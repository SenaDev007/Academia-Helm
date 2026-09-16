/**
 * ============================================================================
 * DOCUMENT SEALS SERVICE — Cachets & signatures officiels pour les documents
 * ============================================================================
 *
 * ⭐ 2026-09-16 — Application AUTOMATIQUE des cachets et signatures sur :
 *   - Bulletins (module Examen) : cachet circulaire nominatif « DIRECTEUR » +
 *     cachet nominatif rectangulaire (nom + poste) + signature du directeur ;
 *   - Cahiers journaux (module Pédagogie) : même trio sur le visa directeur ;
 *   - Reçus de paiement (module Finance) : nom du trésorier (comptable /
 *     secrétaire-comptable, déjà paramétré dans RH > Administration) +
 *     cachet comptable + signature.
 *
 * Réutilisation du MÊME moteur de génération que le module Personnel RH
 * (StampsSignaturesService.generateStampsForStaff : SVG effet encre → PNG
 * Puppeteer transparent) : les cachets manquants sont générés à la volée
 * (une seule fois — les fichiers persistent, identifiés par roleSlug+niveau),
 * puis lus sur disque et convertis en data-URL base64 pour être embarqués
 * dans les HTML Puppeteer des documents.
 *
 * Résolution du titulaire :
 *   DIRECTEUR   → table school_directors (niveau + langue, cf. bulletins)
 *                 puis staff_admin_assignments (DIRECTEUR, DIRECTEUR_ADJOINT,
 *                 PROVISEUR, DIRECTEUR_GENERAL actifs) ;
 *   TRÉSORIER   → staff_admin_assignments (COMPTABLE, SECRETAIRE_COMPTABLE,
 *                 ECONOME, INTENDANT actifs) — le poste déjà paramétré dans
 *                 RH > Administration.
 *
 * Signature : school_directors.signatureDataUrl (base64) ou
 * tenant_signatures.signatureUrl (fichier du flux « Lien signature ») →
 * data-URL. Toutes les méthodes sont NON BLOQUANTES : un échec de cachet ne
 * doit jamais empêcher la génération du document (fallback silencieux).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StampsSignaturesService } from './stamps-signatures.service';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface OfficialSeals {
  /** Nom complet du titulaire (directeur / trésorier) */
  holderName: string | null;
  /** Libellé du poste affiché au centre du cachet circulaire nominatif */
  holderRole: string | null;
  /** Signature manuscrite en data-URL base64 (ou null) */
  signatureDataUrl: string | null;
  /** Cachet circulaire NOMINATIF (rôle au centre) — data-URL base64 */
  nominativeCircularDataUrl: string | null;
  /** Cachet rectangulaire nominatif (nom + poste) — data-URL base64 */
  nominativeRectangularDataUrl: string | null;
  /** Cachet circulaire institutionnel de l'école — data-URL base64 */
  institutionalCircularDataUrl: string | null;
}

const EMPTY_SEALS: OfficialSeals = {
  holderName: null,
  holderRole: null,
  signatureDataUrl: null,
  nominativeCircularDataUrl: null,
  nominativeRectangularDataUrl: null,
  institutionalCircularDataUrl: null,
};

