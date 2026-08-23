/**
 * ============================================================================
 * HELM CONNECT V2.6 — Poll Service
 * ============================================================================
 *
 * Système de sondages type Telegram :
 *   - Question + 2 à 10 options
 *   - Choix unique OU multiple
 *   - Anonyme (optionnel)
 *   - Expiration (1H, 8H, 24H, 7D, jamais)
 *   - Affichage des résultats en temps réel
 *   - Graphique de progression par option
 *
 * ⭐ Architecture :
 *   - Poll stocké comme un message spécial (type='POLL')
 *   - Les votes sont stockés dans une table dédiée chat_poll_votes
 *   - Un message POLL a une colonne `pollData` (JSONB) avec la structure
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { randomUUID } from 'crypto';

export interface PollData {
  question: string;
  options: Array<{ id: string; text: string; voteCount: number }>;
  multipleChoice: boolean;
  anonymous: boolean;
  expiry?: '1H' | '8H' | '24H' | '7D' | 'NEVER';
  expiresAt?: Date;
  closed: boolean;
}

const EXPIRY_DURATIONS_MS: Record<string, number | null> = {
  '1H': 60 * 60 * 1000,
  '8H': 8 * 60 * 60 * 1000,
  '24H': 24 * 60 * 60 * 1000,
  '7D': 7 * 24 * 60 * 60 * 1000,
  'NEVER': null,
};

@Injectable()
export class PollService {
  private readonly logger = new Logger(PollService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═════════════════════════════════════════════════════════════════
  //  CREATE POLL — Create a poll as a special message
  // ═════════════════════════════════════════════════════════════════
  async createPoll(
    tenantId: string,
    authorId: string,
    data: {
      conversationId: string;
      question: string;
      options: string[];          // array of text options (2 to 10)
      multipleChoice?: boolean;
      anonymous?: boolean;
      expiry?: '1H' | '8H' | '24H' | '7D' | 'NEVER';
    },
  ): Promise<{ id: string; pollData: PollData }> {
    if (!data.question || data.question.trim().length < 5) {
      throw new BadRequestException('Question must be at least 5 characters');
    }
    if (!data.options || data.options.length < 2 || data.options.length > 10) {
      throw new BadRequestException('Poll must have 2 to 10 options');
    }
    // Filter empty options
    const cleanOptions = data.options.map(o => o.trim()).filter(o => o.length > 0);
    if (cleanOptions.length < 2) {
      throw new BadRequestException('At least 2 non-empty options required');
    }

    // Verify author is participant in conversation
    const participants: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id FROM chat_participants
      WHERE "conversationId" = $1 AND "userId" = $2 AND "leftAt" IS NULL
    `, data.conversationId, authorId);
    if (participants.length === 0) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    // Build poll data
    const optionsWithIds = cleanOptions.map((text, idx) => ({
      id: `opt_${idx + 1}_${randomUUID().substring(0, 8)}`,
      text,
      voteCount: 0,
    }));

    const expiry = data.expiry || '24H';
    const ms = EXPIRY_DURATIONS_MS[expiry];
    const expiresAt = ms ? new Date(Date.now() + ms) : null;

    const pollData: PollData = {
      question: data.question.trim(),
      options: optionsWithIds,
      multipleChoice: data.multipleChoice || false,
      anonymous: data.anonymous || false,
      expiry,
      expiresAt: expiresAt || undefined,
      closed: false,
    };

    // Create the poll as a special message (type='POLL')
    // The pollData is stored in the message's `content` field as JSON
    const msgId = randomUUID();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_messages"
        ("id", "conversationId", "senderId", "type", "content", "createdAt")
      VALUES
        ($1, $2, $3, 'POLL', $4, NOW())
    `, msgId, data.conversationId, authorId, JSON.stringify(pollData));

    // Update conversation lastMessage
    const preview = `📊 ${data.question.substring(0, 50)}`;
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_conversations"
      SET "lastMessageAt" = NOW(),
          "lastMessagePreview" = $3,
          "lastMessageSenderId" = $2,
          "updatedAt" = NOW()
      WHERE "id" = $1
    `, data.conversationId, authorId, preview);

    this.logger.log(`⭐ Poll created: id=${msgId}, question="${data.question.substring(0, 50)}", options=${cleanOptions.length}, multipleChoice=${pollData.multipleChoice}, anonymous=${pollData.anonymous}`);

    return { id: msgId, pollData };
  }

  // ═════════════════════════════════════════════════════════════════
  //  VOTE — User votes on a poll
  // ═════════════════════════════════════════════════════════════════
  async vote(
    tenantId: string,
    userId: string,
    data: {
      pollId: string;       // = messageId
      optionIds: string[]; // 1 or more (if multipleChoice)
    },
  ): Promise<{ success: boolean; pollData: PollData }> {
    if (!data.optionIds || data.optionIds.length === 0) {
      throw new BadRequestException('At least one option must be selected');
    }

    // Fetch the poll message
    const msgs: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT m.*, c."tenantId" AS "convTenantId"
      FROM chat_messages m
      JOIN "chat_conversations" c ON c.id = m."conversationId"
      WHERE m.id = $1 AND m.type = 'POLL' AND m."deletedAt" IS NULL
    `, data.pollId);
    if (msgs.length === 0) {
      throw new NotFoundException('Poll not found');
    }
    const msg = msgs[0];

    // Verify user is participant
    const participants: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id FROM chat_participants
      WHERE "conversationId" = $1 AND "userId" = $2 AND "leftAt" IS NULL
    `, msg.conversationId, userId);
    if (participants.length === 0) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    // Parse pollData
    const pollData: PollData = JSON.parse(msg.content);

    // Check if poll is closed
    if (pollData.closed || (pollData.expiresAt && new Date(pollData.expiresAt) < new Date())) {
      throw new BadRequestException('This poll is closed');
    }

    // Check multiple choice
    if (!pollData.multipleChoice && data.optionIds.length > 1) {
      throw new BadRequestException('This poll only allows a single choice');
    }

    // Verify all optionIds exist
    const validOptionIds = new Set(pollData.options.map(o => o.id));
    for (const optId of data.optionIds) {
      if (!validOptionIds.has(optId)) {
        throw new BadRequestException(`Invalid option id: ${optId}`);
      }
    }

    // Remove previous votes by this user (if single choice OR if multipleChoice and user wants to change)
    await this.prisma.$executeRawUnsafe(`
      DELETE FROM "chat_poll_votes"
      WHERE "pollId" = $1 AND "userId" = $2
    `, data.pollId, userId);

    // Add new votes
    for (const optionId of data.optionIds) {
      const id = randomUUID();
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "chat_poll_votes" ("id", "pollId", "optionId", "userId", "tenantId", "votedAt")
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT DO NOTHING
      `, id, data.pollId, optionId, userId, tenantId);
    }

    // Recompute vote counts
    const counts: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "optionId", count(*)::int AS cnt
      FROM "chat_poll_votes"
      WHERE "pollId" = $1
      GROUP BY "optionId"
    `, data.pollId);
    const countMap = new Map(counts.map(c => [c.optionId, c.cnt]));
    pollData.options = pollData.options.map(o => ({
      ...o,
      voteCount: countMap.get(o.id) || 0,
    }));

    // Update the poll message content with new counts
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_messages"
      SET "content" = $2
      WHERE "id" = $1
    `, data.pollId, JSON.stringify(pollData));

    return { success: true, pollData };
  }

  // ═════════════════════════════════════════════════════════════════
  //  GET POLL — Get poll details with current results
  // ═════════════════════════════════════════════════════════════════
  async getPoll(pollId: string, userId: string): Promise<{ pollData: PollData; userVotes: string[] }> {
    const msgs: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM chat_messages
      WHERE id = $1 AND type = 'POLL' AND "deletedAt" IS NULL
    `, pollId);
    if (msgs.length === 0) {
      throw new NotFoundException('Poll not found');
    }
    let pollData: PollData = JSON.parse(msgs[0].content);

    // Check if expired → close it
    if (!pollData.closed && pollData.expiresAt && new Date(pollData.expiresAt) < new Date()) {
      pollData.closed = true;
      await this.prisma.$executeRawUnsafe(`
        UPDATE "chat_messages" SET "content" = $2 WHERE "id" = $1
      `, pollId, JSON.stringify(pollData));
    }

    // Get user's previous votes
    const votes: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "optionId" FROM "chat_poll_votes"
      WHERE "pollId" = $1 AND "userId" = $2
    `, pollId, userId);

    return {
      pollData,
      userVotes: votes.map(v => v.optionId),
    };
  }

  // ═════════════════════════════════════════════════════════════════
  //  CLOSE POLL — Manually close a poll (author only)
  // ═════════════════════════════════════════════════════════════════
  async closePoll(pollId: string, userId: string): Promise<{ success: boolean }> {
    const msgs: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM chat_messages WHERE id = $1 AND type = 'POLL'
    `, pollId);
    if (msgs.length === 0) {
      throw new NotFoundException('Poll not found');
    }
    if (msgs[0].senderId !== userId) {
      throw new ForbiddenException('Only the author can close the poll');
    }
    const pollData: PollData = JSON.parse(msgs[0].content);
    pollData.closed = true;
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_messages" SET "content" = $2 WHERE "id" = $1
    `, pollId, JSON.stringify(pollData));
    return { success: true };
  }
}
