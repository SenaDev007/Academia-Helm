/**
 * ============================================================================
 * P2P WEBRTC CONTROLLER — /chat/calls/webrtc : signalisation P2P de secours
 * ============================================================================
 *
 * ⭐ V1 (porté de Yeshua Connect — 14/10/2026) :
 *
 * Quand la chaîne média LiveKit → Agora → Daily échoue, les appels DIRECT
 * 1-à-1 basculent en WebRTC peer-to-peer. Le média (audio/vidéo) voyage
 * DIRECTEMENT entre les deux navigateurs. Cette route assure la signalisation
 * HTTP (polling) qui permet aux deux pairs de s'échanger les offer/answer/ice.
 *
 *   POST /chat/calls/webrtc { callId, type: 'offer'|'answer'|'ice', payload }
 *     → publie un signal (offre SDP, réponse SDP, ou candidat ICE)
 *   GET  /chat/calls/webrtc?callId=X
 *     → renvoie tous les signaux de l'appel (polling côté client)
 *
 * 🔒 JWT + TenantGuard ; membership vérifié (caller doit être initiator OU
 *    membre de la conversation de l'appel).
 * ============================================================================
 */

import {
  Controller, Get, Post, Body, Query,
  UseGuards, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { P2PWebrtcSignalService } from './services/p2p-webrtc-signal.service';

// request.user fourni par la stratégie JWT (id, email, tenantId, role…)
interface AuthUser {
  id: string;
  email: string;
  tenantId: string | null;
  role?: string;
  isSuperAdmin?: boolean;
}

@Controller('chat/calls/webrtc')
@UseGuards(JwtAuthGuard, TenantGuard)
export class P2PWebrtcController {
  constructor(private readonly signalService: P2PWebrtcSignalService) {}

  // ═════════════════════════════════════════════════════════════════
  //  GET ?callId=x — récupérer tous les signaux d'un appel (polling 1.2 s)
  // ═════════════════════════════════════════════════════════════════
  @Get()
  async getSignals(
    @CurrentUser() user: AuthUser,
    @TenantId() tenantId: string,
    @Query('callId') callId: string | undefined,
  ) {
    if (!callId) {
      throw new BadRequestException('callId requis');
    }
    const signals = await this.signalService.getSignals(tenantId, user.id, callId);
    return { signals };
  }

  // ═════════════════════════════════════════════════════════════════
  //  POST — publier un signal (offer / answer / ice)
  // ═════════════════════════════════════════════════════════════════
  @Post()
  async postSignal(
    @CurrentUser() user: AuthUser,
    @TenantId() tenantId: string,
    @Body() body: { callId: string; type: string; payload: any },
  ) {
    if (!body?.callId) {
      throw new BadRequestException('callId requis');
    }
    if (!body?.type || !['offer', 'answer', 'ice'].includes(body.type)) {
      throw new BadRequestException('type doit être offer, answer ou ice');
    }
    if (!body?.payload) {
      throw new BadRequestException('payload requis');
    }

    try {
      const result = await this.signalService.postSignal(
        tenantId,
        user.id,
        body.callId,
        body.type as 'offer' | 'answer' | 'ice',
        body.payload,
      );
      return { ok: true, id: result.id, createdAt: result.createdAt };
    } catch (err: any) {
      throw new ForbiddenException(err?.message || 'Accès refusé à cet appel');
    }
  }
}
