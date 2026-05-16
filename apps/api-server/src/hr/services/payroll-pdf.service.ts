/**
 * ============================================================================
 * PAYROLL PDF SERVICE - MODULE 5 (SCHEMA-ALIGNED)
 * ============================================================================
 * 
 * Service pour la génération de bulletins de paie PDF officiels, aligné sur le schéma v2.
 * 
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PayrollPdfService {
  private readonly logger = new Logger(PayrollPdfService.name);
  private puppeteer: any = null;

  constructor(private readonly prisma: PrismaService) {
    this.loadPuppeteer();
  }

  private async loadPuppeteer() {
    try {
      this.puppeteer = await import('puppeteer');
      this.logger.log('Puppeteer loaded successfully for payroll PDF generation');
    } catch (error) {
      this.logger.warn(
        'Puppeteer not available. PDF generation will be limited. ' +
        'Install with: npm install puppeteer',
      );
      this.puppeteer = null;
    }
  }

  /**
   * Génère un bulletin de paie PDF officiel (Payslip)
   */
  async generatePaySlipPdf(payrollId: string, tenantId: string, userId: string) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id: payrollId, tenantId },
      include: {
        staff: true,
        payrollPeriod: true,
        tenant: {
          include: {
            country: true
          }
        },
        academicYear: true,
        payslips: true,
      },
    });

    if (!payroll) {
      throw new NotFoundException(`Payroll entry with ID ${payrollId} not found`);
    }

    // Détection du pays et configuration des labels régionaux
    const countryCode = payroll.tenant?.country?.code || 'BJ';
    const currency = payroll.tenant?.country?.currencyCode || 'XOF';
    
    // Labels sociaux par pays
    const socialLabels: Record<string, string> = {
      'BJ': 'CNSS',
      'TG': 'CNSS',
      'SN': 'IPRES/CSS',
      'CI': 'CNPS',
      'ML': 'INPS',
      'BF': 'CNSS',
    };
    
    // Labels fiscaux par pays
    const taxLabels: Record<string, string> = {
      'BJ': 'IRPP',
      'TG': 'IRPP',
      'SN': 'ITS',
      'CI': 'IS',
      'ML': 'ITS',
      'BF': 'IUTS',
    };

    const labels = {
      social: socialLabels[countryCode] || 'Cotisations Sociales',
      tax: taxLabels[countryCode] || 'Impôt sur le Revenu',
      currency
    };

    // Vérifier que la paie est validée
    if (payroll.status === 'DRAFT') {
      throw new BadRequestException(
        `Cannot generate pay slip for payroll with status DRAFT. Please calculate/validate first.`,
      );
    }

    // 1. Générer le HTML du bulletin
    const html = this.generatePaySlipHtml(payroll, labels);

    // 2. Convertir en PDF
    if (!this.puppeteer) {
      throw new BadRequestException(
        'PDF generation is not available. Please install Puppeteer: npm install puppeteer',
      );
    }

    const pdfBuffer = await this.renderPdfFromHtml(html);

    // 3. Sauvegarder le PDF et obtenir l'URL
    const pdfUrl = await this.savePdf(
      tenantId,
      payroll.payrollPeriod.id,
      payroll.staffId,
      pdfBuffer,
    );

    // 4. Créer ou mettre à jour l'entrée Payslip
    const payslip = await this.prisma.payslip.create({
      data: {
        tenantId,
        payrollId,
        pdfUrl,
        issuedBy: userId || null,
        generatedAt: new Date(),
      },
    });

    return {
      ...payslip,
      pdfBuffer,
    };
  }

  /**
   * Génère le HTML du bulletin de paie avec labels régionaux
   */
  private generatePaySlipHtml(payroll: any, labels: any): string {
    const { staff, payrollPeriod, tenant, academicYear } = payroll;

    // Format de date
    const formatDate = (date: Date | string) => {
      const d = new Date(date);
      return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const periodName = new Date(payrollPeriod.startDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

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
      <h1>${tenant.name}</h1>
      <p>${tenant.address || ''}</p>
      <p>Année Scolaire: ${academicYear?.name || 'N/A'}</p>
      <p>Pays: ${tenant.country?.name || 'N/A'}</p>
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
      <p><strong>${tenant.name}</strong></p>
      <p>ID: ${tenant.id.substring(0, 8)}</p>
    </div>
    <div class="info-box">
      <h3>Salarié</h3>
      <p><strong>${staff.firstName} ${staff.lastName}</strong></p>
      <p>Matricule: ${staff.staffCode}</p>
      <p>Fonction: ${staff.position || 'Personnel'}</p>
      <p>N° ${labels.social}: ${staff.cnssNumber || 'N/A'}</p>
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
        <td class="amount">${Number(payroll.baseSalary).toLocaleString()}</td>
        <td class="amount"></td>
        <td class="amount">${Number(payroll.baseSalary).toLocaleString()}</td>
      </tr>
      <tr>
        <td>Indemnités et Primes</td>
        <td class="amount"></td>
        <td class="amount"></td>
        <td class="amount">${(Number(payroll.allowances) + Number(payroll.bonuses)).toLocaleString()}</td>
      </tr>
      <tr class="total-row">
        <td>SALAIRE BRUT</td>
        <td class="amount"></td>
        <td class="amount"></td>
        <td class="amount">${Number(payroll.grossSalary).toLocaleString()}</td>
      </tr>
      <tr>
        <td>Cotisation ${labels.social} (Salarié)</td>
        <td class="amount"></td>
        <td class="amount">${Number(payroll.employeeCNSS).toLocaleString()}</td>
        <td class="amount"></td>
      </tr>
      <tr>
        <td>${labels.tax}</td>
        <td class="amount"></td>
        <td class="amount">${Number(payroll.taxWithheld).toLocaleString()}</td>
        <td class="amount"></td>
      </tr>
      ${Number(payroll.deductions) > 0 ? `
      <tr>
        <td>Autres Déductions</td>
        <td class="amount"></td>
        <td class="amount">${Number(payroll.deductions).toLocaleString()}</td>
        <td class="amount"></td>
      </tr>` : ''}
      <tr class="total-row net-pay">
        <td colspan="3">NET À PAYER (${labels.currency})</td>
        <td class="amount">${Number(payroll.netSalary).toLocaleString()}</td>
      </tr>
    </tbody>
  </table>

  <div class="signature-area">
    <div class="signature-box">Signature du Salarié</div>
    <div class="signature-box">Cachet de l'Employeur</div>
  </div>

  <div class="footer">
    <p>Ce bulletin de paie est généré par Academia Hub. Pour votre sécurité, conservez-le précieusement.</p>
    <p>ID Bulletin: ${payroll.id}</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Convertit le HTML en PDF
   */
  private async renderPdfFromHtml(html: string): Promise<Buffer> {
    if (!this.puppeteer) throw new BadRequestException('Puppeteer is not available');

    const browser = await this.puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  /**
   * Sauvegarde le PDF sur le système de fichiers
   */
  private async savePdf(
    tenantId: string,
    periodId: string,
    staffId: string,
    pdfBuffer: Buffer,
  ): Promise<string> {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'pay-slips', tenantId, periodId);
    
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `payslip-${staffId}-${Date.now()}.pdf`;
    const filePath = path.join(uploadsDir, fileName);

    fs.writeFileSync(filePath, pdfBuffer);

    // Retourner le chemin relatif ou l'URL
    return `/uploads/pay-slips/${tenantId}/${periodId}/${fileName}`;
  }

  /**
   * Récupère le PDF d'un bulletin de paie
   */
  async getPaySlipPdf(payrollId: string, tenantId: string): Promise<Buffer | null> {
    const payslip = await this.prisma.payslip.findFirst({
      where: { payrollId, tenantId },
      orderBy: { generatedAt: 'desc' },
    });

    if (!payslip || !payslip.pdfUrl) return null;

    const absolutePath = path.join(process.cwd(), payslip.pdfUrl);
    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException('PDF file not found on filesystem');
    }

    return fs.readFileSync(absolutePath);
  }
}
