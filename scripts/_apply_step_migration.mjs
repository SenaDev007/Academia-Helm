/**
 * ⭐ Applique la migration 20260822100000_add_step_to_timetable_entries sur Neon prod DB.
 *    Ajoute la colonne `step TEXT` (nullable) à la table `timetable_entries`.
 *    Utilisée pour stocker l'étape (1-8) d'une séance de Lecture-Écriture au CI/CP.
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationFile = path.join(__dirname, '..', 'apps', 'api-server', 'prisma', 'migrations', '20260822100000_add_step_to_timetable_entries', 'migration.sql');

const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const sql = fs.readFileSync(migrationFile, 'utf8');
console.log('=== Applying migration ===');
console.log(sql);
console.log('');

try {
  await client.query(sql);
  console.log('✅ Migration applied successfully!\n');
} catch (e) {
  console.error('❌ Migration failed:', e.message);
  // Continue to verify what's there
}

// Verify
const r = await client.query(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'timetable_entries' AND column_name = 'step'
`);

if (r.rows.length === 0) {
  console.log('❌ Column `step` NOT found in timetable_entries');
} else {
  const col = r.rows[0];
  console.log(`✅ Column \`step\` exists: ${col.data_type}, nullable=${col.is_nullable}`);
}

await client.end();
process.exit(0);
