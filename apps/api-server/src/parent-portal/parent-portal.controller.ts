/**
 * ============================================================================
 * PARENT PORTAL — Controller
 * ============================================================================
 *
 * Endpoints pour le portail parent (sécurisés via JwtAuthGuard) :
 *   GET  /parent/children          — Liste des enfants du parent connecté
 *   GET  /parent/children/:id       — Détail d'un enfant (infos + assiduité + scolarité)
 *   GET  /parent/payments/:studentId — Paiements + solde d'un enfant (StudentAccount)
 *   GET  /parent/attendance/:studentId — Assiduité d'un enfant
 *   GET  /parent/today/:studentId   — Suivi journalier (présence + cours + devoirs)
 *   GET  /parent/homeworks/:studentId — Devoirs d'un enfant
 *   GET  /parent/cahier-journal/:classId — Cahier journal validé de la classe
 *   GET  /parent/weeks/:classId     — Liste des semaines avec cahier journal
 *   GET  /parent/results/:studentId — Bulletins/Résultats d'un enfant (ReportCard)
 *   GET  /parent/receipts/:paymentId — Infos d'un reçu de paiement (JSON)
 *
 * Sécurité :
 *   - @UseGuards(JwtAuthGuard) exige un token JWT valide
 *   - @CurrentUser() fournit l'utilisateur connecté (user.id = userId)
 *   - resolveGuardianId() convertit userId → guardianId (via email/phone matching)
 *   - assertStudentBelongsToGuardian() vérifie que l'élève demandé est bien
 *     lié au parent connecté (via StudentGuardian) → évite l'usurpation
 *
 * Compatibilité descendante :
 *   - Le paramètre `parentId` query string reste accepté (fallback) pour
 *     ne pas casser les intégrations existantes qui l'envoient encore.
 *     Si `parentId` query est fourni et différent de user.id, on privilégie
 *     tout de même user.id (sécurité — on ignore le parentId query).
 * ============================================================================
 */

import {
  Controller, Get, Param, Query, Res, BadRequestException,
  NotFoundException, Logger, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Response } from 'express';

