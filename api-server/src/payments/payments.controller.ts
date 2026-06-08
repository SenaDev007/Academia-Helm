/**
 * ============================================================================
 * PAYMENTS CONTROLLER - MODULE FINANCES
 * ============================================================================
 * 
 * Controller pour les paiements avec isolation stricte par tenant + school_level
 * 
 * ============================================================================
 */

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
  UseInterceptors,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContextValidationGuard } from '../common/guards/context-validation.guard';
import { ModuleAccessGuard } from '../common/guards/module-access.guard';
import { PortalAccessGuard } from '../common/guards/portal-access.guard';
import { ModulePermissionGuard } from '../common/guards/module-permission.guard';
import { RequiredModule } from '../common/decorators/required-module.decorator';
import { RequiredPermission } from '../common/decorators/required-permission.decorator';
import { Module } from '../common/enums/module.enum';
import { PermissionAction } from '../common/enums/permission-action.enum';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { SchoolLevelId } from '../common/decorators/school-level-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ModuleTypeRequired } from '../common/decorators/module-type.decorator';
import { ModuleType } from '../modules/entities/module.entity';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('payments')
@UseGuards(
  JwtAuthGuard,
  PortalAccessGuard, // Vérifie le portail autorisé
  ContextValidationGuard, // Valide tenant + school_level + module
  ModulePermissionGuard, // Vérifie les permissions par module
  ModuleAccessGuard, // Vérifie que le module FINANCES est activé
)
@UseInterceptors(AuditLogInterceptor)
@RequiredModule(Module.FINANCES) // Module FINANCES requis (nouveau système)
@ModuleTypeRequired(ModuleType.FINANCES) // Module FINANCES requis (ancien système)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(
    @Body() createPaymentDto: CreatePaymentDto,
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string, // OBLIGATOIRE - Résolu automatiquement
    @CurrentUser() user: any,
  ) {
    return this.paymentsService.create(createPaymentDto, tenantId, schoolLevelId, user.id);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string, // OBLIGATOIRE - Résolu automatiquement
    @Query() pagination: PaginationDto,
    @Query('studentId') studentId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.paymentsService.findAll(
      tenantId,
      schoolLevelId, // OBLIGATOIRE
      pagination,
      studentId,
      status,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string, // OBLIGATOIRE
  ) {
    return this.paymentsService.findOne(id, tenantId, schoolLevelId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string, // OBLIGATOIRE
  ) {
    return this.paymentsService.update(id, updatePaymentDto, tenantId, schoolLevelId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string, // OBLIGATOIRE
  ) {
    return this.paymentsService.delete(id, tenantId, schoolLevelId);
  }
}

