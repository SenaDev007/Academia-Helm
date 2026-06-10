/**
 * ============================================================================
 * HR ORION SERVICE - MODULE 5 (SCHEMA-ALIGNED v2)
 * ============================================================================
 *
 * Moteur d'analyse ORION pour alertes RH/Paie/CNSS en temps réel.
 * Aligné sur les modèles Payroll (batch), PayrollItem (lignes),
 * CNSSRate, EmployeeCNSS, CNSSDeclaration.
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

    // Utiliser PayrollItem pour les KPIs détaillés
    const payrollItems = await this.prisma.payrollItem.findMany({ where });

    const totalLines = payrollItems.length;
    const validatedLines = payrollItems.filter((p) => p.status === 'VALIDATED').length;
    const paidLines = payrollItems.filter((p) => p.status === 'PAID').length;
    const pendingLines = payrollItems.filter((p) => p.status === 'PENDING').length;

    let totalGross = 0;
    let totalNet = 0;
    let totalCNSSEmployee = 0;
    let totalCNSSEmployer = 0;
    let totalTax = 0;

    for (const p of payrollItems) {
      totalGross += Number(p.grossSalary);
      totalNet += Number(p.netSalary);
      totalCNSSEmployee += Number(p.cnssEmployee);
      totalCNSSEmployer += Number(p.cnssEmployer);
      totalTax += Number(p.irppAmount);
    }

    const deductionRate =
      totalGross > 0 ? ((totalGross - totalNet) / totalGross) * 100 : 0;

    return {
      payroll: {
        totalLines,
        validatedLines,
        paidLines,
        pendingLines,
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
      include: { country: true },
    });
    const countryCode = tenant?.country?.code || 'BJ';

    const socialLabels: Record<string, string> = {
      'BJ': 'CNSS', 'TG': 'CNSS', 'SN': 'IPRES',
      'CI': 'CNPS', 'ML': 'INPS', 'BF': 'CNSS',
    };
    const socialLabel = socialLabels[countryCode] || 'Sécurité Sociale';

    // ── 1. Agents actifs CDI sans affiliation CNSS ──────────────────────────
    const agentsSansCNSS = await this.prisma.staff.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        OR: [
          { employeeCNSS: null },
          { employeeCNSS: { isActive: false } },
          { employeeCNSS: { cnssNumber: null } },
        ],
        contracts: { some: { status: 'ACTIVE', contractType: 'CDI' } },
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
          type: c.contractType,
        })),
      });
    }

    // ── 3. Contrats en attente de signature depuis > 7 jours ──────────────
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const unsignedContracts = await this.prisma.contract.findMany({
      where: {
        tenantId,
        status: 'DRAFT',
        signedAt: null,
        createdAt: { lte: sevenDaysAgo },
      },
      include: {
        staff: { select: { firstName: true, lastName: true, status: true } },
      },
    });

    if (unsignedContracts.length > 0) {
      alerts.push({
        severity: 'HIGH',
        category: 'CONTRACT_PENDING_SIGNATURE',
        title: 'Contrats en attente de signature',
        description: `${unsignedContracts.length} contrat(s) non signé(s) depuis plus de 7 jours. Les collaborateurs concernés ne sont pas encore actifs.`,
        recommendation: 'Procéder à la signature des contrats pour activer les collaborateurs.',
        count: unsignedContracts.length,
        details: unsignedContracts.map((c) => ({
          name: `${c.staff?.firstName} ${c.staff?.lastName}`,
          contractType: c.contractType,
          staffStatus: c.staff?.status,
        })),
      });
    }

    // ── 4. Lots de paie DRAFT depuis > 5 jours ─────────────────────────
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
        description: `${staleDraftPayrolls} lot(s) de paie non calculés depuis plus de 5 jours.`,
        recommendation: 'Lancer le calcul fiscal (CNSS + IRPP) pour finaliser la paie.',
        count: staleDraftPayrolls,
      });
    }

    // ── 4. Aucun taux social configuré pour le pays ───────────────────────
    const cnssRate = await this.prisma.cNSSRate.findFirst({
      where: {
        countryCode,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
    });

    if (!cnssRate) {
      alerts.push({
        severity: 'CRITICAL',
        category: 'CONFIGURATION',
        title: `Taux ${socialLabel} non configuré`,
        description: `Aucun taux ${socialLabel} actif trouvé pour le pays ${countryCode}.`,
        recommendation: `Configurer les taux ${socialLabel} dans les paramètres RH.`,
      });
    }

    // ── 5. Déclaration sociale du mois dernier non finalisée ────────────────
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

    const lastMonthDeclaration = await this.prisma.cNSSDeclaration.findFirst({
      where: {
        tenantId,
        month: lastMonthStr,
      },
    });

    if (!lastMonthDeclaration || lastMonthDeclaration.status === 'DRAFT') {
      alerts.push({
        severity: 'HIGH',
        category: 'CNSS_COMPLIANCE',
        title: `Déclaration ${socialLabel} mensuelle manquante`,
        description: `La déclaration ${socialLabel} de ${lastMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} n'est pas finalisée.`,
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
      pendingSignatureStaff,
      pendingLeaves,
      activeContracts,
      pendingSignatureContracts,
    ] = await Promise.all([
      this.prisma.staff.count({ where: { tenantId } }),
      this.prisma.staff.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.staff.count({ where: { tenantId, status: 'PENDING_SIGNATURE' } }),
      this.prisma.leaveRequest.count({ where: { tenantId, status: 'PENDING' } }),
      this.prisma.contract.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.contract.count({ where: { tenantId, status: 'DRAFT' } }),
    ]);

    return {
      totalStaff,
      activeStaff,
      pendingSignatureStaff,
      pendingLeaves,
      activeContracts,
      pendingSignatureContracts,
      alerts: await this.generateAlerts(tenantId),
    };
  }
}