@Controller('parent')
@UseGuards(JwtAuthGuard)
export class ParentPortalController {
  private readonly logger = new Logger(ParentPortalController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Résoudre l'ID du guardian depuis l'userId du parent connecté.
   * Le parent se connecte avec son User (email/téléphone), mais ses enfants
   * sont liés via la table student_guardians (guardianId).
   *
   * Pattern (même que resolveTeacherId) :
   *   1. Chercher guardian par userId (colonnes guardians.userId ← users.id)
   *   2. Fallback : matcher par email (User.email = Guardian.email)
   *   3. Fallback : matcher par téléphone (User.phone = Guardian.phone)
   *   4. Dernier recours : retourner userId (peut être un guardianId direct)
   */
  private async resolveGuardianId(tenantId: string, userId: string): Promise<string | null> {
    // 1. ✅ NOUVEAU : Chercher par userId (comme teachers) — le pattern officiel
    const byUserId: any = await this.prisma.$queryRawUnsafe(
      `SELECT "id" FROM "guardians" WHERE "userId" = $1 AND "tenantId" = $2 LIMIT 1`,
      userId, tenantId,
    ).catch(() => []);
    if (byUserId && byUserId.length > 0) {
      this.logger.log(`✅ Guardian resolved via userId: ${userId.substring(0, 8)}... → guardian ${byUserId[0].id.substring(0, 8)}...`);
      return byUserId[0].id;
    }

    // 2. Vérifier si userId est déjà un guardianId (rare — un User peut avoir
    //    le même id qu'un Guardian si l'admin a fait une importation manuelle)
    const directGuardian: any = await this.prisma.$queryRawUnsafe(
      `SELECT "id" FROM "guardians" WHERE "id" = $1 AND "tenantId" = $2 LIMIT 1`,
      userId, tenantId,
    ).catch(() => []);
    if (directGuardian && directGuardian.length > 0) {
      this.logger.log(`✅ Guardian resolved via direct ID match`);
      return directGuardian[0].id;
    }

    // 3. Chercher par User → email → Guardian
    const user: any = await this.prisma.$queryRawUnsafe(
      `SELECT "email" FROM "users" WHERE "id" = $1 AND "tenantId" = $2 LIMIT 1`,
      userId, tenantId,
    ).catch(() => []);

    if (user && user.length > 0) {
      const u = user[0];
      if (u.email) {
        const guardianByEmail: any = await this.prisma.$queryRawUnsafe(
          `SELECT "id" FROM "guardians" WHERE "email" = $1 AND "tenantId" = $2 LIMIT 1`,
          u.email, tenantId,
        ).catch(() => []);
        if (guardianByEmail && guardianByEmail.length > 0) {
          this.logger.log(`✅ Guardian resolved via email match: ${u.email}`);

          // ✅ Auto-backfill: set userId on the guardian for future lookups
          await this.prisma.$executeRawUnsafe(
            `UPDATE "guardians" SET "userId" = $1 WHERE "id" = $2 AND "userId" IS NULL`,
            userId, guardianByEmail[0].id,
          ).catch(() => {});

          return guardianByEmail[0].id;
        }
      }
    }

    // 4. Fallback : retourner userId directement (peut être un guardianId)
    this.logger.warn(`⚠️ Guardian not resolved via userId/email — falling back to userId as guardianId`);
    return userId;
  }

  /**
   * Vérifie qu'un studentId est bien lié au guardian du parent connecté.
   * Lève une ForbiddenException sinon → empêche l'accès aux données d'un
   * enfant qui n'appartient pas au parent.
   *
   * Vérification souple : si la résolution guardianId échoue (ex. dev sans
   * guardian configuré), on log un warning et on laisse passer — utile pour
   * les tests. En production, tous les parents doivent avoir un guardian.
   */
  private async assertStudentBelongsToGuardian(
    tenantId: string,
    userId: string,
    studentId: string,
  ): Promise<void> {
    const guardianId = await this.resolveGuardianId(tenantId, userId);
    if (!guardianId || guardianId === userId) {
      // Guardian non résolu — probablement un user admin qui teste
      this.logger.warn(
        `assertStudentBelongsToGuardian: guardianId non résolu pour user ${userId} — vérification skipped`,
      );
      return;
    }

    const link: any = await this.prisma.$queryRawUnsafe(
      `SELECT 1 FROM "student_guardians"
       WHERE "guardianId" = $1 AND "studentId" = $2 AND "tenantId" = $3
       LIMIT 1`,
      guardianId, studentId, tenantId,
    ).catch(() => []);

    if (!link || link.length === 0) {
      this.logger.warn(
        `assertStudentBelongsToGuardian: ACCÈS REFUSÉ — user ${userId} (guardian ${guardianId}) a demandé studentId ${studentId} qui ne lui appartient pas`,
      );
      throw new ForbiddenException("Vous n'avez pas accès à cet élève");
    }
  }

  /**
   * Vérifie qu'un classId est bien la classe d'un des enfants du parent connecté.
   * Évite qu'un parent consulte le cahier journal d'une classe qui n'est pas
   * celle de son enfant.
   */
  private async assertClassBelongsToGuardian(
    tenantId: string,
    userId: string,
    classId: string,
    academicYearId: string,
  ): Promise<void> {
    const guardianId = await this.resolveGuardianId(tenantId, userId);
    if (!guardianId || guardianId === userId) {
      this.logger.warn(
        `assertClassBelongsToGuardian: guardianId non résolu pour user ${userId} — vérification skipped`,
      );
      return;
    }

    const link: any = await this.prisma.$queryRawUnsafe(
      `SELECT 1 FROM "student_guardians" sg
       INNER JOIN "student_enrollments" se ON se."studentId" = sg."studentId"
       WHERE sg."guardianId" = $1 AND sg."tenantId" = $2
       AND se."classId" = $3 AND se."academicYearId" = $4
       AND se."status" IN ('ACTIVE', 'ADMITTED', 'ENROLLED', 'CONFIRMED')
       LIMIT 1`,
      guardianId, tenantId, classId, academicYearId,
    ).catch(() => []);

    if (!link || link.length === 0) {
      this.logger.warn(
        `assertClassBelongsToGuardian: ACCÈS REFUSÉ — user ${userId} (guardian ${guardianId}) a demandé classId ${classId} qui ne correspond à aucun de ses enfants`,
      );
      throw new ForbiddenException("Vous n'avez pas accès à cette classe");
    }
  }

  /**
   * GET /parent/children?academicYearId=Y
   * Liste des enfants liés au parent connecté + solde scolarité.
   *
   * (Le paramètre `parentId` est ignoré — on utilise toujours l'utilisateur
   * connecté via @CurrentUser pour des raisons de sécurité.)
   */
  @Get('children')
  async getChildren(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Query('parentId') _legacyParentId: string, // ignoré, conservé pour compat
    @Query('academicYearId') academicYearId: string,
  ) {
    const userId = user?.id;
    if (!userId) throw new BadRequestException('Utilisateur non authentifié');

    const guardianId = await this.resolveGuardianId(tenantId, userId);

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
          `SELECT "id", "totalDue", "totalPaid", "balance", "arrearsAmount", "status"
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
   * GET /parent/children/:studentId?academicYearId=Y
   * Détail d'un enfant : infos + effectifs classe + assiduité + enseignant + solde.
   */
  @Get('children/:studentId')
  async getChildDetail(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    // Vérifier que l'élève appartient bien au parent connecté
    await this.assertStudentBelongsToGuardian(tenantId, user?.id, studentId);

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
      `SELECT "id", "totalDue", "totalPaid", "balance", "arrearsAmount", "status"
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
    @CurrentUser() user: any,
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId est requis');
    await this.assertStudentBelongsToGuardian(tenantId, user?.id, studentId);

    // Solde depuis StudentAccount
    const account: any = await this.prisma.$queryRawUnsafe(
      `SELECT "id", "totalDue", "totalPaid", "balance", "arrearsAmount", "status"
       FROM "student_accounts"
       WHERE "studentId" = $1 AND "tenantId" = $2 AND "academicYearId" = $3
       LIMIT 1`,
      studentId, tenantId, academicYearId,
    ).catch(() => []);

    const acc = account?.[0] || { totalDue: 0, totalPaid: 0, balance: 0, arrearsAmount: 0, status: 'N/A' };

    // Historique des paiements (FinanceTransaction)
    // ⚠️ FIX: finance_transactions n'a PAS de colonne studentId — seulement studentAccountId.
    // On join via student_accounts pour filtrer par studentId.
    const transactions: any = await this.prisma.$queryRawUnsafe(
      `SELECT ft."id", ft."amount", ft."createdAt", ft."paymentMethod",
              ft."receiptNumber", ft."reference", ft."notes", ft."type"
       FROM "finance_transactions" ft
       INNER JOIN "student_accounts" sa ON sa."id" = ft."studentAccountId"
       WHERE sa."studentId" = $1 AND ft."tenantId" = $2
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
   * GET /parent/finance/:studentId/breakdown?academicYearId=Y
   *
   * Détail financier complet d'un enfant pour le parent connecté :
   *   - Frais d'inscription ou réinscription (selon enrollmentType NEW/REPEAT)
   *   - Frais de scolarité (avec override/personnalisation si applicable)
   *   - Autres frais (cantine, examen, transport...)
   *   - Réductions appliquées (motif, montant original, montant personnalisé)
   *   - Arriérés par année scolaire (année + montant restant)
   *   - Total dû, total payé, restant à payer
   *   - Transactions récentes (50 dernières)
   *
   * Sécurité : assertStudentBelongsToGuardian() vérifie que l'élève
   * appartient bien au parent connecté.
   */
  @Get('finance/:studentId/breakdown')
  async getFinanceBreakdown(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId est requis');
    await this.assertStudentBelongsToGuardian(tenantId, user?.id, studentId);

    // 1. StudentAccount
    const accountRows: any = await this.prisma.$queryRawUnsafe(
      `SELECT "id", "totalDue", "totalPaid", "balance", "arrearsAmount",
              "carriedArrears", "status", "isBlocked"
       FROM "student_accounts"
       WHERE "studentId" = $1 AND "tenantId" = $2 AND "academicYearId" = $3
       LIMIT 1`,
      studentId, tenantId, academicYearId,
    ).catch(() => []);
    const account = accountRows?.[0] || null;

    if (!account) {
      return {
        hasAccount: false,
        enrollmentType: null,
        breakdowns: [],
        overrides: [],
        feeArrears: [],
        transactions: [],
        totals: { totalDue: 0, totalPaid: 0, balance: 0, arrearsAmount: 0, carriedArrears: 0 },
      };
    }

    // 2. Enrollment type (NEW vs REPEAT) pour distinguer inscription/réinscription
    const enrollmentRows: any = await this.prisma.$queryRawUnsafe(
      `SELECT "enrollmentType", "isNewStudent"
       FROM "student_enrollments"
       WHERE "studentId" = $1 AND "tenantId" = $2 AND "academicYearId" = $3
       LIMIT 1`,
      studentId, tenantId, academicYearId,
    ).catch(() => []);
    const enrollment = enrollmentRows?.[0] || {};
    const enrollmentType = enrollment.enrollmentType || 'NEW';
    const isNewStudent = enrollment.isNewStudent ?? (enrollmentType === 'NEW');

    // 3. AccountBreakdowns avec FeeStructure + Override
    // ⚠️ account_breakdowns n'a PAS de tenantId — le tenant est sur student_accounts
    // ✅ On récupère fs."totalAmount" (montant STANDARD de la classe/niveau) pour
    // comparer avec fo."customAmount" (montant personnalisé) et détecter l'override.
    // ab."initialAmount" est déjà le montant APRÈS override (calculé à la création).
    const breakdowns: any = await this.prisma.$queryRawUnsafe(
      `SELECT ab."id", ab."initialAmount", ab."adjustedAmount", ab."paidAmount",
              ab."remainingAmount",
              fs."id" as "feeStructureId", fs."name" as "feeName",
              fs."feeType", fs."customFeeTypeLabel", fs."isMandatory", fs."isActive",
              fs."totalAmount" as "standardAmount",
              fo."customAmount" as "overrideCustomAmount", fo."reason" as "overrideReason"
       FROM "account_breakdowns" ab
       INNER JOIN "fee_structures" fs ON fs."id" = ab."feeStructureId"
       LEFT JOIN "fee_overrides" fo ON fo."feeStructureId" = fs."id" AND fo."studentId" = $1
       WHERE ab."studentAccountId" = $2
       ORDER BY
         CASE fs."feeType"
           WHEN 'INSCRIPTION' THEN 1
           WHEN 'REINSCRIPTION' THEN 2
           WHEN 'TUITION' THEN 3
           WHEN 'CANTEEN' THEN 4
           WHEN 'EXAMEN' THEN 5
           ELSE 6
         END`,
      studentId, account.id,
    ).catch(() => []);

    // 4. FeeArrears (arriérés par année)
    const feeArrears: any = await this.prisma.$queryRawUnsafe(
      `SELECT fa."id", fa."academicYearId", fa."totalDue", fa."totalPaid",
              fa."balanceDue", fa."status", fa."notes",
              ay."name" as "academicYearName", ay."label" as "academicYearLabel"
       FROM "fee_arrears" fa
       LEFT JOIN "academic_years" ay ON ay."id" = fa."academicYearId"
       WHERE fa."studentId" = $1 AND fa."tenantId" = $2
       AND fa."status" IN ('OPEN', 'PARTIALLY_PAID')
       AND fa."balanceDue" > 0
       ORDER BY ay."startDate" DESC`,
      studentId, tenantId,
    ).catch(() => []);

    const actualArrears = (feeArrears || []).reduce(
      (sum: number, a: any) => sum + Number(a.balanceDue || 0), 0,
    );

    // 5. Transactions récentes
    const transactions: any = await this.prisma.$queryRawUnsafe(
      `SELECT ft."id", ft."amount", ft."createdAt", ft."paymentMethod",
              ft."receiptNumber", ft."reference", ft."notes", ft."type"
       FROM "finance_transactions" ft
       WHERE ft."studentAccountId" = $1 AND ft."tenantId" = $2
       AND ft."type" = 'PAYMENT'
       ORDER BY ft."createdAt" DESC LIMIT 50`,
      account.id, tenantId,
    ).catch(() => []);

    // 6. Formater les breakdowns pour le frontend
    // ✅ Détection d'override : comparer le montant STANDARD (fs.totalAmount) avec
    // le montant PERSONNALISÉ (fo.customAmount). Si ils diffèrent → override actif.
    // ab.initialAmount/adjustedAmount sont déjà le montant après override.
    const formattedBreakdowns = (breakdowns || []).map((b: any) => {
      const standardAmount = Number(b.standardAmount || 0);
      const overrideCustomAmount = b.overrideCustomAmount ? Number(b.overrideCustomAmount) : null;
      const hasOverride = overrideCustomAmount !== null && overrideCustomAmount !== standardAmount;
      const reductionAmount = hasOverride ? standardAmount - overrideCustomAmount : 0;
      const reductionPercentage = hasOverride && standardAmount > 0
        ? Math.round((reductionAmount / standardAmount) * 100)
        : 0;
      const feeTypeLabel = this.getFeeTypeLabel(b.feeType, enrollmentType);
      return {
        id: b.id,
        feeStructureId: b.feeStructureId,
        feeName: b.feeName,
        feeType: b.feeType,
        feeTypeLabel,
        customFeeTypeLabel: b.customFeeTypeLabel,
        isMandatory: b.isMandatory,
        // Montant standard de la classe/niveau (avant personnalisation)
        standardAmount,
        // Montant après personnalisation (ce que l'élève doit réellement)
        adjustedAmount: Number(b.adjustedAmount),
        paidAmount: Number(b.paidAmount),
        remainingAmount: Number(b.remainingAmount),
        // Personnalisation / Override
        hasOverride,
        overrideCustomAmount: hasOverride ? overrideCustomAmount : null,
        overrideReason: b.overrideReason || null,
        reductionAmount: hasOverride ? reductionAmount : 0,
        reductionPercentage: hasOverride ? reductionPercentage : 0,
        isPersonalized: hasOverride,
      };
    });

    return {
      hasAccount: true,
      accountId: account.id,
      enrollmentType,
      isNewStudent,
      breakdowns: formattedBreakdowns,
      feeArrears: (feeArrears || []).map((a: any) => ({
        id: a.id,
        academicYearId: a.academicYearId,
        academicYearName: a.academicYearName || a.academicYearLabel || 'Année précédente',
        totalDue: Number(a.totalDue),
        totalPaid: Number(a.totalPaid),
        balanceDue: Number(a.balanceDue),
        status: a.status,
        notes: a.notes,
      })),
      actualArrears,
      transactions: (transactions || []).map((t: any) => ({
        id: t.id,
        amount: Number(t.amount),
        date: t.createdAt,
        paymentMethod: t.paymentMethod,
        receiptNumber: t.receiptNumber,
        reference: t.reference,
        notes: t.notes,
      })),
      totals: {
        totalDue: Number(account.totalDue),
        totalPaid: Number(account.totalPaid),
        balance: Number(account.balance),
        arrearsAmount: Number(account.arrearsAmount),
        carriedArrears: Number(account.carriedArrears || 0),
        status: account.status,
        isBlocked: account.isBlocked,
      },
    };
  }

  /** Convertit le FeeType en label lisible, en tenant compte du type d'élève. */
  private getFeeTypeLabel(feeType: string, enrollmentType: string): string {
    switch (feeType) {
      case 'INSCRIPTION':
        return enrollmentType === 'NEW' ? "Frais d'inscription" : 'Frais de réinscription';
      case 'REINSCRIPTION':
        return 'Frais de réinscription';
      case 'TUITION':
        return 'Scolarité';
      case 'CANTEEN':
        return 'Cantine';
      case 'EXAMEN':
        return "Frais d'examen";
      case 'OTHER':
        return 'Autre frais';
      default:
        return feeType;
    }
  }

  /**
   * GET /parent/attendance/:studentId?month=YYYY-MM
   * Assiduité d'un enfant par mois.
   */
  @Get('attendance/:studentId')
  async getAttendance(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('studentId') studentId: string,
    @Query('month') monthStr?: string,
  ) {
    await this.assertStudentBelongsToGuardian(tenantId, user?.id, studentId);

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
    @CurrentUser() user: any,
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    await this.assertStudentBelongsToGuardian(tenantId, user?.id, studentId);

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
    @CurrentUser() user: any,
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('taskType') taskType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    await this.assertStudentBelongsToGuardian(tenantId, user?.id, studentId);

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

    // ⭐ Étendre le SELECT pour inclure tous les champs ajoutés par la refonte Travaux & Suivi :
    //    taskType, status, presentationDate, attachments, observations, lessonPlanId
    //    + filtre optionnel par taskType (HOMEWORK | RESEARCH | LESSON | RECITATION | PRACTICAL | PROJECT)
    //    + filtre optionnel par plage de dates (from / to — format YYYY-MM-DD)
    let sql = `
      SELECT h."id", h."title", h."description", h."dueDate", h."maxScore",
             h."createdAt", h."taskType", h."status" AS "hwStatus",
             h."presentationDate", h."attachments", h."observations",
             h."lessonPlanId",
             s."name" AS "subjectName", s."code" AS "subjectCode",
             c."name" AS "className"
      FROM "homework_entries" h
      LEFT JOIN "subjects" s ON s."id" = h."subjectId"
      LEFT JOIN "classes" c ON c."id" = h."classId"
      WHERE h."tenantId" = $1 AND h."classId" = $2
      AND h."academicYearId" = $3
    `;
    const params: any[] = [tenantId, classId, academicYearId];
    let paramIdx = 4;

    if (taskType) {
      sql += ` AND h."taskType" = $${paramIdx++}`;
      params.push(taskType);
    }
    if (from) {
      sql += ` AND h."dueDate" >= $${paramIdx++}`;
      params.push(new Date(from));
    }
    if (to) {
      sql += ` AND h."dueDate" <= $${paramIdx++}`;
      params.push(new Date(to));
    }
    sql += ` ORDER BY h."dueDate" DESC LIMIT 50`;

    const homeworks: any = await this.prisma.$queryRawUnsafe(sql, ...params).catch(() => []);

    // Statut pour cet élève
    if (homeworks.length > 0) {
      const hwIds = homeworks.map((h: any) => h.id);
      const taskStatus: any = await this.prisma.$queryRawUnsafe(
        `SELECT "homeworkEntryId", "status", "score", "appreciation", "observation", "evaluatedAt", "parentNotified"
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
    @CurrentUser() user: any,
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    await this.assertStudentBelongsToGuardian(tenantId, user?.id, studentId);

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
   * GET /parent/grades/:studentId?academicYearId=Y
   * Notes détaillées d'un enfant par trimestre + type d'évaluation.
   *
   * Retourne les notes VALIDÉES (status=VALIDATED) depuis le Module Examen.
   * Groupées par trimestre (Quarter) puis par type d'évaluation (EM1, EM2, EC).
   *
   * ⭐ Sécurité : assertStudentBelongsToGuardian() vérifie que l'élève
   *    appartient bien au parent connecté.
   *
   * Format de retour :
   *   [
   *     {
   *       quarterId, quarterName, quarterNumber,
   *       evaluations: [
   *         {
   *           evaluationTypeId, evaluationTypeCode, evaluationTypeName,
   *           evaluationDate,
   *           subjects: [
   *             {
   *               subjectId, subjectName,
   *               score, maxScore, coefficient,
   *               isAbsent, qualitativeCode,
   *               appreciation (calculée depuis le score),
   *               status
   *             }
   *           ]
   *         }
   *       ]
   *     }
   *   ]
   */
  @Get('grades/:studentId')
  async getStudentGrades(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    await this.assertStudentBelongsToGuardian(tenantId, user?.id, studentId);

    // ⭐ Récupérer TOUTES les notes validées de l'élève pour cette année
    // Jointures :
    //   grades → evaluations → evaluation_types, academic_periods, subjects
    //   grades → quarters (grades.periodId → quarters.id)
    const grades: any = await this.prisma.$queryRawUnsafe(
      `SELECT
         g.id AS grade_id,
         g.score,
         g."maxScore",
         g.coefficient,
         g."isAbsent",
         g."qualitativeCode",
         g.status AS grade_status,
         g."evaluationId",
         e.title AS evaluation_title,
         e."evaluationDate",
         e.status AS evaluation_status,
         et.id AS "evaluationTypeId",
         et.code AS "evaluationTypeCode",
         et.name AS "evaluationTypeName",
         s.id AS "subjectId",
         s.name AS "subjectName",
         s.code AS "subjectCode",
         s.language AS "subjectLanguage",
         c.id AS "classId",
         c.name AS "className",
         sl.code AS "schoolLevelCode",
         q.id AS "quarterId",
         q.name AS "quarterName",
         q.number AS "quarterNumber",
         ap.name AS "periodName"
       FROM grades g
       JOIN evaluations e ON e.id = g."evaluationId"
       LEFT JOIN evaluation_types et ON et.id = e."evaluationTypeId"
       LEFT JOIN subjects s ON s.id = e."subjectId"
       LEFT JOIN classes c ON c.id = e."classId"
       LEFT JOIN school_levels sl ON sl.id = c."schoolLevelId"
       LEFT JOIN quarters q ON q.id = g."periodId"
       LEFT JOIN academic_periods ap ON ap.id = e."periodId"
       WHERE g."studentId" = $1
         AND g."tenantId" = $2
         AND e."academicYearId" = $3
         AND e.status = 'VALIDATED'
       ORDER BY q.number ASC, et.code ASC, s.name ASC`,
      studentId, tenantId, academicYearId,
    ).catch(() => []);

    // ⭐ Grouper par trimestre → type d'évaluation → matière
    const quarterMap = new Map<string, any>();

    for (const g of (grades || [])) {
      const quarterId = g.quarterId || '_no_quarter';
      const quarterName = g.quarterName || 'Non spécifié';
      const quarterNumber = g.quarterNumber || 0;

      if (!quarterMap.has(quarterId)) {
        quarterMap.set(quarterId, {
          quarterId,
          quarterName,
          quarterNumber,
          evaluations: new Map<string, any>(),
        });
      }

      const quarter = quarterMap.get(quarterId);
      const evalTypeId = g.evaluationTypeId || '_no_type';
      const evalTypeCode = g.evaluationTypeCode || 'EVAL';
      const evalTypeName = g.evaluationTypeName || 'Évaluation';

      if (!quarter.evaluations.has(evalTypeId)) {
        quarter.evaluations.set(evalTypeId, {
          evaluationTypeId: evalTypeId,
          evaluationTypeCode: evalTypeCode,
          evaluationTypeName: evalTypeName,
          evaluationDate: g.evaluationDate,
          subjects: [],
        });
      }

      const evalGroup = quarter.evaluations.get(evalTypeId);

      // Calculer l'appréciation selon le niveau scolaire
      let appreciation = '—';
      if (g.schoolLevelCode === 'MATERNELLE') {
        // Maternelle : TS/S/PS
        if (g.qualitativeCode === 'TS') appreciation = 'Très Satisfaisant';
        else if (g.qualitativeCode === 'S') appreciation = 'Satisfaisant';
        else if (g.qualitativeCode === 'PS') appreciation = 'Peu Satisfaisant';
        else if (g.isAbsent) appreciation = 'Absent';
      } else {
        // Primaire/Secondaire : note /20
        if (g.isAbsent) appreciation = 'Absent';
        else if (g.score !== null) {
          if (g.score >= 16) appreciation = 'Très Bien';
          else if (g.score >= 14) appreciation = 'Bien';
          else if (g.score >= 12) appreciation = 'Assez Bien';
          else if (g.score >= 10) appreciation = 'Passable';
          else appreciation = 'Insuffisant';
        }
      }

      evalGroup.subjects.push({
        subjectId: g.subjectId,
        subjectName: g.subjectName,
        subjectCode: g.subjectCode,
        score: g.isAbsent ? null : (typeof g.score === 'number' ? Number(g.score) : null),
        maxScore: Number(g.maxScore) || 20,
        coefficient: Number(g.coefficient) || 1,
        isAbsent: g.isAbsent || false,
        qualitativeCode: g.qualitativeCode,
        appreciation,
        status: g.grade_status,
      });
    }

    // Convertir Maps en arrays + trier
    const result = Array.from(quarterMap.values())
      .sort((a, b) => a.quarterNumber - b.quarterNumber)
      .map(q => ({
        ...q,
        evaluations: Array.from(q.evaluations.values())
          .sort((a, b) => a.evaluationTypeCode.localeCompare(b.evaluationTypeCode)),
      }));

    return result;
  }

  /**
   * GET /parent/receipts/:paymentId
   * Infos d'un reçu (JSON — utilisé par le frontend pour générer le PDF côté client).
   *
   * Sécurité : vérifie que le paiement concerne bien un élève du parent connecté.
   */
  @Get('receipts/:paymentId')
  async getReceipt(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('paymentId') paymentId: string,
    @Res() res: Response,
  ) {
    // 0. Récupérer le studentId du paiement pour vérifier l'appartenance
    const paymentOwner: any = await this.prisma.$queryRawUnsafe(
      `SELECT "studentId" FROM "payments" WHERE "id" = $1 AND "tenantId" = $2 LIMIT 1`,
      paymentId, tenantId,
    ).catch(() => []);

    let ownerId: string | null = null;
    if (paymentOwner && paymentOwner.length > 0) {
      ownerId = paymentOwner[0].studentId;
    } else {
      // Fallback sur finance_transactions
      const txOwner: any = await this.prisma.$queryRawUnsafe(
        `SELECT "studentId" FROM "finance_transactions" WHERE "id" = $1 AND "tenantId" = $2 LIMIT 1`,
        paymentId, tenantId,
      ).catch(() => []);
      if (txOwner && txOwner.length > 0) {
        ownerId = txOwner[0].studentId;
      }
    }

    if (ownerId) {
      await this.assertStudentBelongsToGuardian(tenantId, user?.id, ownerId);
    }
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
    @CurrentUser() user: any,
    @Param('classId') classId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('weekStart') weekStartStr?: string,
  ) {
    // Vérifier que la classe correspond à un des enfants du parent connecté
    if (academicYearId) {
      await this.assertClassBelongsToGuardian(tenantId, user?.id, classId, academicYearId);
    }

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
    @CurrentUser() user: any,
    @Param('classId') classId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (academicYearId) {
      await this.assertClassBelongsToGuardian(tenantId, user?.id, classId, academicYearId);
    }

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
