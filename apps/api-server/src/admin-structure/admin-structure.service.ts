import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/**
 * ============================================================================
 * AdminStructureService — Résolution du mode d'administration scolaire
 * ============================================================================
 *
 * Centralise la logique de résolution des unités administratives selon le
 * mode configuré par le tenant :
 *
 *   - SEPARATE : chaque niveau (maternelle, primaire, secondaire) a sa propre
 *                administration. Un directeur de la maternelle ne gère QUE
 *                la maternelle.
 *
 *   - FUSED_MATERNELLE_PRIMAIRE : l'administration de la maternelle et du
 *                primaire est FUSIONNÉE (même directeur, même secrétaire,
 *                même secrétaire comptable). Le secondaire reste SÉPARÉ
 *                avec sa propre administration.
 *
 * Le secondaire est TOUJOURS à part, quel que soit le mode.
 *
 * Méthodes clés :
 *   - getMode(tenantId) → 'SEPARATE' | 'FUSED_MATERNELLE_PRIMAIRE'
 *   - setMode(tenantId, mode) → met à jour SchoolSettings
 *   - getAdminGroups(tenantId) → unités administratives avec leurs niveaux
 *   - resolveAdminLevelsForUser(currentLevelId) → niveaux conjoints
 *   - areLevelsFused(tenantId, levelA, levelB) → true si MAT+PRI en mode FUSED
 * ============================================================================
 */

export type AdminStructureMode = 'SEPARATE' | 'FUSED_MATERNELLE_PRIMAIRE';

export interface AdminGroup {
  /** Code de l'unité administrative : MAT, PRI, SEC, MAT_PRI, ALL */
  unit: string;
  /** Libellé affichable : "Maternelle", "Primaire", "Maternelle + Primaire" */
  label: string;
  /** IDs des SchoolLevel regroupés dans cette unité */
  levelIds: string[];
  /** Codes des SchoolLevel regroupés (MATERNELLE, PRIMARY, SECONDAIRE) */
  levelCodes: string[];
}

const VALID_MODES: AdminStructureMode[] = ['SEPARATE', 'FUSED_MATERNELLE_PRIMAIRE'];

// Codes de niveaux (constantes pour éviter les typos)
const MAT = 'MATERNELLE';
const PRI = 'PRIMARY';
const SEC = 'SECONDAIRE';

const UNIT_LABELS: Record<string, string> = {
  MAT: 'Maternelle',
  PRI: 'Primaire',
  SEC: 'Secondaire',
  MAT_PRI: 'Maternelle + Primaire',
  ALL: 'Tous les niveaux',
};

