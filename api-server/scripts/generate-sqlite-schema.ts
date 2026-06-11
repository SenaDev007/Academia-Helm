/**
 * Générateur de Schéma SQLite à partir de Prisma Schema
 * 
 * OBJECTIF : Générer automatiquement un schéma SQLite strictement conforme
 * au schéma PostgreSQL défini dans schema.prisma
 * 
 * PRINCIPE : PostgreSQL = source unique de vérité
 *           SQLite = miroir exact pour offline-first
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse } from '@prisma/schema-parser';

interface PrismaField {
  name: string;
  type: string;
  isOptional: boolean;
  isId: boolean;
  defaultValue?: string;
  isUnique?: boolean;
  relation?: string;
}

interface PrismaModel {
  name: string;
  tableName: string;
  fields: PrismaField[];
  indexes: string[];
}

/**
 * Convertit un type Prisma en type SQLite
 */
function prismaToSQLiteType(prismaType: string, isOptional: boolean): string {
  // Types de base
  const typeMap: Record<string, string> = {
    'String': 'TEXT',
    'Int': 'INTEGER',
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
function generateColumnSQL(field: PrismaField, modelName: string): string {
  const sqliteType = prismaToSQLiteType(field.type, field.isOptional);
  let sql = `  ${field.name} ${sqliteType}`;

  // PRIMARY KEY
  if (field.isId) {
    // Pour UUID, on utilise TEXT avec génération côté application
    if (field.type === 'String' && field.defaultValue?.includes('uuid()')) {
      sql += ' PRIMARY KEY';
    } else if (field.type === 'Int') {
      sql += ' PRIMARY KEY AUTOINCREMENT';
    } else {
      sql += ' PRIMARY KEY';
    }
  }

  // NOT NULL (sauf si optionnel ou avec valeur par défaut)
  if (!field.isOptional && !field.defaultValue && !field.isId) {
    sql += ' NOT NULL';
  }

  // DEFAULT
  if (field.defaultValue) {
    if (field.defaultValue === 'now()') {
      sql += " DEFAULT (datetime('now'))";
    } else if (field.defaultValue === 'uuid()') {
      // UUID généré côté application, pas de DEFAULT SQL
    } else if (field.defaultValue === 'true' || field.defaultValue === 'false') {
      sql += ` DEFAULT ${field.defaultValue === 'true' ? '1' : '0'}`;
    } else if (field.defaultValue.startsWith('@default')) {
      // Valeur par défaut complexe, à gérer selon le cas
      if (field.defaultValue.includes('[]')) {
        sql += " DEFAULT '[]'"; // Tableau vide en JSON
      } else if (field.defaultValue.includes('{}')) {
        sql += " DEFAULT '{}'"; // Objet vide en JSON
      }
    } else {
      sql += ` DEFAULT ${field.defaultValue}`;
    }
  }

  return sql;
}

/**
 * Parse le schéma Prisma et extrait les modèles
 */
function parsePrismaSchema(schemaPath: string): PrismaModel[] {
  const schemaContent = readFileSync(schemaPath, 'utf-8');
  const models: PrismaModel[] = [];

  // Regex pour extraire les modèles
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/gs;
  let match;

  while ((match = modelRegex.exec(schemaContent)) !== null) {
    const modelName = match[1];
    const modelBody = match[2];

    // Extraire le nom de table (@@map)
    const mapMatch = modelBody.match(/@@map\("([^"]+)"\)/);
    const tableName = mapMatch ? mapMatch[1] : modelName.toLowerCase();

    // Extraire les champs
    const fields: PrismaField[] = [];
    const fieldRegex = /(\w+)\s+(\S+?)(\s+@[^@\n]+)?/g;
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(modelBody)) !== null) {
      const fieldName = fieldMatch[1];
      const fieldType = fieldMatch[2];
      const attributes = fieldMatch[3] || '';

      // Ignorer les relations (lignes avec @relation)
      if (attributes.includes('@relation')) {
        continue;
      }

      // Ignorer les directives @@
      if (fieldName.startsWith('@@')) {
        continue;
      }

      const isOptional = fieldType.endsWith('?');
      const isId = attributes.includes('@id');
      const isUnique = attributes.includes('@unique');
      const defaultValueMatch = attributes.match(/@default\(([^)]+)\)/);
      const defaultValue = defaultValueMatch ? defaultValueMatch[1] : undefined;

      fields.push({
        name: fieldName,
        type: fieldType,
        isOptional,
        isId,
        defaultValue,
        isUnique,
      });
    }

    // Extraire les index (@@index)
    const indexes: string[] = [];
    const indexRegex = /@@index\(\[([^\]]+)\]\)/g;
    let indexMatch;
    while ((indexMatch = indexRegex.exec(modelBody)) !== null) {
      const indexFields = indexMatch[1].split(',').map(f => f.trim().replace(/"/g, ''));
      indexes.push(indexFields.join(', '));
    }

    models.push({
      name: modelName,
      tableName,
      fields,
      indexes,
    });
  }

  return models;
}

