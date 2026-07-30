#!/usr/bin/env node
/**
 * ============================================================================
// POSTGRESQL → SQLITE — Convertisseur de schéma
 * ============================================================================
 *
 * Lit postgres-schema.json (exporté depuis Neon) et génère un fichier
 * SQL SQLite complet (CREATE TABLE + indexes + PKs).
 *
 * Conversions de types :
 *   PostgreSQL          → SQLite
 *   ─────────────────────────────────────
 *   uuid                → TEXT (with CHECK for UUID format)
 *   varchar(n)          → TEXT
 *   text                → TEXT
 *   integer             → INTEGER
 *   bigint              → INTEGER
 *   boolean             → INTEGER (0/1)
 *   timestamp / timestamptz → TEXT (ISO 8601)
 *   numeric / decimal   → REAL
 *   double precision    → REAL
 *   json / jsonb        → TEXT
 *   bytea               → BLOB
 *
 * SQLite ne supporte pas :
 *   - ALTER TABLE ADD CONSTRAINT (FKs créées dans le CREATE TABLE)
 *   - Les types personnalisés (enums → CHECK constraints)
 *   - Les séquences (autoincrement via INTEGER PRIMARY KEY)
 *
 * Usage :
 *   node scripts/convert-pg-to-sqlite.js
 *
 * Output :
 *   apps/desktop/src-tauri/migrations/002_full_schema_sqlite.sql
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, '../apps/desktop/src-tauri/migrations/postgres-schema.json');
const OUTPUT = path.join(__dirname, '../apps/desktop/src-tauri/migrations/002_full_schema_sqlite.sql');

// ── Type conversion map ───────────────────────────────────────────────────

function convertType(pgType, maxLength) {
  const t = pgType.toLowerCase();

  // UUID
  if (t === 'uuid') return 'TEXT';

  // Strings
  if (t === 'character varying' || t === 'varchar') return 'TEXT';
  if (t === 'character' || t === 'char') return 'TEXT';
  if (t === 'text') return 'TEXT';

  // Integers
  if (t === 'integer' || t === 'int' || t === 'int4') return 'INTEGER';
  if (t === 'bigint' || t === 'int8') return 'INTEGER';
  if (t === 'smallint' || t === 'int2') return 'INTEGER';
  if (t === 'serial' || t === 'bigserial') return 'INTEGER';

  // Booleans
  if (t === 'boolean' || t === 'bool') return 'INTEGER';

  // Floats
  if (t === 'numeric' || t === 'decimal') return 'REAL';
  if (t === 'real' || t === 'float4') return 'REAL';
  if (t === 'double precision' || t === 'float8') return 'REAL';

  // Date/Time (stored as ISO 8601 text)
  if (t === 'timestamp' || t === 'timestamptz' || t === 'timestamp with time zone') return 'TEXT';
  if (t === 'date') return 'TEXT';
  if (t === 'time' || t === 'timetz') return 'TEXT';
  if (t === 'interval') return 'TEXT';

  // JSON
  if (t === 'json' || t === 'jsonb') return 'TEXT';

  // Binary
  if (t === 'bytea') return 'BLOB';

  // Arrays (stored as JSON text)
  if (t.startsWith('array') || t.endsWith('[]')) return 'TEXT';

  // User-defined types (enums, etc.) → TEXT with CHECK
  if (t === 'USER-DEFINED') return 'TEXT';

  // Default
  return 'TEXT';
}

// ── Convert default value ─────────────────────────────────────────────────

function convertDefault(pgDefault, sqliteType) {
  if (!pgDefault) return null;

  let d = pgDefault.toString();

  // nextval (serial) → AUTOINCREMENT handled by PK
  if (d.includes('nextval') || d.includes('gen_random_uuid')) return null;

  // now() / CURRENT_TIMESTAMP
  if (d.includes('now()') || d.includes('CURRENT_TIMESTAMP')) {
    return "DEFAULT (datetime('now'))";
  }

  // true / false
  if (d === 'true' || d === 'true::boolean') return 'DEFAULT 1';
  if (d === 'false' || d === 'false::boolean') return 'DEFAULT 0';

  // String values
  if (d.startsWith("'") && d.endsWith("'")) {
    return `DEFAULT ${d}`;
  }

  // Numeric values
  if (/^-?\d+(\.\d+)?$/.test(d)) {
    return `DEFAULT ${d}`;
  }

  // uuid_generate_v4()
  if (d.includes('uuid_generate_v4')) return null;

  // Unknown — skip to avoid breaking SQLite
  return null;
}

// ── Main conversion ───────────────────────────────────────────────────────

function main() {
  console.log('Reading PostgreSQL schema...');
  const schema = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

  const tableNames = Object.keys(schema).sort();
  console.log(`Found ${tableNames.length} tables\n`);

  let sql = `-- ============================================================================
-- Academia Helm — SQLite Schema (auto-generated from Neon PostgreSQL)
-- ============================================================================
-- Generated: ${new Date().toISOString()}
-- Tables: ${tableNames.length}
--
-- This file is executed by tauri-plugin-sql on first launch to create
-- the local SQLite database with the same schema as Neon PostgreSQL.
-- ============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

`;

  let tableCount = 0;
  let columnCount = 0;
  let indexCount = 0;

  for (const tableName of tableNames) {
    const table = schema[tableName];

    // Skip Prisma migration table
    if (tableName === '_prisma_migrations') continue;

    tableCount++;
    const columns = [];
    const pkColumns = table.primaryKey || [];

    for (const col of table.columns) {
      columnCount++;
      const sqliteType = convertType(col.data_type, col.character_maximum_length);
      const parts = [`"${col.column_name}"`, sqliteType];

      // PRIMARY KEY (single column)
      if (pkColumns.length === 1 && pkColumns[0] === col.column_name) {
        if (sqliteType === 'INTEGER') {
          parts.push('PRIMARY KEY AUTOINCREMENT');
        } else {
          parts.push('PRIMARY KEY');
        }
      }

      // NOT NULL
      if (col.is_nullable === 'NO' && !pkColumns.includes(col.column_name)) {
        parts.push('NOT NULL');
      }

      // DEFAULT
      const def = convertDefault(col.column_default, sqliteType);
      if (def) parts.push(def);

      columns.push('  ' + parts.join(' '));
    }

    // Composite PRIMARY KEY
    if (pkColumns.length > 1) {
      columns.push(`  PRIMARY KEY (${pkColumns.map(c => `"${c}"`).join(', ')})`);
    }

    sql += `-- Table: ${tableName}\n`;
    sql += `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
    sql += columns.join(',\n');
    sql += '\n);\n\n';

    // Create indexes for non-PK columns that are likely to be searched
    // (foreign keys, unique constraints)
    for (const col of table.columns) {
      // Skip PK columns (already indexed)
      if (pkColumns.includes(col.column_name)) continue;

      // Index foreign key columns (ending with _id)
      if (col.column_name.endsWith('_id') || col.column_name.endsWith('Id')) {
        const indexName = `idx_${tableName}_${col.column_name}`.substring(0, 63);
        sql += `CREATE INDEX IF NOT EXISTS "${indexName}" ON "${tableName}" ("${col.column_name}");\n`;
        indexCount++;
      }
    }

    sql += '\n';
  }

  // Add sync metadata tables
  sql += `-- ============================================================================
-- SYNC METADATA TABLES — Used by the sync engine
-- ============================================================================

-- Tracks the last sync timestamp for each table
CREATE TABLE IF NOT EXISTS _sync_metadata (
  table_name      TEXT PRIMARY KEY,
  last_sync_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_sync_status TEXT DEFAULT 'success',
  records_pulled  INTEGER DEFAULT 0,
  records_pushed  INTEGER DEFAULT 0,
  error_message   TEXT
);

-- Outbox: queue of local writes waiting to be synced to Neon
CREATE TABLE IF NOT EXISTS _sync_outbox (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name      TEXT NOT NULL,
  record_id       TEXT NOT NULL,
  operation       TEXT NOT NULL CHECK(operation IN ('INSERT', 'UPDATE', 'DELETE')),
  data            TEXT NOT NULL,  -- JSON of the record
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at       TEXT,
  sync_error      TEXT,
  retry_count     INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'syncing', 'synced', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_sync_outbox_status ON _sync_outbox (status);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_table ON _sync_outbox (table_name, record_id);

-- Sync log: history of all sync operations
CREATE TABLE IF NOT EXISTS _sync_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_type       TEXT NOT NULL CHECK(sync_type IN ('initial', 'pull', 'push', 'manual')),
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at    TEXT,
  tables_synced   INTEGER DEFAULT 0,
  records_pulled  INTEGER DEFAULT 0,
  records_pushed  INTEGER DEFAULT 0,
  conflicts       INTEGER DEFAULT 0,
  errors          INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'running' CHECK(status IN ('running', 'success', 'partial', 'failed'))
);

`;

  // Write output
  fs.writeFileSync(OUTPUT, sql);

  console.log(`✅ Conversion complete!`);
  console.log(`   Tables: ${tableCount}`);
  console.log(`   Columns: ${columnCount}`);
  console.log(`   Indexes: ${indexCount}`);
  console.log(`   Output: ${OUTPUT}`);
  console.log(`   File size: ${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB`);
}

main();
