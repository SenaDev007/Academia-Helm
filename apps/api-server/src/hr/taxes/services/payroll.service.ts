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

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private prisma: PrismaService,
    private taxSettingsService: TaxSettingsService,
  ) {}

  async getOrCreatePeriod(tenantId: string, academicYearId: string, period: string, staffType: string) {
    let period_ = await this.prisma.payrollPeriod.findFirst({
      where: { tenantId, academicYearId, period, staffType },
    });
    if (!period_) {
      period_ = await this.prisma.payrollPeriod.create({
        data: { tenantId, academicYearId, period, staffType, status: 'DRAFT' },
      });
    }
    return period_;
  }

  async generatePayslips(tenantId: string, academicYearId: string, period: string, staffType: string) {
    const settings = await this.taxSettingsService.getOrCreate(tenantId);
    const payrollPeriod = await this.getOrCreatePeriod(tenantId, academicYearId, period, staffType);

    const staffList = await this.prisma.staff.findMany({
      where: {
        tenantId,
        status: { not: 'ARCHIVED' },
        ...(staffType === 'VACATAIRE' ? { contractType: 'VACATAIRE' } : { contractType: { not: 'VACATAIRE' } }),
      },
      select: { id: true, firstName: true, lastName: true, salary: true, cnssNumber: true, position: true },
    });

    let totalGross = 0, totalDeductions = 0, totalNet = 0;

    for (const staff of staffList) {
      const salaireBase = Number(staff.salary || 0);
      const salaireBrut = salaireBase; // + autres rubriques (à compléter via UI)

      const cnssOuvriere = salaireBrut * (settings.cnssOuvriereRate / 100);
      const itsNet = salaireBrut * (settings.istVpsRate / 100);
      const cnssPatronale = salaireBrut * (settings.cnssPatronaleRate / 100);
      const vps = salaireBrut * (settings.istVpsRate / 100);

      const totalRetenues = cnssOuvriere + itsNet;
      const netAPayer = salaireBrut - totalRetenues;

      totalGross += salaireBrut;
      totalDeductions += totalRetenues;
      totalNet += netAPayer;

      const existing = await this.prisma.payslip.findFirst({
        where: { payrollPeriodId: payrollPeriod.id, staffId: staff.id },
      });

      if (existing) {
        await this.prisma.payslip.update({
          where: { id: existing.id },
          data: { salaireBase, salaireBrut, cnssOuvriere, itsNet, cnssPatronale, vps, totalRetenues, netAPayer },
        });
      } else {
        await this.prisma.payslip.create({
          data: {
            tenantId, academicYearId, staffId: staff.id, payrollPeriodId: payrollPeriod.id, period,
            salaireBase, salaireBrut, cnssOuvriere, itsNet, cnssPatronale, vps, totalRetenues, netAPayer,
          },
        });
      }
    }

    await this.prisma.payrollPeriod.update({
      where: { id: payrollPeriod.id },
      data: { totalGross, totalDeductions, totalNet },
    });

    return { payrollPeriod, payslipsCount: staffList.length, totalGross, totalDeductions, totalNet };
  }

  async getPayslips(tenantId: string, academicYearId: string, period: string) {
    return this.prisma.payslip.findMany({
      where: { tenantId, academicYearId, period },
      include: { staff: { select: { firstName: true, lastName: true, position: true, cnssNumber: true } } },
      orderBy: { staff: { lastName: 'asc' } },
    });
  }

  async updatePayslip(id: string, data: any) {
    const payslip = await this.prisma.payslip.findUnique({ where: { id } });
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

    return this.prisma.payslip.update({ where: { id }, data: updated });
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
