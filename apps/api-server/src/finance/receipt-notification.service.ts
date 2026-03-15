/**
 * ============================================================================
 * RECEIPT NOTIFICATION SERVICE - NOTIFICATIONS AUTOMATIQUES DE REÇUS
 * ============================================================================
 * 
 * Service pour envoyer automatiquement des notifications SMS et WhatsApp
 * aux parents après chaque paiement validé.
 * 
 * Fonctionnalités:
 * - SMS texte officiel avec détails du paiement
 * - WhatsApp avec message professionnel + image du reçu
 * - Traçabilité complète (preuve légale)
 * - Compatible offline-first
 * 
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { Prisma } from '@prisma/client';
import * as puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs/promises';
// import * as sharp from 'sharp'; // Optionnel : pour optimisation d'image

@Injectable()
export class ReceiptNotificationService {
  private readonly logger = new Logger(ReceiptNotificationService.name);
  private readonly receiptsDir = path.join(process.cwd(), 'uploads', 'receipts');
  private readonly imagesDir = path.join(process.cwd(), 'uploads', 'receipts', 'images');

  constructor(private readonly prisma: PrismaService) {
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    try {
      await fs.mkdir(this.imagesDir, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create images directory: ${error}`);
    }
  }

  /**
   * Envoie les notifications SMS et WhatsApp après génération d'un reçu
   */
  async sendReceiptNotifications(
    paymentId: string,
    receiptId: string,
  ): Promise<{
    smsNotification?: any;
    whatsappNotification?: any;
  }> {
    // Récupérer le paiement avec toutes les informations nécessaires
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        student: {
          include: {
            identifier: true,
            tenant: {
              include: {
                schools: {
                  take: 1,
                },
              },
            },
            studentEnrollments: {
              where: {
                status: 'ACTIVE',
              },
              include: {
                class: true,
                schoolLevel: true,
              },
              take: 1,
            },
            studentGuardians: {
              where: {
                isPrimary: true,
              },
              include: {
                guardian: true,
              },
              take: 1,
            },
          },
        },
        academicYear: true,
        receipt: {
          include: {
            payment: {
              include: {
                paymentAllocations: {
                  include: {
                    studentFee: {
                      include: {
                        feeDefinition: {
                          include: {
                            feeCategory: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      this.logger.error(`Payment ${paymentId} not found`);
      return {};
    }

    const parent = payment.student.studentGuardians?.[0]?.guardian;
    if (!parent || !parent.phone) {
      this.logger.warn(`No primary parent phone found for student ${payment.studentId}`);
      return {};
    }

    const enrollment = payment.student.studentEnrollments?.[0];
    const tenant = await this.prisma.tenant.findUnique({ where: { id: payment.student.tenantId } });
    const schools = await this.prisma.school.findMany({ where: { tenantId: payment.student.tenantId } });
    const institution = schools?.[0]?.name || tenant?.name || 'N/A';
    const studentName = `${payment.student.firstName} ${payment.student.lastName}`;
    const parentName = parent.firstName || 'Parent';
    const className = enrollment?.class?.name || 'N/A';
    const matricule = payment.student.identifier?.globalMatricule || 'N/A';

    if (!payment.receipt) {
      this.logger.warn(`No receipt found for payment ${paymentId}`);
      return {};
    }

    // Calculer le solde restant
    const receiptPayment = payment.receipt.payment;
    const totalDue = receiptPayment?.paymentAllocations?.reduce(
      (sum: any, alloc: any) => sum.plus(alloc.studentFee?.totalAmount || 0),
      new Prisma.Decimal(0),
    ) || new Prisma.Decimal(0);
    const totalPaid = new Prisma.Decimal(payment.amount);
    const remainingBalance = totalDue.minus(totalPaid);

    // Préparer les données pour les templates
    const templateData = {
      student_name: studentName,
      student_matricule: matricule,
      parent_name: parentName,
      class_name: className,
      amount: payment.amount.toNumber(),
      fee_type: receiptPayment ? this.getFeeTypeLabel(receiptPayment.paymentAllocations || []) : 'N/A',
      payment_date: new Date(payment.paymentDate).toLocaleDateString('fr-FR'),
      receipt_number: payment.receipt.receiptNumber,
      remaining_balance: remainingBalance.toNumber(),
      school_name: institution,
    };

    const results: any = {};

    // 1. Envoyer SMS (obligatoire)
    try {
      const smsMessage = this.generateSMSMessage(templateData);
      const smsNotification = await this.sendSMS(
        parent.phone,
        smsMessage,
        paymentId,
        receiptId,
      );
      results.smsNotification = smsNotification;
    } catch (error) {
      this.logger.error(`Failed to send SMS notification: ${error}`);
    }

    // 2. Envoyer WhatsApp (si numéro valide)
    try {
      const whatsappMessage = this.generateWhatsAppMessage(templateData);
      const receiptImagePath = await this.generateReceiptImage(payment.receipt, payment);
      const whatsappNotification = await this.sendWhatsApp(
        parent.phone,
        whatsappMessage,
        receiptImagePath,
        paymentId,
        receiptId,
      );
      results.whatsappNotification = whatsappNotification;
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp notification: ${error}`);
    }

    return results;
  }

  /**
   * Génère le message SMS officiel
   */
  private generateSMSMessage(data: any): string {
    return `ACADEMIA HUB

Paiement reçu pour :
Élève : ${data.student_name}
Matricule : ${data.student_matricule}
Montant : ${data.amount.toLocaleString('fr-FR')} FCFA
Objet : ${data.fee_type}
Date : ${data.payment_date}

Reçu N° ${data.receipt_number}
Solde restant : ${data.remaining_balance.toLocaleString('fr-FR')} FCFA

Merci.`;
  }

  /**
   * Génère le message WhatsApp professionnel
   */
  private generateWhatsAppMessage(data: any): string {
    return `Bonjour ${data.parent_name},

Nous confirmons la réception de votre paiement pour l'élève :

👤 ${data.student_name}
🏫 Classe : ${data.class_name}
💰 Montant : ${data.amount.toLocaleString('fr-FR')} FCFA
📅 Date : ${data.payment_date}

Vous trouverez ci-joint le reçu officiel.

Merci pour votre confiance.
— ${data.school_name}`;
  }

  /**
   * Génère une image PNG du reçu (optimisée mobile, portrait)
   */
  private async generateReceiptImage(receipt: any, payment: any): Promise<string> {
    const student = payment.student;
    const enrollment = student.studentEnrollments?.[0];
    const institution = student.tenant.schools?.[0]?.name || student.tenant.name;

    // Préparer les données pour le template
    const receiptData = {
      receiptNumber: receipt.receiptNumber,
      institution,
      academicYear: payment.academicYear.name,
      date: new Date(receipt.issuedAt).toLocaleDateString('fr-FR'),
      student: {
        name: `${student.firstName} ${student.lastName}`,
        matricule: student.identifier?.globalMatricule || 'N/A',
        class: enrollment?.class?.name || 'N/A',
        level: enrollment?.schoolLevel?.label || 'N/A',
      },
      payment: {
        amount: new Prisma.Decimal(payment.amount.toString()).toNumber(),
        method: payment.paymentMethod,
        date: new Date(payment.paymentDate).toLocaleDateString('fr-FR'),
        reference: payment.reference || 'N/A',
        receiptNumber: receipt.receiptNumber,
      },
      allocations: payment.paymentAllocations.map((allocation: any) => ({
        feeType: allocation.studentFee.feeDefinition.feeCategory.code || 'N/A',
        feeLabel: allocation.studentFee.feeDefinition.label,
        totalAmount: new Prisma.Decimal(allocation.studentFee.totalAmount.toString()).toNumber(),
        allocatedAmount: new Prisma.Decimal(allocation.allocatedAmount.toString()).toNumber(),
        balance: new Prisma.Decimal(allocation.studentFee.totalAmount.toString())
          .minus(allocation.studentFee.paymentSummary?.paidAmount || 0)
          .toNumber(),
      })),
      totalPaid: new Prisma.Decimal(payment.amount.toString()).toNumber(),
      verificationToken: receipt.verificationToken,
      qrCodeUrl: receipt.verificationToken
        ? `${process.env.PUBLIC_URL || 'https://verify.academiahub.africa'}/receipt/${receipt.verificationToken}`
        : null,
    };

    // Générer le HTML du reçu (version mobile optimisée)
    const html = this.generateReceiptImageHTML(receiptData);

    // Créer le dossier tenant/année
    const tenantDir = path.join(this.imagesDir, payment.tenantId);
    const yearDir = path.join(tenantDir, payment.academicYearId || 'default');
    await fs.mkdir(yearDir, { recursive: true });

    // Générer l'image PNG
    const imagePath = path.join(yearDir, `receipt-${receipt.receiptNumber}.png`);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 800, height: 1200 }); // Format portrait mobile
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      // Capturer l'image directement en PNG
      await page.screenshot({
        path: imagePath,
        type: 'png',
        fullPage: true,
      });

      // TODO: Optionnel - Optimiser l'image avec Sharp si installé
      // await sharp(screenshot)
      //   .resize(800, null, { withoutEnlargement: true })
      //   .png({ quality: 90, compressionLevel: 9 })
      //   .toFile(imagePath);
    } finally {
      await browser.close();
    }

    return imagePath;
  }

  /**
   * Génère le HTML du reçu optimisé pour image mobile
   */
  private generateReceiptImageHTML(data: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Arial', sans-serif;
      padding: 20px;
      background: #fff;
      color: #333;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 24px;
      color: #2563eb;
      margin-bottom: 5px;
    }
    .header p {
      font-size: 14px;
      color: #666;
    }
    .section {
      margin-bottom: 20px;
      padding: 15px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .section-title {
      font-weight: bold;
      font-size: 16px;
      margin-bottom: 10px;
      color: #1f2937;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 5px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-label {
      font-weight: 600;
      color: #4b5563;
    }
    .info-value {
      color: #1f2937;
      text-align: right;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 12px;
    }
    th, td {
      padding: 8px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background-color: #2563eb;
      color: white;
      font-weight: 600;
    }
    .total {
      font-weight: bold;
      font-size: 18px;
      color: #2563eb;
      text-align: center;
      padding: 15px;
      background: #eff6ff;
      border-radius: 8px;
      margin-top: 15px;
    }
    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 11px;
      color: #6b7280;
      padding-top: 15px;
      border-top: 2px solid #e5e7eb;
    }
    .qr-code {
      text-align: center;
      margin-top: 15px;
      padding: 10px;
      background: #f3f4f6;
      border-radius: 8px;
      font-size: 10px;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${data.institution}</h1>
    <p>REÇU DE PAIEMENT</p>
    <p>Année scolaire: ${data.academicYear}</p>
    <p>N° Reçu: ${data.receiptNumber}</p>
    <p>Date: ${data.date}</p>
  </div>

  <div class="section">
    <div class="section-title">IDENTITÉ ÉLÈVE</div>
    <div class="info-row">
      <span class="info-label">Nom complet:</span>
      <span class="info-value">${data.student.name}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Matricule:</span>
      <span class="info-value">${data.student.matricule}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Classe:</span>
      <span class="info-value">${data.student.class}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Niveau:</span>
      <span class="info-value">${data.student.level}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">DÉTAIL DES FRAIS PAYÉS</div>
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Total</th>
          <th>Payé</th>
          <th>Solde</th>
        </tr>
      </thead>
      <tbody>
        ${data.allocations
          .map(
            (allocation: any) => `
        <tr>
          <td>${allocation.feeLabel}</td>
          <td>${allocation.totalAmount.toLocaleString('fr-FR')}</td>
          <td>${allocation.allocatedAmount.toLocaleString('fr-FR')}</td>
          <td>${allocation.balance.toLocaleString('fr-FR')}</td>
        </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
    <div class="total">
      TOTAL PAYÉ: ${data.totalPaid.toLocaleString('fr-FR')} FCFA
    </div>
  </div>

  <div class="section">
    <div class="section-title">DÉTAIL DU PAIEMENT</div>
    <div class="info-row">
      <span class="info-label">Montant:</span>
      <span class="info-value">${data.totalPaid.toLocaleString('fr-FR')} FCFA</span>
    </div>
    <div class="info-row">
      <span class="info-label">Mode:</span>
      <span class="info-value">${data.payment.method}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Date:</span>
      <span class="info-value">${data.payment.date}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Référence:</span>
      <span class="info-value">${data.payment.reference}</span>
    </div>
  </div>

  ${data.qrCodeUrl ? `
  <div class="qr-code">
    <p>Vérification: ${data.qrCodeUrl}</p>
  </div>
  ` : ''}

  <div class="footer">
    <p>Reçu officiel - Non modifiable</p>
    <p>Généré automatiquement par Academia Hub</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Envoie un SMS (à intégrer avec le service SMS réel)
   */
  private async sendSMS(
    phone: string,
    message: string,
    paymentId: string,
    receiptId: string,
  ): Promise<any> {
    // Créer la notification en base (PENDING)
    const notification = await this.prisma.paymentNotification.create({
      data: {
        paymentId,
        receiptId,
        channel: 'SMS',
        recipientPhone: phone,
        messageSnapshot: message,
        status: 'PENDING',
      },
    });

    try {
      // TODO: Intégrer avec service SMS réel (Twilio, Vonage, etc.)
      // Pour l'instant, on simule l'envoi
      this.logger.log(`[SMS] Sending to ${phone}: ${message.substring(0, 50)}...`);

      // Simuler l'envoi réussi
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Mettre à jour la notification (SENT)
      const updated = await this.prisma.paymentNotification.update({
        where: { id: notification.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          metadata: {
            provider: 'SIMULATED',
            cost: 0,
          },
        },
      });

      this.logger.log(`SMS notification sent successfully for payment ${paymentId}`);
      return updated;
    } catch (error) {
      // Mettre à jour la notification (FAILED)
      await this.prisma.paymentNotification.update({
        where: { id: notification.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      this.logger.error(`Failed to send SMS to ${phone}:`, error);
      throw error;
    }
  }

  /**
   * Envoie un WhatsApp avec image (à intégrer avec le service WhatsApp réel)
   */
  private async sendWhatsApp(
    phone: string,
    message: string,
    imagePath: string,
    paymentId: string,
    receiptId: string,
  ): Promise<any> {
    // Créer la notification en base (PENDING)
    const notification = await this.prisma.paymentNotification.create({
      data: {
        paymentId,
        receiptId,
        channel: 'WHATSAPP',
        recipientPhone: phone,
        messageSnapshot: message,
        attachmentUrl: imagePath,
        status: 'PENDING',
      },
    });

    try {
      // TODO: Intégrer avec service WhatsApp Business API réel
      // Pour l'instant, on simule l'envoi
      this.logger.log(`[WhatsApp] Sending to ${phone} with image ${imagePath}`);

      // Simuler l'envoi réussi
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Mettre à jour la notification (SENT)
      const updated = await this.prisma.paymentNotification.update({
        where: { id: notification.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          metadata: {
            provider: 'SIMULATED',
            cost: 0,
          },
        },
      });

      this.logger.log(`WhatsApp notification sent successfully for payment ${paymentId}`);
      return updated;
    } catch (error) {
      // Mettre à jour la notification (FAILED)
      await this.prisma.paymentNotification.update({
        where: { id: notification.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      this.logger.error(`Failed to send WhatsApp to ${phone}:`, error);
      throw error;
    }
  }

  /**
   * Récupère le libellé du type de frais
   */
  private getFeeTypeLabel(allocations: any[]): string {
    if (allocations.length === 0) return 'Frais divers';
    
    const types = allocations.map((alloc) => {
      const category = alloc.studentFee?.feeDefinition?.feeCategory?.code;
      if (category === 'INSCRIPTION') return 'Inscription';
      if (category === 'REINSCRIPTION') return 'Réinscription';
      if (category === 'SCOLARITE') return 'Scolarité';
      return alloc.studentFee?.feeDefinition?.label || 'Frais';
    });

    return types.join(', ');
  }

  /**
   * Récupère l'historique des notifications pour un paiement
   */
  async getNotificationHistory(paymentId: string) {
    return this.prisma.paymentNotification.findMany({
      where: { paymentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Récupère les statistiques des notifications
   */
  async getNotificationStats(tenantId: string, academicYearId?: string) {
    const where: any = {
      payment: {
        tenantId,
      },
    };

    if (academicYearId) {
      where.payment.academicYearId = academicYearId;
    }

    const notifications = await this.prisma.paymentNotification.findMany({
      where,
      include: {
        payment: true,
      },
    });

    const stats = {
      total: notifications.length,
      sms: {
        total: notifications.filter((n) => n.channel === 'SMS').length,
        sent: notifications.filter((n) => n.channel === 'SMS' && n.status === 'SENT').length,
        failed: notifications.filter((n) => n.channel === 'SMS' && n.status === 'FAILED').length,
        pending: notifications.filter((n) => n.channel === 'SMS' && n.status === 'PENDING').length,
      },
      whatsapp: {
        total: notifications.filter((n) => n.channel === 'WHATSAPP').length,
        sent: notifications.filter((n) => n.channel === 'WHATSAPP' && n.status === 'SENT').length,
        failed: notifications.filter((n) => n.channel === 'WHATSAPP' && n.status === 'FAILED').length,
        pending: notifications.filter((n) => n.channel === 'WHATSAPP' && n.status === 'PENDING').length,
      },
    };

    return stats;
  }
}

