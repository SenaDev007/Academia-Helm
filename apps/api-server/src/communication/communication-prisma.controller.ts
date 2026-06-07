/**
 * ============================================================================
 * COMMUNICATION PRISMA CONTROLLER - MODULE 6
 * ============================================================================
 */

import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { CommunicationPrismaService } from './communication-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { CreateChannelDto, UpdateChannelDto } from './dto/channel.dto';

@Controller('communication/channels')
@UseGuards(JwtAuthGuard, TenantGuard)
export class CommunicationPrismaController {
  constructor(private readonly communicationService: CommunicationPrismaService) {}

  @Post()
  async createChannel(@GetTenant() tenant: any, @Body() data: CreateChannelDto) {
    return this.communicationService.createChannel(tenant.id, data);
  }

  @Get()
  async findAllChannels(@GetTenant() tenant: any) {
    return this.communicationService.findAllChannels(tenant.id);
  }

  @Get(':id')
  async findChannelById(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.communicationService.findChannelById(tenant.id, id);
  }

  @Put(':id')
  async updateChannel(@GetTenant() tenant: any, @Param('id') id: string, @Body() data: UpdateChannelDto) {
    return this.communicationService.updateChannel(tenant.id, id, data);
  }

  @Put(':id/toggle')
  async toggleChannel(@GetTenant() tenant: any, @Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.communicationService.toggleChannel(tenant.id, id, body.isActive);
  }

  @Delete(':id')
  async deleteChannel(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.communicationService.deleteChannel(tenant.id, id);
  }
}
