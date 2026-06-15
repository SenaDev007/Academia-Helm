/**
 * ============================================================================
 * GUARDIANS PRISMA CONTROLLER
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
  UseGuards,
} from '@nestjs/common';
import { GuardiansPrismaService } from './guardians-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CreateGuardianDto, UpdateGuardianDto, UpdateGuardianRelationDto } from './dto';

@Controller('students/:studentId/guardians')
@UseGuards(JwtAuthGuard)
export class GuardiansPrismaController {
  constructor(private readonly guardiansService: GuardiansPrismaService) {}

  @Post()
  async create(
    @Param('studentId') studentId: string,
    @TenantId() tenantId: string,
    @Body() createDto: CreateGuardianDto,
  ) {
    return this.guardiansService.createGuardianForStudent({
      ...createDto,
      tenantId,
      studentId,
    });
  }

  @Get()
  async findAll(
    @Param('studentId') studentId: string,
    @TenantId() tenantId: string,
  ) {
    return this.guardiansService.getStudentGuardians(studentId, tenantId);
  }

  @Put(':guardianId')
  async update(
    @Param('guardianId') guardianId: string,
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateGuardianDto,
  ) {
    return this.guardiansService.updateGuardian(guardianId, tenantId, updateDto);
  }

  @Put('relation/:studentGuardianId')
  async updateRelation(
    @Param('studentGuardianId') studentGuardianId: string,
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateGuardianRelationDto,
  ) {
    return this.guardiansService.updateStudentGuardian(
      studentGuardianId,
      tenantId,
      updateDto,
    );
  }

  @Delete(':studentGuardianId')
  async remove(
    @Param('studentGuardianId') studentGuardianId: string,
    @TenantId() tenantId: string,
  ) {
    return this.guardiansService.removeStudentGuardian(studentGuardianId, tenantId);
  }
}
