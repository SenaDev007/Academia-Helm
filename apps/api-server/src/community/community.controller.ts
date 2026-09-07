/**
 * ============================================================================
 * COMMUNITY CONTROLLER — Routes membres (et auth @Public)
 * ============================================================================
 *
 * Préfixe : /community
 *   @Public()  : auth/register, auth/login, public/overview (vitrine landing)
 *   Authentifié : le reste (cookie community_token → Bearer via BFF)
 *
 * Timeouts cohérents avec l'audit perf 2026-09-07 : polling lecture borné
 * (limit ≤ 100), throttling medium global (300/min) suffisant — le client
 * espace interroge /sync toutes les 10 s.
 * ============================================================================
 */

import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { CommunityAuthGuard } from './community.guard';
import { CommunityAuthService } from './community-auth.service';
import { CommunityService } from './community.service';
import {
  CommunityRegisterDto, CommunityLoginDto, CommunityPostMessageDto,
  CommunityEditMessageDto, CommunityReactionDto, CommunityVoteDto, CommunityPinDto,
} from './community.dto';

/**
 * ⭐ @Public() au niveau CLASSE : le JwtAuthGuard GLOBAL (auth applicative,
 * table `users`) ne doit PAS valider les tokens communauté (claim typ:
 * 'community', table `community_members`) — sinon 401 avant même que le
 * CommunityAuthGuard (authentification communautaire, appliquée route par
 * route) ne puisse agir. Les routes protégées portent toutes
 * @UseGuards(CommunityAuthGuard) ; les routes auth/login-register-public
 * sont volontairement sans garde.
 */

// ─── Contexte membre injecté par le guard ───
interface MemberCtx {
  id: string; email: string; displayName: string;
  role: string; memberType: string; status: string;
  organization?: string; avatarUrl?: string;
}

function memberOf(req: any): MemberCtx {
  return req.communityMember;
}

// ═════════════════════ AUTH (public) ═════════════════════

@Controller('community')
@Public()
export class CommunityController {
  constructor(
    private readonly authService: CommunityAuthService,
    private readonly service: CommunityService,
  ) {}

  @Public()
  @Post('auth/register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: CommunityRegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: CommunityLoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  /** Vitrine publique (page /community sans compte) : canaux + stats anonymisés */
  @Public()
  @Get('public/overview')
  async overview() {
    return this.service.publicOverview();
  }

  /**
   * Logout — le JWT communauté est stateless : la déconnexion réelle est la
   * suppression du cookie httpOnly côté BFF (le BFF gère ce cas même si cette
   * route répond simplement 200).
   */
  @Public()
  @Post('auth/logout')
  @HttpCode(HttpStatus.OK)
  async logout() {
    return { loggedOut: true };
  }

  @Public()
  @Get('public/contact')
  async contact() {
    return { teamEmail: this.authService.teamContact() };
  }

  // ═════════════════════ Membre authentifié ═════════════════════

  @UseGuards(CommunityAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
    const m = memberOf(req);
    return {
      id: m.id, email: m.email, displayName: m.displayName, role: m.role,
      memberType: m.memberType, status: m.status, organization: m.organization,
      avatarUrl: m.avatarUrl, teamEmail: this.authService.teamContact(),
    };
  }

  @UseGuards(CommunityAuthGuard)
  @Get('channels')
  async channels(@Req() req: any) {
    return this.service.channelsForMember(memberOf(req));
  }

  @UseGuards(CommunityAuthGuard)
  @Get('channels/:slug')
  async channel(@Param('slug') slug: string, @Req() req: any) {
    return this.service.channelBySlug(slug, memberOf(req));
  }

  @UseGuards(CommunityAuthGuard)
  @Get('channels/:slug/messages')
  async messages(
    @Req() req: any,
    @Param('slug') slug: string,
    @Query('before') before?: string,
    @Query('since') since?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.messages(slug, memberOf(req), {
      before, since,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @UseGuards(CommunityAuthGuard)
  @Post('channels/:slug/messages')
  @HttpCode(HttpStatus.CREATED)
  async postMessage(@Param('slug') slug: string, @Body() dto: CommunityPostMessageDto, @Req() req: any) {
    return this.service.postMessage(slug, memberOf(req), dto);
  }

  @UseGuards(CommunityAuthGuard)
  @Post('channels/:slug/read')
  @HttpCode(HttpStatus.OK)
  async markRead(@Param('slug') slug: string, @Req() req: any) {
    return this.service.markRead(slug, memberOf(req));
  }

  @UseGuards(CommunityAuthGuard)
  @Patch('messages/:id')
  async editMessage(@Param('id') id: string, @Body() dto: CommunityEditMessageDto, @Req() req: any) {
    return this.service.editMessage(id, memberOf(req), dto.content);
  }

  @UseGuards(CommunityAuthGuard)
  @Delete('messages/:id')
  async deleteMessage(@Param('id') id: string, @Req() req: any) {
    return this.service.deleteMessage(id, memberOf(req));
  }

  @UseGuards(CommunityAuthGuard)
  @Post('messages/:id/pin')
  @HttpCode(HttpStatus.OK)
  async pin(@Param('id') id: string, @Body() dto: CommunityPinDto, @Req() req: any) {
    return this.service.setPinned(id, memberOf(req), dto.pinned !== false);
  }

  @UseGuards(CommunityAuthGuard)
  @Post('messages/:id/reactions')
  @HttpCode(HttpStatus.OK)
  async react(@Param('id') id: string, @Body() dto: CommunityReactionDto, @Req() req: any) {
    return this.service.toggleReaction(id, memberOf(req), dto.emoji);
  }

  @UseGuards(CommunityAuthGuard)
  @Post('messages/:id/poll/vote')
  @HttpCode(HttpStatus.OK)
  async vote(@Param('id') id: string, @Body() dto: CommunityVoteDto, @Req() req: any) {
    return this.service.vote(id, memberOf(req), dto.optionIds ?? []);
  }

  // ═════════════════════ Présence & synchronisation ═════════════════════

  @UseGuards(CommunityAuthGuard)
  @Get('presence')
  async presence() {
    return this.service.presence();
  }
}
