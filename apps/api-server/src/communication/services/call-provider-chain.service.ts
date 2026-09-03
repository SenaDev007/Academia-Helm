/**
 * ============================================================================
 * CALL PROVIDER CHAIN SERVICE — Chaîne de repli multimédia des appels
 * ============================================================================
 *
 * ⭐ V4 (porté de « Yeshua Connect » / Christ Libère) :
 *   « LiveKit est la source de vérité ; si LiveKit a des problèmes, Agora
 *    prend immédiatement le relais ; et si Agora a des problèmes, Daily
 *    prend automatiquement le relais. »
 *
 * ARCHITECTURE (arbitrage SERVEUR — même décision pour tous les clients) :
 *
 *   1. CHAÎNE ORDONNÉE : livekit → agora → daily. Le repli ultime reste le
 *      mesh WebRTC existant côté client (≤5 participants) — équivalent du
 *      « Plan C » P2P/Jitsi de Yeshua Connect.
 *
 *   2. SANTÉ PARTAGÉE en base (table chat_call_provider_health) — pas en
 *      mémoire : chaque instance Railway/lambda aurait sinon son propre
 *      état. Un fournisseur qui échoue entre en « cooldown » 5 minutes ;
 *      chaque NOUVEL appel repart de LiveKit (source de vérité) dès la fin
 *      du cooldown.
 *
 *   3. ARBITRAGE PAR APPEL (colonne chat_call_signals."mediaProvider") :
 *      quand l'appelant (ou un participant) signale l'échec d'un
 *      fournisseur (action « failover »), le serveur fait AVANCER l'appel
 *      au suivant et PERSISTE le choix — le destinataire qui décroche
 *      rejoint le MÊME fournisseur via le champ mediaProvider du polling
 *      d'état (2 s).
 *
 *   4. CANAUX VOCAUX : même logique (table chat_voice_media_provider,
 *      clé = channelId) — pas de CallSignal pour les rooms persistantes.
 *
 *   5. IDENTIFIANTS (env) — un fournisseur sans identifiants est
 *      simplement SAUTÉ (chaîne dégradée propre, jamais d'erreur) :
 *      - LiveKit : LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET
 *      - Agora   : AGORA_APP_ID / AGORA_APP_CERTIFICATE
 *      - Daily   : DAILY_API_KEY
 *
 * Tokens générés CÔTÉ SERVEUR uniquement (jamais de secret côté client) :
 *   - LiveKit : JWT HS256 manuel (même format que LiveKitTokenService —
 *     100 % compatible, aucune dépendance externe requise)
 *   - Agora   : RtcTokenBuilder (paquet officiel agora-token — local,
 *     zéro réseau, impossible à échouer par lui-même)
 *   - Daily   : API REST (création de room + meeting-token — le seul
 *     appel réseau, dont l'échec nourrit directement la santé Daily)
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash, createHmac, randomBytes } from 'crypto';
import { randomUUID } from 'crypto';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { PrismaService } from '../../database/prisma.service';

/** Ordre STRICT imposé : LiveKit (vérité) → Agora → Daily. */
export const MEDIA_PROVIDER_CHAIN = ['livekit', 'agora', 'daily'] as const;
export type MediaProviderName = (typeof MEDIA_PROVIDER_CHAIN)[number];

/** Cooldown d'un fournisseur défaillant (ms) — il redevient éligible après. */
const PROVIDER_COOLDOWN_MS = 5 * 60 * 1000;

/** Durée de validité des tokens générés (s) — 2 h couvre tout appel. */
const TOKEN_TTL_SEC = 2 * 60 * 60;

// ═══════════════════════════════════════════════════════════════════════
//  Types partagés avec le frontend (lib/chat/media-chain.ts)
// ═══════════════════════════════════════════════════════════════════════

export interface ProviderBundle {
  provider: MediaProviderName;
  roomName: string;
  /** Chaîne EFFECTIVE (fournisseurs configurés, dans l'ordre). */
  chain: MediaProviderName[];
  /** Vue diagnostic (aucun secret) pour l'UI « Réseau : … ». */
  providersHealth: Record<string, { configured: boolean; coolingDown: boolean }>;
  livekit?: { url: string; token: string };
  agora?: { appId: string; token: string; channel: string; uid: number };
  daily?: { url: string; token: string };
}

