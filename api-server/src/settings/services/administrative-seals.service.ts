import { prismaCreateDefaults, prismaCreateIdOnly, prismaCreateNoUpdatedAt, prismaUpdateDefaults } from '../../common/utils/prisma-helpers';
/**
 * ============================================================================
 * ADMINISTRATIVE SEALS SERVICE
 * ============================================================================
 * 
 * Service pour la gestion des cachets administratifs
 * - Création, modification, désactivation de cachets
 * - Versionnement automatique
 * - Validation des rôles et permissions
 * - Génération SVG/PDF server-side
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettingsHistoryService } from './settings-history.service';
import { SealGenerationService } from './seal-generation.service';
import { OrionAlertsService } from '../../orion/services/orion-alerts.service';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class AdministrativeSealsService {
  private readonly logger = new Logger(AdministrativeSealsService.name);
  private readonly sealsDir = path.join(process.cwd(), 'uploads', 'seals');

  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: SettingsHistoryService,
    private readonly sealGenerationService: SealGenerationService,
    private readonly orionAlertsService?: OrionAlertsService,
  ) {
    this.ensureSealsDirectory();
  }

  private async ensureSealsDirectory() {
    try {
      await fs.mkdir(this.sealsDir, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create seals directory: ${error}`);
    }
  }

  /**
   * Liste tous les cachets d'un tenant
   */
  async getAllSeals(
    tenantId: string,
    filters?: {
      schoolId?: string;
      academicYearId?: string;
      type?: string;
      isActive?: boolean;
    },
  ) {
    const where: any = { tenantId };

    if (filters?.schoolId) where.schoolId = filters.schoolId;
    if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters?.type) where.type = filters.type;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    return this.prisma.administrativeSeal.findMany({
      where,
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1, // Dernière version
        },
        school: {
          select: { id: true, name: true },
        },
        academicYear: {
          select: { id: true, name: true, label: true },
        },
        _count: {
          select: {
            versions: true,
            // usages n'est pas une relation directe, c'est via versions -> AdministrativeSealUsage
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Récupère un cachet par ID
   */
  async getSealById(tenantId: string, sealId: string) {
    const seal = await this.prisma.administrativeSeal.findFirst({
      where: {
        id: sealId,
        tenantId,
      },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
        school: true,
        academicYear: true,
        tenant: {
          select: { id: true, name: true },
        },
      },
    });

    if (!seal) {
      throw new NotFoundException('Cachet non trouvé');
    }

    return seal;
  }

  /**
   * Crée un nouveau cachet
   */
  async createSeal(
    tenantId: string,
    data: {
      schoolId: string;
      academicYearId: string;
      type: 'INSTITUTIONAL' | 'NOMINATIVE' | 'TRANSACTIONAL';
      label: string;
      role?: string;
      holderName?: string;
      holderTitle?: string;
      validFrom?: Date;
      validTo?: Date;
    },
    userId: string,
  ) {
    // Vérifier que l'année scolaire existe et est active
    const academicYear = await this.prisma.academicYear.findFirst({
      where: {
        id: data.academicYearId,
        tenantId,
      },
    });

    if (!academicYear) {
      throw new NotFoundException('Année scolaire non trouvée');
    }

    // Créer le cachet
    const seal = await this.prisma.administrativeSeal.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        schoolId: data.schoolId,
        academicYearId: data.academicYearId,
        type: data.type,
        label: data.label,
        role: data.role,
        holderName: data.holderName,
        holderTitle: data.holderTitle,
        isActive: true,
        validFrom: data.validFrom,
        validTo: data.validTo,
      },
      include: {
        school: true,
        academicYear: true,
      },
    });

    // Enregistrer dans l'historique
    await this.historyService.logSettingChange(
      tenantId,
      seal.id,
      'administrative_seal',
      'administrative_seals',
      { created: { old: null, new: seal } },
      userId,
    );

    this.logger.log(`Cachet créé: ${seal.id} par ${userId}`);

    return seal;
  }

  /**
   * Met à jour un cachet
   */
  async updateSeal(
    tenantId: string,
    sealId: string,
    data: {
      label?: string;
      role?: string;
      holderName?: string;
      holderTitle?: string;
      isActive?: boolean;
      validFrom?: Date;
      validTo?: Date;
    },
    userId: string,
  ) {
    const existingSeal = await this.getSealById(tenantId, sealId);
    const oldData = { ...existingSeal };

    const updatedSeal = await this.prisma.administrativeSeal.update({
      where: { id: sealId },
      data,
      include: {
        school: true,
        academicYear: true,
      },
    });

    // Enregistrer dans l'historique
    const changes: Record<string, { old: any; new: any }> = {};
    Object.keys(data).forEach((key) => {
      if (oldData[key] !== updatedSeal[key]) {
        changes[key] = { old: oldData[key], new: updatedSeal[key] };
      }
    });

    if (Object.keys(changes).length > 0) {
      await this.historyService.logSettingChange(
        tenantId,
        sealId,
        'administrative_seal',
        'administrative_seals',
        changes,
        userId,
      );
    }

    this.logger.log(`Cachet mis à jour: ${sealId} par ${userId}`);

    return updatedSeal;
  }

  /**
   * Crée une nouvelle version d'un cachet
   */
  async createSealVersion(
    tenantId: string,
    sealId: string,
    data: {
      format: 'SVG' | 'PNG' | 'PDF';
      primaryColor?: string;
      secondaryColor?: string;
      shape: 'ROUND' | 'OVAL' | 'RECTANGULAR';
      logoUrl?: string;
      signatureUrl?: string;
      textLayout?: any;
      fontFamily?: string;
      fontWeight?: string;
      fontSize?: any;
      borderStyle?: string;
      borderThickness?: number;
      innerSymbols?: any;
      rotation?: number;
      opacity?: number;
    },
    userId: string,
  ) {
    const seal = await this.getSealById(tenantId, sealId);

    // Vérifier que le cachet est actif
    if (!seal.isActive) {
      throw new BadRequestException('Impossible de créer une version pour un cachet inactif');
    }

    // Vérifier la validité temporelle
    const now = new Date();
    if (seal.validFrom && now < seal.validFrom) {
      throw new BadRequestException('Le cachet n\'est pas encore valide');
    }
    if (seal.validTo && now > seal.validTo) {
      throw new BadRequestException('Le cachet a expiré');
    }

    // Compter les versions existantes
    const versionCount = await this.prisma.administrativeSealVersion.count({
      where: { sealId },
    });

    const versionNumber = versionCount + 1;

    // Générer le fichier (simplifié - à implémenter avec génération SVG/PDF réelle)
    const generatedFileUrl = await this.generateSealFile(seal, data, versionNumber);

    // Créer la version
    const version = await this.prisma.administrativeSealVersion.create({
      data: {
        ...prismaCreateNoUpdatedAt(),
        sealId,
        format: data.format,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        shape: data.shape,
        logoUrl: data.logoUrl,
        signatureUrl: data.signatureUrl,
        textLayout: data.textLayout,
        fontFamily: data.fontFamily,
        fontWeight: data.fontWeight,
        fontSize: data.fontSize,
        borderStyle: data.borderStyle,
        borderThickness: data.borderThickness,
        innerSymbols: data.innerSymbols,
        rotation: data.rotation || 0,
        opacity: data.opacity || 100,
        generatedFileUrl,
        versionNumber,
        createdBy: userId,
      },
      include: {
        seal: true,
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    this.logger.log(`Version de cachet créée: ${version.id} pour ${sealId}`);

    return version;
  }

  /**
   * Génère le fichier du cachet (SVG/PNG/PDF)
   */
  private async generateSealFile(
    seal: any,
    versionData: any,
    versionNumber: number,
  ): Promise<string> {
    // Créer le répertoire pour ce cachet
    const sealDir = path.join(this.sealsDir, seal.id);
    await fs.mkdir(sealDir, { recursive: true });

    // Générer un nom de fichier
    const fileName = `seal-v${versionNumber}`;

    // Générer le fichier via le service de génération
    const filePath = await this.sealGenerationService.generateSealFile(
      seal,
      versionData,
      sealDir,
      fileName,
    );

    // Retourner l'URL publique
    return this.sealGenerationService.getSealPublicUrl(seal.id, versionNumber, versionData.format);
  }

  /**
   * Enregistre l'utilisation d'un cachet
   */
  async recordSealUsage(
    tenantId: string,
    data: {
      sealVersionId: string;
      documentType: string;
      documentId: string;
      schoolId: string;
      academicYearId: string;
    },
    userId: string,
  ) {
    // Vérifier que la version existe et est valide
    const version = await this.prisma.administrativeSealVersion.findFirst({
      where: {
        id: data.sealVersionId,
        seal: {
          tenantId,
          isActive: true,
        },
      },
      include: {
        seal: true,
      },
    });

    if (!version) {
      throw new NotFoundException('Version de cachet non trouvée ou inactive');
    }

    // Vérifier la validité temporelle
    const now = new Date();
    if (version.seal.validFrom && now < version.seal.validFrom) {
      throw new BadRequestException('Le cachet n\'est pas encore valide');
    }
    if (version.seal.validTo && now > version.seal.validTo) {
      throw new BadRequestException('Le cachet a expiré');
    }

    // Vérifier le rôle si spécifié
    if (version.seal.role) {
      // TODO: Vérifier que l'utilisateur a le bon rôle
      // const user = await this.prisma.user.findUnique({ where: { id: userId } });
      // if (user.role !== version.seal.role) {
      //   throw new BadRequestException('Rôle insuffisant pour utiliser ce cachet');
      // }
    }

    // Enregistrer l'utilisation
    const usage = await this.prisma.administrativeSealUsage.create({
      data: {
        ...prismaCreateIdOnly(),
        sealVersionId: data.sealVersionId,
        documentType: data.documentType,
        documentId: data.documentId,
        usedBy: userId,
        schoolId: data.schoolId,
        academicYearId: data.academicYearId,
      },
      include: {
        sealVersion: {
          include: { seal: true },
        },
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    this.logger.log(`Utilisation de cachet enregistrée: ${usage.id}`);

    // Vérifier les alertes ORION
    await this.checkOrionAlerts(tenantId, usage);

    return usage;
  }

  /**
   * Vérifie et crée des alertes ORION pour les cachets
   */
  private async checkOrionAlerts(tenantId: string, usage: any) {
    try {
      const seal = usage.sealVersion.seal;
      const now = new Date();
      const alerts: any[] = [];

      // Alerte: Cachet expiré utilisé
      if (seal.validTo && now > seal.validTo) {
        alerts.push({
          tenantId,
          academicYearId: usage.academicYearId,
          alertType: 'OPERATIONAL',
          severity: 'CRITICAL',
          title: 'Cachet expiré utilisé',
          description: `Le cachet "${seal.label}" a été utilisé alors qu'il est expiré depuis le ${new Date(seal.validTo).toLocaleDateString('fr-FR')}`,
          metadata: {
            sealId: seal.id,
            sealLabel: seal.label,
            usageId: usage.id,
            documentType: usage.documentType,
            documentId: usage.documentId,
          },
        });
      }

      // Alerte: Cachet désactivé utilisé
      if (!seal.isActive) {
        alerts.push({
          tenantId,
          academicYearId: usage.academicYearId,
          alertType: 'OPERATIONAL',
          severity: 'CRITICAL',
          title: 'Cachet désactivé utilisé',
          description: `Le cachet "${seal.label}" a été utilisé alors qu'il est désactivé`,
          metadata: {
            sealId: seal.id,
            sealLabel: seal.label,
            usageId: usage.id,
            documentType: usage.documentType,
            documentId: usage.documentId,
          },
        });
      }

      // Alerte: Cachet utilisé hors période de validité
      if (seal.validFrom && now < seal.validFrom) {
        alerts.push({
          tenantId,
          academicYearId: usage.academicYearId,
          alertType: 'OPERATIONAL',
          severity: 'WARNING',
          title: 'Cachet utilisé avant sa date de validité',
          description: `Le cachet "${seal.label}" a été utilisé avant sa date de validité (${new Date(seal.validFrom).toLocaleDateString('fr-FR')})`,
          metadata: {
            sealId: seal.id,
            sealLabel: seal.label,
            usageId: usage.id,
            documentType: usage.documentType,
            documentId: usage.documentId,
          },
        });
      }

      // Créer les alertes ORION
      if (alerts.length > 0 && this.orionAlertsService) {
        for (const alertData of alerts) {
          await this.createOrionAlert(tenantId, alertData);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to check ORION alerts: ${error.message}`);
    }
  }

  /**
   * Crée une alerte ORION dans la base de données
   */
  private async createOrionAlert(tenantId: string, alertData: any) {
    try {
      await this.prisma.orionAlert.create({
        data: {
        ...prismaCreateDefaults(),
          tenantId,
          academicYearId: alertData.academicYearId || null,
          schoolLevelId: alertData.schoolLevelId || null,
          alertType: alertData.alertType || 'OPERATIONAL',
          severity: alertData.severity || 'WARNING',
          title: alertData.title,
          description: alertData.description,
          recommendation: alertData.recommendation || null,
          message: alertData.message || alertData.title,
          metadata: alertData.metadata ? JSON.parse(JSON.stringify(alertData.metadata)) : {},
        },
      });
      this.logger.log(`ORION alert created: ${alertData.title}`);
    } catch (error) {
      this.logger.error(`Failed to create ORION alert: ${error.message}`);
    }
  }

  /**
   * Récupère l'historique d'utilisation d'un cachet
   */
  async getSealUsageHistory(
    tenantId: string,
    sealId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      documentType?: string;
    },
  ) {
    const where: any = {
      sealVersion: {
        seal: {
          id: sealId,
          tenantId,
        },
      },
    };

    if (filters?.startDate) where.usedAt = { gte: filters.startDate };
    if (filters?.endDate) {
      where.usedAt = { ...where.usedAt, lte: filters.endDate };
    }
    if (filters?.documentType) where.documentType = filters.documentType;

    return this.prisma.administrativeSealUsage.findMany({
      where,
      include: {
        sealVersion: {
          include: { seal: true },
        },
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        school: {
          select: { id: true, name: true },
        },
        academicYear: {
          select: { id: true, name: true, label: true },
        },
      },
      orderBy: { usedAt: 'desc' },
    });
  }

  /**
   * Désactive un cachet
   */
  async deactivateSeal(tenantId: string, sealId: string, userId: string) {
    return this.updateSeal(tenantId, sealId, { isActive: false }, userId);
  }

  /**
   * Réactive un cachet
   */
  async activateSeal(tenantId: string, sealId: string, userId: string) {
    return this.updateSeal(tenantId, sealId, { isActive: true }, userId);
  }

  /**
   * Vérifie les cachets expirant dans les X prochains jours
   */
  async checkExpiringSeals(tenantId: string, days: number = 30) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + days);

    return this.prisma.administrativeSeal.findMany({
      where: {
        tenantId,
        isActive: true,
        validTo: {
          lte: expirationDate,
          gte: new Date(), // Pas encore expiré
        },
      },
      include: {
        academicYear: {
          select: { id: true, name: true, label: true },
        },
        versions: {
          take: 1,
          orderBy: { versionNumber: 'desc' },
        },
      },
    });
  }
}
