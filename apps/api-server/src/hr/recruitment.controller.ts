import { Controller, Get, Post, Put, Body, Query, Param, Delete } from '@nestjs/common';
import { RecruitmentPrismaService } from './recruitment.service';

@Controller('hr/recruitment')
export class RecruitmentPrismaController {
  constructor(private service: RecruitmentPrismaService) {}

  // Job Offers
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

  // Candidates
  @Get('candidates')
  async getCandidates(@Query('tenantId') tenantId: string) {
    return this.service.getCandidates(tenantId);
  }

  @Post('candidates')
  async createCandidate(@Query('tenantId') tenantId: string, @Body() body: any) {
    return this.service.createCandidate(tenantId, body);
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
  async updateApplicationStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.service.updateApplicationStatus(id, status);
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
}
