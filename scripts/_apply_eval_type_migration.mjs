import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationFile = path.join(__dirname, '..', 'apps', 'api-server', 'prisma', 'migrations', '20260808120000_add_eval_type_to_report_cards', 'migration.sql');

const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const sql = fs.readFileSync(migrationFile, 'utf8');
console.log('=== Applying migration ===');
console.log(sql.substring(0, 200) + '...\n');

try {
  await client.query(sql);
  console.log('✅ Migration applied successfully!\n');
} catch (e) {
  console.error('❌ Migration failed:', e.message);
  // Continue to verify what's there
}

// Verify
const r = await client.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'report_cards' AND column_name LIKE 'evaluation%'
  ORDER BY ordinal_position
`);
console.log('=== New columns in report_cards ===');
console.log(JSON.stringify(r.rows, null, 2));

// Check existing data — see if any bulletins got evaluationTypeId backfilled
const backfill = await client.query(`
  SELECT
    COUNT(*) FILTER (WHERE "evaluationTypeId" IS NOT NULL)::int AS with_eval_type,
    COUNT(*) FILTER (WHERE "evaluationTypeId" IS NULL)::int AS without_eval_type,
    COUNT(*)::int AS total
  FROM report_cards
  WHERE "tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
`);
console.log('\n=== CSPEB report cards after backfill ===');
console.log(JSON.stringify(backfill.rows, null, 2));

await client.end();
