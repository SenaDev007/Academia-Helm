/**
 * Synchronise evaluation_types depuis school_academic_settings.config.assessmentTypes.
 *
 * Pour chaque paramétrage actif (school_academic_settings), on crée/met à jour
 * les entries correspondantes dans evaluation_types avec :
 *   - tenantId, schoolLevelId (résolu depuis levelCode)
 *   - name = assessmentType.label
 *   - code = assessmentType.code
 *   - defaultMaxScore = config.scoreMax
 *   - defaultCoefficient = 1 si includedInAverage, sinon 0
 *   - isSystem = false
 *
 * Ainsi, les types d'évaluation sont persistés DANS la table evaluation_types
 * (pour le backup et les requêtes SQL) EN PLUS du JSON school_academic_settings.
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

    // 1. Récupérer tous les school_academic_settings
    const settings = await client.query(`
      SELECT id, "tenantId", "levelCode", language, config, status
      FROM school_academic_settings
      ORDER BY "tenantId", "levelCode", language
    `);
    console.log(`Paramétrages trouvés: ${settings.rows.length}\n`);

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;

    for (const setting of settings.rows) {
      const { tenantId, levelCode, language, config } = setting;
      const assessmentTypes = config?.assessmentTypes || [];

      if (assessmentTypes.length === 0) {
        console.log(`  ⚠️ [${levelCode}/${language}] Pas d'assessmentTypes dans le config — skip`);
        totalSkipped++;
        continue;
      }

      // Résoudre le schoolLevelId depuis le levelCode
      const levelCodeUpper = (levelCode || '').toUpperCase();
      const slRes = await client.query(
        'SELECT id FROM school_levels WHERE "tenantId" = $1 AND code = $2 LIMIT 1',
        [tenantId, levelCodeUpper]
      );

      if (slRes.rows.length === 0) {
        console.log(`  ⚠️ [${levelCode}/${language}] school_levels non trouvé pour code=${levelCodeUpper} — skip`);
        totalSkipped++;
        continue;
      }

      const schoolLevelId = slRes.rows[0].id;
      const scoreMax = config?.scoreMax || 20;

      console.log(`── [${levelCode}/${language}] schoolLevelId=${schoolLevelId.substring(0, 8)} — ${assessmentTypes.length} types ──`);

      for (const at of assessmentTypes) {
        const code = at.code;
        const name = at.label || at.code;
        const defaultMaxScore = scoreMax;
        const defaultCoefficient = at.includedInAverage ? 1 : 0;

        // Vérifier si existe déjà (tenantId + code + schoolLevelId)
        const existing = await client.query(
          'SELECT id FROM evaluation_types WHERE "tenantId" = $1 AND code = $2 AND "schoolLevelId" = $3',
          [tenantId, code, schoolLevelId]
        );

        if (existing.rows.length > 0) {
          // Mettre à jour
          await client.query(
            `UPDATE evaluation_types SET name = $1, "defaultMaxScore" = $2, "defaultCoefficient" = $3, "updatedAt" = NOW()
             WHERE "tenantId" = $4 AND code = $5 AND "schoolLevelId" = $6`,
            [name, defaultMaxScore, defaultCoefficient, tenantId, code, schoolLevelId]
          );
          totalUpdated++;
          console.log(`  ✓ UPDATE ${code} — ${name}`);
        } else {
          // Créer
          await client.query(
            `INSERT INTO evaluation_types (id, "tenantId", name, code, "schoolLevelId", "isSystem", "defaultMaxScore", "defaultCoefficient", "createdAt", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, false, $5, $6, NOW(), NOW())`,
            [tenantId, name, code, schoolLevelId, defaultMaxScore, defaultCoefficient]
          );
          totalCreated++;
          console.log(`  ✓ CREATE ${code} — ${name}`);
        }
      }
      console.log('');
    }

    // Vérification finale
    const final = await client.query(`
      SELECT et.code, et.name, sl.code AS level_code
      FROM evaluation_types et
      LEFT JOIN school_levels sl ON sl.id = et."schoolLevelId"
      ORDER BY sl.code, et.code
    `);
    console.log(`═══ ÉTAT FINAL : ${final.rows.length} types d'évaluation en DB ═══`);
    final.rows.forEach((t) => {
      console.log(`  - [${t.level_code || '?'}] ${t.code} — ${t.name}`);
    });

    console.log(`\n✅ Synchronisation terminée — ${totalCreated} créés, ${totalUpdated} mis à jour, ${totalSkipped} ignorés`);

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
