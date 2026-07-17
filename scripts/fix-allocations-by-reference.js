/**
 * Correction finale des allocations basée sur les RÉFÉRENCES de transactions.
 *
 * Le script d'import Excel a créé des transactions avec des références
 * explicites :
 *   - "Import Excel - Inscription" → devrait aller vers INSCRIPTION breakdown
 *   - "Import Excel - Scolarité P1" → devrait aller vers TUITION breakdown
 *   - "Import Excel - Scolarité P2" → devrait aller vers TUITION breakdown
 *   - ... (P3, P4, P5, P6)
 *   - "Import Excel - Uniforme" → OTHER (pas de breakdown dédié)
 *   - "Import Excel - Tenue Sport" → OTHER (pas de breakdown dédié)
 *
 * Mais à cause du bug d'import + du fix partiel précédent, certaines
 * allocations sont mal réparties :
 *   - Transactions "Scolarité P1" qui ont encore 8000 sur INSCRIPTION
 *     (le fix précédent a gardé 8000 sur INSCRIPTION au lieu de 0).
 *
 * Ce script :
 *   1. Pour chaque transaction avec référence "Import Excel - Scolarité P*":
 *      - Récupère TOUTES les allocations de cette transaction
 *      - Si une allocation pointe vers INSCRIPTION, la déplace vers TUITION
 *        (en fusionnant si une allocation TUITION existe déjà pour cette tx)
 *   2. Pour chaque transaction avec référence "Import Excel - Inscription":
 *      - Si une allocation pointe vers TUITION, la déplace vers INSCRIPTION
 *   3. Recalcule les paidAmount des breakdowns et les soldes des comptes.
 *
 * Stratégie : nouvelle connexion par étudiant pour éviter timeout Neon.
 */
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const ACADEMIC_YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getClient() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    query_timeout: 30000,
  });
  await client.connect();
  return client;
}

