import {
  Controller, Get, Post, Patch, Param, Query, Body,
  UseGuards, Res, ForbiddenException, Headers, NotFoundException,
} from '@nestjs/common';
import { BulletinsService } from './services/bulletins.service';
import { BulletinPdfService } from './services/bulletin-pdf.service';
import { PrismaService } from '../../database/prisma.service';
// ⭐ 2026-09-16 — Cachets (circulaire nominatif + rectangulaire) et signature
//    du directeur appliqués automatiquement sur TOUS les bulletins.
import { DocumentSealsService } from '../../settings/services/document-seals.service';
// ⭐ 2026-11-23 — Archivage des bulletins PDF (R2/S3 → URL publique) pour
//    l'envoi WhatsApp aux parents + téléchargement depuis le portail parent.
import { StorageService } from '../../common/services/storage.service';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
// ⭐ 2026-11-23 — Partage WhatsApp des bulletins : route publique /bulletin/[token]
//    (repli quand l'archive R2/S3 est indisponible).
import { Public } from '../../auth/decorators/public.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AcademicYearId } from '../../common/decorators/academic-year-id.decorator';
import { UserId } from '../../auth/decorators/user-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
// ⭐ 2026-11-23 — Identité secondaire : helper partagé (écoles combinées).
import { resolveLevelIdentityOverlay, applyLevelIdentityOverlay } from '../../common/context/resolve-level-identity';
import * as crypto from 'crypto';

