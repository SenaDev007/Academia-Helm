/**
 * ============================================================================
 * EXAMS PRISMA SERVICE - MODULE 3
 * ============================================================================
 * 
 * Service pour la gestion des examens
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AcademicRulesEngine } from './academic-rules-engine.service';
import { ReportCardsPrismaService } from './report-cards-prisma.service';

@Injectable()
export class ExamsPrismaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rulesEngine: AcademicRulesEngine,
    private readonly reportCardsService: ReportCardsPrismaService,
  ) {}

  /**
   * Crée un examen
   */
  async createExam(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    academicTrackId?: string;
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

    return this.prisma.exam.create({
      data: {
        ...data,
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
              where: { ...where, isValidated: true, score: { gte: 10 } },
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
    });
    if (!exam) {
      throw new NotFoundException(`Exam with ID ${examId} not found`);
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
    const classRecord = await this.prisma.class.findFirst({
      where: { id: classId, tenantId },
    });
    if (!classRecord) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    // 1. Get active settings
    const activeSettings = await this.prisma.schoolAcademicSettings.findFirst({
      where: { tenantId, schoolYearId: academicYearId, status: 'ACTIVE' },
    });
    if (!activeSettings) {
      throw new BadRequestException(
        "Aucun paramétrage académique actif trouvé pour cette année scolaire. Veuillez l'activer dans les Paramètres.",
      );
    }

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

    // 2. Fetch students
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { classId, tenantId, academicYearId },
      include: { student: true },
    });

    // 3. Fetch class subjects
    const classSubjects = await this.prisma.classSubject.findMany({
      where: { classId, tenantId, academicYearId },
      include: { subject: true },
    });

    // 4. Fetch validated scores
    const scores = await this.prisma.examScore.findMany({
      where: {
        tenantId,
        academicYearId,
        isValidated: true,
        exam: {
          classId,
          quarterId: periodId,
        },
      },
      include: {
        exam: true,
      },
    });

    const studentsList: any[] = [];

    // 5. Compute for each student
    for (const enrollment of enrollments) {
      const subjectAverages: Record<string, number> = {};
      const frontendSubjectAverages: Record<string, number> = {};
      const generalAvgInput: any[] = [];

      for (const cs of classSubjects) {
        const studentSubjScores = scores.filter(
          (s) => s.studentId === enrollment.studentId && s.subjectId === cs.subjectId,
        );

        const assessmentScores: Record<string, number> = {};
        studentSubjScores.forEach((s) => {
          if (assessmentScores[s.exam.examType] !== undefined) {
            assessmentScores[s.exam.examType] =
              (assessmentScores[s.exam.examType] + s.score) / 2;
          } else {
            assessmentScores[s.exam.examType] = s.score;
          }
        });

        // Fill missing scores with 0 if required
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

      const generalAverage = this.rulesEngine.evaluateGeneralAverage(generalAvgInput);

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

    // 7. Persist rankings in the DB
    for (const s of studentsList) {
      const existingRanking = await this.prisma.ranking.findFirst({
        where: {
          tenantId,
          academicYearId,
          schoolLevelId: s.enrollment.schoolLevelId,
          rankingType: 'CLASS',
          classId,
          quarterId: periodId,
          studentId: s.studentId,
        },
      });

      if (existingRanking) {
        await this.prisma.ranking.update({
          where: { id: existingRanking.id },
          data: {
            average: s.generalAverage,
            rank: s.rank,
            totalStudents: enrollments.length,
          },
        });
      } else {
        await this.prisma.ranking.create({
          data: {
            tenantId,
            academicYearId,
            schoolLevelId: s.enrollment.schoolLevelId,
            rankingType: 'CLASS',
            classId,
            quarterId: periodId,
            studentId: s.studentId,
            average: s.generalAverage,
            rank: s.rank,
            totalStudents: enrollments.length,
          },
        });
      }
    }

    // 8. Return formatted averages
    return studentsList.map((s) => {
      const decision = this.rulesEngine.evaluatePromotion(s.generalAverage, promotionRules);

      return {
        id: s.studentId,
        student: {
          lastName: s.enrollment.student.lastName,
          firstName: s.enrollment.student.firstName,
          matricule: s.enrollment.localStudentMatricule ?? s.enrollment.student.matricule ?? null,
        },
        classRank: s.rank,
        generalAverage: Number(s.generalAverage.toFixed(decimals)),
        subjectAverages: s.frontendSubjectAverages,
        decision,
      };
    });
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

    return { success: true };
  }
}

