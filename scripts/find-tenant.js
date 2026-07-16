/**
 * Identifie le tenant "Mon Avenir Plus" / "Ndali" dans la base Neon.
 */
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== Tenants contenant "avenir" ou "ndali" ===');
  const res = await client.query(`
    SELECT id, name, subdomain FROM tenants
    WHERE LOWER(name) LIKE '%avenir%' OR LOWER(name) LIKE '%ndali%' OR LOWER(subdomain) LIKE '%avenir%' OR LOWER(subdomain) LIKE '%ndali%'
    ORDER BY name
  `);
  res.rows.forEach(r => console.log(`  ${r.id} | ${r.name} | subdomain=${r.subdomain}`));

  console.log('\n=== Années académiques pour ces tenants ===');
  if (res.rows.length > 0) {
    for (const t of res.rows) {
      const years = await client.query(`SELECT id, name, "startDate", "endDate", "isActive" FROM academic_years WHERE "tenantId" = $1 ORDER BY "startDate" DESC`, [t.id]);
      console.log(`\nTenant: ${t.name} (${t.id})`);
      years.rows.forEach(y => console.log(`  ${y.id} | ${y.name} | ${y.startDate} → ${y.endDate} | active=${y.isActive}`));
    }
  }

  await client.end();
}
main().catch(e => { console.error(e); process.exit(1); });
