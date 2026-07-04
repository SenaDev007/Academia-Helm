/**
 * ============================================================================
 * NETTOYAGE DES RÉGIMES TARIFAIRES ORPHELINS
 * ============================================================================
 *
 * Problème : Des régimes tarifaires ont été créés avec un schoolLevelId qui
 * correspond à l'UUID de education_levels (au lieu de school_levels).
 * Ces régimes orphelins :
 *   - Ne s'affichent jamais dans l'UI (qui filtre par schoolLevelId correct)
 *   - Empêchent la création de nouveaux régimes (conflit de code unique)
 *   - Sont invisibles pour l'utilisateur mais bloquants
 *
 * Solution : Supprimer tous les fee_regimes dont le schoolLevelId ne correspond
 * à aucune entrée dans school_levels. Les régimes valides (avec FK correcte)
 * sont préservés.
 *
 * ============================================================================
 */

const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const CLEANUP_SQL = `
-- 1. D'abord, supprimer les règles liées aux régimes orphelins
DELETE FROM "fee_regime_rules"
WHERE "feeRegimeId" IN (
  SELECT fr."id"
  FROM "fee_regimes" fr
  LEFT JOIN "school_levels" sl ON sl."id" = fr."schoolLevelId"
  WHERE sl."id" IS NULL
);

-- 2. Ensuite, supprimer les profils étudiants liés aux régimes orphelins
DELETE FROM "student_fee_profiles"
WHERE "feeRegimeId" IN (
  SELECT fr."id"
  FROM "fee_regimes" fr
  LEFT JOIN "school_levels" sl ON sl."id" = fr."schoolLevelId"
  WHERE sl."id" IS NULL
);

-- 3. Enfin, supprimer les régimes orphelins eux-mêmes
DELETE FROM "fee_regimes"
WHERE "id" IN (
  SELECT fr."id"
  FROM "fee_regimes" fr
  LEFT JOIN "school_levels" sl ON sl."id" = fr."schoolLevelId"
  WHERE sl."id" IS NULL
);

-- 4. Afficher les régimes restants pour vérification
SELECT fr."id", fr."code", fr."label", fr."schoolLevelId", sl."code" AS "schoolLevelCode"
FROM "fee_regimes" fr
JOIN "school_levels" sl ON sl."id" = fr."schoolLevelId"
ORDER BY fr."code";
`;

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    console.log('🔗 Connexion à Neon...');
    await client.connect();
    console.log('✅ Connecté\n');

    console.log('🧹 Nettoyage des régimes orphelins...');
    const result = await client.query(CLEANUP_SQL);
    console.log('✅ Nettoyage terminé\n');

    // Le dernier statement (SELECT) retourne les régimes restants
    const lastResult = result[result.length - 1];
    if (lastResult && lastResult.rows) {
      console.log(`📊 Régimes valides restants : ${lastResult.rows.length}`);
      for (const row of lastResult.rows) {
        console.log(`   - [${row.code}] ${row.label} (schoolLevel: ${row.schoolLevelCode})`);
      }
    }
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
