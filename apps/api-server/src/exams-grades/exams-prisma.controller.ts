/**
 * ============================================================================
 * EXAMS PRISMA CONTROLLER - MODULE 3
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ExamsPrismaService } from './exams-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CreateExamPrismaDto,
  UpdateExamPrismaDto,
  SaveGradingSheetDto,
  CalculateAveragesDto,
  CalculateEvaluationAveragesDto,
  GenerateReportCardsDto,
  PublishBulletinsDto,
} from './dto';

@Controller('exams')
@UseGuards(JwtAuthGuard)
export class ExamsPrismaController {
  constructor(private readonly examsService: ExamsPrismaService) {}

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('academicTrackId') academicTrackId?: string,
    @Query('language') language?: string,
    @Query('quarterId') quarterId?: string,
    @Query('classId') classId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('examType') examType?: string,
    @Query('search') search?: string,
  ) {
    return this.examsService.findAllExams(tenantId, {
      academicYearId,
      schoolLevelId,
      academicTrackId: academicTrackId || undefined,
      language,
      quarterId,
      classId,
      subjectId,
      examType,
      search,
    });
  }

  @Post()
  async create(@TenantId() tenantId: string, @Body() createDto: CreateExamPrismaDto) {
    return this.examsService.createExam({
      ...createDto,
      tenantId,
      examDate: new Date(createDto.examDate),
    });
  }

  @Get('dashboard')
  async getDashboard(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) {
      return {
        plannedCount: 0, totalScores: 0, validatedScores: 0,
        missingGrades: 0, globalAverage: 0, successRate: 0,
        generatedBulletins: 0, lockedClasses: 0, orionAlerts: 0,
      };
    }
    return this.examsService.getDashboard(tenantId, academicYearId);
  }

  @Get('evaluations')
  async findEvaluations(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('academicTrackId') academicTrackId?: string,
    @Query('quarterId') quarterId?: string,
    @Query('classId') classId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('examType') examType?: string,
    @Query('search') search?: string,
  ) {
    return this.examsService.findAllExams(tenantId, {
      academicYearId,
      schoolLevelId,
      academicTrackId: academicTrackId || undefined,
      quarterId,
      classId,
      subjectId,
      examType,
      search,
    });
  }

  @Get('evaluations/:id/grading-sheet')
  async getGradingSheet(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.examsService.getGradingSheet(id, tenantId);
  }

  @Post('evaluations/:id/grading-sheet')
  async saveGradingSheet(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: SaveGradingSheetDto,
  ) {
    return this.examsService.saveGradingSheet(id, tenantId, user?.id, body);
  }

  @Get('averages')
  async getAverages(
    @TenantId() tenantId: string,
    @Query('classId') classId: string,
    @Query('periodId') periodId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.examsService.getAverages(tenantId, classId, periodId, academicYearId);
  }

  @Get('bulletins')
  async getBulletins(
    @TenantId() tenantId: string,
    @Query('classId') classId: string,
    @Query('periodId') periodId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.examsService.getBulletinsForClass(tenantId, classId, periodId, academicYearId);
  }

  @Post('calculate-averages')
  async calculateAverages(
    @TenantId() tenantId: string,
    @Body() body: CalculateAveragesDto,
  ) {
    return this.examsService.calculateAverages(
      tenantId,
      body.classId,
      body.periodId,
      body.academicYearId,
    );
  }

  /**
   * POST /api/exams/calculate-evaluation-averages
   *
   * Calcule les moyennes pour un type d'évaluation spécifique (EM1, EM2, EC)
   * pour tous les élèves d'une classe, sur un trimestre donné.
   *
   * Body: { classId, periodId, academicYearId, evaluationTypeId }
   *
   * ⭐ Différent de calculate-averages qui consolide toutes les évaluations :
   *    cette méthode isole UN type d'évaluation précis (EM1, EM2 ou EC).
   */
  @Post('calculate-evaluation-averages')
  async calculateEvaluationAverages(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: CalculateEvaluationAveragesDto,
  ) {
    // ⭐ Fallback: if @TenantId() returns undefined, use user.tenantId from JWT
    const resolvedTenantId = tenantId || user?.tenantId || user?.tenant_id;
    if (!resolvedTenantId) {
      throw new BadRequestException('Tenant ID non résolu — veuillez vous reconnecter.');
    }
    return this.examsService.calculateEvaluationAverages(
      resolvedTenantId,
      body.classId,
      body.periodId,
      body.academicYearId,
      body.evaluationTypeId,
    );
  }

  /**
   * GET /api/exams/annual-averages?classId=X&academicYearId=Y
   * Moyennes annuelles + moyenne de passage pour tous les élèves d'une classe.
   */
  @Get('annual-averages')
  async getAnnualAverages(
    @TenantId() tenantId: string,
    @Query('classId') classId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.examsService.getAnnualAverages(tenantId, classId, academicYearId);
  }

  /**
   * GET /api/exams/rankings/by-level?schoolLevelId=X&periodId=Y&academicYearId=Z
   * Rangs par niveau (toutes classes d'un niveau confondues).
   */
  @Get('rankings/by-level')
  async getRankingsByLevel(
    @TenantId() tenantId: string,
    @Query('schoolLevelId') schoolLevelId: string,
    @Query('periodId') periodId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.examsService.getRankingsByLevel(tenantId, schoolLevelId, periodId, academicYearId);
  }

  /**
   * GET /api/exams/rankings/by-subject?classId=X&periodId=Y&academicYearId=Z
   * Rangs par matière pour une classe (meilleurs élèves par matière).
   */
  @Get('rankings/by-subject')
  async getRankingsBySubject(
    @TenantId() tenantId: string,
    @Query('classId') classId: string,
    @Query('periodId') periodId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.examsService.getRankingsBySubject(tenantId, classId, periodId, academicYearId);
  }

  @Post('generate-report-cards')
  async generateReportCards(
    @TenantId() tenantId: string,
    @Body() body: GenerateReportCardsDto,
  ) {
    return this.examsService.generateReportCardsForClass(
      tenantId,
      body.classId,
      body.periodId,
      body.academicYearId,
    );
  }

  @Post('bulletins/publish')
  async publishBulletins(
    @TenantId() tenantId: string,
    @Body() body: PublishBulletinsDto,
  ) {
    return this.examsService.publishBulletinsForClass(
      tenantId,
      body.classId,
      body.periodId,
      body.academicYearId,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.examsService.findExamById(id, tenantId);
  }

  @Get(':id/statistics')
  async getStatistics(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.examsService.getExamStatistics(id, tenantId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateExamPrismaDto,
  ) {
    const data: any = { ...updateDto };
    if (updateDto.examDate) {
      data.examDate = new Date(updateDto.examDate);
    }
    return this.examsService.updateExam(id, tenantId, data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.examsService.deleteExam(id, tenantId);
  }
}
