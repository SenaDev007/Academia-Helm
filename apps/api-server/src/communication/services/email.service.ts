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
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content?: Buffer | string;
    path?: string;
  }>;
}

export type EmailProvider = 'nodemailer' | 'sendgrid' | 'aws-ses' | 'mock';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: EmailProvider;
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.provider = (this.configService.get<string>('EMAIL_PROVIDER', 'mock') as EmailProvider) || 'mock';
    
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

    const fromEmail = request.from || this.configService.get<string>('SMTP_FROM') || 'noreply@academia-hub.com';

    const mailOptions = {
      from: fromEmail,
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
   * Envoie un email via SendGrid
   */
  private async sendViaSendGrid(request: EmailRequest): Promise<{ success: boolean; messageId?: string }> {
    const sendGridApiKey = this.configService.get<string>('SENDGRID_API_KEY');

    if (!sendGridApiKey) {
      throw new Error('SENDGRID_API_KEY not configured');
    }

    // TODO: Installer @sendgrid/mail et implémenter
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(sendGridApiKey);
    
    this.logger.warn('SendGrid integration not yet implemented. Using mock.');
    return await this.sendMock(request);
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

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Academia Hub</h1>
    </div>
    <div class="content">
      <h2>Rappel d'expiration</h2>
      <p>Bonjour,</p>
      <p>Votre ${statusText} pour <strong>${data.schoolName}</strong> expire dans <strong>${data.daysRemaining} jour${data.daysRemaining > 1 ? 's' : ''}</strong>.</p>
      <p><strong>Plan actuel :</strong> ${data.planName}</p>
      <p>Pour continuer à bénéficier de tous les services Academia Hub, veuillez renouveler votre abonnement dès maintenant.</p>
      <a href="${data.renewalUrl}" class="button">Renouveler maintenant</a>
      <p style="margin-top: 30px;">Si vous avez des questions, n'hésitez pas à nous contacter.</p>
      <p>Cordialement,<br>L'équipe Academia Hub</p>
    </div>
    <div class="footer">
      <p>Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const text = `
Academia Hub - Rappel d'expiration

Bonjour,

Votre ${statusText} pour ${data.schoolName} expire dans ${data.daysRemaining} jour${data.daysRemaining > 1 ? 's' : ''}.

Plan actuel : ${data.planName}

Pour continuer à bénéficier de tous les services Academia Hub, veuillez renouveler votre abonnement :
${data.renewalUrl}

Cordialement,
L'équipe Academia Hub
    `.trim();

    return { subject, html, text };
  }
}
