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
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import {
  SaisieMasterService,
  type ActivityType,
  type UpdateProfileDto,
} from './saisiemaster.service';

@Controller('saisiemaster')
@Public()
export class SaisieMasterController {
  private readonly logger = new Logger(SaisieMasterController.name);

  constructor(private readonly service: SaisieMasterService) {}

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
    },
  ) {
    return this.service.signup(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('Email is required');
    }
    return this.service.login(email);
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
}
