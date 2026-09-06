/**
 * SOUS-MODULE 2 — Comptes élèves — API
 */
import { Controller, Get, Post, Body, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
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
    // ⭐ Task 23 : flag includeWithdrawn pour inclure les élèves abandonnés
    @Query('includeWithdrawn') includeWithdrawn?: string,
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
      // ⭐ Task 23 : par défaut les élèves abandonnés sont exclus
      includeWithdrawn: includeWithdrawn === 'true',
    });
  }

  @Get('student/:studentId')
  async getOrCreate(
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
    @TenantId() tenantId: string,
  ) {
    // ⚠️ FIX : utiliser BadRequestException (HTTP 400) au lieu de Error
    // (qui était catché par le filtre global et renvoyait HTTP 500
    // "Erreur interne (Error): academicYearId required")
    if (!academicYearId) throw new BadRequestException('academicYearId required');
    return this.service.getOrCreate(tenantId, studentId, academicYearId);
  }

  /**
   * ⭐ ONGLET « FRAIS GÉNÉRAUX » — listing par élève (structure identique à
   * Comptes élèves : pagination serveur + KPIs globaux + filtres).
   *
   * GET /finance/accounts/general-fees?academicYearId=&classId=&schoolLevelId=&search=&page=&limit=&feeType=
   * (feeType optionnel — défaut GENERAL)
   *
   * Retourne { data: rows[], total, page, limit, totalPages, sums: { due, paid, remaining, studentsWithGeneralFees } }
   * Chaque row : { accountId, student, className, generalDue, generalPaid, generalBalance, status, breakdowns[] }
   */
  @Get('general-fees')
  async findGeneralFeeAccounts(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('feeType') feeType?: string,
    @Query('classId') classId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId required');
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.service.findGeneralFeeAccounts(tenantId, {
      academicYearId,
      feeType,
      classId,
      schoolLevelId,
      search,
      page: pageNum && !isNaN(pageNum) ? pageNum : undefined,
      limit: limitNum && !isNaN(limitNum) ? limitNum : undefined,
    });
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
