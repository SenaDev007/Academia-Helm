import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettingsHistoryService } from './settings-history.service';

/**
 * Service pour la gestion de la structure pédagogique
 * (niveaux, cycles, séries)
 */
@Injectable()
export class PedagogicalStructureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: SettingsHistoryService,
  ) {}

  /**
   * Récupère la configuration de la structure pédagogique
   */
  async getStructure(tenantId: string) {
    let structure = await this.prisma.settingsPedagogicalStructure.findUnique({
      where: { tenantId },
    });

    if (!structure) {
      structure = await this.prisma.settingsPedagogicalStructure.create({
        data: {
          tenantId,
          maternelleEnabled: false,
          primaireEnabled: true,
          secondaireEnabled: true,
          activeSeries: ['A', 'C', 'D'],
          allowLevelModification: true,
        },
      });
    }

    return structure;
  }

  /**
   * Met à jour la structure pédagogique
   */
  async updateStructure(
    tenantId: string,
    data: {
      maternelleEnabled?: boolean;
      primaireEnabled?: boolean;
      secondaireEnabled?: boolean;
      cyclesConfiguration?: any;
      activeSeries?: string[];
      allowLevelModification?: boolean;
    },
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await this.getStructure(tenantId);

    // Vérifier si des données existent avant de désactiver un niveau
    if (data.maternelleEnabled === false && existing.maternelleEnabled) {
      await this.checkLevelDependencies(tenantId, 'MATERNELLE');
    }
    if (data.primaireEnabled === false && existing.primaireEnabled) {
      await this.checkLevelDependencies(tenantId, 'PRIMAIRE');
    }
    if (data.secondaireEnabled === false && existing.secondaireEnabled) {
      await this.checkLevelDependencies(tenantId, 'SECONDAIRE');
    }

    const changes: Record<string, { old: any; new: any }> = {};
    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined && JSON.stringify(existing[key]) !== JSON.stringify(data[key])) {
        changes[key] = { old: existing[key], new: data[key] };
      }
    });

    if (Object.keys(changes).length === 0) {
      return existing;
    }

    const updated = await this.prisma.settingsPedagogicalStructure.update({
      where: { tenantId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    await this.historyService.logSettingChange(
      tenantId,
      null,
      'settings_pedagogical_structure',
      'pedagogical',
      changes,
      userId,
      ipAddress,
      userAgent,
    );

    return updated;
  }

  /**
   * Vérifie si un niveau a des données dépendantes
   */
  private async checkLevelDependencies(tenantId: string, levelType: string) {
    const levels = await this.prisma.schoolLevel.findMany({
      where: {
        tenantId,
        code: {
          startsWith: levelType === 'MATERNELLE' ? 'MAT' :
                      levelType === 'PRIMAIRE' ? 'PRI' : 'SEC',
        },
      },
      include: {
        _count: {
          select: {
            students: true,
            classes: true,
          },
        },
      },
    });

    const hasData = levels.some(
      (level) => level._count.students > 0 || level._count.classes > 0,
    );

    if (hasData) {
      throw new BadRequestException(
        `Impossible de désactiver le niveau ${levelType} : des données existent (élèves ou classes).`,
      );
    }
  }

  /**
   * Récupère les niveaux scolaires configurés
   */
  async getLevels(tenantId: string) {
    return this.prisma.schoolLevel.findMany({
      where: { tenantId },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Récupère les séries/filières configurées
   */
  async getTracks(tenantId: string) {
    return this.prisma.academicTrack.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }
}
