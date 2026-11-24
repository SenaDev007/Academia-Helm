/**
 * ============================================================================
 * 📧 TÂCHE 181 — RÉGLAGES E-MAIL DE L'ÉCOLE (school_email_settings)
 * ============================================================================
 *
 * Responsable de : lecture (vue SÛRE sans secret), sauvegarde (chiffrement),
 * déconnexion (suppression des secrets), compteur 24 h glissantes, journal
 * des 50 derniers envois, plafond daily_cap.
 *
 * Isolation multi-tenant : TOUTES les requêtes filtrent par tenantId
 * (= schoolId). Aucune lecture croisée entre écoles.
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';
import { EmailCryptoService, EmailSecretDecryptError } from './email-crypto.service';
import {
  EmailSendLogEntry,
  SaveSchoolEmailConfigDto,
  SchoolEmailSettingsView,
  SchoolEmailUsageView,
} from './dto/school-email.dto';

/** Colonnes secrètes — ne sortent JAMAIS du service. */
const PUBLIC_SELECT = {
  id: true,
  tenantId: true,
  mode: true,
  fromName: true,
  fromEmail: true,
  replyTo: true,
  smtpHost: true,
  smtpPort: true,
  smtpUser: true,
  status: true,
  lastError: true,
  lastVerifiedAt: true,
  dailyCap: true,
  updatedAt: true,
} as const;

@Injectable()
export class SchoolEmailSettingsService {
  private readonly logger = new Logger(SchoolEmailSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: EmailCryptoService,
  ) {}

  /** Ligne de réglages brute (avec colonnes secrètes) — usage interne uniquement. */
  async findRaw(tenantId: string) {
    return this.prisma.schoolEmailSetting.findUnique({ where: { tenantId } });
  }

  /** Vue sûre pour l'API (aucun secret, aucun ciphertext). */
  async getView(tenantId: string): Promise<SchoolEmailSettingsView> {
    const row = await this.prisma.schoolEmailSetting.findUnique({
      where: { tenantId },
      select: PUBLIC_SELECT,
    });
    if (!row) {
      return {
        configured: false,
        mode: 'aucun',
        fromName: null,
        fromEmail: null,
        replyTo: null,
        smtpHost: null,
        smtpPort: null,
        smtpUser: null,
        secretSet: false,
        status: 'non_configure',
        lastError: null,
        lastVerifiedAt: null,
        dailyCap: 490,
      };
    }
    const raw = await this.findRaw(tenantId);
    return {
      configured: row.mode !== 'aucun',
      mode: row.mode as SchoolEmailSettingsView['mode'],
      fromName: row.fromName,
      fromEmail: row.fromEmail,
      replyTo: row.replyTo,
      smtpHost: row.smtpHost,
      smtpPort: row.smtpPort,
      smtpUser: row.smtpUser,
      secretSet: this.crypto.hasSecret(raw ?? {}),
      status: row.status as SchoolEmailSettingsView['status'],
      lastError: row.lastError,
      lastVerifiedAt: row.lastVerifiedAt ? row.lastVerifiedAt.toISOString() : null,
      dailyCap: row.dailyCap,
    };
  }

  /**
   * Sauvegarde de la configuration SMTP (Phase 1).
   * - Chiffre le mot de passe d'application s'il est fourni ; sinon conserve
   *   le secret existant (édition sans retaper).
   * - Le statut repasse à « actif » de façon OPTIMISTE ; la vérification réelle
   *   (connexion SMTP) est faite par le controller juste après (verifyAndMark).
   */
  async saveConfig(
    tenantId: string,
    userId: string,
    dto: SaveSchoolEmailConfigDto,
  ): Promise<SchoolEmailSettingsView> {
    const fromEmail = dto.fromEmail.trim().toLowerCase();
    const smtpUser = (dto.smtpUser || fromEmail).trim().toLowerCase();
    const smtpHost = (dto.smtpHost || 'smtp.gmail.com').trim();
    const smtpPort = dto.smtpPort ?? 587;
    const replyTo = (dto.replyTo || fromEmail).trim().toLowerCase();

    if (smtpPort !== 587 && smtpPort !== 465) {
      throw new BadRequestException(
        'Port SMTP non supporté pour Gmail : utilisez 587 (STARTTLS) ou 465 (SSL).',
      );
    }

    const existing = await this.findRaw(tenantId);

    // Secrets : nouveau mot de passe fourni, sinon on conserve l'existant.
    let secretCols: { secretEncrypted: string; secretIv: string; secretTag: string } | null = null;
    if (dto.smtpPassword && dto.smtpPassword.trim().length > 0) {
      secretCols = this.crypto.encrypt(dto.smtpPassword.trim());
    } else if (existing && this.crypto.hasSecret(existing)) {
      secretCols = {
        secretEncrypted: existing.secretEncrypted!,
        secretIv: existing.secretIv!,
        secretTag: existing.secretTag!,
      };
    } else {
      throw new BadRequestException(
        "Le mot de passe d'application est requis pour une première configuration.",
      );
    }

    const data = {
      mode: 'smtp' as const,
      fromName: dto.fromName.trim(),
      fromEmail,
      replyTo,
      smtpHost,
      smtpPort,
      smtpUser,
      ...secretCols,
      status: 'actif' as const, // optimiste — corrigé par verifyAndMark si échec
      lastError: null,
      lastVerifiedAt: new Date(),
      dailyCap: existing?.dailyCap ?? 490,
    };

    await this.prisma.schoolEmailSetting.upsert({
      where: { tenantId },
      update: { ...prismaUpdateDefaults(), ...data },
      create: { ...prismaCreateDefaults(), tenantId, ...data },
    });

    this.logger.log(
      `Configuration e-mail enregistrée (tenant ${tenantId}, user ${userId}) — secret ${secretCols ? 'chiffré' : 'inchangé'}`,
    );
    return this.getView(tenantId);
  }

