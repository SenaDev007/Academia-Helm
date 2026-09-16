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
import { AccessScope } from '../common/context/access-scope.service';

@Injectable()
export class FinanceReportsService {
  private readonly logger = new Logger(FinanceReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getKpi(tenantId: string, academicYearId: string, scope?: AccessScope | null) {
    // ⭐ D3 (matrice P5) : consolidé DU PÉRIMÈTRE du compte level-scoped.
    // NOTE dimension niveau : student_accounts/finance_transactions portent le
    // niveau de l'ÉLÈVE ; finance_expenses et FeeStructure n'ont PAS de colonne
    // niveau (frais globaux sans classe = tous niveaux) → filtrage via les
    // chemins disponibles uniquement.
    const lvlStudent = scope?.resolved && !scope.allLevels
      ? { student: { schoolLevelId: { in: scope.levelIds } } } : undefined;
    const lvlTx = scope?.resolved && !scope.allLevels
      ? { studentAccount: { student: { schoolLevelId: { in: scope.levelIds } } } } : undefined;
    const lvlFee = scope?.resolved && !scope.allLevels
      ? { OR: [{ classId: null }, { class: { schoolLevelId: { in: scope.levelIds } } }] } : undefined;
    const totalDue = await this.prisma.studentAccount.aggregate({
      where: { tenantId, academicYearId, ...(lvlStudent ?? {}) },
      _sum: { totalDue: true },
    });
    const totalPaid = await this.prisma.studentAccount.aggregate({
      where: { tenantId, academicYearId, ...(lvlStudent ?? {}) },
      _sum: { totalPaid: true },
    });
    const transactionsSum = await this.prisma.financeTransaction.aggregate({
      where: { tenantId, academicYearId, type: 'PAYMENT', ...(lvlTx ?? {}) },
      _sum: { amount: true },
    });
    // finance_expenses : AUCUNE dimension niveau (modèle sans schoolLevelId) —
    // dépenses consolidées globales, documenté D3.
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

    // ⭐ Task 30 : Calculer le prévisionnel global (sans personnalisations)
    // et le montant total des réductions (personnalisations).
    // Pour chaque fee_override : réduction = feeStructure.totalAmount - override.customAmount
    const overrides = await this.prisma.feeOverride.findMany({
      where: {
        // ⭐ D3 : frais globaux (sans classe = tous niveaux) OU frais de classe
        //    du périmètre — FeeStructure n'a pas de schoolLevelId direct.
        feeStructure: { tenantId, academicYearId, ...(lvlFee ?? {}) },
      },
      include: {
        feeStructure: { select: { totalAmount: true } },
      },
    });
    let totalReductions = 0;
    for (const o of overrides) {
      const original = Number(o.feeStructure.totalAmount ?? 0);
      const custom = Number(o.customAmount ?? 0);
      const reduction = Math.max(0, original - custom);
      totalReductions += reduction;
    }
    // Prévisionnel global = totalDue (net) + réductions
    // (car totalDue inclut déjà les personnalisations = montants réduits)
    const previsonnementGlobal = due + totalReductions;

    return {
      totalDue: due,                      // Prévisionnel net (après personnalisations)
      previsonnementGlobal,               // Prévisionnel global (sans personnalisations)
      totalReductions,                    // Montant total des réductions (personnalisations)
      totalPaid: paid,
      totalEncaissement: encaissement,
      totalDepenses: depenses,
      soldeNet,
      tauxRecouvrement,
    };
  }

  /**
   * ⭐ V1 audit — KPI consolidés PAR NIVEAU SCOLAIRE.
   * Utilisé par la page « Agrégation & Bilan Global » (Finance) qui appelait
   * auparavant GET /finance/reports (racine inexistante) → 0 FCFA partout.
   * Réutilise getKpi avec un scope synthétique mono-niveau par itération.
   */
  async getKpiByLevel(tenantId: string, academicYearId: string) {
    const levels = await this.prisma.schoolLevel.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });

    const results = [];
    for (const level of levels) {
      const scope = {
        resolved: true,
        transverse: false,
        isTeacher: false,
        isAdmin: true,
        levelCodes: [level.code],
        levelIds: [level.id],
        allLevels: false,
        trackCodes: [],
        trackIds: [],
        allTracks: true,
        locale: 'fr' as const,
      } as AccessScope;

      try {
        const kpi = await this.getKpi(tenantId, academicYearId, scope);
        results.push({
          levelId: level.id,
          levelCode: level.code,
          levelLabel: level.name,
          ...kpi,
        });
      } catch {
        // un niveau en erreur ne doit pas casser l'agrégation globale
        results.push({
          levelId: level.id,
          levelCode: level.code,
          levelLabel: level.name,
          totalDue: 0,
          totalPaid: 0,
          totalEncaissement: 0,
          totalDepenses: 0,
          soldeNet: 0,
          tauxRecouvrement: 0,
        });
      }
    }
    return results;
  }

  /**
   * ⭐ Statistiques du jour : encaissements et dépenses pour aujourd'hui.
   * Utilisé par le tableau de bord ("Recette du jour").
   */
  async getTodayStats(tenantId: string, scope?: AccessScope | null) {
    const lvlTx = scope?.resolved && !scope.allLevels
      ? { studentAccount: { student: { schoolLevelId: { in: scope.levelIds } } } } : undefined;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [incomeAgg, incomeCount, expenseAgg] = await Promise.all([
      this.prisma.financeTransaction.aggregate({
        where: {
          tenantId,
          type: 'PAYMENT',
          createdAt: { gte: today, lt: tomorrow },
          ...(lvlTx ?? {}),
        },
        _sum: { amount: true },
      }).catch(() => ({ _sum: { amount: 0 } })),
      this.prisma.financeTransaction.count({
        where: {
          tenantId,
          type: 'PAYMENT',
          createdAt: { gte: today, lt: tomorrow },
          ...(lvlTx ?? {}),
        },
      }).catch(() => 0),
      this.prisma.financeExpense.aggregate({
        where: {
          tenantId,
          status: 'APPROVED',
          createdAt: { gte: today, lt: tomorrow },
        },
        _sum: { amount: true },
      }).catch(() => ({ _sum: { amount: 0 } })),
    ]);

    const totalIncome = Number(incomeAgg._sum?.amount ?? 0);
    const totalExpenses = Number(expenseAgg._sum?.amount ?? 0);

    return {
      total: totalIncome,
      count: incomeCount,
      expenses: totalExpenses,
      net: totalIncome - totalExpenses,
      date: today.toISOString(),
    };
  }

  /** Encaissements groupés par mois pour l'année scolaire. */
  async getMonthlyEncaissements(tenantId: string, academicYearId: string, scope?: AccessScope | null) {
    // ⭐ D3 : consolidé du périmètre (niveau étudiant) pour les level-scoped
    const lvl = scope?.resolved && !scope.allLevels;
    const data = await this.prisma.$queryRawUnsafe(`
      SELECT
        TO_CHAR(t."createdAt", 'YYYY-MM') as month,
        SUM(t.amount)::FLOAT as total
      FROM "finance_transactions" t
      JOIN "student_accounts" sa ON t."studentAccountId" = sa.id
      JOIN "students" s ON sa."studentId" = s.id
      WHERE t."tenantId" = $1 AND t."academicYearId" = $2 AND t."type" = 'PAYMENT'
        ${lvl ? 'AND s."schoolLevelId" = ANY($3)' : ''}
      GROUP BY 1
      ORDER BY 1 ASC
    `, ...(lvl ? [tenantId, academicYearId, scope!.levelIds] : [tenantId, academicYearId]));
    return data;
  }

  /** Encaissements groupés par classe. */
  async getClassEncaissements(tenantId: string, academicYearId: string, scope?: AccessScope | null) {
    const lvl = scope?.resolved && !scope.allLevels;
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
        ${lvl ? 'AND s."schoolLevelId" = ANY($3)' : ''}
      GROUP BY 1
      ORDER BY 2 DESC
    `, ...(lvl ? [tenantId, academicYearId, scope!.levelIds] : [tenantId, academicYearId]));
    return data;
  }

  /** Dépenses par catégorie. */
  async getExpenseByCategory(tenantId: string, academicYearId: string, _scope?: AccessScope | null) {
    // ⭐ finance_expenses : aucune dimension niveau (documenté D3) — pas de filtre
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
  async getComparativeYear(tenantId: string, currentAcademicYearId: string, scope?: AccessScope | null) {
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
        current: await this.getKpi(tenantId, currentAcademicYearId, scope),
        previous: null,
        deltas: null,
        message: 'Aucune année précédente trouvée pour comparaison',
      };
    }

    const current = await this.getKpi(tenantId, currentAcademicYearId, scope);
    const previous = await this.getKpi(tenantId, previousYear.id, scope);

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
  async getTop10Impayes(tenantId: string, academicYearId: string, scope?: AccessScope | null) {
    const lvl = scope?.resolved && !scope.allLevels;
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
        ${lvl ? 'AND s."schoolLevelId" = ANY($3)' : ''}
      ORDER BY sa."balance" DESC
      LIMIT 10
    `, ...(lvl ? [tenantId, academicYearId, scope!.levelIds] : [tenantId, academicYearId]));
    return data;
  }

  /**
   * Projection de trésorerie fin trimestre et fin année.
   * Basée sur la moyenne mensuelle des 3 derniers mois d'encaissements et dépenses.
   */
  async getProjectionTresorerie(tenantId: string, academicYearId: string, scope?: AccessScope | null) {
    const lvl = scope?.resolved && !scope.allLevels;
    // Solde actuel = cumul netBalance des clôtures journalières
    // (⭐ pas de dimension niveau sur les clôtures — vision caisse globale)
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
          TO_CHAR(t."createdAt", 'YYYY-MM') as month,
          SUM(t.amount) as monthly_total
        FROM "finance_transactions" t
        JOIN "student_accounts" sa ON t."studentAccountId" = sa.id
        JOIN "students" s ON sa."studentId" = s.id
        WHERE t."tenantId" = $1 AND t."academicYearId" = $2 AND t."type" = 'PAYMENT' AND t."createdAt" >= $3
          ${lvl ? 'AND s."schoolLevelId" = ANY($4)' : ''}
        GROUP BY 1
      ) sub
    `, ...(lvl ? [tenantId, academicYearId, threeMonthsAgo, scope!.levelIds] : [tenantId, academicYearId, threeMonthsAgo]));

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

  /**
   * Journal de caisse — liste paginée des transactions filtrées par
   * caisse + plage de dates, avec le caissier et le solde théorique calculé.
   *
   * Utilisé par le rapport "Journal de caisse" dans l'onglet Rapports financiers.
   */
  async getJournalCaisse(
    tenantId: string,
    academicYearId: string,
    filters: { dateFrom?: string; dateTo?: string; cashRegisterId?: string; type?: string },
    scope?: AccessScope | null,
  ) {
    const lvl = scope?.resolved && !scope.allLevels;
    const where: string[] = [
      `t."tenantId" = $1`,
      `t."academicYearId" = $2`,
    ];
    const params: any[] = [tenantId, academicYearId];
    let paramIdx = 3;

    // ⭐ D3 : périmètre niveau du compte (la jointure s existe déjà dans le SQL)
    if (lvl) {
      where.push(`s."schoolLevelId" = ANY($${paramIdx})`);
      params.push(scope!.levelIds);
      paramIdx++;
    }

    if (filters.dateFrom) {
      where.push(`t."createdAt" >= $${paramIdx}`);
      params.push(new Date(filters.dateFrom + 'T00:00:00'));
      paramIdx++;
    }
    if (filters.dateTo) {
      where.push(`t."createdAt" <= $${paramIdx}`);
      params.push(new Date(filters.dateTo + 'T23:59:59'));
      paramIdx++;
    }
    if (filters.cashRegisterId) {
      where.push(`t."cashRegisterId" = $${paramIdx}`);
      params.push(filters.cashRegisterId);
      paramIdx++;
    }
    if (filters.type) {
      where.push(`t."type" = $${paramIdx}`);
      params.push(filters.type);
      paramIdx++;
    }

    const sql = `
      SELECT
        t.id,
        t."receiptNumber",
        t.amount::FLOAT,
        t.type,
        t."paymentMethod",
        t.reference,
        t."createdAt",
        t."cashRegisterId",
        cr.code AS "cashRegisterCode",
        cr.name AS "cashRegisterName",
        t."studentAccountId",
        s."firstName" AS "studentFirstName",
        s."lastName" AS "studentLastName",
        s."studentCode",
        c.name AS "className",
        u."firstName" AS "cashierFirstName",
        u."lastName" AS "cashierLastName"
      FROM "finance_transactions" t
      LEFT JOIN "cash_registers" cr ON t."cashRegisterId" = cr.id
      LEFT JOIN "student_accounts" sa ON t."studentAccountId" = sa.id
      LEFT JOIN "students" s ON sa."studentId" = s.id
      LEFT JOIN "student_enrollments" se ON s.id = se."studentId" AND se."academicYearId" = t."academicYearId"
      LEFT JOIN "classes" c ON se."classId" = c.id
      LEFT JOIN "users" u ON t."cashierId" = u.id
      WHERE ${where.join(' AND ')}
      ORDER BY t."createdAt" DESC
      LIMIT 1000
    `;
    const rows = await this.prisma.$queryRawUnsafe(sql, ...params);

    // Calcul des totaux + solde net
    const typed = rows as any[];
    const totalIn = typed
      .filter((r) => r.type === 'PAYMENT')
      .reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const totalOut = typed
      .filter((r) => r.type === 'REVERSAL')
      .reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const netBalance = totalIn - totalOut;

    return {
      rows: typed,
      totals: {
        totalIn,
        totalOut,
        netBalance,
        count: typed.length,
      },
    };
  }

  /**
   * Bilan périodique — agrégats encaissements / dépenses / solde net sur une
   * période filtrée par date, classe et caisse.
   *
   * Utilisé par le rapport "Bilan périodique" dans l'onglet Rapports financiers.
   */
  async getBilanPeriodique(
    tenantId: string,
    academicYearId: string,
    filters: { dateFrom?: string; dateTo?: string; classId?: string; cashRegisterId?: string },
    scope?: AccessScope | null,
  ) {
    const lvl = scope?.resolved && !scope.allLevels;
    // Construction des conditions dynamiques pour les transactions
    const txWhere: string[] = [
      `t."tenantId" = $1`,
      `t."academicYearId" = $2`,
      `t.type = 'PAYMENT'`,
    ];
    const txParams: any[] = [tenantId, academicYearId];
    let txIdx = 3;

    // ⭐ D3 : périmètre niveau du compte (jointures s/fe déjà présentes)
    if (lvl) {
      txWhere.push(`s."schoolLevelId" = ANY($${txIdx})`);
      txParams.push(scope!.levelIds);
      txIdx++;
    }

    if (filters.dateFrom) {
      txWhere.push(`t."createdAt" >= $${txIdx}`);
      txParams.push(new Date(filters.dateFrom + 'T00:00:00'));
      txIdx++;
    }
    if (filters.dateTo) {
      txWhere.push(`t."createdAt" <= $${txIdx}`);
      txParams.push(new Date(filters.dateTo + 'T23:59:59'));
      txIdx++;
    }
    if (filters.cashRegisterId) {
      txWhere.push(`t."cashRegisterId" = $${txIdx}`);
      txParams.push(filters.cashRegisterId);
      txIdx++;
    }
    if (filters.classId) {
      txWhere.push(`se."classId" = $${txIdx}`);
      txParams.push(filters.classId);
      txIdx++;
    }

    // Total encaissements
    const encaissementsSql = `
      SELECT COALESCE(SUM(t.amount), 0)::FLOAT AS total
      FROM "finance_transactions" t
      LEFT JOIN "student_accounts" sa ON t."studentAccountId" = sa.id
      LEFT JOIN "students" s ON sa."studentId" = s.id
      LEFT JOIN "student_enrollments" se ON s.id = se."studentId" AND se."academicYearId" = t."academicYearId"
      WHERE ${txWhere.join(' AND ')}
    `;
    const encaissementResult = await this.prisma.$queryRawUnsafe(encaissementsSql, ...txParams);
    const totalEncaissement = Number((encaissementResult as any[])[0]?.total ?? 0);

    // Total dépenses (filtré par date + catégorie)
    const exWhere: string[] = [
      `fe."tenantId" = $1`,
      `fe."academicYearId" = $2`,
      `fe.status = 'APPROVED'`,
    ];
    const exParams: any[] = [tenantId, academicYearId];
    let exIdx = 3;


    if (filters.dateFrom) {
      exWhere.push(`fe."expenseDate" >= $${exIdx}`);
      exParams.push(new Date(filters.dateFrom + 'T00:00:00'));
      exIdx++;
    }
    if (filters.dateTo) {
      exWhere.push(`fe."expenseDate" <= $${exIdx}`);
      exParams.push(new Date(filters.dateTo + 'T23:59:59'));
      exIdx++;
    }
    if (filters.cashRegisterId) {
      exWhere.push(`fe."cashRegisterId" = $${exIdx}`);
      exParams.push(filters.cashRegisterId);
      exIdx++;
    }

    const depensesSql = `
      SELECT COALESCE(SUM(fe.amount), 0)::FLOAT AS total
      FROM "finance_expenses" fe
      WHERE ${exWhere.join(' AND ')}
    `;
    const depensesResult = await this.prisma.$queryRawUnsafe(depensesSql, ...exParams);
    const totalDepenses = Number((depensesResult as any[])[0]?.total ?? 0);

    // Détail par classe (encaissements)
    const classSql = `
      SELECT
        c.name AS "className",
        COALESCE(SUM(t.amount), 0)::FLOAT AS total,
        COUNT(t.id)::INT AS count
      FROM "finance_transactions" t
      LEFT JOIN "student_accounts" sa ON t."studentAccountId" = sa.id
      LEFT JOIN "students" s ON sa."studentId" = s.id
      LEFT JOIN "student_enrollments" se ON s.id = se."studentId" AND se."academicYearId" = t."academicYearId"
      LEFT JOIN "classes" c ON se."classId" = c.id
      WHERE ${txWhere.join(' AND ')} AND c.id IS NOT NULL
      GROUP BY c.name
      ORDER BY total DESC
    `;
    const classData = await this.prisma.$queryRawUnsafe(classSql, ...txParams);

    // Détail par catégorie de dépense
    const catSql = `
      SELECT
        ec.name AS category,
        COALESCE(SUM(fe.amount), 0)::FLOAT AS total,
        COUNT(fe.id)::INT AS count
      FROM "finance_expenses" fe
      LEFT JOIN "expense_categories" ec ON fe."categoryId" = ec.id
      WHERE ${exWhere.join(' AND ')}
      GROUP BY ec.name
      ORDER BY total DESC
    `;
    const categoryData = await this.prisma.$queryRawUnsafe(catSql, ...exParams);

    return {
      periode: {
        dateFrom: filters.dateFrom || null,
        dateTo: filters.dateTo || null,
      },
      kpi: {
        totalEncaissement,
        totalDepenses,
        soldeNet: totalEncaissement - totalDepenses,
        transactionCount: 0, // sera calculé par l'appelant si besoin
      },
      parClasse: classData,
      parCategorie: categoryData,
    };
  }

  /**
   * Transactions suspectes — annulations + montants inhabituels.
   *
   * Utilisé par l'onglet Contrôle & Audit.
   */
  async getSuspiciousTransactions(
    tenantId: string,
    academicYearId: string,
    options: { days?: number; minAmount?: number } = {},
    scope?: AccessScope | null,
  ) {
    const lvlTx = scope?.resolved && !scope.allLevels
      ? { studentAccount: { student: { schoolLevelId: { in: scope.levelIds } } } } : undefined;
    const days = options.days ?? 30;
    const minAmount = options.minAmount ?? 100000;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // 1. Annulations récentes
    const reversals = await this.prisma.financeTransaction.findMany({
      where: {
        tenantId,
        academicYearId,
        type: 'REVERSAL',
        createdAt: { gte: since },
        ...(lvlTx ?? {}),
      },
      include: {
        studentAccount: { include: { student: { select: { firstName: true, lastName: true, studentCode: true } } } },
        cashier: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // 2. Transactions nocturnes (entre 21h et 6h) — potentiellement suspectes
    const nocturnal = await this.prisma.$queryRawUnsafe(`
      SELECT
        t.id,
        t."receiptNumber",
        t.amount::FLOAT,
        t.type,
        t."paymentMethod",
        t."createdAt",
        s."firstName" AS "studentFirstName",
        s."lastName" AS "studentLastName",
        u."firstName" AS "cashierFirstName",
        u."lastName" AS "cashierLastName"
      FROM "finance_transactions" t
      LEFT JOIN "student_accounts" sa ON t."studentAccountId" = sa.id
      LEFT JOIN "students" s ON sa."studentId" = s.id
      LEFT JOIN "users" u ON t."cashierId" = u.id
      WHERE t."tenantId" = $1
        AND t."academicYearId" = $2
        AND t."createdAt" >= $3
        ${lvlTx ? 'AND s."schoolLevelId" = ANY($4)' : ''}
        AND (EXTRACT(HOUR FROM t."createdAt") >= 21 OR EXTRACT(HOUR FROM t."createdAt") < 6)
      ORDER BY t."createdAt" DESC
      LIMIT 50
    `, ...(lvlTx ? [tenantId, academicYearId, since, scope!.levelIds] : [tenantId, academicYearId, since]));

    // 3. Transactions au-dessus du seuil
    const highValue = await this.prisma.financeTransaction.findMany({
      where: {
        tenantId,
        academicYearId,
        type: 'PAYMENT',
        amount: { gte: minAmount },
        createdAt: { gte: since },
        ...(lvlTx ?? {}),
      },
      include: {
        studentAccount: { include: { student: { select: { firstName: true, lastName: true, studentCode: true } } } },
        cashier: { select: { firstName: true, lastName: true } },
      },
      orderBy: { amount: 'desc' },
      take: 50,
    });

    return {
      reversals: reversals as any[],
      nocturnal: nocturnal as any[],
      highValue: highValue as any[],
      stats: {
        reversalCount: reversals.length,
        reversalTotal: reversals.reduce((s, r) => s + Number(r.amount), 0),
        nocturnalCount: (nocturnal as any[]).length,
        highValueCount: highValue.length,
        highValueTotal: highValue.reduce((s, r) => s + Number(r.amount), 0),
      },
    };
  }

  /**
   * Écarts caisse — comparaison du solde théorique (somme des transactions)
   * avec le solde courant déclaré.
   *
   * Utilisé par l'onglet Contrôle & Audit.
   */
  async getCashMismatches(tenantId: string, academicYearId: string) {
    const rows = await this.prisma.$queryRawUnsafe(`
      SELECT
        cr.id,
        cr.code,
        cr.name,
        cr."currentBalance"::FLOAT,
        cr."openingBalance"::FLOAT,
        cr."isOpen",
        cr."isActive",
        COALESCE(SUM(CASE WHEN t.type = 'PAYMENT' THEN t.amount ELSE 0 END), 0)::FLOAT AS "theoreticalIn",
        COALESCE(SUM(CASE WHEN t.type = 'REVERSAL' THEN t.amount ELSE 0 END), 0)::FLOAT AS "theoreticalOut",
        (
          cr."openingBalance" +
          COALESCE(SUM(CASE WHEN t.type = 'PAYMENT' THEN t.amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN t.type = 'REVERSAL' THEN t.amount ELSE 0 END), 0)
        )::FLOAT AS "theoreticalBalance",
        (
          cr."currentBalance" -
          (
            cr."openingBalance" +
            COALESCE(SUM(CASE WHEN t.type = 'PAYMENT' THEN t.amount ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN t.type = 'REVERSAL' THEN t.amount ELSE 0 END), 0)
          )
        )::FLOAT AS "ecart"
      FROM "cash_registers" cr
      LEFT JOIN "finance_transactions" t ON cr.id = t."cashRegisterId" AND t."academicYearId" = $2
      WHERE cr."tenantId" = $1 AND cr."isActive" = true
      GROUP BY cr.id, cr.code, cr.name, cr."currentBalance", cr."openingBalance", cr."isOpen", cr."isActive"
      ORDER BY ABS(
        cr."currentBalance" -
        (
          cr."openingBalance" +
          COALESCE(SUM(CASE WHEN t.type = 'PAYMENT' THEN t.amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN t.type = 'REVERSAL' THEN t.amount ELSE 0 END), 0)
        )
      ) DESC
    `, tenantId, academicYearId);
    return rows;
  }

  /**
   * Clôtures manquées — identifie les jours où une caisse ouverte n'a pas
   * fait l'objet d'une clôture journalière.
   *
   * Utilisé par l'onglet Contrôle & Audit.
   */
  async getMissedClosures(tenantId: string, academicYearId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Récupère toutes les clôtures de la période
    const closures = await this.prisma.financeDailyClosure.findMany({
      where: {
        tenantId,
        academicYearId,
        closureDate: { gte: since },
      },
      select: { closureDate: true, cashRegisterId: true },
    });

    // Récupère les caisses actives
    const activeRegisters = await this.prisma.cashRegister.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, code: true, name: true },
    });

    // Construit l'ensemble des jours attendus (hors week-end)
    const expectedDays: { date: string; dayName: string }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cursor = new Date(since);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= today) {
      const day = cursor.getDay();
      // 0 = dimanche, 6 = samedi — on exclut le dimanche
      if (day !== 0) {
        expectedDays.push({
          date: cursor.toISOString().slice(0, 10),
          dayName: cursor.toLocaleDateString('fr-FR', { weekday: 'long' }),
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    // Pour chaque caisse, identifie les jours manquants
    const closureSet = new Set(
      closures.map((c) => `${c.cashRegisterId}|${c.closureDate.toISOString().slice(0, 10)}`),
    );
    const missed: any[] = [];
    for (const reg of activeRegisters) {
      for (const day of expectedDays) {
        const key = `${reg.id}|${day.date}`;
        if (!closureSet.has(key)) {
          missed.push({
            cashRegisterId: reg.id,
            cashRegisterCode: reg.code,
            cashRegisterName: reg.name,
            missedDate: day.date,
            dayName: day.dayName,
          });
        }
      }
    }

    return {
      missed,
      stats: {
        totalExpected: expectedDays.length * activeRegisters.length,
        totalMissed: missed.length,
        totalDone: closures.length,
        missRate: expectedDays.length * activeRegisters.length > 0
          ? Math.round((missed.length / (expectedDays.length * activeRegisters.length)) * 100)
          : 0,
      },
    };
  }

  /**
   * Comptable le plus actif — top comptables par nombre de transactions
   * et volume total traité.
   *
   * Utilisé par l'onglet Contrôle & Audit.
   */
  async getTopAccountants(tenantId: string, academicYearId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await this.prisma.$queryRawUnsafe(`
      SELECT
        u.id,
        u."firstName",
        u."lastName",
        u.email,
        r.name AS role,
        COUNT(t.id)::INT AS "transactionCount",
        COALESCE(SUM(CASE WHEN t.type = 'PAYMENT' THEN t.amount ELSE 0 END), 0)::FLOAT AS "paymentTotal",
        COALESCE(SUM(CASE WHEN t.type = 'REVERSAL' THEN t.amount ELSE 0 END), 0)::FLOAT AS "reversalTotal",
        COUNT(DISTINCT t."cashRegisterId")::INT AS "cashRegistersUsed"
      FROM "users" u
      LEFT JOIN "finance_transactions" t ON u.id = t."cashierId"
        AND t."tenantId" = $1 AND t."academicYearId" = $2 AND t."createdAt" >= $3
      LEFT JOIN "roles" r ON u."roleId" = r.id
      WHERE u."tenantId" = $1
        AND (t.id IS NOT NULL)
      GROUP BY u.id, u."firstName", u."lastName", u.email, r.name
      ORDER BY "transactionCount" DESC
      LIMIT 10
    `, tenantId, academicYearId, since);
    return rows;
  }

  async logExport(tenantId: string, academicYearId: string, reportType: string, generatedById: string) {
    return this.prisma.financialReportExport.create({
      data: { tenantId, academicYearId, reportType, generatedById },
    });
  }
}
