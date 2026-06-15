import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { AcademicTracksService } from './academic-tracks.service';
import { CreateAcademicTrackDto } from './dto/create-academic-track.dto';
import { UpdateAcademicTrackDto } from './dto/update-academic-track.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@Controller('academic-tracks')
@UseGuards(JwtAuthGuard)
export class AcademicTracksController {
  constructor(private readonly academicTracksService: AcademicTracksService) {}

  @Post()
  create(
    @Body() createDto: CreateAcademicTrackDto,
    @TenantId() tenantId: string,
  ) {
    return this.academicTracksService.create(createDto, tenantId);
  }

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.academicTracksService.findAll(tenantId);
  }

  @Get('default')
  getDefault(@TenantId() tenantId: string) {
    return this.academicTracksService.getDefaultTrack(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.academicTracksService.findOne(id, tenantId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAcademicTrackDto,
    @TenantId() tenantId: string,
  ) {
    return this.academicTracksService.update(id, updateDto, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.academicTracksService.delete(id, tenantId);
  }
}

