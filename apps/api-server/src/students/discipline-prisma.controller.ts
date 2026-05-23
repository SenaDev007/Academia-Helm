/**
 * ============================================================================
 * DISCIPLINE PRISMA CONTROLLER
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DisciplinePrismaService } from './discipline-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@Controller('discipline')
@UseGuards(JwtAuthGuard)
export class DisciplinePrismaController {
  constructor(private readonly disciplineService: DisciplinePrismaService) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() createDto: any,
  ) {
    return this.disciplineService.createDisciplinaryAction({
      ...createDto,
      tenantId,
    });
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('status') status?: string,
    @Query('actionType') actionType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.disciplineService.getAllDisciplinaryActions(tenantId, {
      academicYearId,
      schoolLevelId,
      status,
      actionType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('student/:studentId')
  async getStudentDiscipline(
    @Param('studentId') studentId: string,
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('status') status?: string,
    @Query('actionType') actionType?: string,
  ) {
    return this.disciplineService.getStudentDisciplinaryActions(studentId, tenantId, {
      academicYearId,
      status,
      actionType,
    });
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() updateDto: any,
  ) {
    return this.disciplineService.updateDisciplinaryAction(id, tenantId, updateDto);
  }

  @Get('statistics')
  async getStatistics(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    return this.disciplineService.getDisciplineStatistics(
      tenantId,
      academicYearId,
      schoolLevelId,
    );
  }
}

