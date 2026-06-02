import { Controller, Get, Post, Put, Body, Query, Param, Delete, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { RecruitmentPrismaService } from './recruitment.service';
import { Public } from '../auth/decorators/public.decorator';



@Controller('hr/recruitment')
export class RecruitmentPrismaController {
  constructor(private service: RecruitmentPrismaService) {}

  // Job Offers
  @Public()
  @Get('jobs')
  async getJobs(@Query('tenantId') tenantId: string) {
    return this.service.getJobs(tenantId);
  }

  @Post('jobs')
  async createJob(@Query('tenantId') tenantId: string, @Body() body: any) {
    return this.service.createJob(tenantId, body);
  }

  @Put('jobs/:id')
  async updateJob(@Param('id') id: string, @Body() body: any) {
    return this.service.updateJob(id, body);
  }

  @Delete('jobs/:id')
  async deleteJob(@Param('id') id: string) {
    return this.service.deleteJob(id);
  }

  // Candidates CRUD
  @Get('candidates')
  async getCandidates(@Query('tenantId') tenantId: string) {
    return this.service.getCandidates(tenantId);
  }

  @Post('candidates')
  async createCandidate(@Query('tenantId') tenantId: string, @Body() body: any) {
    return this.service.createCandidate(tenantId, body);
  }

  @Put('candidates/:id')
  async updateCandidate(@Param('id') id: string, @Body() body: any) {
    return this.service.updateCandidate(id, body);
  }

  @Delete('candidates/:id')
  async deleteCandidate(@Param('id') id: string) {
    return this.service.deleteCandidate(id);
  }

  // Applications
  @Get('applications')
  async getApplications(@Query('tenantId') tenantId: string) {
    return this.service.getApplications(tenantId);
  }

  @Post('applications')
  async createApplication(@Query('tenantId') tenantId: string, @Body() body: any) {
    return this.service.createApplication(tenantId, body);
  }

  @Put('applications/:id/status')
  async updateApplicationStatus(@Param('id') id: string, @Body() body: { status: string; review?: string }) {
    return this.service.updateApplicationStatus(id, body.status, body.review);
  }

  @Delete('applications/:id')
  async deleteApplication(@Param('id') id: string) {
    return this.service.deleteApplication(id);
  }

  // Interviews
  @Get('interviews')
  async getInterviews(@Query('tenantId') tenantId: string) {
    return this.service.getInterviews(tenantId);
  }

  @Post('interviews')
  async createInterview(@Query('tenantId') tenantId: string, @Body() body: any) {
    return this.service.createInterview(tenantId, body);
  }

  @Put('interviews/:id')
  async updateInterview(@Param('id') id: string, @Body() body: any) {
    return this.service.updateInterview(id, body);
  }

  @Delete('interviews/:id')
  async deleteInterview(@Param('id') id: string) {
    return this.service.deleteInterview(id);
  }

  // Tests
  @Get('tests')
  async getTests(@Query('tenantId') tenantId: string) {
    return this.service.getTests(tenantId);
  }

  @Post('tests')
  async createTest(@Query('tenantId') tenantId: string, @Body() body: any) {
    return this.service.createTest(tenantId, body);
  }

  @Put('tests/:id')
  async updateTest(@Param('id') id: string, @Body() body: any) {
    return this.service.updateTest(id, body);
  }

  @Delete('tests/:id')
  async deleteTest(@Param('id') id: string) {
    return this.service.deleteTest(id);
  }

  // Test Results
  @Post('test-results')
  async createTestResult(@Body() body: any) {
    return this.service.createTestResult(body);
  }

  @Delete('test-results/:id')
  async deleteTestResult(@Param('id') id: string) {
    return this.service.deleteTestResult(id);
  }

  // Talent Pool
  @Get('talent-pool')
  async getTalentPool(@Query('tenantId') tenantId: string) {
    return this.service.getTalentPool(tenantId);
  }

  @Post('talent-pool/:candidateId')
  async addToTalentPool(@Param('candidateId') candidateId: string, @Body() body: any) {
    return this.service.addToTalentPool(candidateId, body);
  }

  @Delete('talent-pool/:id')
  async removeFromTalentPool(@Param('id') id: string) {
    return this.service.removeFromTalentPool(id);
  }

  // Public/Job apply endpoint
  @Public()
  @Post('apply')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'cv', maxCount: 1 },
    { name: 'coverLetter', maxCount: 1 },
    { name: 'recommendationLetter', maxCount: 1 }
  ]))
  async applyJob(
    @Body() body: any,
    @UploadedFiles() files: { cv?: Express.Multer.File[], coverLetter?: Express.Multer.File[], recommendationLetter?: Express.Multer.File[] }
  ) {
    return this.service.applyJob(body, files);
  }
}


