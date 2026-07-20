/**
 * ============================================================================
 * ESPACE PÉDAGOGIQUE — Controller
 * ============================================================================
 *
 * Endpoints pour l'espace pédagogique enseignant et le contrôle direction.
 *
 * Routes:
 *   GET    /pedagogy-space/my-classes          — Mes classes
 *   GET    /pedagogy-space/attendance/:classId  — Appel du jour
 *   POST   /pedagogy-space/attendance           — Enregistrer l'appel
 *   GET    /pedagogy-space/class-logs           — Cahier journal
 *   POST   /pedagogy-space/class-logs           — Créer entrée cahier journal
 *   PUT    /pedagogy-space/class-logs/:id       — Modifier entrée
 *   GET    /pedagogy-space/weekly-logs          — Semainiers
 *   POST   /pedagogy-space/weekly-logs/submit/:id — Soumettre semainier
 *   GET    /pedagogy-space/homeworks            — Devoirs
 *   POST   /pedagogy-space/homeworks            — Créer devoir
 *   GET    /pedagogy-space/homeworks/:id/students — Suivi par élève
 *   PUT    /pedagogy-space/task-students/:id     — Mettre à jour suivi élève
 *   GET    /pedagogy-space/director/dashboard    — Dashboard direction
 *   GET    /pedagogy-space/director/pending      — Semainiers en attente
 *   POST   /pedagogy-space/director/validate/:id — Valider/rejeter semainier
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Headers,
  HttpCode, HttpStatus, BadRequestException, NotFoundException, Logger, Res,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PedagogicalSpaceService } from './pedagogical-space.service';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('pedagogy-space')
@Public()
export class PedagogicalSpaceController {
  private readonly logger = new Logger(PedagogicalSpaceController.name);

  constructor(private readonly service: PedagogicalSpaceService) {}

  // ─── MES CLASSES ──────────────────────────────────────────────────────────

  @Get('my-classes')
  async getMyClasses(
    @TenantId() tenantId: string,
    @Query('teacherId') teacherId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!teacherId || !academicYearId) {
      throw new BadRequestException('teacherId et academicYearId sont requis');
    }
    return this.service.getMyClasses(tenantId, teacherId, academicYearId);
  }

  // ─── APPEL JOURNALIER ─────────────────────────────────────────────────────

  @Get('attendance/:classId')
  async getAttendance(
    @TenantId() tenantId: string,
    @Param('classId') classId: string,
    @Query('date') date: string,
  ) {
    if (!date) throw new BadRequestException('date est requis (YYYY-MM-DD)');
    return this.service.getDailyAttendance(tenantId, classId, date);
  }

  @Post('attendance')
  @HttpCode(HttpStatus.OK)
  async saveAttendance(
    @TenantId() tenantId: string,
    @Body() body: {
      academicYearId: string;
      schoolLevelId: string;
      classId: string;
      date: string;
      records: { studentId: string; status: string; notes?: string }[];
    },
    @CurrentUser() user: any,
  ) {
    return this.service.saveDailyAttendance(
      tenantId,
      body.academicYearId,
      body.schoolLevelId,
      body.classId,
      body.date,
      body.records,
      user?.id,
    );
  }

  // ─── CAHIER JOURNAL ───────────────────────────────────────────────────────

  @Get('class-logs')
  async getClassLogs(
    @TenantId() tenantId: string,
    @Query('teacherId') teacherId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId?: string,
    @Query('date') date?: string,
  ) {
    if (!teacherId || !academicYearId) {
      throw new BadRequestException('teacherId et academicYearId sont requis');
    }
    return this.service.getClassLogs(tenantId, teacherId, academicYearId, classId, date);
  }

  @Post('class-logs')
  async createClassLog(
    @TenantId() tenantId: string,
    @Body() body: {
      academicYearId: string;
      teacherId: string;
      classId: string;
      subjectId: string;
      lessonDate: string;
      topic: string;
      durationHours: number;
      homework?: string;
      detailedContent?: string;
      materialsUsed?: string;
      observations?: string;
    },
  ) {
    return this.service.createClassLog(tenantId, body.academicYearId, body.teacherId, body);
  }

  @Put('class-logs/:id')
  async updateClassLog(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { teacherId: string } & any,
  ) {
    return this.service.updateClassLog(tenantId, body.teacherId, id, body);
  }

  // ─── CAHIER DU SEMAINIER ──────────────────────────────────────────────────

  @Get('weekly-logs')
  async getWeeklyLogs(
    @TenantId() tenantId: string,
    @Query('teacherId') teacherId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.service.getWeeklyLogs(tenantId, teacherId, academicYearId);
  }

  @Post('weekly-logs/submit/:id')
  @HttpCode(HttpStatus.OK)
  async submitWeeklyLog(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { teacherId: string },
  ) {
    return this.service.submitWeeklyLog(tenantId, body.teacherId, id);
  }

  // ─── DEVOIRS & ACTIVITÉS ─────────────────────────────────────────────────

  @Get('homeworks')
  async getHomeworks(
    @TenantId() tenantId: string,
    @Query('teacherId') teacherId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId?: string,
  ) {
    return this.service.getHomeworks(tenantId, academicYearId, teacherId, classId);
  }

  @Post('homeworks')
  async createHomework(
    @TenantId() tenantId: string,
    @Body() body: {
      academicYearId: string;
      schoolLevelId: string;
      teacherId: string;
      classId: string;
      subjectId?: string;
      title: string;
      description: string;
      dueDate: string;
      maxScore?: number;
    },
  ) {
    return this.service.createHomework(
      tenantId,
      body.academicYearId,
      body.schoolLevelId,
      body.teacherId,
      body,
    );
  }

  @Get('homeworks/:id/students')
  async getTaskStudents(
    @TenantId() tenantId: string,
    @Param('id') homeworkEntryId: string,
  ) {
    return this.service.getTaskStudents(tenantId, homeworkEntryId);
  }

  @Put('task-students/:id')
  async updateTaskStudent(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: {
      status: string;
      score?: number;
      appreciation?: string;
      observation?: string;
    },
  ) {
    return this.service.updateTaskStudent(tenantId, id, body);
  }

  // ─── CONTRÔLE PÉDAGOGIQUE DIRECTION ──────────────────────────────────────

  @Get('director/dashboard')
  async getDirectorDashboard(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.service.getDirectorDashboard(tenantId, academicYearId);
  }

  @Get('director/pending')
  async getPendingWeeklyLogs(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.service.getPendingWeeklyLogs(tenantId, academicYearId);
  }

  @Post('director/validate/:id')
  @HttpCode(HttpStatus.OK)
  async validateWeeklyLog(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: {
      action: 'VALIDATED' | 'REJECTED';
      validatedBy: string;
      rejectionReason?: string;
    },
  ) {
    return this.service.validateWeeklyLog(
      tenantId,
      id,
      body.action,
      body.validatedBy,
      body.rejectionReason,
    );
  }

  // ─── CAHIER DE SEMAINE — Rapports journaliers ────────────────────────────

  @Get('weekly-log/daily-reports')
  async getDailyReports(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('weekNumber') weekNumber: string,
  ) {
    return this.service.getDailyReports(tenantId, academicYearId, parseInt(weekNumber));
  }

  @Post('weekly-log/daily-reports')
  async getOrCreateDailyReport(
    @TenantId() tenantId: string,
    @Body() body: {
      academicYearId: string;
      weekNumber: number;
      trimester: number;
      dayOfWeek: number;
      reportDate: string;
      filledBy?: string;
    },
  ) {
    return this.service.getOrCreateDailyReport(
      tenantId, body.academicYearId, body.weekNumber, body.trimester,
      body.dayOfWeek, body.reportDate, body.filledBy,
    );
  }

  @Put('weekly-log/daily-reports/:id')
  async updateDailyReport(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.updateDailyReport(tenantId, id, body);
  }

  // ─── CAHIER DE SEMAINE — Rapport de fin de semaine ───────────────────────

  @Post('weekly-log/summary')
  async getOrCreateWeeklySummary(
    @TenantId() tenantId: string,
    @Body() body: {
      academicYearId: string;
      weekNumber: number;
      trimester: number;
      weekStartDate: string;
      weekEndDate: string;
      filledBy?: string;
    },
  ) {
    return this.service.getOrCreateWeeklySummary(
      tenantId, body.academicYearId, body.weekNumber, body.trimester,
      body.weekStartDate, body.weekEndDate, body.filledBy,
    );
  }

  @Put('weekly-log/summary/:id')
  async updateWeeklySummary(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.updateWeeklySummary(tenantId, id, body);
  }

  @Post('weekly-log/summary/:id/submit')
  @HttpCode(HttpStatus.OK)
  async submitWeeklySummary(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.submitWeeklySummary(tenantId, id);
  }

  @Get('director/pending-summaries')
  async getPendingWeeklySummaries(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.service.getPendingWeeklySummaries(tenantId, academicYearId);
  }

  @Post('director/validate-summary/:id')
  @HttpCode(HttpStatus.OK)
  async validateWeeklySummary(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: {
      action: 'VALIDATED' | 'REJECTED';
      validatedBy: string;
      rejectionReason?: string;
    },
  ) {
    return this.service.validateWeeklySummary(
      tenantId, id, body.action, body.validatedBy, body.rejectionReason,
    );
  }

  // ===========================================================================
  // CAHIER JOURNAL — Grille hebdomadaire (5 jours × 8 matières)
  // ===========================================================================

  @Get('cahier-journal')
  async getCahierJournals(
    @TenantId() tenantId: string,
    @Query('teacherId') teacherId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId?: string,
  ) {
    if (!teacherId || !academicYearId) {
      throw new BadRequestException('teacherId et academicYearId sont requis');
    }
    return this.service.getCahierJournals(tenantId, teacherId, academicYearId, classId);
  }

  @Post('cahier-journal')
  @HttpCode(HttpStatus.OK)
  async getOrCreateCahierJournal(
    @TenantId() tenantId: string,
    @Body() body: {
      academicYearId: string;
      teacherId: string;
      classId: string;
      weekStartDate: string;
      className?: string;
    },
  ) {
    return this.service.getOrCreateCahierJournal(
      tenantId, body.academicYearId, body.teacherId, body.classId,
      body.weekStartDate, body.className,
    );
  }

  @Put('cahier-journal/:id')
  async updateCahierJournal(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.updateCahierJournal(tenantId, id, body);
  }

  @Post('cahier-journal/:id/submit')
  @HttpCode(HttpStatus.OK)
  async submitCahierJournal(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.submitCahierJournal(tenantId, id);
  }

  // ===========================================================================
  // FICHES PÉDAGOGIQUES PRIMAIRE (5 types: MATH/FRANCAIS/EST/ES/EA)
  // ===========================================================================

  @Get('fiches')
  async getPedagogicalFiches(
    @TenantId() tenantId: string,
    @Query('teacherId') teacherId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('sheetType') sheetType?: string,
    @Query('classId') classId?: string,
  ) {
    if (!teacherId || !academicYearId) {
      throw new BadRequestException('teacherId et academicYearId sont requis');
    }
    return this.service.getPedagogicalFiches(tenantId, teacherId, academicYearId, sheetType, classId);
  }

  @Get('fiches/:id')
  async getPedagogicalFiche(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.getPedagogicalFiche(tenantId, id);
  }

  @Post('fiches')
  async createPedagogicalFiche(
    @TenantId() tenantId: string,
    @Body() body: any,
  ) {
    return this.service.createPedagogicalFiche(
      tenantId, body.academicYearId, body.teacherId, body,
    );
  }

  @Put('fiches/:id')
  async updatePedagogicalFiche(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.updatePedagogicalFiche(tenantId, id, body);
  }

  @Delete('fiches/:id')
  async deletePedagogicalFiche(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.deletePedagogicalFiche(tenantId, id);
  }

  @Post('fiches/:id/submit')
  @HttpCode(HttpStatus.OK)
  async submitPedagogicalFiche(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.submitPedagogicalFiche(tenantId, id);
  }

  // ===========================================================================
  // REGISTRE D'APPEL — Registre mensuel + Évaluation + Tableau annuel
  // ===========================================================================

  @Get('attendance-registers')
  async getAttendanceRegisters(
    @TenantId() tenantId: string,
    @Query('teacherId') teacherId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId?: string,
  ) {
    if (!teacherId || !academicYearId) {
      throw new BadRequestException('teacherId et academicYearId sont requis');
    }
    return this.service.getAttendanceRegisters(tenantId, teacherId, academicYearId, classId);
  }

  @Post('attendance-registers')
  @HttpCode(HttpStatus.OK)
  async getOrCreateAttendanceRegister(
    @TenantId() tenantId: string,
    @Body() body: {
      academicYearId: string;
      teacherId: string;
      classId: string;
      month: number;
      year: number;
    },
  ) {
    return this.service.getOrCreateAttendanceRegister(
      tenantId, body.academicYearId, body.teacherId,
      body.classId, body.month, body.year,
    );
  }

  @Put('attendance-registers/:id')
  async updateAttendanceRegister(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.updateAttendanceRegister(tenantId, id, body);
  }

  @Post('monthly-evaluations')
  @HttpCode(HttpStatus.OK)
  async getOrCreateMonthlyEvaluation(
    @TenantId() tenantId: string,
    @Body() body: {
      academicYearId: string;
      classId: string;
      attendanceRegisterId: string;
      month: number;
      year: number;
    },
  ) {
    return this.service.getOrCreateMonthlyEvaluation(
      tenantId, body.academicYearId, body.classId,
      body.attendanceRegisterId, body.month, body.year,
    );
  }

  @Put('monthly-evaluations/:id')
  async updateMonthlyEvaluation(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.updateMonthlyEvaluation(tenantId, id, body);
  }

  @Get('monthly-summaries')
  async getMonthlySummary(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId: string,
  ) {
    if (!academicYearId || !classId) {
      throw new BadRequestException('academicYearId et classId sont requis');
    }
    return this.service.getOrCreateMonthlySummary(tenantId, academicYearId, classId);
  }

  @Post('monthly-summaries/refresh')
  @HttpCode(HttpStatus.OK)
  async refreshMonthlySummary(
    @TenantId() tenantId: string,
    @Body() body: {
      academicYearId: string;
      classId: string;
    },
  ) {
    return this.service.refreshMonthlySummary(tenantId, body.academicYearId, body.classId);
  }

  // ===========================================================================
  // VALIDATION DIRECTION — Cahier Journal, Fiches, Registres, Évaluations
  // ===========================================================================

  @Get('director/pedagogy-dashboard')
  async getDirectorPedagogyDashboard(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId est requis');
    return this.service.getDirectorPedagogyDashboard(tenantId, academicYearId);
  }

  // --- Cahier Journal ---

  @Get('director/pending-cahier-journals')
  async getPendingCahierJournals(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId est requis');
    return this.service.getPendingCahierJournals(tenantId, academicYearId);
  }

  @Get('director/cahier-journal/:id')
  async getCahierJournalDetail(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.getCahierJournalDetail(tenantId, id);
  }

  @Post('director/validate-cahier-journal/:id')
  @HttpCode(HttpStatus.OK)
  async validateCahierJournal(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: {
      action: 'VALIDATED' | 'REJECTED';
      validatedBy: string;
      rejectionReason?: string;
    },
  ) {
    return this.service.validateCahierJournal(
      tenantId, id, body.action, body.validatedBy, body.rejectionReason,
    );
  }

  // --- Fiches Pédagogiques ---

  @Get('director/pending-fiches')
  async getPendingPedagogicalFiches(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId est requis');
    return this.service.getPendingPedagogicalFiches(tenantId, academicYearId);
  }

  @Get('director/fiches/:id')
  async getPedagogicalFicheDetail(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.getPedagogicalFicheDetail(tenantId, id);
  }

  @Post('director/validate-fiche/:id')
  @HttpCode(HttpStatus.OK)
  async validatePedagogicalFiche(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: {
      action: 'VALIDATED' | 'REJECTED';
      validatedBy: string;
      rejectionReason?: string;
    },
  ) {
    return this.service.validatePedagogicalFiche(
      tenantId, id, body.action, body.validatedBy, body.rejectionReason,
    );
  }

  // --- Registres d'appel ---

  @Get('director/pending-registers')
  async getPendingAttendanceRegisters(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId est requis');
    return this.service.getPendingAttendanceRegisters(tenantId, academicYearId);
  }

  @Get('director/attendance-register/:id')
  async getAttendanceRegisterDetail(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.getAttendanceRegisterDetail(tenantId, id);
  }

  @Post('director/validate-attendance-register/:id')
  @HttpCode(HttpStatus.OK)
  async validateAttendanceRegister(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: {
      action: 'VALIDATED' | 'REJECTED';
      validatedBy: string;
      rejectionReason?: string;
    },
  ) {
    return this.service.validateAttendanceRegister(
      tenantId, id, body.action, body.validatedBy, body.rejectionReason,
    );
  }

  // --- Évaluations mensuelles ---

  @Get('director/pending-evaluations')
  async getPendingMonthlyEvaluations(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId est requis');
    return this.service.getPendingMonthlyEvaluations(tenantId, academicYearId);
  }

  @Get('director/evaluation/:id')
  async getMonthlyEvaluationDetail(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.getMonthlyEvaluationDetail(tenantId, id);
  }

  @Post('director/validate-evaluation/:id')
  @HttpCode(HttpStatus.OK)
  async validateMonthlyEvaluation(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: {
      action: 'VALIDATED' | 'REJECTED';
      validatedBy: string;
      rejectionReason?: string;
    },
  ) {
    return this.service.validateMonthlyEvaluation(
      tenantId, id, body.action, body.validatedBy, body.rejectionReason,
    );
  }

  // ===========================================================================
  // CONFIGURATION DES MATIÈRES — Évaluation mensuelle
  // ===========================================================================

  @Get('subjects/available')
  async getAvailableSubjectsForClass(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId: string,
  ) {
    if (!academicYearId || !classId) {
      throw new BadRequestException('academicYearId et classId sont requis');
    }
    return this.service.getAvailableSubjectsForClass(tenantId, academicYearId, classId);
  }

  @Put('monthly-evaluations/:id/subjects')
  async setMonthlyEvaluationSubjects(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: {
      subjectsConfig: Array<{ subjectId?: string; subjectName: string; order?: number; coefficient?: number }>;
    },
  ) {
    if (!body.subjectsConfig || !Array.isArray(body.subjectsConfig)) {
      throw new BadRequestException('subjectsConfig doit être un tableau');
    }
    return this.service.setMonthlyEvaluationSubjects(tenantId, id, body.subjectsConfig);
  }

  @Post('monthly-evaluations/:id/submit')
  @HttpCode(HttpStatus.OK)
  async submitMonthlyEvaluation(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.submitMonthlyEvaluation(tenantId, id);
  }

  // ===========================================================================
  // CAHIER DE TEST (SECONDAIRE) — Évaluations et compositions
  // ===========================================================================

  @Get('cahier-tests')
  async getCahierDeTests(
    @TenantId() tenantId: string,
    @Query('teacherId') teacherId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId?: string,
    @Query('testType') testType?: string,
    @Query('trimester') trimester?: string,
  ) {
    if (!teacherId || !academicYearId) {
      throw new BadRequestException('teacherId et academicYearId sont requis');
    }
    return this.service.getCahierDeTests(
      tenantId, teacherId, academicYearId,
      classId, testType, trimester ? parseInt(trimester) : undefined,
    );
  }

  @Get('cahier-tests/:id')
  async getCahierDeTest(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.getCahierDeTest(tenantId, id);
  }

  @Post('cahier-tests')
  async createCahierDeTest(
    @TenantId() tenantId: string,
    @Body() body: any,
  ) {
    return this.service.createCahierDeTest(
      tenantId, body.academicYearId, body.teacherId, body,
    );
  }

  @Put('cahier-tests/:id')
  async updateCahierDeTest(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.updateCahierDeTest(tenantId, id, body);
  }

  @Delete('cahier-tests/:id')
  async deleteCahierDeTest(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.deleteCahierDeTest(tenantId, id);
  }

  @Post('cahier-tests/:id/submit')
  @HttpCode(HttpStatus.OK)
  async submitCahierDeTest(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.submitCahierDeTest(tenantId, id);
  }

  @Post('cahier-tests/:id/init-students')
  @HttpCode(HttpStatus.OK)
  async initCahierDeTestStudents(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.initCahierDeTestStudents(tenantId, id);
  }

  // === Validation direction pour les cahiers de test ===

  @Get('director/pending-cahier-tests')
  async getPendingCahierDeTests(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId est requis');
    return this.service.getPendingCahierDeTests(tenantId, academicYearId);
  }

  @Get('director/cahier-test/:id')
  async getCahierDeTestDetail(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.getCahierDeTestDetail(tenantId, id);
  }

  @Post('director/validate-cahier-test/:id')
  @HttpCode(HttpStatus.OK)
  async validateCahierDeTest(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: {
      action: 'VALIDATED' | 'REJECTED';
      validatedBy: string;
      rejectionReason?: string;
    },
  ) {
    return this.service.validateCahierDeTest(
      tenantId, id, body.action, body.validatedBy, body.rejectionReason,
    );
  }
}
