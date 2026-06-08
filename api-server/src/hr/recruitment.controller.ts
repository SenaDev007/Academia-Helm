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
    @UploadedFiles() files: { cv?: Express.Multer.File[], coverLetter?: Express.Multer.File[], recommendationLetter?: Express.Multer.File[] }
  ) {
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
}
