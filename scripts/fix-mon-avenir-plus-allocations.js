/**
 * Correction des données Mon Avenir Plus :
 *
 * Problème identifié :
 *   - 2550 transactions importées depuis Excel (IMP-EXCEL-...)
 *   - Toutes sont taggées feeType=INSCRIPTION dans finance_transaction_allocations
 *     (l'import a mis le mauvais accountBreakdownId pour les paiements P1-P6
 *     de scolarité).
 *   - Résultat : compte INSCRIPTION sur-payé (118000 au lieu de 8000),
 *     compte TUITION non payé (paidAmount=0 alors que l'élève a payé 110000).
 *
 * Solution :
 *   Pour chaque élève :
 *     1. Calculer le montant INSCRIPTION attendu (= 8000 pour Secondaire,
 *        5000 pour Primaire/Maternelle, depuis la fee_structure INSCRIPTION).
 *     2. Sommer tous les paiements taggés INSCRIPTION.
 *     3. Si totalPaid > expectedInscription : l'excédent est du TUITION mal
 *        taggé. On supprime les allocations INSCRIPTION excédentaires et on
 *        les recrée vers le account_breakdown TUITION de l'élève.
 *     4. Reconstruire account_breakdowns.paidAmount et remainingAmount
 *        depuis les allocations corrigées.
 *     5. Recalculer student_accounts.totalPaid et balance.
 *
 * Stratégie de re-tagging :
 *   - Les transactions sont ordonnées par createdAt ASC.
 *   - On remplit d'abord l'INSCRIPTION (jusqu'à expectedInscription).
 *   - Le reste va vers TUITION.
 *
 * Sécurité :
 *   - DRY_RUN = true par défaut (affiche les changements sans les appliquer).
 *   - Passe DRY_RUN = false pour appliquer réellement.
 *   - Transaction SQL par élève (ROLLBACK en cas d'erreur).
 */

const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const DRY_RUN = true; // ⚠️ Mettre à false pour appliquer réellement les changements

