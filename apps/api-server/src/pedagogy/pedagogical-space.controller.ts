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
  UseGuards,
} from '@nestjs/common';
import { PedagogicalSpaceService } from './pedagogical-space.service';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { AcademicYearId } from '../common/decorators/academic-year-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

@Controller('pedagogy-space')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PedagogicalSpaceController {
  private readonly logger = new Logger(PedagogicalSpaceController.name);

  constructor(private readonly service: PedagogicalSpaceService) {}

  // ─── MES CLASSES ──────────────────────────────────────────────────────────

  @Get('my-classes')
  async getMyClasses(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearIdFromDecorator: string | null,
    @Query('teacherId') teacherId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    // ⭐ academicYearId peut venir du query param OU du décorateur (header/body)
    const resolvedAcademicYearId = academicYearId || academicYearIdFromDecorator;
    if (!teacherId || !resolvedAcademicYearId) {
      throw new BadRequestException('teacherId et academicYearId sont requis');
    }
    return this.service.getMyClasses(tenantId, teacherId, resolvedAcademicYearId);
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
      schoolLevelId?: string;
      classId: string;
      date: string;
      records: {
        studentId: string;
        status: string;
        morningStatus?: string;
        afternoonStatus?: string;
        eveningStatus?: string;
        late?: boolean;
        lateMinutes?: number;
        notes?: string;
      }[];
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

  // ⭐ Soumission cahier journal + fiches pédagogiques (séparée du registre)
  //    Body : { dayRange?: string[] } — ex: ['lundi', 'mardi', 'mercredi']
  //    Si dayRange absent → soumet toute la semaine (lundi→vendredi)
  @Post('cahier-journal/:id/submit-with-fiches')
  @HttpCode(HttpStatus.OK)
  async submitCahierJournalWithFiches(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { dayRange?: string[] },
  ) {
    return this.service.submitCahierJournalWithFiches(tenantId, id, body?.dayRange);
  }

  // ⭐ Récupère toutes les fiches pédagogiques rattachées à un cahier journal
  //    Retourne : { parJour: { lundi: [...], mardi: [...], ... }, matieresPlanifiees, stats }
  //    Utilisé par l'UI pour afficher les fiches manquantes par jour après
  //    l'enregistrement du cahier journal.
  @Get('cahier-journal/:id/fiches')
  async getFichesForCahierJournal(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.getFichesForCahierJournal(tenantId, id);
  }

  // ⭐ Rattache manuellement une fiche pédagogique à un cahier journal
  //    Body : { ficheId }
  @Post('cahier-journal/:id/link-fiche')
  @HttpCode(HttpStatus.OK)
  async linkFicheToCahierJournal(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { ficheId: string },
  ) {
    return this.service.linkFicheToCahierJournal(tenantId, id, body.ficheId);
  }

  // ⭐ Export PDF d'une fiche pédagogique individuelle
  //    Génère un PDF structuré au nom de l'enseignant titulaire
  @Get('fiches/:id/export-pdf')
  async exportFichePdf(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Res() res: any,
  ) {
    const buffer = await this.service.exportFichePdf(tenantId, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="fiche_pedagogique_${id.substring(0, 8)}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ⭐ Export PDF de TOUTES les fiches d'un cahier journal (document combiné)
  @Get('cahier-journal/:id/fiches/export-pdf')
  async exportAllFichesPdf(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Res() res: any,
  ) {
    const buffer = await this.service.exportAllFichesForCahierJournal(tenantId, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="fiches_cahier_journal_${id.substring(0, 8)}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ⭐ Mise à jour directeur : observations + signature + validation cahier journal
  //    Body : { directorObservations?, directorGeneralObservation?, directorSignature?, action, rejectionReason? }
  @Put('cahier-journal/:id/director-update')
  async directorUpdateCahierJournal(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: {
      directorObservations?: Record<string, string>;
      directorGeneralObservation?: string;
      directorSignature?: string;
      action?: 'VALIDATED' | 'REJECTED';
      rejectionReason?: string;
    },
  ) {
    return this.service.directorUpdateCahierJournal(tenantId, id, body);
  }

  // ===========================================================================
  // ⭐ SOUMISSION UNIFIÉE — registre + évaluation mensuelle (cahier journal séparé)
  // ===========================================================================

  @Post('submit-unified')
  @HttpCode(HttpStatus.OK)
  async submitUnified(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string | null,
    @Body() body: {
      teacherId: string;
      classId: string;
      month: number;
      year: number;
    },
  ) {
    // ⭐ academicYearId peut venir du décorateur (header/query/body) ou du body directement
    const resolvedAcademicYearId = academicYearId || (body as any).academicYearId;
    if (!resolvedAcademicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    return this.service.submitUnified(
      tenantId,
      resolvedAcademicYearId,
      body.teacherId,
      body.classId,
      body.month,
      body.year,
    );
  }

  @Post('notify-director')
  @HttpCode(HttpStatus.OK)
  async notifyDirector(
    @TenantId() tenantId: string,
    @Body() body: {
      classId: string;
      month: number;
      year: number;
      channels?: string[];
      teacherId?: string;
    },
  ) {
    return this.service.notifyDirector(
      tenantId,
      body.classId,
      body.month,
      body.year,
      body.channels || ['email', 'whatsapp', 'sms'],
      body.teacherId,
    );
  }

  // ===========================================================================
  // FICHES PÉDAGOGIQUES PRIMAIRE (6 types: MATH/FRANCAIS/EST/ES/EA/EPS)
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

  // ⭐ CROSS-YEAR REUSE : lister les fiches des années précédentes
  //    pour la même classe + matière (ou même schoolLevel + matière).
  //    Permet à un enseignant de retrouver les fiches de l'année précédente
  //    et de les dupliquer vers l'année courante.
  @Get('fiches/previous-years')
  async getPreviousYearFiches(
    @TenantId() tenantId: string,
    @Query('currentAcademicYearId') currentAcademicYearId: string,
    @Query('classId') classId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    if (!currentAcademicYearId) {
      throw new BadRequestException('currentAcademicYearId est requis');
    }
    return this.service.getPreviousYearFiches(
      tenantId, currentAcademicYearId, classId, subjectId, schoolLevelId,
    );
  }

  // ⭐ CROSS-YEAR REUSE : dupliquer une fiche d'une année précédente vers l'année courante
  //    Crée une nouvelle PedagogicalSheet avec :
  //    - academicYearId = année courante
  //    - teacherId = nouvel enseignant
  //    - originalSheetId = fiche d'origine (traçabilité)
  //    - status = DRAFT (l'enseignant peut l'éditer avant soumission)
  @Post('fiches/:id/duplicate-to-year')
  @HttpCode(HttpStatus.OK)
  async duplicateFicheToCurrentYear(
    @TenantId() tenantId: string,
    @Param('id') sourceFicheId: string,
    @Body() body: {
      targetAcademicYearId: string;
      targetTeacherId?: string;
      targetClassId?: string;
    },
  ) {
    if (!body.targetAcademicYearId) {
      throw new BadRequestException('targetAcademicYearId est requis');
    }
    return this.service.duplicateFicheToYear(
      tenantId, sourceFicheId, body.targetAcademicYearId,
      body.targetTeacherId, body.targetClassId,
    );
  }

  // ⭐ CROSS-YEAR REUSE : dupliquer un cahier journal d'une année précédente vers l'année courante
  //    Crée un nouveau CahierJournal avec :
  //    - academicYearId = année cible
  //    - teacherId = enseignant cible (ou enseignant d'origine)
  //    - classId = classe cible (ou classe d'origine)
  //    - weekStartDate/weekEndDate = recalculées pour la même semaine de l'année cible
  //    - entries = copie de la grille hebdo (contenu pédagogique)
  //    - status = DRAFT (l'enseignant peut l'éditer avant soumission)
  //    - originalJournalId = ID du cahier journal d'origine (traçabilité)
  @Post('cahier-journal/:id/duplicate-to-year')
  @HttpCode(HttpStatus.OK)
  async duplicateCahierJournalToCurrentYear(
    @TenantId() tenantId: string,
    @Param('id') sourceJournalId: string,
    @Body() body: {
      targetAcademicYearId: string;
      targetTeacherId?: string;
      targetClassId?: string;
      targetWeekStartDate?: string; // ISO date — si non fourni, décalage de N années
    },
  ) {
    if (!body.targetAcademicYearId) {
      throw new BadRequestException('targetAcademicYearId est requis');
    }
    return this.service.duplicateCahierJournalToYear(
      tenantId, sourceJournalId, body.targetAcademicYearId,
      body.targetTeacherId, body.targetClassId, body.targetWeekStartDate,
    );
  }

  // ===========================================================================
  // CATALOGUE — Hiérarchie années → trimestres → mois → semaines
  //    Pour l'espace pédagogie enseignant, sous-onglet "Catalogue"
  //    Pattern identique à l'explorateur Windows : on navigue dans les dossiers
  //    pour retrouver les cahiers journaux + fiches pédagogiques des années antérieures
  // ===========================================================================

  @Get('catalogue')
  async getCatalogue(
    @TenantId() tenantId: string,
    @Query('teacherId') teacherId: string,
    @Query('classId') classId?: string,
  ) {
    if (!teacherId) {
      throw new BadRequestException('teacherId est requis');
    }
    return this.service.getCatalogue(tenantId, teacherId, classId);
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
    @Query('status') status?: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId est requis');
    // ⭐ status options : 'SUBMITTED' (default) | 'VALIDATED' | 'REJECTED' | 'ALL'
    const statusFilter = status && ['SUBMITTED', 'VALIDATED', 'REJECTED', 'ALL'].includes(status)
      ? status
      : 'SUBMITTED';
    return this.service.getPendingCahierJournals(tenantId, academicYearId, statusFilter);
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
    @Query('status') status?: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId est requis');
    // ⭐ status options : 'SUBMITTED' (default) | 'VALIDATED' | 'REJECTED' | 'ALL'
    const statusFilter = status && ['SUBMITTED', 'VALIDATED', 'REJECTED', 'ALL'].includes(status)
      ? status
      : 'SUBMITTED';
    return this.service.getPendingPedagogicalFiches(tenantId, academicYearId, statusFilter);
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

  // ⭐ Mise à jour directeur : observations + signature + validation fiche pédagogique
  //    action maintenant optionnelle — si absente → sauvegarde simple (pas de changement de statut, pas de notification)
  //    Pattern identique à directorUpdateCahierJournal
  @Put('director/fiches/:id/director-update')
  async directorUpdatePedagogicalFiche(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: {
      directorSectionObservations?: Record<string, string>;
      directorObservation?: string;
      directorSignature?: string;
      action?: 'VALIDATED' | 'REJECTED';
      rejectionReason?: string;
      validatedBy?: string;
    },
  ) {
    return this.service.directorUpdatePedagogicalFiche(tenantId, id, body);
  }

  // ⭐ Envoi manuel de notification à l'enseignant après validation/rejet d'une fiche
  //    Permet au directeur de re-notifier l'enseignant (rappel) sans changer le statut
  @Post('director/fiches/:id/send-to-teacher')
  @HttpCode(HttpStatus.OK)
  async sendFicheDecisionToTeacher(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.sendFicheDecisionToTeacher(tenantId, id);
  }

  // ⭐ Envoi manuel de notification à l'enseignant après validation/rejet d'un cahier journal
  @Post('cahier-journal/:id/send-to-teacher')
  @HttpCode(HttpStatus.OK)
  async sendCahierJournalDecisionToTeacher(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.sendCahierJournalDecisionToTeacher(tenantId, id);
  }

  // --- Registres d'appel ---

  @Get('director/pending-registers')
  async getPendingAttendanceRegisters(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('status') status?: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId est requis');
    // ⭐ status options : 'SUBMITTED' (default) | 'VALIDATED' | 'REJECTED' | 'ALL'
    const statusFilter = status && ['SUBMITTED', 'VALIDATED', 'REJECTED', 'ALL'].includes(status)
      ? status
      : 'SUBMITTED';
    return this.service.getPendingAttendanceRegisters(tenantId, academicYearId, statusFilter);
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

  // ⭐ Mise à jour directeur : observations + signature + validation registre + évaluation
  @Put('director/attendance-registers/:id/director-update')
  async directorUpdateAttendanceRegister(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: {
      directorSignature?: string;
      directorObservation?: string;
      action: 'VALIDATED' | 'REJECTED';
      rejectionReason?: string;
      validatedBy?: string;
    },
  ) {
    return this.service.directorUpdateAttendanceRegister(tenantId, id, body);
  }

  // --- Évaluations mensuelles ---

  @Get('director/pending-evaluations')
  async getPendingMonthlyEvaluations(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('status') status?: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId est requis');
    // ⭐ status options : 'SUBMITTED' (default) | 'VALIDATED' | 'REJECTED' | 'ALL'
    const statusFilter = status && ['SUBMITTED', 'VALIDATED', 'REJECTED', 'ALL'].includes(status)
      ? status
      : 'SUBMITTED';
    return this.service.getPendingMonthlyEvaluations(tenantId, academicYearId, statusFilter);
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
    @Query('teacherId') teacherId: string,
  ) {
    if (!academicYearId || !classId) {
      throw new BadRequestException('academicYearId et classId sont requis');
    }
    return this.service.getAvailableSubjectsForClass(tenantId, academicYearId, classId, teacherId);
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

  @Get('cahier-textes')
  async getCahierDeTextes(
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
    return this.service.getCahierDeTextes(
      tenantId, teacherId, academicYearId,
      classId, testType, trimester ? parseInt(trimester) : undefined,
    );
  }

  @Get('cahier-textes/:id')
  async getCahierDeTexte(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.getCahierDeTexte(tenantId, id);
  }

  @Post('cahier-textes')
  async createCahierDeTexte(
    @TenantId() tenantId: string,
    @Body() body: any,
  ) {
    return this.service.createCahierDeTexte(
      tenantId, body.academicYearId, body.teacherId, body,
    );
  }

  @Put('cahier-textes/:id')
  async updateCahierDeTexte(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.updateCahierDeTexte(tenantId, id, body);
  }

  @Delete('cahier-textes/:id')
  async deleteCahierDeTexte(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.deleteCahierDeTexte(tenantId, id);
  }

  @Post('cahier-textes/:id/submit')
  @HttpCode(HttpStatus.OK)
  async submitCahierDeTexte(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.submitCahierDeTexte(tenantId, id);
  }

  @Post('cahier-textes/:id/init-students')
  @HttpCode(HttpStatus.OK)
  async initCahierDeTexteStudents(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.initCahierDeTexteStudents(tenantId, id);
  }

  // === Validation direction pour les cahiers de test ===

  @Get('director/pending-cahier-textes')
  async getPendingCahierDeTextes(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId est requis');
    return this.service.getPendingCahierDeTextes(tenantId, academicYearId);
  }

  @Get('director/cahier-texte/:id')
  async getCahierDeTexteDetail(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.getCahierDeTexteDetail(tenantId, id);
  }

  @Post('director/validate-cahier-texte/:id')
  @HttpCode(HttpStatus.OK)
  async validateCahierDeTexte(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: {
      action: 'VALIDATED' | 'REJECTED';
      validatedBy: string;
      rejectionReason?: string;
    },
  ) {
    return this.service.validateCahierDeTexte(
      tenantId, id, body.action, body.validatedBy, body.rejectionReason,
    );
  }

  // ─── EXPORT REGISTRE D'APPEL (Excel / PDF) ──────────────────────────────

  @Get('attendance-registers/:id/export')
  async exportRegister(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Query('format') format: string,
    @Res() res: any,
  ) {
    if (!format || (format !== 'excel' && format !== 'pdf')) {
      throw new BadRequestException('format doit être "excel" ou "pdf"');
    }
    const buffer = await this.service.exportAttendanceRegister(tenantId, id, format);
    // ⭐ Excel = CSV (avec BOM), PDF = vrai PDF via Puppeteer
    const ext = format === 'excel' ? 'csv' : 'pdf';
    const mimeType = format === 'excel'
      ? 'text/csv; charset=utf-8'
      : 'application/pdf';
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="Registre_Appel.${ext}"`,
    });
    res.send(buffer);
  }

  // ─── EXPORT CAHIER JOURNAL (Excel / PDF) ────────────────────────────────

  @Get('cahier-journal/:id/export')
  async exportCahierJournal(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Query('format') format: string,
    @Res() res: any,
  ) {
    // ⭐ Excel supprimé — seul le PDF est supporté (format professionnel via Puppeteer)
    const fmt = format || 'pdf';
    if (fmt !== 'pdf') {
      throw new BadRequestException('Seul le format PDF est supporté pour le cahier journal');
    }
    const buffer = await this.service.exportCahierJournal(tenantId, id, 'pdf');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Cahier_Journal.pdf"`,
    });
    res.send(buffer);
  }

  // ===========================================================================
  // CAHIER DU SEMAINIER — Endpoints
  // ===========================================================================

  @Get('seminar-config')
  async getSeminarConfigs(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.service.getSeminarConfigs(tenantId, academicYearId);
  }

  @Post('seminar-config/auto-generate')
  async autoGenerateSeminarConfigs(
    @TenantId() tenantId: string,
    @Body() body: { academicYearId: string; tenantId: string },
  ) {
    return this.service.autoGenerateSeminarConfigs(tenantId, body.academicYearId);
  }

  // ⭐ Configuration MANUELLE — créer un semainier pour une semaine spécifique
  @Post('seminar-config/manual')
  async createSeminarConfigManual(
    @TenantId() tenantId: string,
    @Body() body: {
      academicYearId: string;
      weekNumber: number;
      trimester: number;
      weekStartDate: string;
      weekEndDate: string;
      teacherId: string;
      classIds?: string[];
    },
  ) {
    return this.service.createSeminarConfigManual(tenantId, body);
  }

  // ⭐ Enseignants éligibles (FR only, maternelle + primaire) + leurs classes
  @Get('seminar-config/eligible-teachers')
  async getEligibleSeminarTeachers(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.service.getEligibleSeminarTeachers(tenantId, academicYearId);
  }

  // ⭐ Vérifie si l'enseignant connecté est le semainier pour la semaine
  //    courante OU la semaine prochaine. Utilisé par le dashboard enseignant
  //    pour afficher une bannière de notification "Vous êtes le semainier
  //    cette semaine / la semaine prochaine".
  //    La notification doit s'afficher :
  //      - Le week-end (samedi/dimanche) AVANT le début de la semaine où l'enseignant est semainier
  //      - Pendant toute la semaine où l'enseignant est semainier
  //    Retourne { currentWeek: config|null, nextWeek: config|null } où config
  //    contient les infos essentielles (weekNumber, trimester, dates, classes, status).
  @Get('seminar-config/my-assignment')
  async getMySeminarAssignment(
    @TenantId() tenantId: string,
    @Query('teacherId') teacherId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.service.getMySeminarAssignment(tenantId, teacherId, academicYearId);
  }

  // ⭐ Suppression manuelle d'un semainier (uniquement si PENDING)
  @Delete('seminar-config/:id')
  async deleteSeminarConfig(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.deleteSeminarConfig(tenantId, id);
  }

  // ⭐ RAPPORT HEBDOMADAIRE (synthèse de fin de semaine — page 8 du document)
  @Get('seminar-weekly-report')
  async getWeeklyReport(
    @TenantId() tenantId: string,
    @Query('configId') configId: string,
  ) {
    return this.service.getOrCreateWeeklyReport(tenantId, configId);
  }

  @Put('seminar-weekly-report/:id')
  async updateWeeklyReport(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.updateWeeklyReport(tenantId, id, body);
  }

  @Put('seminar-config/:id')
  async updateSeminarConfig(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.updateSeminarConfig(tenantId, id, body);
  }

  // ⭐ Soumet le cahier de semaine au directeur (enseignant → direction)
  @Post('seminar-config/:id/submit')
  @HttpCode(HttpStatus.OK)
  async submitSeminarConfig(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.submitSeminarConfig(tenantId, id);
  }

  // ⭐ Valide ou rejette le cahier de semaine (direction)
  @Post('seminar-config/:id/validate')
  @HttpCode(HttpStatus.OK)
  async validateSeminarConfig(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { action: 'VALIDATED' | 'REJECTED'; directorSignature: string; validatedBy: string; rejectionReason?: string },
  ) {
    return this.service.validateSeminarConfig(tenantId, id, body.action, body.directorSignature, body.validatedBy, body.rejectionReason);
  }

  @Get('seminar-daily-report')
  async getDailyReport(
    @TenantId() tenantId: string,
    @Query('configId') configId: string,
    @Query('dayOfWeek') dayOfWeek: string,
  ) {
    return this.service.getOrCreateDailyReport(tenantId, configId, parseInt(dayOfWeek));
  }

  @Put('seminar-daily-report/:id')
  async updateDailyReport(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.updateDailyReport(tenantId, id, body);
  }

  // ===========================================================================
  // CAHIER DU SEMAINIER — Phase 6 : Communication inter-modules
  // Synchronisation automatique depuis RH (présences enseignants),
  // Élèves (appel), et EDT (cours modifiés).
  // ===========================================================================

  @Get('seminar-daily-report/:id/cross-module')
  async getCrossModuleData(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.fetchCrossModuleData(tenantId, id);
  }

  @Post('seminar-daily-report/:id/sync-from-rh')
  async syncFromRh(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.syncStaffAttendanceFromRh(tenantId, id);
  }

  @Post('seminar-daily-report/:id/sync-from-students')
  async syncFromStudents(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.syncStudentPresenceFromAttendance(tenantId, id);
  }

  @Post('seminar-daily-report/:id/sync-from-edt')
  async syncFromEdt(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.syncScheduleFromEdt(tenantId, id);
  }

  // ===========================================================================
  // CAHIER DU SEMAINIER — Phase 7 : Export PDF
  // ===========================================================================

  @Get('seminar-config/:id/export')
  async exportSeminarConfig(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Query('format') format: string,
    @Res() res: any,
  ) {
    if (!format || (format !== 'pdf' && format !== 'excel')) {
      throw new BadRequestException('format doit être "pdf" ou "excel"');
    }
    const buffer = await this.service.exportSeminarWeek(tenantId, id, format);
    const ext = format === 'excel' ? 'csv' : 'pdf';
    const mimeType = format === 'excel'
      ? 'text/csv; charset=utf-8'
      : 'application/pdf';
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="Cahier_Semainier_S${id}.${ext}"`,
    });
    res.send(buffer);
  }
}
