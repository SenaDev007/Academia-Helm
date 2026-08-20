// Check if subjects have academicYearId set or NULL
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

  // Count subjects with NULL vs NOT NULL academicYearId
  const stats = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE "academicYearId" IS NULL) as null_ay,
      COUNT(*) FILTER (WHERE "academicYearId" IS NOT NULL) as not_null_ay,
      COUNT(DISTINCT "academicYearId") FILTER (WHERE "academicYearId" IS NOT NULL) as distinct_ay
    FROM "subjects";
  `);
  console.log('=== Subjects academicYearId distribution ===');
  console.log(JSON.stringify(stats.rows[0]));

  // Show academicYearId values for subjects
  const ays = await client.query(`
    SELECT "academicYearId", COUNT(*) as count
    FROM "subjects"
    WHERE "academicYearId" IS NOT NULL
    GROUP BY "academicYearId"
    ORDER BY count DESC;
  `);
  console.log('\n=== Subjects academicYearId values ===');
  for (const r of ays.rows) {
    console.log(`  academicYearId=${r.academicYearId} — ${r.count} matières`);
  }

  // Try the exact query the backend runs (for the active academic year)
  const ayRes = await client.query(`SELECT "id", "name", "label", "tenantId" FROM "academic_years" WHERE "isActive" = true;`);
  for (const ay of ayRes.rows) {
    console.log(`\n=== Active academic year: ${ay.label} (tenantId=${ay.tenantId.substring(0,8)}...) ===`);
    // Simulate: WHERE tenantId = $1 AND academicYearId = $2 AND schoolLevelId = $3
    const byLevel = await client.query(`
      SELECT sl."name" as level, COUNT(s."id") as count
      FROM "subjects" s
      LEFT JOIN "school_levels" sl ON sl."id" = s."schoolLevelId"
      WHERE s."tenantId" = $1 AND s."academicYearId" = $2
      GROUP BY sl."name" ORDER BY sl."name"
    `, [ay.tenantId, ay.id]);
    for (const r of byLevel.rows) {
      console.log(`  ${r.level || 'NULL'} — ${r.count} matières`);
    }
    // Without academicYearId filter
    const byLevelNoAY = await client.query(`
      SELECT sl."name" as level, COUNT(s."id") as count
      FROM "subjects" s
      LEFT JOIN "school_levels" sl ON sl."id" = s."schoolLevelId"
      WHERE s."tenantId" = $1
      GROUP BY sl."name" ORDER BY sl."name"
    `, [ay.tenantId]);
    console.log('  (without academicYearId filter:)');
    for (const r of byLevelNoAY.rows) {
      console.log(`    ${r.level || 'NULL'} — ${r.count} matières`);
    }
  }

  await client.end();
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
