/**
 * ============================================================================
 * FILE SCANNER SERVICE — Antivirus optionnel des uploads Helm Connect (V5, chantier 5)
 * ============================================================================
 *
 * Scan AVANT sauvegarde des pièces jointes de messages (et tout upload passé
 * au scanner). Deux moteurs OPTIONNELS — si aucun n'est configuré, le
 * comportement par défaut est INCHANGÉ (fichier accepté, log « scan skipped »).
 *
 * 1) VirusTotal (cloud, env VIRUSTOTAL_API_KEY) :
 *    - calcule le SHA-256 du fichier ;
 *    - GET https://www.virustotal.com/api/v3/files/{sha256} d'abord (rapport
 *      déjà connu → zéro upload) ;
 *    - si inconnu → POST multipart https://www.virustotal.com/api/v3/files
 *      (timeout 20 s) puis re-poll léger du rapport ;
 *    - refuse si stats.malicious > 0.
 *
 * 2) ClamAV (réseau, env CLAMAV_HOST + CLAMAV_PORT) :
 *    - ping TCP, protocole INSTREAM simple : "zINSTREAM\0" puis chunks
 *      <taille:uint32 BE><données 32 Ko> terminés par un chunk de taille 0 ;
 *    - réponse "stream: OK" → propre, sinon (ex: "FOUND") → infecté ;
 *    - taille max 25 Mo (limite INSTREAM standard) ;
 *    - toute erreur → skip (best effort, jamais bloquant pour l'upload).
 *
 * HTTP natif fetch — AUCUNE dépendance SDK installée.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import * as net from 'net';

export interface ScanResult {
  scanned: boolean; // un moteur a réellement scanné le fichier
  clean: boolean; // false → malware détecté → refuser (415)
  engine: 'virustotal' | 'clamav' | 'none';
  details?: string; // nom du malware / résumé
  sha256?: string;
}

/** Limite ClamAV INSTREAM : 25 Mo par défaut. */
const CLAMAV_MAX_BYTES = 25 * 1024 * 1024;
/** Taille des chunks INSTREAM : 32 Ko. */
const CLAMAV_CHUNK_SIZE = 32 * 1024;
/** Timeouts réseau (ms). */
const VIRUSTOTAL_TIMEOUT_MS = 20_000;
const CLAMAV_TIMEOUT_MS = 20_000;

@Injectable()
export class FileScannerService {
  private readonly logger = new Logger(FileScannerService.name);
  private readonly virustotalKey: string | undefined;
  private readonly clamavHost: string | undefined;
  private readonly clamavPort: number | undefined;

  constructor(private readonly configService: ConfigService) {
    this.virustotalKey = this.configService.get<string>('VIRUSTOTAL_API_KEY') || undefined;
    this.clamavHost = this.configService.get<string>('CLAMAV_HOST') || undefined;
    const port = this.configService.get<string>('CLAMAV_PORT');
    this.clamavPort = port ? parseInt(port, 10) : undefined;
    if (this.virustotalKey)
      this.logger.log('✅ Antivirus VirusTotal activé (VIRUSTOTAL_API_KEY détectée)');
    if (this.clamavHost && this.clamavPort)
      this.logger.log(`✅ Antivirus ClamAV activé (${this.clamavHost}:${this.clamavPort})`);
  }

