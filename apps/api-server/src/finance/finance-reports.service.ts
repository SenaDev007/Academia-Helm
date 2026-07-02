/**
 * SOUS-MODULE 7 — Rapports & Analytique stratégique
 *
 * Rapports disponibles :
 *   - getKpi : KPI principaux (total dû, payé, encaissement, dépenses, taux recouvrement)
 *   - getMonthlyEncaissements : encaissements groupés par mois
 *   - getClassEncaissements : encaissements groupés par classe
 *   - getExpenseByCategory : dépenses par catégorie
 *   - getComparativeYear : comparatif année N vs N-1
 *   - getTop10Impayes : top 10 élèves avec le plus gros solde impayé
 *   - getProjectionTresorerie : projection trésorerie fin trimestre/année
 *   - getCashRegisterComparative : comparatif par caisse (multi-caisses)
 *   - logExport : journaliser un export de rapport
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class FinanceReportsService {
  private readonly logger = new Logger(FinanceReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getKpi(tenantId: string, academicYearId: string) {
    const totalDue = await this.prisma.studentAccount.aggregate({
      where: { tenantId, academicYearId },
      _sum: { totalDue: true },
    });
    const totalPaid = await this.prisma.studentAccount.aggregate({
      where: { tenantId, academicYearId },
      _sum: { totalPaid: true },
    });
    const transactionsSum = await this.prisma.financeTransaction.aggregate({
      where: { tenantId, academicYearId, type: 'PAYMENT' },
      _sum: { amount: true },
    });
    const expensesSum = await this.prisma.financeExpense.aggregate({
      where: { tenantId, academicYearId, status: 'APPROVED' },
      _sum: { amount: true },
    });
    const due = Number(totalDue._sum.totalDue ?? 0);
    const paid = Number(totalPaid._sum.totalPaid ?? 0);
    const encaissement = Number(transactionsSum._sum.amount ?? 0);
    const depenses = Number(expensesSum._sum.amount ?? 0);
    const tauxRecouvrement = due > 0 ? Math.round((paid / due) * 100) : 0;
    const soldeNet = encaissement - depenses;
    return {
      totalDue: due,
      totalPaid: paid,
      totalEncaissement: encaissement,
      totalDepenses: depenses,
      soldeNet,
      tauxRecouvrement,
    };
  }

  /** Encaissements groupés par mois pour l'année scolaire. */
  async getMonthlyEncaissements(tenantId: string, academicYearId: string) {
    const data = await this.prisma.$queryRawUnsafe(`
      SELECT
        TO_CHAR("createdAt", 'YYYY-MM') as month,
        SUM(amount)::FLOAT as total
      FROM "finance_transactions"
      WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "type" = 'PAYMENT'
      GROUP BY 1
      ORDER BY 1 ASC
    `, tenantId, academicYearId);
    return data;
  }

  /** Encaissements groupés par classe. */
  async getClassEncaissements(tenantId: string, academicYearId: string) {
    const data = await this.prisma.$queryRawUnsafe(`
      SELECT
        c.name as "className",
        SUM(t.amount)::FLOAT as total
      FROM "finance_transactions" t
      JOIN "student_accounts" sa ON t."studentAccountId" = sa.id
      JOIN "students" s ON sa."studentId" = s.id
      JOIN "student_enrollments" se ON s.id = se."studentId" AND se."academicYearId" = t."academicYearId"
      JOIN "classes" c ON se."classId" = c.id
      WHERE t."tenantId" = $1 AND t."academicYearId" = $2 AND t."type" = 'PAYMENT'
      GROUP BY 1
      ORDER BY 2 DESC
    `, tenantId, academicYearId);
    return data;
  }

  /** Dépenses par catégorie. */
  async getExpenseByCategory(tenantId: string, academicYearId: string) {
    const data = await this.prisma.$queryRawUnsafe(`
      SELECT
        ec.name as category,
        SUM(fe.amount)::FLOAT as total
      FROM "finance_expenses" fe
      JOIN "expense_categories" ec ON fe."categoryId" = ec.id
      WHERE fe."tenantId" = $1 AND fe."academicYearId" = $2 AND fe."status" = 'APPROVED'
      GROUP BY 1
      ORDER BY 2 DESC
    `, tenantId, academicYearId);
    return data;
  }

  /**
   * Comparatif année N vs N-1.
   * Compare les KPI principaux entre l'année en cours et l'année précédente.
   */
  async getComparativeYear(tenantId: string, currentAcademicYearId: string) {
    // Récupère l'année précédente (par startDate DESC, en excluant l'année courante)
    const currentYear = await this.prisma.academicYear.findUnique({
      where: { id: currentAcademicYearId },
    });
    if (!currentYear) {
      throw new Error('Année scolaire introuvable');
    }

    const previousYear = await this.prisma.academicYear.findFirst({
      where: {
        tenantId,
        id: { not: currentAcademicYearId },
        startDate: { lt: currentYear.startDate },
      },
      orderBy: { startDate: 'desc' },
    });

    if (!previousYear) {
      return {
        current: await this.getKpi(tenantId, currentAcademicYearId),
        previous: null,
        deltas: null,
        message: 'Aucune année précédente trouvée pour comparaison',
      };
    }

    const current = await this.getKpi(tenantId, currentAcademicYearId);
    const previous = await this.getKpi(tenantId, previousYear.id);

    const deltas = {
      totalDue: current.totalDue - previous.totalDue,
      totalPaid: current.totalPaid - previous.totalPaid,
      totalEncaissement: current.totalEncaissement - previous.totalEncaissement,
      totalDepenses: current.totalDepenses - previous.totalDepenses,
      soldeNet: current.soldeNet - previous.soldeNet,
      tauxRecouvrement: current.tauxRecouvrement - previous.tauxRecouvrement,
    };

    return {
      current,
      previous,
      deltas,
      currentYearLabel: currentYear.label,
      previousYearLabel: previousYear.label,
    };
  }

  /**
   * Top 10 élèves avec le plus gros solde impayé.
   */
  async getTop10Impayes(tenantId: string, academicYearId: string) {
    const data = await this.prisma.$queryRawUnsafe(`
      SELECT
        sa.id as "accountId",
        s.id as "studentId",
        s."firstName",
        s."lastName",
        s."studentCode",
        s."photoUrl",
        c.name as "className",
        sa."totalDue"::FLOAT,
        sa."totalPaid"::FLOAT,
        sa."balance"::FLOAT,
        sa."status",
        sa."isBlocked"
      FROM "student_accounts" sa
      JOIN "students" s ON sa."studentId" = s.id
      LEFT JOIN "student_enrollments" se ON s.id = se."studentId" AND se."academicYearId" = sa."academicYearId"
      LEFT JOIN "classes" c ON se."classId" = c.id
      WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2 AND sa."balance" > 0
      ORDER BY sa."balance" DESC
      LIMIT 10
    `, tenantId, academicYearId);
    return data;
  }

  /**
   * Projection de trésorerie fin trimestre et fin année.
   * Basée sur la moyenne mensuelle des 3 derniers mois d'encaissements et dépenses.
   */
  async getProjectionTresorerie(tenantId: string, academicYearId: string) {
    // Solde actuel = cumul netBalance des clôtures journalières
    const closuresSum = await this.prisma.financeDailyClosure.aggregate({
      where: { tenantId, academicYearId },
      _sum: { netBalance: true },
    });
    const soldeActuel = Number(closuresSum._sum.netBalance ?? 0);

    // Moyenne mensuelle encaissements (3 derniers mois)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const monthlyEncaissement = await this.prisma.$queryRawUnsafe(`
      SELECT
        AVG(monthly_total)::FLOAT as avg_monthly
      FROM (
        SELECT
          TO_CHAR("createdAt", 'YYYY-MM') as month,
          SUM(amount) as monthly_total
        FROM "finance_transactions"
        WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "type" = 'PAYMENT' AND "createdAt" >= $3
        GROUP BY 1
      ) sub
    `, tenantId, academicYearId, threeMonthsAgo);

    const avgEncaissement = Number((monthlyEncaissement as any[])[0]?.avg_monthly ?? 0);

    // Moyenne mensuelle dépenses (3 derniers mois)
    const monthlyDepense = await this.prisma.$queryRawUnsafe(`
      SELECT
        AVG(monthly_total)::FLOAT as avg_monthly
      FROM (
        SELECT
          TO_CHAR("createdAt", 'YYYY-MM') as month,
          SUM(amount) as monthly_total
        FROM "finance_expenses"
        WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "status" = 'APPROVED' AND "createdAt" >= $3
        GROUP BY 1
      ) sub
    `, tenantId, academicYearId, threeMonthsAgo);

    const avgDepense = Number((monthlyDepense as any[])[0]?.avg_monthly ?? 0);

    // Calcul des projections
    const fluxNetMensuel = avgEncaissement - avgDepense;

    // Mois restants dans l'année scolaire
    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
    });
    const now = new Date();
    let monthsRemainingInYear = 0;
    if (academicYear?.endDate) {
      const diffMs = academicYear.endDate.getTime() - now.getTime();
      monthsRemainingInYear = Math.max(0, Math.ceil(diffMs / (30 * 24 * 60 * 60 * 1000)));
    }

    // Projection fin trimestre (3 mois)
    const projectionFinTrimestre = soldeActuel + fluxNetMensuel * 3;
    // Projection fin année
    const projectionFinAnnee = soldeActuel + fluxNetMensuel * monthsRemainingInYear;

    return {
      soldeActuel,
      avgEncaissementMensuel: avgEncaissement,
      avgDepenseMensuel: avgDepense,
      fluxNetMensuel,
      monthsRemainingInYear,
      projectionFinTrimestre,
      projectionFinAnnee,
      risqueDeficit: projectionFinAnnee < 0,
    };
  }

  /**
   * Comparatif par caisse (multi-caisses).
   * Volume total, nombre de transactions, solde courant par caisse.
   */
  async getCashRegisterComparative(tenantId: string, academicYearId: string) {
    const data = await this.prisma.$queryRawUnsafe(`
      SELECT
        cr.id,
        cr.code,
        cr.name,
        cr."currentBalance"::FLOAT,
        cr."isOpen",
        cr."isActive",
        COUNT(t.id)::INT as "transactionCount",
        COALESCE(SUM(CASE WHEN t.type = 'PAYMENT' THEN t.amount ELSE 0 END), 0)::FLOAT as "paymentTotal",
        COALESCE(SUM(CASE WHEN t.type = 'REVERSAL' THEN t.amount ELSE 0 END), 0)::FLOAT as "reversalTotal"
      FROM "cash_registers" cr
      LEFT JOIN "finance_transactions" t ON cr.id = t."cashRegisterId" AND t."academicYearId" = $2
      WHERE cr."tenantId" = $1
      GROUP BY cr.id, cr.code, cr.name, cr."currentBalance", cr."isOpen", cr."isActive"
      ORDER BY "paymentTotal" DESC
    `, tenantId, academicYearId);
    return data;
  }

  async logExport(tenantId: string, academicYearId: string, reportType: string, generatedById: string) {
    return this.prisma.financialReportExport.create({
      data: { tenantId, academicYearId, reportType, generatedById },
    });
  }
}
