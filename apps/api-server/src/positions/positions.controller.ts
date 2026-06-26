import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@Controller('positions')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PositionsController {
  constructor(private readonly service: PositionsService) {}

  @Get()
  async findAll(@TenantId() tenantId: string) { return this.service.findAll(tenantId); }

  @Post()
  async create(@TenantId() tenantId: string, @Body() body: { name: string; description?: string; category?: string }) {
    if (!body?.name) throw new BadRequestException('Le nom est requis');
    return this.service.create(tenantId, body);
  }

  @Put(':id')
  async update(@TenantId() tenantId: string, @Param('id') id: string, @Body() body: { name?: string; description?: string; category?: string }) {
    return this.service.update(tenantId, id, body);
  }

  @Delete(':id')
  async delete(@TenantId() tenantId: string, @Param('id') id: string) {
    await this.service.delete(tenantId, id);
    return { success: true };
  }
}
