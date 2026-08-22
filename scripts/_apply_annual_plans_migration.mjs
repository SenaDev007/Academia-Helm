/**
 * ⭐ Applique la migration 20260822200000_add_annual_plans sur Neon prod DB.
 *    Crée la table annual_plans avec FK vers tenants, academic_years, school_levels.
 *    Index sur (tenantId, academicYearId), (tenantId, classLevel, trimester), etc.
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationFile = path.join(__dirname, '..', 'apps', 'api-server', 'prisma', 'migrations', '20260822200000_add_annual_plans', 'migration.sql');

const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const sql = fs.readFileSync(migrationFile, 'utf8');
console.log('=== Applying migration: annual_plans table ===');
console.log(sql.substring(0, 200) + '...\n');

try {
  await client.query(sql);
  console.log('✅ Migration applied successfully!\n');
} catch (e) {
  console.error('❌ Migration failed:', e.message);
}

// Verify table exists
const r = await client.query(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'annual_plans'
  ORDER BY ordinal_position
`);
console.log('=== annual_plans columns ===');
r.rows.forEach(col => console.log(`  ${col.column_name} (${col.data_type}, nullable=${col.is_nullable})`));

await client.end();
process.exit(0);
