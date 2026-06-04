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

import { Controller, Get, Post, Put, Body, Query, Param, Delete, UseGuards, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
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
  CreateTestDto,
  UpdateTestDto,
  CreateTestResultDto,
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

  @Post('jobs')
  async createJob(@GetTenant() tenant: any, @Body() body: CreateJobDto) {
    return this.service.createJob(tenant.id, body);
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
  async getCandidates(@GetTenant() tenant: any) {
    return this.service.getCandidates(tenant.id);
  }

  @Post('candidates')
  async createCandidate(@GetTenant() tenant: any, @Body() body: CreateCandidateDto) {
    return this.service.createCandidate(tenant.id, body);
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
  async getApplications(@GetTenant() tenant: any) {
    return this.service.getApplications(tenant.id);
  }

  @Post('applications')
  async createApplication(@GetTenant() tenant: any, @Body() body: CreateApplicationDto) {
    return this.service.createApplication(tenant.id, body);
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
  async getInterviews(@GetTenant() tenant: any) {
    return this.service.getInterviews(tenant.id);
  }

  @Post('interviews')
  async createInterview(@GetTenant() tenant: any, @Body() body: CreateInterviewDto) {
    return this.service.createInterview(tenant.id, body);
  }

  @Put('interviews/:id')
  async updateInterview(@Param('id') id: string, @Body() body: UpdateInterviewDto) {
    return this.service.updateInterview(id, body);
  }

  @Delete('interviews/:id')
  async deleteInterview(@Param('id') id: string) {
    return this.service.deleteInterview(id);
  }

  // ─── Tests ────────────────────────────────────────────────────────────────────

  @Get('tests')
  async getTests(@GetTenant() tenant: any) {
    return this.service.getTests(tenant.id);
  }

  @Post('tests')
  async createTest(@GetTenant() tenant: any, @Body() body: CreateTestDto) {
    return this.service.createTest(tenant.id, body);
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
    return this.service.createTestResult(body);
  }

  @Delete('test-results/:id')
  async deleteTestResult(@Param('id') id: string) {
    return this.service.deleteTestResult(id);
  }

  // ─── Talent Pool ──────────────────────────────────────────────────────────────

  @Get('talent-pool')
  async getTalentPool(@GetTenant() tenant: any) {
    return this.service.getTalentPool(tenant.id);
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
  ]))
  async applyJob(
    @Body() body: ApplyJobDto,
    @UploadedFiles() files: { cv?: Express.Multer.File[], coverLetter?: Express.Multer.File[], recommendationLetter?: Express.Multer.File[] }
  ) {
    return this.service.applyJob(body, files);
  }
}
