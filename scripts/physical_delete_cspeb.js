#!/usr/bin/env node
/**
 * PHYSICAL DELETE of fictitious CSPEB data — bypasses protective triggers.
 *
 * Strategy:
 *   1. ALTER TABLE ... DISABLE TRIGGER trg_prevent_student_delete
 *      (and the 3 other protective triggers on fee_structures / finance_expenses)
 *   2. DELETE FROM students / fee_structures / finance_expenses WHERE tenantId = CSPEB
 *      (FK CASCADE will clean up child records automatically)
 *   3. ALTER TABLE ... ENABLE TRIGGER (re-arm the protective triggers)
 *
 * Note: We use DISABLE TRIGGER (not DROP) so the trigger definition is preserved
 * and can be re-enabled. The trigger function is NOT affected.
 */

const { Client } = require('/home/z/node_modules/pg');

const CSPEB_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const CONFIRM = process.argv.includes('--confirm');

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 15000,
    query_timeout: 60000,
  });

  try {
    await client.connect();
    console.log(`✅ Connected — Mode: ${CONFIRM ? 'CONFIRM (will DELETE physically)' : 'DRY-RUN'}\n`);

    // ─── Step 1: Disable protective triggers ──────────────────────────────
    const triggersToDisable = [
      { table: 'students', trigger: 'trg_prevent_student_delete' },
      { table: 'fee_structures', trigger: 'no_delete_fee' },
      { table: 'finance_expenses', trigger: 'no_delete_expense' },
      { table: 'finance_expenses', trigger: 'no_delete_finance_expense' },
    ];

    console.log('━'.repeat(70));
    console.log('STEP 1: Disable protective triggers');
    console.log('━'.repeat(70));
    for (const { table, trigger } of triggersToDisable) {
      if (CONFIRM) {
        try {
          await client.query(`ALTER TABLE "${table}" DISABLE TRIGGER "${trigger}";`);
          console.log(`  ✓ Disabled: ${table}.${trigger}`);
        } catch (err) {
          console.log(`  ✗ Failed to disable ${table}.${trigger}: ${err.message}`);
        }
      } else {
        console.log(`  🔍 Would disable: ${table}.${trigger}`);
      }
    }

    // ─── Step 2: Physical delete (CASCADE will handle child records) ──────
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 2: Physical delete of CSPEB fictitious data');
    console.log('━'.repeat(70));

    const tablesToDelete = [
      {
        table: 'students',
        label: 'Students (4 fictitious: Koffi, Adèle, Benedicta, Aminata)',
        note: 'CASCADE will clean: student_enrollments, student_guardians, payments, attendance_records, grades, etc.',
      },
      {
        table: 'fee_structures',
        label: 'Fee structures (2 fictitious: Scolarité CM2, Scolarité 4ème)',
        note: 'CASCADE will clean: student_fees, fee_overrides, payment_summaries',
      },
      {
        table: 'finance_expenses',
        label: 'Finance expense (1 fictitious: Achat cahiers v2)',
        note: '',
      },
    ];

    for (const { table, label, note } of tablesToDelete) {
      // Count first
      const countRes = await client.query(
        `SELECT COUNT(*)::int as n FROM "${table}" WHERE "tenantId" = $1`,
        [CSPEB_ID],
      );
      const count = countRes.rows[0].n;

      if (count === 0) {
        console.log(`  ⏭️  ${label.padEnd(60)} — 0 records (skip)`);
        continue;
      }

      if (CONFIRM) {
        try {
          const del = await client.query(
            `DELETE FROM "${table}" WHERE "tenantId" = $1`,
            [CSPEB_ID],
          );
          console.log(`  🗑️  ${label.padEnd(60)} — ${del.rowCount} deleted`);
          if (note) console.log(`     └─ ${note}`);
        } catch (err) {
          console.log(`  ❌ ${label}: ${err.message}`);
          if (err.message.includes('foreign key') || err.code === 'P2003' || err.code === '23503') {
            console.log(`     └─ FK constraint blocks delete. Need to clean dependent tables first.`);
          }
        }
      } else {
        console.log(`  🔍 ${label.padEnd(60)} — ${count} records (dry-run)`);
        if (note) console.log(`     └─ ${note}`);
      }
    }

    // ─── Step 3: Re-enable protective triggers ────────────────────────────
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 3: Re-enable protective triggers');
    console.log('━'.repeat(70));
    for (const { table, trigger } of triggersToDisable) {
      if (CONFIRM) {
        try {
          await client.query(`ALTER TABLE "${table}" ENABLE TRIGGER "${trigger}";`);
          console.log(`  ✓ Re-enabled: ${table}.${trigger}`);
        } catch (err) {
          console.log(`  ✗ Failed to re-enable ${table}.${trigger}: ${err.message}`);
        }
      } else {
        console.log(`  🔍 Would re-enable: ${table}.${trigger}`);
      }
    }

    // ─── Step 4: Verification ─────────────────────────────────────────────
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 4: Verification — final counts for CSPEB');
    console.log('━'.repeat(70));
    for (const t of ['students', 'fee_structures', 'finance_expenses', 'expenses']) {
      const r = await client.query(
        `SELECT COUNT(*)::int as n FROM "${t}" WHERE "tenantId" = $1`,
        [CSPEB_ID],
      );
      console.log(`  ${t.padEnd(25)} ${r.rows[0].n} records`);
    }

    console.log('\n' + '='.repeat(70));
    console.log(CONFIRM ? '✅ Physical deletion completed' : '⚠️  DRY-RUN — re-run with --confirm to execute');
    console.log('='.repeat(70));

  } catch (err) {
    console.error('❌ Fatal:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
