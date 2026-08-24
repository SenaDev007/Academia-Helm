/**
 * ============================================================================
 * CHAT TRANSCRIPTION SERVICE — Whisper-powered audio transcriptions (V3-2)
 * ============================================================================
 *
 * Transcrit les messages vocaux (audio) en texte via l'API OpenAI Whisper
 * (ou tout endpoint compatible OpenAI Speech-to-Text).
 *
 * Rôle : appelé par `POST /chat/messages/:id/transcribe`. Prend un message
 * de type AUDIO, récupère le fichier, l'envoie à Whisper, stocke la
 * transcription dans `chat_messages.transcription`, et la retourne.
 *
 * Configuration (par ordre de priorité) :
 *   - OPENAI_API_KEY            : clé API OpenAI (utilise api.openai.com)
 *   - WHISPER_API_KEY           : clé API alternative (utilise WHISPER_BASE_URL)
 *   - WHISPER_BASE_URL          : URL alternative (défaut: https://api.openai.com/v1)
 *   - WHISPER_MODEL             : modèle (défaut: whisper-1)
 *   - WHISPER_LANGUAGE          : langue forcée (défaut: fr)
 *
 * Pattern :
 *   - Cache persistant : si `transcription` déjà présent → retourne direct
 *   - Fallback sans API : si aucune clé configurée → retourne un message
 *     informatif indiquant que la transcription n'est pas disponible
 *   - Multi-tenant strict : tenantId filtré
 *
 * Réutilise le pattern d'appel HTTP de OrionAiService + StorageService pour
 * récupérer le fichier audio.
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/services/storage.service';

export interface TranscriptionResult {
  messageId: string;
  transcription: string;
  language: string;
  duration?: number; // seconds
  cached: boolean; // true if transcription was already stored
  usingWhisper: boolean; // false if fallback
}

@Injectable()
export class ChatTranscriptionService {
  private readonly logger = new Logger(ChatTranscriptionService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly language: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey =
      this.configService.get<string>('OPENAI_API_KEY') ||
      this.configService.get<string>('WHISPER_API_KEY') ||
      '';
    this.baseUrl =
      this.configService.get<string>('WHISPER_BASE_URL') ||
      'https://api.openai.com/v1';
    this.model =
      this.configService.get<string>('WHISPER_MODEL') ||
      'whisper-1';
    this.language =
      this.configService.get<string>('WHISPER_LANGUAGE') ||
      'fr';
  }

  /**
   * Transcrit un message audio en texte.
   *
   * @param tenantId Le tenant (multi-tenant strict)
   * @param messageId L'ID du message audio à transcrire
   */
  async transcribeMessage(
    tenantId: string,
    messageId: string,
  ): Promise<TranscriptionResult> {
    // 1. Récupérer le message
    const messages = await this.prisma.$queryRawUnsafe<Array<any>>(
      `SELECT id, "conversationId", "senderId", type, content, "attachmentUrl",
              "transcription", "transcribedAt", "transcriptionLanguage"
       FROM "chat_messages" WHERE id = $1`,
      messageId,
    );
    const msg = messages[0];
    if (!msg) {
      throw new NotFoundException(`Message with ID ${messageId} not found`);
    }

    // 2. Vérifier multi-tenant
    const convs = await this.prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "tenantId" FROM "chat_conversations" WHERE id = $1`,
      msg.conversationId,
    );
    if (!convs[0] || convs[0].tenantId !== tenantId) {
      throw new NotFoundException(`Message not found in tenant ${tenantId}`);
    }

    // 3. Si déjà transcrit → retourne du cache
    if (msg.transcription) {
      return {
        messageId,
        transcription: msg.transcription,
        language: msg.transcriptionLanguage || this.language,
        cached: true,
        usingWhisper: true, // we assume it was transcribed by Whisper originally
      };
    }

    // 4. Vérifier que c'est bien un message audio
    if (msg.type !== 'AUDIO' && msg.type !== 'ATTACHMENT') {
      return {
        messageId,
        transcription: '',
        language: this.language,
        cached: false,
        usingWhisper: false,
      };
    }

    // 5. Récupérer l'URL du fichier audio
    const audioUrl = msg.attachmentUrl || msg.content;
    if (!audioUrl) {
      return {
        messageId,
        transcription: 'Aucun fichier audio trouvé pour ce message.',
        language: this.language,
        cached: false,
        usingWhisper: false,
      };
    }

    // 6. Si pas de clé API configurée → fallback
    if (!this.apiKey) {
      this.logger.warn('OPENAI_API_KEY / WHISPER_API_KEY not configured — transcription unavailable');
      const fallbackText = 'Transcription non disponible. L\'administrateur doit configurer la clé API OpenAI/Whisper.';
      await this.storeTranscription(messageId, fallbackText, this.language);
      return {
        messageId,
        transcription: fallbackText,
        language: this.language,
        cached: false,
        usingWhisper: false,
      };
    }

    // 7. Télécharger le fichier audio
    try {
      const audioBuffer = await this.downloadAudio(audioUrl);
      if (!audioBuffer) {
        throw new Error('Failed to download audio file');
      }

      // 8. Envoyer à Whisper
      const transcription = await this.callWhisper(audioBuffer, this.getFileName(audioUrl));
      if (!transcription) {
        throw new Error('Empty transcription from Whisper');
      }

      // 9. Stocker la transcription
      await this.storeTranscription(messageId, transcription, this.language);

      return {
        messageId,
        transcription,
        language: this.language,
        cached: false,
        usingWhisper: true,
      };
    } catch (e: any) {
      this.logger.error(`transcribeMessage failed: ${e.message}`, e.stack);
      const errorText = `Échec de la transcription: ${e.message}`;
      // Ne pas stocker l'erreur comme transcription définitive — on la retourne juste
      return {
        messageId,
        transcription: errorText,
        language: this.language,
        cached: false,
        usingWhisper: false,
      };
    }
  }

  /**
   * Télécharge le fichier audio depuis le storage (R2 / S3 / local).
   */
  private async downloadAudio(audioUrl: string): Promise<Buffer | null> {
    try {
      // Si c'est une URL publique → fetch direct
      if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
        const response = await fetch(audioUrl);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }
      // Si c'est un chemin local → StorageService
      const buf = await this.storage.downloadFile(audioUrl);
      return buf as any;
    } catch (e: any) {
      this.logger.warn(`downloadAudio failed for ${audioUrl}: ${e.message}`);
      return null;
    }
  }

  /**
   * Appelle l'API Whisper (OpenAI-compatible) avec multipart/form-data.
   */
  private async callWhisper(audioBuffer: Buffer, fileName: string): Promise<string | null> {
    try {
      const url = `${this.baseUrl}/audio/transcriptions`;
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      formData.append('file', blob, fileName || 'audio.mp3');
      formData.append('model', this.model);
      formData.append('language', this.language);
      formData.append('response_format', 'text');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout (audio can be long)
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
        signal: controller.signal as any,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text().catch(() => 'unknown');
        this.logger.warn(`Whisper API error ${response.status}: ${errText}`);
        return null;
      }

      // Whisper renvoie du texte brut avec response_format=text
      const text = (await response.text()).trim();
      return text;
    } catch (e: any) {
      this.logger.error(`callWhisper exception: ${e.message}`, e.stack);
      return null;
    }
  }

  /**
   * Stocke la transcription dans la DB.
   */
  private async storeTranscription(
    messageId: string,
    transcription: string,
    language: string,
  ): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "chat_messages"
         SET "transcription" = $2,
             "transcribedAt" = NOW(),
             "transcriptionLanguage" = $3
         WHERE "id" = $1`,
        messageId,
        transcription,
        language,
      );
    } catch (e: any) {
      this.logger.error(`storeTranscription failed: ${e.message}`, e.stack);
    }
  }

  /**
   * Extrait le nom du fichier depuis l'URL.
   */
  private getFileName(url: string): string {
    try {
      const parts = url.split('/');
      const last = parts[parts.length - 1];
      return last || 'audio.mp3';
    } catch {
      return 'audio.mp3';
    }
  }
}
