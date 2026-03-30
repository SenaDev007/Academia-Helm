/**
 * ============================================================================
 * ORION ALERTS SERVICE
 * ============================================================================
 * 
 * Service pour générer des alertes ORION basées sur :
 * - QHSE+ (incidents critiques, risques élevés)
 * - KPI Objectives (écarts objectif vs réel)
 * - Automatisation (règles déclenchées)
 * 
 * PRINCIPE : ORION est READ-ONLY, il observe et alerte uniquement
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export enum OrionAlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum OrionAlertType {
  PEDAGOGICAL = 'PEDAGOGICAL',
  FINANCIAL = 'FINANCIAL',
  QHSE = 'QHSE',
  RH = 'RH',
  OPERATIONAL = 'OPERATIONAL',
  STRATEGIC = 'STRATEGIC',
}

@Injectable()
export class OrionAlertsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Génère des alertes basées sur les incidents QHSE critiques
   */
  async generateQhsAlerts(tenantId: string, academicYearId?: string): Promise<any[]> {
    const where: any = {
      tenantId,
      gravity: 'CRITIQUE',
      status: { in: ['OUVERT', 'EN_COURS'] },
    };

    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    const criticalIncidents = await this.prisma.qhsIncident.findMany({
      where,
      include: {
        academicYear: { select: { label: true } },
        schoolLevel: { select: { code: true, label: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Vérifier les incidents critiques répétés
    // Note: groupBy avec having cause parfois des erreurs TypeScript circulaires
    // Utiliser une approche alternative
    const repeatedIncidents = await this.prisma.qhsIncident.groupBy({
      by: ['type', 'category'],
      where: {
        tenantId,
        gravity: 'CRITIQUE',
        ...(academicYearId && { academicYearId }),
      },
      _count: {
        type: true,
        category: true,
      },
      // Filtrer après avec _count au lieu de having pour éviter erreurs TypeScript
    });

    const alerts: any[] = [];

    // Alerte pour incidents critiques ouverts
    if (criticalIncidents.length > 0) {
      alerts.push({
        type: 'QHSE',
        severity: 'CRITICAL',
        title: `${criticalIncidents.length} incident(s) critique(s) en cours`,
        description: `Des incidents critiques nécessitent une attention immédiate.`,
        recommendation: 'Examiner et traiter les incidents critiques dans le module QHSE.',
        metadata: {
          source: 'QHSE_INCIDENTS',
          count: criticalIncidents.length,
          incidents: criticalIncidents.map((i) => ({
            id: i.id,
            title: i.title,
            type: i.type,
            createdAt: i.createdAt,
          })),
        },
      });
    }

    // Alerte pour incidents répétés
    if (repeatedIncidents.length > 0) {
      alerts.push({
        type: OrionAlertType.QHSE,
        severity: OrionAlertSeverity.WARNING,
        title: 'Incidents critiques répétés détectés',
        description: `Plusieurs incidents critiques du même type ont été signalés. Analyse de tendance recommandée.`,
        recommendation: 'Analyser les causes racines et mettre en place des actions préventives.',
        metadata: {
          source: 'QHSE_REPEATED_INCIDENTS',
          patterns: repeatedIncidents,
        },
      });
    }

    return alerts;
  }

  /**
   * Génère des alertes basées sur les risques QHSE élevés
   */
  async generateRiskAlerts(tenantId: string, academicYearId?: string): Promise<any[]> {
    const where: any = {
      tenantId,
      level: { in: ['ELEVE', 'CRITIQUE'] },
      status: { in: ['ACTIF', 'EN_SURVEILLANCE'] },
    };

    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    const highRisks = await this.prisma.qhsRiskRegister.findMany({
      where,
      include: {
        academicYear: { select: { label: true } },
        schoolLevel: { select: { code: true, label: true } },
      },
      orderBy: { level: 'desc' },
    });

    const alerts: any[] = [];

    if (highRisks.length > 0) {
      alerts.push({
        type: OrionAlertType.QHSE,
        severity: OrionAlertSeverity.WARNING,
        title: `${highRisks.length} risque(s) élevé(s) non mitigé(s)`,
        description: `Des risques élevés ou critiques nécessitent une attention.`,
        recommendation: 'Examiner le registre des risques et mettre en place des mesures de mitigation.',
        metadata: {
          source: 'QHSE_RISK_REGISTER',
          count: highRisks.length,
          risks: highRisks.map((r) => ({
            id: r.id,
            code: r.code,
            title: r.title,
            level: r.level,
            probability: r.probability,
            impact: r.impact,
          })),
        },
      });
    }

    return alerts;
  }

  /**
   * Génère des alertes basées sur les écarts KPI (objectif vs réel)
   */
  async generateKpiAlerts(tenantId: string, academicYearId?: string): Promise<any[]> {
    // Récupérer les objectifs avec leurs valeurs réelles
    const objectives = await this.prisma.kpiObjective.findMany({
      where: {
        tenantId,
        ...(academicYearId && { academicYearId }),
        status: { in: ['ACTIVE', 'AT_RISK', 'OFF_TRACK'] },
      },
      include: {
        kpi: {
          select: {
            id: true,
            name: true,
            code: true,
            category: true,
            unit: true,
          },
        },
        academicYear: { select: { label: true } },
      },
    });

    const alerts: any[] = [];

    for (const objective of objectives) {
      // Récupérer la dernière snapshot pour ce KPI
      const latestSnapshot = await this.prisma.kpiSnapshot.findFirst({
        where: {
          tenantId,
          kpiId: objective.kpiId,
          academicYearId: objective.academicYearId,
          schoolLevelId: objective.schoolLevelId || null,
        },
        orderBy: { computedAt: 'desc' },
      });

      if (!latestSnapshot) continue;

      const actualValue = latestSnapshot.value;
      const gap = actualValue - objective.targetValue;
      const percentageGap =
        objective.targetValue !== 0 ? (gap / objective.targetValue) * 100 : 0;

      // Alerte si écart significatif (> 10% ou hors limites acceptables)
      const isOffTrack =
        (objective.minAcceptable && actualValue < objective.minAcceptable) ||
        (objective.maxAcceptable && actualValue > objective.maxAcceptable) ||
        Math.abs(percentageGap) > 10;

      if (isOffTrack) {
        alerts.push({
          type: this.getKpiAlertType(objective.kpi.category),
          severity:
            Math.abs(percentageGap) > 20
              ? OrionAlertSeverity.CRITICAL
              : OrionAlertSeverity.WARNING,
          title: `Écart détecté : ${objective.kpi.name}`,
          description: `L'objectif de ${objective.targetValue} ${objective.kpi.unit || ''} n'est pas atteint. Valeur actuelle : ${actualValue} ${objective.kpi.unit || ''} (écart : ${percentageGap.toFixed(1)}%)`,
          recommendation: 'Analyser les causes de l\'écart et ajuster les actions si nécessaire.',
          metadata: {
            source: 'KPI_OBJECTIVES',
            objectiveId: objective.id,
            kpiId: objective.kpiId,
            kpiCode: objective.kpi.code,
            targetValue: objective.targetValue,
            actualValue,
            gap,
            percentageGap: parseFloat(percentageGap.toFixed(2)),
            period: objective.period,
          },
        });
      }
    }

    return alerts;
  }

  /**
   * Génère des alertes basées sur les examens et notes (Module 3)
   */
  async generateExamAlerts(tenantId: string, academicYearId?: string): Promise<any[]> {
    const alerts: any[] = [];

    // Alerte : Examens sans notes saisies
    const examsWithoutScores = await this.prisma.exam.findMany({
      where: {
        tenantId,
        ...(academicYearId && { academicYearId }),
        examScores: {
          none: {},
        },
      },
      include: {
        subject: { select: { name: true } },
        quarter: { select: { name: true } },
      },
      take: 10,
    });

    if (examsWithoutScores.length > 0) {
      alerts.push({
        type: 'PEDAGOGIC',
        severity: 'WARNING',
        title: `${examsWithoutScores.length} examen(s) sans notes`,
        description: `Des examens ont été créés mais aucune note n'a encore été saisie.`,
        recommendation: 'Saisir les notes pour ces examens ou vérifier leur pertinence.',
        metadata: {
          source: 'EXAMS_WITHOUT_SCORES',
          count: examsWithoutScores.length,
          exams: examsWithoutScores.map((e) => ({
            id: e.id,
            name: e.name,
            subject: e.subject?.name,
            examDate: e.examDate,
          })),
        },
      });
    }

    // Alerte : Notes non validées depuis plus de 7 jours
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const pendingScores = await this.prisma.examScore.findMany({
      where: {
        tenantId,
        ...(academicYearId && { academicYearId }),
        isValidated: false,
        createdAt: { lt: sevenDaysAgo },
      },
      include: {
        exam: { select: { name: true, examDate: true } },
        student: { select: { firstName: true, lastName: true } },
      },
      take: 20,
    });

    if (pendingScores.length > 0) {
      alerts.push({
        type: 'PEDAGOGIC',
        severity: 'WARNING',
        title: `${pendingScores.length} note(s) en attente de validation depuis plus de 7 jours`,
        description: `Des notes ont été saisies mais ne sont pas encore validées, ce qui bloque le calcul des moyennes.`,
        recommendation: 'Valider les notes en attente pour permettre le calcul des bulletins.',
        metadata: {
          source: 'PENDING_SCORES_OLD',
          count: pendingScores.length,
          scores: pendingScores.map((s) => ({
            id: s.id,
            student: `${s.student?.firstName} ${s.student?.lastName}`,
            exam: s.exam?.name,
            score: s.score,
            createdAt: s.createdAt,
          })),
        },
      });
    }

    // Alerte : Bulletins non générés pour une période
    if (academicYearId) {
      const quarters = await this.prisma.quarter.findMany({
        where: {
          tenantId,
          academicYearId,
        },
      });

      for (const quarter of quarters) {
        const studentsWithScores = await this.prisma.examScore.findMany({
          where: {
            tenantId,
            academicYearId,
            isValidated: true,
            exam: {
              quarterId: quarter.id,
            },
          },
          distinct: ['studentId'],
        });

        const studentsWithReportCards = await this.prisma.reportCard.findMany({
          where: {
            tenantId,
            academicYearId,
            quarterId: quarter.id,
          },
          distinct: ['studentId'],
        });

        const missingCount = studentsWithScores.length - studentsWithReportCards.length;

        if (missingCount > 0) {
          alerts.push({
            type: OrionAlertType.PEDAGOGICAL,
            severity: OrionAlertSeverity.INFO,
            title: `${missingCount} bulletin(s) non généré(s) pour ${quarter.name}`,
            description: `Des élèves ont des notes validées mais n'ont pas encore de bulletin pour cette période.`,
            recommendation: `Générer les bulletins manquants pour ${quarter.name}.`,
            metadata: {
              source: 'MISSING_REPORT_CARDS',
              quarterId: quarter.id,
              quarterName: quarter.name,
              count: missingCount,
            },
          });
        }
      }
    }

    // Alerte : Incohérences statistiques (moyennes anormalement basses ou élevées)
    const reportCards = await this.prisma.reportCard.findMany({
      where: {
        tenantId,
        ...(academicYearId && { academicYearId }),
        status: { in: ['VALIDATED', 'PUBLISHED'] },
      },
      take: 100,
    });

    const veryLowAverages = reportCards.filter((rc) => rc.overallAverage < 5);
    const veryHighAverages = reportCards.filter((rc) => rc.overallAverage > 19);

    if (veryLowAverages.length > 5) {
      alerts.push({
        type: 'PEDAGOGIC',
        severity: 'WARNING',
        title: `${veryLowAverages.length} moyenne(s) très faible(s) détectée(s)`,
        description: `Plusieurs bulletins présentent des moyennes inférieures à 5/20, ce qui peut indiquer un problème pédagogique.`,
        recommendation: 'Analyser les causes des moyennes très faibles et mettre en place un accompagnement.',
        metadata: {
          source: 'VERY_LOW_AVERAGES',
          count: veryLowAverages.length,
          threshold: 5,
        },
      });
    }

    if (veryHighAverages.length > 10) {
      alerts.push({
          type: OrionAlertType.PEDAGOGICAL,
          severity: OrionAlertSeverity.INFO,
        title: `${veryHighAverages.length} moyenne(s) exceptionnelle(s)`,
        description: `Plusieurs bulletins présentent des moyennes supérieures à 19/20.`,
        recommendation: 'Vérifier la cohérence des notes et la difficulté des examens.',
        metadata: {
          source: 'VERY_HIGH_AVERAGES',
          count: veryHighAverages.length,
          threshold: 19,
        },
      });
    }

    return alerts;
  }

  /**
   * Génère toutes les alertes ORION pour un tenant
   */
  /**
   * Génère des alertes financières (Module 4)
   */
  async generateFinancialAlerts(tenantId: string, academicYearId?: string): Promise<any[]> {
    const alerts: any[] = [];
    const where: any = { tenantId, ...(academicYearId && { academicYearId }) };

    // 1. Alertes pour impayés critiques
    const criticalArrears = await this.prisma.feeArrear.findMany({
      where: {
        ...where,
        arrearsLevel: 'CRITICAL',
      },
      include: {
        student: { select: { firstName: true, lastName: true, studentCode: true } },
        studentFee: {
          include: {
            feeDefinition: { select: { label: true } },
          },
        },
      },
      take: 20,
    });

    if (criticalArrears.length > 0) {
      const totalCriticalAmount = criticalArrears.reduce(
        (sum, a) => sum + Number(a.balanceDue),
        0
      );

      alerts.push({
        type: 'FINANCIAL',
        severity: 'CRITICAL',
        title: `${criticalArrears.length} impayé(s) critique(s)`,
        description: `Montant total en impayés critiques : ${totalCriticalAmount.toLocaleString('fr-FR')} XOF`,
        recommendation: 'Traiter immédiatement les impayés critiques via le module Recouvrement.',
        metadata: {
          source: 'CRITICAL_ARREARS',
          count: criticalArrears.length,
          totalAmount: totalCriticalAmount,
          arrears: criticalArrears.map((a) => ({
            id: a.id,
            student: `${a.student.firstName} ${a.student.lastName}`,
            studentCode: a.student.studentCode,
            fee: a.studentFee.feeDefinition.label,
            balanceDue: Number(a.balanceDue),
            lastPaymentDate: a.lastPaymentDate,
          })),
        },
      });
    }

    // 2. Alertes pour promesses de paiement non tenues
    const brokenPromises = await this.prisma.paymentPromise.findMany({
      where: {
        ...where,
        status: 'BROKEN',
        promisedDate: { lt: new Date() },
      },
      include: {
        feeArrear: {
          include: {
            student: { select: { firstName: true, lastName: true } },
          },
        },
      },
      take: 20,
    });

    if (brokenPromises.length > 0) {
      alerts.push({
        type: 'FINANCIAL',
        severity: 'WARNING',
        title: `${brokenPromises.length} promesse(s) de paiement non tenue(s)`,
        description: `Des promesses de paiement ont été rompues, nécessitant un suivi renforcé.`,
        recommendation: 'Contacter les parents concernés et mettre à jour le plan de recouvrement.',
        metadata: {
          source: 'BROKEN_PROMISES',
          count: brokenPromises.length,
          promises: brokenPromises.map((p) => ({
            id: p.id,
            student: `${p.feeArrear.student.firstName} ${p.feeArrear.student.lastName}`,
            promisedAmount: Number(p.promisedAmount),
            promisedDate: p.promisedDate,
            brokenAt: p.updatedAt,
          })),
        },
      });
    }

    // 3. Alertes pour taux de recouvrement faible
    const allArrears = await this.prisma.feeArrear.findMany({
      where,
      select: {
        totalDue: true,
        totalPaid: true,
        balanceDue: true,
      },
    });

    if (allArrears.length > 0) {
      const totalExpected = allArrears.reduce((sum, a) => sum + Number(a.totalDue), 0);
      const totalPaid = allArrears.reduce((sum, a) => sum + Number(a.totalPaid), 0);
      const collectionRate = totalExpected > 0 ? (totalPaid / totalExpected) * 100 : 0;

      if (collectionRate < 70) {
        alerts.push({
          type: OrionAlertType.FINANCIAL,
          severity: collectionRate < 50 ? OrionAlertSeverity.CRITICAL : OrionAlertSeverity.WARNING,
          title: `Taux de recouvrement faible : ${collectionRate.toFixed(1)}%`,
          description: `Le taux de recouvrement est en dessous du seuil acceptable (70%).`,
          recommendation: 'Renforcer les actions de recouvrement et analyser les causes des impayés.',
          metadata: {
            source: 'LOW_COLLECTION_RATE',
            collectionRate: parseFloat(collectionRate.toFixed(2)),
            totalExpected,
            totalPaid,
            totalBalanceDue: allArrears.reduce((sum, a) => sum + Number(a.balanceDue), 0),
          },
        });
      }
    }

    // 4. Alertes pour clôtures journalières non validées
    const unvalidatedClosures = await this.prisma.dailyClosure.findMany({
      where: {
        ...where,
        validated: false,
        date: {
          lt: new Date(new Date().setHours(0, 0, 0, 0)), // Avant aujourd'hui
        },
      },
      orderBy: { date: 'desc' },
      take: 10,
    });

    if (unvalidatedClosures.length > 0) {
      alerts.push({
        type: 'FINANCIAL',
        severity: 'WARNING',
        title: `${unvalidatedClosures.length} clôture(s) journalière(s) non validée(s)`,
        description: `Des clôtures journalières attendent validation depuis plusieurs jours.`,
        recommendation: 'Valider les clôtures en attente pour maintenir la traçabilité financière.',
        metadata: {
          source: 'UNVALIDATED_CLOSURES',
          count: unvalidatedClosures.length,
          closures: unvalidatedClosures.map((c) => ({
            id: c.id,
            date: c.date,
            totalCollected: Number(c.totalCollected),
            totalSpent: Number(c.totalSpent),
          })),
        },
      });
    }

    // 5. Alertes pour dépenses non approuvées depuis plus de 7 jours
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const pendingExpenses = await this.prisma.expense.findMany({
      where: {
        ...where,
        status: 'pending',
        createdAt: { lt: sevenDaysAgo },
      },
      include: {
        creator: { select: { firstName: true, lastName: true } },
      },
      take: 20,
    });

    if (pendingExpenses.length > 0) {
      const totalPendingAmount = pendingExpenses.reduce(
        (sum, e) => sum + Number(e.amount),
        0
      );

      alerts.push({
        type: 'FINANCIAL',
        severity: 'WARNING',
        title: `${pendingExpenses.length} dépense(s) en attente d'approbation (> 7 jours)`,
        description: `Montant total en attente : ${totalPendingAmount.toLocaleString('fr-FR')} XOF`,
        recommendation: 'Traiter les demandes de dépenses en attente pour maintenir la fluidité opérationnelle.',
        metadata: {
          source: 'PENDING_EXPENSES',
          count: pendingExpenses.length,
          totalAmount: totalPendingAmount,
          expenses: pendingExpenses.map((e) => ({
            id: e.id,
            description: e.description,
            amount: Number(e.amount),
            expenseDate: e.expenseDate,
            createdBy: e.creator ? `${e.creator.firstName} ${e.creator.lastName}` : null,
          })),
        },
      });
    }

    // 6. Alertes pour risques de trésorerie (dépenses > recettes sur 30 jours)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [recentPayments, recentExpenses] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          ...where,
          paymentDate: { gte: thirtyDaysAgo },
        },
        select: { amount: true },
      }),
      this.prisma.expense.findMany({
        where: {
          ...where,
          status: 'approved',
          expenseDate: { gte: thirtyDaysAgo },
        },
        select: { amount: true },
      }),
    ]);

    const totalIncome = recentPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalExpenses = recentExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const netCashFlow = totalIncome - totalExpenses;

    if (netCashFlow < 0) {
      alerts.push({
        type: OrionAlertType.FINANCIAL,
        severity: Math.abs(netCashFlow) > totalIncome * 0.3 ? OrionAlertSeverity.CRITICAL : OrionAlertSeverity.WARNING,
        title: `Risque de trésorerie détecté`,
        description: `Sur les 30 derniers jours, les dépenses (${totalExpenses.toLocaleString('fr-FR')} XOF) dépassent les recettes (${totalIncome.toLocaleString('fr-FR')} XOF).`,
        recommendation: 'Analyser les dépenses et optimiser les recettes pour rétablir l\'équilibre financier.',
        metadata: {
          source: 'CASH_FLOW_RISK',
          period: '30_DAYS',
          totalIncome,
          totalExpenses,
          netCashFlow,
          deficit: Math.abs(netCashFlow),
        },
      });
    }

    return alerts;
  }

  /**
   * Génère des alertes RH basées sur la masse salariale, absences critiques et performance (Module 5)
   */
  async generateHRAlerts(tenantId: string, academicYearId?: string): Promise<any[]> {
    const alerts: any[] = [];
    const where: any = { tenantId };
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    // 1. Alertes pour absences critiques
    const criticalAbsences = await this.prisma.staffAttendance.findMany({
      where: {
        ...where,
        status: 'ABSENT',
        date: {
          gte: new Date(new Date().setDate(new Date().getDate() - 30)), // 30 derniers jours
        },
      },
      include: {
        staff: { select: { firstName: true, lastName: true, employeeNumber: true } },
      },
      take: 20,
    });

    // Compter les absences par personnel
    const absenceCounts = criticalAbsences.reduce((acc, attendance) => {
      const staffId = attendance.staffId;
      acc[staffId] = (acc[staffId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const highAbsenceStaff = Object.entries(absenceCounts)
      .filter(([_, count]) => count >= 5) // 5+ absences en 30 jours
      .map(([staffId]) => {
        const attendance = criticalAbsences.find(a => a.staffId === staffId);
        return {
          staffId,
          staff: attendance?.staff,
          absenceCount: absenceCounts[staffId],
        };
      });

    if (highAbsenceStaff.length > 0) {
      alerts.push({
        type: 'RH',
        severity: 'WARNING',
        title: `${highAbsenceStaff.length} membre(s) du personnel avec absences répétées`,
        description: `Certains membres du personnel ont un taux d'absence élevé sur les 30 derniers jours.`,
        recommendation: 'Examiner les causes des absences et prendre les mesures appropriées.',
        metadata: {
          source: 'HR_CRITICAL_ABSENCES',
          count: highAbsenceStaff.length,
          staff: highAbsenceStaff,
        },
      });
    }

    // 2. Alertes pour masse salariale élevée
    const payrolls = await this.prisma.payroll.findMany({
      where: {
        ...where,
        status: 'VALIDATED',
        month: {
          gte: new Date().toISOString().slice(0, 7), // Mois en cours ou récents
        },
      },
      include: {
        items: true,
      },
      take: 3,
    });

    if (payrolls.length > 0) {
      const totalPayroll = payrolls.reduce((sum, payroll) => {
        return sum + Number(payroll.totalAmount);
      }, 0);

      const averagePayroll = totalPayroll / payrolls.length;

      // Alerte si la masse salariale dépasse un seuil (exemple: 10M XOF/mois)
      if (averagePayroll > 10000000) {
        alerts.push({
          type: OrionAlertType.RH,
          severity: OrionAlertSeverity.WARNING,
          title: `Masse salariale élevée : ${(averagePayroll / 1000000).toFixed(1)}M XOF/mois`,
          description: `La masse salariale moyenne dépasse le seuil de 10M XOF par mois.`,
          recommendation: 'Analyser la structure des salaires et optimiser les coûts RH si nécessaire.',
          metadata: {
            source: 'HR_HIGH_PAYROLL',
            averagePayroll,
            threshold: 10000000,
          },
        });
      }
    }

    // 3. Alertes pour contrats expirant bientôt
    const upcomingExpirations = await this.prisma.contract.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        endDate: {
          gte: new Date(),
          lte: new Date(new Date().setMonth(new Date().getMonth() + 3)), // 3 prochains mois
        },
      },
      include: {
        staff: { select: { firstName: true, lastName: true, employeeNumber: true } },
      },
      take: 10,
    });

    if (upcomingExpirations.length > 0) {
      alerts.push({
        type: 'RH',
        severity: 'INFO',
        title: `${upcomingExpirations.length} contrat(s) expirant dans les 3 prochains mois`,
        description: `Des contrats de travail arrivent à échéance et nécessitent un renouvellement ou une décision.`,
        recommendation: 'Planifier le renouvellement ou la fin des contrats concernés.',
        metadata: {
          source: 'HR_CONTRACT_EXPIRATIONS',
          count: upcomingExpirations.length,
          contracts: upcomingExpirations.map(c => ({
            id: c.id,
            staff: `${c.staff.firstName} ${c.staff.lastName}`,
            endDate: c.endDate,
            contractType: c.contractType,
          })),
        },
      });
    }

    // 4. Alertes pour non-conformité CNSS
    const cnssDeclarations = await this.prisma.cNSSDeclaration.findMany({
      where: {
        ...where,
        status: { in: ['LATE', 'DRAFT'] },
      },
      take: 5,
    });

    if (cnssDeclarations.length > 0) {
      alerts.push({
        type: 'RH',
        severity: 'CRITICAL',
        title: `${cnssDeclarations.length} déclaration(s) CNSS en retard ou non déclarée(s)`,
        description: `Des déclarations CNSS sont en attente de déclaration ou en retard.`,
        recommendation: 'Déclarer immédiatement les déclarations CNSS en retard pour éviter des pénalités.',
        metadata: {
          source: 'HR_CNSS_NON_COMPLIANCE',
          count: cnssDeclarations.length,
          declarations: cnssDeclarations.map(d => ({
            id: d.id,
            month: d.month,
            status: d.status,
            totalAmount: d.totalAmount,
          })),
        },
      });
    }

    // 5. Alertes pour employés déclarés CNSS sans déclaration
    const employeesCNSS = await this.prisma.employeeCNSS.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      include: {
        staff: { select: { firstName: true, lastName: true } },
      },
    });

    if (employeesCNSS.length > 0 && academicYearId) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const currentDeclaration = await this.prisma.cNSSDeclaration.findFirst({
        where: {
          tenantId,
          academicYearId,
          month: currentMonth,
        },
      });

      if (!currentDeclaration || currentDeclaration.status === 'DRAFT') {
        alerts.push({
          type: OrionAlertType.RH,
          severity: OrionAlertSeverity.WARNING,
          title: `${employeesCNSS.length} employé(s) CNSS sans déclaration pour le mois en cours`,
          description: `Des employés sont déclarés CNSS mais aucune déclaration n'a été générée pour le mois en cours.`,
          recommendation: 'Générer la déclaration CNSS du mois en cours pour assurer la conformité.',
          metadata: {
            source: 'HR_CNSS_MISSING_DECLARATION',
            employeeCount: employeesCNSS.length,
            currentMonth,
          },
        });
      }
    }

    return alerts;
  }

  /**
   * Génère des alertes communication basées sur les taux de livraison, engagement et risques (Module 6)
   */
  async generateCommunicationAlerts(tenantId: string, academicYearId?: string): Promise<any[]> {
    const alerts: any[] = [];
    const where: any = { tenantId };
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    // 1. Alertes pour messages échoués
    const failedMessages = await this.prisma.message.findMany({
      where: {
        ...where,
        status: 'FAILED',
        createdAt: {
          gte: new Date(new Date().setDate(new Date().getDate() - 7)), // 7 derniers jours
        },
      },
      take: 10,
    });

    if (failedMessages.length > 0) {
      alerts.push({
        type: 'OPERATIONAL',
        severity: 'WARNING',
        title: `${failedMessages.length} message(s) échoué(s) cette semaine`,
        description: `Certains messages n'ont pas pu être envoyés. Vérifiez la configuration des canaux.`,
        recommendation: 'Examiner les logs des messages échoués et vérifier la configuration des canaux de communication.',
        metadata: {
          source: 'COMMUNICATION_FAILED_MESSAGES',
          count: failedMessages.length,
          messages: failedMessages.map(m => ({
            id: m.id,
            subject: m.subject,
            messageType: m.messageType,
            createdAt: m.createdAt,
          })),
        },
      });
    }

    // 2. Alertes pour taux de livraison faible
    const recentMessages = await this.prisma.message.findMany({
      where: {
        ...where,
        status: 'SENT',
        sentAt: {
          gte: new Date(new Date().setDate(new Date().getDate() - 30)), // 30 derniers jours
        },
      },
      include: {
        logs: true,
      },
      take: 100,
    });

    if (recentMessages.length > 0) {
      const totalLogs = recentMessages.reduce((sum, msg) => sum + msg.logs.length, 0);
      const deliveredLogs = recentMessages.reduce(
        (sum, msg) => sum + msg.logs.filter(log => log.status === 'DELIVERED').length,
        0
      );
      const deliveryRate = totalLogs > 0 ? (deliveredLogs / totalLogs) * 100 : 0;

      if (deliveryRate < 85) {
        alerts.push({
          type: OrionAlertType.OPERATIONAL,
          severity: OrionAlertSeverity.WARNING,
          title: `Taux de livraison faible : ${deliveryRate.toFixed(1)}%`,
          description: `Le taux de livraison des messages est en dessous du seuil recommandé (85%).`,
          recommendation: 'Vérifier la qualité des contacts (emails, téléphones) et la configuration des canaux.',
          metadata: {
            source: 'COMMUNICATION_LOW_DELIVERY_RATE',
            deliveryRate,
            threshold: 85,
            totalMessages: recentMessages.length,
            deliveredCount: deliveredLogs,
            totalLogs,
          },
        });
      }
    }

    // 3. Alertes pour messages planifiés en échec
    const failedScheduled = await this.prisma.scheduledMessage.findMany({
      where: {
        message: { tenantId },
        status: 'FAILED',
        scheduledAt: {
          gte: new Date(new Date().setDate(new Date().getDate() - 7)),
        },
      },
      include: {
        message: { select: { id: true, subject: true, messageType: true } },
      },
      take: 10,
    });

    if (failedScheduled.length > 0) {
      alerts.push({
        type: 'OPERATIONAL',
        severity: 'WARNING',
        title: `${failedScheduled.length} message(s) planifié(s) en échec`,
        description: `Des messages planifiés n'ont pas pu être envoyés automatiquement.`,
        recommendation: 'Vérifier les messages planifiés en échec et corriger les problèmes (canaux, destinataires, etc.).',
        metadata: {
          source: 'COMMUNICATION_FAILED_SCHEDULED',
          count: failedScheduled.length,
          scheduled: failedScheduled.map(s => ({
            id: s.id,
            messageId: s.messageId,
            subject: s.message.subject,
            scheduledAt: s.scheduledAt,
            errorMessage: s.errorMessage,
          })),
        },
      });
    }

    // 4. Alertes pour déclencheurs automatisés inactifs
    const inactiveTriggers = await this.prisma.automatedTrigger.findMany({
      where: {
        tenantId,
        isActive: false,
      },
      take: 10,
    });

    if (inactiveTriggers.length > 0) {
      alerts.push({
        type: 'OPERATIONAL',
        severity: 'INFO',
        title: `${inactiveTriggers.length} déclencheur(s) automatisé(s) inactif(s)`,
        description: `Certains déclencheurs automatisés sont désactivés et ne génèrent plus de messages automatiques.`,
        recommendation: 'Réactiver les déclencheurs si nécessaire ou les supprimer s\'ils ne sont plus utilisés.',
        metadata: {
          source: 'COMMUNICATION_INACTIVE_TRIGGERS',
          count: inactiveTriggers.length,
          triggers: inactiveTriggers.map(t => ({
            id: t.id,
            triggerType: t.triggerType,
            channel: t.channelId,
          })),
        },
      });
    }

    // 5. Alertes pour canaux de communication inactifs
    const inactiveChannels = await this.prisma.communicationChannel.findMany({
      where: {
        tenantId,
        isActive: false,
      },
    });

    if (inactiveChannels.length > 0) {
      alerts.push({
        type: 'OPERATIONAL',
        severity: 'INFO',
        title: `${inactiveChannels.length} canal(x) de communication inactif(s)`,
        description: `Certains canaux de communication sont désactivés et ne peuvent pas être utilisés pour envoyer des messages.`,
        recommendation: 'Réactiver les canaux nécessaires ou vérifier leur configuration.',
        metadata: {
          source: 'COMMUNICATION_INACTIVE_CHANNELS',
          count: inactiveChannels.length,
          channels: inactiveChannels.map(c => ({
            id: c.id,
            code: c.code,
            name: c.name,
          })),
        },
      });
    }

    return alerts;
  }

  async generateAllAlerts(tenantId: string, academicYearId?: string): Promise<any[]> {
    const [qhsAlerts, riskAlerts, kpiAlerts, examAlerts, financialAlerts, hrAlerts, communicationAlerts] = await Promise.all([
      this.generateQhsAlerts(tenantId, academicYearId),
      this.generateRiskAlerts(tenantId, academicYearId),
      this.generateKpiAlerts(tenantId, academicYearId),
      this.generateExamAlerts(tenantId, academicYearId),
      this.generateFinancialAlerts(tenantId, academicYearId),
      this.generateHRAlerts(tenantId, academicYearId),
      this.generateCommunicationAlerts(tenantId, academicYearId),
    ]);

    const allAlerts = [...qhsAlerts, ...riskAlerts, ...kpiAlerts, ...examAlerts, ...financialAlerts, ...hrAlerts, ...communicationAlerts];

    // Sauvegarder les alertes dans la table orion_alerts
    if (allAlerts.length > 0) {
      await Promise.all(
        allAlerts.map((alert) =>
          this.prisma.orionAlert.create({
            data: {
              tenantId,
              academicYearId: academicYearId || null,
              alertType: alert.type,
              severity: alert.severity,
              title: alert.title,
              description: alert.description,
              recommendation: alert.recommendation,
              message: alert.title, // Message court pour affichage
              acknowledged: false,
              metadata: alert.metadata,
            },
          }),
        ),
      );
    }

    return allAlerts;
  }

  /**
   * Récupère les alertes ORION actives pour un tenant
   */
  async getActiveAlerts(tenantId: string, filters?: {
    academicYearId?: string;
    schoolLevelId?: string;
    alertType?: string;
    severity?: string;
    acknowledged?: boolean;
  }): Promise<any[]> {
    const where: any = {
      tenantId,
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }
    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
    }
    if (filters?.alertType) {
      where.alertType = filters.alertType;
    }
    if (filters?.severity) {
      where.severity = filters.severity;
    }
    if (filters?.acknowledged !== undefined) {
      where.acknowledged = filters.acknowledged;
    }

    try {
      return await this.prisma.orionAlert.findMany({
        where,
        include: {
          academicYear: { select: { id: true, label: true } },
          schoolLevel: { select: { id: true, code: true, label: true } },
          acknowledgedUser: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [
          { severity: 'desc' }, // CRITICAL en premier
          { createdAt: 'desc' },
        ],
        take: 50,
      });
    } catch (error) {
      // Mode dégradé : en dev, la table ORION peut ne pas exister (migrations incomplètes).
      // Ne pas bloquer l'app : renvoyer une liste vide et laisser l'observabilité au logging serveur.
      // eslint-disable-next-line no-console
      console.warn('ORION getActiveAlerts failed (degraded mode):', (error as Error)?.message);
      return [];
    }
  }

  /**
   * Marque une alerte comme acquittée (acknowledged)
   */
  async acknowledgeAlert(
    alertId: string,
    tenantId: string,
    userId?: string,
  ): Promise<void> {
    await this.prisma.orionAlert.updateMany({
      where: {
        id: alertId,
        tenantId,
      },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy: userId || null,
      },
    });
  }

  /**
   * Sauvegarde une alerte dans la base de données
   */
  async saveAlert(tenantId: string, alert: {
    academicYearId?: string;
    schoolLevelId?: string;
    alertType: string;
    severity: string;
    title: string;
    description: string;
    recommendation?: string;
    message?: string;
    metadata?: any;
  }) {
    return this.prisma.orionAlert.create({
      data: {
        tenantId,
        ...alert,
        acknowledged: false,
      },
    });
  }

  /**
   * Convertit la catégorie KPI en type d'alerte ORION
   */
  private getKpiAlertType(category: string | null): string {
    if (!category) return 'OPERATIONAL';

    const categoryUpper = category.toUpperCase();
    if (categoryUpper.includes('PEDAGOGICAL') || categoryUpper.includes('PEDAGOGIE')) {
      return 'PEDAGOGIC';
    }
    if (categoryUpper.includes('FINANCIAL') || categoryUpper.includes('FINANCE')) {
      return 'FINANCIAL';
    }
    if (categoryUpper.includes('RH') || categoryUpper.includes('HR')) {
      return 'RH';
    }
    if (categoryUpper.includes('QHSE') || categoryUpper.includes('QHS')) {
      return 'QHSE';
    }
    return 'OPERATIONAL';
  }
}

