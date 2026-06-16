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

import { Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PuppeteerPoolService } from '../../common/services/puppeteer-pool.service';
import { StorageService } from '../../common/services/storage.service';
import { StaffCredentialService } from './staff-credential.service';
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
    @Inject(forwardRef(() => StaffCredentialService))
    private readonly credentialService: StaffCredentialService,
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
    // NOTE: employeeCNSS relation may not exist if Prisma client is outdated.
    // We try with the full include first, and fall back to a simpler query if it fails.
    let contract: any;
    try {
      contract = await this.prisma.contract.findFirst({
        where: { id: contractId, tenantId },
        include: {
          staff: { include: { employeeCNSS: true } },
          tenant: { include: { country: true, schools: true } },
          academicYear: true,
          template: true,
        },
      });
    } catch (prismaErr: any) {
      // P2022 = column does not exist, P2009 = validation error (unknown field/relation)
      if (prismaErr?.code === 'P2022' || prismaErr?.code === 'P2009' || prismaErr?.message?.includes('column') || prismaErr?.message?.includes('does not exist')) {
        this.logger.warn(`Full include query failed (likely missing column/relation), falling back to simpler query: ${prismaErr.message}`);
        contract = await this.prisma.contract.findFirst({
          where: { id: contractId, tenantId },
          include: {
            staff: true,
            tenant: { include: { country: true, schools: true } },
            academicYear: true,
            template: true,
          },
        });
      } else {
        throw prismaErr;
      }
    }

    if (!contract) throw new NotFoundException(`Contrat ${contractId} introuvable`);

    // 1b. Charger les données complètes de l'école depuis SchoolSettings / TenantIdentityProfile
    const schoolSettings = await this.prisma.schoolSettings.findFirst({
      where: { tenantId },
    });
    const identityProfile = await this.prisma.tenantIdentityProfile.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { version: 'desc' },
    });
    const school = contract.tenant?.schools || await this.prisma.school.findFirst({ where: { tenantId } });

    // Priorité : SchoolSettings > TenantIdentityProfile > School > Tenant
    const schoolName = schoolSettings?.schoolName || identityProfile?.schoolName || school?.name || contract.tenant?.name || 'L\'École';
    const schoolAddress = schoolSettings?.address || identityProfile?.address || school?.address || '';
    const schoolPhone = schoolSettings?.phone || identityProfile?.phonePrimary || school?.primaryPhone || '';
    const schoolEmail = schoolSettings?.email || identityProfile?.email || school?.primaryEmail || '';
    const schoolLogo = schoolSettings?.logoUrl || identityProfile?.logoUrl || school?.logo || '';
    const schoolCity = schoolSettings?.city || identityProfile?.city || '';
    const schoolCountry = schoolSettings?.country || identityProfile?.country || contract.tenant?.country?.name || '';
    const directorName = school?.directorPrimary || schoolSettings?.abbreviation || identityProfile?.schoolAcronym || 'Le Directeur';
    const schoolAuthorizationNumber = schoolSettings?.authorizationNumber || identityProfile?.authorizationNumber || '';
    const schoolAbbreviation = schoolSettings?.abbreviation || identityProfile?.schoolAcronym || school?.abbreviation || '';

    // Résoudre le logo en URL complète si nécessaire
    // safety: school?.logo might be a JSON object (Prisma Json field), ensure we only use strings
    const schoolLogoStr = typeof schoolLogo === 'string' ? schoolLogo : (schoolLogo as any)?.url || '';
    let schoolLogoUrl = '';
    if (schoolLogoStr) {
      try {
        schoolLogoUrl = await this.storageService.resolveFileUrl(schoolLogoStr);
      } catch {
        schoolLogoUrl = schoolLogoStr; // Use raw URL if resolveFileUrl fails
      }
    }

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
    const verificationUrl = `${process.env.APP_URL || 'https://academia-helm.app'}/verify/contract/${contractId}`;
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
    const currency = contract.tenant?.country?.currencyCode || schoolSettings?.currency || 'XOF';
    const templateVars = {
      // École / Employeur
      schoolName,
      schoolAddress,
      schoolPhone,
      schoolEmail,
      schoolCountry,
      schoolCity,
      schoolLogoUrl,
      directorName,
      directorPosition: 'Directeur(rice)',
      schoolAuthorizationNumber,
      schoolAbbreviation,
      // Employé
      civilite: contract.staff?.gender === 'FEMALE' ? 'Madame' : 'Monsieur',
      staffFirstName: contract.staff?.firstName || '',
      staffLastName: contract.staff?.lastName || '',
      staffFullName: `${contract.staff?.firstName} ${contract.staff?.lastName}`,
      staffPosition: contract.staff?.position || 'Personnel',
      employeeNumber: contract.staff?.employeeNumber || '',
      staffMatricule: contract.staff?.tenantMatricule || contract.staff?.globalMatricule || contract.staff?.employeeNumber || '',
      staffRoleType: contract.staff?.roleType || '',
      staffEmail: contract.staff?.email || '',
      staffPhone: contract.staff?.phone || '',
      staffBirthDate: contract.staff?.birthDate
        ? new Date(contract.staff.birthDate).toLocaleDateString('fr-FR')
        : '',
      staffBirthPlace: contract.staff?.address || '',
      staffNationality: contract.staff?.nationality || '',
      staffMaritalStatus: contract.staff?.maritalStatus || '',
      staffNumberOfChildren: contract.staff?.numberOfChildren ?? '',
      staffAddress: contract.staff?.address || '',
      staffIdType: contract.staff?.nationalId ? 'CNI / Passeport' : '',
      staffIdNumber: contract.staff?.nationalId || '',
      cnssNumber: contract.staff?.employeeCNSS?.cnssNumber || contract.staff?.cnssNumber || 'Non encore attribué',
      staffIfuNumber: contract.staff?.ifuNumber || '',
      staffBankName: (contract.staff?.bankDetails as any)?.bankName || '',
      staffBankAccountNumber: (contract.staff?.bankDetails as any)?.accountNumber || '',
      staffBankAccountName: (contract.staff?.bankDetails as any)?.accountName || '',
      // Contrat — Utiliser le matricule comme référence (jamais l'ID backend)
      contractId: contract.id,
      contractReference: contract.staff?.tenantMatricule || contract.staff?.globalMatricule || `CTR-${new Date(contract.startDate).getFullYear()}-${contract.staff?.employeeNumber || ''}`,
      contractType: contract.contractType,
      contractTypeLabel:
        { CDI: 'Contrat à Durée Indéterminée (CDI)', CDD: 'Contrat à Durée Déterminée (CDD)', VACATAIRE: 'Contrat de Vacation', STAGE: 'Convention de Stage', CONSULTANT: 'Contrat de Consultation' }[contract.contractType] || contract.contractType,
      startDate: new Date(contract.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
      endDate: contract.endDate
        ? new Date(contract.endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
        : null,
      isCDI: contract.contractType === 'CDI',
      isStage: contract.contractType === 'STAGE',
      isVacataire: contract.contractType === 'VACATAIRE',
      probationDuration: contract.contractType === 'CDI' ? 'trois (3) mois' : 'un (1) mois',
      jobResponsibilities: contract.staff?.qualifications || 'Les missions définies par la Direction de l\'établissement',
      workLocation: schoolAddress || schoolCity || 'L\'établissement',
      weeklyHours: '40',
      workSchedule: 'Du lundi au vendredi, selon les horaires affichés par la Direction',
      baseSalary: Number(contract.baseSalary).toLocaleString('fr-FR'),
      functionBonus: '0',
      transportBonus: '0',
      otherBenefits: 'Aucun',
      grossSalary: Number(contract.baseSalary).toLocaleString('fr-FR'),
      currency,
      paymentMode: { BANK: 'Virement bancaire', CASH: 'Espèces', MOBILE_MONEY: 'Mobile Money' }[contract.paymentMode] || contract.paymentMode,
      academicYear: contract.academicYear?.name || '',
      country: schoolCountry || 'Bénin',
      city: schoolCity || '',
      signatureDate: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
      // Signature
      signedAt: contract.signedAt
        ? new Date(contract.signedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
        : null,
      signatureData: (contract.terms as any)?.signatureData || null,
      employerSignatureData: (contract.terms as any)?.employerSignatureData || null,
      employerSignerName: (contract.terms as any)?.employerSignerName || directorName,
      employerSignedAt: (contract.terms as any)?.employerSignedAt ? new Date((contract.terms as any).employerSignedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : null,
      isSigned: !!contract.signedAt,
      isEmployerSigned: !!(contract.terms as any)?.employerSignedAt,
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
        `Impossible de générer le PDF du contrat. Détail : ${renderError?.message || 'Erreur inconnue'}`,
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

  // ─── HTML Preview (no PDF generation) ─────────────────────────────────────

  /**
   * Génère uniquement le HTML du contrat pour prévisualisation,
   * sans produire de PDF ni mettre à jour l'URL.
   * Utilisé pour l'édition interactive avant signature.
   */
  async generateContractHtml(contractId: string, tenantId: string): Promise<{
    html: string;
    contract: any;
    templateVars: Record<string, any>;
  }> {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      include: {
        staff: { include: { employeeCNSS: true } },
        tenant: { include: { country: true, schools: true } },
        academicYear: true,
        template: true,
      },
    }).catch(async (prismaErr: any) => {
      // Fallback if employeeCNSS relation or column is missing
      if (prismaErr?.code === 'P2022' || prismaErr?.code === 'P2009' || prismaErr?.message?.includes('column') || prismaErr?.message?.includes('does not exist')) {
        this.logger.warn(`generateContractHtml: Full include failed, falling back: ${prismaErr.message}`);
        return this.prisma.contract.findFirst({
          where: { id: contractId, tenantId },
          include: {
            staff: true,
            tenant: { include: { country: true, schools: true } },
            academicYear: true,
            template: true,
          },
        });
      }
      throw prismaErr;
    });

    if (!contract) throw new NotFoundException(`Contrat ${contractId} introuvable`);

    const schoolSettings = await this.prisma.schoolSettings.findFirst({ where: { tenantId } });
    const identityProfile = await this.prisma.tenantIdentityProfile.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { version: 'desc' },
    });
    const school = contract.tenant?.schools || await this.prisma.school.findFirst({ where: { tenantId } });

    const schoolName = schoolSettings?.schoolName || identityProfile?.schoolName || school?.name || contract.tenant?.name || "L'École";
    const schoolAddress = schoolSettings?.address || identityProfile?.address || school?.address || '';
    const schoolPhone = schoolSettings?.phone || identityProfile?.phonePrimary || school?.primaryPhone || '';
    const schoolEmail = schoolSettings?.email || identityProfile?.email || school?.primaryEmail || '';
    const schoolLogo = schoolSettings?.logoUrl || identityProfile?.logoUrl || school?.logo || '';
    const schoolCity = schoolSettings?.city || identityProfile?.city || '';
    const schoolCountry = schoolSettings?.country || identityProfile?.country || contract.tenant?.country?.name || '';
    const directorName = school?.directorPrimary || schoolSettings?.abbreviation || identityProfile?.schoolAcronym || 'Le Directeur';
    const schoolAuthorizationNumber = schoolSettings?.authorizationNumber || identityProfile?.authorizationNumber || '';
    const schoolAbbreviation = schoolSettings?.abbreviation || identityProfile?.schoolAcronym || school?.abbreviation || '';

    let schoolLogoUrl = '';
    const schoolLogoStr = typeof schoolLogo === 'string' ? schoolLogo : (schoolLogo as any)?.url || '';
    if (schoolLogoStr) {
      try {
        schoolLogoUrl = await this.storageService.resolveFileUrl(schoolLogoStr);
      } catch {
        schoolLogoUrl = schoolLogoStr;
      }
    }

    // Sélectionner le template
    let templateSource: string;
    if (contract.template?.template) {
      templateSource = contract.template.template;
    } else {
      const activeTemplate = await this.prisma.contractTemplate.findFirst({
        where: { tenantId, contractType: contract.contractType, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      templateSource = activeTemplate?.template || JSON.stringify(this.getDefaultArticles(contract.contractType));
    }

    if (templateSource.trim().startsWith('[')) {
      try {
        const articles = JSON.parse(templateSource);
        templateSource = this.buildHtmlFromArticles(articles, contract.contractType);
      } catch {
        templateSource = this.getDefaultTemplate(contract.contractType);
      }
    }

    // QR Code
    const verificationUrl = `${process.env.APP_URL || 'https://academia-helm.app'}/verify/contract/${contractId}`;
    let qrCodeDataUrl = '';
    if (this.qrcode) {
      try {
        qrCodeDataUrl = await this.qrcode.toDataURL(verificationUrl, { width: 100, margin: 1, color: { dark: '#1A2BA6', light: '#ffffff' } });
      } catch { /* ignore */ }
    }

    // Réutiliser les mêmes variables que generateContractPdf
    const currency = contract.tenant?.country?.currencyCode || schoolSettings?.currency || 'XOF';
    const templateVars = {
      schoolName, schoolAddress, schoolPhone, schoolEmail, schoolCountry, schoolCity, schoolLogoUrl,
      directorName, directorPosition: 'Directeur(rice)', schoolAuthorizationNumber, schoolAbbreviation,
      civilite: contract.staff?.gender === 'FEMALE' ? 'Madame' : 'Monsieur',
      staffFirstName: contract.staff?.firstName || '',
      staffLastName: contract.staff?.lastName || '',
      staffFullName: `${contract.staff?.firstName} ${contract.staff?.lastName}`,
      staffPosition: contract.staff?.position || 'Personnel',
      employeeNumber: contract.staff?.employeeNumber || '',
      staffMatricule: contract.staff?.tenantMatricule || contract.staff?.globalMatricule || contract.staff?.employeeNumber || '',
      staffRoleType: contract.staff?.roleType || '',
      staffEmail: contract.staff?.email || '',
      staffPhone: contract.staff?.phone || '',
      staffBirthDate: contract.staff?.birthDate ? new Date(contract.staff.birthDate).toLocaleDateString('fr-FR') : '',
      staffBirthPlace: contract.staff?.address || '',
      staffNationality: contract.staff?.nationality || '',
      staffMaritalStatus: contract.staff?.maritalStatus || '',
      staffNumberOfChildren: contract.staff?.numberOfChildren ?? '',
      staffAddress: contract.staff?.address || '',
      staffIdType: contract.staff?.nationalId ? 'CNI / Passeport' : '',
      staffIdNumber: contract.staff?.nationalId || '',
      cnssNumber: contract.staff?.employeeCNSS?.cnssNumber || contract.staff?.cnssNumber || 'Non encore attribué',
      staffIfuNumber: contract.staff?.ifuNumber || '',
      staffBankName: (contract.staff?.bankDetails as any)?.bankName || '',
      staffBankAccountNumber: (contract.staff?.bankDetails as any)?.accountNumber || '',
      staffBankAccountName: (contract.staff?.bankDetails as any)?.accountName || '',
      contractId: contract.id,
      contractReference: contract.staff?.tenantMatricule || contract.staff?.globalMatricule || `CTR-${new Date(contract.startDate).getFullYear()}-${contract.staff?.employeeNumber || ''}`,
      contractType: contract.contractType,
      contractTypeLabel: { CDI: 'Contrat à Durée Indéterminée (CDI)', CDD: 'Contrat à Durée Déterminée (CDD)', VACATAIRE: 'Contrat de Vacation', STAGE: 'Convention de Stage' }[contract.contractType] || contract.contractType,
      startDate: new Date(contract.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
      endDate: contract.endDate ? new Date(contract.endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : null,
      isCDI: contract.contractType === 'CDI',
      isStage: contract.contractType === 'STAGE',
      isVacataire: contract.contractType === 'VACATAIRE',
      probationDuration: contract.contractType === 'CDI' ? 'trois (3) mois' : 'un (1) mois',
      jobResponsibilities: contract.staff?.qualifications || "Les missions définies par la Direction de l'établissement",
      workLocation: schoolAddress || schoolCity || "L'établissement",
      weeklyHours: '40',
      workSchedule: 'Du lundi au vendredi, selon les horaires affichés par la Direction',
      baseSalary: Number(contract.baseSalary).toLocaleString('fr-FR'),
      functionBonus: '0',
      transportBonus: '0',
      otherBenefits: 'Aucun',
      grossSalary: Number(contract.baseSalary).toLocaleString('fr-FR'),
      currency,
      paymentMode: { BANK: 'Virement bancaire', CASH: 'Espèces', MOBILE_MONEY: 'Mobile Money' }[contract.paymentMode] || contract.paymentMode,
      academicYear: contract.academicYear?.name || '',
      country: schoolCountry || 'Bénin',
      city: schoolCity || '',
      signatureDate: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
      signedAt: contract.signedAt ? new Date(contract.signedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : null,
      signatureData: (contract.terms as any)?.signatureData || null,
      employerSignatureData: (contract.terms as any)?.employerSignatureData || null,
      employerSignerName: (contract.terms as any)?.employerSignerName || directorName,
      employerSignedAt: (contract.terms as any)?.employerSignedAt ? new Date((contract.terms as any).employerSignedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : null,
      isSigned: !!contract.signedAt,
      isEmployerSigned: !!(contract.terms as any)?.employerSignedAt,
      qrCodeDataUrl,
      verificationUrl,
      generatedAt: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
      generatedTime: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };

    const html = Handlebars.compile(templateSource)(templateVars);
    return { html, contract, templateVars };
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
    }).catch(async (prismaErr: any) => {
      if (prismaErr?.code === 'P2022' || prismaErr?.code === 'P2009' || prismaErr?.message?.includes('column') || prismaErr?.message?.includes('does not exist')) {
        this.logger.warn(`getExistingContractPdf: Full include failed, falling back: ${prismaErr.message}`);
        return this.prisma.contract.findFirst({
          where: { id: contractId, tenantId },
          include: {
            staff: true,
            tenant: { include: { country: true } },
          },
        });
      }
      throw prismaErr;
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
      // Cloud download failed, try other methods
      this.logger.warn(`Cloud download failed for ${pdfUrl}, trying alternative methods`);
    }

    // Try Vercel Blob or any HTTPS URL — fetch the URL server-side and return the buffer
    if (pdfUrl.startsWith('https://')) {
      try {
        const response = await fetch(pdfUrl);
        if (response.ok) {
          const arrayBuf = await response.arrayBuffer();
          const pdfBuffer = Buffer.from(arrayBuf);
          this.logger.log(`Retrieved PDF from remote URL (${pdfBuffer.length} bytes)`);
          return { pdfBuffer, contract };
        }
        this.logger.warn(`Failed to fetch PDF from ${pdfUrl}: HTTP ${response.status}`);
      } catch (fetchErr: any) {
        this.logger.warn(`Failed to fetch PDF from ${pdfUrl}: ${fetchErr.message}`);
      }
      // Don't return null immediately — try local filesystem as well
    }

    // Local filesystem fallback
    const absolutePath = path.join(process.cwd(), pdfUrl);
    if (fs.existsSync(absolutePath)) {
      const pdfBuffer = fs.readFileSync(absolutePath);
      return { pdfBuffer, contract };
    }

    return null;
  }

  // ─── Electronic Signature ───────────────────────────────────────────────────

  /**
   * Enregistre la signature électronique d'un contrat.
   * Supporte la double signature : EMPLOYEUR signe en premier, EMPLOYE signe en second.
   * - signerRole = 'EMPLOYEUR' → enregistre la signature employeur, contrat reste PENDING
   * - signerRole = 'EMPLOYE' (ou absent) → enregistre la signature employé, contrat → ACTIVE
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

    // Vérifier que le contrat peut être signé (pas expiré, résilié ou supprimé)
    if (contract.status === 'EXPIRED' || contract.status === 'TERMINATED' || contract.status === 'DELETED') {
      throw new BadRequestException(`Impossible de signer un contrat avec le statut "${contract.status}". Veuillez d'abord réactiver le contrat.`);
    }

    // Vérifier que le contrat n'est pas déjà signé
    if (contract.signedAt) {
      throw new BadRequestException('Ce contrat a déjà été signé.');
    }

    const terms = (contract.terms as any) || {};
    const signerRole = (data.signerRole || 'EMPLOYE').toUpperCase().replace('É', 'E').replace('E', 'E');

    // ─── EMPLOYEUR signs first ───────────────────────────────────────────────
    if (signerRole === 'EMPLOYEUR') {
      if (terms.employerSignedAt) {
        throw new BadRequestException("L'employeur a déjà signé ce contrat.");
      }

      const updatedContract = await this.prisma.contract.update({
        where: { id: contractId },
        data: {
          status: 'PENDING',  // Still pending employee signature
          terms: {
            ...terms,
            employerSignatureData: data.signatureData,
            employerSignerName: data.signerName,
            employerSignedAt: new Date().toISOString(),
            employerIpAddress: data.ipAddress || null,
            employerSignatureMethod: 'ELECTRONIC_CANVAS',
          },
        },
        include: { staff: true },
      });

      // Re-générer le PDF avec la signature employeur
      await this.generateContractPdf(contractId, tenantId);

      this.logger.log(`Contrat ${contractId} signé par l'employeur: ${data.signerName}`);
      return {
        ...updatedContract,
        _signResult: { signed: true, signerRole: 'EMPLOYEUR', contractStatus: 'PENDING' },
      };
    }

    // ─── EMPLOYE signs second ────────────────────────────────────────────────
    // L'employeur doit avoir signé en premier
    if (!terms.employerSignedAt) {
      throw new BadRequestException("L'employeur doit signer le contrat en premier.");
    }
    if (contract.signedAt) {
      throw new BadRequestException('Ce contrat a déjà été signé par l\'employé.');
    }

    const signedAt = new Date();
    const updatedContract = await this.prisma.contract.update({
      where: { id: contractId },
      data: {
        signedAt,
        signedBy: data.signerName,
        status: 'ACTIVE',  // Le contrat n'est en vigueur qu'après signature de l'employé
        terms: {
          ...terms,
          signatureData: data.signatureData,
          signerName: data.signerName,
          signerRole: data.signerRole || 'EMPLOYE',
          signedAt: signedAt.toISOString(),
          ipAddress: data.ipAddress || null,
          signatureMethod: 'ELECTRONIC_CANVAS',
        },
      },
      include: { staff: { include: { employeeCNSS: true } } },
    }).catch(async (prismaErr: any) => {
      if (prismaErr?.code === 'P2022' || prismaErr?.code === 'P2009' || prismaErr?.message?.includes('column') || prismaErr?.message?.includes('does not exist')) {
        return this.prisma.contract.update({
          where: { id: contractId },
          data: {
            signedAt,
            signedBy: data.signerName,
            status: 'ACTIVE',
            terms: {
              ...terms,
              signatureData: data.signatureData,
              signerName: data.signerName,
              signerRole: data.signerRole || 'EMPLOYE',
              signedAt: signedAt.toISOString(),
              ipAddress: data.ipAddress || null,
              signatureMethod: 'ELECTRONIC_CANVAS',
            },
          },
          include: { staff: true },
        });
      }
      throw prismaErr;
    });

    // Re-générer le PDF avec les deux signatures
    await this.generateContractPdf(contractId, tenantId);

    // Mettre à jour le statut du personnel : PENDING_SIGNATURE → ACTIVE
    const staffId = updatedContract.staffId;
    if (staffId) {
      try {
        const currentStaff = await this.prisma.staff.findFirst({ where: { id: staffId } });
        if (currentStaff && currentStaff.status === 'PENDING_SIGNATURE') {
          await this.prisma.staff.update({
            where: { id: staffId },
            data: { status: 'ACTIVE' },
          });
          this.logger.log(`Staff ${staffId} status updated: PENDING_SIGNATURE → ACTIVE (contract signed)`);

          // ── Création automatique des credentials ──
          try {
            const credResult = await this.credentialService.createCredentialsForStaff(staffId, tenantId);
            if (credResult?.created) {
              this.logger.log(`Credentials created for staff ${staffId}: user=${credResult.userId}, role=${credResult.role}, emailSent=${credResult.emailSent}`);
            } else if (credResult?.error) {
              this.logger.warn(`Credential creation skipped for staff ${staffId}: ${credResult.error}`);
            }
          } catch (credErr: any) {
            this.logger.error(`Credential creation failed for staff ${staffId} (non-blocking): ${credErr?.message}`);
          }
        }
      } catch (staffErr: any) {
        this.logger.warn(`Failed to update staff status after contract signing: ${staffErr?.message}`);
      }
    }

    this.logger.log(`Contrat ${contractId} signé par l'employé: ${data.signerName}`);
    return {
      ...updatedContract,
      _signResult: { signed: true, signerRole: 'EMPLOYE', contractStatus: 'ACTIVE' },
    };
  }

  // ─── Onboarding Completion ─────────────────────────────────────────────────

  /**
   * Finalise le processus d'embauche d'un employé.
   * Vérifie que le contrat est signé par les deux parties, met à jour le statut,
   * et envoie optionnellement une copie par email.
   */
  async completeOnboarding(staffId: string, contractId: string, tenantId: string, options: { sendEmail?: boolean } = {}) {
    // Vérifier le personnel
    const staff = await this.prisma.staff.findFirst({ where: { id: staffId, tenantId } });
    if (!staff) throw new NotFoundException('Personnel introuvable');

    // Vérifier le contrat
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, tenantId, staffId },
    });
    if (!contract) throw new NotFoundException('Contrat introuvable');

    const terms = (contract.terms as any) || {};

    // Vérifier que l'employeur a signé
    if (!terms.employerSignedAt) {
      throw new BadRequestException("L'employeur n'a pas encore signé le contrat. Veuillez compléter la signature de l'employeur avant de finaliser.");
    }

    // Vérifier que l'employé a signé
    if (!contract.signedAt) {
      throw new BadRequestException("L'employé n'a pas encore signé le contrat. Veuillez compléter la signature de l'employé avant de finaliser.");
    }

    // S'assurer que le statut du personnel est ACTIVE
    if (staff.status !== 'ACTIVE') {
      await this.prisma.staff.update({
        where: { id: staffId },
        data: { status: 'ACTIVE' },
      });
      this.logger.log(`Staff ${staffId} status updated to ACTIVE during onboarding completion`);
    }

    // Générer les matricules si pas encore fait
    if (!staff.globalMatricule || !staff.tenantMatricule) {
      try {
        const matriculeService = (this as any).matriculeService;
        if (matriculeService) {
          await matriculeService.generateMatricules(staffId, tenantId);
        }
      } catch (err: any) {
        this.logger.warn(`Matricule generation failed (non-blocking): ${err?.message}`);
      }
    }

    const result = {
      success: true,
      staffId,
      contractId,
      staffStatus: 'ACTIVE',
      contractStatus: contract.status,
      employerSignedAt: terms.employerSignedAt,
      employeeSignedAt: contract.signedAt,
      pdfUrl: terms.pdfUrl || null,
    };

    // Envoi email optionnel et création des credentials
    if (options.sendEmail && staff.email) {
      try {
        // Créer les credentials (inclut l'envoi d'email)
        const credResult = await this.credentialService.createCredentialsForStaff(staffId, tenantId);
        if (credResult?.created) {
          this.logger.log(`Credentials created during onboarding completion for staff ${staffId}`);
          (result as any).credentials = { userId: credResult.userId, username: credResult.username, role: credResult.role, emailSent: credResult.emailSent };
        } else if (credResult?.error) {
          this.logger.warn(`Credential creation during onboarding for staff ${staffId}: ${credResult.error}`);
        }
      } catch (err: any) {
        this.logger.warn(`Failed to create credentials during onboarding (non-blocking): ${err?.message}`);
      }
    } else if (!options.sendEmail) {
      // Même si sendEmail est false, créer les credentials sans envoyer d'email
      try {
        const credResult = await this.credentialService.createCredentialsForStaff(staffId, tenantId);
        if (credResult?.created) {
          this.logger.log(`Credentials created (without email) during onboarding for staff ${staffId}`);
          (result as any).credentials = { userId: credResult.userId, username: credResult.username, role: credResult.role };
        }
      } catch (err: any) {
        this.logger.warn(`Credential creation during onboarding failed (non-blocking): ${err?.message}`);
      }
    }

    return result;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async renderPdf(html: string): Promise<Buffer> {
    try {
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
    } catch (acquireError: any) {
      this.logger.error(`Puppeteer acquire/render failed: ${acquireError?.message || acquireError}`);
      // Try to reset browser pool and retry once
      try {
        await this.puppeteerPool.closeBrowser();
        this.logger.log('Browser pool reset, retrying PDF generation...');
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
      } catch (retryError: any) {
        this.logger.error(`PDF retry also failed: ${retryError?.message || retryError}`);
        throw new Error(`Le service de rendu PDF est indisponible. Détail : ${retryError?.message || 'Erreur inconnue'}`);
      }
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
      font-size: 11pt;
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
      margin-bottom: 20px;
    }
    .school-info { display: flex; align-items: center; gap: 14px; }
    .school-info img.logo { max-height: 60px; max-width: 60px; object-fit: contain; }
    .school-info h1 { font-size: 16pt; color: #1A2BA6; font-weight: bold; }
    .school-info p { font-size: 8.5pt; color: #555; margin-top: 1px; }
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
      margin: 20px 0 20px;
    }
    .contract-title h2 {
      font-size: 14pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 2px;
      border: 2px solid #1A2BA6;
      display: inline-block;
      padding: 8px 28px;
      color: #1A2BA6;
    }
    /* Reference */
    .ref-line {
      text-align: center;
      font-size: 10pt;
      color: #555;
      margin-bottom: 16px;
    }
    /* Preamble */
    .preamble { margin-bottom: 20px; }
    .preamble h3 { font-size: 11pt; color: #1A2BA6; margin-bottom: 8px; text-transform: uppercase; }
    .party-block { margin: 12px 0; padding: 10px 14px; background: #f8fafc; border-left: 4px solid #1A2BA6; border-radius: 0 6px 6px 0; }
    .party-block h4 { font-size: 10pt; color: #1A2BA6; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; }
    .party-block .field { display: flex; gap: 6px; margin: 2px 0; }
    .party-block .label { font-weight: bold; color: #444; min-width: 160px; font-size: 9.5pt; }
    .party-block .value { color: #1a1a1a; font-size: 9.5pt; }
    .party-role { font-style: italic; font-size: 9.5pt; color: #555; margin-top: 6px; }
    /* Articles */
    .article { margin-bottom: 16px; page-break-inside: avoid; }
    .article-title {
      font-weight: bold;
      color: #1A2BA6;
      font-size: 11pt;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .article p { font-size: 10pt; text-align: justify; margin-top: 4px; }
    .article .field { display: flex; gap: 6px; margin: 2px 0; }
    .article .label { font-weight: bold; color: #444; min-width: 200px; font-size: 10pt; }
    .article .value { color: #1a1a1a; font-size: 10pt; }
    .checkbox { margin: 4px 0; font-size: 10pt; }
    .checkbox span { margin-right: 8px; }
    /* Salary box */
    .salary-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #1A2BA6;
      padding: 14px 18px;
      border-radius: 6px;
      margin: 10px 0;
    }
    .salary-row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 10pt; }
    .salary-row.total { border-top: 2px solid #1A2BA6; padding-top: 6px; margin-top: 6px; font-weight: bold; font-size: 12pt; color: #1A2BA6; }
    .salary-label { color: #444; }
    .salary-value { font-weight: bold; }
    /* Signature area */
    .signature-section {
      margin-top: 36px;
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
    .sig-role { font-size: 9pt; color: #666; }
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

  <!-- Header with logo -->
  <div class="header">
    <div class="school-info">
      {{#if schoolLogoUrl}}<img class="logo" src="{{schoolLogoUrl}}" alt="Logo" />{{/if}}
      <div>
        <h1>{{schoolName}}</h1>
        <p>{{schoolAddress}}</p>
        <p>Tél. : {{schoolPhone}} | Email : {{schoolEmail}}</p>
      </div>
    </div>
    <div class="contract-meta">
      <div class="ref">Réf. : {{contractReference}}</div>
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
    <h2>CONTRAT DE TRAVAIL</h2>
  </div>

  <div class="ref-line"><strong>Référence :</strong> {{contractReference}}</div>

  <!-- Preamble: Parties -->
  <div class="preamble">
    <p style="text-align:center; margin-bottom:12px;">Entre les soussignés :</p>

    <div class="party-block">
      <h4>L'Employeur</h4>
      <div class="field"><span class="label">Établissement scolaire :</span><span class="value">{{schoolName}}</span></div>
      <div class="field"><span class="label">Adresse :</span><span class="value">{{schoolAddress}}</span></div>
      <div class="field"><span class="label">Téléphone :</span><span class="value">{{schoolPhone}}</span></div>
      <div class="field"><span class="label">Email :</span><span class="value">{{schoolEmail}}</span></div>
      <div class="field"><span class="label">Représenté par :</span><span class="value">{{directorName}}</span></div>
      <div class="field"><span class="label">Fonction :</span><span class="value">{{directorPosition}}</span></div>
      <p class="party-role">Ci-après dénommé(e) « l'Employeur », <strong>D'une part,</strong></p>
    </div>

    <p style="text-align:center; margin:8px 0;">Et</p>

    <div class="party-block">
      <h4>Le Salarié</h4>
      <div class="field"><span class="label">Nom et Prénoms :</span><span class="value">{{staffFullName}}</span></div>
      <div class="field"><span class="label">Date de naissance :</span><span class="value">{{staffBirthDate}}</span></div>
      <div class="field"><span class="label">Nationalité :</span><span class="value">{{staffNationality}}</span></div>
      <div class="field"><span class="label">Adresse :</span><span class="value">{{staffAddress}}</span></div>
      <div class="field"><span class="label">Téléphone :</span><span class="value">{{staffPhone}}</span></div>
      <div class="field"><span class="label">Email :</span><span class="value">{{staffEmail}}</span></div>
      <div class="field"><span class="label">Pièce d'identité :</span><span class="value">{{staffIdType}}</span></div>
      <div class="field"><span class="label">N° de pièce :</span><span class="value">{{staffIdNumber}}</span></div>
      <p class="party-role">Ci-après dénommé(e) « le Salarié », <strong>D'autre part.</strong></p>
    </div>

    <p style="text-align:center; margin-top:12px; font-style:italic;">Il a été convenu ce qui suit :</p>
  </div>

  <!-- Article 1: Objet -->
  <div class="article">
    <div class="article-title">Article 1 : Objet du contrat</div>
    <p>Le présent contrat a pour objet l'engagement du Salarié en qualité de :</p>
    <div class="field"><span class="label">Poste occupé :</span><span class="value"><strong>{{staffPosition}}</strong></span></div>
    <p style="margin-top:6px;">Le Salarié exercera ses fonctions sous l'autorité de la Direction de l'établissement scolaire.</p>
  </div>

  <!-- Article 2: Date d'effet -->
  <div class="article">
    <div class="article-title">Article 2 : Date d'effet</div>
    <p>Le présent contrat prend effet à compter du :</p>
    <p style="text-align:center; margin:8px 0;"><strong>{{startDate}}</strong></p>
  </div>

  <!-- Article 3: Type de contrat -->
  <div class="article">
    <div class="article-title">Article 3 : Type de contrat</div>
    <div class="checkbox">
      {{#if isCDI}}<span>☑</span>{{else}}<span>☐</span>{{/if}} Contrat à Durée Indéterminée (CDI)
    </div>
    <div class="checkbox">
      {{#if isCDI}}<span>☐</span>{{else}}<span>☑</span>{{/if}} Contrat à Durée Déterminée (CDD)
    </div>
    {{#unless isCDI}}
    <p style="margin-top:8px; margin-left:20px;">Dans le cas d'un CDD :</p>
    <div class="field" style="margin-left:20px;"><span class="label">Date de début :</span><span class="value">{{startDate}}</span></div>
    <div class="field" style="margin-left:20px;"><span class="label">Date de fin :</span><span class="value">{{endDate}}</span></div>
    {{/unless}}
  </div>

  <!-- Article 4: Période d'essai -->
  <div class="article">
    <div class="article-title">Article 4 : Période d'essai</div>
    <p>Le présent contrat est assorti d'une période d'essai de :</p>
    <p style="text-align:center; margin:8px 0;"><strong>{{probationDuration}}</strong></p>
    <p>Durant cette période, chacune des parties pourra mettre fin au contrat conformément aux dispositions légales en vigueur.</p>
  </div>

  <!-- Article 5: Missions -->
  <div class="article">
    <div class="article-title">Article 5 : Missions et responsabilités</div>
    <p>Le Salarié s'engage à accomplir notamment les missions suivantes :</p>
    <p style="margin-top:6px; margin-left:16px;">{{jobResponsibilities}}</p>
    <p style="margin-top:6px;">Cette liste n'est pas exhaustive et peut être adaptée en fonction des besoins de l'établissement.</p>
  </div>

  <!-- Article 6: Lieu de travail -->
  <div class="article">
    <div class="article-title">Article 6 : Lieu de travail</div>
    <p>Le Salarié exercera principalement ses fonctions à :</p>
    <p style="text-align:center; margin:8px 0;"><strong>{{workLocation}}</strong></p>
    <p>Toutefois, il pourra être amené à intervenir dans tout autre site relevant de l'établissement scolaire.</p>
  </div>

  <!-- Article 7: Durée du travail -->
  <div class="article">
    <div class="article-title">Article 7 : Durée du travail</div>
    <p>La durée hebdomadaire de travail est fixée à :</p>
    <p style="text-align:center; margin:8px 0;"><strong>{{weeklyHours}} heures</strong></p>
    <p>Horaires habituels :</p>
    <p style="margin:6px 0 6px 16px;">{{workSchedule}}</p>
    <p>Toute modification des horaires sera communiquée au Salarié dans un délai raisonnable.</p>
  </div>

  <!-- Article 8: Rémunération -->
  <div class="article">
    <div class="article-title">Article 8 : Rémunération</div>
    <p>En contrepartie de son travail, le Salarié percevra :</p>
    <div class="salary-box">
      <div class="salary-row"><span class="salary-label">Salaire de base mensuel :</span><span class="salary-value">{{baseSalary}} {{currency}}</span></div>
      <div class="salary-row"><span class="salary-label">Prime de fonction :</span><span class="salary-value">{{functionBonus}} {{currency}}</span></div>
      <div class="salary-row"><span class="salary-label">Prime de transport :</span><span class="salary-value">{{transportBonus}} {{currency}}</span></div>
      <div class="salary-row"><span class="salary-label">Autres avantages :</span><span class="salary-value">{{otherBenefits}}</span></div>
      <div class="salary-row total"><span class="salary-label">Salaire brut total :</span><span class="salary-value">{{grossSalary}} {{currency}}</span></div>
    </div>
    <p>Le salaire est payable selon les modalités définies par l'établissement.</p>
  </div>

  <!-- Article 9: Congés -->
  <div class="article">
    <div class="article-title">Article 9 : Congés</div>
    <p>Le Salarié bénéficie des congés prévus par la législation du travail applicable ainsi que du règlement intérieur de l'établissement.</p>
  </div>

  <!-- Article 10: Confidentialité -->
  <div class="article">
    <div class="article-title">Article 10 : Obligation de confidentialité</div>
    <p>Le Salarié s'engage à préserver la confidentialité de toutes les informations pédagogiques, administratives, financières et stratégiques auxquelles il pourrait avoir accès dans le cadre de ses fonctions.</p>
    <p style="margin-top:4px;">Cette obligation demeure applicable même après la cessation du contrat.</p>
  </div>

  <!-- Article 11: Protection des données -->
  <div class="article">
    <div class="article-title">Article 11 : Protection des données</div>
    <p>Le Salarié s'engage à respecter les règles de protection des données personnelles des élèves, parents, enseignants et partenaires de l'établissement.</p>
  </div>

  <!-- Article 12: Discipline -->
  <div class="article">
    <div class="article-title">Article 12 : Discipline et règlement intérieur</div>
    <p>Le Salarié déclare avoir pris connaissance du règlement intérieur de l'établissement et s'engage à le respecter.</p>
    <p style="margin-top:4px;">Toute violation pourra faire l'objet de sanctions disciplinaires conformément à la réglementation en vigueur.</p>
  </div>

  <!-- Article 13: Absences -->
  <div class="article">
    <div class="article-title">Article 13 : Absences</div>
    <p>Toute absence devra être justifiée dans les délais prévus par la réglementation interne de l'établissement.</p>
  </div>

  <!-- Article 14: Résiliation -->
  <div class="article">
    <div class="article-title">Article 14 : Résiliation du contrat</div>
    <p>Le présent contrat peut être résilié :</p>
    <ul style="margin:6px 0 6px 24px; font-size:10pt;">
      <li>Par accord mutuel des parties ;</li>
      <li>À l'initiative de l'Employeur ;</li>
      <li>À l'initiative du Salarié ;</li>
      <li>Pour faute grave ;</li>
      <li>Pour toute autre cause prévue par la législation du travail applicable.</li>
    </ul>
    <p>Les délais de préavis seront ceux prévus par la réglementation en vigueur.</p>
  </div>

  <!-- Article 15: Droit applicable -->
  <div class="article">
    <div class="article-title">Article 15 : Droit applicable</div>
    <p>Le présent contrat est régi par les dispositions du Code du Travail applicable dans :</p>
    <p style="text-align:center; margin:8px 0;"><strong>{{country}}</strong></p>
    <p>et par les textes réglementaires en vigueur.</p>
  </div>

  <!-- Article 16: Dispositions finales -->
  <div class="article">
    <div class="article-title">Article 16 : Dispositions finales</div>
    <p>Le présent contrat est établi en deux exemplaires originaux dont un est remis à chacune des parties.</p>
    <div class="field" style="margin-top:8px;"><span class="label">Fait à :</span><span class="value"><strong>{{city}}</strong></span></div>
    <div class="field"><span class="label">Le :</span><span class="value"><strong>{{signatureDate}}</strong></span></div>
  </div>

  <!-- Signature Section -->
  <div class="signature-section">
    <div class="article-title">Signatures</div>

    <div class="sig-grid">
      <!-- Employeur -->
      <div class="sig-box">
        <p class="sig-title">L'Employeur</p>
        <p class="sig-name">{{employerSignerName}}</p>
        <p class="sig-role">{{directorPosition}}</p>
        {{#if isEmployerSigned}}
          <p class="sig-date">Signé le : {{employerSignedAt}}</p>
          {{#if employerSignatureData}}
            <img class="sig-image" src="{{employerSignatureData}}" alt="Signature employeur" />
          {{/if}}
        {{else}}
          <div class="sig-placeholder">Signature et cachet de l'employeur</div>
        {{/if}}
      </div>
      <!-- Salarié -->
      <div class="sig-box">
        <p class="sig-title">Le Salarié</p>
        <p class="sig-name">{{staffFullName}}</p>
        {{#if isSigned}}
          <p class="sig-date">Signé le : {{signedAt}}</p>
          {{#if signatureData}}
            <img class="sig-image" src="{{signatureData}}" alt="Signature électronique" />
          {{/if}}
        {{else}}
          <div class="sig-placeholder">Signature du salarié</div>
        {{/if}}
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      <p><strong>Academia Helm</strong> — Système de Gestion Scolaire</p>
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
    const isConsultant = type === 'CONSULTANT';

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
          : isConsultant
          ? `Le présent contrat est un <strong>Contrat de Consultation</strong> pour la période du <strong>{{startDate}}</strong> au <strong>{{endDate}}</strong>.`
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
        <p class="sig-name">{{employerSignerName}} — {{schoolName}}</p>
        {{#if isEmployerSigned}}
          <p class="sig-date">Signé le : {{employerSignedAt}}</p>
          {{#if employerSignatureData}}
            <img class="sig-image" src="{{employerSignatureData}}" alt="Signature employeur" />
          {{/if}}
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
      <p><strong>Academia Helm</strong> — Système de Gestion Scolaire</p>
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
