/**
 * ============================================================================
 * Termination Document PDF Service
 * ============================================================================
 * Generates professional termination documents:
 * - Lettre de débauche (dismissal/resignation letter)
 * - Certificat de travail (certificate of employment)
 * - Reçu pour solde de tout compte (final settlement receipt)
 * - Attestation d'employeur (employer attestation)
 * 
 * Reuses the same pattern as ContractPdfService:
 * Handlebars templates + Puppeteer PDF rendering
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PuppeteerPoolService } from '../../common/services/puppeteer-pool.service';
import { StorageService } from '../../common/services/storage.service';
import * as Handlebars from 'handlebars';

@Injectable()
export class TerminationPdfService {
  private readonly logger = new Logger(TerminationPdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly storageService: StorageService,
  ) {}

  // ─── Document Generation ─────────────────────────────────────────────────

  /**
   * Generates a termination letter PDF (lettre de débauche).
   * This is the main document that formalizes the employment termination.
   */
  async generateTerminationLetterPdf(staffId: string, tenantId: string): Promise<string> {
    const data = await this.loadTerminationData(staffId, tenantId);
    const html = this.buildTerminationLetterHtml(data);
    return this.renderAndSavePdf(html, tenantId, staffId, 'termination-letter');
  }

  /**
   * Generates a certificate of employment PDF (certificat de travail).
   * Mandatory document that must be provided to the employee upon departure.
   */
  async generateEmploymentCertificatePdf(staffId: string, tenantId: string): Promise<string> {
    const data = await this.loadTerminationData(staffId, tenantId);
    const html = this.buildEmploymentCertificateHtml(data);
    return this.renderAndSavePdf(html, tenantId, staffId, 'employment-certificate');
  }

  /**
   * Generates a final settlement receipt PDF (reçu pour solde de tout compte).
   * Legal document acknowledging the final financial settlement.
   */
  async generateSettlementReceiptPdf(staffId: string, tenantId: string): Promise<string> {
    const data = await this.loadTerminationData(staffId, tenantId);
    const html = this.buildSettlementReceiptHtml(data);
    return this.renderAndSavePdf(html, tenantId, staffId, 'settlement-receipt');
  }

  /**
   * Generates an employer attestation PDF (attestation d'employeur).
   * Document certifying the employment relationship for third parties (CNSS, banks, etc.).
   */
  async generateEmployerAttestationPdf(staffId: string, tenantId: string): Promise<string> {
    const data = await this.loadTerminationData(staffId, tenantId);
    const html = this.buildEmployerAttestationHtml(data);
    return this.renderAndSavePdf(html, tenantId, staffId, 'employer-attestation');
  }

  // ─── Preview HTML ─────────────────────────────────────────────────────────

  /**
   * Returns the HTML preview for a termination document type.
   */
  async previewTerminationDocument(
    staffId: string,
    tenantId: string,
    documentType: 'letter' | 'certificate' | 'settlement' | 'attestation',
  ): Promise<string> {
    const data = await this.loadTerminationData(staffId, tenantId);
    switch (documentType) {
      case 'letter':
        return this.buildTerminationLetterHtml(data);
      case 'certificate':
        return this.buildEmploymentCertificateHtml(data);
      case 'settlement':
        return this.buildSettlementReceiptHtml(data);
      case 'attestation':
        return this.buildEmployerAttestationHtml(data);
      default:
        throw new NotFoundException(`Type de document inconnu: ${documentType}`);
    }
  }

  // ─── Data Loading ─────────────────────────────────────────────────────────

  private async loadTerminationData(staffId: string, tenantId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId },
      include: {
        contracts: { where: { status: { in: ['ACTIVE', 'TERMINATED'] } }, orderBy: { startDate: 'desc' }, take: 1 },
      },
    });
    if (!staff) throw new NotFoundException('Personnel introuvable');

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      include: { country: true, schools: true },
    });

    const schoolSettings = await this.prisma.schoolSettings.findFirst({ where: { tenantId } });
    const identityProfile = await this.prisma.tenantIdentityProfile.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { version: 'desc' },
    });
    const school = tenant?.schools || await this.prisma.school.findFirst({ where: { tenantId } });

    const schoolName = schoolSettings?.schoolName || identityProfile?.schoolName || school?.name || tenant?.name || "L'École";
    const schoolAddress = schoolSettings?.address || identityProfile?.address || school?.address || '';
    const schoolPhone = schoolSettings?.phone || identityProfile?.phonePrimary || school?.primaryPhone || '';
    const schoolEmail = schoolSettings?.email || identityProfile?.email || school?.primaryEmail || '';
    const schoolCity = schoolSettings?.city || identityProfile?.city || '';
    const schoolCountry = schoolSettings?.country || identityProfile?.country || tenant?.country?.name || '';
    const directorName = school?.directorPrimary || schoolSettings?.abbreviation || identityProfile?.schoolAcronym || 'Le Directeur';
    const schoolAuthorizationNumber = schoolSettings?.authorizationNumber || identityProfile?.authorizationNumber || '';

    const contract = staff.contracts?.[0];
    const details = (staff.terminationDetails as any) || {};
    const currency = tenant?.country?.currencyCode || schoolSettings?.currency || 'XOF';

    const terminationTypeLabels: Record<string, string> = {
      RESIGNATION: 'Démission',
      DISMISSAL: 'Licenciement',
      MUTUAL_AGREEMENT: 'Rupture conventionnelle',
      END_OF_CONTRACT: 'Fin de contrat',
      RETIREMENT: 'Retraite',
      DEATH: 'Décès',
      ABANDONMENT: 'Abandon de poste',
      OTHER: 'Autre motif',
    };

    return {
      staff,
      contract,
      schoolName,
      schoolAddress,
      schoolPhone,
      schoolEmail,
      schoolCity,
      schoolCountry,
      directorName,
      schoolAuthorizationNumber,
      terminationType: staff.terminationType,
      terminationTypeLabel: terminationTypeLabels[staff.terminationType || ''] || staff.terminationType || 'Non spécifié',
      terminationReason: details.reason || details.detailedReason || '',
      terminatedAt: staff.terminatedAt ? new Date(staff.terminatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '',
      lastWorkingDate: staff.lastWorkingDate ? new Date(staff.lastWorkingDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '',
      noticePeriodDays: staff.noticePeriodDays,
      hireDate: staff.hireDate ? new Date(staff.hireDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '',
      contractStartDate: contract?.startDate ? new Date(contract.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '',
      contractEndDate: contract?.endDate ? new Date(contract.endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '',
      contractType: contract?.contractType || '',
      contractTypeLabel: { CDI: 'Contrat à Durée Indéterminée', CDD: 'Contrat à Durée Déterminée', VACATAIRE: 'Contrat de Vacation', STAGE: 'Convention de Stage' }[contract?.contractType || ''] || contract?.contractType || '',
      position: staff.position || '',
      department: staff.department || '',
      employeeNumber: staff.employeeNumber || '',
      baseSalary: contract?.baseSalary ? Number(contract.baseSalary).toLocaleString('fr-FR') : '0',
      currency,
      exitInterviewConducted: details.exitInterviewConducted || false,
      equipmentReturned: details.equipmentReturned || false,
      exitDocumentsProvided: details.exitDocumentsProvided || false,
      finalSettlementPaid: details.finalSettlementPaid || false,
      authorizedBy: details.authorizedBy || '',
      terminationLetterRef: details.terminationLetterRef || '',
      employerSignatureData: details.employerSignatureData || null,
      employeeSignatureData: details.employeeSignatureData || null,
      employerSignedAt: details.employerSignedAt ? new Date(details.employerSignedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '',
      employeeSignedAt: details.employeeSignedAt ? new Date(details.employeeSignedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '',
      today: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
      civilite: staff.gender === 'FEMALE' ? 'Madame' : 'Monsieur',
      staffFullName: `${staff.firstName} ${staff.lastName}`,
      staffNationality: staff.nationality || '',
      staffBirthDate: staff.birthDate ? new Date(staff.birthDate).toLocaleDateString('fr-FR') : '',
      staffNationalId: staff.nationalId || '',
    };
  }

  // ─── HTML Templates ───────────────────────────────────────────────────────

  private buildTerminationLetterHtml(data: any): string {
    const template = Handlebars.compile(TERMINATION_LETTER_TEMPLATE);
    return template(data);
  }

  private buildEmploymentCertificateHtml(data: any): string {
    const template = Handlebars.compile(EMPLOYMENT_CERTIFICATE_TEMPLATE);
    return template(data);
  }

  private buildSettlementReceiptHtml(data: any): string {
    const template = Handlebars.compile(SETTLEMENT_RECEIPT_TEMPLATE);
    return template(data);
  }

  private buildEmployerAttestationHtml(data: any): string {
    const template = Handlebars.compile(EMPLOYER_ATTESTATION_TEMPLATE);
    return template(data);
  }

  // ─── PDF Rendering & Storage ──────────────────────────────────────────────

  private async renderAndSavePdf(html: string, tenantId: string, staffId: string, docType: string): Promise<string> {
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      });
      const pdfBuffer = Buffer.from(pdf);
      const storageKey = `termination-docs/${tenantId}/${staffId}-${docType}.pdf`;
      return this.storageService.uploadBuffer(pdfBuffer, storageKey, 'application/pdf');
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }
}

// ─── Termination Letter Template ──────────────────────────────────────────

const TERMIATION_LETTER_BASE_STYLE = `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>
  body { font-family: 'Noto Sans SC', 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; font-size: 11pt; line-height: 1.6; }
  .container { max-width: 700px; margin: 0 auto; padding: 10px 20px; }
  .header { text-align: center; border-bottom: 3px solid #0b2f73; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { color: #0b2f73; font-size: 14pt; margin: 0 0 4px; }
  .header p { color: #64748b; font-size: 9pt; margin: 2px 0; }
  .school-name { font-size: 13pt; font-weight: bold; color: #1d4fa5; }
  .date-block { text-align: right; margin-bottom: 20px; }
  .recipient { margin-bottom: 20px; }
  .subject { font-weight: bold; color: #0b2f73; margin: 16px 0; font-size: 11pt; }
  .body-text { text-align: justify; margin-bottom: 16px; }
  .sig-grid { display: flex; justify-content: space-between; margin-top: 40px; }
  .sig-box { width: 45%; text-align: center; }
  .sig-title { font-weight: bold; font-size: 10pt; color: #0b2f73; margin-bottom: 8px; }
  .sig-name { font-size: 10pt; color: #1e293b; margin-top: 4px; }
  .sig-image { max-height: 50px; margin-top: 4px; }
  .sig-placeholder { border-top: 1px solid #cbd5e1; margin: 30px 0 4px; padding-top: 4px; font-size: 9pt; color: #94a3b8; }
  .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 8px; text-align: center; font-size: 8pt; color: #94a3b8; }
  .gold-bar { height: 3px; background: linear-gradient(90deg, #0b2f73, #f5b335, #0b2f73); margin-bottom: 16px; }
</style></head><body>`;

const TERMINATION_LETTER_TEMPLATE = `${TERMIATION_LETTER_BASE_STYLE}
<div class="container">
  <div class="header">
    <p class="school-name">{{schoolName}}</p>
    <p>{{schoolAddress}}{{#if schoolCity}}, {{schoolCity}}{{/if}}</p>
    <p>Tél : {{schoolPhone}} | Email : {{schoolEmail}}</p>
    {{#if schoolAuthorizationNumber}}<p>N° Autorisation : {{schoolAuthorizationNumber}}</p>{{/if}}
  </div>
  <div class="gold-bar"></div>

  <div class="date-block">Fait à {{schoolCity}}, le {{today}}</div>

  <div class="recipient">
    <strong>{{civilite}} {{staffFullName}}</strong><br/>
    {{#if staff.position}}Poste : {{staff.position}}<br/>{{/if}}
    {{#if employeeNumber}}Matricule : {{employeeNumber}}<br/>{{/if}}
  </div>

  <div class="subject">Objet : Lettre de {{terminationTypeLabel}}</div>

  <div class="body-text">
    <p>{{civilite}},</p>
    <p>
      Par la présente, nous vous informons que votre emploi au sein de <strong>{{schoolName}}</strong>
      en qualité de <strong>{{position}}</strong> prend fin dans le cadre d'une <strong>{{terminationTypeLabel}}</strong>.
    </p>
    {{#if terminationReason}}
    <p>Motif : {{terminationReason}}</p>
    {{/if}}
    {{#if noticePeriodDays}}
    <p>Conformément aux dispositions contractuelles, un préavis de <strong>{{noticePeriodDays}} jour(s)</strong> est applicable.
    {{#if lastWorkingDate}}Votre dernier jour de travail sera le <strong>{{lastWorkingDate}}</strong>.{{/if}}</p>
    {{/if}}
    {{#if terminatedAt}}
    <p>La date d'effet de la fin de vos fonctions est fixée au <strong>{{terminatedAt}}</strong>.</p>
    {{/if}}
    <p>
      Nous vous prions de bien vouloir restituer l'ensemble du matériel et des documents appartenant à l'établissement
      avant votre départ, et de vous présenter au service des ressources humaines pour les formalités de sortie.
    </p>
    <p>
      Nous vous rappelons vos obligations de confidentialité et de non-concurrence telles que stipulées dans votre
      contrat de travail.
    </p>
    <p>Nous vous souhaitons plein succès dans vos futures entreprises.</p>
  </div>

  <div class="sig-grid">
    <div class="sig-box">
      <p class="sig-title">Pour l'Employeur</p>
      <p>{{directorName}}</p>
      {{#if employerSignatureData}}<img class="sig-image" src="{{employerSignatureData}}" alt="Signature employeur"/>{{/if}}
      {{#if employerSignedAt}}<p class="sig-name" style="font-size:8pt;">Signé le {{employerSignedAt}}</p>{{/if}}
      {{#unless employerSignatureData}}<div class="sig-placeholder">Signature & cachet</div>{{/unless}}
    </div>
    <div class="sig-box">
      <p class="sig-title">L'Employé(e)</p>
      <p>{{staffFullName}}</p>
      {{#if employeeSignatureData}}<img class="sig-image" src="{{employeeSignatureData}}" alt="Signature employé"/>{{/if}}
      {{#if employeeSignedAt}}<p class="sig-name" style="font-size:8pt;">Signé le {{employeeSignedAt}}</p>{{/if}}
      {{#unless employeeSignatureData}}<div class="sig-placeholder">Lu et approuvé</div>{{/unless}}
    </div>
  </div>

  <div class="footer">{{schoolName}} — Document généré par Academia Helm</div>
</div></body></html>`;

// ─── Employment Certificate Template ──────────────────────────────────────

const EMPLOYMENT_CERTIFICATE_TEMPLATE = `${TERMIATION_LETTER_BASE_STYLE}
<div class="container">
  <div class="header">
    <p class="school-name">{{schoolName}}</p>
    <p>{{schoolAddress}}{{#if schoolCity}}, {{schoolCity}}{{/if}}</p>
  </div>
  <div class="gold-bar"></div>

  <div class="date-block">Fait à {{schoolCity}}, le {{today}}</div>

  <div class="subject" style="text-align:center; font-size: 13pt; margin: 24px 0;">CERTIFICAT DE TRAVAIL</div>

  <div class="body-text">
    <p>
      Je soussigné(e), <strong>{{directorName}}</strong>, Directeur(rice) de l'établissement <strong>{{schoolName}}</strong>,
      certifie par la présente que :
    </p>
    <p style="margin-left: 24px;">
      <strong>{{civilite}} {{staffFullName}}</strong>{{#if staffBirthDate}}, né(e) le {{staffBirthDate}}{{/if}}{{#if staffNationality}}, de nationalité {{staffNationality}}{{/if}},
    </p>
    <p>
      a été employé(e) au sein de notre établissement en qualité de <strong>{{position}}</strong>
      au département <strong>{{department}}</strong> du <strong>{{hireDate}}</strong>
      au <strong>{{terminatedAt}}</strong>{{#if contractTypeLabel}} sous un {{contractTypeLabel}}{{/if}}.
    </p>
    <p>
      Le départ de l'intéressé(e) fait suite à une <strong>{{terminationTypeLabel}}</strong>.
    </p>
    <p>
      En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit.
    </p>
  </div>

  <div class="sig-grid">
    <div class="sig-box" style="width:100%; text-align: right;">
      <p class="sig-title">Pour l'Employeur</p>
      <p>{{directorName}}</p>
      {{#if employerSignatureData}}<img class="sig-image" src="{{employerSignatureData}}" alt="Signature employeur"/>{{/if}}
      {{#unless employerSignatureData}}<div class="sig-placeholder" style="width:200px; margin-left:auto;">Signature & cachet</div>{{/unless}}
    </div>
  </div>

  <div class="footer">{{schoolName}} — Certificat de travail — Document généré par Academia Helm</div>
</div></body></html>`;

// ─── Settlement Receipt Template ──────────────────────────────────────────

const SETTLEMENT_RECEIPT_TEMPLATE = `${TERMIATION_LETTER_BASE_STYLE}
<div class="container">
  <div class="header">
    <p class="school-name">{{schoolName}}</p>
    <p>{{schoolAddress}}{{#if schoolCity}}, {{schoolCity}}{{/if}}</p>
  </div>
  <div class="gold-bar"></div>

  <div class="date-block">Fait à {{schoolCity}}, le {{today}}</div>

  <div class="subject" style="text-align:center; font-size: 13pt; margin: 24px 0;">REÇU POUR SOLDE DE TOUT COMPTE</div>

  <div class="body-text">
    <p>
      Je soussigné(e), <strong>{{civilite}} {{staffFullName}}</strong>, reconnais avoir reçu de
      <strong>{{schoolName}}</strong> la somme correspondant à mon solde de tout compte, établi
      suite à la fin de mes fonctions en qualité de <strong>{{position}}</strong>
      ({{terminationTypeLabel}}) prenant effet le <strong>{{terminatedAt}}</strong>.
    </p>
    <p>
      Le présent reçu est établi en double exemplaire et libère <strong>{{schoolName}}</strong>
      de toute obligation financière à mon égard, à l'exception des droits qui seraient reconnus
      par décision de justice.
    </p>
    <p style="font-weight: bold; color: #0b2f73;">
      Le salarié dispose d'un délai de six (6) mois pour contester le solde de tout compte,
      conformément aux dispositions légales en vigueur.
    </p>
  </div>

  <div class="sig-grid">
    <div class="sig-box">
      <p class="sig-title">Pour l'Employeur</p>
      <p>{{directorName}}</p>
      {{#if employerSignatureData}}<img class="sig-image" src="{{employerSignatureData}}" alt="Signature employeur"/>{{/if}}
      {{#unless employerSignatureData}}<div class="sig-placeholder">Signature & cachet</div>{{/unless}}
    </div>
    <div class="sig-box">
      <p class="sig-title">L'Employé(e)</p>
      <p>{{staffFullName}}</p>
      {{#if employeeSignatureData}}<img class="sig-image" src="{{employeeSignatureData}}" alt="Signature employé"/>{{/if}}
      {{#unless employeeSignatureData}}<div class="sig-placeholder">Lu et approuvé</div>{{/unless}}
    </div>
  </div>

  <div class="footer">{{schoolName}} — Reçu pour solde de tout compte — Document généré par Academia Helm</div>
</div></body></html>`;

// ─── Employer Attestation Template ────────────────────────────────────────

const EMPLOYER_ATTESTATION_TEMPLATE = `${TERMIATION_LETTER_BASE_STYLE}
<div class="container">
  <div class="header">
    <p class="school-name">{{schoolName}}</p>
    <p>{{schoolAddress}}{{#if schoolCity}}, {{schoolCity}}{{/if}}</p>
  </div>
  <div class="gold-bar"></div>

  <div class="date-block">Fait à {{schoolCity}}, le {{today}}</div>

  <div class="subject" style="text-align:center; font-size: 13pt; margin: 24px 0;">ATTESTATION D'EMPLOYEUR</div>

  <div class="body-text">
    <p>
      Je soussigné(e), <strong>{{directorName}}</strong>, Directeur(rice) de l'établissement
      <strong>{{schoolName}}</strong>, atteste par la présente que :
    </p>
    <p style="margin-left: 24px;">
      <strong>{{civilite}} {{staffFullName}}</strong>{{#if staffBirthDate}}, né(e) le {{staffBirthDate}}{{/if}}{{#if staffNationalId}}, titulaire de la pièce d'identité N° {{staffNationalId}}{{/if}},
    </p>
    <p>
      a été employé(e) au sein de notre établissement du <strong>{{hireDate}}</strong>
      au <strong>{{terminatedAt}}</strong> en qualité de <strong>{{position}}</strong>.
    </p>
    <p>
      Cette attestation est délivrée à l'intéressé(e) pour faire valoir ce que de droit,
      notamment auprès des organismes de sécurité sociale et autres institutions compétentes.
    </p>
  </div>

  <div class="sig-grid">
    <div class="sig-box" style="width:100%; text-align: right;">
      <p class="sig-title">Le Directeur(rice)</p>
      <p>{{directorName}}</p>
      {{#if employerSignatureData}}<img class="sig-image" src="{{employerSignatureData}}" alt="Signature employeur"/>{{/if}}
      {{#unless employerSignatureData}}<div class="sig-placeholder" style="width:200px; margin-left:auto;">Signature & cachet</div>{{/unless}}
    </div>
  </div>

  <div class="footer">{{schoolName}} — Attestation d'employeur — Document généré par Academia Helm</div>
</div></body></html>`;
