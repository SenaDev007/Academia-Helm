// Fix NULL lessonDate/courseTitle columns on existing cahier_de_textes rows
// created before the latest deployment that properly handles these fields.
//
// Strategy:
//   - lessonDate IS NULL → copy from testDate (if testDate IS NOT NULL)
//   - courseTitle IS NULL → copy from testTitle

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

  // Fix lessonDate = NULL
  const fixLesson = await client.query(`
    UPDATE "cahier_de_textes"
    SET "lessonDate" = "testDate"
    WHERE "lessonDate" IS NULL AND "testDate" IS NOT NULL
    RETURNING "id", "lessonDate", "testDate";
  `);
  console.log(`\n✅ Fixed lessonDate on ${fixLesson.rowCount} rows`);
  for (const r of fixLesson.rows) {
    console.log(`  ${r.id} → lessonDate = ${r.lessonDate}`);
  }

  // Fix courseTitle = NULL
  const fixCourse = await client.query(`
    UPDATE "cahier_de_textes"
    SET "courseTitle" = "testTitle"
    WHERE "courseTitle" IS NULL AND "testTitle" IS NOT NULL
    RETURNING "id", "courseTitle";
  `);
  console.log(`\n✅ Fixed courseTitle on ${fixCourse.rowCount} rows`);
  for (const r of fixCourse.rows) {
    console.log(`  ${r.id} → courseTitle = "${r.courseTitle}"`);
  }

  // Show all rows now
  const all = await client.query(`
    SELECT "id", "teacherId", "testType", "testTitle", "courseTitle", "lessonDate", "startTime", "endTime"
    FROM "cahier_de_textes"
    ORDER BY "createdAt" DESC
    LIMIT 10;
  `);
  console.log(`\n=== All rows (latest 10) ===`);
  for (const r of all.rows) {
    console.log(JSON.stringify(r));
  }

  await client.end();
  console.log('\n✅ Done');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
