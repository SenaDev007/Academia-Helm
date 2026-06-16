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
 * Limites TTS : 1024 caractères max par requête (chunking automatique)
 * Voix par défaut : 'tongtong' (chaude et amicale — idéale pour Sarah)
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import ZAI from 'z-ai-web-dev-sdk';

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

// ─── SERVICE ────────────────────────────────────────────────────────────────

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  private zai: ZAI | null = null;

  /** Voix par défaut pour Sarah — chaude et amicale */
  private readonly DEFAULT_VOICE = 'tongtong';

  /** Vitesse de parole par défaut (1.0 = normal) */
  private readonly DEFAULT_SPEED = 1.05;

  /** Format audio par défaut */
  private readonly DEFAULT_FORMAT = 'mp3';

  /** Taille max des chunks TTS (1024 char limite API) */
  private readonly TTS_CHUNK_SIZE = 950;

  // ─── INITIALISATION LAZY ──────────────────────────────────────────────

  private async getZAI(): Promise<ZAI> {
    if (!this.zai) {
      this.zai = await ZAI.create();
      this.logger.log('✅ z-ai-web-dev-sdk initialized for VoiceService');
    }
    return this.zai;
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
      // The SDK may need it to detect the audio format
      let fileBase64 = audioBase64;
      if (!audioBase64.startsWith('data:')) {
        // Detect format from base64 header bytes
        const prefix = this.detectAudioFormat(audioBase64);
        fileBase64 = `${prefix}${audioBase64}`;
      }

      this.logger.log(`🎤 ASR request — audio data length: ${audioBase64.length} chars, prefix: ${fileBase64.substring(0, 50)}...`);

      const response = await zai.audio.asr.create({
        file_base64: fileBase64,
      });

      const text = response.text || '';
      const durationMs = Date.now() - startTime;

      this.logger.log(`🎤 ASR completed in ${durationMs}ms — ${text.length} chars, text: "${text.substring(0, 100)}"`);

      return {
        text,
        language: 'fr', // SARA parle principalement français
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
   *
   * @param text Texte à convertir en parole
   * @param voice Voix à utiliser (défaut: tongtong)
   * @param speed Vitesse de parole 0.5-2.0 (défaut: 1.05)
   * @returns Audio encodé en base64 (MP3)
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

      // Découper le texte en chunks si nécessaire
      const chunks = this.splitTextIntoChunks(text, this.TTS_CHUNK_SIZE);

      if (chunks.length === 1) {
        // Texte court — une seule requête TTS
        const audioBase64 = await this.generateTTSChunk(chunks[0], voice, speed);
        const durationMs = Date.now() - startTime;

        this.logger.log(`🔊 TTS completed in ${durationMs}ms — ${text.length} chars`);

        return {
          audioBase64,
          format: this.DEFAULT_FORMAT,
          durationMs,
        };
      }

      // Texte long — plusieurs chunks TTS, on retourne le premier chunk
      // (Le frontend fera les requêtes suivantes pour les chunks restants)
      this.logger.log(`🔊 TTS chunking: ${chunks.length} chunks for ${text.length} chars`);

      const audioBase64 = await this.generateTTSChunk(chunks[0], voice, speed);
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

  /**
   * Génère l'audio pour un texte complet (tous les chunks).
   * Retourne un tableau d'audios base64, un par chunk.
   */
  async speakAllChunks(
    text: string,
    voice: string = this.DEFAULT_VOICE,
    speed: number = this.DEFAULT_SPEED,
  ): Promise<{ chunks: string[]; format: string }> {
    const chunks = this.splitTextIntoChunks(text, this.TTS_CHUNK_SIZE);
    const zai = await this.getZAI();
    const audioChunks: string[] = [];

    for (const chunk of chunks) {
      const audioBase64 = await this.generateTTSChunkDirect(zai, chunk, voice, speed);
      audioChunks.push(audioBase64);
    }

    return { chunks: audioChunks, format: this.DEFAULT_FORMAT };
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────

  /**
   * Découpe un texte en chunks de taille maximale, en respectant
   * les fins de phrases pour un rendu TTS naturel.
   */
  private splitTextIntoChunks(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) {
      return [text];
    }

    const chunks: string[] = [];
    // Découper par phrases (., !, ?, …)
    const sentences = text.match(/[^.!?…]+[.!?…]+/g) || [text];

    let currentChunk = '';
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= maxLength) {
        currentChunk += sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        // Si une phrase est plus longue que maxLength, la couper
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

  /**
   * Génère un chunk TTS unique et retourne le base64 du buffer audio.
   */
  private async generateTTSChunk(
    text: string,
    voice: string,
    speed: number,
  ): Promise<string> {
    const zai = await this.getZAI();
    return this.generateTTSChunkDirect(zai, text, voice, speed);
  }

  /**
   * Génère un chunk TTS avec une instance ZAI déjà initialisée.
   */
  private async generateTTSChunkDirect(
    zai: ZAI,
    text: string,
    voice: string,
    speed: number,
  ): Promise<string> {
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
   * - Développe les abréviations courantes
   */
  cleanTextForTTS(text: string): string {
    let cleaned = text;

    // Supprimer les symboles markdown
    cleaned = cleaned.replace(/\*\*/g, ''); // bold
    cleaned = cleaned.replace(/\*/g, '');   // italic
    cleaned = cleaned.replace(/`{1,3}[^`]*`{1,3}/g, ''); // inline code
    cleaned = cleaned.replace(/#{1,6}\s/g, ''); // headings
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // links → text
    cleaned = cleaned.replace(/^[-*+]\s/gm, ''); // bullet points
    cleaned = cleaned.replace(/^\d+\.\s/gm, ''); // numbered lists

    // Supprimer les emojis
    cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F5FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F680}-\u{1F6FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, '');
    cleaned = cleaned.replace(/✅|⚠️|🗑️|🎤|🔊|📦|🚀/g, '');

    // Nettoyer les espaces multiples
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }
}
