const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌍 Début du déploiement des standards RH régionaux (JS version)...');

  const countries = [
    { code: 'BJ', name: 'Bénin', currency: 'XOF', symbol: 'FCFA' },
    { code: 'TG', name: 'Togo', currency: 'XOF', symbol: 'FCFA' },
    { code: 'SN', name: 'Sénégal', currency: 'XOF', symbol: 'FCFA' },
    { code: 'CI', name: 'Côte d\'Ivoire', currency: 'XOF', symbol: 'FCFA' },
    { code: 'BF', name: 'Burkina Faso', currency: 'XOF', symbol: 'FCFA' },
    { code: 'ML', name: 'Mali', currency: 'XOF', symbol: 'FCFA' },
  ];

  for (const c of countries) {
    await prisma.country.upsert({
      where: { code: c.code },
      update: { name: c.name, currencyCode: c.currency, currencySymbol: c.symbol },
      create: { code: c.code, name: c.name, currencyCode: c.currency, currencySymbol: c.symbol },
    });
    console.log(`✅ Pays configuré : ${c.name} (${c.code})`);
  }

  const taxRates = [
    { country: 'BJ', min: 0, max: 60000, rate: 0, desc: 'Tranche exonérée (0%)' },
    { country: 'BJ', min: 60001, max: 150000, rate: 10, desc: 'Tranche 1 (10%)' },
    { country: 'BJ', min: 150001, max: 250000, rate: 15, desc: 'Tranche 2 (15%)' },
    { country: 'BJ', min: 250001, max: 500000, rate: 20, desc: 'Tranche 3 (20%)' },
    { country: 'BJ', min: 500001, max: null, rate: 30, desc: 'Tranche supérieure (30%)' },

    { country: 'TG', min: 0, max: 75000, rate: 0, desc: 'Exonéré (0%)' },
    { country: 'TG', min: 75001, max: 150000, rate: 7, desc: 'Tranche 1 (7%)' },
    { country: 'TG', min: 150001, max: 300000, rate: 15, desc: 'Tranche 2 (15%)' },
    { country: 'TG', min: 300001, max: 600000, rate: 25, desc: 'Tranche 3 (25%)' },
    { country: 'TG', min: 600001, max: null, rate: 35, desc: 'Tranche supérieure (35%)' },

    { country: 'SN', min: 0, max: 50000, rate: 0, desc: 'Exonéré (0%)' },
    { country: 'SN', min: 50001, max: 150000, rate: 14, desc: 'Tranche 1 (14%)' },
    { country: 'SN', min: 150001, max: 350000, rate: 20, desc: 'Tranche 2 (20%)' },
    { country: 'SN', min: 350001, max: 750000, rate: 28, desc: 'Tranche 3 (28%)' },
    { country: 'SN', min: 750001, max: null, rate: 35, desc: 'Tranche supérieure (35%)' },

    { country: 'CI', min: 0, max: 50000, rate: 0, desc: 'Exonéré (0%)' },
    { country: 'CI', min: 50001, max: 130000, rate: 10, desc: 'Tranche 1 (10%)' },
    { country: 'CI', min: 130001, max: 200000, rate: 15, desc: 'Tranche 2 (15%)' },
    { country: 'CI', min: 200001, max: 450000, rate: 20, desc: 'Tranche 3 (20%)' },
    { country: 'CI', min: 450001, max: null, rate: 35, desc: 'Tranche supérieure (35%)' },

    { country: 'BF', min: 0, max: 30000, rate: 0, desc: 'Exonéré (0%)' },
    { country: 'BF', min: 30001, max: 50000, rate: 2, desc: 'Tranche 1 (2%)' },
    { country: 'BF', min: 50001, max: 100000, rate: 5, desc: 'Tranche 2 (5%)' },
    { country: 'BF', min: 100001, max: 250000, rate: 10, desc: 'Tranche 3 (10%)' },
    { country: 'BF', min: 250001, max: null, rate: 25, desc: 'Tranche supérieure (25%)' },
  ];

  for (const r of taxRates) {
    const where = {
        countryCode_taxType_bracketMin_effectiveFrom: {
          countryCode: r.country,
          taxType: 'IRPP',
          bracketMin: r.min,
          effectiveFrom: new Date('2026-01-01'),
        }
    };
    const data = {
        bracketMax: r.max || undefined,
        ratePercentage: r.rate,
        description: r.desc,
        isActive: true,
    };

    await prisma.taxRate.upsert({
      where,
      update: data,
      create: {
        countryCode: r.country,
        taxType: 'IRPP',
        bracketMin: r.min,
        bracketMax: r.max || undefined,
        ratePercentage: r.rate,
        description: r.desc,
        effectiveFrom: new Date('2026-01-01'),
        isActive: true,
      },
    });
  }

  console.log('✅ Barèmes fiscaux déployés pour toute la zone UEMOA.');
}

main()
  .catch((e) => {
    console.error('❌ Erreur :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
