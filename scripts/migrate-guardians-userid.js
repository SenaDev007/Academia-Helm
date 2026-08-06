/**
 * Migration: Add userId column to guardians + backfill from users email match
 *
 * This mirrors the teachers table pattern where teachers.userId links to users.id.
 * Guardians previously had no userId — resolveGuardianId relied on email/phone
 * matching which fails when guardians have NULL email/phone (6/7 in production).
 */
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const db = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  await db.connect();
  console.log('✅ Connected to Neon\n');

  // 1. Add userId column if not exists
  console.log('─── Step 1: Add userId column to guardians ───');
  try {
    await db.query(`
      ALTER TABLE "guardians"
      ADD COLUMN IF NOT EXISTS "userId" TEXT
    `);
    console.log('✅ Column "userId" added (or already exists)');
  } catch (e) {
    console.log('❌ Error adding column:', e.message);
  }

  // 2. Backfill: match guardians.email → users.email
  console.log('\n─── Step 2: Backfill userId from email match ───');
  const backfillEmail = await db.query(`
    UPDATE "guardians" g
    SET "userId" = u.id
    FROM "users" u
    WHERE g.email IS NOT NULL
      AND g.email != ''
      AND LOWER(g.email) = LOWER(u.email)
      AND g."userId" IS NULL
    RETURNING g.id, g."firstName", g."lastName", g.email, g."userId"
  `);
  console.log(`✅ Backfilled ${backfillEmail.rowCount} guardians from email match:`);
  backfillEmail.rows.forEach(r => {
    console.log(`  ${r.lastName} ${r.firstName} (${r.email}) → userId ${r.userId.substring(0, 8)}...`);
  });

  // 3. Backfill: match guardians.phone → users.phone (if users table has phone)
  console.log('\n─── Step 3: Backfill userId from phone match ───');
  try {
    const backfillPhone = await db.query(`
      UPDATE "guardians" g
      SET "userId" = u.id
      FROM "users" u
      WHERE g.phone IS NOT NULL
        AND g.phone != ''
        AND g.phone = u.phone
        AND g."userId" IS NULL
      RETURNING g.id, g."firstName", g."lastName", g.phone, g."userId"
    `);
    console.log(`✅ Backfilled ${backfillPhone.rowCount} guardians from phone match:`);
    backfillPhone.rows.forEach(r => {
      console.log(`  ${r.lastName} ${r.firstName} (${r.phone}) → userId ${r.userId.substring(0, 8)}...`);
    });
  } catch (e) {
    console.log('⚠️  Users table has no phone column or match failed:', e.message);
  }

  // 4. Create index on userId for fast lookups
  console.log('\n─── Step 4: Create index on guardians.userId ───');
  try {
    await db.query(`
      CREATE INDEX IF NOT EXISTS "guardians_userId_idx"
      ON "guardians"("userId")
      WHERE "userId" IS NOT NULL
    `);
    console.log('✅ Index created');
  } catch (e) {
    console.log('⚠️  Index creation failed:', e.message);
  }

  // 5. Summary
  console.log('\n─── Summary ───');
  const total = await db.query('SELECT COUNT(*)::int as c FROM guardians');
  const withUserId = await db.query('SELECT COUNT(*)::int as c FROM guardians WHERE "userId" IS NOT NULL');
  const withoutUserId = await db.query('SELECT COUNT(*)::int as c FROM guardians WHERE "userId" IS NULL');

  console.log(`  Total guardians:        ${total.rows[0].c}`);
  console.log(`  With userId (linked):   ${withUserId.rows[0].c}`);
  console.log(`  Without userId (orphans): ${withoutUserId.rows[0].c}`);

  if (withoutUserId.rows[0].c > 0) {
    console.log('\n⚠️  Guardians without userId (need manual linking or User account creation):');
    const orphans = await db.query(`
      SELECT "firstName", "lastName", email, phone
      FROM guardians
      WHERE "userId" IS NULL
    `);
    orphans.rows.forEach(g => {
      console.log(`  ${g.lastName} ${g.firstName} | email=${g.email || 'NULL'} | phone=${g.phone || 'NULL'}`);
    });
  }

  await db.end();
  console.log('\n✅ Migration complete!');
}

main().catch(e => { console.error('❌ FATAL:', e.message); process.exit(1); });
