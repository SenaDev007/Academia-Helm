import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Param, 
  Query, 
  Body, 
  UseGuards, 
  Res, 
  ForbiddenException 
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

@Controller('api/institutional-exams/bulletins')
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
}
