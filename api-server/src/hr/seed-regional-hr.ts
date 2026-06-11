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
  console.log('🌍 Début du déploiement des standards RH régionaux (UEMOA/CEDEAO)...');

  const countries = [
    { code: 'BJ', name: 'Bénin', currency: 'XOF', symbol: 'FCFA' },
    { code: 'TG', name: 'Togo', currency: 'XOF', symbol: 'FCFA' },
    { code: 'SN', name: 'Sénégal', currency: 'XOF', symbol: 'FCFA' },
    { code: 'CI', name: 'Côte d\'Ivoire', currency: 'XOF', symbol: 'FCFA' },
    { code: 'BF', name: 'Burkina Faso', currency: 'XOF', symbol: 'FCFA' },
    { code: 'ML', name: 'Mali', currency: 'XOF', symbol: 'FCFA' },
  ];

  // 1. S'assurer que les pays existent
  for (const c of countries) {
    const existing = await prisma.country.findUnique({ where: { code: c.code } });
    if (existing) {
        await prisma.country.update({
            where: { code: c.code },
            data: { name: c.name, currencyCode: c.currency, currencySymbol: c.symbol }
        });
    } else {
        await prisma.country.create({
            data: { code: c.code, name: c.name, currencyCode: c.currency, currencySymbol: c.symbol }
        });
    }
    console.log(`✅ Pays configuré : ${c.name} (${c.code})`);
  }

  // 2. Barèmes IRPP / ITS par pays
  const taxRates = [
    // --- BÉNIN (BJ) ---
    { country: 'BJ', type: 'IRPP', min: 0, max: 60000, rate: 0, desc: 'Tranche exonérée (0%)' },
    { country: 'BJ', type: 'IRPP', min: 60001, max: 150000, rate: 10, desc: 'Tranche 1 (10%)' },
    { country: 'BJ', type: 'IRPP', min: 150001, max: 250000, rate: 15, desc: 'Tranche 2 (15%)' },
    { country: 'BJ', type: 'IRPP', min: 250001, max: 500000, rate: 20, desc: 'Tranche 3 (20%)' },
    { country: 'BJ', type: 'IRPP', min: 500001, max: null, rate: 30, desc: 'Tranche supérieure (30%)' },

    // --- TOGO (TG) ---
    { country: 'TG', type: 'IRPP', min: 0, max: 75000, rate: 0, desc: 'Exonéré (0%)' },
    { country: 'TG', type: 'IRPP', min: 75001, max: 150000, rate: 7, desc: 'Tranche 1 (7%)' },
    { country: 'TG', type: 'IRPP', min: 150001, max: 300000, rate: 15, desc: 'Tranche 2 (15%)' },
    { country: 'TG', type: 'IRPP', min: 300001, max: 600000, rate: 25, desc: 'Tranche 3 (25%)' },
    { country: 'TG', type: 'IRPP', min: 600001, max: null, rate: 35, desc: 'Tranche supérieure (35%)' },

    // --- SÉNÉGAL (SN) - ITS Progressif ---
    { country: 'SN', type: 'IRPP', min: 0, max: 50000, rate: 0, desc: 'Exonéré (0%)' },
    { country: 'SN', type: 'IRPP', min: 50001, max: 150000, rate: 14, desc: 'Tranche 1 (14%)' },
    { country: 'SN', type: 'IRPP', min: 150001, max: 350000, rate: 20, desc: 'Tranche 2 (20%)' },
    { country: 'SN', type: 'IRPP', min: 350001, max: 750000, rate: 28, desc: 'Tranche 3 (28%)' },
    { country: 'SN', type: 'IRPP', min: 750001, max: null, rate: 35, desc: 'Tranche supérieure (35%)' },

    // --- CÔTE D'IVOIRE (CI) - IGR ---
    { country: 'CI', type: 'IRPP', min: 0, max: 50000, rate: 0, desc: 'Exonéré (0%)' },
    { country: 'CI', type: 'IRPP', min: 50001, max: 130000, rate: 10, desc: 'Tranche 1 (10%)' },
    { country: 'CI', type: 'IRPP', min: 130001, max: 200000, rate: 15, desc: 'Tranche 2 (15%)' },
    { country: 'CI', type: 'IRPP', min: 200001, max: 450000, rate: 20, desc: 'Tranche 3 (20%)' },
    { country: 'CI', type: 'IRPP', min: 450001, max: null, rate: 35, desc: 'Tranche supérieure (35%)' },

    // --- BURKINA FASO (BF) - IUTS ---
    { country: 'BF', type: 'IRPP', min: 0, max: 30000, rate: 0, desc: 'Exonéré (0%)' },
    { country: 'BF', type: 'IRPP', min: 30001, max: 50000, rate: 2, desc: 'Tranche 1 (2%)' },
    { country: 'BF', type: 'IRPP', min: 50001, max: 100000, rate: 5, desc: 'Tranche 2 (5%)' },
    { country: 'BF', type: 'IRPP', min: 100001, max: 250000, rate: 10, desc: 'Tranche 3 (10%)' },
    { country: 'BF', type: 'IRPP', min: 250001, max: null, rate: 25, desc: 'Tranche supérieure (25%)' },
  ];

  console.log('📊 Ingestion des barèmes fiscaux progressifs...');

  for (const r of taxRates) {
    const existing = await prisma.taxRate.findFirst({
      where: {
        countryCode: r.country,
        taxType: 'IRPP',
        bracketMin: r.min,
        effectiveFrom: new Date('2026-01-01'),
      }
    });

    if (existing) {
      await prisma.taxRate.update({
        where: { id: existing.id },
        data: {
          bracketMax: r.max ?? undefined,
          ratePercentage: r.rate,
          description: r.desc,
          isActive: true,
        },
      });
    } else {
      await prisma.taxRate.create({
        data: {
          countryCode: r.country,
          taxType: 'IRPP',
          bracketMin: r.min,
          bracketMax: r.max ?? undefined,
          ratePercentage: r.rate,
          description: r.desc,
          effectiveFrom: new Date('2026-01-01'),
          isActive: true,
        },
      });
    }
  }

  console.log('✅ Barèmes fiscaux déployés pour toute la zone UEMOA.');
  console.log('🚀 Academia Helm est prêt pour un déploiement multi-pays.');
}

main()
  .catch((e) => {
    console.error('❌ Erreur pendant le seeding :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
