/**
 * Investigate why user search isn't working — check users table schema.
 */
const { Client } = require('/home/z/my-project/node_modules/pg');
const NEON_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

(async () => {
  const client = new Client({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  await client.connect();

  // 1. Check users table columns
  console.log('=== users table columns ===');
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position;
  `);
  for (const c of cols.rows) {
    console.log(`  - ${c.column_name} (${c.data_type}, ${c.is_nullable === 'YES' ? 'nullable' : 'NOT NULL'})`);
  }

  // 2. Check if user_roles table exists
  console.log('\n=== user_roles table columns ===');
  const urCols = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'user_roles'
    ORDER BY ordinal_position;
  `);
  if (urCols.rows.length === 0) {
    console.log('  ⚠️ user_roles table does NOT exist!');
  } else {
    for (const c of urCols.rows) {
      console.log(`  - ${c.column_name} (${c.data_type})`);
    }
  }

  // 3. Count users
  console.log('\n=== User count ===');
  const userCount = await client.query('SELECT COUNT(*)::int AS count FROM "users"');
  console.log(`  Total users: ${userCount.rows[0].count}`);

  // 4. Sample 5 users to see what data we have
  console.log('\n=== Sample users (5) ===');
  const sample = await client.query(`
    SELECT id, "firstName", "lastName", "email", "tenantId", "avatarUrl"
    FROM "users"
    LIMIT 5;
  `);
  for (const u of sample.rows) {
    console.log(`  - id=${u.id.substring(0, 8)}... firstName="${u.firstName}" lastName="${u.lastName}" email="${u.email}" tenantId=${u.tenantId ? u.tenantId.substring(0, 8) + '...' : 'NULL'}`);
  }

  // 5. Try the actual search query
  console.log('\n=== Test search query (q="saliou") ===');
  try {
    const testSearch = await client.query(`
      SELECT u.id, u."firstName", u."lastName", u."email", u."tenantId"
      FROM "users" u
      WHERE LOWER(u."firstName") LIKE $1
         OR LOWER(u."lastName") LIKE $1
         OR LOWER(u."email") LIKE $1
      LIMIT 5;
    `, ['%saliou%']);
    console.log(`  Found ${testSearch.rows.length} results`);
    for (const r of testSearch.rows) {
      console.log(`    - ${r.firstName} ${r.lastName} (${r.email})`);
    }
  } catch (e) {
    console.error('  ❌ Search failed:', e.message);
  }

  // 6. Try with all tenants join
  console.log('\n=== Test full search query with tenant join ===');
  try {
    const fullSearch = await client.query(`
      SELECT u.id, u."firstName", u."lastName", u."email", u."avatarUrl",
             ur."role", t."name" AS "tenantName", u."tenantId"
      FROM "users" u
      LEFT JOIN "user_roles" ur ON ur."userId" = u.id
      LEFT JOIN "tenants" t ON t.id = u."tenantId"
      WHERE u.id != 'dummy-id'
        AND (
          LOWER(u."firstName") LIKE $1
          OR LOWER(u."lastName") LIKE $1
          OR LOWER(CONCAT(u."firstName", ' ', u."lastName")) LIKE $1
          OR LOWER(u."email") LIKE $1
        )
      ORDER BY u."lastName" ASC
      LIMIT 5;
    `, ['%a%']);
    console.log(`  Found ${fullSearch.rows.length} results`);
    for (const r of fullSearch.rows) {
      console.log(`    - ${r.firstName} ${r.lastName} (${r.email || 'no email'}) role=${r.role || 'none'} tenant=${r.tenantName || 'none'}`);
    }
  } catch (e) {
    console.error('  ❌ Full search failed:', e.message);
  }

  await client.end();
})();