const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb'; // CSP Mon Avenir Plus N'Dali
const ACADEMIC_YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b'; // 2025-2026

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log(`\n🔧 Correction des allocations de transactions`);
  console.log(`   Tenant: ${TENANT_ID}`);
  console.log(`   Année: ${ACADEMIC_YEAR_ID}`);
  console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN (aucune modification)' : '⚠️  APPLICATION RÉELLE'}\n`);

  // 1. Récupérer tous les étudiants avec leurs account_breakdowns (INSCRIPTION + TUITION)
  console.log('=== 1. Chargement des comptes élèves ===');
  const accounts = await client.query(`
    SELECT
      sa.id as account_id,
      sa."studentId",
      s."firstName" || ' ' || s."lastName" as student_name,
      s.matricule,
      c.name as class_name,
      sl.code as level_code
    FROM student_accounts sa
    JOIN students s ON s.id = sa."studentId"
    LEFT JOIN student_enrollments se ON se."studentId" = s.id AND se."academicYearId" = sa."academicYearId"
    LEFT JOIN classes c ON c.id = se."classId"
    LEFT JOIN school_levels sl ON sl.id = c."schoolLevelId"
    WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2
    ORDER BY student_name
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`   ${accounts.rows.length} comptes chargés\n`);

  // 2. Pour chaque compte, charger les account_breakdowns et les transactions
  let stats = {
    studentsProcessed: 0,
    studentsNeedFix: 0,
    allocationsDeleted: 0,
    allocationsCreated: 0,
    breakdownsUpdated: 0,
    accountsUpdated: 0,
    errors: 0,
  };

  for (const account of accounts.rows) {
    stats.studentsProcessed++;
    if (stats.studentsProcessed % 50 === 0) {
      console.log(`   ... traité ${stats.studentsProcessed}/${accounts.rows.length} comptes`);
    }

    try {
      // Récupérer les account_breakdowns INSCRIPTION et TUITION
      const breakdowns = await client.query(`
        SELECT ab.id, ab."feeStructureId", ab."initialAmount", ab."paidAmount",
          fs."feeType", fs."totalAmount"
        FROM account_breakdowns ab
        JOIN fee_structures fs ON fs.id = ab."feeStructureId"
        WHERE ab."studentAccountId" = $1
        ORDER BY fs."feeType"
      `, [account.account_id]);

      const inscriptionBd = breakdowns.rows.find(b => b.feeType === 'INSCRIPTION');
      const tuitionBd = breakdowns.rows.find(b => b.feeType === 'TUITION');

      if (!inscriptionBd) {
        // Pas de breakdown INSCRIPTION → rien à corriger
        continue;
      }

      // Récupérer toutes les transactions du compte, ordonnées par date ASC
      const transactions = await client.query(`
        SELECT ft.id, ft."receiptNumber", ft.amount, ft."createdAt", ft.reference,
          fta.id as alloc_id, fta.amount as alloc_amount
        FROM finance_transactions ft
        LEFT JOIN finance_transaction_allocations fta ON fta."financeTransactionId" = ft.id
        WHERE ft."studentAccountId" = $1
          AND ft."academicYearId" = $2
        ORDER BY ft."createdAt" ASC, ft."receiptNumber" ASC
      `, [account.account_id, ACADEMIC_YEAR_ID]);

      if (transactions.rows.length === 0) continue;

      // Calculer le montant INSCRIPTION attendu
      const expectedInscription = Number(inscriptionBd.initialAmount) || 0;

      // Sommer les allocations INSCRIPTION actuelles
      const inscriptionAllocs = transactions.rows.filter(t => t.alloc_id);
      // Pour identifier quelles allocations sont INSCRIPTION vs TUITION,
      // on doit vérifier le accountBreakdownId de chaque allocation.
      const allocDetails = await client.query(`
        SELECT fta.id, fta."financeTransactionId", fta.amount, fta."accountBreakdownId"
        FROM finance_transaction_allocations fta
        JOIN finance_transactions ft ON ft.id = fta."financeTransactionId"
        WHERE ft."studentAccountId" = $1 AND ft."academicYearId" = $2
      `, [account.account_id, ACADEMIC_YEAR_ID]);

      const inscriptionAllocIds = allocDetails.rows
        .filter(a => a.accountBreakdownId === inscriptionBd.id)
        .map(a => a.id);
      const totalInscriptionPaid = allocDetails.rows
        .filter(a => a.accountBreakdownId === inscriptionBd.id)
        .reduce((sum, a) => sum + Number(a.amount), 0);

      // Si pas d'excédent → OK, rien à faire
      if (totalInscriptionPaid <= expectedInscription) {
        continue;
      }

      // Il y a un excédent INSCRIPTION → c'est du TUITION mal taggé
      const excess = totalInscriptionPaid - expectedInscription;
      stats.studentsNeedFix++;

      if (!tuitionBd) {
        console.log(`⚠️  ${account.student_name} (${account.class_name}): excédent INSCRIPTION = ${excess} FCFA mais PAS de breakdown TUITION ! Skipping.`);
        continue;
      }

      console.log(`🔧 ${account.student_name} (${account.class_name}, ${account.level_code}):`);
      console.log(`   INSCRIPTION expected = ${expectedInscription}, paid = ${totalInscriptionPaid}, excédent = ${excess} → re-tag vers TUITION`);

      // Stratégie : on garde les premières allocations INSCRIPTION (par date ASC)
      // jusqu'à atteindre expectedInscription, et on re-tag les suivantes vers TUITION.
      // Pour cela, on trie les allocations INSCRIPTION par date de la transaction.
      const insAllocsWithDate = allocDetails.rows
        .filter(a => a.accountBreakdownId === inscriptionBd.id)
        .map(a => {
          const tx = transactions.rows.find(t => t.id === a.financeTransactionId);
          return { ...a, createdAt: tx?.createdAt, receiptNumber: tx?.receiptNumber };
        })
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      // Trouver l'index où on dépasse expectedInscription
      let cumul = 0;
      let firstExcessIdx = -1;
      for (let i = 0; i < insAllocsWithDate.length; i++) {
        cumul += Number(insAllocsWithDate[i].amount);
        if (cumul > expectedInscription) {
          firstExcessIdx = i;
          break;
        }
      }

      if (firstExcessIdx === -1) {
        // Ne devrait pas arriver vu qu'on a un excédent
        continue;
      }

      // Pour l'allocation à firstExcessIdx, on doit la splitter :
      // - garder la partie qui rentre dans expectedInscription sur INSCRIPTION
      // - déplacer l'excédent vers TUITION
      const allocToSplit = insAllocsWithDate[firstExcessIdx];
      const amountBeforeExcess = expectedInscription - (cumul - Number(allocToSplit.amount));
      const amountToMove = Number(allocToSplit.amount) - amountBeforeExcess;

      // Transactions suivantes : toutes à re-tag vers TUITION
      const allocsToMove = insAllocsWithDate.slice(firstExcessIdx + 1);
      const totalToMove = amountToMove + allocsToMove.reduce((s, a) => s + Number(a.amount), 0);

      if (Math.abs(totalToMove - excess) > 1) {
        console.log(`   ⚠️  Incohérence: totalToMove=${totalToMove} vs excess=${excess} — adjust`);
      }

      if (DRY_RUN) {
        console.log(`   → Split allocation ${allocToSplit.id} (${allocToSplit.receiptNumber}): garder ${amountBeforeExcess} sur INSCRIPTION, déplacer ${amountToMove} vers TUITION`);
        if (allocsToMove.length > 0) {
          console.log(`   → Re-tag ${allocsToMove.length} allocation(s) suivantes vers TUITION (total = ${allocsToMove.reduce((s, a) => s + Number(a.amount), 0)} FCFA)`);
        }
        continue;
      }

      // === APPLICATION RÉELLE ===
      await client.query('BEGIN');

      try {
        // 1. Si allocation à splitter : réduire son montant sur INSCRIPTION
        if (amountToMove > 0) {
          await client.query(`
            UPDATE finance_transaction_allocations
            SET amount = $1
            WHERE id = $2
          `, [amountBeforeExcess, allocToSplit.id]);
          stats.allocationsUpdated = (stats.allocationsUpdated || 0) + 1;

          // Créer une nouvelle allocation vers TUITION pour le montant déplacé
          await client.query(`
            INSERT INTO finance_transaction_allocations (id, "financeTransactionId", "accountBreakdownId", amount)
            VALUES (gen_random_uuid(), $1, $2, $3)
          `, [allocToSplit.financeTransactionId, tuitionBd.id, amountToMove]);
          stats.allocationsCreated++;
        }

        // 2. Re-tag les allocations suivantes vers TUITION
        for (const a of allocsToMove) {
          await client.query(`
            UPDATE finance_transaction_allocations
            SET "accountBreakdownId" = $1
            WHERE id = $2
          `, [tuitionBd.id, a.id]);
          stats.allocationsUpdated = (stats.allocationsUpdated || 0) + 1;
        }

        // 3. Recalculer paidAmount sur INSCRIPTION breakdown
        const newInscriptionPaid = expectedInscription; // exact
        const newInscriptionRemaining = 0;
        await client.query(`
          UPDATE account_breakdowns
          SET "paidAmount" = $1, "remainingAmount" = $2
          WHERE id = $3
        `, [newInscriptionPaid, newInscriptionRemaining, inscriptionBd.id]);
        stats.breakdownsUpdated++;

        // 4. Recalculer paidAmount sur TUITION breakdown (depuis allocations)
        const newTuitionPaidRes = await client.query(`
          SELECT COALESCE(SUM(amount), 0) as total
          FROM finance_transaction_allocations
          WHERE "accountBreakdownId" = $1
        `, [tuitionBd.id]);
        const newTuitionPaid = Number(newTuitionPaidRes.rows[0].total);
        const newTuitionRemaining = Math.max(0, Number(tuitionBd.initialAmount) - newTuitionPaid);
        await client.query(`
          UPDATE account_breakdowns
          SET "paidAmount" = $1, "remainingAmount" = $2
          WHERE id = $3
        `, [newTuitionPaid, newTuitionRemaining, tuitionBd.id]);
        stats.breakdownsUpdated++;

        // 5. Recalculer student_accounts.totalPaid et balance
        const newTotalPaidRes = await client.query(`
          SELECT COALESCE(SUM(amount), 0) as total
          FROM finance_transaction_allocations fta
          JOIN finance_transactions ft ON ft.id = fta."financeTransactionId"
          WHERE ft."studentAccountId" = $1 AND ft."academicYearId" = $2
        `, [account.account_id, ACADEMIC_YEAR_ID]);
        const newTotalPaid = Number(newTotalPaidRes.rows[0].total);

        // totalDue = sum des initialAmount des breakdowns
        const newTotalDueRes = await client.query(`
          SELECT COALESCE(SUM("initialAmount"), 0) as total
          FROM account_breakdowns
          WHERE "studentAccountId" = $1
        `, [account.account_id]);
        const newTotalDue = Number(newTotalDueRes.rows[0].total);

        await client.query(`
          UPDATE student_accounts
          SET "totalPaid" = $1, "balance" = $2, "totalDue" = $3, "updatedAt" = NOW()
          WHERE id = $4
        `, [newTotalPaid, Math.max(0, newTotalDue - newTotalPaid), newTotalDue, account.account_id]);
        stats.accountsUpdated++;

        await client.query('COMMIT');
        console.log(`   ✅ Corrigé: INSCRIPTION paid=${newInscriptionPaid}, TUITION paid=${newTuitionPaid}, totalPaid=${newTotalPaid}/${newTotalDue}`);
      } catch (err) {
        await client.query('ROLLBACK');
        stats.errors++;
        console.error(`   ❌ Erreur pour ${account.student_name}: ${err.message}`);
      }
    } catch (err) {
      stats.errors++;
      console.error(`❌ Erreur traitement ${account.student_name}: ${err.message}`);
    }
  }

  console.log('\n=== Statistiques ===');
  console.log(`  Comptes traités: ${stats.studentsProcessed}`);
  console.log(`  Comptes à corriger: ${stats.studentsNeedFix}`);
  console.log(`  Allocations créées: ${stats.allocationsCreated}`);
  console.log(`  Allocations modifiées: ${stats.allocationsUpdated || 0}`);
  console.log(`  Breakdowns mis à jour: ${stats.breakdownsUpdated}`);
  console.log(`  Comptes mis à jour: ${stats.accountsUpdated}`);
  console.log(`  Erreurs: ${stats.errors}`);

  if (DRY_RUN) {
    console.log('\n⚠️  DRY_RUN = true → aucune modification appliquée.');
    console.log('   Pour appliquer réellement, mettre DRY_RUN = false dans le script.');
  } else {
    console.log('\n✅ Corrections appliquées avec succès.');
  }

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
