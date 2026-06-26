import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * ============================================================================
 * TenantBlockSelectionService — Persistance des sélections de composants CMS
 * ============================================================================
 *
 * Stocke quelle variante de composant l'utilisateur a choisie pour chaque
 * catégorie (navbar, hero, footer, border, testimonial, text, image, video).
 *
 * 1 enregistrement par (tenantId, category) — upsert via ON CONFLICT.
 *
 * Stocke aussi les colorOverrides (JSON) si l'utilisateur a personnalisé
 * les couleurs par-dessus le thème.
 * ============================================================================
 */

export interface BlockSelection {
  id: string;
  tenantId: string;
  category: string;        // navbar | hero | footer | border | testimonial | text | image | video
  variantId: string;       // ex: 'navbar-classic', 'hero-centered'
  colorOverrides: any;     // { primary?, accent?, background?, foreground? } ou null
  createdAt: string;
  updatedAt: string;
}

const VALID_CATEGORIES = [
  'navbar', 'hero', 'footer', 'border',
  'testimonial', 'text', 'image', 'video',
];

function rowToSelection(r: any): BlockSelection {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    category: r.category,
    variantId: r.variant_id,
    colorOverrides: r.color_overrides
      ? (typeof r.color_overrides === 'string' ? JSON.parse(r.color_overrides) : r.color_overrides)
      : null,
    createdAt: r.created_at?.toISOString?.() || r.created_at,
    updatedAt: r.updated_at?.toISOString?.() || r.updated_at,
  };
}

@Injectable()
export class TenantBlockSelectionService {
  private readonly logger = new Logger(TenantBlockSelectionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════
  //  GET ALL — Toutes les sélections d'un tenant
  // ═══════════════════════════════════════════════════════════════════════

  async getAll(tenantId: string): Promise<BlockSelection[]> {
    await this.ensureTableExists();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "tenant_block_selections" WHERE "tenant_id" = $1
      ORDER BY "category" ASC
    `, tenantId);
    return rows.map(rowToSelection);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  GET BY CATEGORY — Une sélection par catégorie
  // ═══════════════════════════════════════════════════════════════════════

  async getByCategory(tenantId: string, category: string): Promise<BlockSelection | null> {
    await this.ensureTableExists();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "tenant_block_selections" WHERE "tenant_id" = $1 AND "category" = $2
    `, tenantId, category);
    return rows[0] ? rowToSelection(rows[0]) : null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  UPSERT — Créer ou mettre à jour une sélection
  // ═══════════════════════════════════════════════════════════════════════

  async upsert(
    tenantId: string,
    category: string,
    variantId: string,
    colorOverrides?: any,
  ): Promise<BlockSelection> {
    await this.ensureTableExists();

    if (!VALID_CATEGORIES.includes(category)) {
      throw new BadRequestException(`Catégorie invalide : ${category}. Valeurs acceptées : ${VALID_CATEGORIES.join(', ')}.`);
    }
    if (!variantId || typeof variantId !== 'string' || variantId.length > 100) {
      throw new BadRequestException('variantId invalide.');
    }

    const id = uuidv4();
    const overridesJson = colorOverrides ? JSON.stringify(colorOverrides) : null;

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "tenant_block_selections" ("id", "tenant_id", "category", "variant_id", "color_overrides", "created_at", "updated_at")
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT ("tenant_id", "category") DO UPDATE
      SET
        "variant_id" = $4,
        "color_overrides" = $5,
        "updated_at" = NOW()
    `, id, tenantId, category, variantId, overridesJson);

    this.logger.log(`Block selection upserted: tenant=${tenantId}, category=${category}, variant=${variantId}`);

    const result = await this.getByCategory(tenantId, category);
    return result!;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  DELETE — Supprimer une sélection
  // ═══════════════════════════════════════════════════════════════════════

  async delete(tenantId: string, category: string): Promise<void> {
    await this.ensureTableExists();
    await this.prisma.$executeRawUnsafe(`
      DELETE FROM "tenant_block_selections" WHERE "tenant_id" = $1 AND "category" = $2
    `, tenantId, category);
    this.logger.log(`Block selection deleted: tenant=${tenantId}, category=${category}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  PUBLIC — Récupérer toutes les sélections par slug tenant (pour rendu public)
  // ═══════════════════════════════════════════════════════════════════════

  async getPublicBySlug(tenantSlug: string): Promise<{ category: string; variantId: string; colorOverrides: any }[]> {
    await this.ensureTableExists();

    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { subdomain: tenantSlug }],
        status: { in: ['active', 'trial'] },
      },
      select: { id: true },
    });

    if (!tenant) return [];

    const selections = await this.getAll(tenant.id);
    return selections.map((s) => ({
      category: s.category,
      variantId: s.variantId,
      colorOverrides: s.colorOverrides,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  private async ensureTableExists(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "tenant_block_selections" (
          "id" TEXT PRIMARY KEY,
          "tenant_id" TEXT NOT NULL,
          "category" TEXT NOT NULL,
          "variant_id" TEXT NOT NULL,
          "color_overrides" TEXT,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "tenant_block_selections_tenant_id_fkey"
            FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
          CONSTRAINT "tenant_block_selections_tenant_category_unique"
            UNIQUE ("tenant_id", "category")
        );
        CREATE INDEX IF NOT EXISTS "idx_tenant_block_selections_tenant" ON "tenant_block_selections" ("tenant_id");
      `);
    } catch (e: any) {
      this.logger.warn(`ensureTableExists tenant_block_selections: ${e.message}`);
    }
  }
}
