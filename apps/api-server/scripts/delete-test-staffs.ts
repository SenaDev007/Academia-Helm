/**
 * ============================================================================
 * DELETE TEST STAFFS — Saliou AKPAKI, Aurore AKPOVI, Bienvenu KOTCHONI
 * ============================================================================
 *
 * Script de suppression DÉFINITIVE de 3 membres du personnel de test + toutes
 * leurs données liées (candidatures, tests, documents, contrats, paies, etc.).
 *
 * ⚠️ Ce script effectue une suppression IRRÉVERSIBLE.
 *
 * Personnes supprimées :
 *   1. Saliou AKPAKI (Instituteur)
 *   2. Aurore AKPOVI (Secrétaire-Comptable)
 *   3. Bienvenu KOTCHONI (Enseignant)
 *
 * NE SUPPRIME PAS : Erhel DEGBE (PROMOTER — propriétaire de l'école)
 *
 * Usage :
 *   cd apps/api-server
 *   # Assurez-vous que .env contient la bonne DATABASE_URL (PostgreSQL prod)
 *   npx ts-node scripts/delete-test-staffs.ts
 *
 * Le script :
 *   1. Recherche les 3 staffs par nom (insensible à la casse)
 *   2. Pour chaque staff trouvé :
 *      a. Trouve la HrApplication liée (staffId) → récupère le candidateId
 *      b. Supprime le HrCandidate (CASCADE : tests, documents, interviews, etc.)
 *      c. Nettoie les FK optionnelles (transport, library, etc.)
 *      d. Supprime le Teacher correspondant en pédagogie
 *      e. Supprime le Staff (CASCADE : contrats, paies, photos, etc.)
 *   3. Affiche un récapitulatif
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

console.log(`🔌 Connexion à: ${databaseUrl.substring(0, 50)}...`);

// Prisma 7 + PostgreSQL adapter (same pattern as prisma.service.ts)
const pool = new Pool({
  connectionString: databaseUrl,
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  ssl: databaseUrl.includes('sslmode=') ? { rejectUnauthorized: false } : undefined,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// Les 3 personnes à supprimer (prénom + nom)
const TARGETS = [
  { firstName: 'Saliou', lastName: 'AKPAKI' },
  { firstName: 'Aurore', lastName: 'AKPOVI' },
  { firstName: 'Bienvenu', lastName: 'KOTCHONI' },
];

interface DeletionResult {
  name: string;
  staffId: string;
  tenantName: string;
  candidateDeleted: boolean;
  teacherDeleted: boolean;
  staffDeleted: boolean;
  error?: string;
}

async function deleteStaffAndDependencies(
  firstName: string,
  lastName: string,
): Promise<DeletionResult> {
  const result: DeletionResult = {
    name: `${firstName} ${lastName}`,
    staffId: '',
    tenantName: '',
    candidateDeleted: false,
    teacherDeleted: false,
    staffDeleted: false,
  };

  // ─── ÉTAPE 1: Trouver le staff ──
  const staff = await prisma.staff.findFirst({
    where: {
      firstName: { equals: firstName, mode: 'insensitive' },
      lastName: { equals: lastName, mode: 'insensitive' },
    },
    include: {
      tenant: { select: { name: true } },
    },
  });

  if (!staff) {
    result.error = 'Staff non trouvé';
    console.log(`  ⚠️  ${firstName} ${lastName} non trouvé dans la base.`);
    return result;
  }

  result.staffId = staff.id;
  result.tenantName = staff.tenant?.name || '—';
  console.log(`  📋 Trouvé: ${staff.firstName} ${staff.lastName} (id=${staff.id}, tenant=${result.tenantName})`);

  // ─── ÉTAPE 2: Trouver et supprimer la candidature (HrApplication + HrCandidate) ──
  // HrApplication a staffId → on cherche l'application liée à ce staff
  const application = await prisma.hrApplication.findFirst({
    where: { staffId: staff.id },
    select: { id: true, candidateId: true },
  });

  if (application?.candidateId) {
    console.log(`  📝 Candidature trouvée (candidateId=${application.candidateId})`);
    // Supprimer le HrCandidate — CASCADE nettoie automatiquement :
    //   - hr_test_results, hr_interviews, hr_ai_reports
    //   - hr_candidate_documents, hr_teaching_certifications
    //   - hr_academic_profiles, hr_academic_scores
    //   - hr_talent_pool
    // Et supprime aussi hr_applications (qui cascade depuis candidate)
    try {
      await prisma.hrCandidate.delete({ where: { id: application.candidateId } });
      result.candidateDeleted = true;
      console.log(`  ✅ Candidature + tests + documents supprimés (CASCADE)`);
    } catch (err: any) {
      console.log(`  ⚠️  Erreur suppression candidature: ${err.message}`);
      // Fallback: essayer de supprimer l'application seule
      try {
        await prisma.hrApplication.delete({ where: { id: application.id } });
        result.candidateDeleted = true;
        console.log(`  ✅ Application supprimée (candidat conservé)`);
      } catch (err2: any) {
        console.log(`  ⚠️  Erreur suppression application: ${err2.message}`);
      }
    }
  } else {
    console.log(`  ℹ️  Aucune candidature liée trouvée`);
  }

  // ─── ÉTAPE 3: Nettoyer les FK optionnelles (Restrict) ──
  // Ces tables n'ont pas de onDelete: Cascade → doivent être nullifiées avant
  try {
    await prisma.libraryLoan.updateMany({
      where: { staffId: staff.id },
      data: { staffId: null },
    });
  } catch {}

  try {
    await prisma.transportDriver.updateMany({
      where: { staffId: staff.id },
      data: { staffId: null },
    });
  } catch {}

  try {
    await prisma.transportAttendant.updateMany({
      where: { staffId: staff.id },
      data: { staffId: null },
    });
  } catch {}

  // HrApplication.staffId est SET NULL automatiquement, mais on le fait manuellement au cas où
  try {
    await prisma.hrApplication.updateMany({
      where: { staffId: staff.id },
      data: { staffId: null },
    });
  } catch {}

  console.log(`  🧹 FK optionnelles nettoyées`);

  // ─── ÉTAPE 4: Supprimer le Teacher correspondant en pédagogie ──
  // (Pas de FK entre Staff et Teacher — suppression manuelle nécessaire)
  const teacher = await prisma.teacher.findFirst({
    where: {
      tenantId: staff.tenantId,
      OR: [
        { firstName: { equals: firstName, mode: 'insensitive' } },
        { lastName: { equals: lastName, mode: 'insensitive' } },
      ],
    },
  });

  if (teacher) {
    console.log(`  📚 Teacher trouvé en pédagogie (id=${teacher.id})`);
    try {
      // Supprimer les dépendances du Teacher
      await prisma.teacherClassAssignment.deleteMany({ where: { teacherId: teacher.id } }).catch(() => {});
      await prisma.teacherSubject.deleteMany({ where: { teacherId: teacher.id } }).catch(() => {});
      await prisma.teacherMaterialAssignment.deleteMany({ where: { teacherId: teacher.id } }).catch(() => {});
      await prisma.teacherAcademicProfile.deleteMany({ where: { teacherId: teacher.id } }).catch(() => {});
      await prisma.weeklyDutyAssignment.deleteMany({ where: { teacherId: teacher.id } }).catch(() => {});
      await prisma.annualTeacherSupply.deleteMany({ where: { teacherId: teacher.id } }).catch(() => {});
      await prisma.subjectAssignment.deleteMany({ where: { teacherId: teacher.id } }).catch(() => {});
      await prisma.timetableEntry.deleteMany({ where: { teacherId: teacher.id } }).catch(() => {});
      await prisma.lessonPlan.deleteMany({ where: { teacherId: teacher.id } }).catch(() => {});
      await prisma.lessonJournal.deleteMany({ where: { teacherId: teacher.id } }).catch(() => {});
      await prisma.dailyLog.deleteMany({ where: { teacherId: teacher.id } }).catch(() => {});
      await prisma.pedagogicalDocument.deleteMany({ where: { teacherId: teacher.id } }).catch(() => {});

      await prisma.teacher.delete({ where: { id: teacher.id } });
      result.teacherDeleted = true;
      console.log(`  ✅ Teacher supprimé du module Pédagogie`);
    } catch (err: any) {
      console.log(`  ⚠️  Erreur suppression Teacher: ${err.message}`);
    }
  } else {
    console.log(`  ℹ️  Aucun Teacher correspondant en pédagogie`);
  }

  // ─── ÉTAPE 5: Supprimer le Staff (CASCADE pour tout le reste) ──
  // CASCADE nettoie automatiquement :
  //   - staff_documents, staff_photos, staff_assignments
  //   - employment_contracts (+ amendments + sign_tokens)
  //   - staff_attendances, staff_evaluations, staff_trainings, staff_schedules
  //   - staff_allowances, leave_requests, overtime_records
  //   - employee_cnss (+ cnss_declaration_lines)
  //   - payroll_items (+ salary_payments, salary_slips, tax_withholdings)
  //   - one_time_bonuses
  try {
    await prisma.staff.delete({ where: { id: staff.id } });
    result.staffDeleted = true;
    console.log(`  ✅ Staff supprimé (CASCADE: contrats, paies, photos, etc.)`);
  } catch (err: any) {
    result.error = err.message;
    console.log(`  ❌ Erreur suppression Staff: ${err.message}`);
  }

  return result;
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('  SUPPRESSION DES STAFFS DE TEST');
  console.log('  Cibles: Saliou AKPAKI, Aurore AKPOVI, Bienvenu KOTCHONI');
  console.log('  (Erhel DEGBE — PROMOTER — NON supprimé)');
  console.log('='.repeat(70) + '\n');

  const results: DeletionResult[] = [];

  for (const target of TARGETS) {
    console.log(`\n Traitement de ${target.firstName} ${target.lastName}...`);
    const result = await deleteStaffAndDependencies(target.firstName, target.lastName);
    results.push(result);
  }

  // ─── Récapitulatif ──
  console.log('\n' + '='.repeat(70));
  console.log('  RÉCAPITULATIF');
  console.log('='.repeat(70));
  console.table(
    results.map((r) => ({
      Nom: r.name,
      Staff: r.staffDeleted ? '✅ Supprimé' : '❌ Erreur',
      Candidature: r.candidateDeleted ? '✅ Supprimée' : '—',
      Teacher: r.teacherDeleted ? '✅ Supprimé' : '—',
      Erreur: r.error || '',
    })),
  );

  const successCount = results.filter((r) => r.staffDeleted).length;
  console.log(`\n  ${successCount}/${results.length} staff(s) supprimé(s) avec succès.\n`);

  if (successCount === results.length) {
    console.log('  ✨ Tous les staffs de test ont été supprimés.');
    console.log('  Vous pouvez maintenant refaire les inscriptions correctement.\n');
  } else {
    console.log('  ⚠️  Certains staffs n\'ont pas pu être supprimés.');
    console.log('  Vérifiez les erreurs ci-dessus.\n');
  }
}

main()
  .catch((e) => {
    console.error('\n💥 Erreur fatale:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
