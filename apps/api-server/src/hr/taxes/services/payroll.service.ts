/**
 * ============================================================================
 * PAYROLL SERVICE — États de paiement + Fiches de paie
 * ============================================================================
 * Gère la génération des fiches de paie avec calculs automatiques
 * (CNSS, ITS, VPS) basés sur les taux configurables (TaxSettings).
 * ============================================================================
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TaxSettingsService } from './tax-settings.service';
import { PAYSLIP_DEDICATED_CODES } from '../../allowance-catalog';
import { PayrollEngineService } from '../../services/payroll-engine.service';

/** ⭐ 156 — rubrique de la fiche fiscale pour un code d'indemnité. */
function rubriqueFor(code: string | null | undefined): string {
  return (code && PAYSLIP_DEDICATED_CODES[code]) || 'indemnites';
}

/**
 * ⭐ 156 — Règle fiscale « Permanent / Vacataire » (exigence promoteur) :
 *   PERMANENT  = personnel DÉCLARÉ à la CNSS (statut SALARIE_DECLARE, ou
 *                dossier hérité sans statut mais avec n° CNSS actif) ;
 *   VACATAIRE  = PRESTATAIRES et personnels NON déclarés à la CNSS
 *                (PRESTATAIRE_SERVICE, SALARIE_NON_DECLARE, sans n° CNSS).
 * L'ancienne dérivation contractType==='VACATAIRE' ne matchait AUCUN dossier
 * réel : la colonne/filtre « vacataire » restait vide partout.
 */
