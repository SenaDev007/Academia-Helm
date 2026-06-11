/**
 * ============================================================================
 * FEE REGIME SERVICE - GESTION DES RÉGIMES TARIFAIRES
 * ============================================================================
 * 
 * Service pour gérer les régimes tarifaires (STANDARD, ENFANT_ENSEIGNANT, REDUCTION)
 * et leurs règles de réduction
 * 
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class FeeRegimeService {
  private readonly logger = new Logger(FeeRegimeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée un régime tarifaire
   */
  async createRegime(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    code: string; // STANDARD | ENFANT_ENSEIGNANT | REDUCTION
    label: string;
    description?: string;
    isDefault?: boolean;
  }) {
    // Vérifier l'unicité
    const existing = await this.prisma.feeRegime.findUnique({
      where: {
        tenantId_academicYearId_schoolLevelId_code: {
          tenantId: data.tenantId,
          academicYearId: data.academicYearId,
          schoolLevelId: data.schoolLevelId,
          code: data.code,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Un régime avec le code ${data.code} existe déjà pour ce niveau et cette année`,
      );
    }

    // Si c'est le régime par défaut, désactiver les autres
    if (data.isDefault) {
      await this.prisma.feeRegime.updateMany({
        where: {
          tenantId: data.tenantId,
          academicYearId: data.academicYearId,
          schoolLevelId: data.schoolLevelId,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    return this.prisma.feeRegime.create({
      data,
    });
  }

  /**
   * Récupère tous les régimes d'un niveau pour une année
   */
  async getRegimes(
    tenantId: string,
    academicYearId: string,
    schoolLevelId: string,
  ) {
    return this.prisma.feeRegime.findMany({
      where: {
        tenantId,
        academicYearId,
        schoolLevelId,
      },
      include: {
        rules: true,
      },
      orderBy: [
        { isDefault: 'desc' },
        { code: 'asc' },
      ],
    });
  }

  /**
   * Récupère un régime par ID
   */
  async getRegimeById(id: string) {
    const regime = await this.prisma.feeRegime.findUnique({
      where: { id },
      include: {
        rules: true,
        academicYear: true,
        schoolLevel: true,
      },
    });

    if (!regime) {
      throw new NotFoundException(`Régime tarifaire ${id} non trouvé`);
    }

    return regime;
  }

  /**
   * Ajoute une règle de réduction à un régime
   */
  async addRule(
    feeRegimeId: string,
    data: {
      feeType: string; // INSCRIPTION | REINSCRIPTION | SCOLARITE
      discountType: string; // FIXED | PERCENT
      discountValue: number;
    },
  ) {
    // Vérifier que le régime existe
    await this.getRegimeById(feeRegimeId);

    // Vérifier l'unicité
    const existing = await this.prisma.feeRegimeRule.findUnique({
      where: {
        feeRegimeId_feeType: {
          feeRegimeId,
          feeType: data.feeType,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Une règle pour ${data.feeType} existe déjà pour ce régime`,
      );
    }

    return this.prisma.feeRegimeRule.create({
      data: {
        feeRegimeId,
        ...data,
        discountValue: new Prisma.Decimal(data.discountValue),
      },
    });
  }

  /**
   * Calcule le montant après réduction selon le régime
   */
  async calculateDiscountedAmount(
    feeRegimeId: string,
    feeType: string,
    originalAmount: Prisma.Decimal,
  ): Promise<Prisma.Decimal> {
    const regime = await this.getRegimeById(feeRegimeId);
    const rule = regime.rules.find((r) => r.feeType === feeType);

    if (!rule) {
      // Pas de réduction pour ce type de frais
      return originalAmount;
    }

    if (rule.discountType === 'FIXED') {
      // Réduction fixe
      const discounted = originalAmount.minus(rule.discountValue);
      return discounted.greaterThan(0) ? discounted : new Prisma.Decimal(0);
    } else if (rule.discountType === 'PERCENT') {
      // Réduction en pourcentage
      const discountAmount = originalAmount
        .times(rule.discountValue)
        .dividedBy(100);
      return originalAmount.minus(discountAmount);
    }

    return originalAmount;
  }

  /**
   * Met à jour un régime
   */
  async updateRegime(
    id: string,
    data: {
      label?: string;
      description?: string;
      isDefault?: boolean;
    },
  ) {
    await this.getRegimeById(id);

    // Si on définit comme défaut, désactiver les autres
    if (data.isDefault) {
      const regime = await this.prisma.feeRegime.findUnique({
        where: { id },
      });

      await this.prisma.feeRegime.updateMany({
        where: {
          tenantId: regime.tenantId,
          academicYearId: regime.academicYearId,
          schoolLevelId: regime.schoolLevelId,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    return this.prisma.feeRegime.update({
      where: { id },
      data,
    });
  }

  /**
   * Supprime un régime (seulement s'il n'est pas utilisé)
   */
  async deleteRegime(id: string) {
    await this.getRegimeById(id);

    // Vérifier qu'aucun profil n'utilise ce régime
    const profiles = await this.prisma.studentFeeProfile.findFirst({
      where: { feeRegimeId: id },
    });

    if (profiles) {
      throw new BadRequestException(
        'Ce régime est utilisé par des profils élèves et ne peut pas être supprimé',
      );
    }

    // Supprimer les règles d'abord
    await this.prisma.feeRegimeRule.deleteMany({
      where: { feeRegimeId: id },
    });

    return this.prisma.feeRegime.delete({
      where: { id },
    });
  }
}

