/**
 * ============================================================================
 * HELM CONNECT V2.6 — Poll Controller
 * ============================================================================
 *
 * Endpoints REST pour les sondages Helm Connect.
 *
 *   POST   /chat/v2/polls                          — créer un sondage
 *   GET    /chat/v2/polls/:id                       — détails d'un sondage (avec résultats)
 *   POST   /chat/v2/polls/:id/vote                  — voter
 *   POST   /chat/v2/polls/:id/close                — clôturer (auteur uniquement)
 * ============================================================================
 */

import {
  Controller, Get, Post, Body, Param, Query, UseGuards, BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { PollService } from './services/poll.service';

@Controller('chat/v2/polls')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PollController {
  constructor(private readonly pollService: PollService) {}

  @Post()
  async createPoll(
    @TenantId() tenantId: string,
    @Body() body: {
      authorId: string;
      conversationId: string;
      question: string;
      options: string[];
      multipleChoice?: boolean;
      anonymous?: boolean;
      expiry?: '1H' | '8H' | '24H' | '7D' | 'NEVER';
    },
  ) {
    if (!body.authorId) throw new BadRequestException('authorId is required');
    if (!body.conversationId) throw new BadRequestException('conversationId is required');
    if (!body.question) throw new BadRequestException('question is required');
    if (!body.options || !Array.isArray(body.options)) throw new BadRequestException('options array is required');
    return this.pollService.createPoll(tenantId, body.authorId, body);
  }

  @Get(':id')
  async getPoll(
    @Param('id') pollId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.pollService.getPoll(pollId, userId);
  }

  @Post(':id/vote')
  async vote(
    @TenantId() tenantId: string,
    @Param('id') pollId: string,
    @Body() body: { userId: string; optionIds: string[] },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    if (!body.optionIds || !Array.isArray(body.optionIds)) throw new BadRequestException('optionIds array is required');
    return this.pollService.vote(tenantId, body.userId, { pollId, optionIds: body.optionIds });
  }

  @Post(':id/close')
  async closePoll(
    @Param('id') pollId: string,
    @Body() body: { userId: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.pollService.closePoll(pollId, body.userId);
  }
}
