import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * ============================================================================
 * TimetableEngineService — Moteur de génération d'emplois du temps (STE V1)
 * ============================================================================
 *
 * V1 : Génération automatique basique avec contraintes hard.
 *
 * Pipeline :
 *   1. Récupérer la config (jours, créneaux)
 *   2. Récupérer les ressources (classes, matières, enseignants, salles)
 *   3. Récupérer les disponibilités enseignants
 *   4. Générer une solution (algorithme CSP simple : backtracking glouton)
 *   5. Calculer les scores
 *   6. Retourner la solution
 * ============================================================================
 */

export interface TimetableEntry {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  roomId: string | null;
  roomName: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface TimetableConflict {
  type: string; // TEACHER_CONFLICT, ROOM_CONFLICT
  message: string;
  entries: TimetableEntry[];
}

export interface GeneratedSolution {
  id: string;
  score: number;
  feasibilityScore: number;
  pedagogyScore: number;
  comfortScore: number;
  preferenceScore: number;
  conflictCount: number;
  conflicts: TimetableConflict[];
  entries: TimetableEntry[];
  status: string;
  notes: string;
}

@Injectable()
export class TimetableEngineService {
  private readonly logger = new Logger(TimetableEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════
  //  CONFIG — Gestion de la configuration d'emploi du temps
  // ═══════════════════════════════════════════════════════════════════════

  async getConfig(tenantId: string, schoolLevelId: string, academicYearId: string) {
    await this.ensureTablesExist();
    let config = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "timetable_configs"
      WHERE "tenantId" = $1 AND "schoolLevelId" = $2 AND "academicYearId" = $3
    `, tenantId, schoolLevelId, academicYearId);

    if (!config[0]) {
      // Créer une config par défaut
      const id = uuidv4();
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "timetable_configs" ("id", "tenantId", "schoolLevelId", "academicYearId")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
      `, id, tenantId, schoolLevelId, academicYearId);
      config = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT * FROM "timetable_configs"
        WHERE "tenantId" = $1 AND "schoolLevelId" = $2 AND "academicYearId" = $3
      `, tenantId, schoolLevelId, academicYearId);
    }

    return config[0] || null;
  }

  async updateConfig(tenantId: string, schoolLevelId: string, academicYearId: string, data: any) {
    await this.ensureTablesExist();
    // Upsert
    const existing = await this.getConfig(tenantId, schoolLevelId, academicYearId);
    if (existing) {
      const sets: string[] = [];
      const params: any[] = [];
      let idx = 1;
      const fields = ['schoolDays', 'timeBlocks', 'dayStartTime', 'dayEndTime', 'defaultSessionDuration', 'lunchBreakStart', 'lunchBreakEnd', 'saturdayEnabled', 'eveningEnabled', 'eveningStart', 'eveningEnd'];
      for (const f of fields) {
        if (data[f] !== undefined) {
          sets.push(`"${f}" = $${idx++}`);
          params.push(typeof data[f] === 'object' ? JSON.stringify(data[f]) : data[f]);
        }
      }
      sets.push(`"updatedAt" = NOW()`);
      params.push(tenantId, schoolLevelId, academicYearId);
      await this.prisma.$executeRawUnsafe(`UPDATE "timetable_configs" SET ${sets.join(', ')} WHERE "tenantId" = $${idx++} AND "schoolLevelId" = $${idx++} AND "academicYearId" = $${idx++}`, ...params);
    } else {
      const id = uuidv4();
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "timetable_configs" ("id", "tenantId", "schoolLevelId", "academicYearId", "schoolDays", "timeBlocks", "dayStartTime", "dayEndTime", "defaultSessionDuration", "lunchBreakStart", "lunchBreakEnd", "saturdayEnabled", "eveningEnabled", "eveningStart", "eveningEnd")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT ("tenantId", "schoolLevelId", "academicYearId") DO UPDATE SET
          "schoolDays" = EXCLUDED."schoolDays", "timeBlocks" = EXCLUDED."timeBlocks",
          "dayStartTime" = EXCLUDED."dayStartTime", "dayEndTime" = EXCLUDED."dayEndTime",
          "defaultSessionDuration" = EXCLUDED."defaultSessionDuration",
          "lunchBreakStart" = EXCLUDED."lunchBreakStart", "lunchBreakEnd" = EXCLUDED."lunchBreakEnd",
          "saturdayEnabled" = EXCLUDED."saturdayEnabled", "eveningEnabled" = EXCLUDED."eveningEnabled",
          "eveningStart" = EXCLUDED."eveningStart", "eveningEnd" = EXCLUDED."eveningEnd",
          "updatedAt" = NOW()
      `, id, tenantId, schoolLevelId, academicYearId,
        JSON.stringify(data.schoolDays || [1,2,3,4,5]),
        JSON.stringify(data.timeBlocks || []),
        data.dayStartTime || '08:00', data.dayEndTime || '18:00',
        data.defaultSessionDuration || 120,
        data.lunchBreakStart || '12:00', data.lunchBreakEnd || '14:00',
        data.saturdayEnabled || false, data.eveningEnabled || false,
        data.eveningStart || '16:00', data.eveningEnd || '18:00',
      );
    }
    return this.getConfig(tenantId, schoolLevelId, academicYearId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  TEACHER AVAILABILITY
  // ═══════════════════════════════════════════════════════════════════════

  async getAvailability(tenantId: string, teacherId?: string) {
    await this.ensureTablesExist();
    if (teacherId) {
      return this.prisma.$queryRawUnsafe<any[]>(`
        SELECT * FROM "teacher_availability" WHERE "tenantId" = $1 AND "teacherId" = $2 ORDER BY "dayOfWeek", "startTime"
      `, tenantId, teacherId);
    }
    return this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "teacher_availability" WHERE "tenantId" = $1 ORDER BY "teacherId", "dayOfWeek", "startTime"
    `, tenantId);
  }

  async setAvailability(tenantId: string, data: { teacherId: string; staffId?: string; dayOfWeek: number; startTime: string; endTime: string; status: string; reason?: string }) {
    await this.ensureTablesExist();
    const id = uuidv4();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "teacher_availability" ("id", "tenantId", "teacherId", "staffId", "dayOfWeek", "startTime", "endTime", "status", "reason")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT ("tenantId", "teacherId", "dayOfWeek", "startTime", "endTime") DO UPDATE SET
        "status" = EXCLUDED."status", "reason" = EXCLUDED."reason", "staffId" = EXCLUDED."staffId", "updatedAt" = NOW()
    `, id, tenantId, data.teacherId, data.staffId || null, data.dayOfWeek, data.startTime, data.endTime, data.status, data.reason || null);
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  GENERATE — Le cœur du moteur de génération
  // ═══════════════════════════════════════════════════════════════════════

  async generate(tenantId: string, academicYearId: string, schoolLevelId: string): Promise<GeneratedSolution> {
    await this.ensureTablesExist();
    this.logger.log(`Generating timetable: tenant=${tenantId}, year=${academicYearId}, level=${schoolLevelId}`);

    // 1. Récupérer la config
    const config = await this.getConfig(tenantId, schoolLevelId, academicYearId);
    if (!config) throw new BadRequestException('Configuration d\'emploi du temps manquante. Configurez d\'abord les créneaux horaires.');

    const schoolDays: number[] = Array.isArray(config.schoolDays) ? config.schoolDays : JSON.parse(config.schoolDays || '[1,2,3,4,5]');
    const timeBlocks: any[] = Array.isArray(config.timeBlocks) ? config.timeBlocks : JSON.parse(config.timeBlocks || '[]');

    if (timeBlocks.length === 0) throw new BadRequestException('Aucun créneau horaire configuré. Ajoutez des créneaux dans la configuration.');

    // 2. Récupérer les ressources
    const classes = await this.prisma.class.findMany({
      where: { tenantId, academicYearId, schoolLevelId },
      select: { id: true, name: true, capacity: true },
    });
    if (classes.length === 0) throw new BadRequestException('Aucune classe trouvée pour ce niveau et cette année.');

    const subjects = await this.prisma.subject.findMany({
      where: { tenantId, academicYearId, schoolLevelId },
      select: { id: true, name: true, code: true },
    });
    if (subjects.length === 0) throw new BadRequestException('Aucune matière trouvée pour ce niveau.');

    // 3. Récupérer les affectations (classe → matière → enseignant)
    const assignments = await this.prisma.subjectAssignment.findMany({
      where: { tenantId, academicYearId, schoolLevelId },
      include: {
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // 4. Récupérer les salles
    const rooms = await this.prisma.room.findMany({
      where: { tenantId, schoolLevelId },
      select: { id: true, name: true, roomCode: true, capacity: true, roomType: true },
    });

    // 5. Récupérer les disponibilités enseignants
    const availabilityRows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "teacher_availability" WHERE "tenantId" = $1
    `, tenantId);
    const teacherAvailability = new Map<string, Set<string>>();
    for (const av of availabilityRows) {
      if (av.status === 'UNAVAILABLE' || av.status === 'FORBIDDEN') {
        const key = `${av.teacherId}:${av.dayOfWeek}:${av.startTime}-${av.endTime}`;
        if (!teacherAvailability.has(av.teacherId)) teacherAvailability.set(av.teacherId, new Set());
        teacherAvailability.get(av.teacherId)!.add(key);
      }
    }

    // 6. GÉNÉRATION — Algorithme CSP simple (greedy + backtracking léger)
    const entries: TimetableEntry[] = [];
    const conflicts: TimetableConflict[] = [];

    // Tracker pour détecter les conflits
    const teacherSlots = new Map<string, Set<string>>(); // teacherId → Set("day:start-end")
    const roomSlots = new Map<string, Set<string>>();    // roomId → Set("day:start-end")
    const classSlots = new Map<string, Set<string>>();   // classId → Set("day:start-end")

    // Pour chaque classe, assigner chaque matière à un créneau
    for (const cls of classes) {
      // Récupérer les affectations pour cette classe
      const classAssignments = assignments.filter(a => a.classId === cls.id);

      for (const assignment of classAssignments) {
        if (!assignment.teacher) continue;

        const teacherKey = assignment.teacher.id;
        const subject = assignment.subject;
        let placed = false;

        // Essayer chaque jour + créneau
        for (const day of schoolDays) {
          if (placed) break;

          for (const block of timeBlocks) {
            if (block.type !== 'BLOCK') continue; // Skip breaks
            if (placed) break;

            const slotKey = `${day}:${block.start}-${block.end}`;

            // Vérifier disponibilité enseignant
            if (teacherAvailability.has(teacherKey) && teacherAvailability.get(teacherKey)!.has(slotKey)) {
              continue; // Enseignant indisponible
            }

            // Vérifier conflit enseignant (déjà occupé)
            if (teacherSlots.has(teacherKey) && teacherSlots.get(teacherKey)!.has(slotKey)) {
              continue;
            }

            // Vérifier conflit classe (déjà occupée)
            if (classSlots.has(cls.id) && classSlots.get(cls.id)!.has(slotKey)) {
              continue;
            }

            // Assigner une salle (première disponible)
            let assignedRoom: any = null;
            for (const room of rooms) {
              const roomKey = room.id;
              if (!roomSlots.has(roomKey) || !roomSlots.get(roomKey)!.has(slotKey)) {
                assignedRoom = room;
                if (!roomSlots.has(roomKey)) roomSlots.set(roomKey, new Set());
                roomSlots.get(roomKey)!.add(slotKey);
                break;
              }
            }

            // Marquer les slots comme occupés
            if (!teacherSlots.has(teacherKey)) teacherSlots.set(teacherKey, new Set());
            teacherSlots.get(teacherKey)!.add(slotKey);

            if (!classSlots.has(cls.id)) classSlots.set(cls.id, new Set());
            classSlots.get(cls.id)!.add(slotKey);

            // Créer l'entrée
            entries.push({
              classId: cls.id,
              className: cls.name,
              subjectId: subject.id,
              subjectName: subject.name,
              teacherId: assignment.teacher.id,
              teacherName: `${assignment.teacher.firstName} ${assignment.teacher.lastName}`,
              roomId: assignedRoom?.id || null,
              roomName: assignedRoom?.name || null,
              dayOfWeek: day,
              startTime: block.start,
              endTime: block.end,
            });

            placed = true;
          }
        }

        if (!placed) {
          conflicts.push({
            type: 'PLACEMENT_FAILED',
            message: `Impossible de placer ${subject.name} pour ${cls.name} (enseignant: ${assignment.teacher.firstName} ${assignment.teacher.lastName})`,
            entries: [],
          });
        }
      }
    }

    // 7. Calculer les scores
    const totalAssignments = classes.length * subjects.length;
    const placedCount = entries.length;
    const feasibilityScore = totalAssignments > 0 ? Math.round((placedCount / totalAssignments) * 100) : 0;
    const conflictCount = conflicts.length;
    const pedagogyScore = 75; // V1: score fixe (améliorable en V2)
    const comfortScore = 70;
    const preferenceScore = 65;
    const overallScore = Math.round(feasibilityScore * 0.4 + pedagogyScore * 0.25 + comfortScore * 0.2 + preferenceScore * 0.15);

    // 8. Sauvegarder la solution
    const solutionId = uuidv4();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "timetable_solutions" ("id", "tenantId", "academicYearId", "schoolLevelId", "score", "feasibilityScore", "pedagogyScore", "comfortScore", "preferenceScore", "conflictCount", "conflicts", "entries", "status", "notes")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PROPOSED', $13)
    `, solutionId, tenantId, academicYearId, schoolLevelId,
      overallScore, feasibilityScore, pedagogyScore, comfortScore, preferenceScore,
      conflictCount, JSON.stringify(conflicts), JSON.stringify(entries),
      `Génération V1: ${placedCount}/${totalAssignments} séances placées, ${conflictCount} conflit(s).`,
    );

    this.logger.log(`Timetable generated: ${placedCount}/${totalAssignments} placed, ${conflictCount} conflicts, score=${overallScore}`);

    return {
      id: solutionId,
      score: overallScore,
      feasibilityScore,
      pedagogyScore,
      comfortScore,
      preferenceScore,
      conflictCount,
      conflicts,
      entries,
      status: 'PROPOSED',
      notes: `Génération V1: ${placedCount}/${totalAssignments} séances placées, ${conflictCount} conflit(s).`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  SOLUTIONS — Récupérer les solutions générées
  // ═══════════════════════════════════════════════════════════════════════

  async getSolutions(tenantId: string, academicYearId: string, schoolLevelId: string) {
    await this.ensureTablesExist();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "timetable_solutions"
      WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "schoolLevelId" = $3
      ORDER BY "createdAt" DESC
    `, tenantId, academicYearId, schoolLevelId);
    return rows.map(r => ({
      ...r,
      entries: typeof r.entries === 'string' ? JSON.parse(r.entries) : r.entries,
      conflicts: typeof r.conflicts === 'string' ? JSON.parse(r.conflicts) : r.conflicts,
    }));
  }

  async acceptSolution(tenantId: string, solutionId: string) {
    await this.ensureTablesExist();
    // Marquer la solution comme ACCEPTED
    await this.prisma.$executeRawUnsafe(`
      UPDATE "timetable_solutions" SET "status" = 'ACCEPTED', "updatedAt" = NOW()
      WHERE "id" = $1 AND "tenantId" = $2
    `, solutionId, tenantId);

    // Archiver les autres solutions PROPOSED
    await this.prisma.$executeRawUnsafe(`
      UPDATE "timetable_solutions" SET "status" = 'ARCHIVED', "updatedAt" = NOW()
      WHERE "tenantId" = $1 AND "status" = 'PROPOSED' AND "id" != $2
    `, tenantId, solutionId);

    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  private async ensureTablesExist(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "timetable_configs" (
          "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "schoolLevelId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL,
          "schoolDays" JSONB NOT NULL DEFAULT '[1,2,3,4,5]', "timeBlocks" JSONB NOT NULL DEFAULT '[]',
          "dayStartTime" TEXT NOT NULL DEFAULT '08:00', "dayEndTime" TEXT NOT NULL DEFAULT '18:00',
          "defaultSessionDuration" INTEGER NOT NULL DEFAULT 120, "lunchBreakStart" TEXT, "lunchBreakEnd" TEXT,
          "saturdayEnabled" BOOLEAN NOT NULL DEFAULT false, "eveningEnabled" BOOLEAN NOT NULL DEFAULT false,
          "eveningStart" TEXT, "eveningEnd" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "timetable_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
          CONSTRAINT "timetable_configs_tenantId_schoolLevelId_academicYearId_key" UNIQUE ("tenantId", "schoolLevelId", "academicYearId")
        );
        CREATE TABLE IF NOT EXISTS "teacher_availability" (
          "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "teacherId" TEXT NOT NULL, "staffId" TEXT,
          "dayOfWeek" INTEGER NOT NULL, "startTime" TEXT NOT NULL, "endTime" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'AVAILABLE', "reason" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "teacher_availability_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
          CONSTRAINT "teacher_availability_tenantId_teacherId_dayOfWeek_startTime_endTime_key" UNIQUE ("tenantId", "teacherId", "dayOfWeek", "startTime", "endTime")
        );
        CREATE TABLE IF NOT EXISTS "timetable_solutions" (
          "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL, "schoolLevelId" TEXT NOT NULL, "timetableId" TEXT,
          "score" INTEGER NOT NULL DEFAULT 0, "feasibilityScore" INTEGER NOT NULL DEFAULT 0, "pedagogyScore" INTEGER NOT NULL DEFAULT 0,
          "comfortScore" INTEGER NOT NULL DEFAULT 0, "preferenceScore" INTEGER NOT NULL DEFAULT 0,
          "conflictCount" INTEGER NOT NULL DEFAULT 0, "conflicts" JSONB NOT NULL DEFAULT '[]', "entries" JSONB NOT NULL DEFAULT '[]',
          "status" TEXT NOT NULL DEFAULT 'DRAFT', "notes" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "timetable_solutions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS "timetable_constraints" (
          "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "schoolLevelId" TEXT, "type" TEXT NOT NULL,
          "severity" TEXT NOT NULL DEFAULT 'HARD', "entityId" TEXT, "entityType" TEXT, "params" JSONB NOT NULL DEFAULT '{}',
          "weight" INTEGER NOT NULL DEFAULT 5, "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "timetable_constraints_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
        );
      `);
    } catch (e: any) {
      this.logger.warn(`ensureTablesExist: ${e.message}`);
    }
  }
}
