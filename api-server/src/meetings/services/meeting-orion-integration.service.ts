import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Service d'intégration ORION pour les KPIs et alertes de réunions
 */
@Injectable()
export class MeetingOrionIntegrationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcule le taux de tenue des réunions
   */
  async calculateMeetingHeldRate(
    tenantId: string,
    academicYearId: string,
    meetingType?: string,
  ) {
    const where: any = {
      tenantId,
      academicYearId,
    };

    if (meetingType) {
      where.meetingType = meetingType;
    }

    const allMeetings = await this.prisma.meeting.count({
      where: {
        ...where,
        status: { in: ['PLANNED', 'HELD', 'CANCELLED', 'POSTPONED'] },
      },
    });

    const heldMeetings = await this.prisma.meeting.count({
      where: {
        ...where,
        status: 'HELD',
      },
    });

    const rate = allMeetings > 0 ? (heldMeetings / allMeetings) * 100 : 0;

    return {
      rate: Math.round(rate * 100) / 100,
      total: allMeetings,
      held: heldMeetings,
      cancelled: await this.prisma.meeting.count({
        where: { ...where, status: 'CANCELLED' },
      }),
    };
  }

  /**
   * Calcule le taux de présence des participants
   */
  async calculateAttendanceRate(
    tenantId: string,
    academicYearId: string,
    participantType?: string,
  ) {
    const where: any = {
      meeting: {
        tenantId,
        academicYearId,
        status: 'HELD',
      },
    };

    if (participantType) {
      where.participantType = participantType;
    }

    const participants = await this.prisma.meetingParticipant.findMany({
      where,
    });

    if (participants.length === 0) {
      return {
        rate: 0,
        total: 0,
        present: 0,
        absent: 0,
        excused: 0,
        notAttended: 0,
      };
    }

    const present = participants.filter((p) => p.attendanceStatus === 'PRESENT').length;
    const absent = participants.filter((p) => p.attendanceStatus === 'ABSENT').length;
    const excused = participants.filter((p) => p.attendanceStatus === 'EXCUSED').length;
    const notAttended = participants.filter(
      (p) => !p.attendanceStatus || p.attendanceStatus === 'NOT_ATTENDED',
    ).length;

    const rate = (present / participants.length) * 100;

    return {
      rate: Math.round(rate * 100) / 100,
      total: participants.length,
      present,
      absent,
      excused,
      notAttended,
    };
  }

  /**
   * Calcule le taux d'exécution des décisions
   */
  async calculateDecisionExecutionRate(
    tenantId: string,
    academicYearId: string,
  ) {
    const decisions = await this.prisma.meetingDecision.findMany({
      where: {
        meeting: {
          tenantId,
          academicYearId,
        },
      },
    });

    if (decisions.length === 0) {
      return {
        rate: 0,
        total: 0,
        done: 0,
        pending: 0,
        inProgress: 0,
        overdue: 0,
      };
    }

    const done = decisions.filter((d) => d.status === 'DONE').length;
    const pending = decisions.filter((d) => d.status === 'PENDING').length;
    const inProgress = decisions.filter((d) => d.status === 'IN_PROGRESS').length;

    const now = new Date();
    const overdue = decisions.filter(
      (d) =>
        (d.status === 'PENDING' || d.status === 'IN_PROGRESS') &&
        d.dueDate &&
        d.dueDate < now,
    ).length;

    const rate = (done / decisions.length) * 100;

    return {
      rate: Math.round(rate * 100) / 100,
      total: decisions.length,
      done,
      pending,
      inProgress,
      overdue,
    };
  }

  /**
   * Génère des alertes ORION pour les réunions
   */
  async generateOrionAlerts(tenantId: string, academicYearId: string) {
    const alerts: any[] = [];

    // Alerte : Réunions critiques non tenues
    const criticalMeetings = await this.prisma.meeting.findMany({
      where: {
        tenantId,
        academicYearId,
        meetingType: { in: ['ADMIN', 'PEDAGOGIC'] },
        status: { in: ['PLANNED', 'POSTPONED'] },
        meetingDate: { lt: new Date() },
      },
      include: {
        schoolLevel: true,
        class: true,
      },
    });

    if (criticalMeetings.length > 0) {
      alerts.push({
        alertType: 'OPERATIONAL',
        severity: 'CRITICAL',
        title: 'Réunions critiques non tenues',
        description: `${criticalMeetings.length} réunion(s) planifiée(s) n'ont pas été tenues.`,
        recommendation: 'Vérifier les réunions en retard et les reporter ou les annuler si nécessaire.',
        metadata: {
          meetingIds: criticalMeetings.map((m) => m.id),
          count: criticalMeetings.length,
        },
      });
    }

    // Alerte : Décisions en retard
    const overdueDecisions = await this.prisma.meetingDecision.findMany({
      where: {
        meeting: {
          tenantId,
          academicYearId,
        },
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueDate: { lt: new Date() },
      },
      include: {
        meeting: {
          select: {
            id: true,
            title: true,
            meetingDate: true,
          },
        },
        responsible: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (overdueDecisions.length > 0) {
      alerts.push({
        alertType: 'GOVERNANCE',
        severity: 'WARNING',
        title: 'Décisions en retard',
        description: `${overdueDecisions.length} décision(s) n'ont pas été exécutées dans les délais.`,
        recommendation: 'Suivre les décisions en retard et relancer les responsables.',
        metadata: {
          decisionIds: overdueDecisions.map((d) => d.id),
          count: overdueDecisions.length,
        },
      });
    }

    // Alerte : Absences répétées
    const participants = await this.prisma.meetingParticipant.findMany({
      where: {
        meeting: {
          tenantId,
          academicYearId,
          status: 'HELD',
        },
      },
    });

    const participantAbsences = new Map<string, number>();
    participants.forEach((p) => {
      if (p.attendanceStatus === 'ABSENT' || p.attendanceStatus === 'NOT_ATTENDED') {
        const key = `${p.participantType}-${p.participantId}`;
        participantAbsences.set(key, (participantAbsences.get(key) || 0) + 1);
      }
    });

    const frequentAbsences = Array.from(participantAbsences.entries())
      .filter(([_, count]) => count >= 3)
      .map(([key, count]) => ({ key, count }));

    if (frequentAbsences.length > 0) {
      alerts.push({
        alertType: 'OPERATIONAL',
        severity: 'WARNING',
        title: 'Absences répétées aux réunions',
        description: `${frequentAbsences.length} participant(s) ont manqué 3 réunions ou plus.`,
        recommendation: 'Contacter les participants fréquemment absents pour comprendre les raisons.',
        metadata: {
          frequentAbsences,
          count: frequentAbsences.length,
        },
      });
    }

    // Alerte : Taux de présence faible
    const attendanceStats = await this.calculateAttendanceRate(tenantId, academicYearId);
    if (attendanceStats.total > 10 && attendanceStats.rate < 70) {
      alerts.push({
        alertType: 'GOVERNANCE',
        severity: 'WARNING',
        title: 'Taux de présence faible',
        description: `Le taux de présence aux réunions est de ${attendanceStats.rate}%.`,
        recommendation: 'Améliorer la communication et la planification des réunions pour augmenter la participation.',
        metadata: {
          attendanceRate: attendanceStats.rate,
          total: attendanceStats.total,
          present: attendanceStats.present,
        },
      });
    }

    // Alerte : Comptes rendus non validés après réunion
    const unvalidatedMinutes = await this.prisma.meetingMinutes.findMany({
      where: {
        validated: false,
        meeting: {
          tenantId,
          academicYearId,
          status: 'HELD',
          meetingDate: { lt: new Date() },
        },
        recordedAt: {
          not: null,
        },
      },
      include: {
        meeting: {
          select: {
            id: true,
            title: true,
            meetingDate: true,
            meetingType: true,
          },
        },
        recorder: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const unvalidatedOlderThan7Days = unvalidatedMinutes.filter((m) => {
      if (!m.recordedAt) return false;
      const daysDiff = Math.floor(
        (new Date().getTime() - new Date(m.recordedAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      return daysDiff > 7;
    });

    if (unvalidatedOlderThan7Days.length > 0) {
      alerts.push({
        alertType: 'GOVERNANCE',
        severity: 'WARNING',
        title: 'Comptes rendus non validés',
        description: `${unvalidatedOlderThan7Days.length} compte(s) rendu(s) non validé(s) depuis plus de 7 jours.`,
        recommendation: 'Valider les comptes rendus en attente pour garantir la traçabilité institutionnelle.',
        metadata: {
          unvalidatedCount: unvalidatedOlderThan7Days.length,
          meetingIds: unvalidatedOlderThan7Days.map((m) => m.meetingId),
        },
      });
    }

    // Alerte : Récurrence des problèmes (basé sur les décisions similaires)
    const decisions = await this.prisma.meetingDecision.findMany({
      where: {
        meeting: {
          tenantId,
          academicYearId,
        },
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      include: {
        meeting: {
          select: {
            id: true,
            title: true,
            meetingType: true,
            meetingDate: true,
          },
        },
      },
    });

    // Analyser les décisions pour détecter les récurrences
    const decisionTexts = decisions.map((d) => d.decisionText.toLowerCase());
    const recurringTopics = this.detectRecurringTopics(decisionTexts);

    if (recurringTopics.length > 0) {
      alerts.push({
        alertType: 'STRATEGIC',
        severity: 'INFO',
        title: 'Problèmes récurrents identifiés',
        description: `${recurringTopics.length} sujet(s) récurrent(s) détecté(s) dans les décisions.`,
        recommendation: 'Analyser les causes profondes et mettre en place des actions correctives structurelles.',
        metadata: {
          recurringTopics,
          count: recurringTopics.length,
        },
      });
    }

    return alerts;
  }

  /**
   * Détecte les sujets récurrents dans les décisions
   */
  private detectRecurringTopics(decisionTexts: string[]): string[] {
    // Mots-clés communs qui indiquent des problèmes récurrents
    const keywords = [
      'absence',
      'retard',
      'discipline',
      'échec',
      'impayé',
      'matériel',
      'infrastructure',
      'effectif',
      'formation',
    ];

    const topicCounts = new Map<string, number>();
    decisionTexts.forEach((text) => {
      keywords.forEach((keyword) => {
        if (text.includes(keyword)) {
          topicCounts.set(keyword, (topicCounts.get(keyword) || 0) + 1);
        }
      });
    });

    // Retourner les sujets qui apparaissent au moins 3 fois
    return Array.from(topicCounts.entries())
      .filter(([_, count]) => count >= 3)
      .map(([topic, _]) => topic);
  }

  /**
   * Récupère les KPIs de réunions pour ORION
   */
  async getMeetingKPIs(tenantId: string, academicYearId: string) {
    const [heldRate, attendanceRate, decisionRate, alerts] = await Promise.all([
      this.calculateMeetingHeldRate(tenantId, academicYearId),
      this.calculateAttendanceRate(tenantId, academicYearId),
      this.calculateDecisionExecutionRate(tenantId, academicYearId),
      this.generateOrionAlerts(tenantId, academicYearId),
    ]);

    return {
      meetingHeldRate: heldRate,
      attendanceRate,
      decisionExecutionRate: decisionRate,
      alerts,
      generatedAt: new Date(),
    };
  }
}

