/**
 * ============================================================================
 * RECRUITMENT PRISMA CONTROLLER - MODULE 5 (SCHEMA-ALIGNED v2)
 * ============================================================================
 *
 * Controller pour la gestion du recrutement.
 * Utilise @GetTenant() pour la résolution du tenant (sauf endpoints @Public).
 * Les endpoints @Public() utilisent @Query('tenantId') car il n'y a pas de contexte auth.
 *
 * ============================================================================
 */

import { Controller, Get, Post, Put, Body, Query, Param, Delete, UseGuards, UseInterceptors, UploadedFiles, Res, StreamableFile, BadRequestException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { RecruitmentPrismaService } from './recruitment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { Public } from '../auth/decorators/public.decorator';
import {
  CreateJobDto,
  UpdateJobDto,
  CreateCandidateDto,
  UpdateCandidateDto,
  CreateApplicationDto,
  UpdateApplicationStatusDto,
  CreateInterviewDto,
  UpdateInterviewDto,
  ValidateInterviewDto,
  CreateTestDto,
  UpdateTestDto,
  CreateTestResultDto,
  UpdateTestResultDto,
  AddToTalentPoolDto,
  ApplyJobDto,
  UpsertRecruiterProfileDto,
  ReassignApplicationDto,
} from './dto';

@Controller('hr/recruitment')
@UseGuards(JwtAuthGuard, TenantGuard)
export class RecruitmentPrismaController {
  constructor(private service: RecruitmentPrismaService) {}

  // ─── Job Offers ────────────────────────────────────────────────────────────

  @Public()
  @Get('jobs')
  async getJobs(@GetTenant() tenant: any, @Query('tenantId') tenantIdFallback?: string) {
    return this.service.getJobs(tenant?.id ?? tenantIdFallback);
  }

  @Public()
  @Get('jobs/:id/stats')
  async getJobStats(@Param('id') jobId: string, @Query('tenantId') tenantIdFallback?: string) {
    return this.service.getJobStats(jobId, tenantIdFallback);
  }

  @Public()
  @Get('jobs/by-slug/:slug')
  async getJobBySlug(@Param('slug') slug: string) {
    return this.service.getJobBySlug(slug);
  }

  @Post('jobs')
  async createJob(
    @GetTenant() tenant: any,
    @Body() body: CreateJobDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour créer une offre d\'emploi');
    }
    return this.service.createJob(tid, body);
  }

  @Put('jobs/:id')
  async updateJob(@Param('id') id: string, @Body() body: UpdateJobDto) {
    return this.service.updateJob(id, body);
  }

  @Put('jobs/:id/deactivate')
  async deactivateJob(@Param('id') id: string) {
    return this.service.deactivateJob(id);
  }

  @Put('jobs/:id/republish')
  async republishJob(@Param('id') id: string) {
    return this.service.republishJob(id);
  }

  @Delete('jobs/:id')
  async deleteJob(@Param('id') id: string) {
    return this.service.deleteJob(id);
  }

  // ─── Candidates CRUD ────────────────────────────────────────────────────────

  @Get('candidates')
  async getCandidates(@GetTenant() tenant: any, @Query('tenantId') tenantIdFallback?: string) {
    return this.service.getCandidates(tenant?.id ?? tenantIdFallback);
  }

  @Post('candidates')
  async createCandidate(
    @GetTenant() tenant: any,
    @Body() body: CreateCandidateDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour créer un candidat');
    }
    return this.service.createCandidate(tid, body);
  }

  @Put('candidates/:id')
  async updateCandidate(@Param('id') id: string, @Body() body: UpdateCandidateDto) {
    return this.service.updateCandidate(id, body);
  }

  @Delete('candidates/:id')
  async deleteCandidate(@Param('id') id: string) {
    return this.service.deleteCandidate(id);
  }

  // ─── Applications ────────────────────────────────────────────────────────────

  @Get('applications')
  async getApplications(@GetTenant() tenant: any, @Query('tenantId') tenantIdFallback?: string) {
    return this.service.getApplications(tenant?.id ?? tenantIdFallback);
  }

  @Post('applications')
  async createApplication(
    @GetTenant() tenant: any,
    @Body() body: CreateApplicationDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour créer une candidature');
    }
    return this.service.createApplication(tid, body);
  }

  @Put('applications/:id/status')
  async updateApplicationStatus(@Param('id') id: string, @Body() body: UpdateApplicationStatusDto) {
    return this.service.updateApplicationStatus(id, body.status, body.review);
  }

  @Delete('applications/:id')
  async deleteApplication(@Param('id') id: string) {
    return this.service.deleteApplication(id);
  }

  // ─── Interviews ──────────────────────────────────────────────────────────────

  @Get('interviews')
  async getInterviews(@GetTenant() tenant: any, @Query('tenantId') tenantIdFallback?: string) {
    return this.service.getInterviews(tenant?.id ?? tenantIdFallback);
  }

  @Post('interviews')
  async createInterview(
    @GetTenant() tenant: any,
    @Body() body: CreateInterviewDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour créer un entretien');
    }
    return this.service.createInterview(tid, body);
  }

  @Put('interviews/:id')
  async updateInterview(@Param('id') id: string, @Body() body: UpdateInterviewDto) {
    return this.service.updateInterview(id, body);
  }

  @Put('interviews/:id/validate')
  async validateInterview(
    @Param('id') id: string,
    @Body() body: ValidateInterviewDto,
  ) {
    return this.service.validateInterview(id, body);
  }

  @Delete('interviews/:id')
  async deleteInterview(@Param('id') id: string) {
    return this.service.deleteInterview(id);
  }

  // ─── Tests ────────────────────────────────────────────────────────────────────

  @Get('tests')
  async getTests(@GetTenant() tenant: any, @Query('tenantId') tenantIdFallback?: string) {
    return this.service.getTests(tenant?.id ?? tenantIdFallback);
  }

  @Post('tests')
  async createTest(
    @GetTenant() tenant: any,
    @Body() body: CreateTestDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour créer un test');
    }
    return this.service.createTest(tid, body);
  }

  @Put('tests/:id')
  async updateTest(@Param('id') id: string, @Body() body: UpdateTestDto) {
    return this.service.updateTest(id, body);
  }

  @Delete('tests/:id')
  async deleteTest(@Param('id') id: string) {
    return this.service.deleteTest(id);
  }

  // ─── Test Results ─────────────────────────────────────────────────────────────

  @Post('test-results')
  async createTestResult(@Body() body: CreateTestResultDto) {
    try {
      return await this.service.createTestResult(body);
    } catch (error: any) {
      console.error('[HR] createTestResult error:', error?.message || error);
      throw error;
    }
  }

  @Put('test-results/:id')
  async updateTestResult(@Param('id') id: string, @Body() body: UpdateTestResultDto) {
    try {
      return await this.service.updateTestResult(id, body);
    } catch (error: any) {
      console.error('[HR] updateTestResult error:', error?.message || error);
      throw error;
    }
  }

  @Delete('test-results/:id')
  async deleteTestResult(@Param('id') id: string) {
    return this.service.deleteTestResult(id);
  }

  // ─── Talent Pool ──────────────────────────────────────────────────────────────

  @Get('talent-pool')
  async getTalentPool(@GetTenant() tenant: any, @Query('tenantId') tenantIdFallback?: string) {
    return this.service.getTalentPool(tenant?.id ?? tenantIdFallback);
  }

  @Post('talent-pool/:candidateId')
  async addToTalentPool(@Param('candidateId') candidateId: string, @Body() body: AddToTalentPoolDto) {
    return this.service.addToTalentPool(candidateId, body);
  }

  @Delete('talent-pool/:id')
  async removeFromTalentPool(@Param('id') id: string) {
    return this.service.removeFromTalentPool(id);
  }

  // ─── Public Job Apply ──────────────────────────────────────────────────────

  @Public()
  @Post('apply')
  @SkipThrottle()
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'cv', maxCount: 1 },
    { name: 'applicationLetter', maxCount: 1 },
    { name: 'coverLetter', maxCount: 1 },
    { name: 'recommendationLetter', maxCount: 1 }
  ], {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB per file
      fieldSize: 5 * 1024 * 1024,  // 5MB per non-file field (for large JSON payloads)
    }
  }))
  async applyJob(
    @Body() body: ApplyJobDto,
    @UploadedFiles() files: {
      cv?: Express.Multer.File[];
      applicationLetter?: Express.Multer.File[];
      coverLetter?: Express.Multer.File[];
      recommendationLetter?: Express.Multer.File[];
    }
  ) {
    return this.service.applyJob(body, files);
  }

  /**
   * Public job apply via data URLs (base64) — pattern identique au logo école.
   *
   * Body: { ...ApplyJobDto, cv?, applicationLetter?, coverLetter?, recommendationLetter? }
   * où chaque fichier est { fileName, fileDataUrl, mimeType, fileSize }
   *
   * Plus fiable que le multipart via BFF proxy. Supporte les PDF et images.
   */
  @Public()
  @Post('apply-data')
  @SkipThrottle()
  async applyJobDataUrl(@Body() body: any) {
    // Convertir les data URLs en pseudo-files Express.Multer.File
    const convertToFile = (f: any): Express.Multer.File | null => {
      if (!f || !f.fileDataUrl) return null;
      const m = /^data:([^;]+);base64,(.+)$/i.exec(f.fileDataUrl);
      if (!m) return null;
      const buffer = Buffer.from(m[2], 'base64');
      return {
        buffer,
        originalname: f.fileName || 'document',
        mimetype: f.mimeType || m[1],
        size: f.fileSize || buffer.length,
        fieldname: 'file',
        encoding: '7bit',
        destination: '',
        filename: f.fileName || 'document',
        path: '',
        stream: null as any,
      } as unknown as Express.Multer.File;
    };

    const files: any = {};
    if (body.cv) files.cv = [convertToFile(body.cv)].filter(Boolean);
    if (body.applicationLetter) files.applicationLetter = [convertToFile(body.applicationLetter)].filter(Boolean);
    if (body.coverLetter) files.coverLetter = [convertToFile(body.coverLetter)].filter(Boolean);
    if (body.recommendationLetter) files.recommendationLetter = [convertToFile(body.recommendationLetter)].filter(Boolean);

    // Passer un flag au service pour qu'il stocke les data URLs directement
    // au lieu de les uploader vers S3/R2
    body._useDataUrlStorage = true;
    return this.service.applyJob(body, files);
  }

  // ─── Candidate Document Delete ──────────────────────────────────────────

  @Delete('candidates/:candidateId/documents/:docId')
  async deleteCandidateDocument(
    @Param('candidateId') candidateId: string,
    @Param('docId') docId: string,
  ) {
    return this.service.deleteCandidateDocument(candidateId, docId);
  }

  // ─── Candidate Document Download ──────────────────────────────────────────

  @Get('candidates/:candidateId/documents/:docId/download')
  async downloadCandidateDocument(
    @Param('candidateId') candidateId: string,
    @Param('docId') docId: string,
    @Res({ passthrough: true }) res: any,
  ) {
    return this.service.downloadCandidateDocument(candidateId, docId, res);
  }

  // ─── Admin: Orphaned File Cleanup ──────────────────────────────────────
  // Requires JWT auth — call from admin interface

  @Post('cleanup/orphaned-files')
  async cleanupOrphanedFiles(@GetTenant() tenant: any, @Query('tenantId') tenantIdFallback?: string) {
    return this.service.cleanupOrphanedFiles(tenant?.id ?? tenantIdFallback);
  }

  // ─── Admin: Fix Application Statuses ──────────────────────────────────
  // Retroactively correct application statuses based on completed interviews/tests

  @Post('fix/application-statuses')
  async fixApplicationStatuses(@GetTenant() tenant: any, @Query('tenantId') tenantIdFallback?: string) {
    return this.service.fixApplicationStatuses(tenant?.id ?? tenantIdFallback);
  }

  // ============================================================================
  // RECRUITER PROFILE — Configuration du recruteur par tenant
  // ============================================================================

  @Get('recruiter-profile')
  async getRecruiterProfile(
    @GetTenant() tenant: any,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    return this.service.getRecruiterProfile(tenant?.id ?? tenantIdFallback);
  }

  @Put('recruiter-profile')
  async upsertRecruiterProfile(
    @GetTenant() tenant: any,
    @Body() body: UpsertRecruiterProfileDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    return this.service.upsertRecruiterProfile(tenant?.id ?? tenantIdFallback, body);
  }

  @Delete('recruiter-profile')
  async deactivateRecruiterProfile(
    @GetTenant() tenant: any,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    return this.service.deactivateRecruiterProfile(tenant?.id ?? tenantIdFallback);
  }

  // ============================================================================
  // REASSIGN APPLICATION — Multi-postulation / réaffectation après embauche
  // ============================================================================

  @Post('applications/:id/reassign')
  async reassignApplication(
    @Param('id') id: string,
    @GetTenant() tenant: any,
    @Body() body: ReassignApplicationDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    return this.service.reassignApplication(id, tenant?.id ?? tenantIdFallback, body);
  }

  // ============================================================================
  // TEST — Renvoyer l'email de notification de candidature à un candidat existant
  // Endpoint temporaire pour tester l'envoi d'email sans soumettre une nouvelle
  // candidature. À supprimer après validation.
  // ============================================================================

  @Public()
  @Post('test-resend-email/:candidateId')
  async testResendEmail(
    @Param('candidateId') candidateId: string,
    @Query('tenantId') tenantId: string,
  ) {
    return this.service.testResendApplicationEmail(candidateId, tenantId);
  }

  // ============================================================================
  // TEST — Renvoyer l'email de notification "Résultat entretien" à un candidat
  // Endpoint temporaire pour tester l'envoi d'email sans passer par le bouton
  // "Valider l'entretien". À supprimer après validation.
  // ============================================================================

  @Public()
  @Post('test-resend-interview-result/:interviewId')
  async testResendInterviewResultEmail(
    @Param('interviewId') interviewId: string,
    @Query('tenantId') tenantId: string,
  ) {
    return this.service.testResendInterviewResultEmail(interviewId, tenantId);
  }

  // ============================================================================
  // TEST — Renvoyer l'email de notification "Résultat test" à un candidat
  // Endpoint temporaire pour tester l'envoi d'email sans créer un nouveau test
  // result. À supprimer après validation.
  // ============================================================================

  @Public()
  @Post('test-resend-test-result/:testResultId')
  async testResendTestResultEmail(
    @Param('testResultId') testResultId: string,
    @Query('tenantId') tenantId: string,
  ) {
    return this.service.testResendTestResultEmail(testResultId, tenantId);
  }

  // ============================================================================
  // TEST — Renvoyer l'email "Résultat entretien" en retrouvant l'entretien
  // le plus récent d'un candidat par son email.
  // Endpoint temporaire pour tester sans connaître l'interviewId. À supprimer
  // après validation.
  //
  // Usage :
  //   POST /api/hr/recruitment/test-resend-interview-result-by-email
  //        ?email=aurore@example.com&tenantId=...
  // ============================================================================

  @Public()
  @Post('test-resend-interview-result-by-email')
  async testResendInterviewResultByEmail(
    @Query('email') email: string,
    @Query('tenantId') tenantId: string,
  ) {
    return this.service.testResendInterviewResultByEmail(email, tenantId);
  }

  // ============================================================================
  // TEST — Renvoyer l'email "Résultat test" en retrouvant le test result le
  // plus récent d'un candidat par son email.
  // Endpoint temporaire pour tester sans connaître le testResultId.
  // ============================================================================

  @Public()
  @Post('test-resend-test-result-by-email')
  async testResendTestResultByEmail(
    @Query('email') email: string,
    @Query('tenantId') tenantId: string,
  ) {
    return this.service.testResendTestResultByEmail(email, tenantId);
  }

  // ============================================================================
  // TEST — Envoie DIRECTEMENT l'email "Résultat entretien" avec les paramètres
  // fournis dans le body (sans lookup DB). Permet de tester le template
  // email sans devoir avoir un entretien existant en base.
  //
  // Body JSON:
  //   {
  //     "tenantId": "...",
  //     "toEmail": "candidate@example.com",
  //     "candidateFirstName": "Aurore",
  //     "candidateName": "Aurore AKPOVI",
  //     "jobTitle": "Professeur des SVT",
  //     "result": "RÉUSSI",        // ou "ÉCHEC"
  //     "score": 85,
  //     "feedback": "<p>excellent</p>",
  //     "evaluator": "M. Dupont",
  //     "interviewDate": "2026-06-19"  // ISO ou YYYY-MM-DD
  //   }
  // ============================================================================

  @Public()
  @Post('test-send-interview-result-direct')
  async testSendInterviewResultDirect(@Body() body: any) {
    return this.service.testSendInterviewResultDirect(body);
  }

  // ============================================================================
  // TEST — Envoie DIRECTEMENT l'email "Résultat test" avec les paramètres
  // fournis dans le body (sans lookup DB).
  //
  // Body JSON:
  //   {
  //     "tenantId": "...",
  //     "toEmail": "candidate@example.com",
  //     "candidateFirstName": "Aurore",
  //     "candidateName": "Aurore AKPOVI",
  //     "jobTitle": "Professeur des SVT",
  //     "testName": "Test de connaissances",
  //     "result": "RÉUSSI",
  //     "score": 80,
  //     "maxScore": 100,
  //     "passingScore": 50,
  //     "feedback": "<p>excellent</p>"
  //   }
  // ============================================================================

  @Public()
  @Post('test-send-test-result-direct')
  async testSendTestResultDirect(@Body() body: any) {
    return this.service.testSendTestResultDirect(body);
  }

  // ============================================================================
  // TEST — Vérifier les documents d'un candidat (endpoint temporaire @Public)
  // Pour diagnostiquer pourquoi les documents n'apparaissent pas dans la fiche.
  // À supprimer après diagnostic.
  //
  // GET /api/hr/recruitment/debug-candidate-documents/:candidateId?tenantId=...
  // ============================================================================

  @Public()
  @Get('debug-candidate-documents/:candidateId')
  async debugCandidateDocuments(
    @Param('candidateId') candidateId: string,
    @Query('tenantId') tenantId: string,
  ) {
    return this.service.debugCandidateDocuments(candidateId, tenantId);
  }
}
