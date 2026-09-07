/**
 * ============================================================================
 * COMMUNITY ADMIN CONTROLLER — Cockpit équipe (MODERATOR+)
 * ============================================================================
 *
 * Préfixe : /community/admin
 *   - Membres (annuaire, rôles, tags, statut)        → MODERATOR+
 *   - Rôles et gestion de canaux                     → ADMIN+
 *   - Posts programmés, invitations, broadcast, stats → MODERATOR+ (broadcast ADMIN+)
 *
 * Toutes les routes sont derrière CommunityAuthGuard + @CommunityRoles.
 * ============================================================================
 */

import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { CommunityAuthGuard, CommunityRoles } from './community.guard';
import { CommunityAdminService } from './community-admin.service';

class UpdateMemberDto { role?: string; memberType?: string; status?: string; }
class CreateChannelDto {
  slug: string; name: string; description?: string;
  icon?: string; type?: string; position?: number;
}
class UpdateChannelDto {
  name?: string; description?: string; icon?: string;
  type?: string; position?: number; isActive?: boolean;
}
class SchedulePostDto { channelId: string; content: string; type?: string; scheduledAt: string; }
class UpdateScheduledDto { content?: string; scheduledAt?: string; status?: string; }
class BroadcastDto { channelIds: string[]; content: string; type?: string; }
class CreateInviteDto {
  channelId?: string; memberType?: string; note?: string;
  maxUses?: number; expiresInDays?: number;
}

@Controller('community/admin')
@UseGuards(CommunityAuthGuard)
export class CommunityAdminController {
  constructor(private readonly admin: CommunityAdminService) {}

  @Get('members')
  @CommunityRoles('MODERATOR')
  async members(@Req() req: any, @Query('query') query?: string, @Query('memberType') memberType?: string) {
    return this.admin.members(req.communityMember, { query, memberType });
  }

  @Patch('members/:id')
  @CommunityRoles('MODERATOR')
  async updateMember(@Param('id') id: string, @Body() dto: UpdateMemberDto, @Req() req: any) {
    return this.admin.updateMember(req.communityMember, id, dto);
  }

  @Post('channels')
  @CommunityRoles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async createChannel(@Body() dto: CreateChannelDto, @Req() req: any) {
    return this.admin.createChannel(req.communityMember, dto);
  }

  @Patch('channels/:id')
  @CommunityRoles('ADMIN')
  async updateChannel(@Param('id') id: string, @Body() dto: UpdateChannelDto, @Req() req: any) {
    return this.admin.updateChannel(req.communityMember, id, dto);
  }

  @Get('scheduled-posts')
  @CommunityRoles('MODERATOR')
  async listScheduled(@Req() req: any, @Query('status') status?: string) {
    return this.admin.listScheduled(req.communityMember, status);
  }

  @Post('scheduled-posts')
  @CommunityRoles('MODERATOR')
  @HttpCode(HttpStatus.CREATED)
  async schedulePost(@Body() dto: SchedulePostDto, @Req() req: any) {
    return this.admin.schedulePost(req.communityMember, dto);
  }

  @Patch('scheduled-posts/:id')
  @CommunityRoles('MODERATOR')
  async updateScheduled(@Param('id') id: string, @Body() dto: UpdateScheduledDto, @Req() req: any) {
    return this.admin.updateScheduled(req.communityMember, id, dto);
  }

  @Post('broadcast')
  @CommunityRoles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async broadcast(@Body() dto: BroadcastDto, @Req() req: any) {
    return this.admin.broadcast(req.communityMember, dto);
  }

  @Post('invites')
  @CommunityRoles('MODERATOR')
  @HttpCode(HttpStatus.CREATED)
  async createInvite(@Body() dto: CreateInviteDto, @Req() req: any) {
    return this.admin.createInvite(req.communityMember, dto);
  }

  @Get('invites')
  @CommunityRoles('MODERATOR')
  async listInvites(@Req() req: any) {
    return this.admin.listInvites(req.communityMember);
  }

  @Delete('invites/:id')
  @CommunityRoles('MODERATOR')
  async deleteInvite(@Param('id') id: string, @Req() req: any) {
    return this.admin.deleteInvite(req.communityMember, id);
  }

  @Get('stats')
  @CommunityRoles('MODERATOR')
  async stats(@Req() req: any) {
    return this.admin.stats(req.communityMember);
  }
}
