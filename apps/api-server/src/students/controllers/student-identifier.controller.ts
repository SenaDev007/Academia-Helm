/**
 * ============================================================================
 * STUDENT IDENTIFIER CONTROLLER - MODULE 1
 * ============================================================================
 * 
 * Controller pour gestion des matricules globaux uniques
 * 
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GetTenant } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StudentIdentifierService } from '../services/student-identifier.service';

@Controller('students/identifiers')
@UseGuards(JwtAuthGuard, TenantGuard)
export class StudentIdentifierController {
  constructor(private readonly identifierService: StudentIdentifierService) {}

  /**
   * Génère un matricule global pour un élève
   * Règle : Backend uniquement, jamais manuel
   */
  @Post(':studentId/generate')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DIRECTOR')
  async generateMatricule(
    @GetTenant() tenant: any,
    @Param('studentId') studentId: string,
    @Query('countryCode') countryCode: string = 'BJ',
    @CurrentUser() user: any,
  ) {
    return this.identifierService.generateGlobalMatricule(
      tenant.id,
      studentId,
      countryCode,
      user.id,
    );
  }

  /**
   * Génère un matricule temporaire (mode offline)
   */
  @Post(':studentId/generate-temporary')
  async generateTemporaryMatricule(
    @GetTenant() tenant: any,
    @Param('studentId') studentId: string,
  ) {
    return this.identifierService.generateTemporaryLocalId(tenant.id, studentId);
  }

  /**
   * Synchronise un matricule temporaire avec le définitif
   */
  @Post(':studentId/synchronize')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DIRECTOR')
  async synchronizeTemporaryMatricule(
    @GetTenant() tenant: any,
    @Param('studentId') studentId: string,
    @Query('temporaryLocalId') temporaryLocalId: string,
    @CurrentUser() user: any,
  ) {
    if (!temporaryLocalId) {
      throw new BadRequestException('temporaryLocalId is required');
    }

    return this.identifierService.synchronizeTemporaryIdentifier(
      tenant.id,
      studentId,
      temporaryLocalId,
      user.id,
    );
  }

  /**
   * Récupère le matricule d'un élève
   */
  @Get(':studentId')
  async getStudentMatricule(@GetTenant() tenant: any, @Param('studentId') studentId: string) {
    return this.identifierService.getStudentMatricule(studentId, tenant.id);
  }

  /**
   * Recherche un élève par matricule global
   */
  @Get('search/:matricule')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DIRECTOR')
  async findStudentByMatricule(@Param('matricule') matricule: string) {
    return this.identifierService.findStudentByMatricule(matricule);
  }

  /**
   * Vérifie l'unicité d'un matricule
   */
  @Get('verify/:matricule')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DIRECTOR')
  async verifyMatricule(@Param('matricule') matricule: string) {
    const isUnique = await this.identifierService.verifyMatriculeUniqueness(matricule);
    return { matricule, isUnique, available: isUnique };
  }

  /**
   * Récupère les statistiques des matricules
   */
  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DIRECTOR')
  async getMatriculeStats(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.identifierService.getMatriculeStats(tenant.id, academicYearId);
  }

  /**
   * Génère des matricules par lot (pour élèves sans matricule)
   */
  @Post('generate-bulk')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DIRECTOR')
  async generateBulkMatricules(
    @GetTenant() tenant: any,
    @Body() data: {
      academicYearId: string;
      schoolLevelId?: string;
      classId?: string;
      status?: string;
    },
    @Query('countryCode') countryCode: string = 'BJ',
    @CurrentUser() user: any,
  ) {
    const where: any = {
      tenantId: tenant.id,
      academicYearId: data.academicYearId,
      status: data.status || 'ACTIVE',
      identifier: null,
    };

    if (data.schoolLevelId) {
      where.schoolLevelId = data.schoolLevelId;
    }

    const students = await this.identifierService['prisma'].student.findMany({
      where,
      include: {
        studentEnrollments: {
          where: {
            academicYearId: data.academicYearId,
            ...(data.classId && { classId: data.classId }),
            status: 'ACTIVE',
          },
        },
      },
    });

    const results = await Promise.allSettled(
      students.map((student) =>
        this.identifierService.generateGlobalMatricule(
          tenant.id,
          student.id,
          countryCode,
          user.id,
        ),
      ),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return {
      total: students.length,
      succeeded,
      failed,
      results: results.map((r, index) => ({
        student: students[index],
        status: r.status,
        ...(r.status === 'rejected' && { error: (r as PromiseRejectedResult).reason.message }),
        ...(r.status === 'fulfilled' && { matricule: (r as PromiseFulfilledResult<any>).value }),
      })),
    };
  }
}

