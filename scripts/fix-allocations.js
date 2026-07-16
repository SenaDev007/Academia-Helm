/**
 * Script de correction : pour chaque transaction "Import Excel" existante,
 * crée l'allocation correspondante sur le bon breakdown et met à jour les soldes.
 *
 * Le trigger trg_update_balance_after_tx a déjà mis à jour student_accounts.totalPaid/balance,
 * mais les account_breakdowns ne sont pas touchés. Ce script crée les allocations
 * et met à jour paidAmount/remainingAmount sur les breakdowns.
 *
 * Stratégie :
 * 1. Pour chaque élève, récupérer ses breakdowns (INSCRIPTION + TUITION)
 * 2. Pour chaque transaction "Import Excel" de cet élève :
 *    - Si reference contient "Inscription" → allouer au breakdown INSCRIPTION
 *    - Si reference contient "Scolarité" → allouer au breakdown TUITION
 *    - Si reference contient "Uniforme" ou "Tenue" → allouer au breakdown OTHER (ou TUITION si pas de OTHER)
 * 3. Créer les finance_transaction_allocations
 * 4. Mettre à jour les breakdowns (paidAmount += allocation, remainingAmount -= allocation)
 * 5. Recalculer les soldes du student_account (totalDue = somme initialAmount, balance = totalDue - totalPaid)
 */

const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const ACADEMIC_YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== Correction des allocations pour transactions Import Excel ===\n');

  // 1. Récupérer toutes les transactions Import Excel groupées par studentAccountId
  const txRes = await client.query(`
    SELECT id, "studentAccountId", amount, reference, "createdAt"
    FROM finance_transactions
    WHERE "tenantId" = $1 AND "academicYearId" = $2 AND reference LIKE 'Import Excel%'
    ORDER BY "studentAccountId", "createdAt"
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`Transactions à corriger: ${txRes.rows.length}`);

  // Grouper par studentAccountId
  const byAccount = {};
  for (const tx of txRes.rows) {
    if (!byAccount[tx.studentAccountId]) byAccount[tx.studentAccountId] = [];
    byAccount[tx.studentAccountId].push(tx);
  }
  console.log(`Comptes concernés: ${Object.keys(byAccount).length}\n`);

  let allocationsCreated = 0;
  let breakdownsUpdated = 0;
  let accountsRecalculated = 0;
  let errors = 0;

  // 2. Pour chaque compte, créer les allocations + mettre à jour les breakdowns
  for (const [accountId, txs] of Object.entries(byAccount)) {
    const txFn = async () => {
      await client.query('BEGIN');

      // Récupérer les breakdowns du compte
      const bdRes = await client.query(`
        SELECT ab.id, ab."feeStructureId", fs."feeType", ab."initialAmount", ab."paidAmount", ab."remainingAmount"
        FROM account_breakdowns ab
        JOIN fee_structures fs ON fs.id = ab."feeStructureId"
        WHERE ab."studentAccountId" = $1
        ORDER BY fs."feeType"
      `, [accountId]);

      if (bdRes.rows.length === 0) {
        console.log(`⚠ Pas de breakdowns pour ${accountId}`);
        await client.query('ROLLBACK');
        return;
      }

      const breakdowns = bdRes.rows;
      const inscriptionBd = breakdowns.find(b => b.feeType === 'INSCRIPTION');
      const tuitionBd = breakdowns.find(b => b.feeType === 'TUITION');
      const otherBd = breakdowns.find(b => b.feeType === 'OTHER');

      // Pour chaque transaction, créer l'allocation
      for (const tx of txs) {
        let targetBd = null;
        if (tx.reference.includes('Inscription')) {
          targetBd = inscriptionBd;
        } else if (tx.reference.includes('Scolarité') || tx.reference.includes('Scolarite')) {
          targetBd = tuitionBd;
        } else if (tx.reference.includes('Uniforme') || tx.reference.includes('Tenue')) {
          targetBd = otherBd || tuitionBd; // fallback sur TUITION si pas de OTHER
        } else {
          targetBd = tuitionBd; // défaut
        }

        if (!targetBd) {
          console.log(`⚠ Pas de breakdown cible pour tx ${tx.id} (${tx.reference})`);
          continue;
        }

        // Vérifier si l'allocation existe déjà
        const existingAlloc = await client.query(
          `SELECT id FROM finance_transaction_allocations WHERE "financeTransactionId" = $1 AND "accountBreakdownId" = $2`,
          [tx.id, targetBd.id]
        );
        if (existingAlloc.rows.length > 0) continue; // déjà créé

        // Créer l'allocation
        await client.query(`
          INSERT INTO finance_transaction_allocations (id, "financeTransactionId", "accountBreakdownId", amount)
          VALUES (gen_random_uuid(), $1, $2, $3)
        `, [tx.id, targetBd.id, tx.amount]);
        allocationsCreated++;

        // Mettre à jour le breakdown (paidAmount += amount, remainingAmount -= amount)
        // ⚠️ account_breakdowns n'a pas de updatedAt — on ne met à jour que paidAmount et remainingAmount
        await client.query(`
          UPDATE account_breakdowns
          SET "paidAmount" = "paidAmount" + $1,
              "remainingAmount" = GREATEST("remainingAmount" - $1, 0)
          WHERE id = $2
        `, [tx.amount, targetBd.id]);
        breakdownsUpdated++;
      }

      // 3. Recalculer les soldes du student_account
      // totalDue = somme des initialAmount des breakdowns
      // totalPaid = somme des paidAmount des breakdowns (pas le totalPaid du account qui peut être différent à cause des triggers)
      // balance = totalDue - totalPaid
      const recalc = await client.query(`
        SELECT
          SUM("initialAmount") as total_due,
          SUM("paidAmount") as total_paid
        FROM account_breakdowns
        WHERE "studentAccountId" = $1
      `, [accountId]);

      const newTotalDue = parseFloat(recalc.rows[0].total_due || 0);
      const newTotalPaid = parseFloat(recalc.rows[0].total_paid || 0);
      const newBalance = newTotalDue - newTotalPaid;

      // Mettre à jour le student_account avec le flag allow_balance_update
      await client.query(`SET LOCAL app.allow_balance_update = 'true'`);
      await client.query(`
        UPDATE student_accounts
        SET "totalDue" = $1, "totalPaid" = $2, "balance" = $3, "updatedAt" = NOW()
        WHERE id = $4
      `, [newTotalDue, newTotalPaid, newBalance, accountId]);
      accountsRecalculated++;

      await client.query('COMMIT');
    };

    try {
      await txFn();
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      errors++;
      if (errors <= 5) console.error(`Erreur sur ${accountId}: ${e.message}`);
    }
  }

  console.log(`\n=== Résultats ===`);
  console.log(`Allocations créées: ${allocationsCreated}`);
  console.log(`Breakdowns mis à jour: ${breakdownsUpdated}`);
  console.log(`Comptes recalculés: ${accountsRecalculated}`);
  console.log(`Erreurs: ${errors}`);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
