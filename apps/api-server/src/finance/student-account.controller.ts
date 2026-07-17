/**
 * SOUS-MODULE 2 — Comptes élèves — API
 */
import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { StudentAccountService } from './student-account.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('finance/accounts')
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
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    // ⭐ Task 20-a : flag exportAll pour lever la limite de 500 lors des exports PDF/Excel
    @Query('exportAll') exportAll?: string,
  ) {
    if (!academicYearId) return [];
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.service.findAll(tenantId, {
      academicYearId,
      classId,
      status,
      search,
      isBlocked: isBlocked === 'true' ? true : isBlocked === 'false' ? false : undefined,
      page: pageNum && !isNaN(pageNum) ? pageNum : undefined,
      limit: limitNum && !isNaN(limitNum) ? limitNum : undefined,
      // ⭐ Task 20-a : passe le flag exportAll au service (lève le cap de 500)
      exportAll: exportAll === 'true',
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
