/**
 * ============================================================================
 * COUNCIL DECISIONS PRISMA CONTROLLER - MODULE 3
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
import { CouncilDecisionsPrismaService } from './council-decisions-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CreateCouncilDecisionDto, UpdateCouncilDecisionDto } from './dto';

@Controller('council-decisions')
@UseGuards(JwtAuthGuard)
export class CouncilDecisionsPrismaController {
  constructor(private readonly decisionsService: CouncilDecisionsPrismaService) {}

  @Post()
  async create(@TenantId() tenantId: string, @Body() createDto: CreateCouncilDecisionDto) {
    return this.decisionsService.createDecision({
      ...createDto,
      tenantId,
    });
  }

  @Get('council/:councilId')
  async findByCouncil(
    @Param('councilId') councilId: string,
    @TenantId() tenantId: string,
  ) {
    return this.decisionsService.findDecisionsByCouncil(councilId, tenantId);
  }

  @Get('student/:studentId')
  async findByStudent(
    @Param('studentId') studentId: string,
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('quarterId') quarterId?: string,
    @Query('decision') decision?: string,
  ) {
    return this.decisionsService.findDecisionsByStudent(studentId, tenantId, {
      academicYearId,
      schoolLevelId,
      quarterId,
      decision,
    });
  }

  @Get('statistics')
  async getStatistics(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('quarterId') quarterId?: string,
    @Query('classId') classId?: string,
  ) {
    return this.decisionsService.getDecisionStatistics(tenantId, {
      academicYearId,
      schoolLevelId,
      quarterId,
      classId,
    });
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateCouncilDecisionDto,
  ) {
    return this.decisionsService.updateDecision(id, tenantId, updateDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.decisionsService.deleteDecision(id, tenantId);
  }
}
