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
 *   - 'email'        — email HTML avec branding + URL du portail + identifiant
 *   - 'helm_connect' — message chat au compte parent (remplace WhatsApp+SMS,
 *                      cf. helm-connect-finance-notification.service.ts)
 *   - 'whatsapp'     — conservé pour compat (message texte libre, non appelé
 *                      par défaut — remplacé par Helm Connect)
 *   - 'sms'          — conservé pour compat (SMS court, non appelé par défaut)
 *
 * Le portail parent se connecte SANS mot de passe par défaut (téléphone ou
 * email, cf. portal-auth.service.ts) — les « identifiants » envoyés sont donc
 * l'URL du portail + l'identifiant du parent.
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

      // 2. Informations de connexion (URL portail + identifiant)
      const credentials = await this.buildCredentials(params.tenantId, guardian);
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
    credentials: { portalUrl: string; identifier: string; identifierType: 'PHONE' | 'EMAIL' };
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
    credentials: { portalUrl: string; identifier: string; identifierType: 'PHONE' | 'EMAIL' };
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
   * SMS court — conservé pour compatibilité, non appelé par défaut.
   */
  private async sendBySMS(params: {
    to?: string;
    parentName?: string;
    studentName?: string;
    credentials: { portalUrl: string; identifier: string; identifierType: 'PHONE' | 'EMAIL' };
    branding: any;
  }): Promise<{ status: 'sent' | 'failed' | 'skipped'; to?: string; error?: string }> {
    if (!params.to) {
      return { status: 'skipped', error: 'Aucun téléphone parent disponible' };
    }

    const schoolName = (params.branding.schoolName || 'Etablissement').substring(0, 25);
    const identifierWord = params.credentials.identifierType === 'PHONE' ? 'votre numero' : 'votre email';
    const message = `${schoolName}: Votre compte parent est actif. Portail: ${params.credentials.portalUrl} - Connectez-vous avec ${identifierWord} (${params.credentials.identifier}). Aucun mot de passe requis.`;

    const result = await this.smsService.sendSMS(params.to, message);
    if (result.success) {
      return { status: 'sent', to: params.to };
    }
    return { status: 'failed', to: params.to, error: 'Échec envoi SMS' };
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
    credentials: { portalUrl: string; identifier: string; identifierType: 'PHONE' | 'EMAIL' };
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
        `<b>Mot de passe :</b> aucun requis — votre ${isPhone ? 'numero' : 'email'} suffit`,
        ``,
        `Ouvrez l'adresse ci-dessus, onglet « Parent », puis connectez-vous avec votre ${isPhone ? 'numero de telephone' : 'adresse email'}.`,
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
    credentials: { portalUrl: string; identifier: string; identifierType: 'PHONE' | 'EMAIL' },
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
      `Mot de passe : aucun requis.`,
      ``,
      `Onglet « Parent » puis connexion avec votre ${isPhone ? 'numero' : 'email'}.`,
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
