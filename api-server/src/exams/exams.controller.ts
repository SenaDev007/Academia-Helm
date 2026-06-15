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
import { ExamsService } from './exams.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PortalAccessGuard } from '../common/guards/portal-access.guard';
import { ModulePermissionGuard } from '../common/guards/module-permission.guard';
import { RequiredModule } from '../common/decorators/required-module.decorator';
import { RequiredPermission } from '../common/decorators/required-permission.decorator';
import { Module } from '../common/enums/module.enum';
import { PermissionAction } from '../common/enums/permission-action.enum';

@Controller('exams')
@UseGuards(JwtAuthGuard, PortalAccessGuard, ModulePermissionGuard)
@RequiredModule(Module.EXAMENS)
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post()
  @RequiredPermission(PermissionAction.WRITE)
  create(
    @Body() createExamDto: CreateExamDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.examsService.create(createExamDto, tenantId, user.id);
  }

  @Get()
  @RequiredPermission(PermissionAction.READ)
  findAll(
    @TenantId() tenantId: string,
    @Query('classId') classId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.examsService.findAll(tenantId, classId, subjectId, academicYearId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.examsService.findOne(id, tenantId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateExamDto: UpdateExamDto,
    @TenantId() tenantId: string,
  ) {
    return this.examsService.update(id, updateExamDto, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.examsService.delete(id, tenantId);
  }
}

