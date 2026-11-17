/**
 * ============================================================================
 * PAYROLL DOCUMENTS SERVICE — Émission FP / EP (RH Bénin)
 * ============================================================================
 *
 * Couche DOCUMENTS du module de paie (au-dessus du moteur payroll-engine) :
 *
 *   FICHE_DE_PAIE    (FP-2026-000123) — salariés déclarés / non déclarés
 *   ETAT_DE_PAIEMENT (EP-2026-000045) — prestataires de services (AIB)
 *
 * Garanties structurelles :
 *   - Le type de document est TOUJOURS dérivé du statut contractuel
 *     (deriveDocumentPaieType) — jamais choisi par l'appelant.
 *   - Le document est un SNAPSHOT FIGÉ : les montants proviennent de la ligne
 *     de paie calculée (PayrollItem), le barème est celui en vigueur sur la
 *     période, et les cumuls annuels sont RECALCULÉS depuis les documents
 *     déjà émis (jamais stockés en incrément manuel).
 *   - IMMUABILITÉ : une ligne → au plus un document. Réémettre = 422.
 *     Le PDF est scellé par SHA-256 (contentHash) et archivé (StorageService
 *     R2/S3, repli /uploads local).
 *   - Numérotation séquentielle annuelle ATOMIQUE (UPSERT ... RETURNING sur
 *     payroll_document_sequences) — pas de doublon sous concurrence.
 *   - La prévisualisation passe par la MÊME construction de snapshot que
 *     l'émission (prévisu = émission, modulo numéro/hash/filigrane).
 * ============================================================================
 */

