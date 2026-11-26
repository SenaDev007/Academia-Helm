/**
 * ============================================================================
 * 📧 TÂCHE 183 — PHASE 2 : SERVICE GOOGLE OAUTH2 (PKCE + API Gmail)
 * ============================================================================
 *
 * Rôle (CDC section 8) :
 *   1. startFlow()          — génère state + verifier PKCE, mémorise le flux
 *                             (CacheService, TTL 10 min, single usage) et
 *                             retourne l'URL de consentement Google.
 *   2. handleCallback()     — échange le code (avec verifier) contre un
 *                             refresh token, lit l'adresse du compte connecté,
 *                             puis délègue la persistance chiffrée à
 *                             SchoolEmailSettingsService.saveGoogleConnection
 *                             (mode google_oauth, statut Actif).
 *   3. getAccessToken()     — rafraîchit et met en cache les access tokens
 *                             (mémoire, marge de 120 s). invalid_grant →
 *                             connexion « Expirée » (markExpired).
 *   4. sendMail()           — construit le MIME (MailComposer de Nodemailer)
 *                             et l'envoie par l'API Gmail REST (messages/send,
 *                             portée gmail.send). Une seule reprise sur 401
 *                             après refresh forcé.
 *
 * Sécurité :
 *   - le refresh token est chiffré AES-256-GCM dans school_email_settings
 *     (colonnes partagées avec le mot de passe SMTP — même EmailCryptoService) ;
 *   - state anti-CSRF single usage (invalidé dès la première lecture) ;
 *   - la clé publique du client OAuth est portée par des variables
 *     d'environnement (GOOGLE_OAUTH_CLIENT_ID/SECRET) — jamais en base ;
 *   - le callback est @Public() (redirection navigateur depuis Google) mais
 *     ne touche QUE le tenant enregistré dans le state.
 * ============================================================================
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../common/services/cache.service';
import { PrismaService } from '../database/prisma.service';
import { SchoolEmailSettingsService } from './school-email-settings.service';
import {
  GmailApiError,
  GMAIL_API_PROFILE_URL,
  GMAIL_API_SEND_URL,
  GOOGLE_TOKEN_ENDPOINT,
  GOOGLE_USERINFO_ENDPOINT,
  GoogleAuthExpiredError,
  buildGoogleAuthUrl,
  generateCodeVerifier,
  generateOauthState,
  isGmailApiDisabledError,
  pkceChallengeS256,
  safeGmailErrorMessage,
  tokenErrorReason,
} from './google-oauth.helpers';

/** Compositeur MIME de Nodemailer (`export =` CJS — import-égal requis).
 *  Typé par @types/nodemailer/lib/mail-composer (compile() puis build()). */
import MailComposer = require('nodemailer/lib/mail-composer');

/** Durée de vie d'un flux d'autorisation en cours (state). */
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

/** Ce qui est mémorisé entre le start et le callback (CacheService). */
interface GoogleOauthStatePayload {
  tenantId: string;
  userId: string;
  codeVerifier: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  redirectUri: string;
}

/** Marge de rafraîchissement des access tokens (avant expiration réelle). */
const ACCESS_TOKEN_MARGIN_MS = 120 * 1000;

/** Paramètres d'un envoi via l'API Gmail. */
export interface GmailSendMailInput {
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  /**
   * Pièces jointes (files + logo inline de l'école). `cid` + `contentDisposition:
   * 'inline'` permettent l'embarquement d'images référencées par <img src="cid:…">
   * — géré nativement par MailComposer (même moteur que Nodemailer).
   */
  attachments?: Array<{
    filename: string;
    content?: Buffer;
    path?: string;
    contentType?: string;
    cid?: string;
    contentDisposition?: 'attachment' | 'inline';
  }>;
}

export interface GoogleSendResult {
  messageId?: string;
  provider: 'google_oauth';
}

@Injectable()
export class GoogleOauthService {
  private readonly logger = new Logger(GoogleOauthService.name);

