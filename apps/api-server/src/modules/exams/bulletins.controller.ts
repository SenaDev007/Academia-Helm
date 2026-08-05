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

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=bulletin_${body.studentName || 'eleve'}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
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