async function main() {
  console.log(`\n🔧 Correction allocations basée sur références de transactions\n`);

  // 1. Charger toutes les transactions avec leurs références et allocations
  const loadClient = await getClient();
  console.log('=== Chargement transactions + allocations ===');
  const txRes = await loadClient.query(`
    SELECT ft.id, ft."receiptNumber", ft.amount, ft.reference, ft."studentAccountId",
      fta.id as alloc_id, fta.amount as alloc_amount, fta."accountBreakdownId",
      ab."feeStructureId", fs."feeType"
    FROM finance_transactions ft
    LEFT JOIN finance_transaction_allocations fta ON fta."financeTransactionId" = ft.id
    LEFT JOIN account_breakdowns ab ON ab.id = fta."accountBreakdownId"
    LEFT JOIN fee_structures fs ON fs.id = ab."feeStructureId"
    WHERE ft."tenantId" = $1 AND ft."academicYearId" = $2
    ORDER BY ft."studentAccountId", ft."createdAt"
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`  ${txRes.rows.length} lignes (transactions × allocations)\n`);

  // Grouper par transaction
  const txMap = new Map();
  for (const row of txRes.rows) {
    if (!txMap.has(row.id)) {
      txMap.set(row.id, {
        id: row.id,
        receiptNumber: row.receiptNumber,
        amount: Number(row.amount),
        reference: row.reference,
        studentAccountId: row.studentAccountId,
        allocations: [],
      });
    }
    if (row.alloc_id) {
      txMap.get(row.id).allocations.push({
        id: row.alloc_id,
        amount: Number(row.alloc_amount),
        accountBreakdownId: row.accountBreakdownId,
        feeType: row.feeType,
        feeStructureId: row.feeStructureId,
      });
    }
  }

  // 2. Charger les account_breakdowns par studentAccountId
  console.log('=== Chargement account_breakdowns ===');
  const accountIds = new Set();
  for (const tx of txMap.values()) {
    accountIds.add(tx.studentAccountId);
  }
  const bdRes = await loadClient.query(`
    SELECT ab.id, ab."studentAccountId", ab."feeStructureId", fs."feeType"
    FROM account_breakdowns ab
    JOIN fee_structures fs ON fs.id = ab."feeStructureId"
    WHERE ab."studentAccountId" = ANY($1::text[])
  `, [Array.from(accountIds)]);
  console.log(`  ${bdRes.rows.length} breakdowns chargés`);

  // Index: studentAccountId → { INSCRIPTION: bdId, TUITION: bdId }
  const bdByAccount = new Map();
  for (const bd of bdRes.rows) {
    if (!bdByAccount.has(bd.studentAccountId)) {
      bdByAccount.set(bd.studentAccountId, {});
    }
    bdByAccount.get(bd.studentAccountId)[bd.feeType] = bd.id;
  }
  await loadClient.end();

  // 3. Identifier les transactions à corriger
  const fixes = []; // [{ txId, studentAccountId, fromBdId, toBdId, amount }]
  let stats = {
    tuitionTxToFix: 0,
    inscriptionTxToFix: 0,
    alreadyCorrect: 0,
    noBreakdown: 0,
  };

  for (const tx of txMap.values()) {
    if (!tx.reference) continue;
    const breakdowns = bdByAccount.get(tx.studentAccountId) || {};
    const inscriptionBdId = breakdowns.INSCRIPTION;
    const tuitionBdId = breakdowns.TUITION;

    if (!inscriptionBdId || !tuitionBdId) {
      stats.noBreakdown++;
      continue;
    }

    // Déterminer le feeType cible basé sur la référence
    let targetFeeType = null;
    if (tx.reference.includes('Inscription')) {
      targetFeeType = 'INSCRIPTION';
    } else if (tx.reference.includes('Scolarité P') || tx.reference.includes('Scolarite P')) {
      targetFeeType = 'TUITION';
    } else {
      // Uniforme, Tenue Sport → pas de correction (pas de breakdown dédié)
      continue;
    }

    const targetBdId = targetFeeType === 'INSCRIPTION' ? inscriptionBdId : tuitionBdId;
    const otherBdId = targetFeeType === 'INSCRIPTION' ? tuitionBdId : inscriptionBdId;

    // Vérifier si une allocation pointe vers le mauvais breakdown
    for (const alloc of tx.allocations) {
      if (alloc.accountBreakdownId === otherBdId) {
        // Cette allocation devrait être sur targetBdId
        fixes.push({
          txId: tx.id,
          studentAccountId: tx.studentAccountId,
          allocId: alloc.id,
          amount: alloc.amount,
          fromBdId: alloc.accountBreakdownId,
          toBdId: targetBdId,
          targetFeeType,
          receiptNumber: tx.receiptNumber,
          reference: tx.reference,
        });
        if (targetFeeType === 'TUITION') {
          stats.tuitionTxToFix++;
        } else {
          stats.inscriptionTxToFix++;
        }
      } else if (alloc.accountBreakdownId === targetBdId) {
        stats.alreadyCorrect++;
      }
    }
  }

  console.log(`\n=== Analyse ===`);
  console.log(`  Transactions Scolarité P* avec allocation INSCRIPTION à corriger: ${stats.tuitionTxToFix}`);
  console.log(`  Transactions Inscription avec allocation TUITION à corriger: ${stats.inscriptionTxToFix}`);
  console.log(`  Allocations déjà correctes: ${stats.alreadyCorrect}`);
  console.log(`  Transactions sans breakdown: ${stats.noBreakdown}`);
  console.log(`  Total corrections à appliquer: ${fixes.length}\n`);

  if (fixes.length === 0) {
    console.log('✅ Aucune correction nécessaire.');
    return;
  }

  // 4. Grouper les fixes par studentAccountId (pour appliquer par batch)
  const fixesByAccount = new Map();
  for (const f of fixes) {
    if (!fixesByAccount.has(f.studentAccountId)) {
      fixesByAccount.set(f.studentAccountId, []);
    }
    fixesByAccount.get(f.studentAccountId).push(f);
  }
  console.log(`  ${fixesByAccount.size} comptes à corriger\n`);

  // 5. Appliquer les corrections
  console.log(`=== Application des ${fixesByAccount.size} corrections ===`);
  let applied = 0;
  let errors = 0;

  // ⭐ Écrire les progrès dans un fichier pour pouvoir suivre l'exécution
  const fs = require('fs');
  const progressFile = '/tmp/fix-ref-progress.log';
  fs.writeFileSync(progressFile, `Starting fixes for ${fixesByAccount.size} accounts\n`);

  for (const [accountId, accountFixes] of fixesByAccount) {
    let client = null;
    try {
      client = await getClient();
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.allow_balance_update = 'true'`);

      for (const f of accountFixes) {
        // Vérifier s'il y a déjà une allocation sur le targetBdId pour cette tx
        const existing = await client.query(`
          SELECT id, amount FROM finance_transaction_allocations
          WHERE "financeTransactionId" = $1 AND "accountBreakdownId" = $2
        `, [f.txId, f.toBdId]);

        if (existing.rows.length > 0) {
          // Fusionner : ajouter le montant à l'allocation existante + supprimer l'ancienne
          const newAmount = Number(existing.rows[0].amount) + f.amount;
          await client.query(`UPDATE finance_transaction_allocations SET amount = $1 WHERE id = $2`,
            [newAmount, existing.rows[0].id]);
          await client.query(`DELETE FROM finance_transaction_allocations WHERE id = $1`, [f.allocId]);
        } else {
          // Simple re-tag : changer le accountBreakdownId
          await client.query(`UPDATE finance_transaction_allocations SET "accountBreakdownId" = $1 WHERE id = $2`,
            [f.toBdId, f.allocId]);
        }
      }

      // Recalculer les paidAmount des breakdowns INSCRIPTION et TUITION
      const breakdowns = bdByAccount.get(accountId) || {};
      for (const [feeType, bdId] of Object.entries(breakdowns)) {
        const paidRes = await client.query(`
          SELECT COALESCE(SUM(fta.amount), 0) as total
          FROM finance_transaction_allocations fta
          WHERE fta."accountBreakdownId" = $1
        `, [bdId]);
        const newPaid = Number(paidRes.rows[0].total);
        // Récupérer initialAmount pour calculer remaining
        const bdRes2 = await client.query(`SELECT "initialAmount" FROM account_breakdowns WHERE id = $1`, [bdId]);
        const initial = Number(bdRes2.rows[0]?.initialAmount || 0);
        const remaining = Math.max(0, initial - newPaid);
        await client.query(`UPDATE account_breakdowns SET "paidAmount" = $1, "remainingAmount" = $2 WHERE id = $3`,
          [newPaid, remaining, bdId]);
      }

      // Recalculer student_accounts
      const totalsRes = await client.query(`
        SELECT
          (SELECT COALESCE(SUM(fta.amount), 0) FROM finance_transaction_allocations fta
           JOIN finance_transactions ft ON ft.id = fta."financeTransactionId"
           WHERE ft."studentAccountId" = $1 AND ft."academicYearId" = $2) as total_paid,
          (SELECT COALESCE(SUM(ab."initialAmount"), 0) FROM account_breakdowns ab
           WHERE ab."studentAccountId" = $1) as total_due
      `, [accountId, ACADEMIC_YEAR_ID]);
      const totalPaid = Number(totalsRes.rows[0].total_paid);
      const totalDue = Number(totalsRes.rows[0].total_due);
      await client.query(`UPDATE student_accounts SET "totalPaid" = $1, "balance" = $2, "totalDue" = $3, "updatedAt" = NOW() WHERE id = $4`,
        [totalPaid, Math.max(0, totalDue - totalPaid), totalDue, accountId]);

      await client.query('COMMIT');
      applied++;
      if (applied % 20 === 0 || applied === fixesByAccount.size) {
        const msg = `[${applied}/${fixesByAccount.size}] OK`;
        console.log(`   ${msg}`);
        fs.appendFileSync(progressFile, msg + '\n');
      }
    } catch (err) {
      if (client) {
        try { await client.query('ROLLBACK'); } catch {}
      }
      errors++;
      const errMsg = `❌ Account ${accountId.substring(0, 8)}: ${err.message}`;
      console.error(errMsg);
      fs.appendFileSync(progressFile, errMsg + '\n');
    } finally {
      if (client) {
        try { await client.end(); } catch {}
      }
    }
    await sleep(50);
  }

  console.log(`\n=== Statistiques finales ===`);
  console.log(`  Comptes corrigés: ${applied}/${fixesByAccount.size}`);
  console.log(`  Erreurs: ${errors}`);
  fs.appendFileSync(progressFile, `DONE: applied=${applied}, errors=${errors}\n`);
  console.log('\n✅ Terminé');
}

main().catch(e => { console.error(e); process.exit(1); });