  /**
   * Scan optionnel d'un fichier uploadé. Ordre : VirusTotal puis ClamAV.
   * Retourne { clean: false } SEULEMENT sur détection POSITIVE certaine.
   * Toute erreur réseau/protocole → skip (clean, pas scanned).
   */
  async scanFile(file: {
    buffer: Buffer;
    originalname: string;
    mimetype?: string;
  }): Promise<ScanResult> {
    // 1. VirusTotal (priorité : verdict multi-moteurs, cache par hash)
    if (this.virustotalKey) {
      try {
        const vt = await this.scanWithVirusTotal(file.buffer);
        if (vt.scanned) return vt; // verdict (positif OU négatif) → on s'arrête
      } catch (e: any) {
        this.logger.warn(`scanWithVirusTotal échoué (${e.message}) — bascule ClamAV/skip`);
      }
    }

    // 2. ClamAV (si configuré — même si VT a échoué en erreur)
    if (this.clamavHost && this.clamavPort) {
      try {
        const clam = await this.scanWithClamAv(file.buffer);
        if (clam.scanned) return clam;
      } catch (e: any) {
        this.logger.warn(`scanWithClamAv échoué (${e.message}) — skip`);
      }
    }

    // 3. Aucun moteur configuré/disponible → comportement par défaut inchangé
    this.logger.log(
      `scan skipped: aucun moteur antivirus disponible pour « ${file.originalname} » ` +
        `(VIRUSTOTAL_API_KEY=${this.virustotalKey ? 'oui' : 'non'}, CLAMAV=${this.clamavHost ? 'oui' : 'non'})`,
    );
    return { scanned: false, clean: true, engine: 'none' };
  }

  // ═════════════════════════════════════════════════════════════════
  //  VIRUSTOTAL (API v3 — fetch natif)
  // ═════════════════════════════════════════════════════════════════

  private async scanWithVirusTotal(buffer: Buffer): Promise<ScanResult> {
    const sha256 = createHash('sha256').update(buffer).digest('hex');

    // 1) Rapport déjà connu ? (aucun upload nécessaire)
    const report = await this.vtGetReport(sha256);
    if (report) return this.vtVerdict(sha256, report);

    // 2) Inconnu → upload multipart (timeout 20 s)
    const uploaded = await this.vtUploadFile(buffer, sha256);
    if (uploaded) {
      // Petit délai d'analyse cloud, puis re-poll du rapport (2 essais)
      for (const delayMs of [2000, 5000]) {
        await this.sleep(delayMs);
        const report2 = await this.vtGetReport(sha256);
        if (report2) return this.vtVerdict(sha256, report2);
      }
      // Analyse encore en cours → ne pas bloquer l'upload (fail-open) :
      // VT analyse en arrière-plan, le hash sera connu la prochaine fois.
      this.logger.warn(
        `VirusTotal : analyse en cours pour ${sha256} — fichier accepté (fail-open)`,
      );
      return {
        scanned: false,
        clean: true,
        engine: 'virustotal',
        sha256,
        details: 'analyse en cours',
      };
    }

    // Upload échoué (quota/réseau) → skip silencieux
    return { scanned: false, clean: true, engine: 'virustotal', sha256 };
  }

