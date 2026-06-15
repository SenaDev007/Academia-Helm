import { Controller, Post, Get, Body, Query, UseGuards, Req } from '@nestjs/common';
import { SaraService } from './sara.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@Controller('sara')
export class SaraController {
  constructor(private readonly saraService: SaraService) {}

  /**
   * Landing page — public, no auth
   * POST /sara/query
   */
  @Public()
  @Post('query')
  async query(@Body() body: { query: string; visitorId?: string }) {
    return this.saraService.handleVisitorQuery(body.query, body.visitorId);
  }

  /**
   * In-app chat — authenticated, context-aware
   * POST /sara/chat
   */
  @UseGuards(JwtAuthGuard)
  @Post('chat')
  async chat(@Req() req: any, @Body() body: { message: string; sessionId?: string }) {
    return this.saraService.handleInAppChat(
      req.user.tenantId,
      req.user.id,
      body.message,
      body.sessionId,
    );
  }

  /**
   * Get conversation history
   * GET /sara/history
   */
  @UseGuards(JwtAuthGuard)
  @Get('history')
  async getHistory(@Req() req: any, @Query('sessionId') sessionId?: string) {
    return this.saraService.getSessionHistory(
      req.user.tenantId,
      req.user.id,
      sessionId,
    );
  }
}
