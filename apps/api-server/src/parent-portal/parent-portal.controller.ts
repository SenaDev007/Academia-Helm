/**
 * ============================================================================
 * PARENT PORTAL — Controller
 * ============================================================================
 *
 * Endpoints pour le portail parent :
 *   GET  /parent/children          — Liste des enfants du parent
 *   GET  /parent/children/:id       — Détail d'un enfant (infos + assiduité + scolarité)
 *   GET  /parent/payments/:studentId — Paiements + solde d'un enfant (StudentAccount)
 *   GET  /parent/attendance/:studentId — Assiduité d'un enfant
 *   GET  /parent/today/:studentId   — Suivi journalier (présence + cours + devoirs)
 *   GET  /parent/homeworks/:studentId — Devoirs d'un enfant
 *   GET  /parent/cahier-journal/:classId — Cahier journal validé de la classe
 *   GET  /parent/results/:studentId   — Bulletins/Résultats d'un enfant (ReportCard)
 * ============================================================================
 */

import {
  Controller, Get, Param, Query, Res, BadRequestException,
  NotFoundException, Logger,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../database/prisma.service';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { Response } from 'express';

@Controller('parent')
@Public()
export class ParentPortalController {
  private readonly logger = new Logger(ParentPortalController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Résoudre l'ID du guardian depuis l'userId du parent connecté.
   * Le parent se connecte avec son User (email/téléphone), mais ses enfants
   * sont liés via la table student_guardians (guardianId).
   * On cherche par email ou téléphone matching.
   */
  private async resolveGuardianId(tenantId: string, parentId: string): Promise<string | null> {
    // 1. Vérifier si parentId est déjà un guardianId
    const directGuardian: any = await this.prisma.$queryRawUnsafe(
      `SELECT "id" FROM "guardians" WHERE "id" = $1 AND "tenantId" = $2 LIMIT 1`,
      parentId, tenantId,
    ).catch(() => []);
    if (directGuardian && directGuardian.length > 0) return directGuardian[0].id;

    // 2. Chercher par User → email/téléphone → Guardian
    const user: any = await this.prisma.$queryRawUnsafe(
      `SELECT "email", "phone" FROM "users" WHERE "id" = $1 AND "tenantId" = $2 LIMIT 1`,
      parentId, tenantId,
    ).catch(() => []);

    if (user && user.length > 0) {
      const u = user[0];
      // Chercher guardian par email
      if (u.email) {
        const guardianByEmail: any = await this.prisma.$queryRawUnsafe(
          `SELECT "id" FROM "guardians" WHERE "email" = $1 AND "tenantId" = $2 LIMIT 1`,
          u.email, tenantId,
        ).catch(() => []);
        if (guardianByEmail && guardianByEmail.length > 0) return guardianByEmail[0].id;
      }
      // Chercher guardian par téléphone
      if (u.phone) {
        const guardianByPhone: any = await this.prisma.$queryRawUnsafe(
          `SELECT "id" FROM "guardians" WHERE "phone" = $1 AND "tenantId" = $2 LIMIT 1`,
          u.phone, tenantId,
        ).catch(() => []);
        if (guardianByPhone && guardianByPhone.length > 0) return guardianByPhone[0].id;
      }
    }

    // 3. Fallback : retourner parentId directement (peut être un guardianId)
    return parentId;
  }

  /**
   * GET /parent/children?parentId=X&academicYearId=Y
   * Liste des enfants liés à un parent + solde scolarité.
   */
  @Get('children')
  async getChildren(
    @TenantId() tenantId: string,
    @Query('parentId') parentId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!parentId) throw new BadRequestException('parentId est requis');

    const guardianId = await this.resolveGuardianId(tenantId, parentId);

    // Récupérer les élèves liés à ce guardian
    const children: any = await this.prisma.$queryRawUnsafe(
      `SELECT s."id", s."firstName", s."lastName", s."gender", s."matricule",
              s."dateOfBirth", s."photoUrl",
              se."classId", c."name" as "className",
              sl."name" as "levelName", sl."code" as "levelCode",
              se."status" as "enrollmentStatus",
              sg."relationship", sg."isPrimary"
       FROM "students" s
       INNER JOIN "student_enrollments" se ON se."studentId" = s."id"
       INNER JOIN "student_guardians" sg ON sg."studentId" = s."id"
       LEFT JOIN "classes" c ON c."id" = se."classId"
       LEFT JOIN "school_levels" sl ON sl."id" = se."schoolLevelId"
       WHERE s."tenantId" = $1
       AND se."academicYearId" = $2
       AND se."status" IN ('ACTIVE', 'ADMITTED', 'ENROLLED', 'CONFIRMED')
       AND sg."guardianId" = $3
       ORDER BY s."lastName", s."firstName"`,
      tenantId, academicYearId, guardianId,
    ).catch(() => []);

    // Enrichir avec le solde scolarité (StudentAccount)
    const enriched = await Promise.all(
      (children || []).map(async (child: any) => {
        const account: any = await this.prisma.$queryRawUnsafe(
          `SELECT "totalDue", "totalPaid", "balance", "arrearsAmount", "status"
           FROM "student_accounts"
           WHERE "studentId" = $1 AND "tenantId" = $2 AND "academicYearId" = $3
           LIMIT 1`,
          child.id, tenantId, academicYearId,
        ).catch(() => []);

        const acc = account && account.length > 0 ? account[0] : null;

        // Enseignant titulaire
        let teacher = null;
        if (child.classId) {
          const teachers: any = await this.prisma.$queryRawUnsafe(
            `SELECT t."firstName", t."lastName", t."email", t."phone"
             FROM "teacher_class_assignments" tca
             INNER JOIN "teachers" t ON t."id" = tca."teacherId"
             WHERE tca."tenantId" = $1 AND tca."academicYearId" = $2
             AND tca."classId" = $3 LIMIT 1`,
            tenantId, academicYearId, child.classId,
          ).catch(() => []);
          if (teachers && teachers.length > 0) {
            teacher = {
              name: `${teachers[0].firstName} ${teachers[0].lastName}`.trim(),
              email: teachers[0].email,
              phone: teachers[0].phone,
            };
          }
        }

        return {
          ...child,
          teacher,
          account: acc || { totalDue: 0, totalPaid: 0, balance: 0, arrearsAmount: 0, status: 'N/A' },
        };
      }),
    );

    return enriched;
  }

  /**
   * GET /parent/children/:studentId?parentId=X&academicYearId=Y
   * Détail d'un enfant : infos + effectifs classe + assiduité + enseignant + solde.
   */
  @Get('children/:studentId')
  async getChildDetail(
    @TenantId() tenantId: string,
    @Param('studentId') studentId: string,
    @Query('parentId') parentId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    // Infos élève
    const students: any = await this.prisma.$queryRawUnsafe(
      `SELECT s."id", s."firstName", s."lastName", s."gender", s."matricule",
              s."dateOfBirth", s."photoUrl", s."placeOfBirth",
              se."classId", c."name" as "className",
              sl."name" as "levelName", sl."code" as "levelCode",
              se."status" as "enrollmentStatus"
       FROM "students" s
       INNER JOIN "student_enrollments" se ON se."studentId" = s."id"
       LEFT JOIN "classes" c ON c."id" = se."classId"
       LEFT JOIN "school_levels" sl ON sl."id" = se."schoolLevelId"
       WHERE s."id" = $1 AND s."tenantId" = $2
       AND se."academicYearId" = $3 LIMIT 1`,
      studentId, tenantId, academicYearId,
    );

    if (!students || students.length === 0) {
      throw new NotFoundException('Élève non trouvé');
    }
    const student = students[0];

    // Effectifs de la classe
    let classStats: any = null;
    if (student.classId) {
      const stats: any = await this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as "total",
           COUNT(CASE WHEN s."gender" = 'MALE' THEN 1 END)::int as "boys",
           COUNT(CASE WHEN s."gender" = 'FEMALE' THEN 1 END)::int as "girls"
         FROM "student_enrollments" se
         INNER JOIN "students" s ON s."id" = se."studentId"
         WHERE se."classId" = $1 AND se."academicYearId" = $2
         AND se."status" IN ('ACTIVE', 'ADMITTED', 'ENROLLED')`,
        student.classId, academicYearId,
      ).catch(() => []);
      classStats = stats?.[0] || null;
    }

    // Enseignant titulaire
    let teacher: any = null;
    if (student.classId) {
      const teachers: any = await this.prisma.$queryRawUnsafe(
        `SELECT t."id", t."firstName", t."lastName", t."email", t."phone"
         FROM "teacher_class_assignments" tca
         INNER JOIN "teachers" t ON t."id" = tca."teacherId"
         WHERE tca."tenantId" = $1 AND tca."academicYearId" = $2
         AND tca."classId" = $3 LIMIT 1`,
        tenantId, academicYearId, student.classId,
      ).catch(() => []);
      if (teachers?.length > 0) {
        teacher = {
          id: teachers[0].id,
          name: `${teachers[0].firstName} ${teachers[0].lastName}`.trim(),
          email: teachers[0].email,
          phone: teachers[0].phone,
        };
      }
    }

    // Résumé assiduité (ce mois)
    const attendance: any = await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as "totalDays",
         COUNT(CASE WHEN "status" = 'PRESENT' THEN 1 END)::int as "present",
         COUNT(CASE WHEN "status" = 'ABSENT' THEN 1 END)::int as "absent",
         COUNT(CASE WHEN "status" = 'LATE' THEN 1 END)::int as "late"
       FROM "attendance_records"
       WHERE "studentId" = $1 AND "tenantId" = $2
       AND "date" >= date_trunc('month', CURRENT_DATE)`,
      studentId, tenantId,
    ).catch(() => []);

    // Solde scolarité (StudentAccount)
    const account: any = await this.prisma.$queryRawUnsafe(
      `SELECT "totalDue", "totalPaid", "balance", "arrearsAmount", "status"
       FROM "student_accounts"
       WHERE "studentId" = $1 AND "tenantId" = $2 AND "academicYearId" = $3
       LIMIT 1`,
      studentId, tenantId, academicYearId,
    ).catch(() => []);

    return {
      ...student,
      classStats,
      teacher,
      attendance: attendance?.[0] || { totalDays: 0, present: 0, absent: 0, late: 0 },
      account: account?.[0] || { totalDue: 0, totalPaid: 0, balance: 0, arrearsAmount: 0, status: 'N/A' },
    };
  }

  /**
   * GET /parent/payments/:studentId?academicYearId=Y
   * Solde + historique paiements (depuis StudentAccount + FinanceTransaction).
   */
  @Get('payments/:studentId')
  async getPayments(
    @TenantId() tenantId: string,
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId est requis');

    // Solde depuis StudentAccount
    const account: any = await this.prisma.$queryRawUnsafe(
      `SELECT "totalDue", "totalPaid", "balance", "arrearsAmount", "status"
       FROM "student_accounts"
       WHERE "studentId" = $1 AND "tenantId" = $2 AND "academicYearId" = $3
       LIMIT 1`,
      studentId, tenantId, academicYearId,
    ).catch(() => []);

    const acc = account?.[0] || { totalDue: 0, totalPaid: 0, balance: 0, arrearsAmount: 0, status: 'N/A' };

    // Historique des paiements (FinanceTransaction)
    const transactions: any = await this.prisma.$queryRawUnsafe(
      `SELECT ft."id", ft."amount", ft."createdAt", ft."paymentMethod",
              ft."receiptNumber", ft."reference", ft."status", ft."notes",
              ft."type"
       FROM "finance_transactions" ft
       WHERE ft."studentId" = $1 AND ft."tenantId" = $2
       AND ft."type" = 'PAYMENT'
       ORDER BY ft."createdAt" DESC LIMIT 50`,
      studentId, tenantId,
    ).catch(() => []);

    // Fallback : anciens paiements (table payments)
    const legacyPayments: any = await this.prisma.$queryRawUnsafe(
      `SELECT p."id", p."amount", p."paymentDate", p."paymentMethod",
              p."receiptNumber", p."reference", p."status", p."notes",
              p."createdAt", p."transactionType"
       FROM "payments" p
       WHERE p."studentId" = $1 AND p."tenantId" = $2
       AND p."status" = 'completed'
       ORDER BY p."paymentDate" DESC LIMIT 50`,
      studentId, tenantId,
    ).catch(() => []);

    return {
      totalDue: acc.totalDue || 0,
      totalPaid: acc.totalPaid || 0,
      totalRemaining: acc.balance || 0,
      arrears: acc.arrearsAmount || 0,
      status: acc.status || 'N/A',
      transactions: transactions || [],
      legacyPayments: legacyPayments || [],
    };
  }

  /**
   * GET /parent/attendance/:studentId?month=YYYY-MM
   * Assiduité d'un enfant par mois.
   */
  @Get('attendance/:studentId')
  async getAttendance(
    @TenantId() tenantId: string,
    @Param('studentId') studentId: string,
    @Query('month') monthStr?: string,
  ) {
    let query = `SELECT "date", "status", "notes"
                 FROM "attendance_records"
                 WHERE "studentId" = $1 AND "tenantId" = $2`;
    const params: any[] = [studentId, tenantId];

    if (monthStr) {
      query += ` AND date_trunc('month', "date") = date_trunc('month', $3::date)`;
      params.push(monthStr);
    } else {
      query += ` AND "date" >= date_trunc('month', CURRENT_DATE)`;
    }
    query += ` ORDER BY "date" DESC LIMIT 100`;

    return this.prisma.$queryRawUnsafe(query, ...params);
  }

  /**
   * GET /parent/today/:studentId?academicYearId=Y
   * Suivi journalier : présence du jour + cours déroulés + devoirs donnés.
   */
  @Get('today/:studentId')
  async getTodaySummary(
    @TenantId() tenantId: string,
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    const today = new Date().toISOString().split('T')[0];

    // 1. Présence du jour
    const attendance: any = await this.prisma.$queryRawUnsafe(
      `SELECT "status", "notes"
       FROM "attendance_records"
       WHERE "studentId" = $1 AND "tenantId" = $2 AND "date" = $3::date
       LIMIT 1`,
      studentId, tenantId, today,
    ).catch(() => []);

    // 2. Récupérer le classId de l'élève
    const enrollment: any = await this.prisma.$queryRawUnsafe(
      `SELECT se."classId", c."name" as "className"
       FROM "student_enrollments" se
       LEFT JOIN "classes" c ON c."id" = se."classId"
       WHERE se."studentId" = $1 AND se."tenantId" = $2
       AND se."academicYearId" = $3 LIMIT 1`,
      studentId, tenantId, academicYearId,
    ).catch(() => []);

    const classId = enrollment?.[0]?.classId || null;
    const className = enrollment?.[0]?.className || '—';

    // 3. Cahier journal du jour (entries JSON)
    let cahierJournal: any = null;
    if (classId) {
      // Calculer le lundi de la semaine
      const now = new Date();
      const day = now.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff);
      const weekStart = monday.toISOString().split('T')[0];

      const cj: any = await this.prisma.$queryRawUnsafe(
        `SELECT "entries", "observations", "status"
         FROM "cahier_journal_entries"
         WHERE "tenantId" = $1 AND "classId" = $2
         AND "weekStartDate" = $3::date LIMIT 1`,
        tenantId, classId, weekStart,
      ).catch(() => []);

      if (cj && cj.length > 0) {
        const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
        const todayKey = dayNames[now.getDay()];
        let entries = cj[0].entries;
        if (typeof entries === 'string') {
          try { entries = JSON.parse(entries); } catch { entries = {}; }
        }
        cahierJournal = {
          todayEntries: entries[todayKey] || {},
          status: cj[0].status,
          observations: cj[0].observations,
        };
      }
    }

    // 4. Devoirs donnés (HomeworkEntry) pour la classe
    let homeworks: any[] = [];
    if (classId) {
      homeworks = await this.prisma.$queryRawUnsafe(
        `SELECT h."id", h."title", h."description", h."dueDate", h."maxScore",
                s."name" as "subjectName"
         FROM "homework_entries" h
         LEFT JOIN "subjects" s ON s."id" = h."subjectId"
         WHERE h."tenantId" = $1 AND h."classId" = $2
         AND h."academicYearId" = $3
         AND h."dueDate" >= CURRENT_DATE
         ORDER BY h."dueDate" ASC LIMIT 20`,
        tenantId, classId, academicYearId,
      ).catch(() => []);

      // Statut de chaque devoir pour cet élève
      if (homeworks.length > 0) {
        const hwIds = homeworks.map((h: any) => h.id);
        const taskStatus: any = await this.prisma.$queryRawUnsafe(
          `SELECT "homeworkEntryId", "status", "score", "appreciation", "observation"
           FROM "pedagogical_task_students"
           WHERE "studentId" = $1 AND "homeworkEntryId" = ANY($2::text[])`,
          studentId, hwIds,
        ).catch(() => []);

        const statusMap = new Map<string, any>();
        for (const t of (taskStatus || [])) {
          statusMap.set(t.homeworkEntryId, t);
        }
        homeworks = homeworks.map((h: any) => ({
          ...h,
          taskStatus: statusMap.get(h.id) || null,
        }));
      }
    }

    return {
      date: today,
      attendance: attendance?.[0] || null,
      className,
      cahierJournal,
      homeworks,
    };
  }

  /**
   * GET /parent/homeworks/:studentId?academicYearId=Y
   * Tous les devoirs d'un enfant (avec statut).
   */
  @Get('homeworks/:studentId')
  async getHomeworks(
    @TenantId() tenantId: string,
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    // Récupérer le classId
    const enrollment: any = await this.prisma.$queryRawUnsafe(
      `SELECT se."classId"
       FROM "student_enrollments" se
       WHERE se."studentId" = $1 AND se."tenantId" = $2
       AND se."academicYearId" = $3 LIMIT 1`,
      studentId, tenantId, academicYearId,
    ).catch(() => []);

    if (!enrollment || enrollment.length === 0) return [];

    const classId = enrollment[0].classId;
    if (!classId) return [];

    const homeworks: any = await this.prisma.$queryRawUnsafe(
      `SELECT h."id", h."title", h."description", h."dueDate", h."maxScore",
              h."createdAt", s."name" as "subjectName"
       FROM "homework_entries" h
       LEFT JOIN "subjects" s ON s."id" = h."subjectId"
       WHERE h."tenantId" = $1 AND h."classId" = $2
       AND h."academicYearId" = $3
       ORDER BY h."dueDate" DESC LIMIT 50`,
      tenantId, classId, academicYearId,
    ).catch(() => []);

    // Statut pour cet élève
    if (homeworks.length > 0) {
      const hwIds = homeworks.map((h: any) => h.id);
      const taskStatus: any = await this.prisma.$queryRawUnsafe(
        `SELECT "homeworkEntryId", "status", "score", "appreciation", "observation", "evaluatedAt"
         FROM "pedagogical_task_students"
         WHERE "studentId" = $1 AND "homeworkEntryId" = ANY($2::text[])`,
        studentId, hwIds,
      ).catch(() => []);

      const statusMap = new Map<string, any>();
      for (const t of (taskStatus || [])) {
        statusMap.set(t.homeworkEntryId, t);
      }
      return homeworks.map((h: any) => ({
        ...h,
        taskStatus: statusMap.get(h.id) || null,
      }));
    }

    return homeworks;
  }

  /**
   * GET /parent/results/:studentId?academicYearId=Y
   * Bulletins d'un enfant (depuis ReportCard).
   */
  @Get('results/:studentId')
  async getResults(
    @TenantId() tenantId: string,
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    const reportCards: any = await this.prisma.$queryRawUnsafe(
      `SELECT rc."id", rc."type", rc."overallAverage", rc."rank", rc."status",
              rc."filePath", rc."publishedAt", rc."createdAt",
              q."name" as "quarterName", q."number" as "quarterNumber"
       FROM "report_cards" rc
       LEFT JOIN "quarters" q ON q."id" = rc."quarterId"
       WHERE rc."studentId" = $1 AND rc."tenantId" = $2
       AND rc."academicYearId" = $3
       AND rc."status" IN ('VALIDATED', 'PUBLISHED')
       ORDER BY rc."createdAt" DESC`,
      studentId, tenantId, academicYearId,
    ).catch(() => []);

    // Enrichir avec les items par matière
    const enriched = await Promise.all(
      (reportCards || []).map(async (rc: any) => {
        const items: any = await this.prisma.$queryRawUnsafe(
          `SELECT rci."average", rci."coefficient", rci."rank", rci."comments",
                  s."name" as "subjectName"
           FROM "report_card_items" rci
           LEFT JOIN "subjects" s ON s."id" = rci."subjectId"
           WHERE rci."reportCardId" = $1
           ORDER BY s."name"`,
          rc.id,
        ).catch(() => []);
        return { ...rc, items: items || [] };
      }),
    );

    return enriched;
  }

  /**
   * GET /parent/receipts/:paymentId
   * Infos d'un reçu (JSON — utilisé par le frontend pour générer le PDF côté client).
   */
  @Get('receipts/:paymentId')
  async getReceipt(
    @TenantId() tenantId: string,
    @Param('paymentId') paymentId: string,
    @Res() res: Response,
  ) {
    const payment: any = await this.prisma.$queryRawUnsafe(
      `SELECT p."id", p."amount", p."paymentDate", p."paymentMethod",
              p."receiptNumber", p."reference", p."status", p."notes",
              p."feeName",
              s."firstName", s."lastName", s."matricule",
              t."name" as "tenantName", t."logoUrl", t."address", t."phone", t."email",
              se."classId", c."name" as "className",
              sl."name" as "levelName"
       FROM "payments" p
       INNER JOIN "students" s ON s."id" = p."studentId"
       LEFT JOIN "tenants" t ON t."id" = p."tenantId"
       LEFT JOIN "student_enrollments" se ON se."studentId" = s."id"
         AND se."tenantId" = p."tenantId"
         AND se."academicYearId" = p."academicYearId"
       LEFT JOIN "classes" c ON c."id" = se."classId"
       LEFT JOIN "school_levels" sl ON sl."id" = se."schoolLevelId"
       WHERE p."id" = $1 AND p."tenantId" = $2 LIMIT 1`,
      paymentId, tenantId,
    ).catch(() => []);

    if (!payment || payment.length === 0) {
      // Fallback sur FinanceTransaction si pas dans la table `payments`
      const tx: any = await this.prisma.$queryRawUnsafe(
        `SELECT ft."id", ft."amount", ft."createdAt" as "paymentDate",
                ft."paymentMethod", ft."receiptNumber", ft."reference",
                ft."status", ft."notes", ft."type",
                s."firstName", s."lastName", s."matricule",
                t."name" as "tenantName", t."logoUrl", t."address", t."phone", t."email",
                se."classId", c."name" as "className",
                sl."name" as "levelName"
         FROM "finance_transactions" ft
         INNER JOIN "students" s ON s."id" = ft."studentId"
         LEFT JOIN "tenants" t ON t."id" = ft."tenantId"
         LEFT JOIN "student_enrollments" se ON se."studentId" = s."id"
           AND se."tenantId" = ft."tenantId"
           AND se."academicYearId" = ft."academicYearId"
         LEFT JOIN "classes" c ON c."id" = se."classId"
         LEFT JOIN "school_levels" sl ON sl."id" = se."schoolLevelId"
         WHERE ft."id" = $1 AND ft."tenantId" = $2 LIMIT 1`,
        paymentId, tenantId,
      ).catch(() => []);

      if (!tx || tx.length === 0) {
        throw new NotFoundException('Paiement non trouvé');
      }

      const p = tx[0];
      res.json({
        paymentId: p.id,
        amount: p.amount,
        date: p.paymentDate,
        method: p.paymentMethod,
        receiptNumber: p.receiptNumber,
        reference: p.reference,
        status: p.status,
        notes: p.notes,
        feeName: 'Scolarité',
        student: `${p.firstName} ${p.lastName}`,
        matricule: p.matricule,
        className: p.className,
        levelName: p.levelName,
        school: {
          name: p.tenantName,
          logoUrl: p.logoUrl,
          address: p.address,
          phone: p.phone,
          email: p.email,
        },
      });
      return;
    }

    const p = payment[0];
    res.json({
      paymentId: p.id,
      amount: p.amount,
      date: p.paymentDate,
      method: p.paymentMethod,
      receiptNumber: p.receiptNumber,
      reference: p.reference,
      status: p.status,
      notes: p.notes,
      feeName: p.feeName || 'Scolarité',
      student: `${p.firstName} ${p.lastName}`,
      matricule: p.matricule,
      className: p.className,
      levelName: p.levelName,
      school: {
        name: p.tenantName,
        logoUrl: p.logoUrl,
        address: p.address,
        phone: p.phone,
        email: p.email,
      },
    });
  }

  /**
   * GET /parent/cahier-journal/:classId?weekStart=YYYY-MM-DD
   * Cahier journal hebdomadaire de la classe (visible par les parents).
   *
   * Retourne les entrées structurées par jour + les observations + le statut
   * de validation. Le parent peut consulter les cahiers journals passés.
   */
  @Get('cahier-journal/:classId')
  async getCahierJournal(
    @TenantId() tenantId: string,
    @Param('classId') classId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('weekStart') weekStartStr?: string,
  ) {
    // Déterminer la semaine cible
    let weekStart: string;
    if (weekStartStr) {
      weekStart = weekStartStr;
    } else {
      // Calculer le lundi de la semaine courante
      const now = new Date();
      const day = now.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff);
      weekStart = monday.toISOString().split('T')[0];
    }

    const cj: any = await this.prisma.$queryRawUnsafe(
      `SELECT cj."id", cj."entries", cj."observations", cj."status",
              cj."weekStartDate", cj."submittedAt", cj."validatedAt",
              cj."teacherSignature", cj."directorSignature",
              t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName",
              c."name" as "className",
              sl."code" as "levelCode", sl."name" as "levelName"
       FROM "cahier_journal_entries" cj
       LEFT JOIN "teachers" t ON t."id" = cj."teacherId"
       LEFT JOIN "classes" c ON c."id" = cj."classId"
       LEFT JOIN "school_levels" sl ON sl."id" = c."schoolLevelId"
       WHERE cj."tenantId" = $1 AND cj."classId" = $2
       AND cj."weekStartDate" = $3::date LIMIT 1`,
      tenantId, classId, weekStart,
    ).catch(() => []);

    if (!cj || cj.length === 0) {
      // Retourner une structure vide plutôt que 404 — le parent doit voir
      // que le cahier n'est pas encore disponible pour cette semaine.
      return {
        available: false,
        weekStart,
        message: 'Cahier journal non disponible pour cette semaine.',
      };
    }

    const row = cj[0];
    let entries = row.entries;
    if (typeof entries === 'string') {
      try { entries = JSON.parse(entries); } catch { entries = {}; }
    }

    // Récupérer la liste des semaines disponibles (pour navigation frontend)
    const availableWeeks: any = await this.prisma.$queryRawUnsafe(
      `SELECT "weekStartDate"::text as "weekStart", "status"
       FROM "cahier_journal_entries"
       WHERE "tenantId" = $1 AND "classId" = $2
       AND "academicYearId" = $3
       ORDER BY "weekStartDate" DESC LIMIT 12`,
      tenantId, classId, academicYearId,
    ).catch(() => []);

    return {
      available: true,
      id: row.id,
      weekStart,
      className: row.className,
      levelCode: row.levelCode,
      levelName: row.levelName,
      teacherName: `${row.teacherFirstName || ''} ${row.teacherLastName || ''}`.trim() || null,
      entries,
      observations: row.observations,
      status: row.status,
      submittedAt: row.submittedAt,
      validatedAt: row.validatedAt,
      teacherSignature: row.teacherSignature,
      directorSignature: row.directorSignature,
      availableWeeks: availableWeeks || [],
    };
  }

  /**
   * GET /parent/weeks/:classId
   * Liste des semaines ayant un cahier journal — pour navigation frontend.
   */
  @Get('weeks/:classId')
  async getAvailableWeeks(
    @TenantId() tenantId: string,
    @Param('classId') classId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    const weeks: any = await this.prisma.$queryRawUnsafe(
      `SELECT "weekStartDate"::text as "weekStart", "status", "submittedAt"
       FROM "cahier_journal_entries"
       WHERE "tenantId" = $1 AND "classId" = $2
       AND "academicYearId" = $3
       ORDER BY "weekStartDate" DESC LIMIT 24`,
      tenantId, classId, academicYearId,
    ).catch(() => []);

    return weeks || [];
  }
}
