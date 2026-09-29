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
  CommunityCreateInviteDto, CommunityCreateEventDto, CommunityUpdateEventDto,
  CommunityCreateSchoolGroupDto,
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

  // ═════════════════ v2 : Écoles (canaux dynamiques) ═════════════════

  /** Synchroniser : provisionne salon + groupes pour toutes les écoles actives */
  @Post('schools/sync')
  @CommunityRoles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async syncSchools(@Req() req: any) {
    return this.admin.syncSchools(req.communityMember);
  }

  /** Vue synthèse : écoles + canaux + effectifs rattachés */
  @Get('schools')
  @CommunityRoles('MODERATOR')
  async schools(@Req() req: any) {
    return this.admin.schools(req.communityMember);
  }

  /** Annuaire des membres rattachés à une école */
  @Get('schools/:tenantId/members')
  @CommunityRoles('MODERATOR')
  async schoolMembers(@Param('tenantId') tenantId: string, @Req() req: any) {
    return this.admin.schoolMembers(req.communityMember, tenantId);
  }

  /** Groupe custom au sein du canal d'une école */
  @Post('schools/groups')
  @CommunityRoles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async createSchoolGroup(@Body() dto: CommunityCreateSchoolGroupDto, @Req() req: any) {
    return this.admin.createSchoolGroup(req.communityMember, dto);
  }

  // ═════════════════ v2 : Lives & événements ═════════════════

  @Get('events')
  @CommunityRoles('MODERATOR')
  async listEvents(@Req() req: any, @Query('status') status?: string) {
    return this.admin.listEvents(req.communityMember, status);
  }

  /** Planifier un live/formation/atelier avec ciblage d'audience (dispatch) */
  @Post('events')
  @CommunityRoles('MODERATOR')
  @HttpCode(HttpStatus.CREATED)
  async createEvent(@Body() dto: CommunityCreateEventDto, @Req() req: any) {
    return this.admin.createEvent(req.communityMember, dto);
  }

  /** Mise à jour (démarrer live, terminer + replay, annuler, reprogrammer) */
  @Patch('events/:id')
  @CommunityRoles('MODERATOR')
  async updateEvent(@Param('id') id: string, @Body() dto: CommunityUpdateEventDto, @Req() req: any) {
    return this.admin.updateEvent(req.communityMember, id, dto);
  }
}
