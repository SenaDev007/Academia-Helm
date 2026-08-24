/**
 * Script pour mettre à jour les pricing_plans sur Neon avec les bons prix du contrat.
 */
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected to Neon\n');

    // Vérifier l'état actuel
    console.log('📋 Current pricing_plans:');
    const current = await client.query('SELECT code, name, "studentMin", "studentMax", "initialFee", "yearlyAmount", "monthlyAmount" FROM pricing_plans ORDER BY "sortOrder"');
    current.rows.forEach(r => {
      console.log(`  ${r.code} (${r.name}): students ${r.studentMin}-${r.studentMax || '∞'}, initial=${r.initialFee}, yearly=${r.yearlyAmount}, monthly=${r.monthlyAmount}`);
    });
    console.log('');

    // Mettre à jour les 4 plans selon le contrat
    const updates = [
      {
        code: 'SEED',
        name: 'Helm Essentiel',
        studentMin: 1,
        studentMax: 50,
        initialFee: 300000,
        yearlyAmount: 50000,
        monthlyAmount: null,
        bilingualYearly: 50000,
      },
      {
        code: 'GROW',
        name: 'Helm Croissance',
        studentMin: 51,
        studentMax: 150,
        initialFee: 300000,
        yearlyAmount: 75000,
        monthlyAmount: null,
        bilingualYearly: 50000,
      },
      {
        code: 'LEAD',
        name: 'Helm Performance',
        studentMin: 151,
        studentMax: 400,
        initialFee: 300000,
        yearlyAmount: 100000,
        monthlyAmount: null,
        bilingualYearly: 50000,
      },
      {
        code: 'NETWORK',
        name: 'Helm Institution',
        studentMin: 401,
        studentMax: null,
        initialFee: 300000,
        yearlyAmount: 150000,
        monthlyAmount: null,
        bilingualYearly: 50000,
      },
    ];

    for (const plan of updates) {
      const result = await client.query(`
        UPDATE pricing_plans SET
          name = $2,
          "studentMin" = $3,
          "studentMax" = $4,
          "initialFee" = $5,
          "yearlyAmount" = $6,
          "monthlyAmount" = $7,
          "bilingualYearly" = $8,
          "bilingualMonthly" = NULL,
          "updatedAt" = now()
        WHERE code = $1
        RETURNING code, name
      `, [plan.code, plan.name, plan.studentMin, plan.studentMax, plan.initialFee, plan.yearlyAmount, plan.monthlyAmount, plan.bilingualYearly]);

      if (result.rows.length > 0) {
        console.log(`✅ Updated: ${result.rows[0].code} → ${result.rows[0].name}`);
      } else {
        // Plan n'existe pas → créer
        const insertResult = await client.query(`
          INSERT INTO pricing_plans (code, name, "studentMin", "studentMax", "initialFee", "yearlyAmount", "monthlyAmount", "bilingualYearly", "bilingualMonthly", "isActive", "sortOrder", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, TRUE, 
            CASE $1 WHEN 'SEED' THEN 1 WHEN 'GROW' THEN 2 WHEN 'LEAD' THEN 3 ELSE 4 END,
            now(), now())
          RETURNING code, name
        `, [plan.code, plan.name, plan.studentMin, plan.studentMax, plan.initialFee, plan.yearlyAmount, plan.monthlyAmount, plan.bilingualYearly]);
        console.log(`✅ Created: ${insertResult.rows[0].code} → ${insertResult.rows[0].name}`);
      }
    }

    // Vérifier le résultat
    console.log('\n📋 Updated pricing_plans:');
    const updated = await client.query('SELECT code, name, "studentMin", "studentMax", "initialFee", "yearlyAmount", "monthlyAmount" FROM pricing_plans ORDER BY "sortOrder"');
    updated.rows.forEach(r => {
      console.log(`  ${r.code} (${r.name}): students ${r.studentMin}-${r.studentMax || '∞'}, initial=${r.initialFee}, yearly=${r.yearlyAmount}, monthly=${r.monthlyAmount}`);
    });

    // Mettre à jour aussi pricing_config si elle existe
    console.log('\n📋 Updating pricing_config...');
    const configResult = await client.query(`
      UPDATE pricing_config SET
        "initialSubscriptionFee" = 300000,
        "bilingualYearlyFee" = 50000,
        "updatedAt" = now()
      WHERE "isActive" = TRUE
      RETURNING id, "initialSubscriptionFee", "bilingualYearlyFee"
    `);
    if (configResult.rows.length > 0) {
      console.log(`✅ pricing_config updated: initialFee=${configResult.rows[0].initialSubscriptionFee}, bilingual=${configResult.rows[0].bilingualYearlyFee}`);
    } else {
      console.log('ℹ️ No active pricing_config found');
    }

    console.log('\n✅ All pricing data updated to match the contract!');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
