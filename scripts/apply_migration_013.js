// Script : applique la migration 013_official_vs_physical_classes.sql sur Neon
// Usage : node /home/z/my-project/scripts/apply_migration_013.js

const { Client } = require('/home/z/my-project/node_modules/pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const SQL_FILE = '/home/z/my-project/apps/api-server/migrations/013_official_vs_physical_classes.sql';

async function main() {
  const sql = fs.readFileSync(SQL_FILE, 'utf8');
  console.log(`📄 Loaded migration file: ${SQL_FILE} (${sql.length} bytes)`);

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔌 Connecting to Neon PostgreSQL...');
    await client.connect();
    console.log('✅ Connected');

    // Vérifier l'état avant migration
    const beforeAdmissions = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'admissions' AND column_name = 'requestedAcademicClassId'
    `);
    const beforeEnrollments = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'student_enrollments' AND column_name = 'academicClassId'
    `);
    const beforeTransferType = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'class_transfers' AND column_name = 'transferType'
    `);
    console.log('État avant migration :');
    console.log(`  - admissions.requestedAcademicClassId : ${beforeAdmissions.rows.length > 0 ? 'EXISTE' : 'ABSENT'}`);
    console.log(`  - student_enrollments.academicClassId : ${beforeEnrollments.rows.length > 0 ? 'EXISTE' : 'ABSENT'}`);
    console.log(`  - class_transfers.transferType : ${beforeTransferType.rows.length > 0 ? 'EXISTE' : 'ABSENT'}`);

    // Neon (pgbouncer pooler) ne supporte pas les transactions multi-statements
    // avec DO $$ blocks. On découpe en statements individuels.

    console.log('\n🔧 Application de la migration...\n');

    // 1. Ajouter requestedAcademicClassId à admissions
    await execAndLog(client, `ALTER TABLE "admissions" ADD COLUMN IF NOT EXISTS "requestedAcademicClassId" TEXT`);
    await execAndLog(client, `CREATE INDEX IF NOT EXISTS "admissions_requestedAcademicClassId_idx" ON "admissions" ("requestedAcademicClassId")`);

    // 2. Ajouter academicClassId à student_enrollments
    await execAndLog(client, `ALTER TABLE "student_enrollments" ADD COLUMN IF NOT EXISTS "academicClassId" TEXT`);
    await execAndLog(client, `CREATE INDEX IF NOT EXISTS "student_enrollments_academicClassId_idx" ON "student_enrollments" ("academicClassId")`);

    // 3. class_transfers : rendre fromClassId/toClassId nullables
    try {
      await execAndLog(client, `ALTER TABLE "class_transfers" ALTER COLUMN "fromClassId" DROP NOT NULL`);
    } catch (e) { console.log(`  ⚠️  fromClassId DROP NOT NULL: ${e.message}`); }
    try {
      await execAndLog(client, `ALTER TABLE "class_transfers" ALTER COLUMN "toClassId" DROP NOT NULL`);
    } catch (e) { console.log(`  ⚠️  toClassId DROP NOT NULL: ${e.message}`); }

    // 4. Ajouter transferType, fromSeriesId, toSeriesId
    await execAndLog(client, `ALTER TABLE "class_transfers" ADD COLUMN IF NOT EXISTS "transferType" TEXT NOT NULL DEFAULT 'CLASS_CHANGE'`);
    await execAndLog(client, `ALTER TABLE "class_transfers" ADD COLUMN IF NOT EXISTS "fromSeriesId" TEXT`);
    await execAndLog(client, `ALTER TABLE "class_transfers" ADD COLUMN IF NOT EXISTS "toSeriesId" TEXT`);
    await execAndLog(client, `CREATE INDEX IF NOT EXISTS "class_transfers_transferType_idx" ON "class_transfers" ("transferType")`);

    // 5. FK admissions.requestedAcademicClassId → pedagogy_academic_classes.id
    const fkAdmissions = await client.query(`
      SELECT 1 FROM pg_constraint WHERE conname = 'admissions_requestedAcademicClassId_fkey'
    `);
    if (fkAdmissions.rows.length === 0) {
      try {
        await execAndLog(client, `ALTER TABLE "admissions" ADD CONSTRAINT "admissions_requestedAcademicClassId_fkey" FOREIGN KEY ("requestedAcademicClassId") REFERENCES "pedagogy_academic_classes" ("id") ON DELETE SET NULL`);
      } catch (e) { console.log(`  ⚠️  FK admissions: ${e.message}`); }
    } else {
      console.log('  ℹ️  FK admissions déjà existante');
    }

    // 6. FK student_enrollments.academicClassId → pedagogy_academic_classes.id
    const fkEnr = await client.query(`
      SELECT 1 FROM pg_constraint WHERE conname = 'student_enrollments_academicClassId_fkey'
    `);
    if (fkEnr.rows.length === 0) {
      try {
        await execAndLog(client, `ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_academicClassId_fkey" FOREIGN KEY ("academicClassId") REFERENCES "pedagogy_academic_classes" ("id") ON DELETE SET NULL`);
      } catch (e) { console.log(`  ⚠️  FK enrollments: ${e.message}`); }
    } else {
      console.log('  ℹ️  FK enrollments déjà existante');
    }

    // 7. Backfill : student_enrollments.academicClassId depuis Class.officialClassId
    console.log('\n🔄 Backfill student_enrollments...');
    const backfillEnr = await client.query(`
      UPDATE "student_enrollments" se
      SET "academicClassId" = c."officialClassId", "updatedAt" = NOW()
      FROM "classes" c
      WHERE se."classId" = c."id"
        AND se."academicClassId" IS NULL
        AND c."officialClassId" IS NOT NULL
    `);
    console.log(`  ✅ ${backfillEnr.rowCount} inscription(s) backfillée(s)`);

    // 8. Backfill : admissions.requestedAcademicClassId depuis Class.officialClassId
    console.log('🔄 Backfill admissions...');
    const backfillAdm = await client.query(`
      UPDATE "admissions" a
      SET "requestedAcademicClassId" = c."officialClassId"
      FROM "classes" c
      WHERE a."requestedClassId" = c."id"
        AND a."requestedAcademicClassId" IS NULL
        AND c."officialClassId" IS NOT NULL
    `);
    console.log(`  ✅ ${backfillAdm.rowCount} admission(s) backfillée(s)`);

    // 9. Vérification finale
    console.log('\n📊 État après migration :');
    const afterAdmissions = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'admissions' AND column_name = 'requestedAcademicClassId'`);
    const afterEnrollments = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'student_enrollments' AND column_name = 'academicClassId'`);
    const afterTransferType = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'class_transfers' AND column_name = 'transferType'`);
    const enrStats = await client.query(`SELECT COUNT(*) total, COUNT("academicClassId") with_academic FROM "student_enrollments"`);
    const admStats = await client.query(`SELECT COUNT(*) total, COUNT("requestedAcademicClassId") with_academic FROM "admissions"`);

    console.log(`  - admissions.requestedAcademicClassId : ${afterAdmissions.rows.length > 0 ? '✅ EXISTE' : '❌ ABSENT'}`);
    console.log(`  - student_enrollments.academicClassId : ${afterEnrollments.rows.length > 0 ? '✅ EXISTE' : '❌ ABSENT'}`);
    console.log(`  - class_transfers.transferType : ${afterTransferType.rows.length > 0 ? '✅ EXISTE' : '❌ ABSENT'}`);
    console.log(`  - student_enrollments : ${enrStats.rows[0].with_academic}/${enrStats.rows[0].total} avec academicClassId`);
    console.log(`  - admissions : ${admStats.rows[0].with_academic}/${admStats.rows[0].total} avec requestedAcademicClassId`);

    console.log('\n🎉 Migration 013 appliquée avec succès !');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected');
  }
}

async function execAndLog(client, sql) {
  try {
    await client.query(sql);
    console.log(`  ✅ ${sql.substring(0, 100)}${sql.length > 100 ? '…' : ''}`);
  } catch (e) {
    console.error(`  ❌ FAILED: ${sql.substring(0, 100)}…`);
    throw e;
  }
}

main();
