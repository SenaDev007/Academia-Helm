/**
 * ============================================================================
 * MESSAGES PRISMA CONTROLLER - MODULE 6
 * ============================================================================
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { MessagesPrismaService } from './messages-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { CreateMessageDto, UpdateMessageDto, AddRecipientsDto, AddTargetsDto } from './dto/message.dto';

@Controller('communication/messages')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MessagesPrismaController {
  constructor(private readonly messagesService: MessagesPrismaService) {}

  @Post()
  async createMessage(@GetTenant() tenant: any, @Req() req: any, @Body() data: CreateMessageDto) {
    return this.messagesService.createMessage(tenant.id, {
      academicYearId: data.academicYearId,
      schoolLevelId: data.schoolLevelId,
      channelId: data.channelId,
      senderUserId: data.senderUserId || req.user?.id,
      subject: data.subject,
      content: data.content,
      contentFr: data.contentFr,
      contentEn: data.contentEn,
      messageType: data.messageType || 'INFO',
      isScheduled: data.isScheduled,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      targets: data.targets,
    });
  }

  @Get()
  async findAllMessages(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('messageType') messageType?: string,
    @Query('status') status?: string,
    @Query('channelId') channelId?: string,
  ) {
    return this.messagesService.findAllMessages(tenant.id, {
      academicYearId,
      schoolLevelId,
      messageType,
      status,
      channelId,
    });
  }

  @Get(':id')
  async findMessageById(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.messagesService.findMessageById(tenant.id, id);
  }

  @Put(':id')
  async updateMessage(@GetTenant() tenant: any, @Param('id') id: string, @Body() data: UpdateMessageDto) {
    return this.messagesService.updateMessage(tenant.id, id, data);
  }

  @Post(':id/send')
  async sendMessage(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.messagesService.sendMessage(tenant.id, id);
  }

  @Post(':id/recipients')
  async addRecipients(@GetTenant() tenant: any, @Param('id') id: string, @Body() body: AddRecipientsDto) {
    return this.messagesService.addRecipients(tenant.id, id, body.recipients);
  }

  @Post(':id/targets')
  async addTargets(@GetTenant() tenant: any, @Param('id') id: string, @Body() body: AddTargetsDto) {
    return this.messagesService.addTargets(id, body.targets);
  }

  @Put(':id/archive')
  async archiveMessage(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.messagesService.archiveMessage(tenant.id, id);
  }

  @Delete(':id')
  async deleteMessage(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.messagesService.deleteMessage(tenant.id, id);
  }
}
