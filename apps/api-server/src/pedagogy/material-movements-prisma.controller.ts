/**
 * ============================================================================
 * MATERIAL MOVEMENTS PRISMA CONTROLLER - MODULE 2
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
import { MaterialMovementsPrismaService } from './material-movements-prisma.service';
import { CreateMaterialMovementDto } from './dto/create-material-movement.dto';
import { MaterialMovementsQueryDto } from './dto/query-dtos';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MaterialContextGuard } from './guards/material-context.guard';
import { MaterialRbacGuard } from './guards/material-rbac.guard';
import { UseInterceptors } from '@nestjs/common';
import { MaterialAuditInterceptor } from './interceptors/material-audit.interceptor';

@Controller('pedagogy/material-movements')
@UseGuards(JwtAuthGuard, MaterialContextGuard, MaterialRbacGuard)
@UseInterceptors(MaterialAuditInterceptor)
export class MaterialMovementsPrismaController {
  constructor(
    private readonly materialMovementsService: MaterialMovementsPrismaService,
  ) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() createDto: CreateMaterialMovementDto,
    @CurrentUser() user: any,
  ) {
    return this.materialMovementsService.create({
      ...createDto,
      tenantId,
      performedById: user.id,
    });
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query() query: MaterialMovementsQueryDto,
  ) {
    return this.materialMovementsService.findAll(
      tenantId,
      query.academicYearId,
      query,
      {
        materialId: query.materialId,
        movementType: query.movementType,
        performedById: query.performedById,
      },
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.materialMovementsService.findOne(id, tenantId);
  }
}
