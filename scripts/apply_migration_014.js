// Migration 014 : admissionOpenDate, admissionCloseDate, admissionEnabled sur academic_years
const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('🔌 Connected to Neon\n');

  // 1. Ajouter les colonnes
  console.log('🔧 Ajout des colonnes admissionOpenDate, admissionCloseDate, admissionEnabled...');
  await client.query(`ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "admissionOpenDate" TIMESTAMP`);
  await client.query(`ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "admissionCloseDate" TIMESTAMP`);
  await client.query(`ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "admissionEnabled" BOOLEAN NOT NULL DEFAULT true`);
  console.log('✅ Colonnes ajoutées\n');

  // 2. Vérification
  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'academic_years'
      AND column_name IN ('admissionOpenDate', 'admissionCloseDate', 'admissionEnabled')
    ORDER BY column_name
  `);
  console.log('📊 Colonnes présentes :');
  cols.rows.forEach(r => console.log('  -', r.column_name));

  await client.end();
  console.log('\n🔌 Disconnected');
  console.log('🎉 Migration 014 appliquée avec succès !');
}
main().catch(e => { console.error(e); process.exit(1); });
