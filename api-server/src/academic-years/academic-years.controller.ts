import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AcademicYearsPrismaService } from './academic-years-prisma.service';

@Controller('academic-years')
@UseGuards(JwtAuthGuard)
export class AcademicYearsController {
  constructor(
    private readonly academicYearsService: AcademicYearsService,
    private readonly academicYearsPrismaService: AcademicYearsPrismaService,
  ) {}

  @Post()
  create(
    @Body() createAcademicYearDto: CreateAcademicYearDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.academicYearsService.create(createAcademicYearDto, tenantId, user.id);
  }

  /**
   * POST /academic-years/:id/promote
   * Clôture l'année scolaire active et active l'année suivante calculée automatiquement.
   * La promotion automatique des élèves est gérée côté Module 1 via les endpoints de cycle de vie.
   */
  @Post(':id/promote')
  promote(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.academicYearsPrismaService.closeAndPromoteYear(id, tenantId, user.id);
  }

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.academicYearsService.findAll(tenantId);
  }

  @Get('current')
  findCurrent(@TenantId() tenantId: string) {
    return this.academicYearsService.findCurrent(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.academicYearsService.findOne(id, tenantId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAcademicYearDto: UpdateAcademicYearDto,
    @TenantId() tenantId: string,
  ) {
    return this.academicYearsService.update(id, updateAcademicYearDto, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.academicYearsService.delete(id, tenantId);
  }
}

