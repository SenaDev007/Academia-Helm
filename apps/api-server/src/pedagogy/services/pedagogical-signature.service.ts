/**
 * ============================================================================
 * PEDAGOGICAL SIGNATURE SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service de signature numérique interne pour les documents pédagogiques.
 * 
 * ============================================================================
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class PedagogicalSignatureService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Signe numériquement un document
   */
  async signDocument(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
    signedBy: string;
    contentToHash: string;
  }) {
    // 1. Générer le hash
    const hash = crypto
      .createHash('sha256')
      .update(params.contentToHash)
      .digest('hex');

    // 2. Enregistrer la signature
    return this.prisma.pedagogicalSignature.create({
      data: {
        tenantId: params.tenantId,
        entityType: params.entityType,
        entityId: params.entityId,
        signerId: params.signedBy,
        hashSignature: hash,
        signatureDate: new Date(),
        isValid: true,
      },
    });
  }

  /**
   * Vérifie l'intégrité d'un document signé
   */
  async verifySignature(entityId: string, currentContent: string) {
    const signature = await this.prisma.pedagogicalSignature.findFirst({
      where: { entityId, isValid: true },
      orderBy: { signatureDate: 'desc' },
    });

    if (!signature) {
      return { isSigned: false, isValid: false };
    }

    const currentHash = crypto
      .createHash('sha256')
      .update(currentContent)
      .digest('hex');

    const isValid = currentHash === signature.hashSignature;

    return {
      isSigned: true,
      isValid,
      signedAt: signature.signatureDate,
      signedBy: signature.signerId,
    };
  }
}
