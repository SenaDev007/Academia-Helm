import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * ============================================================================
 * TimetableEngineService — Smart Timetable Engine V2+
 * ============================================================================
 *
 * V1   : Génération greedy basique
 * V2   : CSP avec slot ranking par préférence + scorers dynamiques
 * V2+  : Contraintes soft/hard + backtracking + multi-solutions Pareto
 *
 * Pipeline V2+ :
 *   1. Charger config (jours, créneaux)
 *   2. Charger ressources (classes, matières, enseignants, salles, affectations)
 *   3. Charger disponibilités enseignants
 *   4. Charger contraintes (timetable_constraints)
 *   5. Pour chaque stratégie de génération :
 *      a. Trier les affectations selon la stratégie
 *      b. Backtracking : essayer slots candidats, reculer si échec
 *      c. Vérifier contraintes HARD (must satisfy) et SOFT (pénaliser si violée)
 *      d. Calculer scores (faisabilité, préférence, pédagogie, confort)
 *   6. Calculer front de Pareto (solutions non dominées)
 *   7. Sauvegarder toutes les solutions, marquer le front de Pareto
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
  /// V2+ Multigrade : true si cette séance fait partie d'un groupe multigrade
  /// (enseignant qui alterne entre 2 classes du même niveau)
  isMultigrade?: boolean;
  /// V2+ Multigrade : nom de la classe jumelée (ex: "CE2" si CE1+CE2)
  multigradePairedClass?: string;
}

export interface TimetableConflict {
  type: string;
  message: string;
  entries: TimetableEntry[];
}

export interface ViolatedConstraint {
  constraintId: string;
  type: string;
  severity: string;
  message: string;
  penalty: number;
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
  strategy?: string;
  isParetoOptimal?: boolean;
  violatedSoftConstraints?: ViolatedConstraint[];
}

// ─── Contraintes V2+ ─────────────────────────────────────────────────────

export type ConstraintType =
  | 'SUBJECT_TIME_WINDOW'
  | 'TEACHER_MAX_DAILY'
  | 'SUBJECT_DISTRIBUTION'
  | 'SUBJECT_NOT_CONSECUTIVE'
  | 'CLASS_FREE_SLOT'
  | 'TEACHER_PREFERRED_DAY';

export type ConstraintSeverity = 'HARD' | 'SOFT';

