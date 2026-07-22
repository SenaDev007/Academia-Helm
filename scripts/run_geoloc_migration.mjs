// Apply the geolocation migration directly to Neon DB
import fs from 'fs';
import pg from 'pg';

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const MIGRATION_FILE = '/home/z/my-project/apps/api-server/prisma/migrations/20260723080000_add_staff_attendance_geolocation/migration.sql';

async function main() {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  console.log(`📄 Loaded migration: ${MIGRATION_FILE} (${sql.length} bytes)\n`);

  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔌 Connecting to Neon DB...');
    await client.connect();
    console.log('✅ Connected\n');

    console.log('🚀 Executing migration...\n');
    await client.query('BEGIN');
    try {
      // Execute each statement — split on semicolon followed by newline
      const statements = sql
        .split(/;\s*\n/)
        .map(s => s.trim())
        .filter(s => s.length > 5);

      for (const stmt of statements) {
        // Skip pure comment blocks (no SQL keyword)
        const stripped = stmt.replace(/--[^\n]*\n/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
        if (!stripped || stripped.length < 5) continue;
        try {
          await client.query(stmt + ';');
          const preview = stripped.split('\n')[0].substring(0, 100);
          console.log(`  ✓ ${preview}...`);
        } catch (err) {
          if (err.message.includes('already exists') || err.message.includes('duplicate column')) {
            console.log(`  ⏭️  skipped (already exists): ${preview?.substring(0, 50)}`);
          } else {
            throw err;
          }
        }
      }
      await client.query('COMMIT');
      console.log('\n✅ Migration committed.');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    // Verification
    console.log('\n📊 Verification:');
    const cols1 = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'staff_attendances'
        AND column_name IN ('latitude','longitude','geoAccuracy','geoVerified','geoDistance','markedBy','markedByRole','deviceInfo','ipAddress','checkOutMethod')
      ORDER BY column_name;
    `);
    console.log('\n  staff_attendances new columns:');
    for (const r of cols1.rows) {
      console.log(`    - ${r.column_name.padEnd(16)} ${r.data_type.padEnd(20)} nullable=${r.is_nullable}`);
    }

    const cols2 = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'tenant_identity_profiles'
        AND column_name IN ('latitude','longitude','geoRadius')
      ORDER BY column_name;
    `);
    console.log('\n  tenant_identity_profiles new columns:');
    for (const r of cols2.rows) {
      console.log(`    - ${r.column_name.padEnd(12)} ${r.data_type.padEnd(20)} default=${r.column_default || 'NULL'}`);
    }

    console.log('\n✨ Migration successful!');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
