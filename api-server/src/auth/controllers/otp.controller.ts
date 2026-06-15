/**
 * OTP Controller
 * 
 * Contrôleur pour les endpoints OTP
 * - Générer un code OTP
 * - Vérifier un code OTP
 * - Gestion des appareils
 */

import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OtpService } from '../services/otp.service';
import { DeviceTrackingService } from '../services/device-tracking.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';

export class GenerateOtpDto {
  userId: string;
  tenantId: string;
  deviceId?: string;
  purpose: 'LOGIN' | 'DEVICE_VERIFICATION' | 'SENSITIVE_ACTION';
  phoneNumber: string;
}

export class VerifyOtpDto {
  code: string;
  deviceId?: string;
  otpId?: string;
}

@Controller('auth/otp')
export class OtpController {
  constructor(
    private readonly otpService: OtpService,
    private readonly deviceTrackingService: DeviceTrackingService
  ) {}

  /**
   * POST /auth/otp/generate
   * 
   * Génère et envoie un code OTP
   */
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generateOtp(@Body() dto: GenerateOtpDto) {
    const result = await this.otpService.generateOtp({
      userId: dto.userId,
      tenantId: dto.tenantId,
      deviceId: dto.deviceId,
      purpose: dto.purpose,
      phoneNumber: dto.phoneNumber,
    });

    return {
      success: true,
      otpId: result.otpId,
      expiresAt: result.expiresAt,
      message: 'Code OTP envoyé avec succès',
    };
  }

  /**
   * POST /auth/otp/verify
   * 
   * Vérifie un code OTP
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @CurrentUser() user: any,
    @TenantId() tenantId: string
  ) {
    const result = await this.otpService.verifyOtp({
      userId: user.id,
      tenantId,
      code: dto.code,
      deviceId: dto.deviceId,
      otpId: dto.otpId,
    });

    if (result.valid && result.deviceId) {
      // Marquer l'appareil comme trusted
      await this.deviceTrackingService.trustDevice(result.deviceId);
    }

    return {
      success: true,
      valid: result.valid,
      deviceId: result.deviceId,
      message: 'Code OTP vérifié avec succès',
    };
  }

  /**
   * GET /auth/otp/devices
   * 
   * Liste les appareils d'un utilisateur
   */
  @Get('devices')
  @UseGuards(JwtAuthGuard)
  async getUserDevices(@CurrentUser() user: any, @TenantId() tenantId: string) {
    const devices = await this.deviceTrackingService.getUserDevices(user.id, tenantId);

    return {
      success: true,
      devices,
    };
  }

  /**
   * DELETE /auth/otp/devices/:deviceId
   * 
   * Révoque un appareil
   */
  @Delete('devices/:deviceId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async revokeDevice(
    @Param('deviceId') deviceId: string,
    @CurrentUser() user: any
  ) {
    await this.deviceTrackingService.revokeDevice(deviceId, user.id);

    return {
      success: true,
      message: 'Appareil révoqué avec succès',
    };
  }
}
