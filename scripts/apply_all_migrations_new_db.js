// Applique toutes les migrations personnalisées (009-014) sur la nouvelle BDD
const { Client } = require('/home/z/my-project/node_modules/pg');
const NEW_DB = 'postgresql://neondb_owner:npg_6KId8HblkNrZ@ep-mute-dawn-asgj3thg-pooler.c-4.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function exec(client, label, sql) {
  try {
    await client.query(sql);
    console.log(`✅ ${label}`);
  } catch (e) {
    console.log(`⚠️ ${label}: ${e.message}`);
  }
}

async function main() {
  const client = new Client({ connectionString: NEW_DB, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected to new DB\n');

  // Migration 011 : card settings
  console.log('📦 Migration 011 — card settings...');
  await exec(client, 'maternellePickupMorning', `ALTER TABLE "tenant_identity_profiles" ADD COLUMN IF NOT EXISTS "maternellePickupMorning" TEXT DEFAULT '12:00'`);
  await exec(client, 'maternellePickupAfternoon', `ALTER TABLE "tenant_identity_profiles" ADD COLUMN IF NOT EXISTS "maternellePickupAfternoon" TEXT DEFAULT '16:30'`);
  await exec(client, 'cardPrimaryColor', `ALTER TABLE "tenant_identity_profiles" ADD COLUMN IF NOT EXISTS "cardPrimaryColor" TEXT DEFAULT '#003087'`);
  await exec(client, 'cardShowQRCode', `ALTER TABLE "tenant_identity_profiles" ADD COLUMN IF NOT EXISTS "cardShowQRCode" BOOLEAN DEFAULT true`);
  await exec(client, 'cardShowPhoto', `ALTER TABLE "tenant_identity_profiles" ADD COLUMN IF NOT EXISTS "cardShowPhoto" BOOLEAN DEFAULT true`);
  await exec(client, 'cardShowGuardian', `ALTER TABLE "tenant_identity_profiles" ADD COLUMN IF NOT EXISTS "cardShowGuardian" BOOLEAN DEFAULT true`);
  await exec(client, 'cardShowEmergencyCall', `ALTER TABLE "tenant_identity_profiles" ADD COLUMN IF NOT EXISTS "cardShowEmergencyCall" BOOLEAN DEFAULT true`);
  await exec(client, 'cardShowSchoolAddress', `ALTER TABLE "tenant_identity_profiles" ADD COLUMN IF NOT EXISTS "cardShowSchoolAddress" BOOLEAN DEFAULT true`);
  await exec(client, 'cardConditionsText', `ALTER TABLE "tenant_identity_profiles" ADD COLUMN IF NOT EXISTS "cardConditionsText" TEXT`);

  // Migration 012 : maternelle single exit
  console.log('\n📦 Migration 012 — maternelle single exit...');
  await exec(client, 'maternelleSingleExit', `ALTER TABLE "tenant_identity_profiles" ADD COLUMN IF NOT EXISTS "maternelleSingleExit" BOOLEAN DEFAULT false`);
  await exec(client, 'maternelleSingleExitTime', `ALTER TABLE "tenant_identity_profiles" ADD COLUMN IF NOT EXISTS "maternelleSingleExitTime" TEXT DEFAULT '15:30'`);

  // Migration 013 : official vs physical classes
  console.log('\n📦 Migration 013 — official vs physical classes...');
  await exec(client, 'admissions.requestedAcademicClassId', `ALTER TABLE "admissions" ADD COLUMN IF NOT EXISTS "requestedAcademicClassId" TEXT`);
  await exec(client, 'student_enrollments.academicClassId', `ALTER TABLE "student_enrollments" ADD COLUMN IF NOT EXISTS "academicClassId" TEXT`);
  await exec(client, 'class_transfers.fromClassId nullable', `ALTER TABLE "class_transfers" ALTER COLUMN "fromClassId" DROP NOT NULL`);
  await exec(client, 'class_transfers.toClassId nullable', `ALTER TABLE "class_transfers" ALTER COLUMN "toClassId" DROP NOT NULL`);
  await exec(client, 'class_transfers.transferType', `ALTER TABLE "class_transfers" ADD COLUMN IF NOT EXISTS "transferType" TEXT NOT NULL DEFAULT 'CLASS_CHANGE'`);
  await exec(client, 'class_transfers.fromSeriesId', `ALTER TABLE "class_transfers" ADD COLUMN IF NOT EXISTS "fromSeriesId" TEXT`);
  await exec(client, 'class_transfers.toSeriesId', `ALTER TABLE "class_transfers" ADD COLUMN IF NOT EXISTS "toSeriesId" TEXT`);

  // FK pour 013
  await exec(client, 'FK admissions.requestedAcademicClassId', `
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admissions_requestedAcademicClassId_fkey') THEN
        ALTER TABLE "admissions" ADD CONSTRAINT "admissions_requestedAcademicClassId_fkey"
        FOREIGN KEY ("requestedAcademicClassId") REFERENCES "pedagogy_academic_classes" ("id") ON DELETE SET NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END $$`);

  await exec(client, 'FK student_enrollments.academicClassId', `
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_enrollments_academicClassId_fkey') THEN
        ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_academicClassId_fkey"
        FOREIGN KEY ("academicClassId") REFERENCES "pedagogy_academic_classes" ("id") ON DELETE SET NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END $$`);

  // Migration 014 : admission settings
  console.log('\n📦 Migration 014 — admission settings...');
  await exec(client, 'admissionOpenDate', `ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "admissionOpenDate" TIMESTAMP`);
  await exec(client, 'admissionCloseDate', `ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "admissionCloseDate" TIMESTAMP`);
  await exec(client, 'admissionEnabled', `ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "admissionEnabled" BOOLEAN NOT NULL DEFAULT true`);

  // Vérification
  console.log('\n📊 Vérification:');
  const cols1 = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'tenant_identity_profiles' AND column_name LIKE 'card%' ORDER BY column_name`);
  console.log('  Card columns:', cols1.rows.map(r => r.column_name).join(', '));
  const cols2 = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'student_enrollments' AND column_name = 'academicClassId'`);
  console.log('  academicClassId:', cols2.rows.length > 0 ? '✅' : '❌');
  const cols3 = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'academic_years' AND column_name LIKE 'admission%'`);
  console.log('  Admission columns:', cols3.rows.map(r => r.column_name).join(', '));

  await client.end();
  console.log('\n🎉 Toutes les migrations appliquées sur la nouvelle BDD !');
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
