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
    const envProvider = (this.configService.get<string>('EMAIL_PROVIDER') || '').toLowerCase();
    const resendKey = this.configService.get<string>('RESEND_API_KEY');
    if (envProvider === 'resend' && resendKey) {
      this.provider = 'resend';
      this.logger.log('✅ Email provider: Resend');
    } else {
      this.provider = (this.configService.get<string>('EMAIL_PROVIDER', 'mock') as EmailProvider) || 'mock';
    }

    if (this.provider === 'nodemailer') {
      this.initializeNodemailer();
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
      throw new Error('RESEND_API_KEY not configured');
    }

    const fromEmail =
      request.from ||
      this.configService.get<string>('EMAIL_FROM_NOREPLY') ||
      this.configService.get<string>('SMTP_FROM');
    if (!fromEmail) {
      throw new Error('Expéditeur manquant : renseignez request.from ou EMAIL_FROM_NOREPLY');
    }

    const fromName = request.fromName || 'Academia Helm';
    const fromField = `"${fromName}" <${fromEmail}>`;

    const toList = Array.isArray(request.to) ? request.to : [request.to];
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
      }),
    });

    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };

    if (!res.ok) {
      this.logger.error('Resend API error:', body);
      throw new Error(body.message || `Resend error HTTP ${res.status}`);
    }

    this.logger.log(`Email sent via Resend to ${toList.join(', ')}: ${body.id}`);

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
   * Formate un email de rappel de facturation
   */
  formatBillingReminderEmail(data: {
    schoolName: string;
    planName: string;
    daysRemaining: number;
    status: string;
    renewalUrl: string;
  }): { subject: string; html: string; text: string } {
    const statusText = data.status === 'TRIAL_ACTIVE' ? 'période d\'essai' : 'abonnement';
    const urgency = data.daysRemaining === 1 ? 'URGENT' : data.daysRemaining <= 3 ? 'IMPORTANT' : '';

    const subject = `${urgency ? `[${urgency}] ` : ''}Rappel - ${data.schoolName} - Expiration dans ${data.daysRemaining} jour${data.daysRemaining > 1 ? 's' : ''}`;

    const logoUrl = this.configService.get<string>('APP_PUBLIC_URL', 'https://academiahelm.com') + '/images/logo-academia-helm-email.png';

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
      <h2>Rappel d'expiration</h2>
      <p>Bonjour,</p>
      <p>Votre ${statusText} pour <strong>${data.schoolName}</strong> expire dans <strong>${data.daysRemaining} jour${data.daysRemaining > 1 ? 's' : ''}</strong>.</p>
      <p><strong>Plan actuel :</strong> ${data.planName}</p>
      <p>Pour continuer à bénéficier de tous les services Academia Helm, veuillez renouveler votre abonnement dès maintenant.</p>
      <a href="${data.renewalUrl}" class="button">Renouveler maintenant</a>
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

    const text = `
Academia Helm - Rappel d'expiration

Bonjour,

Votre ${statusText} pour ${data.schoolName} expire dans ${data.daysRemaining} jour${data.daysRemaining > 1 ? 's' : ''}.

Plan actuel : ${data.planName}

Pour continuer à bénéficier de tous les services Academia Helm, veuillez renouveler votre abonnement :
${data.renewalUrl}

Cordialement,
L'équipe Academia Helm
    `.trim();

    return { subject, html, text };
  }
}