import {
  Injectable, Logger, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../database/prisma.service';
import { PuppeteerPoolService } from '../../common/services/puppeteer-pool.service';
import { StorageService } from '../../common/services/storage.service';
import { PayrollEngineService } from './payroll-engine.service';
import {
  deriveDocumentPaieType, CATEGORY_LABELS, categoryKeyFromRoleType,
} from './employment-contract-templates';
import {
  FichePaieSnapshot, EtatPaiementSnapshot, PayrollDocumentSnapshot,
  renderFicheDePaieHtml, renderEtatDePaiementHtml,
  monthLabel, joursOuvres, ancienneteLabel, computeConges, formatDocumentNumber,
  MENTION_FICHE_CONSERVATION, MENTION_ETAT_PAIEMENT,
} from './payroll-document-templates';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../../common/utils/prisma-helpers';

const BLANK = '…à compléter';

@Injectable()
export class PayrollDocumentsService {
  private readonly logger = new Logger(PayrollDocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly storageService: StorageService,
    private readonly payrollEngine: PayrollEngineService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // PRÉVISUALISATION (même construction que l'émission, sans numéro/hash)
  // ─────────────────────────────────────────────────────────────────────────

  async previewDocument(payrollItemId: string, tenantId: string) {
    const ctx = await this.loadContext(payrollItemId, tenantId);
    const snapshot = await this.buildSnapshot(ctx, { forIssue: false });
    const html =
      snapshot.kind === 'FICHE_DE_PAIE'
        ? renderFicheDePaieHtml(snapshot)
        : renderEtatDePaiementHtml(snapshot);
    return { snapshot, html, alreadyIssued: !!ctx.existingDocument };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ÉMISSION — immuable, numérotée, hachée, archivée
  // ─────────────────────────────────────────────────────────────────────────

  async issueDocument(payrollItemId: string, tenantId: string, user: any) {
    const ctx = await this.loadContext(payrollItemId, tenantId);

    if (ctx.existingDocument) {
      throw new ConflictException(
        `Un document de paie a déjà été émis pour cette ligne (${ctx.existingDocument.documentNumber}) — ` +
        `le document est immuable. Toute correction passe par un document rectificatif tracé.`,
      );
    }

    // 1. Allocation atomique du numéro (UPSERT RETURNING — pas de doublon sous concurrence)
    const documentType = ctx.documentType as 'FICHE_DE_PAIE' | 'ETAT_DE_PAIEMENT';
    const seq = await this.allocateSequence(tenantId, documentType, ctx.fiscalYear);
    const documentNumber = formatDocumentNumber(documentType, ctx.fiscalYear, seq);
    const issuedAt = new Date();

    // 2. Snapshot figé (avec numéro + émetteur)
    const snapshot = await this.buildSnapshot(ctx, {
      forIssue: true,
      documentNumber,
      issuedAt,
      issuedByName: user?.email || user?.fullName || user?.name || null,
    });

    // 3. Rendu PDF (Puppeteer — hors transaction DB, l'insertion reste atomique)
    const html =
      snapshot.kind === 'FICHE_DE_PAIE'
        ? renderFicheDePaieHtml(snapshot)
        : renderEtatDePaiementHtml(snapshot);
    const pdfBuffer = await this.renderPdf(html);
    const contentHash = createHash('sha256').update(pdfBuffer).digest('hex');

    // 4. Archivage (R2/S3, repli local)
    const filePath = await this.savePdf(tenantId, documentNumber, ctx, pdfBuffer);

    // 5. Insertion — contraintes uniques (payrollItemId, documentNumber) = verrous d'immuabilité
    try {
      const doc = await this.prisma.payrollDocument.create({
        data: {
          ...prismaCreateDefaults(),
          tenantId,
          academicYearId: ctx.item.academicYearId ?? null,
          staffId: ctx.staff.id,
          payrollItemId: ctx.item.id,
          documentType,
          documentNumber,
          periodYear: ctx.period.year,
          periodMonth: ctx.period.month,
          fiscalYear: ctx.fiscalYear,
          periodLabel: ctx.period.label,
          statutContractuel: ctx.statut,
          snapshot: snapshot as any,
          contentHash,
          filePath,
          issuedAt,
          issuedBy: user?.id ?? null,
          issuedByName: user?.email || user?.fullName || user?.name || null,
        },
      });
      this.logger.log(`📄 Document de paie émis : ${documentNumber} (${fmtHash(contentHash)})`);
      return { document: doc, pdfBase64: pdfBuffer.toString('base64'), contentHash };
    } catch (err: any) {
      // Collision d'unicité = émission concurrente de la même ligne
      if (err?.code === 'P2002') {
        throw new ConflictException(
          'Émission concurrente détectée : un document existe déjà pour cette ligne de paie.',
        );
      }
      // Nettoyage du fichier archivé si l'insertion échoue (pas de fichier orphelin)
      try {
        if (filePath && this.storageService.getStorageType() !== 'local') {
          await this.storageService.deleteFile(filePath);
        }
      } catch { /* best effort */ }
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REGISTRE & TÉLÉCHARGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  async listDocuments(
    tenantId: string,
    filters: { periodYear?: number; periodMonth?: number; documentType?: string; staffId?: string },
  ) {
    return this.prisma.payrollDocument.findMany({
      where: {
        tenantId,
        ...(filters.periodYear ? { periodYear: filters.periodYear } : {}),
        ...(filters.periodMonth ? { periodMonth: filters.periodMonth } : {}),
        ...(filters.documentType ? { documentType: filters.documentType } : {}),
        ...(filters.staffId ? { staffId: filters.staffId } : {}),
      },
      include: {
        staff: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true, position: true },
        },
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { documentNumber: 'desc' }],
    });
  }

  async getDocument(id: string, tenantId: string) {
    const doc = await this.prisma.payrollDocument.findFirst({
      where: { id, tenantId },
      include: {
        staff: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true, position: true },
        },
      },
    });
    if (!doc) throw new NotFoundException(`Document de paie ${id} introuvable.`);
    return doc;
  }

  /** PDF émis — fichier archivé tel quel (jamais régénéré) + contrôle du hash. */
  async downloadDocument(id: string, tenantId: string): Promise<{ buffer: Buffer; document: any }> {
    const doc = await this.getDocument(id, tenantId);
    if (!doc.filePath) {
      throw new NotFoundException('Aucun fichier PDF archivé pour ce document.');
    }
    const buffer = await this.readStoredPdf(doc.filePath);
    // Contrôle d'intégrité — le document scellé doit être intègre
    const actual = createHash('sha256').update(buffer).digest('hex');
    if (doc.contentHash && actual !== doc.contentHash) {
      this.logger.error(`Intégrité rompue sur ${doc.documentNumber} (attendu ${doc.contentHash}, obtenu ${actual})`);
      throw new BadRequestException(
        `Intégrité du document ${doc.documentNumber} compromise — le fichier archivé ne correspond plus à son sceau SHA-256.`,
      );
    }
    return { buffer, document: doc };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONSTRUCTION DU SNAPSHOT (prévisu = émission)
  // ─────────────────────────────────────────────────────────────────────────

  private async loadContext(payrollItemId: string, tenantId: string) {
    const item = await this.prisma.payrollItem.findFirst({
      where: { id: payrollItemId, tenantId },
      include: {
        staff: {
          include: {
            employeeCNSS: true,
            contracts: {
              where: { status: { in: ['ACTIVE', 'PENDING'] } },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
        payroll: { include: { tenant: { include: { country: true } } } },
        taxWithholdings: { where: { taxType: 'AIB' }, take: 1 },
        salarySlip: true,
        payrollDocument: true,
      },
    });
    if (!item) throw new NotFoundException(`Ligne de paie ${payrollItemId} introuvable.`);
    if (item.status === 'PENDING') {
      throw new BadRequestException(
        'La ligne de paie doit être calculée avant d\u2019émettre un document (bouton Calculer).',
      );
    }

    const staff: any = item.staff as any;
    const contract: any = staff?.contracts?.[0] ?? null;
    const statut = staff?.statutContractuel || contract?.statutContractuel || null;
    const documentType = deriveDocumentPaieType(statut);
    if (!statut || !documentType) {
      throw new BadRequestException(
        'Ce personnel n\u2019a pas de statut contractuel (salarié déclaré / non déclaré / prestataire). ' +
        'Le document de paie ne peut pas être déterminé — complétez le statut sur sa fiche.',
      );
    }

    const payroll: any = item.payroll;
    const periodStart = payroll?.startDate ? new Date(payroll.startDate) : new Date();
    const periodEnd = payroll?.endDate ? new Date(payroll.endDate) : periodStart;
    const period = {
      year: periodStart.getFullYear(),
      month: periodStart.getMonth() + 1,
      label: monthLabel(periodStart.getFullYear(), periodStart.getMonth() + 1),
      startDate: periodStart.toISOString(),
      endDate: periodEnd.toISOString(),
      joursOuvres: joursOuvres(periodStart.getFullYear(), periodStart.getMonth() + 1),
    };
    const fiscalYear = period.year;

    return { item, staff, contract, statut, documentType, payroll, period, fiscalYear, tenantId, existingDocument: (item as any).payrollDocument };
  }

  private async buildSnapshot(
    ctx: any,
    opts: { forIssue: boolean; documentNumber?: string; issuedAt?: Date; issuedByName?: string | null },
  ): Promise<PayrollDocumentSnapshot> {
    // ⭐ 17/11/2026 — FIX ReferenceError « tenantId is not defined » : le
    //    champ existe dans le contexte (retourné par loadContext) mais
    //    n'était pas déstructuré → TOUTES les prévisualisations/émissions
    //    FP/EP renvoyaient 500 depuis l'origine.
    const { item, staff, contract, statut, period, fiscalYear, tenantId } = ctx;
    const countryCode = ctx.payroll?.tenant?.country?.code || 'BJ';
    const rates = await this.payrollEngine.getFiscalRates(countryCode, new Date(period.endDate));
    if (!rates) {
      throw new BadRequestException(
        'Aucun barème fiscal disponible (payroll_fiscal_rates) — l\u2019émission est impossible. ' +
        'Créez d\u2019abord le barème de l\u2019exercice.',
      );
    }

    const employeur = await this.resolveEmployer(tenantId, contract);
    const cnssNumber = staff.employeeCNSS?.cnssNumber || staff.cnssNumber || null;
    const periodEnd = new Date(period.endDate);

    // Cumuls annuels : RECALCULÉS depuis les documents émis (jamais d'incrément stocké)
    const cumuls = await this.recalculateCumuls(staff.id, staff.tenantId, fiscalYear, item);

    if (ctx.documentType === 'ETAT_DE_PAIEMENT') {
      // ─── ÉTAT DE PAIEMENT (prestataire) : AIB uniquement, jamais une fiche ───
      const ifu = staff.ifuNumber || null;
      const brut = Number(item.grossSalary);
      const aib = Number(item.otherDeductions);
      const net = Number(item.netSalary);
      // Taux AIB DÉRIVÉ de l'IFU (jamais saisi) : trace fiscale d'abord, barème sinon
      const trace: any = (item as any).taxWithholdings?.[0];
      const tauxAib =
        trace?.ratePercentage != null
          ? Number(trace.ratePercentage)
          : ifu
            ? rates.aibAvecIfu
            : rates.aibSansIfu;

      const snapshot: EtatPaiementSnapshot = {
        kind: 'ETAT_DE_PAIEMENT',
        statutContractuel: 'PRESTATAIRE_SERVICE',
        documentNumber: opts.documentNumber ?? null,
        period,
        fiscalYear,
        employeur,
        prestataire: {
          nom: staff.lastName || BLANK,
          prenoms: staff.firstName || BLANK,
          ifu,
          contratReference: contract?.id ? `CT-${String(contract.id).slice(0, 8).toUpperCase()}` : null,
          description:
            (contract?.terms as any)?.prestation?.description ||
            (contract?.terms as any)?.description ||
            staff.position ||
            null,
          mode: staff.prestationPaymentMode || contract?.prestationPaymentMode || null,
          heures: null,
          tauxHoraire:
            (staff.prestationPaymentMode || contract?.prestationPaymentMode) === 'HORAIRE'
              ? Number(staff.prestationAmount ?? contract?.prestationAmount ?? 0)
              : null,
        },
        decompte: { brut, tauxAib, aib, net, indemnites: buildIndemnitesGains(item) },
        cumuls,
        rates: { fiscalYear: rates.fiscalYear, aibPct: tauxAib, sourceNotes: rates.sourceNotes },
        mention: MENTION_ETAT_PAIEMENT,
      };
      return snapshot;
    }

    // ─── FICHE DE PAIE (salarié déclaré / non déclaré) ───
    const cnssDeclare = statut === 'SALARIE_DECLARE';
    const brut = Number(item.grossSalary);
    const base = Number(item.baseSalary);
    const heuresSup = Number(item.overtimeAmount);
    // ⭐ 17/11/2026 — indemnités DÉTAILLÉES par type (figées dans la ligne de
    //    paie au calcul) : salaire réel = base + Σ indemnités + heures supp +
    //    primes. Lignes héritées sans détail → repli « Primes et indemnités »
    //    (résidu brut − base − heures sup), rendu inchangé.
    const indemnites = buildIndemnitesGains(item);
    const indemTotal = indemnites
      ? Math.round(indemnites.reduce((s: number, a: any) => s + a.amount, 0) * 100) / 100
      : 0;
    // Primes ponctuelles pures : complément du brut hors base/indemnités/heures supp
    const primes = indemnites
      ? Math.max(0, Math.round((brut - base - heuresSup - indemTotal) * 100) / 100)
      : Math.max(0, Math.round((brut - base - heuresSup) * 100) / 100);
    const retenues = {
      cnss: Number(item.cnssEmployee || 0),
      its: Number(item.irppAmount || 0),
      autres: Math.max(0, Number(item.otherDeductions || 0)),
      total: Number(item.totalDeductions || 0),
    };

    // Charges patronales : informatives, recalculées au barème de la période
    const chargesPatronales = cnssDeclare
      ? {
          prestationsFamiliales: round2((brut * rates.cnssPrestationsFamiliales) / 100),
          risquesProfessionnels: round2((brut * rates.cnssRisquesProMin) / 100),
          vieillesse: round2((brut * rates.cnssVieillesse) / 100),
          total: round2((brut * rates.cnssPatronalGlobal) / 100),
          informatif: true as const,
        }
      : null;

    // Congés payés : module Congés (congés annuels approuvés) + barème jours/mois
    const joursPris = await this.countApprovedAnnualLeaveDays(staff.id, staff.tenantId, period);
    const conges = computeConges({
      joursCongesParMois: rates.joursCongesParMois,
      hireDate: staff.hireDate || contract?.startDate || null,
      periodEnd,
      joursPris,
    });

    const snapshot: FichePaieSnapshot = {
      kind: 'FICHE_DE_PAIE',
      statutContractuel: statut,
      cnssDeclare,
      documentNumber: opts.documentNumber ?? null,
      period,
      fiscalYear,
      employeur,
      salarie: {
        matricule: staff.tenantMatricule || staff.employeeNumber || BLANK,
        nom: staff.lastName || BLANK,
        prenoms: staff.firstName || BLANK,
        poste: staff.position || staff.roleType || BLANK,
        categorie: CATEGORY_LABELS[categoryKeyFromRoleType(staff.roleType)] || staff.roleType || BLANK,
        cnssNumber: cnssDeclare ? cnssNumber : null,
        anciennete: ancienneteLabel(staff.hireDate || contract?.startDate || null, periodEnd),
        ancienneteDepuis: staff.hireDate || contract?.startDate || null,
        joursTravailles: period.joursOuvres,
      },
      gains: { base, heuresSup, primes, indemnites, brut },
      retenues,
      net: Number(item.netSalary),
      chargesPatronales,
      cumuls,
      conges,
      rates: { fiscalYear: rates.fiscalYear, cnssSalarialPct: rates.cnssSalarial, sourceNotes: rates.sourceNotes },
      mention: MENTION_FICHE_CONSERVATION,
    };
    return snapshot;
  }

  /** Cumuls annuels RECALCULÉS depuis les payroll_documents émis + la ligne courante. */
  private async recalculateCumuls(staffId: string, tenantId: string, fiscalYear: number, currentItem: any) {
    const previousDocs = await this.prisma.payrollDocument.findMany({
      where: { staffId, tenantId, fiscalYear },
      select: { snapshot: true },
    });
    const sum = (fn: (s: any) => number) =>
      previousDocs.reduce((acc, d) => acc + (fn(d.snapshot as any) || 0), 0);

    const prevBrut = sum((s) => (s.kind === 'FICHE_DE_PAIE' ? s.gains?.brut : s.decompte?.brut));
    const prevNet = sum((s) => (s.kind === 'FICHE_DE_PAIE' ? s.net : s.decompte?.net));
    const prevImpot = sum((s) =>
      s.kind === 'FICHE_DE_PAIE' ? s.retenues?.its : s.decompte?.aib,
    );
    const prevCnss = sum((s) => (s.kind === 'FICHE_DE_PAIE' ? s.retenues?.cnss : 0));

    const isFiche = currentItem
      ? deriveDocumentPaieType(currentItem.staff?.statutContractuel || (currentItem as any).statut) !== 'ETAT_DE_PAIEMENT'
      : true;
    const curBrut = Number(currentItem?.grossSalary ?? 0);
    const curNet = Number(currentItem?.netSalary ?? 0);
    const curImpot = Number(currentItem?.irppAmount ?? 0);
    const curCnss = Number(currentItem?.cnssEmployee ?? 0);
    // Pour un état de paiement, l'impôt du document = AIB (otherDeductions)
    const curDocImpot = isFiche ? curImpot : Number(currentItem?.otherDeductions ?? 0);

    return {
      brut: round2(prevBrut + curBrut),
      impot: round2(prevImpot + curDocImpot),
      cnss: round2(prevCnss + (isFiche ? curCnss : 0)),
      net: round2(prevNet + curNet),
      documents: previousDocs.length + 1,
    };
  }

  /** Congés annuels approuvés (module Congés) sur l'exercice, jusqu'à la fin de période. */
  private async countApprovedAnnualLeaveDays(staffId: string, tenantId: string, period: any): Promise<number> {
    try {
      const yearStart = new Date(period.year, 0, 1);
      const periodEnd = new Date(period.endDate);
      const leaves = await this.prisma.leaveRequest.findMany({
        where: {
          staffId,
          tenantId,
          type: 'ANNUAL',
          status: 'APPROVED',
          startDate: { gte: yearStart, lte: periodEnd },
        },
        select: { startDate: true, endDate: true },
      });
      return leaves.reduce((acc, l) => {
        const s = new Date(l.startDate);
        const e = new Date(l.endDate);
        const days = Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
        return acc + Math.max(0, days);
      }, 0);
    } catch (err: any) {
      this.logger.warn(`Congés indisponibles (${err?.message}) — pris = 0`);
      return 0;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // IDENTITÉ EMPLOYEUR (fiche R1 > SchoolSettings > IdentityProfile > School > Tenant)
  // ─────────────────────────────────────────────────────────────────────────

  private async resolveEmployer(tenantId: string, contract?: any): Promise<any> {
    const schoolSettings: any = await this.prisma.schoolSettings.findFirst({ where: { tenantId } }).catch(() => null);
    const identityProfile: any = await this.prisma.tenantIdentityProfile.findFirst({
      where: { tenantId, isActive: true }, orderBy: { version: 'desc' },
    }).catch(() => null);
    const school: any = await this.prisma.school.findFirst({ where: { tenantId } }).catch(() => null);
    const financialHeader: any = await this.prisma.financialReportHeader.findFirst({
      where: { tenantId }, orderBy: { updatedAt: 'desc' },
    }).catch(() => null);
    const tenant: any = await this.prisma.tenant.findUnique({ where: { id: tenantId } }).catch(() => null);
    const recruiter: any = await this.prisma.recruiterProfile.findFirst({ where: { tenantId } }).catch(() => null);

    const schoolName =
      schoolSettings?.schoolName || identityProfile?.schoolName || school?.name || tenant?.name || "L'École";
    const schoolAddress = schoolSettings?.address || identityProfile?.address || school?.address || BLANK;
    const schoolCity = schoolSettings?.city || identityProfile?.city || '';
    return {
      raisonSociale: financialHeader?.denominationSociale || schoolName,
      formeJuridique: financialHeader?.formeJuridique || null,
      rccm: financialHeader?.numeroRC || null,
      ifu: financialHeader?.numeroIF || null,
      cnss: financialHeader?.numeroCNSS || (financialHeader as any)?.cnssNumber || null,
      adresse: schoolAddress + (schoolCity ? `, ${schoolCity}` : ''),
      telephone: schoolSettings?.phone || identityProfile?.phonePrimary || school?.primaryPhone || null,
      email: schoolSettings?.email || identityProfile?.email || school?.primaryEmail || null,
      representant: contract?.terms?.employerSignerName || recruiter?.fullName || school?.directorPrimary || 'Le Directeur',
      qualite: (contract?.terms as any)?.employer?.representantQualite || recruiter?.functionLabel || 'Directeur(trice)',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PDF + STOCKAGE + NUMÉROTATION
  // ─────────────────────────────────────────────────────────────────────────

  private async renderPdf(html: string): Promise<Buffer> {
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      return Buffer.from(pdf);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  private async savePdf(tenantId: string, documentNumber: string, ctx: any, pdfBuffer: Buffer): Promise<string> {
    const fileName = `${documentNumber}.pdf`;
    const storageKey = `payroll-documents/${tenantId}/${ctx.fiscalYear}/${fileName}`;
    try {
      const result = await this.storageService.uploadBuffer(pdfBuffer, storageKey, 'application/pdf');
      return result;
    } catch (cloudError: any) {
      this.logger.warn(`Cloud upload failed, fallback local : ${cloudError?.message}`);
      const dir = path.join(process.cwd(), 'uploads', 'payroll-documents', tenantId, String(ctx.fiscalYear));
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, fileName);
      fs.writeFileSync(filePath, pdfBuffer);
      return `/uploads/payroll-documents/${tenantId}/${ctx.fiscalYear}/${fileName}`;
    }
  }

  private async readStoredPdf(filePath: string): Promise<Buffer> {
    // Cloud storage (R2/S3)
    try {
      const type = this.storageService.getStorageType();
      if (type === 'r2' || type === 's3') {
        return await this.storageService.downloadFile(filePath);
      }
    } catch (err: any) {
      this.logger.warn(`Cloud download failed (${filePath}) : ${err?.message}`);
    }
    // Vercel Blob (URL directe)
    if (filePath.startsWith('https://')) {
      const res = await fetch(filePath);
      if (!res.ok) throw new NotFoundException('Fichier PDF introuvable dans le stockage distant.');
      return Buffer.from(await res.arrayBuffer());
    }
    // Fallback système de fichiers local
    const absolutePath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException('Fichier PDF introuvable sur le système de fichiers.');
    }
    return fs.readFileSync(absolutePath);
  }

  /** Allocation atomique : UPSERT ... RETURNING sur payroll_document_sequences. */
  private async allocateSequence(tenantId: string, documentType: string, fiscalYear: number): Promise<number> {
    try {
      const rows: any[] = await (this.prisma as any).$queryRawUnsafe(
        `INSERT INTO "payroll_document_sequences" ("id","tenantId","documentType","fiscalYear","lastNumber","createdAt","updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, 1, now(), now())
         ON CONFLICT ("tenantId","documentType","fiscalYear")
         DO UPDATE SET "lastNumber" = "payroll_document_sequences"."lastNumber" + 1, "updatedAt" = now()
         RETURNING "lastNumber"`,
        tenantId, documentType, fiscalYear,
      );
      return Number(rows?.[0]?.lastNumber ?? 1);
    } catch (err: any) {
      this.logger.warn(`Séquence SQL indisponible (${err?.message}) — repli Prisma upsert`);
      // Repli (par exemple si la table vient d'être créée par bootstrap dans la même seconde)
      const existing = await this.prisma.payrollDocumentSequence.findUnique({
        where: { tenantId_documentType_fiscalYear: { tenantId, documentType, fiscalYear } },
      });
      const next = (existing?.lastNumber ?? 0) + 1;
      await this.prisma.payrollDocumentSequence.upsert({
        where: { tenantId_documentType_fiscalYear: { tenantId, documentType, fiscalYear } },
        create: { ...prismaCreateDefaults(), tenantId, documentType, fiscalYear, lastNumber: next },
        update: { ...prismaUpdateDefaults(), lastNumber: next },
      });
      return next;
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * ⭐ 17/11/2026 — Indemnités DÉTAILLÉES par type, figées dans la ligne de paie
 * (payroll_items.allowancesDetail) au moment du calcul :
 *   • détail présent  → [{label, amount}] par type d'indemnité ;
 *   • total seul      → ligne agrégée « Indemnités » (montant figé) ;
 *   • rien (héritage) → null → les gabarits retombent sur « Primes et
 *     indemnités » (résidu), rendu inchangé des documents déjà émis.
 * Le SALAIRE RÉEL s'affiche alors : base + chaque type d'indemnité + heures
 * supp + primes = SALAIRE BRUT.
 */
function buildIndemnitesGains(item: any): Array<{ label: string; amount: number }> | null {
  const detailRaw = Array.isArray(item?.allowancesDetail) ? item.allowancesDetail : [];
  const detail = detailRaw
    .map((a: any) => ({
      label: String(a?.label ?? a?.code ?? 'Indemnité'),
      amount: round2(Number(a?.amount ?? 0)),
    }))
    .filter((a: any) => a.amount > 0);
  if (detail.length > 0) return detail;
  const total = round2(Number(item?.allowancesTotal ?? 0));
  if (total > 0) return [{ label: 'Indemnités', amount: total }];
  return null;
}

function fmtHash(hash: string): string {
  return hash ? `${hash.slice(0, 12)}…` : '—';
}
