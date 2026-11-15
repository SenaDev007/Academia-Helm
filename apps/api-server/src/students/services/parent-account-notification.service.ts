/**
 * ============================================================================
 * PARENT ACCOUNT NOTIFICATION SERVICE (module Élèves)
 * ============================================================================
 *
 * ⭐ Why this service exists (demande promoteur, nov. 2026) :
 * Lors de l'inscription d'un élève (wizard Onglet Inscriptions) ou depuis
 * l'onglet Famille → sous-onglet « Création de compte », l'école peut créer
 * le compte parent (User role=PARENT) ET envoyer les informations de
 * connexion au parent — exactement comme le module Finance envoie le reçu
 * d'encaissement (pattern receipt-notification-finance.service.ts).
 *
 * ⭐ Canaux (même architecture que le modal d'encaissement) :
 *   - 'sms'          — ⭐ nov. 2026 (demande promoteur) : VRAI SMS via Termii
 *                      (https://developers.termii.com — provider du
 *                      SmsService, activé par SMS_PROVIDER=termii +
 *                      TERMII_API_KEY). Canal de PREMIER contact pour les
 *                      identifiants : le parent sans email ne peut pas
 *                      recevoir l'email, et le message Helm Connect suppose
 *                      déjà un compte connecté — le SMS sur son numéro est
 *                      le seul canal qui fonctionne AVANT toute connexion.
 *   - 'email'        — email HTML avec branding + URL du portail + identifiant
 *   - 'helm_connect' — message chat au compte parent (visible une fois
 *                      connecté — garde-fou anti « œuf et poule » du SMS)
 *   - 'whatsapp'     — conservé pour compat (envoi API ; le bouton UI
 *                      « WhatsApp » utilise le lien wa.me — envoi manuel)
 *
 * ⭐ nov. 2026 (demande promoteur) — MOT DE PASSE OBLIGATOIRE : le portail
 *    parent se connecte désormais par (téléphone OU email) + MOT DE PASSE.
 *    Les identifiants envoyés incluent donc un mot de passe SIMPLE (petit
 *    mot + 2-3 chiffres, ex : soleil42) — régénéré à chaque envoi par
 *    ParentUserProvisioningService.regeneratePasswordForGuardian (⭐ 16/11/2026
 *    fix 1.0.8 : un compte PARENT DÉDIÉ est créé si le guardian était lié à
 *    un compte staff → le mot de passe est TOUJOURS réel ; le cas
 *    password=null est un filet de sécurité rarissime → « contactez
 *    l'administration »).
 *
 * Règles : fire-and-forget, ne lève JAMAIS d'erreur — retourne un rapport
 * par canal (status sent/failed/skipped), pattern identique aux reçus.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../../communication/services/email.service';
import { WhatsAppService } from '../../communication/services/whatsapp.service';
import { SmsService } from '../../communication/services/sms.service';
import { ChatService } from '../../communication/services/chat.service';
import { ParentUserProvisioningService } from './parent-user-provisioning.service';
import { renderParentAccountEmail } from '../parent-account-email-templates';

export type ParentAccountChannel = 'email' | 'whatsapp' | 'sms' | 'helm_connect';

/**
 * Informations de connexion envoyées au parent — ⭐ nov. 2026 :
 * `password` = mot de passe SIMPLE régénéré à l'envoi (⭐ 16/11/2026 fix
 * 1.0.8 : compte PARENT dédié créé si besoin → toujours réel ; null est un
 * filet de sécurité rarissime → « contactez l'administration »).
 */
export interface ParentAccountCredentials {
  portalUrl: string;
  identifier: string;
  identifierType: 'PHONE' | 'EMAIL';
  password?: string | null;
}

export interface ParentAccountNotificationReport
  extends Record<string, { status: 'sent' | 'failed' | 'skipped'; to?: string; error?: string } | undefined> {}

@Injectable()
export class ParentAccountNotificationService {
  private readonly logger = new Logger(ParentAccountNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsAppService,
    private readonly smsService: SmsService,
    private readonly chatService: ChatService,
    private readonly configService: ConfigService,
    private readonly parentProvisioningService: ParentUserProvisioningService,
  ) {}

