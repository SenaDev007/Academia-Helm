/**
 * ============================================================================
 * SAISIEMASTER FOLLOW-UP SERVICE — Emails automatiques de closing
 * ============================================================================
 *
 * Envoie automatiquement des emails de présentation Academia Helm aux
 * prospects SaisieMaster selon un calendrier défini :
 *
 *   Jour 3  → Email 1 : "Découvrez Academia Helm" (présentation complète)
 *   Jour 7  → Email 2 : "Ne ratez pas l'occasion" (relance + démo)
 *   Jour 14 → Email 3 : "Dernier rappel" (urgence + offre spéciale)
 *
 * Le service est appelé par un cron job (ou manuellement via endpoint).
 * Il vérifie les prospects qui n'ont pas encore reçu un email donné
 * et dont la date d'inscription correspond au délai.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../communication/services/email.service';

@Injectable()
export class SaisieMasterFollowupService {
  private readonly logger = new Logger(SaisieMasterFollowupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Cron job : vérifie toutes les heures les prospects à relancer.
   * Tourne à minuit, 6h, 12h, 18h (UTC) pour éviter la surcharge.
   */
  @Cron('0 0,6,12,18 * * *')
  async processFollowups() {
    this.logger.log('🔄 Vérification des prospects SaisieMaster à relancer...');
    try {
      await this.sendFirstFollowup();    // Jour +3
      await this.sendSecondFollowup();   // Jour +7
      await this.sendThirdFollowup();    // Jour +14
    } catch (err) {
      this.logger.error('Erreur lors du traitement des follow-ups:', err);
    }
  }

  /**
   * Email 1 (Jour +3) : Présentation complète d'Academia Helm
   */
  async sendFirstFollowup() {
    const prospects = await this.prisma.saisieMasterProspect.findMany({
      where: {
        firstFollowupSent: false,
        status: 'LEAD',
        signupDate: {
          lte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 jours avant
        },
      },
    });

    if (prospects.length === 0) return;

    this.logger.log(`📧 Email 1 (Jour+3) : ${prospects.length} prospect(s) à contacter`);

    for (const prospect of prospects) {
      try {
        const html = this.buildFirstEmailHtml(prospect);
        await this.emailService.sendEmail({
          to: prospect.email,
          subject: `${prospect.firstName}, découvrez Academia Helm — la plateforme complète pour votre école`,
          html,
          fromName: 'Academia Helm',
        });

        await this.prisma.saisieMasterProspect.update({
          where: { id: prospect.id },
          data: {
            firstFollowupSent: true,
            firstFollowupSentAt: new Date(),
            status: 'CONTACTED',
          },
        });

        this.logger.log(`  ✅ Email 1 envoyé à ${prospect.email}`);
      } catch (err) {
        this.logger.error(`  ❌ Erreur email 1 pour ${prospect.email}: ${err.message}`);
      }
    }
  }

  /**
   * Email 2 (Jour +7) : Relance + invitation démo
   */
  async sendSecondFollowup() {
    const prospects = await this.prisma.saisieMasterProspect.findMany({
      where: {
        firstFollowupSent: true,
        secondFollowupSent: false,
        status: { in: ['LEAD', 'CONTACTED'] },
        firstFollowupSentAt: {
          lte: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 jours après email 1
        },
      },
    });

    if (prospects.length === 0) return;

    this.logger.log(`📧 Email 2 (Jour+7) : ${prospects.length} prospect(s) à relancer`);

    for (const prospect of prospects) {
      try {
        const html = this.buildSecondEmailHtml(prospect);
        await this.emailService.sendEmail({
          to: prospect.email,
          subject: `${prospect.firstName}, ne ratez pas l'occasion de simplifier la gestion de ${prospect.schoolName}`,
          html,
          fromName: 'Academia Helm',
        });

        await this.prisma.saisieMasterProspect.update({
          where: { id: prospect.id },
          data: {
            secondFollowupSent: true,
            secondFollowupSentAt: new Date(),
          },
        });

        this.logger.log(`  ✅ Email 2 envoyé à ${prospect.email}`);
      } catch (err) {
        this.logger.error(`  ❌ Erreur email 2 pour ${prospect.email}: ${err.message}`);
      }
    }
  }

  /**
   * Email 3 (Jour +14) : Dernier rappel + offre
   */
  async sendThirdFollowup() {
    const prospects = await this.prisma.saisieMasterProspect.findMany({
      where: {
        secondFollowupSent: true,
        convertedToTenantId: null,
        secondFollowupSentAt: {
          lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 jours après email 2
        },
      },
    });

    // Utiliser un champ non-standard pour le 3e email — on vérifie via le status
    const eligible = prospects.filter(p => p.status !== 'CONVERTED' && p.status !== 'LOST');
    if (eligible.length === 0) return;

    this.logger.log(`📧 Email 3 (Jour+14) : ${eligible.length} prospect(s) en dernier rappel`);

    for (const prospect of eligible) {
      try {
        const html = this.buildThirdEmailHtml(prospect);
        await this.emailService.sendEmail({
          to: prospect.email,
          subject: `Dernière chance : Academia Helm peut transformer ${prospect.schoolName}`,
          html,
          fromName: 'Academia Helm',
        });

        await this.prisma.saisieMasterProspect.update({
          where: { id: prospect.id },
          data: { status: 'LOST' }, // Marquer comme dernier contact
        });

        this.logger.log(`  ✅ Email 3 envoyé à ${prospect.email}`);
      } catch (err) {
        this.logger.error(`  ❌ Erreur email 3 pour ${prospect.email}: ${err.message}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  TEMPLATES HTML DES EMAILS
  // ═══════════════════════════════════════════════════════════════════════

  private buildFirstEmailHtml(prospect: any): string {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Découvrez Academia Helm</title>
</head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f5f7;color:#1a1a1a;">
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0D1F6E 0%,#1A3A8F 100%);padding:32px 24px;text-align:center;">
    <img src="https://academiahelm.com/images/logo-academia-helm-signature.png" alt="Academia Helm" style="height:48px;margin-bottom:12px;" />
    <h1 style="color:#fff;font-size:24px;margin:0;font-weight:700;">Découvrez Academia Helm</h1>
    <p style="color:#a8c5f0;font-size:14px;margin:8px 0 0;">La plateforme complète de gestion scolaire</p>
  </div>

  <!-- Body -->
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <p style="font-size:16px;line-height:1.6;color:#333;">Bonjour <strong>${prospect.firstName}</strong>,</p>

    <p style="font-size:15px;line-height:1.7;color:#555;">
      Vous utilisez actuellement <strong>SaisieMaster</strong> pour la saisie de vos notes EducMaster — et nous en sommes ravis ! 🎉
    </p>

    <p style="font-size:15px;line-height:1.7;color:#555;">
      Mais saviez-vous que <strong>Academia Helm</strong> offre bien plus qu'une simple saisie de notes ? C'est une <strong>plateforme complète de gestion scolaire</strong> qui peut transformer la façon dont vous gérez <strong>${prospect.schoolName}</strong>.
    </p>

    <!-- Modules grid -->
    <div style="background:#fff;border-radius:12px;padding:24px;margin:24px 0;border:1px solid #e5e7eb;">
      <h2 style="font-size:18px;color:#0D1F6E;margin:0 0 16px;">Tout ce qu'Academia Helm peut faire pour votre école :</h2>

      <table role="presentation" style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;width:40px;vertical-align:top;">📊</td>
          <td style="padding:8px 0;">
            <strong style="color:#0D1F6E;">Finances & Comptabilité</strong><br/>
            <span style="font-size:13px;color:#666;">Frais de scolarité, encaissements, dépenses, multi-caisses, bilan des encaissements, reçus PDF</span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;width:40px;vertical-align:top;">👥</td>
          <td style="padding:8px 0;">
            <strong style="color:#0D1F6E;">Élèves & Scolarité</strong><br/>
            <span style="font-size:13px;color:#666;">Inscriptions, cartes scolaires, transferts, dossiers complets, export EducMaster</span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;width:40px;vertical-align:top;">📝</td>
          <td style="padding:8px 0;">
            <strong style="color:#0D1F6E;">Examens & Bulletins</strong><br/>
            <span style="font-size:13px;color:#666;">Saisie de notes, calcul automatique des moyennes, bulletins PDF, export EducMaster</span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;width:40px;vertical-align:top;">💬</td>
          <td style="padding:8px 0;">
            <strong style="color:#0D1F6E;">Communication</strong><br/>
            <span style="font-size:13px;color:#666;">SMS, emails, WhatsApp aux parents — reçus de paiement envoyés automatiquement</span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;width:40px;vertical-align:top;">🏫</td>
          <td style="padding:8px 0;">
            <strong style="color:#0D1F6E;">Site institutionnel</strong><br/>
            <span style="font-size:13px;color:#666;">Un site web professionnel pour votre école, personnalisable sans compétences techniques</span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;width:40px;vertical-align:top;">👨‍🏫</td>
          <td style="padding:8px 0;">
            <strong style="color:#0D1F6E;">RH & Personnel</strong><br/>
            <span style="font-size:13px;color:#666;">Contrats, paie, absences, congés, organisation pédagogique</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:32px 0;">
      <a href="https://academiahelm.com/contact" style="display:inline-block;background:#0D1F6E;color:#fff;font-size:16px;font-weight:600;padding:14px 36px;border-radius:8px;text-decoration:none;">
        Demander une démo gratuite
      </a>
    </div>

    <p style="font-size:14px;line-height:1.7;color:#666;border-top:1px solid #e5e7eb;padding-top:20px;">
      <strong>Et le meilleur ?</strong> Vous pouvez exporter vos élèves ET vos notes au format EducMaster en un seul clic depuis Academia Helm — plus besoin de saisir manuellement !
    </p>

    <p style="font-size:14px;color:#666;">
      Cordialement,<br/>
      <strong>L'équipe Academia Helm</strong><br/>
      <span style="color:#999;">YEHI OR Tech — Parakou, Bénin</span>
    </p>
  </div>

  <!-- Footer -->
  <div style="background:#0D1F6E;padding:20px 24px;text-align:center;">
    <img src="https://academiahelm.com/images/logo-yehi-or-tech.png" alt="YEHI OR Tech" style="height:36px;margin-bottom:8px;" />
    <p style="color:#a8c5f0;font-size:12px;margin:0;">
      © 2026 Academia Helm — YEHI OR Tech<br/>
      Vous recevez cet email car vous avez créé un compte SaisieMaster.
    </p>
  </div>
</body>
</html>`;
  }

  private buildSecondEmailHtml(prospect: any): string {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ne ratez pas l'occasion</title>
</head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f5f7;color:#1a1a1a;">
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0D1F6E 0%,#1A3A8F 100%);padding:32px 24px;text-align:center;">
    <img src="https://academiahelm.com/images/logo-academia-helm-signature.png" alt="Academia Helm" style="height:48px;margin-bottom:12px;" />
    <h1 style="color:#fff;font-size:22px;margin:0;font-weight:700;">Simplifiez la gestion de ${prospect.schoolName}</h1>
  </div>

  <!-- Body -->
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <p style="font-size:16px;line-height:1.6;color:#333;">Bonjour <strong>${prospect.firstName}</strong>,</p>

    <p style="font-size:15px;line-height:1.7;color:#555;">
      Il y a quelques jours, nous vous avons présenté <strong>Academia Helm</strong> — la plateforme qui gère TOUT votre établissement scolaire.
    </p>

    <div style="background:#fff3cd;border:1px solid #ffeaa7;border-radius:8px;padding:16px;margin:24px 0;">
      <p style="margin:0;font-size:14px;color:#856404;">
        <strong>💡 Le saviez-vous ?</strong> Avec Academia Helm, vos notes saisies tout au long de l'année sont automatiquement prêtes pour l'import EducMaster. Plus besoin de ressaisir vos notes à la fin de l'année !
      </p>
    </div>

    <p style="font-size:15px;line-height:1.7;color:#555;">
      Voici ce que les directeurs d'école apprécient le plus :
    </p>

    <ul style="font-size:14px;line-height:1.8;color:#555;padding-left:24px;">
      <li><strong>Reçus de paiement</strong> envoyés automatiquement aux parents (SMS + WhatsApp + email)</li>
      <li><strong>Bilan des encaissements</strong> en temps réel — plus besoin de calculs manuels</li>
      <li><strong>Cartes scolaires</strong> avec QR code générées en un clic</li>
      <li><strong>Site web</strong> professionnel pour votre école</li>
      <li><strong>Multi-caisses</strong> pour suivre chaque source de revenu</li>
    </ul>

    <!-- Stats -->
    <div style="background:#f0f4ff;border-radius:12px;padding:20px;margin:24px 0;text-align:center;">
      <p style="font-size:28px;font-weight:800;color:#0D1F6E;margin:0;">13+ modules</p>
      <p style="font-size:14px;color:#666;margin:4px 0 0;">Tout votre établissement, une seule plateforme</p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:32px 0;">
      <a href="https://academiahelm.com/contact" style="display:inline-block;background:#0D1F6E;color:#fff;font-size:16px;font-weight:600;padding:14px 36px;border-radius:8px;text-decoration:none;">
        Réserver ma démo gratuite
      </a>
    </div>

    <p style="font-size:13px;color:#999;text-align:center;">
      Une démo de 30 minutes suffit pour voir comment Academia Helm peut transformer votre quotidien.
    </p>

    <p style="font-size:14px;color:#666;border-top:1px solid #e5e7eb;padding-top:20px;">
      Cordialement,<br/>
      <strong>L'équipe Academia Helm</strong><br/>
      <span style="color:#999;">YEHI OR Tech — Parakou, Bénin</span>
    </p>
  </div>

  <!-- Footer -->
  <div style="background:#0D1F6E;padding:20px 24px;text-align:center;">
    <img src="https://academiahelm.com/images/logo-yehi-or-tech.png" alt="YEHI OR Tech" style="height:36px;margin-bottom:8px;" />
    <p style="color:#a8c5f0;font-size:12px;margin:0;">
      © 2026 Academia Helm — YEHI OR Tech<br/>
      Vous recevez cet email car vous avez créé un compte SaisieMaster.
    </p>
  </div>
</body>
</html>`;
  }

  private buildThirdEmailHtml(prospect: any): string {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dernière chance</title>
</head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f5f7;color:#1a1a1a;">
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0D1F6E 0%,#1A3A8F 100%);padding:32px 24px;text-align:center;">
    <img src="https://academiahelm.com/images/logo-academia-helm-signature.png" alt="Academia Helm" style="height:48px;margin-bottom:12px;" />
    <h1 style="color:#fff;font-size:22px;margin:0;font-weight:700;">Dernière chance de transformer ${prospect.schoolName}</h1>
  </div>

  <!-- Body -->
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <p style="font-size:16px;line-height:1.6;color:#333;">Bonjour <strong>${prospect.firstName}</strong>,</p>

    <p style="font-size:15px;line-height:1.7;color:#555;">
      C'est notre dernier message à propos d'<strong>Academia Helm</strong>. Nous ne voulons pas vous spammer, mais nous tenons à vous offrir une <strong>dernière opportunité</strong> de découvrir comment notre plateforme peut révolutionner la gestion de votre école.
    </p>

    <div style="background:#e8f5e9;border:1px solid #a5d6a7;border-radius:8px;padding:16px;margin:24px 0;">
      <p style="margin:0;font-size:14px;color:#2e7d32;">
        <strong>🎁 Offre spéciale :</strong> Frais d'installation réduits pour les directeurs venant de SaisieMaster. Mentionnez le code <strong>SAISIEMASTER2026</strong> lors de votre inscription.
      </p>
    </div>

    <p style="font-size:15px;line-height:1.7;color:#555;">
      Voici un récapitulatif de ce que vous ratez sans Academia Helm :
    </p>

    <table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr style="background:#f8f9fa;">
        <td style="padding:12px;border:1px solid #e5e7eb;width:50%;">
          <strong style="color:#dc3545;">Sans Academia Helm ❌</strong>
        </td>
        <td style="padding:12px;border:1px solid #e5e7eb;width:50%;">
          <strong style="color:#28a745;">Avec Academia Helm ✅</strong>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#666;">Saisie manuelle des notes</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#333;">Notes saisies pendant l'année, export automatique</td>
      </tr>
      <tr style="background:#f8f9fa;">
        <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#666;">Cahiers pour les encaissements</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#333;">Reçus PDF + SMS/WhatsApp automatiques</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#666;">Cartes scolaires imprimées manuellement</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#333;">Cartes avec QR code générées en 1 clic</td>
      </tr>
      <tr style="background:#f8f9fa;">
        <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#666;">Communication parentale limitée</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#333;">SMS, email, WhatsApp intégrés</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#666;">Pas de site web pour l'école</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#333;">Site institutionnel personnalisé inclus</td>
      </tr>
    </table>

    <!-- CTA -->
    <div style="text-align:center;margin:32px 0;">
      <a href="https://academiahelm.com/contact" style="display:inline-block;background:#28a745;color:#fff;font-size:16px;font-weight:600;padding:14px 36px;border-radius:8px;text-decoration:none;">
        Je veux ma démo gratuite →
      </a>
    </div>

    <p style="font-size:13px;color:#999;text-align:center;">
      Si vous n'êtes pas intéressé, aucune action n'est nécessaire — vous ne recevrez plus d'emails de notre part.<br/>
      Mais n'hésitez pas à revenir quand vous serez prêt !
    </p>

    <p style="font-size:14px;color:#666;border-top:1px solid #e5e7eb;padding-top:20px;">
      Cordialement,<br/>
      <strong>L'équipe Academia Helm</strong><br/>
      <span style="color:#999;">YEHI OR Tech — Parakou, Bénin</span>
    </p>
  </div>

  <!-- Footer -->
  <div style="background:#0D1F6E;padding:20px 24px;text-align:center;">
    <img src="https://academiahelm.com/images/logo-yehi-or-tech.png" alt="YEHI OR Tech" style="height:36px;margin-bottom:8px;" />
    <p style="color:#a8c5f0;font-size:12px;margin:0;">
      © 2026 Academia Helm — YEHI OR Tech<br/>
      Vous recevez cet email car vous avez créé un compte SaisieMaster.
    </p>
  </div>
</body>
</html>`;
  }
}
