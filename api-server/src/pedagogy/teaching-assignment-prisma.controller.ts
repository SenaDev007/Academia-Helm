/**
 * TEACHING ASSIGNMENT PRISMA CONTROLLER - SM4
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
import { TeachingAssignmentPrismaService } from './teaching-assignment-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CreateTeachingAssignmentDto } from './dto/create-teaching-assignment.dto';
import { UpdateTeachingAssignmentDto } from './dto/update-teaching-assignment.dto';

@Controller('pedagogy/assignments')
@UseGuards(JwtAuthGuard)
export class TeachingAssignmentPrismaController {
  constructor(private readonly service: TeachingAssignmentPrismaService) {}

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('profileId') profileId?: string,
    @Query('classId') classId?: string,
    @Query('isActive') isActive?: string,
  ) {
    const filters: { profileId?: string; classId?: string; isActive?: boolean } = {};
    if (profileId) filters.profileId = profileId;
    if (classId) filters.classId = classId;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    return this.service.findAll(tenantId, academicYearId, filters);
  }

  @Get('charge-summary/:profileId')
  async getChargeSummary(
    @Param('profileId') profileId: string,
    @TenantId() tenantId: string,
  ) {
    return this.service.getChargeSummary(profileId, tenantId);
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.getOne(id, tenantId);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() body: CreateTeachingAssignmentDto,
  ) {
    return this.service.create({ ...body, tenantId } as any);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: UpdateTeachingAssignmentDto,
  ) {
    return this.service.update(id, tenantId, body as any);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.delete(id, tenantId);
  }
}
