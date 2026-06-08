/**
 * ============================================================================
 * ACADEMIC STRUCTURE PRISMA CONTROLLER - MODULE 2
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
import { AcademicStructurePrismaService } from './academic-structure-prisma.service';
import { DuplicateStructureDto } from './dto/duplicate-structure.dto';
import { CreateAcademicLevelDto } from './dto/create-academic-level.dto';
import { UpdateAcademicLevelDto } from './dto/update-academic-level.dto';
import { CreateAcademicCycleDto } from './dto/create-academic-cycle.dto';
import { UpdateAcademicCycleDto } from './dto/supplementary-dtos';
import { CreateAcademicClassDto } from './dto/create-academic-class.dto';
import { UpdateAcademicClassDto } from './dto/update-academic-class.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('pedagogy/academic-structure')
@UseGuards(JwtAuthGuard)
export class AcademicStructurePrismaController {
  constructor(private readonly service: AcademicStructurePrismaService) {}

  /** Duplication annuelle : structure source → année cible (transaction + audit). */
  @Post('duplicate')
  async duplicateStructure(
    @TenantId() tenantId: string,
    @Body() body: DuplicateStructureDto,
    @CurrentUser() user: { id?: string },
  ) {
    return this.service.duplicateStructure(
      tenantId,
      body.fromAcademicYearId,
      body.toAcademicYearId,
      user?.id ?? null,
    );
  }

  // ---------- Levels ----------
  @Get('levels')
  async findAllLevels(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) {
      return [];
    }
    return this.service.findAllLevels(tenantId, academicYearId);
  }

  @Post('levels')
  async createLevel(
    @TenantId() tenantId: string,
    @Body() body: CreateAcademicLevelDto,
  ) {
    return this.service.createLevel({ ...body, tenantId });
  }

  @Put('levels/:id')
  async updateLevel(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: UpdateAcademicLevelDto,
  ) {
    return this.service.updateLevel(id, tenantId, body);
  }

  @Get('levels/:id')
  async getLevel(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.getLevelOrThrow(id, tenantId);
  }

  // ---------- Cycles ----------
  @Get('cycles')
  async findAllCycles(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('levelId') levelId?: string,
  ) {
    if (!academicYearId) return [];
    return this.service.findAllCycles(tenantId, academicYearId, levelId);
  }

  @Post('cycles')
  async createCycle(
    @TenantId() tenantId: string,
    @Body() body: CreateAcademicCycleDto,
  ) {
    return this.service.createCycle({ ...body, tenantId });
  }

  @Put('cycles/:id')
  async updateCycle(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: UpdateAcademicCycleDto,
  ) {
    return this.service.updateCycle(id, tenantId, body);
  }

  @Get('cycles/:id')
  async getCycle(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.getCycleOrThrow(id, tenantId);
  }

  // ---------- Classes ----------
  @Get('classes')
  async findAllClasses(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('levelId') levelId?: string,
    @Query('cycleId') cycleId?: string,
    @Query('isActive') isActive?: string,
  ) {
    if (!academicYearId) return [];
    const filters: any = {};
    if (levelId) filters.levelId = levelId;
    if (cycleId) filters.cycleId = cycleId;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    return this.service.findAllClasses(tenantId, academicYearId, filters);
  }

  @Post('classes')
  async createClass(
    @TenantId() tenantId: string,
    @Body() body: CreateAcademicClassDto,
  ) {
    // Auto-generate code if not provided (Prisma requires it)
    const code = body.code || `${body.name.replace(/\s/g, '').toUpperCase().substring(0, 8)}-${Date.now().toString(36).toUpperCase()}`;
    return this.service.createClass({ ...body, code, tenantId } as any);
  }

  @Put('classes/:id')
  async updateClass(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: UpdateAcademicClassDto,
  ) {
    return this.service.updateClass(id, tenantId, body as any);
  }

  @Get('classes/:id')
  async getClass(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.getClassOrThrow(id, tenantId);
  }

  @Put('classes/:id/deactivate')
  async deactivateClass(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.deactivateClass(id, tenantId);
  }
}
