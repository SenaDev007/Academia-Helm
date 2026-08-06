/**
 * ============================================================================
 * COUNCILS SERVICE - MODULE 3
 * ============================================================================
 *
 * Gestion des Conseils de Classe et des décisions pédagogiques.
 *
 * Fonctionnalités :
 *   - CRUD complet des conseils de classe
 *   - ⭐ Création GLOBALE : un conseil pour TOUTES les classes d'un niveau
 *     scolaire (tous les enseignants de ces classes voient le conseil dans
 *     leur UI)
 *   - Décisions par élève (promotion, redoublement, encouragement, etc.)
 *   - Analyse IA (ORION) : analyse automatique des performances + assiduité
 *   - Génération de PV (procès-verbal)
 *
 * Schéma DB (class_councils) :
 *   id, tenantId, academicYearId, schoolLevelId, academicTrackId?,
 *   classId, quarterId?, councilDate, status, participants[], notes?,
 *   createdAt, updatedAt
 *
 * Note : la colonne s'appelle `quarterId` (référence quarters), pas `periodId`.
 * Historiquement, le service utilisait `periodId` + `academic_periods` — c'était
 * incorrect. Désormais on utilise `quarterId` + table `quarters`.
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
  async getCouncils(
    tenantId: string,
    academicYearId: string,
    quarterId?: string,
    classId?: string,
    schoolLevelId?: string,
  ) {
    const where: any = { tenantId, academicYearId };
    if (quarterId) where.quarterId = quarterId;
    if (classId) where.classId = classId;
    if (schoolLevelId) where.schoolLevelId = schoolLevelId;

    return this.prisma.classCouncil.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        schoolLevel: { select: { id: true, name: true, code: true } },
        quarter: { select: { id: true, name: true } },
        academicTrack: { select: { id: true, name: true } },
        _count: {
          select: {
            decisions: true,
            studentCouncilDecisions: true,
            minutes: true,
          },
        },
      },
      orderBy: { councilDate: 'desc' },
    });
  }

  // ── Create ONE council for a single class ──────────────────────────────────
  async createCouncil(tenantId: string, data: {
    academicYearId: string;
    schoolLevelId: string;
    classId: string;
    quarterId?: string;
    academicTrackId?: string;
    councilDate: string | Date;
    participants?: string[];
    notes?: string;
  }) {
    const council = await this.prisma.classCouncil.create({
      data: {
        tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId,
        classId: data.classId,
        quarterId: data.quarterId || null,
        academicTrackId: data.academicTrackId || null,
        councilDate: new Date(data.councilDate),
        status: 'SCHEDULED',
        participants: data.participants || [],
        notes: data.notes || null,
      },
      include: {
        class: { select: { id: true, name: true } },
        schoolLevel: { select: { id: true, name: true, code: true } },
      },
    });
    return council;
  }

  // ── ⭐ Create councils GLOBALLY for ALL classes of a school level ──────────
  // Crée un council par classe du niveau scolaire, en une seule transaction.
  // Tous les enseignants de ces classes verront le conseil dans leur UI.
  // Retourne la liste des councils créés.
  async createGlobalCouncils(tenantId: string, data: {
    academicYearId: string;
    schoolLevelId: string;
    quarterId?: string;
    academicTrackId?: string;
    councilDate: string | Date;
    participants?: string[];
    notes?: string;
  }) {
    // 1. Récupérer toutes les classes du niveau scolaire pour ce tenant + année
    const classes = await this.prisma.class.findMany({
      where: {
        tenantId,
        schoolLevelId: data.schoolLevelId,
        // On prend seulement les classes qui ont des enrollments actifs pour
        // cette année académique — évite de créer des councils pour classes vides.
        studentEnrollments: {
          some: {
            tenantId,
            academicYearId: data.academicYearId,
            status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED', 'CONFIRMED'] },
          },
        },
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    if (classes.length === 0) {
      throw new BadRequestException(
        'Aucune classe avec élèves actifs trouvée pour ce niveau scolaire et cette année.',
      );
    }

    // 2. Vérifier qu'il n'existe pas déjà un council pour les mêmes
    // (classId, quarterId, academicYearId) — éviter les doublons.
    const existingCouncils = await this.prisma.classCouncil.findMany({
      where: {
        tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId,
        quarterId: data.quarterId || null,
        classId: { in: classes.map((c) => c.id) },
      },
      select: { classId: true },
    });
    const existingClassIds = new Set(existingCouncils.map((c) => c.classId));
    const classesToCreate = classes.filter((c) => !existingClassIds.has(c.id));

    if (classesToCreate.length === 0) {
      return {
        created: [],
        skipped: classes.map((c) => ({ classId: c.id, className: c.name, reason: 'already_exists' })),
        totalClasses: classes.length,
        createdCount: 0,
        skippedCount: classes.length,
      };
    }

    // 3. Transaction atomique : créer un council par classe
    const created = await this.prisma.$transaction(
      classesToCreate.map((cls) =>
        this.prisma.classCouncil.create({
          data: {
            tenantId,
            academicYearId: data.academicYearId,
            schoolLevelId: data.schoolLevelId,
            classId: cls.id,
            quarterId: data.quarterId || null,
            academicTrackId: data.academicTrackId || null,
            councilDate: new Date(data.councilDate),
            status: 'SCHEDULED',
            participants: data.participants || [],
            notes: data.notes || null,
          },
          include: {
            class: { select: { id: true, name: true } },
          },
        }),
      ),
    );

    this.logger.log(
      `✓ Created ${created.length} global councils for schoolLevel=${data.schoolLevelId} quarter=${data.quarterId || 'none'}`,
    );

    return {
      created: created.map((c) => ({ id: c.id, classId: c.classId, className: (c as any).class?.name })),
      skipped: classes
        .filter((c) => existingClassIds.has(c.id))
        .map((c) => ({ classId: c.id, className: c.name, reason: 'already_exists' })),
      totalClasses: classes.length,
      createdCount: created.length,
      skippedCount: classes.length - created.length,
    };
  }

  // ── Get council details with decisions + student data ─────────────────────
  async getCouncilDetails(councilId: string, tenantId: string) {
    const council = await this.prisma.classCouncil.findFirst({
      where: { id: councilId, tenantId },
      include: {
        class: { select: { id: true, name: true, schoolLevelId: true } },
        schoolLevel: { select: { id: true, name: true, code: true } },
        quarter: { select: { id: true, name: true } },
        academicTrack: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
      },
    });

    if (!council) {
      throw new NotFoundException('Conseil de classe introuvable');
    }

    // Get existing decisions
    const decisions = await this.prisma.studentCouncilDecision.findMany({
      where: { councilId, tenantId },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, matricule: true, gender: true },
        },
      },
      orderBy: { student: { lastName: 'asc' } },
    }).catch(() => []);

    // Get enrolled students for this class
    const students = await this.prisma.studentEnrollment.findMany({
      where: {
        classId: council.classId,
        tenantId,
        academicYearId: council.academicYearId,
        status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED', 'CONFIRMED'] },
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, matricule: true, gender: true },
        },
      },
      orderBy: { student: { lastName: 'asc' } },
    }).catch(() => []);

    // Map decisions to students
    const decisionMap = new Map<string, any>();
    for (const d of (decisions as any[])) {
      decisionMap.set(d.studentId, d);
    }

    return {
      ...council,
      students: students.map((se: any) => ({
        id: se.student.id,
        firstName: se.student.firstName,
        lastName: se.student.lastName,
        matricule: se.student.matricule,
        gender: se.student.gender,
        decision: decisionMap.get(se.student.id) || null,
      })),
    };
  }

  // ── Save/update a student decision ────────────────────────────────────────
  async saveDecision(
    tenantId: string,
    councilId: string,
    studentId: string,
    data: {
      decision?: string;
      appreciation?: string;
      recommendation?: string;
      sanctions?: string;
      userId?: string;
    },
  ) {
    // Upsert : if a decision already exists for (tenantId, councilId, studentId), update it.
    const existing = await this.prisma.studentCouncilDecision.findFirst({
      where: { tenantId, councilId, studentId },
    });

    if (existing) {
      const updated = await this.prisma.studentCouncilDecision.update({
        where: { id: existing.id },
        data: {
          decision: data.decision || 'PROMOTED',
          appreciation: data.appreciation || null,
          recommendation: data.recommendation || null,
          sanctions: data.sanctions || null,
          decidedById: data.userId || null,
          decidedAt: new Date(),
        },
      });
      return { success: true, councilId, studentId, decision: updated.decision, updated: true };
    }

    const created = await this.prisma.studentCouncilDecision.create({
      data: {
        tenantId,
        councilId,
        studentId,
        decision: data.decision || 'PROMOTED',
        appreciation: data.appreciation || null,
        recommendation: data.recommendation || null,
        sanctions: data.sanctions || null,
        decidedById: data.userId || null,
        decidedAt: new Date(),
      },
    });
    return { success: true, councilId, studentId, decision: created.decision, created: true };
  }

  // ── Start council (SCHEDULED → IN_PROGRESS) ───────────────────────────────
  async startCouncil(councilId: string, tenantId: string) {
    const updated = await this.prisma.classCouncil.updateMany({
      where: { id: councilId, tenantId },
      data: { status: 'IN_PROGRESS' },
    });
    if (updated.count === 0) throw new NotFoundException('Conseil introuvable');
    return { id: councilId, status: 'IN_PROGRESS' };
  }

  // ── Close council (IN_PROGRESS → COMPLETED) ───────────────────────────────
  async closeCouncil(councilId: string, tenantId: string) {
    const updated = await this.prisma.classCouncil.updateMany({
      where: { id: councilId, tenantId },
      data: { status: 'COMPLETED' },
    });
    if (updated.count === 0) throw new NotFoundException('Conseil introuvable');
    return { id: councilId, status: 'COMPLETED' };
  }

  // ── AI Analysis: Generate performance + attendance analysis per student ────
  async getAIAnalysis(councilId: string, tenantId: string) {
    const council = await this.prisma.classCouncil.findFirst({
      where: { id: councilId, tenantId },
      include: {
        class: { select: { id: true, name: true, schoolLevelId: true } },
        schoolLevel: { select: { code: true } },
      },
    });
    if (!council) throw new NotFoundException('Conseil introuvable');

    const isMaternelle = council.schoolLevel?.code === 'MATERNELLE';

    // 2. Get all VALIDATED evaluations for this class + year
    // Note: Evaluation.periodId references AcademicPeriod, ClassCouncil.quarterId
    // references Quarter — they're parallel concepts in different tables.
    // For the AI analysis, we use classId + academicYearId + status=VALIDATED
    // (all evaluations for the year, regardless of trimester).
    const evaluations = await this.prisma.evaluation.findMany({
      where: {
        classId: council.classId,
        tenantId,
        academicYearId: council.academicYearId,
        status: 'VALIDATED',
      },
      include: {
        subject: { select: { id: true, name: true, language: true } },
        evaluationType: { select: { code: true, name: true } },
      },
    }).catch(() => []);

    // 3. Get grades for each evaluation
    const evalGradesMap = new Map<string, any[]>();
    for (const ev of evaluations) {
      const grades = await this.prisma.grade.findMany({
        where: { evaluationId: ev.id, tenantId },
        select: { studentId: true, score: true, qualitativeCode: true, isAbsent: true },
      }).catch(() => []);
      evalGradesMap.set(ev.id, grades);
    }

    // 4. Get attendance records for this quarter
    let attendanceRecords: any[] = [];
    if (council.quarterId) {
      const quarter = await this.prisma.quarter.findUnique({
        where: { id: council.quarterId },
        select: { startDate: true, endDate: true },
      }).catch(() => null);
      if (quarter) {
        attendanceRecords = await this.prisma.attendanceRecord.findMany({
          where: {
            tenantId,
            classId: council.classId,
            date: {
              gte: quarter.startDate,
              lte: quarter.endDate || new Date(),
            },
          },
          select: { studentId: true, status: true, notes: true, date: true },
        }).catch(() => []);
      }
    }

    // 5. Get enrolled students
    const students = await this.prisma.studentEnrollment.findMany({
      where: {
        classId: council.classId,
        tenantId,
        academicYearId: council.academicYearId,
        status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED', 'CONFIRMED'] },
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, matricule: true, gender: true },
        },
      },
      orderBy: { student: { lastName: 'asc' } },
    }).catch(() => []);

    // 6. Compute per-student analysis
    const analyses = students.map((se: any) => {
      const student = se.student;
      const studentId = student.id;

      // Grades analysis
      let totalScore = 0;
      let validSubjects = 0;
      let absentCount = 0;
      const subjectsBreakdown: any[] = [];

      for (const ev of evaluations) {
        const grades = evalGradesMap.get(ev.id) || [];
        const grade = grades.find((g) => g.studentId === studentId);
        if (!grade) continue;

        if (isMaternelle) {
          // Maternelle : qualitative grading (TS/S/PS)
          subjectsBreakdown.push({
            subject: ev.subject?.name,
            qualitativeCode: grade.qualitativeCode,
            isAbsent: grade.isAbsent,
          });
          if (grade.qualitativeCode) validSubjects++;
        } else {
          // Primaire/Secondaire : numeric /20
          if (grade.isAbsent) {
            absentCount++;
            continue;
          }
          if (grade.score != null) {
            totalScore += Number(grade.score);
            validSubjects++;
            subjectsBreakdown.push({
              subject: ev.subject?.name,
              score: Number(grade.score),
              isAbsent: false,
            });
          }
        }
      }

      const average = validSubjects > 0 && !isMaternelle ? totalScore / validSubjects : null;

      // Attendance analysis
      const studentAttendance = attendanceRecords.filter((a) => a.studentId === studentId);
      const absentDays = studentAttendance.filter((a) => a.status === 'ABSENT').length;
      const lateDays = studentAttendance.filter((a) => a.status === 'LATE').length;
      const justifiedAbsences = studentAttendance.filter((a) => a.status === 'JUSTIFIED').length;

      // Recommendation logic
      let recommendation = 'PROMOTED';
      let appreciation = 'SATISFACTOR';
      if (!isMaternelle && average != null) {
        if (average >= 14) { recommendation = 'PROMOTED'; appreciation = 'EXCELLENT'; }
        else if (average >= 10) { recommendation = 'PROMOTED'; appreciation = 'SATISFACTOR'; }
        else if (average >= 8) { recommendation = 'REDOUBLMENT_RISK'; appreciation = 'INSUFFISANT'; }
        else { recommendation = 'REDOUBLMENT'; appreciation = 'INSUFFISANT'; }
      }

      return {
        student,
        isMaternelle,
        average,
        validSubjects,
        absentCount,
        attendance: {
          totalRecords: studentAttendance.length,
          absentDays,
          lateDays,
          justifiedAbsences,
        },
        subjectsBreakdown,
        recommendation,
        appreciation,
      };
    });

    return {
      council: {
        id: council.id,
        className: council.class?.name,
        schoolLevelCode: council.schoolLevel?.code,
      },
      isMaternelle,
      totalStudents: analyses.length,
      analyses,
    };
  }

  // ── Delete a council ──────────────────────────────────────────────────────
  async deleteCouncil(councilId: string, tenantId: string) {
    // Cascade delete via Prisma relations (CouncilDecision, StudentCouncilDecision, CouncilMinute)
    const deleted = await this.prisma.classCouncil.deleteMany({
      where: { id: councilId, tenantId },
    });
    if (deleted.count === 0) throw new NotFoundException('Conseil introuvable');
    return { success: true, id: councilId };
  }

  // ── Update council (date, status, notes, participants) ────────────────────
  async updateCouncil(councilId: string, tenantId: string, data: {
    councilDate?: string | Date;
    status?: string;
    notes?: string;
    participants?: string[];
    quarterId?: string;
  }) {
    const updateData: any = {};
    if (data.councilDate) updateData.councilDate = new Date(data.councilDate);
    if (data.status) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.participants) updateData.participants = data.participants;
    if (data.quarterId !== undefined) updateData.quarterId = data.quarterId || null;

    const updated = await this.prisma.classCouncil.updateMany({
      where: { id: councilId, tenantId },
      data: updateData,
    });
    if (updated.count === 0) throw new NotFoundException('Conseil introuvable');
    return this.prisma.classCouncil.findUnique({
      where: { id: councilId },
      include: {
        class: { select: { id: true, name: true } },
        schoolLevel: { select: { id: true, name: true, code: true } },
      },
    });
  }

  // ── Generate PV (Procès-Verbal) PDF via Puppeteer ─────────────────────────
  async generatePV(councilId: string, tenantId: string) {
    const council = await this.getCouncilDetails(councilId, tenantId);

    const analysis = await this.getAIAnalysis(councilId, tenantId).catch(() => null);

    const html = this.buildPVHtml(council, analysis);
    const pdfBuffer = await this.puppeteerPool.renderHtmlToPdf(html, {
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    });

    return {
      pdf: pdfBuffer,
      filename: `PV_conseil_${council.class?.name || council.id}.pdf`,
    };
  }

  private buildPVHtml(council: any, analysis: any): string {
    const students = council.students || [];
    const schoolName = 'Academia Helm';
    const className = council.class?.name || '—';
    const councilDate = new Date(council.councilDate).toLocaleDateString('fr-FR');

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Procès-verbal — Conseil de classe ${className}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; padding: 0; margin: 0; }
    .header { background: #0A2A5E; color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .header h2 { margin: 4px 0 0; font-size: 16px; font-weight: 400; opacity: 0.9; }
    .meta { padding: 16px 24px; background: #f8fafc; border-bottom: 2px solid #CFA63A; }
    .meta-row { display: flex; justify-content: space-between; font-size: 12px; margin: 2px 0; }
    .meta-row strong { color: #0A2A5E; }
    .content { padding: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #0A2A5E; color: white; padding: 8px 6px; text-align: left; }
    td { padding: 6px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) { background: #f9fafb; }
    .decision-PROMOTED { color: #047857; font-weight: 600; }
    .decision-REDOUBLMENT { color: #b91c1c; font-weight: 600; }
    .decision-REDOUBLMENT_RISK { color: #d97706; font-weight: 600; }
    .footer { margin-top: 32px; padding: 16px 24px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>PROCÈS-VERBAL DU CONSEIL DE CLASSE</h1>
    <h2>${schoolName} — Classe ${className}</h2>
  </div>
  <div class="meta">
    <div class="meta-row"><span>Date du conseil : <strong>${councilDate}</strong></span><span>Statut : <strong>${council.status}</strong></span></div>
    <div class="meta-row"><span>Niveau : <strong>${council.schoolLevel?.name || '—'}</strong></span><span>Trimestre : <strong>${council.quarter?.name || '—'}</strong></span></div>
  </div>
  <div class="content">
    <h3 style="margin: 0 0 12px; color: #0A2A5E; font-size: 14px;">Décisions par élève (${students.length})</h3>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Élève</th>
          <th>Matricule</th>
          <th>Moyenne</th>
          <th>Assiduité</th>
          <th>Décision</th>
          <th>Appréciation</th>
        </tr>
      </thead>
      <tbody>
        ${students.map((s: any, i: number) => {
          const d = s.decision || {};
          const a = analysis?.analyses?.find((x: any) => x.student?.id === s.id) || {};
          const avg = a.average != null ? a.average.toFixed(2) + '/20' : '—';
          const abs = a.attendance ? `${a.attendance.absentDays} abs` : '—';
          return `
            <tr>
              <td>${i + 1}</td>
              <td>${s.lastName || ''} ${s.firstName || ''}</td>
              <td>${s.matricule || '—'}</td>
              <td>${avg}</td>
              <td>${abs}</td>
              <td class="decision-${d.decision || 'PROMOTED'}">${d.decision || '—'}</td>
              <td>${d.appreciation || a.appreciation || '—'}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>
  <div class="footer">
    Document généré le ${new Date().toLocaleString('fr-FR')} — Academia Helm
  </div>
</body>
</html>`;
  }
}
