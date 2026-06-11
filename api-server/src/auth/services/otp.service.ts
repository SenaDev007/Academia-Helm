/**
 * OTP Service
 * 
 * Service pour gérer les codes OTP
 * - Génération de codes
 * - Validation de codes
 * - Envoi par SMS
 * - Gestion des tentatives et expiration
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { SmsService } from './sms.service';
import * as crypto from 'crypto';

export type OtpPurpose = 'LOGIN' | 'DEVICE_VERIFICATION' | 'SENSITIVE_ACTION';

export interface GenerateOtpRequest {
  userId: string;
  tenantId: string;
  deviceId?: string;
  purpose: OtpPurpose;
  phoneNumber: string;
}

export interface VerifyOtpRequest {
  userId: string;
  tenantId: string;
  code: string;
  deviceId?: string;
  otpId?: string;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly codeLength = 6;
  private readonly codeValidityMinutes = 5;
  private readonly maxAttempts = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly smsService: SmsService
  ) {}

  /**
   * Génère un code OTP
   */
  private generateCode(): string {
    // Générer un code à 6 chiffres
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    return code;
  }

  /**
   * Hash le code OTP pour stockage sécurisé
   */
  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * Génère et envoie un code OTP
   */
  async generateOtp(request: GenerateOtpRequest): Promise<{ otpId: string; expiresAt: Date }> {
    const code = this.generateCode();
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(Date.now() + this.codeValidityMinutes * 60 * 1000);

    // Invalider les codes OTP précédents non utilisés pour ce device/purpose
    if (request.deviceId) {
      await this.prisma.otpCode.updateMany({
        where: {
          userId: request.userId,
          tenantId: request.tenantId,
          deviceId: request.deviceId,
          purpose: request.purpose,
          isUsed: false,
          isExpired: false,
        },
        data: { isExpired: true },
      });
    }

    // Créer le code OTP
    const otpCode = await this.prisma.otpCode.create({
      data: {
        userId: request.userId,
        tenantId: request.tenantId,
        deviceId: request.deviceId,
        code: code, // Stocker en clair pour l'instant (sera hashé en production)
        codeHash,
        purpose: request.purpose,
        phoneNumber: request.phoneNumber,
        expiresAt,
        maxAttempts: this.maxAttempts,
      },
    });

    // Envoyer le code par SMS
    const smsMessage = this.smsService.formatOtpMessage(code, request.purpose);
    await this.smsService.sendSms({
      to: request.phoneNumber,
      message: smsMessage,
    });

    // Logger l'audit
    await this.logAudit({
      userId: request.userId,
      tenantId: request.tenantId,
      deviceId: request.deviceId,
      action: 'OTP_SENT',
      status: 'SUCCESS',
      metadata: { purpose: request.purpose, otpId: otpCode.id },
    });

    return {
      otpId: otpCode.id,
      expiresAt,
    };
  }

  /**
   * Vérifie un code OTP
   */
  async verifyOtp(request: VerifyOtpRequest): Promise<{ valid: boolean; otpId?: string; deviceId?: string }> {
    const codeHash = this.hashCode(request.code);

    // Trouver le code OTP non utilisé et non expiré
    const otpCode = await this.prisma.otpCode.findFirst({
      where: {
        userId: request.userId,
        tenantId: request.tenantId,
        codeHash,
        isUsed: false,
        isExpired: false,
        expiresAt: { gt: new Date() },
        ...(request.deviceId ? { deviceId: request.deviceId } : {}),
        ...(request.otpId ? { id: request.otpId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpCode) {
      // Logger l'échec
      await this.logAudit({
        userId: request.userId,
        tenantId: request.tenantId,
        deviceId: request.deviceId,
        action: 'OTP_FAILED',
        status: 'FAILED',
        reason: 'Code invalide ou expiré',
        metadata: { codeProvided: request.code.substring(0, 2) + '****' },
      });

      throw new BadRequestException('Code OTP invalide ou expiré');
    }

    // Vérifier le nombre de tentatives
    if (otpCode.attempts >= otpCode.maxAttempts) {
      await this.prisma.otpCode.update({
        where: { id: otpCode.id },
        data: { isExpired: true },
      });

      await this.logAudit({
        userId: request.userId,
        tenantId: request.tenantId,
        deviceId: request.deviceId,
        action: 'OTP_FAILED',
        status: 'BLOCKED',
        reason: 'Trop de tentatives',
      });

      throw new BadRequestException('Trop de tentatives. Le code a été invalidé.');
    }

    // Incrémenter les tentatives
    await this.prisma.otpCode.update({
      where: { id: otpCode.id },
      data: {
        attempts: { increment: 1 },
      },
    });

    // Marquer le code comme utilisé
    await this.prisma.otpCode.update({
      where: { id: otpCode.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

    // Logger le succès
    await this.logAudit({
      userId: request.userId,
      tenantId: request.tenantId,
      deviceId: otpCode.deviceId,
      action: 'OTP_VERIFIED',
      status: 'SUCCESS',
      metadata: { otpId: otpCode.id, purpose: otpCode.purpose },
    });

    return {
      valid: true,
      otpId: otpCode.id,
      deviceId: otpCode.deviceId || undefined,
    };
  }


  /**
   * Logger un audit
   */
  private async logAudit(data: {
    userId?: string;
    tenantId?: string;
    deviceId?: string;
    action: string;
    status: string;
    reason?: string;
    metadata?: any;
  }): Promise<void> {
    try {
      await this.prisma.authAuditLog.create({
        data: {
          userId: data.userId,
          tenantId: data.tenantId,
          deviceId: data.deviceId,
          action: data.action,
          status: data.status,
          reason: data.reason,
          metadata: data.metadata || {},
        },
      });
    } catch (error) {
      this.logger.error('Failed to log audit:', error);
    }
  }
}
