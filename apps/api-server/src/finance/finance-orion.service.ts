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
   * Récupère les KPIs des notifications de reçus
   */
  async getReceiptNotificationKPIs(tenantId: string, academicYearId?: string) {
    const where: any = {
      payment: {
        tenantId,
      },
    };

    if (academicYearId) {
      where.payment.academicYearId = academicYearId;
    }

    const notifications = await this.prisma.paymentNotification.findMany({
      where,
      include: {
        payment: {
          include: {
            student: true,
          },
        },
      },
    });

    const totalNotifications = notifications.length;
    const smsNotifications = notifications.filter((n) => n.channel === 'SMS');
    const whatsappNotifications = notifications.filter((n) => n.channel === 'WHATSAPP');

    const smsSent = smsNotifications.filter((n) => n.status === 'SENT').length;
    const smsFailed = smsNotifications.filter((n) => n.status === 'FAILED').length;
    const smsPending = smsNotifications.filter((n) => n.status === 'PENDING').length;

    const whatsappSent = whatsappNotifications.filter((n) => n.status === 'SENT').length;
    const whatsappFailed = whatsappNotifications.filter((n) => n.status === 'FAILED').length;
    const whatsappPending = whatsappNotifications.filter((n) => n.status === 'PENDING').length;

    const smsSuccessRate = smsNotifications.length > 0
      ? (smsSent / smsNotifications.length) * 100
      : 0;

    const whatsappSuccessRate = whatsappNotifications.length > 0
      ? (whatsappSent / whatsappNotifications.length) * 100
      : 0;

    return {
      totalNotifications,
      sms: {
        total: smsNotifications.length,
        sent: smsSent,
        failed: smsFailed,
        pending: smsPending,
        successRate: Math.round(smsSuccessRate * 100) / 100,
      },
      whatsapp: {
        total: whatsappNotifications.length,
        sent: whatsappSent,
        failed: whatsappFailed,
        pending: whatsappPending,
        successRate: Math.round(whatsappSuccessRate * 100) / 100,
      },
      overallSuccessRate: totalNotifications > 0
        ? Math.round(((smsSent + whatsappSent) / totalNotifications) * 100 * 100) / 100
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

    // Récupérer les notifications échouées
    const failedNotifications = await this.prisma.paymentNotification.findMany({
      where: {
        ...where,
        status: 'FAILED',
      },
      include: {
        payment: {
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
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Dernières 50 notifications échouées
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

    // Alerte : Notifications en attente depuis plus de 24h
    const pendingNotifications = await this.prisma.paymentNotification.findMany({
      where: {
        ...where,
        status: 'PENDING',
        createdAt: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Plus de 24h
        },
      },
      include: {
        payment: {
          include: {
            student: true,
          },
        },
      },
    });

    if (pendingNotifications.length > 0) {
      alerts.push({
        level: 'CRITICAL',
        type: 'PENDING_NOTIFICATIONS_STUCK',
        title: 'Notifications en attente depuis plus de 24h',
        message: `${pendingNotifications.length} notifications sont bloquées en statut PENDING`,
        details: {
          stuckCount: pendingNotifications.length,
          oldestPending: pendingNotifications
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0],
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
   */
  async generateArrearAlerts(tenantId: string, academicYearId: string) {
    const alerts: any[] = [];

    // Récupérer les arriérés
    const arrears = await this.prisma.studentArrear.findMany({
      where: {
        tenantId,
        toAcademicYearId: academicYearId,
        status: { in: ['OPEN', 'PARTIAL'] },
      },
      include: {
        student: true,
        fromAcademicYear: true,
      },
    });

    // Alerte : Arriérés récurrents (2 années consécutives)
    const studentsWithRecurrentArrears = new Map<string, number>();
    arrears.forEach((arrear) => {
      const count = studentsWithRecurrentArrears.get(arrear.studentId) || 0;
      studentsWithRecurrentArrears.set(arrear.studentId, count + 1);
    });

    const recurrentStudents = Array.from(studentsWithRecurrentArrears.entries())
      .filter(([_, count]) => count >= 2)
      .map(([studentId, count]) => ({ studentId, count }));

    if (recurrentStudents.length > 0) {
      alerts.push({
        level: 'CRITICAL',
        type: 'RECURRENT_ARREARS',
        title: 'Arriérés récurrents',
        message: `${recurrentStudents.length} élèves ont des arriérés sur 2 années consécutives ou plus`,
        details: {
          studentCount: recurrentStudents.length,
          students: recurrentStudents.slice(0, 10),
        },
        recommendation: 'Plan de recouvrement urgent requis pour ces élèves',
      });
    }

    // Alerte : Montant total des arriérés élevé
    const totalArrears = arrears.reduce(
      (sum, a) => sum.plus(a.balanceDue),
      new Prisma.Decimal(0),
    );

    if (totalArrears.greaterThan(1000000)) { // 1 million FCFA
      alerts.push({
        level: 'WARNING',
        type: 'HIGH_ARREAR_AMOUNT',
        title: 'Montant total des arriérés élevé',
        message: `Le montant total des arriérés s'élève à ${totalArrears.toNumber().toLocaleString('fr-FR')} FCFA`,
        details: {
          totalAmount: totalArrears.toNumber(),
          arrearCount: arrears.length,
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

    // Récupérer tous les profils avec réduction
    const reductionProfiles = await this.prisma.studentFeeProfile.findMany({
      where: {
        academicYearId,
        feeRegime: {
          code: 'REDUCTION',
          tenantId,
        },
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            schoolLevelId: true,
          },
        },
        feeRegime: {
          include: {
            rules: true,
          },
        },
      },
    });

    // Récupérer le total d'élèves actifs
    const totalStudents = await this.prisma.student.count({
      where: {
        tenantId,
        academicYearId,
        status: 'ACTIVE',
      },
    });

    const reductionPercentage = totalStudents > 0
      ? (reductionProfiles.length / totalStudents) * 100
      : 0;

    // Alerte : Trop de réductions (> 15% des élèves)
    if (reductionPercentage > 15) {
      alerts.push({
        level: 'WARNING',
        type: 'HIGH_REDUCTION_RATE',
        title: 'Taux de réductions élevé',
        message: `${reductionProfiles.length} élèves (${reductionPercentage.toFixed(1)}%) bénéficient d'une réduction`,
        details: {
          reductionCount: reductionProfiles.length,
          totalStudents,
          percentage: reductionPercentage,
        },
        recommendation: 'Réviser la politique de réductions et vérifier les justifications',
      });
    }

    // Alerte : Enfants d'enseignants (si > barème défini)
    const teacherChildProfiles = await this.prisma.studentFeeProfile.findMany({
      where: {
        academicYearId,
        feeRegime: {
          code: 'ENFANT_ENSEIGNANT',
          tenantId,
        },
      },
      include: {
        student: true,
      },
    });

    // Récupérer le nombre d'enseignants
    const teacherCount = await this.prisma.teacher.count({
      where: {
        tenantId,
        status: 'ACTIVE',
      },
    });

    if (teacherCount > 0) {
      const ratio = teacherChildProfiles.length / teacherCount;
      // Si plus de 2 enfants par enseignant en moyenne
      if (ratio > 2) {
        alerts.push({
          level: 'INFO',
          type: 'HIGH_TEACHER_CHILD_RATIO',
          title: 'Ratio enfants d\'enseignants élevé',
          message: `${teacherChildProfiles.length} enfants d'enseignants pour ${teacherCount} enseignants (ratio: ${ratio.toFixed(1)})`,
          details: {
            teacherChildCount: teacherChildProfiles.length,
            teacherCount,
            ratio,
          },
          recommendation: 'Vérifier la cohérence des profils enfants d\'enseignants',
        });
      }
    }

    return alerts;
  }
}

