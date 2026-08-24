// Fix the existing cahier_de_textes rows where teacherId was stored as user.id
// instead of teacher.id (matched by email). This is a one-time data migration
// to repair rows created before the resolveTeacherId fix was deployed.
//
// For each row in cahier_de_textes:
//   - If teacherId matches a row in teachers (good, no change)
//   - Else, find a teacher with the same email as the user matching teacherId
//   - If found, update teacherId to that teacher.id
//   - Else, log a warning (no teacher profile for this user)

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
  console.log('✅ Connected to Neon prod DB');

  // 1. Find rows where teacherId is NOT in teachers table (likely user.id)
  const broken = await client.query(`
    SELECT ct.id, ct."teacherId", ct."testType", ct."testTitle",
           u.email as user_email, u.role as user_role,
           t.id as resolved_teacher_id, t."firstName", t."lastName"
    FROM "cahier_de_textes" ct
    LEFT JOIN "teachers" t_check ON t_check.id = ct."teacherId"
    LEFT JOIN "users" u ON u.id = ct."teacherId"
    LEFT JOIN "teachers" t ON t.email = u.email
    WHERE t_check.id IS NULL
    ORDER BY ct."createdAt" DESC;
  `);

  console.log(`\n=== Found ${broken.rows.length} rows with wrong teacherId (user.id instead of teacher.id) ===\n`);

  let fixed = 0;
  let noTeacherMatch = 0;
  for (const row of broken.rows) {
    if (row.resolved_teacher_id) {
      console.log(`FIX  ${row.id} — "${row.testTitle}"`);
      console.log(`     OLD teacherId: ${row.teacherId} (user.id, email=${row.user_email})`);
      console.log(`     NEW teacherId: ${row.resolved_teacher_id} (${row.firstName} ${row.lastName})`);
      await client.query(
        `UPDATE "cahier_de_textes" SET "teacherId" = $1 WHERE "id" = $2`,
        [row.resolved_teacher_id, row.id],
      );
      fixed++;
    } else {
      console.log(`SKIP ${row.id} — "${row.testTitle}"`);
      console.log(`     teacherId: ${row.teacherId}`);
      console.log(`     user email: ${row.user_email || '(no user found)'}`);
      console.log(`     → no matching teacher profile, skipping`);
      noTeacherMatch++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Fixed (teacherId updated): ${fixed}`);
  console.log(`  Skipped (no teacher match): ${noTeacherMatch}`);
  console.log(`  Total broken rows: ${broken.rows.length}`);

  // Also fix teacher_material_assignments if same issue exists
  const brokenAssignments = await client.query(`
    SELECT tma.id, tma."teacherId", u.email as user_email,
           t.id as resolved_teacher_id, t."firstName", t."lastName"
    FROM "teacher_material_assignments" tma
    LEFT JOIN "teachers" t_check ON t_check.id = tma."teacherId"
    LEFT JOIN "users" u ON u.id = tma."teacherId"
    LEFT JOIN "teachers" t ON t.email = u.email
    WHERE t_check.id IS NULL;
  `);
  console.log(`\n=== teacher_material_assignments: ${brokenAssignments.rows.length} broken rows ===`);
  let fixedAssignments = 0;
  for (const row of brokenAssignments.rows) {
    if (row.resolved_teacher_id) {
      await client.query(
        `UPDATE "teacher_material_assignments" SET "teacherId" = $1 WHERE "id" = $2`,
        [row.resolved_teacher_id, row.id],
      );
      fixedAssignments++;
    }
  }
  console.log(`  Fixed: ${fixedAssignments}`);

  await client.end();
  console.log('\n✅ Done');
}

main().catch(err => {
  console.error('Error:', err.message);
  console.error(err);
  process.exit(1);
});
