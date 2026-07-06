/**
 * Rétrofit : pour chaque transaction FEDAPAY/FEEXPAY existante sans allocation,
 * crée les transferts d'allocation automatique vers les caisses de destination.
 */
const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&connect_timeout=30';

const FEE_TYPE_TO_CAISSE = {
  INSCRIPTION: 'ACCUEIL', REINSCRIPTION: 'ACCUEIL', TUITION: 'ACCUEIL',
  CANTEEN: 'CANTEEN', EXAMEN: 'EXAMEN', TRANSPORT: 'TRANSPORT', OTHER: 'MAIN',
};

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connecté à Neon DB\n');

  // 1. Récupérer toutes les transactions FEDAPAY/FEEXPAY
  const txs = await client.query(`
    SELECT ft.id, ft."tenantId", ft.amount, ft."cashRegisterId", ft."createdAt"
    FROM finance_transactions ft
    WHERE ft."paymentMethod" IN ('FEDAPAY', 'FEEXPAY')
    AND ft."cashRegisterId" IS NOT NULL
    ORDER BY ft."createdAt" ASC
  `);
  console.log(`Transactions en ligne: ${txs.rows.length}`);

  // 2. Pour chaque transaction, vérifier si une allocation existe déjà
  let allocated = 0;
  let skipped = 0;

  for (const tx of txs.rows) {
    // Vérifier si une auto-allocation existe déjà pour cette transaction
    const existing = await client.query(`
      SELECT id FROM cash_register_transfers
      WHERE "fromCashRegisterId" = $1 AND reference LIKE $2 AND status = 'AUTO_ALLOCATION'
      LIMIT 1
    `, [tx.cashRegisterId, `AUTO-${tx.id.substring(0, 8)}%`]);

    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }

    // Récupérer les allocations par breakdown pour cette transaction
    const allocations = await client.query(`
      SELECT ab.id, ab."feeStructureId", fs."feeType", fta.amount
      FROM finance_transaction_allocations fta
      JOIN account_breakdowns ab ON fta."accountBreakdownId" = ab.id
      JOIN fee_structures fs ON ab."feeStructureId" = fs.id
      WHERE fta."financeTransactionId" = $1
    `, [tx.id]);

    if (allocations.rows.length === 0) {
      skipped++;
      continue;
    }

    // Regrouper par feeType
    const byFeeType = {};
    for (const a of allocations.rows) {
      const ft = a.feeType || 'OTHER';
      byFeeType[ft] = (byFeeType[ft] || 0) + Number(a.amount);
    }

    // Récupérer les caisses du tenant
    const caisses = await client.query(`
      SELECT id, code FROM cash_registers WHERE "tenantId" = $1 AND "isActive" = true
    `, [tx.tenantId]);
    const caisseMap = {};
    caisses.rows.forEach(c => caisseMap[c.code] = c.id);

    for (const [feeType, amount] of Object.entries(byFeeType)) {
      if (amount <= 0) continue;
      const destCode = FEE_TYPE_TO_CAISSE[feeType] || 'MAIN';
      let destId = caisseMap[destCode] || caisseMap['MAIN'];
      if (!destId || destId === tx.cashRegisterId) continue;

      try {
        // Créditer la caisse de destination
        await client.query(`UPDATE cash_registers SET "currentBalance" = "currentBalance" + $1 WHERE id = $2`, [amount, destId]);

        // Enregistrer le transfert
        await client.query(`
          INSERT INTO cash_register_transfers (id, "tenantId", "fromCashRegisterId", "toCashRegisterId", amount, note, reference, "userId", status, "createdAt")
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NULL, 'AUTO_ALLOCATION', NOW())
        `, [
          tx.tenantId, tx.cashRegisterId, destId, amount,
          `Allocation rétroactive — ${feeType} (transaction ${tx.id.substring(0, 8)})`,
          `AUTO-${tx.id.substring(0, 8)}-${feeType}`
        ]);
        allocated++;
        console.log(`  ✅ ${tx.id.substring(0, 8)}: ${amount} FCFA → ${destCode} (${feeType})`);
      } catch (e) {
        console.log(`  ❌ ${tx.id.substring(0, 8)}: ${e.message}`);
      }
    }
  }

  console.log(`\nRétrofit terminé: ${allocated} allocations créées, ${skipped} ignorées`);
  await client.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
