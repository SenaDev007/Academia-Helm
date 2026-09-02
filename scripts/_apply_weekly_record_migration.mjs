/**
 * ⭐ Applique la migration 20260903000000_add_weekly_record_fields sur Neon prod DB.
 *    Ajoute documentType, headTeacherInitials, headTeacherDate,
 *    headTeacherSignature, weekDates à monthly_plans + data fix EN-termes.
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationFile = path.join(__dirname, '..', 'apps', 'api-server', 'prisma', 'migrations', '20260903000000_add_weekly_record_fields', 'migration.sql');

const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const sql = fs.readFileSync(migrationFile, 'utf8');
console.log('=== Applying migration 20260903000000_add_weekly_record_fields ===\n');

try {
  await client.query(sql);
  console.log('✅ Migration applied successfully!\n');
} catch (e) {
  console.error('❌ Migration failed:', e.message);
  process.exit(1);
}

// Vérifications
try {
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'monthly_plans'
      AND column_name IN ('documentType','headTeacherInitials','headTeacherDate','headTeacherSignature','weekDates')
    ORDER BY column_name;
  `);
  console.log('=== Vérification colonnes ===');
  for (const c of cols.rows) {
    console.log(`  ${c.column_name}: ${c.data_type}, nullable=${c.is_nullable}, default=${c.column_default}`);
  }

  const counts = await client.query(`
    SELECT "documentType", COUNT(*)::int AS n
    FROM "monthly_plans"
    GROUP BY "documentType"
    ORDER BY "documentType";
  `);
  console.log('\n=== Répartition documentType ===');
  for (const r of counts.rows) {
    console.log(`  ${r.documentType}: ${r.n} lignes`);
  }

  const idx = await client.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'monthly_plans' AND indexname = 'monthly_plans_doc_type_idx';
  `);
  console.log(`\nIndex monthly_plans_doc_type_idx: ${idx.rows.length > 0 ? '✅ existe' : '❌ manquant'}`);
} catch (e) {
  console.error('❌ Verification failed:', e.message);
} finally {
  await client.end();
}
