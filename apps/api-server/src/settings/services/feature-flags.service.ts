import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettingsHistoryService } from './settings-history.service';

/**
 * Codes des modules (feature flags) — gouvernance SaaS.
 * FEATURE_KEYS = uniquement les vrais modules de l'app (ordre sidebar / paramètres).
 */
export enum FeatureCode {
  STUDENTS = 'STUDENTS',
  PEDAGOGY = 'PEDAGOGY',
  EXAMS = 'EXAMS',
  FINANCE = 'FINANCE',
  HR_PAYROLL = 'HR_PAYROLL',
  COMMUNICATION = 'COMMUNICATION',
  QHSE = 'QHSE',
  CANTEEN = 'CANTEEN',
  TRANSPORT = 'TRANSPORT',
  LIBRARY = 'LIBRARY',
  INFIRMARY = 'INFIRMARY',
  SHOP = 'SHOP',
  EDUCAST = 'EDUCAST',
  ORION = 'ORION',
  ATLAS = 'ATLAS',
  OFFLINE_SYNC = 'OFFLINE_SYNC',
}

/** Liste des modules de l'app, dans l'ordre d'affichage (sidebar / paramètres) */
export const FEATURE_KEYS: string[] = [
  FeatureCode.STUDENTS,       // Élèves & Scolarité
  FeatureCode.FINANCE,        // Finances & Économat
  FeatureCode.EXAMS,          // Examens, Notes & Bulletins
  FeatureCode.PEDAGOGY,       // Organisation Pédagogique
  FeatureCode.HR_PAYROLL,     // Personnel, RH & Paie
  FeatureCode.COMMUNICATION,  // Communication
  FeatureCode.LIBRARY,        // Bibliothèque
  FeatureCode.TRANSPORT,      // Transport
  FeatureCode.CANTEEN,        // Cantine
  FeatureCode.INFIRMARY,     // Infirmerie
  FeatureCode.QHSE,           // QHSE
  FeatureCode.EDUCAST,        // EduCast
  FeatureCode.SHOP,          // Boutique
  FeatureCode.ORION,         // ORION
  FeatureCode.ATLAS,         // ATLAS
  FeatureCode.OFFLINE_SYNC,  // Sync. hors ligne
];

/** Modules activés par défaut pour un nouveau tenant */
export const DEFAULT_ENABLED_FEATURES = new Set<string>([
  FeatureCode.STUDENTS,
  FeatureCode.FINANCE,
  FeatureCode.EXAMS,
  FeatureCode.PEDAGOGY,
  FeatureCode.HR_PAYROLL,
  FeatureCode.COMMUNICATION,
]);

/** Modules premium (impact facturation) — uniquement ceux de la liste app */
export const PREMIUM_FEATURES = new Set<string>([
  FeatureCode.CANTEEN,
  FeatureCode.TRANSPORT,
  FeatureCode.LIBRARY,
  FeatureCode.INFIRMARY,
  FeatureCode.SHOP,
  FeatureCode.EDUCAST,
  FeatureCode.ORION,
  FeatureCode.ATLAS,
  FeatureCode.OFFLINE_SYNC,
]);

const LEGACY_FEATURE_ALIAS: Record<string, string> = {
  CANTINE: FeatureCode.CANTEEN,
  BIBLIOTHEQUE: FeatureCode.LIBRARY,
  INFIRMERIE: FeatureCode.INFIRMARY,
  BILINGUAL_TRACK: 'BILINGUAL', // option bilingue (hors liste modules)
};

function normalizeFeatureCode(code: string): string {
  return LEGACY_FEATURE_ALIAS[code] ?? code;
}

/**
 * Service pour la gestion des feature flags
 */
