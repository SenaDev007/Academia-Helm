/**
 * ============================================================================
 * HONOR ROLLS PRISMA CONTROLLER - MODULE 3
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { HonorRollsPrismaService } from './honor-rolls-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { GenerateHonorRollDto } from './dto';

@Controller('honor-rolls')
@UseGuards(JwtAuthGuard)
export class HonorRollsPrismaController {
  constructor(private readonly honorRollsService: HonorRollsPrismaService) {}

  @Post('generate')
  async generate(@TenantId() tenantId: string, @Body() generateDto: GenerateHonorRollDto) {
    return this.honorRollsService.generateHonorRoll({
      ...generateDto,
      tenantId,
    });
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('academicTrackId') academicTrackId?: string,
    @Query('classId') classId?: string,
    @Query('quarterId') quarterId?: string,
    @Query('mention') mention?: string,
  ) {
    return this.honorRollsService.findHonorRolls(tenantId, {
      academicYearId,
      schoolLevelId,
      academicTrackId: academicTrackId || undefined,
      classId,
      quarterId,
      mention,
    });
  }

  @Get('student/:studentId')
  async findByStudent(
    @Param('studentId') studentId: string,
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('quarterId') quarterId?: string,
  ) {
    return this.honorRollsService.findHonorRollsByStudent(studentId, tenantId, {
      academicYearId,
      schoolLevelId,
      quarterId,
    });
  }
}

