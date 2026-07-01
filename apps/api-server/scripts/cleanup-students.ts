/**
 * ============================================================================
 * CLEANUP STUDENTS — Suppression de TOUS les élèves d'un tenant
 * ============================================================================
 *
 * Script de suppression DÉFINITIVE de tous les élèves d'un tenant, avec toutes
 * leurs données liées (enrollments, guardians, identifiers, ID cards, photos,
 * academic records, audit logs, etc.).
 *
 * ⚠️ Ce script effectue une suppression IRRÉVERSIBLE.
 *
 * Le script :
 *   1. Désactive temporairement les triggers de sécurité (prevent_student_delete,
 *      prevent_update_if_year_closed, prevent_class_change_if_grades, etc.)
 *   2. Supprime en cascade toutes les tables liées aux élèves
 *   3. Réactive les triggers
 *
 * Usage :
 *   cd apps/api-server
 *   # Créez .env avec DATABASE_URL PostgreSQL (production Neon)
 *   npx ts-node scripts/cleanup-students.ts [tenantId]
 *
 *   Si tenantId n'est pas fourni, supprime TOUS les élèves de TOUS les tenants.
 *
 * ============================================================================
 */

import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as path from 'path';

// Load environment variables from apps/api-server/.env (override existing)
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath, override: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || databaseUrl.startsWith('file:')) {
  console.error('❌ DATABASE_URL non définie ou invalide (SQLite).');
  console.error('   Créez apps/api-server/.env avec DATABASE_URL PostgreSQL');
  console.error(`   Chemin attendu: ${envPath}`);
  process.exit(1);
}

const tenantIdArg = process.argv[2];

