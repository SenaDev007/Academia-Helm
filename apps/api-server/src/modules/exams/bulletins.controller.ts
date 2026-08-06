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
   * Body: BulletinPdfData (toutes les données du bulletin)
   * Response: PDF binaire (application/pdf)
   */
  @Post('generate-pdf')
  @Permissions('exams.read')
  async generateBulletinPdf(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @Body() body: any,
    @Res() res: Response,
  ) {
    // ⭐ Robust tenantId resolution (same pattern as exams-prisma.controller)
    const resolvedTenantId = tenantId || user?.tenantId || user?.tenant_id || headers?.['x-tenant-id'] || headers?.['X-Tenant-Id'];

    // Récupérer le branding du tenant (nom école, logo, etc.)
    const branding = await this.getTenantBranding(resolvedTenantId);

    // Fusionner les données du frontend avec le branding
    const pdfData = {
      ...body,
      schoolName: body.schoolName || branding.schoolName,
      schoolLogo: body.schoolLogo || branding.schoolLogo,
      schoolAddress: body.schoolAddress || branding.schoolAddress,
      schoolPhone: body.schoolPhone || branding.schoolPhone,
      schoolEmail: body.schoolEmail || branding.schoolEmail,
      schoolSlogan: body.schoolSlogan || branding.schoolSlogan,
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
