/**
 * ⭐ Applique la migration 20260906200000 (estimated_student_count + billing_documents)
 *    directement sur Neon prod (idempotente — le bootstrap Railway la rejouera sans effet).
 * Puis supprime les 4 personnels de test + toutes leurs données liées :
 *    Sophie TEST, Fatou TEST, Léontine DEVO, Jean-Baptiste ADJOVI.
 */
const pg = require('pg');

const DDL = [
  `ALTER TABLE "onboarding_drafts" ADD COLUMN IF NOT EXISTS "estimated_student_count" INTEGER NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS "billing_documents" (
      "id" TEXT NOT NULL,
      "kind" TEXT NOT NULL DEFAULT 'RECEIPT',
      "document_number" TEXT NOT NULL,
      "sequence_year" INTEGER NOT NULL,
      "transaction_type" TEXT NOT NULL DEFAULT 'FULL_SUBSCRIPTION',
      "draft_id" TEXT,
      "tenant_id" TEXT,
      "issued_by_name" TEXT,
      "issued_by_email" TEXT,
      "payer_name" TEXT,
      "payer_email" TEXT,
      "payment_method" TEXT NOT NULL DEFAULT 'CASH',
      "paid_at" TIMESTAMPTZ,
      "amount" INTEGER NOT NULL DEFAULT 0,
      "snapshot" JSONB,
      "file_path" TEXT,
      "file_name" TEXT,
      "status" TEXT NOT NULL DEFAULT 'EMITTED',
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "billing_documents_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "billing_documents_document_number_key" ON "billing_documents"("document_number")`,
  `CREATE INDEX IF NOT EXISTS "billing_documents_draft_id_idx" ON "billing_documents"("draft_id")`,
  `CREATE INDEX IF NOT EXISTS "billing_documents_kind_year_idx" ON "billing_documents"("kind", "sequence_year")`,
  `CREATE INDEX IF NOT EXISTS "billing_documents_tenant_id_idx" ON "billing_documents"("tenant_id")`,
  `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_documents_draft_id_fkey') THEN
          ALTER TABLE "billing_documents" ADD CONSTRAINT "billing_documents_draft_id_fkey"
          FOREIGN KEY ("draft_id") REFERENCES "onboarding_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
  END $$;`,
];

const STAFF_IDS = [
  'bb5cc801-3d6a-4f17-bf41-9af423dc95f4', // Sophie TEST
  '95dd51f7-2486-4d8b-98d1-f3b42533d113', // Fatou TEST
  '661be553-7857-40b3-914d-9ea96ae88fe5', // Léontine DEVO
  'e105c303-eb89-4d11-b348-5f18c9130b3b', // Jean-Baptiste ADJOVI
];
const EMAILS = [
  'recette.sophie@cspeb.test',
  'recette.doublecasquette@cspeb.test',
  'senakpondawes@spacegeneration.org',
  'recette.directeur-fr@cspeb.test',
];

async function connectWithRetry() {
  for (let i = 0; i < 8; i++) {
    const c = new pg.Client({
      connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
      ssl: { rejectUnauthorized: false },
    });
    try { await c.connect(); return c; } catch (e) {
      console.log(`  (connexion tentative ${i + 1} échouée — retry)`);
      await c.end().catch(() => {});
      await new Promise(r => setTimeout(r, 5000 + i * 4000));
    }
  }
  throw new Error('Impossible de se connecter à Neon');
}

(async () => {
  const c = await connectWithRetry();
  try {
    // ── 1. Migration DDL (idempotente) ──
    console.log('=== Migration 20260906200000 (idempotente) ===');
    for (const stmt of DDL) {
      await c.query(stmt);
    }
    console.log('✓ estimated_student_count + billing_documents appliqués');
    const col = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='onboarding_drafts' AND column_name='estimated_student_count'`);
    console.log(`  vérif colonne: ${col.rows.length === 1 ? 'présente ✓' : 'ABSENTE ✗'}`);
    const tbl = await c.query(`SELECT to_regclass('public.billing_documents') AS t`);
    console.log(`  vérif table billing_documents: ${tbl.rows[0].t ? 'présente ✓' : 'ABSENTE ✗'}`);

    // ── 2. Suppression des 4 personnels de test ──
    console.log('\n=== Suppression personnels de test ===');
    await c.query('BEGIN');

    // IDs users/teachers liés
    const users = (await c.query('SELECT id FROM users WHERE email::text = ANY($1::text[])', [EMAILS])).rows.map(r => r.id);
    const teachers = (await c.query('SELECT id FROM teachers WHERE email::text = ANY($1::text[])', [EMAILS])).rows.map(r => r.id);

    // Suppressions explicites (colonnes plates sans FK cascade)
    let n;
    if (users.length) {
      n = await c.query('DELETE FROM audit_logs WHERE "userId"::text = ANY($1::text[])', [users]);
      console.log(`  audit_logs: ${n.rowCount}`);
      n = await c.query('DELETE FROM chat_channel_subscribers WHERE "userId"::text = ANY($1::text[])', [users]);
      console.log(`  chat_channel_subscribers: ${n.rowCount}`);
      n = await c.query('DELETE FROM chat_participants WHERE "userId"::text = ANY($1::text[])', [users]);
      console.log(`  chat_participants: ${n.rowCount}`);
      n = await c.query('DELETE FROM portal_sessions WHERE "userId"::text = ANY($1::text[])', [users]);
      console.log(`  portal_sessions: ${n.rowCount}`);
      n = await c.query('DELETE FROM sessions WHERE "userId"::text = ANY($1::text[])', [users]);
      console.log(`  sessions: ${n.rowCount}`);
    }
    if (teachers.length) {
      n = await c.query('DELETE FROM teachers WHERE id::text = ANY($1::text[])', [teachers]);
      console.log(`  teachers: ${n.rowCount}`);
    }
    // staff (cascade → employment_contracts, staff_admin_assignments, staff_documents…)
    n = await c.query('DELETE FROM staff WHERE id::text = ANY($1::text[])', [STAFF_IDS]);
    console.log(`  staff: ${n.rowCount}`);
    if (users.length) {
      n = await c.query('DELETE FROM users WHERE id::text = ANY($1::text[])', [users]);
      console.log(`  users: ${n.rowCount}`);
    }

    // Vérification finale
    const check = await c.query(
      `SELECT
        (SELECT count(*) FROM staff WHERE id::text = ANY($1::text[])) AS staff,
        (SELECT count(*) FROM teachers WHERE email::text = ANY($2)) AS teachers,
        (SELECT count(*) FROM users WHERE email::text = ANY($2)) AS users,
        (SELECT count(*) FROM employment_contracts WHERE "staffId"::text = ANY($1::text[])) AS contracts`,
      [STAFF_IDS, EMAILS],
    );
    const r = check.rows[0];
    if (Number(r.staff) > 0 || Number(r.teachers) > 0 || Number(r.users) > 0 || Number(r.contracts) > 0) {
      await c.query('ROLLBACK');
      console.log('✗ Vérification non nulle — ROLLBACK :', JSON.stringify(r));
      process.exit(1);
    }
    await c.query('COMMIT');
    console.log('✓ SUPPRESSION VALIDÉE (commit) — il ne reste aucune trace des 4 personnels');

    // Résumé
    const remain = await c.query('SELECT count(*)::int AS n FROM staff');
    console.log(`  staff restants au total: ${remain.rows[0].n}`);
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('ERR:', e.message);
    process.exit(1);
  } finally {
    await c.end().catch(() => {});
  }
})();
