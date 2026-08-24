const { Client } = require('/home/z/my-project/node_modules/pg');
const NEON_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

(async () => {
  const client = new Client({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  await client.connect();

  console.log('=== Tables with profile/avatar/photo ===');
  const res = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE tablename ILIKE '%profile%' OR tablename ILIKE '%avatar%' OR tablename ILIKE '%photo%' OR tablename ILIKE '%media%'
    ORDER BY tablename;
  `);
  for (const r of res.rows) console.log('  -', r.tablename);

  console.log('\n=== Fixed search: %a% ===');
  try {
    const fixed = await client.query(`
      SELECT u.id, u."firstName", u."lastName", u."email", u."role", u."tenantId",
             t."name" AS "tenantName"
      FROM "users" u
      LEFT JOIN "tenants" t ON t.id = u."tenantId"
      WHERE u.id != $1
        AND (
          LOWER(u."firstName") LIKE $2
          OR LOWER(u."lastName") LIKE $2
          OR LOWER(CONCAT(u."firstName", ' ', u."lastName")) LIKE $2
          OR LOWER(u."email") LIKE $2
        )
      ORDER BY u."lastName" ASC
      LIMIT 5;
    `, ['dummy-id', '%a%']);
    console.log('  Found', fixed.rows.length, 'results');
    for (const r of fixed.rows) {
      console.log('    -', r.firstName, r.lastName, '(' + r.email + ') role=' + r.role + ' tenant=' + (r.tenantName || 'none'));
    }
  } catch (e) { console.error('  Error:', e.message); }

  console.log('\n=== All users ===');
  const all = await client.query('SELECT "firstName", "lastName", "email", "role", "tenantId" FROM "users" LIMIT 20');
  for (const u of all.rows) {
    console.log('  -', u.firstName, u.lastName, '(' + u.email + ') role=' + u.role);
  }

  await client.end();
})().catch(e => console.error(e));