  /**
   * TÂCHE 183 (Phase 2, CDC section 8) — Enregistre une connexion Google
   * OAuth2 issue du callback : refresh token chiffré AES-256-GCM (mêmes
   * colonnes que le mot de passe SMTP), mode google_oauth, statut Actif.
   *
   * From bloqué : fromEmail = adresse du compte RÉELLEMENT autorisé (rule
   * Gmail — le compte authentifié). Migration 1 clic : fromName/replyTo
   * existants conservés (param > existant > nom du tenant), plafond conservé.
   */
  async saveGoogleConnection(
    tenantId: string,
    userId: string,
    p: { refreshToken: string; googleEmail: string; fromName?: string; replyTo?: string },
  ): Promise<SchoolEmailSettingsView> {
    if (!p.refreshToken || p.refreshToken.length < 20) {
      throw new BadRequestException('Refresh token Google invalide.');
    }
    const googleEmail = p.googleEmail.trim().toLowerCase();

    const existing = await this.findRaw(tenantId);

    // fromName : param (formulaire au moment du « Connecter Google ») >
    // existant (migration 1 clic sans ressaisir) > nom du tenant.
    let fromName = (p.fromName || existing?.fromName || '').trim();
    if (!fromName) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
      fromName = (tenant?.name || 'École').trim();
    }

    // Reply-To : param > existant > adresse Google (défaut).
    const replyTo = (p.replyTo || existing?.replyTo || googleEmail).trim().toLowerCase();

    const secretCols = this.crypto.encrypt(p.refreshToken.trim());
    const data = {
      mode: 'google_oauth' as const,
      fromName,
      fromEmail: googleEmail, // compte authentifié — imposé par Gmail
      replyTo,
      // Les réglages SMTP sont conservés pour un éventuel retour arrière
      // (le secret étant partagé, un retour SMTP exigera de ressaisir le
      // mot de passe d'application — documenté dans l'onglet).
      ...secretCols,
      status: 'actif' as const, // l'échange du code a déjà validé le jeton
      lastError: null,
      lastVerifiedAt: new Date(),
      dailyCap: existing?.dailyCap ?? 490,
    };

    await this.prisma.schoolEmailSetting.upsert({
      where: { tenantId },
      update: { ...prismaUpdateDefaults(), ...data },
      create: { ...prismaCreateDefaults(), tenantId, ...data },
    });

