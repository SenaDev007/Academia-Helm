import { Controller, Get, Post, Body, UseGuards, Req, Param, Query } from '@nestjs/common';
import { FederisConnectService } from './federis-connect.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('federis/connect')
@UseGuards(JwtAuthGuard)
export class FederisConnectController {
  constructor(private readonly connectService: FederisConnectService) {}

  @Get('feed')
  async getFeed(@Req() req: any) {
    return this.connectService.getFeed(req.user.userId, req.user.tenantId);
  }

  @Get('conversations')
  async getConversations(@Req() req: any) {
    return this.connectService.getConversations(req.user.userId);
  }

  @Get('conversations/:id/messages')
  async getMessages(@Param('id') conversationId: string) {
    return this.connectService.getMessages(conversationId);
  }

  @Get('notices')
  async getNotices(@Req() req: any) {
    return this.connectService.getOfficialNotices(req.user.tenantId);
  }

  @Post('notices/:id/acknowledge')
  async acknowledgeNotice(@Req() req: any, @Param('id') noticeId: string) {
    return this.connectService.acknowledgeNotice(req.user.userId, noticeId);
  }

  @Get('groups')
  async getGroups(@Req() req: any) {
    return this.connectService.getGroups(req.user.tenantId, req.user.userId);
  }

  @Get('communities')
  async getCommunities(@Req() req: any) {
    return this.connectService.getCommunities(req.user.userId);
  }

  @Post('posts')
  async createPost(@Req() req: any, @Body() data: any) {
    return this.connectService.createPost(req.user.userId, data);
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @Req() req: any,
    @Param('id') conversationId: string,
    @Body('content') content: string,
  ) {
    return this.connectService.sendMessage(req.user.userId, req.user.tenantId, conversationId, content);
  }

  @Get('events')
  async getEvents(@Req() req: any) {
    return this.connectService.getEvents(req.user.tenantId);
  }
}