  /** Cache mémoire des access tokens par école { token, expire le }. */
  private accessTokens = new Map<string, { token: string; expiresAt: number }>();

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly prisma: PrismaService,
    private readonly settings: SchoolEmailSettingsService,
  ) {}

  // ─── Configuration client (variables d'environnement) ─────────────────────

  /** true si YEHI OR Tech a configuré le client OAuth de la plateforme. */
  isConfigured(): boolean {
    return Boolean(this.clientId() && this.clientSecret());
  }

  private clientId(): string {
    return (this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID') || '').trim();
  }

  private clientSecret(): string {
    return (this.config.get<string>('GOOGLE_OAUTH_CLIENT_SECRET') || '').trim();
  }

  /**
   * URI de redirection enregistrée dans Google Cloud Console :
   * GOOGLE_OAUTH_REDIRECT_URI (override explicite) sinon dérivée de l'origine
   * de la requête (fonctionne en production ET en recette sans réglage).
   */
  redirectUri(origin?: string): string {
    const override = (this.config.get<string>('GOOGLE_OAUTH_REDIRECT_URI') || '').trim();
    if (override) return override;
    const base = (origin || 'https://api.academiahelm.com').replace(/\/+$/, '');
    return `${base}/api/school-email/google/callback`;
  }

  /** Page de l'onglet E-mail vers laquelle renvoyer le directeur après callback. */
  frontendSettingsUrl(): string {
    const base = (
      this.config.get<string>('FRONTEND_URL') ||
      this.config.get<string>('APP_PUBLIC_URL') ||
      'https://academiahelm.com'
    ).replace(/\/+$/, '');
    return `${base}/app/settings?tab=email`;
  }

  // ─── 1. Démarrage du flux (bouton « Connecter Google ») ───────────────────

  async startFlow(
    params: {
      tenantId: string;
      userId: string;
      fromName?: string;
      fromEmail?: string;
      replyTo?: string;
    },
    origin?: string,
  ): Promise<{ authUrl: string; redirectUri: string }> {
    if (!this.isConfigured()) {
      throw new BadRequestException(
        "Google OAuth2 n'est pas encore activé sur la plateforme — YEHI OR Tech doit d'abord configurer le client Google (GOOGLE_OAUTH_CLIENT_ID/SECRET).",
      );
    }

    const state = generateOauthState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = pkceChallengeS256(codeVerifier);
    const uri = this.redirectUri(origin);

    // Mémorise le flux (TTL 10 min, single usage au callback).
    const payload: GoogleOauthStatePayload = {
      tenantId: params.tenantId,
      userId: params.userId,
      codeVerifier,
      fromName: params.fromName?.trim() || undefined,
      fromEmail: params.fromEmail?.trim().toLowerCase() || undefined,
      replyTo: params.replyTo?.trim().toLowerCase() || undefined,
      redirectUri: uri,
    };
    await this.cache.set(`school-email:google-state:${state}`, payload, OAUTH_STATE_TTL_MS);

    const authUrl = buildGoogleAuthUrl({
      clientId: this.clientId(),
      redirectUri: uri,
      state,
      codeChallenge,
      // Pré-sélectionne le compte Google déclaré par l'école (facultatif).
      loginHint: payload.fromEmail,
    });

    this.logger.log(
      `Flux Google OAuth2 démarré (tenant ${params.tenantId}, user ${params.userId}, state ${state.slice(0, 8)}…)`,
    );
    return { authUrl, redirectUri: uri };
  }

  // ─── 2. Callback Google (redirection navigateur, @Public) ─────────────────

  /**
   * Traite le retour de Google : valide le state (single usage), échange le
   * code contre les jetons, lit l'adresse du compte autorisé puis persiste la
   * connexion chiffrée. Lève une erreur avec message affichable en cas
   * d'échec (le controller redirige alors vers l'onglet avec le motif).
   */
  async handleCallback(query: {
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  }): Promise<{ tenantId: string; googleEmail: string }> {
    // Refus explicite du directeur sur l'écran de consentement.
    if (query.error) {
      throw new BadRequestException(
        query.error === 'access_denied'
          ? "Vous avez refusé l'accès — l'envoi d'e-mails depuis le Gmail de l'école nécessite votre autorisation."
          : `Google a renvoyé une erreur : ${query.error}.`,
      );
    }
    if (!query.code || !query.state) {
      throw new BadRequestException('Retour Google incomplet (code ou state manquant).');
    }

    // State : lecture + invalidation IMMÉDIATE (single usage anti-rejeu).
    const cacheKey = `school-email:google-state:${query.state}`;
    const payload = await this.cache.get<GoogleOauthStatePayload>(cacheKey);
    await this.cache.invalidate(cacheKey).catch(() => {});
    if (!payload) {
      throw new BadRequestException(
        "Session d'autorisation expirée ou déjà utilisée — relancez la connexion depuis l'onglet E-mail (validité 10 minutes).",
      );
    }

    // Échange du code (PKCE verifier obligatoire, même redirect_uri).
    const tokens = await this.exchangeCodeForTokens(query.code, payload);

    // Adresse RÉELLE du compte autorisé (From = compte authentifié, règle Gmail).
    const googleEmail = await this.fetchUserinfoEmail(tokens.access_token);
    if (!googleEmail) {
      throw new BadRequestException(
        "Google n'a pas retourné l'adresse du compte autorisé — réessayez la connexion.",
      );
    }

    // TÂCHE 185 — l'oubli classique : consentement + jetons OK mais API Gmail
    // non activée dans le projet Google Cloud → le 1ᵉʳ envoi échouerait en 403.
    // Détecté ICI, au moment de la connexion, avec un message actionnable.
    await this.assertGmailApiEnabled(tokens.access_token);

    // Persistance chiffrée : mode google_oauth, statut Actif, From imposé.
    await this.settings.saveGoogleConnection(payload.tenantId, payload.userId, {
      refreshToken: tokens.refresh_token,
      googleEmail,
      fromName: payload.fromName,
      replyTo: payload.replyTo,
    });

    // Invalide l'éventuel access token mémorisé pour cette école.
    this.accessTokens.delete(payload.tenantId);

    this.logger.log(
      `Connexion Google OAuth2 établie (tenant ${payload.tenantId}, compte ${googleEmail}, user ${payload.userId})`,
    );
    return { tenantId: payload.tenantId, googleEmail };
  }

  /** POST /token — grant_type=authorization_code + code_verifier (PKCE). */
  private async exchangeCodeForTokens(
    code: string,
    payload: GoogleOauthStatePayload,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const body = new URLSearchParams({
      code,
      client_id: this.clientId(),
      client_secret: this.clientSecret(),
      redirect_uri: payload.redirectUri,
      code_verifier: payload.codeVerifier,
      grant_type: 'authorization_code',
    });
    const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const text = await res.text();
    if (!res.ok) {
      this.logger.warn(`Échange du code Google échoué : ${tokenErrorReason(text)}`);
      throw new BadRequestException(
        `L'échange du code d'autorisation a échoué (${tokenErrorReason(text)}). Relancez la connexion.`,
      );
    }
    const json = JSON.parse(text) as { access_token?: string; refresh_token?: string };
    if (!json.access_token || !json.refresh_token) {
      throw new BadRequestException(
        "Google n'a pas renvoyé de refresh token — relancez la connexion (l'écran de consentement doit être validé en entier).",
      );
    }
    return { access_token: json.access_token, refresh_token: json.refresh_token };
  }

  /** GET /userinfo — adresse du compte qui vient d'autoriser. */
  private async fetchUserinfoEmail(accessToken: string): Promise<string | null> {
    const res = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { email?: string };
    return json.email?.toLowerCase() || null;
  }

  /**
   * Sonde users.getProfile : ne bloque la connexion QUE si l'API Gmail est
   * désactivée dans le projet Google Cloud (défaut de configuration plateforme,
   * déterministe). Tout autre résultat (200, portée insuffisante, réseau…)
   * laisse passer — le premier envoi remonterait alors la cause réelle.
   */
  private async assertGmailApiEnabled(accessToken: string): Promise<void> {
    let res: Response;
    try {
      res = await fetch(GMAIL_API_PROFILE_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      return; // réseau : ne bloque pas la connexion sur une sonde best-effort
    }
    if (res.ok) return;
    const text = await res.text().catch(() => '');
    if (isGmailApiDisabledError(text)) {
      throw new BadRequestException(
        "L'API Gmail n'est pas activée dans le projet Google Cloud de la plateforme (Academia Helm). " +
          'YEHI OR Tech doit l’activer une seule fois : console.cloud.google.com → APIs & Services → ' +
          'Bibliothèque → « Gmail API » → Activer — puis relancez la connexion.',
      );
    }
  }

  // ─── 3. Access tokens (cache mémoire + refresh) ───────────────────────────

  /**
   * Retourne un access token valide pour l'école. Rafraîchit si nécessaire
   * (marge de 120 s). invalid_grant → connexion « Expirée » + erreur typée.
   */
  async getAccessToken(tenantId: string, forceRefresh = false): Promise<string> {
    const cached = this.accessTokens.get(tenantId);
    if (!forceRefresh && cached && cached.expiresAt > Date.now() + ACCESS_TOKEN_MARGIN_MS) {
      return cached.token;
    }

    // Le refresh token EST le secret chiffré de l'école (mode google_oauth).
    const refreshToken = await this.settings.decryptSecret(tenantId);

    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.clientId(),
      client_secret: this.clientSecret(),
      grant_type: 'refresh_token',
    });
    let res: Response;
    try {
      res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch (err: any) {
      // Réseau : laisse la file relancer (classifyGmailApiError → retryable).
      throw new GmailApiError(
        `Rafraîchissement du jeton Google impossible : ${err?.code || err?.message}`,
        0,
      );
    }
    const text = await res.text();

    if (!res.ok) {
      if (res.status === 400 && text.includes('invalid_grant')) {
        // CDC section 8 : invalid_grant → connexion Expirée (reconnexion).
        await this.settings.markExpired(
          tenantId,
          "Google a révoqué l'autorisation (invalid_grant) — reconnectez le compte de l'école depuis l'onglet E-mail.",
        );
        this.accessTokens.delete(tenantId);
        throw new GoogleAuthExpiredError(
          "L'autorisation Google de l'école a expiré — reconnectez le compte depuis Paramètres, onglet E-mail.",
        );
      }
      throw new GmailApiError(
        `Rafraîchissement du jeton refusé : ${tokenErrorReason(text)}`,
        res.status,
        text,
      );
    }

    const json = JSON.parse(text) as { access_token?: string; expires_in?: number };
    if (!json.access_token) {
      throw new GmailApiError('Réponse Google sans access_token.', 0);
    }
    this.accessTokens.set(tenantId, {
      token: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    });
    return json.access_token;
  }

  // ─── 4. Envoi via l'API Gmail REST (portée gmail.send) ────────────────────

  /**
   * Envoie un e-mail via l'API Gmail du compte connecté de l'école.
   * Le MIME est composé par Nodemailer (MailComposer) — From imposé au compte
   * authentifié par Google. Une reprise unique sur 401 (refresh + re-essai).
   *
   * @returns soit le messageId Gmail, soit lève une erreur classifiable par
   *          classifyGmailApiError (retryable / fatal_auth / fatal / expired).
   */
  async sendMail(tenantId: string, mail: GmailSendMailInput): Promise<GoogleSendResult> {
    // MIME brut (en-têtes + corps + pièces jointes) encodé base64url.
    const raw = await this.buildRawMime(mail);

    // 1ʳᵉ tentative (jeton en cache ou rafraîchi).
    let accessToken: string;
    try {
      accessToken = await this.getAccessToken(tenantId);
    } catch (err) {
      if (err instanceof GoogleAuthExpiredError) throw err;
      // Impossible d'obtenir un jeton maintenant (réseau…) → erreur neutre
      // classée « retryable » par le dispatcher (statut 0).
      throw new GmailApiError(safeGmailErrorMessage(err), 0);
    }

    let res: Response;
    try {
      res = await fetch(GMAIL_API_SEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      });
    } catch (err: any) {
      throw new GmailApiError(`Appel API Gmail impossible : ${err?.code || err?.message}`, 0);
    }

    // 401 : jeton périmé entre-temps → refresh forcé + UNE reprise.
    if (res.status === 401) {
      const text = await res.text();
      try {
        accessToken = await this.getAccessToken(tenantId, true);
      } catch (err) {
        if (err instanceof GoogleAuthExpiredError) throw err;
        throw new GmailApiError(safeGmailErrorMessage(err), 401, text);
      }
      try {
        res = await fetch(GMAIL_API_SEND_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw }),
        });
      } catch (err: any) {
        throw new GmailApiError(`Appel API Gmail impossible : ${err?.code || err?.message}`, 0);
      }
    }

    const text = await res.text();
    if (!res.ok) {
      throw new GmailApiError(
        `Envoi refusé par l'API Gmail : ${tokenErrorReason(text)}`,
        res.status,
        text,
      );
    }

    let messageId: string | undefined;
    try {
      messageId = (JSON.parse(text) as { id?: string }).id;
    } catch {
      /* pas bloquant */
    }
    return { messageId, provider: 'google_oauth' };
  }

  /** Compose le message MIME via MailComposer (Nodemailer) et l'encode. */
  private async buildRawMime(mail: GmailSendMailInput): Promise<string> {
    const composer = new MailComposer({
      from: mail.from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: mail.replyTo,
      attachments: mail.attachments,
    });
    const buffer = await composer.compile().build();
    return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
}
