import { Controller, Post, Body, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { SaraService } from './sara.service';
import { VoiceService } from './voice.service';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('sara')
export class SaraController {
  constructor(
    private readonly saraService: SaraService,
    private readonly voiceService: VoiceService,
  ) {}

  /**
   * Landing page SARA query (public, Closer Senior #1 mode)
   * Used by the SaraWidget on the landing page
   */
  @Public()
  @Post('query')
  async query(@Body() body: { query: string; visitorId?: string; messages?: Array<{ role: string; content: string }> }) {
    return this.saraService.handleVisitorQuery(body.query, body.visitorId, body.messages);
  }

  /**
   * Landing page SARA streaming query (public, SSE)
   * Used by the SaraWidget for real-time streaming responses
   */
  @Public()
  @Post('query/stream')
  async queryStream(
    @Body() body: { query: string; visitorId?: string; messages?: Array<{ role: string; content: string }> },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Désactiver le buffering Nginx

    try {
      const stream = this.saraService.handleVisitorQueryStream(
        body.query,
        body.visitorId,
        body.messages,
      );

      for await (const chunk of stream) {
        if (chunk.type === 'delta' && chunk.text) {
          res.write(`data: ${JSON.stringify({ type: 'delta', text: chunk.text })}\n\n`);
        } else if (chunk.type === 'reasoning' && chunk.reasoningText) {
          res.write(`data: ${JSON.stringify({ type: 'reasoning', text: chunk.reasoningText })}\n\n`);
        } else if (chunk.type === 'status') {
          res.write(`data: ${JSON.stringify({ type: 'status', text: chunk.text })}\n\n`);
        } else if (chunk.type === 'final') {
          res.write(`data: ${JSON.stringify({ type: 'final', text: chunk.text, usage: chunk.usage })}\n\n`);
        } else if (chunk.type === 'error') {
          res.write(`data: ${JSON.stringify({ type: 'error', text: chunk.text })}\n\n`);
        }
      }
    } catch (error: any) {
      res.write(`data: ${JSON.stringify({ type: 'error', text: error?.message || 'Stream error' })}\n\n`);
    }

    res.end();
  }

  /**
   * In-App SARA query (authenticated, Guide User mode)
   * Used by the InAppSaraGuide and module-specific Sara assistants
   */
  @Post('inapp')
  async inappQuery(
    @Body() body: {
      query: string;
      userId: string;
      schoolId: string;
      userRole?: string;
      currentModule?: string;
      messages?: Array<{ role: string; content: string }>;
    },
  ) {
    return this.saraService.handleInAppQuery(
      body.query,
      body.userId,
      body.schoolId,
      body.userRole,
      body.currentModule,
      body.messages,
    );
  }

  /**
   * In-App SARA streaming query (authenticated, SSE)
   * Used by the InAppSaraGuide for real-time streaming responses
   */
  @UseGuards(JwtAuthGuard)
  @Post('inapp/stream')
  async inappQueryStream(
    @Body() body: {
      query: string;
      userId: string;
      schoolId: string;
      userRole?: string;
      currentModule?: string;
      messages?: Array<{ role: string; content: string }>;
    },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      const stream = this.saraService.handleInAppQueryStream(
        body.query,
        body.userId,
        body.schoolId,
        body.userRole,
        body.currentModule,
        body.messages,
      );

      for await (const chunk of stream) {
        if (chunk.type === 'delta' && chunk.text) {
          res.write(`data: ${JSON.stringify({ type: 'delta', text: chunk.text })}\n\n`);
        } else if (chunk.type === 'reasoning' && chunk.reasoningText) {
          res.write(`data: ${JSON.stringify({ type: 'reasoning', text: chunk.reasoningText })}\n\n`);
        } else if (chunk.type === 'status') {
          res.write(`data: ${JSON.stringify({ type: 'status', text: chunk.text })}\n\n`);
        } else if (chunk.type === 'final') {
          res.write(`data: ${JSON.stringify({ type: 'final', text: chunk.text, usage: chunk.usage })}\n\n`);
        } else if (chunk.type === 'error') {
          res.write(`data: ${JSON.stringify({ type: 'error', text: chunk.text })}\n\n`);
        }
      }
    } catch (error: any) {
      res.write(`data: ${JSON.stringify({ type: 'error', text: error?.message || 'Stream error' })}\n\n`);
    }

    res.end();
  }

  /**
   * In-App SARA query via AI Gateway (mode avancé avec contexte MCP et outils)
   */
  @Post('gateway')
  async gatewayQuery(
    @Body() body: {
      query: string;
      userId: string;
      tenantId: string;
      schoolId?: string;
    },
  ) {
    return this.saraService.handleInAppQueryViaGateway(
      body.query,
      body.userId,
      body.tenantId,
      body.schoolId,
    );
  }

  /**
   * Get contextual suggestions based on user role and current module
   */
  @Post('suggestions')
  async getSuggestions(
    @Body() body: { userRole?: string; currentModule?: string },
  ) {
    return this.saraService.getContextualSuggestions(body.userRole, body.currentModule);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VOICE ENDPOINTS — Mode Vocal SARA (comme ChatGPT Voice)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * VOICE TRANSCRIBE — Audio → Texte (ASR seul)
   *
   * POST /sara/voice/transcribe
   * Body: { audioBase64: string }
   * Response: { text: string, language?: string }
   *
   * Utilisé par le frontend pour transcrire la voix de l'utilisateur
   * et afficher le texte dans le chat avant envoi à SARA.
   */
  @Public()
  @Post('voice/transcribe')
  async voiceTranscribe(
    @Body() body: { audioBase64: string },
  ) {
    if (!body.audioBase64) {
      return { text: '', error: 'audioBase64 is required' };
    }

    return this.voiceService.transcribe(body.audioBase64);
  }

  /**
   * VOICE SPEAK — Texte → Audio (TTS seul)
   *
   * POST /sara/voice/speak
   * Body: { text: string; voice?: string; speed?: number }
   * Response: { audioBase64: string; format: string; durationMs?: number }
   *
   * Utilisé par le frontend pour lire à voix haute la réponse de SARA.
   * Le texte est nettoyé du markdown avant TTS.
   */
  @Public()
  @Post('voice/speak')
  async voiceSpeak(
    @Body() body: { text: string; voice?: string; speed?: number },
  ) {
    if (!body.text) {
      return { audioBase64: '', format: 'mp3', error: 'text is required' };
    }

    // Nettoyer le markdown pour un rendu TTS naturel
    const cleanText = this.voiceService.cleanTextForTTS(body.text);

    return this.voiceService.speak(
      cleanText,
      body.voice,
      body.speed,
    );
  }

  /**
   * VOICE CHAT — Pipeline complet : Audio → ASR → SARA → TTS → Audio
   *
   * POST /sara/voice/chat
   * Body: {
   *   audioBase64: string;
   *   visitorId?: string;
   *   messages?: Array<{ role: string; content: string }>;
   *   voice?: string;
   *   speed?: number;
   * }
   * Response: {
   *   transcribedText: string;
   *   saraResponse: string;
   *   audioBase64: string;
   *   format: string;
   * }
   *
   * Pipeline complet pour le mode vocal immersif :
   * 1. Transcrire l'audio de l'utilisateur (ASR)
   * 2. Envoyer le texte à SARA
   * 3. Convertir la réponse en audio (TTS)
   * 4. Retourner le tout au frontend
   */
  @Public()
  @Post('voice/chat')
  async voiceChat(
    @Body() body: {
      audioBase64: string;
      visitorId?: string;
      messages?: Array<{ role: string; content: string }>;
      voice?: string;
      speed?: number;
    },
  ) {
    if (!body.audioBase64) {
      return {
        transcribedText: '',
        saraResponse: '',
        audioBase64: '',
        format: 'mp3',
        error: 'audioBase64 is required',
      };
    }

    // 1. ASR : Audio → Texte
    const { text: transcribedText } = await this.voiceService.transcribe(body.audioBase64);

    if (!transcribedText.trim()) {
      return {
        transcribedText: '',
        saraResponse: "Je n'ai pas bien compris. Pouvez-vous répéter ?",
        audioBase64: '',
        format: 'mp3',
      };
    }

    // 2. SARA : Texte → Réponse
    const saraResult = await this.saraService.handleVisitorQuery(
      transcribedText,
      body.visitorId,
      body.messages,
    );

    const saraResponse = saraResult?.reply || saraResult?.content || '';

    // 3. TTS : Réponse → Audio
    const cleanResponse = this.voiceService.cleanTextForTTS(saraResponse);
    let audioBase64 = '';
    let format = 'mp3';

    try {
      const speakResult = await this.voiceService.speak(
        cleanResponse,
        body.voice,
        body.speed,
      );
      audioBase64 = speakResult.audioBase64;
      format = speakResult.format;
    } catch (ttsError: any) {
      // Si le TTS échoue, on retourne quand même le texte
      // Le frontend pourra afficher la réponse textuelle
    }

    return {
      transcribedText,
      saraResponse,
      audioBase64,
      format,
    };
  }
}
