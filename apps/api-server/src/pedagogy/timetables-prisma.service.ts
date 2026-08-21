/**
 * ============================================================================
 * TIMETABLES PRISMA SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service pour la gestion des emplois du temps
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PedagogicalAuditService } from './services/pedagogical-audit.service';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';


export interface TimetableConflict {
  type: 'CLASS' | 'TEACHER' | 'ROOM';
  message: string;
  conflictingEntry: {
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    className?: string;
    teacherName?: string;
    roomName?: string;
    subjectName?: string;
  };
}

export interface TimetableConflictCheckResult {
  hasConflict: boolean;
  conflicts: TimetableConflict[];
}


@Injectable()
export class TimetablesPrismaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PedagogicalAuditService,
  ) {}


  /**
   * Crée un créneau horaire
   */
  async createTimeSlot(data: {
    tenantId: string;
    dayOfWeek: number; // 0 = Lundi, 6 = Dimanche
    startTime: string; // Format: HH:mm
    endTime: string; // Format: HH:mm
  }) {
    // Vérifier l'unicité
    const existing = await this.prisma.timeSlot.findFirst({
      where: {
        tenantId: data.tenantId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
      },
    });

    if (existing) {
      throw new BadRequestException('Time slot already exists');
    }

    return this.prisma.timeSlot.create({
      data: {
        ...prismaCreateDefaults(),
        ...data,
      },
    });
  }

  /**
   * Crée un emploi du temps
   */
  async createTimetable(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    name: string;
    description?: string;
    startDate: Date;
    endDate?: Date;
  }) {
    return this.prisma.timetable.create({
      data: {
        ...prismaCreateDefaults(),
        ...data,
        isActive: true,
      },
      include: {
        academicYear: true,
        schoolLevel: true,
      },
    });
  }

  /**
   * ⭐ Détecte les conflits pour un créneau proposé (sans le créer).
   *    Utilisé par :
   *    - createTimetableEntry() → throw ConflictException si conflit
   *    - POST /timetables/check-conflict → dry-run pour UX préventive
   *
   *    Conflits détectés :
   *    - CLASS : la classe a déjà un cours sur ce créneau
   *    - TEACHER : l'enseignant est déjà occupé sur ce créneau
   *    - ROOM : la salle est déjà occupée sur ce créneau
   *
   *    Chevauchement d'horaires : startTime < other.endTime AND endTime > other.startTime
   *
   *    ⚠️ La détection est cross-timetable (tous les EDT actifs du tenant),
   *    pas seulement au sein d'un même timetableId — un enseignant ne peut
   *    pas être à deux endroits même dans deux EDT différents.
   */
  async detectConflicts(params: {
    tenantId: string;
    timetableId?: string;
    classId?: string;
    teacherId?: string;
    roomId?: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    excludeEntryId?: string; // pour ignorer l'entry en cours d'édition
  }): Promise<TimetableConflictCheckResult> {
    const conflicts: TimetableConflict[] = [];

    // Clause de chevauchement d'horaires
    // Un créneau [start1, end1) chevauche [start2, end2) si :
    //   start1 < end2 AND end1 > start2
    const timeOverlap = [
      { startTime: { lt: params.endTime }, endTime: { gt: params.startTime } },
    ];

    // Base where : même tenant + même jour + chevauchement horaire
    const baseWhere: any = {
      tenantId: params.tenantId,
      dayOfWeek: params.dayOfWeek,
      OR: timeOverlap,
    };

    // Optionnel : restreindre à un timetableId spécifique
    // (par défaut, on cherche cross-timetable pour les enseignants/salles)
    if (params.timetableId) {
      baseWhere.timetableId = params.timetableId;
    }

    // Exclure l'entry en cours d'édition
    if (params.excludeEntryId) {
      baseWhere.id = { not: params.excludeEntryId };
    }

    // Inclure les relations pour construire un message utile
    const include = {
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
      room: { select: { id: true, name: true } },
    };

    // Check CLASS conflict
    if (params.classId) {
      const classConflicts = await this.prisma.timetableEntry.findMany({
        where: { ...baseWhere, classId: params.classId },
        include,
        take: 5,
      });
      for (const c of classConflicts) {
        conflicts.push({
          type: 'CLASS',
          message: `La classe ${c.class?.name || '?'} a déjà un cours de ${c.subject?.name || '?'} (${c.startTime}-${c.endTime})`,
          conflictingEntry: {
            id: c.id,
            dayOfWeek: c.dayOfWeek,
            startTime: c.startTime,
            endTime: c.endTime,
            className: c.class?.name,
            teacherName: c.teacher ? `${c.teacher.firstName} ${c.teacher.lastName}` : undefined,
            roomName: c.room?.name,
            subjectName: c.subject?.name,
          },
        });
      }
    }

    // Check TEACHER conflict (cross-timetable — un prof ne peut pas être à deux endroits)
    if (params.teacherId) {
      const teacherWhere = { ...baseWhere };
      delete teacherWhere.timetableId; // cross-timetable pour les enseignants
      const teacherConflicts = await this.prisma.timetableEntry.findMany({
        where: { ...teacherWhere, teacherId: params.teacherId },
        include,
        take: 5,
      });
      for (const c of teacherConflicts) {
        conflicts.push({
          type: 'TEACHER',
          message: `L'enseignant ${c.teacher?.firstName || ''} ${c.teacher?.lastName || ''} est déjà assigné à ${c.class?.name || '?'} (${c.subject?.name || '?'}) de ${c.startTime} à ${c.endTime}`,
          conflictingEntry: {
            id: c.id,
            dayOfWeek: c.dayOfWeek,
            startTime: c.startTime,
            endTime: c.endTime,
            className: c.class?.name,
            teacherName: c.teacher ? `${c.teacher.firstName} ${c.teacher.lastName}` : undefined,
            roomName: c.room?.name,
            subjectName: c.subject?.name,
          },
        });
      }
    }

    // Check ROOM conflict (cross-timetable — une salle ne peut pas accueillir 2 cours)
    if (params.roomId) {
      const roomWhere = { ...baseWhere };
      delete roomWhere.timetableId; // cross-timetable pour les salles
      const roomConflicts = await this.prisma.timetableEntry.findMany({
        where: { ...roomWhere, roomId: params.roomId },
        include,
        take: 5,
      });
      for (const c of roomConflicts) {
        conflicts.push({
          type: 'ROOM',
          message: `La salle ${c.room?.name || '?'} est déjà occupée par ${c.class?.name || '?'} (${c.subject?.name || '?'}) de ${c.startTime} à ${c.endTime}`,
          conflictingEntry: {
            id: c.id,
            dayOfWeek: c.dayOfWeek,
            startTime: c.startTime,
            endTime: c.endTime,
            className: c.class?.name,
            teacherName: c.teacher ? `${c.teacher.firstName} ${c.teacher.lastName}` : undefined,
            roomName: c.room?.name,
            subjectName: c.subject?.name,
          },
        });
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
    };
  }

  /**
   * Ajoute une entrée à l'emploi du temps
   */
  async createTimetableEntry(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    timetableId: string;
    classId?: string;
    subjectId?: string;
    teacherId?: string;
    roomId?: string;
    timeSlotId?: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    duration?: number;
  }) {
    // Vérifier que l'emploi du temps existe
    const timetable = await this.prisma.timetable.findFirst({
      where: { id: data.timetableId, tenantId: data.tenantId },
    });

    if (!timetable) {
      throw new NotFoundException(`Timetable with ID ${data.timetableId} not found`);
    }

    // ⭐ Détection de conflits — NON BLOQUANTE (try/catch)
    //    Si la détection échoue (ex: Prisma client pas à jour), on continue quand même.
    //    L'utilisateur peut ajouter des séances sans être bloqué par une erreur technique.
    try {
      const conflictCheck = await this.detectConflicts({
        tenantId: data.tenantId,
        timetableId: data.timetableId,
        classId: data.classId,
        teacherId: data.teacherId,
        roomId: data.roomId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
      });

      if (conflictCheck.hasConflict) {
        throw new ConflictException({
          message: 'Conflit détecté — création impossible',
          conflicts: conflictCheck.conflicts,
        });
      }
    } catch (e) {
      // Si c'est un ConflictException (vrai conflit), on le relance
      if (e instanceof ConflictException) throw e;
      // Sinon c'est une erreur technique (Prisma client) → on log et continue
      console.warn('[createTimetableEntry] Conflict detection failed, skipping:', e.message);
    }

    // Vérifier la capacité de la salle
    if (data.roomId && data.classId) {
      const [room, academicClass] = await Promise.all([
        this.prisma.room.findUnique({ where: { id: data.roomId } }),
        this.prisma.academicClass.findUnique({ where: { id: data.classId } }),
      ]);

      if (room && academicClass && room.capacity && academicClass.capacity && academicClass.capacity > room.capacity) {
        throw new BadRequestException(`Capacité insuffisante : La salle (${room.capacity}) est trop petite pour la classe (${academicClass.capacity}).`);
      }
    }

    const entry = await this.prisma.timetableEntry.create({
      data: {
        ...prismaCreateDefaults(),
        ...data,
      },
      include: {
        class: true,
        subject: true,
        teacher: true,
        room: true,
        timeSlot: true,
      },
    });

    // Log action (non-blocking, don't fail if audit fails)
    try {
      await this.audit.log({
        tenantId: data.tenantId,
        entityType: 'TIMETABLE_SLOT',
        entityId: entry.id,
        action: 'CREATE',
        performedBy: 'SYSTEM',
        newData: JSON.parse(JSON.stringify(entry)),
      });
    } catch (auditError) {
      // Audit logging failure should not block the operation
    }

    return entry;

  }

  /**
   * Récupère un emploi du temps avec ses entrées
   */
  async getTimetable(id: string, tenantId: string) {
    const timetable = await this.prisma.timetable.findFirst({
      where: { id, tenantId },
      include: {
        academicYear: true,
        schoolLevel: true,
        entries: {
          include: {
            class: true,
            subject: true,
            teacher: true,
            room: true,
            timeSlot: true,
          },
          orderBy: [
            { dayOfWeek: 'asc' },
            { startTime: 'asc' },
          ],
        },
      },
    });

    if (!timetable) {
      throw new NotFoundException(`Timetable with ID ${id} not found`);
    }

    return timetable;
  }

  /**
   * Récupère tous les emplois du temps
   */
  async findAllTimetables(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      isActive?: boolean;
    }
  ) {
    const where: any = {
      tenantId,
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return this.prisma.timetable.findMany({
      where,
      include: {
        academicYear: true,
        schoolLevel: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Met à jour un emploi du temps
   */
  async updateTimetable(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    await this.getTimetable(id, tenantId);

    return this.prisma.timetable.update({
      where: { id },
      data: { ...prismaUpdateDefaults(), ...data },
      include: {
        academicYear: true,
        schoolLevel: true,
      },
    });
  }

  /**
   * Supprime une entrée d'emploi du temps
   * (alias deleteTimetableEntry pour compatibilité avec le controller)
   */
  async deleteTimetableEntry(id: string, tenantId: string) {
    return this.deleteTimetableSlot(id, tenantId);
  }

  /**
   * Supprime une entrée d'emploi du temps
   */
  async deleteTimetableSlot(id: string, tenantId: string) {
    const entry = await this.prisma.timetableEntry.findFirst({
      where: { id, tenantId },
    });

    if (!entry) {
      throw new NotFoundException(`TimetableSlot with ID ${id} not found`);
    }

    await this.prisma.timetableEntry.delete({
      where: { id },
    });

    // Log action (non-blocking)
    try {
      await this.audit.log({
        tenantId,
        entityType: 'TIMETABLE_SLOT',
        entityId: id,
        action: 'DELETE',
        performedBy: 'SYSTEM',
        oldData: JSON.parse(JSON.stringify(entry)),
      });
    } catch (auditError) {
      // Audit logging failure should not block the operation
    }

    return { success: true };
  }

  /// ⭐ Supprime un timetable complet + toutes ses entries (cascade).
  async deleteTimetable(id: string, tenantId: string) {
    const timetable = await this.prisma.timetable.findFirst({
      where: { id, tenantId },
    });
    if (!timetable) {
      throw new NotFoundException(`Timetable with ID ${id} not found`);
    }
    // Supprimer d'abord les entries (pas de cascade auto sur cette relation)
    await this.prisma.timetableEntry.deleteMany({
      where: { timetableId: id },
    });
    await this.prisma.timetable.delete({
      where: { id },
    });
    return { success: true };
  }
}

