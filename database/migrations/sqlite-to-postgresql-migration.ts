/**
 * ============================================================================
 * MIGRATION SQLITE → POSTGRESQL MULTI-TENANT
 * ============================================================================
 * 
 * Objectif : Migrer les données Desktop (SQLite) vers SaaS (PostgreSQL)
 * - Migration non destructive
 * - Rollback possible
 * - Injection tenant_id par école
 * - Script réexécutable (idempotent)
 * - Logs détaillés
 * 
 * Usage:
 *   npm run migrate:sqlite-to-postgresql
 * 
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { Pool, Client } from 'pg';
import * as readline from 'readline';

// ============================================================================
// CONFIGURATION
// ============================================================================

interface MigrationConfig {
  sqlitePath: string;
  postgresql: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  logFile: string;
  backupBeforeMigration: boolean;
  dryRun: boolean;
}

// ============================================================================
// LOGGER
// ============================================================================

class MigrationLogger {
  private logFile: string;
  private logs: string[] = [];

  constructor(logFile: string) {
    this.logFile = logFile;
    // Créer le répertoire de logs si nécessaire
    const logDir = path.dirname(logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  log(message: string, level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage);
    this.logs.push(logMessage);
  }

  async flush() {
    const content = this.logs.join('\n') + '\n';
    fs.appendFileSync(this.logFile, content, 'utf-8');
    this.logs = [];
  }

  async save() {
    await this.flush();
  }
}

// ============================================================================
// MIGRATION MANAGER
// ============================================================================

class SqliteToPostgresqlMigration {
  private sqliteDb: Database.Database | null = null;
  private pgPool: Pool | null = null;
  private logger: MigrationLogger;
  private config: MigrationConfig;
  private tenantMapping: Map<string, string> = new Map(); // school_id -> tenant_id
  private migrationStats = {
    tenantsCreated: 0,
    tablesMigrated: 0,
    recordsMigrated: 0,
    errors: 0,
  };

  constructor(config: MigrationConfig) {
    this.config = config;
    this.logger = new MigrationLogger(config.logFile);
  }

  // ========================================================================
  // INITIALISATION
  // ========================================================================

  async initialize() {
    this.logger.log('🚀 Démarrage de la migration SQLite → PostgreSQL', 'INFO');

    // Vérifier le fichier SQLite
    if (!fs.existsSync(this.config.sqlitePath)) {
      throw new Error(`Fichier SQLite introuvable: ${this.config.sqlitePath}`);
    }
    this.logger.log(`✅ Fichier SQLite trouvé: ${this.config.sqlitePath}`, 'SUCCESS');

    // Connexion SQLite
    this.sqliteDb = new Database(this.config.sqlitePath, { readonly: true });
    this.logger.log('✅ Connexion SQLite établie', 'SUCCESS');

    // Connexion PostgreSQL
    this.pgPool = new Pool(this.config.postgresql);
    try {
      await this.pgPool.query('SELECT 1');
      this.logger.log('✅ Connexion PostgreSQL établie', 'SUCCESS');
    } catch (error) {
      throw new Error(`Erreur de connexion PostgreSQL: ${error}`);
    }
  }

  // ========================================================================
  // BACKUP
  // ========================================================================

  async createBackup() {
    if (!this.config.backupBeforeMigration) {
      this.logger.log('⚠️  Backup désactivé', 'WARN');
      return;
    }

    this.logger.log('📦 Création d\'un backup PostgreSQL...', 'INFO');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `database/backups/postgresql-backup-${timestamp}.sql`;

    // Utiliser pg_dump via commande système
    const { exec } = require('child_process');
    const pgDumpCmd = `pg_dump -h ${this.config.postgresql.host} -p ${this.config.postgresql.port} -U ${this.config.postgresql.user} -d ${this.config.postgresql.database} -F c -f ${backupFile}`;

    return new Promise<void>((resolve, reject) => {
      exec(pgDumpCmd, { env: { ...process.env, PGPASSWORD: this.config.postgresql.password } }, (error: any) => {
        if (error) {
          this.logger.log(`⚠️  Erreur lors du backup: ${error.message}`, 'WARN');
          reject(error);
        } else {
          this.logger.log(`✅ Backup créé: ${backupFile}`, 'SUCCESS');
          resolve();
        }
      });
    });
  }

  // ========================================================================
  // MAPPING DES TABLES
  // ========================================================================

  private getTableMapping(): Map<string, TableMapping> {
    const mapping = new Map<string, TableMapping>();

    // Tables SaaS (à créer)
    mapping.set('tenants', {
      sqliteTable: null,
      postgresqlTable: 'tenants',
      skip: false,
      transform: null,
    });

    mapping.set('users', {
      sqliteTable: 'users',
      postgresqlTable: 'users',
      skip: false,
      transform: (row: any, tenantId: string) => ({
        ...row,
        tenant_id: tenantId,
        id: row.id || this.generateUUID(),
      }),
    });

    // Tables métier - Académiques
    mapping.set('academic_years', {
      sqliteTable: 'academic_years',
      postgresqlTable: 'academic_years',
      skip: false,
      transform: (row: any, tenantId: string) => ({
        ...row,
        tenant_id: tenantId,
        id: row.id || this.generateUUID(),
        created_by: null, // À mapper depuis users si possible
      }),
    });

    mapping.set('quarters', {
      sqliteTable: 'quarters',
      postgresqlTable: 'quarters',
      skip: false,
      transform: (row: any, tenantId: string) => ({
        ...row,
        tenant_id: tenantId,
        id: row.id || this.generateUUID(),
        created_by: null,
      }),
    });

    mapping.set('schools', {
      sqliteTable: 'schools',
      postgresqlTable: 'schools',
      skip: false,
      transform: (row: any, tenantId: string) => ({
        ...row,
        tenant_id: tenantId,
        id: row.id || this.generateUUID(),
        created_by: null,
      }),
    });

    // Tables métier - Pédagogiques
    mapping.set('classes', {
      sqliteTable: 'classes',
      postgresqlTable: 'classes',
      skip: false,
      transform: (row: any, tenantId: string) => ({
        ...row,
        tenant_id: tenantId,
        id: row.id || this.generateUUID(),
        created_by: null,
      }),
    });

    mapping.set('subjects', {
      sqliteTable: 'subjects',
      postgresqlTable: 'subjects',
      skip: false,
      transform: (row: any, tenantId: string) => ({
        ...row,
        tenant_id: tenantId,
        id: row.id || this.generateUUID(),
        created_by: null,
      }),
    });

    mapping.set('students', {
      sqliteTable: 'students',
      postgresqlTable: 'students',
      skip: false,
      transform: (row: any, tenantId: string) => ({
        ...row,
        tenant_id: tenantId,
        id: row.id || this.generateUUID(),
        educmaster_number: row.educmaster_number || row.matricule || null,
        created_by: null,
      }),
    });

    mapping.set('teachers', {
      sqliteTable: 'teachers',
      postgresqlTable: 'teachers',
      skip: false,
      transform: (row: any, tenantId: string) => ({
        ...row,
        tenant_id: tenantId,
        id: row.id || this.generateUUID(),
        created_by: null,
      }),
    });

    mapping.set('departments', {
      sqliteTable: 'departments',
      postgresqlTable: 'departments',
      skip: false,
      transform: (row: any, tenantId: string) => ({
        ...row,
        tenant_id: tenantId,
        id: row.id || this.generateUUID(),
        created_by: null,
      }),
    });

    mapping.set('rooms', {
      sqliteTable: 'rooms',
      postgresqlTable: 'rooms',
      skip: false,
      transform: (row: any, tenantId: string) => ({
        ...row,
        tenant_id: tenantId,
        id: row.id || this.generateUUID(),
        equipment: this.parseJSONField(row.equipment),
        created_by: null,
      }),
    });

    // Tables métier - Présence
    mapping.set('absences', {
      sqliteTable: 'absences',
      postgresqlTable: 'absences',
      skip: false,
      transform: (row: any, tenantId: string) => ({
        ...row,
        tenant_id: tenantId,
        id: row.id || this.generateUUID(),
        created_by: null,
      }),
    });

    mapping.set('discipline', {
      sqliteTable: 'discipline',
      postgresqlTable: 'discipline',
      skip: false,
      transform: (row: any, tenantId: string) => ({
        ...row,
        tenant_id: tenantId,
        id: row.id || this.generateUUID(),
        created_by: null,
      }),
    });

    // Tables métier - Évaluation
    mapping.set('exams', {
      sqliteTable: 'exams',
      postgresqlTable: 'exams',
      skip: false,
      transform: (row: any, tenantId: string) => ({
        ...row,
        tenant_id: tenantId,
        id: row.id || this.generateUUID(),
        created_by: null,
      }),
    });

    mapping.set('grades', {
      sqliteTable: 'grades',
      postgresqlTable: 'grades',
      skip: false,
      transform: (row: any, tenantId: string) => ({
        ...row,
        tenant_id: tenantId,
        id: row.id || this.generateUUID(),
        created_by: null,
      }),
    });

    // Tables métier - Finance
    mapping.set('fee_configurations', {
      sqliteTable: 'fee_configurations',
      postgresqlTable: 'fee_configurations',
      skip: false,
      transform: (row: any, tenantId: string) => ({
        ...row,
        tenant_id: tenantId,
        id: row.id || this.generateUUID(),
        created_by: null,
      }),
    });

    mapping.set('payments', {
      sqliteTable: 'payments',
      postgresqlTable: 'payments',
      skip: false,
      transform: (row: any, tenantId: string) => ({
        ...row,
        tenant_id: tenantId,
        id: row.id || this.generateUUID(),
        created_by: null,
      }),
    });

    mapping.set('expenses', {
      sqliteTable: 'expenses',
      postgresqlTable: 'expenses',
      skip: false,
      transform: (row: any, tenantId: string) => ({
        ...row,
        tenant_id: tenantId,
        id: row.id || this.generateUUID(),
        created_by: null,
      }),
    });

    return mapping;
  }

  // ========================================================================
  // UTILITAIRES
  // ========================================================================

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private parseJSONField(value: any): any {
    if (!value) return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }

  private convertSQLiteDate(dateStr: string | null): string | null {
    if (!dateStr) return null;
    // SQLite stocke les dates en format ISO ou DATETIME
    // PostgreSQL attend TIMESTAMP WITH TIME ZONE
    try {
      const date = new Date(dateStr);
      return date.toISOString();
    } catch {
      return null;
    }
  }

  // ========================================================================
  // CRÉATION DES TENANTS
  // ========================================================================

  async createTenantsFromSchools() {
    this.logger.log('🏫 Création des tenants depuis les écoles SQLite...', 'INFO');

    if (!this.sqliteDb) throw new Error('SQLite DB non initialisée');

    // Récupérer toutes les écoles
    const schools = this.sqliteDb.prepare('SELECT * FROM schools').all() as any[];

    if (schools.length === 0) {
      this.logger.log('⚠️  Aucune école trouvée dans SQLite', 'WARN');
      return;
    }

    this.logger.log(`📊 ${schools.length} école(s) trouvée(s)`, 'INFO');

    // Récupérer le pays par défaut (BJ)
    const defaultCountry = await this.pgPool!.query(
      'SELECT id FROM countries WHERE is_default = TRUE LIMIT 1'
    );

    if (defaultCountry.rows.length === 0) {
      throw new Error('Aucun pays par défaut trouvé. Exécutez d\'abord le seeder des pays.');
    }

    const countryId = defaultCountry.rows[0].id;

    // Créer un tenant par école
    for (const school of schools) {
      const tenantId = this.generateUUID();
      const slug = this.sanitizeSlug(school.name || `school-${school.id}`);

      // Vérifier si le tenant existe déjà
      const existing = await this.pgPool!.query(
        'SELECT id FROM tenants WHERE slug = $1',
        [slug]
      );

      if (existing.rows.length > 0) {
        this.logger.log(`⚠️  Tenant existe déjà: ${slug}`, 'WARN');
        this.tenantMapping.set(school.id, existing.rows[0].id);
        continue;
      }

      // Créer le tenant
      await this.pgPool!.query(
        `INSERT INTO tenants (
          id, name, subdomain, slug, country_id, status,
          primary_email, primary_phone, address, website,
          subscription_plan, subscription_status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        ON CONFLICT (slug) DO NOTHING`,
        [
          tenantId,
          school.name || 'École sans nom',
          slug,
          slug,
          countryId,
          'active',
          school.primary_email || null,
          school.primary_phone || null,
          school.address || null,
          school.website || null,
          'free',
          'active',
        ]
      );

      // Créer l'école dans PostgreSQL
      await this.pgPool!.query(
        `INSERT INTO schools (
          id, tenant_id, name, abbreviation, address,
          primary_phone, secondary_phone, primary_email, website,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        ON CONFLICT DO NOTHING`,
        [
          school.id || this.generateUUID(),
          tenantId,
          school.name,
          school.abbreviation || null,
          school.address || null,
          school.primary_phone || null,
          school.secondary_phone || null,
          school.primary_email || null,
          school.website || null,
        ]
      );

      this.tenantMapping.set(school.id, tenantId);
      this.migrationStats.tenantsCreated++;
      this.logger.log(`✅ Tenant créé: ${school.name} (${tenantId})`, 'SUCCESS');
    }

    this.logger.log(`✅ ${this.migrationStats.tenantsCreated} tenant(s) créé(s)`, 'SUCCESS');
  }

  private sanitizeSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);
  }

  // ========================================================================
  // MIGRATION DES TABLES
  // ========================================================================

  async migrateTable(tableName: string, mapping: TableMapping) {
    if (mapping.skip || !mapping.sqliteTable) {
      this.logger.log(`⏭️  Table ${tableName} ignorée`, 'INFO');
      return;
    }

    this.logger.log(`📋 Migration de la table: ${mapping.sqliteTable} → ${mapping.postgresqlTable}`, 'INFO');

    if (!this.sqliteDb) throw new Error('SQLite DB non initialisée');

    // Vérifier si la table existe dans SQLite
    const tableExists = this.sqliteDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(mapping.sqliteTable);

    if (!tableExists) {
      this.logger.log(`⚠️  Table ${mapping.sqliteTable} n'existe pas dans SQLite`, 'WARN');
      return;
    }

    // Récupérer les données
    const rows = this.sqliteDb.prepare(`SELECT * FROM ${mapping.sqliteTable}`).all() as any[];

    if (rows.length === 0) {
      this.logger.log(`⚠️  Table ${mapping.sqliteTable} est vide`, 'WARN');
      return;
    }

    this.logger.log(`📊 ${rows.length} enregistrement(s) à migrer`, 'INFO');

    // Déterminer le tenant_id
    // Pour les tables liées à une école, utiliser le mapping
    // Pour les autres, utiliser le premier tenant (ou une logique spécifique)
    const tenantId = this.getTenantIdForTable(mapping.sqliteTable, rows[0]);

    if (!tenantId) {
      this.logger.log(`⚠️  Impossible de déterminer tenant_id pour ${mapping.sqliteTable}`, 'WARN');
      return;
    }

    // Migrer chaque ligne
    let migrated = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        const transformedRow = mapping.transform
          ? mapping.transform(row, tenantId)
          : { ...row, tenant_id: tenantId };

        // Construire la requête INSERT
        const columns = Object.keys(transformedRow).filter(
          (key) => transformedRow[key] !== undefined
        );
        const values = columns.map((col) => transformedRow[col]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        const query = `
          INSERT INTO ${mapping.postgresqlTable} (${columns.join(', ')})
          VALUES (${placeholders})
          ON CONFLICT (id) DO NOTHING
        `;

        if (!this.config.dryRun) {
          await this.pgPool!.query(query, values);
        }

        migrated++;
      } catch (error: any) {
        errors++;
        this.logger.log(
          `❌ Erreur lors de la migration de l'enregistrement: ${error.message}`,
          'ERROR'
        );
        this.migrationStats.errors++;
      }
    }

    this.migrationStats.tablesMigrated++;
    this.migrationStats.recordsMigrated += migrated;

    this.logger.log(
      `✅ Table ${mapping.postgresqlTable}: ${migrated} enregistrement(s) migré(s), ${errors} erreur(s)`,
      migrated > 0 ? 'SUCCESS' : 'WARN'
    );
  }

  private getTenantIdForTable(tableName: string, sampleRow: any): string | null {
    // Si la table a un school_id, utiliser le mapping
    if (sampleRow.school_id) {
      return this.tenantMapping.get(sampleRow.school_id) || null;
    }

    // Si la table a un schoolId (camelCase)
    if (sampleRow.schoolId) {
      return this.tenantMapping.get(sampleRow.schoolId) || null;
    }

    // Pour les tables sans lien direct, utiliser le premier tenant
    if (this.tenantMapping.size > 0) {
      return Array.from(this.tenantMapping.values())[0];
    }

    return null;
  }

  // ========================================================================
  // MIGRATION PRINCIPALE
  // ========================================================================

  async migrate() {
    try {
      await this.initialize();

      if (this.config.backupBeforeMigration) {
        await this.createBackup();
      }

      // Créer les tenants depuis les écoles
      await this.createTenantsFromSchools();

      // Migrer toutes les tables
      const mapping = this.getTableMapping();
      const tablesToMigrate = Array.from(mapping.entries()).filter(
        ([_, map]) => !map.skip && map.sqliteTable
      );

      this.logger.log(`📋 ${tablesToMigrate.length} table(s) à migrer`, 'INFO');

      for (const [tableName, tableMapping] of tablesToMigrate) {
        await this.migrateTable(tableName, tableMapping);
      }

      // Afficher les statistiques
      this.logger.log('📊 Statistiques de migration:', 'INFO');
      this.logger.log(`  - Tenants créés: ${this.migrationStats.tenantsCreated}`, 'INFO');
      this.logger.log(`  - Tables migrées: ${this.migrationStats.tablesMigrated}`, 'INFO');
      this.logger.log(`  - Enregistrements migrés: ${this.migrationStats.recordsMigrated}`, 'INFO');
      this.logger.log(`  - Erreurs: ${this.migrationStats.errors}`, 'INFO');

      this.logger.log('✅ Migration terminée avec succès!', 'SUCCESS');
    } catch (error: any) {
      this.logger.log(`❌ Erreur fatale: ${error.message}`, 'ERROR');
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  async cleanup() {
    if (this.sqliteDb) {
      this.sqliteDb.close();
      this.logger.log('✅ Connexion SQLite fermée', 'INFO');
    }

    if (this.pgPool) {
      await this.pgPool.end();
      this.logger.log('✅ Connexion PostgreSQL fermée', 'INFO');
    }

    await this.logger.save();
  }
}

// ============================================================================
// INTERFACES
// ============================================================================

interface TableMapping {
  sqliteTable: string | null;
  postgresqlTable: string;
  skip: boolean;
  transform: ((row: any, tenantId: string) => any) | null;
}

// ============================================================================
// EXECUTION
// ============================================================================

async function main() {
  const config: MigrationConfig = {
    sqlitePath: process.env.SQLITE_PATH || path.join(process.env.APPDATA || '', 'academia-hub', 'academia-hub.db'),
    postgresql: {
      host: process.env.PG_HOST || 'localhost',
      port: parseInt(process.env.PG_PORT || '5432'),
      database: process.env.PG_DATABASE || 'academia_helm',
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || '',
    },
    logFile: `database/migrations/logs/migration-${new Date().toISOString().replace(/[:.]/g, '-')}.log`,
    backupBeforeMigration: process.env.BACKUP !== 'false',
    dryRun: process.env.DRY_RUN === 'true',
  };

  const migration = new SqliteToPostgresqlMigration(config);
  await migration.migrate();
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
}

export { SqliteToPostgresqlMigration, MigrationConfig };

