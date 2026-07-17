/**
 * Correction des données Mon Avenir Plus — VERSION OPTIMISÉE.
 *
 * Charge toutes les données en une seule requête, puis traite en mémoire.
 * Écrit les modifications par batch de 50 comptes.
 */
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const DRY_RUN = false; // ⚠️ Mettre à false pour appliquer réellement

const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const ACADEMIC_YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log(`\n🔧 Correction allocations (VERSION OPTIMISÉE)`);
  console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN' : '⚠️  APPLICATION RÉELLE'}\n`);

  // 1. Charger TOUS les account_breakdowns avec leur feeType
  console.log('=== 1. Chargement breakdowns ===');
  const breakdownsRes = await client.query(`
    SELECT ab.id, ab."studentAccountId", ab."feeStructureId",
      ab."initialAmount", ab."paidAmount", ab."remainingAmount",
      fs."feeType"
    FROM account_breakdowns ab
    JOIN fee_structures fs ON fs.id = ab."feeStructureId"
    JOIN student_accounts sa ON sa.id = ab."studentAccountId"
    WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`   ${breakdownsRes.rows.length} breakdowns chargés`);

  // Index: accountId → { INSCRIPTION: bd, TUITION: bd }
  const bdByAccount = new Map();
  for (const bd of breakdownsRes.rows) {
    if (!bdByAccount.has(bd.studentAccountId)) {
      bdByAccount.set(bd.studentAccountId, {});
    }
    bdByAccount.get(bd.studentAccountId)[bd.feeType] = bd;
  }

  // 2. Charger TOUTES les allocations avec leur transaction
  console.log('=== 2. Chargement allocations ===');
  const allocsRes = await client.query(`
    SELECT fta.id, fta."financeTransactionId", fta."accountBreakdownId", fta.amount,
      ft."studentAccountId", ft."createdAt", ft."receiptNumber"
    FROM finance_transaction_allocations fta
    JOIN finance_transactions ft ON ft.id = fta."financeTransactionId"
    WHERE ft."tenantId" = $1 AND ft."academicYearId" = $2
    ORDER BY ft."createdAt" ASC
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`   ${allocsRes.rows.length} allocations chargées`);

  // Index: accountId → [allocs sorted by date]
  const allocsByAccount = new Map();
  for (const a of allocsRes.rows) {
    if (!allocsByAccount.has(a.studentAccountId)) {
      allocsByAccount.set(a.studentAccountId, []);
    }
    allocsByAccount.get(a.studentAccountId).push(a);
  }

  // 3. Charger les comptes
  console.log('=== 3. Chargement comptes ===');
  const accountsRes = await client.query(`
    SELECT sa.id, sa."studentId", s."firstName" || ' ' || s."lastName" as student_name,
      c.name as class_name, sl.code as level_code
    FROM student_accounts sa
    JOIN students s ON s.id = sa."studentId"
    LEFT JOIN student_enrollments se ON se."studentId" = s.id AND se."academicYearId" = sa."academicYearId"
    LEFT JOIN classes c ON c.id = se."classId"
    LEFT JOIN school_levels sl ON sl.id = c."schoolLevelId"
    WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`   ${accountsRes.rows.length} comptes chargés\n`);

  // 4. Pour chaque compte, calculer les corrections nécessaires
  const fixes = []; // { accountId, allocsToSplit, allocsToRetag, newInscriptionPaid, newTuitionPaid }
  let stats = {
    studentsProcessed: 0,
    studentsNeedFix: 0,
    allocationsToSplit: 0,
    allocationsToRetag: 0,
  };

  for (const account of accountsRes.rows) {
    stats.studentsProcessed++;
    const breakdowns = bdByAccount.get(account.id) || {};
    const inscriptionBd = breakdowns.INSCRIPTION;
    const tuitionBd = breakdowns.TUITION;
    const allocs = allocsByAccount.get(account.id) || [];

    if (!inscriptionBd || !tuitionBd || allocs.length === 0) continue;

    // Allocations INSCRIPTION, triées par date ASC (déjà triées)
    const insAllocs = allocs.filter(a => a.accountBreakdownId === inscriptionBd.id);
    const totalInscriptionPaid = insAllocs.reduce((s, a) => s + Number(a.amount), 0);
    const expectedInscription = Number(inscriptionBd.initialAmount) || 0;

    if (totalInscriptionPaid <= expectedInscription) continue;

    // Il y a un excédent → on doit re-tag
    const excess = totalInscriptionPaid - expectedInscription;
    stats.studentsNeedFix++;

    // Trouver l'index où on dépasse expectedInscription
    let cumul = 0;
    let firstExcessIdx = -1;
    for (let i = 0; i < insAllocs.length; i++) {
      cumul += Number(insAllocs[i].amount);
      if (cumul > expectedInscription) {
        firstExcessIdx = i;
        break;
      }
    }
    if (firstExcessIdx === -1) continue;

    const allocToSplit = insAllocs[firstExcessIdx];
    const amountBeforeExcess = expectedInscription - (cumul - Number(allocToSplit.amount));
    const amountToMove = Number(allocToSplit.amount) - amountBeforeExcess;
    const allocsToRetag = insAllocs.slice(firstExcessIdx + 1);

    fixes.push({
      account,
      inscriptionBd,
      tuitionBd,
      allocToSplit: { id: allocToSplit.id, financeTransactionId: allocToSplit.financeTransactionId, amountBeforeExcess, amountToMove },
      allocsToRetag: allocsToRetag.map(a => ({ id: a.id, amount: Number(a.amount) })),
      expectedInscription,
      totalInscriptionPaid,
      excess,
    });
    stats.allocationsToSplit++;
    stats.allocationsToRetag += allocsToRetag.length;
  }

  console.log(`=== Résumé dry-run ===`);
  console.log(`  Comptes traités: ${stats.studentsProcessed}`);
  console.log(`  Comptes à corriger: ${stats.studentsNeedFix}`);
  console.log(`  Allocations à splitter: ${stats.allocationsToSplit}`);
  console.log(`  Allocations à re-tagger: ${stats.allocationsToRetag}`);

  // 5. Échantillon de 10 corrections pour validation visuelle
  console.log(`\n=== Échantillon de 10 corrections ===`);
  fixes.slice(0, 10).forEach(f => {
    console.log(`  ${f.account.student_name} (${f.account.class_name}, ${f.account.level_code}):`);
    console.log(`    INSCRIPTION expected=${f.expectedInscription} paid=${f.totalInscriptionPaid} excédent=${f.excess}`);
    console.log(`    Split alloc ${f.allocToSplit.id.substring(0, 8)}: garder ${f.allocToSplit.amountBeforeExcess} INSCRIPT + déplacer ${f.allocToSplit.amountToMove} vers TUITION`);
    if (f.allocsToRetag.length > 0) {
      console.log(`    Re-tag ${f.allocsToRetag.length} alloc(s) vers TUITION (total = ${f.allocsToRetag.reduce((s, a) => s + a.amount, 0)} FCFA)`);
    }
  });

  if (DRY_RUN) {
    console.log('\n⚠️  DRY_RUN = true → aucune modification appliquée.');
    console.log('   Pour appliquer réellement, mettre DRY_RUN = false dans le script.');
    await client.end();
    return;
  }

  // === APPLICATION RÉELLE ===
  console.log(`\n=== Application des ${fixes.length} corrections ===`);

  let applied = 0;
  let errors = 0;
  for (let idx = 0; idx < fixes.length; idx++) {
    const f = fixes[idx];
    try {
      await client.query('BEGIN');

      // 1. Split allocation : réduire montant sur INSCRIPTION
      if (f.allocToSplit.amountToMove > 0) {
        await client.query(`
          UPDATE finance_transaction_allocations
          SET amount = $1
          WHERE id = $2
        `, [f.allocToSplit.amountBeforeExcess, f.allocToSplit.id]);

        // Créer nouvelle allocation vers TUITION
        await client.query(`
          INSERT INTO finance_transaction_allocations (id, "financeTransactionId", "accountBreakdownId", amount)
          VALUES (gen_random_uuid(), $1, $2, $3)
        `, [f.allocToSplit.financeTransactionId, f.tuitionBd.id, f.allocToSplit.amountToMove]);
      }

      // 2. Re-tag les allocations suivantes vers TUITION
      for (const a of f.allocsToRetag) {
        await client.query(`
          UPDATE finance_transaction_allocations
          SET "accountBreakdownId" = $1
          WHERE id = $2
        `, [f.tuitionBd.id, a.id]);
      }

      // 3. Recalculer INSCRIPTION breakdown
      await client.query(`
        UPDATE account_breakdowns
        SET "paidAmount" = $1, "remainingAmount" = 0
        WHERE id = $2
      `, [f.expectedInscription, f.inscriptionBd.id]);

      // 4. Recalculer TUITION breakdown depuis la DB (somme des allocations)
      const tuitionPaidRes = await client.query(`
        SELECT COALESCE(SUM(fta.amount), 0) as total
        FROM finance_transaction_allocations fta
        WHERE fta."accountBreakdownId" = $1
      `, [f.tuitionBd.id]);
      const newTuitionPaid = Number(tuitionPaidRes.rows[0].total);
      const newTuitionRemaining = Math.max(0, Number(f.tuitionBd.initialAmount) - newTuitionPaid);
      await client.query(`
        UPDATE account_breakdowns
        SET "paidAmount" = $1, "remainingAmount" = $2
        WHERE id = $3
      `, [newTuitionPaid, newTuitionRemaining, f.tuitionBd.id]);

      // 5. Recalculer student_accounts
      const totalsRes = await client.query(`
        SELECT
          (SELECT COALESCE(SUM(fta.amount), 0) FROM finance_transaction_allocations fta
           JOIN finance_transactions ft ON ft.id = fta."financeTransactionId"
           WHERE ft."studentAccountId" = $1 AND ft."academicYearId" = $2) as total_paid,
          (SELECT COALESCE(SUM(ab."initialAmount"), 0) FROM account_breakdowns ab
           WHERE ab."studentAccountId" = $1) as total_due
      `, [f.account.id, ACADEMIC_YEAR_ID]);
      const totalPaid = Number(totalsRes.rows[0].total_paid);
      const totalDue = Number(totalsRes.rows[0].total_due);
      await client.query(`
        UPDATE student_accounts
        SET "totalPaid" = $1, "balance" = $2, "totalDue" = $3, "updatedAt" = NOW()
        WHERE id = $4
      `, [totalPaid, Math.max(0, totalDue - totalPaid), totalDue, f.account.id]);

      await client.query('COMMIT');
      applied++;
      if (applied % 10 === 0 || applied === fixes.length) {
        console.log(`   [${applied}/${fixes.length}] ${f.account.student_name} OK`);
      }
      // Petite pause tous les 30 comptes pour éviter timeout Neon
      if (applied % 30 === 0) {
        await sleep(500);
      }
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch {}
      errors++;
      console.error(`❌ Erreur ${f.account.student_name}: ${err.message}`);
      // Reconnect si la connexion a sauté
      try {
        await client.query('SELECT 1');
      } catch {
        console.log('   🔄 Reconnexion à la DB...');
        try { await client.end(); } catch {}
        await client.connect();
      }
    }
  }

  console.log(`\n=== Statistiques finales ===`);
  console.log(`  Corrections appliquées: ${applied}/${fixes.length}`);
  console.log(`  Erreurs: ${errors}`);

  await client.end();
  console.log('\n✅ Terminé');
}

main().catch(e => { console.error(e); process.exit(1); });
