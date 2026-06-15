/**
 * ============================================================================
 * MATERIAL STOCKS PRISMA CONTROLLER - MODULE 2
 * ============================================================================
 */

import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MaterialStocksPrismaService } from './material-stocks-prisma.service';
import { MaterialStocksQueryDto } from './dto/query-dtos';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { MaterialContextGuard } from './guards/material-context.guard';
import { MaterialRbacGuard } from './guards/material-rbac.guard';
import { UseInterceptors } from '@nestjs/common';
import { MaterialAuditInterceptor } from './interceptors/material-audit.interceptor';

@Controller('pedagogy/material-stocks')
@UseGuards(JwtAuthGuard, MaterialContextGuard, MaterialRbacGuard)
@UseInterceptors(MaterialAuditInterceptor)
export class MaterialStocksPrismaController {
  constructor(private readonly materialStocksService: MaterialStocksPrismaService) {}

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query() query: MaterialStocksQueryDto,
  ) {
    return this.materialStocksService.findAll(
      tenantId,
      query.academicYearId,
      query,
      {
        materialId: query.materialId,
        schoolLevelId: query.schoolLevelId,
        classId: query.classId,
      },
    );
  }

  @Get('by-material/:materialId')
  async findByMaterial(
    @Param('materialId') materialId: string,
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('classId') classId?: string,
  ) {
    return this.materialStocksService.findByMaterial(
      tenantId,
      academicYearId,
      materialId,
      schoolLevelId,
      classId,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.materialStocksService.findOne(id, tenantId);
  }
}
