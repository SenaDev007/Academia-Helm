import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as crypto from 'crypto';

/**
 * Service pour la gestion des signatures électroniques
 */
@Injectable()
export class ElectronicSignatureService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Signe électroniquement un compte rendu
   */
  async sign(
    minutesId: string,
    tenantId: string,
    userId: string,
    signatureType: string = 'VALIDATION',
    signatureData?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Vérifier que le compte rendu appartient au tenant
    const minutes = await this.prisma.meetingMinutes.findFirst({
      where: {
        id: minutesId,
        meeting: {
          tenantId,
        },
      },
      include: {
        meeting: true,
      },
    });

    if (!minutes) {
      throw new NotFoundException(`Minutes with ID ${minutesId} not found`);
    }

    // Vérifier que le compte rendu est validé (pour signature de validation)
    if (signatureType === 'VALIDATION' && !minutes.validated) {
      throw new BadRequestException('Cannot sign an unvalidated minutes document');
    }

    // Vérifier si l'utilisateur a déjà signé ce type de signature
    const existing = await this.prisma.electronicSignature.findUnique({
      where: {
        minutesId_userId_signatureType: {
          minutesId,
          userId,
          signatureType,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `User has already signed this document with signature type ${signatureType}`,
      );
    }

    // Générer le hash de la signature
    const signatureContent = `${minutesId}-${userId}-${signatureType}-${new Date().toISOString()}-${minutes.content}`;
    const signatureHash = crypto.createHash('sha256').update(signatureContent).digest('hex');

    // Créer la signature
    const signature = await this.prisma.electronicSignature.create({
      data: {
        minutesId,
        userId,
        signatureType,
        signatureHash,
        signatureData: signatureData || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        signedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        minutes: {
          include: {
            meeting: {
              select: {
                id: true,
                title: true,
                meetingDate: true,
              },
            },
          },
        },
      },
    });

    return signature;
  }

  /**
   * Vérifie l'intégrité d'une signature
   */
  async verifySignature(signatureId: string, tenantId: string): Promise<boolean> {
    const signature = await this.prisma.electronicSignature.findFirst({
      where: {
        id: signatureId,
        minutes: {
          meeting: {
            tenantId,
          },
        },
      },
      include: {
        minutes: true,
        user: true,
      },
    });

    if (!signature) {
      throw new NotFoundException(`Signature with ID ${signatureId} not found`);
    }

    // Recalculer le hash et comparer
    const signatureContent = `${signature.minutesId}-${signature.userId}-${signature.signatureType}-${signature.signedAt.toISOString()}-${signature.minutes.content}`;
    const expectedHash = crypto.createHash('sha256').update(signatureContent).digest('hex');

    return signature.signatureHash === expectedHash;
  }

  /**
   * Récupère toutes les signatures d'un compte rendu
   */
  async getSignatures(minutesId: string, tenantId: string) {
    // Vérifier que le compte rendu appartient au tenant
    const minutes = await this.prisma.meetingMinutes.findFirst({
      where: {
        id: minutesId,
        meeting: {
          tenantId,
        },
      },
    });

    if (!minutes) {
      throw new NotFoundException(`Minutes with ID ${minutesId} not found`);
    }

    return this.prisma.electronicSignature.findMany({
      where: { minutesId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { signedAt: 'asc' },
    });
  }

  /**
   * Récupère les statistiques de signatures
   */
  async getSignatureStats(tenantId: string, academicYearId?: string) {
    const where: any = {
      minutes: {
        meeting: {
          tenantId,
        },
      },
    };

    if (academicYearId) {
      where.minutes.meeting.academicYearId = academicYearId;
    }

    const signatures = await this.prisma.electronicSignature.findMany({
      where,
      include: {
        minutes: {
          include: {
            meeting: {
              select: {
                academicYearId: true,
              },
            },
          },
        },
      },
    });

    const total = signatures.length;
    const byType = signatures.reduce((acc, sig) => {
      acc[sig.signatureType] = (acc[sig.signatureType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      byType,
      signaturesPerMonth: this.groupByMonth(signatures),
    };
  }

  /**
   * Groupe les signatures par mois
   */
  private groupByMonth(signatures: any[]): Record<string, number> {
    return signatures.reduce((acc, sig) => {
      const month = new Date(sig.signedAt).toISOString().substring(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

