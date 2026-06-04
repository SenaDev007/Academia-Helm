/**
 * ============================================================================
 * ROOMS PRISMA CONTROLLER
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
import { RoomsPrismaService } from './rooms-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import {
  CreateRoomDto,
  UpdateRoomDto,
  CreateRoomAllocationDto,
  CreateRoomMaintenanceDto,
  CreateRoomScheduleDto,
} from './dto/supplementary-dtos';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsPrismaController {
  constructor(private readonly roomsService: RoomsPrismaService) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() createDto: CreateRoomDto,
  ) {
    return this.roomsService.createRoom({
      ...createDto,
      tenantId,
    });
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('roomType') roomType?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.roomsService.findAllRooms(tenantId, {
      academicYearId,
      schoolLevelId,
      roomType,
      status,
      search,
    });
  }

  @Get('statistics')
  async getStatistics(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('roomType') roomType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.roomsService.getRoomStatistics(tenantId, academicYearId, {
      roomType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.roomsService.findRoomById(id, tenantId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateRoomDto,
  ) {
    return this.roomsService.updateRoom(id, tenantId, updateDto);
  }

  @Post(':id/maintenance')
  async setMaintenance(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: { reason?: string },
  ) {
    return this.roomsService.setMaintenance(id, tenantId, body.reason);
  }

  @Get(':id/maintenances')
  async getMaintenances(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.roomsService.findMaintenancesByRoom(
      id,
      tenantId,
      activeOnly === 'true',
    );
  }

  @Post('maintenances')
  async createMaintenance(
    @TenantId() tenantId: string,
    @Body() body: CreateRoomMaintenanceDto,
  ) {
    return this.roomsService.createRoomMaintenance({
      tenantId,
      roomId: body.roomId,
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      reason: body.reason,
    });
  }

  @Get(':id/schedules')
  async getSchedules(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) return [];
    return this.roomsService.findSchedulesByRoom(id, tenantId, academicYearId);
  }

  @Post('schedules')
  async createSchedule(
    @TenantId() tenantId: string,
    @Body() body: CreateRoomScheduleDto,
  ) {
    return this.roomsService.createRoomSchedule({ ...body, tenantId });
  }

  @Get(':id/occupation')
  async getOccupation(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.roomsService.getRoomOccupation(id, tenantId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get(':id/schedule')
  async getWeeklySchedule(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Query('weekStart') weekStart: string,
  ) {
    return this.roomsService.getWeeklySchedule(
      id,
      tenantId,
      new Date(weekStart),
    );
  }

  @Post(':id/allocations')
  async createAllocation(
    @Param('id') roomId: string,
    @TenantId() tenantId: string,
    @Body() createDto: CreateRoomAllocationDto,
  ) {
    return this.roomsService.createRoomAllocation({
      ...createDto,
      tenantId,
      roomId,
    });
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.roomsService.deleteRoom(id, tenantId);
  }
}
