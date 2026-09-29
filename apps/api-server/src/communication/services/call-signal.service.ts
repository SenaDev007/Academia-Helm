/**
 * ============================================================================
 * CALL SIGNAL SERVICE — Signalisation des appels audio/vidéo Helm Connect
 * ============================================================================
 *
 * ⭐ V4 (porté de « Yeshua Connect » / Christ Libère) :
 *
 *   start(conversationId, type)
 *        → crée un signal "ringing" (annule les anciens signaux ringing du
 *          canal) + renvoie le contexte (nom du canal, photo, appelant) +
 *          NOTIFIE les membres (socket call:incoming instantané + push FCM/
 *          Web Push pour les appels privés — haute priorité, TTL court).
 *          Appelé par le bouton 📞/🎥 du header de conversation.
 *
 *   accept(callId)   → un destinataire décroche : status "accepted" + acceptedAt.
 *   decline(callId)  → refuse. En DIRECT : termine l'appel (status "declined"
 *                      + journal). En groupe : l'appel continue de sonner
 *                      pour les autres (le refus est purement local).
 *   end(callId)      → raccroche (appelant ou participant accepté) :
 *                      ringing → "cancelled" (journal « Appel annulé »),
 *                      accepted → "ended" + durée (journal « Appel terminé ·
 *                      3 min 12 s »).
 *
 *   getIncoming(userId)  (polling 3 s + socket call:incoming)
 *        → appels qui sonnent POUR MOI (membre, non-initiateur) avec la
 *          photo du canal + le nom/photo de l'appelant. Balayage « manqué » :
 *          tout signal ringing de plus de 45 s devient "missed" + journal
 *          « Appel manqué » dans le chat.
 *
 *   getStatus(callId)     (polling 2 s par les parties en cours d'appel)
 *        → { status, duration, mediaProvider } pour refléter refusé / manqué /
 *          terminé à distance + le FOURNISSEUR MULTIMÉDIA arbitré (toutes
 *          les parties convergent vers le même réseau).
 *
 * ⭐ Journaux d'appel : chaque issue (manqué / refusé / annulé / terminé
 *   avec durée) est insérée comme message type CALL_LOG dans la conversation
 *   — « il faut que ça s'affiche dans le chat qu'il y a eu appel manqué ou
 *   un appel qui a duré tel nombre de minutes ». L'historique classique
 *   (chat_call_history) est tenu à jour en parallèle pour la section Appels.
 *
 * 🔒 Authentification JWT + TenantGuard au contrôleur ; membership vérifié.
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { ChatGateway } from '../chat.gateway';
import { FcmSenderService } from '../../notifications/fcm-sender.service';
import { PushNotificationService } from './push-notification.service';
// ⭐ V5 (chantier 1) : blocage d'utilisateurs — un privé bloqué ne sonne plus
import { ChatBlockService } from './chat-block.service';

type CallMeta = {
  callType: 'audio' | 'video';
  status: 'missed' | 'declined' | 'cancelled' | 'ended';
  durationSec?: number;
  byName: string;
};

/** 192 s → « 3 min 12 s » ; 45 s → « 45 s » ; 3700 s → « 1 h 1 min ». */
function formatDurationFr(sec: number): string {
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s > 0 ? `${m} min ${s} s` : `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

@Injectable()
export class CallSignalService {
  private readonly logger = new Logger(CallSignalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
    private readonly fcmSender: FcmSenderService,
    private readonly pushService: PushNotificationService,
    // ⭐ V5 (chantier 1) : blocage — start() refusé sur un privé bloqué
    private readonly chatBlockService: ChatBlockService,
  ) {}

  // ═════════════════════════════════════════════════════════════════
  //  Helpers
  // ═════════════════════════════════════════════════════════════════

  /** L'utilisateur est-il membre de la conversation ? */
  private async isMember(conversationId: string, userId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ one: number }>>(
      `SELECT 1 AS one FROM "chat_participants"
       WHERE "conversationId" = $1 AND "userId" = $2 AND "leftAt" IS NULL`,
      conversationId,
      userId,
    );
    return rows.length > 0;
  }

  /** Insère le message CALL_LOG dans la conversation. */
  private async insertCallLogMessage(
    conversationId: string,
    initiatorId: string,
    meta: CallMeta,
  ): Promise<void> {
    const typeLabel = meta.callType === 'video' ? 'Appel vidéo' : 'Appel audio';
    let text: string;
    switch (meta.status) {
      case 'missed': text = `${typeLabel} manqué`; break;
      case 'declined': text = `${typeLabel} refusé`; break;
      case 'cancelled': text = `${typeLabel} annulé`; break;
      default: text = `${typeLabel} terminé · ${formatDurationFr(meta.durationSec ?? 0)}`;
    }
    const msgId = randomUUID();
    // ⭐ V5.2 — CORRECTIF : la table chat_messages n'a PAS de colonne
    //    « updatedAt » (vérifié en production) → l'INSERT échouait
    //    silencieusement (catch + log) : AUCUN journal d'appel (manqué /
    //    refusé / annulé / terminé) n'a jamais été écrit, et le preview de
    //    conversation ne se mettait pas à jour à la fin d'un appel.
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "chat_messages" ("id", "conversationId", "senderId", "type", "content", "callMeta", "createdAt")
       VALUES ($1, $2, $3, 'CALL_LOG', $4, $5::jsonb, now())`,
      msgId, conversationId, initiatorId, text, JSON.stringify(meta),
    );
    // ⭐ Diffuser le journal en temps réel aux participants connectés
    const participantIds = await this.getParticipantIds(conversationId);
    this.chatGateway?.broadcastNewMessage(conversationId, {
      id: msgId,
      conversationId,
      senderId: initiatorId,
      type: 'CALL_LOG',
      content: text,
      callMeta: meta,
      createdAt: new Date().toISOString(),
    }, participantIds);
    // Rafraîchir le preview de la conversation (dernier message)
    try {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "chat_conversations"
         SET "lastMessageAt" = now(), "lastMessagePreview" = $2, "lastMessageSenderId" = $3
         WHERE "id" = $1`,
        conversationId, text, initiatorId,
      );
    } catch {
      // best effort — le preview se corrigera au prochain message
    }
  }

  /** Met à jour aussi l'historique classique (chat_call_history) — section Appels. */
  private async upsertCallHistory(
    conversationId: string,
    initiatorId: string,
    callType: 'audio' | 'video',
    status: string,
    durationSec: number | null,
    tenantId: string,
  ): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "chat_call_history" ("id", "conversationId", "callerId", "callType", "status", "startedAt", "endedAt", "duration")
         VALUES ($1, $2, $3, $4, $5, now(), now(), $6)`,
        randomUUID(), conversationId, initiatorId,
        callType === 'video' ? 'VIDEO' : 'AUDIO',
        status === 'missed' ? 'MISSED' : status === 'declined' ? 'REJECTED'
          : status === 'cancelled' ? 'CANCELLED'
          : status === 'ended' ? 'COMPLETED' : 'ONGOING',
        durationSec,
      );
      void tenantId;
    } catch (e: any) {
      this.logger.warn(`upsertCallHistory: ${e.message}`);
    }
  }

  private async getParticipantIds(conversationId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
      `SELECT "userId" FROM "chat_participants" WHERE "conversationId" = $1 AND "leftAt" IS NULL`,
      conversationId,
    );
    return rows.map((r) => r.userId);
  }

  /** Marque « manqués » tous les signaux ringing expirés (+ journal d'appel).
   *
   * ⭐ FIX PERFORMANCE CONCURRENCE — throttle 15 s :
   *    AVANT : appelé par getIncoming/getStatus sur CHAQUE poll de CHAQUE
   *    client (polling 3 s) → 20 utilisateurs = ~7 sweeps/s sur la DB pour
   *    rien. Désormais le sweep effectif ne s'exécute qu'au plus toutes les
   *    15 s (garde-fou en mémoire, non-bloquant : les appels qui traînent
   *    sont marqués manqués avec ≤ 15 s de retard supplémentaire).
   */
  private lastSweepAt = 0;
  private sweepRunning = false;

  async sweepMissedCalls(): Promise<void> {
    const now = Date.now();
    if (this.sweepRunning || now - this.lastSweepAt < 15_000) {
      return; // déjà balayé récemment (ou en cours)
    }
    this.sweepRunning = true;
    this.lastSweepAt = now;
    try {
      await this.doSweepMissedCalls();
    } finally {
      this.sweepRunning = false;
    }
  }

  private async doSweepMissedCalls(): Promise<void> {
    const stale = await this.prisma.$queryRawUnsafe<Array<{
      id: string; tenantId: string; conversationId: string; initiatorId: string; type: string;
      initiatorName: string | null;
    }>>(
      `SELECT s."id", s."tenantId", s."conversationId", s."initiatorId", s."type",
              u."firstName" || ' ' || u."lastName" AS "initiatorName"
       FROM "chat_call_signals" s LEFT JOIN "users" u ON u."id" = s."initiatorId"
       WHERE s."status" = 'ringing' AND s."createdAt" < now() - interval '45 seconds'`,
    );
    for (const s of stale) {
      const updated = await this.prisma.$executeRawUnsafe(
        `UPDATE "chat_call_signals" SET "status" = 'missed', "endedAt" = now()
         WHERE "id" = $1 AND "status" = 'ringing'`,
        s.id,
      );
      if (updated > 0) {
        const name = (s.initiatorName || '').trim() || 'Membre';
        await this.upsertCallHistory(s.conversationId, s.initiatorId,
          s.type === 'video' ? 'video' : 'audio', 'missed', null, s.tenantId);
        await this.insertCallLogMessage(s.conversationId, s.initiatorId, {
          callType: s.type === 'video' ? 'video' : 'audio',
          status: 'missed',
          byName: name,
        }).catch((e) => this.logger.error(`log missed: ${e.message}`));
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════
  //  START — je lance un appel dans une conversation
  // ═════════════════════════════════════════════════════════════════

  async start(
    tenantId: string,
    userId: string,
    conversationId: string,
    type: 'audio' | 'video',
  ): Promise<{
    callId: string;
    conversation: { name: string | null; avatarUrl: string | undefined; type: string } | null;
  }> {
    if (!(await this.isMember(conversationId, userId))) {
      throw new ForbiddenException('Vous n\'êtes pas membre de cette conversation');
    }

    const convRows = await this.prisma.$queryRawUnsafe<Array<{
      name: string | null; avatarUrl: string | null; type: string; tenantId: string;
    }>>(
      `SELECT "name", "avatarUrl", "type", "tenantId" FROM "chat_conversations" WHERE "id" = $1`,
      conversationId,
    );
    if (!convRows.length) throw new NotFoundException('Conversation introuvable');
    const conv = convRows[0];

    // ⭐ V5 (chantier 1) — BLOCAGE : sur une conversation DIRECT (privé), on
    //    refuse l'appel si l'un des deux membres a bloqué l'autre (les deux
    //    sens — comme la création de DM et l'envoi de message). Les appels de
    //    GROUPE restent OUVERTS.
    if (conv.type === 'DIRECT') {
      const otherRows = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
        `SELECT "userId" FROM "chat_participants" WHERE "conversationId" = $1 AND "userId" <> $2 AND "leftAt" IS NULL LIMIT 1`,
        conversationId, userId,
      );
      if (otherRows.length > 0) {
        await this.chatBlockService.assertNotBlocked(conv.tenantId || tenantId, userId, otherRows[0].userId);
      }
    }

    const callId = randomUUID();
    const isGroupCall = conv.type === 'GROUP';

    // Remplace tout signal ringing antérieur du même canal (un seul appel
    // simultané par conversation — évite les sonneries fantômes).
    await this.prisma.$executeRawUnsafe(
      `UPDATE "chat_call_signals" SET "status" = 'cancelled', "endedAt" = now()
       WHERE "conversationId" = $1 AND "status" = 'ringing' AND "id" <> $2`,
      conversationId, callId,
    );
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "chat_call_signals" ("id", "tenantId", "conversationId", "initiatorId", "type", "status", "isGroupCall", "createdAt")
       VALUES ($1, $2, $3, $4, $5, 'ringing', $6, now())`,
      callId, tenantId, conversationId, userId, type, isGroupCall,
    );

    // ⭐ Contexte de l'appelant pour l'écran d'appel entrant des destinataires
    const meRows = await this.prisma.$queryRawUnsafe<Array<{
      firstName: string | null; lastName: string | null; avatarUrl: string | null;
    }>>(
      `SELECT "firstName", "lastName", "avatarUrl" FROM "users" WHERE "id" = $1`,
      userId,
    );
    const callerName = meRows.length
      ? `${meRows[0].firstName || ''} ${meRows[0].lastName || ''}`.trim() || 'Utilisateur'
      : 'Utilisateur';
    const callerAvatarUrl = meRows[0]?.avatarUrl || null;

    // ⭐ Diffusion instantanée aux membres connectés (socket) — plus rapide
    //    que le polling 3 s ; le polling reste le filet de sécurité.
    const participantIds = await this.getParticipantIds(conversationId);
    this.chatGateway?.broadcastCallIncoming(participantIds.filter((p) => p !== userId), {
      callId,
      conversationId,
      convName: conv.name || 'Conversation',
      convAvatarUrl: conv.avatarUrl || undefined,
      convType: conv.type,
      isGroupCall,
      callType: type,
      initiatorId: userId,
      initiatorName: callerName,
      initiatorAvatarUrl: callerAvatarUrl || undefined,
    });

    // ⭐ NOTIFICATION PUSH de l'appel entrant (privé uniquement, pour ne pas
    //    sonner sur tout un groupe) : le mobile du destinataire sonne/l'affiche
    //    MÊME APPLICATION FERMÉE (FCM haute priorité). Best effort — sans
    //    FIREBASE_*/VAPID_* configurées, silencieux.
    if (!isGroupCall) {
      const callee = participantIds.find((p) => p !== userId);
      if (callee) {
        // FCM mobile
        // ⭐ V5 (chantier 9) — CORRECTIF DE LIVRISON des appels entrants :
        //    - android : priority 'high', ttl '45s', channel_id 'helm_calls' ;
        //    - apns : interruption-level 'time-sensitive', apns-expiration = now+45 s.
        //    (avant : notification générique, écrasement du data.type par
        //    'SYSTEM' — corrigé côté FcmSenderService par fusion des data)
        this.fcmSender.sendToUser(callee, {
          title: 'Appel entrant — Helm Connect',
          body: `${callerName} vous appelle (${type === 'video' ? 'vidéo' : 'audio'})`,
          data: { type: 'incoming_call', callId, conversationId },
          delivery: {
            android: { priority: 'high', ttl: '45s', channelId: 'helm_calls' },
            apns: { interruptionLevel: 'time-sensitive', expirationSeconds: 45 },
          },
        }).catch((e) => this.logger.warn(`FCM call push: ${e.message}`));
        // Web Push navigateur
        this.pushService.sendPushToUser(callee, {
          title: 'Appel entrant — Helm Connect',
          body: `${callerName} vous appelle (${type === 'video' ? 'vidéo' : 'audio'})`,
          conversationId,
        }).catch((e) => this.logger.warn(`Web push call: ${e.message}`));
      }
    }

    return {
      callId,
      conversation: {
        name: conv.name,
        avatarUrl: conv.avatarUrl ?? undefined,
        type: conv.type,
      },
    };
  }

  // ═════════════════════════════════════════════════════════════════
  //  ACCEPT / DECLINE / END
  // ═════════════════════════════════════════════════════════════════

  async accept(tenantId: string, userId: string, callId: string): Promise<{ ok: true; status: string }> {
    const call = await this.getCall(callId);
    if (call.initiatorId === userId) {
      throw new BadRequestException('Vous êtes l\'appelant');
    }
    if (!(await this.isMember(call.conversationId, userId))) {
      throw new ForbiddenException('Accès refusé');
    }
    if (call.status === 'ringing') {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "chat_call_signals" SET "status" = 'accepted', "acceptedAt" = now() WHERE "id" = $1`,
        callId,
      );
    }
    return { ok: true, status: 'accepted' };
  }

  async decline(tenantId: string, userId: string, callId: string): Promise<{ ok: true; status: string; groupIgnored: boolean }> {
    const call = await this.getCall(callId);
    if (call.initiatorId === userId) {
      throw new BadRequestException('Vous êtes l\'appelant');
    }
    if (!(await this.isMember(call.conversationId, userId))) {
      throw new ForbiddenException('Accès refusé');
    }
    const callType = call.type === 'video' ? 'video' : 'audio';
    const byName = (call.initiatorName || '').trim() || 'Membre';

    // En conversation DIRECT, un refus termine l'appel pour tout le monde.
    // En groupe, l'appel continue de sonner pour les autres membres.
    if (call.convType === 'DIRECT' && call.status === 'ringing') {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "chat_call_signals" SET "status" = 'declined', "endedAt" = now() WHERE "id" = $1`,
        callId,
      );
      await this.upsertCallHistory(call.conversationId, call.initiatorId, callType, 'declined', null, tenantId);
      await this.insertCallLogMessage(call.conversationId, call.initiatorId, {
        callType, status: 'declined', byName,
      }).catch((e) => this.logger.error(`log declined: ${e.message}`));
      return { ok: true, status: 'declined', groupIgnored: false };
    }
    return { ok: true, status: call.status, groupIgnored: call.convType !== 'DIRECT' };
  }

  async end(tenantId: string, userId: string, callId: string): Promise<{ ok: true; status: string; durationSec?: number }> {
    const call = await this.getCall(callId);
    const isInitiator = call.initiatorId === userId;
    // Raccrocher un appel accepté : initiateur OU participant (membre).
    if (!(await this.isMember(call.conversationId, userId))) {
      throw new ForbiddenException('Accès refusé');
    }
    if (call.status !== 'accepted' && !isInitiator) {
      throw new ForbiddenException('Seul l\'appelant peut annuler l\'appel');
    }
    const callType = call.type === 'video' ? 'video' : 'audio';
    const byName = (call.initiatorName || '').trim() || 'Membre';

    if (call.status === 'ringing') {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "chat_call_signals" SET "status" = 'cancelled', "endedAt" = now() WHERE "id" = $1`,
        callId,
      );
      await this.upsertCallHistory(call.conversationId, call.initiatorId, callType, 'cancelled', null, tenantId);
      await this.insertCallLogMessage(call.conversationId, call.initiatorId, {
        callType, status: 'cancelled', byName,
      }).catch((e) => this.logger.error(`log cancelled: ${e.message}`));
      return { ok: true, status: 'cancelled' };
    }
    if (call.status === 'accepted') {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "chat_call_signals" SET "status" = 'ended', "endedAt" = now() WHERE "id" = $1`,
        callId,
      );
      const fresh = await this.prisma.$queryRawUnsafe<Array<{ acceptedAt: Date | null; endedAt: Date | null }>>(
        `SELECT "acceptedAt", "endedAt" FROM "chat_call_signals" WHERE "id" = $1`, callId,
      );
      const acceptedAt = fresh[0]?.acceptedAt ? new Date(fresh[0].acceptedAt).getTime() : null;
      const endedAt = fresh[0]?.endedAt ? new Date(fresh[0].endedAt).getTime() : Date.now();
      const durationSec = acceptedAt ? Math.max(0, Math.round((endedAt - acceptedAt) / 1000)) : 0;
      await this.upsertCallHistory(call.conversationId, call.initiatorId, callType, 'ended', durationSec, tenantId);
      await this.insertCallLogMessage(call.conversationId, call.initiatorId, {
        callType, status: 'ended', durationSec, byName,
      }).catch((e) => this.logger.error(`log ended: ${e.message}`));
      return { ok: true, status: 'ended', durationSec };
    }
    // Déjà terminal (missed/declined/ended/cancelled) → idempotent.
    return { ok: true, status: call.status };
  }

  // ═════════════════════════════════════════════════════════════════
  //  GET — polling : appels entrants POUR MOI + statut d'un appel
  // ═════════════════════════════════════════════════════════════════

  async getIncoming(userId: string): Promise<{
    incoming: Array<{
      callId: string;
      conversationId: string;
      convName: string;
      convAvatarUrl?: string;
      convType: string;
      isGroupCall: boolean;
      callType: 'audio' | 'video';
      initiatorId: string;
      initiatorName: string;
      initiatorAvatarUrl?: string;
      createdAt: Date;
    }>;
  }> {
    await this.sweepMissedCalls();
    const incoming = await this.prisma.$queryRawUnsafe<Array<{
      callId: string; conversationId: string; callType: string; createdAt: Date;
      convName: string | null; convAvatarUrl: string | null; convType: string | null;
      isGroupCall: boolean;
      initiatorId: string; initiatorName: string | null; initiatorAvatarUrl: string | null;
    }>>(
      `SELECT s."id" AS "callId", s."conversationId", s."type" AS "callType", s."createdAt", s."isGroupCall",
              c."name" AS "convName", c."avatarUrl" AS "convAvatarUrl", c."type" AS "convType",
              s."initiatorId", (u."firstName" || ' ' || u."lastName") AS "initiatorName", u."avatarUrl" AS "initiatorAvatarUrl"
       FROM "chat_call_signals" s
       JOIN "chat_conversations" c ON c."id" = s."conversationId"
       LEFT JOIN "users" u ON u."id" = s."initiatorId"
       WHERE s."status" = 'ringing'
         AND s."initiatorId" <> $1
         AND EXISTS (
           SELECT 1 FROM "chat_participants" p
           WHERE p."conversationId" = s."conversationId" AND p."userId" = $1 AND p."leftAt" IS NULL
         )
       ORDER BY s."createdAt" DESC
       LIMIT 5`,
      userId,
    );

    return {
      incoming: incoming.map((c) => ({
        callId: c.callId,
        conversationId: c.conversationId,
        convName: c.convName || 'Conversation',
        convAvatarUrl: c.convAvatarUrl || undefined,
        convType: c.convType || 'DIRECT',
        isGroupCall: c.isGroupCall === true,
        callType: c.callType === 'video' ? 'video' : 'audio',
        initiatorId: c.initiatorId,
        initiatorName: (c.initiatorName || '').trim() || 'Utilisateur',
        initiatorAvatarUrl: c.initiatorAvatarUrl || undefined,
        createdAt: c.createdAt,
      })),
    };
  }

  async getStatus(userId: string, callId: string): Promise<{
    status: string;
    durationSec: number | null;
    type: 'audio' | 'video';
    mediaProvider: string | null;
    isGroupCall: boolean;
    convType: string | null;
  }> {
    let rows = await this.prisma.$queryRawUnsafe<Array<{
      status: string; initiatorId: string; conversationId: string; type: string;
      convType: string | null; isGroupCall: boolean;
      acceptedAt: Date | null; endedAt: Date | null;
      mediaProvider: string | null;
    }>>(
      `SELECT s."status", s."initiatorId", s."conversationId", s."type", s."isGroupCall",
              s."acceptedAt", s."endedAt", s."mediaProvider", c."type" AS "convType"
       FROM "chat_call_signals" s
       LEFT JOIN "chat_conversations" c ON c."id" = s."conversationId"
       WHERE s."id" = $1`,
      callId,
    );
    if (!rows.length) {
      throw new NotFoundException('Appel introuvable');
    }
    let row = rows[0];
    if (row.initiatorId !== userId) {
      if (!(await this.isMember(row.conversationId, userId))) {
        throw new ForbiddenException('Accès refusé');
      }
    }
    // Balayage « manqué » pour CE signal s'il sonne depuis trop longtemps.
    if (row.status === 'ringing') {
      await this.sweepMissedCalls();
      const fresh = await this.prisma.$queryRawUnsafe<Array<{ status: string }>>(
        `SELECT "status" FROM "chat_call_signals" WHERE "id" = $1`, callId,
      );
      if (fresh.length) row.status = fresh[0].status;
    }
    let durationSec: number | null = null;
    if (row.status === 'ended' && row.acceptedAt && row.endedAt) {
      durationSec = Math.max(0, Math.round((new Date(row.endedAt).getTime() - new Date(row.acceptedAt).getTime()) / 1000));
    }
    return {
      status: row.status,
      durationSec,
      type: row.type === 'video' ? 'video' : 'audio',
      mediaProvider: row.mediaProvider || null,
      isGroupCall: row.isGroupCall === true,
      convType: row.convType,
    };
  }

  private async getCall(callId: string): Promise<{
    id: string; status: string; initiatorId: string; conversationId: string; type: string;
    convType: string | null; acceptedAt: Date | null; initiatorName: string | null;
  }> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      id: string; status: string; initiatorId: string; conversationId: string; type: string;
      convType: string | null; acceptedAt: Date | null; initiatorName: string | null;
    }>>(
      `SELECT s."id", s."status", s."initiatorId", s."conversationId", s."type",
              s."acceptedAt", c."type" AS "convType", (u."firstName" || ' ' || u."lastName") AS "initiatorName"
       FROM "chat_call_signals" s
       LEFT JOIN "chat_conversations" c ON c."id" = s."conversationId"
       LEFT JOIN "users" u ON u."id" = s."initiatorId"
       WHERE s."id" = $1`,
      callId,
    );
    if (!rows.length) {
      throw new NotFoundException('Appel introuvable');
    }
    return rows[0];
  }

  // ═════════════════════════════════════════════════════════════════
  //  Historique d'appels global (section Appels — toutes conversations)
  // ═════════════════════════════════════════════════════════════════

  async getCallHistory(tenantId: string, userId: string, limit = 50): Promise<any[]> {
    // ⭐ Les messages CALL_LOG des conversations dont je suis membre —
    //    source la plus riche (contient le texte lisible + les métadonnées).
    const logs = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT m."id", m."conversationId", m."type" AS "msgType", m."content", m."callMeta",
              m."createdAt", c."type" AS "convType", c."name" AS "convName",
              (u."firstName" || ' ' || u."lastName") AS "initiatorName"
       FROM "chat_messages" m
       JOIN "chat_conversations" c ON c."id" = m."conversationId"
       LEFT JOIN "users" u ON u."id" = m."senderId"
       WHERE m."type" = 'CALL_LOG'
         AND m."deletedAt" IS NULL
         AND c."tenantId" = $1
         AND EXISTS (
           SELECT 1 FROM "chat_participants" p
           WHERE p."conversationId" = m."conversationId" AND p."userId" = $2 AND p."leftAt" IS NULL
         )
       ORDER BY m."createdAt" DESC
       LIMIT $3`,
      tenantId, userId, limit,
    );
    // ⭐ Complété par l'historique classique (appels lancés via l'ancien flux
    //    mesh sans signal — la table chat_call_history reste alimentée).
    const history = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT h."id", h."conversationId", h."callType", h."status", h."duration",
              h."startedAt", c."type" AS "convType", c."name" AS "convName",
              (u."firstName" || ' ' || u."lastName") AS "initiatorName"
       FROM "chat_call_history" h
       JOIN "chat_conversations" c ON c."id" = h."conversationId"
       LEFT JOIN "users" u ON u."id" = h."callerId"
       WHERE c."tenantId" = $1
         AND EXISTS (
           SELECT 1 FROM "chat_participants" p
           WHERE p."conversationId" = h."conversationId" AND p."userId" = $2 AND p."leftAt" IS NULL
         )
       ORDER BY h."startedAt" DESC
       LIMIT $3`,
      tenantId, userId, limit,
    );
    // Fusion dédupliquée (les CALL_LOG récents priment — même conversation
    // et même minute ≈ même appel : on garde l'entrée la plus récente).
    const seen = new Set<string>();
    const merged: any[] = [];
    for (const row of [...logs, ...history]) {
      const key = row.conversationId;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(row);
    }
    return merged.slice(0, limit);
  }
}
