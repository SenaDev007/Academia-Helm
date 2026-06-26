/**
 * ============================================================================
 * DELETE STAFF — KOTCHONI Bienvenu
 * ============================================================================
 *
 * Script de suppression définitive (hard delete) d'un membre du personnel.
 *
 * Usage:
 *   cd apps/api-server
 *   npx ts-node scripts/delete-kotchoni.ts
 *
 * ⚠️ Ce script effectue une suppression DÉFINITIVE (hard delete).
 *   - Supprime le Staff + toutes les données liées (cascade)
 *   - Supprime également le Teacher correspondant dans le module Pédagogie
 *     (si existant — non géré par cascade car pas de FK)
 *
 * Prérequis:
 *   - DATABASE_URL doit être configurée dans apps/api-server/.env
 *   - La variable doit pointer vers la base PostgreSQL de production
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FIRST_NAME = 'Bienvenu'; // prénom
const LAST_NAME = 'KOTCHONI'; // nom de famille

async function main() {
  console.log(`\n🔍 Recherche du personnel: ${FIRST_NAME} ${LAST_NAME}...\n`);

  // ─── ÉTAPE 1: Rechercher tous les staffs correspondants ──
  const candidates = await prisma.staff.findMany({
    where: {
      firstName: { equals: FIRST_NAME, mode: 'insensitive' },
      lastName: { equals: LAST_NAME, mode: 'insensitive' },
    },
    include: {
      tenant: { select: { id: true, name: true, subdomain: true } },
      _count: {
        select: {
          contracts: true,
          payrollItems: true,
          salaryPayments: true,
          leaveRequests: true,
          staffAllowances: true,
          staffSchedules: true,
          staffAssignments: true,
          staffAttendance: true,
          documents: true,
        },
      },
    },
  });

  if (candidates.length === 0) {
    console.log('❌ Aucun personnel trouvé avec ce nom.');
    console.log('   Vérifiez l\'orthographe ou les majuscules/minuscules.');
    return;
  }

  console.log(`✅ ${candidates.length} personnel(s) trouvé(s):\n`);
  console.table(
    candidates.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      tenant: s.tenant?.name || '—',
      employeeNumber: s.employeeNumber,
      status: s.status,
      contracts: s._count.contracts,
      payrollItems: s._count.payrollItems,
    })),
  );

  if (candidates.length > 1) {
    console.log('\n⚠️  Plusieurs personnels trouvés. Veuillez spécifier l\'ID exact.');
    console.log('   Modifiez ce script pour filtrer par ID, ou supprimez manuellement.');
    return;
  }

  const target = candidates[0];
  console.log(`\n🎯 Suppression de: ${target.firstName} ${target.lastName} (${target.id})`);
  console.log(`   Tenant: ${target.tenant?.name}`);

  // ─── ÉTAPE 2: Supprimer le Teacher correspondant dans le module Pédagogie ──
  // (Pas de FK entre Staff et Teacher — suppression manuelle nécessaire)
  const teacher = await prisma.teacher.findFirst({
    where: {
      tenantId: target.tenantId,
      OR: [
        { firstName: { equals: FIRST_NAME, mode: 'insensitive' } },
        { lastName: { equals: LAST_NAME, mode: 'insensitive' } },
      ],
    },
  });

  if (teacher) {
    console.log(`\n📚 Teacher trouvé dans le module Pédagogie: ${teacher.id}`);
    console.log('   Suppression des dépendances Teacher...');

    // Supprimer les dépendances du Teacher (pas de cascade automatique)
    try {
      await prisma.teacherClassAssignment.deleteMany({ where: { teacherId: teacher.id } });
      await prisma.teacherSubject.deleteMany({ where: { teacherId: teacher.id } });
      await prisma.teacherMaterialAssignment.deleteMany({ where: { teacherId: teacher.id } });
      await prisma.teacherAcademicProfile.deleteMany({ where: { teacherId: teacher.id } });
      await prisma.weeklyDutyAssignment.deleteMany({ where: { teacherId: teacher.id } });
      await prisma.annualTeacherSupply.deleteMany({ where: { teacherId: teacher.id } });
      await prisma.subjectAssignment.deleteMany({ where: { teacherId: teacher.id } });

      // Supprimer les TimetableEntry, LessonPlan, LessonJournal, DailyLog, PedagogicalDocument
      // (ils ont teacherId en FK)
      await prisma.timetableEntry.deleteMany({ where: { teacherId: teacher.id } }).catch(() => {});
      await prisma.lessonPlan.deleteMany({ where: { teacherId: teacher.id } }).catch(() => {});
      await prisma.lessonJournal.deleteMany({ where: { teacherId: teacher.id } }).catch(() => {});
      await prisma.dailyLog.deleteMany({ where: { teacherId: teacher.id } }).catch(() => {});
      await prisma.pedagogicalDocument.deleteMany({ where: { teacherId: teacher.id } }).catch(() => {});

      await prisma.teacher.delete({ where: { id: teacher.id } });
      console.log('   ✅ Teacher supprimé du module Pédagogie.');
    } catch (err: any) {
      console.log(`   ⚠️  Erreur lors de la suppression du Teacher: ${err.message}`);
      console.log('   Le Teacher reste dans la base. Supprimez-le manuellement si nécessaire.');
    }
  } else {
    console.log('\n📚 Aucun Teacher correspondant trouvé dans le module Pédagogie.');
  }

  // ─── ÉTAPE 3: Nettoyer les FK optionnelles qui bloquent la suppression ──
  console.log('\n🧹 Nettoyage des FK optionnelles...');

  await prisma.libraryLoan.updateMany({
    where: { staffId: target.id },
    data: { staffId: null },
  }).catch(() => {});

  await prisma.transportDriver.updateMany({
    where: { staffId: target.id },
    data: { staffId: null },
  }).catch(() => {});

  await prisma.transportAttendant.updateMany({
    where: { staffId: target.id },
    data: { staffId: null },
  }).catch(() => {});

  await prisma.hrApplication.updateMany({
    where: { staffId: target.id },
    data: { staffId: null },
  }).catch(() => {});

  console.log('   ✅ FK optionnelles nettoyées.');

  // ─── ÉTAPE 4: Supprimer le Staff (cascade automatique pour le reste) ──
  console.log('\n🗑️  Suppression du Staff...');

  try {
    await prisma.staff.delete({ where: { id: target.id } });
    console.log('   ✅ Staff supprimé avec succès!');
  } catch (err: any) {
    console.log(`   ❌ Erreur lors de la suppression: ${err.message}`);
    console.log('   Vérifiez les dépendances restantes et réessayez.');
    return;
  }

  console.log('\n✨ Suppression terminée avec succès!');
  console.log(`   ${target.firstName} ${target.lastName} a été retiré de la base de données.`);
  console.log('   Vous pouvez maintenant refaire son inscription correctement.\n');
}

main()
  .catch((e) => {
    console.error('\n💥 Erreur fatale:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
