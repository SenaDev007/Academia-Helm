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
 *
 * ⭐ 2026-11-26 (retour promoteur) — DOUBLE IDENTITÉ PAR NIVEAU SCOLAIRE :
 * une ligne de réglages PAR niveau (levelCategory) pour les écoles combinées
 * (maternelle/primaire + secondaire, cf. onglet Identité) :
 *   • affichage (getView) : STRICT — « Non configuré » si la ligne du niveau
 *     n'existe pas ;
 *   • envoi (findRaw) : REPLI TRANSPARENT — un envoi du secondaire sans
 *     connexion secondaire configurée part de la connexion principale
 *     (aucun envoi bloqué).
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';
import { EmailCryptoService, EmailSecretDecryptError } from './email-crypto.service';
import {
  EmailLevelCategory181,
  EmailSendLogEntry,
  SaveSchoolEmailConfigDto,
  SchoolEmailSettingsView,
  SchoolEmailUsageView,
} from './dto/school-email.dto';

/** Colonnes secrètes — ne sortent JAMAIS du service. */
const PUBLIC_SELECT = {
  id: true,
  tenantId: true,
  levelCategory: true,
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

  /**
   * Ligne de réglages brute (avec colonnes secrètes) — usage interne uniquement.
   * ⭐ 2026-11-26 : cible la ligne du NIVEAU demandé ; un envoi SECONDARY sans
   * ligne secondaire retombe sur la connexion principale (repli transparent).
   */
  async findRaw(
    tenantId: string,
    levelCategory: EmailLevelCategory181 = 'MATERNAL_PRIMARY',
  ) {
    const row = await this.prisma.schoolEmailSetting.findFirst({
      where: { tenantId, levelCategory },
    });
    if (row) return row;
    if (levelCategory === 'SECONDARY') {
      return this.prisma.schoolEmailSetting.findFirst({
        where: { tenantId, levelCategory: 'MATERNAL_PRIMARY' },
      });
    }
    return null;
  }

  /** Vue SÛRE pour l'API (aucun secret, aucun ciphertext). STRICTE par niveau. */
  async getView(
    tenantId: string,
    levelCategory: EmailLevelCategory181 = 'MATERNAL_PRIMARY',
  ): Promise<SchoolEmailSettingsView> {
    const row = await this.prisma.schoolEmailSetting.findFirst({
      where: { tenantId, levelCategory },
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
    const raw = await this.prisma.schoolEmailSetting.findFirst({
      where: { tenantId, levelCategory },
    });
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
   * ⭐ 2026-11-26 — nom affiché par défaut de la ligne du NIVEAU : dynamique
   * selon l'onglet Identité. Pour le SECONDARY, l'identité du secondaire
   * (tenant_level_identity_profiles) prime sur le nom du tenant.
   */
  private async defaultFromNameForLevel(
    tenantId: string,
    levelCategory: EmailLevelCategory181,
  ): Promise<string> {
    if (levelCategory === 'SECONDARY') {
      try {
        const overlay = await this.prisma.tenantLevelIdentityProfile.findFirst({
          where: {
            tenantId,
            educationLevel: { name: { in: ['SECONDAIRE', 'SECONDARY'] } },
          },
          select: { schoolName: true },
        });
        if (overlay?.schoolName?.trim()) return overlay.schoolName.trim();
      } catch {
        /* pas d'identité secondaire configurée — repli nom du tenant */
      }
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    return (tenant?.name || 'École').trim();
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
    const levelCategory: EmailLevelCategory181 = dto.levelCategory || 'MATERNAL_PRIMARY';
    const fromEmail = dto.fromEmail.trim().toLowerCase();
    const smtpUser = (dto.smtpUser || fromEmail).trim().toLowerCase();
    const smtpHost = (dto.smtpHost || 'smtp.gmail.com').trim();
    const smtpPort = dto.smtpPort ?? 587;
    const replyTo = (dto.replyTo || fromEmail).trim().toLowerCase();

    if (smtpPort !== 587 && smtpPort !== 465 && smtpPort !== 2525) {
      throw new BadRequestException(
        'Port SMTP non supporté : utilisez 587 (STARTTLS), 465 (SSL) ou 2525 (relais professionnel).',
      );
    }

    const existing = await this.prisma.schoolEmailSetting.findFirst({
      where: { tenantId, levelCategory },
    });

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
      where: { tenantId_levelCategory: { tenantId, levelCategory } },
      update: { ...prismaUpdateDefaults(), ...data },
      create: { ...prismaCreateDefaults(), tenantId, levelCategory, ...data },
    });

    this.logger.log(
      `Configuration e-mail enregistrée (tenant ${tenantId}, niveau ${levelCategory}, user ${userId}) — secret ${secretCols ? 'chiffré' : 'inchangé'}`,
    );
    return this.getView(tenantId, levelCategory);
  }

  /**
   * TÂCHE 183 (Phase 2, CDC section 8) — Enregistre une connexion Google
   * OAuth2 issue du callback : refresh token chiffré AES-256-GCM (mêmes
   * colonnes que le mot de passe SMTP), mode google_oauth, statut Actif.
   *
   * From bloqué : fromEmail = adresse du compte RÉELLEMENT autorisé (rule
   * Gmail — le compte authentifié). Migration 1 clic : fromName/replyTo
   * existants conservés (param > existant > nom du niveau), plafond conservé.
   *
   * ⭐ 2026-11-26 : persiste dans la ligne du NIVEAU visé (state OAuth) —
   * secondaire pour les écoles à double identité.
   */
  async saveGoogleConnection(
    tenantId: string,
    userId: string,
    p: {
      refreshToken: string;
      googleEmail: string;
      fromName?: string;
      replyTo?: string;
      levelCategory?: EmailLevelCategory181;
    },
  ): Promise<SchoolEmailSettingsView> {
    const levelCategory: EmailLevelCategory181 = p.levelCategory || 'MATERNAL_PRIMARY';
    if (!p.refreshToken || p.refreshToken.length < 20) {
      throw new BadRequestException('Refresh token Google invalide.');
    }
    const googleEmail = p.googleEmail.trim().toLowerCase();

    const existing = await this.prisma.schoolEmailSetting.findFirst({
      where: { tenantId, levelCategory },
    });

    // fromName : param (formulaire au moment du « Connecter Google ») >
    // existant (migration 1 clic sans ressaisir) > identité du niveau
    // (secondaire de l'onglet Identité si configurée) > nom du tenant.
    let fromName = (p.fromName || existing?.fromName || '').trim();
    if (!fromName) {
      fromName = await this.defaultFromNameForLevel(tenantId, levelCategory);
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
      where: { tenantId_levelCategory: { tenantId, levelCategory } },
      update: { ...prismaUpdateDefaults(), ...data },
      create: { ...prismaCreateDefaults(), tenantId, levelCategory, ...data },
    });

    this.logger.log(
      `Connexion Google OAuth2 enregistrée (tenant ${tenantId}, niveau ${levelCategory}, user ${userId}, compte ${googleEmail}) — refresh token chiffré AES-256-GCM`,
    );
    return this.getView(tenantId, levelCategory);
  }

  /** Marque la connexion comme vérifiée (connexion SMTP OK) — ligne du niveau. */
  async markVerified(
    tenantId: string,
    levelCategory: EmailLevelCategory181 = 'MATERNAL_PRIMARY',
  ): Promise<void> {
    await this.prisma.schoolEmailSetting.updateMany({
      where: { tenantId, levelCategory },
      data: {
        ...prismaUpdateDefaults(),
        status: 'actif',
        lastError: null,
        lastVerifiedAt: new Date(),
      },
    });
  }

  /** Marque la connexion en erreur (5xx / auth refusée) — ligne du niveau. */
  async markError(
    tenantId: string,
    errorMessage: string,
    levelCategory: EmailLevelCategory181 = 'MATERNAL_PRIMARY',
  ): Promise<void> {
    await this.prisma.schoolEmailSetting.updateMany({
      where: { tenantId, levelCategory },
      data: {
        ...prismaUpdateDefaults(),
        status: 'erreur',
        lastError: errorMessage.slice(0, 500),
        lastVerifiedAt: new Date(),
      },
    });
  }

  /** Marque la connexion comme expirée (clé changée / invalid_grant) — ligne du niveau. */
  async markExpired(
    tenantId: string,
    reason: string,
    levelCategory: EmailLevelCategory181 = 'MATERNAL_PRIMARY',
  ): Promise<void> {
    await this.prisma.schoolEmailSetting.updateMany({
      where: { tenantId, levelCategory },
      data: { ...prismaUpdateDefaults(), status: 'expire', lastError: reason.slice(0, 500) },
    });
  }

  /**
   * Déconnexion (CDC section 2.8) : supprime TOUS les secrets de la ligne du
   * niveau et repasse le statut à Non configuré. Le journal des envois est
   * conservé.
   */
  async disconnect(
    tenantId: string,
    userId: string,
    levelCategory: EmailLevelCategory181 = 'MATERNAL_PRIMARY',
  ): Promise<SchoolEmailSettingsView> {
    await this.prisma.schoolEmailSetting.updateMany({
      where: { tenantId, levelCategory },
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
    this.logger.log(
      `Déconnexion e-mail (tenant ${tenantId}, niveau ${levelCategory}, user ${userId}) — secrets supprimés`,
    );
    return this.getView(tenantId, levelCategory);
  }

  /**
   * Déchiffre le secret de la ligne du NIVEAU. Gère la mesure de dépannage du
   * CDC : clé changée → statut Expiré + EmailSecretDecryptError.
   */
  async decryptSecret(
    tenantId: string,
    levelCategory: EmailLevelCategory181 = 'MATERNAL_PRIMARY',
  ): Promise<string> {
    const row = await this.prisma.schoolEmailSetting.findFirst({
      where: { tenantId, levelCategory },
    });
    if (!row || !this.crypto.hasSecret(row)) {
      throw new EmailSecretDecryptError(
        'Aucun secret e-mail configuré pour cette école.',
      );
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
          levelCategory,
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
   * ⭐ Le plafond reste GLOBAL à l'école (les deux connexions partagent la
   *    même fenêtre — une seule école aux yeux de Gmail).
   */
  async getUsage(tenantId: string): Promise<SchoolEmailUsageView> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [settings, agg, oldest, deferredAgg, testAgg] = await Promise.all([
      this.prisma.schoolEmailSetting.findFirst({
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
