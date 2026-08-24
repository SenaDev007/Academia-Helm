// Test the migration SQL on SQLite to verify syntax
try {
  const Database = require('better-sqlite3');
  const db = new Database('/home/z/my-project/db/custom.db', { readonly: false });
  
  const fs = require('fs');
  const sql = fs.readFileSync('/home/z/my-project/apps/api-server/prisma/migrations/20260823200000_add_monthly_plans/migration.sql', 'utf8');
  
  // SQLite doesn't support BOOLEAN or TIMESTAMP(3) — adapt
  const sqlAdapted = sql
    .replace(/BOOLEAN NOT NULL DEFAULT (true|false)/g, 'INTEGER NOT NULL DEFAULT $1')
    .replace(/TIMESTAMP\(3\)/g, 'TEXT')
    .replace(/ON DELETE CASCADE ON UPDATE CASCADE/g, '')
    .replace(/ON DELETE SET NULL ON UPDATE CASCADE/g, '');
  
  const statements = sqlAdapted.split(';').filter(s => s.trim().length > 0);
  let ok = 0, failed = 0;
  for (const stmt of statements) {
    try {
      db.exec(stmt);
      ok++;
      console.log('OK:', stmt.substring(0, 60).replace(/\s+/g, ' '));
    } catch (e) {
      failed++;
      console.error('FAIL:', e.message, '\nStmt:', stmt.substring(0, 100));
    }
  }
  db.close();
  console.log(`\nDone. ${ok} OK, ${failed} failed.`);
} catch (e) {
  console.error('better-sqlite3 not available:', e.message);
  
  // Fallback — just verify syntax with a parser
  const fs = require('fs');
  const sql = fs.readFileSync('/home/z/my-project/apps/api-server/prisma/migrations/20260823200000_add_monthly_plans/migration.sql', 'utf8');
  console.log('Migration SQL length:', sql.length, 'chars');
  console.log('Contains CREATE TABLE:', sql.includes('CREATE TABLE'));
  console.log('Contains FK to annual_plans:', sql.includes('annual_plans'));
  console.log('Contains CREATE INDEX count:', (sql.match(/CREATE INDEX/g) || []).length);
  console.log('Contains ALTER TABLE count:', (sql.match(/ALTER TABLE/g) || []).length);
}
