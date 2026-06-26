import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * ============================================================================
 * PositionsService — Gestion des postes occupés (CRUD)
 * ============================================================================
 *
 * Pattern identique à DepartmentsService.
 * Table: positions (créée idempotentement).
 * ============================================================================
 */

export interface Position {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  category: string | null; // TEACHER, ADMIN, SUPPORT, DIRECTOR
  createdAt: string;
  updatedAt: string;
}

const VALID_CATEGORIES = ['TEACHER', 'ADMIN', 'SUPPORT', 'DIRECTOR'];

// Postes suggérés par défaut (créés automatiquement à l'initialisation)
const DEFAULT_POSITIONS = [
  { name: 'Directeur', category: 'DIRECTOR' },
  { name: 'Directeur Adjoint', category: 'DIRECTOR' },
  { name: 'Censeur', category: 'DIRECTOR' },
  { name: 'Secrétaire', category: 'ADMIN' },
  { name: 'Secrétaire Comptable', category: 'ADMIN' },
  { name: 'Comptable', category: 'ADMIN' },
  { name: 'Économe', category: 'ADMIN' },
  { name: 'Responsable Scolarité', category: 'ADMIN' },
  { name: 'Surveillant Général', category: 'ADMIN' },
  { name: 'Professeur Principal', category: 'TEACHER' },
  { name: 'Professeur de Mathématiques', category: 'TEACHER' },
  { name: 'Professeur de Français', category: 'TEACHER' },
  { name: "Professeur d'Anglais", category: 'TEACHER' },
  { name: 'Professeur de SVT', category: 'TEACHER' },
  { name: 'Professeur de Physique-Chimie', category: 'TEACHER' },
  { name: "Professeur d'Histoire-Géographie", category: 'TEACHER' },
  { name: "Professeur d'EPS", category: 'TEACHER' },
  { name: 'Professeur de Philosophie', category: 'TEACHER' },
  { name: "Professeur d'Informatique", category: 'TEACHER' },
  { name: 'Instituteur', category: 'TEACHER' },
  { name: 'Éducateur', category: 'TEACHER' },
  { name: 'Animateur', category: 'SUPPORT' },
  { name: 'Agent d\'entretien', category: 'SUPPORT' },
  { name: 'Agent de sécurité', category: 'SUPPORT' },
  { name: 'Chauffeur', category: 'SUPPORT' },
  { name: 'Cuisinier', category: 'SUPPORT' },
  { name: 'Infirmier', category: 'SUPPORT' },
  { name: 'Bibliothécaire', category: 'SUPPORT' },
  { name: 'Responsable informatique', category: 'ADMIN' },
  { name: 'Responsable communication', category: 'ADMIN' },
];

@Injectable()
export class PositionsService {
  private readonly logger = new Logger(PositionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string): Promise<Position[]> {
    await this.ensureTableExists();
    await this.ensureDefaultPositions(tenantId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "positions" WHERE "tenantId" = $1 ORDER BY "category" ASC, "name" ASC`,
      tenantId,
    );
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      name: r.name,
      description: r.description,
      category: r.category,
      createdAt: r.createdAt?.toISOString?.() || r.createdAt,
      updatedAt: r.updatedAt?.toISOString?.() || r.updatedAt,
    }));
  }

  async create(tenantId: string, data: { name: string; description?: string; category?: string }): Promise<Position> {
    await this.ensureTableExists();
    if (!data.name?.trim()) throw new Error('Le nom du poste est requis');
    if (data.category && !VALID_CATEGORIES.includes(data.category)) {
      throw new Error(`Catégorie invalide: ${data.category}. Valeurs acceptées: ${VALID_CATEGORIES.join(', ')}`);
    }
    const id = uuidv4();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "positions" ("id", "tenantId", "name", "description", "category", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      id, tenantId, data.name.trim(), data.description || null, data.category || null,
    );
    this.logger.log(`Position created: ${data.name} for tenant ${tenantId}`);
    return (await this.findById(tenantId, id))!;
  }

  async update(tenantId: string, id: string, data: { name?: string; description?: string; category?: string }): Promise<Position> {
    await this.ensureTableExists();
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (data.name !== undefined) { sets.push(`"name" = $${idx++}`); params.push(data.name.trim()); }
    if (data.description !== undefined) { sets.push(`"description" = $${idx++}`); params.push(data.description); }
    if (data.category !== undefined) {
      if (data.category && !VALID_CATEGORIES.includes(data.category)) throw new Error('Catégorie invalide');
      sets.push(`"category" = $${idx++}`); params.push(data.category || null);
    }
    if (sets.length === 0) return (await this.findById(tenantId, id))!;
    sets.push(`"updatedAt" = NOW()`);
    params.push(id, tenantId);
    await this.prisma.$executeRawUnsafe(`UPDATE "positions" SET ${sets.join(', ')} WHERE "id" = $${idx++} AND "tenantId" = $${idx++}`, ...params);
    return (await this.findById(tenantId, id))!;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.ensureTableExists();
    const result = await this.prisma.$executeRawUnsafe(`DELETE FROM "positions" WHERE "id" = $1 AND "tenantId" = $2`, id, tenantId);
    if (result === 0) throw new NotFoundException('Poste introuvable');
  }

  private async findById(tenantId: string, id: string): Promise<Position | null> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "positions" WHERE "id" = $1 AND "tenantId" = $2`, id, tenantId);
    if (!rows[0]) return null;
    const r = rows[0];
    return { id: r.id, tenantId: r.tenantId, name: r.name, description: r.description, category: r.category, createdAt: r.createdAt?.toISOString?.() || r.createdAt, updatedAt: r.updatedAt?.toISOString?.() || r.updatedAt };
  }

  private async ensureTableExists(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "positions" (
          "id" TEXT PRIMARY KEY,
          "tenantId" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "category" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "positions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "idx_positions_tenant" ON "positions" ("tenantId");
      `);
    } catch (e: any) { this.logger.warn(`ensureTableExists positions: ${e.message}`); }
  }

  private async ensureDefaultPositions(tenantId: string): Promise<void> {
    const count = await this.prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS count FROM "positions" WHERE "tenantId" = $1`, tenantId);
    if (count[0]?.count > 0) return;
    for (const pos of DEFAULT_POSITIONS) {
      const id = uuidv4();
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "positions" ("id", "tenantId", "name", "description", "category", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) ON CONFLICT DO NOTHING`,
        id, tenantId, pos.name, null, pos.category,
      );
    }
    this.logger.log(`Initialized ${DEFAULT_POSITIONS.length} default positions for tenant ${tenantId}`);
  }
}
