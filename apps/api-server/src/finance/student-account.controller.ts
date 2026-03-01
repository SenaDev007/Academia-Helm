/**
 * SOUS-MODULE 2 — Comptes élèves — API
 */
import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { StudentAccountService } from './student-account.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/finance/accounts')
@UseGuards(JwtAuthGuard)
export class StudentAccountController {
  constructor(private readonly service: StudentAccountService) {}

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId?: string,
    @Query('status') status?: string,
    @Query('isBlocked') isBlocked?: string,
  ) {
    if (!academicYearId) return [];
    return this.service.findAll(tenantId, {
      academicYearId,
      classId,
      status,
      isBlocked: isBlocked === 'true' ? true : isBlocked === 'false' ? false : undefined,
    });
  }

  @Get('student/:studentId')
  async getOrCreate(
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
    @TenantId() tenantId: string,
  ) {
    if (!academicYearId) throw new Error('academicYearId required');
    return this.service.getOrCreate(tenantId, studentId, academicYearId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.findOne(id, tenantId);
  }

  @Post(':id/unblock')
  async unblock(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { reason: string },
  ) {
    return this.service.unblock(id, tenantId, body?.reason ?? '', user?.id);
  }
}
