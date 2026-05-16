/**
 * ============================================================================
 * HR ORION SERVICE - MODULE 5 (SCHEMA-ALIGNED)
 * ============================================================================
 *
 * Moteur d'analyse ORION pour alertes RH/Paie/CNSS en temps réel.
 * Aligné sur le schéma Prisma v2.
 *
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class HROrionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * KPIs globaux paie + CNSS pour le dashboard ORION
   */
  async getPayrollAndTaxKPIs(tenantId: string, academicYearId?: string) {
    const where: any = { tenantId };
    if (academicYearId) where.academicYearId = academicYearId;

    const payrolls = await this.prisma.payroll.findMany({ where });

    const totalLines = payrolls.length;
    const validatedLines = payrolls.filter((p) => p.status === 'VALIDATED').length;
    const paidLines = payrolls.filter((p) => p.status === 'PAID').length;
    const draftLines = payrolls.filter((p) => p.status === 'DRAFT').length;

    let totalGross = 0;
    let totalNet = 0;
    let totalCNSSEmployee = 0;
    let totalCNSSEmployer = 0;
    let totalTax = 0;

    for (const p of payrolls) {
      totalGross += Number(p.grossSalary);
      totalNet += Number(p.netSalary);
      totalCNSSEmployee += Number(p.employeeCNSS);
      totalCNSSEmployer += Number(p.employerCNSS);
      totalTax += Number(p.taxWithheld);
    }

    const deductionRate =
      totalGross > 0 ? ((totalGross - totalNet) / totalGross) * 100 : 0;

    return {
      payroll: {
        totalLines,
        validatedLines,
        paidLines,
        draftLines,
        totalGross,
        totalNet,
        totalCNSSEmployee,
        totalCNSSEmployer,
        totalTax,
        deductionRate: Math.round(deductionRate * 100) / 100,
      },
      alerts: await this.generateAlerts(tenantId),
    };
  }

  /**
   * Génère les alertes ORION pour la paie, les contrats et la conformité sociale
   */
  async generateAlerts(tenantId: string) {
    const alerts: any[] = [];

    // Récupérer le code pays du tenant
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { country: true }
    });
    const countryCode = tenant?.country?.code || 'BJ';
    
    const socialLabels: Record<string, string> = {
      'BJ': 'CNSS',
      'TG': 'CNSS',
      'SN': 'IPRES',
      'CI': 'CNPS',
      'ML': 'INPS',
      'BF': 'CNSS',
    };
    const socialLabel = socialLabels[countryCode] || 'Sécurité Sociale';

    // ── 1. Agents actifs CDI sans numéro social ──────────────────────────────
    const agentsSansCNSS = await this.prisma.staff.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        cnssNumber: null,
        contracts: { some: { status: 'ACTIVE', type: 'CDI' } },
      },
      select: { id: true, firstName: true, lastName: true },
    });

    if (agentsSansCNSS.length > 0) {
      alerts.push({
        severity: 'HIGH',
        category: 'COMPLIANCE',
        title: `Numéros ${socialLabel} manquants`,
        description: `${agentsSansCNSS.length} agent(s) CDI sans numéro ${socialLabel} enregistré.`,
        recommendation: 'Mettre à jour les fiches personnel pour conformité légale.',
        count: agentsSansCNSS.length,
      });
    }

    // ── 2. Contrats expirant dans 30 jours ────────────────────────────────
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);

    const expiringContracts = await this.prisma.contract.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        endDate: { gt: new Date(), lte: thirtyDays },
      },
      include: {
        staff: { select: { firstName: true, lastName: true } },
      },
    });

    if (expiringContracts.length > 0) {
      alerts.push({
        severity: 'MEDIUM',
        category: 'CONTRACT_EXPIRATION',
        title: 'Contrats expirant bientôt',
        description: `${expiringContracts.length} contrat(s) se terminent dans moins de 30 jours.`,
        recommendation: 'Préparer les avenants ou renouvellements.',
        count: expiringContracts.length,
        details: expiringContracts.map((c) => ({
          name: `${c.staff.firstName} ${c.staff.lastName}`,
          endDate: c.endDate,
          type: c.type,
        })),
      });
    }

    // ── 3. Lignes de paie DRAFT depuis > 5 jours ─────────────────────────
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const staleDraftPayrolls = await this.prisma.payroll.count({
      where: {
        tenantId,
        status: 'DRAFT',
        createdAt: { lte: fiveDaysAgo },
      },
    });

    if (staleDraftPayrolls > 0) {
      alerts.push({
        severity: 'MEDIUM',
        category: 'PAYROLL_PENDING',
        title: 'Paie en attente de calcul',
        description: `${staleDraftPayrolls} ligne(s) de paie non calculées depuis plus de 5 jours.`,
        recommendation: 'Lancer le calcul fiscal (CNSS + IRPP) pour finaliser la paie.',
        count: staleDraftPayrolls,
      });
    }

    // ── 4. Aucun taux social configuré pour ce tenant ───────────────────────
    const payrollRate = await this.prisma.payrollRate.findFirst({
      where: {
        tenantId,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
    });

    if (!payrollRate) {
      alerts.push({
        severity: 'CRITICAL',
        category: 'CONFIGURATION',
        title: `Taux ${socialLabel} non configuré`,
        description: `Aucun taux ${socialLabel} actif trouvé pour cet établissement.`,
        recommendation: `Configurer les taux ${socialLabel} dans les paramètres RH.`,
      });
    }

    // ── 5. Déclaration sociale du mois dernier non finalisée ────────────────
    const lastMonthEnd = new Date();
    lastMonthEnd.setDate(0); // dernier jour du mois précédent
    const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);

    const lastMonthDeclaration = await this.prisma.cNSSDeclaration.findFirst({
      where: {
        tenantId,
        periodStart: { gte: lastMonthStart },
        periodEnd: { lte: lastMonthEnd },
      },
    });

    if (!lastMonthDeclaration || lastMonthDeclaration.status === 'DRAFT') {
      alerts.push({
        severity: 'HIGH',
        category: 'CNSS_COMPLIANCE',
        title: `Déclaration ${socialLabel} mensuelle manquante`,
        description: `La déclaration ${socialLabel} de ${lastMonthStart.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} n'est pas finalisée.`,
        recommendation: `Générer et soumettre la déclaration nominative ${socialLabel}.`,
      });
    }

    return alerts;
  }

  /**
   * KPIs RH généraux (pour le dashboard principal)
   */
  async getHrKPIs(tenantId: string, academicYearId?: string) {
    const where: any = { tenantId };
    if (academicYearId) where.academicYearId = academicYearId;

    const [
      totalStaff,
      activeStaff,
      pendingLeaves,
      activeContracts,
    ] = await Promise.all([
      this.prisma.staff.count({ where: { tenantId } }),
      this.prisma.staff.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.leaveRequest.count({ where: { tenantId, status: 'PENDING' } }),
      this.prisma.contract.count({ where: { tenantId, status: 'ACTIVE' } }),
    ]);

    return {
      totalStaff,
      activeStaff,
      pendingLeaves,
      activeContracts,
      alerts: await this.generateAlerts(tenantId),
    };
  }
}
