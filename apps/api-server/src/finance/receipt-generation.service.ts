/**
 * ============================================================================
 * RECEIPT GENERATION SERVICE - GÉNÉRATION DE REÇUS OFFICIELS
 * ============================================================================
 * 
 * Service pour générer des reçus officiels avec détails des allocations
 * Inclut génération PDF et QR Code de vérification
 * 
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { ReceiptNotificationService } from './receipt-notification.service';
import { AdministrativeSealsService } from '../settings/services/administrative-seals.service';
import { ElectronicSignaturesService } from '../settings/services/electronic-signatures.service';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import * as puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class ReceiptGenerationService {
  private readonly logger = new Logger(ReceiptGenerationService.name);
  private readonly receiptsDir = path.join(process.cwd(), 'uploads', 'receipts');

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: ReceiptNotificationService,
    private readonly sealsService: AdministrativeSealsService,
    private readonly signaturesService: ElectronicSignaturesService,
  ) {
    // Créer le dossier de stockage s'il n'existe pas
    this.ensureReceiptsDirectory();
  }

  private async ensureReceiptsDirectory() {
    try {
      await fs.mkdir(this.receiptsDir, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create receipts directory: ${error}`);
    }
  }

  /**
   * Génère un reçu officiel avec détails des allocations
   */
  async generateReceipt(
    paymentId: string,
    issuedBy?: string,
  ): Promise<{
    receipt: any;
    pdfPath: string;
    verificationToken: string;
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
          },
        },
        academicYear: true,
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
          orderBy: { allocationOrder: 'asc' },
        },
        receipt: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    // Vérifier si un reçu existe déjà
    let receipt = payment.receipt;
    if (!receipt) {
      // Générer un numéro de reçu unique
      const receiptNumber = await this.generateReceiptNumber(payment.tenantId);

      // Générer un token de vérification
      const verificationToken = this.generateVerificationToken(paymentId, receiptNumber);
      const verificationTokenHash = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');

      // Créer le reçu
      receipt = await this.prisma.paymentReceipt.create({
        data: {
          paymentId,
          receiptNumber,
          verificationToken,
          verificationTokenHash,
          issuedBy,
        },
      });
    }

    // Générer le PDF du reçu
    const pdfPath = await this.generateReceiptPDF(receipt, payment);

    // Mettre à jour le chemin du PDF
    await this.prisma.paymentReceipt.update({
      where: { id: receipt.id },
      data: { filePath: pdfPath },
    });

    // Envoyer les notifications automatiques (SMS + WhatsApp)
    try {
      await this.notificationService.sendReceiptNotifications(paymentId, receipt.id);
      this.logger.log(`Receipt notifications sent for payment ${paymentId}`);
    } catch (error) {
      // Ne pas bloquer la génération du reçu si les notifications échouent
      this.logger.error(`Failed to send receipt notifications: ${error}`);
    }

    return {
      receipt,
      pdfPath,
      verificationToken: receipt.verificationToken || '',
    };
  }

  /**
   * Génère le PDF du reçu avec Puppeteer
   */
  private async generateReceiptPDF(receipt: any, payment: any, sealVersion?: any): Promise<string> {
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
      sealVersion: sealVersion ? {
        fileUrl: sealVersion.generatedFileUrl,
        position: 'bottom-right',
      } : null,
    };

    // Générer le HTML du reçu
    const html = this.generateReceiptHTML(receiptData);

    // Créer le dossier tenant/année
    const tenantDir = path.join(this.receiptsDir, payment.tenantId);
    const yearDir = path.join(tenantDir, payment.academicYearId || 'default');
    await fs.mkdir(yearDir, { recursive: true });

    // Générer le PDF
    const pdfPath = path.join(yearDir, `receipt-${receipt.receiptNumber}.pdf`);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
      });
    } finally {
      await browser.close();
    }

    return pdfPath;
  }

  /**
   * Génère le HTML du reçu
   */
  private generateReceiptHTML(data: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 40px;
      color: #333;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 10px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      padding: 8px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .total {
      font-weight: bold;
      font-size: 16px;
    }
    .seal-container {
      position: absolute;
      width: 150px;
      height: 150px;
    }
    .seal-bottom-right {
      bottom: 20px;
      right: 20px;
    }
    .seal-bottom-left {
      bottom: 20px;
      left: 20px;
    }
    .seal-top-right {
      top: 20px;
      right: 20px;
    }
    .seal-top-left {
      top: 20px;
      left: 20px;
    }
    .seal-center {
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
    .seal-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    body {
      position: relative;
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
    <table>
      <tr><td>Nom complet:</td><td>${data.student.name}</td></tr>
      <tr><td>Matricule:</td><td>${data.student.matricule}</td></tr>
      <tr><td>Classe:</td><td>${data.student.class}</td></tr>
      <tr><td>Niveau:</td><td>${data.student.level}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">DÉTAIL DES FRAIS PAYÉS</div>
    <table>
      <thead>
        <tr>
          <th>Type de frais</th>
          <th>Montant total</th>
          <th>Montant payé</th>
          <th>Solde</th>
        </tr>
      </thead>
      <tbody>
        ${data.allocations
          .map(
            (allocation: any) => `
        <tr>
          <td>${allocation.feeLabel}</td>
          <td>${allocation.totalAmount.toLocaleString('fr-FR')} FCFA</td>
          <td>${allocation.allocatedAmount.toLocaleString('fr-FR')} FCFA</td>
          <td>${allocation.balance.toLocaleString('fr-FR')} FCFA</td>
        </tr>
        `,
          )
          .join('')}
      </tbody>
      <tfoot>
        <tr class="total">
          <td colspan="2">TOTAL PAYÉ</td>
          <td colspan="2">${data.totalPaid.toLocaleString('fr-FR')} FCFA</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div class="section">
    <div class="section-title">DÉTAIL DU PAIEMENT</div>
    <table>
      <tr><td>Montant encaissé:</td><td>${data.totalPaid.toLocaleString('fr-FR')} FCFA</td></tr>
      <tr><td>Mode de paiement:</td><td>${data.payment.method}</td></tr>
      <tr><td>Date:</td><td>${data.payment.date}</td></tr>
      <tr><td>Référence:</td><td>${data.payment.reference}</td></tr>
    </table>
  </div>

  <div class="footer">
    <p>Ce reçu est généré automatiquement et fait foi.</p>
    ${data.qrCodeUrl ? `<p>QR Code de vérification: ${data.qrCodeUrl}</p>` : ''}
    <p>Mention légale: Reçu officiel - Non modifiable</p>
  </div>

  ${data.sealVersion ? `
  <div class="seal-container seal-${data.sealVersion.position || 'bottom-right'}">
    <img src="${data.sealVersion.fileUrl}" alt="Cachet administratif" class="seal-image" />
  </div>
  ` : ''}
</body>
</html>
    `;
  }

  /**
   * Génère un numéro de reçu unique
   */
  private async generateReceiptNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `REC-${year}-`;

    const lastReceipt = await this.prisma.paymentReceipt.findFirst({
      where: {
        receiptNumber: {
          startsWith: prefix,
        },
        payment: {
          tenantId,
        },
      },
      orderBy: {
        receiptNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastReceipt) {
      const lastSequence = parseInt(
        lastReceipt.receiptNumber.split('-').pop() || '0',
        10,
      );
      sequence = lastSequence + 1;
    }

    return `${prefix}${sequence.toString().padStart(6, '0')}`;
  }

  /**
   * Génère un token de vérification pour le QR Code
   */
  private generateVerificationToken(paymentId: string, receiptNumber: string): string {
    const randomBytes = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now().toString();
    const payload = `RECEIPT-${paymentId}-${receiptNumber}-${timestamp}-${randomBytes}`;

    const secret = process.env.VERIFICATION_SECRET || 'academia-hub-verification-secret';
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    return Buffer.from(`${payload}:${signature}`).toString('base64url');
  }

  /**
   * Vérifie un token de reçu
   */
  async verifyReceiptToken(token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const receipt = await this.prisma.paymentReceipt.findFirst({
      where: {
        verificationTokenHash: tokenHash,
      },
      include: {
        payment: {
          include: {
            student: {
              include: {
                identifier: true,
              },
            },
            academicYear: true,
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
    });

    if (!receipt) {
      return {
        isValid: false,
        message: 'Token invalide',
      };
    }

    return {
      isValid: true,
      receipt: {
        receiptNumber: receipt.receiptNumber,
        date: receipt.issuedAt,
        student: {
          name: `${receipt.payment.student.firstName} ${receipt.payment.student.lastName}`,
          matricule: receipt.payment.student.identifier?.globalMatricule || 'N/A',
        },
        amount: receipt.payment.amount,
        academicYear: receipt.payment.academicYear.name,
      },
    };
  }

  /**
   * Génère un duplicata de reçu
   */
  async generateDuplicate(receiptId: string, issuedBy?: string) {
    const originalReceipt = await this.prisma.paymentReceipt.findUnique({
      where: { id: receiptId },
      include: {
        payment: true,
      },
    });

    if (!originalReceipt) {
      throw new NotFoundException('Receipt not found');
    }

    // Créer un nouveau reçu marqué comme duplicata
    const duplicateReceipt = await this.prisma.paymentReceipt.create({
      data: {
        paymentId: originalReceipt.paymentId,
        receiptNumber: `${originalReceipt.receiptNumber}-DUPL`,
        isDuplicate: true,
        duplicateOf: receiptId,
        issuedBy,
      },
    });

    // Régénérer le PDF avec mention DUPLICATA
    const pdfPath = await this.generateReceiptPDF(duplicateReceipt, originalReceipt.payment);

    await this.prisma.paymentReceipt.update({
      where: { id: duplicateReceipt.id },
      data: { filePath: pdfPath },
    });

    return duplicateReceipt;
  }
}

