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
  Req,
  BadRequestException,
} from '@nestjs/common';
import { DailyLogsPrismaService } from './daily-logs-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { PrismaService } from '../database/prisma.service';
import { CreateDailyLogDto } from './dto/create-daily-log.dto';
import { UpdateDailyLogDto } from './dto/update-daily-log.dto';

@Controller('daily-logs')
@UseGuards(JwtAuthGuard)
export class DailyLogsPrismaController {
  constructor(
    private readonly dailyLogsService: DailyLogsPrismaService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() createDto: CreateDailyLogDto,
    @Req() req?: any,
  ) {
    // Map legacy field names to Prisma field names
    const { content, status, subjectId, homework, title, description, dueDate, maxScore, ...prismaFields } = createDto;

    // Build summary from title + description (homework mode) or from content/summary (journal mode)
    let summary = prismaFields.summary || content || '';
    if (!summary && title) {
      summary = title + (description ? '\n\n' + description : '');
    }
    if (!summary) {
      summary = 'Devoir'; // fallback
    }

    // Map dueDate → date (homework mode)
    let date = prismaFields.date;
    if (!date && dueDate) {
      date = dueDate;
    }
    if (!date) {
      date = new Date().toISOString(); // fallback to today
    }

    const validated = prismaFields.validated ?? (status === 'VALIDATED' ? true : undefined);

    // Resolve teacherId: from DTO, or from the logged-in user's linked Teacher record
    let teacherId = prismaFields.teacherId;
    if (!teacherId && req?.user?.email) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { tenantId, email: req.user.email },
        select: { id: true },
      });
      if (teacher) {
        teacherId = teacher.id;
      }
    }
    if (!teacherId) {
      throw new BadRequestException('teacherId requis : impossible de résoudre l\'enseignant connecté');
    }

    // Resolve academicYearId: from DTO, or from active year
    let academicYearId = prismaFields.academicYearId;
    if (!academicYearId) {
      const activeYear = await this.prisma.academicYear.findFirst({
        where: { isActive: true, tenantId },
        select: { id: true },
      });
      if (activeYear) {
        academicYearId = activeYear.id;
      }
    }
    if (!academicYearId) {
      throw new BadRequestException('academicYearId requis : aucune année académique active');
    }

    // Resolve schoolLevelId: from DTO, or from class, or from teacher
    let schoolLevelId = prismaFields.schoolLevelId;
    if (!schoolLevelId && prismaFields.classId) {
      const cls = await this.prisma.class.findUnique({
        where: { id: prismaFields.classId },
        select: { schoolLevelId: true },
      }).catch(() => null);
      if (cls) schoolLevelId = cls.schoolLevelId;
    }
    if (!schoolLevelId) {
      const teacher = await this.prisma.teacher.findUnique({
        where: { id: teacherId },
        select: { schoolLevelId: true },
      });
      if (teacher) schoolLevelId = teacher.schoolLevelId;
    }

    return this.dailyLogsService.createDailyLog({
      ...prismaFields,
      teacherId,
      academicYearId,
      schoolLevelId,
      summary,
      date,
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
    const { content, status, subjectId, homework, title, description, dueDate, maxScore, ...prismaFields } = updateDto;
    const mappedData: any = { ...prismaFields };

    // Build summary from title + description (homework mode)
    if (title !== undefined) {
      mappedData.summary = title + (description ? '\n\n' + description : '');
    } else if (content !== undefined) {
      mappedData.summary = content;
    } else if (prismaFields.summary !== undefined) {
      mappedData.summary = prismaFields.summary;
    }

    // Map dueDate → date
    if (dueDate !== undefined) {
      mappedData.date = dueDate;
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
