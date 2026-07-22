// Compare existing columns to expected schema and ALTER TABLE to add missing columns
import pg from 'pg';

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

// Expected columns per table (from migration 20260722100000)
const EXPECTED = {
  weekly_seminar_config: [
    ['id', 'TEXT'],
    ['tenantId', 'TEXT'],
    ['academicYearId', 'TEXT'],
    ['weekNumber', 'INTEGER'],
    ['trimester', 'INTEGER'],
    ['weekStartDate', 'DATE'],
    ['weekEndDate', 'DATE'],
    ['teacherId', 'TEXT'],
    ['classIds', 'JSONB'],
    ['status', 'TEXT'],
    ['teacherSignature', 'TEXT'],
    ['directorSignature', 'TEXT'],
    ['rejectionReason', 'TEXT'],
    ['submittedAt', 'TIMESTAMP(3)'],
    ['validatedAt', 'TIMESTAMP(3)'],
    ['validatedBy', 'TEXT'],
    ['createdAt', 'TIMESTAMP(3)'],
    ['updatedAt', 'TIMESTAMP(3)'],
  ],
  weekly_seminar_daily_report: [
    ['id', 'TEXT'],
    ['tenantId', 'TEXT'],
    ['academicYearId', 'TEXT'],
    ['seminarConfigId', 'TEXT'],
    ['dayOfWeek', 'INTEGER'],
    ['date', 'DATE'],
    ['teacherAttendance', 'JSONB'],
    ['teacherAttendanceSynthesis', 'TEXT'],
    ['studentPresence', 'JSONB'],
    ['pedagogy', 'JSONB'],
    ['discipline', 'JSONB'],
    ['hygiene', 'JSONB'],
    ['visits', 'JSONB'],
    ['communication', 'JSONB'],
    ['dailySummary', 'JSONB'],
    ['filledBy', 'TEXT'],
    ['createdAt', 'TIMESTAMP(3)'],
    ['updatedAt', 'TIMESTAMP(3)'],
  ],
  weekly_seminar_weekly_report: [
    ['id', 'TEXT'],
    ['tenantId', 'TEXT'],
    ['academicYearId', 'TEXT'],
    ['seminarConfigId', 'TEXT'],
    ['weekNumber', 'INTEGER'],
    ['staffAttendanceStats', 'JSONB'],
    ['studentAttendanceStats', 'JSONB'],
    ['pedagogySummary', 'TEXT'],
    ['disciplineSummary', 'TEXT'],
    ['hygieneSummary', 'TEXT'],
    ['visitsAndCommsSummary', 'TEXT'],
    ['recommendations', 'TEXT'],
    ['teacherSignature', 'TEXT'],
    ['directorSignature', 'TEXT'],
    ['filledBy', 'TEXT'],
    ['submittedAt', 'TIMESTAMP(3)'],
    ['validatedAt', 'TIMESTAMP(3)'],
    ['validatedBy', 'TEXT'],
    ['createdAt', 'TIMESTAMP(3)'],
    ['updatedAt', 'TIMESTAMP(3)'],
  ],
};

async function main() {
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected\n');

    for (const [table, expectedCols] of Object.entries(EXPECTED)) {
      // Get existing columns
      const res = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [table]);

      const existingCols = new Map(res.rows.map(r => [r.column_name, r]));
      console.log(`📋 Table "${table}": ${existingCols.size} existing columns (expected: ${expectedCols.length})`);

      const missing = expectedCols.filter(([name]) => !existingCols.has(name));
      if (missing.length === 0) {
        console.log(`   ✅ All ${expectedCols.length} columns present\n`);
        continue;
      }

      console.log(`   ⚠️  Missing ${missing.length} column(s):`);
      for (const [name, type] of missing) {
        console.log(`      - ${name} (${type})`);
      }

      // Build ALTER TABLE statements
      const alters = missing.map(([name, type]) => {
        let def = '';
        if (name === 'createdAt' || name === 'updatedAt') {
          def = ` DEFAULT CURRENT_TIMESTAMP`;
        } else if (name === 'trimester') {
          def = ` DEFAULT 1`;
        } else if (name === 'status') {
          def = ` DEFAULT 'PENDING'`;
        } else if (name === 'classIds') {
          def = ` DEFAULT '[]'::jsonb`;
        }
        return `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${name}" ${type}${def};`;
      });

      console.log(`   🚀 Adding columns...`);
      await client.query('BEGIN');
      try {
        for (const sql of alters) {
          await client.query(sql);
          const summary = sql
            .replace(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS `, '')
            .replace(/;$/, '');
          console.log(`      ✓ ${summary}`);
        }
        await client.query('COMMIT');
        console.log(`   ✅ Done\n`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    // Final verification
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 FINAL SCHEMA VERIFICATION');
    console.log('═══════════════════════════════════════════════════════════');
    for (const table of Object.keys(EXPECTED)) {
      const res = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [table]);
      console.log(`\n📋 ${table} (${res.rows.length} columns):`);
      for (const r of res.rows) {
        const check = EXPECTED[table].find(([n]) => n === r.column_name) ? '✓' : '?';
        console.log(`   ${check} ${r.column_name.padEnd(30)} ${r.data_type}`);
      }
    }

    console.log('\n✨ Schema sync complete!');
  } catch (err) {
    console.error('\n❌ Failed:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