    this.logger.log(
      `Connexion Google OAuth2 enregistrée (tenant ${tenantId}, user ${userId}, compte ${googleEmail}) — refresh token chiffré AES-256-GCM`,
    );
    return this.getView(tenantId);
  }

  /** Marque la connexion comme vérifiée (connexion SMTP OK). */
  async markVerified(tenantId: string): Promise<void> {
    await this.prisma.schoolEmailSetting.updateMany({
      where: { tenantId },
      data: {
        ...prismaUpdateDefaults(),
        status: 'actif',
        lastError: null,
        lastVerifiedAt: new Date(),
      },
    });
  }

  /** Marque la connexion en erreur (5xx / auth refusée). */
  async markError(tenantId: string, errorMessage: string): Promise<void> {
    await this.prisma.schoolEmailSetting.updateMany({
      where: { tenantId },
      data: {
        ...prismaUpdateDefaults(),
        status: 'erreur',
        lastError: errorMessage.slice(0, 500),
        lastVerifiedAt: new Date(),
      },
    });
  }

  /** Marque la connexion comme expirée (clé de chiffrement changée / invalid_grant en phase 2). */
  async markExpired(tenantId: string, reason: string): Promise<void> {
    await this.prisma.schoolEmailSetting.updateMany({
      where: { tenantId },
      data: { ...prismaUpdateDefaults(), status: 'expire', lastError: reason.slice(0, 500) },
    });
  }

  /**
   * Déconnexion (CDC section 2.8) : supprime TOUS les secrets de l'école et
   * repasse le statut à Non configuré. Le journal des envois est conservé.
   */
  async disconnect(tenantId: string, userId: string): Promise<SchoolEmailSettingsView> {
    await this.prisma.schoolEmailSetting.updateMany({
      where: { tenantId },
      data: {
        ...prismaUpdateDefaults(),
        mode: 'aucun',
        secretEncrypted: null,
        secretIv: null,
        secretTag: null,
        smtpHost: null,
        smtpPort: null,
        smtpUser: null,
        status: 'non_configure',
        lastError: null,
        lastVerifiedAt: null,
      },
    });
    this.logger.log(`Déconnexion e-mail (tenant ${tenantId}, user ${userId}) — secrets supprimés`);
    return this.getView(tenantId);
  }

  /**
   * Déchiffre le secret SMTP. Gère la mesure de dépannage du CDC :
   * clé changée → statut Expiré + EmailSecretDecryptError.
   */
  async decryptSecret(tenantId: string): Promise<string> {
    const row = await this.findRaw(tenantId);
    if (!row || !this.crypto.hasSecret(row)) {
      throw new EmailSecretDecryptError('Aucun secret e-mail configuré pour cette école.');
    }
    try {
      return this.crypto.decrypt({
        secretEncrypted: row.secretEncrypted!,
        secretIv: row.secretIv!,
        secretTag: row.secretTag!,
      });
    } catch (err) {
      if (err instanceof EmailSecretDecryptError) {
        await this.markExpired(
          tenantId,
          "Secret indéchiffrable — reconfigurez la connexion e-mail de l'école.",
        );
      }
      throw err;
    }
  }

  /**
   * Compteur du jour (CDC section 2.6) : X envoyés sur 490 + prochaine remise
   * à zéro. Fenêtre GLISSANTE de 24 h comme Gmail (pas un jour calendaire).
   * Compte les destinataires pending + envoyés via le Gmail de l'école
   * (provider != resend). La catégorie system ne compte pas.
   */
  async getUsage(tenantId: string): Promise<SchoolEmailUsageView> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [settings, agg, oldest, deferredAgg, testAgg] = await Promise.all([
      this.prisma.schoolEmailSetting.findUnique({
        where: { tenantId },
        select: { dailyCap: true },
      }),
      // ⚠️ Adaptateur PrismaPg : raw SQL — colonnes camelCase entre guillemets.
      this.prisma.$queryRaw<
        Array<{ count: bigint }>
      >`SELECT COUNT(*)::bigint AS count FROM "email_send_log"
         WHERE "tenantId" = ${tenantId} AND "provider" <> 'resend'
           AND "status" IN ('pending', 'envoye')
           AND "createdAt" > ${since}`,
      this.prisma.$queryRaw<
        Array<{ oldest: Date | null }>
      >`SELECT MIN("createdAt") AS oldest FROM "email_send_log"
         WHERE "tenantId" = ${tenantId} AND "provider" <> 'resend'
           AND "status" IN ('pending', 'envoye')
           AND "createdAt" > ${since}`,
      this.prisma.emailQueue.count({
        where: { tenantId, status: 'reporte' },
      }),
      this.prisma.$queryRaw<
        Array<{ count: bigint }>
      >`SELECT COUNT(*)::bigint AS count FROM "email_send_log"
         WHERE "tenantId" = ${tenantId} AND "category" = 'test'
           AND "createdAt" > ${new Date(Date.now() - 60 * 60 * 1000)}`,
    ]);

    const sent24h = Number(agg[0]?.count ?? 0);
    const oldestAt = oldest[0]?.oldest ?? null;

    return {
      sent24h,
      dailyCap: settings?.dailyCap ?? 490,
      windowResetsAt: oldestAt
        ? new Date(new Date(oldestAt).getTime() + 24 * 60 * 60 * 1000).toISOString()
        : null,
      deferredCount: deferredAgg,
      testCountLastHour: Number(testAgg[0]?.count ?? 0),
    };
  }

  /** Journal des 50 derniers envois (CDC section 2.7) — sans contenu de message. */
  async getRecentLog(tenantId: string, limit = 50): Promise<EmailSendLogEntry[]> {
    const rows = await this.prisma.emailSendLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
      select: {
        id: true,
        module: true,
        category: true,
        recipient: true,
        subject: true,
        provider: true,
        status: true,
        errorCode: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }
}
