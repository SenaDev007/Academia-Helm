/**
 * ============================================================================
 * FINANCE ORION SERVICE - SURVEILLANCE & ALERTES FINANCIÈRES
 * ============================================================================
 * 
 * Service ORION pour le Module 4 - Finances & Économat
 * Surveille les notifications de reçus, les échecs d'envoi, et génère des alertes
 * 
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class FinanceOrionService {
  private readonly logger = new Logger(FinanceOrionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * FIX OOM: Use aggregate/count queries instead of loading all notifications into memory.
   * Previously loaded ALL paymentNotification + payment + student records → OOM.
   */
  async getReceiptNotificationKPIs(tenantId: string, academicYearId?: string) {
    const paymentWhere: any = { tenantId };
    if (academicYearId) paymentWhere.academicYearId = academicYearId;

    const notifWhere: any = { payment: paymentWhere };

    // Use groupBy instead of loading all records
    const [totalNotifications, smsStats, whatsappStats] = await Promise.all([
      this.prisma.paymentNotification.count({ where: notifWhere }),
      this.prisma.paymentNotification.groupBy({
        by: ['status'],
        where: { ...notifWhere, channel: 'SMS' },
        _count: { id: true },
      }),
      this.prisma.paymentNotification.groupBy({
        by: ['status'],
        where: { ...notifWhere, channel: 'WHATSAPP' },
        _count: { id: true },
      }),
    ]);

    const buildStats = (stats: any[]) => {
      const map = new Map(stats.map(s => [s.status, s._count.id]));
      const total = stats.reduce((sum, s) => sum + s._count.id, 0);
      const sent = map.get('SENT') ?? 0;
      const failed = map.get('FAILED') ?? 0;
      const pending = map.get('PENDING') ?? 0;
      const successRate = total > 0 ? (sent / total) * 100 : 0;
      return { total, sent, failed, pending, successRate: Math.round(successRate * 100) / 100 };
    };

    const sms = buildStats(smsStats);
    const whatsapp = buildStats(whatsappStats);

    return {
      totalNotifications,
      sms,
      whatsapp,
      overallSuccessRate: totalNotifications > 0
        ? Math.round(((sms.sent + whatsapp.sent) / totalNotifications) * 100 * 100) / 100
        : 0,
    };
  }

  /**
   * Génère des alertes pour les notifications de reçus
   */
  async generateReceiptNotificationAlerts(tenantId: string, academicYearId?: string) {
    const alerts: any[] = [];

    const where: any = {
      payment: {
        tenantId,
      },
    };

    if (academicYearId) {
      where.payment.academicYearId = academicYearId;
    }

    // Récupérer les notifications échouées (FIX OOM: limited to 50)
    const failedNotifications = await this.prisma.paymentNotification.findMany({
      where: {
        ...where,
        status: 'FAILED',
      },
      include: {
        payment: {
          include: {
            student: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    // Alerte : Taux d'échec SMS élevé
    const smsFailed = failedNotifications.filter((n) => n.channel === 'SMS');
    if (smsFailed.length >= 5) {
      alerts.push({
        level: 'WARNING',
        type: 'SMS_DELIVERY_FAILURE',
        title: 'Taux d\'échec SMS élevé',
        message: `${smsFailed.length} notifications SMS ont échoué récemment`,
        details: {
          failedCount: smsFailed.length,
          recentFailures: smsFailed.slice(0, 5).map((n) => ({
            paymentId: n.paymentId,
            phone: n.recipientPhone,
            error: n.errorMessage,
            date: n.createdAt,
          })),
        },
        recommendation: 'Vérifier la configuration du service SMS et les numéros de téléphone',
      });
    }

    // Alerte : Taux d'échec WhatsApp élevé
    const whatsappFailed = failedNotifications.filter((n) => n.channel === 'WHATSAPP');
    if (whatsappFailed.length >= 5) {
      alerts.push({
        level: 'WARNING',
        type: 'WHATSAPP_DELIVERY_FAILURE',
        title: 'Taux d\'échec WhatsApp élevé',
        message: `${whatsappFailed.length} notifications WhatsApp ont échoué récemment`,
        details: {
          failedCount: whatsappFailed.length,
          recentFailures: whatsappFailed.slice(0, 5).map((n) => ({
            paymentId: n.paymentId,
            phone: n.recipientPhone,
            error: n.errorMessage,
            date: n.createdAt,
          })),
        },
        recommendation: 'Vérifier la configuration du service WhatsApp Business API',
      });
    }

    // Alerte : Notifications en attente depuis plus de 24h (FIX OOM: count instead of loading all)
    const stuckPendingCount = await this.prisma.paymentNotification.count({
      where: {
        ...where,
        status: 'PENDING',
        createdAt: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    if (stuckPendingCount > 0) {
      // Only load a few for details
      const pendingNotifications = await this.prisma.paymentNotification.findMany({
        where: {
          ...where,
          status: 'PENDING',
          createdAt: {
            lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
        select: { id: true, createdAt: true, channel: true, recipientPhone: true },
        orderBy: { createdAt: 'asc' },
        take: 5,
      });

      alerts.push({
        level: 'CRITICAL',
        type: 'PENDING_NOTIFICATIONS_STUCK',
        title: 'Notifications en attente depuis plus de 24h',
        message: `${stuckPendingCount} notifications sont bloquées en statut PENDING`,
        details: {
          stuckCount: stuckPendingCount,
          oldestPending: pendingNotifications[0] ?? null,
        },
        recommendation: 'Vérifier le service de notifications et relancer les notifications bloquées',
      });
    }

    // Alerte : Parents injoignables (échecs répétés)
    const phoneFailureCounts = new Map<string, number>();
    failedNotifications.forEach((n) => {
      const count = phoneFailureCounts.get(n.recipientPhone) || 0;
      phoneFailureCounts.set(n.recipientPhone, count + 1);
    });

    const unreachableParents = Array.from(phoneFailureCounts.entries())
      .filter(([_, count]) => count >= 3)
      .map(([phone, count]) => ({ phone, failureCount: count }));

    if (unreachableParents.length > 0) {
      alerts.push({
        level: 'INFO',
        type: 'UNREACHABLE_PARENTS',
        title: 'Parents injoignables',
        message: `${unreachableParents.length} numéros de téléphone ont des échecs répétés`,
        details: {
          unreachableCount: unreachableParents.length,
          phones: unreachableParents,
        },
        recommendation: 'Vérifier les numéros de téléphone et contacter les parents pour mise à jour',
      });
    }

    // Alerte : Paiements sans notification effective
    const paymentsWithoutNotification = await this.prisma.payment.findMany({
      where: {
        tenantId,
        academicYearId,
        receipt: {
          isNot: null,
        },
        notifications: {
          none: {
            status: 'SENT',
          },
        },
      },
      include: {
        student: {
          include: {
            studentGuardians: {
              where: {
                isPrimary: true,
              },
              include: {
                guardian: true,
              },
              take: 1,
            },
          },
        },
        receipt: true,
      },
      take: 10,
    });

    if (paymentsWithoutNotification.length > 0) {
      alerts.push({
        level: 'WARNING',
        type: 'PAYMENTS_WITHOUT_NOTIFICATION',
        title: 'Paiements sans notification envoyée',
        message: `${paymentsWithoutNotification.length} paiements ont un reçu mais aucune notification envoyée`,
        details: {
          paymentCount: paymentsWithoutNotification.length,
          recentPayments: paymentsWithoutNotification.slice(0, 5).map((p) => ({
            paymentId: p.id,
            studentName: `${p.student?.firstName || ''} ${p.student?.lastName || ''}`,
            amount: p.amount,
            date: p.paymentDate,
          })),
        },
        recommendation: 'Vérifier pourquoi les notifications n\'ont pas été envoyées pour ces paiements',
      });
    }

    return alerts;
  }

  /**
   * Génère des alertes pour les arriérés inter-années
   * FIX OOM: Use aggregate for totals, limit findMany for detail queries
   */
  async generateArrearAlerts(tenantId: string, academicYearId: string) {
    const alerts: any[] = [];

    const where = {
      tenantId,
      toAcademicYearId: academicYearId,
      status: { in: ['OPEN', 'PARTIAL'] },
    };

    // FIX OOM: Use aggregate for total amount instead of loading all records
    const [arrearStats, arrearCount] = await Promise.all([
      this.prisma.studentArrear.aggregate({
        where,
        _sum: { balanceDue: true },
        _count: { id: true },
      }),
      this.prisma.studentArrear.groupBy({
        by: ['studentId'],
        where,
        _count: { id: true },
        having: { studentId: { _count: { gte: 2 } } },
      }),
    ]);

    // Alerte : Arriérés récurrents (2 années consécutives)
    if (arrearCount.length > 0) {
      alerts.push({
        level: 'CRITICAL',
        type: 'RECURRENT_ARREARS',
        title: 'Arriérés récurrents',
        message: `${arrearCount.length} élèves ont des arriérés sur 2 années consécutives ou plus`,
        details: {
          studentCount: arrearCount.length,
          students: arrearCount.slice(0, 10).map(s => ({ studentId: s.studentId, count: s._count.id })),
        },
        recommendation: 'Plan de recouvrement urgent requis pour ces élèves',
      });
    }

    // Alerte : Montant total des arriérés élevé
    const totalArrears = arrearStats._sum.balanceDue ?? new Prisma.Decimal(0);

    if (totalArrears.greaterThan(1000000)) {
      alerts.push({
        level: 'WARNING',
        type: 'HIGH_ARREAR_AMOUNT',
        title: 'Montant total des arriérés élevé',
        message: `Le montant total des arriérés s'élève à ${totalArrears.toNumber().toLocaleString('fr-FR')} FCFA`,
        details: {
          totalAmount: totalArrears.toNumber(),
          arrearCount: arrearStats._count.id,
        },
        recommendation: 'Réviser la stratégie de recouvrement et contacter les parents concernés',
      });
    }

    return alerts;
  }

  /**
   * Génère des alertes pour les réductions tarifaires
   */
  async generateReductionAlerts(tenantId: string, academicYearId: string) {
    const alerts: any[] = [];

    // FIX OOM: Use count instead of loading all profiles for percentage calculation
    const [reductionCount, totalStudents] = await Promise.all([
      this.prisma.studentFeeProfile.count({
        where: {
          academicYearId,
          feeRegime: {
            code: 'REDUCTION',
            tenantId,
          },
        },
      }),
      this.prisma.student.count({
        where: {
          tenantId,
          academicYearId,
          status: 'ACTIVE',
        },
      }),
    ]);

    const reductionPercentage = totalStudents > 0
      ? (reductionCount / totalStudents) * 100
      : 0;

    // Alerte : Trop de réductions (> 15% des élèves)
    if (reductionPercentage > 15) {
      alerts.push({
        level: 'WARNING',
        type: 'HIGH_REDUCTION_RATE',
        title: 'Taux de réductions élevé',
        message: `${reductionCount} élèves (${reductionPercentage.toFixed(1)}%) bénéficient d'une réduction`,
        details: {
          reductionCount,
          totalStudents,
          percentage: reductionPercentage,
        },
        recommendation: 'Réviser la politique de réductions et vérifier les justifications',
      });
    }

    // Alerte : Enfants d'enseignants (FIX OOM: use count instead of loading all profiles)
    const [teacherChildCount, teacherCount] = await Promise.all([
      this.prisma.studentFeeProfile.count({
        where: {
          academicYearId,
          feeRegime: {
            code: 'ENFANT_ENSEIGNANT',
            tenantId,
          },
        },
      }),
      this.prisma.teacher.count({
        where: {
          tenantId,
          status: 'ACTIVE',
        },
      }),
    ]);

    if (teacherCount > 0) {
      const ratio = teacherChildCount / teacherCount;
      // Si plus de 2 enfants par enseignant en moyenne
      if (ratio > 2) {
        alerts.push({
          level: 'INFO',
          type: 'HIGH_TEACHER_CHILD_RATIO',
          title: 'Ratio enfants d\'enseignants élevé',
          message: `${teacherChildCount} enfants d'enseignants pour ${teacherCount} enseignants (ratio: ${ratio.toFixed(1)})`,
          details: {
            teacherChildCount,
            teacherCount,
            ratio,
          },
          recommendation: 'Vérifier la cohérence des profils enfants d\'enseignants',
        });
      }
    }

    return alerts;
  }

  /**
   * Synthèse globale des anomalies financières pour ORION (Spec Academia Helm)
   */
  async detectAnomalies(tenantId: string, academicYearId: string) {
    const alerts: any[] = [];

    // 1. Détecter les écarts de caisse (Physical Mismatch)
    const closuresWithDiscrepancy = await this.prisma.financeDailyClosure.findMany({
      where: {
        tenantId,
        academicYearId,
        anomalyDetected: true,
        discrepancy: { not: 0 },
      },
      orderBy: { date: 'desc' },
      take: 5,
    });

    for (const c of closuresWithDiscrepancy) {
      alerts.push({
        level: 'CRITICAL',
        type: 'CASH_DISCREPANCY',
        title: 'Écart de caisse détecté',
        message: `Le ${new Date(c.date).toLocaleDateString()} : écart de ${c.discrepancy?.toString()} XOF entre le calcul AH et le comptage physique.`,
        details: { date: c.date, discrepancy: c.discrepancy },
        recommendation: 'Auditer les transactions de cette journée et vérifier les justificatifs.',
      });
    }

    // 2. Détecter les dépassements de budget (> 85% par défaut)
    const settings = await this.prisma.financialSettings.findUnique({ where: { tenantId } });
    const threshold = Number(settings?.budgetAlertThreshold ?? 85);

    const budgets = await this.prisma.financeBudget.findMany({
      where: { tenantId, academicYearId },
      include: { category: true },
    });

    for (const b of budgets) {
      const expenses = await this.prisma.financeExpense.aggregate({
        where: { tenantId, academicYearId, categoryId: b.categoryId, status: 'APPROVED' },
        _sum: { amount: true },
      });
      const spent = Number(expenses._sum.amount ?? 0);
      const allocated = Number(b.allocatedAmount);
      const percent = allocated > 0 ? (spent / allocated) * 100 : 0;

      if (percent >= threshold) {
        alerts.push({
          level: percent >= 100 ? 'CRITICAL' : 'WARNING',
          type: 'BUDGET_OVERRUN',
          title: `Alerte budget : ${b.category.name}`,
          message: `${percent.toFixed(1)}% du budget consommé (${spent.toLocaleString()} / ${allocated.toLocaleString()} XOF).`,
          details: { category: b.category.name, spent, allocated, percent },
          recommendation: 'Restreindre les dépenses pour cette catégorie ou réallouer des fonds.',
        });
      }
    }

    // 3. Détecter les annulations suspectes (Manual Overrides)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const suspiciousReversals = await this.prisma.financeTransaction.groupBy({
      by: ['cashierId'],
      where: {
        tenantId,
        type: 'REVERSAL',
        createdAt: { gte: today },
      },
      _count: { id: true },
      _sum: { amount: true },
    });

    for (const r of suspiciousReversals) {
      if (r._count.id >= 3) {
        alerts.push({
          level: 'WARNING',
          type: 'SUSPICIOUS_CANCELLATIONS',
          title: 'Vagues d\'annulations suspectes',
          message: `Le caissier ${r.cashierId} a effectué ${r._count.id} annulations aujourd'hui.`,
          details: { cashierId: r.cashierId, count: r._count.id, totalAmount: r._sum.amount },
          recommendation: 'Vérifier les motifs d\'annulation et les logs d\'audit.',
        });
      }
    }

    // 4. Détecter les clôtures tardives ou absentes
    const lastClosure = await this.prisma.financeDailyClosure.findFirst({
      where: { tenantId, academicYearId },
      orderBy: { date: 'desc' },
    });

    if (lastClosure) {
      const lastDate = new Date(lastClosure.date);
      const daysDiff = (today.getTime() - lastDate.getTime()) / (1000 * 3600 * 24);
      if (daysDiff > 2) {
        alerts.push({
          level: 'CRITICAL',
          type: 'MISSING_CLOSURE',
          title: 'Retard de clôture critique',
          message: `La dernière clôture date d'il y a ${Math.floor(daysDiff)} jours.`,
          details: { lastClosureDate: lastClosure.date },
          recommendation: 'Forcer la clôture des journées en attente pour figer la comptabilité.',
        });
      }
    }

    return alerts;
  }
}
