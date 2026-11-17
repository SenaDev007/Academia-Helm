/**
 * ============================================================================
 * TAX DECLARATION SERVICE — Déclarations fiscales (IST, AIB, CNSS)
 * ============================================================================
 *
 * Génère et gère les déclarations fiscales avec calculs automatiques
 * basés sur les taux configurables (TaxSettings).
 *
 * IST  — Impôt sur Salaires et Traitements (mensuel)
 * AIB  — Abattement à l'Impôt des Bénéfices (mensuel)
 * CNSS — Déclaration nominative trimestrielle
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TaxSettingsService } from './tax-settings.service';
import { PayrollService } from './payroll.service';

@Injectable()
export class TaxDeclarationService {
  private readonly logger = new Logger(TaxDeclarationService.name);

  constructor(
    private prisma: PrismaService,
    private taxSettingsService: TaxSettingsService,
    private payrollFiscalService: PayrollService,
  ) {}

  /**
   * Génère (ou RAFRAÎCHIT si encore DRAFT) la déclaration IST pour une période.
   * L'IST = IRPP + VPS (Versement Patronal sur Salaires)
   * ⭐ 125 — rafraîchissement : une déclaration en brouillon suit la paie
   *    (recalcul des données) ; SUBMITTED/PAID restent figés (déclaration
   *    déposée = immuable).
   */
  async getOrGenerateIST(tenantId: string, academicYearId: string, period: string) {
    if (!period) {
      // Auto-générer le mois courant si non fourni: "2026-06"
      const now = new Date();
      period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    // Vérifier si la déclaration existe déjà
    const existing = await this.prisma.taxDeclaration.findFirst({
      where: { tenantId, academicYearId, type: 'IST', period }, });

    // Générer depuis les données de paie du personnel
    const settings = await this.taxSettingsService.getOrCreate(tenantId);

    // ⭐ 16/11/2026 — données RÉELLES du module Paie : les lignes du mois
    //    (moteur statut contractuel — IST calculé par employé selon son type
    //    de contrat). Plus aucun salaire statique staff.salary.
    const payrollData = await this.getMonthlyPayrollData(tenantId, period);

    const totalGrossSalary = payrollData.totalGross;
    const staffCount = payrollData.staffCount;

    // Calculs
    const vps = totalGrossSalary * (settings.istVpsRate / 100);
    // ⭐ IRPP = somme des IST réellement retenus sur les lignes de paie du mois
    //    (barème progressif par type de contrat) — le taux des paramètres ne
    //    sert plus qu'à l'affichage de référence.
    const irpp = payrollData.totalIrpp;
    const totalIST = vps + irpp;

    const data = {
      staffCount,
      totalGrossSalary,
      vpsRate: settings.istVpsRate,
      irppRate: settings.istIrppRate,
      vps,
      irpp,
      irppSource: 'payroll-items',
      totalAibPrestataires: payrollData.totalAib,
      totalIST,
      staffDetails: payrollData.details,
      // Section paiement (à compléter par l'utilisateur)
      payment: existing?.status === 'DRAFT' ? (existing.data as any)?.payment : {
        mode: '', // ESPECES, CHEQUE, VIREMENT
        chequeNumber: '',
        bank: '',
        reference: '',
        amountInWords: '',
      },
      // Pénalités (à compléter par l'utilisateur)
      penalties: {
        irpp: 0,
        irppReason: '',
        vps: 0,
        vpsReason: '',
        total: 0,
      },
      // Cadre administration
      quittanceNumber: '',
      submissionDate: '',
    };

    // ⭐ 125 — paiement/pénalités/cadre déjà saisis par l'utilisateur : préservés
    if (existing?.status === 'DRAFT') {
      const prev: any = existing.data ?? {};
      if (prev.payment) data.payment = prev.payment;
      if (prev.penalties) data.penalties = prev.penalties;
      if (prev.quittanceNumber) data.quittanceNumber = prev.quittanceNumber;
      if (prev.submissionDate) data.submissionDate = prev.submissionDate;
    }

    if (existing) {
      if (existing.status === 'DRAFT') {
        return this.prisma.taxDeclaration.update({
          where: { id: existing.id },
          data: { data: data as any, totalAmount: totalIST },
        });
      }
      return existing; // SUBMITTED/PAID → figée
    }

    return this.prisma.taxDeclaration.create({
      data: {
        tenantId,
        academicYearId,
        type: 'IST',
        period,
        status: 'DRAFT',
        data: data as any,
        totalAmount: totalIST,
      },
    });
  }

  /**
   * Génère (ou RAFRAÎCHIT si encore DRAFT) la déclaration CNSS pour un trimestre.
   * ⭐ 125 — même mécanique que l'IST : brouillon = suit la paie ; déposé = figé.
   */
  async getOrGenerateCNSS(tenantId: string, academicYearId: string, period: string) {
    if (!period) {
      // Auto-générer le trimestre courant si non fourni: "2026-T1"
      const now = new Date();
      const quarter = Math.floor(now.getMonth() / 3) + 1;
      period = `${now.getFullYear()}-T${quarter}`;
    }

    const existing = await this.prisma.taxDeclaration.findFirst({
      where: { tenantId, academicYearId, type: 'CNSS', period },
    });

    const settings = await this.taxSettingsService.getOrCreate(tenantId);
    const payrollData = await this.getQuarterlyPayrollData(tenantId, period);

    const totalSalary = payrollData.totalGross;

    // ⭐ 16/11/2026 — parts RÉELLES depuis les lignes de paie du trimestre :
    //    cnssEmployee/cnssEmployer calculés par le moteur de paie selon le
    //    statut contractuel de chaque employé (fiche de paie des déclarés).
    //    Les branches patronales restent décomposées sur la base réelle avec
    //    les taux paramétrables — le total déclaré = réel de la paie.
    const partOuvriere = payrollData.totalCnssEmployee;
    const partPatronale = payrollData.totalCnssEmployer;
    const cotisationsFamiliales = totalSalary * (settings.cnssFamilialesRate / 100);
    const risquesPro = totalSalary * (settings.cnssRisquesRate / 100);
    const assuranceVieillesse = totalSalary * (settings.cnssVieillesseRate / 100);
    const totalCotisations = partOuvriere + partPatronale;

    const data = {
      totalSalary,
      rates: {
        familiales: settings.cnssFamilialesRate,
        risques: settings.cnssRisquesRate,
        vieillesse: settings.cnssVieillesseRate,
        patronale: settings.cnssPatronaleRate,
        ouvriere: settings.cnssOuvriereRate,
      },
      cotisationsFamiliales,
      risquesPro,
      assuranceVieillesse,
      partPatronale,
      partOuvriere,
      source: 'payroll-items',
      totalCotisations,
      majorations: 0, // Calculé si retard
      totalAPayer: totalCotisations,
      // Détail par employé (jours ouvrables et rémunération par mois)
      staffDetails: payrollData.details,
      months: payrollData.months || [],
      // Section paiement — saisie utilisateur préservée sur refresh (⭐ 125)
      payment: {
        mode: '', // VIREMENT, CHEQUE, ESPECES
        bank: '',
        chequeNumber: '',
        reference: '',
      },
    };
    if (existing?.status === 'DRAFT') {
      const prev: any = existing.data ?? {};
      if (prev.payment) data.payment = prev.payment;
      if (prev.majorations) data.majorations = prev.majorations;
    }

    if (existing) {
      if (existing.status === 'DRAFT') {
        return this.prisma.taxDeclaration.update({
          where: { id: existing.id },
          data: { data: data as any, totalAmount: totalCotisations },
        });
      }
      return existing; // SUBMITTED/PAID → figée
    }

    return this.prisma.taxDeclaration.create({
      data: {
        tenantId,
        academicYearId,
        type: 'CNSS',
        period,
        status: 'DRAFT',
        data: data as any,
        totalAmount: totalCotisations,
      },
    });
  }

  /**
   * Génère (ou RAFRAÎCHIT si encore DRAFT) la déclaration AIB pour une période.
   * AIB 1% sur achats + AIB 5% sur prestations.
   * ⭐ 125 — même mécanique : brouillon = suit la paie ; déposé = figé.
   */
  async getOrGenerateAIB(tenantId: string, academicYearId: string, period: string, baseAchats = 0, basePrestations = 0) {
    if (!period) {
      // Auto-générer le mois courant si non fourni: "2026-06"
      const now = new Date();
      period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    const existing = await this.prisma.taxDeclaration.findFirst({
      where: { tenantId, academicYearId, type: 'AIB', period },
    });

    const settings = await this.taxSettingsService.getOrCreate(tenantId);

    // ⭐ 16/11/2026 — Section IV alimentée par la paie RÉELLE : les lignes des
    //    prestataires de services du mois (retenue AIB à la source calculée
    //    par le moteur de paie selon la présence de l'IFU).
    const payrollData = await this.getMonthlyPayrollData(tenantId, period);
    const prestataires = payrollData.prestataires.map((p: any) => ({
      name: p.name,
      address: p.address || '',
      ifu: p.ifu || '',
      base: p.base,
      prelevement: p.prelevement,
    }));

    // Base « prestations » réelle par défaut si l'école n'a rien saisi :
    // montant brut versé aux prestataires dans le mois.
    // ⭐ 125 — saisie utilisateur (bases achats/prestations) préservée sur refresh.
    const prevData: any = existing?.data ?? {};
    const keepAchats = existing?.status === 'DRAFT' && prevData?.baseAchats > 0;
    const keepPrestations = existing?.status === 'DRAFT' && prevData?.basePrestations > 0;
    const baseAchatsReel = keepAchats ? Number(prevData.baseAchats) : baseAchats;
    const basePrestationsReel = keepPrestations
      ? Number(prevData.basePrestations)
      : basePrestations > 0
        ? basePrestations
        : payrollData.prestataires.reduce((s: number, p: any) => s + p.base, 0);

    const aibAchats = baseAchatsReel * (settings.aibAchatsRate / 100);
    const aibPrestations = basePrestationsReel * (settings.aibPrestationsRate / 100);
    const totalAIB = aibAchats + aibPrestations;

    const data = {
      baseAchats: baseAchatsReel,
      basePrestations: basePrestationsReel,
      rates: {
        achats: settings.aibAchatsRate,
        prestations: settings.aibPrestationsRate,
      },
      aibAchats,
      aibPrestations,
      totalAIB,
      aibRetenuePrestataires: payrollData.totalAib,
      source: 'payroll-items',
      // Section IV — Détail des prélèvements AIB (prestataires)
      prestataires,
      // Section paiement — saisie utilisateur préservée sur refresh (⭐ 125)
      payment: {
        mode: '', // ESPECES, CHEQUE, VIREMENT
        bank: '',
        chequeNumber: '',
        reference: '',
      },
      // Cadre administration
      quittanceNumber: '',
      emissionDate: '',
      penalty: 0,
    };
    if (existing?.status === 'DRAFT') {
      if (prevData.payment) data.payment = prevData.payment;
      if (prevData.quittanceNumber) data.quittanceNumber = prevData.quittanceNumber;
      if (prevData.emissionDate) data.emissionDate = prevData.emissionDate;
      if (prevData.penalty) data.penalty = prevData.penalty;
    }

    if (existing) {
      if (existing.status === 'DRAFT') {
        return this.prisma.taxDeclaration.update({
          where: { id: existing.id },
          data: { data: data as any, totalAmount: totalAIB },
        });
      }
      return existing; // SUBMITTED/PAID → figée
    }

    return this.prisma.taxDeclaration.create({
      data: {
        tenantId,
        academicYearId,
        type: 'AIB',
        period,
        status: 'DRAFT',
        data: data as any,
        totalAmount: totalAIB,
      },
    });
  }

  /**
   * ⭐ 125 — SYNCHRONISATION AUTOMATIQUE des sous-onglets CNSS/IRPP/VPS/AIB.
   *
   * Appelée :
   *   1. par le module Paie après chaque génération / calcul de période ;
   *   2. par le front à l'ouverture de l'onglet CNSS (POST sync-all).
   *
   * Pour chaque MOIS disposant de lignes de paie (PayrollItem) :
   *   - déclaration IST (IRPP + VPS) du mois (créée ou rafraîchie si DRAFT) ;
   *   - déclaration AIB du mois (idem) ;
   *   - déclaration CNSS du TRIMESTRE correspondant (idem) ;
   *   - fiches fiscales tax_payslips PERMANENT + VACATAIRE du mois.
   *
   * Idempotent : les déclarations SUBMITTED/PAID ne sont jamais touchées.
   */
  async syncAllForTenant(tenantId: string, academicYearId: string, options?: { payslips?: boolean }) {
    const months = await this.prisma.payrollItem.findMany({
      where: { tenantId },
      select: { payroll: { select: { month: true } } },
      distinct: ['payrollId'],
    });
    const monthKeys = Array.from(
      new Set(months.map((m: any) => m?.payroll?.month).filter((m: string) => m && /^\d{4}-\d{2}$/.test(m))),
    ).sort();

    const results: any = { months: monthKeys, ist: 0, aib: 0, cnss: 0, payslips: 0, errors: [] };

    for (const monthKey of monthKeys) {
      try {
        await this.getOrGenerateIST(tenantId, academicYearId, monthKey);
        results.ist += 1;
      } catch (e: any) {
        results.errors.push(`IST ${monthKey}: ${e?.message}`);
      }
      try {
        await this.getOrGenerateAIB(tenantId, academicYearId, monthKey);
        results.aib += 1;
      } catch (e: any) {
        results.errors.push(`AIB ${monthKey}: ${e?.message}`);
      }
      // CNSS trimestrielle couvrant ce mois
      try {
        const [y, m] = monthKey.split('-').map(Number);
        const quarter = Math.floor((m - 1) / 3) + 1;
        await this.getOrGenerateCNSS(tenantId, academicYearId, `${y}-T${quarter}`);
        results.cnss += 1;
      } catch (e: any) {
        results.errors.push(`CNSS ${monthKey}: ${e?.message}`);
      }
    }

    // Trimestres sans mois de paie (aucun) — couvert par la boucle ci-dessus.

    if (options?.payslips !== false) {
      // Fiches fiscales (tax_payslips) — permanents + vacataires, par mois de paie
      for (const monthKey of monthKeys) {
        for (const staffType of ['PERMANENT', 'VACATAIRE']) {
          try {
            await this.payrollFiscalService.generatePayslips(tenantId, academicYearId, monthKey, staffType);
            results.payslips += 1;
          } catch (e: any) {
            results.errors.push(`payslips ${monthKey}/${staffType}: ${e?.message}`);
          }
        }
      }
    }

    this.logger.log(
      `syncAllForTenant: ${monthKeys.length} mois → ${results.ist} IST, ${results.aib} AIB, ` +
      `${results.cnss} CNSS, ${results.payslips} jeux de fiches fiscales` +
      (results.errors.length ? ` — erreurs: ${results.errors.join(' | ')}` : ''),
    );

    return results;
  }

  /**
   * Récupère toutes les déclarations d'un type pour une année.
   */
  async listByType(tenantId: string, academicYearId: string, type?: string) {
    return this.prisma.taxDeclaration.findMany({
      where: { tenantId, academicYearId, ...(type ? { type } : {}) },
      orderBy: { period: 'desc' },
    });
  }

  /**
   * Met à jour le statut d'une déclaration.
   */
  async updateStatus(id: string, status: string, notes?: string) {
    return this.prisma.taxDeclaration.update({
      where: { id },
      data: {
        status,
        notes,
        submittedAt: status === 'SUBMITTED' ? new Date() : undefined,
        paidAt: status === 'PAID' ? new Date() : undefined,
      },
    });
  }

  /**
   * Récupère une déclaration par ID.
   */
  async getById(id: string) {
    const decl = await this.prisma.taxDeclaration.findUnique({ where: { id } });
    if (!decl) throw new NotFoundException('Déclaration introuvable');
    return decl;
  }

  // ─── Helpers : données de paie (⭐ 16/11/2026 — SOURCES RÉELLES) ─────────
  //
  // Les deux helpers lisent désormais les LIGNES DE PAIE du module Paie
  // (PayrollItem), produites par le moteur statut contractuel :
  //   - IST/IRPP  → salariés (déclarés ou non) : ITS réellement retenu
  //   - CNSS      → affiliés uniquement (SALARIE_DECLARE, ou héritage avec
  //                 n° CNSS actif) : parts ouvrière/patronale réelles
  //   - AIB       → prestataires de services : retenue à la source réelle
  // Plus aucun salaire statique staff.salary ni approximation « 26 jours ».

  /** Jours ouvrables (lun-ven) d'un mois YYYY-MM — calendrier réel. */
  private joursOuvresDuMois(year: number, month: number): number {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));
    let count = 0;
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const dow = d.getUTCDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    return count;
  }

  /**
   * Lignes de paie RÉELLES du mois (period = "2026-01") :
   * totaux IST/IRPP des salariés + retenues AIB des prestataires + détail
   * nominatif par employé avec n° CNSS (employeeCNSS en priorité).
   */
  private async getMonthlyPayrollData(tenantId: string, period: string) {
    const items = await this.prisma.payrollItem.findMany({
      where: { tenantId, payroll: { month: period } },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            cnssNumber: true,
            statutContractuel: true,
            ifuNumber: true,
            employeeCNSS: { select: { cnssNumber: true, isActive: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const nameOf = (it: any) =>
      `${it.staff?.firstName ?? ''} ${it.staff?.lastName ?? ''}`.trim();
    const cnssNumberOf = (it: any) =>
      it.staff?.employeeCNSS?.cnssNumber || it.staff?.cnssNumber || '';

    // Prestataires → AIB (exclus des traitements et salaires) ;
    // salariés → ITS (déclarés et non déclarés).
    const prestataires = items.filter(
      (it: any) => it.staff?.statutContractuel === 'PRESTATAIRE_SERVICE',
    );
    const salaries = items.filter(
      (it: any) => it.staff?.statutContractuel !== 'PRESTATAIRE_SERVICE',
    );

    const details = salaries.map((it: any) => ({
      staffId: it.staffId,
      name: nameOf(it),
      grossSalary: Number(it.grossSalary ?? 0),
      cnssNumber: cnssNumberOf(it),
      irpp: Number(it.irppAmount ?? 0),
      cnssEmployee: Number(it.cnssEmployee ?? 0),
      statutContractuel: it.staff?.statutContractuel ?? null,
    }));

    const prestataireDetails = prestataires.map((it: any) => ({
      staffId: it.staffId,
      name: nameOf(it),
      address: '',
      ifu: it.staff?.ifuNumber || '',
      base: Number(it.grossSalary ?? 0),
      prelevement: Number(it.otherDeductions ?? 0),
    }));

    return {
      totalGross: details.reduce((sum, d) => sum + d.grossSalary, 0),
      staffCount: details.length,
      totalIrpp: salaries.reduce((s, it: any) => s + Number(it.irppAmount ?? 0), 0),
      totalCnssEmployee: salaries.reduce((s, it: any) => s + Number(it.cnssEmployee ?? 0), 0),
      totalAib: prestataires.reduce((s, it: any) => s + Number(it.otherDeductions ?? 0), 0),
      prestataires: prestataireDetails,
      details,
      payrollLines: items.length,
    };
  }

  /**
   * Lignes de paie RÉELLES du trimestre (period = "2026-T1") pour la
   * déclaration nominative CNSS : affiliation = SALARIE_DECLARE (ou héritage
   * sans statut avec n° CNSS actif), jours ouvrables calendaires, rémunération
   * réelle mois par mois depuis les items, parts ouvrière/patronale réelles.
   */
  private async getQuarterlyPayrollData(tenantId: string, period: string) {
    // period = "2026-T1" → extraire l'année et les 3 mois
    // Null-safe: si period est undefined/null, utiliser le trimestre courant
    const safePeriod = period || '';
    const yearMatch = safePeriod.match(/^(\d{4})-T(\d)$/);
    const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
    const quarter = yearMatch ? parseInt(yearMatch[2]) : Math.floor(new Date().getMonth() / 3) + 1;
    const startMonth = (quarter - 1) * 3 + 1; // T1=1, T2=4, T3=7, T4=10
    const months = [startMonth, startMonth + 1, startMonth + 2];
    const monthKeys = months.map(m => `${year}-${String(m).padStart(2, '0')}`);

    const items = await this.prisma.payrollItem.findMany({
      where: { tenantId, payroll: { month: { in: monthKeys } } },
      include: {
        payroll: { select: { month: true } },
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            cnssNumber: true,
            statutContractuel: true,
            employeeCNSS: { select: { cnssNumber: true, isActive: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Affiliés CNSS : statut SALARIE_DECLARE, ou héritage (sans statut) avec
    // n° CNSS actif — les non-déclarés et prestataires n'y figurent JAMAIS.
    const affiliated = items.filter((it: any) => {
      const statut = it.staff?.statutContractuel;
      if (statut === 'PRESTATAIRE_SERVICE' || statut === 'SALARIE_NON_DECLARE') return false;
      if (statut === 'SALARIE_DECLARE') return true;
      return !!(it.staff?.employeeCNSS?.isActive && it.staff?.employeeCNSS?.cnssNumber);
    });

    const daysByMonth: number[] = months.map(m => this.joursOuvresDuMois(year, m));

    // Regroupement par employé — rémunération réelle par mois présent en paie
    const byStaff = new Map<string, {
      staffId: string; name: string; cnssNumber: string;
      salaryByMonth: (number | null)[]; cnssEmployee: number; cnssEmployer: number;
    }>();
    for (const it of affiliated) {
      const monthIdx = monthKeys.indexOf(it.payroll?.month ?? '');
      if (monthIdx < 0) continue;
      const key = it.staffId;
      let entry = byStaff.get(key);
      if (!entry) {
        entry = {
          staffId: key,
          name: `${it.staff?.firstName ?? ''} ${it.staff?.lastName ?? ''}`.trim(),
          cnssNumber: it.staff?.employeeCNSS?.cnssNumber || it.staff?.cnssNumber || '',
          salaryByMonth: [null, null, null],
          cnssEmployee: 0,
          cnssEmployer: 0,
        };
        byStaff.set(key, entry);
      }
      entry.salaryByMonth[monthIdx] = Number(it.grossSalary ?? 0);
      entry.cnssEmployee += Number(it.cnssEmployee ?? 0);
      entry.cnssEmployer += Number(it.cnssEmployer ?? 0);
    }

    const details = Array.from(byStaff.values()).map(e => ({
      staffId: e.staffId,
      cnssNumber: e.cnssNumber,
      name: e.name,
      // Détail par mois (jours ouvrables calendaires du trimestre)
      daysMonth1: daysByMonth[0],
      daysMonth2: daysByMonth[1],
      daysMonth3: daysByMonth[2],
      totalDaysAssimilés: daysByMonth.reduce((a, b) => a + b, 0),
      // Rémunération réelle par mois (0 si aucune paie ce mois-là)
      salaryMonth1: e.salaryByMonth[0] ?? 0,
      salaryMonth2: e.salaryByMonth[1] ?? 0,
      salaryMonth3: e.salaryByMonth[2] ?? 0,
      grossSalary: e.salaryByMonth.reduce((a, b) => a + (b ?? 0), 0),
    }));

    return {
      totalGross: details.reduce((sum, d) => sum + d.grossSalary, 0),
      staffCount: details.length,
      totalCnssEmployee: Array.from(byStaff.values()).reduce((a, e) => a + e.cnssEmployee, 0),
      totalCnssEmployer: Array.from(byStaff.values()).reduce((a, e) => a + e.cnssEmployer, 0),
      details,
      months: monthKeys,
    };
  }
}
