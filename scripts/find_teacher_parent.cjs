const pg = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';

  console.log('[A] All ENSEIGNANT users:');
  const teachers = await client.query(`
    SELECT id, email, role, "firstName", "lastName"
    FROM users
    WHERE "tenantId" = $1 AND role = 'ENSEIGNANT'
    ORDER BY "lastName"
  `, [TENANT_ID]);
  for (const t of teachers.rows) {
    console.log(`  • ${t.lastName||''} ${t.firstName||''} — email=${t.email}`);
  }

  console.log('\n[B] Looking for teacher with email containing CSPEBE-26-00008:');
  const teacher = await client.query(`
    SELECT id, email, role, "firstName", "lastName"
    FROM users
    WHERE "tenantId" = $1 AND email ILIKE '%CSPEBE-26-00008%'
  `, [TENANT_ID]);
  console.log('Teacher:', teacher.rows);

  // Try staff table (sometimes teachers are in staff)
  console.log('\n[B2] Looking in staff table for CSPEBE-26-00008:');
  try {
    const staff = await client.query(`
      SELECT id, email, "firstName", "lastName", "employeeNumber", "tenantMatricule"
      FROM staff WHERE "tenantId" = $1 AND ("tenantMatricule" = 'CSPEBE-26-00008' OR email ILIKE '%CSPEBE-26-00008%')
    `, [TENANT_ID]);
    console.log('Staff:', staff.rows);
  } catch (e) { console.log('staff table error:', e.message); }

  console.log('\n[C] Looking for parent role users with phone 0195722234:');
  const parents = await client.query(`
    SELECT id, email, role, "firstName", "lastName"
    FROM users
    WHERE "tenantId" = $1 AND role = 'PARENT'
    LIMIT 10
  `, [TENANT_ID]);
  for (const p of parents.rows) {
    console.log(`  • ${p.lastName||''} ${p.firstName||''} — email=${p.email}`);
  }

  console.log('\n[D] Guardians with phone 0195722234:');
  try {
    const gcols = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name='guardians' ORDER BY ordinal_position
    `);
    console.log('  columns:', gcols.rows.map(r => r.column_name).join(', '));
    const guardians = await client.query(`
      SELECT * FROM guardians WHERE "tenantId" = $1 AND (phone = '0195722234' OR phone LIKE '%0195722234%')
    `, [TENANT_ID]);
    console.log('  Guardian:', guardians.rows[0] || 'not found');
  } catch (e) { console.log('  Error:', e.message); }

  // Check if there's a parent_users table or similar
  console.log('\n[E] Tables related to parents:');
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND (table_name LIKE '%parent%' OR table_name LIKE '%guardian%')
    ORDER BY table_name
  `);
  for (const r of tables.rows) console.log('  -', r.table_name);

  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