async function main() {
  console.log('='.repeat(80));
  console.log('🧹 CLEANUP STUDENTS — Suppression définitive de tous les élèves');
  console.log('='.repeat(80));
  console.log(`Database: ${databaseUrl.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`Tenant filter: ${tenantIdArg || 'ALL TENANTS'}`);
  console.log('');

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // ── 1. Compter les élèves avant suppression ──────────────────────────
    const whereClause = tenantIdArg ? { tenantId: tenantIdArg } : {};
    const studentCount = await prisma.student.count({ where: whereClause as any });
    const enrollmentCount = await prisma.studentEnrollment.count({ where: whereClause as any });
    const admissionCount = await prisma.admission.count({ where: whereClause as any });

    console.log(`📊 Avant suppression :`);
    console.log(`   - ${studentCount} élève(s)`);
    console.log(`   - ${enrollmentCount} enrollment(s)`);
    console.log(`   - ${admissionCount} admission(s)`);
    console.log('');

    if (studentCount === 0 && enrollmentCount === 0 && admissionCount === 0) {
      console.log('✅ Rien à supprimer — la base est déjà propre.');
      return;
    }

    // Confirmation
    console.log('⚠️  ATTENTION : Cette action est IRRÉVERSIBLE.');
    console.log('   Tous les élèves, enrollments, admissions, guardians, identifiers,');
    console.log('   ID cards, photos, academic records, audit logs seront supprimés.');
    console.log('');
    console.log('   Pour confirmer, tapez OUI et appuyez sur Entrée :');

    // En mode non-interactif (pas de TTY), on demande une variable d'env
    const isInteractive = process.stdin.isTTY;
    if (isInteractive) {
      const answer = await new Promise<string>(resolve => {
        process.stdin.setEncoding('utf8');
        process.stdin.resume();
        process.stdin.once('data', data => {
          resolve(data.trim().toUpperCase());
        });
      });
      if (answer !== 'OUI') {
        console.log('❌ Annulé.');
        return;
      }
    } else {
      if (process.env.CONFIRM_DELETE !== 'OUI') {
        console.error('❌ Mode non-interactif : définissez CONFIRM_DELETE=OUI pour confirmer.');
        process.exit(1);
      }
    }

    console.log('');
    console.log('🔄 Suppression en cours...');

    // ── 2. Désactiver les triggers de sécurité ───────────────────────────
    console.log('   [1/4] Désactivation des triggers de sécurité...');
    await pool.query(`
      ALTER TABLE "students" DISABLE TRIGGER trg_prevent_student_delete;
      ALTER TABLE "student_enrollments" DISABLE TRIGGER trg_prevent_year_change;
      ALTER TABLE "student_enrollments" DISABLE TRIGGER trg_prevent_update_if_year_closed_enrollments;
      ALTER TABLE "student_enrollments" DISABLE TRIGGER trg_prevent_class_change_if_grades;
      ALTER TABLE "grades" DISABLE TRIGGER trg_prevent_update_if_year_closed_grades;
      ALTER TABLE "fee_arrears" DISABLE TRIGGER trg_prevent_update_if_year_closed_fee_arrears;
    `).catch(err => {
      // Certains triggers peuvent ne pas exister — on continue
      console.log(`   ⚠️  Certains triggers n'ont pas pu être désactivés (continuons) : ${err.message}`);
    });

    // ── 3. Supprimer en cascade toutes les tables liées ──────────────────
    console.log('   [2/4] Suppression des tables liées (cascade)...');
    const tenantFilter = tenantIdArg ? `WHERE "tenantId" = $1` : '';
    const params = tenantIdArg ? [tenantIdArg] : [];

    // Tables enfants (dans l'ordre pour éviter les FK violations)
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
      'student_academic_records',
    ];

    for (const table of deleteTables) {
      try {
        const res = await pool.query(`DELETE FROM "${table}" ${tenantFilter}`, params);
        if (res.rowCount && res.rowCount > 0) {
          console.log(`      ✓ ${table}: ${res.rowCount} ligne(s) supprimée(s)`);
        }
      } catch (err: any) {
        // Table peut ne pas exister — on continue
      }
    }

    // Supprimer les guardians orphelins (sans student_guardian lié)
    if (tenantIdArg) {
      try {
        const orphanGuardians = await pool.query(`
          DELETE FROM "guardians"
          WHERE "tenantId" = $1
            AND id NOT IN (SELECT "guardianId" FROM "student_guardians")
        `, params);
        if (orphanGuardians.rowCount && orphanGuardians.rowCount > 0) {
          console.log(`      ✓ guardians (orphelins): ${orphanGuardians.rowCount} ligne(s) supprimée(s)`);
        }
      } catch (err: any) {
        // ignore
      }
    }

    // Enfin, supprimer les students
    console.log('   [3/4] Suppression des students...');
    const studentDeleteRes = await pool.query(`DELETE FROM "students" ${tenantFilter}`, params);
    console.log(`      ✓ students: ${studentDeleteRes.rowCount} ligne(s) supprimée(s)`);

    // ── 4. Réactiver les triggers ────────────────────────────────────────
    console.log('   [4/4] Réactivation des triggers de sécurité...');
    await pool.query(`
      ALTER TABLE "students" ENABLE TRIGGER trg_prevent_student_delete;
      ALTER TABLE "student_enrollments" ENABLE TRIGGER trg_prevent_year_change;
      ALTER TABLE "student_enrollments" ENABLE TRIGGER trg_prevent_update_if_year_closed_enrollments;
      ALTER TABLE "student_enrollments" ENABLE TRIGGER trg_prevent_class_change_if_grades;
      ALTER TABLE "grades" ENABLE TRIGGER trg_prevent_update_if_year_closed_grades;
      ALTER TABLE "fee_arrears" ENABLE TRIGGER trg_prevent_update_if_year_closed_fee_arrears;
    `).catch(err => {
      console.log(`   ⚠️  Certains triggers n'ont pas pu être réactivés : ${err.message}`);
    });

    // ── 5. Vérification finale ───────────────────────────────────────────
    console.log('');
    console.log('📊 Après suppression :');
    const finalStudentCount = await prisma.student.count({ where: whereClause as any });
    const finalEnrollmentCount = await prisma.studentEnrollment.count({ where: whereClause as any });
    const finalAdmissionCount = await prisma.admission.count({ where: whereClause as any });
    console.log(`   - ${finalStudentCount} élève(s)`);
    console.log(`   - ${finalEnrollmentCount} enrollment(s)`);
    console.log(`   - ${finalAdmissionCount} admission(s)`);
    console.log('');
    console.log('='.repeat(80));
    console.log('✅ Nettoyage terminé avec succès !');
    console.log('='.repeat(80));

  } catch (err: any) {
    console.error('❌ Erreur :', err.message);
    console.error(err.stack);

    // En cas d'erreur, s'assurer que les triggers sont réactivés
    try {
      await pool.query(`
        ALTER TABLE "students" ENABLE TRIGGER trg_prevent_student_delete;
        ALTER TABLE "student_enrollments" ENABLE TRIGGER trg_prevent_year_change;
        ALTER TABLE "student_enrollments" ENABLE TRIGGER trg_prevent_update_if_year_closed_enrollments;
        ALTER TABLE "student_enrollments" ENABLE TRIGGER trg_prevent_class_change_if_grades;
        ALTER TABLE "grades" ENABLE TRIGGER trg_prevent_update_if_year_closed_grades;
        ALTER TABLE "fee_arrears" ENABLE TRIGGER trg_prevent_update_if_year_closed_fee_arrears;
      `);
      console.log('⚠️  Triggers réactivés après erreur.');
    } catch (e) {
      console.error('❌❌ Impossible de réactiver les triggers — intervention manuelle requise !');
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
