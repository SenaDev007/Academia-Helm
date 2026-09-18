/**
 * ============================================================================
 * EMAIL SERVICE - ENVOI D'EMAILS
 * ============================================================================
 * 
 * Service pour l'envoi d'emails via différents providers
 * Supporte : Nodemailer (SMTP), SendGrid, AWS SES
 * 
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

export interface EmailRequest {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  fromName?: string;
  replyTo?: string; // Adresse reply-to personnalisée (ex: log_xxx@replies.academiahelm.com)
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content?: Buffer | string;
    path?: string;
  }>;
}

export type EmailProvider = 'nodemailer' | 'sendgrid' | 'aws-ses' | 'mock' | 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: EmailProvider;
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    const envProvider = (this.configService.get<string>('EMAIL_PROVIDER') || '').toLowerCase().trim();
    const resendKey = this.configService.get<string>('RESEND_API_KEY');

    if (envProvider === 'resend') {
      if (resendKey) {
        this.provider = 'resend';
        this.logger.log('✅ Email provider: Resend');
      } else {
        this.provider = 'mock';
        this.logger.error('❌ EMAIL_PROVIDER=resend mais RESEND_API_KEY est MANQUANT ! L\'email ne sera PAS envoyé. Veuillez configurer RESEND_API_KEY dans les variables d\'environnement.');
      }
    } else if (envProvider === 'nodemailer') {
      this.provider = 'nodemailer';
      this.initializeNodemailer();
    } else if (envProvider === 'sendgrid') {
      this.provider = 'sendgrid';
      this.logger.log('✅ Email provider: SendGrid');
    } else if (envProvider === 'aws-ses') {
      this.provider = 'aws-ses';
      this.logger.warn('⚠️  AWS SES non implémenté — utilise mock');
    } else if (envProvider === 'mock') {
      this.provider = 'mock';
      this.logger.warn('⚠️  Email provider: MOCK — aucun email ne sera réellement envoyé');
    } else {
      // Aucun EMAIL_PROVIDER défini → mock
      this.provider = 'mock';
      this.logger.warn(`⚠️  EMAIL_PROVIDER non configuré (valeur: "${envProvider || '(vide)'}") — mode MOCK par défaut. Configurez EMAIL_PROVIDER=resend + RESEND_API_KEY pour envoyer des emails réels.`);
    }
  }

  /**
   * Initialise Nodemailer avec la configuration SMTP
   */
  private initializeNodemailer() {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<number>('SMTP_PORT', 587);
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPassword = this.configService.get<string>('SMTP_PASSWORD');
    const smtpSecure = this.configService.get<boolean>('SMTP_SECURE', false);

    if (!smtpHost || !smtpUser || !smtpPassword) {
      this.logger.warn('⚠️  SMTP configuration incomplete. Email service will use MOCK mode.');
      return;
    }

    this.transporter = createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    this.logger.log('✅ Nodemailer initialized');
  }

  /**
   * Retourne le provider email actif (pour diagnostic)
   */
  getProvider(): EmailProvider {
    return this.provider;
  }

  /**
   * Envoie un email
   */
  async sendEmail(request: EmailRequest): Promise<{ success: boolean; messageId?: string }> {
    try {
      switch (this.provider) {
        case 'nodemailer':
          return await this.sendViaNodemailer(request);
        case 'resend':
          return await this.sendViaResend(request);
        case 'sendgrid':
          return await this.sendViaSendGrid(request);
        case 'aws-ses':
          return await this.sendViaAwsSes(request);
        case 'mock':
        default:
          return await this.sendMock(request);
      }
    } catch (error: any) {
      this.logger.error(`Failed to send email via ${this.provider}:`, error);
      throw new Error(`Échec d'envoi email: ${error.message}`);
    }
  }

  /**
   * Envoie un email via Nodemailer (SMTP)
   */
  private async sendViaNodemailer(request: EmailRequest): Promise<{ success: boolean; messageId?: string }> {
    if (!this.transporter) {
      throw new Error('Nodemailer transporter not initialized');
    }

    const fromEmail = request.from || this.configService.get<string>('SMTP_FROM') || 'noreply@academiahelm.com';
    const fromName = request.fromName || 'Academia Helm';

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: Array.isArray(request.to) ? request.to.join(', ') : request.to,
      subject: request.subject,
      text: request.text,
      html: request.html || request.text,
      replyTo: request.replyTo,
      cc: request.cc ? (Array.isArray(request.cc) ? request.cc.join(', ') : request.cc) : undefined,
      bcc: request.bcc ? (Array.isArray(request.bcc) ? request.bcc.join(', ') : request.bcc) : undefined,
      attachments: request.attachments,
    };

    const result = await this.transporter.sendMail(mailOptions);

    this.logger.log(`Email sent via Nodemailer to ${request.to}: ${result.messageId}`);

    return {
      success: true,
      messageId: result.messageId,
    };
  }

  /**
   * Envoie un email via Resend (https://resend.com/docs/api-reference/emails/send-email)
   */
  private async sendViaResend(request: EmailRequest): Promise<{ success: boolean; messageId?: string }> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.error('❌ RESEND_API_KEY est MANQUANT — impossible d\'envoyer l\'email via Resend');
      throw new Error('RESEND_API_KEY not configured');
    }

    const fromEmail =
      request.from ||
      this.configService.get<string>('EMAIL_FROM_NOREPLY') ||
      this.configService.get<string>('SMTP_FROM');
    if (!fromEmail) {
      this.logger.error('❌ Aucun expéditeur configuré — renseignez request.from ou EMAIL_FROM_NOREPLY');
      throw new Error('Expéditeur manquant : renseignez request.from ou EMAIL_FROM_NOREPLY');
    }

    const fromName = request.fromName || 'Academia Helm';
    const fromField = `"${fromName}" <${fromEmail}>`;

    const toList = Array.isArray(request.to) ? request.to : [request.to];

    this.logger.log(`📧 Envoi email via Resend: from=${fromField}, to=${toList.join(', ')}, subject="${request.subject}"${request.attachments?.length ? `, attachments=${request.attachments.length}` : ''}`);

    // Resend API expects attachments as base64-encoded strings
    // (see https://resend.com/docs/api-reference/emails/send-email#body-parameters)
    const resendAttachments = (request.attachments || [])
      .map((att) => {
        // Content can be Buffer, Uint8Array, or string.
        // ⚠️ Puppeteer v13+ page.pdf() returns Uint8Array, not Buffer.
        // Uint8Array doesn't pass `instanceof Buffer` check, so we must
        // handle it explicitly — otherwise the attachment is silently dropped.
        let base64Content: string | undefined;
        if (att.content instanceof Buffer) {
          base64Content = att.content.toString('base64');
        } else if (att.content instanceof Uint8Array) {
          // Convert Uint8Array → Buffer → base64 (zero-copy if possible)
          base64Content = Buffer.from(att.content).toString('base64');
        } else if (typeof att.content === 'string') {
          // Assume string is already UTF-8 text — encode as base64
          base64Content = Buffer.from(att.content, 'utf-8').toString('base64');
        }
        if (!base64Content && !att.path) return null;
        return {
          filename: att.filename,
          content: base64Content,
          // path: att.path,  // Resend doesn't support `path` — only `content` (base64)
          ...(att.contentType ? { content_type: att.contentType } : {}),
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromField,
        to: toList,
        subject: request.subject,
        html: request.html ?? request.text,
        text: request.text,
        ...(request.replyTo ? { reply_to: request.replyTo } : {}),
        ...(request.cc ? { cc: Array.isArray(request.cc) ? request.cc : [request.cc] } : {}),
        ...(request.bcc ? { bcc: Array.isArray(request.bcc) ? request.bcc : [request.bcc] } : {}),
        ...(resendAttachments.length > 0 ? { attachments: resendAttachments } : {}),
      }),
    });

    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string; statusCode?: number };

    if (!res.ok) {
      this.logger.error(`❌ Resend API error (HTTP ${res.status}): ${JSON.stringify(body)}`);
      
      // Diagnostic spécifique pour les erreurs courantes
      if (body.name === 'validation_error' && body.message?.includes('not verified')) {
        this.logger.error(`🔴 DOMAINE NON VÉRIFIÉ: Le domaine de l'expéditeur "${fromEmail}" n'est pas vérifié dans Resend. Allez dans le dashboard Resend → Domaines → Vérifiez les enregistrements DNS (SPF, DKIM, DMARC).`);
      } else if (res.status === 403) {
        this.logger.error(`🔴 CLÉ API INVALIDE: La clé RESEND_API_KEY est invalide ou a expiré. Vérifiez dans le dashboard Resend.`);
      } else if (res.status === 429) {
        this.logger.error(`🔴 RATE LIMIT: Trop d'emails envoyés. Attendez avant de réessayer.`);
      }
      
      throw new Error(body.message || `Resend error HTTP ${res.status}`);
    }

    this.logger.log(`✅ Email envoyé avec succès via Resend à ${toList.join(', ')} — messageId: ${body.id}`);

    return {
      success: true,
      messageId: body.id,
    };
  }

  /**
   * Envoie un email via SendGrid
   */
  private async sendViaSendGrid(request: EmailRequest): Promise<{ success: boolean; messageId?: string }> {
    const sendGridApiKey = this.configService.get<string>('SENDGRID_API_KEY');
    const fromEmail = request.from || this.configService.get<string>('SENDGRID_FROM_EMAIL') || 'noreply@academiahelm.com';
    const fromName = request.fromName || this.configService.get<string>('SENDGRID_FROM_NAME') || 'Academia Helm';

    if (!sendGridApiKey) {
      throw new Error('SENDGRID_API_KEY not configured');
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sendGridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: Array.isArray(request.to) ? request.to.map((email) => ({ email })) : [{ email: request.to }],
            subject: request.subject,
          },
        ],
        from: { email: fromEmail, name: fromName },
        content: [
          {
            type: request.html ? 'text/html' : 'text/plain',
            value: request.html || request.text || '',
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      this.logger.error('SendGrid API error:', errorData);
      throw new Error(`SendGrid error HTTP ${response.status}: ${JSON.stringify(errorData)}`);
    }

    const messageId = response.headers.get('x-message-id') || `sg-${Date.now()}`;
    this.logger.log(`Email sent via SendGrid to ${request.to}: ${messageId}`);

    return {
      success: true,
      messageId: messageId,
    };
  }

  /**
   * Envoie un email via AWS SES
   */
  private async sendViaAwsSes(request: EmailRequest): Promise<{ success: boolean; messageId?: string }> {
    // TODO: Installer @aws-sdk/client-ses et implémenter
    this.logger.warn('AWS SES integration not yet implemented. Using mock.');
    return await this.sendMock(request);
  }

  /**
   * Mode mock (développement)
   */
  private async sendMock(request: EmailRequest): Promise<{ success: boolean; messageId?: string }> {
    this.logger.log(`[MOCK EMAIL] To: ${Array.isArray(request.to) ? request.to.join(', ') : request.to}`);
    this.logger.log(`[MOCK EMAIL] Subject: ${request.subject}`);
    this.logger.log(`[MOCK EMAIL] Body: ${request.text || request.html?.substring(0, 100)}...`);
    this.logger.warn('⚠️  Email service is in MOCK mode. No emails will be sent. Configure EMAIL_PROVIDER for production.');

    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      success: true,
      messageId: `mock-email-${Date.now()}`,
    };
  }

  /**
   * Formate un montant FCFA avec espaces (ex : 550 000) — même rendu que le
   * contrat d'abonnement (contract-generation.service.ts fmt()).
   */
  private fmtFCFA(n: number | null | undefined): string {
    if (n == null || isNaN(Number(n))) return '';
    return Math.round(Number(n)).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');
  }

  /** Libellé « 1 à 50 », « 51 à 150 », « 401 et plus ». */
  private fmtStudentRange(min: number | null | undefined, max: number | null | undefined): string {
    if (max == null) return `${min ?? 0} et plus`;
    return `${min ?? 0} à ${max}`;
  }

  /**
   * Formate un email de rappel d'expiration d'abonnement
   *
   * ⭐ ALIGNÉ SUR LES NOUVEAUX PLANS D'ABONNEMENT (page tarification + contrat
   * d'abonnement de l'onboarding sign-up) :
   *   - Plan actuel avec son nom OFFICIEL (« Helm Essentiel », « Helm
   *     Croissance », « Helm Performance », « Helm Institution ») et sa
   *     tranche d'élèves — JAMAIS le code brut (SEED/LEAD…) ni les anciens
   *     plans « Plan Mensuel - 1 École » ;
   *   - Grille tarifaire des 4 plans (contrat Article 3 / page tarification),
   *     plan courant surligné ;
   *   - Règles de renouvellement du contrat (Articles 4 et 5).
   *
   * Les enrichissements (planCode/plansGrid/renewalFee…) sont optionnels pour
   * rester rétro-compatible : sans grille, l'email reste correct (bloc plan
   * seul) ; avec grille, il est complet.
   */
  formatBillingReminderEmail(data: {
    schoolName: string;
    planName: string;
    daysRemaining: number;
    status: string;
    renewalUrl: string;
    // ⭐ Enrichissements nouveaux plans (alignement contrat)
    planCode?: string | null;
    planRange?: string | null;
    planAnnualFee?: number | null;
    planActivationFee?: number | null;
    bilingualEnabled?: boolean;
    bilingualYearlyFee?: number | null;
    renewalFee?: number | null;
    plansGrid?: Array<{
      code: string;
      name: string;
      studentMin: number;
      studentMax: number | null;
      initialFee: number;
      yearlyAmount: number | null;
    }> | null;
  }): { subject: string; html: string; text: string } {
    const isTrial = data.status === 'TRIAL_ACTIVE' || data.status === 'TRIALING';
    const statusText = isTrial ? 'période d\'essai' : 'abonnement';
    const urgency = data.daysRemaining === 1 ? 'URGENT' : data.daysRemaining <= 3 ? 'IMPORTANT' : '';

    const subject = `${urgency ? `[${urgency}] ` : ''}Rappel - ${data.schoolName} - ${isTrial ? 'Fin de période d\'essai' : 'Expiration d\'abonnement'} dans ${data.daysRemaining} jour${data.daysRemaining > 1 ? 's' : ''}`;

    // ⭐ FIX 2026-09-18 (retour promoteur) : le fichier
    //    /images/logo-academia-helm-email.png a été remplacé par le VRAI
    //    logo Academia Helm (128×128, PNG transparent) — même image que la
    //    signature des emails OTP.
    const logoUrl = this.configService.get<string>('APP_PUBLIC_URL', 'https://academiahelm.com') + '/images/logo-academia-helm-email.png';

    // ── Données enrichies (avec replis robustes) ──
    const bilingualEnabled = !!data.bilingualEnabled;
    const bilingualFee = bilingualEnabled ? (data.bilingualYearlyFee ?? null) : null;
    const planAnnualFee = data.planAnnualFee ?? null;
    // Montant à régler : frais annuels du plan (+ bilingue si activée).
    // En essai : souscription initiale = activation + frais annuels (+ bilingue).
    const renewalFee =
      data.renewalFee != null
        ? data.renewalFee
        : planAnnualFee != null
          ? isTrial
            ? (data.planActivationFee ?? 0) + planAnnualFee + (bilingualFee ?? 0)
            : planAnnualFee + (bilingualFee ?? 0)
          : null;
    const planRange = data.planRange ?? null;
    const grid = (data.plansGrid || []).filter((p) => p && p.name);
    const planCode = data.planCode ?? null;

    const fmt = (n: number | null | undefined) => this.fmtFCFA(n);

    // ── Bloc « Votre plan » ──
    const planDetails: string[] = [];
    if (planRange) planDetails.push(`<tr><td style="padding:4px 0;color:#475569;font-size:14px;">Capacité du plan</td><td style="padding:4px 0;text-align:right;color:#0b2f73;font-size:14px;font-weight:600;">${planRange}</td></tr>`);
    if (planAnnualFee != null) planDetails.push(`<tr><td style="padding:4px 0;color:#475569;font-size:14px;">Frais annuels du plan</td><td style="padding:4px 0;text-align:right;color:#0b2f73;font-size:14px;font-weight:600;">${fmt(planAnnualFee)} FCFA/an</td></tr>`);
    if (bilingualEnabled) {
      planDetails.push(`<tr><td style="padding:4px 0;color:#475569;font-size:14px;">Option bilingue FR/EN (activée)</td><td style="padding:4px 0;text-align:right;color:#0b2f73;font-size:14px;font-weight:600;">${bilingualFee != null ? `${fmt(bilingualFee)} FCFA/an` : 'en supplément'}</td></tr>`);
    }
    const planBlock = planDetails.length
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;border-radius:8px;padding:14px 18px;margin:16px 0;border:1px solid #e2e8f0;">
          <tr><td colspan="2" style="padding:0 0 8px 0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Votre plan actuel</td></tr>
          <tr><td colspan="2" style="padding:0 0 6px 0;color:#0b2f73;font-size:17px;font-weight:700;">${data.planName}</td></tr>
          ${planDetails.join('')}
        </table>`
      : `<p style="margin:12px 0;"><strong>Plan actuel :</strong> ${data.planName}</p>`;

    // ── Bloc « À régler » + conditions de renouvellement (contrat Art. 4/5) ──
    const renewalIntro = isTrial
      ? `Pour continuer à utiliser Academia Helm au terme de votre période d'essai, souscrivez au plan adapté à votre effectif :`
      : `Pour renouveler, seuls les <strong>frais annuels de votre plan</strong> sont dus — payables d'avance à la date d'échéance annuelle (contrat d'abonnement, Article 4) :`;
    const renewalLines: string[] = [];
    if (renewalFee != null && planAnnualFee != null) {
      if (isTrial && data.planActivationFee != null) renewalLines.push(`Frais d'activation (une seule fois, à la souscription) : <strong>${fmt(data.planActivationFee)} FCFA</strong>`);
      renewalLines.push(`Frais annuels du plan ${data.planName} : <strong>${fmt(planAnnualFee)} FCFA/an</strong>`);
      if (bilingualFee != null) renewalLines.push(`Option bilingue FR/EN : <strong>${fmt(bilingualFee)} FCFA/an</strong>`);
      renewalLines.push(`<strong>Total à régler${isTrial ? '' : ' au renouvellement'} : ${fmt(renewalFee)} FCFA</strong>`);
    }
    const activationNote = data.planActivationFee != null
      ? `Les frais d'activation (${fmt(data.planActivationFee)} FCFA) ne sont dus qu'une seule fois, à la signature du contrat — ils ne sont pas redevables au renouvellement.`
      : `Les frais d'activation ne sont dus qu'une seule fois, à la signature du contrat — ils ne sont pas redevables au renouvellement.`;
    const renewalBlock = `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #f5b335;border-radius:8px;padding:16px 20px;margin:16px 0;">
      <p style="margin:0 0 10px 0;font-size:14px;color:#334155;line-height:1.6;">${renewalIntro}</p>
      ${renewalLines.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px 0;">${renewalLines.map((l) => `<tr><td style="padding:3px 0;font-size:14px;color:#475569;line-height:1.6;">• ${l}</td></tr>`).join('')}</table>` : ''}
      ${isTrial ? '' : `<p style="margin:0;font-size:12.5px;color:#64748b;line-height:1.6;">${activationNote}</p>`}
    </div>`;

    // ── Grille tarifaire des 4 plans (contrat Article 3 — page tarification) ──
    const gridRows = grid
      .map((p) => {
        const isCurrent = planCode ? p.code === planCode : p.name === data.planName;
        const range = this.fmtStudentRange(p.studentMin, p.studentMax);
        const bg = isCurrent ? 'background:#e8eefb;' : '';
        const bold = isCurrent ? 'font-weight:700;color:#0b2f73;' : 'color:#334155;';
        return `<tr style="${bg}">
          <td style="padding:8px 10px;font-size:13.5px;${bold}">${p.name}${isCurrent ? ' <span style="color:#1d4fa5;">✔</span>' : ''}</td>
          <td style="padding:8px 10px;font-size:13.5px;text-align:center;${bold}">${range}</td>
          <td style="padding:8px 10px;font-size:13.5px;text-align:right;${bold}">${fmt(p.initialFee)}</td>
          <td style="padding:8px 10px;font-size:13.5px;text-align:right;${bold}">${fmt(p.yearlyAmount)} / an</td>
        </tr>`;
      })
      .join('');
    const gridBlock = gridRows
      ? `<h3 style="font-size:15px;color:#0b2f73;margin:24px 0 8px 0;">Grille tarifaire — plans Academia Helm</h3>
        <p style="margin:0 0 10px 0;font-size:13px;color:#64748b;line-height:1.6;">Tous les plans incluent l'intégralité des 21 modules métier + 6 modules complémentaires — aucune restriction. Montants en FCFA, toutes taxes comprises (contrat d'abonnement, Article 3).</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#0b2f73;">
              <th style="padding:9px 10px;font-size:12.5px;color:#ffffff;text-align:left;font-weight:600;">Plan</th>
              <th style="padding:9px 10px;font-size:12.5px;color:#ffffff;text-align:center;font-weight:600;">Capacité (élèves)</th>
              <th style="padding:9px 10px;font-size:12.5px;color:#ffffff;text-align:right;font-weight:600;">Activation (FCFA)</th>
              <th style="padding:9px 10px;font-size:12.5px;color:#ffffff;text-align:right;font-weight:600;">Frais annuels (FCFA)</th>
            </tr>
          </thead>
          <tbody>${gridRows}</tbody>
        </table>
        <p style="margin:8px 0 0 0;font-size:12.5px;color:#64748b;line-height:1.6;">Option bilingue FR/EN : ${bilingualFee != null ? fmt(bilingualFee) : fmt(data.bilingualYearlyFee)} FCFA/an en supplément, quel que soit le plan. Si votre effectif a évolué, le plan adapté à votre nouvelle tranche s'applique au renouvellement.</p>`
      : '';

    // ── Conditions (contrat Articles 4 et 5) ──
    const conditionsBlock = `<h3 style="font-size:15px;color:#0b2f73;margin:24px 0 8px 0;">Conditions de renouvellement</h3>
      <ul style="margin:0;padding-left:20px;font-size:13px;color:#475569;line-height:1.7;">
        <li>Facturation <strong>annuelle uniquement</strong> ; frais annuels payables d'avance à chaque date d'échéance annuelle.</li>
        <li>Pénalité de retard : <strong>15 jours</strong> après l'échéance → suspension possible du service.</li>
        <li>Règlement : espèces contre reçu, virement bancaire ou Mobile Money.</li>
        <li>Reconduction tacite par périodes d'un an ; dénonciation possible jusqu'à <strong>60 jours</strong> avant la date d'échéance (Article 5).</li>
        <li>Messagerie Helm Connect et e-mail inclus gratuitement et sans limitation.</li>
      </ul>`;

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; background: #f8fafc; font-family: 'Segoe UI', Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #0b2f73, #1d4fa5); padding: 28px 24px; text-align: center; border-radius: 12px 12px 0 0; }
    .header img { max-width: 48px; margin-bottom: 8px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; }
    .header p { color: #f5b335; margin: 4px 0 0; font-size: 12px; font-weight: 500; }
    .content { background: #ffffff; padding: 36px 32px; border: 1px solid #e2e8f0; border-top: none; }
    .content h2 { font-size: 18px; color: #0b2f73; margin: 0 0 16px; }
    .content p { font-size: 14px; color: #475569; line-height: 1.7; margin: 0 0 12px; }
    .button { display: inline-block; background: linear-gradient(135deg, #0b2f73, #1d4fa5); color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; margin-top: 16px; font-weight: 600; font-size: 14px; }
    .footer { background: #f8fafc; padding: 20px 24px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none; }
    .footer p { font-size: 12px; color: #94a3b8; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logoUrl}" alt="Academia Helm" />
      <h1>Academia Helm</h1>
      <p>Plateforme SaaS de gestion scolaire</p>
    </div>
    <div class="content">
      <h2>${isTrial ? 'Fin de période d\'essai imminente' : 'Rappel d\'expiration d\'abonnement'}</h2>
      <p>Bonjour,</p>
      <p>Votre ${statusText} pour <strong>${data.schoolName}</strong> expire dans <strong>${data.daysRemaining} jour${data.daysRemaining > 1 ? 's' : ''}</strong>.</p>
      ${planBlock}
      ${renewalBlock}
      <a href="${data.renewalUrl}" class="button">${isTrial ? 'Souscrire maintenant' : 'Renouveler maintenant'}</a>
      ${gridBlock}
      ${conditionsBlock}
      <p style="margin-top: 24px;">Si vous avez des questions, n'hésitez pas à nous contacter.</p>
      <p>Cordialement,<br>L'équipe Academia Helm</p>
    </div>
    <div class="footer">
      <p>Academia Helm — Solution de gestion scolaire</p>
      <p>Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    // ── Version texte (alignée sur le HTML) ──
    const textLines: string[] = [
      `Academia Helm - ${isTrial ? 'Fin de période d\'essai' : 'Rappel d\'expiration d\'abonnement'}`,
      '',
      'Bonjour,',
      '',
      `Votre ${statusText} pour ${data.schoolName} expire dans ${data.daysRemaining} jour${data.daysRemaining > 1 ? 's' : ''}.`,
      '',
      `Plan actuel : ${data.planName}${planRange ? ` (${planRange})` : ''}`,
    ];
    if (planAnnualFee != null) textLines.push(`Frais annuels du plan : ${fmt(planAnnualFee)} FCFA/an`);
    if (bilingualEnabled && bilingualFee != null) textLines.push(`Option bilingue FR/EN : ${fmt(bilingualFee)} FCFA/an`);
    if (renewalFee != null) {
      textLines.push('');
      textLines.push(isTrial
        ? `Pour continuer après votre essai, souscrivez au plan adapté — total à régler : ${fmt(renewalFee)} FCFA.`
        : `Pour renouveler, seuls les frais annuels sont dus (contrat Article 4) — total à régler : ${fmt(renewalFee)} FCFA.`);
      if (!isTrial) textLines.push('Les frais d\'activation ne sont dus qu\'une seule fois, à la signature du contrat.');
    }
    if (grid.length) {
      textLines.push('');
      textLines.push('Grille tarifaire — plans Academia Helm (contrat Article 3) :');
      grid.forEach((p) => {
        const isCurrent = planCode ? p.code === planCode : p.name === data.planName;
        textLines.push(`- ${p.name}${isCurrent ? ' (votre plan)' : ''} : ${this.fmtStudentRange(p.studentMin, p.studentMax)} élèves — activation ${fmt(p.initialFee)} FCFA, frais annuels ${fmt(p.yearlyAmount)} FCFA/an`);
      });
      textLines.push(`Option bilingue FR/EN : ${bilingualFee != null ? fmt(bilingualFee) : fmt(data.bilingualYearlyFee)} FCFA/an en supplément.`);
    }
    textLines.push('');
    textLines.push(`Pour ${isTrial ? 'souscrire' : 'renouveler'} :`);
    textLines.push(data.renewalUrl);
    textLines.push('');
    textLines.push('Conditions (contrat Articles 4 et 5) : facturation annuelle uniquement ; pénalité de retard 15 jours après échéance (suspension possible) ; règlement en espèces contre reçu, virement ou Mobile Money ; reconduction tacite annuelle, dénonciation jusqu\'à 60 jours avant l\'échéance.');
    textLines.push('');
    textLines.push('Cordialement,');
    textLines.push('L\'équipe Academia Helm');

    const text = textLines.join('\n').trim();

    return { subject, html, text };
  }

  // ============================================================================
  // MÉTHODE sendCategorized() — Wrapper avec traçabilité
  // ============================================================================
  //
  // Cette méthode orchestre :
  //   1. La création d'une entrée EmailLog (status=PENDING) avec catégorisation
  //   2. L'envoi de l'email via sendEmail() avec le reply-to personnalisé
  //   3. La mise à jour de l'EmailLog (status=SENT ou FAILED)
  //
  // Elle ne JAMAIS throw — les erreurs sont loggées et l'EmailLog est marqué
  // FAILED. Le caller peut vérifier le retour pour diagnostic.
  //
  // Pour migrer un service existant :
  //   AVANT : await this.emailService.sendEmail({ to, subject, html, fromName })
  //   APRÈS : await this.emailService.sendCategorized({ tenantId, category, to, subject, html, ... })
  //
  // Le EmailLogService est résolu via ModuleRef (lazy) pour éviter une
  // circular dependency entre EmailService → EmailLogService → PrismaService.
  // ============================================================================

  private _emailLogService: any = null;
  private _emailTrackingService: any = null;

  /**
   * Injecte le EmailLogService (appelé par CommunicationModule.onModuleInit).
   * Évite la circular dependency.
   */
  setEmailLogService(service: any): void {
    this._emailLogService = service;
  }

  /**
   * Injecte le EmailTrackingService (appelé par CommunicationModule.onModuleInit).
   * Permet à sendCategorized d'injecter le pixel + liens trackés dans le HTML.
   */
  setEmailTrackingService(service: any): void {
    this._emailTrackingService = service;
  }

  /**
   * Envoie un email catégorisé ET tracé en DB.
   *
   * @returns { success, logId, providerId?, error? }
   *   - success=true : email envoyé et log cré
   *   - success=false : envoi échoué, log marqué FAILED
   */
  async sendCategorized(request: import('./email-log.service').CategorizedEmailRequest): Promise<{
    success: boolean;
    logId?: string;
    providerId?: string;
    error?: string;
  }> {
    // Si EmailLogService n'est pas injecté (config minimale), fallback vers sendEmail
    if (!this._emailLogService) {
      this.logger.warn(
        'sendCategorized called but EmailLogService not injected — falling back to sendEmail (no logging)',
      );
      try {
        const result = await this.sendEmail({
          to: request.to,
          subject: request.subject,
          html: request.html,
          text: request.text,
          from: request.fromEmail,
          fromName: request.fromName,
          cc: request.cc,
          bcc: request.bcc,
        });
        return { success: result.success, providerId: result.messageId };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    // 1. Créer le log (status=PENDING)
    let logId: string;
    let replyTo: string | null;
    try {
      const logResult = await this._emailLogService.createLog(request);
      logId = logResult.logId;
      replyTo = logResult.replyTo;
    } catch (err: any) {
      this.logger.error(`Failed to create EmailLog: ${err.message}`, err.stack);
      // On continue quand même l'envoi — l'email doit partir même si le log échoue
      try {
        const result = await this.sendEmail({
          to: request.to,
          subject: request.subject,
          html: request.html,
          text: request.text,
          from: request.fromEmail,
          fromName: request.fromName,
        });
        return { success: result.success, providerId: result.messageId };
      } catch (sendErr: any) {
        return { success: false, error: sendErr.message };
      }
    }

    // 1.5 Injecter le tracking pixel + liens trackés dans le HTML
    // (uniquement si EmailTrackingService est injecté)
    let htmlToSend = request.html;
    if (this._emailTrackingService) {
      try {
        htmlToSend = this._emailTrackingService.injectTracking(request.html, logId);
      } catch (err: any) {
        this.logger.warn(`Failed to inject tracking for log ${logId}: ${err.message} — sending without tracking`);
        // On continue avec le HTML original
      }
    }

    // 2. Envoyer l'email avec le reply-to personnalisé + HTML tracké
    try {
      const result = await this.sendEmail({
        to: request.to,
        subject: request.subject,
        html: htmlToSend,
        text: request.text,
        from: request.fromEmail,
        fromName: request.fromName,
        replyTo: replyTo || undefined,
        cc: request.cc,
        bcc: request.bcc,
        // ⚠️ Pièces jointes (ex: PDF récapitulatif pédagogique enseignant).
        // Passées telles quelles à Nodemailer.sendMail() → voir sendViaNodemailer.
        attachments: request.attachments,
      });

      // 3a. Marquer comme SENT
      if (result.success) {
        await this._emailLogService.markAsSent(logId, this.provider, result.messageId);
        return { success: true, logId, providerId: result.messageId };
      } else {
        await this._emailLogService.markAsFailed(logId, 'Provider returned success=false');
        return { success: false, logId, error: 'Provider returned success=false' };
      }
    } catch (err: any) {
      // 3b. Marquer comme FAILED
      try {
        await this._emailLogService.markAsFailed(logId, err.message);
      } catch (markErr: any) {
        this.logger.error(`Failed to mark EmailLog ${logId} as FAILED: ${markErr.message}`);
      }
      return { success: false, logId, error: err.message };
    }
  }
}
