/**
 * ============================================================================
 * Script rétro-fix : crée les Teachers manquants pour les Staff existants
 * ============================================================================
 *
 * Problème : Avant le fix de batchAssignLevel (commit 895e3543), les Staff
 * affectés à un niveau scolaire dans RH n'étaient JAMAIS créés comme Teacher
 * dans Pédagogie. Résultat : ils n'apparaissaient pas dans Pédagogie > Enseignants.
 *
 * Ce script scanne TOUS les Staff (avec schoolLevelId défini) du tenant,
 * vérifie s'ils ont un Teacher correspondant (par email ou matricule), et
 * crée le Teacher manquant si besoin.
 *
 * Utilisation :
 *   npx tsx scripts/retrofix-create-teachers.ts [TENANT_ID]
 *
 * Si TENANT_ID n'est pas fourni, le script s'applique à TOUS les tenants.
 *
 * ⚠️ À exécuter une seule fois après déploiement du fix.
 * ⚠️ Idempotent — peut être relancé sans doublons (grâce au match par email/matricule).
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RetrofixStats {
  tenantId: string;
  tenantName: string;
  totalStaff: number;
  staffWithLevel: number;
  teachersExisting: number;
  teachersCreated: number;
  errors: number;
}

async function retrofixTenant(tenantId: string): Promise<RetrofixStats> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true },
  });

  const stats: RetrofixStats = {
    tenantId,
    tenantName: tenant?.name || '(inconnu)',
    totalStaff: 0,
    staffWithLevel: 0,
    teachersExisting: 0,
    teachersCreated: 0,
    errors: 0,
  };

  console.log(`\n═══ Traitement tenant : ${tenant?.name || tenantId} ═══`);

  // 1. Récupérer l'année académique active du tenant
  const activeYear = await prisma.academicYear.findFirst({
    where: { isActive: true, tenantId },
    select: { id: true, name: true },
  });
  if (!activeYear) {
    console.log(`  ⚠️ Aucune année académique active pour ce tenant — skip`);
    return stats;
  }
  console.log(`  Année active : ${activeYear.name}`);

  // 2. Récupérer tous les Staff du tenant
  const allStaff = await prisma.staff.findMany({
    where: { tenantId },
    select: {
      id: true, email: true, employeeNumber: true,
      firstName: true, lastName: true, phone: true, gender: true,
      position: true, department: true, hireDate: true, contractType: true,
      schoolLevelId: true, roleType: true,
    },
  });
  stats.totalStaff = allStaff.length;
  console.log(`  Total Staff : ${allStaff.length}`);

  // 3. Filtrer les Staff qui ont un schoolLevelId défini (affectés à un niveau)
  const staffWithLevel = allStaff.filter((s) => s.schoolLevelId);
  stats.staffWithLevel = staffWithLevel.length;
  console.log(`  Staff avec schoolLevelId défini : ${staffWithLevel.length}`);

  if (staffWithLevel.length === 0) {
    console.log(`  → Aucun Staff à traiter.`);
    return stats;
  }

  // 4. Pour chaque Staff avec level, vérifier/créer le Teacher
  for (const s of staffWithLevel) {
    try {
      // Match par email ou matricule (employeeNumber)
      const existingTeacher = await prisma.teacher.findFirst({
        where: {
          tenantId,
          OR: [
            ...(s.email ? [{ email: s.email }] : []),
            ...(s.employeeNumber ? [{ matricule: s.employeeNumber }] : []),
          ],
        },
        select: { id: true, schoolLevelId: true, assignedLanguages: true },
      });

      if (existingTeacher) {
        stats.teachersExisting++;
        // Optionnel : mettre à jour schoolLevelId si différent
        if (existingTeacher.schoolLevelId !== s.schoolLevelId) {
          await prisma.teacher.update({
            where: { id: existingTeacher.id },
            data: {
              schoolLevelId: s.schoolLevelId!,
              // Initialiser assignedLanguages si null (FR+EN par défaut)
              ...(existingTeacher.assignedLanguages === null
                ? { assignedLanguages: ['FR', 'EN'] as any }
                : {}),
            },
          });
          console.log(`  ↻ Teacher ${existingTeacher.id} mis à jour (schoolLevelId) pour Staff ${s.firstName} ${s.lastName}`);
        }
        continue;
      }

      // Aucun Teacher — on le crée
      const newTeacher = await prisma.teacher.create({
        data: {
          tenantId,
          schoolLevelId: s.schoolLevelId!,
          matricule: s.employeeNumber || `STF-${s.id.slice(-8)}`,
          firstName: s.firstName,
          lastName: s.lastName,
          gender: s.gender,
          phone: s.phone,
          email: s.email,
          position: s.position,
          hireDate: s.hireDate,
          contractType: s.contractType,
          status: 'active',
          academicYearId: activeYear.id,
          assignedLanguages: ['FR', 'EN'] as any, // FR+EN par défaut (bilingue)
        },
      });
      stats.teachersCreated++;
      console.log(`  ✅ Teacher créé ${newTeacher.id} pour Staff ${s.firstName} ${s.lastName} (${s.email || s.employeeNumber})`);
    } catch (err: any) {
      stats.errors++;
      console.error(`  ❌ Erreur pour Staff ${s.id} (${s.firstName} ${s.lastName}): ${err.message}`);
    }
  }

  return stats;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Rétro-fix : création des Teachers manquants pour les Staff ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const targetTenantId = process.argv[2];

  let tenantIds: string[] = [];
  if (targetTenantId) {
    tenantIds = [targetTenantId];
    console.log(`\nTenant cible : ${targetTenantId}`);
  } else {
    const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
    tenantIds = tenants.map((t) => t.id);
    console.log(`\n${tenants.length} tenant(s) à traiter`);
  }

  const allStats: RetrofixStats[] = [];
  for (const tenantId of tenantIds) {
    const stats = await retrofixTenant(tenantId);
    allStats.push(stats);
  }

  // Récapitulatif
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                        RÉCAPITULATIF                          ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  for (const s of allStats) {
    console.log(`║ ${s.tenantName.padEnd(30)} | Staff: ${String(s.totalStaff).padStart(4)} | Avec niveau: ${String(s.staffWithLevel).padStart(4)} | Teachers existants: ${String(s.teachersExisting).padStart(4)} | Créés: ${String(s.teachersCreated).padStart(4)} | Erreurs: ${String(s.errors).padStart(4)}`);
  }
  const totals = allStats.reduce(
    (acc, s) => ({
      totalStaff: acc.totalStaff + s.totalStaff,
      staffWithLevel: acc.staffWithLevel + s.staffWithLevel,
      teachersExisting: acc.teachersExisting + s.teachersExisting,
      teachersCreated: acc.teachersCreated + s.teachersCreated,
      errors: acc.errors + s.errors,
    }),
    { totalStaff: 0, staffWithLevel: 0, teachersExisting: 0, teachersCreated: 0, errors: 0 },
  );
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║ TOTAL                          | Staff: ${String(totals.totalStaff).padStart(4)} | Avec niveau: ${String(totals.staffWithLevel).padStart(4)} | Teachers existants: ${String(totals.teachersExisting).padStart(4)} | Créés: ${String(totals.teachersCreated).padStart(4)} | Erreurs: ${String(totals.errors).padStart(4)}`);
  console.log('╚══════════════════════════════════════════════════════════════╝');

  if (totals.errors > 0) {
    console.log(`\n⚠️ ${totals.errors} erreur(s) — vérifiez les logs ci-dessus.`);
  } else {
    console.log(`\n✅ Rétro-fix terminé sans erreur.`);
  }
}

main()
  .catch((err) => {
    console.error('Erreur fatale :', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