  /** GET /files/{sha256} — null si inconnu (404) ou erreur. */
  private async vtGetReport(sha256: string): Promise<any | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VIRUSTOTAL_TIMEOUT_MS);
    try {
      const res = await fetch(`https://www.virustotal.com/api/v3/files/${sha256}`, {
        method: 'GET',
        headers: { 'x-apikey': this.virustotalKey! },
        signal: controller.signal as any,
      });
      if (res.status === 404) return null; // hash inconnu
      if (!res.ok) {
        this.logger.warn(`VirusTotal GET report ${res.status} — skip`);
        return null;
      }
      const data = (await res.json()) as any;
      return data?.data?.attributes || null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** POST multipart /files — true si l'upload a été accepté. */
  private async vtUploadFile(buffer: Buffer, sha256: string): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VIRUSTOTAL_TIMEOUT_MS);
    try {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(buffer)]), `upload-${sha256.substring(0, 12)}`);
      const res = await fetch(`https://www.virustotal.com/api/v3/files`, {
        method: 'POST',
        headers: { 'x-apikey': this.virustotalKey! },
        body: form,
        signal: controller.signal as any,
      });
      if (!res.ok) {
        this.logger.warn(`VirusTotal upload ${res.status} — skip`);
        return false;
      }
      return true;
    } catch (e: any) {
      this.logger.warn(`VirusTotal upload échoué: ${e.message}`);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Traduit les stats VirusTotal en verdict Helm Connect. */
  private vtVerdict(sha256: string, attributes: any): ScanResult {
    const stats = attributes?.last_analysis_stats || {};
    const malicious = Number(stats.malicious || 0) + Number(stats['malicious' as any] || 0);
    if (malicious > 0) {
      const detected = (attributes?.last_analysis_results &&
        Object.values(attributes.last_analysis_results as any).find(
          (r: any) => r?.category === 'malicious',
        )) as any;
      return {
        scanned: true,
        clean: false,
        engine: 'virustotal',
        sha256,
        details: detected?.result || `${malicious} moteur(s) antivirus détectent un malware`,
      };
    }
    return {
      scanned: true,
      clean: true,
      engine: 'virustotal',
      sha256,
      details: 'aucun moteur ne détecte de malware',
    };
  }

  // ═════════════════════════════════════════════════════════════════
  //  CLAMAV (protocole INSTREAM — module net natif)
  // ═════════════════════════════════════════════════════════════════

  private async scanWithClamAv(buffer: Buffer): Promise<ScanResult> {
    if (buffer.length > CLAMAV_MAX_BYTES) {
      // Trop gros pour INSTREAM → on ne bloque pas (les gros fichiers média
      // passent par les limites multer 50 Mo) mais on le signale.
      this.logger.warn(`ClamAV : fichier > ${CLAMAV_MAX_BYTES} o non scanné (limite INSTREAM)`);
      return {
        scanned: false,
        clean: true,
        engine: 'clamav',
        details: 'fichier trop volumineux pour INSTREAM',
      };
    }
    const response = await this.clamavInstream(buffer);
    if (response.startsWith('stream: OK')) {
      return { scanned: true, clean: true, engine: 'clamav', details: 'stream: OK' };
    }
    // ex: "stream: Eicar-Signature FOUND"
    const signature = response.replace('stream:', '').replace('FOUND', '').trim();
    return {
      scanned: true,
      clean: false,
      engine: 'clamav',
      details: signature || 'malware détecté',
    };
  }

  /** Implémentation minimale du protocole INSTREAM (chunk 32 Ko, taille max 25 Mo). */
  private clamavInstream(buffer: Buffer): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const socket = net.createConnection({ host: this.clamavHost!, port: this.clamavPort! });
      let response = '';
      const chunks: Buffer[] = [];

      const fail = (err: Error) => {
        socket.destroy();
        reject(err);
      };

      socket.setTimeout(CLAMAV_TIMEOUT_MS);
      socket.on('timeout', () => fail(new Error('timeout ClamAV')));
      socket.on('error', (err) => fail(err));

      socket.on('connect', () => {
        // En-tête protocole : "zINSTREAM\0"
        socket.write(Buffer.concat([Buffer.from('zINSTREAM\0', 'ascii')]));
        // Données par chunks de 32 Ko : <taille:uint32 BE><données>
        for (let offset = 0; offset < buffer.length; offset += CLAMAV_CHUNK_SIZE) {
          const chunk = buffer.subarray(
            offset,
            Math.min(offset + CLAMAV_CHUNK_SIZE, buffer.length),
          );
          const header = Buffer.alloc(4);
          header.writeUInt32BE(chunk.length, 0);
          chunks.push(Buffer.concat([header, chunk]));
        }
        // Chunk de taille 0 = fin de flux
        const zero = Buffer.alloc(4);
        zero.writeUInt32BE(0, 0);
        chunks.push(zero);
        // Écriture séquentielle avec backpressure simple
        const writeNext = (i: number) => {
          if (i >= chunks.length) return;
          if (socket.write(chunks[i])) writeNext(i + 1);
          else socket.once('drain', () => writeNext(i + 1));
        };
        writeNext(0);
      });

      socket.on('data', (data: Buffer) => {
        response += data.toString('ascii').replace(/\0/g, '');
        // La réponse se termine par \0 — verdict complet
        if (response.includes('OK') || response.includes('FOUND') || response.includes('ERROR')) {
          socket.end();
          resolve(response.trim());
        }
      });

      socket.on('close', () => {
        if (response.trim().length > 0) resolve(response.trim());
        else reject(new Error('connexion ClamAV fermée sans réponse'));
      });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
