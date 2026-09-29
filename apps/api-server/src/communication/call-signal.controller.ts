/**
 * ============================================================================
 * CALL SIGNAL CONTROLLER — /chat/calls/* : signalisation + arbitrage média
 * ============================================================================
 *
 * ⭐ V4 (porté de « Yeshua Connect » / Christ Libère) :
 *
 *   POST /chat/calls/signal  { action: start|accept|decline|end }
 *   GET  /chat/calls/signal?incoming=1        (polling 3 s — appels entrants)
 *   GET  /chat/calls/signal?callId=x          (polling 2 s — statut + provider)
 *
 *   POST /chat/calls/media   { action: join|failover|join-voice|failover-voice }
 *   GET  /chat/calls/media?callId=x           (diagnostics fournisseur)
 *   GET  /chat/calls/history                 (section Appels — toutes convs)
 *
 *   GET  /chat/calls/diagnostics              (état global de la chaîne)
 *
 * Chaîne multimédia : LiveKit → Agora → Daily (arbitrage serveur persisté,
 * santé partagée en base, cooldown 5 min). Si la chaîne est ÉPUISÉE (aucun
 * fournisseur configuré ou tous en échec), le client retombe sur le mesh
 * WebRTC existant (≤5 participants).
 *
 * 🔒 JWT + TenantGuard ; membership vérifié partout.
 * ============================================================================
 */

import {
  Controller, Get, Post, Body, Query,
  UseGuards, BadRequestException, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CallSignalService } from './services/call-signal.service';
import {
  CallProviderChainService,
  MEDIA_PROVIDER_CHAIN,
  MediaProviderName,
} from './services/call-provider-chain.service';
import { PrismaService } from '../database/prisma.service';

// request.user fourni par la stratégie JWT (id, email, tenantId, role…)
interface AuthUser {
  id: string;
  email: string;
  tenantId: string | null;
  role?: string;
  isSuperAdmin?: boolean;
}

@Controller('chat/calls')
@UseGuards(JwtAuthGuard, TenantGuard)
export class CallSignalController {
  constructor(
    private readonly signalService: CallSignalService,
    private readonly chainService: CallProviderChainService,
    private readonly prisma: PrismaService,
  ) {}

  // ═════════════════════════════════════════════════════════════════
  //  GET ?callId=x — statut d'un appel précis (polling 2 s)
  //  GET ?incoming=1 — appels qui sonnent pour moi (polling 3 s)
  // ═════════════════════════════════════════════════════════════════
  @Get('signal')
  async getSignal(
    @CurrentUser() user: AuthUser,
    @Query('callId') callId: string | undefined,
    @Query('incoming') incoming: string | undefined,
  ) {
    if (callId) {
      return this.signalService.getStatus(user.id, callId);
    }
    if (incoming) {
      return this.signalService.getIncoming(user.id);
    }
    throw new BadRequestException('callId ou incoming requis');
  }

  // ═════════════════════════════════════════════════════════════════
  //  POST signal — start / accept / decline / end
  // ═════════════════════════════════════════════════════════════════
  @Post('signal')
  async postSignal(
    @CurrentUser() user: AuthUser,
    @TenantId() tenantId: string,
    @Body() body: { action: string; conversationId?: string; type?: string; callId?: string },
  ) {
    const userId = user.id;
    const action = body?.action;

    if (action === 'start') {
      if (!body?.conversationId) throw new BadRequestException('conversationId requis');
      const type = body?.type === 'video' ? 'video' : 'audio';
      return this.signalService.start(tenantId, userId, body.conversationId, type);
    }

    if (!body?.callId) throw new BadRequestException('callId requis');
    if (action === 'accept') return this.signalService.accept(tenantId, userId, body.callId);
    if (action === 'decline') return this.signalService.decline(tenantId, userId, body.callId);
    if (action === 'end') return this.signalService.end(tenantId, userId, body.callId);

    throw new BadRequestException('action inconnue');
  }

