// Vérification des paramètres d'admission dans Neon DB
const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('🔌 Connected to Neon\n');

  // 1. Lister toutes les années scolaires avec leurs paramètres d'admission
  console.log('📊 Toutes les années scolaires :');
  const res = await client.query(`
    SELECT id, name, "isActive",
      "admissionEnabled",
      "admissionOpenDate",
      "admissionCloseDate",
      "updatedAt"
    FROM academic_years
    ORDER BY name DESC
    LIMIT 10
  `);
  console.table(res.rows);

  // 2. Vérifier l'année active
  console.log('\n📊 Année active :');
  const active = await client.query(`
    SELECT id, name, "admissionEnabled",
      "admissionOpenDate",
      "admissionCloseDate"
    FROM academic_years
    WHERE "isActive" = true
  `);
  console.table(active.rows);

  // 3. Vérifier les tenants
  console.log('\n📊 Tenants :');
  const tenants = await client.query(`
    SELECT id, name FROM tenants LIMIT 5
  `);
  console.table(tenants.rows);

  await client.end();
  console.log('\n🔌 Disconnected');
}

main().catch(e => { console.error(e); process.exit(1); });
