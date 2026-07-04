#!/usr/bin/env node
/**
 * CLEANUP PART 2 — Handle the 4 cases that triggered DB triggers / FK constraints.
 *
 * Strategy:
 *   - finance_expenses: update status='REJECTED' (instead of DELETE)
 *   - fee_structures: update "isActive"=false (historisation)
 *   - students: update "isActive"=false, status='WITHDRAWN'
 *   - teachers: delete FK children (annual_teacher_supplies, etc.) first, then delete teachers
 */

const { Client } = require('/home/z/node_modules/pg');

const CSPEB_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const CONFIRM = process.argv.includes('--confirm');

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 15000,
    query_timeout: 30000,
  });

  try {
    await client.connect();
    console.log(`✅ Connected — Mode: ${CONFIRM ? 'CONFIRM' : 'DRY-RUN'}\n`);

    // ─── 1. finance_expenses: SOFT-DELETE (status='REJECTED') ──────────────
    console.log('━'.repeat(70));
    console.log('1. finance_expenses — SOFT-DELETE (status=REJECTED)');
    console.log('━'.repeat(70));
    try {
      const countRes = await client.query(`
        SELECT id, description, amount, status FROM finance_expenses
        WHERE "tenantId" = $1;
      `, [CSPEB_ID]);
      console.log(`  Records: ${countRes.rows.length}`);
      for (const r of countRes.rows) {
        console.log(`    - ${r.description} | ${r.amount} | status=${r.status}`);
      }
      if (CONFIRM && countRes.rows.length > 0) {
        const upd = await client.query(`
          UPDATE finance_expenses SET status='REJECTED' WHERE "tenantId" = $1 AND status != 'REJECTED';
        `, [CSPEB_ID]);
        console.log(`  🗑️  Rejected: ${upd.rowCount} records`);
      }
    } catch (err) {
      console.log(`  ❌ ${err.message}`);
    }

    // ─── 2. fee_structures: SOFT-DELETE (isActive=false) ───────────────────
    console.log('\n' + '━'.repeat(70));
    console.log('2. fee_structures — SOFT-DELETE (isActive=false)');
    console.log('━'.repeat(70));
    try {
      const countRes = await client.query(`
        SELECT id, name, "totalAmount", "isActive" FROM fee_structures
        WHERE "tenantId" = $1;
      `, [CSPEB_ID]);
      console.log(`  Records: ${countRes.rows.length}`);
      for (const r of countRes.rows) {
        console.log(`    - ${r.name} | ${r.totalAmount} | active=${r.isActive}`);
      }
      if (CONFIRM && countRes.rows.length > 0) {
        const upd = await client.query(`
          UPDATE fee_structures SET "isActive"=false WHERE "tenantId" = $1 AND "isActive" = true;
        `, [CSPEB_ID]);
        console.log(`  🗑️  Deactivated: ${upd.rowCount} records`);
      }
    } catch (err) {
      console.log(`  ❌ ${err.message}`);
    }

    // ─── 3. students: SOFT-DELETE (isActive=false, status=WITHDRAWN) ───────
    console.log('\n' + '━'.repeat(70));
    console.log('3. students — SOFT-DELETE (isActive=false, status=WITHDRAWN)');
    console.log('━'.repeat(70));
    try {
      const countRes = await client.query(`
        SELECT id, "firstName", "lastName", "studentCode", status, "isActive"
        FROM students WHERE "tenantId" = $1;
      `, [CSPEB_ID]);
      console.log(`  Records: ${countRes.rows.length}`);
      for (const r of countRes.rows) {
        console.log(`    - ${r.firstName} ${r.lastName} | code=${r.studentCode} | status=${r.status} | active=${r.isActive}`);
      }
      if (CONFIRM && countRes.rows.length > 0) {
        const upd = await client.query(`
          UPDATE students
          SET "isActive"=false, status='WITHDRAWN'
          WHERE "tenantId" = $1 AND (status != 'WITHDRAWN' OR "isActive" != false);
        `, [CSPEB_ID]);
        console.log(`  🗑️  Withdrawn: ${upd.rowCount} records`);
      }
    } catch (err) {
      console.log(`  ❌ ${err.message}`);
    }

    // ─── 4. teachers: delete FK children first, then teachers ──────────────
    console.log('\n' + '━'.repeat(70));
    console.log('4. teachers — Delete FK children then teachers');
    console.log('━'.repeat(70));

    // List FK children of teachers
    const fkRes = await client.query(`
      SELECT tc.table_name, tc.constraint_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'teacherId';
    `);
    console.log(`  FK children of teachers (column=teacherId):`);
    for (const r of fkRes.rows) {
      console.log(`    - ${r.table_name}`);
    }

    // Also check teacherId in pedagogy_* tables that may not have a formal FK
    const pedagogyTeacherTables = [
      'annual_teacher_supplies',
      'pedagogy_teaching_assignments',
      'pedagogy_teacher_academic_profiles',
      'pedagogy_teacher_availabilities',
      'pedagogy_teacher_level_authorizations',
      'pedagogy_teacher_subject_qualifications',
      'teacher_material_assignments',
    ];

    for (const t of pedagogyTeacherTables) {
      try {
        const c = await client.query(`
          SELECT COUNT(*)::int as n FROM ${t}
          WHERE "tenantId" = $1;
        `, [CSPEB_ID]);
        const n = c.rows[0].n;
        if (n > 0) {
          console.log(`  - ${t}: ${n} records (will delete)`);
          if (CONFIRM) {
            try {
              const del = await client.query(`DELETE FROM ${t} WHERE "tenantId" = $1`, [CSPEB_ID]);
              console.log(`    🗑️  Deleted: ${del.rowCount}`);
            } catch (e) {
              console.log(`    ❌ ${e.message}`);
            }
          }
        }
      } catch (e) {
        // skip
      }
    }

    // Finally delete teachers
    try {
      const countRes = await client.query(`
        SELECT id, "firstName", "lastName", matricule FROM teachers
        WHERE "tenantId" = $1;
      `, [CSPEB_ID]);
      console.log(`\n  Teachers to delete: ${countRes.rows.length}`);
      for (const r of countRes.rows) {
        console.log(`    - ${r.firstName} ${r.lastName} | matricule=${r.matricule}`);
      }
      if (CONFIRM && countRes.rows.length > 0) {
        const del = await client.query(`DELETE FROM teachers WHERE "tenantId" = $1`, [CSPEB_ID]);
        console.log(`  🗑️  Teachers deleted: ${del.rowCount}`);
      }
    } catch (err) {
      console.log(`  ❌ ${err.message}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('DONE');
    console.log('='.repeat(70));

  } catch (err) {
    console.error('❌ Fatal:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
