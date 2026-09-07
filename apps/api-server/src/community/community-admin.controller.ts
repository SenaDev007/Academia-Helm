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
import { Public } from '../auth/decorators/public.decorator';
import { CommunityAuthGuard, CommunityRoles } from './community.guard';
import { CommunityAdminService } from './community-admin.service';
import {
  CommunityUpdateMemberDto, CommunityCreateChannelDto, CommunityUpdateChannelDto,
  CommunitySchedulePostDto, CommunityUpdateScheduledDto, CommunityBroadcastDto,
  CommunityCreateInviteDto,
} from './community.dto';


@Controller('community/admin')
@Public() // ⭐ contourne le JwtAuthGuard global (tokens applicatifs) — l'authentification est portée par CommunityAuthGuard ci-dessous
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
  async updateMember(@Param('id') id: string, @Body() dto: CommunityUpdateMemberDto, @Req() req: any) {
    return this.admin.updateMember(req.communityMember, id, dto);
  }

  @Post('channels')
  @CommunityRoles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async createChannel(@Body() dto: CommunityCreateChannelDto, @Req() req: any) {
    return this.admin.createChannel(req.communityMember, dto);
  }

  @Patch('channels/:id')
  @CommunityRoles('ADMIN')
  async updateChannel(@Param('id') id: string, @Body() dto: CommunityUpdateChannelDto, @Req() req: any) {
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
  async schedulePost(@Body() dto: CommunitySchedulePostDto, @Req() req: any) {
    return this.admin.schedulePost(req.communityMember, dto);
  }

  @Patch('scheduled-posts/:id')
  @CommunityRoles('MODERATOR')
  async updateScheduled(@Param('id') id: string, @Body() dto: CommunityUpdateScheduledDto, @Req() req: any) {
    return this.admin.updateScheduled(req.communityMember, id, dto);
  }

  @Post('broadcast')
  @CommunityRoles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async broadcast(@Body() dto: CommunityBroadcastDto, @Req() req: any) {
    return this.admin.broadcast(req.communityMember, dto);
  }

  @Post('invites')
  @CommunityRoles('MODERATOR')
  @HttpCode(HttpStatus.CREATED)
  async createInvite(@Body() dto: CommunityCreateInviteDto, @Req() req: any) {
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