@Injectable()
export class FeatureFlagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: SettingsHistoryService,
  ) {}

  /**
   * Récupère toutes les features d'un tenant (lignes en base uniquement)
   */
  async getAllFeatures(tenantId: string) {
    return this.prisma.tenantFeature.findMany({
      where: { tenantId },
      orderBy: { featureCode: 'asc' },
    });
  }

  /**
   * Liste exhaustive des modules avec état activé/désactivé (pour l’UI Paramètres)
   */
  /**
   * Crée en BDD les lignes manquantes pour ce tenant (état par défaut).
   * Garantit que la configuration affichée dans l'onglet Modules est bien persistée.
   */
  async ensureTenantFeaturesInitialized(tenantId: string): Promise<void> {
    const rows = await this.prisma.tenantFeature.findMany({
      where: { tenantId },
      select: { featureCode: true },
    });
    const existingCodes = new Set(rows.map((r) => r.featureCode));
    const toCreate = FEATURE_KEYS.filter((code) => !existingCodes.has(code));
    if (toCreate.length === 0) return;
    await this.prisma.$transaction(
      toCreate.map((featureCode) =>
        this.prisma.tenantFeature.create({
          data: {
            tenantId,
            featureCode,
            isEnabled: DEFAULT_ENABLED_FEATURES.has(featureCode),
            status: DEFAULT_ENABLED_FEATURES.has(featureCode) ? 'ACTIVE' : 'INACTIVE',
          },
        }),
      ),
    );
  }

  /**
   * Liste exhaustive des modules avec état activé/désactivé (pour l'UI Paramètres).
   * Au premier appel, initialise les lignes manquantes en BDD.
   */
  async getAllModulesWithState(tenantId: string): Promise<
    { featureCode: string; isEnabled: boolean; status: string; enabledAt?: Date; enabledBy?: string; premium?: boolean }[]
  > {
    await this.ensureTenantFeaturesInitialized(tenantId);
    const rows = await this.prisma.tenantFeature.findMany({
      where: { tenantId },
    });
    const byCode = new Map(rows.map((r) => [r.featureCode, r]));
    return FEATURE_KEYS.map((featureCode) => {
      const row = byCode.get(featureCode);
      const isEnabled = row ? row.isEnabled && row.status === 'ACTIVE' : DEFAULT_ENABLED_FEATURES.has(featureCode);
      return {
        featureCode,
        isEnabled,
        status: row?.status ?? (DEFAULT_ENABLED_FEATURES.has(featureCode) ? 'ACTIVE' : 'INACTIVE'),
        enabledAt: row?.enabledAt ?? undefined,
        enabledBy: row?.enabledBy ?? undefined,
        premium: PREMIUM_FEATURES.has(featureCode),
      };
    });
  }

  /**
   * Récupère une feature par code
   */
  async getFeature(tenantId: string, featureCode: string) {
    const feature = await this.prisma.tenantFeature.findUnique({
      where: {
        tenantId_featureCode: {
          tenantId,
          featureCode,
        },
      },
    });

    if (!feature) {
      const defaultOn = DEFAULT_ENABLED_FEATURES.has(featureCode);
      return {
        tenantId,
        featureCode,
        isEnabled: defaultOn,
        status: defaultOn ? 'ACTIVE' : 'INACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return feature;
  }

  /**
   * Vérifie si une feature est activée
   */
  async isFeatureEnabled(tenantId: string, featureCode: string): Promise<boolean> {
    const feature = await this.getFeature(tenantId, featureCode);
    return feature.isEnabled && feature.status === 'ACTIVE';
  }

  /**
   * Active une feature
   */
  async enableFeature(
    tenantId: string,
    featureCode: string,
    userId: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await this.prisma.tenantFeature.findUnique({
      where: {
        tenantId_featureCode: {
          tenantId,
          featureCode,
        },
      },
    });

    let feature;
    if (existing) {
      if (existing.status === 'ACTIVE') {
        throw new BadRequestException(`Feature ${featureCode} is already enabled`);
      }

      feature = await this.prisma.tenantFeature.update({
        where: {
          tenantId_featureCode: {
            tenantId,
            featureCode,
          },
        },
        data: {
          isEnabled: true,
          status: 'ACTIVE',
          enabledAt: new Date(),
          enabledBy: userId,
          updatedAt: new Date(),
        },
      });
    } else {
      feature = await this.prisma.tenantFeature.create({
        data: {
          tenantId,
          featureCode,
          isEnabled: true,
          status: 'ACTIVE',
          enabledAt: new Date(),
          enabledBy: userId,
        },
      });
    }

    // Enregistrer l'historique
    await this.historyService.logFeatureChange(
      tenantId,
      featureCode,
      'INACTIVE',
      'ACTIVE',
      userId,
      reason,
      ipAddress,
      userAgent,
    );

    return feature;
  }

  /**
   * Désactive une feature
   */
  async disableFeature(
    tenantId: string,
    featureCode: string,
    userId: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await this.prisma.tenantFeature.findUnique({
      where: {
        tenantId_featureCode: {
          tenantId,
          featureCode,
        },
      },
    });

    const currentlyActive = existing ? existing.isEnabled && existing.status === 'ACTIVE' : DEFAULT_ENABLED_FEATURES.has(featureCode);
    if (!currentlyActive) {
      throw new NotFoundException(`Feature ${featureCode} is not enabled`);
    }

    // Vérifier les dépendances avant désactivation
    await this.validateFeatureDependencies(tenantId, featureCode);

    if (!existing) {
      // Pas de ligne en base mais module activé par défaut : créer une ligne désactivée
      const feature = await this.prisma.tenantFeature.create({
        data: {
          tenantId,
          featureCode,
          isEnabled: false,
          status: 'INACTIVE',
          disabledAt: new Date(),
          disabledBy: userId,
        },
      });
      await this.historyService.logFeatureChange(
        tenantId,
        featureCode,
        'ACTIVE',
        'INACTIVE',
        userId,
        reason,
        ipAddress,
        userAgent,
      );
      return feature;
    }

    const feature = await this.prisma.tenantFeature.update({
      where: {
        tenantId_featureCode: {
          tenantId,
          featureCode,
        },
      },
      data: {
        isEnabled: false,
        status: 'INACTIVE',
        disabledAt: new Date(),
        disabledBy: userId,
        updatedAt: new Date(),
      },
    });

    await this.historyService.logFeatureChange(
      tenantId,
      featureCode,
      'ACTIVE',
      'INACTIVE',
      userId,
      reason,
      ipAddress,
      userAgent,
    );

    return feature;
  }

  /**
   * Active tous les modules pour le tenant
   */
  async enableAllFeatures(
    tenantId: string,
    userId: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ enabled: number; skipped: number }> {
    const list = await this.getAllModulesWithState(tenantId);
    let enabled = 0;
    let skipped = 0;
    for (const f of list) {
      if (f.isEnabled) {
        skipped += 1;
        continue;
      }
      try {
        await this.enableFeature(tenantId, f.featureCode, userId, reason, ipAddress, userAgent);
        enabled += 1;
      } catch {
        skipped += 1;
      }
    }
    return { enabled, skipped };
  }

  /**
   * Désactive tous les modules pour le tenant
   */
  async disableAllFeatures(
    tenantId: string,
    userId: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ disabled: number; skipped: number }> {
    const list = await this.getAllModulesWithState(tenantId);
    let disabled = 0;
    let skipped = 0;
    for (const f of list) {
      if (!f.isEnabled) {
        skipped += 1;
        continue;
      }
      try {
        await this.disableFeature(tenantId, f.featureCode, userId, reason, ipAddress, userAgent);
        disabled += 1;
      } catch {
        skipped += 1;
      }
    }
    return { disabled, skipped };
  }

  /**
   * Calcule l'impact sur la facturation
   */
  async calculateBillingImpact(tenantId: string) {
    const features = await this.getAllFeatures(tenantId);
    const enabledFeatures = features.filter(
      (f) => f.isEnabled && f.status === 'ACTIVE',
    );

    // Prix des modules premium (uniquement modules de l'app)
    const pricing: Record<string, { monthly: number; annual: number }> = {
      CANTEEN: { monthly: 5000, annual: 50000 },
      TRANSPORT: { monthly: 3000, annual: 30000 },
      LIBRARY: { monthly: 2000, annual: 20000 },
      INFIRMARY: { monthly: 1000, annual: 10000 },
      SHOP: { monthly: 2500, annual: 25000 },
      EDUCAST: { monthly: 8000, annual: 80000 },
      ORION: { monthly: 5000, annual: 50000 },
      ATLAS: { monthly: 5000, annual: 50000 },
      OFFLINE_SYNC: { monthly: 3000, annual: 30000 },
    };

    const impact = enabledFeatures.reduce(
      (acc, feature) => {
        const price = pricing[feature.featureCode] || { monthly: 0, annual: 0 };
        return {
          monthly: acc.monthly + price.monthly,
          annual: acc.annual + price.annual,
        };
      },
      { monthly: 0, annual: 0 },
    );

    return impact;
  }

  /**
   * Valide les dépendances avant désactivation
   */
  private async validateFeatureDependencies(tenantId: string, featureCode: string) {
    // Validation optionnelle selon la feature (dépendances métier)
    switch (featureCode) {
      default:
        break;
    }
  }
}

