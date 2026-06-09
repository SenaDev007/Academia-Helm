/**
 * ============================================================================
 * CONTRACT PDF SERVICE - MODULE 5 (HR)
 * ============================================================================
 *
 * Génère des contrats de travail en PDF à partir de modèles Handlebars.
 * Supporte les types : CDD, CDI, VACATAIRE, STAGE
 * Inclut un QR Code de vérification et une zone de signature électronique.
 *
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PuppeteerPoolService } from '../../common/services/puppeteer-pool.service';
import { StorageService } from '../../common/services/storage.service';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

// ─── Handlebars Helpers ───────────────────────────────────────────────────────
Handlebars.registerHelper('formatDate', (date: Date | string) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
});

Handlebars.registerHelper('formatMoney', (amount: any, currency: string = 'XOF') => {
  if (amount == null) return '0';
  return `${Number(amount).toLocaleString('fr-FR')} ${currency}`;
});

Handlebars.registerHelper('paymentModeLabel', (mode: string) => {
  const labels: Record<string, string> = {
    BANK: 'Virement bancaire',
    CASH: 'Paiement en espèces',
    MOBILE_MONEY: 'Mobile Money',
  };
  return labels[mode] || mode;
});

Handlebars.registerHelper('genderLabel', (gender: string) => {
  return gender === 'FEMALE' ? 'Madame' : 'Monsieur';
});

Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
Handlebars.registerHelper('or', (a: any, b: any) => a || b);
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class ContractPdfService {
  private readonly logger = new Logger(ContractPdfService.name);
  private qrcode: any = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly storageService: StorageService,
  ) {
    this.loadDependencies();
  }

  private async loadDependencies() {
    try {
      this.qrcode = await import('qrcode');
      this.logger.log('QRCode loaded for contract verification');
    } catch {
      this.logger.warn('QRCode not available');
    }
  }

  // ─── Template CRUD ──────────────────────────────────────────────────────────

  async listTemplates(tenantId: string) {
    return this.prisma.contractTemplate.findMany({
      where: { tenantId, isActive: true },
      orderBy: { contractType: 'asc' },
    });
  }

  async getTemplate(id: string, tenantId: string) {
    const tmpl = await this.prisma.contractTemplate.findFirst({ where: { id, tenantId } });
    if (!tmpl) throw new NotFoundException('Template introuvable');
    return tmpl;
  }

  async createTemplate(tenantId: string, data: {
    name: string;
    contractType: string;
    template: string;
    variables?: Record<string, any>;
  }) {
    return this.prisma.contractTemplate.create({
      data: { ...data, tenantId },
    });
  }

  async updateTemplate(id: string, tenantId: string, data: Partial<{
    name: string;
    template: string;
    variables: Record<string, any>;
    isActive: boolean;
  }>) {
    await this.getTemplate(id, tenantId);
    return this.prisma.contractTemplate.update({ where: { id }, data });
  }

  async deleteTemplate(id: string, tenantId: string) {
    await this.getTemplate(id, tenantId);
    return this.prisma.contractTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─── Contract Generation ────────────────────────────────────────────────────

  /**
   * Génère un PDF de contrat pour un contrat donné.
   * Utilise le template lié si disponible, sinon le template par défaut selon le type.
   */
  async generateContractPdf(contractId: string, tenantId: string): Promise<{
    pdfBuffer: Buffer;
    pdfUrl: string;
    contract: any;
  }> {
    // 1. Charger le contrat complet
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      include: {
        staff: { include: { employeeCNSS: true } },
        tenant: { include: { country: true } },
        academicYear: true,
        template: true,
      },
    });

    if (!contract) throw new NotFoundException(`Contrat ${contractId} introuvable`);

    // 2. Sélectionner le template Handlebars
    let templateSource: string;
    if (contract.template?.template) {
      templateSource = contract.template.template;
    } else {
      // Chercher un template actif pour ce type de contrat
      const activeTemplate = await this.prisma.contractTemplate.findFirst({
        where: { tenantId, contractType: contract.contractType, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      templateSource = activeTemplate?.template || JSON.stringify(this.getDefaultArticles(contract.contractType));
    }

    // Si c'est un modèle structuré en JSON (articles), construire le HTML correspondant
    if (templateSource.trim().startsWith('[')) {
      try {
        const articles = JSON.parse(templateSource);
        templateSource = this.buildHtmlFromArticles(articles, contract.contractType);
      } catch (err) {
        this.logger.error('Failed to parse articles JSON template, falling back to legacy HTML template', err);
        templateSource = this.getDefaultTemplate(contract.contractType);
      }
    }

    // 3. Générer le QR Code de vérification
    const verificationUrl = `${process.env.APP_URL || 'https://academia-hub.app'}/verify/contract/${contractId}`;
    let qrCodeDataUrl = '';
    if (this.qrcode) {
      try {
        qrCodeDataUrl = await this.qrcode.toDataURL(verificationUrl, {
          width: 100,
          margin: 1,
          color: { dark: '#1A2BA6', light: '#ffffff' },
        });
      } catch (e) {
        this.logger.warn('QR Code generation failed', e);
      }
    }

    // 4. Préparer les variables du template
    const currency = contract.tenant?.country?.currencyCode || 'XOF';
    const templateVars = {
      // École / Employeur
      schoolName: contract.tenant?.name || 'L\'École',
      schoolAddress: contract.tenant?.schools?.address || contract.tenant?.slug || '',
      schoolCountry: contract.tenant?.country?.name || '',
      // Employé
      civilite: contract.staff?.gender === 'FEMALE' ? 'Madame' : 'Monsieur',
      staffFirstName: contract.staff?.firstName || '',
      staffLastName: contract.staff?.lastName || '',
      staffFullName: `${contract.staff?.firstName} ${contract.staff?.lastName}`,
      staffPosition: contract.staff?.position || 'Personnel',
      employeeNumber: contract.staff?.employeeNumber || '',
      staffRoleType: contract.staff?.roleType || '',
      staffEmail: contract.staff?.email || '',
      staffPhone: contract.staff?.phone || '',
      staffBirthDate: contract.staff?.birthDate
        ? new Date(contract.staff.birthDate).toLocaleDateString('fr-FR')
        : '',
      cnssNumber: contract.staff?.employeeCNSS?.cnssNumber || 'Non encore attribué',
      // Contrat
      contractId: contract.id,
      contractType: contract.contractType,
      contractTypeLabel:
        { CDI: 'Contrat à Durée Indéterminée (CDI)', CDD: 'Contrat à Durée Déterminée (CDD)', VACATAIRE: 'Contrat de Vacation', STAGE: 'Convention de Stage' }[contract.contractType] || contract.contractType,
      startDate: new Date(contract.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
      endDate: contract.endDate
        ? new Date(contract.endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
        : null,
      isCDI: contract.contractType === 'CDI',
      isStage: contract.contractType === 'STAGE',
      isVacataire: contract.contractType === 'VACATAIRE',
      baseSalary: Number(contract.baseSalary).toLocaleString('fr-FR'),
      currency,
      paymentMode: { BANK: 'Virement bancaire', CASH: 'Espèces', MOBILE_MONEY: 'Mobile Money' }[contract.paymentMode] || contract.paymentMode,
      academicYear: contract.academicYear?.name || '',
      // Signature
      signedAt: contract.signedAt
        ? new Date(contract.signedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
        : null,
      signatureData: (contract.terms as any)?.signatureData || null,
      isSigned: !!contract.signedAt,
      // QR Code & meta
      qrCodeDataUrl,
      verificationUrl,
      generatedAt: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
      generatedTime: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };

    // 5. Compiler le template Handlebars → HTML
    const compiledHtml = Handlebars.compile(templateSource)(templateVars);

    // 6. Générer le PDF via Puppeteer Pool
    // (PuppeteerPoolService handles browser availability)

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await this.renderPdf(compiledHtml);
    } catch (renderError: any) {
      this.logger.error('PDF rendering failed', renderError?.message || renderError);
      throw new BadRequestException(
        `Impossible de générer le PDF du contrat. Le service de rendu PDF est indisponible. Détail : ${renderError?.message || 'Erreur inconnue'}`,
      );
    }

    // 7. Sauvegarder sur le filesystem
    const pdfUrl = await this.savePdf(tenantId, contractId, pdfBuffer);

    // 8. Mettre à jour le contrat avec l'URL du PDF
    await this.prisma.contract.update({
      where: { id: contractId },
      data: {
        terms: {
          ...((contract.terms as any) || {}),
          pdfUrl,
          pdfGeneratedAt: new Date().toISOString(),
        },
      },
    });

    this.logger.log(`Contrat PDF généré: ${pdfUrl}`);
    return { pdfBuffer, pdfUrl, contract };
  }

  // ─── Get Existing PDF (no re-generation) ────────────────────────────────────

  /**
   * Récupère un PDF de contrat déjà généré sans le régénérer.
   * Retourne null si le PDF n'existe pas encore.
   */  
  async getExistingContractPdf(contractId: string, tenantId: string): Promise<{
    pdfBuffer: Buffer;
    contract: any;
  } | null> {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      include: {
        staff: { include: { employeeCNSS: true } },
        tenant: { include: { country: true } },
      },
    });

    if (!contract) throw new NotFoundException(`Contrat ${contractId} introuvable`);

    const pdfUrl = (contract.terms as any)?.pdfUrl;
    if (!pdfUrl) return null;

    // Try cloud storage first (R2/S3)
    try {
      if (this.storageService.getStorageType() === 'r2' || this.storageService.getStorageType() === 's3') {
        const pdfBuffer = await this.storageService.downloadFile(pdfUrl);
        return { pdfBuffer, contract };
      }
    } catch {
      // Cloud download failed, try local fallback
      this.logger.warn(`Cloud download failed for ${pdfUrl}, trying local fallback`);
    }

    // Try Vercel Blob (already a URL, can't download as buffer)
    if (pdfUrl.startsWith('https://')) {
      return null; // Can't serve Vercel Blob PDFs from buffer — need to re-generate
    }

    // Local filesystem fallback
    const absolutePath = path.join(process.cwd(), pdfUrl);
    if (!fs.existsSync(absolutePath)) return null;

    const pdfBuffer = fs.readFileSync(absolutePath);
    return { pdfBuffer, contract };
  }

  // ─── Electronic Signature ───────────────────────────────────────────────────

  /**
   * Enregistre la signature électronique d'un contrat.
   * signatureData: base64 image de la signature (depuis canvas)
   */
  async signContract(contractId: string, tenantId: string, data: {
    signatureData: string;   // base64 PNG from canvas
    signerName: string;
    signerRole?: string;
    ipAddress?: string;
  }) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, tenantId },
    });
    if (!contract) throw new NotFoundException('Contrat introuvable');
    if (contract.signedAt) throw new BadRequestException('Ce contrat a déjà été signé.');

    const signedAt = new Date();
    const updatedContract = await this.prisma.contract.update({
      where: { id: contractId },
      data: {
        signedAt,
        signedBy: data.signerName,
        terms: {
          ...((contract.terms as any) || {}),
          signatureData: data.signatureData,
          signerName: data.signerName,
          signerRole: data.signerRole || 'Employé',
          signedAt: signedAt.toISOString(),
          ipAddress: data.ipAddress || null,
          signatureMethod: 'ELECTRONIC_CANVAS',
        },
      },
      include: { staff: { include: { employeeCNSS: true } } },
    });

    // Re-générer le PDF avec la signature
    await this.generateContractPdf(contractId, tenantId);

    this.logger.log(`Contrat ${contractId} signé par ${data.signerName}`);
    return updatedContract;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async renderPdf(html: string): Promise<Buffer> {
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  private async savePdf(tenantId: string, contractId: string, pdfBuffer: Buffer): Promise<string> {
    const storageKey = `contracts/${tenantId}/contract-${contractId}.pdf`;
    try {
      // Upload to cloud storage (R2/S3/Vercel Blob) for persistence across redeployments
      const result = await this.storageService.uploadBuffer(pdfBuffer, storageKey, 'application/pdf');
      return result;
    } catch (cloudError) {
      // Fallback to local filesystem if cloud upload fails
      this.logger.warn(`Cloud upload failed, falling back to local filesystem: ${cloudError.message}`);
      const dir = path.join(process.cwd(), 'uploads', 'contracts', tenantId);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const fileName = `contract-${contractId}.pdf`;
      fs.writeFileSync(path.join(dir, fileName), pdfBuffer);
      return `/uploads/contracts/${tenantId}/${fileName}`;
    }
  }

  /**
   * Sauvegarde les articles personnalisés d'un contrat non signé.
   * Stocke les articles dans le champ `terms` du contrat sous forme de JSON.
   * Si un template existe, le met à jour avec les nouveaux articles.
   */
  async saveContractArticles(contractId: string, tenantId: string, articles: Array<{ title: string; content: string }>) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, tenantId },
    });

    if (!contract) throw new NotFoundException(`Contrat ${contractId} introuvable`);
    if (contract.signedAt) throw new BadRequestException('Impossible de modifier un contrat déjà signé');

    // Validate articles
    if (!Array.isArray(articles) || articles.length === 0) {
      throw new BadRequestException('Au moins un article est requis');
    }

    for (const art of articles) {
      if (!art.title || typeof art.title !== 'string') {
        throw new BadRequestException('Chaque article doit avoir un titre valide');
      }
      if (!art.content || typeof art.content !== 'string') {
        throw new BadRequestException('Chaque article doit avoir un contenu valide');
      }
    }

    // Store articles as JSON in contract terms
    const updatedTerms = {
      ...((contract.terms as any) || {}),
      customArticles: articles,
      articlesUpdatedAt: new Date().toISOString(),
    };

    // Also update or create a ContractTemplate with the custom articles
    // If the contract has a linked template, update it; otherwise create one
    let templateId = contract.templateId;

    if (templateId) {
      // Update existing template
      await this.prisma.contractTemplate.update({
        where: { id: templateId },
        data: {
          template: JSON.stringify(articles),
          updatedAt: new Date(),
        },
      });
    } else {
      // Create a new template linked to this contract type
      const newTemplate = await this.prisma.contractTemplate.create({
        data: {
          name: `Personnalisé - ${contract.contractType} - ${new Date().toLocaleDateString('fr-FR')}`,
          contractType: contract.contractType,
          template: JSON.stringify(articles),
          tenantId,
          isActive: true,
        },
      });
      templateId = newTemplate.id;

      // Link the template to the contract
      await this.prisma.contract.update({
        where: { id: contractId },
        data: { templateId },
      });
    }

    // Update the contract terms
    const updated = await this.prisma.contract.update({
      where: { id: contractId },
      data: { terms: updatedTerms },
      include: { staff: true, template: true },
    });

    this.logger.log(`Articles sauvegardés pour le contrat ${contractId}: ${articles.length} articles`);
    return { success: true, articlesCount: articles.length, contract: updated };
  }

  // ─── Default Templates ──────────────────────────────────────────────────────

  getDefaultTemplate(contractType: string): string {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', serif;
      color: #1a1a1a;
      font-size: 12pt;
      line-height: 1.7;
      background: white;
    }
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 72pt;
      color: rgba(26, 43, 166, 0.04);
      font-weight: bold;
      z-index: 0;
      white-space: nowrap;
      pointer-events: none;
    }
    .page { position: relative; z-index: 1; }
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #1A2BA6;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .school-info h1 { font-size: 18pt; color: #1A2BA6; font-weight: bold; }
    .school-info p { font-size: 9pt; color: #555; margin-top: 2px; }
    .contract-meta { text-align: right; }
    .contract-meta .ref {
      font-size: 8pt;
      color: #888;
      border: 1px solid #ddd;
      padding: 4px 8px;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 4px;
    }
    /* Title */
    .contract-title {
      text-align: center;
      margin: 28px 0 24px;
    }
    .contract-title h2 {
      font-size: 15pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 2px;
      border: 2px solid #1A2BA6;
      display: inline-block;
      padding: 8px 32px;
      color: #1A2BA6;
    }
    /* Sections */
    .section {
      margin-bottom: 22px;
    }
    .section-title {
      font-size: 11pt;
      font-weight: bold;
      color: #1A2BA6;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    /* Info grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 24px;
    }
    .info-row {
      display: flex;
      gap: 6px;
    }
    .info-label { font-weight: bold; color: #444; min-width: 130px; font-size: 10pt; }
    .info-value { color: #1a1a1a; font-size: 10pt; }
    /* Article */
    .article { margin-bottom: 16px; }
    .article-num {
      font-weight: bold;
      color: #1A2BA6;
      font-size: 10.5pt;
    }
    .article p { font-size: 10.5pt; text-align: justify; margin-top: 4px; }
    /* Salary box */
    .salary-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #1A2BA6;
      padding: 14px 18px;
      border-radius: 6px;
      margin: 10px 0;
    }
    .salary-amount {
      font-size: 18pt;
      font-weight: bold;
      color: #1A2BA6;
    }
    .salary-label { font-size: 9pt; color: #64748b; }
    /* Signature area */
    .signature-section {
      margin-top: 40px;
      page-break-inside: avoid;
    }
    .sig-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 20px;
    }
    .sig-box {
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 16px;
      min-height: 130px;
      display: flex;
      flex-direction: column;
    }
    .sig-title {
      font-size: 9pt;
      font-weight: bold;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .sig-name { font-size: 10pt; font-weight: bold; color: #1a1a1a; }
    .sig-date { font-size: 8.5pt; color: #888; margin-top: 4px; }
    .sig-image { max-height: 70px; max-width: 180px; margin-top: 6px; }
    .sig-placeholder {
      flex: 1;
      display: flex;
      align-items: flex-end;
      font-size: 8.5pt;
      color: #94a3b8;
      font-style: italic;
    }
    /* Footer */
    .footer {
      margin-top: 36px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .footer-left { font-size: 8pt; color: #94a3b8; }
    .footer-qr { text-align: right; }
    .footer-qr img { width: 64px; height: 64px; }
    .footer-qr p { font-size: 7pt; color: #94a3b8; margin-top: 2px; }
    /* Status badge */
    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 8pt;
      font-weight: bold;
      background: #dcfce7;
      color: #166534;
      border: 1px solid #bbf7d0;
    }
    .status-badge.unsigned {
      background: #fef9c3;
      color: #854d0e;
      border-color: #fef08a;
    }
  </style>
</head>
<body>
<div class="watermark">ACADEMIA HELM</div>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="school-info">
      <h1>{{schoolName}}</h1>
      <p>{{schoolAddress}}</p>
      <p>{{schoolCountry}}</p>
    </div>
    <div class="contract-meta">
      <div class="ref">Réf. {{contractReference}}</div>
      <p style="font-size:8pt;color:#888;">Émis le {{generatedAt}} à {{generatedTime}}</p>
      {{#if isSigned}}
        <span class="status-badge">✓ SIGNÉ</span>
      {{else}}
        <span class="status-badge unsigned">EN ATTENTE DE SIGNATURE</span>
      {{/if}}
    </div>
  </div>

  <!-- Title -->
  <div class="contract-title">
    <h2>{{contractTypeLabel}}</h2>
  </div>

  <!-- Preamble -->
  <div class="section">
    <p style="font-size:10.5pt; text-align:justify;">
      Entre les soussignés, <strong>{{schoolName}}</strong>, établissement scolaire sis à
      {{schoolAddress}}, ci-après dénommé <em>« L'Employeur »</em>,
    </p>
    <p style="font-size:10.5pt; text-align:justify; margin-top:8px;">
      Et <strong>{{civilite}} {{staffFullName}}</strong>, né(e) le {{staffBirthDate}},
      ci-après dénommé(e) <em>« L'Employé(e) »</em>,
    </p>
    <p style="font-size:10.5pt; margin-top:8px;">
      Il a été convenu et arrêté ce qui suit :
    </p>
  </div>

  <!-- Section 1: Identité parties -->
  <div class="section">
    <div class="section-title">Article 1 — Identification des Parties</div>
    <div class="info-grid">
      <div>
        <p style="font-size:9pt;font-weight:bold;color:#1A2BA6;margin-bottom:6px;">L'EMPLOYEUR</p>
        <div class="info-row"><span class="info-label">Établissement :</span><span class="info-value">{{schoolName}}</span></div>
        <div class="info-row"><span class="info-label">Adresse :</span><span class="info-value">{{schoolAddress}}</span></div>
        <div class="info-row"><span class="info-label">Pays :</span><span class="info-value">{{schoolCountry}}</span></div>
      </div>
      <div>
        <p style="font-size:9pt;font-weight:bold;color:#1A2BA6;margin-bottom:6px;">L'EMPLOYÉ(E)</p>
        <div class="info-row"><span class="info-label">Civilité :</span><span class="info-value">{{civilite}}</span></div>
        <div class="info-row"><span class="info-label">Nom complet :</span><span class="info-value">{{staffFullName}}</span></div>
        <div class="info-row"><span class="info-label">Matricule :</span><span class="info-value">{{employeeNumber}}</span></div>
        {{#if staffRoleType}}<div class="info-row"><span class="info-label">Catégorie :</span><span class="info-value">{{staffRoleType}}</span></div>{{/if}}
        <div class="info-row"><span class="info-label">N° CNSS :</span><span class="info-value">{{cnssNumber}}</span></div>
        {{#if staffEmail}}<div class="info-row"><span class="info-label">Email :</span><span class="info-value">{{staffEmail}}</span></div>{{/if}}
        {{#if staffPhone}}<div class="info-row"><span class="info-label">Téléphone :</span><span class="info-value">{{staffPhone}}</span></div>{{/if}}
      </div>
    </div>
  </div>

  <!-- Section 2: Objet -->
  <div class="section">
    <div class="section-title">Article 2 — Objet et Durée</div>
    <div class="article">
      <p class="article-num">2.1 — Nature du contrat</p>
      <p>{{civility}} {{staffFullName}} est engagé(e) en qualité de <strong>{{staffPosition}}</strong>
      dans le cadre d'un <strong>{{contractTypeLabel}}</strong>.</p>
    </div>
    <div class="article">
      <p class="article-num">2.2 — Durée</p>
      {{#if isCDI}}
        <p>Le présent contrat est à durée indéterminée. Il prend effet à compter du <strong>{{startDate}}</strong>.</p>
      {{else}}
        <p>Le présent contrat est conclu pour la période du <strong>{{startDate}}</strong>
        {{#if endDate}}au <strong>{{endDate}}</strong>{{else}}jusqu'à terme de la mission confiée{{/if}}.</p>
      {{/if}}
      {{#if academicYear}}<p style="margin-top:6px;">Année scolaire de référence : <strong>{{academicYear}}</strong></p>{{/if}}
    </div>
  </div>

  <!-- Section 3: Rémunération -->
  <div class="section">
    <div class="section-title">Article 3 — Rémunération</div>
    <div class="salary-box">
      <p class="salary-label">Salaire brut mensuel de base</p>
      <p class="salary-amount">{{baseSalary}} {{currency}}</p>
      <p class="salary-label" style="margin-top:4px;">Mode de paiement : {{paymentMode}}</p>
    </div>
    {{#unless isStage}}
    <p style="font-size:10pt; margin-top:10px; text-align:justify;">
      Ce salaire est versé mensuellement, après déduction des cotisations sociales et fiscales
      réglementaires en vigueur dans le pays. Des primes et indemnités pourront être accordées
      selon les dispositions du règlement intérieur de l'établissement.
    </p>
    {{/unless}}
    {{#if isStage}}
    <p style="font-size:10pt; margin-top:10px; text-align:justify;">
      Le stagiaire percevra une gratification mensuelle de <strong>{{baseSalary}} {{currency}}</strong>.
    </p>
    {{/if}}
  </div>

  <!-- Section 4: Obligations -->
  <div class="section">
    <div class="section-title">Article 4 — Obligations des Parties</div>
    <div class="article">
      <p class="article-num">4.1 — Obligations de l'Employé(e)</p>
      <p>L'employé(e) s'engage à exercer ses fonctions avec diligence, loyauté et professionnalisme,
      à respecter le règlement intérieur de l'établissement, à maintenir la confidentialité des
      informations auxquelles il/elle aura accès dans le cadre de ses fonctions.</p>
    </div>
    <div class="article">
      <p class="article-num">4.2 — Obligations de l'Employeur</p>
      <p>L'employeur s'engage à fournir les moyens nécessaires à l'exécution des missions confiées,
      à verser la rémunération convenue aux échéances prévues, à déclarer l'employé(e) aux
      organismes sociaux compétents conformément à la législation en vigueur.</p>
    </div>
  </div>

  <!-- Section 5: Conditions générales -->
  <div class="section">
    <div class="section-title">Article 5 — Dispositions Générales</div>
    <div class="article">
      <p class="article-num">5.1 — Période d'essai</p>
      {{#if isCDI}}
        <p>Le présent contrat est soumis à une période d'essai de trois (3) mois à compter de la
        date de prise d'effet. Durant cette période, chacune des parties peut rompre le contrat
        sans préavis ni indemnité.</p>
      {{else}}
        <p>Un mois d'essai est prévu à compter de la date de prise d'effet du contrat.</p>
      {{/if}}
    </div>
    <div class="article">
      <p class="article-num">5.2 — Résiliation</p>
      <p>Le présent contrat peut être résilié par consentement mutuel des parties, ou par l'une
      d'elles dans les cas prévus par la législation du travail applicable, moyennant un préavis
      dont la durée sera fixée conformément aux dispositions légales en vigueur.</p>
    </div>
    <div class="article">
      <p class="article-num">5.3 — Droit applicable</p>
      <p>Le présent contrat est soumis aux dispositions du Code du Travail applicable dans le pays
      de l'établissement. Tout litige relatif à l'interprétation ou à l'exécution du présent
      contrat sera soumis à la juridiction compétente.</p>
    </div>
  </div>

  <!-- Signature Section -->
  <div class="signature-section">
    <div class="section-title">Signatures</div>
    <p style="font-size:10pt; color:#555; margin-bottom:16px;">
      Fait en deux (2) exemplaires originaux, dont un remis à chaque partie.
      Chaque partie reconnaît avoir lu et accepté les termes du présent contrat.
    </p>
    <div class="sig-grid">
      <!-- Employeur -->
      <div class="sig-box">
        <p class="sig-title">Pour l'Établissement (Employeur)</p>
        <p class="sig-name">{{schoolName}}</p>
        {{#if isSigned}}
          <p class="sig-date">Fait le : {{signedAt}}</p>
        {{else}}
          <div class="sig-placeholder">Signature & cachet de l'établissement</div>
        {{/if}}
      </div>
      <!-- Employé -->
      <div class="sig-box">
        <p class="sig-title">L'Employé(e) — Lu et approuvé</p>
        <p class="sig-name">{{civilite}} {{staffFullName}}</p>
        {{#if isSigned}}
          <p class="sig-date">Signé le : {{signedAt}}</p>
          {{#if signatureData}}
            <img class="sig-image" src="{{signatureData}}" alt="Signature électronique" />
          {{/if}}
        {{else}}
          <div class="sig-placeholder">Signature de l'employé(e)</div>
        {{/if}}
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      <p><strong>Academia Hub</strong> — Système de Gestion Scolaire</p>
      <p>Document généré automatiquement. Réf. : {{contractReference}}</p>
      <p>Vérification : {{verificationUrl}}</p>
    </div>
    {{#if qrCodeDataUrl}}
    <div class="footer-qr">
      <img src="{{qrCodeDataUrl}}" alt="QR Code de vérification" />
      <p>Scanner pour vérifier</p>
    </div>
    {{/if}}
  </div>

</div>
</body>
</html>`;
  }

  getDefaultArticles(type: string): any[] {
    const isCDI = type === 'CDI';
    const isCDD = type === 'CDD';
    const isStage = type === 'STAGE';
    const isVacataire = type === 'VACATAIRE';

    return [
      {
        title: "Article 1 — Objet du contrat",
        content: `Le présent contrat a pour objet l'engagement du Salarié en qualité de <strong>{{staffPosition}}</strong> au sein de l'établissement <strong>{{schoolName}}</strong>. Le Salarié exercera ses fonctions sous l'autorité de la Direction de l'établissement scolaire.`
      },
      {
        title: "Article 2 — Date d'effet",
        content: `Le présent contrat prend effet à compter du <strong>{{startDate}}</strong>.`
      },
      {
        title: "Article 3 — Type de contrat",
        content: isCDI
          ? `Le présent contrat est un <strong>Contrat à Durée Indéterminée (CDI)</strong>.`
          : isCDD
          ? `Le présent contrat est un <strong>Contrat à Durée Déterminée (CDD)</strong> pour la période du <strong>{{startDate}}</strong> au <strong>{{endDate}}</strong>.`
          : isVacataire
          ? `Le présent contrat est un <strong>Contrat de Vacation</strong>.`
          : `Le présent document est une <strong>Convention de Stage</strong> pour la période du <strong>{{startDate}}</strong> au <strong>{{endDate}}</strong>.`
      },
      {
        title: "Article 4 — Période d'essai",
        content: `Le présent contrat est assorti d'une période d'essai de <strong>{{probationDuration}}</strong>. Durant cette période, chacune des parties pourra mettre fin au contrat conformément aux dispositions légales en vigueur.`
      },
      {
        title: "Article 5 — Missions et responsabilités",
        content: `Le Salarié s'engage à accomplir notamment les missions suivantes : <strong>{{jobResponsibilities}}</strong>. Cette liste n'est pas exhaustive et peut être adaptée en fonction des besoins de l'établissement.`
      },
      {
        title: "Article 6 — Lieu de travail",
        content: `Le Salarié exercera principalement ses fonctions à : <strong>{{workLocation}}</strong>. Toute affectation dans un autre lieu de travail pourra être décidée par l'Employeur, après consultation du Salarié, dans l'intérêt du service.`
      },
      {
        title: "Article 7 — Durée du travail",
        content: `La durée hebdomadaire de travail est fixée à <strong>{{weeklyHours}} heures</strong>. Les horaires de travail sont : {{workSchedule}}. Toute modification des horaires sera portée à la connaissance du Salarié dans un délai raisonnable.`
      },
      {
        title: "Article 8 — Rémunération",
        content: isStage
          ? `Le stagiaire percevra une gratification mensuelle nette de <strong>{{baseSalary}} {{currency}}</strong>, payée par <strong>{{paymentMode}}</strong>.`
          : `En contrepartie de son travail, le Salarié percevra une rémunération composée comme suit :<br>- Salaire de base : <strong>{{baseSalary}} {{currency}}</strong><br>- Prime de fonction : <strong>{{functionBonus}} {{currency}}</strong><br>- Indemnité de transport : <strong>{{transportBonus}} {{currency}}</strong><br>- Autres avantages : <strong>{{otherBenefits}}</strong><br><br>Soit un salaire brut mensuel de <strong>{{grossSalary}} {{currency}}</strong>, versé mensuellement par <strong>{{paymentMode}}</strong>.`
      },
      {
        title: "Article 9 — Congés",
        content: `Le Salarié bénéficiera des congés conformément à la législation du travail en vigueur dans le pays ({{country}}). Les périodes de congé seront fixées d'un commun accord entre l'Employeur et le Salarié, dans le respect du fonctionnement de l'établissement scolaire et du calendrier académique.`
      },
      {
        title: "Article 10 — Obligation de confidentialité",
        content: `Le Salarié s'engage à préserver la confidentialité de toutes les informations dont il aurait connaissance dans l'exercice de ses fonctions, notamment les données relatives aux élèves, aux familles, à la gestion financière et administrative de l'établissement. Cette obligation perdure après la fin du contrat.`
      },
      {
        title: "Article 11 — Protection des données",
        content: `Conformément à la législation en matière de protection des données personnelles, le Salarié est informé que ses données personnelles sont traitées dans le cadre de la gestion de la relation de travail. Il dispose d'un droit d'accès, de rectification et de suppression de ses données.`
      },
      {
        title: "Article 12 — Discipline et règlement intérieur",
        content: `Le Salarié s'engage à respecter le règlement intérieur de l'établissement, qui lui a été communiqué et dont il accuse réception. Toute infraction pourra faire l'objet de sanctions disciplinaires conformément aux dispositions légales en vigueur.`
      },
      {
        title: "Article 13 — Absences",
        content: `Toute absence doit être justifiée et préalablement autorisée par l'Employeur, sauf en cas de force majeure. Les absences injustifiées pourront entraîner une retenue sur salaire et, le cas échéant, des sanctions disciplinaires.`
      },
      {
        title: "Article 14 — Résiliation du contrat",
        content: isCDI
          ? `Le présent contrat pourra être résilié par chacune des parties, moyennant un préavis de un (1) mois. En cas de faute grave, le contrat pourra être rompu sans préavis ni indemnités. La démission devra être notifiée par écrit.`
          : `Le présent contrat prend fin à l'échéance du terme fixé, sans qu'il soit besoin de notification. Il pourra toutefois être résilié avant terme en cas de faute grave ou de force majeure.`
      },
      {
        title: "Article 15 — Droit applicable",
        content: `Le présent contrat est soumis au droit du travail applicable en <strong>{{country}}</strong>. Toute clause non prévue expressément sera régie par les dispositions légales et conventionnelles en vigueur.`
      },
      {
        title: "Article 16 — Dispositions finales",
        content: `Le présent contrat est établi en deux (2) exemplaires originaux, dont un remis à chaque partie. Les modifications apportées au présent contrat feront l'objet d'un avenant écrit. Fait à <strong>{{city}}</strong>, le <strong>{{signatureDate}}</strong>.`
      }
    ];
  }

  /**
   * Sanitize user-provided text to prevent XSS in HTML templates.
   * Escapes HTML special characters but preserves intentional HTML
   * tags used in default templates (like <strong>).
   */
  private sanitizeTemplateInput(text: string): string {
    if (!text || typeof text !== 'string') return '';
    // Remove dangerous tags but allow safe formatting tags
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^>]*>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
      .replace(/javascript\s*:/gi, ''); // Remove javascript: URLs
  }

  buildHtmlFromArticles(articles: any[], contractType: string): string {
    let articlesHtml = '';
    for (const art of articles) {
      if (!art || typeof art !== 'object') continue;
      const safeTitle = this.sanitizeTemplateInput(art.title || '');
      // Content is intentionally allowed to contain <strong> and similar
      // formatting tags used in default templates, but dangerous tags are stripped
      const safeContent = this.sanitizeTemplateInput(art.content || '');
      articlesHtml += `
  <!-- ${safeTitle || 'Article'} -->
  <div class="section">
    <div class="section-title">${safeTitle}</div>
    <div class="article">
      <p>${safeContent}</p>
    </div>
  </div>`;
    }

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', serif;
      color: #1a1a1a;
      font-size: 12pt;
      line-height: 1.7;
      background: white;
    }
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 72pt;
      color: rgba(26, 43, 166, 0.04);
      font-weight: bold;
      z-index: 0;
      white-space: nowrap;
      pointer-events: none;
    }
    .page { position: relative; z-index: 1; }
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #1A2BA6;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .school-info h1 { font-size: 18pt; color: #1A2BA6; font-weight: bold; }
    .school-info p { font-size: 9pt; color: #555; margin-top: 2px; }
    .contract-meta { text-align: right; }
    .contract-meta .ref {
      font-size: 8pt;
      color: #888;
      border: 1px solid #ddd;
      padding: 4px 8px;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 4px;
    }
    /* Title */
    .contract-title {
      text-align: center;
      margin: 28px 0 24px;
    }
    .contract-title h2 {
      font-size: 15pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 2px;
      border: 2px solid #1A2BA6;
      display: inline-block;
      padding: 8px 32px;
      color: #1A2BA6;
    }
    /* Sections */
    .section {
      margin-bottom: 22px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 11pt;
      font-weight: bold;
      color: #1A2BA6;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    /* Info grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 24px;
    }
    .info-row {
      display: flex;
      gap: 6px;
    }
    .info-label { font-weight: bold; color: #444; min-width: 130px; font-size: 10pt; }
    .info-value { color: #1a1a1a; font-size: 10pt; }
    /* Article */
    .article { margin-bottom: 16px; }
    .article p { font-size: 10.5pt; text-align: justify; margin-top: 4px; }
    
    /* Signature area */
    .signature-section {
      margin-top: 40px;
      page-break-inside: avoid;
    }
    .sig-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 20px;
    }
    .sig-box {
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 16px;
      min-height: 130px;
      display: flex;
      flex-direction: column;
    }
    .sig-title {
      font-size: 9pt;
      font-weight: bold;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .sig-name { font-size: 10pt; font-weight: bold; color: #1a1a1a; }
    .sig-date { font-size: 8.5pt; color: #888; margin-top: 4px; }
    .sig-image { max-height: 70px; max-width: 180px; margin-top: 6px; }
    .sig-placeholder {
      flex: 1;
      display: flex;
      align-items: flex-end;
      font-size: 8.5pt;
      color: #94a3b8;
      font-style: italic;
    }
    /* Footer */
    .footer {
      margin-top: 36px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .footer-left { font-size: 8pt; color: #94a3b8; }
    .footer-qr { text-align: right; }
    .footer-qr img { width: 64px; height: 64px; }
    .footer-qr p { font-size: 7pt; color: #94a3b8; margin-top: 2px; }
    /* Status badge */
    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 8pt;
      font-weight: bold;
      background: #dcfce7;
      color: #166534;
      border: 1px solid #bbf7d0;
    }
    .status-badge.unsigned {
      background: #fef9c3;
      color: #854d0e;
      border-color: #fef08a;
    }
  </style>
</head>
<body>
<div class="watermark">ACADEMIA HELM</div>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="school-info">
      <h1>{{schoolName}}</h1>
      <p>{{schoolAddress}}</p>
      <p>{{schoolCountry}}</p>
    </div>
    <div class="contract-meta">
      <div class="ref">Réf. {{contractReference}}</div>
      <p style="font-size:8pt;color:#888;">Émis le {{generatedAt}} à {{generatedTime}}</p>
      {{#if isSigned}}
        <span class="status-badge">✓ SIGNÉ</span>
      {{else}}
        <span class="status-badge unsigned">EN ATTENTE DE SIGNATURE</span>
      {{/if}}
    </div>
  </div>

  <!-- Title -->
  <div class="contract-title">
    <h2>{{contractTypeLabel}}</h2>
  </div>

  <!-- Preamble -->
  <div class="section">
    <p style="font-size:10.5pt; text-align:justify;">
      Entre les soussignés, <strong>{{schoolName}}</strong>, établissement scolaire sis à
      {{schoolAddress}}, ci-après dénommé <em>« L\'Employeur »</em>,
    </p>
    <p style="font-size:10.5pt; text-align:justify; margin-top:8px;">
      Et <strong>{{civilite}} {{staffFullName}}</strong>, né(e) le {{staffBirthDate}},
      ci-après dénommé(e) <em>« L\'Employé(e) »</em>,
    </p>
    <p style="font-size:10.5pt; margin-top:8px;">
      Il a été convenu et arrêté ce qui suit :
    </p>
  </div>

  <!-- Articles du contrat générés dynamiquement -->
  ${articlesHtml}

  <!-- Signature Section -->
  <div class="signature-section">
    <div class="section-title">Signatures</div>
    <p style="font-size:10pt; color:#555; margin-bottom:16px;">
      Fait en deux (2) exemplaires originaux, dont un remis à chaque partie.
      Chaque partie reconnaît avoir lu et accepté les termes du présent contrat.
    </p>
    <div class="sig-grid">
      <!-- Employeur -->
      <div class="sig-box">
        <p class="sig-title">Pour l'Établissement (Employeur)</p>
        <p class="sig-name">{{schoolName}}</p>
        {{#if isSigned}}
          <p class="sig-date">Fait le : {{signedAt}}</p>
        {{else}}
          <div class="sig-placeholder">Signature & cachet de l'établissement</div>
        {{/if}}
      </div>
      <!-- Employé -->
      <div class="sig-box">
        <p class="sig-title">L'Employé(e) — Lu et approuvé</p>
        <p class="sig-name">{{civilite}} {{staffFullName}}</p>
        {{#if isSigned}}
          <p class="sig-date">Signé le : {{signedAt}}</p>
          {{#if signatureData}}
            <img class="sig-image" src="{{signatureData}}" alt="Signature électronique" />
          {{/if}}
        {{else}}
          <div class="sig-placeholder">Signature de l'employé(e)</div>
        {{/if}}
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      <p><strong>Academia Hub</strong> — Système de Gestion Scolaire</p>
      <p>Document généré automatiquement. Réf. : {{contractReference}}</p>
      <p>Vérification : {{verificationUrl}}</p>
    </div>
    {{#if qrCodeDataUrl}}
    <div class="footer-qr">
      <img src="{{qrCodeDataUrl}}" alt="QR Code de vérification" />
      <p>Scanner pour vérifier</p>
    </div>
    {{/if}}
  </div>

</div>
</body>
</html>`;
  }
}
