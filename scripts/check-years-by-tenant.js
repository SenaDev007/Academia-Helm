// Vérifier les années scolaires par tenant
const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('📊 Années scolaires par tenant :');
  const res = await client.query(`
    SELECT
      t.name AS tenant,
      ay.id,
      ay.name,
      ay."isActive",
      ay."admissionEnabled",
      ay."admissionOpenDate",
      ay."admissionCloseDate",
      ay."updatedAt"
    FROM academic_years ay
    JOIN tenants t ON t.id = ay."tenantId"
    ORDER BY t.name, ay.name
  `);
  console.table(res.rows);

  // Compter les années actives par tenant
  console.log('\n📊 Nombre d\'années actives par tenant :');
  const active = await client.query(`
    SELECT t.name AS tenant, COUNT(*) AS active_count
    FROM academic_years ay
    JOIN tenants t ON t.id = ay."tenantId"
    WHERE ay."isActive" = true
    GROUP BY t.name
  `);
  console.table(active.rows);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
