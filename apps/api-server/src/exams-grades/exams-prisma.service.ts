/**
 * ============================================================================
 * EXAMS PRISMA SERVICE - MODULE 3
 * ============================================================================
 * 
 * Service pour la gestion des examens
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Optional, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AcademicRulesEngine } from './academic-rules-engine.service';
import { AcademicSettingsService } from './academic-settings.service';
import { ReportCardsPrismaService } from './report-cards-prisma.service';
import { HelmConnectNotificationBridgeService } from '../communication/services/helm-connect-bridge.service';
import * as crypto from 'crypto';

@Injectable()
export class ExamsPrismaService {
  private readonly logger = new Logger(ExamsPrismaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rulesEngine: AcademicRulesEngine,
    private readonly academicSettingsService: AcademicSettingsService,
    private readonly reportCardsService: ReportCardsPrismaService,
    @Optional() @Inject(HelmConnectNotificationBridgeService)
    private readonly bridge?: HelmConnectNotificationBridgeService,
  ) {}

  /**
   * ⭐ Récupère le seuil de réussite configurable (défaut 10).
   */
  private async getPassScore(tenantId: string, academicYearId: string): Promise<number> {
    try {
      const settings = await this.academicSettingsService.findActive(tenantId, academicYearId);
      const config = settings.config as any;
      return config?.scoreScale?.passScore ?? 10;
    } catch {
      return 10;
    }
  }

  /**
   * Crée un examen
   */
  async createExam(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    academicTrackId?: string;
    language?: string;
    quarterId?: string;
    classSubjectId?: string;
    subjectId: string;
    classId?: string;
    name: string;
    examType: string; // DEVOIR | COMPOSITION | ORAL | PRATIQUE
    examDate: Date;
    maxScore?: number;
    coefficient?: number;
    description?: string;
    triggeredByUserId?: string; // ⭐ V3-4: pour Yeshua Connect notification
  }) {
    // Vérifier que la matière existe
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: data.subjectId,
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId,
      },
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${data.subjectId} not found`);
    }

    // Vérifier que la classe existe si fournie
    if (data.classId) {
      const classExists = await this.prisma.class.findFirst({
        where: {
          id: data.classId,
          tenantId: data.tenantId,
          academicYearId: data.academicYearId,
          schoolLevelId: data.schoolLevelId,
        },
      });

      if (!classExists) {
        throw new NotFoundException(`Class with ID ${data.classId} not found`);
      }
    }

    // Déduire la langue depuis la matière si non fournie (mode bilingue)
    const examLanguage = data.language || subject.language || 'FR';

    const exam = await this.prisma.exam.create({
      data: {
        ...data,
        language: examLanguage,
        maxScore: data.maxScore || 20.0,
        coefficient: data.coefficient || 1.0,
      },
      include: {
        subject: true,
        quarter: true,
        classSubject: true,
        academicYear: true,
        schoolLevel: true,
      },
    });

    // ⭐ V3-4: Yeshua Connect notification (fire-and-forget)
    if (this.bridge && exam) {
      this.bridge
        .notifyExamScheduled({
          tenantId: data.tenantId,
          examId: exam.id,
          classId: data.classId,
          subjectId: data.subjectId,
          examName: data.name,
          examType: data.examType,
          examDate: data.examDate,
          triggeredByUserId: data.triggeredByUserId,
        })
        .then((r) =>
          this.logger.log(
            `notifyExamScheduled: inApp=${r.channels.inApp?.status} whatsapp=${r.channels.whatsapp?.status} helm=${r.channels.helmConnectMessage?.status}`,
          ),
        )
        .catch((err) =>
          this.logger.warn(`notifyExamScheduled non-bloquant échoué: ${err.message}`),
        );
    }

    return exam;
  }

  /**
   * Récupère tous les examens
   */
  async findAllExams(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      academicTrackId?: string;
      language?: string;
      quarterId?: string;
      classId?: string;
      subjectId?: string;
      examType?: string;
      search?: string;
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

    if (filters?.academicTrackId !== undefined) {
      where.academicTrackId = filters.academicTrackId;
    }

    // Mode bilingue : filtrer par langue (FR/EN)
    if (filters?.language) {
      where.language = filters.language;
    }

    if (filters?.quarterId) {
      where.quarterId = filters.quarterId;
    }

    if (filters?.classId) {
      where.classId = filters.classId;
    }

    if (filters?.subjectId) {
      where.subjectId = filters.subjectId;
    }

    if (filters?.examType) {
      where.examType = filters.examType;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.exam.findMany({
      where,
      include: {
        subject: true,
        quarter: true,
        classSubject: true,
        academicYear: true,
        schoolLevel: true,
      },
      orderBy: [
        { examDate: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  /**
   * Récupère un examen par ID
   */
  async findExamById(id: string, tenantId: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id, tenantId },
      include: {
        subject: true,
        quarter: true,
        classSubject: true,
        academicYear: true,
        schoolLevel: true,
        examScores: {
          include: {
            student: true,
          },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException(`Exam with ID ${id} not found`);
    }

    return exam;
  }

  /**
   * Met à jour un examen
   */
  async updateExam(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      examType?: string;
      examDate?: Date;
      maxScore?: number;
      coefficient?: number;
      description?: string;
    }
  ) {
    const exam = await this.findExamById(id, tenantId);

    return this.prisma.exam.update({
      where: { id },
      data,
      include: {
        subject: true,
        quarter: true,
        classSubject: true,
      },
    });
  }

  /**
   * Supprime un examen (archivage logique)
   */
  async deleteExam(id: string, tenantId: string) {
    const exam = await this.findExamById(id, tenantId);

    // Vérifier qu'aucune note n'est associée
    const scoresCount = await this.prisma.examScore.count({
      where: {
        examId: id,
        tenantId,
      },
    });

    if (scoresCount > 0) {
      throw new BadRequestException(
        `Cannot delete exam: ${scoresCount} score(s) are associated with it`
      );
    }

    await this.prisma.exam.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Récupère les statistiques d'un examen
   */
  async getExamStatistics(examId: string, tenantId: string) {
    const exam = await this.findExamById(examId, tenantId);

    const [totalScores, validatedScores, averageScore] = await Promise.all([
      this.prisma.examScore.count({
        where: {
          examId,
          tenantId,
        },
      }),
      this.prisma.examScore.count({
        where: {
          examId,
          tenantId,
          isValidated: true,
        },
      }),
      this.prisma.examScore.aggregate({
        where: {
          examId,
          tenantId,
          isValidated: true,
        },
        _avg: {
          score: true,
        },
      }),
    ]);

    return {
      exam,
      totalScores,
      validatedScores,
      pendingValidation: totalScores - validatedScores,
      averageScore: averageScore._avg.score || 0,
    };
  }

  /**
   * Tableau de bord global des examens (KPIs agrégés)
   * Endpoint: GET /api/exams/dashboard?academicYearId=...
   */
  async getDashboard(tenantId: string, academicYearId: string) {
    const where = { tenantId, academicYearId };

    // ⭐ Seuil de réussite configurable (défaut 10)
    const passScore = await this.getPassScore(tenantId, academicYearId);

    const [totalExams, totalScores, validatedScores, reportCards] =
      await Promise.all([
        // Total examens planifiés
        this.prisma.exam.count({ where }),

        // Total notes saisies
        this.prisma.examScore.count({ where }),

        // Notes validées
        this.prisma.examScore.count({ where: { ...where, isValidated: true } }),

        // Bulletins générés
        this.prisma.reportCard.findMany({
          where,
          select: { id: true, status: true },
        }),
      ]);

    // Calcul de la moyenne globale sur les notes validées
    const avgResult = await this.prisma.examScore.aggregate({
      where: { ...where, isValidated: true },
      _avg: { score: true },
    });

    const globalAverage = avgResult._avg.score
      ? Number(avgResult._avg.score.toFixed(2))
      : 0;

    const missingGrades = totalScores === 0 ? 0 : totalScores - validatedScores;
    const successRate =
      validatedScores > 0
        ? Math.round(
            ((await this.prisma.examScore.count({
              where: { ...where, isValidated: true, score: { gte: passScore } },
            })) /
              validatedScores) *
              100,
          )
        : 0;

    const generatedBulletins = reportCards.filter(
      (r) => r.status === 'GENERATED' || r.status === 'PUBLISHED',
    ).length;

    return {
      plannedCount: totalExams,
      totalScores,
      validatedScores,
      missingGrades,
      globalAverage,
      successRate,
      generatedBulletins,
      lockedClasses: 0,   // À connecter à la table grade_locks si implémentée
      orionAlerts: 0,     // À connecter au service OrionAlerts
    };
  }

  /**
   * Récupère la grille de saisie pour une évaluation
   */
  async getGradingSheet(examId: string, tenantId: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, tenantId },
    });
    if (!exam) {
      throw new NotFoundException(`Exam with ID ${examId} not found`);
    }

    // 1. Get all students enrolled in the class of this exam
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        classId: exam.classId,
        tenantId,
        academicYearId: exam.academicYearId,
      },
      include: {
        student: true,
      },
    });

    // 2. Fetch all exams of this subject in the same class, period, and year
    // because grading sheet collects scores for all types (columns) of exams
    const relatedExams = await this.prisma.exam.findMany({
      where: {
        classId: exam.classId,
        subjectId: exam.subjectId,
        quarterId: exam.quarterId,
        academicYearId: exam.academicYearId,
        tenantId,
      },
    });

    const examIds = relatedExams.map((e) => e.id);

    // 3. Fetch all scores for these exams
    const scores = await this.prisma.examScore.findMany({
      where: {
        examId: { in: examIds },
        studentId: { in: enrollments.map((e) => e.studentId) },
        tenantId,
      },
    });

    // 4. Map students to grading row structure
    return enrollments.map((enrollment) => {
      const studentScores: Record<string, number | null> = {};
      let isAbsent = false;
      let comment = '';

      relatedExams.forEach((e) => {
        const scoreObj = scores.find(
          (s) => s.examId === e.id && s.studentId === enrollment.studentId,
        );
        if (scoreObj) {
          studentScores[e.examType] = scoreObj.score;
          if (scoreObj.remarks === 'ABSENT') {
            isAbsent = true;
          } else if (scoreObj.remarks) {
            comment = scoreObj.remarks;
          }
        } else {
          studentScores[e.examType] = null;
        }
      });

      return {
        studentId: enrollment.studentId,
        studentName: `${enrollment.student.lastName} ${enrollment.student.firstName}`.trim(),
        matricule: enrollment.localStudentMatricule ?? enrollment.student.matricule ?? null,
        scores: studentScores,
        isAbsent,
        comment,
      };
    });
  }

  /**
   * Enregistre la grille de saisie pour une évaluation
   */
  async saveGradingSheet(examId: string, tenantId: string, userId: string, body: any) {
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, tenantId },
      include: {
        classSubject: true,
      },
    });
    if (!exam) {
      throw new NotFoundException(`Exam with ID ${examId} not found`);
    }

    // ⭐ Check serveur : seul l'enseignant assigné (ou un directeur/admin) peut saisir les notes
    // Vérifie via TeacherClassAssignment si l'utilisateur est bien l'enseignant de la matière
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isDirectorOrAdmin = user && ['DIRECTOR', 'ADMIN', 'SCHOOL_DIRECTOR', 'DIRECTEUR_ETABLISSEMENT', 'DIRECTEUR_GENERAL', 'PROMOTER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'SUPER_DIRECTOR', 'PLATFORM_OWNER', 'PLATFORM_ADMIN'].includes(user.role || '');

    if (!isDirectorOrAdmin && exam.classSubject) {
      // Vérifier que l'utilisateur est bien l'enseignant assigné à cette matière
      const teacherAssignment = await this.prisma.teacherClassAssignment.findFirst({
        where: {
          tenantId,
          classSubjectId: exam.classSubject.id,
          teacher: { createdBy: userId },
        },
      });
      // Si pas d'assignation trouvée → refuser
      if (!teacherAssignment) {
        throw new BadRequestException(
          "Vous n'êtes pas autorisé à saisir des notes pour cette évaluation. " +
          "Seul l'enseignant assigné à cette matière (ou un directeur/admin) peut le faire."
        );
      }
    }

    const { scores, submit } = body;
    if (!Array.isArray(scores)) {
      throw new BadRequestException('Scores array is required');
    }

    // Find all column keys (assessment types) sent
    const colKeys = new Set<string>();
    scores.forEach((s) => {
      if (s.scores) {
        Object.keys(s.scores).forEach((k) => colKeys.add(k));
      }
    });

    // For each column key, find or create the corresponding Exam record
    const colExams: Record<string, any> = {};
    for (const key of colKeys) {
      let colExam = await this.prisma.exam.findFirst({
        where: {
          classId: exam.classId,
          subjectId: exam.subjectId,
          quarterId: exam.quarterId,
          academicYearId: exam.academicYearId,
          tenantId,
          examType: key,
        },
      });

      if (!colExam) {
        colExam = await this.prisma.exam.create({
          data: {
            tenantId,
            academicYearId: exam.academicYearId,
            schoolLevelId: exam.schoolLevelId,
            academicTrackId: exam.academicTrackId,
            quarterId: exam.quarterId,
            classSubjectId: exam.classSubjectId,
            subjectId: exam.subjectId,
            classId: exam.classId,
            name: `${exam.name} - ${key}`,
            examType: key,
            examDate: exam.examDate,
            maxScore: exam.maxScore,
            coefficient: exam.coefficient,
            description: exam.description,
          },
        });
      }
      colExams[key] = colExam;
    }

    // Save scores
    for (const s of scores) {
      const { studentId, scores: studentScores, isAbsent, comment } = s;

      for (const [key, val] of Object.entries(studentScores)) {
        const colExam = colExams[key];
        if (!colExam) continue;

        const scoreVal = isAbsent ? 0 : val !== null ? Number(val) : null;
        const remarks = isAbsent ? 'ABSENT' : comment || null;

        if (scoreVal === null && !isAbsent) {
          // Delete existing score if empty
          await this.prisma.examScore.deleteMany({
            where: {
              examId: colExam.id,
              studentId,
              subjectId: exam.subjectId,
              tenantId,
            },
          });
          continue;
        }

        const existingScore = await this.prisma.examScore.findFirst({
          where: {
            examId: colExam.id,
            studentId,
            subjectId: exam.subjectId,
            tenantId,
          },
        });

        if (existingScore) {
          await this.prisma.examScore.update({
            where: { id: existingScore.id },
            data: {
              score: scoreVal ?? 0,
              remarks,
              isValidated: submit,
              validatedBy: submit ? userId : null,
              validatedAt: submit ? new Date() : null,
            },
          });
        } else {
          await this.prisma.examScore.create({
            data: {
              tenantId,
              academicYearId: exam.academicYearId,
              schoolLevelId: exam.schoolLevelId,
              academicTrackId: exam.academicTrackId,
              examId: colExam.id,
              studentId,
              subjectId: exam.subjectId,
              score: scoreVal ?? 0,
              maxScore: colExam.maxScore,
              coefficient: colExam.coefficient,
              remarks,
              isValidated: submit,
              recordedBy: userId,
              validatedBy: submit ? userId : null,
              validatedAt: submit ? new Date() : null,
            },
          });
        }
      }
    }

    return { success: true };
  }

  /**
   * Calcule et retourne les moyennes d'une classe pour une période donnée.
   * Cette méthode est réutilisable pour get et calculate.
   */
  async computeClassAveragesInternal(
    tenantId: string,
    classId: string,
    periodId: string,
    academicYearId: string,
  ) {
    // 0. Verify class exists via raw SQL
    // ⭐ Fallback: if tenantId is undefined, try without tenant filter
    let classRows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, name, "schoolLevelId" FROM "classes" WHERE id = $1 AND "tenantId" = $2 LIMIT 1
    `, [classId, tenantId]).catch(() => []);

    // Fallback: try without tenantId (in case @TenantId() returned undefined)
    if ((!classRows || classRows.length === 0) && !tenantId) {
      classRows = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT id, name, "schoolLevelId" FROM "classes" WHERE id = $1 LIMIT 1
      `, [classId]).catch(() => []);
    }

    if (!classRows || classRows.length === 0) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }
    const classRecord = classRows[0];

    // 1. Get active settings via raw SQL (avoid Prisma model issues)
    const settingsRows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, config, status FROM "school_academic_settings"
      WHERE "tenantId" = $1 AND "schoolYearId" = $2 AND status = 'ACTIVE'
      LIMIT 1
    `, [tenantId, academicYearId]).catch(() => []);

    if (!settingsRows || settingsRows.length === 0) {
      throw new BadRequestException(
        "Aucun paramétrage académique actif trouvé pour cette année scolaire. Veuillez l'activer dans les Paramètres.",
      );
    }

    const activeSettings = settingsRows[0];
    const cfg =
      typeof activeSettings.config === 'string'
        ? JSON.parse(activeSettings.config)
        : activeSettings.config;

    const subjectFormula =
      cfg.calculationRules?.subjectAverage?.expression ||
      '((DEVOIR_1 * 1) + (COMPOSITION * 2)) / 3';
    const promotionRules = cfg.calculationRules?.promotionRules || [];
    const tieMode = cfg.rankingRules?.tieMode || 'SAME_RANK';
    const decimals = cfg.scoreScale?.decimals ?? 2;

    // 2. Fetch students via raw SQL (avoid Prisma include issues)
    // ✅ Use column aliases to match camelCase property names expected by code
    const enrollments = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT se."id", se."studentId", se."classId", se."schoolLevelId",
             se."localStudentMatricule",
             s."firstName", s."lastName", s."matricule"
      FROM "student_enrollments" se
      INNER JOIN "students" s ON s."id" = se."studentId"
      WHERE se."classId" = $1 AND se."tenantId" = $2 AND se."academicYearId" = $3
        AND se."status" IN ('ACTIVE', 'ADMITTED', 'ENROLLED', 'CONFIRMED')
    `, [classId, tenantId, academicYearId]).catch(() => []);

    // ✅ Prisma $queryRawUnsafe returns column names in lowercase by default
    // Map to camelCase to match the rest of the code
    const enrollmentsMapped = enrollments.map((e: any) => ({
      id: e.id,
      studentId: e.studentId || e.studentid,
      classId: e.classId || e.classid,
      schoolLevelId: e.schoolLevelId || e.schoollevelid,
      localStudentMatricule: e.localStudentMatricule || e.localstudentmatricule,
      firstName: e.firstName || e.firstname,
      lastName: e.lastName || e.lastname,
      matricule: e.matricule,
      student: {
        firstName: e.firstName || e.firstname,
        lastName: e.lastName || e.lastname,
        matricule: e.matricule,
      },
    }));

    // 3. Fetch class subjects
    // ✅ FIX: class_subjects.classId is NULL in production — uses academicClassId
    // Use raw SQL to avoid Prisma schema issues with officialClassId field
    let classSubjects: any[] = [];

    // Step 1: Try classId
    classSubjects = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT cs.*, s."name" as "subjectName", s."code" as "subjectCode"
      FROM "class_subjects" cs
      INNER JOIN "subjects" s ON s."id" = cs."subjectId"
      WHERE cs."classId" = $1 AND cs."tenantId" = $2 AND cs."academicYearId" = $3
    `, [classId, tenantId, academicYearId]).catch(() => []);

    // Step 2: Fallback via officialClassId → academicClassId
    if (classSubjects.length === 0) {
      classSubjects = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT cs.*, s."name" as "subjectName", s."code" as "subjectCode"
        FROM "class_subjects" cs
        INNER JOIN "subjects" s ON s."id" = cs."subjectId"
        INNER JOIN "classes" c ON c."officialClassId" = cs."academicClassId"
        WHERE c."id" = $1 AND cs."tenantId" = $2 AND cs."academicYearId" = $3
      `, [classId, tenantId, academicYearId]).catch(() => []);
    }

    // Step 3: Last resort — match by subjectId from evaluations
    if (classSubjects.length === 0) {
      classSubjects = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT cs.*, s."name" as "subjectName", s."code" as "subjectCode"
        FROM "class_subjects" cs
        INNER JOIN "subjects" s ON s."id" = cs."subjectId"
        WHERE cs."tenantId" = $1 AND cs."academicYearId" = $2
        AND cs."subjectId" IN (
          SELECT DISTINCT "subjectId" FROM "evaluations"
          WHERE "classId" = $3 AND "tenantId" = $1 AND "academicYearId" = $2
        )
      `, [tenantId, academicYearId, classId]).catch(() => []);
    }

    // Transform to match expected format
    classSubjects = classSubjects.map((cs: any) => ({
      id: cs.id,
      subjectId: cs.subjectId,
      coefficient: Number(cs.coefficient) || 1,
      subject: {
        id: cs.subjectId,
        name: cs.subjectName || cs.subjectCode || 'Matière',
      },
    }));

    // 4. Fetch grades via raw SQL (avoid Prisma relation issues with evaluation include)
    // ✅ FIX: prisma.grade.findMany with evaluation include causes P2003 on Railway
    // because the Prisma client cache doesn't have the Grade→Evaluation relation
    const gradesRaw = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT g.id, g.score, g."qualitativeCode", g.status, g."isAbsent",
             g."classId", g."periodId", g."evaluationId",
             g."studentId", g."subjectId",
             e."evaluationTypeId",
             et."name" as "evalTypeName"
      FROM "grades" g
      LEFT JOIN "evaluations" e ON e."id" = g."evaluationId"
      LEFT JOIN "evaluation_types" et ON et."id" = e."evaluationTypeId"
      WHERE g."tenantId" = $1
        AND g."academicYearId" = $2
        AND g."classId" = $3
        AND g.status IN ('VALIDATED', 'SUBMITTED')
        AND e."periodId" = $4
    `, [tenantId, academicYearId, classId, periodId]).catch(() => []);

    // ✅ Map raw SQL lowercase columns to camelCase
    const grades = gradesRaw.map((g: any) => ({
      id: g.id,
      score: g.score !== null ? Number(g.score) : null,
      qualitativeCode: g.qualitativeCode || g.qualitativecode,
      status: g.status,
      isAbsent: g.isAbsent ?? g.isabsent ?? false,
      classId: g.classId || g.classid,
      periodId: g.periodId || g.periodid,
      evaluationId: g.evaluationId || g.evaluationid,
      studentId: g.studentId || g.studentid,
      subjectId: g.subjectId || g.subjectid,
      evalTypeName: g.evalTypeName || g.evaltypename || g.EvalTypeName || 'UNKNOWN',
    }));

    const studentsList: any[] = [];

    // 5. Compute for each student
    for (const enrollment of enrollmentsMapped) {
      const subjectAverages: Record<string, number> = {};
      const frontendSubjectAverages: Record<string, number> = {};
      const generalAvgInput: any[] = [];

      for (const cs of classSubjects) {
        // Get all validated grades for this student + subject
        const studentSubjGrades = grades.filter(
          (g) => g.studentId === enrollment.studentId && g.subjectId === cs.subjectId,
        );

        // Skip absent students
        const validGrades = studentSubjGrades.filter(g => !g.isAbsent && g.score !== null);

        if (validGrades.length === 0) {
          // No grades for this subject — skip (don't count as 0)
          continue;
        }

        // ✅ Maternelle: qualitative evaluation (TS/S/PS)
        // Convert qualitative codes to numeric values for calculation
        const isQualitative = validGrades.some(g => g.qualitativeCode);
        if (isQualitative) {
          // TS=3, S=2, PS=1 — used for backend calculation
          const qualitativeMap: Record<string, number> = { 'TS': 3, 'S': 2, 'PS': 1, 'NS': 0 };
          const numericValues = validGrades.map(g =>
            g.qualitativeCode ? (qualitativeMap[g.qualitativeCode] ?? 0) : (g.score ?? 0)
          );
          const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;

          // Convert back to appreciation
          const appreciation = avg >= 2.5 ? 'Très Satisfaisant' : avg >= 1.5 ? 'Satisfaisant' : 'Peu Satisfaisant';

          subjectAverages[cs.subjectId] = avg;
          frontendSubjectAverages[cs.subject.name] = avg;
          frontendSubjectAverages[`${cs.subject.name}_appreciation`] = appreciation as any;
          frontendSubjectAverages[`${cs.subject.name}_qualitative`] = true as any;
          generalAvgInput.push({
            average: avg,
            coefficient: cs.coefficient,
          });
          continue;
        }

        // ✅ Primaire/Secondaire: numeric scores
        // Group by evaluation type (EM1, EM2, EC, DS1, DS2, IE1, IE2, etc.)
        const assessmentScores: Record<string, number> = {};
        validGrades.forEach((g) => {
          const evalTypeName = g.evalTypeName || g.evaluation?.evaluationType?.name || 'UNKNOWN';
          // Map common names to formula placeholders
          const placeholder = this.mapEvaluationTypeToPlaceholder(evalTypeName);
          if (assessmentScores[placeholder] !== undefined) {
            // Average duplicates of same type
            assessmentScores[placeholder] =
              (assessmentScores[placeholder] + (g.score ?? 0)) / 2;
          } else {
            assessmentScores[placeholder] = g.score ?? 0;
          }
        });

        // Calculate subject average using rules engine
        const subjectAvg = this.rulesEngine.evaluateSubjectAverage(
          assessmentScores,
          { expression: subjectFormula, type: 'formula' },
        );

        subjectAverages[cs.subjectId] = subjectAvg;
        frontendSubjectAverages[cs.subject.name] = subjectAvg;
        generalAvgInput.push({
          average: subjectAvg,
          coefficient: cs.coefficient,
        });
      }

      // ✅ General average: weighted by coefficients (from ClassSubject)
      // For 6e/5e (no coefficients): all coefficients = 1 → simple average
      // For 4e/3e (with coefficients): weighted average
      const generalAverage = generalAvgInput.length > 0
        ? this.rulesEngine.evaluateGeneralAverage(generalAvgInput)
        : 0;

      studentsList.push({
        studentId: enrollment.studentId,
        enrollment,
        generalAverage,
        subjectAverages,
        frontendSubjectAverages,
      });
    }

    // 6. Compute rankings
    const ranked = this.rulesEngine.computeRankings(
      studentsList.map((s) => ({ id: s.studentId, average: s.generalAverage })),
      tieMode,
    );

    studentsList.forEach((s) => {
      const rankObj = ranked.find((r) => r.id === s.studentId);
      s.rank = rankObj ? rankObj.rank : 1;
    });

    // 7. Persist rankings via raw SQL (avoid Prisma model issues)
    for (const s of studentsList) {
      const schoolLevelId = s.enrollment.schoolLevelId || classRecord.schoolLevelId;
      
      // Check existing
      const existing = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT id FROM "rankings"
        WHERE "tenantId" = $1 AND "academicYearId" = $2
          AND "schoolLevelId" = $3 AND "rankingType" = 'CLASS'
          AND "classId" = $4 AND "quarterId" = $5 AND "studentId" = $6
        LIMIT 1
      `, [tenantId, academicYearId, schoolLevelId, classId, periodId, s.studentId]).catch(() => []);

      if (existing && existing.length > 0) {
        await this.prisma.$executeRawUnsafe(`
          UPDATE "rankings"
          SET "average" = $1, "rank" = $2, "totalStudents" = $3, "updatedAt" = NOW()
          WHERE "id" = $4
        `, [s.generalAverage, s.rank, enrollmentsMapped.length, existing[0].id]).catch(() => {});
      } else {
        const rankId = crypto.randomUUID();
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO "rankings" ("id", "tenantId", "academicYearId", "schoolLevelId",
            "rankingType", "classId", "quarterId", "studentId", "average", "rank", "totalStudents",
            "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, 'CLASS', $5, $6, $7, $8, $9, $10, NOW(), NOW())
        `, [rankId, tenantId, academicYearId, schoolLevelId, classId, periodId,
            s.studentId, s.generalAverage, s.rank, enrollmentsMapped.length]).catch(() => {});
      }
    }

    // 8. Return formatted averages
    return studentsList.map((s) => {
      const decision = this.rulesEngine.evaluatePromotion(s.generalAverage, promotionRules);

      return {
        id: s.studentId,
        student: {
          lastName: s.enrollment.lastName || s.enrollment.student?.lastName || '',
          firstName: s.enrollment.firstName || s.enrollment.student?.firstName || '',
          matricule: s.enrollment.localStudentMatricule || s.enrollment.matricule || s.enrollment.student?.matricule || null,
        },
        classRank: s.rank,
        generalAverage: Number(s.generalAverage.toFixed(decimals)),
        subjectAverages: s.frontendSubjectAverages,
        decision,
      };
    });
  }

  /**
   * ✅ Map evaluation type names to formula placeholders.
   * Supports both French and English naming conventions.
   * Examples:
   *   "Évaluation mensuelle 1" → "EM1"
   *   "Évaluation mensuelle 2" → "EM2"
   *   "Évaluation certificative" → "EC"
   *   "Devoir surveillé 1" → "DS1"
   *   "Interrogation écrite 1" → "IE1"
   *   "Devoir 1" → "DEVOIR_1"
   *   "Composition" → "COMPOSITION"
   */
  private mapEvaluationTypeToPlaceholder(name: string): string {
    const upper = name.toUpperCase().trim();

    // Primaire: EM1, EM2, EC, EP
    if (upper.includes('MENSUELLE 1') || upper.includes('EM1')) return 'EM1';
    if (upper.includes('MENSUELLE 2') || upper.includes('EM2')) return 'EM2';
    if (upper.includes('CERTIFICATIVE') || upper.includes('EC')) return 'EC';
    if (upper.includes('PASSAGE') || upper.includes('EP')) return 'EP';

    // Secondaire: IE1, IE2, DS1, DS2
    if (upper.includes('INTERROGATION') && (upper.includes('1') || upper.includes('I'))) return 'IE1';
    if (upper.includes('INTERROGATION') && (upper.includes('2') || upper.includes('II'))) return 'IE2';
    if (upper.includes('DEVOIR SURVEILL') && (upper.includes('1') || upper.includes('I'))) return 'DS1';
    if (upper.includes('DEVOIR SURVEILL') && (upper.includes('2') || upper.includes('II'))) return 'DS2';

    // Generic: Devoir 1/2, Composition
    if (upper.includes('DEVOIR 1') || upper === 'DEVOIR_1') return 'DEVOIR_1';
    if (upper.includes('DEVOIR 2') || upper === 'DEVOIR_2') return 'DEVOIR_2';
    if (upper.includes('COMPOSITION')) return 'COMPOSITION';

    // Fallback: use the raw name as placeholder
    return upper.replace(/\s+/g, '_');
  }

  /**
   * GET /api/exams/averages
   */
  async getAverages(tenantId: string, classId: string, periodId: string, academicYearId: string) {
    // Return dynamically calculated averages
    return this.computeClassAveragesInternal(tenantId, classId, periodId, academicYearId);
  }

  /**
   * POST /api/exams/calculate-averages
   */
  async calculateAverages(tenantId: string, classId: string, periodId: string, academicYearId: string) {
    return this.computeClassAveragesInternal(tenantId, classId, periodId, academicYearId);
  }

  /**
   * POST /api/exams/calculate-evaluation-averages
   *
   * Calcule les moyennes pour un type d'évaluation spécifique (EM1, EM2, EC)
   * pour tous les élèves d'une classe, sur un trimestre donné.
   *
   * ⭐ Contrairement à calculateAverages (qui consolide toutes les évaluations),
   *    cette méthode isole UN type d'évaluation précis.
   *
   * Retourne :
   *   - Pour chaque élève : moyenne par matière + moyenne générale + rang
   *   - Pour la maternelle : codes qualitatifs (TS/S/PS) + appréciation globale
   *   - Pour le primaire : notes /20 par matière + moyenne générale
   *
   * @param evaluationTypeId ID du type d'évaluation (EM1, EM2, EC)
   * @param periodId ID du trimestre
   * @param classId ID de la classe
   * @param academicYearId ID de l'année scolaire
   */
  async calculateEvaluationAverages(
    tenantId: string,
    classId: string,
    periodId: string,
    academicYearId: string,
    evaluationTypeId: string,
    language?: string, // ⭐ 'FR' or 'EN' — filters subjects by language track
  ) {
    // 1. Verify class exists + get school level
    // ⭐ Fallback: if tenantId is undefined, try without tenant filter
    let classRows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT c.id, c.name, c."schoolLevelId", sl.code AS "schoolLevelCode"
      FROM "classes" c
      LEFT JOIN "school_levels" sl ON sl.id = c."schoolLevelId"
      WHERE c.id = $1 AND c."tenantId" = $2 LIMIT 1
    `, [classId, tenantId]).catch(() => []);

    // Fallback: try without tenantId (in case @TenantId() returned undefined)
    if ((!classRows || classRows.length === 0) && !tenantId) {
      classRows = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT c.id, c.name, c."schoolLevelId", sl.code AS "schoolLevelCode"
        FROM "classes" c
        LEFT JOIN "school_levels" sl ON sl.id = c."schoolLevelId"
        WHERE c.id = $1 LIMIT 1
      `, [classId]).catch(() => []);
    }

    if (!classRows || classRows.length === 0) {
      throw new NotFoundException(`Classe ${classId} introuvable`);
    }
    const classRecord = classRows[0];
    const isMaternelle = classRecord.schoolLevelCode === 'MATERNELLE';

    // 2. Fetch students enrolled in this class
    const enrollments = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT se."studentId", s."firstName", s."lastName", s."matricule", s.gender
      FROM "student_enrollments" se
      INNER JOIN "students" s ON s."id" = se."studentId"
      WHERE se."classId" = $1 AND se."tenantId" = $2 AND se."academicYearId" = $3
        AND se."status" IN ('ACTIVE', 'ADMITTED', 'ENROLLED', 'CONFIRMED')
      ORDER BY s."lastName", s."firstName"
    `, [classId, tenantId, academicYearId]).catch(() => []);

    // 3. Fetch all evaluations for this class + period + evaluationType
    const evaluations = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT e.id, e."subjectId", e."evaluationTypeId", e.status,
             s."name" AS "subjectName", s."code" AS "subjectCode",
             s.language AS "subjectLanguage"
      FROM "evaluations" e
      LEFT JOIN "subjects" s ON s."id" = e."subjectId"
      WHERE e."classId" = $1 AND e."tenantId" = $2 AND e."academicYearId" = $3
        AND e."periodId" = $4 AND e."evaluationTypeId" = $5
        AND e.status = 'VALIDATED'
      ORDER BY s."name"
    `, [classId, tenantId, academicYearId, periodId, evaluationTypeId]).catch(() => []);

    // 4. For each evaluation, fetch grades
    const evalGradesMap = new Map<string, any[]>();
    for (const ev of evaluations) {
      const grades = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT g."studentId", g.score, g."qualitativeCode", g."isAbsent", g.coefficient
        FROM "grades" g
        WHERE g."evaluationId" = $1 AND g."tenantId" = $2
      `, [ev.id, tenantId]).catch(() => []);
      evalGradesMap.set(ev.id, grades);
    }

    // 5. Build subject list — filtered by language track (FR or EN)
    // ⭐ If language is 'FR', include FR subjects + subjects with no language (legacy)
    //    If language is 'EN', include EN subjects only
    //    If language is not specified, include ALL subjects
    const subjects: Array<{ id: string; name: string; code?: string }> = [];
    const seenSubjectIds = new Set<string>();
    for (const ev of evaluations) {
      if (ev.subjectId && !seenSubjectIds.has(ev.subjectId)) {
        if (language) {
          // Filter by language track
          if (ev.subjectLanguage === language || (!ev.subjectLanguage && language === 'FR')) {
            subjects.push({ id: ev.subjectId, name: ev.subjectName, code: ev.subjectCode });
            seenSubjectIds.add(ev.subjectId);
          }
        } else {
          // No language filter — include all
          subjects.push({ id: ev.subjectId, name: ev.subjectName, code: ev.subjectCode });
          seenSubjectIds.add(ev.subjectId);
        }
      }
    }

    // 6. For each student, compute per-subject score + general average
    const results = enrollments.map((enrollment: any) => {
      const studentId = enrollment.studentId;
      const subjectScores: Record<string, {
        score: number | null;
        qualitativeCode: string | null;
        isAbsent: boolean;
        appreciation: string;
      }> = {};

      let totalScore = 0;
      let validSubjectsCount = 0;
      let tsCount = 0, sCount = 0, psCount = 0;

      for (const subject of subjects) {
        // Find the evaluation for this subject
        const ev = evaluations.find(e => e.subjectId === subject.id);
        if (!ev) {
          subjectScores[subject.id] = {
            score: null,
            qualitativeCode: null,
            isAbsent: false,
            appreciation: '—',
          };
          continue;
        }

        const grades = evalGradesMap.get(ev.id) || [];
        const grade = grades.find(g => g.studentId === studentId);

        if (!grade) {
          subjectScores[subject.id] = {
            score: null,
            qualitativeCode: null,
            isAbsent: false,
            appreciation: '—',
          };
          continue;
        }

        if (grade.isAbsent) {
          subjectScores[subject.id] = {
            score: null,
            qualitativeCode: null,
            isAbsent: true,
            appreciation: 'Absent',
          };
          continue;
        }

        if (isMaternelle) {
          // Maternelle : qualitative codes TS/S/PS
          const code = grade.qualitativeCode;
          subjectScores[subject.id] = {
            score: null,
            qualitativeCode: code,
            isAbsent: false,
            appreciation: code === 'TS' ? 'Très Satisfaisant' :
                          code === 'S' ? 'Satisfaisant' :
                          code === 'PS' ? 'Peu Satisfaisant' : '—',
          };
          if (code === 'TS') { tsCount++; validSubjectsCount++; }
          else if (code === 'S') { sCount++; validSubjectsCount++; }
          else if (code === 'PS') { psCount++; validSubjectsCount++; }
        } else {
          // Primaire/Secondaire : numeric score /20
          const score = grade.score !== null ? Number(grade.score) : null;
          subjectScores[subject.id] = {
            score,
            qualitativeCode: null,
            isAbsent: false,
            appreciation: score === null ? '—' :
                          score >= 16 ? 'Très Bien' :
                          score >= 14 ? 'Bien' :
                          score >= 12 ? 'Assez Bien' :
                          score >= 10 ? 'Passable' : 'Insuffisant',
          };
          if (score !== null) {
            totalScore += score;
            validSubjectsCount++;
          }
        }
      }

      // Compute general average
      let generalAverage: number | null = null;
      let appreciationGlobale = '—';

      if (isMaternelle) {
        // Maternelle : TS=3, S=2, PS=1
        if (validSubjectsCount > 0) {
          const total = tsCount * 3 + sCount * 2 + psCount * 1;
          generalAverage = total / validSubjectsCount;
          // Appreciation globale
          if (generalAverage >= 2.5) appreciationGlobale = 'Très Satisfaisant';
          else if (generalAverage >= 1.5) appreciationGlobale = 'Satisfaisant';
          else appreciationGlobale = 'Peu Satisfaisant';
        }
      } else {
        if (validSubjectsCount > 0) {
          generalAverage = totalScore / validSubjectsCount;
        }
      }

      return {
        id: studentId,
        student: {
          firstName: enrollment.firstName,
          lastName: enrollment.lastName,
          matricule: enrollment.matricule,
          gender: enrollment.gender,
        },
        subjectScores,
        generalAverage,
        appreciationGlobale: isMaternelle ? appreciationGlobale : null,
        isMaternelle,
        // Stats for maternelle
        tsCount, sCount, psCount,
        validSubjectsCount,
      };
    });

    // 7. Compute ranks
    const sorted = [...results].sort((a, b) => {
      const aAvg = a.generalAverage ?? -1;
      const bAvg = b.generalAverage ?? -1;
      return bAvg - aAvg;
    });

    let currentRank = 0;
    let previousAvg: number | null = null;
    let sameRankCount = 0;
    sorted.forEach((r, idx) => {
      if (r.generalAverage === null) {
        r.classRank = idx + 1;
        return;
      }
      if (previousAvg !== null && Math.abs(r.generalAverage - previousAvg) < 0.01) {
        // Same rank as previous
        sameRankCount++;
        r.classRank = currentRank;
      } else {
        currentRank = idx + 1;
        r.classRank = currentRank;
        sameRankCount = 0;
      }
      previousAvg = r.generalAverage;
    });

    // 8. Compute class stats
    const validResults = results.filter(r => r.generalAverage !== null);
    const classAverage = validResults.length > 0
      ? validResults.reduce((sum, r) => sum + (r.generalAverage || 0), 0) / validResults.length
      : null;

    // For primaire: passing count (avg >= 10)
    // For maternelle: passing count (appreciation = TS or S)
    const passingCount = isMaternelle
      ? validResults.filter(r => r.appreciationGlobale === 'Très Satisfaisant' || r.appreciationGlobale === 'Satisfaisant').length
      : validResults.filter(r => (r.generalAverage || 0) >= 10).length;
    const failingCount = validResults.length - passingCount;

    return {
      classId,
      className: classRecord.name,
      schoolLevelCode: classRecord.schoolLevelCode,
      isMaternelle,
      evaluationTypeId,
      periodId,
      subjects,
      results: sorted,
      stats: {
        totalStudents: results.length,
        composedStudents: validResults.length,
        classAverage,
        passingCount,
        failingCount,
        passingRate: validResults.length > 0 ? (passingCount / validResults.length) * 100 : 0,
      },
    };
  }

  /**
   * GET /api/exams/annual-averages?classId=X&academicYearId=Y
   *
   * Calcule la moyenne annuelle + moyenne de passage pour tous les élèves d'une classe.
   *
   * Formule primaire/maternelle :
   *   Moyenne EM annuelle = (Moyenne EM trim1 + trim2 + trim3) / 3
   *   Moyenne EC annuelle = (EC trim1 + trim2 + trim3) / 3
   *   Moyenne annuelle = (Moyenne EM + Moyenne EC) / 2
   *   Moyenne de passage = (Moyenne annuelle + EP) / 2
   *
   * Formule secondaire :
   *   Moyenne annuelle = (Trim1 + Trim2 + Trim3) / 3
   */
  async getAnnualAverages(tenantId: string, classId: string, academicYearId: string) {
    // Récupérer les trimestres (périodes) de l'année
    const periods = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, name, "orderIndex"
      FROM "academic_periods"
      WHERE "academicYearId" = $1 AND "tenantId" = $2
      AND "type" = 'TRIMESTER'
      ORDER BY "orderIndex"
    `, [academicYearId, tenantId]).catch(() => []);

    if (!periods || periods.length === 0) {
      throw new BadRequestException('Aucun trimestre trouvé pour cette année scolaire');
    }

    // Calculer les moyennes par trimestre pour chaque élève
    const trimesterAverages: Record<string, any[]> = {}; // periodId → results

    for (const period of periods) {
      try {
        const results = await this.computeClassAveragesInternal(
          tenantId, classId, period.id, academicYearId,
        );
        trimesterAverages[period.id] = results;
      } catch {
        // Si un trimestre n'a pas de notes, on l'ignore
        trimesterAverages[period.id] = [];
      }
    }

    // Récupérer les notes de l'évaluation de passage (EP)
    const passageGrades = await this.prisma.grade.findMany({
      where: {
        tenantId, academicYearId, classId,
        status: { in: ['VALIDATED', 'SUBMITTED'] },
        evaluation: {
          evaluationType: { name: { contains: 'passage', mode: 'insensitive' } },
        },
      },
      include: { evaluation: { include: { evaluationType: true } } },
    }).catch(() => []);

    // Récupérer les inscriptions
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { classId, tenantId, academicYearId },
      include: { student: true },
    });

    // Pour chaque élève : calculer la moyenne annuelle + passage
    const annualResults = enrollments.map((enrollment) => {
      const studentId = enrollment.studentId;

      // Collecter les moyennes trimestrielles
      const trimAverages: number[] = [];
      const trimDetails: any[] = [];

      for (const period of periods) {
        const trimResult = (trimesterAverages[period.id] || []).find(
          (r: any) => r.id === studentId,
        );
        if (trimResult) {
          trimAverages.push(trimResult.generalAverage);
          trimDetails.push({
            periodId: period.id,
            periodName: period.name,
            average: trimResult.generalAverage,
            rank: trimResult.classRank,
          });
        }
      }

      if (trimAverages.length === 0) {
        return {
          studentId,
          student: {
            lastName: enrollment.student.lastName,
            firstName: enrollment.student.firstName,
            matricule: enrollment.localStudentMatricule ?? enrollment.student.matricule,
          },
          trimesterDetails: [],
          annualAverage: 0,
          passageAverage: null,
          passageStatus: 'N/A',
        };
      }

      // Moyenne annuelle = moyenne des moyennes trimestrielles
      const annualAverage = trimAverages.reduce((a, b) => a + b, 0) / trimAverages.length;

      // Moyenne de passage (si EP existe)
      let passageAverage: number | null = null;
      let passageStatus = 'N/A';

      const studentPassageGrades = passageGrades.filter(g => g.studentId === studentId);
      if (studentPassageGrades.length > 0) {
        // Moyenne EP = somme des notes / nombre de matières
        const epScores = studentPassageGrades.filter(g => !g.isAbsent && g.score !== null);
        if (epScores.length > 0) {
          const epAverage = epScores.reduce((sum, g) => sum + (g.score ?? 0), 0) / epScores.length;
          passageAverage = (annualAverage + epAverage) / 2;
          passageStatus = passageAverage >= 10 ? 'ADMIS' : 'REDOUBLANT';
        }
      }

      return {
        studentId,
        student: {
          lastName: enrollment.student.lastName,
          firstName: enrollment.student.firstName,
          matricule: enrollment.localStudentMatricule ?? enrollment.student.matricule,
        },
        trimesterDetails: trimDetails,
        annualAverage: Number(annualAverage.toFixed(2)),
        passageAverage: passageAverage !== null ? Number(passageAverage.toFixed(2)) : null,
        passageStatus,
      };
    });

    // Trier par moyenne annuelle décroissante
    annualResults.sort((a, b) => b.annualAverage - a.annualAverage);

    // Assigner les rangs annuels
    annualResults.forEach((r, idx) => {
      r.annualRank = idx + 1;
    });

    return annualResults;
  }

  /**
   * GET /api/exams/rankings/by-level?schoolLevelId=X&periodId=Y&academicYearId=Z
   *
   * Calcule les rangs par niveau (toutes classes d'un niveau confondues).
   * Ex: tous les élèves de Maternelle classés par moyenne générale.
   */
  async getRankingsByLevel(
    tenantId: string,
    schoolLevelId: string,
    periodId: string,
    academicYearId: string,
  ) {
    // Récupérer toutes les classes du niveau
    const classes = await this.prisma.class.findMany({
      where: { tenantId, schoolLevelId },
    });

    if (!classes || classes.length === 0) {
      return [];
    }

    // Calculer les moyennes pour chaque classe
    const allStudents: any[] = [];

    for (const cls of classes) {
      try {
        const results = await this.computeClassAveragesInternal(
          tenantId, cls.id, periodId, academicYearId,
        );
        // Ajouter le nom de la classe à chaque résultat
        results.forEach((r: any) => {
          allStudents.push({
            ...r,
            classId: cls.id,
            className: cls.name,
          });
        });
      } catch {
        // Skip classes with no data
      }
    }

    // Trier par moyenne décroissante
    allStudents.sort((a, b) => b.generalAverage - a.generalAverage);

    // Assigner les rangs par niveau
    const tieMode = 'SAME_RANK';
    const ranked = this.rulesEngine.computeRankings(
      allStudents.map((s) => ({ id: s.id, average: s.generalAverage })),
      tieMode,
    );

    allStudents.forEach((s) => {
      const rankObj = ranked.find((r) => r.id === s.id);
      s.levelRank = rankObj ? rankObj.rank : 0;
    });

    return allStudents;
  }

  /**
   * GET /api/exams/rankings/by-subject?classId=X&periodId=Y&academicYearId=Z
   *
   * Calcule les rangs par matière pour une classe.
   * Retourne pour chaque matière le classement des élèves.
   */
  async getRankingsBySubject(
    tenantId: string,
    classId: string,
    periodId: string,
    academicYearId: string,
  ) {
    // Récupérer les matières de la classe
    const classSubjects = await this.prisma.classSubject.findMany({
      where: { classId, tenantId, academicYearId },
      include: { subject: true },
    });

    if (!classSubjects || classSubjects.length === 0) {
      return [];
    }

    // Récupérer les notes (VALIDATED + SUBMITTED)
    // ✅ periodId via evaluation (grades.periodId may be NULL)
    const grades = await this.prisma.grade.findMany({
      where: {
        tenantId, academicYearId, classId,
        status: { in: ['VALIDATED', 'SUBMITTED'] },
        evaluation: { periodId },
      },
      include: {
        evaluation: { include: { evaluationType: true } },
      },
    });

    // Récupérer les élèves
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { classId, tenantId, academicYearId },
      include: { student: true },
    });

    const results: any[] = [];

    for (const cs of classSubjects) {
      const subjectRankings: any[] = [];

      for (const enrollment of enrollments) {
        const studentGrades = grades.filter(
          g => g.studentId === enrollment.studentId &&
               g.subjectId === cs.subjectId &&
               !g.isAbsent &&
               g.score !== null,
        );

        if (studentGrades.length === 0) continue;

        // Pour le maternelle (qualitatif)
        const isQualitative = studentGrades.some(g => g.qualitativeCode);
        let subjectAverage: number;

        if (isQualitative) {
          const qualitativeMap: Record<string, number> = { 'TS': 3, 'S': 2, 'PS': 1, 'NS': 0 };
          const numericValues = studentGrades.map(g =>
            g.qualitativeCode ? (qualitativeMap[g.qualitativeCode] ?? 0) : (g.score ?? 0)
          );
          subjectAverage = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
        } else {
          // Moyenne simple des notes
          subjectAverage = studentGrades.reduce((sum, g) => sum + (g.score ?? 0), 0) / studentGrades.length;
        }

        subjectRankings.push({
          studentId: enrollment.studentId,
          studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
          matricule: enrollment.localStudentMatricule ?? enrollment.student.matricule,
          subjectAverage: Number(subjectAverage.toFixed(2)),
          isQualitative,
        });
      }

      // Trier par moyenne décroissante
      subjectRankings.sort((a, b) => b.subjectAverage - a.subjectAverage);

      // Assigner les rangs
      const ranked = this.rulesEngine.computeRankings(
        subjectRankings.map((s) => ({ id: s.studentId, average: s.subjectAverage })),
        'SAME_RANK',
      );

      subjectRankings.forEach((s) => {
        const rankObj = ranked.find((r) => r.id === s.studentId);
        s.subjectRank = rankObj ? rankObj.rank : 0;
      });

      results.push({
        subjectId: cs.subjectId,
        subjectName: cs.subject.name,
        coefficient: cs.coefficient,
        rankings: subjectRankings,
      });
    }

    return results;
  }

  /**
   * POST /api/exams/generate-report-cards
   */
  async generateReportCardsForClass(
    tenantId: string,
    classId: string,
    periodId: string,
    academicYearId: string,
  ) {
    const classRecord = await this.prisma.class.findFirst({
      where: { id: classId, tenantId },
    });
    if (!classRecord) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    // Delete existing DRAFT report cards
    const draftReportCards = await this.prisma.reportCard.findMany({
      where: {
        tenantId,
        academicYearId,
        quarterId: periodId,
        status: 'DRAFT',
        student: {
          studentEnrollments: {
            some: {
              classId,
              academicYearId,
            },
          },
        },
      },
    });

    const draftIds = draftReportCards.map((rc) => rc.id);
    await this.prisma.reportCardItem.deleteMany({
      where: { reportCardId: { in: draftIds }, tenantId },
    });
    await this.prisma.reportCard.deleteMany({
      where: { id: { in: draftIds }, tenantId },
    });

    // Fetch all student enrollments
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { classId, tenantId, academicYearId },
    });

    // Determine type based on settings periodType
    const activeSettings = await this.prisma.schoolAcademicSettings.findFirst({
      where: { tenantId, schoolYearId: academicYearId, status: 'ACTIVE' },
    });

    let type = 'QUARTERLY';
    if (activeSettings) {
      const cfg =
        typeof activeSettings.config === 'string'
          ? JSON.parse(activeSettings.config)
          : activeSettings.config;
      const periodType = cfg.periodType;
      if (periodType === 'Semestre') type = 'SEMESTER';
      else if (periodType === 'Séquence') type = 'SEQUENCE';
    }

    // Generate bulletins
    for (const enrollment of enrollments) {
      await this.reportCardsService
        .generateReportCard({
          tenantId,
          academicYearId,
          schoolLevelId: classRecord.schoolLevelId,
          studentId: enrollment.studentId,
          quarterId: periodId,
          type,
        })
        .catch((e) => console.warn(`Bulletin generation failed for student ${enrollment.studentId}:`, e));
    }

    return { success: true };
  }

  /**
   * GET /api/exams/bulletins
   */
  async getBulletinsForClass(
    tenantId: string,
    classId: string,
    periodId: string,
    academicYearId: string,
  ) {
    const reportCards = await this.prisma.reportCard.findMany({
      where: {
        tenantId,
        academicYearId,
        quarterId: periodId,
        student: {
          studentEnrollments: {
            some: {
              classId,
              academicYearId,
            },
          },
        },
      },
      include: {
        student: true,
        items: {
          include: {
            subject: true,
          },
        },
      },
    });

    return reportCards.map((rc) => {
      const subjectAverages = rc.items.map((item) => ({
        subjectName: item.subject.name,
        average: item.average,
        coefficient: item.coefficient,
        maxScore: 20,
      }));

      return {
        id: rc.id,
        studentId: rc.studentId,
        student: {
          lastName: rc.student.lastName,
          firstName: rc.student.firstName,
          matricule: rc.student.matricule ?? null,
        },
        classRank: rc.rank ?? 1,
        generalAverage: rc.overallAverage,
        isPublished: rc.status === 'PUBLISHED',
        promotionDecision: rc.status === 'PUBLISHED' ? 'Passe' : 'En attente',
        teacherComment: '',
        directorDecision: '',
        subjectAverages,
      };
    });
  }

  /**
   * POST /api/exams/bulletins/publish
   */
  async publishBulletinsForClass(
    tenantId: string,
    classId: string,
    periodId: string,
    academicYearId: string,
    publishedByUserId?: string, // ⭐ V3-4: pour Yeshua Connect notification
  ) {
    const reportCards = await this.prisma.reportCard.findMany({
      where: {
        tenantId,
        academicYearId,
        quarterId: periodId,
        student: {
          studentEnrollments: {
            some: {
              classId,
              academicYearId,
            },
          },
        },
      },
    });

    const ids = reportCards.map((rc) => rc.id);
    await this.prisma.reportCard.updateMany({
      where: { id: { in: ids }, tenantId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        generatedAt: new Date(),
      },
    });

    // ⭐ V3-4: Yeshua Connect notification (fire-and-forget) — prévient tous les parents
    if (this.bridge) {
      this.bridge
        .notifyBulletinPublished({
          tenantId,
          classId,
          periodId,
          academicYearId,
          publishedByUserId,
        })
        .then((r) =>
          this.logger.log(
            `notifyBulletinPublished: inApp=${r.channels.inApp?.status} whatsapp=${r.channels.whatsapp?.status} helm=${r.channels.helmConnectMessage?.status}`,
          ),
        )
        .catch((err) =>
          this.logger.warn(`notifyBulletinPublished non-bloquant échoué: ${err.message}`),
        );
    }

    return { success: true };
  }
}