@Injectable()
export class AdminStructureService {
  private readonly logger = new Logger(AdminStructureService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère le mode d'administration d'un tenant.
   * Par défaut SEPARATE si SchoolSettings n'existe pas ou champ vide.
   */
  async getMode(tenantId: string): Promise<AdminStructureMode> {
    try {
      const settings = await this.prisma.schoolSettings.findUnique({
        where: { tenantId },
        select: { adminStructureMode: true },
      });
      const mode = (settings?.adminStructureMode as AdminStructureMode) || 'SEPARATE';
      return VALID_MODES.includes(mode) ? mode : 'SEPARATE';
    } catch (err: any) {
      this.logger.warn(`getMode failed for tenant ${tenantId}: ${err.message}`);
      return 'SEPARATE';
    }
  }

  /**
   * Met à jour le mode d'administration.
   */
  async setMode(tenantId: string, mode: AdminStructureMode): Promise<void> {
    if (!VALID_MODES.includes(mode)) {
      throw new Error(`Mode invalide : ${mode}. Valeurs acceptées : ${VALID_MODES.join(', ')}`);
    }

    // Upsert SchoolSettings (peut ne pas exister encore)
    const existing = await this.prisma.schoolSettings.findUnique({
      where: { tenantId },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.schoolSettings.update({
        where: { tenantId },
        data: { adminStructureMode: mode },
      });
    } else {
      // Créer avec valeurs par défaut minimales
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
      await this.prisma.schoolSettings.create({
        data: {
          tenantId,
          schoolName: tenant?.name || 'Établissement',
          adminStructureMode: mode,
        },
      });
    }

    this.logger.log(`Admin structure mode set to ${mode} for tenant ${tenantId}`);
  }

  /**
   * Récupère les unités administratives d'un tenant selon son mode.
   *
   * - Mode SEPARATE : 3 unités séparées (MAT, PRI, SEC)
   * - Mode FUSED_MATERNELLE_PRIMAIRE : 2 unités (MAT_PRI, SEC)
   *
   * Le secondaire est TOUJOURS une unité distincte.
   */
  async getAdminGroups(tenantId: string): Promise<AdminGroup[]> {
    const mode = await this.getMode(tenantId);

    // Récupérer les niveaux actifs du tenant
    const levels = await this.prisma.schoolLevel.findMany({
      where: { tenantId, isActive: true },
      orderBy: { order: 'asc' },
      select: { id: true, code: true, name: true, label: true },
    });

    if (levels.length === 0) {
      return [];
    }

    const findByCode = (code: string) => levels.find((l) => l.code === code);
    const mat = findByCode(MAT);
    const pri = findByCode(PRI);
    const sec = findByCode(SEC);

    const groups: AdminGroup[] = [];

    if (mode === 'FUSED_MATERNELLE_PRIMAIRE' && mat && pri) {
      // Maternelle + Primaire fusionnés
      groups.push({
        unit: 'MAT_PRI',
        label: UNIT_LABELS.MAT_PRI,
        levelIds: [mat.id, pri.id],
        levelCodes: [MAT, PRI],
      });
    } else {
      // Mode SEPARATE (ou FUSED mais un des 2 niveaux manquant)
      if (mat) {
        groups.push({
          unit: 'MAT',
          label: UNIT_LABELS.MAT,
          levelIds: [mat.id],
          levelCodes: [MAT],
        });
      }
      if (pri) {
        groups.push({
          unit: 'PRI',
          label: UNIT_LABELS.PRI,
          levelIds: [pri.id],
          levelCodes: [PRI],
        });
      }
    }

    // Secondaire toujours séparé
    if (sec) {
      groups.push({
        unit: 'SEC',
        label: UNIT_LABELS.SEC,
        levelIds: [sec.id],
        levelCodes: [SEC],
      });
    }

    return groups;
  }

  /**
   * Détermine si deux niveaux sont fusionnés administrativement.
   * En mode FUSED_MATERNELLE_PRIMAIRE : MATERNELLE et PRIMARY sont fusionnés.
   * Le secondaire n'est jamais fusionné avec un autre niveau.
   */
  async areLevelsFused(
    tenantId: string,
    levelCodeA: string,
    levelCodeB: string,
  ): Promise<boolean> {
    const mode = await this.getMode(tenantId);
    if (mode !== 'FUSED_MATERNELLE_PRIMAIRE') return false;

    const pair = new Set([levelCodeA, levelCodeB]);
    return pair.has(MAT) && pair.has(PRI);
  }

  /**
   * Résout les niveaux administrés conjointement à partir d'un niveau donné.
   *
   * Exemple en mode FUSED_MATERNELLE_PRIMAIRE :
   *   - resolveAdminLevelsForUser(tenantId, 'MATERNELLE') → ['MATERNELLE', 'PRIMARY']
   *   - resolveAdminLevelsForUser(tenantId, 'PRIMARY') → ['MATERNELLE', 'PRIMARY']
   *   - resolveAdminLevelsForUser(tenantId, 'SECONDAIRE') → ['SECONDAIRE']
   *
   * Utile pour les guards backend : si un utilisateur a un rôle level-specific
   * sur la maternelle, il peut aussi accéder au primaire en mode FUSED.
   *
   * @param currentLevelCode Code du niveau actif (MATERNELLE, PRIMARY, SECONDAIRE)
   * @returns Liste des codes de niveaux que l'utilisateur peut administrer
   */
  async resolveAdminLevelsForUser(
    tenantId: string,
    currentLevelCode: string,
  ): Promise<string[]> {
    const mode = await this.getMode(tenantId);

    if (mode === 'FUSED_MATERNELLE_PRIMAIRE') {
      if (currentLevelCode === MAT || currentLevelCode === PRI) {
        return [MAT, PRI];
      }
    }

    // Par défaut : juste le niveau demandé
    return [currentLevelCode];
  }

  /**
   * Vérifie si un niveau fait partie d'une unité administrative donnée.
   */
  isLevelInUnit(levelCode: string, unit: string): boolean {
    if (unit === 'ALL') return true;
    if (unit === 'MAT_PRI') return levelCode === MAT || levelCode === PRI;
    if (unit === 'MAT') return levelCode === MAT;
    if (unit === 'PRI') return levelCode === PRI;
    if (unit === 'SEC') return levelCode === SEC;
    return false;
  }

  /**
   * Récupère le libellé affichable d'une unité administrative.
   */
  getUnitLabel(unit: string): string {
    return UNIT_LABELS[unit] || unit;
  }
}
