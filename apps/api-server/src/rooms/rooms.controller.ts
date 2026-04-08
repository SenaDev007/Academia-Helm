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
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  create(
    @Body() createRoomDto: CreateRoomDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.roomsService.create(createRoomDto, tenantId, user.id);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('roomType') roomType?: string,
    @Query('search') search?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    return this.roomsService.findAll(tenantId, {
      status,
      roomType,
      search,
      academicYearId,
      schoolLevelId,
    });
  }

  @Get('statistics')
  statistics(@TenantId() tenantId: string) {
    return this.roomsService.statistics(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.roomsService.findOne(id, tenantId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateRoomDto: UpdateRoomDto,
    @TenantId() tenantId: string,
  ) {
    return this.roomsService.update(id, updateRoomDto, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.roomsService.delete(id, tenantId);
  }
}

