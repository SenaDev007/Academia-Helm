/**
 * ============================================================================
 * PORTAL AUTH CONTROLLER - AUTHENTIFICATION MULTI-PORTAILS
 * ============================================================================
 */

import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '@/auth/decorators/public.decorator';
import { PortalAuthService } from '../services/portal-auth.service';
import {
  SchoolPortalLoginDto,
  TeacherPortalLoginDto,
  ParentPortalLoginDto,
} from '../dto/portal-login.dto';

@Controller('portal/auth')
@Public()
export class PortalAuthController {
  constructor(private readonly portalAuthService: PortalAuthService) {}

  /**
   * Authentification Portail École
   */
  @Post('school')
  @HttpCode(HttpStatus.OK)
  async loginSchool(
    @Body() dto: SchoolPortalLoginDto,
    @Req() request: any,
  ) {
    const ipAddress =
      request.ip ||
      request.headers['x-forwarded-for'] ||
      request.connection.remoteAddress;
    const userAgent = request.headers['user-agent'];

    return this.portalAuthService.loginSchool(dto, ipAddress, userAgent);
  }

  /**
   * Authentification Portail Enseignant
   */
  @Post('teacher')
  @HttpCode(HttpStatus.OK)
  async loginTeacher(
    @Body() dto: TeacherPortalLoginDto,
    @Req() request: any,
  ) {
    const ipAddress =
      request.ip ||
      request.headers['x-forwarded-for'] ||
      request.connection.remoteAddress;
    const userAgent = request.headers['user-agent'];

    return this.portalAuthService.loginTeacher(dto, ipAddress, userAgent);
  }

  /**
   * Authentification Portail Parent
   */
  @Post('parent')
  @HttpCode(HttpStatus.OK)
  async loginParent(
    @Body() dto: ParentPortalLoginDto,
    @Req() request: any,
  ) {
    const ipAddress =
      request.ip ||
      request.headers['x-forwarded-for'] ||
      request.connection.remoteAddress;
    const userAgent = request.headers['user-agent'];

    return this.portalAuthService.loginParent(dto, ipAddress, userAgent);
  }
}

