// Diagnostic: check what's in cahier_de_textes and teachers tables
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 30000,
    query_timeout: 60000,
  });
  await client.connect();

  // 1. Count cahier_de_textes rows
  const countResult = await client.query(`SELECT COUNT(*) FROM "cahier_de_textes";`);
  console.log(`Total cahier_de_textes rows: ${countResult.rows[0].count}`);

  // 2. Show last 5 entries with teacher info
  const last5 = await client.query(`
    SELECT ct.id, ct."testType", ct."teacherId", ct."lessonDate", ct."courseTitle", ct."testTitle",
           t."firstName" as teacher_first, t."lastName" as teacher_last, t."email" as teacher_email,
           u."email" as user_email, u."role" as user_role
    FROM "cahier_de_textes" ct
    LEFT JOIN "teachers" t ON t."id" = ct."teacherId"
    LEFT JOIN "users" u ON u."id" = ct."teacherId"
    ORDER BY ct."createdAt" DESC
    LIMIT 5;
  `);
  console.log('\n=== Last 5 cahier_de_textes entries ===');
  for (const row of last5.rows) {
    console.log(JSON.stringify({
      id: row.id,
      testType: row.testType,
      teacherId: row.teacherId,
      teacherInTeachersTable: !!row.teacher_first,
      teacherEmail: row.teacher_email,
      userEmail: row.user_email,
      userRole: row.user_role,
      lessonDate: row.lessonDate,
      courseTitle: row.courseTitle,
      testTitle: row.testTitle,
    }, null, 2));
  }

  // 3. Verify teachers.signatureUrl column
  const colCheck = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'teachers' AND column_name = 'signatureUrl';
  `);
  console.log(`\nteachers.signatureUrl column exists: ${colCheck.rows.length > 0}`);

  // 4. Show all teacher signature URLs
  const sigs = await client.query(`
    SELECT t."id", t."firstName", t."lastName", t."email",
           LENGTH(t."signatureUrl") as sig_len
    FROM "teachers" t
    WHERE t."signatureUrl" IS NOT NULL
    LIMIT 10;
  `);
  console.log(`\n=== Teachers with signature (${sigs.rows.length}) ===`);
  for (const row of sigs.rows) {
    console.log(`  ${row.firstName} ${row.lastName} <${row.email}> — sig len: ${row.sig_len}`);
  }

  // 5. Check a sample of teacher ID pairs (user.id vs teacher.id)
  const teachers = await client.query(`
    SELECT t."id" as teacher_id, t."firstName", t."lastName", t."email",
           u."id" as user_id, u."role" as user_role
    FROM "teachers" t
    LEFT JOIN "users" u ON u."email" = t."email"
    WHERE t."tenantId" = (SELECT "id" FROM "tenants" LIMIT 1)
    LIMIT 5;
  `);
  console.log(`\n=== Teacher ↔ User matching (sample) ===`);
  for (const row of teachers.rows) {
    console.log(`  Teacher: ${row.firstName} ${row.lastName} <${row.email}>`);
    console.log(`    teacher.id: ${row.teacher_id}`);
    console.log(`    user.id:   ${row.user_id || '(no matching user)'}`);
    console.log(`    user role: ${row.user_role || '—'}`);
    console.log(`    IDs match: ${row.teacher_id === row.user_id ? 'YES ✓' : 'NO ✗ (different)'}`);
  }

  await client.end();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