  // ═════════════════════════════════════════════════════════════════
  //  POST media — join / failover / join-voice / failover-voice
  // ═════════════════════════════════════════════════════════════════
  @Post('media')
  async postMedia(
    @CurrentUser() user: AuthUser,
    @Body() body: { action: string; callId?: string; conversationId?: string; from?: string; reason?: string },
  ) {
    const userId = user.id;
    let userName: string = user.email ? user.email.split('@')[0] : 'Utilisateur';
    const action = body?.action;

    // ─── Nom complet (métadonnées LiveKit / affichage des tuiles) ──
    let userNameFull = userName;
    let avatarUrl: string | null = null;
    try {
      const me = await this.prisma.$queryRawUnsafe<Array<{ avatarUrl: string | null; firstName: string | null; lastName: string | null }>>(
        `SELECT "avatarUrl", "firstName", "lastName" FROM "users" WHERE "id" = $1`, userId,
      );
      if (me[0]) {
        avatarUrl = me[0].avatarUrl ?? null;
        const full = `${me[0].firstName || ''} ${me[0].lastName || ''}`.trim();
        if (full) userNameFull = full;
      }
    } catch { /* optionnel */ }
    userName = userNameFull;

    /** Vérifie le membership de la conversation. */
    const assertMember = async (conversationId: string): Promise<boolean> => {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ one: number }>>(
        `SELECT 1 AS one FROM "chat_participants"
         WHERE "conversationId" = $1 AND "userId" = $2 AND "leftAt" IS NULL`,
        conversationId, userId,
      );
      return rows.length > 0;
    };

    // ─── JOIN — bundle du fournisseur courant d'un APPEL ─────────────
    if (action === 'join') {
      if (!body?.callId) throw new BadRequestException('callId requis');
      const rows = await this.prisma.$queryRawUnsafe<Array<{
        conversationId: string; initiatorId: string; status: string; type: string;
      }>>(
        `SELECT "conversationId", "initiatorId", "status", "type"
         FROM "chat_call_signals" WHERE "id" = $1`,
        body.callId,
      );
      if (!rows.length) throw new NotFoundException('Appel introuvable');
      const call = rows[0];
      if (!(await assertMember(call.conversationId))) {
        throw new ForbiddenException('Accès refusé');
      }

      // Boucle de repli SERVEUR : le fournisseur courant d'abord, puis les
      // suivants si la GÉNÉRATION du bundle échoue (ex. Daily injoignable).
      let provider = await this.chainService.getCallProvider(body.callId);
      if (!provider) {
        return { exhausted: true, chain: this.chainService.effectiveChain(), reason: 'Aucun fournisseur multimédia disponible' };
      }
      const tentatives: MediaProviderName[] = [provider];
      for (const p of MEDIA_PROVIDER_CHAIN) {
        if (p !== provider && this.chainService.providerConfigured(p) && !tentatives.includes(p)) {
          tentatives.push(p);
        }
      }
      let lastError = '';
      for (let i = 0; i < tentatives.length; i++) {
        const p = tentatives[i];
        try {
          const bundle = await this.chainService.buildProviderBundle(p, {
            kind: 'call',
            conversationId: call.conversationId,
            userId,
            userName,
            avatarUrl,
          });
          return bundle;
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
          // On PERSISTE le fournisseur retenu pour que l'autre partie
          // rejoigne le même réseau (arbitrage par appel).
          provider = await this.chainService.advanceCallProvider(body.callId, p, `join: ${lastError}`);
          if (!provider) break;
          tentatives[i + 1] = provider;
        }
      }
      return { exhausted: true, chain: this.chainService.effectiveChain(), reason: lastError || 'Fournisseurs multimédia indisponibles' };
    }

    // ─── FAILOVER — le client signale l'échec d'un fournisseur (APPEL) ─
    if (action === 'failover') {
      if (!body?.callId || !body?.from) throw new BadRequestException('callId et from requis');
      if (!(MEDIA_PROVIDER_CHAIN as readonly string[]).includes(body.from)) {
        throw new BadRequestException('Fournisseur inconnu');
      }
      const reason = typeof body?.reason === 'string' ? body.reason : 'échec client';
      const rows = await this.prisma.$queryRawUnsafe<Array<{ conversationId: string }>>(
        `SELECT "conversationId" FROM "chat_call_signals" WHERE "id" = $1`, body.callId,
      );
      if (!rows.length) throw new NotFoundException('Appel introuvable');
      if (!(await assertMember(rows[0].conversationId))) {
        throw new ForbiddenException('Accès refusé');
      }
      const next = await this.chainService.advanceCallProvider(body.callId, body.from as MediaProviderName, `client: ${reason}`);
      if (!next) {
        return { exhausted: true, from: body.from, chain: this.chainService.effectiveChain() };
      }
      try {
        return await this.chainService.buildProviderBundle(next, {
          kind: 'call', conversationId: rows[0].conversationId, userId, userName, avatarUrl,
        });
      } catch (e) {
        // Le remplaçant a échoué à la GÉNÉRATION → on avance encore.
        const secondReason = e instanceof Error ? e.message : String(e);
        const next2 = await this.chainService.advanceCallProvider(body.callId, next, `join: ${secondReason}`);
        if (!next2) {
          return { exhausted: true, chain: this.chainService.effectiveChain() };
        }
        return await this.chainService.buildProviderBundle(next2, {
          kind: 'call', conversationId: rows[0].conversationId, userId, userName, avatarUrl,
        });
      }
    }