/** Slug identique au moteur RH (NFD, accents retirés, non-alnum → tirets) */
function roleSlug(role: string): string {
  return (role || 'role')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Normalisation floue des rôles texte libre de tenant_signatures */
function normalizeRole(role: string): string {
  return (role || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}

const DIRECTOR_ROLE_CODES = ['DIRECTEUR', 'DIRECTEUR_ADJOINT', 'DIRECTEUR_GENERAL', 'PROVISEUR'];
const ACCOUNTANT_ROLE_CODES = ['COMPTABLE', 'SECRETAIRE_COMPTABLE', 'ECONOME', 'INTENDANT'];

const ROLE_LABELS: Record<string, string> = {
  DIRECTEUR: 'DIRECTEUR',
  DIRECTEUR_ADJOINT: 'DIRECTEUR ADJOINT',
  DIRECTEUR_GENERAL: 'DIRECTEUR GÉNÉRAL',
  PROVISEUR: 'PROVISEUR',
  COMPTABLE: 'COMPTABLE',
  SECRETAIRE_COMPTABLE: 'SECRÉTAIRE-COMPTABLE',
  ECONOME: 'ÉCONOME',
  INTENDANT: 'INTENDANT',
};

@Injectable()
export class DocumentSealsService {
  private readonly logger = new Logger(DocumentSealsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stampsService: StampsSignaturesService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  //  Lectures disque → data-URL
  // ═══════════════════════════════════════════════════════════════════════

  /** Lit un fichier du dossier uploads/ et le renvoie en data-URL base64. */
  private async fileToDataUrl(relativePath: string | null | undefined): Promise<string | null> {
    if (!relativePath) return null;
    try {
      const clean = String(relativePath).replace(/^\/+/, '');
      // Une data-URL ou une URL absolue est renvoyée telle quelle
      if (clean.startsWith('data:')) return clean;
      if (/^https?:\/\//.test(clean)) return clean;
      const abs = path.join(process.cwd(), clean);
      const buf = await fs.readFile(abs);
      const ext = path.extname(clean).toLowerCase().replace('.', '') || 'png';
      const mime = ext === 'jpg' ? 'jpeg' : ext;
      return `data:image/${mime};base64,${buf.toString('base64')}`;
    } catch {
      return null;
    }
  }

  private async fileExists(absPath: string): Promise<boolean> {
    try { await fs.access(absPath); return true; } catch { return false; }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Cachets nominatifs — génération à la demande (même moteur que RH)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Renvoie les 2 cachets nominatifs (circulaire rôle + rectangulaire nom)
   * en data-URL. Génère les PNG s'ils n'existent pas encore — via le MÊME
   * moteur que RH > Administration (generateStampsForStaff). Non bloquant.
   */
  private async getNominativeSeals(
    tenantId: string,
    holderName: string,
    holderRole: string,
    educationLevelId: string | null,
  ): Promise<{ circular: string | null; rectangular: string | null }> {
    const levelFolder = educationLevelId ?? 'global';
    const slug = roleSlug(holderRole);
    const baseDir = path.join(process.cwd(), 'uploads/tenant-stamps', tenantId, levelFolder, 'nominative');
    const circularAbs = path.join(baseDir, `${slug}-circular.png`);
    const rectangularAbs = path.join(baseDir, `${slug}.png`);

    try {
      const [circularOk, rectangularOk] = await Promise.all([
        this.fileExists(circularAbs),
        this.fileExists(rectangularAbs),
      ]);
      if (!circularOk || !rectangularOk) {
        // ⭐ Génération à la demande — une seule fois (fichiers persistants).
        //    Silencieuse si le profil d'identité n'existe pas (cachet absent).
        await this.stampsService.generateStampsForStaff(tenantId, holderName, holderRole, educationLevelId);
      }
    } catch (e: any) {
      this.logger.warn(`Génération cachets nominatifs ignorée (${holderRole}): ${e.message}`);
    }

    const [circular, rectangular] = await Promise.all([
      this.fileToDataUrl(`uploads/tenant-stamps/${tenantId}/${levelFolder}/nominative/${slug}-circular.png`),
      this.fileToDataUrl(`uploads/tenant-stamps/${tenantId}/${levelFolder}/nominative/${slug}.png`),
    ]);
    return { circular, rectangular };
  }

  /** Cachet circulaire institutionnel (école) du niveau, sinon global. */
  private async getInstitutionalCircular(
    tenantId: string,
    educationLevelId: string | null,
  ): Promise<string | null> {
    try {
      const row = educationLevelId
        ? (await this.prisma.tenantStamp.findUnique({
            where: { tenantId_educationLevelId: { tenantId, educationLevelId } },
          })) ?? (await this.prisma.tenantStamp.findFirst({ where: { tenantId, educationLevelId: null } }))
        : await this.prisma.tenantStamp.findFirst({ where: { tenantId, educationLevelId: null } });
      return await this.fileToDataUrl(row?.circularStampUrl ?? null);
    } catch {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Signatures persistées (tenant_signatures — flux « Lien signature »)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Cherche la signature persistée dont le rôle correspond au matcher,
   * pour le niveau donné (sinon global). Renvoie la data-URL.
   */
  private async findPersistedSignature(
    tenantId: string,
    educationLevelId: string | null,
    roleMatcher: (normalizedRole: string) => boolean,
  ): Promise<string | null> {
    try {
      const rows = await this.prisma.tenantSignature.findMany({
        where: { tenantId },
        select: { role: true, signatureUrl: true, educationLevelId: true },
      });
      const candidates = rows.filter((r) => r.signatureUrl && roleMatcher(normalizeRole(r.role)));
      if (candidates.length === 0) return null;
      // Priorité au niveau exact, sinon global
      const exact = educationLevelId
        ? candidates.find((r) => r.educationLevelId === educationLevelId)
        : undefined;
      const chosen = exact ?? candidates.find((r) => r.educationLevelId === null) ?? candidates[0];
      return await this.fileToDataUrl(chosen?.signatureUrl ?? null);
    } catch {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Résolution des titulaires
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * ⭐ DIRECTEUR — pour les bulletins et cahiers journaux.
   * Source principale : school_directors (niveau + langue, avec repli sur
   * l'autre langue — même logique que bulletins.controller). Repli :
   * staff_admin_assignments (poste DIRECTEUR actif).
   */
  async getDirectorSeals(
    tenantId: string,
    schoolLevelId?: string | null,
    lang: 'FR' | 'EN' = 'FR',
  ): Promise<OfficialSeals> {
    try {
      let holderName: string | null = null;
      let signatureDataUrl: string | null = null;
      let roleCode = 'DIRECTEUR';

      // 1. school_directors (niveau + langue, avec fallback)
      if (schoolLevelId) {
        const tryLang = async (l: string) => {
          const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT "fullName", "signatureDataUrl", "signatureUploadedUrl", "staffId"
             FROM school_directors
             WHERE "tenantId" = $1 AND "schoolLevelId" = $2 AND "language" = $3 AND "isActive" = true
             LIMIT 1`,
            [tenantId, schoolLevelId, l],
          );
          return rows?.[0] ?? null;
        };
        const director = (await tryLang(lang)) ?? (await tryLang(lang === 'FR' ? 'EN' : 'FR'));
        if (director) {
          holderName = director.fullName || null;
          signatureDataUrl = director.signatureDataUrl || director.signatureUploadedUrl || null;
          if (signatureDataUrl && !String(signatureDataUrl).startsWith('data:')) {
            // signatureUploadedUrl = chemin fichier → data-URL
            signatureDataUrl = await this.fileToDataUrl(signatureDataUrl);
          }
        }
      }

      // 2. Repli : staff_admin_assignments (DIRECTEUR, DIRECTEUR_ADJOINT,
      //    PROVISEUR, DIRECTEUR_GENERAL actifs — niveau correspondant en priorité)
      if (!holderName) {
        const rows = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT s."firstName", s."lastName", a."adminRole"
           FROM staff_admin_assignments a
           JOIN staff s ON s.id = a."staffId"
           WHERE a."tenantId" = $1 AND a."isActive" = true
             AND a."adminRole" = ANY($2::text[])
           ORDER BY a."adminRole" ASC
           LIMIT 1`,
          [tenantId, DIRECTOR_ROLE_CODES],
        );
        if (rows?.[0]) {
          holderName = `${rows[0].firstName ?? ''} ${rows[0].lastName ?? ''}`.trim() || null;
          roleCode = rows[0].adminRole;
        }
      }

      if (!holderName) return { ...EMPTY_SEALS };

      // 3. Signature : school_directors d'abord, sinon signature persistée
      //    (tenant_signatures — rôle « Directeur* » signé via lien email)
      if (!signatureDataUrl) {
        signatureDataUrl = await this.findPersistedSignature(
          tenantId, schoolLevelId ?? null,
          (r) => r.startsWith('directeur') || r.startsWith('proviseur'),
        );
      }

      // 4. Cachets nominatifs (générés à la demande) + institutionnel
      const holderRole = ROLE_LABELS[roleCode] || 'DIRECTEUR';
      const [nominative, institutional] = await Promise.all([
        this.getNominativeSeals(tenantId, holderName, holderRole, schoolLevelId ?? null),
        this.getInstitutionalCircular(tenantId, schoolLevelId ?? null),
      ]);

      return {
        holderName,
        holderRole,
        signatureDataUrl,
        nominativeCircularDataUrl: nominative.circular,
        nominativeRectangularDataUrl: nominative.rectangular,
        institutionalCircularDataUrl: institutional,
      };
    } catch (e: any) {
      this.logger.warn(`getDirectorSeals non bloquant : ${e.message}`);
      return { ...EMPTY_SEALS };
    }
  }

  /**
   * ⭐ TRÉSORIER (comptable / secrétaire-comptable / économome / intendant)
   * — pour les reçus de paiement. Le poste est déjà paramétré dans
   * RH > Administration (staff_admin_assignments) : maternelle, primaire,
   * secondaire — on résout le titulaire du niveau correspondant.
   */
  async getAccountantSeals(
    tenantId: string,
    schoolLevelId?: string | null,
  ): Promise<OfficialSeals> {
    try {
      // Mapper school_levels.code → code admin (MAT/PRI/SEC/MAT_PRI)
      let levelCode: string | null = null;
      if (schoolLevelId) {
        const level = await this.prisma.schoolLevel.findUnique({
          where: { id: schoolLevelId },
          select: { code: true },
        });
        const code = level?.code;
        if (code === 'MATERNELLE') levelCode = 'MAT';
        else if (code === 'PRIMAIRE') levelCode = 'PRI';
        else if (code === 'SECONDAIRE') levelCode = 'SEC';
      }

      // Titulaire du poste comptable : priorité au niveau exact (MAT/PRI/SEC
      // ou MAT_PRI qui couvre MAT+PRI), sinon MAT_PRI/ALL, sinon n'importe quel.
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT s."firstName", s."lastName", s.email, a."adminRole", a."schoolLevelCode"
         FROM staff_admin_assignments a
         JOIN staff s ON s.id = a."staffId"
         WHERE a."tenantId" = $1 AND a."isActive" = true
           AND a."adminRole" = ANY($2::text[])
         ORDER BY
           CASE
             WHEN a."schoolLevelCode" = $3 THEN 0
             WHEN a."schoolLevelCode" = 'MAT_PRI' AND $3 IN ('MAT','PRI') THEN 1
             WHEN a."schoolLevelCode" = 'ALL' THEN 2
             ELSE 3
           END ASC,
           CASE a."adminRole"
             WHEN 'SECRETAIRE_COMPTABLE' THEN 0
             WHEN 'COMPTABLE' THEN 1
             ELSE 2
           END ASC
         LIMIT 1`,
        [tenantId, ACCOUNTANT_ROLE_CODES, levelCode ?? ''],
      );

      const row = rows?.[0];
      if (!row) return { ...EMPTY_SEALS };

      const holderName = `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim();
      if (!holderName) return { ...EMPTY_SEALS };

      const roleCode: string = row.adminRole;
      const holderRole = ROLE_LABELS[roleCode] || 'COMPTABLE';

      // Signature persistée (tenant_signatures — « Lien signature » RH)
      const signatureDataUrl = await this.findPersistedSignature(
        tenantId, schoolLevelId ?? null,
        (r) => r.includes('comptable') || r.includes('econome') || r.includes('intendant') || r.includes('tresorier'),
      );

      const [nominative, institutional] = await Promise.all([
        this.getNominativeSeals(tenantId, holderName, holderRole, schoolLevelId ?? null),
        this.getInstitutionalCircular(tenantId, schoolLevelId ?? null),
      ]);

      return {
        holderName,
        holderRole,
        signatureDataUrl,
        nominativeCircularDataUrl: nominative.circular,
        nominativeRectangularDataUrl: nominative.rectangular,
        institutionalCircularDataUrl: institutional,
      };
    } catch (e: any) {
      this.logger.warn(`getAccountantSeals non bloquant : ${e.message}`);
      return { ...EMPTY_SEALS };
    }
  }
}
