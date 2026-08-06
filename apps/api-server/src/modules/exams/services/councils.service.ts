/**
 * ============================================================================
 * COUNCILS SERVICE - MODULE 3
 * ============================================================================
 *
 * Gestion des Conseils de Classe et des décisions pédagogiques.
 *
 * Fonctionnalités :
 *   - CRUD complet des conseils de classe
 *   - Décisions par élève (promotion, redoublement, encouragement, etc.)
 *   - Analyse IA (ORION) : analyse automatique des performances + assiduité
 *   - Génération de PV (procès-verbal)
 *
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class CouncilsService {
  private readonly logger = new Logger(CouncilsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── List councils (with filters) ──────────────────────────────────────────
  async getCouncils(tenantId: string, academicYearId: string, periodId?: string, classId?: string) {
    const where: any = { tenantId, academicYearId };
    if (periodId) where.periodId = periodId;
    if (classId) where.classId = classId;

    return this.prisma.$queryRawUnsafe<any[]>(`
      SELECT cc.*, c.name AS "className", ap.name AS "periodName",
             u."firstName" AS "chairFirstName", u."lastName" AS "chairLastName",
             (SELECT COUNT(*) FROM student_council_decisions scd WHERE scd."councilId" = cc.id) AS "decisionCount"
      FROM class_councils cc
      LEFT JOIN classes c ON c.id = cc."classId"
      LEFT JOIN academic_periods ap ON ap.id = cc."periodId"
      LEFT JOIN users u ON u.id = cc."chairedById"
      WHERE cc."tenantId" = $1 AND cc."academicYearId" = $2
      ${periodId ? 'AND cc."periodId" = $3' : ''}
      ${classId ? `AND cc."classId" = ${periodId ? '$4' : '$3'}` : ''}
      ORDER BY cc."councilDate" DESC
    `, ...[tenantId, academicYearId, ...(periodId ? [periodId] : []), ...(classId ? [classId] : [])].filter(Boolean));
  }

  // ── Create a council ──────────────────────────────────────────────────────
  async createCouncil(tenantId: string, data: any) {
    const id = require('crypto').randomUUID();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO class_councils (id, "tenantId", "academicYearId", "periodId", "classId",
        title, "councilDate", status, "chairedById", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'PLANNED', $8, NOW(), NOW())
    `, id, tenantId, data.academicYearId, data.periodId, data.classId,
      data.title || 'Conseil de classe', new Date(data.councilDate), data.chairedById || null);

    return { id, ...data, status: 'PLANNED' };
  }

  // ── Get council details with decisions + student data ─────────────────────
  async getCouncilDetails(councilId: string, tenantId: string) {
    const councils = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT cc.*, c.name AS "className", c."schoolLevelId",
             ap.name AS "periodName", ap.id AS "periodId",
             u."firstName" AS "chairFirstName", u."lastName" AS "chairLastName"
      FROM class_councils cc
      LEFT JOIN classes c ON c.id = cc."classId"
      LEFT JOIN academic_periods ap ON ap.id = cc."periodId"
      LEFT JOIN users u ON u.id = cc."chairedById"
      WHERE cc.id = $1 AND cc."tenantId" = $2
    `, councilId, tenantId);

    if (!councils || councils.length === 0) {
      throw new NotFoundException('Conseil de classe introuvable');
    }
    const council = councils[0];

    // Get existing decisions
    const decisions = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT scd.*, s."firstName", s."lastName", s.matricule, s.gender,
             u."firstName" AS "deciderFirstName", u."lastName" AS "deciderLastName"
      FROM student_council_decisions scd
      LEFT JOIN students s ON s.id = scd."studentId"
      LEFT JOIN users u ON u.id = scd."decidedById"
      WHERE scd."councilId" = $1
      ORDER BY s."lastName", s."firstName"
    `, councilId).catch(() => []);

    // Get enrolled students for this class
    const students = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT s.id, s."firstName", s."lastName", s.matricule, s.gender
      FROM student_enrollments se
      JOIN students s ON s.id = se."studentId"
      WHERE se."classId" = $1 AND se."tenantId" = $2 AND se."academicYearId" = $3
        AND se.status IN ('ACTIVE', 'ADMITTED', 'ENROLLED', 'CONFIRMED')
      ORDER BY s."lastName", s."firstName"
    `, council.classId, tenantId, council.academicYearId).catch(() => []);

    // Map decisions to students
    const decisionMap = new Map<string, any>();
    for (const d of (decisions || [])) {
      decisionMap.set(d.studentId, d);
    }

    council.students = students.map((s: any) => ({
      ...s,
      decision: decisionMap.get(s.id) || null,
    }));

    return council;
  }

  // ── Save/update a student decision ────────────────────────────────────────
  async saveDecision(tenantId: string, councilId: string, studentId: string, data: any) {
    const id = require('crypto').randomUUID();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO student_council_decisions (id, "tenantId", "councilId", "studentId",
        decision, appreciation, recommendation, sanctions, "decidedById", "decidedAt", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW())
      ON CONFLICT ("tenantId", "councilId", "studentId") DO UPDATE SET
        decision = $5, appreciation = $6, recommendation = $7, sanctions = $8,
        "decidedById" = $9, "decidedAt" = NOW(), "updatedAt" = NOW()
    `, id, tenantId, councilId, studentId,
      data.decision || 'PROMOTED', data.appreciation || null,
      data.recommendation || null, data.sanctions || null, data.userId || null);

    return { success: true, councilId, studentId, decision: data.decision };
  }

  // ── Start council (PLANNED → IN_PROGRESS) ─────────────────────────────────
  async startCouncil(councilId: string) {
    await this.prisma.$executeRawUnsafe(`
      UPDATE class_councils SET status = 'IN_PROGRESS', "updatedAt" = NOW() WHERE id = $1
    `, councilId);
    return { id: councilId, status: 'IN_PROGRESS' };
  }

  // ── Close council (IN_PROGRESS → COMPLETED) ───────────────────────────────
  async closeCouncil(councilId: string) {
    await this.prisma.$executeRawUnsafe(`
      UPDATE class_councils SET status = 'COMPLETED', "updatedAt" = NOW() WHERE id = $1
    `, councilId);
    return { id: councilId, status: 'COMPLETED' };
  }

  // ── AI Analysis: Generate performance + attendance analysis per student ────
  // ⭐ Uses the same data pattern as bulletins (institutionalExamsService)
  async getAIAnalysis(councilId: string, tenantId: string) {
    // 1. Get council details
    const councils = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT cc."classId", cc."academicYearId", cc."periodId",
             c.name AS "className", sl.code AS "schoolLevelCode"
      FROM class_councils cc
      LEFT JOIN classes c ON c.id = cc."classId"
      LEFT JOIN school_levels sl ON sl.id = c."schoolLevelId"
      WHERE cc.id = $1 AND cc."tenantId" = $2
    `, councilId, tenantId);

    if (!councils || councils.length === 0) {
      throw new NotFoundException('Conseil introuvable');
    }
    const council = councils[0];
    const isMaternelle = council.schoolLevelCode === 'MATERNELLE';

    // 2. Get all VALIDATED evaluations for this class + period
    const evaluations = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT e.id, e."subjectId", e."evaluationTypeId",
             s."name" AS "subjectName", s.language AS "subjectLanguage",
             et.code AS "evalTypeCode", et.name AS "evalTypeName"
      FROM evaluations e
      LEFT JOIN subjects s ON s.id = e."subjectId"
      LEFT JOIN evaluation_types et ON et.id = e."evaluationTypeId"
      WHERE e."classId" = $1 AND e."tenantId" = $2 AND e."academicYearId" = $3
        AND e."periodId" = $4 AND e.status = 'VALIDATED'
    `, council.classId, tenantId, council.academicYearId, council.periodId).catch(() => []);

    // 3. Get grades for each evaluation
    const evalGradesMap = new Map<string, any[]>();
    for (const ev of evaluations) {
      const grades = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT g."studentId", g.score, g."qualitativeCode", g."isAbsent"
        FROM grades g WHERE g."evaluationId" = $1 AND g."tenantId" = $2
      `, ev.id, tenantId).catch(() => []);
      evalGradesMap.set(ev.id, grades);
    }

    // 4. Get attendance records for this period
    const attendanceRecords = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT ar."studentId", ar.status, ar.notes, ar.date
      FROM attendance_records ar
      WHERE ar."tenantId" = $1
        AND ar.date >= (SELECT "startDate" FROM academic_periods WHERE id = $2)
        AND ar.date <= COALESCE((SELECT "endDate" FROM academic_periods WHERE id = $2), CURRENT_DATE)
    `, tenantId, council.periodId).catch(() => []);

    // 5. Get enrolled students
    const students = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT s.id, s."firstName", s."lastName", s.matricule, s.gender
      FROM student_enrollments se
      JOIN students s ON s.id = se."studentId"
      WHERE se."classId" = $1 AND se."tenantId" = $2 AND se."academicYearId" = $3
        AND se.status IN ('ACTIVE', 'ADMITTED', 'ENROLLED', 'CONFIRMED')
      ORDER BY s."lastName", s."firstName"
    `, council.classId, tenantId, council.academicYearId).catch(() => []);

    // 6. Compute per-student analysis
    const analyses = students.map((student: any) => {
      const studentId = student.id;

      // Grades analysis
      let totalScore = 0;
      let validSubjects = 0;
      let absentCount = 0;
      let tsCount = 0, sCount = 0, psCount = 0;
      const subjectDetails: any[] = [];

      for (const ev of evaluations) {
        const grades = evalGradesMap.get(ev.id) || [];
        const grade = grades.find((g: any) => g.studentId === studentId);
        if (!grade) continue;

        if (grade.isAbsent) {
          absentCount++;
          subjectDetails.push({ subject: ev.subjectName, status: 'Absent', score: null });
          continue;
        }

        if (isMaternelle) {
          const code = grade.qualitativeCode;
          if (code === 'TS') { tsCount++; validSubjects++; }
          else if (code === 'S') { sCount++; validSubjects++; }
          else if (code === 'PS') { psCount++; validSubjects++; }
          subjectDetails.push({ subject: ev.subjectName, status: code, score: null });
        } else {
          const score = Number(grade.score);
          if (!isNaN(score)) {
            totalScore += score;
            validSubjects++;
            subjectDetails.push({ subject: ev.subjectName, status: `${score.toFixed(2)}/20`, score });
          }
        }
      }

      // Average
      let average: number | null = null;
      if (isMaternelle && validSubjects > 0) {
        average = (tsCount * 3 + sCount * 2 + psCount * 1) / validSubjects;
      } else if (!isMaternelle && validSubjects > 0) {
        average = totalScore / validSubjects;
      }

      // Attendance analysis
      const studentAttendance = attendanceRecords.filter((a: any) => a.studentId === studentId);
      const presentCount = studentAttendance.filter((a: any) => a.status === 'PRESENT' || a.status === 'ABSENT_HALF').length;
      const absentTotal = studentAttendance.filter((a: any) => a.status === 'ABSENT' || a.status === 'ABSENT_HALF').length;
      const attendanceRate = studentAttendance.length > 0
        ? (presentCount / studentAttendance.length) * 100 : 100;

      // AI-generated observations
      const observations: string[] = [];
      const recommendations: string[] = [];

      if (average !== null) {
        if (!isMaternelle) {
          if (average >= 14) {
            observations.push(`Excellentes performances académiques avec une moyenne de ${average.toFixed(2)}/20.`);
            recommendations.push('Encourager l'élève à maintenir ce niveau d'excellence.');
          } else if (average >= 10) {
            observations.push(`Performances satisfaisantes avec une moyenne de ${average.toFixed(2)}/20.`);
            recommendations.push('Continuer les efforts pour améliorer les résultats dans les matières faibles.');
          } else {
            observations.push(`Performances insuffisantes avec une moyenne de ${average.toFixed(2)}/20, en dessous du seuil de réussite.`);
            recommendations.push('Mise en place d'un accompagnement renforcé et suivi individualisé.');
          }
        } else {
          if (average >= 2.5) {
            observations.push('Évaluation très satisfaisante. L'enfant maîtrise les compétences attendues.');
          } else if (average >= 1.5) {
            observations.push('Évaluation satisfaisante. L'enfant progresse bien.');
          } else {
            observations.push('Évaluation peu satisfaisante. L'enfant nécessite un accompagnement particulier.');
          }
        }
      }

      // Attendance observations
      if (attendanceRate < 75) {
        observations.push(`Taux d'assiduité préoccupant (${attendanceRate.toFixed(0)}%). L'élève a été absent ${absentTotal} fois.`);
        recommendations.push('Sensibiliser les parents sur l'importance de la régularité scolaire.');
      } else if (attendanceRate < 90) {
        observations.push(`Assiduité à améliorer (${attendanceRate.toFixed(0)}%). Quelques absences constatées.`);
      } else {
        observations.push(`Bonne assiduité (${attendanceRate.toFixed(0)}%).`);
      }

      // Absent in evaluations
      if (absentCount > 0) {
        observations.push(`L'élève a été absent à ${absentCount} évaluation(s) sur ${evaluations.length}.`);
      }

      // Decision suggestion
      let suggestedDecision = 'PROMOTED';
      if (average !== null) {
        if (!isMaternelle) {
          if (average >= 14) suggestedDecision = 'HONOR_ROLL';
          else if (average >= 12) suggestedDecision = 'ENCOURAGEMENT';
          else if (average >= 10) suggestedDecision = 'PROMOTED';
          else if (average >= 8) suggestedDecision = 'CONDITIONAL_PROMOTION';
          else suggestedDecision = 'WARNING';
        } else {
          if (average >= 2.5) suggestedDecision = 'ENCOURAGEMENT';
          else if (average >= 1.5) suggestedDecision = 'PROMOTED';
          else suggestedDecision = 'WARNING';
        }
      }

      // Appreciation text (auto-generated)
      let appreciation = observations.join(' ');
      let recommendation = recommendations.join(' ');

      return {
        studentId,
        studentName: `${student.lastName} ${student.firstName}`,
        matricule: student.matricule,
        gender: student.gender,
        average,
        appreciation,
        recommendation,
        suggestedDecision,
        subjectDetails,
        attendanceRate,
        absentCount,
        totalEvaluations: evaluations.length,
        validSubjects,
        isMaternelle,
        // Detailed metrics
        tsCount, sCount, psCount,
      };
    });

    return {
      councilId,
      className: council.className,
      isMaternelle,
      totalStudents: students.length,
      analyses,
    };
  }

  // ── Generate PV (procès-verbal) ───────────────────────────────────────────
  async generateMinutes(councilId: string, tenantId: string) {
    const council = await this.getCouncilDetails(councilId, tenantId);
    const aiAnalysis = await this.getAIAnalysis(councilId, tenantId);

    // Build PV content
    const pvDate = new Date().toLocaleDateString('fr-FR');
    const decisions = council.students
      .filter((s: any) => s.decision)
      .map((s: any) => ({
        studentName: `${s.firstName} ${s.lastName}`,
        decision: s.decision.decision,
        appreciation: s.decision.appreciation || '',
        recommendation: s.decision.recommendation || '',
      }));

    return {
      councilId,
      councilTitle: council.title || `Conseil de classe — ${council.className}`,
      className: council.className,
      periodName: council.periodName,
      date: pvDate,
      chairName: council.chairFirstName ? `${council.chairFirstName} ${council.chairLastName}` : '—',
      totalStudents: council.students.length,
      decisionsCount: decisions.length,
      decisions,
      aiSummary: aiAnalysis.analyses.map((a: any) => ({
        studentName: a.studentName,
        average: a.average,
        appreciation: a.appreciation,
        recommendation: a.recommendation,
        suggestedDecision: a.suggestedDecision,
      })),
    };
  }
}
