/**
 * Gestionnaire de Migrations SQLite
 * 
 * OBJECTIF : Gérer les migrations SQLite versionnées de manière synchronisée
 * avec les migrations PostgreSQL
 * 
 * PRINCIPE : Chaque migration PostgreSQL doit avoir une migration SQLite correspondante
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

interface Migration {
  version: string;
  name: string;
  up: string;
  down: string;
  prismaSchemaHash: string;
}

interface MigrationStatus {
  version: string;
  applied: boolean;
  appliedAt?: string;
  prismaSchemaHash: string;
}

/**
 * Gestionnaire de migrations SQLite
 */
class SQLiteMigrationManager {
  private migrationsDir: string;
  private schemaPath: string;

  constructor(
    migrationsDir: string = join(__dirname, '../migrations/sqlite'),
    schemaPath: string = join(__dirname, '../prisma/schema.prisma')
  ) {
    this.migrationsDir = migrationsDir;
    this.schemaPath = schemaPath;

    // Créer le répertoire si nécessaire
    if (!existsSync(this.migrationsDir)) {
      mkdirSync(this.migrationsDir, { recursive: true });
    }
  }

  /**
   * Calcule le hash du schéma Prisma actuel
   */
  getPrismaSchemaHash(): string {
    const schemaContent = readFileSync(this.schemaPath, 'utf-8');
    return createHash('sha256').update(schemaContent).digest('hex');
  }

  /**
   * Génère une nouvelle migration SQLite à partir du schéma Prisma
   */
  generateMigration(name: string): string {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    const version = `${timestamp}_${name}`;
    const prismaSchemaHash = this.getPrismaSchemaHash();

    // Lire le schéma SQLite généré
    const sqliteSchemaPath = join(__dirname, '../prisma/sqlite-schema.sql');
    if (!existsSync(sqliteSchemaPath)) {
      throw new Error('Schéma SQLite non généré. Exécutez d\'abord generate-sqlite-schema.ts');
    }

    const sqliteSchema = readFileSync(sqliteSchemaPath, 'utf-8');

    // Générer la migration UP (création/mise à jour)
    const upSQL = `-- Migration: ${name}
-- Version: ${version}
-- Prisma Schema Hash: ${prismaSchemaHash}
-- Generated: ${new Date().toISOString()}

${sqliteSchema}

-- Marquer la version comme appliquée
INSERT OR REPLACE INTO schema_version (version, prisma_schema_hash, applied_at)
VALUES ('${version}', '${prismaSchemaHash}', datetime('now'));
`;

    // Générer la migration DOWN (rollback)
    const downSQL = `-- Rollback: ${name}
-- Version: ${version}

-- Supprimer toutes les tables (ATTENTION: perte de données)
-- Cette migration est destructive, utiliser avec précaution

-- Supprimer les tables métier (ordre inverse des dépendances)
-- ... (à générer selon les dépendances)

-- Supprimer la version
DELETE FROM schema_version WHERE version = '${version}';
`;

    // Écrire les fichiers de migration
    const migrationDir = join(this.migrationsDir, version);
    mkdirSync(migrationDir, { recursive: true });

    writeFileSync(join(migrationDir, 'up.sql'), upSQL, 'utf-8');
    writeFileSync(join(migrationDir, 'down.sql'), downSQL, 'utf-8');
    writeFileSync(
      join(migrationDir, 'metadata.json'),
      JSON.stringify({
        version,
        name,
        prismaSchemaHash,
        createdAt: new Date().toISOString(),
      }, null, 2),
      'utf-8'
    );

    console.log(`✅ Migration générée: ${version}`);
    console.log(`📁 Répertoire: ${migrationDir}`);

    return version;
  }

  /**
   * Liste toutes les migrations disponibles
   */
  listMigrations(): Migration[] {
    if (!existsSync(this.migrationsDir)) {
      return [];
    }

    const migrations: Migration[] = [];
    const entries = readdirSync(this.migrationsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const version = entry.name;
        const migrationDir = join(this.migrationsDir, version);

        const upPath = join(migrationDir, 'up.sql');
        const downPath = join(migrationDir, 'down.sql');
        const metadataPath = join(migrationDir, 'metadata.json');

        if (existsSync(upPath) && existsSync(downPath)) {
          const up = readFileSync(upPath, 'utf-8');
          const down = readFileSync(downPath, 'utf-8');
          const metadata = existsSync(metadataPath)
            ? JSON.parse(readFileSync(metadataPath, 'utf-8'))
            : {};

          migrations.push({
            version,
            name: metadata.name || version,
            up,
            down,
            prismaSchemaHash: metadata.prismaSchemaHash || '',
          });
        }
      }
    }

    // Trier par version (timestamp)
    return migrations.sort((a, b) => a.version.localeCompare(b.version));
  }

  /**
   * Applique une migration sur une base SQLite
   */
  async applyMigration(db: any, version: string): Promise<void> {
    const migrations = this.listMigrations();
    const migration = migrations.find(m => m.version === version);

    if (!migration) {
      throw new Error(`Migration ${version} introuvable`);
    }

    // Exécuter le SQL UP
    db.exec(migration.up);
    console.log(`✅ Migration appliquée: ${version}`);
  }

  /**
   * Vérifie la conformité du schéma SQLite avec le schéma Prisma
   */
  async validateSchemaConformity(db: any): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Vérifier la version du schéma
    try {
      const versionResult = db.prepare('SELECT * FROM schema_version ORDER BY applied_at DESC LIMIT 1').get();
      
      if (!versionResult) {
        errors.push('Aucune version de schéma enregistrée');
        return { isValid: false, errors, warnings };
      }

      const currentHash = this.getPrismaSchemaHash();
      if (versionResult.prisma_schema_hash !== currentHash) {
        errors.push(
          `Hash du schéma non conforme. ` +
          `Attendu: ${currentHash.substring(0, 16)}..., ` +
          `Trouvé: ${versionResult.prisma_schema_hash.substring(0, 16)}...`
        );
      }
    } catch (error: any) {
      errors.push(`Erreur lors de la vérification de version: ${error.message}`);
    }

    // Vérifier la présence des tables essentielles
    const essentialTables = [
      'tenants', 'academic_years', 'school_levels', 'academic_tracks',
      'users', 'students', 'classes', 'subjects'
    ];

    for (const table of essentialTables) {
      try {
        const result = db.prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
        ).get(table);
        
        if (!result) {
          errors.push(`Table manquante: ${table}`);
        }
      } catch (error: any) {
        errors.push(`Erreur lors de la vérification de ${table}: ${error.message}`);
      }
    }

    // Vérifier les colonnes structurantes
    const structuredColumns = ['tenant_id', 'academic_year_id', 'school_level_id'];
    const businessTables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND name NOT LIKE 'sqlite_%'
      AND name NOT IN ('schema_version', 'sync_operations', 'sync_conflicts', 'sync_logs')
    `).all();

    for (const table of businessTables) {
      const tableName = table.name;
      const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
      const columnNames = columns.map((c: any) => c.name);

      for (const requiredColumn of structuredColumns) {
        if (!columnNames.includes(requiredColumn)) {
          warnings.push(`Colonne manquante dans ${tableName}: ${requiredColumn}`);
        }
      }

      // Vérifier les colonnes techniques
      if (!columnNames.includes('sync_status')) {
        warnings.push(`Colonne technique manquante dans ${tableName}: sync_status`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

export default SQLiteMigrationManager;

