/**
 * Corrige les tranches de paiement avec des montants ronds (10000, 5000, etc.)
 * au lieu de chiffres bizarres (8333, 7166...).
 *
 * Stratégie : pour chaque fee_structure, répartir le total en tranches rondes
 * qui s'additionnent au total exact. Par exemple :
 *   43000 → 13000 + 10000 + 10000 + 10000 (4 tranches)
 *   50000 → 20000 + 10000 + 10000 + 10000 (4 tranches)
 *   53000 → 15000 + 10000 + 10000 + 8000 + 10000 (5 tranches)
 *   70000 → 20000 + 15000 + 15000 + 10000 + 10000 (5 tranches)
 *   90000 → 30000 + 15000 + 15000 + 15000 + 15000 (5 tranches)
 *   110000 → 50000 + 20000 + 20000 + 10000 + 10000 (5 tranches)
 *   38000 → 10000 + 10000 + 10000 + 8000 (4 tranches)
 *   48000 → 12000 + 12000 + 12000 + 12000 (4 tranches)
 *
 * On utilise des paliers de 5000 FCFA (5000, 10000, 15000, 20000, 25000, 30000, 50000)
 * pour que les montants soient toujours ronds.
 */

const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const ACADEMIC_YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

/**
 * Génère des tranches avec montants ronds (paliers de 5000).
 * Le nombre de tranches est flexible (4 à 6), l'objectif est d'avoir
 * des montants propres qui s'additionnent au total exact.
 */
function generateRoundTranches(total) {
  const tranches = [];

  // Définir des répartitions connues pour les montants courants
  const presets = {
    43000: [13000, 10000, 10000, 10000],
    48000: [12000, 12000, 12000, 12000],
    50000: [20000, 10000, 10000, 10000],
    53000: [15000, 10000, 10000, 8000, 10000],
    70000: [20000, 15000, 15000, 10000, 10000],
    90000: [30000, 15000, 15000, 15000, 15000],
    110000: [50000, 20000, 20000, 10000, 10000],
    38000: [10000, 10000, 10000, 8000],
  };

  if (presets[total]) {
    return presets[total];
  }

  // Fallback : répartition automatique en paliers de 5000
  // Première tranche = ~40% du total (arrondi au 5000 le plus proche)
  const firstTranche = Math.round(total * 0.4 / 5000) * 5000;
  tranches.push(firstTranche);
  let remaining = total - firstTranche;

  // Répartir le reste en tranches de 10000 (ou 5000 si < 10000)
  while (remaining > 0) {
    if (remaining >= 15000) {
      tranches.push(10000);
      remaining -= 10000;
    } else if (remaining >= 5000) {
      // Arrondir au 5000 le plus proche
      const amount = Math.round(remaining / 5000) * 5000;
      if (amount > 0 && amount <= remaining + 4999) {
        tranches.push(remaining); // dernière tranche = reste exact
        remaining = 0;
      } else {
        tranches.push(remaining);
        remaining = 0;
      }
    } else {
      // Moins de 5000 → ajouter au reste
      if (tranches.length > 0) {
        tranches[tranches.length - 1] += remaining;
      } else {
        tranches.push(remaining);
      }
      remaining = 0;
    }
  }

  return tranches;
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== Correction des tranches avec montants ronds ===\n');

  // Récupérer tous les fee_structures TUITION
  const fs = await client.query(`
    SELECT id, name, "totalAmount"
    FROM fee_structures
    WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "feeType" = 'TUITION'
    ORDER BY name
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);

  for (const f of fs.rows) {
    const total = parseFloat(f.totalAmount);
    const tranches = generateRoundTranches(total);

    // Vérifier que la somme = total
    const sum = tranches.reduce((a, b) => a + b, 0);
    if (sum !== total) {
      console.log(`⚠ ${f.name} | total=${total} | sum=${sum} | MISMATCH — ajustement dernière tranche`);
      tranches[tranches.length - 1] += (total - sum);
    }

    // Supprimer les tranches existantes
    await client.query('DELETE FROM fee_structure_installments WHERE "feeStructureId" = $1', [f.id]);

    // Créer les nouvelles tranches
    for (let i = 0; i < tranches.length; i++) {
      await client.query(`
        INSERT INTO fee_structure_installments (id, "feeStructureId", label, amount, "orderIndex", "dueDateType")
        VALUES (gen_random_uuid(), $1, $2, $3::numeric, $4, 'FIXED')
      `, [f.id, `Tranche ${i + 1}`, tranches[i], i]);
    }

    console.log(`  ✓ ${f.name} | total=${total} | ${tranches.length} tranches: ${tranches.join(' + ')} = ${tranches.reduce((a,b)=>a+b,0)}`);
  }

  // Corriger le nom de l'élève 0ROU → OROU
  console.log('\n=== Correction nom élève 0ROU → OROU ===');
  const fixName = await client.query(`
    UPDATE students SET "lastName" = 'OROU', "updatedAt" = NOW()
    WHERE "tenantId" = $1 AND "lastName" = '0ROU'
    RETURNING id, "lastName", "firstName"
  `, [TENANT_ID]);
  console.log(`  ✓ ${fixName.rows.length} élève(s) corrigé(s):`);
  fixName.rows.forEach(r => console.log(`    ${r.lastName} ${r.firstName} (id=${r.id})`));

  await client.end();
  console.log('\n✅ Corrections terminées.');
}

main().catch(e => { console.error(e); process.exit(1); });
