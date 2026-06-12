import { prismaCreateDefaults, prismaCreateNoUpdatedAt, prismaUpdateDefaults } from '../../common/utils/prisma-helpers';
/**
 * ============================================================================
 * ELECTRONIC SIGNATURES SERVICE
 * ============================================================================
 * 
 * Service pour la gestion des signatures électroniques certifiées
 * - Création et gestion de signatures
 * - Génération de hash cryptographique
 * - Vérification d'intégrité
 * - QR Code de vérification publique
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettingsHistoryService } from './settings-history.service';
import * as crypto from 'crypto';

@Injectable()
export class ElectronicSignaturesService {
  private readonly logger = new Logger(ElectronicSignaturesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: SettingsHistoryService,
  ) {}

  /**
   * Liste toutes les signatures d'un utilisateur
   */
  async getUserSignatures(tenantId: string, userId: string) {
    return this.prisma.certifiedElectronicSignature.findMany({
      where: {
        tenantId,
        userId,
        status: 'active',
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  /**
   * Récupère une signature par ID
   */
  async getSignatureById(tenantId: string, signatureId: string) {
    const signature = await this.prisma.certifiedElectronicSignature.findFirst({
      where: {
        id: signatureId,
        tenantId,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        signedDocuments: {
          orderBy: { signedAt: 'desc' },
          take: 10, // Derniers documents signés
        },
      },
    });

    if (!signature) {
      throw new NotFoundException('Signature non trouvée');
    }

    return signature;
  }

  /**
   * Crée une nouvelle signature électronique
   */
  async createSignature(
    tenantId: string,
    userId: string,
    data: {
      role: string;
      signatureType: 'visual' | 'certified' | 'combined';
      signatureImageUrl?: string;
      expiresAt?: Date;
    },
  ) {
    // Vérifier que l'utilisateur existe
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Générer le hash cryptographique
    const signatureData = {
      userId,
      role: data.role,
      signatureType: data.signatureType,
      timestamp: new Date().toISOString(),
      tenantId,
    };

    const certificateHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(signatureData))
      .digest('hex');

    // Créer la signature
    const signature = await this.prisma.certifiedElectronicSignature.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        userId,
        role: data.role,
        signatureType: data.signatureType,
        signatureImageUrl: data.signatureImageUrl,
        certificateHash,
        issuedAt: new Date(),
        expiresAt: data.expiresAt,
        status: 'active',
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    this.logger.log(`Signature électronique créée: ${signature.id} pour ${userId}`);

    return signature;
  }

  /**
   * Signe un document électroniquement
   */
  async signDocument(
    tenantId: string,
    data: {
      documentType: string;
      documentId: string;
      signatureId: string;
      documentContent: any; // Contenu du document pour générer le hash
    },
    userId: string,
  ) {
    // Vérifier que la signature existe et est valide
    const signature = await this.getSignatureById(tenantId, data.signatureId);

    if (signature.status !== 'active') {
      throw new BadRequestException('La signature n\'est pas active');
    }

    if (signature.userId !== userId) {
      throw new BadRequestException('Vous ne pouvez pas utiliser cette signature');
    }

    // Vérifier l'expiration
    if (signature.expiresAt && new Date() > signature.expiresAt) {
      throw new BadRequestException('La signature a expiré');
    }

    // Générer le hash du document
    const documentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(data.documentContent))
      .digest('hex');

    // Générer un token de vérification unique
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Créer l'enregistrement de signature
    const signedDocument = await this.prisma.signedDocument.create({
      data: {
        ...prismaCreateNoUpdatedAt(),
        tenantId,
        documentType: data.documentType,
        documentId: data.documentId,
        documentHash,
        signatureId: data.signatureId,
        signedBy: userId,
        signedAt: new Date(),
        verificationToken,
      },
      include: {
        signature: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        signer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    this.logger.log(`Document signé: ${data.documentType}/${data.documentId} avec signature ${data.signatureId}`);

    return {
      ...signedDocument,
      verificationUrl: `/verify/${verificationToken}`,
    };
  }

  /**
   * Vérifie un document signé via le token public
   */
  async verifyDocument(verificationToken: string) {
    const signedDocument = await this.prisma.signedDocument.findUnique({
      where: { verificationToken },
      include: {
        signature: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        signer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        tenant: {
          select: { id: true, name: true },
        },
      },
    });

    if (!signedDocument) {
      throw new NotFoundException('Document non trouvé');
    }

    // Vérifier que la signature est toujours valide
    const signature = signedDocument.signature;
    let isValid = true;
    const reasons: string[] = [];

    if (signature.status !== 'active') {
      isValid = false;
      reasons.push('La signature n\'est plus active');
    }

    if (signature.expiresAt && new Date() > signature.expiresAt) {
      isValid = false;
      reasons.push('La signature a expiré');
    }

    return {
      isValid,
      reasons,
      document: {
        type: signedDocument.documentType,
        id: signedDocument.documentId,
        signedAt: signedDocument.signedAt,
        documentHash: signedDocument.documentHash,
      },
      signature: {
        id: signature.id,
        type: signature.signatureType,
        role: signature.role,
        issuedAt: signature.issuedAt,
        user: signature.user,
      },
      signer: signedDocument.signer,
      tenant: signedDocument.tenant,
    };
  }

  /**
   * Révoque une signature
   */
  async revokeSignature(tenantId: string, signatureId: string, userId: string) {
    const signature = await this.getSignatureById(tenantId, signatureId);

    if (signature.userId !== userId) {
      throw new BadRequestException('Vous ne pouvez pas révoquer cette signature');
    }

    const updated = await this.prisma.certifiedElectronicSignature.update({
      where: { id: signatureId },
      data: { ...prismaUpdateDefaults(), status: 'revoked' },
    });

    this.logger.log(`Signature révoquée: ${signatureId} par ${userId}`);

    return updated;
  }

  /**
   * Récupère l'historique des documents signés
   */
  async getSignedDocumentsHistory(
    tenantId: string,
    filters?: {
      signatureId?: string;
      documentType?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    const where: any = { tenantId };

    if (filters?.signatureId) where.signatureId = filters.signatureId;
    if (filters?.documentType) where.documentType = filters.documentType;
    if (filters?.startDate) where.signedAt = { gte: filters.startDate };
    if (filters?.endDate) {
      where.signedAt = { ...where.signedAt, lte: filters.endDate };
    }

    return this.prisma.signedDocument.findMany({
      where,
      include: {
        signature: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        signer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { signedAt: 'desc' },
    });
  }
}
