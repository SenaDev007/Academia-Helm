/**
 * ============================================================================
 * TAX SETTINGS SERVICE — Paramètres fiscaux configurables
 * ============================================================================
 *
 * Gère les taux CNSS, IST, AIB de manière configurable par tenant.
 * Évite de hardcoder les pourcentages dans le code.
 *
 * Toutes les valeurs sont en pourcentage (ex: 9.0 = 9%).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export interface TaxSettingsData {
  // CNSS
  cnssFamilialesRate: number;
  cnssRisquesRate: number;
  cnssVieillesseRate: number;
  cnssPatronaleRate: number;
  cnssOuvriereRate: number;
  // IST
  istVpsRate: number;
  istIrppRate: number;
  // AIB
  aibAchatsRate: number;
  aibPrestationsRate: number;
  // Périodicité
  istFrequency: string;
  cnssFrequency: string;
  aibFrequency: string;
}

const DEFAULT_SETTINGS: TaxSettingsData = {
  cnssFamilialesRate: 9.0,
  cnssRisquesRate: 1.0,
  cnssVieillesseRate: 0.0,
  cnssPatronaleRate: 6.4,
  cnssOuvriereRate: 3.6,
  istVpsRate: 4.0,
  istIrppRate: 0.0,
  aibAchatsRate: 1.0,
  aibPrestationsRate: 5.0,
  istFrequency: 'MONTHLY',
  cnssFrequency: 'QUARTERLY',
  aibFrequency: 'MONTHLY',
};

@Injectable()
export class TaxSettingsService {
  private readonly logger = new Logger(TaxSettingsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Récupère les paramètres fiscaux d'un tenant (ou crée les valeurs par défaut).
   */
  async getOrCreate(tenantId: string): Promise<TaxSettingsData> {
    try {
      let settings = await this.prisma.taxSettings.findFirst({
        where: { tenantId },
      });

      if (!settings) {
        settings = await this.prisma.taxSettings.create({
          data: { tenantId, ...DEFAULT_SETTINGS },
        });
      }

      return {
        cnssFamilialesRate: settings.cnssFamilialesRate,
        cnssRisquesRate: settings.cnssRisquesRate,
        cnssVieillesseRate: settings.cnssVieillesseRate,
        cnssPatronaleRate: settings.cnssPatronaleRate,
        cnssOuvriereRate: settings.cnssOuvriereRate,
        istVpsRate: settings.istVpsRate,
        istIrppRate: settings.istIrppRate,
        aibAchatsRate: settings.aibAchatsRate,
        aibPrestationsRate: settings.aibPrestationsRate,
        istFrequency: settings.istFrequency,
        cnssFrequency: settings.cnssFrequency,
        aibFrequency: settings.aibFrequency,
      };
    } catch (err: any) {
      this.logger.warn(`getOrCreate failed: ${err.message} — returning defaults`);
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Met à jour les paramètres fiscaux.
   */
  async update(tenantId: string, data: Partial<TaxSettingsData>): Promise<TaxSettingsData> {
    const existing = await this.prisma.taxSettings.findFirst({ where: { tenantId } });

    if (existing) {
      const updated = await this.prisma.taxSettings.update({
        where: { id: existing.id },
        data: {
          cnssFamilialesRate: data.cnssFamilialesRate ?? undefined,
          cnssRisquesRate: data.cnssRisquesRate ?? undefined,
          cnssVieillesseRate: data.cnssVieillesseRate ?? undefined,
          cnssPatronaleRate: data.cnssPatronaleRate ?? undefined,
          cnssOuvriereRate: data.cnssOuvriereRate ?? undefined,
          istVpsRate: data.istVpsRate ?? undefined,
          istIrppRate: data.istIrppRate ?? undefined,
          aibAchatsRate: data.aibAchatsRate ?? undefined,
          aibPrestationsRate: data.aibPrestationsRate ?? undefined,
          istFrequency: data.istFrequency ?? undefined,
          cnssFrequency: data.cnssFrequency ?? undefined,
          aibFrequency: data.aibFrequency ?? undefined,
        },
      });
      return this.mapToData(updated);
    }

    const created = await this.prisma.taxSettings.create({
      data: { tenantId, ...DEFAULT_SETTINGS, ...data },
    });
    return this.mapToData(created);
  }

  private mapToData(r: any): TaxSettingsData {
    return {
      cnssFamilialesRate: r.cnssFamilialesRate,
      cnssRisquesRate: r.cnssRisquesRate,
      cnssVieillesseRate: r.cnssVieillesseRate,
      cnssPatronaleRate: r.cnssPatronaleRate,
      cnssOuvriereRate: r.cnssOuvriereRate,
      istVpsRate: r.istVpsRate,
      istIrppRate: r.istIrppRate,
      aibAchatsRate: r.aibAchatsRate,
      aibPrestationsRate: r.aibPrestationsRate,
      istFrequency: r.istFrequency,
      cnssFrequency: r.cnssFrequency,
      aibFrequency: r.aibFrequency,
    };
  }
}
