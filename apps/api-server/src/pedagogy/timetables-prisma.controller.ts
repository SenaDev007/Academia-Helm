/**
 * ============================================================================
 * TIMETABLES PRISMA CONTROLLER
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
import { TimetablesPrismaService } from './timetables-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CreateTimetableDto } from './dto/create-timetable.dto';
import { UpdateTimetableDto } from './dto/update-timetable.dto';
import { CreateTimetableEntryDto } from './dto/create-timetable-entry.dto';
import { CreateTimeSlotDto } from './dto/supplementary-dtos';

@Controller('timetables')
@UseGuards(JwtAuthGuard)
export class TimetablesPrismaController {
  constructor(private readonly timetablesService: TimetablesPrismaService) {}

  @Post('time-slots')
  async createTimeSlot(
    @TenantId() tenantId: string,
    @Body() createDto: CreateTimeSlotDto,
  ) {
    return this.timetablesService.createTimeSlot({
      ...createDto,
      tenantId,
    });
  }

  @Post()
  async createTimetable(
    @TenantId() tenantId: string,
    @Body() createDto: CreateTimetableDto,
  ) {
    return this.timetablesService.createTimetable({
      ...createDto,
      tenantId,
    } as any);
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.timetablesService.findAllTimetables(tenantId, {
      academicYearId,
      schoolLevelId,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.timetablesService.getTimetable(id, tenantId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateTimetableDto,
  ) {
    return this.timetablesService.updateTimetable(id, tenantId, updateDto as any);
  }

  @Post(':id/entries')
  async createEntry(
    @Param('id') timetableId: string,
    @TenantId() tenantId: string,
    @Body() createDto: CreateTimetableEntryDto,
  ) {
    return this.timetablesService.createTimetableEntry({
      ...createDto,
      tenantId,
      timetableId,
    });
  }

  /**
   * ⭐ POST /timetables/check-conflict
   *    Dry-run : vérifie les conflits SANS créer l'entry.
   *    Utilisé par le frontend pour afficher les conflits en temps réel
   *    pendant que l'utilisateur remplit le formulaire (UX préventive).
   *
   *    Body : { classId?, teacherId?, roomId?, dayOfWeek, startTime, endTime, excludeEntryId? }
   *    Response : { hasConflict: boolean, conflicts: TimetableConflict[] }
   */
  @Post('check-conflict')
  async checkConflict(
    @TenantId() tenantId: string,
    @Body() body: {
      timetableId?: string;
      classId?: string;
      teacherId?: string;
      roomId?: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      excludeEntryId?: string;
    },
  ) {
    if (body.startTime >= body.endTime) {
      return {
        hasConflict: true,
        conflicts: [{
          type: 'CLASS' as const,
          message: 'L\'heure de fin doit être après l\'heure de début',
          conflictingEntry: {
            id: '',
            dayOfWeek: body.dayOfWeek,
            startTime: body.startTime,
            endTime: body.endTime,
          },
        }],
      };
    }

    return this.timetablesService.detectConflicts({
      tenantId,
      timetableId: body.timetableId,
      classId: body.classId,
      teacherId: body.teacherId,
      roomId: body.roomId,
      dayOfWeek: body.dayOfWeek,
      startTime: body.startTime,
      endTime: body.endTime,
      excludeEntryId: body.excludeEntryId,
    });
  }

  @Delete('entries/:id')
  async deleteEntry(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.timetablesService.deleteTimetableEntry(id, tenantId);
  }
}
