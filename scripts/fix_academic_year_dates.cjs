const pg = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Fix the 2026-2027 academic year dates for CSPEB tenant
  // Pre-rentrée: Monday September 7, 2026 (1st Monday of September)
  // Rentrée officielle: Monday September 14, 2026 (pre-rentrée + 1 week)
  // Start date: September 14, 2026
  // End date: Last Friday of June 2027

  // Calculate: September 1, 2026 is a Tuesday
  // First Monday = September 7
  // Second Monday (rentrée) = September 14

  await client.query(`
    UPDATE academic_years
    SET "preEntryDate" = '2026-09-07',
        "officialStartDate" = '2026-09-14',
        "startDate" = '2026-09-14'
    WHERE name = '2026-2027'
      AND "tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
  `);
  console.log('✓ Updated 2026-2027 dates: pre-rentrée=Sept 7, rentrée=Sept 14');

  // Also update school_calendar_configs if exists
  await client.query(`
    UPDATE school_calendar_configs
    SET "preEntryWeekNumber" = 1
    WHERE "tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
  `).catch(() => console.log('(no school_calendar_configs table or rows)'));

  // Verify
  const r = await client.query(`
    SELECT name, "preEntryDate", "officialStartDate", "startDate", "endDate"
    FROM academic_years
    WHERE "tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    ORDER BY "startDate" DESC LIMIT 5
  `);
  for (const row of r.rows) {
    console.log(`  ${row.name}: pre=${row.preEntryDate?.toISOString().substring(0,10)} | rentrée=${row.officialStartDate?.toISOString().substring(0,10)} | start=${row.startDate?.toISOString().substring(0,10)} | end=${row.endDate?.toISOString().substring(0,10)}`);
  }

  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
