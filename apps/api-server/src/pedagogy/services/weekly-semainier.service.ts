/**
 * ============================================================================
 * WEEKLY SEMAINIER SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service pour gestion du cahier du semainier
 * Rotation automatique ou manuelle entre enseignants
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class WeeklySemainierService {
  private readonly logger = new Logger(WeeklySemainierService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Désigne automatiquement le semainier pour une semaine
   * Rotation hebdomadaire entre enseignants actifs
   */
  async assignSemainierAuto(
    tenantId: string,
    academicYearId: string,
    schoolLevelId: string,
    weekStartDate: Date,
    weekEndDate: Date,
  ) {
    // Calculer le numéro de semaine
    const weekNumber = this.getWeekNumber(weekStartDate);

    // Vérifier qu'il n'y a pas déjà une désignation pour cette semaine
    const existing = await this.prisma.weeklyDutyAssignment.findFirst({
      where: {
        tenantId,
        academicYearId,
        schoolLevelId,
        weekStartDate,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Duty assignment already exists for week starting ${weekStartDate.toISOString()}`,
      );
    }

    // Récupérer les enseignants actifs du niveau
    const teachers = await this.prisma.teacher.findMany({
      where: {
        tenantId,
        schoolLevelId,
        status: 'active',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
      orderBy: { id: 'asc' },
    });

    if (teachers.length === 0) {
      throw new NotFoundException(`No active teachers found for school level ${schoolLevelId}`);
    }

    // Récupérer la dernière désignation pour déterminer la rotation
    const lastAssignment = await this.prisma.weeklyDutyAssignment.findFirst({
      where: {
        tenantId,
        academicYearId,
        schoolLevelId,
        isActive: true,
      },
      orderBy: { weekStartDate: 'desc' },
    });

    // Déterminer le prochain enseignant (rotation circulaire)
    let nextTeacherIndex = 0;
    if (lastAssignment) {
      const lastTeacherIndex = teachers.findIndex((t) => t.id === lastAssignment.teacherId);
      if (lastTeacherIndex >= 0) {
        nextTeacherIndex = (lastTeacherIndex + 1) % teachers.length;
      }
    }

    const assignedTeacher = teachers[nextTeacherIndex];

    // Créer la désignation
    return this.prisma.weeklyDutyAssignment.create({
      data: {
        tenantId,
        academicYearId,
        schoolLevelId,
        teacherId: assignedTeacher.id,
        weekStartDate,
        weekEndDate,
        weekNumber,
        assignmentMode: 'AUTO',
        isActive: true,
      },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });
  }

  /**
   * Désigne manuellement le semainier pour une semaine
   * Par directeur ou admin
   */
  async assignSemainierManual(
    tenantId: string,
    academicYearId: string,
    schoolLevelId: string,
    weekStartDate: Date,
    weekEndDate: Date,
    teacherId: string,
    assignedBy: string,
    reason?: string,
  ) {
    // Calculer le numéro de semaine
    const weekNumber = this.getWeekNumber(weekStartDate);

    // Vérifier que l'enseignant existe et appartient au niveau
    const teacher = await this.prisma.teacher.findFirst({
      where: {
        id: teacherId,
        tenantId,
        schoolLevelId,
        status: 'active',
      },
    });

    if (!teacher) {
      throw new NotFoundException(
        `Active teacher with ID ${teacherId} not found for school level ${schoolLevelId}`,
      );
    }

    // Vérifier qu'il n'y a pas déjà une désignation pour cette semaine
    const existing = await this.prisma.weeklyDutyAssignment.findFirst({
      where: {
        tenantId,
        academicYearId,
        schoolLevelId,
        weekStartDate,
      },
    });

    if (existing) {
      // Si changement exceptionnel, désactiver l'ancienne
      await this.prisma.weeklyDutyAssignment.update({
        where: { id: existing.id },
        data: { isActive: false },
      });
    }

    // Créer la désignation manuelle
    return this.prisma.weeklyDutyAssignment.create({
      data: {
        tenantId,
        academicYearId,
        schoolLevelId,
        teacherId,
        weekStartDate,
        weekEndDate,
        weekNumber,
        assignmentMode: 'MANUAL',
        assignedBy,
        reason: reason || 'Désignation manuelle par la direction',
        isActive: true,
      },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        assigner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Crée ou met à jour le cahier du semainier pour une semaine
   */
  async createOrUpdateSemainier(
    tenantId: string,
    academicYearId: string,
    schoolLevelId: string,
    assignmentId: string,
    teacherId: string,
    content: string,
  ) {
    // Vérifier que l'assignation existe et appartient à l'enseignant
    const assignment = await this.prisma.weeklyDutyAssignment.findFirst({
      where: {
        id: assignmentId,
        tenantId,
        academicYearId,
        schoolLevelId,
        teacherId,
        isActive: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException(
        `Active duty assignment with ID ${assignmentId} not found for teacher ${teacherId}`,
      );
    }

    // Vérifier si le semainier existe déjà
    const existing = await this.prisma.weeklySemainier.findFirst({
      where: { assignmentId },
    });

    if (existing) {
      // Vérifier que le statut permet la modification
      if (existing.status !== 'EN_COURS') {
        throw new BadRequestException(
          `Cannot update semainier with status ${existing.status}. Only EN_COURS can be updated.`,
        );
      }

      return this.prisma.weeklySemainier.update({
        where: { id: existing.id },
        data: {
          content,
        },
        include: {
          assignment: {
            include: {
              teacher: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          dailyEntries: {
            orderBy: { date: 'asc' },
          },
          incidents: {
            orderBy: { date: 'desc' },
          },
        },
      });
    }

    // Créer le semainier
    return this.prisma.weeklySemainier.create({
      data: {
        tenantId,
        academicYearId,
        schoolLevelId,
        assignmentId,
        weekStartDate: assignment.weekStartDate,
        weekEndDate: assignment.weekEndDate,
        content,
        status: 'EN_COURS',
      },
      include: {
        assignment: {
          include: {
            teacher: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Ajoute une entrée quotidienne au semainier
   */
  async addDailyEntry(
    semainierId: string,
    tenantId: string,
    date: Date,
    data: {
      observations?: string;
      actions?: string;
      events?: any;
    },
  ) {
    const semainier = await this.prisma.weeklySemainier.findFirst({
      where: { id: semainierId, tenantId },
    });

    if (!semainier) {
      throw new NotFoundException(`Semainier with ID ${semainierId} not found`);
    }

    if (semainier.status !== 'EN_COURS') {
      throw new BadRequestException(
        `Cannot add entry to semainier with status ${semainier.status}. Only EN_COURS can be modified.`,
      );
    }

    // Vérifier que la date est dans la semaine du semainier
    if (date < semainier.weekStartDate || date > semainier.weekEndDate) {
      throw new BadRequestException(
        `Date ${date.toISOString()} is not within semainier week (${semainier.weekStartDate.toISOString()} - ${semainier.weekEndDate.toISOString()})`,
      );
    }

    return this.prisma.weeklySemainierDailyEntry.upsert({
      where: {
        semainierId_date: {
          semainierId,
          date,
        },
      },
      create: {
        tenantId: semainier.tenantId,
        academicYearId: semainier.academicYearId,
        schoolLevelId: semainier.schoolLevelId,
        semainierId,
        date,
        observations: data.observations,
        actions: data.actions,
        events: data.events,
      },
      update: {
        observations: data.observations,
        actions: data.actions,
        events: data.events,
      },
    });
  }

  /**
   * Signale un incident dans le semainier
   */
  async reportIncident(
    semainierId: string,
    tenantId: string,
    date: Date,
    reportedBy: string,
    data: {
      type: 'ABSENCE' | 'RETARD' | 'DISCIPLINE' | 'SECURITY' | 'OTHER';
      description: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      actions?: string;
    },
  ) {
    const semainier = await this.prisma.weeklySemainier.findFirst({
      where: { id: semainierId, tenantId },
    });

    if (!semainier) {
      throw new NotFoundException(`Semainier with ID ${semainierId} not found`);
    }

    // Créer l'incident
    const incident = await this.prisma.weeklySemainierIncident.create({
      data: {
        tenantId: semainier.tenantId,
        academicYearId: semainier.academicYearId,
        schoolLevelId: semainier.schoolLevelId,
        semainierId,
        date,
        type: data.type,
        description: data.description,
        severity: data.severity,
        actions: data.actions,
        reportedBy,
        escalatedToQHSE: data.severity === 'CRITICAL' || data.severity === 'HIGH',
      },
      include: {
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Si incident critique, escalader vers QHSE
    if (incident.escalatedToQHSE) {
      // TODO: Créer un incident QHSE automatiquement
      this.logger.log(`Critical incident ${incident.id} should be escalated to QHSE`);
    }

    return incident;
  }

  /**
   * Soumet le semainier à la direction (en fin de semaine)
   */
  async submitSemainier(semainierId: string, tenantId: string, teacherId: string) {
    const semainier = await this.prisma.weeklySemainier.findFirst({
      where: {
        id: semainierId,
        tenantId,
        assignment: {
          teacherId,
          isActive: true,
        },
      },
    });

    if (!semainier) {
      throw new NotFoundException(`Semainier with ID ${semainierId} not found for teacher ${teacherId}`);
    }

    if (semainier.status !== 'EN_COURS') {
      throw new BadRequestException(
        `Cannot submit semainier with status ${semainier.status}. Only EN_COURS can be submitted.`,
      );
    }

    // Vérifier qu'on est en fin de semaine (optionnel, peut être soumis avant)
    const today = new Date();
    if (today < semainier.weekEndDate) {
      // Warning mais autoriser
      this.logger.warn(`Semainier submitted before week end (${semainier.weekEndDate.toISOString()})`);
    }

    return this.prisma.weeklySemainier.update({
      where: { id: semainierId },
      data: {
        status: 'SOUMIS',
        submittedAt: new Date(),
      },
      include: {
        assignment: {
          include: {
            teacher: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        dailyEntries: {
          orderBy: { date: 'asc' },
        },
        incidents: {
          orderBy: { date: 'desc' },
        },
      },
    });
  }

  /**
   * Valide le semainier (Direction)
   */
  async validateSemainier(semainierId: string, tenantId: string, directorId: string) {
    const semainier = await this.prisma.weeklySemainier.findFirst({
      where: { id: semainierId, tenantId, status: 'SOUMIS' },
    });

    if (!semainier) {
      throw new NotFoundException(`Submitted semainier with ID ${semainierId} not found`);
    }

    return this.prisma.weeklySemainier.update({
      where: { id: semainierId },
      data: {
        status: 'VALIDATED',
        validatedAt: new Date(),
        validatedBy: directorId,
      },
      include: {
        assignment: {
          include: {
            teacher: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        dailyEntries: {
          orderBy: { date: 'asc' },
        },
        incidents: {
          orderBy: { date: 'desc' },
        },
      },
    });
  }

  /**
   * Récupère le semainier actif pour un enseignant
   */
  async getCurrentSemainier(
    tenantId: string,
    academicYearId: string,
    schoolLevelId: string,
    teacherId: string,
  ) {
    const today = new Date();

    const assignment = await this.prisma.weeklyDutyAssignment.findFirst({
      where: {
        tenantId,
        academicYearId,
        schoolLevelId,
        teacherId,
        isActive: true,
        weekStartDate: { lte: today },
        weekEndDate: { gte: today },
      },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        semainier: {
          include: {
            dailyEntries: {
              orderBy: { date: 'asc' },
            },
            incidents: {
              orderBy: { date: 'desc' },
            },
          },
        },
      },
    });

    return assignment;
  }

  /**
   * Récupère tous les semainiers soumis (Direction)
   */
  async findSubmittedSemainiers(
    tenantId: string,
    academicYearId: string,
    schoolLevelId?: string,
    status?: 'SOUMIS' | 'VALIDATED',
  ) {
    const where: any = {
      tenantId,
      academicYearId,
      status: status || 'SOUMIS',
    };

    if (schoolLevelId && schoolLevelId !== 'ALL') {
      where.schoolLevelId = schoolLevelId;
    }

    return this.prisma.weeklySemainier.findMany({
      where,
      include: {
        assignment: {
          include: {
            teacher: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        dailyEntries: {
          orderBy: { date: 'asc' },
        },
        incidents: {
          orderBy: { date: 'desc' },
        },
      },
      orderBy: { weekStartDate: 'desc' },
    });
  }

  /**
   * Calcule le numéro de semaine (ISO 8601)
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
}

