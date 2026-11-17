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

/** ⭐ 125 — rubrique de la fiche fiscale pour un code d'indemnité. */
function rubriqueFor(code: string | null | undefined): string {
  return (code && PAYSLIP_DEDICATED_CODES[code]) || 'indemnites';
}

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private prisma: PrismaService,
    private taxSettingsService: TaxSettingsService,
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

    const staffList = await this.prisma.staff.findMany({
      where: {
        tenantId,
        status: { not: 'ARCHIVED' },
        // ⭐ 125 — sémantique NULL : « non-VACATAIRE » doit INCLURE les fiches
        //    sans contractType (NULL/'' — dossiers hérités). Un simple
        //    `contractType: { not: 'VACATAIRE' }` les excluerait (SQL NULL).
        ...(staffType === 'VACATAIRE'
          ? { contractType: 'VACATAIRE' }
          : { OR: [{ contractType: null }, { contractType: '' }, { contractType: { not: 'VACATAIRE' } }] }),
      },
      select: { id: true, firstName: true, lastName: true, salary: true, cnssNumber: true, position: true },
    });

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

        cnssOuvriere = salaireBrut * (settings.cnssOuvriereRate / 100);
        itsNet = salaireBrut * (settings.istVpsRate / 100);
        cnssPatronale = salaireBrut * (settings.cnssPatronaleRate / 100);
        vps = salaireBrut * (settings.istVpsRate / 100);

        totalRetenues = cnssOuvriere + itsNet;
        netAPayer = salaireBrut - totalRetenues;
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
    return this.prisma.taxPayslip.findMany({
      where,
      // ⭐ 125 — relation staff ajoutée au schéma Prisma (TaxPayslip.staff) :
      //    l'include échouait avant (PrismaClientValidationError « Champ "staff" »).
      include: { staff: { select: { firstName: true, lastName: true, position: true, cnssNumber: true, maritalStatus: true, hireDate: true, contractType: true } } },
      orderBy: { staff: { lastName: 'asc' } },
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
