/**
 * Correction des données Mon Avenir Plus — VERSION BATCH avec reconnexion.
 *
 * Problème : Neon ferme les connexions idle après ~30s, ce qui fait planter
 * le script lors de l'application des corrections.
 *
 * Solution : pour CHAQUE correction, on ouvre une nouvelle connexion,
 * on applique la transaction, on ferme. Plus lent mais robuste.
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
  console.log(`\n🔧 Correction allocations (VERSION BATCH)\n`);

  // 1. Charger toutes les données en mémoire
  const loadClient = await getClient();
  console.log('=== 1. Chargement breakdowns ===');
  const breakdownsRes = await loadClient.query(`
    SELECT ab.id, ab."studentAccountId", ab."feeStructureId",
      ab."initialAmount", ab."paidAmount",
      fs."feeType"
    FROM account_breakdowns ab
    JOIN fee_structures fs ON fs.id = ab."feeStructureId"
    JOIN student_accounts sa ON sa.id = ab."studentAccountId"
    WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`   ${breakdownsRes.rows.length} breakdowns chargés`);

  const bdByAccount = new Map();
  for (const bd of breakdownsRes.rows) {
    if (!bdByAccount.has(bd.studentAccountId)) bdByAccount.set(bd.studentAccountId, {});
    bdByAccount.get(bd.studentAccountId)[bd.feeType] = bd;
  }

  console.log('=== 2. Chargement allocations ===');
  const allocsRes = await loadClient.query(`
    SELECT fta.id, fta."financeTransactionId", fta."accountBreakdownId", fta.amount,
      ft."studentAccountId", ft."createdAt"
    FROM finance_transaction_allocations fta
    JOIN finance_transactions ft ON ft.id = fta."financeTransactionId"
    WHERE ft."tenantId" = $1 AND ft."academicYearId" = $2
    ORDER BY ft."createdAt" ASC
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`   ${allocsRes.rows.length} allocations chargées`);

  const allocsByAccount = new Map();
  for (const a of allocsRes.rows) {
    if (!allocsByAccount.has(a.studentAccountId)) allocsByAccount.set(a.studentAccountId, []);
    allocsByAccount.get(a.studentAccountId).push(a);
  }

  console.log('=== 3. Chargement comptes ===');
  const accountsRes = await loadClient.query(`
    SELECT sa.id, sa."studentId",
      s."firstName" || ' ' || s."lastName" as student_name,
      c.name as class_name, sl.code as level_code
    FROM student_accounts sa
    JOIN students s ON s.id = sa."studentId"
    LEFT JOIN student_enrollments se ON se."studentId" = s.id AND se."academicYearId" = sa."academicYearId"
    LEFT JOIN classes c ON c.id = se."classId"
    LEFT JOIN school_levels sl ON sl.id = c."schoolLevelId"
    WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`   ${accountsRes.rows.length} comptes chargés`);
  await loadClient.end();

  // 2. Calculer les corrections
  const fixes = [];
  for (const account of accountsRes.rows) {
    const breakdowns = bdByAccount.get(account.id) || {};
    const inscriptionBd = breakdowns.INSCRIPTION;
    const tuitionBd = breakdowns.TUITION;
    const allocs = allocsByAccount.get(account.id) || [];
    if (!inscriptionBd || !tuitionBd || allocs.length === 0) continue;

    const insAllocs = allocs.filter(a => a.accountBreakdownId === inscriptionBd.id);
    const totalInscriptionPaid = insAllocs.reduce((s, a) => s + Number(a.amount), 0);
    const expectedInscription = Number(inscriptionBd.initialAmount) || 0;
    if (totalInscriptionPaid <= expectedInscription) continue;

    let cumul = 0;
    let firstExcessIdx = -1;
    for (let i = 0; i < insAllocs.length; i++) {
      cumul += Number(insAllocs[i].amount);
      if (cumul > expectedInscription) { firstExcessIdx = i; break; }
    }
    if (firstExcessIdx === -1) continue;

    const allocToSplit = insAllocs[firstExcessIdx];
    const amountBeforeExcess = expectedInscription - (cumul - Number(allocToSplit.amount));
    const amountToMove = Number(allocToSplit.amount) - amountBeforeExcess;
    const allocsToRetag = insAllocs.slice(firstExcessIdx + 1);

    fixes.push({
      accountId: account.id,
      studentName: account.student_name,
      className: account.class_name,
      inscriptionBdId: inscriptionBd.id,
      tuitionBdId: tuitionBd.id,
      tuitionInitialAmount: Number(tuitionBd.initialAmount),
      allocToSplit: { id: allocToSplit.id, financeTransactionId: allocToSplit.financeTransactionId, amountBeforeExcess, amountToMove },
      allocsToRetag: allocsToRetag.map(a => ({ id: a.id, amount: Number(a.amount) })),
      expectedInscription,
    });
  }

  console.log(`\n=== ${fixes.length} corrections à appliquer ===`);

  // 3. Appliquer par batch avec nouvelle connexion à chaque itération
  let applied = 0;
  let errors = 0;

  for (let idx = 0; idx < fixes.length; idx++) {
    const f = fixes[idx];
    let client = null;
    try {
      client = await getClient();
      await client.query('BEGIN');

      // ⭐ Autoriser la mise à jour directe des champs de balance (sinon trigger bloque)
      await client.query(`SET LOCAL app.allow_balance_update = 'true'`);

      if (f.allocToSplit.amountToMove > 0) {
        // 1. Réduire le montant de l'allocation INSCRIPTION existante
        await client.query(`UPDATE finance_transaction_allocations SET amount = $1 WHERE id = $2`,
          [f.allocToSplit.amountBeforeExcess, f.allocToSplit.id]);

        // 2. Vérifier s'il existe déjà une allocation TUITION pour cette transaction
        // (suite à un précédent run partiel). Si oui, on UPDATE le montant au lieu
        // d'INSERT (sinon violation de la contrainte unique
        // (financeTransactionId, accountBreakdownId)).
        const existing = await client.query(`
          SELECT id, amount FROM finance_transaction_allocations
          WHERE "financeTransactionId" = $1 AND "accountBreakdownId" = $2
        `, [f.allocToSplit.financeTransactionId, f.tuitionBdId]);

        if (existing.rows.length > 0) {
          // UPDATE l'allocation TUITION existante
          const newAmount = Number(existing.rows[0].amount) + f.allocToSplit.amountToMove;
          await client.query(`UPDATE finance_transaction_allocations SET amount = $1 WHERE id = $2`,
            [newAmount, existing.rows[0].id]);
        } else {
          // INSERT nouvelle allocation TUITION
          await client.query(`INSERT INTO finance_transaction_allocations (id, "financeTransactionId", "accountBreakdownId", amount) VALUES (gen_random_uuid(), $1, $2, $3)`,
            [f.allocToSplit.financeTransactionId, f.tuitionBdId, f.allocToSplit.amountToMove]);
        }
      }

      for (const a of f.allocsToRetag) {
        // Vérifier s'il y a déjà une allocation TUITION pour cette transaction
        const existingTx = await client.query(`
          SELECT id, amount FROM finance_transaction_allocations
          WHERE "financeTransactionId" = (SELECT "financeTransactionId" FROM finance_transaction_allocations WHERE id = $1)
          AND "accountBreakdownId" = $2
        `, [a.id, f.tuitionBdId]);

        if (existingTx.rows.length > 0) {
          // Fusionner : on supprime l'ancienne INSCRIPTION et on ajoute son montant à la TUITION existante
          await client.query(`UPDATE finance_transaction_allocations SET amount = $1 WHERE id = $2`,
            [Number(existingTx.rows[0].amount) + a.amount, existingTx.rows[0].id]);
          await client.query(`DELETE FROM finance_transaction_allocations WHERE id = $1`, [a.id]);
        } else {
          // Simple re-tag : changer le accountBreakdownId
          await client.query(`UPDATE finance_transaction_allocations SET "accountBreakdownId" = $1 WHERE id = $2`,
            [f.tuitionBdId, a.id]);
        }
      }

      // Recalculer INSCRIPTION breakdown
      await client.query(`UPDATE account_breakdowns SET "paidAmount" = $1, "remainingAmount" = 0 WHERE id = $2`,
        [f.expectedInscription, f.inscriptionBdId]);

      // Recalculer TUITION breakdown
      const tuitionPaidRes = await client.query(`SELECT COALESCE(SUM(fta.amount), 0) as total FROM finance_transaction_allocations fta WHERE fta."accountBreakdownId" = $1`, [f.tuitionBdId]);
      const newTuitionPaid = Number(tuitionPaidRes.rows[0].total);
      const newTuitionRemaining = Math.max(0, f.tuitionInitialAmount - newTuitionPaid);
      await client.query(`UPDATE account_breakdowns SET "paidAmount" = $1, "remainingAmount" = $2 WHERE id = $3`,
        [newTuitionPaid, newTuitionRemaining, f.tuitionBdId]);

      // Recalculer student_accounts (le flag allow_balance_update est déjà SET)
      const totalsRes = await client.query(`
        SELECT
          (SELECT COALESCE(SUM(fta.amount), 0) FROM finance_transaction_allocations fta
           JOIN finance_transactions ft ON ft.id = fta."financeTransactionId"
           WHERE ft."studentAccountId" = $1 AND ft."academicYearId" = $2) as total_paid,
          (SELECT COALESCE(SUM(ab."initialAmount"), 0) FROM account_breakdowns ab
           WHERE ab."studentAccountId" = $1) as total_due
      `, [f.accountId, ACADEMIC_YEAR_ID]);
      const totalPaid = Number(totalsRes.rows[0].total_paid);
      const totalDue = Number(totalsRes.rows[0].total_due);
      await client.query(`UPDATE student_accounts SET "totalPaid" = $1, "balance" = $2, "totalDue" = $3, "updatedAt" = NOW() WHERE id = $4`,
        [totalPaid, Math.max(0, totalDue - totalPaid), totalDue, f.accountId]);

      await client.query('COMMIT');
      applied++;
      if (applied % 10 === 0 || applied === fixes.length) {
        console.log(`   [${applied}/${fixes.length}] ${f.studentName} (${f.className}) OK`);
      }
    } catch (err) {
      if (client) {
        try { await client.query('ROLLBACK'); } catch {}
      }
      errors++;
      console.error(`❌ [${idx + 1}/${fixes.length}] ${f.studentName}: ${err.message}`);
    } finally {
      if (client) {
        try { await client.end(); } catch {}
      }
    }
    // Petite pause entre chaque correction
    await sleep(50);
  }

  console.log(`\n=== Statistiques finales ===`);
  console.log(`  Corrections appliquées: ${applied}/${fixes.length}`);
  console.log(`  Erreurs: ${errors}`);
  console.log('\n✅ Terminé');
}

main().catch(e => { console.error(e); process.exit(1); });
