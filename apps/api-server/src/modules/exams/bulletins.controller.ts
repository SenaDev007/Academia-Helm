import {
  Controller, Get, Post, Patch, Param, Query, Body,
  UseGuards, Res, ForbiddenException, Headers,
} from '@nestjs/common';
import { BulletinsService } from './services/bulletins.service';
import { BulletinPdfService } from './services/bulletin-pdf.service';
import { PrismaService } from '../../database/prisma.service';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AcademicYearId } from '../../common/decorators/academic-year-id.decorator';
import { UserId } from '../../auth/decorators/user-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('institutional-exams/bulletins')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class BulletinsController {
  constructor(
    private readonly bulletinsService: BulletinsService,
    private readonly pdfService: BulletinPdfService,
    private readonly prisma: PrismaService,
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

    // 3. GÉNÉRATION DU PDF
    const buffer = await this.pdfService.generateBulletin(bulletinData);

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

    // Récupérer le branding du tenant (nom école, logo, etc.)
    const branding = await this.getTenantBranding(resolvedTenantId);

    // ⭐ Résolution automatique du nom de l'enseignant titulaire de la classe
    //    de l'élève (via StudentEnrollment → TeacherClassAssignment → Teacher)
    let teacherName: string | null = null;
    let teacherGender: string | null = null;
    let studentAge: number | null = null;
    let admissionNumber: string | null = null;
    if (body.studentMatricule && resolvedTenantId && academicYearId) {
      try {
        // 1. Trouver l'élève par matricule
        const student = await this.prisma.student.findFirst({
          where: { matricule: body.studentMatricule, tenantId: resolvedTenantId },
          select: { id: true, birthDate: true, admissionNumber: true },
        }).catch(() => null);

        // ⭐ Résolution de l'âge à partir de la date de naissance
        if (student?.birthDate) {
          const birth = new Date(student.birthDate);
          const now = new Date();
          let age = now.getFullYear() - birth.getFullYear();
          const mDiff = now.getMonth() - birth.getMonth();
          if (mDiff < 0 || (mDiff === 0 && now.getDate() < birth.getDate())) age--;
          if (age >= 0 && age < 150) studentAge = age;
        }
        if (student?.admissionNumber) {
          admissionNumber = student.admissionNumber;
        }

        if (student) {
          // 2. Trouver l'enrollment (pour récupérer la classe)
          const enrollment = await this.prisma.studentEnrollment.findFirst({
            where: { studentId: student.id, academicYearId, tenantId: resolvedTenantId },
            select: { classId: true },
          }).catch(() => null);

          if (enrollment?.classId) {
            // 3. Trouver le teacher assignment pour cette classe
            const tca = await this.prisma.teacherClassAssignment.findFirst({
              where: { classId: enrollment.classId, tenantId: resolvedTenantId },
              select: { teacherId: true },
            }).catch(() => null);

            if (tca?.teacherId) {
              const teacher = await this.prisma.teacher.findFirst({
                where: { id: tca.teacherId },
                select: { firstName: true, lastName: true, gender: true },
              }).catch(() => null);

              if (teacher) {
                const last = (teacher.lastName || '').trim().toUpperCase();
                const first = (teacher.firstName || '').trim();
                const civility = teacher.gender === 'F' ? 'Mme' : (teacher.gender === 'M' ? 'M.' : '');
                teacherName = civility ? `${civility} ${last} ${first}`.trim() : `${last} ${first}`.trim();
                teacherGender = teacher.gender || null;
              }
            }
          }
        }
      } catch (e) {
        // Silent fail — on n'a pas réussi à résoudre le teacher, le PDF est quand même généré
      }
    }

    // Fusionner les données du frontend avec le branding + teacherName résolu
    const pdfData = {
      ...body,
      schoolName: body.schoolName || branding.schoolName,
      schoolLogo: body.schoolLogo || branding.schoolLogo,
      schoolAddress: body.schoolAddress || branding.schoolAddress,
      schoolPhone: body.schoolPhone || branding.schoolPhone,
      schoolEmail: body.schoolEmail || branding.schoolEmail,
      schoolSlogan: body.schoolSlogan || branding.schoolSlogan,
      // ⭐ Nom du titulaire : priorité au backend (résolu via Teacher),
      //    fallback sur ce que le frontend a envoyé (pour rétro-compat)
      teacherName: teacherName || body.teacherName || null,
      teacherGender: teacherGender || body.teacherGender || null,
      // ⭐ Champs anglophones : résolus backend (âge + admission number)
      studentAge: body.studentAge ?? studentAge,
      admissionNumber: body.admissionNumber || admissionNumber || body.studentMatricule || null,
    };

    const buffer = await this.pdfService.generateBulletin(pdfData);

    // ⭐ Nom du fichier : bulletin_[élève]_[type éval]_[trimestre].pdf
    const safeName = (body.studentName || 'eleve').replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
    const safeEvalType = (body.evaluationTypeCode || body.evaluationTypeName || 'eval').replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
    const safePeriod = (body.periodName || 'periode').replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
    const filename = `bulletin_${safeName}_${safeEvalType}_${safePeriod}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
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
