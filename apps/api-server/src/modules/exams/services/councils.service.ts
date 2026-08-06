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
import { PuppeteerPoolService } from '../../../common/services/puppeteer-pool.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CouncilsService {
  private readonly logger = new Logger(CouncilsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly configService: ConfigService,
  ) {}

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
            recommendations.push("Encourager l'élève à maintenir ce niveau d'excellence.");
          } else if (average >= 10) {
            observations.push(`Performances satisfaisantes avec une moyenne de ${average.toFixed(2)}/20.`);
            recommendations.push("Continuer les efforts pour améliorer les résultats dans les matières faibles.");
          } else {
            observations.push(`Performances insuffisantes avec une moyenne de ${average.toFixed(2)}/20, en dessous du seuil de réussite.`);
            recommendations.push("Mise en place d'un accompagnement renforcé et suivi individualisé.");
          }
        } else {
          if (average >= 2.5) {
            observations.push("Évaluation très satisfaisante. L'enfant maîtrise les compétences attendues.");
          } else if (average >= 1.5) {
            observations.push("Évaluation satisfaisante. L'enfant progresse bien.");
          } else {
            observations.push("Évaluation peu satisfaisante. L'enfant nécessite un accompagnement particulier.");
          }
        }
      }

      // Attendance observations
      if (attendanceRate < 75) {
        observations.push(`Taux d'assiduité préoccupant (${attendanceRate.toFixed(0)}%). L'élève a été absent ${absentTotal} fois.`);
        recommendations.push("Sensibiliser les parents sur l'importance de la régularité scolaire.");
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

  // ── Generate PV PDF (procès-verbal) — Backend Puppeteer ──────────────────
  async generateMinutesPdf(councilId: string, tenantId: string): Promise<Buffer> {
    // 1. Gather all data
    const council = await this.getCouncilDetails(councilId, tenantId);
    const aiAnalysis = await this.getAIAnalysis(councilId, tenantId);
    const branding = await this.getTenantBranding(tenantId);

    // 2. Build decisions table
    const decisionRows = council.students.map((s: any) => {
      const ai = aiAnalysis.analyses.find((a: any) => a.studentId === s.id);
      const dec = s.decision;
      const decisionLabel = dec
        ? this.getDecisionLabel(dec.decision)
        : (ai ? this.getDecisionLabel(ai.suggestedDecision) : '—');
      const avg = ai?.average !== null && ai?.average !== undefined
        ? (ai.isMaternelle
          ? (ai.average >= 2.5 ? 'TS' : ai.average >= 1.5 ? 'S' : 'PS')
          : ai.average.toFixed(2) + '/20')
        : '—';
      const attendance = ai ? `${ai.attendanceRate.toFixed(0)}%` : '—';
      const appreciation = dec?.appreciation || ai?.appreciation || '—';
      const recommendation = dec?.recommendation || ai?.recommendation || '—';

      return `<tr>
        <td style="border:1px solid #cbd5e1;padding:4px 6px;font-size:10px;font-weight:600;">${s.lastName} ${s.firstName}</td>
        <td style="border:1px solid #cbd5e1;padding:4px 6px;text-align:center;font-size:10px;font-weight:bold;color:${ai && !ai.isMaternelle && ai.average >= 10 ? '#059669' : '#dc2626'};">${avg}</td>
        <td style="border:1px solid #cbd5e1;padding:4px 6px;text-align:center;font-size:10px;">${attendance}</td>
        <td style="border:1px solid #cbd5e1;padding:4px 6px;text-align:center;font-size:10px;font-weight:bold;">${decisionLabel}</td>
        <td style="border:1px solid #cbd5e1;padding:4px 6px;font-size:9px;color:#475569;">${appreciation}</td>
        <td style="border:1px solid #cbd5e1;padding:4px 6px;font-size:9px;color:#475569;">${recommendation}</td>
      </tr>`;
    }).join('');

    // 3. Build HTML (same official header as class-list-pdf)
    const html = this.buildPvHtml({
      council, aiAnalysis, branding, decisionRows,
    });

    // 4. Generate PDF via Puppeteer
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' },
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  private getDecisionLabel(decision: string): string {
    const labels: Record<string, string> = {
      PROMOTED: 'Promu(e)',
      ENCOURAGEMENT: 'Encouragement',
      HONOR_ROLL: 'Félicitations',
      WARNING: 'Avertissement',
      CONDITIONAL_PROMOTION: 'Passage conditionnel',
      REPEATED: 'Redoublement',
      TRANSFER_RECOMMENDED: 'Réorientation',
    };
    return labels[decision] || decision || '—';
  }

  private async getTenantBranding(tenantId: string) {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: { schoolName: true, logoUrl: true, address: true, phonePrimary: true, email: true, slogan: true },
      });
      if (profile?.schoolName) {
        const apiBaseUrl = this.configService.get<string>('APP_PUBLIC_URL') || 'https://api.academiahelm.com';
        return {
          schoolName: profile.schoolName,
          schoolLogo: profile.logoUrl ? `${apiBaseUrl}/api/tenants/${tenantId}/logo` : null,
          schoolAddress: profile.address,
          schoolPhone: profile.phonePrimary,
          schoolEmail: profile.email,
          schoolSlogan: profile.slogan,
        };
      }
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
      return { schoolName: tenant?.name || 'Établissement' };
    } catch {
      return { schoolName: 'Établissement' };
    }
  }

  private buildPvHtml(data: {
    council: any;
    aiAnalysis: any;
    branding: any;
    decisionRows: string;
  }): string {
    const { council, aiAnalysis, branding, decisionRows } = data;
    const ministry = "Ministère des Enseignements Maternel et Primaire";

    const beninFlagSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40" viewBox="0 0 75 50"><rect width="30" height="50" fill="#008751"/><rect x="30" width="45" height="25" fill="#FCD116"/><rect x="30" y="25" width="45" height="25" fill="#E8112D"/></svg>`;
    const beninFlag = `data:image/svg+xml;base64,${Buffer.from(beninFlagSvg).toString('base64')}`;

    const councilDate = council.councilDate
      ? new Date(council.councilDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('fr-FR');

    const pvNumber = `PV-CC-${council.id.substring(0, 8).toUpperCase()}`;
    const totalStudents = council.students?.length || 0;
    const decisionsCount = council.students?.filter((s: any) => s.decision).length || 0;

    // Class average
    const validAverages = aiAnalysis.analyses.filter((a: any) => a.average !== null);
    const classAvg = validAverages.length > 0
      ? (validAverages.reduce((sum: number, a: any) => sum + a.average, 0) / validAverages.length).toFixed(2)
      : '—';

    // Stats summary
    const honorRoll = aiAnalysis.analyses.filter((a: any) => a.suggestedDecision === 'HONOR_ROLL').length;
    const encouragement = aiAnalysis.analyses.filter((a: any) => a.suggestedDecision === 'ENCOURAGEMENT').length;
    const warnings = aiAnalysis.analyses.filter((a: any) => a.suggestedDecision === 'WARNING').length;

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>PV du Conseil de Classe — ${council.className || ''}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Times New Roman',Georgia,serif; color:#1a1a1a; font-size:11px; }
.header { margin-bottom:15px; padding-bottom:10px; border-bottom:3px double #0A2A5E; }
.header-table { width:100%; border-collapse:collapse; }
.header-table td { vertical-align:middle; padding:4px 8px; }
.header-left { text-align:center; width:15%; }
.header-center { text-align:center; width:65%; }
.header-right { text-align:center; width:20%; }
.republique { font-size:12px; font-weight:bold; text-transform:uppercase; letter-spacing:0.5px; }
.divider { margin:4px auto; width:50%; display:flex; align-items:center; justify-content:center; gap:4px; }
.divider-line { flex:1; height:1px; background:#0A2A5E; }
.divider-diamond { width:5px; height:5px; background:#0A2A5E; transform:rotate(45deg); flex-shrink:0; }
.ministere { font-size:9px; font-weight:bold; text-transform:uppercase; letter-spacing:0.3px; line-height:1.3; }
.school-name { font-size:13px; font-weight:bold; text-transform:uppercase; margin-top:4px; color:#0A2A5E; }
.school-info { font-size:8px; color:#555; margin-top:2px; font-style:italic; }
.pv-title { text-align:center; background:#0A2A5E; color:white; padding:6px 12px; border-radius:3px; margin:12px 0 10px; font-size:12px; font-weight:bold; text-transform:uppercase; }
.pv-meta { display:flex; justify-content:space-between; background:#f8fafc; border:1px solid #e2e8f0; border-radius:3px; padding:6px 10px; margin-bottom:10px; font-size:10px; }
.pv-meta strong { color:#0A2A5E; }
.section-title { font-size:11px; font-weight:bold; text-transform:uppercase; color:#0A2A5E; margin:12px 0 6px; border-bottom:1px solid #cbd5e1; padding-bottom:2px; }
table.decisions { width:100%; border-collapse:collapse; }
table.decisions th { background:#0A2A5E; color:white; padding:5px 6px; border:1px solid #0D3B85; font-size:9px; text-transform:uppercase; }
table.decisions td { border:1px solid #cbd5e1; padding:4px 6px; }
table.decisions tbody tr:nth-child(even) { background:#f8fafc; }
.stats-row { display:flex; gap:8px; margin:10px 0; }
.stats-card { flex:1; text-align:center; border:1px solid #e2e8f0; border-radius:4px; padding:8px; background:#f8fafc; }
.stats-card .label { font-size:8px; color:#64748b; text-transform:uppercase; font-weight:bold; }
.stats-card .value { font-size:14px; font-weight:bold; margin-top:2px; }
.attendees { margin-top:10px; font-size:10px; }
.attendee-line { display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px dotted #cbd5e1; }
.signatures { display:flex; justify-content:space-between; margin-top:25px; gap:16px; }
.sig-box { flex:1; text-align:center; }
.sig-label { font-size:9px; font-weight:bold; color:#0A2A5E; }
.sig-line { border-top:1px solid #94a3b8; margin-top:30px; padding-top:3px; font-size:7px; color:#94a3b8; }
.footer { margin-top:15px; text-align:center; font-size:7px; color:#999; border-top:1px solid #eee; padding-top:5px; }
</style>
</head>
<body>

<!-- EN-TÊTE OFFICIEL -->
<div class="header">
  <table class="header-table">
    <tr>
      <td class="header-left"><img src="${beninFlag}" alt="Drapeau du Bénin" style="width:40px;height:27px;" /></td>
      <td class="header-center">
        <div class="republique">République du Bénin</div>
        <div class="divider"><div class="divider-line"></div><div class="divider-diamond"></div><div class="divider-line"></div></div>
        <div class="ministere">${ministry}</div>
        <div class="divider"><div class="divider-line"></div><div class="divider-diamond"></div><div class="divider-line"></div></div>
        <div class="school-name">${branding.schoolName}</div>
        <div class="school-info">${branding.schoolSlogan ? `« ${branding.schoolSlogan} » · ` : ''}${branding.schoolAddress || ''} · Tél: ${branding.schoolPhone || ''} · ${branding.schoolEmail || ''}</div>
      </td>
      <td class="header-right">${branding.schoolLogo ? `<img src="${branding.schoolLogo}" style="max-width:50px;max-height:50px;object-fit:contain;" />` : ''}</td>
    </tr>
  </table>
</div>

<!-- TITRE PV -->
<div class="pv-title">Procès-Verbal du Conseil de Classe</div>

<!-- MÉTADONNÉES -->
<div class="pv-meta">
  <div>N° PV: <strong>${pvNumber}</strong></div>
  <div>Classe: <strong>${council.className || '—'}</strong></div>
  <div>Période: <strong>${council.periodName || '—'}</strong></div>
  <div>Date: <strong>${councilDate}</strong></div>
</div>

<!-- OUVERTURE -->
<div class="section-title">Ouverture de la séance</div>
<p style="font-size:10px;line-height:1.5;text-align:justify;">
Le conseil de classe de la classe de <strong>${council.className || '—'}</strong> pour la période de <strong>${council.periodName || '—'}</strong>
s'est tenu le <strong>${councilDate}</strong> dans la salle de réunion de l'établissement
<em>${branding.schoolName}</em>, sous la présidence de
<strong>${council.chairFirstName ? council.chairFirstName + ' ' + council.chairLastName : 'le Directeur / la Directrice'}</strong>.
Étaient présents les membres du conseil de classe ci-après désignés. Le quorum étant atteint,
la séance est ouverte à l'heure prévue.
</p>

<!-- MEMBRES PRÉSENTS -->
<div class="section-title">Membres présents</div>
<div class="attendees">
  <div class="attendee-line"><span>1. Le/La Directeur(trice) — Président(e) du conseil</span><span style="color:#94a3b8;">Signature</span></div>
  <div class="attendee-line"><span>2. Le/La Titulaire de la classe — ${council.className || '—'}</span><span style="color:#94a3b8;">Signature</span></div>
  <div class="attendee-line"><span>3. Les enseignants de la classe</span><span style="color:#94a3b8;">Signatures</span></div>
  <div class="attendee-line"><span>4. Le/La Censeur / Surveillant(e) général(e)</span><span style="color:#94a3b8;">Signature</span></div>
</div>

<!-- STATISTIQUES -->
<div class="section-title">Statistiques de la classe</div>
<div class="stats-row">
  <div class="stats-card"><div class="label">Effectif</div><div class="value" style="color:#334155;">${totalStudents}</div></div>
  <div class="stats-card"><div class="label">Moy. classe</div><div class="value" style="color:#0A2A5E;">${classAvg}${classAvg !== '—' ? '/20' : ''}</div></div>
  <div class="stats-card"><div class="label">Félicitations</div><div class="value" style="color:#7c3aed;">${honorRoll}</div></div>
  <div class="stats-card"><div class="label">Encouragements</div><div class="value" style="color:#2563eb;">${encouragement}</div></div>
  <div class="stats-card"><div class="label">Avertissements</div><div class="value" style="color:#dc2626;">${warnings}</div></div>
</div>

<!-- DÉLIBÉRATIONS -->
<div class="section-title">Délibérations par élève</div>
<p style="font-size:9px;color:#64748b;margin-bottom:6px;">
Le conseil a examiné les résultats de chaque élève sur la base des notes obtenues aux évaluations,
de l'assiduité et du comportement général. Les observations et recommandations de l'analyse
pédagogique automatique (ORION) ont été prises en compte. Les décisions du conseil sont les suivantes :
</p>
<table class="decisions">
  <thead>
    <tr>
      <th style="text-align:left;">Nom et Prénom(s)</th>
      <th style="width:55px;">Moyenne</th>
      <th style="width:45px;">Assid.</th>
      <th style="width:90px;">Décision</th>
      <th>Observations</th>
      <th>Recommandations</th>
    </tr>
  </thead>
  <tbody>
    ${decisionRows}
  </tbody>
</table>

<!-- CLÔTURE -->
<div class="section-title">Clôture de la séance</div>
<p style="font-size:10px;line-height:1.5;text-align:justify;">
Les décisions du conseil ont été prises à l'unanimité des membres présents. Le procès-verbal
est dressé pour servir et valoir ce que de droit. La séance est levée à l'heure prévue.
</p>

<!-- SIGNATURES -->
<div class="signatures">
  <div class="sig-box">
    <div class="sig-label">Le/La Titulaire</div>
    <div class="sig-line">Signature</div>
  </div>
  <div class="sig-box">
    <div class="sig-label">Le/La Censeur</div>
    <div class="sig-line">Signature</div>
  </div>
  <div class="sig-box">
    <div class="sig-label">Le/La Directeur(trice)</div>
    <div class="sig-line">Signature et Cachet</div>
  </div>
</div>

<!-- PIED DE PAGE -->
<div class="footer">
  Document généré par Academia Helm — ${new Date().toLocaleDateString('fr-FR')} — ${pvNumber}
</div>

</body>
</html>`;
  }
}
