#!/usr/bin/env node
/**
 * CLEANUP — Remove fictitious/test data from CSPEB tenant
 * ============================================================================
 *
 * Tenant: Complexe Scolaire Privé Entrepreneurial et Bilingue - Eveil d'Afrique Education
 * Tenant ID: 59b8c348-ae5f-4d67-8fbd-af6aefa1f394
 *
 * MODULES TO CLEAN (per user request):
 *   - Élèves: students, student_guardians, admissions, enrollments
 *   - Finance: payments, fee_structures, expenses, finance_expenses,
 *              finance_daily_closures, daily_closures, expense_categories,
 *              fee_categories, fee_regimes
 *   - Pédagogie (teachers, subjects, classes, exams, timetables):
 *              teachers, subjects, exams, timetables, timetable_entries,
 *              class_subjects, class_diaries, teacher_material_assignments,
 *              material_movements, daily_logs, time_slots
 *   - HR (only test data — keep real staff contracts):
 *              hr_applications, hr_candidates, hr_jobs, hr_tests
 *
 * TABLES PRESERVED (Settings + RH real data per user request):
 *   - academic_years, academic_periods, academic_tracks
 *   - school_levels, education_levels, education_series
 *   - classrooms, rooms, allowance_types
 *   - tenant_features, tenant_domains, tenant_identity_profiles
 *   - financial_settings, school_settings, security_settings
 *   - settings_bilingual, settings_communication, settings_pedagogical_structure
 *   - atlas_settings, offline_sync_settings, orion_settings
 *   - modules, message_templates, meeting_minutes_templates
 *   - communication_channels, automated_triggers
 *   - staff (Erhel DEGBE — real promoter)
 *   - staff_contracts, payroll_periods (real HR data)
 *   - users (real user account)
 *   - pedagogy_academic_classes, pedagogy_academic_cycles,
 *     pedagogy_academic_levels, pedagogy_academic_series (academic structure)
 *   - pedagogy_teacher_academic_profiles, pedagogy_teacher_availabilities,
 *     pedagogy_teacher_level_authorizations, pedagogy_teacher_subject_qualifications
 *     (these are SETTINGS — but they reference teachers that we're deleting,
 *      so we need to delete them too as orphans)
 *   - hr_applications, hr_candidates, hr_jobs, hr_tests (the user only
 *     mentioned they entered staff in HR, not recruitment; these test
 *     recruitment records should be cleaned)
 *
 * SAFE-MODE: this script DRY-RUNS first and only deletes when --confirm is passed.
 * ============================================================================
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
    console.log(`✅ Connected to Neon DB`);
    console.log(`🎯 Target tenant: CSPEB (${CSPEB_ID})`);
    console.log(`🔧 Mode: ${CONFIRM ? 'CONFIRM (will DELETE)' : 'DRY-RUN (no changes)'}\n`);

    // ─── Tables to clean, in dependency order (children first) ─────────────
    // Each entry: [table, label, optional WHERE clause addition]
    const tablesToClean = [
      // ─── Finance ──────────────────────────────────────────────────────────
      ['payments', 'Finance — Payments'],
      ['finance_expenses', 'Finance — finance_expenses'],
      ['finance_daily_closures', 'Finance — finance_daily_closures (test closures)'],
      ['daily_closures', 'Finance — daily_closures'],
      ['expenses', 'Finance — Expenses'],
      ['fee_structures', 'Finance — Fee structures (Scolarité CM2/4ème tests)'],
      // settings preserved: fee_categories, fee_regimes, expense_categories

      // ─── Élèves ───────────────────────────────────────────────────────────
      ['student_guardians', 'Élèves — Student guardians'],
      ['admissions', 'Élèves — Admissions'],
      ['students', 'Élèves — Students (4 fictitious: Benedicta, Adèle, Koffi, Aminata)'],

      // ─── Pédagogie — Exams & Grades ───────────────────────────────────────
      ['exams', 'Pédagogie — Exams (5 test exams)'],

      // ─── Pédagogie — Timetables ───────────────────────────────────────────
      ['timetable_entries', 'Pédagogie — Timetable entries'],
      ['timetables', 'Pédagogie — Timetables'],
      ['time_slots', 'Pédagogie — Time slots'],

      // ─── Pédagogie — Class diaries ────────────────────────────────────────
      ['class_diaries', 'Pédagogie — Class diaries'],
      ['daily_logs', 'Pédagogie — Daily logs'],

      // ─── Pédagogie — Material ─────────────────────────────────────────────
      ['teacher_material_assignments', 'Pédagogie — Teacher material assignments'],
      ['material_movements', 'Pédagogie — Material movements'],

      // ─── Pédagogie — Teachers (orphans profiles to clean too) ─────────────
      ['pedagogy_teaching_assignments', 'Pédagogie — Teaching assignments'],
      ['pedagogy_teacher_level_authorizations', 'Pédagogie — Teacher level authorizations (orphan settings)'],
      ['pedagogy_teacher_subject_qualifications', 'Pédagogie — Teacher subject qualifications (orphan settings)'],
      ['pedagogy_teacher_availabilities', 'Pédagogie — Teacher availabilities (orphan settings)'],
      ['pedagogy_teacher_academic_profiles', 'Pédagogie — Teacher academic profiles (orphan settings)'],
      ['teachers', 'Pédagogie — Teachers (4 fictitious: Pierre, Marie, Jean D, Jean TestDB)'],

      // ─── Pédagogie — Subjects (test subjects only) ────────────────────────
      // Keep "Français" and "Mathématiques" (real), delete "Mathématiques Test"
      // and "Test Subject Updated" via WHERE clause
      // We'll handle this separately with a WHERE clause below.

      // ─── Pédagogie — Class subjects (junction) ────────────────────────────
      ['class_subjects', 'Pédagogie — Class subjects (junction)'],

      // ─── HR — Recruitment test data ───────────────────────────────────────
      ['hr_applications', 'RH — HR Applications (test recruitment)'],
      ['hr_candidates', 'RH — HR Candidates (test recruitment)'],
      ['hr_jobs', 'RH — HR Jobs (test job offers)'],
      ['hr_tests', 'RH — HR Tests (test evaluations)'],
      ['hr_interviews', 'RH — HR Interviews (if any)'],
      // Keep: staff, staff_contracts, payroll_periods (real HR data)

      // ─── Orion (system-generated alerts, can be regenerated) ──────────────
      ['orion_alerts', 'ORION — Generated alerts (35)'],
    ];

    let totalDeleted = 0;
    let totalErrors = 0;
    const summary = [];

    for (const [table, label] of tablesToClean) {
      try {
        // Count first
        const countRes = await client.query(
          `SELECT COUNT(*)::int as n FROM "${table}" WHERE "tenantId" = $1`,
          [CSPEB_ID]
        );
        const count = countRes.rows[0].n;

        if (count === 0) {
          console.log(`  ⏭️  ${label.padEnd(60)} — 0 records (skip)`);
          summary.push({ table, label, count: 0, deleted: 0, status: 'empty' });
          continue;
        }

        if (CONFIRM) {
          // Delete
          const delRes = await client.query(
            `DELETE FROM "${table}" WHERE "tenantId" = $1`,
            [CSPEB_ID]
          );
          const deleted = delRes.rowCount || 0;
          totalDeleted += deleted;
          console.log(`  🗑️  ${label.padEnd(60)} — ${deleted} deleted`);
          summary.push({ table, label, count, deleted, status: 'deleted' });
        } else {
          console.log(`  🔍 ${label.padEnd(60)} — ${count} records (dry-run)`);
          summary.push({ table, label, count, deleted: 0, status: 'dry-run' });
        }
      } catch (err) {
        totalErrors++;
        console.log(`  ❌ ${label.padEnd(60)} — ERROR: ${err.message}`);
        summary.push({ table, label, count: 0, deleted: 0, status: `error: ${err.message}` });
      }
    }

    // ─── Special case: subjects — only delete test subjects ─────────────────
    console.log('\n--- Subjects: delete only test subjects (preserve real ones) ---');
    try {
      const testSubjectsRes = await client.query(`
        SELECT id, name, code FROM subjects
        WHERE "tenantId" = $1 AND (
          name ILIKE '%test%' OR code ILIKE '%test%'
          OR name ILIKE '%mathématiques test%'
          OR code ILIKE '%MATH-TEST%'
          OR code ILIKE '%TEST-API%'
        );
      `, [CSPEB_ID]);

      console.log(`  Test subjects found: ${testSubjectsRes.rows.length}`);
      for (const s of testSubjectsRes.rows) {
        console.log(`    - ${s.name} (code=${s.code})`);
      }

      if (CONFIRM && testSubjectsRes.rows.length > 0) {
        const delRes = await client.query(`
          DELETE FROM subjects
          WHERE "tenantId" = $1 AND (
            name ILIKE '%test%' OR code ILIKE '%test%'
            OR name ILIKE '%mathématiques test%'
            OR code ILIKE '%MATH-TEST%'
            OR code ILIKE '%TEST-API%'
          );
        `, [CSPEB_ID]);
        console.log(`  🗑️  ${delRes.rowCount} test subjects deleted`);
        totalDeleted += delRes.rowCount || 0;
      }
    } catch (err) {
      console.log(`  ❌ Error cleaning test subjects: ${err.message}`);
      totalErrors++;
    }

    // ─── Final summary ─────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));
    console.log(`  Total deleted: ${totalDeleted}`);
    console.log(`  Total errors:  ${totalErrors}`);
    console.log(`  Mode: ${CONFIRM ? 'CONFIRM' : 'DRY-RUN'}`);
    console.log('\nPreserved (real data):');
    console.log('  - staff (Erhel DEGBE)');
    console.log('  - users (salumerhel2036@gmail.com)');
    console.log('  - staff_contracts, payroll_periods (real HR)');
    console.log('  - academic_years, school_levels, education_* (settings)');
    console.log('  - pedagogy_academic_* (settings)');
    console.log('  - tenant_features, settings_*, financial_settings (settings)');
    console.log('  - subjects: Français, Mathématiques (real subjects preserved)');

    if (!CONFIRM) {
      console.log('\n⚠️  This was a DRY-RUN. To actually delete, re-run with --confirm:');
      console.log(`   node ${__filename} --confirm`);
    }

  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
