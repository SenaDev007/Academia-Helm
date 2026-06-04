/**
 * ============================================================================
 * TEMPLATES PRISMA CONTROLLER - MODULE 6
 * ============================================================================
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TemplatesPrismaService } from './templates-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';

@Controller('communication/templates')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TemplatesPrismaController {
  constructor(private readonly templatesService: TemplatesPrismaService) {}

  @Post()
  async createTemplate(@GetTenant() tenant: any, @Body() data: CreateTemplateDto) {
    return this.templatesService.createTemplate(tenant.id, data);
  }

  @Get()
  async findAllTemplates(
    @GetTenant() tenant: any,
    @Query('type') type?: string,
    @Query('channelId') channelId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.templatesService.findAllTemplates(tenant.id, {
      type,
      channelId,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get('type/:type')
  async findTemplatesByType(@GetTenant() tenant: any, @Param('type') type: string) {
    return this.templatesService.findTemplatesByType(tenant.id, type);
  }

  @Get(':id')
  async findTemplateById(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.templatesService.findTemplateById(tenant.id, id);
  }

  @Put(':id')
  async updateTemplate(@GetTenant() tenant: any, @Param('id') id: string, @Body() data: UpdateTemplateDto) {
    return this.templatesService.updateTemplate(tenant.id, id, data);
  }

  @Put(':id/toggle')
  async toggleTemplate(@GetTenant() tenant: any, @Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.templatesService.toggleTemplate(tenant.id, id, body.isActive);
  }

  @Delete(':id')
  async deleteTemplate(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.templatesService.deleteTemplate(tenant.id, id);
  }
}
