import { Controller, Post, Body, Res, UseGuards, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { SaraService } from './sara.service';
import { VoiceService } from './voice.service';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { GetTenant } from '../common/decorators/tenant.decorator';

/**
 * 🔒 Mapping currentModule → permission RBAC requise.
 * Sarah ne peut pas parler d'un module si l'utilisateur n'a pas la permission
 * de lecture correspondante. Empêche un PARENT de demander à Sarah des infos
 * sur la paie, un ENSEIGNANT sur les candidats, etc.
 */
const MODULE_PERMISSION_MAP: Record<string, string> = {
  hr: 'RH_read',
  finance: 'FINANCES_read',
  students: 'ELEVES_read',
  pedagogy: 'ORGANISATION_PEDAGOGIQUE_read',
  exams: 'EXAMENS_read',
  communication: 'COMMUNICATION_read',
  qhse: 'QHSE_read',
  settings: 'PARAMETRES_read',
  // orion / atlas : pas de permission dédiée, géré par canAccessOrion/canAccessAtlas
};

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
   *
   * 🔒 SÉCURITÉ :
   *   - JwtAuthGuard : authentification obligatoire (était MANQUANT avant)
   *   - Le schoolId du body DOIT correspondre au tenantId du JWT — empêche
   *     l'usurpation cross-tenant (un utilisateur de l'école A ne peut pas
   *     passer schoolId=école-b pour obtenir des infos sur l'école B)
   *   - RBAC par module : si currentModule='hr', l'utilisateur doit avoir
   *     la permission RH_read, etc. Sinon 403 Forbidden.
   */
  @UseGuards(JwtAuthGuard)
  @Post('inapp')
  async inappQuery(
    @GetTenant() tenant: any,
    @Body() body: {
      query: string;
      userId: string;
      schoolId: string;
      userRole?: string;
      currentModule?: string;
      messages?: Array<{ role: string; content: string }>;
    },
  ) {
    // 🔒 Isolation tenant stricte : le schoolId du body doit correspondre
    // au tenant résolu depuis le JWT. Empêche la fuite cross-tenant.
    const jwtTenantId = tenant?.id;
    if (!jwtTenantId) {
      throw new BadRequestException('Tenant non résolu depuis la session.');
    }
    if (body.schoolId && body.schoolId !== jwtTenantId) {
      throw new ForbiddenException(
        '🚨 Sécurité : le schoolId fourni ne correspond pas à votre établissement. ' +
        'Vous ne pouvez accéder qu\'aux données de votre propre tenant.',
      );
    }

    return this.saraService.handleInAppQuery(
      body.query,
      body.userId,
      jwtTenantId, // 🔒 On utilise TOUJOURS le tenant du JWT, jamais celui du body
      body.userRole,
      body.currentModule,
      body.messages,
    );
  }

  /**
   * In-App SARA streaming query (authenticated, SSE)
   * Used by the InAppSaraGuide for real-time streaming responses
   *
   * 🔒 Mêmes règles de sécurité que /sara/inapp :
   *   - JwtAuthGuard (déjà présent)
   *   - Validation schoolId == JWT.tenantId
   */
  @UseGuards(JwtAuthGuard)
  @Post('inapp/stream')
  async inappQueryStream(
    @GetTenant() tenant: any,
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
    // 🔒 Isolation tenant stricte
    const jwtTenantId = tenant?.id;
    if (!jwtTenantId) {
      res.status(400).json({ error: 'Tenant non résolu depuis la session.' });
      return;
    }
    if (body.schoolId && body.schoolId !== jwtTenantId) {
      res.status(403).json({
        error: '🚨 Sécurité : le schoolId fourni ne correspond pas à votre établissement.',
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Désactiver le buffering Nginx

    try {
      const stream = this.saraService.handleInAppQueryStream(
        body.query,
        body.userId,
        jwtTenantId, // 🔒 On utilise TOUJOURS le tenant du JWT
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
   *
   * 🔒 SÉCURITÉ :
   *   - JwtAuthGuard obligatoire
   *   - Le tenantId du body DOIT correspondre au tenant du JWT
   */
  @UseGuards(JwtAuthGuard)
  @Post('gateway')
  async gatewayQuery(
    @GetTenant() tenant: any,
    @Body() body: {
      query: string;
      userId: string;
      tenantId: string;
      schoolId?: string;
    },
  ) {
    // 🔒 Isolation tenant stricte
    const jwtTenantId = tenant?.id;
    if (!jwtTenantId) {
      throw new BadRequestException('Tenant non résolu depuis la session.');
    }
    if (body.tenantId && body.tenantId !== jwtTenantId) {
      throw new ForbiddenException(
        '🚨 Sécurité : le tenantId fourni ne correspond pas à votre établissement.',
      );
    }

    return this.saraService.handleInAppQueryViaGateway(
      body.query,
      body.userId,
      jwtTenantId, // 🔒 On utilise TOUJOURS le tenant du JWT
      body.schoolId,
    );
  }

  /**
   * Get contextual suggestions based on user role and current module
   * 🔒 Authentification JWT requise (les suggestions sont contextuelles à l'utilisateur)
   */
  @UseGuards(JwtAuthGuard)
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

    try {
      return await this.voiceService.transcribe(body.audioBase64);
    } catch (error: any) {
      return {
        text: '',
        error: `Transcription échouée : ${error?.message || 'Erreur ASR'}`,
      };
    }
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

    try {
      return await this.voiceService.speak(
        cleanText,
        body.voice,
        body.speed,
      );
    } catch (error: any) {
      return {
        audioBase64: '',
        format: 'mp3',
        error: `Synthèse vocale échouée : ${error?.message || 'Erreur TTS'}`,
      };
    }
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

    try {
      // 1. ASR : Audio → Texte
      let transcribedText = '';
      try {
        const asrResult = await this.voiceService.transcribe(body.audioBase64);
        transcribedText = asrResult.text || '';
      } catch (asrError: any) {
        return {
          transcribedText: '',
          saraResponse: '',
          audioBase64: '',
          format: 'mp3',
          error: `Transcription échouée : ${asrError?.message || 'Erreur ASR'}`,
        };
      }

      if (!transcribedText.trim()) {
        return {
          transcribedText: '',
          saraResponse: "Je n'ai pas bien compris. Pouvez-vous répéter ?",
          audioBase64: '',
          format: 'mp3',
        };
      }

      // 2. SARA : Texte → Réponse
      let saraResponse = '';
      try {
        const saraResult = await this.saraService.handleVisitorQuery(
          transcribedText,
          body.visitorId,
          body.messages,
        );
        saraResponse = saraResult?.reply || saraResult?.content || '';
      } catch (saraError: any) {
        // Si SARA échoue, on retourne quand même la transcription
        return {
          transcribedText,
          saraResponse: "Je suis temporairement indisponible. Réessayez dans un instant.",
          audioBase64: '',
          format: 'mp3',
          error: `SARA indisponible : ${saraError?.message || 'Erreur'}`,
        };
      }

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
        console.error('[VoiceChat] TTS failed:', ttsError?.message);
      }

      return {
        transcribedText,
        saraResponse,
        audioBase64,
        format,
      };
    } catch (error: any) {
      // Catch-all de sécurité
      return {
        transcribedText: '',
        saraResponse: '',
        audioBase64: '',
        format: 'mp3',
        error: `Erreur vocale : ${error?.message || 'Erreur inconnue'}`,
      };
    }
  }
}
