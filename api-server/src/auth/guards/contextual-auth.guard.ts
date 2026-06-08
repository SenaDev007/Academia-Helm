/**
 * Contextual Auth Guard
 * 
 * Guard pour l'authentification contextuelle
 * Vérifie :
 * - Session valide
 * - Device trusted
 * - Contexte (tenant_id + academic_year_id + device_id) valide
 * - OTP si nécessaire
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { DeviceSessionService } from '../services/device-session.service';
import { DeviceTrackingService } from '../services/device-tracking.service';
import { OtpService } from '../services/otp.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ContextualAuthGuard implements CanActivate {
  constructor(
    private readonly deviceSessionService: DeviceSessionService,
    private readonly deviceTrackingService: DeviceTrackingService,
    private readonly otpService: OtpService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const sessionToken = this.extractSessionToken(request);

    if (!sessionToken) {
      throw new UnauthorizedException('Session token manquant');
    }

    // Valider la session
    const session = await this.deviceSessionService.validateSession(sessionToken);

    if (!session.valid || !session.sessionId) {
      throw new UnauthorizedException('Session invalide ou expirée');
    }

    // Vérifier que l'appareil nécessite OTP
    if (session.deviceId && session.userId && session.tenantId && session.academicYearId) {
      const requiresOtp = await this.deviceTrackingService.requiresOtpVerification(
        session.deviceId,
        session.userId,
        session.tenantId,
        session.academicYearId
      );

      if (requiresOtp) {
        // Vérifier si un OTP a été fourni
        const otpCode = request.headers['x-otp-code'] || request.body?.otpCode;
        const otpId = request.headers['x-otp-id'] || request.body?.otpId;

        if (!otpCode || !otpId) {
          throw new ForbiddenException({
            code: 'OTP_REQUIRED',
            message: 'Vérification OTP requise',
            requiresOtp: true,
          });
        }

        // Vérifier l'OTP
        try {
          const otpResult = await this.otpService.verifyOtp({
            userId: session.userId!,
            tenantId: session.tenantId!,
            code: otpCode,
            deviceId: session.deviceId,
            otpId,
          });

          if (!otpResult.valid) {
            throw new ForbiddenException('Code OTP invalide');
          }

          // Marquer l'appareil comme trusted si ce n'est pas déjà fait
          if (session.deviceId) {
            await this.deviceTrackingService.trustDevice(session.deviceId);
          }
        } catch (error: any) {
          if (error instanceof ForbiddenException) {
            throw error;
          }
          throw new ForbiddenException('Erreur lors de la vérification OTP');
        }
      }
    }

    // Ajouter les informations de session à la requête
    request.session = {
      id: session.sessionId,
      userId: session.userId,
      tenantId: session.tenantId,
      academicYearId: session.academicYearId,
      deviceId: session.deviceId,
    };

    return true;
  }

  /**
   * Extrait le token de session depuis les headers ou cookies
   */
  private extractSessionToken(request: any): string | null {
    // Chercher dans les headers
    const headerToken = request.headers['x-session-token'] || request.headers['authorization']?.replace('Bearer ', '');

    if (headerToken) {
      return headerToken;
    }

    // Chercher dans les cookies
    const cookieToken = request.cookies?.['session_token'];

    if (cookieToken) {
      return cookieToken;
    }

    return null;
  }
}
