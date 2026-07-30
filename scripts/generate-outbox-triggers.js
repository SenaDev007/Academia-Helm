#!/usr/bin/env node
/**
 * ============================================================================
// OUTBOX TRIGGERS GENERATOR
 * ============================================================================
 *
 * Lit postgres-schema.json et génère les triggers SQLite pour chaque table.
 * Ces triggers captent les INSERT/UPDATE/DELETE et insèrent une entrée
 * dans _sync_outbox.
 *
 * Pour chaque table métier, 3 triggers sont créés :
 *   1. AFTER INSERT → INSERT into outbox (operation='INSERT')
 *   2. AFTER UPDATE → INSERT into outbox (operation='UPDATE')
 *   3. AFTER DELETE → INSERT into outbox (operation='DELETE')
 *
 * Usage :
 *   node scripts/generate-outbox-triggers.js
 *
 * Output :
 *   apps/desktop/src-tauri/migrations/003_outbox_triggers.sql
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, '../apps/desktop/src-tauri/migrations/postgres-schema.json');
const OUTPUT = path.join(__dirname, '../apps/desktop/src-tauri/migrations/003_outbox_triggers.sql');

// Tables système à exclure
const EXCLUDED_TABLES = new Set([
  '_prisma_migrations',
  '_sync_metadata',
  '_sync_outbox',
  '_sync_log',
]);

function main() {
  console.log('Reading schema...');
  const schema = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

  const tableNames = Object.keys(schema)
    .filter(name => !EXCLUDED_TABLES.has(name))
    .sort();

  console.log(`Generating triggers for ${tableNames.length} tables\n`);

  let sql = `-- ============================================================================
-- OUTBOX TRIGGERS — Auto-generated for ${tableNames.length} tables
-- ============================================================================
-- Generated: ${new Date().toISOString()}
--
-- These triggers capture all INSERT/UPDATE/DELETE operations and insert
-- an entry into _sync_outbox. The sync engine pushes the outbox to Neon
-- when the device is online.
-- ============================================================================

`;

  let triggerCount = 0;

  for (const tableName of tableNames) {
    const table = schema[tableName];
    const columns = table.columns.map(c => c.column_name);

    // ── INSERT trigger ──
    sql += `-- Triggers for table: ${tableName}\n`;

    const insertValues = columns.map(col => `json('${col}', NEW."${col}")`).join(', ');
    const insertJson = `json_object(${insertValues})`;

    sql += `CREATE TRIGGER IF NOT EXISTS trg_${tableName}_outbox_insert
AFTER INSERT ON "${tableName}"
FOR EACH ROW
BEGIN
    INSERT INTO _sync_outbox (table_name, record_id, operation, data, created_at, status)
    VALUES ('${tableName}', NEW."id", 'INSERT', ${insertJson}, datetime('now'), 'pending');
END;\n\n`;

    // ── UPDATE trigger ──
    const updateJson = `json_object(${insertValues})`;

    sql += `CREATE TRIGGER IF NOT EXISTS trg_${tableName}_outbox_update
AFTER UPDATE ON "${tableName}"
FOR EACH ROW
WHEN OLD."id" IS NOT NULL
BEGIN
    INSERT INTO _sync_outbox (table_name, record_id, operation, data, created_at, status)
    VALUES ('${tableName}', NEW."id", 'UPDATE', ${updateJson}, datetime('now'), 'pending');
END;\n\n`;

    // ── DELETE trigger ──
    sql += `CREATE TRIGGER IF NOT EXISTS trg_${tableName}_outbox_delete
AFTER DELETE ON "${tableName}"
FOR EACH ROW
BEGIN
    INSERT INTO _sync_outbox (table_name, record_id, operation, data, created_at, status)
    VALUES ('${tableName}', OLD."id", 'DELETE', json_object('id', OLD."id"), datetime('now'), 'pending');
END;\n\n`;

    // ── updated_at trigger (if column exists) ──
    if (columns.includes('updated_at')) {
      sql += `CREATE TRIGGER IF NOT EXISTS trg_${tableName}_set_updated_at
AFTER UPDATE ON "${tableName}"
FOR EACH ROW
WHEN NEW."updated_at" = OLD."updated_at"
BEGIN
    UPDATE "${tableName}" SET "updated_at" = datetime('now') WHERE "id" = NEW."id";
END;\n\n`;
    }

    triggerCount += 3;
    if (columns.includes('updated_at')) triggerCount++;
  }

  // Write output
  fs.writeFileSync(OUTPUT, sql);

  console.log(`✅ Triggers generated!`);
  console.log(`   Tables: ${tableNames.length}`);
  console.log(`   Triggers: ${triggerCount}`);
  console.log(`   Output: ${OUTPUT}`);
  console.log(`   File size: ${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB`);
}

main();
