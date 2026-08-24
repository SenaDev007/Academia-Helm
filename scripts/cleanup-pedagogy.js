const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('✅ Connecté à la BDD Neon');

  // 1. Compter avant suppression
  const beforeFiches = await client.query(`SELECT COUNT(*) as count FROM "primary_pedagogical_fiches" WHERE "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')`);
  const beforeCJ = await client.query(`SELECT COUNT(*) as count FROM "cahier_journal_entries" WHERE "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')`);
  const beforeReg = await client.query(`SELECT COUNT(*) as count FROM "attendance_registers" WHERE "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')`);
  const beforeEval = await client.query(`SELECT COUNT(*) as count FROM "monthly_evaluations" WHERE "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')`);
  const beforeCT = await client.query(`SELECT COUNT(*) as count FROM "cahier_de_textes" WHERE "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')`);

  console.log(`Avant nettoyage :`);
  console.log(`  - Fiches pédagogiques (SUBMITTED/VALIDATED/REJECTED) : ${beforeFiches.rows[0].count}`);
  console.log(`  - Cahiers journal (SUBMITTED/VALIDATED/REJECTED) : ${beforeCJ.rows[0].count}`);
  console.log(`  - Registres d'appel : ${beforeReg.rows[0].count}`);
  console.log(`  - Évaluations mensuelles : ${beforeEval.rows[0].count}`);
  console.log(`  - Cahiers de test : ${beforeCT.rows[0].count}`);

  // 2. Supprimer TOUTES les fiches pédagogiques soumisées/validées/rejetées
  const delFiches = await client.query(`DELETE FROM "primary_pedagogical_fiches" WHERE "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')`);
  console.log(`\n✅ ${delFiches.rowCount} fiche(s) pédagogique(s) supprimée(s)`);

  // 3. Reset cahiers journal → DRAFT
  const updCJ = await client.query(`
    UPDATE "cahier_journal_entries"
    SET "status" = 'DRAFT',
        "submittedAt" = NULL,
        "directorSignature" = NULL,
        "directorValidatedAt" = NULL,
        "rejectionReason" = NULL,
        "updatedAt" = NOW()
    WHERE "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')
  `);
  console.log(`✅ ${updCJ.rowCount} cahier(s) journal reset → DRAFT`);

  // 4. Reset registres → DRAFT
  const updReg = await client.query(`
    UPDATE "attendance_registers"
    SET "status" = 'DRAFT',
        "submittedAt" = NULL,
        "directorSignature" = NULL,
        "directeurSignatureDate" = NULL,
        "validatedAt" = NULL,
        "validatedBy" = NULL,
        "rejectionReason" = NULL,
        "updatedAt" = NOW()
    WHERE "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')
  `);
  console.log(`✅ ${updReg.rowCount} registre(s) d'appel reset → DRAFT`);

  // 5. Reset évaluations → DRAFT
  const updEval = await client.query(`
    UPDATE "monthly_evaluations"
    SET "status" = 'DRAFT',
        "submittedAt" = NULL,
        "directorSignature" = NULL,
        "validatedAt" = NULL,
        "validatedBy" = NULL,
        "rejectionReason" = NULL,
        "updatedAt" = NOW()
    WHERE "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')
  `);
  console.log(`✅ ${updEval.rowCount} évaluation(s) reset → DRAFT`);

  // 6. Reset cahiers de test → DRAFT
  const updCT = await client.query(`
    UPDATE "cahier_de_textes"
    SET "status" = 'DRAFT',
        "submittedAt" = NULL,
        "directorSignature" = NULL,
        "validatedAt" = NULL,
        "validatedBy" = NULL,
        "rejectionReason" = NULL,
        "updatedAt" = NOW()
    WHERE "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')
  `);
  console.log(`✅ ${updCT.rowCount} cahier(s) de texte reset → DRAFT`);

  // 7. Vérifier après
  const afterFiches = await client.query(`SELECT COUNT(*) as count FROM "primary_pedagogical_fiches" WHERE "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')`);
  const afterCJ = await client.query(`SELECT COUNT(*) as count FROM "cahier_journal_entries" WHERE "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')`);
  console.log(`\nAprès nettoyage :`);
  console.log(`  - Fiches pédagogiques (SUBMITTED/VALIDATED/REJECTED) : ${afterFiches.rows[0].count}`);
  console.log(`  - Cahiers journal (SUBMITTED/VALIDATED/REJECTED) : ${afterCJ.rows[0].count}`);

  // 8. Vérifier les fiches DRAFT restantes
  const draftFiches = await client.query(`SELECT COUNT(*) as count FROM "primary_pedagogical_fiches" WHERE "status" = 'DRAFT'`);
  const draftCJ = await client.query(`SELECT COUNT(*) as count FROM "cahier_journal_entries" WHERE "status" = 'DRAFT'`);
  console.log(`\nDonnées conservées (DRAFT) :`);
  console.log(`  - Fiches pédagogiques (DRAFT) : ${draftFiches.rows[0].count}`);
  console.log(`  - Cahiers journal (DRAFT) : ${draftCJ.rows[0].count}`);

  await client.end();
  console.log('\n✅ Nettoyage terminé — déconnecté de la BDD');
}

main().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
