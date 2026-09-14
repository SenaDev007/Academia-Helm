import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, BadRequestException,
} from '@nestjs/common';
import { MultigradeService } from './multigrade.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('multigrade')
@UseGuards(JwtAuthGuard)
export class MultigradeController {
  constructor(private readonly service: MultigradeService) {}

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('isActive') isActive?: string,
  ) {
    // ⭐ 2026-09-15 : scope niveau serveur — les groupes multigrades sont
    //    filtrés par le périmètre du directeur (via la relation teacher).
    return this.service.findAll(tenantId, {
      academicYearId,
      teacherId,
      schoolLevelId,
      isActive: isActive === undefined ? undefined : isActive === 'true',
    }, user?.scope);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() body: any,
  ) {
    if (!body.academicYearId || !body.teacherId || !body.classIds) {
      throw new BadRequestException('academicYearId, teacherId et classIds requis.');
    }
    return this.service.create(tenantId, body);
  }

  @Put(':id')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.update(tenantId, id, body);
  }

  @Delete(':id')
  async delete(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.delete(tenantId, id);
  }
}