  /**
   * Construit les « informations de connexion » du parent :
   * URL du portail parent + identifiant (téléphone, sinon email).
   */
  async buildCredentials(
    tenantId: string,
    guardian: { phone?: string | null; email?: string | null },
  ): Promise<{ portalUrl: string; identifier: string; identifierType: 'PHONE' | 'EMAIL' }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true, subdomain: true },
    });

    // ⭐ Domaine du FRONT (web-app) — même logique que staff-credential.service.ts
    //    (emails d'identifiants RH) : FRONTEND_URL puis APP_PUBLIC_URL puis défaut.
    //    Si l'URL configurée pointe vers l'API (api.xxx), on retire le préfixe
    //    « api. » pour retrouver le domaine web.
    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.APP_PUBLIC_URL ||
      'https://academiahelm.com';
    let domain = frontendUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\/$/, '');
    if (domain.startsWith('api.')) {
      domain = domain.substring('api.'.length);
    }

    const subdomain = tenant?.subdomain || tenant?.slug || '';
    let portalUrl: string;
    if (subdomain) {
      portalUrl = `https://${subdomain}.${domain}/login?portal=parent`;
    } else {
      // Pas de sous-domaine — mode query params (le middleware résout ?tenant=)
      portalUrl = `https://${domain}/login?portal=parent&tenant=${tenantId}`;
    }

    // Identifiant : téléphone d'abord (mode de connexion principal du portail
    // parent — cf. loginParentByPhone), sinon email.
    const phone = (guardian.phone || '').trim();
    const email = (guardian.email || '').trim();
    const identifierType: 'PHONE' | 'EMAIL' = phone ? 'PHONE' : 'EMAIL';
    const identifier = phone || email;

    return { portalUrl, identifier, identifierType };
  }

  /**
   * Envoie les informations de connexion du compte parent sur les canaux
   * demandés. Ne lance JAMAIS d'erreur — retourne un rapport par canal.
   *
   * @param senderUserId — utilisateur qui déclenche l'envoi (expéditeur du
   *        message Helm Connect — la secrétaire/directeur qui a créé le compte).
   *        Repli automatique : le promoteur/directeur du tenant.
   */
  async sendAccountCredentials(params: {
    tenantId: string;
    guardianId: string;
    studentId?: string;
    channels: ParentAccountChannel[];
    senderUserId?: string;
    /** ⭐ nov. 2026 — mot de passe simple (régénéré par l'appelant) inclus
     * dans TOUS les messages. null = compte staff partagé (mot de passe
     * habituel, non communiqué). */
    password?: string | null;
  }): Promise<ParentAccountNotificationReport> {
    const results: ParentAccountNotificationReport = {};

    try {
      // 1. Charger le guardian (+ nom d'un élève lié pour personnaliser)
      const guardian = await this.prisma.guardian.findFirst({
        where: { id: params.guardianId, tenantId: params.tenantId },
        include: {
          studentGuardians: {
            take: 1,
            orderBy: [{ isPrimary: 'desc' }],
            include: { student: { select: { firstName: true, lastName: true } } },
          },
        },
      });
      if (!guardian) {
        this.logger.warn(`Guardian ${params.guardianId} introuvable (tenant ${params.tenantId}) — notification annulée`);
        return { error: { status: 'failed', error: 'Guardian introuvable' } };
      }

      const studentName = guardian.studentGuardians?.[0]?.student
        ? `${guardian.studentGuardians[0].student.firstName} ${guardian.studentGuardians[0].student.lastName}`
        : undefined;
      const parentName = `${guardian.firstName || ''} ${guardian.lastName || ''}`.trim() || undefined;

      // 2. Informations de connexion (URL portail + identifiant + mot de passe)
      const credentials: ParentAccountCredentials = {
        ...(await this.buildCredentials(params.tenantId, guardian)),
        password: params.password ?? null,
      };
      if (!credentials.identifier) {
        this.logger.warn(
          `Guardian ${params.guardianId} sans téléphone NI email — identifiants non envoyables (tenant ${params.tenantId})`,
        );
        return { error: { status: 'failed', error: 'Aucun téléphone ni email pour ce parent' } };
      }

      // 3. Branding (pattern receipt-notification-finance.service.ts)
      const branding = await this.getTenantBranding(params.tenantId);

      // 4. Envoyer sur chaque canal demandé
      for (const channel of params.channels) {
        try {
          if (channel === 'email') {
            results.email = await this.sendByEmail({
              tenantId: params.tenantId,
              guardianId: guardian.id,
              to: (guardian.email || '').trim() || undefined,
              parentName,
              studentName,
              credentials,
              branding,
            });
          } else if (channel === 'whatsapp') {
            results.whatsapp = await this.sendByWhatsApp({
              tenantId: params.tenantId,
              guardianId: guardian.id,
              to: (guardian.phone || '').trim() || undefined,
              parentName,
              studentName,
              credentials,
              branding,
            });
          } else if (channel === 'sms') {
            results.sms = await this.sendBySMS({
              to: (guardian.phone || '').trim() || undefined,
              parentName,
              studentName,
              credentials,
              branding,
            });
          } else if (channel === 'helm_connect') {
            results.helm_connect = await this.sendByHelmConnect({
              tenantId: params.tenantId,
              guardianId: guardian.id,
              parentUserId: guardian.userId || undefined,
              senderUserId: params.senderUserId,
              parentName,
              studentName,
              credentials,
              branding,
            });
          }
        } catch (err: any) {
          results[channel] = { status: 'failed', error: err?.message || String(err) };
          this.logger.error(`Échec envoi identifiants (${channel}) guardian ${params.guardianId}: ${err?.message}`);
        }
      }
    } catch (outerErr: any) {
      this.logger.error(`sendAccountCredentials (guardian ${params.guardianId}) a échoué: ${outerErr?.message}`);
      results.error = { status: 'failed', error: outerErr?.message };
    }

    return results;
  }

  /**
   * Email avec les identifiants — pièce du pattern « reçu encaissement » :
   * EmailService.sendCategorized + template HTML avec branding.
   */
  private async sendByEmail(params: {
    tenantId: string;
    guardianId: string;
    to?: string;
    parentName?: string;
    studentName?: string;
    credentials: ParentAccountCredentials;
    branding: any;
  }): Promise<{ status: 'sent' | 'failed' | 'skipped'; to?: string; error?: string }> {
    if (!params.to) {
      return { status: 'skipped', error: 'Aucun email parent disponible' };
    }

    const { subject, html, text } = renderParentAccountEmail({
      branding: params.branding,
      parentName: params.parentName,
      studentName: params.studentName,
      portalUrl: params.credentials.portalUrl,
      identifier: params.credentials.identifier,
      identifierType: params.credentials.identifierType,
      password: params.credentials.password ?? null,
    });

    const result = await this.emailService.sendCategorized({
      tenantId: params.tenantId,
      category: 'ADMINISTRATIF',
      subCategory: 'PARENT_ACCOUNT',
      module: 'students',
      to: params.to,
      toName: params.parentName,
      recipientType: 'PARENT',
      recipientId: params.guardianId,
      subject,
      html,
      text,
      fromName: params.branding.schoolName || 'Academia Helm',
      triggeredBy: 'SYSTEM',
      relatedEntityId: params.guardianId,
      relatedEntityType: 'Guardian',
    } as any);

    if (result.success) {
      return { status: 'sent', to: params.to };
    }
    return { status: 'failed', to: params.to, error: result.error };
  }

  /**
   * WhatsApp — conservé pour compatibilité (message texte libre, pas de
   * template Meta dédié). Non appelé par défaut : Helm Connect remplace
   * WhatsApp+SMS (même décision que le module Finance).
   */
  private async sendByWhatsApp(params: {
    tenantId: string;
    guardianId: string;
    to?: string;
    parentName?: string;
    studentName?: string;
    credentials: ParentAccountCredentials;
    branding: any;
  }): Promise<{ status: 'sent' | 'failed' | 'skipped'; to?: string; error?: string }> {
    if (!params.to) {
      return { status: 'skipped', error: 'Aucun téléphone parent disponible' };
    }

    const message = this.buildPlainText(params.parentName, params.studentName, params.credentials, params.branding);

    const result = await this.whatsappService.sendCategorized({
      tenantId: params.tenantId,
      category: 'ADMINISTRATIF',
      module: 'students',
      to: params.to,
      toName: params.parentName,
      recipientType: 'PARENT',
      message,
      triggeredBy: 'SYSTEM',
      relatedEntityId: params.guardianId,
      relatedEntityType: 'Guardian',
    } as any);

    if (result.success) {
      return { status: 'sent', to: params.to };
    }
    return { status: 'failed', to: params.to, error: result.error };
  }

  /**
   * ⭐ SMS — canal de PREMIER contact (demande promoteur nov. 2026) :
   * envoi réel via Termii (SmsService, SMS_PROVIDER=termii + TERMII_API_KEY).
   * Si aucun vrai provider SMS n'est configuré (mock/gateway ou clés
   * absentes), le canal est « skipped » avec un message explicite — JAMAIS un
   * faux ✓ (le mock renvoie success:true sans rien envoyer).
   */
  private async sendBySMS(params: {
    to?: string;
    parentName?: string;
    studentName?: string;
    credentials: ParentAccountCredentials;
    branding: any;
  }): Promise<{ status: 'sent' | 'failed' | 'skipped'; to?: string; error?: string }> {
    if (!params.to) {
      return { status: 'skipped', error: 'Aucun téléphone parent disponible' };
    }
    if (!this.smsService.isRealProviderConfigured()) {
      return {
        status: 'skipped',
        to: params.to,
        error: 'Service SMS non configuré — définissez SMS_PROVIDER=termii et TERMII_API_KEY (variables d\u2019environnement Railway)',
      };
    }

    // Message court, sans caractères spéciaux (1 page SMS = 160 caractères ;
    // les caractères accentués réduisent la page à 70 — encodage GSM-7)
    const schoolName = (params.branding.schoolName || 'Etablissement').substring(0, 25);
    const identifierWord = params.credentials.identifierType === 'PHONE' ? 'votre numero' : 'votre email';
    const passwordPart = params.credentials.password
      ? ` - Mot de passe: ${params.credentials.password}`
      : ' - Mot de passe: contactez l\'administration';
    const message = `${schoolName}: Votre compte parent est actif. Portail: ${params.credentials.portalUrl} - Connectez-vous (onglet Parent) avec ${identifierWord} (${params.credentials.identifier})${passwordPart}.`;

    try {
      const result = await this.smsService.sendSMS(params.to, message);
      if (result.success) {
        return { status: 'sent', to: params.to };
      }
      return { status: 'failed', to: params.to, error: 'Échec envoi SMS' };
    } catch (smsErr: any) {
      return { status: 'failed', to: params.to, error: smsErr?.message || String(smsErr) };
    }
  }

  /**
   * ⭐ Helm Connect — message chat au compte du parent (remplace WhatsApp+SMS,
   * même architecture que helm-connect-finance-notification.service.ts).
   * L'expéditeur est l'utilisateur qui crée le compte (ex: la secrétaire),
   * avec repli sur le promoteur/directeur du tenant.
   */
  private async sendByHelmConnect(params: {
    tenantId: string;
    guardianId: string;
    parentUserId?: string;
    senderUserId?: string;
    parentName?: string;
    studentName?: string;
    credentials: ParentAccountCredentials;
    branding: any;
  }): Promise<{ status: 'sent' | 'failed' | 'skipped'; to?: string; error?: string }> {
    try {
      // 1. Garantir le User parent (idempotent)
      let parentUserId = params.parentUserId;
      if (!parentUserId) {
        const provisioned = await this.parentProvisioningService.ensureUserForGuardian(params.guardianId);
        parentUserId = provisioned.userId;
      }

      // 2. Expéditeur : utilisateur déclencheur, sinon promoteur/directeur
      //    (pattern recovery-notification-finance.service.ts)
      let senderId = params.senderUserId;
      if (!senderId) {
        senderId = await this.resolveTenantDirectorId(params.tenantId);
      }
      if (!senderId) {
        return { status: 'skipped', error: 'Aucun expéditeur (directeur/promoteur) trouvé pour ce tenant' };
      }
      if (senderId === parentUserId) {
        return { status: 'skipped', error: 'Le compte du parent est le même que celui de l\u2019expéditeur' };
      }

      // 3. Conversation directe staff ↔ parent (auto-créée)
      const conversation = await this.chatService.createOrGetDirectConversation(
        params.tenantId,
        senderId,
        parentUserId,
      );

      // 4. Message (même structure que le message du reçu — gras + listes)
      const isPhone = params.credentials.identifierType === 'PHONE';
      const identifierLabel = isPhone ? 'Numero de telephone' : 'Adresse email';
      const messageText = [
        `🔑 <b>Compte parent activé</b>`,
        ``,
        `Bonjour ${escapeHtml(params.parentName || 'Parent')},`,
        ``,
        params.studentName
          ? `Le compte de l'espace parent de ${escapeHtml(params.studentName)} est désormais actif.`
          : `Votre compte pour l'espace parent est désormais actif.`,
        ``,
        `<b>Adresse du portail :</b> ${escapeHtml(params.credentials.portalUrl)}`,
        `<b>${identifierLabel} :</b> ${escapeHtml(params.credentials.identifier)}`,
        params.credentials.password
          ? `<b>Mot de passe :</b> <b>${escapeHtml(params.credentials.password)}</b>`
          : `<b>Mot de passe :</b> contactez l\'administration`,
        ``,
        `Ouvrez l'adresse ci-dessus, onglet « Parent », puis connectez-vous avec votre ${isPhone ? 'numero de telephone' : 'adresse email'} ET votre mot de passe.`,
        ``,
        `Cordialement,`,
        `L'administration — ${escapeHtml(params.branding.schoolName || "l'établissement")}`,
        ``,
        `<i>— Academia Helm — Helm Connect</i>`,
      ].join('\n');

      const message = await this.chatService.sendTextMessage(
        params.tenantId,
        senderId,
        conversation.id,
        { content: messageText },
      );

      this.logger.log(
        `✅ Identifiants du compte parent envoyés (guardian ${params.guardianId}) — conversation ${conversation.id}, message ${message.id}`,
      );
      return { status: 'sent', to: conversation.id };
    } catch (err: any) {
      return { status: 'failed', error: err?.message || String(err) };
    }
  }

  /**
   * Résout le promoteur/directeur du tenant — expéditeur de repli pour
   * Helm Connect (pattern recovery-notification-finance.service.ts).
   */
  private async resolveTenantDirectorId(tenantId: string): Promise<string | null> {
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id FROM "users"
      WHERE "tenantId" = $1 AND status = 'active'
        AND ("role" IN ('PROMOTER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
                        'SUPER_DIRECTOR', 'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT',
                        'DIRECTEUR', 'DIRECTOR', 'ADMIN', 'admin'))
      ORDER BY
        CASE
          WHEN "role" IN ('PROMOTER', 'SCHOOL_OWNER') THEN 1
          WHEN "role" IN ('SUPER_DIRECTOR', 'DIRECTEUR_GENERAL') THEN 2
          ELSE 3
        END,
        "createdAt" ASC
      LIMIT 1
    `, tenantId).catch(() => [] as any[]);
    return rows?.[0]?.id || null;
  }

  /**
   * Message texte court (WhatsApp/SMS) — même contenu que l'email.
   */
  private buildPlainText(
    parentName?: string,
    studentName: string | undefined,
    credentials: ParentAccountCredentials,
    branding: any,
  ): string {
    const schoolName = branding.schoolName || "l'établissement";
    const isPhone = credentials.identifierType === 'PHONE';
    return [
      `Bonjour ${parentName || 'Parent'},`,
      ``,
      studentName
        ? `Le compte parent de ${studentName} est actif.`
        : `Votre compte parent est actif.`,
      ``,
      `Portail : ${credentials.portalUrl}`,
      `Identifiant : ${credentials.identifier} (${isPhone ? 'numero de telephone' : 'email'})`,
      credentials.password
        ? `Mot de passe : ${credentials.password}`
        : `Mot de passe : contactez l'administration`,
      ``,
      `Onglet « Parent » puis connexion avec votre ${isPhone ? 'numero' : 'email'} et votre mot de passe.`,
      ``,
      `Cordialement, l'administration — ${schoolName}`,
    ].join('\n');
  }

  /**
   * Branding du tenant — copie du pattern receipt-notification-finance.service.ts.
   */
  private async getTenantBranding(tenantId: string) {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: {
          schoolName: true,
          logoUrl: true,
          address: true,
          phonePrimary: true,
          email: true,
        },
      });
      if (profile?.schoolName) {
        const apiBaseUrl = this.configService.get<string>('APP_PUBLIC_URL')
          || 'https://api.academiahelm.com';
        const schoolLogo = profile.logoUrl
          ? `${apiBaseUrl}/api/tenants/${tenantId}/logo`
          : null;
        return {
          schoolName: profile.schoolName,
          schoolLogo,
          schoolAddress: profile.address,
          schoolPhone: profile.phonePrimary,
          schoolEmail: profile.email,
        };
      }
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
      return { schoolName: tenant?.name || 'Établissement' };
    } catch {
      return { schoolName: 'Établissement' };
    }
  }
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
