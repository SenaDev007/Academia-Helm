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
  Controller, Get, Post, Put, Body, Param, Query, Headers,
  HttpCode, HttpStatus, BadRequestException, NotFoundException, Logger,
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
}