@Injectable()
export class CallProviderChainService {
  private readonly logger = new Logger(CallProviderChainService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═════════════════════════════════════════════════════════════════
  //  Configuration des fournisseurs (lecture env, pure)
  // ═════════════════════════════════════════════════════════════════

  providerConfigured(provider: MediaProviderName): boolean {
    switch (provider) {
      case 'livekit':
        return !!(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);
      case 'agora':
        return !!(process.env.AGORA_APP_ID && process.env.AGORA_APP_CERTIFICATE);
      case 'daily':
        return !!process.env.DAILY_API_KEY;
    }
  }

  /** Liste des fournisseurs réellement configurés (ordre de la chaîne). */
  effectiveChain(): MediaProviderName[] {
    return MEDIA_PROVIDER_CHAIN.filter((p) => this.providerConfigured(p));
  }

  // ═════════════════════════════════════════════════════════════════
  //  Santé partagée (table chat_call_provider_health)
  // ═════════════════════════════════════════════════════════════════

  /**
   * Enregistre l'échec d'un fournisseur : incrément du compteur + cooldown
   * de 5 minutes. Les NOUVEAUX appels l'éviteront ; les appels en cours qui
   * y sont déjà restent dessus tant qu'ils ne signalent pas d'échec.
   */
  async recordProviderFailure(provider: MediaProviderName, reason: string): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "chat_call_provider_health" ("provider", "failCount", "lastFailureAt", "lastReason", "cooldownUntil")
         VALUES ($1, 1, now(), $2, now() + interval '5 minutes')
         ON CONFLICT ("provider") DO UPDATE SET
           "failCount" = "chat_call_provider_health"."failCount" + 1,
           "lastFailureAt" = now(),
           "lastReason" = $2,
           "cooldownUntil" = now() + interval '5 minutes'`,
        provider,
        reason.slice(0, 300),
      );
      this.logger.warn(`${provider} en échec (${reason}) → cooldown 5 min`);
    } catch (e: any) {
      this.logger.error(`recordProviderFailure: ${e.message}`);
    }
  }

  /** Réinitialise la santé d'un fournisseur (connexion réussie constatée). */
  async recordProviderSuccess(provider: MediaProviderName): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "chat_call_provider_health" ("provider", "failCount", "lastFailureAt", "lastReason", "cooldownUntil")
         VALUES ($1, 0, NULL, NULL, NULL)
         ON CONFLICT ("provider") DO UPDATE SET
           "failCount" = 0, "lastFailureAt" = NULL, "lastReason" = NULL, "cooldownUntil" = NULL`,
        provider,
      );
    } catch {
      // best effort
    }
  }

  /** Un fournisseur est-il en cooldown (dernier échec < 5 min) ? */
  async isProviderCoolingDown(provider: MediaProviderName): Promise<boolean> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ cooling: boolean }>>(
        `SELECT ("cooldownUntil" IS NOT NULL AND "cooldownUntil" > now()) AS "cooling"
         FROM "chat_call_provider_health" WHERE "provider" = $1`,
        provider,
      );
      return rows.length > 0 && rows[0].cooling === true;
    } catch {
      return false;
    }
  }

  /**
   * ⭐ Choix du fournisseur pour un NOUVEL appel/room : le premier de la
   * chaîne qui est configuré ET hors cooldown. null si TOUT est épuisé (le
   * client garde le repli mesh WebRTC existant).
   */
  async pickProvider(): Promise<MediaProviderName | null> {
    for (const p of MEDIA_PROVIDER_CHAIN) {
      if (!this.providerConfigured(p)) continue;
      if (await this.isProviderCoolingDown(p)) continue;
      return p;
    }
    return null;
  }

  /** Fournisseur SUIVANT après `from` (échec signalé). null = épuisé. */
  async nextProviderAfter(from: MediaProviderName): Promise<MediaProviderName | null> {
    const idx = MEDIA_PROVIDER_CHAIN.indexOf(from);
    for (let i = idx + 1; i < MEDIA_PROVIDER_CHAIN.length; i++) {
      const p = MEDIA_PROVIDER_CHAIN[i];
      if (!this.providerConfigured(p)) continue;
      if (await this.isProviderCoolingDown(p)) continue;
      return p;
    }
    return null;
  }

  // ═════════════════════════════════════════════════════════════════
  //  Noms de rooms/channels — MÊME espacement de noms pour les 3
  //  fournisseurs (helm-call-<hash10> / helm-voice-<hash10>)
  // ═════════════════════════════════════════════════════════════════

  /**
   * ⭐ V5.2 — CORRECTIF CRITIQUE (bug de production) : les noms de rooms
   * Daily sont CONTRAINTS (minuscules/chiffres/tirets, longueur max ~38
   * caractères). L'ancien format `helm-call-<uuid36>` = 46 caractères →
   * l'API Daily répondait 400 à la création, avalé comme « room existe »
   * (statut 400/409 toléré) puis le GET de contrôle renvoyait 404 →
   * « Daily room introuvable après création » → cooldown Daily → chaîne
   * ÉPUISÉE → tous les appels retombaient en mesh.
   *
   * On raccourcit via un hash SHA-256 STABLE (`kind:conversationId`) :
   * la même conversation → la même room pour l'APPELANT et le DESTINATAIRE
   * (condition indispensable au rendez-vous des deux parties), 20-21
   * caractères — compatible Daily, LiveKit (libre) et Agora (≤64 octets).
   */
  roomNameFor(kind: 'call' | 'voice', conversationId: string): string {
    const short = createHash('sha256').update(`${kind}:${conversationId}`).digest('hex').slice(0, 10);
    return `helm-${kind}-${short}`;
  }

  // ═════════════════════════════════════════════════════════════════
  //  Génération des identifiants (tokens) — 100 % serveur
  // ═════════════════════════════════════════════════════════════════

  /**
   * LiveKit : JWT HS256 manuel (même format que LiveKitTokenService, avec
   * métadonnées avatar pour l'affichage des tuiles vidéo).
   */
  private buildLiveKitCreds(
    roomName: string,
    identity: string,
    name: string,
    avatarUrl?: string | null,
  ): { url: string; token: string } {
    const apiKey = process.env.LIVEKIT_API_KEY!;
    const apiSecret = process.env.LIVEKIT_API_SECRET!;
    const url = process.env.LIVEKIT_URL!;
    const now = Math.floor(Date.now() / 1000);
    const payload: any = {
      iss: apiKey,
      sub: identity,
      nbf: now,
      exp: now + TOKEN_TTL_SEC,
      name,
      video: {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
      sid: randomBytes(8).toString('hex'),
      jti: randomBytes(8).toString('hex'),
    };
    if (avatarUrl) {
      payload.metadata = JSON.stringify({ avatarUrl });
    }
    const header = { alg: 'HS256', typ: 'JWT', kid: apiKey };
    const b64 = (obj: any) =>
      Buffer.from(JSON.stringify(obj), 'utf8').toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const signingInput = `${b64(header)}.${b64(payload)}`;
    const signature = createHmac('sha256', apiSecret)
      .update(signingInput).digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return { url, token: `${signingInput}.${signature}` };
  }

  /** Hash djb2 → uint32 stable (uid Agora). */
  private uidHash(userId: string): number {
    let h = 5381;
    for (let i = 0; i < userId.length; i++) h = ((h << 5) + h + userId.charCodeAt(i)) >>> 0;
    return h % 2147483647;
  }

  /** Agora : token RTC local (paquet officiel — aucun appel réseau). */
  private buildAgoraCreds(
    channel: string,
    userId: string,
  ): { appId: string; token: string; channel: string; uid: number } {
    const appId = process.env.AGORA_APP_ID || '';
    const uid = this.uidHash(userId);
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      process.env.AGORA_APP_CERTIFICATE || '',
      channel,
      uid,
      RtcRole.PUBLISHER,
      TOKEN_TTL_SEC,
      TOKEN_TTL_SEC,
    );
    return { appId, token, channel, uid };
  }

  // ─── Daily : cache léger de rooms (une création par conversation suffit) ──
  private get dailyRoomCache(): Map<string, { url: string; createdAt: number }> {
    const g = globalThis as unknown as { __helmDailyRoomCache?: Map<string, { url: string; createdAt: number }> };
    if (!g.__helmDailyRoomCache) g.__helmDailyRoomCache = new Map();
    return g.__helmDailyRoomCache;
  }

  /**
   * Daily : garantit l'existence de la room privée (API REST) et renvoie son
   * URL. Échec réseau = échec Daily → nourrit la santé (recordProviderFailure
   * appelé par le contrôleur media sur catch).
   */
  private async ensureDailyRoom(roomName: string): Promise<string> {
    const cached = this.dailyRoomCache.get(roomName);
    // cache 24 h — les rooms Daily privées persistent tant qu'aucune
    // expiration n'est fixée, un GET de contrôle suffit alors.
    if (cached && Date.now() - cached.createdAt < 24 * 3600 * 1000) {
      return cached.url;
    }
    const headers = {
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      'Content-Type': 'application/json',
    };
    // 1) La room existe-t-elle déjà ? (GET — évite le quota de création)
    const getRes = await fetch(`https://api.daily.co/v1/rooms/${encodeURIComponent(roomName)}`, {
      headers,
      cache: 'no-store',
    }).catch(() => null);
    if (getRes && getRes.ok) {
      const room = (await getRes.json()) as { url?: string };
      if (room.url) {
        this.dailyRoomCache.set(roomName, { url: room.url, createdAt: Date.now() });
        return room.url;
      }
    }
    // 2) Création (room PRIVÉE — meeting-token obligatoire pour rejoindre).
    //    ⭐ V5.2 — max_participants SUPPRIMÉ : propriété marquée x-paidPlan
    //    dans la spec OpenAPI Daily → 400 invalid-request-error sur les
    //    comptes gratuits (défaut plan : 200 participants — largement assez).
    const createRes = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: roomName,
        privacy: 'private',
        properties: {
          enable_chat: false, // le chat passe par Helm Connect, pas Daily
          enable_people_ui: true,
          enable_screenshare: true,
          start_video_off: true,
          start_audio_off: false,
        },
      }),
    });
    // 409/400 « room-exists » → la room existe déjà, on relit.
    if (!createRes.ok && createRes.status !== 400 && createRes.status !== 409) {
      throw new Error(`Daily room: HTTP ${createRes.status}`);
    }
    const created = (await createRes.json().catch(() => ({}))) as { url?: string; error?: string; info?: string };
    // ⭐ V5.2 — un 400 n'est PAS toujours « room existe » (ex: nom invalide,
    //    propriété payante, quota dépassé) : on remonte la VRAIE raison de
    //    l'API (error + info) au lieu de l'avaler puis d'échouer avec un
    //    « introuvable » non-diagnostiquable.
    if (!createRes.ok && createRes.status === 400 && created?.error && created.error !== 'room-exists') {
      throw new Error(`Daily room 400: ${created.error}${created.info ? ` (${created.info})` : ''}`);
    }
    if (created.url) {
      this.dailyRoomCache.set(roomName, { url: created.url, createdAt: Date.now() });
      return created.url;
    }
    const retry = await fetch(`https://api.daily.co/v1/rooms/${encodeURIComponent(roomName)}`, {
      headers,
      cache: 'no-store',
    });
    const room = (await retry.json().catch(() => ({}))) as { url?: string };
    if (!room.url) throw new Error('Daily room introuvable après création');
    this.dailyRoomCache.set(roomName, { url: room.url, createdAt: Date.now() });
    return room.url;
  }

  /** Daily : meeting-token (participant simple). */
  private async buildDailyCreds(roomName: string): Promise<{ url: string; token: string }> {
    const url = await this.ensureDailyRoom(roomName);
    const tokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { room_name: roomName, is_owner: false },
      }),
    });
    if (!tokenRes.ok) {
      throw new Error(`Daily token: HTTP ${tokenRes.status}`);
    }
    const { token } = (await tokenRes.json()) as { token: string };
    return { url, token };
  }

  // ═════════════════════════════════════════════════════════════════
  //  Bundle complet envoyé au client (une seule forme pour les 3)
  // ═════════════════════════════════════════════════════════════════

  /**
   * Construit le bundle d'un fournisseur pour un utilisateur donné.
   * ⚠️ Peut JETER (ex. Daily réseau mort) — l'appelant (contrôleur media)
   * catch et bascule au suivant : c'est la boucle de repli serveur.
   */
  async buildProviderBundle(
    provider: MediaProviderName,
    opts: {
      kind: 'call' | 'voice';
      conversationId: string;
      userId: string;
      userName: string;
      avatarUrl?: string | null;
    },
  ): Promise<ProviderBundle> {
    const roomName = this.roomNameFor(opts.kind, opts.conversationId);
    const bundle: ProviderBundle = {
      provider,
      roomName,
      chain: this.effectiveChain(),
      providersHealth: {},
    };
    for (const p of MEDIA_PROVIDER_CHAIN) {
      bundle.providersHealth[p] = {
        configured: this.providerConfigured(p),
        coolingDown: await this.isProviderCoolingDown(p),
      };
    }
    switch (provider) {
      case 'livekit':
        bundle.livekit = this.buildLiveKitCreds(roomName, opts.userId, opts.userName, opts.avatarUrl);
        break;
      case 'agora':
        bundle.agora = this.buildAgoraCreds(roomName, opts.userId);
        break;
      case 'daily':
        bundle.daily = await this.buildDailyCreds(roomName);
        break;
    }
    return bundle;
  }

  // ═════════════════════════════════════════════════════════════════
  //  Arbitrage persisté : par APPEL (chat_call_signals) et par CANAL VOCAL
  // ═════════════════════════════════════════════════════════════════

  /** Fournisseur courant d'un appel (défaut : le premier de la chaîne). */
  async getCallProvider(callId: string): Promise<MediaProviderName | null> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ mediaProvider: string | null }>>(
        `SELECT "mediaProvider" FROM "chat_call_signals" WHERE "id" = $1`,
        callId,
      );
      const stored = rows[0]?.mediaProvider;
      if (stored && (MEDIA_PROVIDER_CHAIN as readonly string[]).includes(stored)) {
        return stored as MediaProviderName;
      }
      return this.pickProvider();
    } catch {
      return this.pickProvider();
    }
  }

  /** Fait avancer un appel au fournisseur suivant après échec de `from`. */
  async advanceCallProvider(
    callId: string,
    from: MediaProviderName,
    reason: string,
  ): Promise<MediaProviderName | null> {
    await this.recordProviderFailure(from, reason);
    const next = await this.nextProviderAfter(from);
    if (next) {
      try {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "chat_call_signals" SET "mediaProvider" = $2 WHERE "id" = $1`,
          callId,
          next,
        );
      } catch (e: any) {
        this.logger.error(`advanceCallProvider UPDATE: ${e.message}`);
      }
    }
    return next;
  }

  /** Fournisseur courant d'un canal vocal (table chat_voice_media_provider). */
  async getVoiceProvider(channelId: string): Promise<MediaProviderName | null> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ provider: string | null }>>(
        `SELECT "provider" FROM "chat_voice_media_provider" WHERE "channelId" = $1`,
        channelId,
      );
      const stored = rows[0]?.provider;
      if (stored && (MEDIA_PROVIDER_CHAIN as readonly string[]).includes(stored)) {
        return stored as MediaProviderName;
      }
    } catch {
      // table absente au tout premier déploiement → pickProvider
    }
    return this.pickProvider();
  }

  /** Fait avancer un canal vocal au suivant après échec de `from`. */
  async advanceVoiceProvider(
    channelId: string,
    from: MediaProviderName,
    reason: string,
  ): Promise<MediaProviderName | null> {
    await this.recordProviderFailure(from, reason);
    const next = await this.nextProviderAfter(from);
    if (next) {
      try {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO "chat_voice_media_provider" ("channelId", "provider", "updatedAt")
           VALUES ($1, $2, now())
           ON CONFLICT ("channelId") DO UPDATE SET "provider" = $2, "updatedAt" = now()`,
          channelId,
          next,
        );
      } catch (e: any) {
        this.logger.error(`advanceVoiceProvider: ${e.message}`);
      }
    }
    return next;
  }

  /** Écrit le fournisseur choisi pour un canal vocal (join initial). */
  async setVoiceProvider(channelId: string, provider: MediaProviderName): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "chat_voice_media_provider" ("channelId", "provider", "updatedAt")
         VALUES ($1, $2, now())
         ON CONFLICT ("channelId") DO UPDATE SET "provider" = $2, "updatedAt" = now()`,
        channelId,
        provider,
      );
    } catch {
      // best effort — l'arbitrage retombera sur pickProvider au prochain join
    }
  }
}
