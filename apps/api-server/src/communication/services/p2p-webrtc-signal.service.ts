/**
 * ============================================================================
 * P2P WEBRTC SIGNAL SERVICE — Signalisation HTTP pour les appels P2P de secours
 * ============================================================================
 *
 * ⭐ V1 (porté de Yeshua Connect — 14/10/2026) :
 *
 * Quand la chaîne média LiveKit → Agora → Daily échoue (CGNAT africain,
 * key expirée, etc.), les appels DIRECT 1-à-1 basculent en WebRTC peer-to-peer.
 * Le média (audio/vidéo) voyage DIRECTEMENT entre les deux navigateurs, sans
 * serveur multimédia ni clé d'API. La seule infrastructure requise est cette
 * signalisation HTTP (polling de la table chat_p2p_webrtc_signals) + STUN/TURN
 * publics gratuits.
 *
 * Flot :
 *   APPELANT (startCaller) :
 *     1. POST /chat/calls/webrtc { callId, type: 'offer', payload: { sdp, type } }
 *     2. polling GET /chat/calls/webrtc?callId=X → attend 'answer' + 'ice'
 *   DESTINATAIRE (acceptCallee) :
 *     1. GET /chat/calls/webrtc?callId=X → lit 'offer'
 *     2. POST /chat/calls/webrtc { callId, type: 'answer', payload: { sdp, type } }
 *     3. polling GET /chat/calls/webrtc?callId=X → attend 'ice'
 *   ICE (trickle des deux côtés) :
 *     POST /chat/calls/webrtc { callId, type: 'ice', payload: { candidate } }
 *
 * Table : chat_p2p_webrtc_signals (migrée 20261014120000)
 *   Cleanup : signaux > 5 min supprimés automatiquement (METHODE PRISMA RAW).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { randomUUID } from 'crypto';

export interface P2PSignalMessage {
  id: string;
  type: 'offer' | 'answer' | 'ice';
  payload: { sdp?: string; type?: string; candidate?: RTCIceCandidateInit };
  createdAt: string;
}

/** Durée de vie maximale d'un signal (5 min) — au-delà, cleanup. */
const SIGNAL_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class P2PWebrtcSignalService {
  private readonly logger = new Logger(P2PWebrtcSignalService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Publier un signal (offer / answer / ice) pour un appel P2P. */
  async postSignal(
    tenantId: string,
    userId: string,
    callId: string,
    type: 'offer' | 'answer' | 'ice',
    payload: { sdp?: string; type?: string; candidate?: RTCIceCandidateInit },
  ): Promise<{ id: string; createdAt: Date }> {
    // Vérifier que l'appel existe et que l'utilisateur est autorisé
    // (initiator OU participant de la conversation liée à l'appel)
    const callRow = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT cs."id" FROM "chat_call_signals" cs
       WHERE cs."id" = $1 AND cs."tenantId" = $2
         AND (cs."initiatorId" = $3 OR EXISTS (
           SELECT 1 FROM "chat_participants" p
           WHERE p."conversationId" = cs."conversationId"
             AND p."userId" = $3
         ))`,
      callId,
      tenantId,
      userId,
    );
    if (!callRow || callRow.length === 0) {
      throw new Error('Appel introuvable ou utilisateur non autorisé');
    }

    const id = randomUUID();
    const inserted = await this.prisma.$queryRawUnsafe<Array<{ id: string; createdAt: Date }>>(
      `INSERT INTO "chat_p2p_webrtc_signals"
         ("id", "tenantId", "callId", "userId", "type", "payload", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, CURRENT_TIMESTAMP)
       RETURNING "id", "createdAt"`,
      id,
      tenantId,
      callId,
      userId,
      type,
      JSON.stringify(payload ?? {}),
    );

    // Opportuniste : cleanup des signaux > 5 min (1 requête, pas de boucle)
    this.cleanupStaleSignals().catch((err) => {
      this.logger.warn(`cleanup stale P2P signals failed: ${err?.message ?? err}`);
    });

    return { id: inserted[0].id, createdAt: inserted[0].createdAt };
  }

  /** Récupérer tous les signaux d'un appel (polling côté client). */
  async getSignals(tenantId: string, userId: string, callId: string): Promise<P2PSignalMessage[]> {
    // Vérifier que l'utilisateur est autorisé (membre de la conversation)
    const callRow = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT cs."id" FROM "chat_call_signals" cs
       WHERE cs."id" = $1 AND cs."tenantId" = $2
         AND (cs."initiatorId" = $3 OR EXISTS (
           SELECT 1 FROM "chat_participants" p
           WHERE p."conversationId" = cs."conversationId"
             AND p."userId" = $3
         ))`,
      callId,
      tenantId,
      userId,
    );
    if (!callRow || callRow.length === 0) {
      return [];
    }

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ id: string; type: string; payload: any; createdAt: Date }>
    >(
      `SELECT "id", "type", "payload", "createdAt"
       FROM "chat_p2p_webrtc_signals"
       WHERE "callId" = $1 AND "tenantId" = $2
       ORDER BY "createdAt" ASC`,
      callId,
      tenantId,
    );

    return (rows || []).map((r) => ({
      id: r.id,
      type: r.type as 'offer' | 'answer' | 'ice',
      payload: (typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload) ?? {},
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }));
  }

  /** Supprimer les signaux > 5 min (cleanup opportun). */
  async cleanupStaleSignals(): Promise<number> {
    const result = await this.prisma.$executeRawUnsafe(
      `DELETE FROM "chat_p2p_webrtc_signals"
       WHERE "createdAt" < (CURRENT_TIMESTAMP - INTERVAL '5 minutes')`,
    );
    return Number(result) || 0;
  }
}