    // ─── JOIN-VOICE — canal vocal persistant (sans CallSignal) ────────
    if (action === 'join-voice') {
      if (!body?.conversationId) throw new BadRequestException('conversationId requis');
      if (!(await assertMember(body.conversationId))) {
        throw new ForbiddenException('Accès refusé');
      }
      let provider = await this.chainService.getVoiceProvider(body.conversationId);
      if (!provider) {
        return { exhausted: true, chain: this.chainService.effectiveChain(), reason: 'Aucun fournisseur multimédia disponible' };
      }
      const tentatives: MediaProviderName[] = [provider];
      for (const p of MEDIA_PROVIDER_CHAIN) {
        if (p !== provider && this.chainService.providerConfigured(p) && !tentatives.includes(p)) {
          tentatives.push(p);
        }
      }
      let lastError = '';
      for (let i = 0; i < tentatives.length; i++) {
        const p = tentatives[i];
        try {
          const bundle = await this.chainService.buildProviderBundle(p, {
            kind: 'voice', conversationId: body.conversationId, userId, userName, avatarUrl,
          });
          await this.chainService.setVoiceProvider(body.conversationId, p);
          return bundle;
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
          provider = await this.chainService.advanceVoiceProvider(body.conversationId, p, `join: ${lastError}`);
          if (!provider) break;
          tentatives[i + 1] = provider;
        }
      }
      return { exhausted: true, chain: this.chainService.effectiveChain(), reason: lastError || 'Fournisseurs multimédia indisponibles' };
    }

    // ─── FAILOVER-VOICE — le client signale l'échec (CANAL VOCAL) ─────
    if (action === 'failover-voice') {
      if (!body?.conversationId || !body?.from) throw new BadRequestException('conversationId et from requis');
      if (!(MEDIA_PROVIDER_CHAIN as readonly string[]).includes(body.from)) {
        throw new BadRequestException('Fournisseur inconnu');
      }
      if (!(await assertMember(body.conversationId))) {
        throw new ForbiddenException('Accès refusé');
      }
      const reason = typeof body?.reason === 'string' ? body.reason : 'échec client';
      const next = await this.chainService.advanceVoiceProvider(body.conversationId, body.from as MediaProviderName, `client: ${reason}`);
      if (!next) {
        return { exhausted: true, from: body.from, chain: this.chainService.effectiveChain() };
      }
      try {
        return await this.chainService.buildProviderBundle(next, {
          kind: 'voice', conversationId: body.conversationId, userId, userName, avatarUrl,
        });
      } catch (e) {
        const secondReason = e instanceof Error ? e.message : String(e);
        const next2 = await this.chainService.advanceVoiceProvider(body.conversationId, next, `join: ${secondReason}`);
        if (!next2) {
          return { exhausted: true, chain: this.chainService.effectiveChain() };
        }
        return await this.chainService.buildProviderBundle(next2, {
          kind: 'voice', conversationId: body.conversationId, userId, userName, avatarUrl,
        });
      }
    }

    throw new BadRequestException('action inconnue');
  }

  // ═════════════════════════════════════════════════════════════════
  //  GET ?callId=x (media) — fournisseur courant d'un appel (diagnostics)
  //  GET /history — historique global (section Appels)
  //  GET /diagnostics — état global de la chaîne
  // ═════════════════════════════════════════════════════════════════
  @Get('media')
  async getMedia(@CurrentUser() user: AuthUser, @Query('callId') callId: string | undefined) {
    if (callId) {
      const provider = await this.chainService.getCallProvider(callId);
      return { provider, chain: this.chainService.effectiveChain() };
    }
    const picked = await this.chainService.pickProvider();
    return { chain: this.chainService.effectiveChain(), current: picked };
  }

  @Get('history')
  async getHistory(
    @CurrentUser() user: AuthUser,
    @TenantId() tenantId: string,
    @Query('limit') limit: string | undefined,
  ) {
    return this.signalService.getCallHistory(tenantId, user.id, Math.min(parseInt(limit || '50', 10) || 50, 200));
  }

  @Get('diagnostics')
  async getDiagnostics() {
    const health: Record<string, { configured: boolean; coolingDown: boolean }> = {};
    for (const p of MEDIA_PROVIDER_CHAIN) {
      health[p] = {
        configured: this.chainService.providerConfigured(p),
        coolingDown: await this.chainService.isProviderCoolingDown(p),
      };
    }
    return {
      chain: this.chainService.effectiveChain(),
      current: await this.chainService.pickProvider(),
      providersHealth: health,
    };
  }
}
