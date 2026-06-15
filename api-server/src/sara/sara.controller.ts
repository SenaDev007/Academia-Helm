import { Controller, Post, Body, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { SaraService } from './sara.service';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('sara')
export class SaraController {
  constructor(private readonly saraService: SaraService) {}

  /**
   * Landing page SARA query (public, Closer Senior #1 mode)
   * Used by the SaraWidget on the landing page
   */
  @Public()
  @Post('query')
  async query(@Body() body: { query: string; visitorId?: string; messages?: Array<{ role: string; content: string }> }) {
    return this.saraService.handleVisitorQuery(body.query, body.visitorId, body.messages);
  }

  /**
   * Landing page SARA streaming query (public, SSE)
   * Used by the SaraWidget for real-time streaming responses
   */
  @Public()
  @Post('query/stream')
  async queryStream(
    @Body() body: { query: string; visitorId?: string; messages?: Array<{ role: string; content: string }> },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Désactiver le buffering Nginx

    try {
      const stream = this.saraService.handleVisitorQueryStream(
        body.query,
        body.visitorId,
        body.messages,
      );

      for await (const chunk of stream) {
        if (chunk.type === 'delta' && chunk.text) {
          res.write(`data: ${JSON.stringify({ type: 'delta', text: chunk.text })}\n\n`);
        } else if (chunk.type === 'reasoning' && chunk.reasoningText) {
          res.write(`data: ${JSON.stringify({ type: 'reasoning', text: chunk.reasoningText })}\n\n`);
        } else if (chunk.type === 'status') {
          res.write(`data: ${JSON.stringify({ type: 'status', text: chunk.text })}\n\n`);
        } else if (chunk.type === 'final') {
          res.write(`data: ${JSON.stringify({ type: 'final', text: chunk.text, usage: chunk.usage })}\n\n`);
        } else if (chunk.type === 'error') {
          res.write(`data: ${JSON.stringify({ type: 'error', text: chunk.text })}\n\n`);
        }
      }
    } catch (error: any) {
      res.write(`data: ${JSON.stringify({ type: 'error', text: error?.message || 'Stream error' })}\n\n`);
    }

    res.end();
  }

  /**
   * In-App SARA query (authenticated, Guide User mode)
   * Used by the InAppSaraGuide and module-specific Sara assistants
   */
  @Post('inapp')
  async inappQuery(
    @Body() body: {
      query: string;
      userId: string;
      schoolId: string;
      userRole?: string;
      currentModule?: string;
      messages?: Array<{ role: string; content: string }>;
    },
  ) {
    return this.saraService.handleInAppQuery(
      body.query,
      body.userId,
      body.schoolId,
      body.userRole,
      body.currentModule,
      body.messages,
    );
  }

  /**
   * In-App SARA streaming query (authenticated, SSE)
   * Used by the InAppSaraGuide for real-time streaming responses
   */
  @UseGuards(JwtAuthGuard)
  @Post('inapp/stream')
  async inappQueryStream(
    @Body() body: {
      query: string;
      userId: string;
      schoolId: string;
      userRole?: string;
      currentModule?: string;
      messages?: Array<{ role: string; content: string }>;
    },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      const stream = this.saraService.handleInAppQueryStream(
        body.query,
        body.userId,
        body.schoolId,
        body.userRole,
        body.currentModule,
        body.messages,
      );

      for await (const chunk of stream) {
        if (chunk.type === 'delta' && chunk.text) {
          res.write(`data: ${JSON.stringify({ type: 'delta', text: chunk.text })}\n\n`);
        } else if (chunk.type === 'reasoning' && chunk.reasoningText) {
          res.write(`data: ${JSON.stringify({ type: 'reasoning', text: chunk.reasoningText })}\n\n`);
        } else if (chunk.type === 'status') {
          res.write(`data: ${JSON.stringify({ type: 'status', text: chunk.text })}\n\n`);
        } else if (chunk.type === 'final') {
          res.write(`data: ${JSON.stringify({ type: 'final', text: chunk.text, usage: chunk.usage })}\n\n`);
        } else if (chunk.type === 'error') {
          res.write(`data: ${JSON.stringify({ type: 'error', text: chunk.text })}\n\n`);
        }
      }
    } catch (error: any) {
      res.write(`data: ${JSON.stringify({ type: 'error', text: error?.message || 'Stream error' })}\n\n`);
    }

    res.end();
  }

  /**
   * In-App SARA query via AI Gateway (mode avancé avec contexte MCP et outils)
   */
  @Post('gateway')
  async gatewayQuery(
    @Body() body: {
      query: string;
      userId: string;
      tenantId: string;
      schoolId?: string;
    },
  ) {
    return this.saraService.handleInAppQueryViaGateway(
      body.query,
      body.userId,
      body.tenantId,
      body.schoolId,
    );
  }

  /**
   * Get contextual suggestions based on user role and current module
   */
  @Post('suggestions')
  async getSuggestions(
    @Body() body: { userRole?: string; currentModule?: string },
  ) {
    return this.saraService.getContextualSuggestions(body.userRole, body.currentModule);
  }
}
