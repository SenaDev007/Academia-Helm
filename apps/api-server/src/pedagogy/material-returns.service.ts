/**
 * ============================================================================
 * MATERIAL RETURNS SERVICE — Logique métier pour le suivi des retours
 * ============================================================================
 *
 * Utilise des requêtes SQL brutes ($queryRawUnsafe / $executeRawUnsafe) car
 * les nouveaux champs (returnQuantity, returnStatus, etc.) ne sont pas encore
 * régénérés dans le client Prisma. Cette approche est plus résiliente et
 * indépendante des variations du schéma Prisma.
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PuppeteerPoolService } from '../common/services/puppeteer-pool.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MaterialReturnsService {
  private readonly logger = new Logger(MaterialReturnsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly configService: ConfigService,
  ) {}

  /// Résout user.id → teacher.id (identique au pattern cahier de texte).
  private async resolveTeacherId(tenantId: string, userId: string): Promise<string | null> {
    const directTeacher: any = await this.prisma.$queryRawUnsafe(
      `SELECT "id" FROM "teachers" WHERE "id" = $1 AND "tenantId" = $2`,
      userId, tenantId,
    );
    if (directTeacher && directTeacher.length > 0) {
      return directTeacher[0].id;
    }

    const user: any = await this.prisma.$queryRawUnsafe(
      `SELECT "email" FROM "users" WHERE "id" = $1 AND "tenantId" = $2`,
      userId, tenantId,
    );
    if (user && user.length > 0 && user[0].email) {
      const teacher: any = await this.prisma.$queryRawUnsafe(
        `SELECT "id" FROM "teachers" WHERE "email" = $1 AND "tenantId" = $2`,
        user[0].email, tenantId,
      );
      if (teacher && teacher.length > 0) return teacher[0].id;
    }
    return null;
  }

  /// Récupère toutes les attributions de l'enseignant pour l'année.
  ///    Inclut le matériel, la classe, le niveau scolaire, et l'état du retour.
  async getMyAssignments(tenantId: string, userId: string, academicYearId: string) {
    const teacherId = await this.resolveTeacherId(tenantId, userId);
    if (!teacherId) {
      return { hasTeacherProfile: false, assignments: [] };
    }

    const rows: any = await this.prisma.$queryRawUnsafe(
      `SELECT
         tma.*,
         pm."name" AS "materialName",
         pm."code" AS "materialCode",
         pm."category" AS "materialCategory",
         pm."description" AS "materialDescription",
         s."name" AS "subjectName",
         sl."name" AS "schoolLevelName",
         sl."code" AS "schoolLevelCode",
         c."name" AS "className",
         c."code" AS "classCode"
       FROM "teacher_material_assignments" tma
       LEFT JOIN "pedagogical_materials" pm ON pm."id" = tma."materialId"
       LEFT JOIN "subjects" s ON s."id" = pm."subjectId"
       LEFT JOIN "school_levels" sl ON sl."id" = tma."schoolLevelId"
       LEFT JOIN "classes" c ON c."id" = tma."classId"
       WHERE tma."tenantId" = $1
         AND tma."academicYearId" = $2
         AND tma."teacherId" = $3
       ORDER BY pm."category" ASC, pm."name" ASC`,
      tenantId, academicYearId, teacherId,
    );

    return {
      hasTeacherProfile: true,
      teacherId,
      assignments: Array.isArray(rows) ? rows : [],
    };
  }

  /// Met à jour les infos de retour pour une attribution.
  ///    Rejette si l'attribution est déjà SUBMITTED/VALIDATED (verrouillage).
  async updateReturnInfo(
    tenantId: string,
    assignmentId: string,
    data: { returnQuantity?: number; returnCondition?: string; returnNotes?: string },
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT "id", "returnStatus", "quantity" FROM "teacher_material_assignments"
       WHERE "id" = $1 AND "tenantId" = $2`,
      assignmentId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Attribution non trouvée');
    }
    const row = existing[0];
    if (row.returnStatus === 'SUBMITTED' || row.returnStatus === 'VALIDATED') {
      throw new BadRequestException(
        `Impossible de modifier : retour déjà ${row.returnStatus.toLowerCase()}`,
      );
    }

    // Validation : returnQuantity ≤ quantity
    if (data.returnQuantity !== undefined && data.returnQuantity > row.quantity) {
      throw new BadRequestException(
        `returnQuantity (${data.returnQuantity}) ne peut pas dépasser la quantité attribuée (${row.quantity})`,
      );
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (data.returnQuantity !== undefined) {
      updates.push(`"returnQuantity" = $${paramIdx++}`);
      params.push(data.returnQuantity);
      updates.push(`"lostQuantity" = $${paramIdx++}`);
      params.push(row.quantity - data.returnQuantity);
    }
    if (data.returnCondition !== undefined) {
      updates.push(`"returnCondition" = $${paramIdx++}`);
      params.push(data.returnCondition);
    }
    if (data.returnNotes !== undefined) {
      updates.push(`"returnNotes" = $${paramIdx++}`);
      params.push(data.returnNotes);
    }
    updates.push(`"updatedAt" = NOW()`);

    if (updates.length === 1) return { skipped: true };

    params.push(assignmentId, tenantId);
    await this.prisma.$executeRawUnsafe(
      `UPDATE "teacher_material_assignments"
       SET ${updates.join(', ')}
       WHERE "id" = $${paramIdx++} AND "tenantId" = $${paramIdx++}`,
      ...params,
    );

    return { success: true };
  }

  /// Soumet TOUTES les attributions PENDING de l'enseignant pour l'année.
  ///    La signature est attachée à chaque ligne (pour conserver l'historique
  ///    même si la signature globale est supprimée plus tard).
  async submitReturn(
    tenantId: string,
    userId: string,
    academicYearId: string,
    signatureUrl: string,
  ) {
    const teacherId = await this.resolveTeacherId(tenantId, userId);
    if (!teacherId) {
      throw new BadRequestException(
        'Aucun profil Teacher trouvé pour cet utilisateur',
      );
    }

    // Vérifier qu'il y a au moins une attribution PENDING
    const pending: any = await this.prisma.$queryRawUnsafe(
      `SELECT "id", "quantity", "returnQuantity" FROM "teacher_material_assignments"
       WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "teacherId" = $3
         AND "returnStatus" = 'PENDING'`,
      tenantId, academicYearId, teacherId,
    );
    if (!pending || pending.length === 0) {
      throw new BadRequestException(
        'Aucune attribution en attente — toutes vos attributions ont déjà été soumises ou validées.',
      );
    }

    // Vérifier que chaque ligne a au moins returnQuantity (par défaut 0 si non renseigné)
    const result = await this.prisma.$executeRawUnsafe(
      `UPDATE "teacher_material_assignments"
       SET "returnStatus" = 'SUBMITTED',
           "returnSentAt" = NOW(),
           "returnSignatureUrl" = $4,
           "lostQuantity" = COALESCE("quantity" - COALESCE("returnQuantity", 0), "quantity"),
           "updatedAt" = NOW()
       WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "teacherId" = $3
         AND "returnStatus" = 'PENDING'`,
      tenantId, academicYearId, teacherId, signatureUrl,
    );

    this.logger.log(
      `[submitReturn] ${pending.length} attributions soumises par teacherId=${teacherId}`,
    );

    return {
      success: true,
      submittedCount: pending.length,
      message: `${pending.length} attribution(s) soumise(s) à la direction`,
    };
  }

  /// Liste les soumissions SUBMITTED en attente de validation (vue direction).
  async getPendingReturns(
    tenantId: string,
    academicYearId: string,
    schoolLevelId?: string,
  ) {
    const params: any[] = [tenantId, academicYearId];
    let schoolLevelFilter = '';
    if (schoolLevelId) {
      params.push(schoolLevelId);
      schoolLevelFilter = ` AND tma."schoolLevelId" = $${params.length}`;
    }

    const rows: any = await this.prisma.$queryRawUnsafe(
      `SELECT
         tma.*,
         pm."name" AS "materialName",
         pm."code" AS "materialCode",
         pm."category" AS "materialCategory",
         s."name" AS "subjectName",
         sl."name" AS "schoolLevelName",
         sl."code" AS "schoolLevelCode",
         c."name" AS "className",
         t."firstName" AS "teacherFirstName",
         t."lastName" AS "teacherLastName",
         t."matricule" AS "teacherMatricule"
       FROM "teacher_material_assignments" tma
       LEFT JOIN "pedagogical_materials" pm ON pm."id" = tma."materialId"
       LEFT JOIN "subjects" s ON s."id" = pm."subjectId"
       LEFT JOIN "school_levels" sl ON sl."id" = tma."schoolLevelId"
       LEFT JOIN "classes" c ON c."id" = tma."classId"
       LEFT JOIN "teachers" t ON t."id" = tma."teacherId"
       WHERE tma."tenantId" = $1
         AND tma."academicYearId" = $2
         AND tma."returnStatus" = 'SUBMITTED'
         ${schoolLevelFilter}
       ORDER BY t."lastName" ASC, t."firstName" ASC, pm."category" ASC`,
      ...params,
    );
    return Array.isArray(rows) ? rows : [];
  }

  /// Vue historique : toutes les attributions de l'année (validées ou non).
  ///    Filtrable par teacherId et classId.
  async getHistory(
    tenantId: string,
    academicYearId: string,
    teacherId?: string,
    classId?: string,
  ) {
    const params: any[] = [tenantId, academicYearId];
    let filters = '';
    if (teacherId) {
      params.push(teacherId);
      filters += ` AND tma."teacherId" = $${params.length}`;
    }
    if (classId) {
      params.push(classId);
      filters += ` AND tma."classId" = $${params.length}`;
    }

    const rows: any = await this.prisma.$queryRawUnsafe(
      `SELECT
         tma.*,
         pm."name" AS "materialName",
         pm."code" AS "materialCode",
         pm."category" AS "materialCategory",
         sl."name" AS "schoolLevelName",
         c."name" AS "className",
         t."firstName" AS "teacherFirstName",
         t."lastName" AS "teacherLastName",
         t."matricule" AS "teacherMatricule"
       FROM "teacher_material_assignments" tma
       LEFT JOIN "pedagogical_materials" pm ON pm."id" = tma."materialId"
       LEFT JOIN "school_levels" sl ON sl."id" = tma."schoolLevelId"
       LEFT JOIN "classes" c ON c."id" = tma."classId"
       LEFT JOIN "teachers" t ON t."id" = tma."teacherId"
       WHERE tma."tenantId" = $1
         AND tma."academicYearId" = $2
         ${filters}
       ORDER BY t."lastName" ASC, t."firstName" ASC, pm."category" ASC, pm."name" ASC`,
      ...params,
    );
    return Array.isArray(rows) ? rows : [];
  }

  /// La direction valide une soumission de retour.
  async validateReturn(
    tenantId: string,
    assignmentId: string,
    validatedBy: string,
    lostQuantity: number,
    lostNotes?: string,
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT "id", "returnStatus", "quantity", "returnQuantity"
       FROM "teacher_material_assignments"
       WHERE "id" = $1 AND "tenantId" = $2`,
      assignmentId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Attribution non trouvée');
    }
    if (existing[0].returnStatus !== 'SUBMITTED') {
      throw new BadRequestException(
        `Impossible de valider : statut actuel = ${existing[0].returnStatus}`,
      );
    }

    const effectiveLostQty = lostQuantity
      ?? (existing[0].quantity - (existing[0].returnQuantity ?? 0));

    await this.prisma.$executeRawUnsafe(
      `UPDATE "teacher_material_assignments"
       SET "returnStatus" = 'VALIDATED',
           "returnValidatedAt" = NOW(),
           "returnValidatedBy" = $3,
           "lostQuantity" = $4,
           "lostNotes" = COALESCE($5, "lostNotes"),
           "updatedAt" = NOW()
       WHERE "id" = $1 AND "tenantId" = $2`,
      assignmentId, tenantId, validatedBy, effectiveLostQty, lostNotes,
    );

    return { success: true, lostQuantity: effectiveLostQty };
  }

  /// La direction refuse une soumission de retour (avec motif).
  async rejectReturn(
    tenantId: string,
    assignmentId: string,
    validatedBy: string,
    rejectionReason: string,
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT "id", "returnStatus" FROM "teacher_material_assignments"
       WHERE "id" = $1 AND "tenantId" = $2`,
      assignmentId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Attribution non trouvée');
    }
    if (existing[0].returnStatus !== 'SUBMITTED') {
      throw new BadRequestException(
        `Impossible de refuser : statut actuel = ${existing[0].returnStatus}`,
      );
    }

    // Re-pass to PENDING so teacher can amend and resubmit
    await this.prisma.$executeRawUnsafe(
      `UPDATE "teacher_material_assignments"
       SET "returnStatus" = 'PENDING',
           "returnRejectionReason" = $3,
           "returnValidatedBy" = $4,
           "returnValidatedAt" = NOW(),
           "returnSignatureUrl" = NULL,
           "returnSentAt" = NULL,
           "updatedAt" = NOW()
       WHERE "id" = $1 AND "tenantId" = $2`,
      assignmentId, tenantId, rejectionReason, validatedBy,
    );

    return { success: true, reason: rejectionReason };
  }

  // ===========================================================================
  // NOUVEAU : LISTE DES ENSEIGNANTS PAR NIVEAU SCOLAIRE (pour Distribution)
  // ===========================================================================

  /// Renvoie les SCHOOL LEVELS (table school_levels) — référencés par subjects.schoolLevelId.
  ///    À ne pas confondre avec AcademicLevel (table pedagogy_academic_levels)
  ///    qui a des IDs différents et qui est par année scolaire.
  async getSchoolLevels(tenantId: string) {
    const rows: any = await this.prisma.$queryRawUnsafe(
      `SELECT "id", "name", "label", "code", "order", "isActive"
       FROM "school_levels"
       WHERE "tenantId" = $1
       ORDER BY "order" ASC NULLS LAST, "name" ASC`,
      tenantId,
    );
    return Array.isArray(rows) ? rows : [];
  }

  /// Liste les enseignants groupés par niveau scolaire pour l'année donnée.
  ///    Utilisé par le sous-onglet Distribution (selector enseignant dynamique).
  async getTeachersByLevel(tenantId: string, academicYearId: string) {
    const rows: any = await this.prisma.$queryRawUnsafe(
      `SELECT DISTINCT ON (t."id")
         t."id", t."firstName", t."lastName", t."email", t."matricule",
         t."schoolLevelId", sl."name" as "schoolLevelName", sl."code" as "schoolLevelCode"
       FROM "teachers" t
       LEFT JOIN "school_levels" sl ON sl."id" = t."schoolLevelId"
       LEFT JOIN "teacher_class_assignments" tca ON tca."teacherId" = t."id"
          AND tca."tenantId" = $1 AND tca."academicYearId" = $2
       WHERE t."tenantId" = $1
         AND (tca."id" IS NOT NULL OR t."schoolLevelId" IS NOT NULL)
       ORDER BY t."id", sl."name" ASC`,
      tenantId, academicYearId,
    );
    // Grouper par niveau scolaire
    const groups: Record<string, any> = {};
    for (const row of (Array.isArray(rows) ? rows : [])) {
      const levelId = row.schoolLevelId || '_no_level';
      if (!groups[levelId]) {
        groups[levelId] = {
          schoolLevelId: row.schoolLevelId,
          schoolLevelName: row.schoolLevelName || 'Sans niveau',
          schoolLevelCode: row.schoolLevelCode,
          teachers: [],
        };
      }
      groups[levelId].teachers.push({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        matricule: row.matricule,
        fullName: `${row.firstName || ''} ${row.lastName || ''}`.trim(),
      });
    }
    return Object.values(groups);
  }

  // ===========================================================================
  // NOUVEAU : SIGNATURE DE RÉCEPTION (l'enseignant confirme avoir reçu)
  // ===========================================================================

  /// Signe la réception d'une attribution (séparé du retour en fin d'année).
  ///    Le teacher appelle ça dès qu'il reçoit le matériel de la part de la direction.
  async signReceipt(
    tenantId: string,
    assignmentId: string,
    userId: string,
    signatureUrl: string,
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT "id", "signed", "signedBy" FROM "teacher_material_assignments"
       WHERE "id" = $1 AND "tenantId" = $2`,
      assignmentId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Attribution non trouvée');
    }
    if (existing[0].signed) {
      throw new BadRequestException('Réception déjà signée');
    }

    // ⭐ Conserver le userId (pas le teacher.id) dans signedBy car la FK pointe vers users.id
    await this.prisma.$executeRawUnsafe(
      `UPDATE "teacher_material_assignments"
       SET "signed" = TRUE,
           "signedAt" = NOW(),
           "signedBy" = $3,
           "updatedAt" = NOW()
       WHERE "id" = $1 AND "tenantId" = $2`,
      assignmentId, tenantId, userId,
    );

    return { success: true, signedAt: new Date() };
  }

  // ===========================================================================
  // EXPORTS PDF
  // ===========================================================================

  /// ⭐ PDF — Bon de réception de matériel pédagogique pour un enseignant
  async exportMyReceiptPdf(
    tenantId: string,
    userId: string,
    academicYearId: string,
  ): Promise<Buffer> {
    // 1. Récupérer les données + identité école
    const data = await this.getMyAssignments(tenantId, userId, academicYearId);
    if (!data.hasTeacherProfile || data.assignments.length === 0) {
      throw new BadRequestException('Aucune attribution de matériel trouvée pour cet enseignant');
    }

    const schoolInfo: any = await this.prisma.$queryRawUnsafe(
      `SELECT "schoolName", "schoolAcronym", "logoUrl"
       FROM "tenant_identity_profiles"
       WHERE "tenantId" = $1 AND "isActive" = true
       ORDER BY "version" DESC LIMIT 1`,
      tenantId,
    );

    const ayInfo: any = await this.prisma.$queryRawUnsafe(
      `SELECT "name", "label" FROM "academic_years" WHERE "id" = $1`,
      academicYearId,
    );

    const teacherInfo: any = await this.prisma.$queryRawUnsafe(
      `SELECT t."firstName", t."lastName", t."matricule", t."email", t."signatureUrl",
              c."name" as "mainClassName"
       FROM "teachers" t
       LEFT JOIN "teacher_class_assignments" tca
         ON tca."teacherId" = t."id"
         AND tca."tenantId" = $2
         AND tca."academicYearId" = $3
         AND tca."isMainTitular" = true
       LEFT JOIN "classes" c ON c."id" = tca."classId"
       WHERE t."id" = $1`,
      data.teacherId, tenantId, academicYearId,
    );

    const html = this.buildReceiptPdfHtml({
      assignments: data.assignments,
      school: schoolInfo?.[0] || {},
      academicYear: ayInfo?.[0] || {},
      teacher: teacherInfo?.[0] || {},
    });

    return this.renderPdf(html);
  }

  /// ⭐ PDF — État complet des distributions (vue direction)
  async exportDistributionPdf(
    tenantId: string,
    academicYearId: string,
    schoolLevelId?: string,
  ): Promise<Buffer> {
    const assignments = await this.getHistory(tenantId, academicYearId, undefined, undefined);

    const schoolInfo: any = await this.prisma.$queryRawUnsafe(
      `SELECT "schoolName", "schoolAcronym", "logoUrl"
       FROM "tenant_identity_profiles"
       WHERE "tenantId" = $1 AND "isActive" = true
       ORDER BY "version" DESC LIMIT 1`,
      tenantId,
    );

    const ayInfo: any = await this.prisma.$queryRawUnsafe(
      `SELECT "name", "label" FROM "academic_years" WHERE "id" = $1`,
      academicYearId,
    );

    const html = this.buildDistributionPdfHtml({
      assignments: Array.isArray(assignments) ? assignments : [],
      school: schoolInfo?.[0] || {},
      academicYear: ayInfo?.[0] || {},
      schoolLevelId,
    });

    return this.renderPdf(html);
  }

  /// ⭐ PDF — Inventaire complet du matériel pédagogique (vue direction)
  async exportInventoryPdf(
    tenantId: string,
    academicYearId: string,
  ): Promise<Buffer> {
    const materials: any = await this.prisma.$queryRawUnsafe(
      `SELECT pm.*, sl."name" as "schoolLevelName", sl."code" as "schoolLevelCode",
              s."name" as "subjectName",
              COALESCE(ms."quantityTotal", 0) as "stockTotal",
              COALESCE(ms."quantityAvailable", 0) as "stockAvailable"
       FROM "pedagogical_materials" pm
       LEFT JOIN "school_levels" sl ON sl."id" = pm."schoolLevelId"
       LEFT JOIN "subjects" s ON s."id" = pm."subjectId"
       LEFT JOIN "material_stocks" ms ON ms."materialId" = pm."id"
          AND ms."academicYearId" = $2 AND ms."tenantId" = $1
       WHERE pm."tenantId" = $1
       ORDER BY sl."name" ASC, pm."category" ASC, pm."name" ASC`,
      tenantId, academicYearId,
    );

    const schoolInfo: any = await this.prisma.$queryRawUnsafe(
      `SELECT "schoolName", "schoolAcronym", "logoUrl"
       FROM "tenant_identity_profiles"
       WHERE "tenantId" = $1 AND "isActive" = true
       ORDER BY "version" DESC LIMIT 1`,
      tenantId,
    );

    const ayInfo: any = await this.prisma.$queryRawUnsafe(
      `SELECT "name", "label" FROM "academic_years" WHERE "id" = $1`,
      academicYearId,
    );

    const html = this.buildInventoryPdfHtml({
      materials: Array.isArray(materials) ? materials : [],
      school: schoolInfo?.[0] || {},
      academicYear: ayInfo?.[0] || {},
    });

    return this.renderPdf(html);
  }

  // --- Helpers PDF ---

  /// Rend un HTML en PDF via Puppeteer
  private async renderPdf(html: string): Promise<Buffer> {
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(r => setTimeout(r, 500));
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
        headerTemplate: '<div></div>',
        footerTemplate: '<div></div>',
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  /// Renvoie l'URL du logo résolue (data: ou http:// ou chemin absolu via APP_PUBLIC_URL)
  private resolveLogoUrl(logoUrl: string | null | undefined): string {
    if (!logoUrl) return '';
    if (logoUrl.startsWith('data:') || logoUrl.startsWith('http')) return logoUrl;
    const apiBaseUrl = this.configService.get<string>('APP_PUBLIC_URL')
      || this.configService.get<string>('API_URL')
      || 'https://api.academiahelm.com';
    return `${apiBaseUrl}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`;
  }

  /// Construit l'en-tête HTML commun à tous les PDF (logo + nom école + watermark)
  ///    ⭐ Sans le bloc "Academia Helm — Système Pédagogique" à droite
  ///    (supprimé à la demande de l'utilisateur pour alléger l'en-tête).
  private buildSchoolHeader(school: any): string {
    const logoUrl = this.resolveLogoUrl(school.logoUrl);
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="logo" style="max-height:70px;max-width:200px;object-fit:contain;" />`
      : '';
    const schoolName = school.schoolName || '';
    const schoolAcronym = school.schoolAcronym || schoolName.substring(0, 3).toUpperCase();
    const watermark = schoolAcronym
      ? `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:120px;font-weight:bold;color:#e2e8f0;opacity:0.10;z-index:0;pointer-events:none;white-space:nowrap;letter-spacing:8px;">${schoolAcronym}</div>`
      : '';

    return `
      <div style="display:flex;align-items:center;border-bottom:3px solid #1e3a8a;padding-bottom:10px;margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:15px;">
          ${logoHtml}
          <div>
            <div style="font-size:18px;font-weight:bold;color:#1e3a8a;">${schoolName}</div>
            ${schoolAcronym ? `<div style="font-size:11px;color:#64748b;">${schoolAcronym}</div>` : ''}
          </div>
        </div>
      </div>
      ${watermark}
    `;
  }

  /// ⭐ Traduit une catégorie de matériel en français lisible.
  ///    Avant ce fix : le PDF affichait "BOOK" brut au lieu de "Manuel scolaire".
  private translateCategory(category: string | null | undefined): string {
    const map: Record<string, string> = {
      BOOK: 'Manuel scolaire',
      TEACHER_GUIDE: 'Guide pédagogique',
      OFFICIAL_DOCUMENT: 'Document officiel',
      DIDACTIC_SUPPORT: 'Support didactique',
      LAB_MATERIAL: 'Matériel de laboratoire',
      OTHER: 'Autre',
    };
    if (!category) return '—';
    return map[category] || category;
  }

  /// ⭐ Traduit un état (condition) en français lisible avec capitale.
  ///    Avant ce fix : "NEW" s'affichait tel quel, ou en minuscule "neuf".
  private translateCondition(condition: string | null | undefined): string {
    const map: Record<string, string> = {
      NEW: 'Neuf',
      GOOD: 'Bon état',
      USED: 'Usé',
      DAMAGED: 'Endommagé',
      LOST: 'Perdu',
    };
    if (!condition) return '—';
    return map[condition] || condition;
  }

  /// ⭐ Normalise l'année scolaire pour éviter les doublons type
  ///    "Année scolaire Année scolaire 2026-2027".
  ///    L'utilisateur a reporté ce doublon à cause de h2: "Année scolaire ${label}"
  ///    où label = "Année scolaire 2026-2027" → doublon.
  private normalizeAcademicYearLabel(ay: any): string {
    if (!ay) return '—';
    const label = ay.label || ay.name || '';
    if (!label) return '—';
    // Si le label commence déjà par "Année scolaire", ne pas re-préfixer
    return label;
  }

  /// HTML du bon de réception enseignant
  private buildReceiptPdfHtml(params: {
    assignments: any[];
    school: any;
    academicYear: any;
    teacher: any;
  }): string {
    const { assignments, school, academicYear, teacher } = params;
    const teacherName = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || '—';
    const teacherMatricule = teacher.matricule || '—';
    const teacherEmail = teacher.email || '—';
    const academicYearLabel = this.normalizeAcademicYearLabel(academicYear);

    // ⭐ Récupérer la signature de l'enseignant depuis la table teachers
    //    (champ signatureUrl) OU depuis la première attribution signée
    //    (champ returnSignatureUrl — signature apposée lors du retour).
    //    Avant ce fix : le PDF affichait juste "✓ Signé" sans l'image de signature.
    const teacherSignatureUrl = (teacher as any).signatureUrl
      || assignments.find(a => a.returnSignatureUrl)?.returnSignatureUrl
      || null;

    const rowsHtml = assignments.map((a: any, idx: number) => {
      // ⭐ Traduire la catégorie (BOOK → "Manuel scolaire") et l'état (NEW → "Neuf")
      const categoryLabel = this.translateCategory(a.materialCategory);
      const conditionLabel = this.translateCondition(a.conditionAtIssue);
      // ⭐ Afficher la classe : si l'attribution n'a pas de classId, fallback sur
      //    la classe principale du teacher (issue de la jointure).
      const className = a.className || a.teacherMainClassName || '—';
      // ⭐ Colonne Réception : trait de validation ✓ vert au lieu de case à cocher ☐
      const receptionMark = a.signed
        ? '<span style="color:#059669;font-size:14px;font-weight:bold;">✓</span>'
          + (a.signedAt ? `<br/><span style="font-size:8px;color:#64748b;">${new Date(a.signedAt).toLocaleDateString('fr-FR')}</span>` : '')
        : '<span style="color:#94a3b8;font-size:14px;">—</span>';
      return `
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${idx + 1}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;font-family:monospace;font-size:9px;">${a.materialCode || '—'}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">${a.materialName || '—'}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;font-size:9px;">${categoryLabel}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${className}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;font-weight:bold;font-size:14px;">${a.quantity || 0}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;font-size:9px;">${conditionLabel}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${receptionMark}</td>
        </tr>`;
    }).join('');

    // Date du jour
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Bon de réception — ${teacherName}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 18px; color: #1e293b; font-size: 11px; }
    h1 { font-size: 18px; color: #1e3a8a; text-align: center; margin: 0 0 4px; }
    h2 { font-size: 13px; color: #475569; text-align: center; margin: 0 0 18px; font-weight: normal; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1e3a8a; color: white; padding: 6px; font-size: 9px; font-weight: bold; text-transform: uppercase; }
    .signature-section { margin-top: 40px; display: flex; justify-content: space-between; gap: 40px; }
    .signature-block { flex: 1; text-align: center; min-height: 90px; }
    .signature-block .label { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #475569; margin-bottom: 30px; border-top: 1px solid #475569; padding-top: 4px; }
    .signature-block .name { font-weight: bold; font-size: 12px; }
    .signature-block img { max-height: 60px; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 12px; font-size: 10px; }
    .info-box strong { color: #1e3a8a; }
  </style>
</head>
<body>
  ${this.buildSchoolHeader(school)}

  <h1>BON DE RÉCEPTION DE MATÉRIEL PÉDAGOGIQUE</h1>
  <h2>${academicYearLabel}</h2>

  <div class="info-box">
    <strong>Enseignant :</strong> ${teacherName} &nbsp;|&nbsp;
    <strong>Matricule :</strong> ${teacherMatricule} &nbsp;|&nbsp;
    <strong>Email :</strong> ${teacherEmail} &nbsp;|&nbsp;
    <strong>Date d'édition :</strong> ${today}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:5%;">#</th>
        <th style="width:12%;">Code</th>
        <th style="width:30%;">Désignation</th>
        <th style="width:13%;">Catégorie</th>
        <th style="width:10%;">Classe</th>
        <th style="width:8%;">Qté</th>
        <th style="width:10%;">État</th>
        <th style="width:12%;">Réception</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="signature-section">
    <div class="signature-block">
      <div class="label">Signature de l'enseignant</div>
      ${teacherSignatureUrl
        ? `<img src="${teacherSignatureUrl}" alt="Signature enseignant" style="max-height:55px;" />
           <div class="name" style="margin-top:6px;">${teacherName}</div>
           <div style="font-size:9px;color:#64748b;margin-top:2px;">Réception signée le ${assignments[0]?.signedAt ? new Date(assignments[0].signedAt).toLocaleDateString('fr-FR') : '—'}</div>`
        : assignments[0]?.signed
          ? `<div class="name">${teacherName}</div>
             <div style="font-size:9px;color:#64748b;margin-top:4px;">Réception signée le ${assignments[0]?.signedAt ? new Date(assignments[0].signedAt).toLocaleDateString('fr-FR') : '—'}</div>`
          : `<div style="font-size:10px;color:#94a3b8;font-style:italic;">(En attente de signature)</div>`}
    </div>
    <div class="signature-block">
      <div class="label">Visa de la Direction</div>
      <div style="font-size:10px;color:#94a3b8;font-style:italic;">(Cachet et signature)</div>
    </div>
  </div>

  <div style="margin-top:30px;font-size:8px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:6px;">
    Document généré automatiquement par Academia Helm le ${today}
  </div>
</body>
</html>`;
  }

  /// HTML de l'état des distributions (vue direction)
  private buildDistributionPdfHtml(params: {
    assignments: any[];
    school: any;
    academicYear: any;
    schoolLevelId?: string;
  }): string {
    const { assignments, school, academicYear } = params;
    const academicYearLabel = this.normalizeAcademicYearLabel(academicYear);
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    // Grouper par enseignant
    const byTeacher: Record<string, any> = {};
    for (const a of assignments) {
      const key = a.teacherId || '_unknown';
      if (!byTeacher[key]) {
        byTeacher[key] = {
          teacherName: `${a.teacherFirstName || ''} ${a.teacherLastName || ''}`.trim() || '—',
          teacherMatricule: a.teacherMatricule,
          items: [],
        };
      }
      byTeacher[key].items.push(a);
    }
    const teacherGroups = Object.values(byTeacher);

    const teacherSectionsHtml = teacherGroups.map((g: any) => {
      const rowsHtml = g.items.map((a: any, idx: number) => {
        // ⭐ Traduire catégorie + état
        const categoryLabel = this.translateCategory(a.materialCategory);
        const conditionLabel = this.translateCondition(a.conditionAtIssue);
        const className = a.className || '—';
        // ⭐ Colonne Signé : trait ✓ vert au lieu de case à cocher/rectangle
        const signedMark = a.signed
          ? '<span style="color:#059669;font-weight:bold;font-size:13px;">✓</span>'
          : '<span style="color:#94a3b8;font-size:13px;">—</span>';
        return `
        <tr>
          <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:9px;">${idx + 1}</td>
          <td style="border:1px solid #cbd5e1;padding:4px;font-family:monospace;font-size:9px;">${a.materialCode || '—'}</td>
          <td style="border:1px solid #cbd5e1;padding:4px;">${a.materialName || '—'}</td>
          <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:9px;">${categoryLabel}</td>
          <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;">${className}</td>
          <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-weight:bold;">${a.quantity || 0}</td>
          <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:9px;">${a.returnQuantity ?? 0}</td>
          <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:9px;">${a.lostQuantity ?? 0}</td>
          <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;">${signedMark}</td>
        </tr>`;
      }).join('');

      return `
        <div style="margin-top:14px;">
          <div style="background:#e0e7ff;padding:5px 8px;border-radius:4px 4px 0 0;font-size:11px;font-weight:bold;color:#1e3a8a;">
            ${g.teacherName} ${g.teacherMatricule ? `<span style="font-weight:normal;color:#475569;">(matricule: ${g.teacherMatricule})</span>` : ''}
            <span style="float:right;font-weight:normal;color:#475569;font-size:9px;">${g.items.length} matériel(s)</span>
          </div>
          <table style="margin-bottom:8px;">
            <thead>
              <tr>
                <th style="width:4%;">#</th>
                <th style="width:11%;">Code</th>
                <th style="width:30%;">Désignation</th>
                <th style="width:11%;">Catégorie</th>
                <th style="width:8%;">Classe</th>
                <th style="width:8%;">Qté</th>
                <th style="width:9%;">Rendu</th>
                <th style="width:9%;">Perdu</th>
                <th style="width:10%;">Signé</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>État des distributions — ${academicYearLabel}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 18px; color: #1e293b; font-size: 11px; }
    h1 { font-size: 18px; color: #1e3a8a; text-align: center; margin: 0 0 4px; }
    h2 { font-size: 13px; color: #475569; text-align: center; margin: 0 0 18px; font-weight: normal; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1e3a8a; color: white; padding: 4px; font-size: 9px; font-weight: bold; text-transform: uppercase; }
  </style>
</head>
<body>
  ${this.buildSchoolHeader(school)}

  <h1>ÉTAT DES DISTRIBUTIONS DE MATÉRIEL PÉDAGOGIQUE</h1>
  <h2>${academicYearLabel} — ${assignments.length} attribution(s) au total</h2>

  ${teacherGroups.length === 0 ? '<p style="text-align:center;color:#94a3b8;">Aucune distribution enregistrée pour cette année.</p>' : teacherSectionsHtml}

  <div style="margin-top:30px;font-size:8px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:6px;">
    Document généré automatiquement par Academia Helm le ${today}
  </div>
</body>
</html>`;
  }

  /// HTML de l'inventaire complet (vue direction)
  private buildInventoryPdfHtml(params: {
    materials: any[];
    school: any;
    academicYear: any;
  }): string {
    const { materials, school, academicYear } = params;
    const academicYearLabel = this.normalizeAcademicYearLabel(academicYear);
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    const rowsHtml = materials.map((m: any, idx: number) => `
      <tr>
        <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">${idx + 1}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;font-family:monospace;font-size:9px;">${m.code || '—'}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;font-weight:bold;">${m.name || '—'}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-size:9px;">${this.translateCategory(m.category)}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-size:9px;">${m.schoolLevelName || '—'}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-size:9px;">${m.subjectName || '—'}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-weight:bold;font-size:13px;">${m.stockTotal || 0}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-weight:bold;color:#059669;font-size:13px;">${m.stockAvailable || 0}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-weight:bold;color:#dc2626;font-size:13px;">${(m.stockTotal || 0) - (m.stockAvailable || 0)}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-size:9px;">${m.isActive ? 'Actif' : 'Inactif'}</td>
      </tr>`).join('');

    const totalStock = materials.reduce((sum: number, m: any) => sum + (m.stockTotal || 0), 0);
    const totalAvailable = materials.reduce((sum: number, m: any) => sum + (m.stockAvailable || 0), 0);
    const totalDistributed = totalStock - totalAvailable;

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Inventaire matériel — ${academicYearLabel}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 18px; color: #1e293b; font-size: 11px; }
    h1 { font-size: 18px; color: #1e3a8a; text-align: center; margin: 0 0 4px; }
    h2 { font-size: 13px; color: #475569; text-align: center; margin: 0 0 18px; font-weight: normal; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1e3a8a; color: white; padding: 5px; font-size: 9px; font-weight: bold; text-transform: uppercase; }
    .stats { display: flex; gap: 12px; margin-bottom: 14px; }
    .stat-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; text-align: center; }
    .stat-card .label { font-size: 9px; color: #475569; text-transform: uppercase; font-weight: bold; }
    .stat-card .value { font-size: 20px; font-weight: bold; color: #1e3a8a; }
  </style>
</head>
<body>
  ${this.buildSchoolHeader(school)}

  <h1>INVENTAIRE DU MATÉRIEL PÉDAGOGIQUE</h1>
  <h2>${academicYearLabel} — ${materials.length} référence(s)</h2>

  <div class="stats">
    <div class="stat-card"><div class="label">Stock total</div><div class="value">${totalStock}</div></div>
    <div class="stat-card"><div class="label">Disponible</div><div class="value" style="color:#059669;">${totalAvailable}</div></div>
    <div class="stat-card"><div class="label">Distribué</div><div class="value" style="color:#dc2626;">${totalDistributed}</div></div>
  </div>

  ${materials.length === 0
    ? '<p style="text-align:center;color:#94a3b8;">Aucun matériel enregistré pour cette année.</p>'
    : `<table>
        <thead>
          <tr>
            <th style="width:4%;">#</th>
            <th style="width:11%;">Code</th>
            <th style="width:25%;">Désignation</th>
            <th style="width:11%;">Catégorie</th>
            <th style="width:10%;">Niveau</th>
            <th style="width:10%;">Matière</th>
            <th style="width:8%;">Stock</th>
            <th style="width:8%;">Dispo.</th>
            <th style="width:8%;">Distrib.</th>
            <th style="width:5%;">État</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>`}

  <div style="margin-top:30px;font-size:8px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:6px;">
    Document généré automatiquement par Academia Helm le ${today}
  </div>
</body>
</html>`;
  }

  // ===========================================================================
  // COMPARAISON REÇU vs RENDU (suivi des retours)
  // ===========================================================================

  /// ⭐ Comparaison automatique : pour chaque enseignant, calcule :
  ///    - totalReceived : somme des quantités attribuées
  ///    - totalReturned : somme des returnQuantity
  ///    - totalLost : somme des lostQuantity (matériel non rendu)
  ///    - difference : totalReceived - totalReturned - totalLost (devrait = 0 si OK)
  ///    - status : COMPLET (tout rendu) / PARTIEL (partiellement rendu) /
  ///               PERTE (matériel perdu) / NON_RETOURNE (rien rendu) /
  ///               EN_ATTENTE (aucun retour soumis)
  ///    - returnStatus : PENDING/SUBMITTED/VALIDATED (statut global)
  async getReturnComparison(
    tenantId: string,
    academicYearId: string,
    schoolLevelId?: string,
  ) {
    const params: any[] = [tenantId, academicYearId];
    let levelFilter = '';
    if (schoolLevelId) {
      params.push(schoolLevelId);
      levelFilter = ` AND tma."schoolLevelId" = $${params.length}`;
    }

    const rows: any = await this.prisma.$queryRawUnsafe(
      `SELECT
         tma."teacherId",
         t."firstName" AS "teacherFirstName",
         t."lastName" AS "teacherLastName",
         t."matricule" AS "teacherMatricule",
         t."email" AS "teacherEmail",
         sl."name" AS "schoolLevelName",
         COUNT(*) AS "itemsCount",
         COALESCE(SUM(tma."quantity"), 0) AS "totalReceived",
         COALESCE(SUM(tma."returnQuantity"), 0) AS "totalReturned",
         COALESCE(SUM(tma."lostQuantity"), 0) AS "totalLost",
         COUNT(*) FILTER (WHERE tma."signed" = true) AS "signedCount",
         COUNT(*) FILTER (WHERE tma."returnStatus" = 'SUBMITTED') AS "submittedCount",
         COUNT(*) FILTER (WHERE tma."returnStatus" = 'VALIDATED') AS "validatedCount",
         COUNT(*) FILTER (WHERE tma."returnStatus" = 'PENDING') AS "pendingCount"
       FROM "teacher_material_assignments" tma
       LEFT JOIN "teachers" t ON t."id" = tma."teacherId"
       LEFT JOIN "school_levels" sl ON sl."id" = tma."schoolLevelId"
       WHERE tma."tenantId" = $1
         AND tma."academicYearId" = $2
         ${levelFilter}
       GROUP BY tma."teacherId", t."firstName", t."lastName", t."matricule", t."email", sl."name"
       ORDER BY t."lastName" ASC, t."firstName" ASC`,
      ...params,
    );

    const result = (Array.isArray(rows) ? rows : []).map((r: any) => {
      const totalReceived = Number(r.totalReceived) || 0;
      const totalReturned = Number(r.totalReturned) || 0;
      const totalLost = Number(r.totalLost) || 0;
      const difference = totalReceived - totalReturned - totalLost;

      // Déterminer le statut
      let status: string;
      let statusColor: string;
      if (totalReceived === 0) {
        status = 'AUCUN';
        statusColor = 'bg-slate-100 text-slate-700';
      } else if (r.pendingCount > 0 && r.submittedCount === 0 && r.validatedCount === 0) {
        // Tout est PENDING → l'enseignant n'a pas encore soumis de retour
        status = 'EN_ATTENTE';
        statusColor = 'bg-amber-100 text-amber-700';
      } else if (totalReturned === 0 && totalLost === 0) {
        // Rien rendu, mais des soumissions ont été faites (et peut-être rejetées)
        status = 'NON_RETOURNE';
        statusColor = 'bg-rose-100 text-rose-700';
      } else if (totalLost > 0) {
        // Matériel perdu
        status = 'PERTE';
        statusColor = 'bg-rose-100 text-rose-700';
      } else if (totalReturned >= totalReceived) {
        // Tout rendu
        status = 'COMPLET';
        statusColor = 'bg-emerald-100 text-emerald-700';
      } else {
        // Partiellement rendu
        status = 'PARTIEL';
        statusColor = 'bg-amber-100 text-amber-700';
      }

      return {
        teacherId: r.teacherId,
        teacherName: `${r.teacherFirstName || ''} ${r.teacherLastName || ''}`.trim() || '—',
        teacherMatricule: r.teacherMatricule,
        teacherEmail: r.teacherEmail,
        schoolLevelName: r.schoolLevelName,
        itemsCount: Number(r.itemsCount) || 0,
        totalReceived,
        totalReturned,
        totalLost,
        difference,
        signedCount: Number(r.signedCount) || 0,
        submittedCount: Number(r.submittedCount) || 0,
        validatedCount: Number(r.validatedCount) || 0,
        pendingCount: Number(r.pendingCount) || 0,
        status,
        statusColor,
      };
    });

    // Statistiques globales
    const totals = {
      teachersCount: result.length,
      totalReceived: result.reduce((s: number, r: any) => s + r.totalReceived, 0),
      totalReturned: result.reduce((s: number, r: any) => s + r.totalReturned, 0),
      totalLost: result.reduce((s: number, r: any) => s + r.totalLost, 0),
      completeCount: result.filter((r: any) => r.status === 'COMPLET').length,
      partialCount: result.filter((r: any) => r.status === 'PARTIEL').length,
      lostCount: result.filter((r: any) => r.status === 'PERTE').length,
      notReturnedCount: result.filter((r: any) => r.status === 'NON_RETOURNE').length,
      pendingCount: result.filter((r: any) => r.status === 'EN_ATTENTE').length,
    };

    return { comparisons: result, totals };
  }

  /// ⭐ PDF — Rapport de comparaison reçu vs rendu
  async exportComparisonPdf(
    tenantId: string,
    academicYearId: string,
    schoolLevelId?: string,
  ): Promise<Buffer> {
    const { comparisons, totals } = await this.getReturnComparison(tenantId, academicYearId, schoolLevelId);

    const schoolInfo: any = await this.prisma.$queryRawUnsafe(
      `SELECT "schoolName", "schoolAcronym", "logoUrl"
       FROM "tenant_identity_profiles"
       WHERE "tenantId" = $1 AND "isActive" = true
       ORDER BY "version" DESC LIMIT 1`,
      tenantId,
    );

    const ayInfo: any = await this.prisma.$queryRawUnsafe(
      `SELECT "name", "label" FROM "academic_years" WHERE "id" = $1`,
      academicYearId,
    );

    const html = this.buildComparisonPdfHtml({
      comparisons,
      totals,
      school: schoolInfo?.[0] || {},
      academicYear: ayInfo?.[0] || {},
    });

    return this.renderPdf(html);
  }

  /// HTML du rapport de comparaison
  private buildComparisonPdfHtml(params: {
    comparisons: any[];
    totals: any;
    school: any;
    academicYear: any;
  }): string {
    const { comparisons, totals, school, academicYear } = params;
    const academicYearLabel = this.normalizeAcademicYearLabel(academicYear);
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    // Map statut → label français + couleur
    const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
      COMPLET: { label: 'Complet', color: '#059669' },
      PARTIEL: { label: 'Partiel', color: '#d97706' },
      PERTE: { label: 'Perte', color: '#dc2626' },
      NON_RETOURNE: { label: 'Non retourné', color: '#dc2626' },
      EN_ATTENTE: { label: 'En attente', color: '#d97706' },
      AUCUN: { label: 'Aucun matériel', color: '#64748b' },
    };

    const rowsHtml = comparisons.map((c: any, idx: number) => {
      const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.AUCUN;
      return `
        <tr>
          <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">${idx + 1}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;font-weight:bold;">${c.teacherName}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-size:9px;">${c.teacherMatricule || '—'}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-size:9px;">${c.schoolLevelName || '—'}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-weight:bold;">${c.totalReceived}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-weight:bold;color:#059669;">${c.totalReturned}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-weight:bold;color:#dc2626;">${c.totalLost}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">${c.difference}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">
            <span style="color:${cfg.color};font-weight:bold;font-size:10px;">${cfg.label}</span>
          </td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Comparaison des retours — ${academicYearLabel}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 18px; color: #1e293b; font-size: 11px; }
    h1 { font-size: 18px; color: #1e3a8a; text-align: center; margin: 0 0 4px; }
    h2 { font-size: 13px; color: #475569; text-align: center; margin: 0 0 18px; font-weight: normal; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1e3a8a; color: white; padding: 5px; font-size: 9px; font-weight: bold; text-transform: uppercase; }
    .stats { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
    .stat-card { flex: 1; min-width: 100px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; text-align: center; }
    .stat-card .label { font-size: 8px; color: #475569; text-transform: uppercase; font-weight: bold; }
    .stat-card .value { font-size: 16px; font-weight: bold; color: #1e3a8a; }
  </style>
</head>
<body>
  ${this.buildSchoolHeader(school)}

  <h1>COMPARAISON DES RETOURS DE MATÉRIEL PÉDAGOGIQUE</h1>
  <h2>${academicYearLabel} — ${totals.teachersCount} enseignant(s) au total</h2>

  <div class="stats">
    <div class="stat-card"><div class="label">Total reçu</div><div class="value">${totals.totalReceived}</div></div>
    <div class="stat-card"><div class="label">Total rendu</div><div class="value" style="color:#059669;">${totals.totalReturned}</div></div>
    <div class="stat-card"><div class="label">Total perdu</div><div class="value" style="color:#dc2626;">${totals.totalLost}</div></div>
    <div class="stat-card"><div class="label">Complets</div><div class="value" style="color:#059669;">${totals.completeCount}</div></div>
    <div class="stat-card"><div class="label">Partiels</div><div class="value" style="color:#d97706;">${totals.partialCount}</div></div>
    <div class="stat-card"><div class="label">Pertes</div><div class="value" style="color:#dc2626;">${totals.lostCount}</div></div>
    <div class="stat-card"><div class="label">Non rendus</div><div class="value" style="color:#dc2626;">${totals.notReturnedCount}</div></div>
    <div class="stat-card"><div class="label">En attente</div><div class="value" style="color:#d97706;">${totals.pendingCount}</div></div>
  </div>

  ${comparisons.length === 0
    ? '<p style="text-align:center;color:#94a3b8;">Aucune distribution enregistrée pour cette année.</p>'
    : `<table>
        <thead>
          <tr>
            <th style="width:4%;">#</th>
            <th style="width:22%;">Enseignant</th>
            <th style="width:10%;">Matricule</th>
            <th style="width:10%;">Niveau</th>
            <th style="width:10%;">Reçu</th>
            <th style="width:10%;">Rendu</th>
            <th style="width:10%;">Perdu</th>
            <th style="width:8%;">Écart</th>
            <th style="width:16%;">Statut</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>`}

  <div style="margin-top:30px;font-size:8px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:6px;">
    Document généré automatiquement par Academia Helm le ${today}
  </div>
</body>
</html>`;
  }
}
