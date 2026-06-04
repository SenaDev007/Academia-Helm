/**
 * ============================================================================
 * DAILY LOGS PRISMA CONTROLLER
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DailyLogsPrismaService } from './daily-logs-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CreateDailyLogDto } from './dto/create-daily-log.dto';
import { UpdateDailyLogDto } from './dto/update-daily-log.dto';

@Controller('daily-logs')
@UseGuards(JwtAuthGuard)
export class DailyLogsPrismaController {
  constructor(private readonly dailyLogsService: DailyLogsPrismaService) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() createDto: CreateDailyLogDto,
  ) {
    // Map legacy field names to Prisma field names
    const { content, status, subjectId, homework, ...prismaFields } = createDto;
    const summary = prismaFields.summary || content || '';
    const validated = prismaFields.validated ?? (status === 'VALIDATED' ? true : undefined);

    return this.dailyLogsService.createDailyLog({
      ...prismaFields,
      summary,
      ...(validated !== undefined && { validated }),
      tenantId,
    } as any);
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('classId') classId?: string,
    @Query('validated') validated?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dailyLogsService.findAllDailyLogs(tenantId, {
      academicYearId,
      schoolLevelId,
      teacherId,
      classId,
      validated: validated === 'true' ? true : validated === 'false' ? false : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.dailyLogsService.findDailyLogById(id, tenantId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateDailyLogDto,
  ) {
    // Map legacy field names to Prisma field names
    const { content, status, subjectId, homework, ...prismaFields } = updateDto;
    const mappedData: any = { ...prismaFields };
    if (content !== undefined) {
      mappedData.summary = content;
    }
    if (prismaFields.summary !== undefined) {
      mappedData.summary = prismaFields.summary;
    }
    if (status === 'VALIDATED') {
      mappedData.validated = true;
    }

    return this.dailyLogsService.updateDailyLog(id, tenantId, mappedData);
  }

  @Post(':id/validate')
  async validate(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: { validatedBy: string },
  ) {
    return this.dailyLogsService.validateDailyLog(id, tenantId, body.validatedBy);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.dailyLogsService.deleteDailyLog(id, tenantId);
  }
}
