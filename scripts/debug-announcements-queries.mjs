import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
const USER_ID = 'dffe5ffb-06ec-4301-8ee7-4c17b396f82b';  // Saliou AKPAKI

async function test() {
  console.log('⭐ Testing listAnnouncements query for tenant:', TENANT_ID);

  // Simulate user lookup (service uses this)
  console.log('\n1. Fetching user role...');
  try {
    const r = await pool.query(`SELECT "role" FROM "users" WHERE id = $1`, [USER_ID]);
    console.log('   Role:', r.rows[0]?.role);
    const userRole = (r.rows[0]?.role || '').toUpperCase();
    const PUBLISHER_ROLES = ['DIRECTEUR_GENERAL','DIRECTEUR_ETABLISSEMENT','DIRECTEUR','DIRECTEUR_MATERNELLE','DIRECTEUR_PRIMAIRE','DIRECTEUR_SECONDAIRE','DIRECTEUR_MAT_PRI','SUPER_DIRECTOR','DEPUTY_DIRECTOR','SCHOOL_ADMIN','ADMIN','ADMINISTRATEUR','SUPER_ADMIN','PLATFORM_OWNER','PLATFORM_SUPER_ADMIN','PLATFORM_ADMIN','PROMOTER','SCHOOL_OWNER','PROMOTEUR','COMMUNICATION_MANAGER'];
    const isPublisher = PUBLISHER_ROLES.includes(userRole);
    console.log('   isPublisher:', isPublisher);
  } catch (e) { console.error('   FAIL:', e.message); }

  // Simulate listAnnouncements query (publishers branch, since Saliou is ENSEIGNANT — not publisher)
  console.log('\n2. Testing listAnnouncements query...');
  try {
    const publishedFilter = `AND a."publishedAt" IS NOT NULL AND (a."expiresAt" IS NULL OR a."expiresAt" > NOW())`;
    const r = await pool.query(`
      SELECT a.*, u."firstName" AS "authorFirstName", u."lastName" AS "authorLastName"
      FROM "chat_announcements" a
      LEFT JOIN "users" u ON u.id = a."authorId"
      WHERE a."tenantId" = $1
        ${publishedFilter}
        AND a."deletedAt" IS NULL
      ORDER BY a."publishedAt" DESC NULLS LAST, a."createdAt" DESC
      LIMIT 50 OFFSET 0
    `, [TENANT_ID]);
    console.log('   Found', r.rows.length, 'announcements');
  } catch (e) { console.error('   FAIL:', e.message); }

  // Simulate count query
  console.log('\n3. Testing count query...');
  try {
    const publishedFilter = `AND a."publishedAt" IS NOT NULL AND (a."expiresAt" IS NULL OR a."expiresAt" > NOW())`;
    const r = await pool.query(`
      SELECT count(*)::int AS total
      FROM "chat_announcements" a
      WHERE a."tenantId" = $1
        ${publishedFilter}
        AND a."deletedAt" IS NULL
    `, [TENANT_ID]);
    console.log('   Total:', r.rows[0]?.total);
  } catch (e) { console.error('   FAIL:', e.message); }

  // Test enrichAnnouncement - read receipt query
  console.log('\n4. Testing read receipt query...');
  try {
    const r = await pool.query(`
      SELECT "readAt", "confirmed" FROM "chat_announcement_reads"
      WHERE "announcementId" = 'test-id' AND "userId" = $1
    `, [USER_ID]);
    console.log('   Read receipts:', r.rows.length);
  } catch (e) { console.error('   FAIL:', e.message); }

  // Test estimateRecipients for ALL_SCHOOL
  console.log('\n5. Testing estimateRecipients ALL_SCHOOL...');
  try {
    const r = await pool.query(`SELECT count(*)::int AS cnt FROM "users" WHERE "tenantId" = $1`, [TENANT_ID]);
    console.log('   Users in tenant:', r.rows[0]?.cnt);
  } catch (e) { console.error('   FAIL:', e.message); }

  // Test the full list with computed fields
  console.log('\n6. Testing enrichment (count query with FILTER)...');
  try {
    const r = await pool.query(`
      SELECT count(*)::int AS cnt,
             count(*) FILTER (WHERE "confirmed" = true)::int AS confirmed_cnt
      FROM "chat_announcement_reads"
      WHERE "announcementId" = 'test-id' AND "tenantId" = $1
    `, [TENANT_ID]);
    console.log('   Counts:', r.rows[0]);
  } catch (e) { console.error('   FAIL:', e.message); }

  await pool.end();
}

test().catch(e => { console.error(e); process.exit(1); });
