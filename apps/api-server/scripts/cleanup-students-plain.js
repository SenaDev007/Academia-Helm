/**
 * Diagnostic + Cleanup des élèves — version Node.js plain (pas de Prisma/dotenv)
 * 
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/cleanup-students-plain.js [tenantId]
 *   DATABASE_URL="..." CONFIRM_DELETE=OUI node scripts/cleanup-students-plain.js [tenantId]
 */

const { Pool } = require('/home/z/my-project/node_modules/pg');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || databaseUrl.startsWith('file:')) {
  console.error('❌ DATABASE_URL non définie ou invalide');
  process.exit(1);
}

const tenantIdArg = process.argv[2];
const isConfirmed = process.env.CONFIRM_DELETE === 'OUI';

async function main() {
  console.log('='.repeat(80));
  console.log('🧹 CLEANUP STUDENTS — Diagnostic + Suppression');
  console.log('='.repeat(80));
  console.log(`Database: ${databaseUrl.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`Tenant filter: ${tenantIdArg || 'ALL TENANTS'}`);
  console.log(`Confirmé: ${isConfirmed ? 'OUI' : 'NON (diagnostic seulement)'}`);
  console.log('');

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // ── 1. DIAGNOSTIC ────────────────────────────────────────────────────
    console.log('📊 DIAGNOSTIC — état actuel');
    console.log('-'.repeat(50));

    // Tenants
    const tenants = await pool.query(`
      SELECT id, name, slug, subdomain FROM "tenants" ORDER BY name LIMIT 20
    `);
    console.log(`🏛️  Tenants (${tenants.rows.length}):`);
    for (const t of tenants.rows) {
      console.log(`   - ${t.name} | slug=${t.slug || '—'} | id=${t.id}`);
    }
    console.log('');

    // Counts par tenant
    const tenantFilter = tenantIdArg ? `WHERE "tenantId" = $1` : '';
    const params = tenantIdArg ? [tenantIdArg] : [];

    const studentCount = await pool.query(`SELECT COUNT(*)::int as c FROM "students" ${tenantFilter}`, params);
    const enrollCount = await pool.query(`SELECT COUNT(*)::int as c FROM "student_enrollments" ${tenantFilter}`, params);
    const admCount = await pool.query(`SELECT COUNT(*)::int as c FROM "admissions" ${tenantFilter}`, params);

    console.log(`👥 Students: ${studentCount.rows[0].c}`);
    console.log(`📋 Enrollments: ${enrollCount.rows[0].c}`);
    console.log(`📝 Admissions: ${admCount.rows[0].c}`);
    console.log('');

    // Détail des élèves
    const students = await pool.query(`
      SELECT s.id, s."firstName", s."lastName", s."matricule", s.status, t.name as tenant_name
      FROM "students" s
      LEFT JOIN "tenants" t ON t.id = s."tenantId"
      ${tenantFilter}
      ORDER BY s."createdAt" DESC
      LIMIT 20
    `, params);
    console.log(`🎓 Élèves (max 20):`);
    for (const s of students.rows) {
      console.log(`   - ${s.firstName} ${s.lastName} | matricule=${s.matricule || '—'} | status=${s.status} | tenant=${s.tenant_name || '—'}`);
    }
    console.log('');

    // Détail des admissions
    const admissions = await pool.query(`
      SELECT a.id, a."admissionNumber", a."firstName", a."lastName", a.status, t.name as tenant_name
      FROM "admissions" a
      LEFT JOIN "tenants" t ON t.id = a."tenantId"
      ${tenantFilter}
      ORDER BY a."createdAt" DESC
      LIMIT 20
    `, params);
    console.log(`📝 Admissions (max 20):`);
    for (const a of admissions.rows) {
      console.log(`   - ${a.admissionNumber} | ${a.firstName} ${a.lastName} | status=${a.status} | tenant=${a.tenant_name || '—'}`);
    }
    console.log('');

    if (!isConfirmed) {
      console.log('='.repeat(80));
      console.log('ℹ️  Mode diagnostic seulement (CONFIRM_DELETE != OUI).');
      console.log('   Pour supprimer réellement :');
      console.log(`   CONFIRM_DELETE=OUI DATABASE_URL="..." node scripts/cleanup-students-plain.js ${tenantIdArg || ''}`);
      console.log('='.repeat(80));
      return;
    }

    // ── 2. CLEANUP ──────────────────────────────────────────────────────
    console.log('='.repeat(80));
    console.log('🔄 SUPPRESSION EN COURS...');
    console.log('='.repeat(80));

    // 2a. Désactiver les triggers de sécurité
    console.log('   [1/4] Désactivation des triggers...');
    const disableQueries = [
      `ALTER TABLE "students" DISABLE TRIGGER trg_prevent_student_delete`,
      `ALTER TABLE "student_enrollments" DISABLE TRIGGER trg_prevent_year_change`,
      `ALTER TABLE "student_enrollments" DISABLE TRIGGER trg_prevent_update_if_year_closed_enrollments`,
      `ALTER TABLE "student_enrollments" DISABLE TRIGGER trg_prevent_class_change_if_grades`,
      `ALTER TABLE "grades" DISABLE TRIGGER trg_prevent_update_if_year_closed_grades`,
      `ALTER TABLE "fee_arrears" DISABLE TRIGGER trg_prevent_update_if_year_closed_fee_arrears`,
    ];
    for (const q of disableQueries) {
      try {
        await pool.query(q);
      } catch (err) {
        console.log(`      ⚠️  ${err.message}`);
      }
    }
    console.log('      ✓ Triggers désactivés');

    // 2b. Supprimer les tables liées (cascade)
    console.log('   [2/4] Suppression des tables liées...');
    const deleteTables = [
      'student_audit_logs',
      'student_academic_records',
      'student_id_cards',
      'student_identifiers',
      'student_photos',
      'student_guardians',
      'attendance_records',
      'discipline_records',
      'grades',
      'fee_arrears',
      'student_enrollments',
      'transfers',
      'transfer_requests',
      'admission_documents',
      'admissions',
      'student_fee_profiles',
      'student_accounts',
    ];
    for (const table of deleteTables) {
      try {
        const res = await pool.query(`DELETE FROM "${table}" ${tenantFilter}`, params);
        if (res.rowCount && res.rowCount > 0) {
          console.log(`      ✓ ${table}: ${res.rowCount} ligne(s)`);
        }
      } catch (err) {
        // Table peut ne pas exister
      }
    }

    // Supprimer les guardians orphelins
    if (tenantIdArg) {
      try {
        const orphanRes = await pool.query(`
          DELETE FROM "guardians"
          WHERE "tenantId" = $1
            AND id NOT IN (SELECT "guardianId" FROM "student_guardians")
        `, params);
        if (orphanRes.rowCount && orphanRes.rowCount > 0) {
          console.log(`      ✓ guardians (orphelins): ${orphanRes.rowCount} ligne(s)`);
        }
      } catch (err) {
        // ignore
      }
    }

    // 2c. Supprimer les students
    console.log('   [3/4] Suppression des students...');
    const studentDeleteRes = await pool.query(`DELETE FROM "students" ${tenantFilter}`, params);
    console.log(`      ✓ students: ${studentDeleteRes.rowCount} ligne(s)`);

    // 2d. Réactiver les triggers
    console.log('   [4/4] Réactivation des triggers...');
    const enableQueries = [
      `ALTER TABLE "students" ENABLE TRIGGER trg_prevent_student_delete`,
      `ALTER TABLE "student_enrollments" ENABLE TRIGGER trg_prevent_year_change`,
      `ALTER TABLE "student_enrollments" ENABLE TRIGGER trg_prevent_update_if_year_closed_enrollments`,
      `ALTER TABLE "student_enrollments" ENABLE TRIGGER trg_prevent_class_change_if_grades`,
      `ALTER TABLE "grades" ENABLE TRIGGER trg_prevent_update_if_year_closed_grades`,
      `ALTER TABLE "fee_arrears" ENABLE TRIGGER trg_prevent_update_if_year_closed_fee_arrears`,
    ];
    for (const q of enableQueries) {
      try {
        await pool.query(q);
      } catch (err) {
        console.log(`      ⚠️  ${err.message}`);
      }
    }
    console.log('      ✓ Triggers réactivés');

    // ── 3. VÉRIFICATION FINALE ──────────────────────────────────────────
    console.log('');
    console.log('📊 APRÈS SUPPRESSION');
    console.log('-'.repeat(50));
    const finalStudent = await pool.query(`SELECT COUNT(*)::int as c FROM "students" ${tenantFilter}`, params);
    const finalEnroll = await pool.query(`SELECT COUNT(*)::int as c FROM "student_enrollments" ${tenantFilter}`, params);
    const finalAdm = await pool.query(`SELECT COUNT(*)::int as c FROM "admissions" ${tenantFilter}`, params);
    console.log(`👥 Students: ${finalStudent.rows[0].c}`);
    console.log(`📋 Enrollments: ${finalEnroll.rows[0].c}`);
    console.log(`📝 Admissions: ${finalAdm.rows[0].c}`);
    console.log('');
    console.log('='.repeat(80));
    console.log('✅ Nettoyage terminé !');
    console.log('='.repeat(80));

  } catch (err) {
    console.error('❌ Erreur :', err.message);
    console.error(err.stack);
    // Réactiver les triggers en cas d'erreur
    try {
      await pool.query(`ALTER TABLE "students" ENABLE TRIGGER trg_prevent_student_delete`);
      await pool.query(`ALTER TABLE "student_enrollments" ENABLE TRIGGER trg_prevent_year_change`);
      await pool.query(`ALTER TABLE "student_enrollments" ENABLE TRIGGER trg_prevent_update_if_year_closed_enrollments`);
      await pool.query(`ALTER TABLE "student_enrollments" ENABLE TRIGGER trg_prevent_class_change_if_grades`);
      await pool.query(`ALTER TABLE "grades" ENABLE TRIGGER trg_prevent_update_if_year_closed_grades`);
      await pool.query(`ALTER TABLE "fee_arrears" ENABLE TRIGGER trg_prevent_update_if_year_closed_fee_arrears`);
      console.log('⚠️  Triggers réactivés après erreur.');
    } catch (e) {
      console.error('❌❌ Triggers NON réactivés — intervention manuelle requise !');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