export function fiscalStaffType(s: {
  statutContractuel?: string | null;
  cnssNumber?: string | null;
  employeeCNSS?: { cnssNumber?: string | null; isActive?: boolean } | null;
} | null | undefined): 'PERMANENT' | 'VACATAIRE' {
  const statut = s?.statutContractuel;
  if (statut === 'SALARIE_DECLARE') return 'PERMANENT';
  if (statut === 'PRESTATAIRE_SERVICE' || statut === 'SALARIE_NON_DECLARE') return 'VACATAIRE';
  const hasActiveCnss =
    !!(s?.employeeCNSS?.isActive && s?.employeeCNSS?.cnssNumber) ||
    !!(s?.cnssNumber && String(s.cnssNumber).trim());
  return hasActiveCnss ? 'PERMANENT' : 'VACATAIRE';
}

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private prisma: PrismaService,
    private taxSettingsService: TaxSettingsService,
    private payrollEngine: PayrollEngineService,
  ) {}

  async getOrCreatePeriod(tenantId: string, academicYearId: string, period: string, staffType: string) {
    let period_ = await this.prisma.taxPayrollPeriod.findFirst({
      where: { tenantId, academicYearId, period, staffType },
    });
    if (!period_) {
      period_ = await this.prisma.taxPayrollPeriod.create({
        data: { tenantId, academicYearId, period, staffType, status: 'DRAFT' },
      });
    }
    return period_;
  }

  /**
   * Génère les fiches de paie fiscales (tax_payslips) pour une période.
   *
   * ⭐ 125 — SOURCE DE VÉRITÉ = les LIGNES DE PAIE du module Paie (PayrollItem)
   *    quand elles existent pour le mois demandé : les montants affichés dans
   *    l'onglet CNSS (« États de paiement » / « Vacataires ») sont EXACTEMENT
   *    ceux calculés par le moteur statut contractuel (CNSS/ITS/AIB, indemnités
   *    par rubrique). Repli inchangé sur staff.salary + indemnités actives
   *    pour les mois sans paie générée.
   */
  async generatePayslips(tenantId: string, academicYearId: string, period: string, staffType: string) {
    const settings = await this.taxSettingsService.getOrCreate(tenantId);
    const payrollPeriod = await this.getOrCreatePeriod(tenantId, academicYearId, period, staffType);

    // ── Lignes de paie réelles du mois (source de vérité) ──
    const payrollItems = await this.prisma.payrollItem.findMany({
      where: { tenantId, payroll: { month: period } },
      include: { staff: { select: { contractType: true } } },
    });
    const itemsByStaff = new Map<string, any>(payrollItems.map((it: any) => [it.staffId, it]));

    // ⭐ 156 — sélection du personnel par la règle FISCALE (statut contractuel
    //    + déclaration CNSS) et non plus par contractType : les PERMANENTS
    //    sont les déclarés CNSS, les VACATAIRES les prestataires et non
    //    déclarés — l'ancien filtre contractType ne matchait aucun dossier.
    const allStaff = await this.prisma.staff.findMany({
      where: { tenantId, status: { not: 'ARCHIVED' } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        salary: true,
        cnssNumber: true,
        position: true,
        statutContractuel: true,
        employeeCNSS: { select: { cnssNumber: true, isActive: true } },
      },
    });
    const staffList = allStaff.filter((s) => fiscalStaffType(s as any) === staffType);

    // ⭐ 13/11/2026 — Indemnités actives du personnel (onglet Indemnités /
    //    workflow d'embauche) : elles alimentent les rubriques de la fiche de
    //    paie — MOINS_PERCU_ARRIERS / GRATIFICATIONS_ETRENNES /
    //    PRIMES_SALISSURE vers leurs colonnes dédiées, tout le reste vers la
    //    rubrique générique « indemnites ». Seules les indemnités en cours
    //    sur la période sont retenues (dates d'effet/fin respectées).
    const periodStart = period && /^\d{4}-\d{2}$/.test(period) ? new Date(`${period}-01T00:00:00Z`) : new Date();
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
    periodEnd.setUTCDate(0);
    const allowancesByStaff = new Map<string, Map<string, number>>();
    try {
      const allowanceRows = await this.prisma.staffAllowance.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          staffId: { in: staffList.map((s) => s.id) },
          effectiveDate: { lte: periodEnd },
          OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
        },
        include: { allowanceType: { select: { code: true } } },
      });
      for (const row of allowanceRows) {
        const code = row.allowanceType?.code || 'INDEMNITES';
        const rubrique = PAYSLIP_DEDICATED_CODES[code] || 'indemnites';
        const bucket = allowancesByStaff.get(row.staffId) || new Map<string, number>();
        bucket.set(rubrique, (bucket.get(rubrique) || 0) + Number(row.amount || 0));
        allowancesByStaff.set(row.staffId, bucket);
      }
    } catch (e: any) {
      this.logger.warn(`Rubriques indemnites indisponibles : ${e?.message}`);
    }

    let totalGross = 0, totalDeductions = 0, totalNet = 0;

    for (const staff of staffList) {
      // ⭐ 125 — LIGNE DE PAIE RÉELLE en priorité (moteur statut contractuel)
      const item: any = itemsByStaff.get(staff.id);
      let salaireBase: number, salaireBrut: number, cnssOuvriere: number,
          itsNet: number, cnssPatronale: number, vps: number,
          totalRetenues: number, netAPayer: number;
      let moinsPercesArriere = 0, gratificationsEtrennes = 0, indemnites = 0, primeSalissures = 0;

      if (item) {
        salaireBase = Number(item.baseSalary ?? 0);
        salaireBrut = Number(item.grossSalary ?? 0);
        cnssOuvriere = Number(item.cnssEmployee ?? 0);
        itsNet = Number(item.irppAmount ?? 0);
        cnssPatronale = Number(item.cnssEmployer ?? 0);
        vps = salaireBrut * (settings.istVpsRate / 100);
        totalRetenues = Number(item.totalDeductions ?? 0);
        netAPayer = Number(item.netSalary ?? 0);
        // Répartition des indemnités par rubrique (détail figé dans la ligne)
        for (const d of (Array.isArray(item.allowancesDetail) ? (item.allowancesDetail as any[]) : [])) {
          const bucket = rubriqueFor(d?.code);
          if (bucket === 'moinsPercesArriere') moinsPercesArriere += Number(d?.amount || 0);
          else if (bucket === 'gratificationsEtrennes') gratificationsEtrennes += Number(d?.amount || 0);
          else if (bucket === 'primeSalissures') primeSalissures += Number(d?.amount || 0);
          else indemnites += Number(d?.amount || 0);
        }
      } else {
        // ── Repli historique : staff.salary + indemnités actives ──
        const salBase = Number(staff.salary || 0);
        const rub = allowancesByStaff.get(staff.id) || new Map<string, number>();
        moinsPercesArriere = rub.get('moinsPercesArriere') || 0;
        gratificationsEtrennes = rub.get('gratificationsEtrennes') || 0;
        indemnites = rub.get('indemnites') || 0;
        primeSalissures = rub.get('primeSalissures') || 0;
        salaireBrut = salBase + moinsPercesArriere + gratificationsEtrennes + indemnites + primeSalissures;

        if (staffType === 'VACATAIRE') {
          // ⭐ 156 — vacataires (prestataires / non déclarés) : NI CNSS ni
          //    ITS/VPS sur le repli — net = brut (la retenue AIB des
          //    prestataires est calculée par le moteur sur les lignes réelles).
          cnssOuvriere = 0;
          itsNet = 0;
          cnssPatronale = 0;
          vps = 0;
          totalRetenues = 0;
          netAPayer = salaireBrut;
        } else {
          cnssOuvriere = salaireBrut * (settings.cnssOuvriereRate / 100);
          itsNet = salaireBrut * (settings.istVpsRate / 100);
          cnssPatronale = salaireBrut * (settings.cnssPatronaleRate / 100);
          vps = salaireBrut * (settings.istVpsRate / 100);

          totalRetenues = cnssOuvriere + itsNet;
          netAPayer = salaireBrut - totalRetenues;
        }
        salaireBase = salBase;
      }

      totalGross += salaireBrut;
      totalDeductions += totalRetenues;
      totalNet += netAPayer;

      const existing = await this.prisma.taxPayslip.findFirst({
        where: { payrollPeriodId: payrollPeriod.id, staffId: staff.id },
      });

      if (existing) {
        await this.prisma.taxPayslip.update({
          where: { id: existing.id },
          data: { salaireBase, moinsPercesArriere, gratificationsEtrennes, indemnites, primeSalissures, salaireBrut, cnssOuvriere, itsNet, cnssPatronale, vps, totalRetenues, netAPayer },
        });
      } else {
        await this.prisma.taxPayslip.create({
          data: {
            tenantId, academicYearId, staffId: staff.id, payrollPeriodId: payrollPeriod.id, period,
            salaireBase, moinsPercesArriere, gratificationsEtrennes, indemnites, primeSalissures, salaireBrut, cnssOuvriere, itsNet, cnssPatronale, vps, totalRetenues, netAPayer,
          },
        });
      }
    }

    await this.prisma.taxPayrollPeriod.update({
      where: { id: payrollPeriod.id },
      data: { totalGross, totalDeductions, totalNet },
    });

    return { payrollPeriod, payslipsCount: staffList.length, totalGross, totalDeductions, totalNet };
  }

  async getPayslips(tenantId: string, academicYearId: string, period: string, staffType?: string) {
    const where: any = { tenantId, academicYearId };
    // Only filter by period if it's non-empty
    if (period && period.trim()) {
      where.period = period;
    }
    // ⭐ 125 — filtre par type de personnel (Vacataires vs États de paiement) :
    //    la vue « Vacataires » ne doit montrer QUE les fiches vacataires.
    if (staffType && staffType.trim()) {
      where.payrollPeriod = { staffType };
    }
    const payslips = await this.prisma.taxPayslip.findMany({
      where,
      // ⭐ 125 — relation staff ajoutée au schéma Prisma (TaxPayslip.staff) :
      //    l'include échouait avant (PrismaClientValidationError « Champ "staff" »).
      // ⭐ 156 — tenantMatricule + statutContractuel : colonnes CIN° et type
      //    fiscal des vues Vacataires / États de paiement.
      include: { staff: { select: { firstName: true, lastName: true, position: true, cnssNumber: true, maritalStatus: true, hireDate: true, contractType: true, tenantMatricule: true, statutContractuel: true } } },
      orderBy: { staff: { lastName: 'asc' } },
    });

    // ─── ⭐ 156 — ENRICHISSEMENT DYNAMIQUE (état de paiement) ───────────────
    // (a) Détail des indemnités PAR FICHE : colonnes dynamiques — une colonne
    //     par type d'indemnité DÉFINI PAR L'EMPLOYEUR (onglet Indemnités /
    //     embauche). Source de vérité = les lignes de paie du mois
    //     (PayrollItem.allowancesDetail, figé au calcul) ; repli sur les
    //     indemnités actives du personnel couvrant la période.
    //     Fin des rubriques « prime de salissure / gratification » codées en dur.
    // (b) ITS BRUT = ITS sur le brut intégral (barème progressif réel, sans
    //     abattement CNSS) — l'ancienne colonne affichait le salaire brut.
    const periodKeys = Array.from(new Set(payslips.map((p: any) => p.period).filter(Boolean)));
    const staffIds = Array.from(new Set(payslips.map((p: any) => p.staffId)));

    const itemDetailMap = new Map<string, any[]>();
    if (periodKeys.length && staffIds.length) {
      try {
        const payrollItems = await this.prisma.payrollItem.findMany({
          where: { tenantId, staffId: { in: staffIds }, payroll: { month: { in: periodKeys } } },
          select: { staffId: true, allowancesDetail: true, payroll: { select: { month: true } } },
        });
        for (const it of payrollItems) {
          const key = `${it.staffId}|${it.payroll?.month}`;
          const prev = itemDetailMap.get(key) || [];
          itemDetailMap.set(
            key,
            prev.concat(Array.isArray(it.allowancesDetail) ? (it.allowancesDetail as any[]) : []),
          );
        }
      } catch (e: any) {
        this.logger.warn(`Détail indemnités (lignes de paie) indisponible : ${e?.message}`);
      }
    }

    // Repli : indemnités actives du personnel (fenêtre de la période respectée)
    let allowanceRows: any[] = [];
    if (staffIds.length) {
      try {
        allowanceRows = await this.prisma.staffAllowance.findMany({
          where: { tenantId, status: 'ACTIVE', staffId: { in: staffIds } },
          include: { allowanceType: { select: { code: true, name: true } } },
        });
      } catch (e: any) {
        this.logger.warn(`Indemnités actives indisponibles : ${e?.message}`);
      }
    }

    // Barème fiscal réel pour l'ITS brut (aucun taux en dur)
    let rates: any = null;
    try {
      rates = await this.payrollEngine.getFiscalRates('BJ');
    } catch (e: any) {
      this.logger.warn(`Barème fiscal indisponible (ITS brut) : ${e?.message}`);
    }

    return payslips.map((p: any) => {
      const periodKey = String(p.period || '');
      let detail: any[] | null = itemDetailMap.get(`${p.staffId}|${periodKey}`) || null;
      if (!detail || detail.length === 0) {
        const start = /^\d{4}-\d{2}$/.test(periodKey) ? new Date(`${periodKey}-01T00:00:00Z`) : null;
        const end = start ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)) : null;
        detail = allowanceRows
          .filter((r: any) => r.staffId === p.staffId)
          .filter((r: any) =>
            !start || !end ||
            (new Date(r.effectiveDate) <= end && (!r.endDate || new Date(r.endDate) >= start)))
          .map((r: any) => ({
            code: r.allowanceType?.code ?? null,
            label: r.allowanceType?.name ?? 'Indemnité',
            amount: Number(r.amount),
          }));
      }
      const brut = Number(p.salaireBrut) || 0;
      const itsBrut = rates
        ? this.payrollEngine.computeFicheDePaie(brut, { cnssActif: false, rates }).its
        : Number(p.itsNet) || 0;
      return {
        ...p,
        salaireBase: Number(p.salaireBase),
        moinsPercesArriere: Number(p.moinsPercesArriere),
        gratificationsEtrennes: Number(p.gratificationsEtrennes),
        indemnites: Number(p.indemnites),
        primeSalissures: Number(p.primeSalissures),
        salaireBrut: brut,
        cnssOuvriere: Number(p.cnssOuvriere),
        itsNet: Number(p.itsNet),
        cnssPatronale: Number(p.cnssPatronale),
        vps: Number(p.vps),
        totalRetenues: Number(p.totalRetenues),
        netAPayer: Number(p.netAPayer),
        avanceAcompte: Number(p.avanceAcompte || 0),
        opposition: Number(p.opposition || 0),
        taxesRadioTele: Number(p.taxesRadioTele || 0),
        itsBrut,
        allowancesDetail: detail || [],
      };
    });
  }

  async updatePayslip(id: string, data: any) {
    const payslip = await this.prisma.taxPayslip.findUnique({ where: { id } });
    if (!payslip) throw new NotFoundException('Fiche de paie introuvable');

    // Recalculer le brut et le net si les rubriques changent
    const updated = { ...data };
    const salaireBrut = (Number(updated.salaireBase ?? payslip.salaireBase))
      + (Number(updated.moinsPercesArriere ?? payslip.moinsPercesArriere))
      + (Number(updated.gratificationsEtrennes ?? payslip.gratificationsEtrennes))
      + (Number(updated.indemnites ?? payslip.indemnites))
      + (Number(updated.primeSalissures ?? payslip.primeSalissures));

    updated.salaireBrut = salaireBrut;

    const settings = await this.taxSettingsService.getOrCreate(payslip.tenantId);
    updated.cnssOuvriere = salaireBrut * (settings.cnssOuvriereRate / 100);
    updated.itsNet = salaireBrut * (settings.istVpsRate / 100);
    updated.cnssPatronale = salaireBrut * (settings.cnssPatronaleRate / 100);
    updated.vps = salaireBrut * (settings.istVpsRate / 100);

    const totalRetenues = (Number(updated.cnssOuvriere))
      + (Number(updated.itsNet))
      + (Number(updated.avanceAcompte ?? payslip.avanceAcompte))
      + (Number(updated.opposition ?? payslip.opposition))
      + (Number(updated.taxesRadioTele ?? payslip.taxesRadioTele));

    updated.totalRetenues = totalRetenues;
    updated.netAPayer = salaireBrut - totalRetenues;

    return this.prisma.taxPayslip.update({ where: { id }, data: updated });
  }

  async getReportHeader(tenantId: string, academicYearId: string) {
    let header = await this.prisma.financialReportHeader.findFirst({ where: { tenantId, academicYearId } });
    if (!header) {
      header = await this.prisma.financialReportHeader.create({ data: { tenantId, academicYearId } });
    }
    return header;
  }

  async updateReportHeader(tenantId: string, academicYearId: string, data: any) {
    const existing = await this.prisma.financialReportHeader.findFirst({ where: { tenantId, academicYearId } });
    if (existing) {
      return this.prisma.financialReportHeader.update({ where: { id: existing.id }, data });
    }
    return this.prisma.financialReportHeader.create({ data: { tenantId, academicYearId, ...data } });
  }
}
