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
import { GradesService } from './grades.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PortalAccessGuard } from '../common/guards/portal-access.guard';
import { ModulePermissionGuard } from '../common/guards/module-permission.guard';
import { RequiredModule } from '../common/decorators/required-module.decorator';
import { RequiredPermission } from '../common/decorators/required-permission.decorator';
import { Module } from '../common/enums/module.enum';
import { PermissionAction } from '../common/enums/permission-action.enum';

@Controller('grades')
@UseGuards(JwtAuthGuard, PortalAccessGuard, ModulePermissionGuard)
@RequiredModule(Module.EXAMENS) // Les notes font partie du module EXAMENS
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Post()
  @RequiredPermission(PermissionAction.WRITE) // Seuls enseignants/directeurs peuvent saisir
  create(
    @Body() createGradeDto: CreateGradeDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.gradesService.create(createGradeDto, tenantId, user.id);
  }

  @Get()
  @RequiredPermission(PermissionAction.READ)
  findAll(
    @TenantId() tenantId: string,
    @Query('studentId') studentId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('classId') classId?: string,
    @Query('quarterId') quarterId?: string,
  ) {
    return this.gradesService.findAll(tenantId, studentId, subjectId, classId, quarterId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.gradesService.findOne(id, tenantId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateGradeDto: UpdateGradeDto,
    @TenantId() tenantId: string,
  ) {
    return this.gradesService.update(id, updateGradeDto, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.gradesService.delete(id, tenantId);
  }
}

