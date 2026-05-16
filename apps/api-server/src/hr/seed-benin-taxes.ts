/**
 * ============================================================================
 * SEED - BARÈMES FISCAUX BÉNIN (IRPP)
 * ============================================================================
 *
 * Seed les barèmes progressifs IRPP pour le Bénin (countryCode='BJ')
 * dans la table TaxRate.
 *
 * Note: Les taux CNSS sont configurés par tenant via l'interface ou
 * via le script seed-hr.ts (PayrollRate par tenantId).
 *
 * Source: Code Général des Impôts du Bénin
 * ============================================================================
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🌍 Seeding IRPP brackets for Bénin (BJ)...');

  const irppBrackets = [
    { min: 0,       max: 60000,  rate: 0,  desc: 'Tranche exonérée (0%)' },
    { min: 60001,   max: 150000, rate: 10, desc: 'Tranche 1 (10%)' },
    { min: 150001,  max: 250000, rate: 15, desc: 'Tranche 2 (15%)' },
    { min: 250001,  max: 500000, rate: 20, desc: 'Tranche 3 (20%)' },
    { min: 500001,  max: null,   rate: 30, desc: 'Tranche supérieure (30%)' },
  ];

  let created = 0;
  let updated = 0;

  for (const b of irppBrackets) {
    const existing = await prisma.taxRate.findFirst({
      where: {
        countryCode: 'BJ',
        taxType: 'IRPP',
        bracketMin: b.min,
        effectiveFrom: new Date('2026-01-01'),
      },
    });

    if (existing) {
      await prisma.taxRate.update({
        where: { id: existing.id },
        data: {
          bracketMax: b.max ?? undefined,
          ratePercentage: b.rate,
          description: b.desc,
          isActive: true,
        },
      });
      updated++;
    } else {
      await prisma.taxRate.create({
        data: {
          countryCode: 'BJ',
          taxType: 'IRPP',
          bracketMin: b.min,
          bracketMax: b.max ?? undefined,
          ratePercentage: b.rate,
          description: b.desc,
          effectiveFrom: new Date('2026-01-01'),
          isActive: true,
        },
      });
      created++;
    }
  }

  console.log(`✅ IRPP Bénin : ${created} créés, ${updated} mis à jour.`);
  console.log('');
  console.log('📋 Barèmes configurés :');
  console.log('  0 – 60,000 XOF        →  0%');
  console.log('  60,001 – 150,000 XOF  → 10%');
  console.log('  150,001 – 250,000 XOF → 15%');
  console.log('  250,001 – 500,000 XOF → 20%');
  console.log('  > 500,000 XOF         → 30%');
  console.log('');
  console.log('⚠️  Les taux CNSS sont configurés par tenant via:');
  console.log('    POST /api/hr/payroll/rates');
  console.log('    { cnssEmployeeRate: 0.036, cnssEmployerRate: 0.164, effectiveFrom: ... }');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
