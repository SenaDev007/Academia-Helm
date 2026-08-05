const pg = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Check attendance_records for the child
  const r = await client.query(`
    SELECT "date", "status", "notes"
    FROM "attendance_records"
    WHERE "studentId" = 'c9a4b7d0-fadd-40a8-8ec0-c472772b5708'
    ORDER BY "date" DESC LIMIT 20
  `);
  console.log('Attendance records for child:');
  for (const row of r.rows) {
    console.log(`  ${row.date} | status=${row.status} | notes=${row.notes || '—'}`);
  }
  console.log(`Total: ${r.rows.length}`);

  await client.end();
}
main().catch(e => console.error(e.message));
