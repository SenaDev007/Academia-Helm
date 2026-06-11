import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { KpiObjectivesService } from './kpi-objectives.service';
import { CreateKpiObjectiveDto } from './dto/create-kpi-objective.dto';
import { UpdateKpiObjectiveDto } from './dto/update-kpi-objective.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('kpi-objectives')
@UseGuards(JwtAuthGuard)
export class KpiObjectivesController {
  constructor(private readonly kpiObjectivesService: KpiObjectivesService) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() createDto: CreateKpiObjectiveDto,
    @CurrentUser() user: any,
  ) {
    return this.kpiObjectivesService.create(tenantId, createDto, user?.id);
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('kpiId') kpiId?: string,
  ) {
    return this.kpiObjectivesService.findAll(tenantId, academicYearId, schoolLevelId, kpiId);
  }

  @Get('with-actuals')
  async getObjectivesWithActuals(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    return this.kpiObjectivesService.getObjectivesWithActuals(
      tenantId,
      academicYearId,
      schoolLevelId,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.kpiObjectivesService.findOne(id, tenantId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateKpiObjectiveDto,
  ) {
    return this.kpiObjectivesService.update(id, tenantId, updateDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.kpiObjectivesService.delete(id, tenantId);
  }
}

