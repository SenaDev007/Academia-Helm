import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * ============================================================================
 * TenantThemeService — Gestion du thème du site institutionnel
 * ============================================================================
 *
 * Stocke le thème choisi par le directeur (themeId + mode) dans une table
 * dédiée `tenant_theme_settings` (créée idempotentement à la première requête).
 *
 * 1 enregistrement par tenant (tenantId @unique).
 *
 * Conventions :
 *   - themeId : slug du thème (ex: 'ocean-breeze', 'academia-helm-default')
 *   - mode : 'light' | 'dark' | 'auto'
 *
 * Si aucun thème n'est configuré, le front utilise DEFAULT_ACADEMIA_HELM_THEME.
 * ============================================================================
 */

export interface TenantThemeSettings {
  id: string;
  tenantId: string;
  themeId: string | null;
  mode: 'light' | 'dark' | 'auto';
  updatedAt: string;
}

function rowToSettings(r: any): TenantThemeSettings {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    themeId: r.theme_id || null,
    mode: (r.mode || 'auto') as 'light' | 'dark' | 'auto',
    updatedAt: r.updated_at?.toISOString?.() || r.updated_at,
  };
}

const VALID_MODES = ['light', 'dark', 'auto'];

@Injectable()
export class TenantThemeService {
  private readonly logger = new Logger(TenantThemeService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════
  //  GET — Récupère les settings de thème d'un tenant
  // ═══════════════════════════════════════════════════════════════════════

  async getSettings(tenantId: string): Promise<TenantThemeSettings> {
    await this.ensureTableExists();

    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "tenant_theme_settings" WHERE "tenant_id" = $1
    `, tenantId);

    if (!rows[0]) {
      // Retourne les valeurs par défaut (thème Academia Helm + mode auto)
      return {
        id: 'default',
        tenantId,
        themeId: null,
        mode: 'auto',
        updatedAt: new Date().toISOString(),
      };
    }

    return rowToSettings(rows[0]);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  SET — Met à jour le thème + mode
  // ═══════════════════════════════════════════════════════════════════════

  async setSettings(
    tenantId: string,
    payload: { themeId?: string | null; mode?: 'light' | 'dark' | 'auto' },
  ): Promise<TenantThemeSettings> {
    await this.ensureTableExists();

    // Validation du mode
    if (payload.mode && !VALID_MODES.includes(payload.mode)) {
      throw new BadRequestException(`Mode invalide : ${payload.mode}. Valeurs acceptées : light, dark, auto.`);
    }

    // Validation du themeId (non-vide si fourni, max 100 chars)
    if (payload.themeId !== undefined && payload.themeId !== null) {
      if (typeof payload.themeId !== 'string' || payload.themeId.length > 100) {
        throw new BadRequestException('themeId invalide.');
      }
    }

    // Upsert (INSERT ... ON CONFLICT DO UPDATE)
    const id = uuidv4();
    const themeId = payload.themeId === undefined ? null : payload.themeId;
    const mode = payload.mode || 'auto';

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "tenant_theme_settings" ("id", "tenant_id", "theme_id", "mode", "updated_at")
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT ("tenant_id") DO UPDATE
      SET
        "theme_id" = COALESCE($3, "tenant_theme_settings"."theme_id"),
        "mode" = COALESCE($4, "tenant_theme_settings"."mode"),
        "updated_at" = NOW()
    `, id, tenantId, themeId, mode);

    this.logger.log(`Theme updated for tenant ${tenantId}: themeId=${themeId}, mode=${mode}`);

    return this.getSettings(tenantId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  PUBLIC — Endpoint public pour récupérer le thème d'un tenant par slug
  //  (utilisé par le site institutionnel public, sans auth)
  // ═══════════════════════════════════════════════════════════════════════

  async getPublicSettingsBySlug(tenantSlug: string): Promise<{ themeId: string | null; mode: string }> {
    await this.ensureTableExists();

    // Trouver le tenant par slug ou subdomain
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: tenantSlug },
          { subdomain: tenantSlug },
        ],
        status: { in: ['active', 'trial'] },
      },
      select: { id: true },
    });

    if (!tenant) {
      return { themeId: null, mode: 'auto' };
    }

    const settings = await this.getSettings(tenant.id);
    return { themeId: settings.themeId, mode: settings.mode };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  private async ensureTableExists(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "tenant_theme_settings" (
          "id" TEXT PRIMARY KEY,
          "tenant_id" TEXT NOT NULL UNIQUE,
          "theme_id" TEXT,
          "mode" TEXT NOT NULL DEFAULT 'auto',
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "tenant_theme_settings_tenant_id_fkey"
            FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "idx_tenant_theme_settings_tenant" ON "tenant_theme_settings" ("tenant_id");
      `);
    } catch (e: any) {
      this.logger.warn(`ensureTableExists tenant_theme_settings: ${e.message}`);
    }
  }
}
