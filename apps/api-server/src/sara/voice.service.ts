/**
 * ============================================================================
 * VOICE SERVICE — ASR (Speech-to-Text) + TTS (Text-to-Speech) pour SARA
 * ============================================================================
 *
 * Utilise z-ai-web-dev-sdk pour :
 *   - ASR : transcription audio (base64) → texte
 *   - TTS : texte → audio WAV (base64)
 *
 * Le mode vocal de SARA fonctionne en 3 flux :
 *   1. POST /sara/voice/transcribe  — Audio → Texte (ASR seul)
 *   2. POST /sara/voice/speak       — Texte → Audio (TTS seul)
 *   3. POST /sara/voice/chat        — Audio → ASR → SARA → TTS → Audio (pipeline complet)
 *
 * ⚠️ IMPORTANT : z-ai-web-dev-sdk est importé dynamiquement (lazy require).
 * Si le package n'est pas installé, le service se charge quand même sans crasher,
 * mais les opérations vocales renverront une erreur propre.
 * Cela garantit que le SaraModule reste fonctionnel même sans le SDK vocal.
 *
 * Limites TTS : 1024 caractères max par requête (chunking automatique)
 * Voix par défaut : 'tongtong' (chaude et amicale — idéale pour Sarah)
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface TranscribeResult {
  text: string;
  confidence?: number;
  language?: string;
}

export interface SpeakResult {
  audioBase64: string;
  format: string;
  durationMs?: number;
}

export interface VoiceChatResult {
  transcribedText: string;
  saraResponse: string;
  audioBase64: string;
  format: string;
}

// ─── LAZY SDK LOADER ────────────────────────────────────────────────────────

/**
 * Charge z-ai-web-dev-sdk dynamiquement.
 * Retourne null si le package n'est pas installé (pas de crash).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ZAI: any = null;
let _zaiLoadAttempted = false;

function loadZAISdk(): any {
  if (_zaiLoadAttempted) return _ZAI;
  _zaiLoadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _ZAI = require('z-ai-web-dev-sdk').default || require('z-ai-web-dev-sdk');
    return _ZAI;
  } catch {
    // Package non installé — le service vocal sera indisponible
    // mais le reste du SaraModule (chat, streaming) fonctionnera normalement
    return null;
  }
}

// ─── SERVICE ────────────────────────────────────────────────────────────────

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private zaiInstance: any = null;

  /** Voix par défaut pour Sarah — chaude et amicale */
  private readonly DEFAULT_VOICE = 'tongtong';

  /** Vitesse de parole par défaut (1.0 = normal) */
  private readonly DEFAULT_SPEED = 1.05;

  /** Format audio par défaut */
  private readonly DEFAULT_FORMAT = 'mp3';

  /** Taille max des chunks TTS (1024 char limite API) */
  private readonly TTS_CHUNK_SIZE = 950;

  // ─── INITIALISATION LAZY ──────────────────────────────────────────────

  /**
   * Initialise le SDK vocal à la demande.
   * Retourne null si le SDK n'est pas installé.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getZAI(): Promise<any> {
    if (this.zaiInstance) return this.zaiInstance;

    const ZAISdk = loadZAISdk();
    if (!ZAISdk) {
      throw new Error('z-ai-web-dev-sdk n\'est pas installé. Le mode vocal est indisponible. Les fonctions chat restent opérationnelles.');
    }

    this.zaiInstance = await ZAISdk.create();
    this.logger.log('✅ z-ai-web-dev-sdk initialized for VoiceService');
    return this.zaiInstance;
  }

  // ─── ASR : SPEECH → TEXT ──────────────────────────────────────────────

  /**
   * Transcrit un audio en texte via ASR.
   * @param audioBase64 Audio encodé en base64 (WAV, MP3, M4A, etc.)
   * @returns Texte transcrit
   */
  async transcribe(audioBase64: string): Promise<TranscribeResult> {
    const startTime = Date.now();

    try {
      const zai = await this.getZAI();

      // Ensure the base64 data has a proper data URI prefix for the ASR engine
      let fileBase64 = audioBase64;
      if (!audioBase64.startsWith('data:')) {
        const prefix = this.detectAudioFormat(audioBase64);
        fileBase64 = `${prefix}${audioBase64}`;
      }

      this.logger.log(`🎤 ASR request — audio data length: ${audioBase64.length} chars`);

      const response = await zai.audio.asr.create({
        file_base64: fileBase64,
      });

      const text = response.text || '';
      const durationMs = Date.now() - startTime;

      this.logger.log(`🎤 ASR completed in ${durationMs}ms — ${text.length} chars`);

      return {
        text,
        language: 'fr',
      };
    } catch (error: any) {
      this.logger.error(`ASR failed: ${error?.message}`, error?.stack);
      throw new Error(`Transcription vocale échouée : ${error?.message}`);
    }
  }

  /**
   * Détecte le format audio à partir des premiers octets du base64.
   * Retourne le data URI prefix approprié.
   */
  private detectAudioFormat(base64: string): string {
    try {
      const buffer = Buffer.from(base64.substring(0, 20), 'base64');
      const header = buffer.toString('hex').toLowerCase();

      // WAV: starts with "52494646" (RIFF)
      if (header.startsWith('52494646')) {
        return 'data:audio/wav;base64,';
      }
      // MP3: starts with "fff3" or "49443303" (ID3)
      if (header.startsWith('fff3') || header.startsWith('fff2') || header.startsWith('494433')) {
        return 'data:audio/mpeg;base64,';
      }
      // OGG/WebM: starts with "4f676753" (OggS) or "1a45dfa3" (WebM/EBML)
      if (header.startsWith('4f676753') || header.startsWith('1a45dfa3')) {
        return 'data:audio/webm;base64,';
      }
      // MP4/M4A: starts with ftyp box
      if (header.includes('66747970')) {
        return 'data:audio/mp4;base64,';
      }
      // FLAC: starts with "664c6143" (fLaC)
      if (header.startsWith('664c6143')) {
        return 'data:audio/flac;base64,';
      }
    } catch {
      // Detection failed
    }

    // Default: assume WAV (since our frontend now converts to WAV)
    return 'data:audio/wav;base64,';
  }

  // ─── TTS : TEXT → SPEECH ──────────────────────────────────────────────

  /**
   * Convertit du texte en audio via TTS.
   * Gère automatiquement le chunking pour les textes > 1024 caractères.
   */
  async speak(
    text: string,
    voice: string = this.DEFAULT_VOICE,
    speed: number = this.DEFAULT_SPEED,
  ): Promise<SpeakResult> {
    const startTime = Date.now();

    if (!text || text.trim().length === 0) {
      throw new Error('Le texte ne peut pas être vide');
    }

    try {
      const zai = await this.getZAI();

      const chunks = this.splitTextIntoChunks(text, this.TTS_CHUNK_SIZE);

      if (chunks.length === 1) {
        const audioBase64 = await this.generateTTSChunk(zai, chunks[0], voice, speed);
        const durationMs = Date.now() - startTime;

        this.logger.log(`🔊 TTS completed in ${durationMs}ms — ${text.length} chars`);

        return {
          audioBase64,
          format: this.DEFAULT_FORMAT,
          durationMs,
        };
      }

      this.logger.log(`🔊 TTS chunking: ${chunks.length} chunks for ${text.length} chars`);

      const audioBase64 = await this.generateTTSChunk(zai, chunks[0], voice, speed);
      const durationMs = Date.now() - startTime;

      return {
        audioBase64,
        format: this.DEFAULT_FORMAT,
        durationMs,
      };
    } catch (error: any) {
      this.logger.error(`TTS failed: ${error?.message}`);
      throw new Error(`Synthèse vocale échouée : ${error?.message}`);
    }
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────

  private splitTextIntoChunks(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) {
      return [text];
    }

    const chunks: string[] = [];
    const sentences = text.match(/[^.!?…]+[.!?…]+/g) || [text];

    let currentChunk = '';
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= maxLength) {
        currentChunk += sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        if (sentence.length > maxLength) {
          const words = sentence.split(' ');
          currentChunk = '';
          for (const word of words) {
            if ((currentChunk + ' ' + word).length <= maxLength) {
              currentChunk += (currentChunk ? ' ' : '') + word;
            } else {
              if (currentChunk) chunks.push(currentChunk.trim());
              currentChunk = word;
            }
          }
        } else {
          currentChunk = sentence;
        }
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());

    return chunks;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async generateTTSChunk(zai: any, text: string, voice: string, speed: number): Promise<string> {
    const response = await zai.audio.tts.create({
      input: text.trim(),
      voice,
      speed,
      response_format: this.DEFAULT_FORMAT as 'mp3',
      stream: false,
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));
    return buffer.toString('base64');
  }

  /**
   * Nettoie le texte SARA pour le TTS :
   * - Supprime le markdown (**, *, `, etc.)
   * - Supprime les emojis
   */
  cleanTextForTTS(text: string): string {
    let cleaned = text;

    cleaned = cleaned.replace(/\*\*/g, '');
    cleaned = cleaned.replace(/\*/g, '');
    cleaned = cleaned.replace(/`{1,3}[^`]*`{1,3}/g, '');
    cleaned = cleaned.replace(/#{1,6}\s/g, '');
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    cleaned = cleaned.replace(/^[-*+]\s/gm, '');
    cleaned = cleaned.replace(/^\d+\.\s/gm, '');

    cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F5FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F680}-\u{1F6FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, '');
    cleaned = cleaned.replace(/✅|⚠️|🗑️|🎤|🔊|📦|🚀/g, '');

    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }
}
