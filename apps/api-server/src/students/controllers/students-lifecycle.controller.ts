/**
 * Module 1 — API cycle de vie élève : pre-register, admit, re-enroll, transfer, change-class, history, export EDUCMASTER.
 */

import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { StudentsLifecycleService } from '../services/students-lifecycle.service';
import { StudentIdCardService } from '../services/student-id-card.service';

@Controller('api/students')
@UseGuards(JwtAuthGuard)
export class StudentsLifecycleController {
  constructor(
    private readonly lifecycle: StudentsLifecycleService,
    private readonly idCard: StudentIdCardService,
  ) {}

  @Post('pre-register')
  async preRegister(@TenantId() tenantId: string, @Body() body: any) {
    return this.lifecycle.preRegister(tenantId, body);
  }

  @Post('admit')
  async admit(@TenantId() tenantId: string, @Body() body: any) {
    return this.lifecycle.admit(tenantId, body);
  }

  @Post('re-enroll')
  async reEnroll(@TenantId() tenantId: string, @Body() body: any) {
    return this.lifecycle.reEnroll(tenantId, body);
  }

  @Post('transfer')
  async transfer(@TenantId() tenantId: string, @Body() body: any) {
    return this.lifecycle.transfer(tenantId, body);
  }

  @Post('change-class')
  async changeClass(@TenantId() tenantId: string, @Body() body: any) {
    return this.lifecycle.changeClass(tenantId, body);
  }

  @Get('class/:classId')
  async getByClass(
    @TenantId() tenantId: string,
    @Param('classId') classId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.lifecycle.getStudentsByClass(tenantId, classId, academicYearId);
  }

  @Get(':id/history')
  async getHistory(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.lifecycle.getStudentHistory(tenantId, id);
  }

  @Post(':id/generate-card')
  async generateCard(
    @TenantId() tenantId: string,
    @Param('id') studentId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') schoolLevelId: string,
  ) {
    return this.idCard.generateIdCard(tenantId, academicYearId, schoolLevelId, studentId, undefined);
  }

  @Post(':id/export-educmaster')
  async exportEducmaster(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.lifecycle.exportEducmaster(tenantId, id);
  }
}
