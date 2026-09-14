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
import { AccessScope } from '../common/context/access-scope.service';
import { applyLevelScope } from '../common/context/scope-where';


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
   *
   * ⭐ Auto-résolution AcademicClass → Class (sections physiques)
   *    Le frontend récupère les classes via /api/pedagogy/academic-structure/classes
   *    qui renvoie des AcademicClass (table pedagogy_academic_classes — ex: "CI", "CP").
   *    Mais TimetableEntry.classId FK → classes.id (table des sections physiques
   *    comme "CI/A", "CI/B", "CI/C").
   *
   *    Donc si data.classId est un AcademicClass.id, on résout vers ses sections
   *    physiques via Class.officialClassId, et on crée une TimetableEntry par section.
   *    Ex: l'utilisateur sélectionne "CI" + "CP" (2 academicClasses) → le frontend
   *    fait 2 POST, et chaque POST crée N entries (N = nombre de sections physiques).
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
    step?: string;
  }) {
    // Vérifier que l'emploi du temps existe
    const timetable = await this.prisma.timetable.findFirst({
      where: { id: data.timetableId, tenantId: data.tenantId },
    });

    if (!timetable) {
      throw new NotFoundException(`Timetable with ID ${data.timetableId} not found`);
    }

    // ⭐ Étape 1 : Résoudre data.classId en liste de Class.id (sections physiques)
    //    - Si data.classId est déjà un Class.id → 1 seule entry à créer
    //    - Si data.classId est un AcademicClass.id → N entries (N sections physiques)
    //    - Si data.classId est invalide → erreur claire
    let targetClassIds: string[] = [];
    let resolvedAcademicClassName: string | null = null;
    if (data.classId) {
      // D'abord vérifier si c'est déjà un Class.id (section physique)
      const physicalClass = await this.prisma.class.findUnique({
        where: { id: data.classId },
        select: { id: true, name: true, officialClassId: true },
      });
      if (physicalClass) {
        targetClassIds = [data.classId];
      } else {
        // Vérifier si c'est un AcademicClass.id → résoudre vers ses sections physiques
        const academicClass = await this.prisma.academicClass.findUnique({
          where: { id: data.classId },
          include: {
            physicalClasses: {
              select: { id: true, name: true },
              orderBy: { name: 'asc' },
            },
          },
        });
        if (academicClass && academicClass.physicalClasses.length > 0) {
          // ⭐ NE CRÉER QU'UNE SEULE entry par AcademicClass — pas une par section physique.
          //    L'EDT appartient à la classe académique (ex: "CI"), pas à chaque section
          //    (CI/A, CI/B, CI/C). Les enseignants verront l'EDT via leur classe dans
          //    leur UI, et les parents verront celui de leur enfant.
          //    On utilise le premier Class.id (section physique) comme proxy pour
          //    satisfaire la FK sur classes.id. Le frontend affiche l'entry via
          //    Class.officialClassId quand l'utilisateur sélectionne l'AcademicClass.
          targetClassIds = [academicClass.physicalClasses[0].id];
          resolvedAcademicClassName = academicClass.name;
        } else if (academicClass) {
          // AcademicClass existe mais n'a aucune section physique
          throw new BadRequestException(
            `La classe "${academicClass.name}" n'a aucune section physique (CI/A, CI/B...). ` +
            `Veuillez d'abord créer les sections dans Paramètres > Sections par classe, ` +
            `ou sélectionner une section physique directement.`,
          );
        } else {
          // Ni Class ni AcademicClass → ID complètement invalide
          throw new BadRequestException(
            `Classe introuvable (ID: ${data.classId}). ` +
            `Sélectionnez une classe valide dans la liste.`,
          );
        }
      }
    }

    // ⭐ Étape 2 : Détection de conflits — NON BLOQUANTE (try/catch)
    //    Si la détection échoue (ex: Prisma client pas à jour), on continue quand même.
    //    L'utilisateur peut ajouter des séances sans être bloqué par une erreur technique.
    //    NOTE : la détection utilise data.classId original (AcademicClass.id) → ne matchera
    //    pas les entries existantes (qui ont des Class.id). C'est une limite acceptable
    //    pour l'instant — la priorité est de faire marcher la création.
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

    // ⭐ Étape 3 : Vérifier la capacité de la salle (sur la première section physique)
    if (data.roomId && targetClassIds.length > 0) {
      const [room, firstPhysicalClass] = await Promise.all([
        this.prisma.room.findUnique({ where: { id: data.roomId } }),
        this.prisma.class.findUnique({ where: { id: targetClassIds[0] } }),
      ]);

      // Si on n'a pas trouvé la capacity sur la section, fallback à l'AcademicClass
      let classCapacity: number | null | undefined = firstPhysicalClass?.capacity;
      if (!classCapacity && resolvedAcademicClassName) {
        const ac = await this.prisma.academicClass.findUnique({
          where: { id: data.classId! },
          select: { capacity: true },
        });
        classCapacity = ac?.capacity;
      }

      if (room && classCapacity && room.capacity && classCapacity > room.capacity) {
        throw new BadRequestException(`Capacité insuffisante : La salle (${room.capacity}) est trop petite pour la classe (${classCapacity}).`);
      }
    }

    // ⭐ Étape 4 : Créer une TimetableEntry par section physique
    //    On évite de cloner `data` (qui contient `classId` à remplacer) en construisant
    //    explicitement le payload Prisma.
    const baseData: any = {
      tenantId: data.tenantId,
      academicYearId: data.academicYearId,
      schoolLevelId: data.schoolLevelId,
      timetableId: data.timetableId,
      subjectId: data.subjectId,
      teacherId: data.teacherId,
      roomId: data.roomId,
      timeSlotId: data.timeSlotId,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      duration: data.duration,
      step: data.step,
    };

    const createdEntries: any[] = [];
    for (const targetClassId of targetClassIds) {
      const entry = await this.prisma.timetableEntry.create({
        data: {
          ...prismaCreateDefaults(),
          ...baseData,
          classId: targetClassId, // ⭐ Override avec le Class.id résolu
        },
        include: {
          class: true,
          subject: true,
          teacher: true,
          room: true,
          timeSlot: true,
        },
      });
      createdEntries.push(entry);

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
    }

    // ⭐ Étape 5 : Retourner le résultat
    //    - Si 1 seule entry → retourner l'entry (compat avec ancien comportement)
    //    - Si N entries → retourner { count: N, entries: [...] } pour que le frontend
    //      puisse afficher le bon nombre de séances créées
    if (createdEntries.length === 1) {
      return createdEntries[0];
    }
    return {
      count: createdEntries.length,
      entries: createdEntries,
      multiClass: true,
      academicClassName: resolvedAcademicClassName,
    };

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
    },
    scope?: AccessScope,
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

    // ⭐ 2026-09-15 : périmètre niveau serveur — un directeur MAT_PRI ne voit que
    //    les emplois du temps de ses niveaux ; le promoteur voit tout.
    applyLevelScope(where, scope);

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
   * ⭐ Met à jour une entrée d'emploi du temps (pour édition inline)
   *    Utilisé par PUT /timetables/entries/:id
   *    Permet à l'utilisateur de modifier une séance existante :
   *    - Changer la matière (subjectId)
   *    - Changer la durée (et donc startTime/endTime)
   *    - Mettre à jour l'étape (step) — ex: "Étape 1" → "Étapes 2-3"
   *    Tous les champs sont optionnels — on ne met à jour que ce qui est envoyé.
   */
  async updateTimetableEntry(
    id: string,
    tenantId: string,
    updates: {
      subjectId?: string;
      teacherId?: string;
      roomId?: string;
      dayOfWeek?: number;
      startTime?: string;
      endTime?: string;
      duration?: number;
      step?: string;
    },
  ) {
    // Vérifier que l'entry existe et appartient au tenant
    const existing = await this.prisma.timetableEntry.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`TimetableEntry with ID ${id} not found`);
    }

    // Construire le payload Prisma — ne mettre à jour que les champs fournis
    // (undefined = ne pas changer)
    const updateData: any = { ...prismaUpdateDefaults() };
    if (updates.subjectId !== undefined) updateData.subjectId = updates.subjectId || null;
    if (updates.teacherId !== undefined) updateData.teacherId = updates.teacherId || null;
    if (updates.roomId !== undefined) updateData.roomId = updates.roomId || null;
    if (updates.dayOfWeek !== undefined) updateData.dayOfWeek = updates.dayOfWeek;
    if (updates.startTime !== undefined) updateData.startTime = updates.startTime;
    if (updates.endTime !== undefined) updateData.endTime = updates.endTime;
    if (updates.duration !== undefined) updateData.duration = updates.duration;
    if (updates.step !== undefined) updateData.step = updates.step || null;

    const updated = await this.prisma.timetableEntry.update({
      where: { id },
      data: updateData,
      include: {
        class: true,
        subject: true,
        teacher: true,
        room: true,
        timeSlot: true,
      },
    });

    // Log action (non-blocking)
    try {
      await this.audit.log({
        tenantId,
        entityType: 'TIMETABLE_SLOT',
        entityId: id,
        action: 'UPDATE',
        performedBy: 'SYSTEM',
        oldData: JSON.parse(JSON.stringify(existing)),
        newData: JSON.parse(JSON.stringify(updated)),
      });
    } catch (auditError) {
      // Audit logging failure should not block the operation
    }

    return updated;
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

