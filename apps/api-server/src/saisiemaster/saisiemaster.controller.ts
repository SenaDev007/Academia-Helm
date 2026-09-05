/**
 * ============================================================================
 * SAISIEMASTER CONTROLLER — Public REST endpoints
 * ============================================================================
 *
 * All routes are PUBLIC (no Academia Helm JWT required): SaisieMaster uses its
 * OWN frictionless auth (email + name only, no password).
 *
 * Protected routes (profile, sessions, track) extract the prospectId from a
 * SaisieMaster Bearer token. The token is verified by SaisieMasterService.
 *
 * Route prefix is `/saisiemaster` → with the global `/api` prefix from main.ts,
 * the full path is `/api/saisiemaster/...`.
 * ============================================================================
 */

import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  SaisieMasterService,
  type ActivityType,
  type UpdateProfileDto,
} from './saisiemaster.service';
import { SaisieMasterFollowupService } from './saisiemaster-followup.service';
import {
  SaisieMasterTestimonialService,
  type SubmitTestimonialDto,
} from './saisiemaster-testimonial.service';

@Controller('saisiemaster')
// ⭐ FIX 2026-09-06 (F9) : fin du @Public() — le CRUD d'évaluations et la saisie
//    de notes SaisieMaster exigent désormais l'authentification JWT (avant :
//    accessible sans aucune authentification).
@UseGuards(JwtAuthGuard)
export class SaisieMasterController {
  private readonly logger = new Logger(SaisieMasterController.name);

  constructor(
    private readonly service: SaisieMasterService,
    private readonly followupService: SaisieMasterFollowupService,
    private readonly testimonialService: SaisieMasterTestimonialService,
  ) {}

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------

  @Post('signup')
  @HttpCode(HttpStatus.OK)
  async signup(
    @Body()
    body: {
      email: string;
      firstName: string;
      lastName: string;
      schoolName: string;
      phoneNumber?: string;
      city?: string;
      password?: string;
    },
  ) {
    return this.service.signup(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: { email: string; password?: string },
  ) {
    if (!body?.email) {
      throw new BadRequestException('Email is required');
    }
    return this.service.login(body.email, body.password);
  }

  // --------------------------------------------------------------------------
  // Profile (Bearer token required)
  // --------------------------------------------------------------------------

  @Get('profile')
  async getProfile(@Headers('authorization') authHeader?: string) {
    const prospectId = await this.extractProspectId(authHeader);
    return this.service.getProfile(prospectId);
  }

  @Put('profile')
  async updateProfile(
    @Headers('authorization') authHeader: string | undefined,
    @Body() body: UpdateProfileDto,
  ) {
    const prospectId = await this.extractProspectId(authHeader);
    return this.service.updateProfile(prospectId, body);
  }

  // --------------------------------------------------------------------------
  // Sessions (Bearer token required)
  // --------------------------------------------------------------------------

  @Post('sessions')
  @HttpCode(HttpStatus.OK)
  async saveSession(
    @Headers('authorization') authHeader: string | undefined,
    @Body()
    body: {
      className: string;
      schoolYear?: string;
      academicYear?: string;
      studentCount: number;
      subjectCount: number;
      gradesData: unknown;
    },
  ) {
    const prospectId = await this.extractProspectId(authHeader);
    return this.service.saveSession(prospectId, body);
  }

  @Get('sessions')
  async getSessions(@Headers('authorization') authHeader?: string) {
    const prospectId = await this.extractProspectId(authHeader);
    return this.service.getSessions(prospectId);
  }

  @Delete('sessions/:id')
  async deleteSession(
    @Param('id') sessionId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const prospectId = await this.extractProspectId(authHeader);
    return this.service.deleteSession(prospectId, sessionId);
  }

  // --------------------------------------------------------------------------
  // Activity tracking (Bearer token required)
  // --------------------------------------------------------------------------

  @Post('track')
  @HttpCode(HttpStatus.OK)
  async track(
    @Headers('authorization') authHeader: string | undefined,
    @Body() body: { type: ActivityType },
  ) {
    const prospectId = await this.extractProspectId(authHeader);
    if (!body?.type) {
      throw new BadRequestException('type is required');
    }
    return this.service.trackActivity(prospectId, body.type);
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  /**
   * Extract prospectId from a `Bearer <token>` Authorization header.
   * Throws UnauthorizedException if missing/malformed.
   */
  private async extractProspectId(authHeader?: string): Promise<string> {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is required');
    }
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new UnauthorizedException(
        'Invalid Authorization header. Expected: Bearer <token>',
      );
    }
    const token = match[1].trim();
    const payload = await this.service.verifyToken(token);
    return payload.prospectId;
  }

  // --------------------------------------------------------------------------
  // ⭐ Follow-up emails — manual trigger (for testing or admin use)
  // --------------------------------------------------------------------------

  @Post('followups/run')
  async triggerFollowups() {
    this.logger.log(' Manual follow-up trigger');
    await this.followupService.sendFirstFollowup();
    await this.followupService.sendSecondFollowup();
    await this.followupService.sendThirdFollowup();
    return { message: 'Follow-ups processed' };
  }

  /**
   * ⭐ Envoie le PREMIER email de la séquence à UN prospect spécifique
   * identifié par son email — sans tenir compte du délai de 3 jours.
   *
   * Body : { email: string }
   *
   * Cas d'usage :
   *  - Vérifier le rendu de l'email (test forme + fond)
   *  - Renvoyer manuellement un email qui aurait échoué
   *
   * Réponse : { sent, prospect, alreadySent }
   */
  @Post('followups/send-first')
  @HttpCode(HttpStatus.OK)
  async sendFirstFollowupToEmail(
    @Body() body: { email: string },
  ) {
    if (!body?.email || typeof body.email !== 'string') {
      throw new BadRequestException('email is required');
    }
    try {
      const result = await this.followupService.sendFirstFollowupToEmail(
        body.email,
      );
      return result;
    } catch (err) {
      // Prospect introuvable → 404 (sinon Nest renvoie 500 par défaut)
      if (err.message?.includes('Aucun prospect')) {
        throw new NotFoundException(err.message);
      }
      throw err;
    }
  }

  // --------------------------------------------------------------------------
  // ⭐ Testimonials (avis utilisateurs affichés sur la landing)
  // --------------------------------------------------------------------------

  /**
   * Liste publique des témoignages publiés — utilisée par la landing page
   * SaisieMaster (section témoignages). Pas d'auth requise.
   */
  @Get('testimonials')
  async listPublishedTestimonials() {
    return this.testimonialService.listPublished(12);
  }

  /**
   * Soumet un nouveau témoignage — nécessite un Bearer token SaisieMaster.
   * Le témoignage est créé avec isPublished=false : un admin doit le modérer.
   */
  @Post('testimonials')
  @HttpCode(HttpStatus.CREATED)
  async submitTestimonial(
    @Headers('authorization') authHeader: string | undefined,
    @Body() body: SubmitTestimonialDto,
  ) {
    const prospectId = await this.extractProspectId(authHeader);
    return this.testimonialService.submit(prospectId, body);
  }

  /**
   * Liste MES témoignages (ceux du prospect authentifié).
   * Inclut ceux non encore publiés.
   */
  @Get('testimonials/mine')
  async listMyTestimonials(
    @Headers('authorization') authHeader: string | undefined,
  ) {
    const prospectId = await this.extractProspectId(authHeader);
    return this.testimonialService.listMine(prospectId);
  }
}
