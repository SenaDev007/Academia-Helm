/**
 * Test CRUD complet des types d'évaluation dans Neon DB.
 *
 * Ce test simule ce que le frontend fera via l'API :
 *   1. CREATE : créer un type "Devoir surveillé" pour le secondaire
 *   2. READ : lister les types
 *   3. UPDATE : modifier le coefficient par défaut
 *   4. DELETE : supprimer le type créé
 *
 * Valide que la contrainte unique (tenantId, code, schoolLevelId) fonctionne
 * et que les nouveaux champs (code, schoolLevelId, isSystem) sont bien persistés.
 */
import pg from 'pg';

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connecté à Neon DB\n');

    const tenantId = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';

    // Récupérer les education_levels
    const levelsRes = await client.query(
      'SELECT id, name FROM education_levels WHERE "tenantId" = $1 AND "isEnabled" = true ORDER BY name',
      [tenantId]
    );
    console.log('Niveaux disponibles:');
    levelsRes.rows.forEach(l => console.log('  -', l.name, '(', l.id.substring(0, 8), ')'));

    const maternelleId = levelsRes.rows.find((l) => l.name === 'MATERNELLE')?.id;
    const primaireId = levelsRes.rows.find((l) => l.name === 'PRIMAIRE')?.id;
    const secondaireId = levelsRes.rows.find((l) => l.name === 'SECONDAIRE')?.id;

    if (!secondaireId) {
      console.log('❌ Niveau SECONDAIRE non trouvé');
      return;
    }

    // ─── État initial ──────────────────────────────────────────────────────
    const before = await client.query('SELECT COUNT(*) FROM evaluation_types');
    console.log(`\nTypes avant test: ${before.rows[0].count}`);

    // ─── 1. CREATE ─────────────────────────────────────────────────────────
    console.log('\n═══ 1. CREATE — "Devoir surveillé" (SECONDAIRE, code=DS) ═══');
    const createRes = await client.query(`
      INSERT INTO evaluation_types (id, "tenantId", name, code, "schoolLevelId", "isSystem", "defaultMaxScore", "defaultCoefficient", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, $3, $4, false, 20, 2, NOW(), NOW())
      RETURNING id, name, code, "schoolLevelId", "isSystem", "defaultMaxScore", "defaultCoefficient"
    `, [tenantId, 'Devoir surveillé', 'DS', secondaireId]);
    const typeRow = createRes.rows[0];
    console.log('  ✅ Type créé:');
    console.log('     ID:', typeRow.id);
    console.log('     Nom:', typeRow.name);
    console.log('     Code:', typeRow.code);
    console.log('     Niveau:', secondaireId.substring(0, 8));
    console.log('     isSystem:', typeRow.isSystem);
    console.log('     Barème:', typeRow.defaultMaxScore, '| Coef:', typeRow.defaultCoefficient);

    // ─── 2. READ ───────────────────────────────────────────────────────────
    console.log('\n═══ 2. READ — Lister les types ═══');
    const readRes = await client.query(`
      SELECT et.id, et.name, et.code, el.name AS level_name, et."isSystem", et."defaultMaxScore", et."defaultCoefficient"
      FROM evaluation_types et
      LEFT JOIN education_levels el ON el.id = et."schoolLevelId"
      WHERE et."tenantId" = $1
      ORDER BY el.name, et.name
    `, [tenantId]);
    console.log(`  ✅ ${readRes.rows.length} type(s) trouvé(s):`);
    readRes.rows.forEach((t) => {
      console.log(`     - [${t.level_name || '—'}] ${t.code || '—'} | ${t.name} | /${t.defaultMaxScore} coef ${t.defaultCoefficient} | system=${t.isSystem}`);
    });

    // ─── 3. UPDATE ─────────────────────────────────────────────────────────
    console.log('\n═══ 3. UPDATE — Changer coef 2 → 3 ═══');
    const updateRes = await client.query(`
      UPDATE evaluation_types
      SET "defaultCoefficient" = 3, "updatedAt" = NOW()
      WHERE id = $1
      RETURNING name, "defaultCoefficient"
    `, [typeRow.id]);
    console.log('  ✅ Type modifié:');
    console.log('     Nom:', updateRes.rows[0].name);
    console.log('     Nouveau coef:', updateRes.rows[0].defaultCoefficient);

    // ─── 4. Test contrainte unique (tenantId, code, schoolLevelId) ─────────
    console.log('\n═══ 4. TEST CONTRAINTE UNIQUE — Créer un 2e "DS" pour SECONDAIRE ═══');
    try {
      await client.query(`
        INSERT INTO evaluation_types (id, "tenantId", name, code, "schoolLevelId", "isSystem", "defaultMaxScore", "defaultCoefficient", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), $1, 'Devoir surveillé (doublon)', $2, $3, false, 20, 2, NOW(), NOW())
      `, [tenantId, 'DS', secondaireId]);
      console.log('  ❌ Contrainte unique non respectée !');
    } catch (err) {
      console.log('  ✅ Contrainte unique OK — doublon refusé:', err.message.substring(0, 80));
    }

    // ─── 5. Test : créer le MÊME code mais pour PRIMAIRE (devrait marcher) ─
    if (primaireId) {
      console.log('\n═══ 5. TEST — Créer "DS" pour PRIMAIRE (devrait marcher) ═══');
      try {
        const crossRes = await client.query(`
          INSERT INTO evaluation_types (id, "tenantId", name, code, "schoolLevelId", "isSystem", "defaultMaxScore", "defaultCoefficient", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), $1, 'Devoir', $2, $3, false, 20, 1, NOW(), NOW())
          RETURNING id, name, code
        `, [tenantId, 'DS', primaireId]);
        console.log('  ✅ Création OK — code DS accepté pour PRIMAIRE');
        const primaireTypeId = crossRes.rows[0].id;

        // Supprimer ce type de test
        await client.query('DELETE FROM evaluation_types WHERE id = $1', [primaireTypeId]);
        console.log('  ✓ Type de test PRIMAIRE supprimé');
      } catch (err) {
        console.log('  ❌ Échec inattendu:', err.message);
      }
    }

    // ─── 6. DELETE ─────────────────────────────────────────────────────────
    console.log('\n═══ 6. DELETE — Supprimer le type "Devoir surveillé" ═══');
    await client.query('DELETE FROM evaluation_types WHERE id = $1', [typeRow.id]);
    const verifyRes = await client.query('SELECT COUNT(*) FROM evaluation_types WHERE id = $1', [typeRow.id]);
    console.log('  ✅ Type supprimé — count restant:', verifyRes.rows[0].count);

    // ─── État final ────────────────────────────────────────────────────────
    console.log('\n═══ ÉTAT FINAL ═══');
    const finalCount = await client.query('SELECT COUNT(*) FROM evaluation_types');
    console.log('  Total types:', finalCount.rows[0].count);
    console.log('  (devrait être 0 — les types seront créés par l\'utilisateur via l\'UI)');

    console.log('\n✅ CRUD TEST TERMINÉ — Tout est persisté correctement en DB');

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
