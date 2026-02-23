/**
 * Migration données : Maternelle PS/MS/GS → Maternelle 1 / Maternelle 2 (Educmaster Bénin)
 *
 * À exécuter une fois pour aligner les tenants existants sur la structure nationale.
 * Mapping : PS → Maternelle 1 (MAT1), MS → Maternelle 2 (MAT2), GS → Maternelle 2 (MAT2).
 *
 * Usage (depuis apps/api-server) :
 *   npm run migrate:maternelle-educmaster
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL requise');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const MATERNELLE_LEVEL_NAME = 'MATERNELLE';
const OLD_CYCLE_NAMES = ['PS', 'MS', 'GS'] as const;
const PS_TO_MAT1 = true;
const MS_TO_MAT2 = true;
const GS_TO_MAT2 = true;

async function main() {
  const levels = await prisma.educationLevel.findMany({
    where: { name: MATERNELLE_LEVEL_NAME },
    include: {
      cycles: {
        where: { name: { in: [...OLD_CYCLE_NAMES] } },
        include: { grades: true },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (levels.length === 0) {
    console.log('Aucun niveau Maternelle avec cycles PS/MS/GS trouvé. Rien à migrer.');
    return;
  }

  for (const level of levels) {
    if (level.cycles.length === 0) {
      console.log(`Tenant ${level.tenantId}: Maternelle sans cycles PS/MS/GS, ignoré.`);
      continue;
    }

    const cycleByName = Object.fromEntries(level.cycles.map((c) => [c.name, c]));
    const gradePs = cycleByName['PS']?.grades?.[0];
    const gradeMs = cycleByName['MS']?.grades?.[0];
    const gradeGs = cycleByName['GS']?.grades?.[0];

    // Créer Maternelle 1 et Maternelle 2 si besoin
    let cycleM1 = await prisma.educationCycle.findFirst({
      where: { levelId: level.id, name: 'Maternelle 1' },
      include: { grades: true },
    });
    let cycleM2 = await prisma.educationCycle.findFirst({
      where: { levelId: level.id, name: 'Maternelle 2' },
      include: { grades: true },
    });

    if (!cycleM1) {
      cycleM1 = await prisma.educationCycle.create({
        data: {
          levelId: level.id,
          name: 'Maternelle 1',
          order: 1,
          grades: {
            create: { name: 'Maternelle 1', code: 'MAT1', order: 1 },
          },
        },
        include: { grades: true },
      });
      console.log(`Tenant ${level.tenantId}: cycle Maternelle 1 + grade MAT1 créés.`);
    }
    if (!cycleM2) {
      cycleM2 = await prisma.educationCycle.create({
        data: {
          levelId: level.id,
          name: 'Maternelle 2',
          order: 2,
          grades: {
            create: { name: 'Maternelle 2', code: 'MAT2', order: 1 },
          },
        },
        include: { grades: true },
      });
      console.log(`Tenant ${level.tenantId}: cycle Maternelle 2 + grade MAT2 créés.`);
    }

    const gradeMat1 = cycleM1.grades[0];
    const gradeMat2 = cycleM2.grades[0];
    if (!gradeMat1 || !gradeMat2) {
      console.warn(`Tenant ${level.tenantId}: grades MAT1/MAT2 manquants, skip.`);
      continue;
    }

    // Mettre à jour les classes physiques
    const updates: { oldGradeId: string; newGradeId: string; count: number }[] = [];

    if (gradePs && PS_TO_MAT1) {
      const count = await prisma.classroom.updateMany({
        where: { gradeId: gradePs.id },
        data: { gradeId: gradeMat1.id },
      });
      if (count.count > 0) updates.push({ oldGradeId: gradePs.id, newGradeId: gradeMat1.id, count: count.count });
    }
    if (gradeMs && MS_TO_MAT2) {
      const count = await prisma.classroom.updateMany({
        where: { gradeId: gradeMs.id },
        data: { gradeId: gradeMat2.id },
      });
      if (count.count > 0) updates.push({ oldGradeId: gradeMs.id, newGradeId: gradeMat2.id, count: count.count });
    }
    if (gradeGs && GS_TO_MAT2) {
      const count = await prisma.classroom.updateMany({
        where: { gradeId: gradeGs.id },
        data: { gradeId: gradeMat2.id },
      });
      if (count.count > 0) updates.push({ oldGradeId: gradeGs.id, newGradeId: gradeMat2.id, count: count.count });
    }

    for (const u of updates) {
      console.log(`Tenant ${level.tenantId}: ${u.count} classe(s) réaffectée(s) (grade ${u.oldGradeId} → ${u.newGradeId}).`);
    }

    // Supprimer les anciens grades puis cycles (PS, MS, GS)
    for (const cycle of level.cycles) {
      for (const g of cycle.grades) {
        const stillUsed = await prisma.classroom.count({ where: { gradeId: g.id } });
        if (stillUsed > 0) {
          console.warn(`Tenant ${level.tenantId}: grade ${g.code} (${g.id}) encore utilisé par ${stillUsed} classe(s), non supprimé.`);
          continue;
        }
        await prisma.educationGrade.delete({ where: { id: g.id } });
        console.log(`Tenant ${level.tenantId}: grade ${g.code} supprimé.`);
      }
      await prisma.educationCycle.delete({ where: { id: cycle.id } });
      console.log(`Tenant ${level.tenantId}: cycle ${cycle.name} supprimé.`);
    }
  }

  console.log('Migration Maternelle Educmaster terminée.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
