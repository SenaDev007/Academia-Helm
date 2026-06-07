/**
 * Générateur de Schéma SQLite Amélioré
 * 
 * Utilise Prisma pour parser le schéma de manière fiable
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getDMMF } from '@prisma/internals';

/**
 * Convertit un type Prisma en type SQLite
 */
function prismaToSQLiteType(prismaType: string): string {
  // Types de base
  const typeMap: Record<string, string> = {
    'String': 'TEXT',
    'Int': 'INTEGER',
    'BigInt': 'INTEGER',
    'Float': 'REAL',
    'Decimal': 'REAL',
    'Boolean': 'INTEGER', // SQLite n'a pas de type BOOLEAN natif
    'DateTime': 'TEXT', // Stocké en ISO 8601
    'Json': 'TEXT', // Stocké en JSON string
    'Bytes': 'BLOB',
  };

  // Gestion des types avec @db
  if (prismaType.includes('@db.')) {
    const dbType = prismaType.split('@db.')[1].trim();
    if (dbType.startsWith('Decimal')) {
      return 'REAL';
    }
    if (dbType.startsWith('VarChar') || dbType.startsWith('Text')) {
      return 'TEXT';
    }
    if (dbType.startsWith('Int') || dbType.startsWith('BigInt')) {
      return 'INTEGER';
    }
  }

  // Type de base
  const baseType = prismaType.split('?')[0].split('[')[0].trim();
  return typeMap[baseType] || 'TEXT';
}

/**
 * Génère la définition SQL d'une colonne
 */
function generateColumnSQL(field: any, isPrimaryKey: boolean): string {
  const sqliteType = prismaToSQLiteType(field.type);
  let sql = `  ${field.name} ${sqliteType}`;

  // PRIMARY KEY
  if (isPrimaryKey) {
    if (field.type === 'String' && field.defaultValue?.includes('uuid')) {
      sql += ' PRIMARY KEY';
    } else if (field.type === 'Int' || field.type === 'BigInt') {
      sql += ' PRIMARY KEY AUTOINCREMENT';
    } else {
      sql += ' PRIMARY KEY';
    }
  }

  // NOT NULL
  if (!field.isOptional && !field.defaultValue && !isPrimaryKey) {
    sql += ' NOT NULL';
  }

  // DEFAULT
  if (field.defaultValue) {
    if (field.defaultValue === 'now()') {
      sql += " DEFAULT (datetime('now'))";
    } else if (field.defaultValue === 'uuid()') {
      // UUID généré côté application
    } else if (field.defaultValue === 'true' || field.defaultValue === 'false') {
      sql += ` DEFAULT ${field.defaultValue === 'true' ? '1' : '0'}`;
    } else if (typeof field.defaultValue === 'string' && field.defaultValue.startsWith('[')) {
      sql += " DEFAULT '[]'"; // Tableau vide
    } else if (typeof field.defaultValue === 'string' && field.defaultValue.startsWith('{')) {
      sql += " DEFAULT '{}'"; // Objet vide
    } else if (typeof field.defaultValue === 'string') {
      sql += ` DEFAULT '${field.defaultValue.replace(/'/g, "''")}'`;
    } else {
      sql += ` DEFAULT ${field.defaultValue}`;
    }
  }

  return sql;
}

/**
 * Génère le schéma SQLite complet à partir du DMMF Prisma
 */
