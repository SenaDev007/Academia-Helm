/**
 * ============================================================================
 * PAYROLL PDF SERVICE - MODULE 5 (SCHEMA-ALIGNED v2)
 * ============================================================================
 *
 * Service pour la génération de bulletins de paie PDF officiels,
 * aligné sur les modèles PayrollItem + SalarySlip.
 *
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PuppeteerPoolService } from '../../common/services/puppeteer-pool.service';
import { StorageService } from '../../common/services/storage.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PayrollPdfService {
  private readonly logger = new Logger(PayrollPdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Génère un bulletin de paie PDF officiel (SalarySlip)
   */
  async generatePaySlipPdf(payrollItemId: string, tenantId: string, userId: string) {
    const payrollItem = await this.prisma.payrollItem.findFirst({
      where: { id: payrollItemId, tenantId },
      include: {
        staff: {
          include: {
            employeeCNSS: true,
          },
        },
        payroll: {
          include: {
            tenant: {
              include: { country: true },
            },
            academicYear: true,
          },
        },
        salarySlip: true,
      },
    });

    if (!payrollItem) {
      throw new NotFoundException(`Payroll item with ID ${payrollItemId} not found`);
    }

    const payroll = payrollItem.payroll;
    const tenant = payroll?.tenant;
    const country = tenant?.country;

    // Détection du pays et configuration des labels régionaux
    const countryCode = country?.code || 'BJ';
    const currency = country?.currencyCode || 'XOF';

    // Labels sociaux par pays
    const socialLabels: Record<string, string> = {
      'BJ': 'CNSS', 'TG': 'CNSS', 'SN': 'IPRES/CSS',
      'CI': 'CNPS', 'ML': 'INPS', 'BF': 'CNSS',
    };

    // Labels fiscaux par pays
    const taxLabels: Record<string, string> = {
      'BJ': 'IRPP', 'TG': 'IRPP', 'SN': 'ITS',
      'CI': 'IS', 'ML': 'ITS', 'BF': 'IUTS',
    };

    const labels = {
      social: socialLabels[countryCode] || 'Cotisations Sociales',
      tax: taxLabels[countryCode] || 'Impôt sur le Revenu',
      currency,
    };

    // Vérifier que la paie est validée
    if (payrollItem.status === 'PENDING') {
      throw new BadRequestException(
        'Cannot generate pay slip for payroll item with status PENDING. Please calculate/validate first.',
      );
    }

    // 1. Générer le HTML du bulletin
    const html = this.generatePaySlipHtml(payrollItem, labels);

    // 2. Convertir en PDF (PuppeteerPoolService handles browser availability)
    const pdfBuffer = await this.renderPdfFromHtml(html);

    // 3. Sauvegarder le PDF
    const pdfUrl = await this.savePdf(
      tenantId,
      payroll?.id ?? 'unknown',
      payrollItem.staffId,
      pdfBuffer,
    );

    // 4. Créer ou mettre à jour le SalarySlip
    const existingSlip = payrollItem.salarySlip;
    let salarySlip;

    if (existingSlip) {
      // Delete old PDF file before updating (prevent orphaned files in cloud + local)
      if (existingSlip.filePath) {
        try {
          // Try cloud storage deletion first
          if (this.storageService.getStorageType() === 'r2' || this.storageService.getStorageType() === 's3') {
            await this.storageService.deleteFile(existingSlip.filePath);
            this.logger.log(`Deleted old payslip PDF from cloud: ${existingSlip.filePath}`);
          } else if (existingSlip.filePath.startsWith('https://')) {
            // Vercel Blob
            await this.storageService.deleteFile(existingSlip.filePath);
          } else {
            // Local filesystem
            const oldPath = path.join(process.cwd(), existingSlip.filePath);
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
              this.logger.log(`Deleted old payslip PDF: ${oldPath}`);
            }
          }
        } catch (err) {
          this.logger.warn(`Failed to delete old payslip PDF: ${err}`);
        }
      }

      salarySlip = await this.prisma.salarySlip.update({
        where: { id: existingSlip.id },
        data: {
          filePath: pdfUrl,
          pdfGenerated: true,
          pdfGeneratedAt: new Date(),
          issuedBy: userId || null,
        },
      });
    } else {
      const receiptNumber = `SLP-${Date.now()}-${payrollItemId.substring(0, 8)}`;
      salarySlip = await this.prisma.salarySlip.create({
        data: {
          tenantId,
          payrollItemId,
          receiptNumber,
          period: payroll?.month ?? '',
          filePath: pdfUrl,
          pdfGenerated: true,
          pdfGeneratedAt: new Date(),
          issuedBy: userId || null,
        },
      });
    }

    return {
      ...salarySlip,
      pdfBuffer,
    };
  }

  /**
   * Génère le HTML du bulletin de paie avec labels régionaux
   */
  private generatePaySlipHtml(payrollItem: any, labels: any): string {
    const { staff, payroll } = payrollItem;
    const tenant = payroll?.tenant;
    const academicYear = payroll?.academicYear;

    // Format de date
    const formatDate = (date: Date | string) => {
      const d = new Date(date);
      return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const periodName = payroll?.startDate
      ? new Date(payroll.startDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      : payroll?.month || 'N/A';

    const cnssNumber = staff.employeeCNSS?.cnssNumber || 'N/A';

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #333; line-height: 1.5; }
    .header { border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; }
    .company-info h1 { color: #2563eb; margin: 0; font-size: 24px; }
    .bulletin-title { text-align: center; margin-bottom: 30px; }
    .bulletin-title h2 { text-transform: uppercase; border: 1px solid #333; display: inline-block; padding: 10px 40px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
    .info-box { border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
    .info-box h3 { margin-top: 0; font-size: 14px; color: #666; text-transform: uppercase; border-bottom: 1px solid #eee; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { background: #f8fafc; text-align: left; padding: 12px; border-bottom: 2px solid #e2e8f0; font-size: 13px; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    .amount { text-align: right; }
    .total-row { background: #f1f5f9; font-weight: bold; }
    .net-pay { background: #2563eb; color: white; font-size: 18px; }
    .footer { margin-top: 50px; font-size: 12px; text-align: center; color: #64748b; }
    .signature-area { margin-top: 40px; display: flex; justify-content: space-between; }
    .signature-box { border: 1px dashed #cbd5e1; width: 200px; height: 100px; padding: 10px; text-align: center; font-size: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      <h1>${tenant?.name || 'N/A'}</h1>
      <p>Année Scolaire: ${academicYear?.name || 'N/A'}</p>
      <p>Pays: ${tenant?.country?.name || 'N/A'}</p>
    </div>
    <div class="period-info">
      <p><strong>Période:</strong> ${periodName}</p>
      <p><strong>Date:</strong> ${formatDate(new Date())}</p>
    </div>
  </div>

  <div class="bulletin-title">
    <h2>Bulletin de Paie</h2>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>Employeur</h3>
      <p><strong>${tenant?.name || 'N/A'}</strong></p>
      <p>ID: ${(tenant?.id || 'N/A').substring(0, 8)}</p>
    </div>
    <div class="info-box">
      <h3>Salarié</h3>
      <p><strong>${staff.firstName} ${staff.lastName}</strong></p>
      <p>Matricule: ${staff.employeeNumber || 'N/A'}</p>
      <p>Catégorie: ${staff.roleType || 'N/A'}</p>
      <p>Fonction: ${staff.position || 'Personnel'}</p>
      <p>N° ${labels.social}: ${cnssNumber}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Désignation</th>
        <th class="amount">Base</th>
        <th class="amount">Retenue</th>
        <th class="amount">Gain</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Salaire de Base</td>
        <td class="amount">${Number(payrollItem.baseSalary).toLocaleString()}</td>
        <td class="amount"></td>
        <td class="amount">${Number(payrollItem.baseSalary).toLocaleString()}</td>
      </tr>
      <tr>
        <td>Heures Supplémentaires</td>
        <td class="amount"></td>
        <td class="amount"></td>
        <td class="amount">${Number(payrollItem.overtimeAmount).toLocaleString()}</td>
      </tr>
      <tr>
        <td>Indemnités et Primes</td>
        <td class="amount"></td>
        <td class="amount"></td>
        <td class="amount">${Number(payrollItem.bonuses).toLocaleString()}</td>
      </tr>
      <tr class="total-row">
        <td>SALAIRE BRUT</td>
        <td class="amount"></td>
        <td class="amount"></td>
        <td class="amount">${Number(payrollItem.grossSalary).toLocaleString()}</td>
      </tr>
      <tr>
        <td>Cotisation ${labels.social} (Salarié)</td>
        <td class="amount"></td>
        <td class="amount">${Number(payrollItem.cnssEmployee).toLocaleString()}</td>
        <td class="amount"></td>
      </tr>
      <tr>
        <td>Cotisation ${labels.social} (Employeur)</td>
        <td class="amount"></td>
        <td class="amount">${Number(payrollItem.cnssEmployer).toLocaleString()}</td>
        <td class="amount"></td>
      </tr>
      <tr>
        <td>${labels.tax}</td>
        <td class="amount"></td>
        <td class="amount">${Number(payrollItem.irppAmount).toLocaleString()}</td>
        <td class="amount"></td>
      </tr>
      ${Number(payrollItem.otherDeductions) > 0 ? `
      <tr>
        <td>Autres Déductions</td>
        <td class="amount"></td>
        <td class="amount">${Number(payrollItem.otherDeductions).toLocaleString()}</td>
        <td class="amount"></td>
      </tr>` : ''}
      <tr class="total-row">
        <td>TOTAL DÉDUCTIONS</td>
        <td class="amount"></td>
        <td class="amount">${Number(payrollItem.totalDeductions).toLocaleString()}</td>
        <td class="amount"></td>
      </tr>
      <tr class="total-row net-pay">
        <td colspan="3">NET À PAYER (${labels.currency})</td>
        <td class="amount">${Number(payrollItem.netSalary).toLocaleString()}</td>
      </tr>
    </tbody>
  </table>

  <div class="signature-area">
    <div class="signature-box">Signature du Salarié</div>
    <div class="signature-box">Cachet de l'Employeur</div>
  </div>

  <div class="footer">
    <p>Ce bulletin de paie est généré par Academia Helm. Pour votre sécurité, conservez-le précieusement.</p>
    <p>ID Bulletin: ${payrollItem.id}</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Convertit le HTML en PDF
   */
  private async renderPdfFromHtml(html: string): Promise<Buffer> {
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      return Buffer.from(pdf);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  /**
   * Sauvegarde le PDF sur le cloud storage (R2/S3) avec fallback local
   */
  private async savePdf(
    tenantId: string,
    payrollId: string,
    staffId: string,
    pdfBuffer: Buffer,
  ): Promise<string> {
    const fileName = `payslip-${staffId}-${Date.now()}.pdf`;
    const storageKey = `pay-slips/${tenantId}/${payrollId}/${fileName}`;

    try {
      // Upload to cloud storage (R2/S3/Vercel Blob) for persistence across redeployments
      const result = await this.storageService.uploadBuffer(pdfBuffer, storageKey, 'application/pdf');
      return result;
    } catch (cloudError) {
      // Fallback to local filesystem if cloud upload fails
      this.logger.warn(`Cloud upload failed, falling back to local filesystem: ${cloudError.message}`);
      const uploadsDir = path.join(process.cwd(), 'uploads', 'pay-slips', tenantId, payrollId);
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, pdfBuffer);
      return `/uploads/pay-slips/${tenantId}/${payrollId}/${fileName}`;
    }
  }

  /**
   * Récupère le PDF d'un bulletin de paie via le SalarySlip
   */
  async getPaySlipPdf(payrollItemId: string, tenantId: string): Promise<Buffer | null> {
    const salarySlip = await this.prisma.salarySlip.findUnique({
      where: { payrollItemId },
    });

    if (!salarySlip || !salarySlip.filePath) return null;

    // Try cloud storage first (R2/S3)
    try {
      if (this.storageService.getStorageType() === 'r2' || this.storageService.getStorageType() === 's3') {
        return await this.storageService.downloadFile(salarySlip.filePath);
      }
    } catch {
      this.logger.warn(`Cloud download failed for ${salarySlip.filePath}, trying local fallback`);
    }

    // Vercel Blob (already a URL)
    if (salarySlip.filePath.startsWith('https://')) {
      return null;
    }

    // Local filesystem fallback
    const absolutePath = path.join(process.cwd(), salarySlip.filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException('PDF file not found on filesystem');
    }

    return fs.readFileSync(absolutePath);
  }
}