export interface TimetableConstraint {
  id: string;
  tenantId: string;
  schoolLevelId: string | null;
  type: ConstraintType;
  severity: ConstraintSeverity;
  entityType: 'subject' | 'teacher' | 'class';
  entityId: string;
  params: Record<string, any>;
  weight: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const CONSTRAINT_TYPE_LABELS: Record<ConstraintType, { label: string; description: string; entityType: 'subject' | 'teacher' | 'class' }> = {
  SUBJECT_TIME_WINDOW: {
    label: 'Fenêtre horaire matière',
    description: 'Une matière doit être enseignée dans une plage horaire précise (ex: Maths le matin)',
    entityType: 'subject',
  },
  TEACHER_MAX_DAILY: {
    label: 'Maximum journalier enseignant',
    description: 'Un enseignant ne peut pas avoir plus de N séances par jour',
    entityType: 'teacher',
  },
  SUBJECT_DISTRIBUTION: {
    label: 'Distribution matière',
    description: 'Limite le nombre de séances d\'une matière par jour et par classe (répartir sur la semaine)',
    entityType: 'subject',
  },
  SUBJECT_NOT_CONSECUTIVE: {
    label: 'Matières non consécutives',
    description: 'Deux matières ne doivent pas se suivre immédiatement (ex: EPS puis Maths)',
    entityType: 'subject',
  },
  CLASS_FREE_SLOT: {
    label: 'Créneau libre classe',
    description: 'Une classe doit être libre sur un créneau précis (ex: mercredi après-midi pour sport)',
    entityType: 'class',
  },
  TEACHER_PREFERRED_DAY: {
    label: 'Jour préféré enseignant',
    description: 'Un enseignant préfère un jour spécifique (soft : bonus si placé ce jour-là)',
    entityType: 'teacher',
  },
};

// ─── Types internes ──────────────────────────────────────────────────────

interface PlacementState {
  entries: TimetableEntry[];
  teacherSlots: Map<string, Set<string>>;
  classSlots: Map<string, Set<string>>;
  roomSlots: Map<string, Set<string>>;
  teacherDailyLoad: Map<string, Map<number, number>>;
  classSubjectDailyCount: Map<string, Map<string, Map<number, number>>>;
  preferredUsedCount: number;
  morningSlotsUsed: number;
  afternoonSlotsUsed: number;
  teacherPreferredDayHits: number;
  teacherPreferredDayTotal: number;
}

interface AssignmentWithContext {
  assignment: any;
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
}

type GenerationStrategy = 'feasibility' | 'preference' | 'pedagogy' | 'comfort' | 'random';

const STRATEGY_LABELS: Record<GenerationStrategy, string> = {
  feasibility: 'Faisabilité maximale',
  preference: 'Préférence enseignants',
  pedagogy: 'Équilibre pédagogique',
  comfort: 'Confort matin/AP',
  random: 'Diversité aléatoire',
};

interface GenerationContext {
  tenantId: string;
  academicYearId: string;
  schoolLevelId: string;
  schoolDays: number[];
  timeBlocks: any[];
  classes: any[];
  subjects: any[];
  rooms: any[];
  assignments: AssignmentWithContext[];
  teacherAvailability: Map<string, string>;
  totalAssignments: number;
  /// V2+ Multigrade : map classId → { pairedClassId, pairedClassName, teacherId }
  /// Si une classe CE1 est jumelée avec CE2, multigradeMap.get("CE1") = { pairedClassId: "CE2", ... }
  multigradeMap: Map<string, { pairedClassId: string; pairedClassName: string; teacherId: string }>;
}

@Injectable()
export class TimetableEngineService {
  private readonly logger = new Logger(TimetableEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═══ CONFIG ═══

  async getConfig(tenantId: string, schoolLevelId: string, academicYearId: string) {
    await this.ensureTablesExist();
    let config = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "timetable_configs"
      WHERE "tenantId" = $1 AND "schoolLevelId" = $2 AND "academicYearId" = $3
    `, tenantId, schoolLevelId, academicYearId);

    if (!config[0]) {
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

  // ═══ AVAILABILITY ═══

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

  async deleteAvailability(tenantId: string, availabilityId: string) {
    await this.ensureTablesExist();
    await this.prisma.$executeRawUnsafe(`DELETE FROM "teacher_availability" WHERE "id" = $1 AND "tenantId" = $2`, availabilityId, tenantId);
    return { success: true };
  }

  async getTeachers(tenantId: string, schoolLevelId?: string) {
    const where: any = { tenantId, status: { in: ['ACTIVE', 'active'] } };
    if (schoolLevelId) where.schoolLevelId = schoolLevelId;
    return this.prisma.teacher.findMany({
      where,
      select: {
        id: true, firstName: true, lastName: true, email: true, phone: true,
        schoolLevelId: true, matricule: true, departmentId: true, specialization: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async getTeachersWithAvailability(tenantId: string, schoolLevelId?: string) {
    await this.ensureTablesExist();
    const [teachers, availRows] = await Promise.all([
      this.getTeachers(tenantId, schoolLevelId),
      this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "teacher_availability" WHERE "tenantId" = $1`, tenantId),
    ]);
    return teachers.map((t: any) => ({
      ...t,
      availabilities: availRows.filter((r: any) => r.teacherId === t.id),
    }));
  }

  // ═══ CONSTRAINTS V2+ ═══

  async getConstraints(tenantId: string, schoolLevelId?: string, filters?: { type?: string; severity?: string; isActive?: boolean }) {
    await this.ensureTablesExist();
    let query = `SELECT * FROM "timetable_constraints" WHERE "tenantId" = $1`;
    const params: any[] = [tenantId];
    let idx = 2;
    if (schoolLevelId) {
      query += ` AND ("schoolLevelId" = $${idx++} OR "schoolLevelId" IS NULL)`;
      params.push(schoolLevelId);
    }
    if (filters?.type) { query += ` AND "type" = $${idx++}`; params.push(filters.type); }
    if (filters?.severity) { query += ` AND "severity" = $${idx++}`; params.push(filters.severity); }
    if (filters?.isActive !== undefined) { query += ` AND "isActive" = $${idx++}`; params.push(filters.isActive); }
    query += ` ORDER BY "createdAt" DESC`;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(query, ...params);
    return rows.map(r => ({ ...r, params: typeof r.params === 'string' ? JSON.parse(r.params) : (r.params || {}) }));
  }

  async createConstraint(tenantId: string, data: any) {
    await this.ensureTablesExist();
    if (!data.type || !CONSTRAINT_TYPE_LABELS[data.type as ConstraintType]) {
      throw new BadRequestException(`Type de contrainte invalide: ${data.type}`);
    }
    if (!data.severity || !['HARD', 'SOFT'].includes(data.severity)) {
      throw new BadRequestException('Sévérité doit être HARD ou SOFT');
    }
    if (!data.entityId) throw new BadRequestException('entityId requis');
    const weight = data.weight !== undefined ? Math.max(1, Math.min(10, data.weight)) : 5;
    const id = uuidv4();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "timetable_constraints" ("id", "tenantId", "schoolLevelId", "type", "severity", "entityType", "entityId", "params", "weight", "isActive")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, id, tenantId, data.schoolLevelId || null, data.type, data.severity, data.entityType, data.entityId,
      JSON.stringify(data.params || {}), weight, data.isActive !== false);
    return this.getConstraintById(tenantId, id);
  }

  async updateConstraint(tenantId: string, id: string, data: any) {
    await this.ensureTablesExist();
    const existing = await this.getConstraintById(tenantId, id);
    if (!existing) throw new NotFoundException('Contrainte non trouvée');
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (data.severity !== undefined) { sets.push(`"severity" = $${idx++}`); params.push(data.severity); }
    if (data.params !== undefined) { sets.push(`"params" = $${idx++}`); params.push(JSON.stringify(data.params)); }
    if (data.weight !== undefined) { sets.push(`"weight" = $${idx++}`); params.push(Math.max(1, Math.min(10, data.weight))); }
    if (data.isActive !== undefined) { sets.push(`"isActive" = $${idx++}`); params.push(data.isActive); }
    if (sets.length === 0) return existing;
    sets.push(`"updatedAt" = NOW()`);
    params.push(id, tenantId);
    await this.prisma.$executeRawUnsafe(`UPDATE "timetable_constraints" SET ${sets.join(', ')} WHERE "id" = $${idx++} AND "tenantId" = $${idx++}`, ...params);
    return this.getConstraintById(tenantId, id);
  }

  async deleteConstraint(tenantId: string, id: string) {
    await this.ensureTablesExist();
    await this.prisma.$executeRawUnsafe(`DELETE FROM "timetable_constraints" WHERE "id" = $1 AND "tenantId" = $2`, id, tenantId);
    return { success: true };
  }

  async getConstraintById(tenantId: string, id: string): Promise<TimetableConstraint | null> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "timetable_constraints" WHERE "id" = $1 AND "tenantId" = $2`, id, tenantId);
    if (!rows[0]) return null;
    return { ...rows[0], params: typeof rows[0].params === 'string' ? JSON.parse(rows[0].params) : (rows[0].params || {}) };
  }

  // ═══ GENERATE ═══

  async generate(tenantId: string, academicYearId: string, schoolLevelId: string): Promise<GeneratedSolution> {
    const ctx = await this.prepareGenerationContext(tenantId, academicYearId, schoolLevelId);
    const constraints = await this.getConstraints(tenantId, schoolLevelId, { isActive: true });
    const result = this.runBacktracking(ctx, constraints, 'preference');
    const evaluated = this.evaluateSolution(result, ctx, constraints, 'preference');
    return this.saveSolution(tenantId, academicYearId, schoolLevelId, evaluated);
  }

  async generateMulti(
    tenantId: string, academicYearId: string, schoolLevelId: string,
    options?: { strategies?: GenerationStrategy[]; backtrackingDepth?: number },
  ): Promise<{ solutions: GeneratedSolution[]; paretoFront: GeneratedSolution[]; allSolutions: GeneratedSolution[] }> {
    const ctx = await this.prepareGenerationContext(tenantId, academicYearId, schoolLevelId);
    const constraints = await this.getConstraints(tenantId, schoolLevelId, { isActive: true });
    const strategies = options?.strategies ?? ['feasibility', 'preference', 'pedagogy', 'comfort', 'random'];

    this.logger.log(`V2+ generateMulti: ${strategies.length} stratégies, ${ctx.assignments.length} affectations, ${constraints.length} contraintes`);

    const allSolutions: GeneratedSolution[] = [];
    for (const strategy of strategies) {
      const result = this.runBacktracking(ctx, constraints, strategy, options?.backtrackingDepth);
      const evaluated = this.evaluateSolution(result, ctx, constraints, strategy);
      allSolutions.push(evaluated);
    }

    const paretoFront = this.computeParetoFront(allSolutions);
    const paretoIds = new Set(paretoFront.map(s => s.id));
    for (const sol of allSolutions) sol.isParetoOptimal = paretoIds.has(sol.id);

    const savedSolutions: GeneratedSolution[] = [];
    for (const sol of allSolutions) {
      const saved = await this.saveSolution(tenantId, academicYearId, schoolLevelId, sol);
      savedSolutions.push({ ...saved, isParetoOptimal: sol.isParetoOptimal, strategy: sol.strategy });
    }

    this.logger.log(`V2+ generateMulti: ${savedSolutions.length} solutions, ${paretoFront.length} Pareto-optimales`);
    return { solutions: savedSolutions, paretoFront: savedSolutions.filter(s => s.isParetoOptimal), allSolutions: savedSolutions };
  }

  // ═══ CONTEXT PREPARATION ═══

  private async prepareGenerationContext(tenantId: string, academicYearId: string, schoolLevelId: string): Promise<GenerationContext> {
    const config = await this.getConfig(tenantId, schoolLevelId, academicYearId);
    if (!config) throw new BadRequestException('Configuration d\'emploi du temps manquante.');
    const schoolDays: number[] = Array.isArray(config.schoolDays) ? config.schoolDays : JSON.parse(config.schoolDays || '[1,2,3,4,5]');
    const timeBlocks: any[] = Array.isArray(config.timeBlocks) ? config.timeBlocks : JSON.parse(config.timeBlocks || '[]');
    if (timeBlocks.length === 0) throw new BadRequestException('Aucun créneau horaire configuré.');

    const classes = await this.prisma.class.findMany({
      where: { tenantId, academicYearId, schoolLevelId },
      select: { id: true, name: true, capacity: true },
    });
    if (classes.length === 0) throw new BadRequestException('Aucune classe trouvée.');

    const subjects = await this.prisma.subject.findMany({
      where: { tenantId, academicYearId, schoolLevelId },
      select: { id: true, name: true, code: true },
    });
    if (subjects.length === 0) throw new BadRequestException('Aucune matière trouvée.');

    const assignments = await this.prisma.subjectAssignment.findMany({
      where: { tenantId, academicYearId, schoolLevelId },
      include: {
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const rooms = await this.prisma.room.findMany({
      where: { tenantId, schoolLevelId },
      select: { id: true, name: true, roomCode: true, capacity: true, roomType: true },
    });

    const availabilityRows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "teacher_availability" WHERE "tenantId" = $1`, tenantId);
    const teacherAvailability = new Map<string, string>();
    for (const av of availabilityRows) {
      teacherAvailability.set(`${av.teacherId}:${av.dayOfWeek}:${av.startTime}-${av.endTime}`, av.status);
    }

    const assignmentsWithContext: AssignmentWithContext[] = [];
    for (const a of assignments) {
      if (!a.teacher) continue;
      assignmentsWithContext.push({
        assignment: a,
        classId: a.classId || '',
        className: classes.find(c => c.id === a.classId)?.name || a.classId || '',
        teacherId: a.teacher.id,
        teacherName: `${a.teacher.firstName} ${a.teacher.lastName}`,
        subjectId: a.subject.id,
        subjectName: a.subject.name,
      });
    }

    // ─── V2+ Multigrade : charger les groupes multigrade actifs ──
    // Construire une map bidirectionnelle : classId → { pairedClassId, pairedClassName, teacherId }
    // Si CE1+CE2 sont jumelées par le teacher T, alors :
    //   multigradeMap.get("CE1") = { pairedClassId: "CE2", pairedClassName: "CE2", teacherId: "T" }
    //   multigradeMap.get("CE2") = { pairedClassId: "CE1", pairedClassName: "CE1", teacherId: "T" }
    const multigradeMap = new Map<string, { pairedClassId: string; pairedClassName: string; teacherId: string }>();
    try {
      const multigradeAssignments = await this.prisma.multigradeAssignment.findMany({
        where: { tenantId, academicYearId, isActive: true },
        include: {
          teacher: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      for (const mg of multigradeAssignments) {
        const classIds = Array.isArray(mg.classIds) ? mg.classIds : [];
        if (classIds.length !== 2) continue;

        const class1 = classes.find(c => c.id === classIds[0]);
        const class2 = classes.find(c => c.id === classIds[1]);
        if (!class1 || !class2) continue;

        // Map bidirectionnelle
        multigradeMap.set(classIds[0], {
          pairedClassId: classIds[1],
          pairedClassName: class2.name,
          teacherId: mg.teacherId,
        });
        multigradeMap.set(classIds[1], {
          pairedClassId: classIds[0],
          pairedClassName: class1.name,
          teacherId: mg.teacherId,
        });
      }

      if (multigradeMap.size > 0) {
        this.logger.log(`Multigrade: ${multigradeAssignments.length} groupe(s) actif(s), ${multigradeMap.size} classes jumelées`);

        // ─── Expansion multigrade : garantir la parité des matières ──
        // Pour chaque groupe multigrade (CE1+CE2 avec teacher T) :
        // - Si T a une SubjectAssignment pour CE1-Maths mais pas pour CE2-Maths,
        //   créer une assignment virtuelle CE2-Maths avec le même teacher T.
        // - Le STE placera naturellement CE2-Maths à un créneau différent
        //   (le teacher ne peut pas être dans 2 classes au même moment).
        for (const mg of multigradeAssignments) {
          const classIds = Array.isArray(mg.classIds) ? mg.classIds : [];
          if (classIds.length !== 2) continue;

          const [c1Id, c2Id] = classIds;
          const c1Name = classes.find(c => c.id === c1Id)?.name || c1Id;
          const c2Name = classes.find(c => c.id === c2Id)?.name || c2Id;

          // Assignments du teacher pour chaque classe
          const c1Assignments = assignmentsWithContext.filter(a =>
            a.classId === c1Id && a.teacherId === mg.teacherId);
          const c2Assignments = assignmentsWithContext.filter(a =>
            a.classId === c2Id && a.teacherId === mg.teacherId);

          // Sujets que c1 a mais pas c2
          const c1SubjectIds = new Set(c1Assignments.map(a => a.subjectId));
          const c2SubjectIds = new Set(c2Assignments.map(a => a.subjectId));

          let added = 0;
          for (const a of c1Assignments) {
            if (!c2SubjectIds.has(a.subjectId)) {
              // Créer une assignment virtuelle pour c2 avec le même subject
              assignmentsWithContext.push({
                ...a,
                classId: c2Id,
                className: c2Name,
              });
              added++;
            }
          }
          for (const a of c2Assignments) {
            if (!c1SubjectIds.has(a.subjectId)) {
              assignmentsWithContext.push({
                ...a,
                classId: c1Id,
                className: c1Name,
              });
              added++;
            }
          }

          if (added > 0) {
            this.logger.log(`Multigrade expansion: ${added} assignment(s) virtuelle(s) créée(s) pour ${c1Name}+${c2Name} (teacher ${mg.teacherId})`);
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to load multigrade assignments: ${err.message}`);
    }

    return {
      tenantId, academicYearId, schoolLevelId,
      schoolDays, timeBlocks, classes, subjects, rooms,
      assignments: assignmentsWithContext,
      teacherAvailability,
      totalAssignments: classes.length * subjects.length,
      multigradeMap,
    };
  }

  // ═══ BACKTRACKING ═══

  private runBacktracking(
    ctx: GenerationContext,
    constraints: TimetableConstraint[],
    strategy: GenerationStrategy,
    maxDepth: number = 500,
  ): { entries: TimetableEntry[]; conflicts: TimetableConflict[]; violatedSoft: ViolatedConstraint[]; state: PlacementState } {
    const sortedAssignments = this.sortAssignmentsByStrategy(ctx.assignments, strategy);
    const state: PlacementState = {
      entries: [], teacherSlots: new Map(), classSlots: new Map(), roomSlots: new Map(),
      teacherDailyLoad: new Map(), classSubjectDailyCount: new Map(),
      preferredUsedCount: 0, morningSlotsUsed: 0, afternoonSlotsUsed: 0,
      teacherPreferredDayHits: 0, teacherPreferredDayTotal: 0,
    };
    const conflicts: TimetableConflict[] = [];
    const violatedSoft: ViolatedConstraint[] = [];
    let backtracks = 0;

    const tryPlace = (idx: number): boolean => {
      if (idx >= sortedAssignments.length) return true;
      if (backtracks >= maxDepth) return false;
      const ctx2 = sortedAssignments[idx];
      const candidateSlots = this.getCandidateSlots(ctx, ctx2, state, constraints, strategy);

      for (const { day, block } of candidateSlots) {
        const hardViolation = this.checkHardConstraints(ctx, ctx2, day, block, state, constraints);
        if (hardViolation) continue;
        this.applyPlacement(ctx, ctx2, day, block, state, constraints);
        if (tryPlace(idx + 1)) return true;
        backtracks++;
        this.undoPlacement(ctx2, day, block, state);
        if (backtracks >= maxDepth) return false;
      }
      conflicts.push({
        type: 'PLACEMENT_FAILED',
        message: `Impossible de placer ${ctx2.subjectName} pour ${ctx2.className} (enseignant: ${ctx2.teacherName})`,
        entries: [],
      });
      return false;
    };

    tryPlace(0);

    for (const constraint of constraints) {
      if (constraint.severity !== 'SOFT') continue;
      const violations = this.checkSoftConstraint(ctx, state, constraint);
      for (const v of violations) violatedSoft.push(v);
    }

    return { entries: state.entries, conflicts, violatedSoft, state };
  }

  private sortAssignmentsByStrategy(assignments: AssignmentWithContext[], strategy: GenerationStrategy): AssignmentWithContext[] {
    const arr = [...assignments];
    switch (strategy) {
      case 'pedagogy':
        arr.sort((a, b) => a.classId.localeCompare(b.classId) || a.subjectId.localeCompare(b.subjectId));
        return arr;
      case 'random':
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      default:
        return arr;
    }
  }

  private getCandidateSlots(
    ctx: GenerationContext, ctx2: AssignmentWithContext, state: PlacementState,
    _constraints: TimetableConstraint[], strategy: GenerationStrategy,
  ): { day: number; block: any; rank: number }[] {
    const candidates: { day: number; block: any; rank: number }[] = [];
    for (const day of ctx.schoolDays) {
      for (const block of ctx.timeBlocks) {
        if (block.type !== 'BLOCK') continue;
        const slotKey = `${day}:${block.start}-${block.end}`;
        const availKey = `${ctx2.teacherId}:${day}:${block.start}-${block.end}`;
        const status = ctx.teacherAvailability.get(availKey);
        if (status === 'UNAVAILABLE' || status === 'FORBIDDEN') continue;
        if (state.teacherSlots.has(ctx2.teacherId) && state.teacherSlots.get(ctx2.teacherId)!.has(slotKey)) continue;
        if (state.classSlots.has(ctx2.classId) && state.classSlots.get(ctx2.classId)!.has(slotKey)) continue;

        let rank = 0;
        const hourStart = parseInt(block.start.split(':')[0], 10);
        const isMorning = hourStart < 12;
        const isPreferred = status === 'PREFERRED';

        switch (strategy) {
          case 'preference': rank = isPreferred ? 0 : 1; break;
          case 'comfort': {
            const wantMorning = state.morningSlotsUsed <= state.afternoonSlotsUsed;
            rank = (isMorning === wantMorning ? 0 : 1) + (isPreferred ? 0 : 2);
            break;
          }
          case 'pedagogy': {
            const dayLoad = state.teacherDailyLoad.get(ctx2.teacherId)?.get(day) ?? 0;
            rank = dayLoad + (isPreferred ? 0 : 10);
            break;
          }
          case 'feasibility': rank = isPreferred ? 0 : 1; break;
          case 'random': rank = Math.floor(Math.random() * 20); break;
        }
        candidates.push({ day, block, rank });
      }
    }
    candidates.sort((a, b) => a.rank - b.rank);
    return candidates;
  }

  private checkHardConstraints(
    ctx: GenerationContext, ctx2: AssignmentWithContext, day: number, block: any,
    state: PlacementState, constraints: TimetableConstraint[],
  ): string | null {
    const slotKey = `${day}:${block.start}-${block.end}`;
    for (const c of constraints) {
      if (c.severity !== 'HARD') continue;
      if (c.entityType === 'subject' && c.entityId !== ctx2.subjectId) continue;
      if (c.entityType === 'teacher' && c.entityId !== ctx2.teacherId) continue;
      if (c.entityType === 'class' && c.entityId !== ctx2.classId) continue;

      switch (c.type) {
        case 'SUBJECT_TIME_WINDOW': {
          const start = c.params.startTime as string;
          const end = c.params.endTime as string;
          if (block.start < start || block.end > end) return `HARD: ${ctx2.subjectName} doit être entre ${start} et ${end}`;
          break;
        }
        case 'TEACHER_MAX_DAILY': {
          const max = c.params.maxPerDay as number;
          const current = state.teacherDailyLoad.get(ctx2.teacherId)?.get(day) ?? 0;
          if (current >= max) return `HARD: ${ctx2.teacherName} a déjà ${current}/${max} séances le jour ${day}`;
          break;
        }
        case 'SUBJECT_DISTRIBUTION': {
          const max = c.params.maxPerDayPerClass as number;
          const current = state.classSubjectDailyCount.get(ctx2.classId)?.get(ctx2.subjectId)?.get(day) ?? 0;
          if (current >= max) return `HARD: ${ctx2.subjectName} déjà ${current}/${max} pour ${ctx2.className} le jour ${day}`;
          break;
        }
        case 'SUBJECT_NOT_CONSECUTIVE': {
          const otherSubjectId = c.params.otherSubjectId as string;
          const sameDaySameClass = state.entries.filter(e => e.classId === ctx2.classId && e.dayOfWeek === day);
          for (const e of sameDaySameClass) {
            if (e.subjectId !== otherSubjectId) continue;
            if (e.endTime === block.start || block.end === e.startTime) return `HARD: ${ctx2.subjectName} ne peut pas être consécutif avec ${e.subjectName}`;
          }
          break;
        }
        case 'CLASS_FREE_SLOT': {
          const cDay = c.params.dayOfWeek as number;
          const cStart = c.params.startTime as string;
          const cEnd = c.params.endTime as string;
          if (day === cDay && block.start < cEnd && block.end > cStart) {
            return `HARD: ${ctx2.className} doit être libre le jour ${day} entre ${cStart} et ${cEnd}`;
          }
          break;
        }
      }
    }
    return null;
  }

  private applyPlacement(
    ctx: GenerationContext, ctx2: AssignmentWithContext, day: number, block: any,
    state: PlacementState, constraints: TimetableConstraint[],
  ): void {
    const slotKey = `${day}:${block.start}-${block.end}`;
    const availKey = `${ctx2.teacherId}:${day}:${block.start}-${block.end}`;
    const status = ctx.teacherAvailability.get(availKey);

    let assignedRoom: any = null;
    for (const room of ctx.rooms) {
      if (!state.roomSlots.has(room.id) || !state.roomSlots.get(room.id)!.has(slotKey)) {
        assignedRoom = room;
        if (!state.roomSlots.has(room.id)) state.roomSlots.set(room.id, new Set());
        state.roomSlots.get(room.id)!.add(slotKey);
        break;
      }
    }

    if (!state.teacherSlots.has(ctx2.teacherId)) state.teacherSlots.set(ctx2.teacherId, new Set());
    state.teacherSlots.get(ctx2.teacherId)!.add(slotKey);
    if (!state.classSlots.has(ctx2.classId)) state.classSlots.set(ctx2.classId, new Set());
    state.classSlots.get(ctx2.classId)!.add(slotKey);

    if (status === 'PREFERRED') state.preferredUsedCount++;
    const hourStart = parseInt(block.start.split(':')[0], 10);
    if (hourStart < 12) state.morningSlotsUsed++; else state.afternoonSlotsUsed++;

    if (!state.teacherDailyLoad.has(ctx2.teacherId)) state.teacherDailyLoad.set(ctx2.teacherId, new Map());
    const dayMap = state.teacherDailyLoad.get(ctx2.teacherId)!;
    dayMap.set(day, (dayMap.get(day) || 0) + 1);

    if (!state.classSubjectDailyCount.has(ctx2.classId)) state.classSubjectDailyCount.set(ctx2.classId, new Map());
    const subjMap = state.classSubjectDailyCount.get(ctx2.classId)!;
    if (!subjMap.has(ctx2.subjectId)) subjMap.set(ctx2.subjectId, new Map());
    const daySubjMap = subjMap.get(ctx2.subjectId)!;
    daySubjMap.set(day, (daySubjMap.get(day) || 0) + 1);

    const prefDayConstraint = constraints.find(c =>
      c.type === 'TEACHER_PREFERRED_DAY' && c.entityType === 'teacher' && c.entityId === ctx2.teacherId);
    if (prefDayConstraint && prefDayConstraint.params.dayOfWeek === day) state.teacherPreferredDayHits++;
    if (prefDayConstraint) state.teacherPreferredDayTotal++;

    // V2+ Multigrade : marquer l'entrée si la classe fait partie d'un groupe multigrade
    const mgInfo = ctx.multigradeMap.get(ctx2.classId);

    state.entries.push({
      classId: ctx2.classId, className: ctx2.className,
      subjectId: ctx2.subjectId, subjectName: ctx2.subjectName,
      teacherId: ctx2.teacherId, teacherName: ctx2.teacherName,
      roomId: assignedRoom?.id || null, roomName: assignedRoom?.name || null,
      dayOfWeek: day, startTime: block.start, endTime: block.end,
      isMultigrade: !!mgInfo,
      multigradePairedClass: mgInfo?.pairedClassName,
    });
  }

  private undoPlacement(ctx2: AssignmentWithContext, day: number, block: any, state: PlacementState): void {
    const slotKey = `${day}:${block.start}-${block.end}`;
    const hourStart = parseInt(block.start.split(':')[0], 10);
    state.entries.pop();
    state.teacherSlots.get(ctx2.teacherId)?.delete(slotKey);
    state.classSlots.get(ctx2.classId)?.delete(slotKey);
    if (hourStart < 12) state.morningSlotsUsed = Math.max(0, state.morningSlotsUsed - 1);
    else state.afternoonSlotsUsed = Math.max(0, state.afternoonSlotsUsed - 1);
    const dayMap = state.teacherDailyLoad.get(ctx2.teacherId);
    if (dayMap) { const c = dayMap.get(day) ?? 0; if (c > 0) dayMap.set(day, c - 1); }
    const subjMap = state.classSubjectDailyCount.get(ctx2.classId)?.get(ctx2.subjectId);
    if (subjMap) { const c = subjMap.get(day) ?? 0; if (c > 0) subjMap.set(day, c - 1); }
  }

  private checkSoftConstraint(ctx: GenerationContext, state: PlacementState, constraint: TimetableConstraint): ViolatedConstraint[] {
    const violations: ViolatedConstraint[] = [];
    const penalty = constraint.weight;

    switch (constraint.type) {
      case 'SUBJECT_TIME_WINDOW': {
        if (constraint.entityType === 'subject') {
          for (const e of state.entries) {
            if (e.subjectId !== constraint.entityId) continue;
            const start = constraint.params.startTime as string;
            const end = constraint.params.endTime as string;
            if (e.startTime < start || e.endTime > end) {
              violations.push({ constraintId: constraint.id, type: constraint.type, severity: 'SOFT',
                message: `${e.subjectName} pour ${e.className} placé à ${e.startTime}-${e.endTime} (hors fenêtre ${start}-${end})`, penalty });
            }
          }
        }
        break;
      }
      case 'TEACHER_MAX_DAILY': {
        if (constraint.entityType === 'teacher') {
          const max = constraint.params.maxPerDay as number;
          const dayMap = state.teacherDailyLoad.get(constraint.entityId);
          if (dayMap) {
            for (const [day, count] of dayMap) {
              if (count > max) violations.push({ constraintId: constraint.id, type: constraint.type, severity: 'SOFT',
                message: `${count} séances le jour ${day} (max ${max})`, penalty: penalty * (count - max) });
            }
          }
        }
        break;
      }
      case 'SUBJECT_DISTRIBUTION': {
        if (constraint.entityType === 'subject') {
          const max = constraint.params.maxPerDayPerClass as number;
          for (const [classId, subjMap] of state.classSubjectDailyCount) {
            const dayMap = subjMap.get(constraint.entityId);
            if (!dayMap) continue;
            for (const [day, count] of dayMap) {
              if (count > max) violations.push({ constraintId: constraint.id, type: constraint.type, severity: 'SOFT',
                message: `${count} séances le jour ${day} pour la classe ${classId} (max ${max})`, penalty: penalty * (count - max) });
            }
          }
        }
        break;
      }
      case 'TEACHER_PREFERRED_DAY': {
        if (constraint.entityType === 'teacher') {
          const preferredDay = constraint.params.dayOfWeek as number;
          const dayMap = state.teacherDailyLoad.get(constraint.entityId);
          if (dayMap) {
            const total = Array.from(dayMap.values()).reduce((a, b) => a + b, 0);
            const preferred = dayMap.get(preferredDay) ?? 0;
            if (total > 0) {
              const ratio = preferred / total;
              if (ratio < 0.5) violations.push({ constraintId: constraint.id, type: constraint.type, severity: 'SOFT',
                message: `Seulement ${preferred}/${total} séances sur le jour préféré ${preferredDay}`, penalty: penalty * Math.round((0.5 - ratio) * 10) });
            }
          }
        }
        break;
      }
      case 'SUBJECT_NOT_CONSECUTIVE': {
        if (constraint.entityType === 'subject') {
          const otherSubjectId = constraint.params.otherSubjectId as string;
          for (const e of state.entries) {
            if (e.subjectId !== constraint.entityId) continue;
            const consec = state.entries.find(e2 =>
              e2.classId === e.classId && e2.dayOfWeek === e.dayOfWeek && e2.subjectId === otherSubjectId &&
              (e2.endTime === e.startTime || e.endTime === e2.startTime));
            if (consec) violations.push({ constraintId: constraint.id, type: constraint.type, severity: 'SOFT',
              message: `${e.subjectName} consécutif avec ${consec.subjectName} pour ${e.className}`, penalty });
          }
        }
        break;
      }
      case 'CLASS_FREE_SLOT': {
        if (constraint.entityType === 'class') {
          const cDay = constraint.params.dayOfWeek as number;
          const cStart = constraint.params.startTime as string;
          const cEnd = constraint.params.endTime as string;
          for (const e of state.entries) {
            if (e.classId !== constraint.entityId || e.dayOfWeek !== cDay) continue;
            if (e.startTime < cEnd && e.endTime > cStart) violations.push({ constraintId: constraint.id, type: constraint.type, severity: 'SOFT',
              message: `${e.className} occupé le jour ${cDay} à ${e.startTime}-${e.endTime}`, penalty });
          }
        }
        break;
      }
    }
    return violations;
  }

  private evaluateSolution(
    result: { entries: TimetableEntry[]; conflicts: TimetableConflict[]; violatedSoft: ViolatedConstraint[]; state: PlacementState },
    ctx: GenerationContext, _constraints: TimetableConstraint[], strategy: GenerationStrategy,
  ): GeneratedSolution {
    const { state, conflicts, violatedSoft } = result;
    const placedCount = state.entries.length;
    const totalAssignments = ctx.totalAssignments;
    const feasibilityScore = totalAssignments > 0 ? Math.round((placedCount / totalAssignments) * 100) : 0;
    const conflictCount = conflicts.length;

    const prefDayBonus = state.teacherPreferredDayTotal > 0
      ? Math.round((state.teacherPreferredDayHits / state.teacherPreferredDayTotal) * 20) : 0;
    const preferenceScore = Math.min(100, Math.round((state.preferredUsedCount / Math.max(1, placedCount)) * 100) + prefDayBonus);

    let pedagogyTotal = 0, pedagogyCount = 0;
    for (const [, dayMap] of state.teacherDailyLoad) {
      for (const [, count] of dayMap) {
        const score = count <= 2 ? 100 : count === 3 ? 80 : count === 4 ? 60 : 40;
        pedagogyTotal += score; pedagogyCount++;
      }
    }
    const pedagogyScore = pedagogyCount > 0 ? Math.round(pedagogyTotal / pedagogyCount) : 75;

    const totalSlots = state.morningSlotsUsed + state.afternoonSlotsUsed;
    const balanceRatio = totalSlots > 0 ? 1 - Math.abs(state.morningSlotsUsed - state.afternoonSlotsUsed) / totalSlots : 1;
    const comfortScore = Math.round(balanceRatio * 100);

    const softPenalty = violatedSoft.reduce((sum, v) => sum + v.penalty, 0);
    const overallScore = Math.max(0, Math.round(
      feasibilityScore * 0.4 + pedagogyScore * 0.25 + comfortScore * 0.2 + preferenceScore * 0.15 - softPenalty * 0.5,
    ));

    return {
      id: uuidv4(), score: overallScore, feasibilityScore, pedagogyScore, comfortScore, preferenceScore,
      conflictCount, conflicts, entries: state.entries, status: 'PROPOSED',
      notes: `Stratégie: ${STRATEGY_LABELS[strategy]}. ${placedCount}/${totalAssignments} séances, ${conflictCount} conflit(s), ${violatedSoft.length} SOFT violée(s) (pénalité: ${softPenalty}). M/AP: ${state.morningSlotsUsed}/${state.afternoonSlotsUsed}.`,
      strategy, violatedSoftConstraints: violatedSoft,
    };
  }

  private computeParetoFront(solutions: GeneratedSolution[]): GeneratedSolution[] {
    const criteria: (keyof GeneratedSolution)[] = ['feasibilityScore', 'pedagogyScore', 'comfortScore', 'preferenceScore'];
    const isDominated = new Array(solutions.length).fill(false);
    for (let i = 0; i < solutions.length; i++) {
      for (let j = 0; j < solutions.length; j++) {
        if (i === j) continue;
        const a = solutions[j], b = solutions[i];
        const geAll = criteria.every(c => (a[c] as number) >= (b[c] as number));
        const gtSome = criteria.some(c => (a[c] as number) > (b[c] as number));
        if (geAll && gtSome) { isDominated[i] = true; break; }
      }
    }
    return solutions.filter((_, i) => !isDominated[i]);
  }

  private async saveSolution(tenantId: string, academicYearId: string, schoolLevelId: string, sol: GeneratedSolution): Promise<GeneratedSolution> {
    const solutionId = uuidv4();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "timetable_solutions" ("id", "tenantId", "academicYearId", "schoolLevelId", "score", "feasibilityScore", "pedagogyScore", "comfortScore", "preferenceScore", "conflictCount", "conflicts", "entries", "status", "notes")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PROPOSED', $13)
    `, solutionId, tenantId, academicYearId, schoolLevelId,
      sol.score, sol.feasibilityScore, sol.pedagogyScore, sol.comfortScore, sol.preferenceScore,
      sol.conflictCount, JSON.stringify(sol.conflicts), JSON.stringify(sol.entries), sol.notes);
    this.logger.log(`Solution saved: id=${solutionId}, score=${sol.score}, strategy=${sol.strategy}, pareto=${sol.isParetoOptimal}`);
    return { ...sol, id: solutionId };
  }

  // ═══ SOLUTIONS ═══

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
    await this.prisma.$executeRawUnsafe(`UPDATE "timetable_solutions" SET "status" = 'ACCEPTED', "updatedAt" = NOW() WHERE "id" = $1 AND "tenantId" = $2`, solutionId, tenantId);
    await this.prisma.$executeRawUnsafe(`UPDATE "timetable_solutions" SET "status" = 'ARCHIVED', "updatedAt" = NOW() WHERE "tenantId" = $1 AND "status" = 'PROPOSED' AND "id" != $2`, tenantId, solutionId);
    return { success: true };
  }

  // ═══ HELPERS ═══

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
          "severity" TEXT NOT NULL DEFAULT 'HARD', "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL,
          "params" JSONB NOT NULL DEFAULT '{}',
          "weight" INTEGER NOT NULL DEFAULT 5, "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "timetable_constraints_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "timetable_constraints_tenantId_schoolLevelId_idx" ON "timetable_constraints" ("tenantId", "schoolLevelId");
        CREATE INDEX IF NOT EXISTS "timetable_constraints_entity_idx" ON "timetable_constraints" ("entityType", "entityId");
      `);
    } catch (e: any) {
      this.logger.warn(`ensureTablesExist: ${e.message}`);
    }
  }
}