@Controller('institutional-exams/bulletins')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class BulletinsController {
  constructor(
    private readonly bulletinsService: BulletinsService,
    private readonly pdfService: BulletinPdfService,
    private readonly prisma: PrismaService,
    private readonly documentSealsService: DocumentSealsService,
    private readonly storageService: StorageService,
  ) {}

  @Get('class/:classId')
  @Permissions('exams.read')
  async getClassBulletins(
    @Param('classId') classId: string,
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @Query('periodId') periodId: string,
  ) {
    return this.bulletinsService.getClassBulletins(tenantId, academicYearId, periodId, classId);
  }

  @Post('class/:classId/generate')
  @Permissions('exams.manage')
  async generate(
    @Param('classId') classId: string,
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @Body('periodId') periodId: string,
  ) {
    return this.bulletinsService.generateClassAverages(tenantId, academicYearId, periodId, classId);
  }

  @Patch('class/:classId/publish')
  @Permissions('exams.publish')
  async publish(
    @Param('classId') classId: string,
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @Body('periodId') periodId: string,
    @UserId() userId: string,
  ) {
    return this.bulletinsService.publishClassBulletins(tenantId, academicYearId, periodId, classId, userId);
  }

  // ============================================================================
  // ⭐ WORKFLOW DE SIGNATURE + DISTRIBUTION DES BULLETINS
  // ============================================================================

  /**
   * Étape 1 : Le directeur/promoteur signe TOUS les bulletins d'une classe
   * POST /institutional-exams/bulletins/class/:classId/director-sign
   * Body: { periodId, signature (base64) }
   */
  @Post('class/:classId/director-sign')
  @Permissions('exams.publish')
  async directorSignAll(
    @Param('classId') classId: string,
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @UserId() userId: string,
    @Body() body: {
      periodId: string;
      signature: string;
      evaluationTypeId?: string;
      evaluationTypeName?: string;
      evaluationTypeCode?: string;
    },
  ) {
    return this.bulletinsService.directorSignAllBulletins(
      tenantId, academicYearId, body.periodId, classId, body.signature, userId,
      {
        evaluationTypeId: body.evaluationTypeId,
        evaluationTypeName: body.evaluationTypeName,
        evaluationTypeCode: body.evaluationTypeCode,
      },
    );
  }

  /**
   * Étape 2 : Le directeur/promoteur active (distribue) les bulletins aux enseignants
   * POST /institutional-exams/bulletins/class/:classId/activate
   * Body: { periodId }
   */
  @Post('class/:classId/activate')
  @Permissions('exams.publish')
  async activateForTeachers(
    @Param('classId') classId: string,
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @UserId() userId: string,
    @Body() body: { periodId: string },
  ) {
    return this.bulletinsService.activateBulletinsForTeachers(
      tenantId, academicYearId, body.periodId, classId, userId,
    );
  }

  /**
   * Étape 3 : L'enseignant signe TOUS les bulletins de sa classe
   * POST /institutional-exams/bulletins/class/:classId/teacher-sign
   * Body: { periodId, signature (base64), evaluationTypeId? }
   *
   * ⭐ Si evaluationTypeId est fourni, seuls les bulletins de ce type d'éval sont signés.
   *    Sinon, tous les bulletins TEACHER_DISTRIBUTED de la classe sont signés (rétro-compat).
   */
  @Post('class/:classId/teacher-sign')
  @Permissions('exams.manage')
  async teacherSignAll(
    @Param('classId') classId: string,
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @UserId() userId: string,
    @Body() body: { periodId: string; signature: string; evaluationTypeId?: string },
  ) {
    return this.bulletinsService.teacherSignAllBulletins(
      tenantId, academicYearId, body.periodId, classId, body.signature, userId,
      body.evaluationTypeId,
    );
  }

  /**
   * Étape 4 : L'enseignant renvoie les bulletins au directeur
   * POST /institutional-exams/bulletins/class/:classId/teacher-return
   * Body: { periodId, evaluationTypeId? }
   *
   * ⭐ Si evaluationTypeId est fourni, seuls les bulletins de ce type d'éval sont renvoyés.
   */
  @Post('class/:classId/teacher-return')
  @Permissions('exams.manage')
  async teacherReturn(
    @Param('classId') classId: string,
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @UserId() userId: string,
    @Body() body: { periodId: string; evaluationTypeId?: string },
  ) {
    return this.bulletinsService.teacherReturnBulletins(
      tenantId, academicYearId, body.periodId, classId, userId,
      body.evaluationTypeId,
    );
  }

  /**
   * Étape 5 : Le directeur envoie les bulletins aux parents
   * POST /institutional-exams/bulletins/class/:classId/send-to-parents
   * Body: { periodId, criteria?: { blockIfArrears?, minPaymentPercentage? } }
   * Si criteria n'est pas fourni, utilise les critères configurés pour le tenant.
   */
  @Post('class/:classId/send-to-parents')
  @Permissions('exams.publish')
  async sendToParents(
    @Param('classId') classId: string,
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @UserId() userId: string,
    @Body() body: { periodId: string; criteria?: { blockIfArrears?: boolean; minPaymentPercentage?: number } },
  ) {
    // ⭐ Si aucun criteria n'est fourni dans le body, charger les critères configurés
    let criteria = body.criteria;
    if (!criteria) {
      const config = await this.bulletinsService.getSendingCriteria(tenantId);
      criteria = {
        blockIfArrears: config.blockIfArrears,
        minPaymentPercentage: config.minPaymentPercentage,
      };
    }
    return this.bulletinsService.sendBulletinsToParents(
      tenantId, academicYearId, body.periodId, classId, userId, criteria,
    );
  }

  /**
   * GET /institutional-exams/bulletins/class/:classId/workflow-status?periodId=X
   * Récupère le statut du workflow pour une classe + période
   */
  @Get('class/:classId/workflow-status')
  @Permissions('exams.read')
  async getWorkflowStatus(
    @Param('classId') classId: string,
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @Query('periodId') periodId: string,
  ) {
    return this.bulletinsService.getWorkflowStatus(tenantId, academicYearId, periodId, classId);
  }

  /**
   * GET /institutional-exams/bulletins/sending-criteria
   * Récupère les critères d'envoi des bulletins configurés pour le tenant
   */
  @Get('sending-criteria')
  @Permissions('exams.read')
  async getSendingCriteria(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    return this.bulletinsService.getSendingCriteria(resolvedTenantId);
  }

  /**
   * PUT /institutional-exams/bulletins/sending-criteria
   * Met à jour les critères d'envoi des bulletins
   */
  @Patch('sending-criteria')
  @Permissions('exams.publish')
  async updateSendingCriteria(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @Body() body: any,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    return this.bulletinsService.updateSendingCriteria(resolvedTenantId, body, user?.id);
  }

  // ============================================================================
  // ⭐ ANNOTATIONS PAR ÉLÈVE (page 2 du carnet)
  // ============================================================================

  /**
   * GET /institutional-exams/bulletins/annotations?studentId=X&periodId=Y
   * Récupère les annotations sauvegardées pour un élève
   */
  @Get('annotations')
  @Permissions('exams.read')
  async getAnnotations(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @AcademicYearId() academicYearId: string,
    @Query('studentId') studentId: string,
    @Query('periodId') periodId: string,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    return this.bulletinsService.getAnnotations(resolvedTenantId, academicYearId, periodId, studentId);
  }

  /**
   * PATCH /institutional-exams/bulletins/annotations
   * Sauvegarde les annotations d'un élève (assiduité, discipline, etc.)
   * Body: { studentId, periodId, assiduite?, discipline?, defautsMajeurs?,
   *         qualitesRemarquables?, analyseRecommandations?, directorVisa?,
   *         enTeacherComment?, enDirectorComment?, enAffectiveAssessment?,
   *         enPsychomotorAssessment? }
   */
  @Patch('annotations')
  @Permissions('exams.manage')
  async saveAnnotations(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @AcademicYearId() academicYearId: string,
    @UserId() userId: string,
    @Body() body: {
      studentId: string;
      periodId: string;
      assiduite?: string;
      discipline?: string;
      defautsMajeurs?: string;
      qualitesRemarquables?: string;
      analyseRecommandations?: string;
      directorVisa?: string;
      // ⭐ Champs anglophones
      enTeacherComment?: string;
      enDirectorComment?: string;
      enAffectiveAssessment?: string;
      enPsychomotorAssessment?: string;
    },
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    const { studentId, periodId, ...data } = body;
    return this.bulletinsService.saveAnnotations(
      resolvedTenantId, academicYearId, periodId, studentId, data, userId,
    );
  }

  /**
   * GET /institutional-exams/bulletins/auto-annotations?studentId=X&periodId=Y
   * ⭐ IA Auto-fill: Génère automatiquement les annotations basées sur
   * l'assiduité et les performances de l'élève
   */
  @Get('auto-annotations')
  @Permissions('exams.read')
  async autoGenerateAnnotations(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @AcademicYearId() academicYearId: string,
    @Query('studentId') studentId: string,
    @Query('periodId') periodId: string,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    return this.bulletinsService.autoGenerateAnnotations(
      resolvedTenantId, academicYearId, periodId, studentId,
    );
  }

  /**
   * GET /institutional-exams/bulletins/teacher-bulletins?periodId=Y
   * ⭐ Récupère les bulletins distribués à l'enseignant connecté
   * (pour ses classes uniquement) — groupés par classe.
   *
   * Retourne :
   *   - `bulletins` : liste complète des bulletins (avec classId pour chacun)
   *   - `classes` : résumé par classe (id, name, total, counts par statut,
   *     currentStatus) — pour afficher directement la liste des classes
   *     sans avoir à rappeler workflow-status pour chaque classe.
   */
  @Get('teacher-bulletins')
  @Permissions('exams.read')
  async getTeacherBulletins(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @AcademicYearId() academicYearId: string,
    @Query('periodId') periodId: string,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    const userId = user?.id;

    // ⭐ Resolve user.id → Teacher.id via email matching
    //    (same pattern as evaluations.service.ts and pedagogical-space.service.ts)
    //    The teachers table does NOT have a userId column — the link is by email.
    let teacherId: string | null = null;
    if (userId) {
      const userRow = await this.prisma.user.findFirst({
        where: { id: userId, tenantId: resolvedTenantId },
        select: { email: true },
      }).catch(() => null);

      if (userRow?.email) {
        const teacherRow = await this.prisma.teacher.findFirst({
          where: { email: userRow.email, tenantId: resolvedTenantId },
          select: { id: true },
        }).catch(() => null);
        teacherId = teacherRow?.id || null;
      }
    }

    // Get classes assigned to this teacher via TeacherClassAssignment
    let teacherClassIds: string[] = [];
    if (teacherId) {
      const assignments = await this.prisma.teacherClassAssignment.findMany({
        where: { teacherId: teacherId, tenantId: resolvedTenantId },
        select: { classId: true },
      }).catch(() => []);
      teacherClassIds = Array.from(new Set(
        assignments.map(a => a.classId).filter(Boolean) as string[]
      ));
    }

    // Build a map classId → className for fast lookup
    const classNameMap = new Map<string, string>();
    if (teacherClassIds.length > 0) {
      const classes = await this.prisma.class.findMany({
        where: { id: { in: teacherClassIds }, tenantId: resolvedTenantId },
        select: { id: true, name: true },
      }).catch(() => []);
      classes.forEach(c => classNameMap.set(c.id, c.name));
    }

    if (teacherClassIds.length === 0) {
      return {
        bulletins: [],
        classes: [],
        total: 0,
        message: 'Aucune classe assignée à cet enseignant.',
      };
    }

    // Get report cards with TEACHER_DISTRIBUTED or TEACHER_SIGNED status
    // (or any status if we want a complete workflow view)
    // ⭐ On récupère TOUS les bulletins (tous statuts) pour pouvoir afficher
    //    le workflow complet, mais on ne garde que les classes qui ont au moins
    //    un bulletin en TEACHER_DISTRIBUTED ou TEACHER_SIGNED (les "actifs").
    const allBulletins = await this.prisma.reportCard.findMany({
      where: {
        tenantId: resolvedTenantId,
        academicYearId,
        quarterId: periodId,
        student: {
          studentEnrollments: {
            some: { classId: { in: teacherClassIds }, academicYearId, tenantId: resolvedTenantId },
          },
        },
      },
      include: {
        student: {
          select: {
            id: true, firstName: true, lastName: true, matricule: true, gender: true,
            // Récupérer l'enrollment pour résoudre la classe de l'élève
            studentEnrollments: {
              where: { academicYearId, tenantId: resolvedTenantId, classId: { in: teacherClassIds } },
              select: { classId: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { student: { lastName: 'asc' } },
    });

    // Build the bulletins list with classId resolved
    const bulletinsWithClass = allBulletins.map(b => {
      const enrollment = b.student.studentEnrollments?.[0];
      const classId = enrollment?.classId || '';
      return {
        id: b.id,
        studentId: b.studentId,
        studentName: `${b.student.lastName} ${b.student.firstName}`,
        matricule: b.student.matricule,
        status: b.status,
        classId,
        className: classNameMap.get(classId) || '',
        // ⭐ Infos du type d'évaluation (peuvent être null pour les anciens bulletins)
        evaluationTypeId: (b as any).evaluationTypeId || null,
        evaluationTypeName: (b as any).evaluationTypeName || null,
        evaluationTypeCode: (b as any).evaluationTypeCode || null,
        directorSignedAt: b.directorSignedAt,
        distributedAt: b.distributedToTeacherAt,
        teacherSignedAt: b.teacherSignedAt,
        directorSignature: b.directorSignature,
        teacherSignature: b.teacherSignature,
      };
    }).filter(b => b.classId); // ne garder que ceux dont on a pu résoudre la classe

    // ⭐ Build per-(class, evaluationType) summary — group by classId + evaluationTypeId
    //    Chaque entrée = un type d'évaluation distinct pour une classe (ex: "EM1 - CI A", "EC - CI A")
    const groupsMap = new Map<string, {
      classId: string;
      className: string;
      evaluationTypeId: string | null;
      evaluationTypeName: string;
      evaluationTypeCode: string;
      total: number;
      counts: Record<string, number>;
    }>();

    for (const b of bulletinsWithClass) {
      // Clé de groupe : classId + evaluationTypeId (ou 'NONE' si null)
      const evalTypeIdKey = b.evaluationTypeId || 'NONE';
      const groupKey = `${b.classId}|${evalTypeIdKey}`;
      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          classId: b.classId,
          className: b.className,
          evaluationTypeId: b.evaluationTypeId,
          evaluationTypeName: b.evaluationTypeName || 'Bulletin',
          evaluationTypeCode: b.evaluationTypeCode || '',
          total: 0,
          counts: {
            DRAFT: 0, DIRECTOR_SIGNED: 0, TEACHER_DISTRIBUTED: 0,
            TEACHER_SIGNED: 0, TEACHER_RETURNED: 0, PARENT_SENT: 0, BLOCKED: 0,
          },
        });
      }
      const c = groupsMap.get(groupKey)!;
      c.total += 1;
      if (c.counts[b.status] !== undefined) c.counts[b.status] += 1;
    }

    // Build final groups list with currentStatus — ne garder que les groupes
    // qui ont au moins un bulletin TEACHER_DISTRIBUTED ou TEACHER_SIGNED
    const classes = Array.from(groupsMap.values())
      .filter(c => c.counts.TEACHER_DISTRIBUTED > 0 || c.counts.TEACHER_SIGNED > 0)
      .map(c => {
        const currentStatus =
          c.counts.PARENT_SENT > 0 ? 'PARENT_SENT' :
          c.counts.BLOCKED > 0 ? 'BLOCKED' :
          c.counts.TEACHER_RETURNED > 0 ? 'TEACHER_RETURNED' :
          c.counts.TEACHER_SIGNED > 0 ? 'TEACHER_SIGNED' :
          c.counts.TEACHER_DISTRIBUTED > 0 ? 'TEACHER_DISTRIBUTED' :
          c.counts.DIRECTOR_SIGNED > 0 ? 'DIRECTOR_SIGNED' :
          'DRAFT';
        return { ...c, currentStatus };
      })
      // ⭐ Tri : par classe puis par nom du type d'évaluation
      .sort((a, b) => {
        const cmp = a.className.localeCompare(b.className, 'fr');
        if (cmp !== 0) return cmp;
        return a.evaluationTypeName.localeCompare(b.evaluationTypeName, 'fr');
      });

    return {
      bulletins: bulletinsWithClass,
      classes,
      total: bulletinsWithClass.length,
    };
  }

  @Get('download/:studentId')
  @Permissions('exams.read')
  async downloadBulletin(
    @Param('studentId') studentId: string,
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @Query('periodId') periodId: string,
    @Res() res: Response,
  ) {
    // 1. VÉRIFICATION FINANCIÈRE (BLOQUAGE SI ARRIÉRÉS)
    const account = await this.prisma.studentAccount.findUnique({
      where: { studentId_academicYearId: { studentId, academicYearId } }
    });

    if (account && (Number(account.arrearsAmount) > 0 || account.isBlocked)) {
      throw new ForbiddenException('Accès au bulletin bloqué : Arriérés de scolarité détectés.');
    }

    // 2. RÉCUPÉRATION DES DONNÉES DU BULLETIN
    const bulletinData = await this.bulletinsService.getBulletinFullData(tenantId, academicYearId, periodId, studentId);

    // ⭐ 2026-09-16 — Cachets + signature du directeur appliqués automatiquement
    //    (cachet circulaire nominatif DIRECTEUR + cachet rectangulaire nom/poste
    //    + signature — même moteur que RH > Administration). Non bloquant.
    let directorSeals: {
      nominativeCircularDataUrl: string | null;
      nominativeRectangularDataUrl: string | null;
    } = { nominativeCircularDataUrl: null, nominativeRectangularDataUrl: null };
    try {
      const enrollment = await this.prisma.studentEnrollment.findFirst({
        where: { studentId, academicYearId, tenantId },
        select: { schoolLevelId: true },
      }).catch(() => null);
      const seals = await this.documentSealsService.getDirectorSeals(
        tenantId, enrollment?.schoolLevelId ?? null, 'FR',
      );
      directorSeals = {
        nominativeCircularDataUrl: seals.nominativeCircularDataUrl,
        nominativeRectangularDataUrl: seals.nominativeRectangularDataUrl,
      };
      (bulletinData as any).directorName = (bulletinData as any).directorName || seals.holderName;
      (bulletinData as any).directorSignature = (bulletinData as any).directorSignature || seals.signatureDataUrl;
    } catch {
      // Silent fail — bulletin généré sans cachets
    }

    // 3. GÉNÉRATION DU PDF
    const buffer = await this.pdfService.generateBulletin({ ...bulletinData, directorSeals } as any);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=bulletin_${studentId}.pdf`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  /**
   * ⭐ POST /institutional-exams/bulletins/generate-pdf
   *
   * Génère un PDF de bulletin à partir des données envoyées par le frontend.
   * Le frontend calcule les moyennes (même pattern que registre) et envoie
   * les données structurées au backend qui génère le PDF professionnel.
   *
   * ⭐ Le backend résout automatiquement le nom de l'enseignant titulaire
   *    de la classe de l'élève (via TeacherClassAssignment → Teacher).
   *    Le frontend n'a pas besoin de l'envoyer.
   *
   * Body: BulletinPdfData (toutes les données du bulletin)
   * Response: PDF binaire (application/pdf)
   */
  @Post('generate-pdf')
  @Permissions('exams.read')
  async generateBulletinPdf(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @AcademicYearId() academicYearId: string,
    @Body() body: any,
    @Res() res: Response,
  ) {
    // ⭐ Robust tenantId resolution (same pattern as exams-prisma.controller)
    const resolvedTenantId = tenantId || user?.tenantId || user?.tenant_id || headers?.['x-tenant-id'] || headers?.['X-Tenant-Id'];

    // ⭐ 2026-11-23 — Toute la logique de résolution (branding, titulaire,
    //    directeur, cachets, conduite, identité secondaire…) est partagée avec
    //    l'endpoint whatsapp-link via buildBulletinPdfPayload().
    const { pdfData, filename, studentId, schoolLevelId } =
      await this.buildBulletinPdfPayload(resolvedTenantId, academicYearId, body);

    const buffer = await this.pdfService.generateBulletin(pdfData);

    // ⭐ 2026-11-23 — PERSISTANCE best-effort (non bloquant) : le bulletin
    //    généré est archivé (R2/S3 → URL publique) et rattaché au ReportCard
    //    (filePath + moyenne/rang + items par matière) pour que le parent
    //    puisse le télécharger depuis son portail (bouton « PDF » de la ligne
    //    du bulletin) — exactement le document que le directeur a généré.
    try {
      await this.persistBulletinDocument(resolvedTenantId, academicYearId, pdfData, buffer, studentId, schoolLevelId);
    } catch {
      // Silent fail — le téléchargement du directeur reste servi même si l'archive échoue
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  /**
   * ⭐ POST /institutional-exams/bulletins/whatsapp-link
   *
   * Envoi du bulletin d'un élève aux parents par WhatsApp — MÊME PATTERN QUE
   * LE MODULE FINANCE / Encaissement (transactions → « lien wa.me ») :
   * message prédéfini professionnel (école, moyenne, rang, mention) + bulletin
   * PDF téléchargeable par LIEN PUBLIC. Le director UI appelle cet endpoint
   * depuis le bouton « Envoyer par WhatsApp » de chaque élève ; il reçoit :
   *   - url       : lien wa.me avec le message pré-rempli (numéro du tuteur)
   *                 → window.open → WhatsApp (app/Web du téléphone de l'école)
   *                 s'ouvre, il ne reste qu'à cliquer Envoyer — depuis le
   *                 numéro de l'école vers le numéro WhatsApp du parent
   *   - message   : le message complet (débogage/confirmation)
   *   - pdfUrl    : URL publique du PDF (incluse dans le message — le parent
   *                 le télécharge directement ; archive R2/S3, sinon repli
   *                 /bulletin/[token] valable 30 jours)
   *   ⭐ PAS d'API WhatsApp directe (retour promoteur : « nous n'utilisons pas
   *      l'API directe de WhatsApp, ça ne peut pas fonctionner par API
   *      directe ») — plus de base64 à télécharger/joindre manuellement.
   *
   * Body : même payload que POST generate-pdf (le frontend calcule les
   * moyennes — le PDF est strictement identique à celui du bouton
   * « Générer PDF »).
   */
  @Post('whatsapp-link')
  @Permissions('exams.read')
  async getWhatsAppLink(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @AcademicYearId() academicYearId: string,
    @Body() body: any,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || user?.tenant_id || headers?.['x-tenant-id'] || headers?.['X-Tenant-Id'];

    const { pdfData, filename, studentId, schoolLevelId } =
      await this.buildBulletinPdfPayload(resolvedTenantId, academicYearId, body);

    // 1. Rendre le PDF (même gabarit que « Générer PDF »)
    const buffer = await this.pdfService.generateBulletin(pdfData);

    // 2. Archiver en URL publique (R2/S3) + persister sur le ReportCard
    //    ⭐ 2026-11-23 — RETOUR PROMOTEUR : « nous n'utilisons pas l'API directe
    //       de WhatsApp, ça ne peut pas fonctionner par API directe — utilisez
    //       le même pattern que le module finance (encaissement) ». Le PDF
    //       n'est PLUS livré en base64 à télécharger/joindre manuellement :
    //       le message contient TOUJOURS un lien public de téléchargement.
    //       (a) archive R2/S3 (pdfUrl) ;
    //       (b) REPLI : si l'archive est indisponible, les octets sont stockés
    //           dans bulletin_pdf_shares avec un token public 30 jours — page
    //           /bulletin/[token] (même garantie que /receipt/[token] du
    //           module finance : le parent obtient toujours son PDF).
    let pdfUrl: string | null = null;
    try {
      const key = `bulletins/${resolvedTenantId}/${studentId || 'eleve'}/bulletin-${(body.periodId || 'periode')}${body.evaluationTypeId ? `-${body.evaluationTypeId}` : ''}.pdf`;
      const stored = await this.storageService.uploadBuffer(buffer, key);
      if (typeof stored === 'string' && /^https?:\/\//.test(stored)) pdfUrl = stored;
    } catch {
      // Storage indisponible — repli bulletin_pdf_shares ci-dessous
    }
    if (!pdfUrl && studentId) {
      try {
        const shareToken = crypto.randomBytes(24).toString('hex');
        const periodIdForShare = body.periodId || null;
        await this.prisma.bulletinPdfShare.deleteMany({
          where: { tenantId: resolvedTenantId, studentId, periodId: periodIdForShare },
        }).catch(() => null);
        await this.prisma.bulletinPdfShare.create({
          data: {
            tenantId: resolvedTenantId,
            academicYearId,
            studentId,
            periodId: periodIdForShare,
            shareToken,
            fileName: filename,
            pdf: buffer,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
        // Purge opportuniste des liens expirés (tous tenants — non bloquant)
        this.prisma.bulletinPdfShare.deleteMany({
          where: { expiresAt: { lt: new Date() } },
        }).catch(() => null);
        const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://academiahelm.com';
        pdfUrl = `${frontendUrl}/bulletin/${shareToken}`;
      } catch {
        // Silent fail — le message part sans lien de repli (rare : storage ET DB indisponibles)
      }
    }
    // ⭐ 2026-11-23 — Persistance + MARQUAGE PARENT_SENT : la direction a
    //    déclenché l'envoi du bulletin au parent (bouton « Envoyer par
    //    WhatsApp ») — le bulletin doit devenir VISIBLE dans le PORTAIL PARENT
    //    (onglet Bulletins : items par matière + bouton PDF = l'archive
    //    publique posée par persistBulletinDocument), sinon la requête parent
    //    filtre status IN (VALIDATED, PUBLISHED, PARENT_SENT) et la ligne
    //    resterait DRAFT/invisible bien qu'envoyée. Fonctionne pour toutes les
    //    pistes (FR maternelle/primaire/secondaire + EN Report Book + vues par
    //    matière trimestrielle/annuelle). Best-effort : l'échec de la
    //    persistance ne bloque JAMAIS le lien wa.me.
    let persistedReportCardId: string | null = null;
    try {
      persistedReportCardId = await this.persistBulletinDocument(
        resolvedTenantId, academicYearId, pdfData, buffer, studentId, schoolLevelId,
        // fallbackFilePath : lien public /bulletin/[token] si l'archive R2/S3
        // est indisponible — le parent conserve son bouton PDF (page publique
        // qui streame les octets depuis bulletin_pdf_shares, 30 jours).
        pdfUrl,
      );
    } catch {
      // Silent fail — l'envoi WhatsApp ne doit jamais être bloqué par la persistance
    }
    if (persistedReportCardId) {
      try {
        await this.prisma.reportCard.update({
          where: { id: persistedReportCardId },
          data: {
            status: 'PARENT_SENT',
            sentToParentAt: new Date(),
            sentToParentBy: user?.id || null,
          },
        });
      } catch {
        // Silent fail — le marquage ne bloque pas non plus le lien wa.me
      }
    }

    // 3. Contacts du tuteur (tuteur principal en priorité, sinon 1er tuteur
    //    avec téléphone — même résolution que le module Finances)
    let parentPhone: string | null = null;
    let parentName: string | null = null;
    if (studentId) {
      try {
        const sgs: any[] = await this.prisma.studentGuardian.findMany({
          where: { studentId },
          include: { guardian: { select: { firstName: true, lastName: true, phone: true, email: true } } },
        });
        const primary = sgs.find((sg: any) => sg.isPrimary && sg.guardian?.phone)
          || sgs.find((sg: any) => sg.guardian?.phone)
          || sgs.find((sg: any) => sg.isPrimary && sg.guardian);
        if (primary?.guardian) {
          parentPhone = primary.guardian.phone || null;
          parentName = `${primary.guardian.firstName || ''} ${primary.guardian.lastName || ''}`.trim() || null;
        }
      } catch {
        // Silent fail — bulletin sans tuteur renseigné
      }
    }

    // 4. Message WhatsApp prédéfini — structuré et professionnel
    //    ⭐ 2026-11-24 — TROIS correctifs promoteur :
    //      (a) FIN des emojis 📊🏅⭐ dans le texte — certains clients WhatsApp
    //          (Desktop/WebView via lien wa.me) affichent un losange « � » à
    //          la place des emojis hors plan BMP : message 100 % texte,
    //          rendu propre partout ;
    //      (b) rang accordé au sexe de l'élève — « 1ère » pour une fille
    //          (studentGender F/FEMALE), « 1er » pour un garçon ;
    //      (c) piste EN : « Position: 1st of 30 » (ordinal anglais) au lieu
    //          du « Rang : 1er » français qui restait collé au message EN.
    const isEn = body.scopeLang === 'EN';
    const isFeminine = body.studentGender === 'FEMALE' || body.studentGender === 'F';
    const isMaternelle = !!body.isMaternelle;
    const totalStudents = body.totalStudents ?? null;
    const generalAverage = typeof body.generalAverage === 'number' ? body.generalAverage : null;
    const classRank = body.classRank ?? null;
    const appreciation = body.appreciationGlobale || null;
    const scaleLabel = isEn ? '/100' : '/20';
    const avgLine = isMaternelle
      ? (appreciation ? (isEn ? `Overall result: ${appreciation}` : `Résultat global : ${appreciation}`) : null)
      : (generalAverage !== null ? (isEn ? `General average: ${Number(generalAverage).toFixed(2)}${scaleLabel}` : `Moyenne générale : ${Number(generalAverage).toFixed(2)}${scaleLabel}`) : null);
    // Ordinal français accordé (1er/1ère) et ordinal anglais (1st/2nd/3rd)
    const frOrdinal = (n: number) => (n === 1 ? (isFeminine ? '1ère' : '1er') : `${n}e`);
    const enOrdinalW = (n: number) => {
      const rem10 = n % 10, rem100 = n % 100;
      const suf = rem10 === 1 && rem100 !== 11 ? 'st'
        : rem10 === 2 && rem100 !== 12 ? 'nd'
        : rem10 === 3 && rem100 !== 13 ? 'rd' : 'th';
      return `${n}${suf}`;
    };
    const rankLine = isEn
      ? (classRank && totalStudents
        ? `Position: ${enOrdinalW(Number(classRank))} of ${totalStudents}`
        : (classRank ? `Position: ${enOrdinalW(Number(classRank))}` : null))
      : (classRank && totalStudents
        ? `Rang : ${frOrdinal(Number(classRank))} sur ${totalStudents}`
        : (classRank ? `Rang : ${frOrdinal(Number(classRank))}` : null));
    const mentionLine = !isMaternelle && appreciation
      ? (isEn ? `Mention: ${appreciation}` : `Mention : ${appreciation}`)
      : null;

    const schoolName = pdfData.schoolName || "l'établissement";
    const studentName = body.studentName || 'l\'élève';
    // ⭐ 2026-11-24 — Élision « de Élise » → « d'Élise » (même correctif que le
    //    titre PDF « Bulletin d'évaluation » — plus de « bulletin de É… »).
    const deStudent = /^[aeiouyàâéèêëîïôûùœyh]/i.test(studentName)
      ? `d'${studentName}` : `de ${studentName}`;
    const periodPart = [
      body.periodName,
      body.evaluationTypeName ? `${isEn ? 'Evaluation' : 'Évaluation'} : ${body.evaluationTypeName}` : null,
    ].filter(Boolean).join(' · ');
    const contactLine = [
      pdfData.schoolPhone ? `Tél : ${pdfData.schoolPhone}` : null,
      pdfData.schoolEmail ? `Email : ${pdfData.schoolEmail}` : null,
    ].filter(Boolean).join(' · ');

    if (isEn) {
      const message = `Hello${parentName ? ` ${parentName}` : ''},\n\n`
        + `${schoolName} — Academic year ${body.academicYearName || ''}\n\n`
        + `Please find below ${studentName}'s report card (${body.className || ''}) for ${periodPart || 'the current period'}.\n\n`
        + (avgLine ? `${avgLine}\n` : '')
        + (rankLine ? `${rankLine}\n` : '')
        + (mentionLine ? `${mentionLine}\n` : '')
        + `\nThe report card PDF (signed by the Head teacher and the class teacher) is attached to this message.`
        + (pdfUrl ? `\nYou may also download it here:\n${pdfUrl}` : '')
        + `\n\nWe remain at your disposal for any further information.\n\nKind regards,\nThe Management — ${schoolName}`;
      const phoneForWaMe = this.normalizePhoneForWaMe(parentPhone);
      return {
        url: phoneForWaMe ? `https://wa.me/${phoneForWaMe}?text=${encodeURIComponent(message)}` : '',
        phone: parentPhone,
        parentName,
        hasPhone: !!parentPhone,
        message,
        pdfUrl,
        filename,
        studentName,
      };
    }

    const message = `Bonjour${parentName ? ` ${parentName}` : ''},\n\n`
      + `${schoolName} — Année scolaire ${body.academicYearName || ''}\n\n`
      + `Nous vous transmettons le bulletin ${deStudent} (${body.className || 'classe non précisée'}) — ${periodPart || 'période courante'}.\n\n`
      + (avgLine ? `${avgLine}\n` : '')
      + (rankLine ? `${rankLine}\n` : '')
      + (mentionLine ? `${mentionLine}\n` : '')
      + `\nLe bulletin PDF, visé par le directeur et l'enseignant titulaire, est joint à ce message.`
      + (pdfUrl ? `\nVous pouvez également le télécharger ici :\n${pdfUrl}` : '')
      + `\n\nNous restons à votre disposition pour toute information complémentaire${contactLine ? ` (${contactLine})` : ''}.\n\nCordialement,\nLa Direction — ${schoolName}`;

    const phoneForWaMe = this.normalizePhoneForWaMe(parentPhone);
    return {
      url: phoneForWaMe ? `https://wa.me/${phoneForWaMe}?text=${encodeURIComponent(message)}` : '',
      phone: parentPhone,
      parentName,
      hasPhone: !!parentPhone,
      message,
      pdfUrl,
      filename,
      studentName,
    };
  }

  /**
   * ⭐ 2026-11-23 — GET /institutional-exams/bulletins/public/:token — PUBLIC
   *
   * Sert le PDF d'un bulletin partagé via WhatsApp (page publique
   * /bulletin/[token] — même pattern que /receipt/[token]/[id] du module
   * finance). Utilisé en REPLI quand l'archive R2/S3 est indisponible :
   * whatsapp-link stocke alors les octets dans bulletin_pdf_shares avec un
   * token secret (hex 48, expiration 30 jours) et met ce lien dans le
   * message — le parent obtient toujours son PDF.
   *
   * ⚠️ POST /whatsapp-send (API WhatsApp directe Gupshup) a été RETIRÉ sur
   *    retour promoteur : « nous n'utilisons pas l'API directe de WhatsApp,
   *    ça ne peut pas fonctionner par API directe » — le bouton utilise
   *    désormais le lien wa.me de whatsapp-link (pattern finance
   *    encaissement), envoyé depuis le téléphone de l'école.
   */
  @Public()
  @Get('public/:token')
  async getPublicSharedBulletin(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    if (!token || !/^[0-9a-f]{16,64}$/i.test(token)) {
      throw new NotFoundException('Lien de bulletin invalide.');
    }
    const share = await this.prisma.bulletinPdfShare.findUnique({
      where: { shareToken: token },
    }).catch(() => null);
    if (!share) throw new NotFoundException('Bulletin indisponible — lien inconnu.');
    if (share.expiresAt.getTime() < Date.now()) {
      // Purge opportuniste + message clair pour le parent
      await this.prisma.bulletinPdfShare.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      }).catch(() => null);
      throw new NotFoundException('Ce lien de bulletin a expiré — demandez un nouvel envoi à l\'établissement.');
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${share.fileName || 'bulletin.pdf'}"`,
      'Content-Length': share.pdf.length,
    });
    res.end(share.pdf);
  }

  /**
   * ⭐ Normalisation du numéro de tuteur pour wa.me — même règle que le module
   *    Finances (reçus) : « 01XXXXXXXX » (Bénin) → 229XXXXXXXX, +XXX → XXX…
   */
  private normalizePhoneForWaMe(phone: string | null): string {
    if (!phone) return '';
    let cleaned = phone.replace(/[\s\-().]/g, '').trim();
    if (/^01\d{8}$/.test(cleaned)) {
      cleaned = '229' + cleaned.substring(2);
    } else if (/^\d{8}$/.test(cleaned) && !cleaned.startsWith('00')) {
      cleaned = '229' + cleaned;
    } else if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    } else if (cleaned.startsWith('00')) {
      cleaned = cleaned.substring(2);
    }
    return cleaned;
  }

  /**
   * ⭐ private buildBulletinPdfPayload — résolution COMPLÈTE des données d'un
   *    bulletin PDF à partir du payload frontend (mêmes résolutions backend
   *    qu'avant la refactorisation : branding, titulaire multi-tier, directeur,
   *    cachets, conduite/distinctions/assiduité, enseignants par matière,
   *    identité secondaire). Partagé par generate-pdf et whatsapp-link pour
   *    garantir que le PDF WhatsApp est strictement identique au PDF généré.
   */
  private async buildBulletinPdfPayload(
    resolvedTenantId: string | undefined,
    academicYearId: string,
    body: any,
  ): Promise<{ pdfData: any; filename: string; studentId: string | null; schoolLevelId: string | null }> {
    // ⭐ 2026-10-05 — OPTIMISATION 504 : paralléliser les requêtes indépendantes
    //    pour réduire le temps de réponse. Avant : getTenantBranding (1-2
    //    requêtes) PUIS student findFirst (1 requête) → 3 requêtes séquentielles
    //    juste pour démarrer. Désormais : 1 vague parallèle de 2 requêtes
    //    (branding + student), puis 1 vague parallèle pour les dépendances.
    let [branding, student] = await Promise.all([
      this.getTenantBranding(resolvedTenantId),
      body.studentMatricule && resolvedTenantId
        ? this.prisma.student.findFirst({
            where: { matricule: body.studentMatricule, tenantId: resolvedTenantId },
            select: { id: true, dateOfBirth: true, photoUrl: true },
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

    // ⭐ Résolution automatique du nom de l'enseignant titulaire de la classe
    //    de l'élève (via StudentEnrollment → TeacherClassAssignment → Teacher)
    let teacherName: string | null = null;
    let teacherGender: string | null = null;
    let studentAge: number | null = null;
    let admissionNumber: string | null = null;
    let directorName: string | null = null;
    let directorSignature: string | null = null;
    let studentSchoolLevelId: string | null = null;
    let studentPhotoUrl: string | null = null;
    // ⭐ 2026-10-06 — Store enrollment in outer scope so the teacher-by-subject
    //    section can reuse it without redundant queries.
    let resolvedEnrollment: any = null;
    // ⭐ 2026-10-05 — On a déjà récupéré student.id + photoUrl dans la vague 1.
    //    On réutilise directement, plus besoin de refaire un findFirst.
    if (student?.photoUrl) {
      studentPhotoUrl = student.photoUrl;
    } else if (student?.id) {
      try {
        const photo = await this.prisma.studentPhoto.findFirst({
          where: { studentId: student.id },
          select: { originalUrl: true, hdUrl: true, thumbnailUrl: true },
        }).catch(() => null);
        if (photo) {
          studentPhotoUrl = photo.hdUrl || photo.originalUrl || photo.thumbnailUrl || null;
        }
      } catch {
        // Silent fail — pas de photo, le placeholder "Photo" s'affiche
      }
    }

    if (student?.dateOfBirth) {
      const birth = new Date(student.dateOfBirth);
      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      const mDiff = now.getMonth() - birth.getMonth();
      if (mDiff < 0 || (mDiff === 0 && now.getDate() < birth.getDate())) age--;
      if (age >= 0 && age < 150) studentAge = age;
    }

    if (student && body.studentMatricule && resolvedTenantId && academicYearId) {
      try {
        // ⭐ Vague 2 : enrollment. On lance enrollment seul ici car c'est la
        //    seule requête qui ne dépend que de student.id.
        //    ⭐ 2026-10-06 — FALLBACK ClassStudent : les élèves anglophones
        //    peuvent être liés à la classe via class_students (ClassStudent)
        //    SANS StudentEnrollment.classId. Si enrollment est null, on
        //    cherche le classId + schoolLevelId via ClassStudent.
        let enrollment = await this.prisma.studentEnrollment.findFirst({
          where: { studentId: student.id, academicYearId, tenantId: resolvedTenantId },
          select: { classId: true, schoolLevelId: true, academicClassId: true },
        }).catch(() => null);

        // ⭐ Fallback ClassStudent : si pas d'enrollment ou pas de classId,
        //    on cherche via class_students (piste anglophone).
        if (!enrollment || !enrollment.classId) {
          const classStudent = await this.prisma.classStudent.findFirst({
            where: { studentId: student.id, academicYearId, tenantId: resolvedTenantId, status: 'ACTIVE' },
            select: { classId: true, schoolLevelId: true },
          }).catch(() => null);
          if (classStudent) {
            if (!enrollment) {
              enrollment = {
                classId: classStudent.classId,
                schoolLevelId: classStudent.schoolLevelId,
                academicClassId: null,
              };
            } else if (!enrollment.classId) {
              enrollment.classId = classStudent.classId;
            }
            if (!enrollment.schoolLevelId && classStudent.schoolLevelId) {
              enrollment.schoolLevelId = classStudent.schoolLevelId;
            }
          }
        }

        studentSchoolLevelId = enrollment?.schoolLevelId || null;
        resolvedEnrollment = enrollment; // ⭐ Store for reuse in teacher-by-subject section

        // ⭐ 2026-10-05 — RÉSOLUTION DU TITULAIRE DE CLASSE (multi-tier) :
        //
        //    Problème : le frontend envoie scopeLang = 'EN' pour un bulletin
        //    anglophone, mais l'ancienne logique ne filtrait les
        //    TeacherClassAssignment QUE par classId (classe physique). Or
        //    l'école a 2 configurations parallèles :
        //    - Module RH > Administration : équipes pédagogiques séparées FR
        //      vs EN (StaffAdminAssignment.academicTrackId).
        //    - Module Pédagogie > Affectation : enseignants anglophones
        //      affectés aux classes miroirs (Primary One = CI, etc.).
        //    Sans filtrer par track, on récupérait souvent le titulaire FR
        //    même pour un bulletin EN, car les 2 classes (CI FR et Primary
        //    One EN) partageaient parfois le même classId historique.
        //
        //    Stratégie multi-tier (3 sources, par ordre de fiabilité) :
        //    1. AcademicClass.mainTeacherId — le titulaire configuré
        //       explicitement pour la classe officielle (CI ou Primary One).
        //       C'est la source de vérité du module Pédagogie > Affectation.
        //    2. TeacherClassAssignment filtré par classId + Teacher.assignedLanguages
        //       contenant scopeLang — garantit qu'on récupère un enseignant
        //       de la bonne piste (FR ou EN) assigné à cette classe physique.
        //    3. Fallback : TeacherClassAssignment filtré par classId seul
        //       (comportement legacy — utile si assignedLanguages n'est pas
        //       rempli, par ex. écoles monolingues).
        const scopeLang = (body.scopeLang === 'EN') ? 'EN' : 'FR';

        // Tier 1 — AcademicClass.mainTeacherId (Pédagogie > Affectation)
        if (enrollment?.academicClassId) {
          try {
            const academicClass = await this.prisma.academicClass.findUnique({
              where: { id: enrollment.academicClassId },
              select: { mainTeacherId: true, languageTrack: true, name: true },
            }).catch(() => null);

            if (academicClass?.mainTeacherId) {
              const mainTeacher = await this.prisma.teacher.findFirst({
                where: { id: academicClass.mainTeacherId, tenantId: resolvedTenantId },
                select: { firstName: true, lastName: true, gender: true, assignedLanguages: true },
              }).catch(() => null);

              if (mainTeacher) {
                const langs = Array.isArray(mainTeacher.assignedLanguages)
                  ? (mainTeacher.assignedLanguages as any[])
                  : (typeof mainTeacher.assignedLanguages === 'string'
                    ? (() => { try { return JSON.parse(mainTeacher.assignedLanguages as any); } catch { return []; } })()
                    : []);
                const matchesTrack = !langs || langs.length === 0
                  || langs.some((l: any) => String(l).toUpperCase() === scopeLang);
                if (matchesTrack) {
                  const last = (mainTeacher.lastName || '').trim().toUpperCase();
                  const first = (mainTeacher.firstName || '').trim();
                  const civility = mainTeacher.gender === 'F' ? 'Mme' : (mainTeacher.gender === 'M' ? 'M.' : '');
                  teacherName = civility ? `${civility} ${last} ${first}`.trim() : `${last} ${first}`.trim();
                  teacherGender = mainTeacher.gender || null;
                }
              }
            }
          } catch {
            // Silent fail — on retombe sur TeacherClassAssignment ci-dessous
          }
        }

        // ⭐ Vague 3 (parallèle) : 4 requêtes indépendantes à lancer en
        //    parallèle dès qu'on a enrollment.classId + enrollment.schoolLevelId :
        //    1. TeacherClassAssignment (Tier 2 raw SQL filtré par scopeLang,
        //       ou Tier 3 fallback par classId seul si Tier 1 déjà trouvé →
        //       on passe null pour skip)
        //    2. schoolLevel (si schoolLevelId — pour code du niveau)
        const [
          tca,
          levelRow,
        ] = await Promise.all([
          // ⭐ Tier 2/3 — TeacherClassAssignment (uniquement si Tier 1 n'a
          //    pas trouvé l'enseignant)
          (!teacherName && enrollment?.classId)
            ? (async () => {
                try {
                  // Tier 2 : filtre par classId + Teacher.assignedLanguages
                  // contenant scopeLang. On accepte aussi assignedLanguages
                  // IS NULL (= enseignant non typé, valide pour les 2 pistes).
                  const tcaRows: any[] = await this.prisma.$queryRawUnsafe(
                    `SELECT tca."teacherId"
                     FROM teacher_class_assignments tca
                     JOIN teachers t ON t.id = tca."teacherId"
                     WHERE tca."classId" = $1
                       AND tca."tenantId" = $2
                       AND (t."assignedLanguages" IS NULL
                            OR t."assignedLanguages"::jsonb @> CAST($3 AS jsonb)
                            OR t."assignedLanguages"::jsonb = 'null'
                            OR t."assignedLanguages"::jsonb = '[]')
                     LIMIT 1`,
                    enrollment.classId,
                    resolvedTenantId,
                    JSON.stringify([scopeLang]),
                  );
                  if (Array.isArray(tcaRows) && tcaRows.length > 0 && tcaRows[0]?.teacherId) {
                    return { teacherId: tcaRows[0].teacherId };
                  }
                  // Tier 3 — Fallback legacy : TeacherClassAssignment par classId seul
                  return await this.prisma.teacherClassAssignment.findFirst({
                    where: { classId: enrollment.classId, tenantId: resolvedTenantId },
                    select: { teacherId: true },
                  }).catch(() => null);
                } catch {
                  // Tier 3 — Fallback legacy
                  return await this.prisma.teacherClassAssignment.findFirst({
                    where: { classId: enrollment.classId, tenantId: resolvedTenantId },
                    select: { teacherId: true },
                  }).catch(() => null);
                }
              })()
            : Promise.resolve(null),
          studentSchoolLevelId
            ? this.prisma.schoolLevel.findUnique({
                where: { id: studentSchoolLevelId },
                select: { code: true },
              }).catch(() => null)
            : Promise.resolve(null),
        ]);

        // ⭐ Vague 4 (parallèle) : teacher + academicTrack (les 2 dépendent
        //    respectivement de tca.teacherId et de directorLang — ce dernier
        //    ne dépend pas de tca, donc on peut paralléliser).
        const directorLang = (body.scopeLang === 'EN') ? 'EN' : 'FR';
        const levelCode = (levelRow?.code || '').toUpperCase().trim();
        const targetLevelCodes =
          ['MAT', 'MATERNELLE'].includes(levelCode) ? ['MAT', 'MAT_PRI', 'ALL'] :
          ['PRI', 'PRIMAIRE'].includes(levelCode) ? ['PRI', 'MAT_PRI', 'ALL'] :
          ['SEC', 'SECONDAIRE'].includes(levelCode) ? ['SEC', 'ALL'] :
          ['MAT_PRI'].includes(levelCode) ? ['MAT_PRI', 'ALL'] : null;

        const [
          teacher,
          trackRow,
        ] = await Promise.all([
          tca?.teacherId
            ? this.prisma.teacher.findFirst({
                where: { id: tca.teacherId },
                select: { firstName: true, lastName: true, gender: true },
              }).catch(() => null)
            : Promise.resolve(null),
          targetLevelCodes
            ? this.prisma.academicTrack.findFirst({
                where: { tenantId: resolvedTenantId, code: directorLang },
                select: { id: true },
              }).catch(() => null)
            : Promise.resolve(null),
        ]);

        if (teacher) {
          const last = (teacher.lastName || '').trim().toUpperCase();
          const first = (teacher.firstName || '').trim();
          const civility = teacher.gender === 'F' ? 'Mme' : (teacher.gender === 'M' ? 'M.' : '');
          teacherName = civility ? `${civility} ${last} ${first}`.trim() : `${last} ${first}`.trim();
          teacherGender = teacher.gender || null;
        }

        // ⭐ Vague 5 (parallèle) : staffAdminAssignment + school_directors.
        //    Les 2 dépendent de targetLevelCodes (et school_directors dépend
        //    aussi de directorLang). On peut les paralléliser.
        const trackUuid = trackRow?.id || null;
        let staffAssignments: any[] = [];
        let directorRows: any[] = [];
        if (targetLevelCodes) {
          [staffAssignments, directorRows] = await Promise.all([
            this.prisma.staffAdminAssignment.findMany({
              where: {
                tenantId: resolvedTenantId,
                isActive: true,
                schoolLevelCode: { in: targetLevelCodes },
                adminRole: { in: ['DIRECTEUR_GENERAL', 'DIRECTEUR', 'PROVISEUR', 'DIRECTEUR_DES_ETUDES', 'DIRECTEUR_ADJOINT'] },
                OR: [
                  { academicTrackId: null },
                  ...(trackUuid ? [{ academicTrackId: trackUuid }] : []),
                ],
                AND: [
                  { OR: [{ academicYearId: null }, { academicYearId }] },
                ],
              },
              include: {
                staff: { select: { firstName: true, lastName: true, gender: true } },
              },
              orderBy: { startDate: 'desc' },
            }).catch(() => []),
            this.prisma.$queryRawUnsafe<any[]>(
              `SELECT * FROM school_directors
               WHERE "tenantId" = $1 AND "schoolLevelId" = $2 AND "language" = $3 AND "isActive" = true
               LIMIT 1`,
              resolvedTenantId, studentSchoolLevelId, directorLang,
            ).catch(() => []),
          ]);

          if (Array.isArray(staffAssignments) && staffAssignments.length > 0) {
            // 4d. Priorité hiérarchique (même ordre que ADMIN_ROLE_PRIORITY)
            const ROLE_PRIORITY = ['DIRECTEUR_GENERAL', 'DIRECTEUR', 'PROVISEUR', 'DIRECTEUR_DES_ETUDES', 'DIRECTEUR_ADJOINT'];
            const sorted = [...staffAssignments].sort((a: any, b: any) => {
              const pa = ROLE_PRIORITY.indexOf(a.adminRole);
              const pb = ROLE_PRIORITY.indexOf(b.adminRole);
              if (pa !== pb) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
              // Affectation de l'année d'abord, permanente ensuite
              const ya = a.academicYearId ? 0 : 1;
              const yb = b.academicYearId ? 0 : 1;
              if (ya !== yb) return ya - yb;
              return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
            });
            const best: any = sorted[0];
            if (best?.staff) {
              const last = (best.staff.lastName || '').trim().toUpperCase();
              const first = (best.staff.firstName || '').trim();
              const civility = best.staff.gender === 'F' ? 'Mme' : (best.staff.gender === 'M' ? 'M.' : '');
              directorName = civility ? `${civility} ${last} ${first}`.trim() : `${last} ${first}`.trim();
            }
          }

          // ⭐ school_directors : signature + nom (si pas déjà trouvé via RH)
          if (Array.isArray(directorRows) && directorRows.length > 0) {
            const director = directorRows[0];
            // ⭐ Priorité : signatureDataUrl (canvas) > signatureUploadedUrl (upload PNG)
            directorSignature = director.signatureDataUrl || director.signatureUploadedUrl || null;
            if (!directorName) directorName = director.fullName || null;
          } else if (studentSchoolLevelId) {
            // ⭐ Fallback : si pas de directeur pour cette langue, essayer l'autre langue
            const fallbackLang = directorLang === 'FR' ? 'EN' : 'FR';
            try {
              const fallbackRows: any = await this.prisma.$queryRawUnsafe(
                `SELECT * FROM school_directors
                 WHERE "tenantId" = $1 AND "schoolLevelId" = $2 AND "language" = $3 AND "isActive" = true
                 LIMIT 1`,
                resolvedTenantId, studentSchoolLevelId, fallbackLang,
              );
              if (Array.isArray(fallbackRows) && fallbackRows.length > 0) {
                const director = fallbackRows[0];
                directorSignature = director.signatureDataUrl || director.signatureUploadedUrl || null;
                if (!directorName) directorName = director.fullName || null;
              }
            } catch (dirErr) {
              // Silent fail
            }
          }
        }
      } catch (e) {
        // Silent fail — on n'a pas réussi à résoudre le teacher/directeur, le PDF est quand même généré
      }
    }

    // ⭐ 2026-09-16 — CACHETS & SIGNATURE OFFICIELS DU DIRECTEUR (automatiques) :
    //    - Cachet circulaire nominatif (mention DIRECTEUR au centre) ;
    //    - Cachet nominatif rectangulaire (nom + poste) ;
    //    - Signature (school_directors, sinon signature persistée du flux
    //      « Lien signature » RH > Administration).
    //    Même moteur de génération que le module Personnel (effet encre PNG).
    //    Non bloquant : en cas d'échec, le bulletin est généré sans cachets.
    //    ⭐ 2026-10-05 — `directorLang` déclaré plus haut (lignes 702) dans la
    //    portée du bloc `if (student ...)`. On le redéclare ici pour la
    //    portée externe (cachets). Pas de conflit car le bloc `if (student ...)`
    //    a sa propre portée.
    const sealsDirectorLang = (body.scopeLang === 'EN') ? 'EN' : 'FR';
    let directorSeals: {
      nominativeCircularDataUrl: string | null;
      nominativeRectangularDataUrl: string | null;
    } = { nominativeCircularDataUrl: null, nominativeRectangularDataUrl: null };
    try {
      const seals = await this.documentSealsService.getDirectorSeals(
        resolvedTenantId, studentSchoolLevelId, sealsDirectorLang,
      );
      if (seals.holderName && !directorName) directorName = seals.holderName;
      if (!directorSignature && seals.signatureDataUrl) directorSignature = seals.signatureDataUrl;
      directorSeals = {
        nominativeCircularDataUrl: seals.nominativeCircularDataUrl,
        nominativeRectangularDataUrl: seals.nominativeRectangularDataUrl,
      };
    } catch {
      // Silent fail — le bulletin reste généré sans cachets
    }

    // ⭐ 2026-10-05 — studentPhotoUrl : déjà résolu plus haut (lignes 638-652)
    //    dans la vague 1+2 (optimisation 504). On supprime l'ancien bloc
    //    séquentiel qui refaisait un student.findFirst + studentPhoto.findFirst
    //    (2 requêtes supplémentaires séquentielles). Le commentaire ci-dessous
    //    documente l'ancien comportement pour la postérité.
    // [SUPPRIMÉ — studentPhotoUrl résolu dans la vague 1+2 plus haut]

    // ⭐ SECONDAIRE — Résolution de la conduite (conduct_ledger) + distinction/sanction
    //    ⭐ 2026-09-28 — Étendu à isSecondaryEval (Bulletin d'évaluation) en plus
    //       de isSecondary (Bulletin trimestriel). Les 2 variantes secondaires
    //       affichent la conduite dans le bulletin PDF, donc les 2 doivent
    //       résoudre le conduct_ledger. Avant, seul le bulletin trimestriel
    //       récupérait la conduite — l'évaluation n'affichait jamais la ligne
    //       « Conduite » dans le PDF.
    let conductScore: number | null = null;
    let conductReference: number | null = null;
    let distinctionLabel: string | null = null;
    let distinctionType: 'DISTINCTION' | 'SANCTION' | null = null;
    // ⭐ 2026-09-28 — Toutes les distinctions/sanctions pour affichage cases à cocher
    let allDistinctions: Array<{ label: string; type: string; minScore: number; maxScore: number }> | null = null;
    // ⭐ 2026-09-28 — Assiduité (total d'heures depuis module Vie Scolaire)
    let assiduityHours: number | null = null;
    let sanctionCount: number | null = null;

    // ⭐ 2026-09-29 — isAnySecondary étendu pour inclure aussi le bulletin EN
    //    Report Book (body.isSecondaryLevel). Avant, seuls isSecondary (FR
    //    trimestriel) et isSecondaryEval (FR évaluation) déclenchaient la
    //    résolution de la conduite. Désormais le bulletin EN secondaire
    //    (Report Book) résout aussi la conduite depuis le module Vie Scolaire.
    //    ⭐ Source de vérité = backend (conduct_ledger + sanctions).
    const isAnySecondary = body.isSecondary || body.isSecondaryEval || body.isSecondaryLevel;
    // ⭐ 2026-09-29 — quarterId déclaré dans la portée externe pour être
    //    accessible à la fois par le bloc conduct_ledger (lignes 868-942)
    //    ET par le bloc assiduité (lignes 990-1018). Avant, quarterId était
    //    déclaré à l'intérieur du premier `if (conductStudent)` → hors de
    //    portée pour le second.
    // ⭐ 2026-09-30 — FIX RÉGRESSION : activeSanctions doit aussi être dans
    //    la portée externe car le bloc assiduité (second if conductStudent)
    //    le réutilise. Avant, activeSanctions était const à l'intérieur du
    //    premier if → inaccessible depuis le second if → assiduityHours et
    //    sanctionCount restaient null → le PDF n'affichait plus les sanctions.
    let resolvedQuarterId: string | null = null;
    let resolvedActiveSanctions: any[] = [];
    let resolvedConductStudent: { id: string } | null = null;
    if (isAnySecondary && body.studentMatricule && resolvedTenantId && academicYearId) {
      try {
        // ⭐ 2026-09-30 — OPTIMISATION : paralléliser les requêtes indépendantes
        //    pour réduire le temps de réponse et éviter le 504 (gateway timeout).
        //    Avant : 6 requêtes séquentielles → ~3-6s sur Neon (cold start) →
        //    504 sur Railway (gateway timeout 30s). Désormais : 2 vagues
        //    parallèles (élève+quarter, puis ledger+settings+sanctions).
        //    ⭐ FIX 2026-09-30 : le periodId envoyé par le frontend est un
        //    AcademicPeriod.id, PAS un Quarter.id. Le conduct_ledger.quarterId
        //    stocke en réalité l'AcademicPeriod.id. On utilise donc directement
        //    body.periodId comme quarterId, sans vérifier la table quarters.

        // Vague 1 (parallèle) : ⭐ 2026-10-06 — RÉUTILISATION : on a déjà
        //    student.id depuis la vague 1 (ligne 616). Plus besoin de refaire
        //    un student.findFirst — économie d'1 round trip sur Neon.
        //    On lance juste conductSetting en parallèle avec school_academic_settings.
        const conductStudent = student ? { id: student.id } : null;
        const [conductSettings, settings] = await Promise.all([
          this.prisma.conductSetting.findFirst({
            where: { tenantId: resolvedTenantId, academicYearId },
            orderBy: { createdAt: 'desc' },
          }).catch(() => null),
          // ⭐ 2026-10-06 — school_academic_settings parallélisé avec
          //    conductSetting (au lieu d'être séquentiel après la vague 2).
          this.prisma.$queryRawUnsafe<any[]>(
            `SELECT config FROM school_academic_settings
             WHERE "tenantId" = $1 AND "levelCode" = 'SECONDAIRE'
               AND ("isActive" = true OR status = 'ACTIVE')
             ORDER BY "createdAt" DESC LIMIT 1`,
            resolvedTenantId,
          ).catch(() => []),
        ]);

        // ⭐ FIX 2026-09-30 : utiliser directement body.periodId comme quarterId
        //    (le conduct_ledger.quarterId stocke l'AcademicPeriod.id).
        resolvedQuarterId = body.periodId || null;
        resolvedConductStudent = conductStudent;

        if (conductStudent) {
          // Vague 2 (parallèle) : conduct_ledger + sanctions
          //    Ces 2 requêtes sont indépendantes → on les lance en parallèle.
          const [ledgerRow, activeSanctions] = await Promise.all([
            resolvedQuarterId
              ? this.prisma.conductLedger.findFirst({
                  where: { tenantId: resolvedTenantId, studentId: conductStudent.id, quarterId: resolvedQuarterId },
                  select: { conductReference: true, totalPointsDeducted: true, conductFinal: true },
                }).catch(() => null)
              : Promise.resolve(null),
            this.prisma.sanction.findMany({
              where: { tenantId: resolvedTenantId, academicYearId, studentId: conductStudent.id, status: 'ACTIVE' },
              select: { pointsDeducted: true, hoursAttributed: true, quarterId: true },
            }).catch(() => []),
          ]);

          // ⭐ 2026-09-30 — Sauvegarder activeSanctions dans la portée externe
          //    pour que le bloc assiduité puisse le réutiliser.
          resolvedActiveSanctions = activeSanctions;

          if (ledgerRow) {
            conductScore = Number(ledgerRow.conductFinal) || null;
            conductReference = Number(ledgerRow.conductReference) || 17;
          }

          // ⭐ 2026-09-28 — FALLBACK : si pas de conduct_ledger (l'élève n'a pas
          //    de ledger pour ce trimestre), calculer depuis les sanctions :
          //    conductScore = conduct_reference - Σ(points_deducted des sanctions
          //    actives). Si pas de sanction non plus → conductScore =
          //    conduct_reference (note de départ).
          if (conductScore === null) {
            if (conductSettings) {
              conductReference = Number(conductSettings.conductReference) || 17;
            }
            // ⭐ Si on a un quarterId, ne compter QUE les sanctions de ce
            //    trimestre (ou sans quarterId = legacy).
            const filteredSanctions = resolvedQuarterId
              ? activeSanctions.filter(s => !s.quarterId || s.quarterId === resolvedQuarterId)
              : activeSanctions;
            const totalDeducted = filteredSanctions.reduce((sum, s) => sum + (Number(s.pointsDeducted) || 0), 0);
            conductScore = Math.max(0, (conductReference ?? 17) - totalDeducted);
          }
        }

        // 4. Récupérer les distinctions depuis school_academic_settings
        //    ⭐ 2026-10-06 — Cette requête est désormais parallélisée avec
        //    conductSetting dans la vague 1 ci-dessus (variable `settings`).
        //    L'ancien appel séquentiel a été supprimé pour économiser 1 round
        //    trip sur Neon.

        if (settings.length > 0 && settings[0].config) {
          const cfg = typeof settings[0].config === 'string'
            ? JSON.parse(settings[0].config)
            : settings[0].config;
          if (cfg.distinctions && Array.isArray(cfg.distinctions)) {
            // ⭐ 2026-09-28 — Stocker toutes les distinctions pour affichage
            //    cases à cocher dans le bloc Conseil de classe du PDF
            allDistinctions = cfg.distinctions.map((d: any) => ({
              label: d.label,
              type: d.type,
              minScore: d.minScore,
              maxScore: d.maxScore,
            }));
            if (typeof body.generalAverage === 'number') {
              for (const d of cfg.distinctions) {
                if (body.generalAverage >= d.minScore && body.generalAverage <= d.maxScore) {
                  distinctionLabel = d.label;
                  distinctionType = d.type;
                  break;
                }
              }
            }
          }
        }

        // 5. ⭐ 2026-09-28 — Récupérer le total d'heures d'assiduité depuis
        //    le module Vie Scolaire (Σ sanction.hoursAttributed pour l'élève
        //    + trimestre courant, status ACTIVE). Affiché dans le bloc
        //    « Assiduité » de la page 2 du bulletin secondaire.
        //    On réutilise `resolvedConductStudent` et `resolvedActiveSanctions`
        //    (déclarés dans la portée externe) et `resolvedQuarterId`
        //    (déjà résolu plus haut — priorité body.periodId).
        //    ⭐ 2026-09-30 — FIX RÉGRESSION : avant, activeSanctions était
        //    inaccessible depuis ce bloc (portée de bloc const) →
        //    assiduityHours et sanctionCount restaient null → le PDF
        //    n'affichait plus les sanctions.
        if (resolvedConductStudent) {
          if (resolvedQuarterId) {
            // ⭐ On réutilise resolvedActiveSanctions (sauvegardé dans la
            //    portée externe). On filtre par quarterId (ou quarterId=null
            //    pour les sanctions legacy sans trimestre).
            const filteredAssiduitySanctions = resolvedActiveSanctions.filter(
              s => !s.quarterId || s.quarterId === resolvedQuarterId,
            );
            assiduityHours = filteredAssiduitySanctions.reduce((sum, s) => sum + (Number(s.hoursAttributed) || 0), 0);
            sanctionCount = filteredAssiduitySanctions.length;
          }
        }
      } catch {
        // Silent fail — pas de conduite/distinction, le bulletin reste généré
      }
    }

    // ⭐ 2026-09-28 — RÉSOUDRE LE NOM DE L'ENSEIGNANT PAR MATIÈRE
    //    Pour chaque matière de body.subjects[], on cherche l'enseignant
    //    assigné à (classe, matière) via TeacherClassAssignment + ClassSubject.
    //    On ne fait cet appel QUE pour les bulletins secondaires (les seuls
    //    qui affichent la colonne « Professeur »), pour éviter la latence
    //    sur les bulletins primaire/maternelle/anglophone qui n'en ont pas
    //    besoin.
    let resolvedSubjects = body.subjects;
    if (Array.isArray(body.subjects) && body.subjects.length > 0
        && (body.isSecondary || body.isSecondaryEval)
        && student?.id && resolvedTenantId && academicYearId) {
      try {
        // ⭐ 2026-10-06 — RÉUTILISATION : on a déjà student.id (vague 1) et
        //    enrollment (vague 2, stocké dans resolvedEnrollment). Plus
        //    besoin de refaire 2 requêtes séquentielles (student.findFirst +
        //    studentEnrollment.findFirst) — économie de ~2-4s sur Neon cold.
        //    Pour les élèves anglophones, resolvedEnrollment peut venir de
        //    ClassStudent (fallback) avec academicClassId=null mais classId
        //    non-null — c'est suffisant pour TeacherClassAssignment.

        // 2. Pour chaque matière, résoudre le teacher via TeacherClassAssignment
        //    ⚠️ TeacherClassAssignment n'a PAS de subjectId direct ; la
        //    relation est via ClassSubject (FK classSubjectId → ClassSubject
        //    qui a subjectId). On filtre donc par `classSubject.subjectId`.
        const subjectIds: string[] = body.subjects
          .map((s: any) => s.id)
          .filter((id: any) => typeof id === 'string' && id.length > 0);

        if (subjectIds.length > 0 && (resolvedEnrollment?.classId || resolvedEnrollment?.academicClassId)) {
          // ⭐ Stratégie : on tente d'abord par classe physique (classId
          //    sur TeacherClassAssignment), puis par classe officielle
          //    (academicClassId sur ClassSubject via classSubject). Les 2
          //    chemins coexistent dans le schéma Prisma — l'un des deux
          //    aura des données selon comment l'école a configuré ses
          //    affectations.
          const classFilters: any[] = [];
          if (resolvedEnrollment?.classId) {
            classFilters.push({ classId: resolvedEnrollment.classId });
          }
          if (resolvedEnrollment?.academicClassId) {
            classFilters.push({ classSubject: { academicClassId: resolvedEnrollment.academicClassId } });
          }

            const assignments = await this.prisma.teacherClassAssignment.findMany({
              where: {
                tenantId: resolvedTenantId,
                academicYearId,
                classSubject: { subjectId: { in: subjectIds } },
                OR: classFilters,
              },
              include: {
                teacher: { select: { firstName: true, lastName: true, gender: true } },
                classSubject: { select: { subjectId: true } },
              },
            }).catch(() => []);

            // Construire la map subjectId → teacherName
            const teacherBySubject = new Map<string, string>();
            for (const a of assignments) {
              const sid = a.classSubject?.subjectId;
              if (!sid) continue;
              if (teacherBySubject.has(sid)) continue; // premier trouvé gagne
              if (a.teacher) {
                const last = (a.teacher.lastName || '').trim().toUpperCase();
                const first = (a.teacher.firstName || '').trim();
                const civility = a.teacher.gender === 'F' ? 'Mme'
                  : (a.teacher.gender === 'M' ? 'M.' : '');
                const name = civility
                  ? `${civility} ${last} ${first}`.trim()
                  : `${last} ${first}`.trim();
                if (name) teacherBySubject.set(sid, name);
              }
            }

            // 3. Réinjecter les teacherName dans subjects[]
            resolvedSubjects = body.subjects.map((s: any) => ({
              ...s,
              teacherName: s.teacherName
                || teacherBySubject.get(s.id)
                || null,
            }));
          }
      } catch {
        // Silent fail — on retombe sur body.subjects tel quel
      }
    }

    // ⭐ 2026-09-29 — REFONTE : le backend est la SOURCE DE VÉRITÉ pour la conduite.
    //    Avant : le frontend injectait une matière « Conduite » (synthetic subject
    //    id __conduct__) avec un score calculé côté frontend (mais les URLs
    //    /api/discipline/conduct et /api/discipline/sanctions étaient fausses →
    //    fetchs retournaient null → tous les élèves affichaient 17/20 = default).
    //    Désormais : le frontend n'injecte PLUS Conduite. Le backend :
    //      1. résout conductScore depuis conduct_ledger (ou calcul depuis sanctions)
    //      2. INJECTE la matière Conduite dans subjects[] si elle n'existe pas
    //         (notamment pour le bulletin EN Report Book où le frontend n'envoie
    //         jamais de matière Conduite)
    //      3. ou MET À JOUR le score de la matière Conduite existante si le
    //         frontend en a envoyé une (rétro-compatibilité)
    //    ⭐ Source de vérité = backend (conduct_ledger + sanctions du module
    //    Vie Scolaire, configuré par l'école).
    let subjectsWithConduite = resolvedSubjects;
    if (isAnySecondary && conductScore !== null && Array.isArray(resolvedSubjects)) {
      const existingConduiteIdx = resolvedSubjects.findIndex(
        (s: any) => s.name && s.name.toLowerCase() === 'conduite',
      );
      if (existingConduiteIdx >= 0) {
        // Mise à jour de la matière existante
        subjectsWithConduite = resolvedSubjects.map((s: any) => {
          if (s.name && s.name.toLowerCase() === 'conduite') {
            return {
              ...s,
              score: conductScore,
              // ⭐ Pour EN Report Book : on remplit aussi firstCA/secondCA/exam/total
              //    pour que la matière Conduite s'affiche correctement dans le
              //    tableau 10 colonnes (FCA/SCA/EXAM/Total/100). On met le score
              //    en Total /100 et on calcule firstCA/secondCA/exam à 0 (la
              //    matière Conduite n'a pas de composantes CA).
              firstCA: s.firstCA ?? null,
              secondCA: s.secondCA ?? null,
              exam: s.exam ?? null,
              total: s.total ?? conductScore,
              // ⭐ Pour FR trimestriel/évaluation : on remplit secMoyenne + secNoteCoef
              secMoyenne: s.secMoyenne ?? conductScore,
              secNoteCoef: s.secNoteCoef ?? (conductScore * (s.secCoef ?? 1)),
              // ⭐ 2026-09-29 — FIX ABS dans colonne « Moyenne d'interrogation » :
              //    secHasSlot: true déclenchait l'affichage « ABS » quand secInt1/
              //    secInt2/secMoyInter étaient null (cell(v) → v === null &&
              //    secHasSlot ? 'ABS' : '—'). Or la Conduite n'a PAS de composantes
              //    INT1/INT2/DS1/DS2 (ce sont des notes d'évaluations), donc on
              //    force secHasSlot: false pour que les colonnes vides affichent
              //    « — » et non « ABS ».
              secHasSlot: false,
              secInt1: null,
              secInt2: null,
              secMoyInter: null,
              secDs1: null,
              secDs2: null,
              appreciation: conductScore >= (conductReference ?? 17) * 0.6 ? 'Satisfaisant' : 'À améliorer',
            };
          }
          return s;
        });
      } else {
        // ⭐ Injection de la matière Conduite (cas du bulletin EN Report Book
        //    où le frontend n'envoie pas de matière Conduite)
        const conductSubject: any = {
          id: '__conduct__',
          name: 'Conduite',
          coefficient: 1,
          score: conductScore,
          isAbsent: false,
          appreciation: conductScore >= (conductReference ?? 17) * 0.6 ? 'Satisfaisant' : 'À améliorer',
          // Pour le bulletin FR secondaire (buildHtmlSecondaire)
          // ⭐ 2026-09-29 — FIX ABS dans colonne « Moyenne d'interrogation » :
          //    secHasSlot: true déclenchait l'affichage « ABS » quand secInt1/
          //    secInt2/secMoyInter étaient null (cell(v) → v === null &&
          //    secHasSlot ? 'ABS' : '—'). Or la Conduite n'a PAS de composantes
          //    INT1/INT2/DS1/DS2 (ce sont des notes d'évaluations), donc on
          //    doit mettre secHasSlot: false pour que les colonnes vides
          //    affichent « — » et non « ABS ».
          secCoef: 1,
          secMoyenne: conductScore,
          secNoteCoef: conductScore,
          secHasSlot: false,
          secInt1: null,
          secInt2: null,
          secMoyInter: null,
          secDs1: null,
          secDs2: null,
          // Pour le bulletin EN Report Book (buildHtmlAnglophone)
          firstCA: null,
          secondCA: null,
          exam: null,
          total: conductScore,
        };
        subjectsWithConduite = [...resolvedSubjects, conductSubject];
      }
    }

    // ⭐ 2026-11-13 — Identité secondaire : écoles combinées — le secondaire peut
    //    porter un nom/logo/contacts DIFFÉRENTS (tenant_level_identity_profiles).
    //    Overlay appliqué AVANT la fusion pdfData. L'élève précis
    //    (studentSchoolLevelId) prime sur le flag du front ; overlay null ⇒
    //    branding global inchangé (maternelle/primaire = identité par défaut).
    //    ⭐ 2026-11-15 — PRIORITÉ INVERSÉE quand l'identité secondaire est configurée :
    //    le front envoie TOUJOURS l'identité globale (useSchoolIdentity) dans
    //    body.school* — l'ancienne fusion `body.school* || branding.school*`
    //    écrasait donc l'overlay secondaire à chaque coup (le nom/contacts du
    //    secondaire ne s'affichaient jamais dans les PDF). Désormais :
    //    overlay secondaire > body > branding global ; sans overlay (maternelle/
    //    primaire, ou secondaire non configuré) l'ancienne priorité est gardée.
    let secondaryIdentityApplied = false;
    if (isAnySecondary) {
      const secOverlay = await resolveLevelIdentityOverlay(
        this.prisma,
        resolvedTenantId,
        studentSchoolLevelId ? { schoolLevelId: studentSchoolLevelId } : { isSecondary: true },
      );
      if (secOverlay) {
        secondaryIdentityApplied = true;
        // Helper partagé : remplace les champs canoniques non vides (schoolName).
        const mergedBranding: any = applyLevelIdentityOverlay(branding, secOverlay);
        // Mapping local : champs canoniques de l'overlay → noms school* lus par
        // la fusion pdfData ci-dessous (le template consomme schoolLogo/…).
        branding = {
          ...mergedBranding,
          schoolLogo: secOverlay.logoUrl || mergedBranding.schoolLogo || null,
          schoolAddress: secOverlay.address || mergedBranding.schoolAddress || null,
          schoolPhone: secOverlay.phonePrimary || mergedBranding.schoolPhone || null,
          schoolEmail: secOverlay.email || mergedBranding.schoolEmail || null,
          schoolSlogan: secOverlay.slogan || mergedBranding.schoolSlogan || null,
        };
      }
    }
    const schoolField = (key: 'schoolName' | 'schoolLogo' | 'schoolAddress' | 'schoolPhone' | 'schoolEmail' | 'schoolSlogan') => {
      const fromBody = (body as any)[key];
      const fromBranding = (branding as any)[key];
      return secondaryIdentityApplied ? (fromBranding || fromBody) : (fromBody || fromBranding);
    };

    // Fusionner les données du frontend avec le branding + teacherName résolu
    const pdfData = {
      ...body,
      subjects: subjectsWithConduite,
      schoolName: schoolField('schoolName'),
      schoolLogo: schoolField('schoolLogo'),
      schoolAddress: schoolField('schoolAddress'),
      schoolPhone: schoolField('schoolPhone'),
      schoolEmail: schoolField('schoolEmail'),
      schoolSlogan: schoolField('schoolSlogan'),
      // ⭐ Nom du titulaire : priorité au backend (résolu via Teacher),
      //    fallback sur ce que le frontend a envoyé (pour rétro-compat)
      teacherName: teacherName || body.teacherName || null,
      teacherGender: teacherGender || body.teacherGender || null,
      // ⭐ Champs anglophones : résolus backend (âge + admission number)
      studentAge: body.studentAge ?? studentAge,
      admissionNumber: body.admissionNumber || admissionNumber || body.studentMatricule || null,
      // ⭐ Photo de l'élève : résolue depuis student_photos (priorité au backend)
      studentPhotoUrl: studentPhotoUrl || body.studentPhotoUrl || null,
      // ⭐ SECONDAIRE — Conduite + Distinction/Sanction (résolues backend)
      // ⭐ 2026-09-29 — conductScore/conductReference TOUJOURS prioritaires côté
      //    backend (résolu depuis conduct_ledger ou calculé depuis sanctions).
      //    Le frontend envoie aussi conductScore (depuis son useEffect __conduct__)
      //    mais cette valeur peut être la baseline (si le frontend n'a pas trouvé
      //    le ledger). On ignore body.conductScore si le backend a résolu une valeur.
      conductScore: conductScore !== null ? conductScore : (body.conductScore ?? null),
      conductReference: conductReference ?? body.conductReference ?? null,
      // ⭐ 2026-09-29 — isSecondaryLevel : passé explicitement au PDF service
      //    pour que buildHtmlAnglophone sache s'il doit afficher la section
      //    Conduct (uniquement pour le bulletin EN secondary, pas EN primary).
      isSecondaryLevel: body.isSecondaryLevel ?? false,
      // ⭐ 2026-09-28 — Assiduité (total d'heures depuis module Vie Scolaire)
      assiduityHours: assiduityHours ?? body.assiduityHours ?? null,
      sanctionCount: sanctionCount ?? body.sanctionCount ?? null,
      distinctionLabel: distinctionLabel || body.distinctionLabel || null,
      distinctionType: distinctionType || body.distinctionType || null,
      // ⭐ 2026-09-28 — Toutes les distinctions pour cases à cocher
      allDistinctions: allDistinctions || body.allDistinctions || null,
      // ⭐ Directeur : résolu backend depuis school_directors (par niveau + langue)
      //    Priorité au backend si trouvé, sinon fallback sur ce que le frontend a envoyé
      directorName: directorName || body.directorName || null,
      directorSignature: directorSignature || body.directorSignature || null,
      // ⭐ 2026-09-16 — Cachets nominatifs automatiques (data-URL) du directeur
      directorSeals,
    };

    // ⭐ Nom du fichier : bulletin_[élève]_[type éval]_[trimestre].pdf
    const safeName = (body.studentName || 'eleve').replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
    const safeEvalType = (body.evaluationTypeCode || body.evaluationTypeName || 'eval').replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
    const safePeriod = (body.periodName || 'periode').replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
    const filename = `bulletin_${safeName}_${safeEvalType}_${safePeriod}.pdf`;

    return {
      pdfData,
      filename,
      studentId: student?.id ?? null,
      schoolLevelId: studentSchoolLevelId ?? null,
    };
  }

  /**
   * ⭐ private persistBulletinDocument — rattache le bulletin PDF généré au
   *    ReportCard de l'élève (filePath = URL publique de l'archive R2/S3) et
   *    alimente les données de synthèse (moyenne générale, rang, items par
   *    matière) pour l'affichage dans le PORTAIL PARENT (onglet « Bulletins » :
   *    ligne par matière + bouton PDF → exactement le document généré par le
   *    directeur). Best-effort : aucun échec ici ne bloque le téléchargement.
   *
   *    ⭐ 2026-11-23 — fallbackFilePath : si l'archive R2/S3 est indisponible,
   *    le lien public de repli (/bulletin/[token], 30 jours — octets dans
   *    bulletin_pdf_shares) est utilisé comme filePath — le parent conserve
   *    TOUJOURS son bouton PDF. Retourne l'ID de la ligne ReportCard (l'appelant
   *    whatsapp-link marque alors PARENT_SENT + sentToParentAt).
   *
   *    ⚠️ Ne touche JAMAIS au statut du workflow — seuls
   *    filePath/generatedAt/overallAverage/rank/items sont mis à jour ; la
   *    ligne est créée en DRAFT si elle n'existe pas (l'appelant marque).
   */
  private async persistBulletinDocument(
    resolvedTenantId: string | undefined,
    academicYearId: string,
    pdfData: any,
    buffer: Buffer,
    studentId: string | null,
    schoolLevelId: string | null,
    fallbackFilePath: string | null = null,
  ): Promise<string | null> {
    if (!resolvedTenantId || !studentId || !pdfData?.periodId) return null;

    // 1. Archiver le PDF (clé déterministe — une re-génération écrase l'ancien)
    let filePath: string | null = null;
    try {
      const key = `bulletins/${resolvedTenantId}/${studentId}/bulletin-${pdfData.periodId}${pdfData.evaluationTypeId ? `-${pdfData.evaluationTypeId}` : ''}.pdf`;
      const stored = await this.storageService.uploadBuffer(buffer, key);
      // URL publique (R2/S3/Blob) uniquement — un chemin relatif local ne serait
      // pas téléchargeable depuis le portail parent.
      if (typeof stored === 'string' && /^https?:\/\//.test(stored)) filePath = stored;
    } catch {
      // Storage indisponible — repli : lien public /bulletin/[token] fourni
      //    par l'appelant (les octets sont déjà dans bulletin_pdf_shares).
      filePath = fallbackFilePath && /^https?:\/\//.test(fallbackFilePath) ? fallbackFilePath : null;
    }
    if (!filePath) filePath = fallbackFilePath && /^https?:\/\//.test(fallbackFilePath) ? fallbackFilePath : null;
    if (!filePath) return null;

    // 2. Retrouver/créer la ligne ReportCard (clé du workflow : tenant + année
    //    + élève + période + type d'évaluation) SANS toucher au statut.
    const where: any = {
      tenantId: resolvedTenantId,
      academicYearId,
      studentId,
      quarterId: pdfData.periodId,
    };
    if (pdfData.evaluationTypeId) {
      where.evaluationTypeId = pdfData.evaluationTypeId;
    } else {
      where.OR = [{ evaluationTypeId: null }, { evaluationTypeId: '' }];
    }

    const existing = await this.prisma.reportCard.findFirst({ where }).catch(() => null);

    const generalAverage = typeof pdfData.generalAverage === 'number'
      ? pdfData.generalAverage
      : (typeof pdfData.generalAverage === 'string' && !isNaN(Number(pdfData.generalAverage))
        ? Number(pdfData.generalAverage)
        : 0);
    const classRank = typeof pdfData.classRank === 'number' ? Math.round(pdfData.classRank) : null;

    let reportCardId: string;
    if (existing) {
      await this.prisma.reportCard.update({
        where: { id: existing.id },
        data: {
          filePath,
          generatedAt: new Date(),
          overallAverage: existing.overallAverage || generalAverage,
          ...(existing.rank == null && classRank != null ? { rank: classRank } : {}),
        },
      });
      reportCardId = existing.id;
    } else {
      if (!schoolLevelId) return null; // impossible de créer la ligne sans niveau
      const created = await this.prisma.reportCard.create({
        data: {
          tenantId: resolvedTenantId,
          academicYearId,
          schoolLevelId,
          studentId,
          quarterId: pdfData.periodId,
          type: 'BULLETIN',
          overallAverage: generalAverage,
          rank: classRank,
          status: 'DRAFT',
          filePath,
          generatedAt: new Date(),
          evaluationTypeId: pdfData.evaluationTypeId || null,
          evaluationTypeName: pdfData.evaluationTypeName || null,
          evaluationTypeCode: pdfData.evaluationTypeCode || null,
        },
      });
      reportCardId = created.id;
    }

    // 3. Items par matière (tableau du portail parent) — remplacés à chaque
    //    génération pour refléter exactement le document émis. Seules les
    //    matières réelles (UUID) avec une moyenne numérique sont écrites.
    const subjects: any[] = Array.isArray(pdfData.subjects) ? pdfData.subjects : [];
    const itemRows = subjects
      .filter((s: any) => s?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s.id)))
      .map((s: any) => {
        const average = typeof s.score === 'number'
          ? s.score
          : typeof s.secMoyenne === 'number'
            ? s.secMoyenne
            : typeof s.total === 'number'
              ? s.total
              : null;
        const coefficient = typeof s.coefficient === 'number'
          ? s.coefficient
          : typeof s.secCoef === 'number'
            ? s.secCoef
            : 1;
        const rank = typeof s.subjectRank === 'number'
          ? s.subjectRank
          : typeof s.secRank === 'number'
            ? s.secRank
            : null;
        return average !== null ? {
          reportCardId,
          subjectId: String(s.id),
          average,
          coefficient,
          rank: rank !== null ? Math.round(rank) : null,
          comments: s.appreciation || null,
        } : null;
      })
      .filter(Boolean) as any[];

    if (itemRows.length > 0) {
      await this.prisma.reportCardItem.deleteMany({ where: { reportCardId } }).catch(() => {});
      await this.prisma.reportCardItem.createMany({
        data: itemRows.map((r: any) => ({
          tenantId: resolvedTenantId!,
          academicYearId,
          schoolLevelId: schoolLevelId!,
          ...r,
        })),
      }).catch(() => {});
    }

    // ⭐ 2026-11-23 — Retourne l'ID de la ligne ReportCard (pour marquer
    //    PARENT_SENT au moment de l'envoi WhatsApp — le parent doit voir le
    //    bulletin ET son PDF dans son portail dès que la direction envoie).
    return reportCardId;
  }

  /**
   * ⭐ PATCH /institutional-exams/bulletins/director-visa
   *
   * Met à jour le visa du directeur pour un élève donné (par période + année).
   * Auto-save : appelé à chaque sortie de ligne (blur) côté frontend.
   * Crée ou met à jour le ReportCard correspondant.
   *
   * Body: { studentId, periodId, directorVisa, academicYearId?, schoolLevelId? }
   */
  @Patch('director-visa')
  @Permissions('exams.manage')
  async updateDirectorVisa(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @AcademicYearId() academicYearId: string,
    @Body() body: {
      studentId: string;
      periodId: string;
      directorVisa: string;
      schoolLevelId?: string;
    },
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    if (!resolvedTenantId) throw new ForbiddenException('Tenant ID requis');
    if (!body.studentId || !body.periodId) {
      throw new ForbiddenException('studentId et periodId sont requis');
    }

    // Récupérer l'enrollment pour schoolLevelId et classId
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { tenantId: resolvedTenantId, academicYearId, studentId: body.studentId },
      select: { schoolLevelId: true, classId: true },
    });
    const schoolLevelId = body.schoolLevelId || enrollment?.schoolLevelId;
    if (!schoolLevelId) {
      throw new ForbiddenException('schoolLevelId non résolu pour cet élève');
    }

    // Upsert ReportCard — met à jour directorVisa ou crée le ReportCard
    const existing = await this.prisma.reportCard.findFirst({
      where: {
        tenantId: resolvedTenantId,
        academicYearId,
        studentId: body.studentId,
        quarterId: body.periodId,
      },
    });

    const now = new Date();
    if (existing) {
      const updated = await this.prisma.reportCard.update({
        where: { id: existing.id },
        data: {
          directorVisa: body.directorVisa,
          directorVisaUpdatedAt: now,
        },
      });
      return { success: true, reportCardId: updated.id, directorVisa: updated.directorVisa, updatedAt: now };
    }

    const created = await this.prisma.reportCard.create({
      data: {
        tenantId: resolvedTenantId,
        academicYearId,
        schoolLevelId,
        studentId: body.studentId,
        quarterId: body.periodId,
        type: 'BULLETIN',
        overallAverage: 0,
        status: 'DRAFT',
        directorVisa: body.directorVisa,
        directorVisaUpdatedAt: now,
      },
    });
    return { success: true, reportCardId: created.id, directorVisa: created.directorVisa, updatedAt: now, created: true };
  }

  /**
   * ⭐ GET /institutional-exams/bulletins/director-visa
   *
   * Récupère le visa du directeur pour un élève + période donnés.
   * Query: ?studentId=X&periodId=Y
   */
  @Get('director-visa')
  @Permissions('exams.read')
  async getDirectorVisa(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @AcademicYearId() academicYearId: string,
    @Query('studentId') studentId: string,
    @Query('periodId') periodId: string,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    if (!resolvedTenantId || !studentId || !periodId) {
      return { directorVisa: null, updatedAt: null };
    }

    const reportCard = await this.prisma.reportCard.findFirst({
      where: {
        tenantId: resolvedTenantId,
        academicYearId,
        studentId,
        quarterId: periodId,
      },
      select: { directorVisa: true, directorVisaUpdatedAt: true },
    });

    return {
      directorVisa: reportCard?.directorVisa ?? null,
      updatedAt: reportCard?.directorVisaUpdatedAt ?? null,
    };
  }

  /**
   * Récupère le branding du tenant (logo, nom, contact).
   */
  private async getTenantBranding(tenantId: string) {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: { schoolName: true, logoUrl: true, address: true, phonePrimary: true, email: true, slogan: true },
      });

      if (profile?.schoolName) {
        const apiBaseUrl = 'https://api.academiahelm.com';
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
}
