/**
 * ============================================================================
 * PARENT PORTAL — Controller
 * ============================================================================
 * 
 * Endpoints pour le portail parent :
 *   GET  /parent/children          — Liste des enfants du parent
 *   GET  /parent/children/:id       — Détail d'un enfant (infos + assiduité)
 *   GET  /parent/payments/:studentId — Paiements + solde d'un enfant
 *   GET  /parent/attendance/:studentId — Assiduité d'un enfant
 *   GET  /parent/results/:studentId   — Bulletins/Résultats d'un enfant
 *   GET  /parent/receipts/:paymentId  — Télécharger un reçu PDF
 * ============================================================================
 */

import {
  Controller, Get, Param, Query, Res, BadRequestException,
  NotFoundException, Logger,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../database/prisma.service';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@Controller('parent')
@Public()
export class ParentPortalController {
  private readonly logger = new Logger(ParentPortalController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /parent/children?parentId=X
   * Liste des enfants liés à un parent.
   */
  @Get('children')
  async getChildren(
    @TenantId() tenantId: string,
    @Query('parentId') parentId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!parentId) throw new BadRequestException('parentId est requis');

    // Récupérer les élèves liés à ce parent
    const links = await this.prisma.$queryRawUnsafe(
      `SELECT s."id", s."firstName", s."lastName", s."gender", s."matricule",
              s."dateOfBirth", s."photoUrl",
              se."classId", c."name" as "className",
              sl."name" as "levelName", sl."code" as "levelCode",
              se."status" as "enrollmentStatus"
       FROM "students" s
       INNER JOIN "student_enrollments" se ON se."studentId" = s."id"
       LEFT JOIN "classes" c ON c."id" = se."classId"
       LEFT JOIN "school_levels" sl ON sl."id" = se."schoolLevelId"
       WHERE s."tenantId" = $1
       AND se."academicYearId" = $2
       AND se."status" IN ('ACTIVE', 'ADMITTED', 'ENROLLED')
       AND s."id" IN (
         SELECT "studentId" FROM "student_guardians"
         WHERE "guardianId" = $3
         UNION
         SELECT "studentId" FROM "parent_student_links"
         WHERE "parentId" = $3 AND "tenantId" = $1
       )
       ORDER BY s."lastName", s."firstName"`,
      tenantId, academicYearId, parentId,
    );

    return links;
  }

  /**
   * GET /parent/children/:studentId?parentId=X&academicYearId=Y
   * Détail d'un enfant : infos + effectifs classe + assiduité + enseignant titulaire.
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
       AND se."academicYearId" = $3
       LIMIT 1`,
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
        `SELECT
           COUNT(*)::int as "total",
           COUNT(CASE WHEN s."gender" = 'MALE' THEN 1 END)::int as "boys",
           COUNT(CASE WHEN s."gender" = 'FEMALE' THEN 1 END)::int as "girls"
         FROM "student_enrollments" se
         INNER JOIN "students" s ON s."id" = se."studentId"
         WHERE se."classId" = $1 AND se."academicYearId" = $2
         AND se."status" IN ('ACTIVE', 'ADMITTED', 'ENROLLED')`,
        student.classId, academicYearId,
      );
      classStats = stats[0] || null;
    }

    // Enseignant titulaire de la classe
    let teacher: any = null;
    if (student.classId) {
      const teachers: any = await this.prisma.$queryRawUnsafe(
        `SELECT t."id", t."firstName", t."lastName", t."email", t."phone",
                t."matricule", u."email" as "userEmail"
         FROM "teacher_class_assignments" tca
         INNER JOIN "teachers" t ON t."id" = tca."teacherId"
         LEFT JOIN "users" u ON u."email" = t."email" AND u."tenantId" = t."tenantId"
         WHERE tca."tenantId" = $1 AND tca."academicYearId" = $2
         AND tca."classId" = $3 AND tca."teacherId" IS NOT NULL
         LIMIT 1`,
        tenantId, academicYearId, student.classId,
      );
      if (teachers && teachers.length > 0) {
        teacher = {
          id: teachers[0].id,
          name: `${teachers[0].firstName} ${teachers[0].lastName}`.trim(),
          email: teachers[0].email || teachers[0].userEmail || null,
          phone: teachers[0].phone || null,
          matricule: teachers[0].matricule || null,
        };
      }
    }

    // Résumé assiduité (ce mois)
    const attendance: any = await this.prisma.$queryRawUnsafe(
      `SELECT
         COUNT(*)::int as "totalDays",
         COUNT(CASE WHEN "status" = 'PRESENT' THEN 1 END)::int as "present",
         COUNT(CASE WHEN "status" = 'ABSENT' THEN 1 END)::int as "absent",
         COUNT(CASE WHEN "status" = 'LATE' THEN 1 END)::int as "late"
       FROM "attendance_records"
       WHERE "studentId" = $1 AND "tenantId" = $2
       AND "date" >= date_trunc('month', CURRENT_DATE)`,
      studentId, tenantId,
    );

    return {
      ...student,
      classStats,
      teacher,
      attendance: attendance[0] || { totalDays: 0, present: 0, absent: 0, late: 0 },
    };
  }

  /**
   * GET /parent/payments/:studentId?academicYearId=Y
   * Paiements + solde pour un enfant.
   */
  @Get('payments/:studentId')
  async getPayments(
    @TenantId() tenantId: string,
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId est requis');

    // Total dû : somme des StudentFee
    const fees: any = await this.prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM("amountDue"), 0)::float as "totalDue",
              COALESCE(SUM("amountPaid"), 0)::float as "totalPaid"
       FROM "student_fees"
       WHERE "studentId" = $1 AND "tenantId" = $2
       AND "academicYearId" = $3`,
      studentId, tenantId, academicYearId,
    );

    const totalDue = fees[0]?.totalDue || 0;
    const totalPaid = fees[0]?.totalPaid || 0;
    const totalRemaining = totalDue - totalPaid;

    // Historique des paiements
    const payments = await this.prisma.$queryRawUnsafe(
      `SELECT p."id", p."amount", p."paymentDate", p."paymentMethod",
              p."receiptNumber", p."reference", p."status", p."notes",
              p."createdAt", fc."name" as "feeName"
       FROM "payments" p
       LEFT JOIN "fee_configurations" fc ON fc."id" = p."feeConfigurationId"
       WHERE p."studentId" = $1 AND p."tenantId" = $2
       AND p."status" = 'completed'
       AND p."transactionType" = 'PAYMENT'
       ORDER BY p."paymentDate" DESC`,
      studentId, tenantId,
    );

    return {
      totalDue,
      totalPaid,
      totalRemaining,
      payments,
    };
  }

  /**
   * GET /parent/attendance/:studentId?month=Y&m=M
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
   * GET /parent/results/:studentId?academicYearId=Y
   * Bulletins / résultats d'un enfant.
   */
  @Get('results/:studentId')
  async getResults(
    @TenantId() tenantId: string,
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    // Pour l'instant, on récupère les notes disponibles
    const results = await this.prisma.$queryRawUnsafe(
      `SELECT r."id", r."subject", r."score", r."maxScore",
              r."grade", r."appreciation", r."period", r."createdAt"
       FROM "results" r
       WHERE r."studentId" = $1 AND r."tenantId" = $2
       ORDER BY r."createdAt" DESC LIMIT 50`,
      studentId, tenantId,
    ).catch(() => {
      // Table results peut ne pas exister — retourner vide
      return [];
    });

    return results;
  }

  /**
   * GET /parent/receipts/:paymentId
   * Télécharge un reçu PDF (placeholder — le reçu réel sera généré par le module finance).
   */
  @Get('receipts/:paymentId')
  async getReceipt(
    @TenantId() tenantId: string,
    @Param('paymentId') paymentId: string,
    @Res() res: any,
  ) {
    const payment: any = await this.prisma.$queryRawUnsafe(
      `SELECT p."id", p."amount", p."paymentDate", p."paymentMethod",
              p."receiptNumber", p."reference", p."status",
              s."firstName", s."lastName", s."matricule",
              t."name" as "tenantName"
       FROM "payments" p
       INNER JOIN "students" s ON s."id" = p."studentId"
       LEFT JOIN "tenants" t ON t."id" = p."tenantId"
       WHERE p."id" = $1 AND p."tenantId" = $2 LIMIT 1`,
      paymentId, tenantId,
    );

    if (!payment || payment.length === 0) {
      throw new NotFoundException('Paiement non trouvé');
    }

    const p = payment[0];
    // Pour l'instant on retourne les infos en JSON — le PDF sera généré plus tard
    res.json({
      paymentId: p.id,
      amount: p.amount,
      date: p.paymentDate,
      method: p.paymentMethod,
      receiptNumber: p.receiptNumber,
      reference: p.reference,
      status: p.status,
      student: `${p.firstName} ${p.lastName}`,
      matricule: p.matricule,
      school: p.tenantName,
    });
  }
}