async function generateSQLiteSchemaFromPrisma(schemaPath: string): Promise<string> {
  const schemaContent = readFileSync(schemaPath, 'utf-8');
  
  // Parser le schéma avec Prisma
  const dmmf = await getDMMF({ datamodel: schemaContent });

  const sql: string[] = [];

  sql.push('-- ============================================================================');
  sql.push('-- SQLITE SCHEMA - ACADEMIA HUB (MIRROIR POSTGRESQL)');
  sql.push('-- ============================================================================');
  sql.push('--');
  sql.push('-- Ce schéma est généré automatiquement à partir de schema.prisma');
  sql.push('-- PostgreSQL = source unique de vérité');
  sql.push('-- SQLite = miroir exact pour offline-first');
  sql.push('--');
  sql.push('-- GÉNÉRATION : Automatique via generate-sqlite-schema-improved.ts');
  sql.push('-- VERSION : Vérifier la correspondance avec schema.prisma');
  sql.push('-- ============================================================================');
  sql.push('');
  sql.push('PRAGMA foreign_keys = ON;');
  sql.push('PRAGMA journal_mode = WAL;');
  sql.push('PRAGMA synchronous = NORMAL;');
  sql.push('');

  // Générer les tables
  for (const model of dmmf.datamodel.models) {
    // Ignorer les tables techniques de sync (seront ajoutées séparément)
    if (['SyncOperation', 'SyncConflict', 'SyncLog'].includes(model.name)) {
      continue;
    }

    const tableName = model.dbName || model.name.toLowerCase();

    sql.push(`-- ============================================================================`);
    sql.push(`-- TABLE: ${tableName} (${model.name})`);
    sql.push(`-- ============================================================================`);
    sql.push(`CREATE TABLE IF NOT EXISTS ${tableName} (`);

    const columns: string[] = [];
    const primaryKeys = model.primaryKey?.fields || [];
    
    for (const field of model.fields) {
      // Ignorer les champs de relation
      if (field.relationName) {
        continue;
      }

      const isPrimaryKey = primaryKeys.includes(field.name);
      columns.push(generateColumnSQL({
        name: field.dbName || field.name,
        type: field.type,
        isOptional: !field.isRequired,
        defaultValue: field.default ? (field.default as any).value : undefined,
      }, isPrimaryKey));
    }

    // Ajouter les colonnes techniques locales
    columns.push('  sync_status TEXT DEFAULT \'pending\'', // pending, synced, conflict
                 '  local_updated_at TEXT DEFAULT (datetime(\'now\'))',
                 '  local_device_id TEXT');

    sql.push(columns.join(',\n'));
    sql.push(');');
    sql.push('');

    // Créer les index
    for (const index of model.indexes || []) {
      const indexFields = index.fields.map(f => f.name).join(', ');
      const indexName = `idx_${tableName}_${indexFields.replace(/,/g, '_').replace(/\s+/g, '_')}`;
      sql.push(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${indexFields});`);
    }

    // Index pour les colonnes techniques
    sql.push(`CREATE INDEX IF NOT EXISTS idx_${tableName}_sync_status ON ${tableName} (sync_status);`);
    sql.push(`CREATE INDEX IF NOT EXISTS idx_${tableName}_local_updated_at ON ${tableName} (local_updated_at);`);
    sql.push('');
  }

  // Ajouter les tables techniques de synchronisation
  sql.push('-- ============================================================================');
  sql.push('-- TABLES TECHNIQUES DE SYNCHRONISATION');
  sql.push('-- ============================================================================');
  sql.push('');
  
  sql.push('CREATE TABLE IF NOT EXISTS sync_operations (');
  sql.push('  id TEXT PRIMARY KEY,');
  sql.push('  tenant_id TEXT NOT NULL,');
  sql.push('  operation_type TEXT NOT NULL, -- UPLOAD, DOWNLOAD, FULL_SYNC');
  sql.push('  status TEXT NOT NULL DEFAULT \'PENDING\',');
  sql.push('  started_at TEXT NOT NULL DEFAULT (datetime(\'now\')),');
  sql.push('  completed_at TEXT,');
  sql.push('  records_count INTEGER,');
  sql.push('  error_message TEXT,');
  sql.push('  metadata TEXT -- JSON');
  sql.push(');');
  sql.push('');

  sql.push('CREATE TABLE IF NOT EXISTS sync_conflicts (');
  sql.push('  id TEXT PRIMARY KEY,');
  sql.push('  tenant_id TEXT NOT NULL,');
  sql.push('  operation_id TEXT NOT NULL,');
  sql.push('  table_name TEXT NOT NULL,');
  sql.push('  record_id TEXT NOT NULL,');
  sql.push('  local_data TEXT NOT NULL, -- JSON');
  sql.push('  remote_data TEXT NOT NULL, -- JSON');
  sql.push('  resolution TEXT, -- LOCAL, REMOTE, MANUAL');
  sql.push('  resolved_by TEXT,');
  sql.push('  resolved_at TEXT,');
  sql.push('  created_at TEXT NOT NULL DEFAULT (datetime(\'now\'))');
  sql.push(');');
  sql.push('');

  sql.push('CREATE TABLE IF NOT EXISTS sync_logs (');
  sql.push('  id TEXT PRIMARY KEY,');
  sql.push('  tenant_id TEXT NOT NULL,');
  sql.push('  operation_id TEXT NOT NULL,');
  sql.push('  level TEXT NOT NULL, -- INFO, WARNING, ERROR');
  sql.push('  message TEXT NOT NULL,');
  sql.push('  details TEXT, -- JSON');
  sql.push('  created_at TEXT NOT NULL DEFAULT (datetime(\'now\'))');
  sql.push(');');
  sql.push('');

  sql.push('CREATE TABLE IF NOT EXISTS schema_version (');
  sql.push('  version TEXT PRIMARY KEY,');
  sql.push('  prisma_schema_hash TEXT NOT NULL,');
  sql.push('  applied_at TEXT NOT NULL DEFAULT (datetime(\'now\'))');
  sql.push(');');
  sql.push('');

  return sql.join('\n');
}

/**
 * Point d'entrée principal
 */
async function main() {
  const schemaPath = join(__dirname, '../prisma/schema.prisma');
  const outputPath = join(__dirname, '../prisma/sqlite-schema.sql');

  console.log('🔄 Génération du schéma SQLite à partir de schema.prisma...');
  console.log(`📄 Lecture: ${schemaPath}`);

  try {
    const sqliteSchema = await generateSQLiteSchemaFromPrisma(schemaPath);
    
    writeFileSync(outputPath, sqliteSchema, 'utf-8');
    
    // Compter les tables
    const tableMatches = sqliteSchema.match(/CREATE TABLE IF NOT EXISTS (\w+)/g);
    const tableCount = tableMatches ? tableMatches.length : 0;
    
    console.log(`✅ Schéma SQLite généré: ${outputPath}`);
    console.log(`📊 ${tableCount} tables générées`);

    // Générer aussi un hash pour la validation
    const crypto = require('crypto');
    const schemaHash = crypto.createHash('sha256').update(sqliteSchema).digest('hex');
    console.log(`🔐 Hash du schéma: ${schemaHash.substring(0, 16)}...`);

  } catch (error: any) {
    console.error('❌ Erreur lors de la génération:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { generateSQLiteSchemaFromPrisma, prismaToSQLiteType };