/**
 * Génère le schéma SQLite complet
 */
function generateSQLiteSchema(models: PrismaModel[]): string {
  const sql: string[] = [];

  sql.push('-- ============================================================================');
  sql.push('-- SQLITE SCHEMA - ACADEMIA HUB (MIRROIR POSTGRESQL)');
  sql.push('-- ============================================================================');
  sql.push('--');
  sql.push('-- Ce schéma est généré automatiquement à partir de schema.prisma');
  sql.push('-- PostgreSQL = source unique de vérité');
  sql.push('-- SQLite = miroir exact pour offline-first');
  sql.push('--');
  sql.push('-- GÉNÉRATION : Automatique via generate-sqlite-schema.ts');
  sql.push('-- VERSION : Vérifier la correspondance avec schema.prisma');
  sql.push('-- ============================================================================');
  sql.push('');
  sql.push('PRAGMA foreign_keys = ON;');
  sql.push('PRAGMA journal_mode = WAL;');
  sql.push('PRAGMA synchronous = NORMAL;');
  sql.push('');

  // Générer les tables
  for (const model of models) {
    // Ignorer les tables techniques de sync (seront ajoutées séparément)
    if (['SyncOperation', 'SyncConflict', 'SyncLog'].includes(model.name)) {
      continue;
    }

    sql.push(`-- ============================================================================`);
    sql.push(`-- TABLE: ${model.tableName} (${model.name})`);
    sql.push(`-- ============================================================================`);
    sql.push(`CREATE TABLE IF NOT EXISTS ${model.tableName} (`);

    const columns: string[] = [];
    for (const field of model.fields) {
      // Ignorer les champs de relation (seront gérés via FK si nécessaire)
      if (field.relation) {
        continue;
      }
      columns.push(generateColumnSQL(field, model.name));
    }

    // Ajouter les colonnes techniques locales
    columns.push('  sync_status TEXT DEFAULT \'pending\'', // pending, synced, conflict
                 '  local_updated_at TEXT DEFAULT (datetime(\'now\'))',
                 '  local_device_id TEXT');

    sql.push(columns.join(',\n'));
    sql.push(');');
    sql.push('');

    // Créer les index
    for (const indexFields of model.indexes) {
      const indexName = `idx_${model.tableName}_${indexFields.replace(/,/g, '_').replace(/\s+/g, '_')}`;
      sql.push(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${model.tableName} (${indexFields});`);
    }

    // Index pour les colonnes techniques
    sql.push(`CREATE INDEX IF NOT EXISTS idx_${model.tableName}_sync_status ON ${model.tableName} (sync_status);`);
    sql.push(`CREATE INDEX IF NOT EXISTS idx_${model.tableName}_local_updated_at ON ${model.tableName} (local_updated_at);`);
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
function main() {
  const schemaPath = join(__dirname, '../prisma/schema.prisma');
  const outputPath = join(__dirname, '../prisma/sqlite-schema.sql');

  console.log('🔄 Génération du schéma SQLite à partir de schema.prisma...');
  console.log(`📄 Lecture: ${schemaPath}`);

  try {
    const models = parsePrismaSchema(schemaPath);
    console.log(`✅ ${models.length} modèles détectés`);

    const sqliteSchema = generateSQLiteSchema(models);
    
    writeFileSync(outputPath, sqliteSchema, 'utf-8');
    console.log(`✅ Schéma SQLite généré: ${outputPath}`);
    console.log(`📊 ${models.length} tables générées`);

    // Générer aussi un hash pour la validation
    const crypto = require('crypto');
    const schemaHash = crypto.createHash('sha256').update(sqliteSchema).digest('hex');
    console.log(`🔐 Hash du schéma: ${schemaHash.substring(0, 16)}...`);

  } catch (error) {
    console.error('❌ Erreur lors de la génération:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { generateSQLiteSchema, parsePrismaSchema, prismaToSQLiteType };

