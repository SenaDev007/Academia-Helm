import { Controller, Post, Get, Body, Query, UseGuards, Req } from '@nestjs/common';
import { SaraService } from './sara.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@Controller('sara')
export class SaraController {
  constructor(private readonly saraService: SaraService) {}

  /**
   * Landing page — public, Closer Senior #1 mode
   * POST /sara/query
   */
  @Public()
  @Post('query')
  async query(@Body() body: { query: string; visitorId?: string; messages?: Array<{ role: string; content: string }> }) {
    return this.saraService.handleVisitorQuery(body.query, body.visitorId, body.messages);
  }

  /**
   * In-app chat — authenticated, context-aware Guide + Stratégique mode
   * POST /sara/chat
   */
  @UseGuards(JwtAuthGuard)
  @Post('chat')
  async chat(@Req() req: any, @Body() body: { message: string; userRole?: string; currentModule?: string; sessionId?: string }) {
    return this.saraService.handleInAppQuery(
      body.message,
      req.user.id,
      req.user.tenantId,
      body.userRole || req.user.role,
      body.currentModule,
    );
  }

  /**
   * In-app chat via AI Gateway (mode avancé avec MCP + Tools)
   * POST /sara/chat/advanced
   */
  @UseGuards(JwtAuthGuard)
  @Post('chat/advanced')
  async chatAdvanced(@Req() req: any, @Body() body: { message: string; schoolId?: string }) {
    return this.saraService.handleInAppQueryViaGateway(
      body.message,
      req.user.id,
      req.user.tenantId,
      body.schoolId,
    );
  }

  /**
   * Detect intent from user message
   * POST /sara/intent
   */
  @UseGuards(JwtAuthGuard)
  @Post('intent')
  async detectIntent(@Req() req: any, @Body() body: { message: string }) {
    return this.saraService.detectIntent(
      body.message,
      req.user.role || 'DIRECTION',
    );
  }

  /**
   * Get contextual suggestions based on user role and current module
   * POST /sara/suggestions
   */
  @Public()
  @Post('suggestions')
  async getSuggestions(
    @Body() body: { userRole?: string; currentModule?: string },
  ) {
    return this.saraService.getContextualSuggestions(body.userRole, body.currentModule);
  }
}
