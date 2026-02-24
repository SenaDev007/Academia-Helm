/**
 * Remplit education_series (A1, A2, B, C, D) et crée les grades du 2nd cycle avec série.
 * Migre les classes physiques des anciens grades (2nde, 1ère, Terminale) vers les nouveaux (2nde A1, etc.).
 *
 * Usage (depuis apps/api-server) :
 *   npx ts-node -r tsconfig-paths/register scripts/seed-education-series-and-second-cycle.ts
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

const DEFAULT_SERIES = [
  { code: 'A1', name: 'Série A1', order: 1 },
  { code: 'A2', name: 'Série A2', order: 2 },
  { code: 'B', name: 'Série B', order: 3 },
  { code: 'C', name: 'Série C', order: 4 },
  { code: 'D', name: 'Série D', order: 5 },
];

const SECOND_CYCLE_GRADES = [
  { name: '2nde A1', code: '2NDE_A1', order: 1, seriesCode: 'A1' },
  { name: '2nde A2', code: '2NDE_A2', order: 2, seriesCode: 'A2' },
  { name: '2nde B', code: '2NDE_B', order: 3, seriesCode: 'B' },
  { name: '2nde C', code: '2NDE_C', order: 4, seriesCode: 'C' },
  { name: '2nde D', code: '2NDE_D', order: 5, seriesCode: 'D' },
  { name: '1ère A1', code: '1ERE_A1', order: 6, seriesCode: 'A1' },
  { name: '1ère A2', code: '1ERE_A2', order: 7, seriesCode: 'A2' },
  { name: '1ère B', code: '1ERE_B', order: 8, seriesCode: 'B' },
  { name: '1ère C', code: '1ERE_C', order: 9, seriesCode: 'C' },
  { name: '1ère D', code: '1ERE_D', order: 10, seriesCode: 'D' },
  { name: 'Terminale A1', code: 'TLE_A1', order: 11, seriesCode: 'A1' },
  { name: 'Terminale A2', code: 'TLE_A2', order: 12, seriesCode: 'A2' },
  { name: 'Terminale B', code: 'TLE_B', order: 13, seriesCode: 'B' },
  { name: 'Terminale C', code: 'TLE_C', order: 14, seriesCode: 'C' },
  { name: 'Terminale D', code: 'TLE_D', order: 15, seriesCode: 'D' },
];

const OLD_CODES = ['2NDE', '1ERE', 'TLE'];
const OLD_TO_NEW_CODE: Record<string, string> = { '2NDE': '2NDE_A1', '1ERE': '1ERE_A1', 'TLE': 'TLE_A1' };

async function main() {
  const tenantIds = await prisma.educationLevel.findMany({ select: { tenantId: true }, distinct: ['tenantId'] }).then((r) => r.map((x) => x.tenantId));
  if (tenantIds.length === 0) {
    console.log('Aucun tenant avec des niveaux. Rien à faire.');
    return;
  }

  for (const tenantId of tenantIds) {
    console.log(`\n--- Tenant ${tenantId} ---`);

    for (const s of DEFAULT_SERIES) {
      await prisma.educationSeries.upsert({
        where: { tenantId_code: { tenantId, code: s.code } },
        create: { tenantId, code: s.code, name: s.name, order: s.order },
        update: { name: s.name, order: s.order },
      });
    }
    console.log('Séries A1, A2, B, C, D créées ou à jour.');

    const seriesByCode = await prisma.educationSeries.findMany({ where: { tenantId } }).then((list) => new Map(list.map((s) => [s.code, s.id])));

    const secLevel = await prisma.educationLevel.findFirst({ where: { tenantId, name: 'SECONDAIRE' } });
    if (!secLevel) continue;

    const secondCycle = await prisma.educationCycle.findFirst({ where: { levelId: secLevel.id, name: '2nd cycle' } });
    if (!secondCycle) continue;

    for (const gr of SECOND_CYCLE_GRADES) {
      const seriesId = seriesByCode.get(gr.seriesCode) ?? null;
      const existing = await prisma.educationGrade.findFirst({ where: { cycleId: secondCycle.id, code: gr.code } });
      if (!existing) {
        await prisma.educationGrade.create({
          data: {
            cycleId: secondCycle.id,
            seriesId: seriesId ?? undefined,
            name: gr.name,
            code: gr.code,
            order: gr.order,
          },
        });
        console.log(`Grade créé: ${gr.name}`);
      }
    }

    const oldGrades = await prisma.educationGrade.findMany({
      where: { cycleId: secondCycle.id, code: { in: OLD_CODES } },
      include: { _count: { select: { classrooms: true } } },
    });

    for (const oldGrade of oldGrades) {
      const newCode = OLD_TO_NEW_CODE[oldGrade.code];
      const newGrade = await prisma.educationGrade.findFirst({ where: { cycleId: secondCycle.id, code: newCode } });
      if (!newGrade) continue;

      const updated = await prisma.classroom.updateMany({
        where: { gradeId: oldGrade.id },
        data: { gradeId: newGrade.id },
      });
      if (updated.count > 0) console.log(`${updated.count} classe(s) migrée(s) de ${oldGrade.code} vers ${newCode}`);

      const stillUsed = await prisma.classroom.count({ where: { gradeId: oldGrade.id } });
      if (stillUsed === 0) {
        await prisma.educationGrade.delete({ where: { id: oldGrade.id } });
        console.log(`Ancien grade supprimé: ${oldGrade.code}`);
      }
    }
  }

  console.log('\nTerminé.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
