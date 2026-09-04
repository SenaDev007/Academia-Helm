/**
 * ============================================================================
 * BACKFILL — Noms d'affichage des comptes enseignants/promoteur (V6.1)
 * ============================================================================
 *
 * Contexte (bug « Inconnu ») :
 *   Les comptes users créés pour les enseignants (connexion par matricule,
 *   liaison par email vers la table teachers) ont firstName/lastName NULL
 *   sur users — le nom vit uniquement dans teachers. Résultat : les fils de
 *   discussion affichaient « Inconnu » / « Utilisateur », la session de
 *   login renvoyait un nom vide.
 *
 *   Le code a été corrigé côté lecture (listMessages, searchUsers,
 *   broadcastNewMessage, getChannelMessages, global-search : jointure
 *   LATERAL teachers par email + COALESCE). Ce script fait le backfill
 *   PERSISTANT des lignes users elles-mêmes, pour que :
 *     - la session de login renvoie le vrai nom (les deux UI l'utilisent),
 *     - les futures requêtes ne dépendent plus de la jointure de secours.
 *
 * Idempotent : ne touche que les users dont firstName ET lastName sont
 * vides/null, et uniquement quand une fiche teachers homonyme (email)
 * existe. Ne modifie JAMAIS un nom déjà renseigné.
 *
 * Usage : node scripts/backfill-teacher-user-names.js
 * ============================================================================
 */
const { Client } = require('pg');

const envUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgresql') ? process.env.DATABASE_URL : null;
const DATABASE_URL =
  envUrl ||
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // 1. État avant backfill
  const before = await client.query(`
    SELECT count(*)::int AS cnt
    FROM "users" u
    WHERE (NULLIF(TRIM(u."firstName"), '') IS NULL OR NULLIF(TRIM(u."lastName"), '') IS NULL)
      AND EXISTS (SELECT 1 FROM "teachers" t WHERE LOWER(t."email") = LOWER(u."email")
                  AND (NULLIF(TRIM(t."firstName"), '') IS NOT NULL OR NULLIF(TRIM(t."lastName"), '') IS NOT NULL))
  `);
  console.log(`Comptes users sans nom mais avec fiche enseignant : ${before.rows[0].cnt}`);

  if (before.rows[0].cnt === 0) {
    console.log('✅ Rien à backfiller — tous les comptes ont déjà un nom.');
    await client.end();
    return;
  }

  // 2. Backfill (uniquement les champs vides, jamais d'écrasement)
  const updated = await client.query(`
    UPDATE "users" u
    SET "firstName" = COALESCE(NULLIF(TRIM(u."firstName"), ''), NULLIF(TRIM(t."firstName"), ''), u."firstName"),
        "lastName"  = COALESCE(NULLIF(TRIM(u."lastName"),  ''), NULLIF(TRIM(t."lastName"),  ''), u."lastName"),
        "updatedAt" = NOW()
    FROM "teachers" t
    WHERE LOWER(t."email") = LOWER(u."email")
      AND (NULLIF(TRIM(u."firstName"), '') IS NULL OR NULLIF(TRIM(u."lastName"), '') IS NULL)
      AND (NULLIF(TRIM(t."firstName"), '') IS NOT NULL OR NULLIF(TRIM(t."lastName"), '') IS NOT NULL)
  `);
  console.log(`✅ ${updated.rowCount} compte(s) users backfillé(s) depuis la fiche enseignant.`);

  // 3. Vérification : liste des comptes encore sans nom (à inspecter manuellement)
  const remaining = await client.query(`
    SELECT u.email, u.role
    FROM "users" u
    WHERE NULLIF(TRIM(u."firstName"), '') IS NULL AND NULLIF(TRIM(u."lastName"), '') IS NULL
    ORDER BY u.email
    LIMIT 30
  `);
  if (remaining.rows.length > 0) {
    console.log(`\n⚠️  ${remaining.rows.length} compte(s) restent sans nom (sans fiche teachers) :`);
    for (const r of remaining.rows) console.log(`   - ${r.email} (${r.role})`);
  } else {
    console.log('Aucun compte sans nom restant.');
  }

  await client.end();
}

main().catch((e) => {
  console.error('❌ Backfill échoué :', e.message);
  process.exit(1);
});
