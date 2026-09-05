#!/usr/bin/env node
/**
 * _apply_scope_migration.js — Applique la migration 20260906100000_add_track_scope_foundation
 * sur Neon, statement par statement (idempotent), + enregistrement dans _prisma_migrations.
 */
const PG = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const DB = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const NAME = '20260906100000_add_track_scope_foundation';
const SQL_PATH = '/home/z/my-project/Academia-Helm/apps/api-server/prisma/migrations/' + NAME + '/migration.sql';
const SQL = fs.readFileSync(SQL_PATH, 'utf8');

// Statements explicites (ordre important) — indépendants du formatage/commentaires
const STATEMENTS = [
  `ALTER TABLE "staff_admin_assignments" ADD COLUMN IF NOT EXISTS "academicTrackId" TEXT`,
  `ALTER TABLE "staff_admin_assignments" DROP CONSTRAINT IF EXISTS "staff_admin_assignments_academicTrackId_fkey"`,
  `ALTER TABLE "staff_admin_assignments" ADD CONSTRAINT "staff_admin_assignments_academicTrackId_fkey" FOREIGN KEY ("academicTrackId") REFERENCES "academic_tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  `CREATE INDEX IF NOT EXISTS "staff_admin_assignments_tenantId_schoolLevelCode_academicTrackId_idx" ON "staff_admin_assignments"("tenantId", "schoolLevelCode", "academicTrackId")`,
  `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "academicTrackId" TEXT`,
  `ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_academicTrackId_fkey"`,
  `ALTER TABLE "payments" ADD CONSTRAINT "payments_academicTrackId_fkey" FOREIGN KEY ("academicTrackId") REFERENCES "academic_tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  `CREATE INDEX IF NOT EXISTS "payments_tenantId_schoolLevelId_academicTrackId_idx" ON "payments"("tenantId", "schoolLevelId", "academicTrackId")`,
  // Backfill idempotent (COALESCE : class_students sinon student_enrollments)
  `UPDATE payments p
   SET "academicTrackId" = (
     SELECT t.id FROM academic_tracks t
     WHERE t."tenantId" = p."tenantId"
       AND t.code = COALESCE(
         (SELECT cl.language FROM class_students cs JOIN classes cl ON cl.id = cs."classId"
          WHERE cs."studentId" = p."studentId" ORDER BY cs."createdAt" DESC LIMIT 1),
         (SELECT cl.language FROM student_enrollments se JOIN classes cl ON cl.id = se."classId"
          WHERE se."studentId" = p."studentId" AND se."classId" IS NOT NULL
          ORDER BY se."enrollmentDate" DESC NULLS LAST LIMIT 1)
       ) LIMIT 1
   )
   WHERE p."academicTrackId" IS NULL AND p."studentId" IS NOT NULL`,
];

(async () => {
  const c = new PG.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
  await c.connect();

  for (const stmt of STATEMENTS) {
    try {
      await c.query(stmt);
      console.log('  ✅ ' + stmt.slice(0, 80).replace(/\n/g, ' ') + '…');
    } catch (e) {
      const msg = String(e.message);
      if (msg.includes('already exists') || e.code === '42701' || e.code === '42710') {
        console.log('  ⏭️ déjà existant : ' + stmt.slice(0, 60).replace(/\n/g, ' '));
      } else {
        console.log('  ⚠️ ' + msg.slice(0, 150));
      }
    }
  }

  // Vérifications
  const bf = await c.query(`SELECT count(*) AS filled FROM payments WHERE "academicTrackId" IS NOT NULL`);
  const tot = await c.query(`SELECT count(*) AS total FROM payments`);
  const saa = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='staff_admin_assignments' AND column_name='academicTrackId'`);
  console.log(`\npayments : ${bf.rows[0].filled}/${tot.rows[0].total} avec piste ; staff_admin_assignments.academicTrackId : ${saa.rows.length > 0 ? 'OK' : 'ABSENT'}`);

  // Enregistrement _prisma_migrations (checksum = hash du fichier SQL)
  const exists = await c.query('SELECT id FROM _prisma_migrations WHERE migration_name = $1', [NAME]);
  if (!exists.rows.length) {
    const checksum = crypto.createHash('sha256').update(SQL).digest('hex');
    await c.query(
      `INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count)
       VALUES (gen_random_uuid(), $1, $2, now(), 0)`,
      [checksum, NAME]);
    console.log('✅ Migration enregistrée dans _prisma_migrations (zéro drift)');
  } else {
    console.log('Migration déjà enregistrée');
  }

  await c.end();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
