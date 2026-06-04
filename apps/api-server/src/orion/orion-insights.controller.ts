/**
 * ============================================================================
 * ORION INSIGHTS CONTROLLER - MODULE 8
 * ============================================================================
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { OrionInsightsService } from './services/orion-insights.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';

@Controller('orion/insights')
@UseGuards(JwtAuthGuard, TenantGuard)
export class OrionInsightsController {
  constructor(private readonly insightsService: OrionInsightsService) {}

  @Get()
  async findAllInsights(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('category') category?: string,
    @Query('priority') priority?: string,
    @Query('isRead') isRead?: string,
  ) {
    return this.insightsService.findAllInsights(tenant.id, {
      academicYearId,
      schoolLevelId,
      category,
      priority,
      isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
    });
  }

  @Post('generate')
  async generateInsights(
    @GetTenant() tenant: any,
    @Body() body: { academicYearId?: string; schoolLevelId?: string },
  ) {
    const insights = await this.insightsService.generateInsights(
      tenant.id,
      body.academicYearId,
      body.schoolLevelId,
    );

    // Créer les insights en base
    for (const insight of insights) {
      await this.insightsService.createInsight(tenant.id, {
        academicYearId: body.academicYearId,
        schoolLevelId: body.schoolLevelId,
        ...insight,
      });
    }

    return insights;
  }

  @Post()
  async createInsight(@GetTenant() tenant: any, @Body() data: any) {
    return this.insightsService.createInsight(tenant.id, data);
  }

  @Put(':id/read')
  async markAsRead(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.insightsService.markInsightAsRead(tenant.id, id);
  }

  @Delete('old')
  async deleteOldInsights(
    @GetTenant() tenant: any,
    @Query('olderThanDays') olderThanDays?: string,
  ) {
    return this.insightsService.deleteOldInsights(
      tenant.id,
      olderThanDays ? parseInt(olderThanDays) : 90,
    );
  }
}

