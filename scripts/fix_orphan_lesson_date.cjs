// Diagnostic for the row with NULL lessonDate - check testDate, createdAt, etc.
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

  // Look at the orphan row
  const orphan = await client.query(`
    SELECT id, "teacherId", "testType", "testTitle", "courseTitle",
           "lessonDate", "testDate", "createdAt",
           "startTime", "endTime", "content"
    FROM "cahier_de_textes"
    WHERE "lessonDate" IS NULL;
  `);
  console.log(`=== Rows with NULL lessonDate (${orphan.rows.length}) ===`);
  for (const r of orphan.rows) {
    console.log(JSON.stringify(r, null, 2));
  }

  // If testDate IS NOT NULL, use it. Otherwise use createdAt (cast to date).
  const fixResult = await client.query(`
    UPDATE "cahier_de_textes"
    SET "lessonDate" = COALESCE("testDate", "createdAt"::date)
    WHERE "lessonDate" IS NULL
    RETURNING "id", "lessonDate";
  `);
  console.log(`\n=== Fixed ${fixResult.rowCount} rows ===`);
  for (const r of fixResult.rows) {
    console.log(`  ${r.id} → lessonDate = ${r.lessonDate}`);
  }

  await client.end();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
