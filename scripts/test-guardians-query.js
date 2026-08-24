const { Client } = require('/home/z/my-project/node_modules/pg');
const NEON_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
(async () => {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const r = await client.query('SELECT id FROM tenants LIMIT 3');
  const tid = r.rows[0].id;
  console.log('Tenant ID:', tid);
  try {
    const g = await client.query('SELECT g.id, g."userId", g."firstName", g."lastName", g."email" FROM guardians g WHERE g."tenantId" = $1 LIMIT 10', [tid]);
    console.log('Guardians found:', g.rows.length);
    for (const g2 of g.rows) console.log('  -', g2.firstName, g2.lastName, 'userId=' + (g2.userid || 'NULL'));
  } catch (e) { console.error('SQL ERROR:', e.message); }
  await client.end();
})().catch(e => console.error(e));
