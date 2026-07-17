/**
 * Crée 6 tranches de paiement (P1-P6) sur TOUS les fee_structures TUITION
 * qui n'en ont pas encore (ou qui en ont moins de 6).
 *
 * La répartition est équitable : totalAmount / 6, avec ajustement sur la dernière
 * tranche pour éviter les arrondis.
 *
 * Les tranches existantes sont supprimées et recréées proprement.
 */

const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const ACADEMIC_YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== Création des 6 tranches de paiement sur tous les fee_structures TUITION ===\n');

  // Récupérer tous les fee_structures TUITION
  const fs = await client.query(`
    SELECT id, name, "totalAmount", "academicClassId", "levelId", "classId"
    FROM fee_structures
    WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "feeType" = 'TUITION'
    ORDER BY name
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);

  console.log(`Fee structures TUITION trouvées: ${fs.rows.length}\n`);

  for (const f of fs.rows) {
    const total = parseFloat(f.totalAmount);
    
    // Supprimer les tranches existantes
    await client.query('DELETE FROM fee_structure_installments WHERE "feeStructureId" = $1', [f.id]);
    
    // Calculer 6 tranches équitables
    const trancheBase = Math.floor(total / 6);
    const reste = total - (trancheBase * 6);
    
    for (let i = 0; i < 6; i++) {
      const amount = i === 5 ? trancheBase + reste : trancheBase;
      await client.query(`
        INSERT INTO fee_structure_installments (id, "feeStructureId", label, amount, "orderIndex", "dueDateType")
        VALUES (gen_random_uuid(), $1, $2, $3::numeric, $4, 'FIXED')
      `, [f.id, `Tranche ${i + 1}`, amount, i]);
    }
    
    console.log(`  ✓ ${f.name} | total=${total} | 6 tranches de ${trancheBase}${reste > 0 ? ` (+${reste} sur T6)` : ''}`);
  }

  // Vérification
  const check = await client.query(`
    SELECT fs.name, COUNT(fsi.id) as count, 
           STRING_AGG(fsi.label || ':' || fsi.amount, ' | ' ORDER BY fsi."orderIndex") as tranches
    FROM fee_structures fs
    LEFT JOIN fee_structure_installments fsi ON fsi."feeStructureId" = fs.id
    WHERE fs."tenantId" = $1 AND fs."academicYearId" = $2 AND fs."feeType" = 'TUITION'
    GROUP BY fs.name
    ORDER BY fs.name
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);

  console.log('\n=== Vérification ===');
  check.rows.forEach(row => {
    console.log(`  ${row.name} (${row.count} tranches): ${row.tranches}`);
  });

  await client.end();
  console.log('\n✅ Tranches créées.');
}

main().catch(e => { console.error(e); process.exit(1); });
