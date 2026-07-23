/**
 * Seed evaluation_types pour tous les tenants actifs.
 *
 * Crée les 8 types d'évaluation spécifiés dans le Module Examen.md :
 *   - devoirs
 *   - interrogations
 *   - compositions
 *   - examens blancs
 *   - épreuves pratiques
 *   - oraux
 *   - évaluation mensuelle
 *   - évaluation certificative
 *
 * Ces types sont créés PAR tenant et PAR niveau scolaire (MATERNELLE, PRIMAIRE, SECONDAIRE).
 * Tous les types ne s'appliquent pas à tous les niveaux :
 *   - MATERNELLE : évaluation mensuelle, évaluation certificative
 *   - PRIMAIRE : devoirs, interrogations, compositions, évaluation mensuelle, évaluation certificative
 *   - SECONDAIRE : tous les 8 types
 *
 * Marqués isSystem=true pour ne pas être supprimables.
 */
import pg from 'pg';

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

// ─── Types d'évaluation par niveau ──────────────────────────────────────────
const EVALUATION_TYPES_BY_LEVEL = {
  MATERNELLE: [
    { code: 'EM', name: 'Évaluation mensuelle', defaultMaxScore: 20, defaultCoefficient: 1, schoolLevel: 'MATERNELLE' },
    { code: 'EC', name: 'Évaluation certificative', defaultMaxScore: 20, defaultCoefficient: 2, schoolLevel: 'MATERNELLE' },
  ],
  PRIMAIRE: [
    { code: 'DV', name: 'Devoir', defaultMaxScore: 20, defaultCoefficient: 1, schoolLevel: 'PRIMAIRE' },
    { code: 'INT', name: 'Interrogation', defaultMaxScore: 20, defaultCoefficient: 1, schoolLevel: 'PRIMAIRE' },
    { code: 'COMP', name: 'Composition', defaultMaxScore: 20, defaultCoefficient: 2, schoolLevel: 'PRIMAIRE' },
    { code: 'EM', name: 'Évaluation mensuelle', defaultMaxScore: 20, defaultCoefficient: 1, schoolLevel: 'PRIMAIRE' },
    { code: 'EC', name: 'Évaluation certificative', defaultMaxScore: 20, defaultCoefficient: 2, schoolLevel: 'PRIMAIRE' },
  ],
  SECONDAIRE: [
    { code: 'DV', name: 'Devoir', defaultMaxScore: 20, defaultCoefficient: 1, schoolLevel: 'SECONDAIRE' },
    { code: 'INT', name: 'Interrogation', defaultMaxScore: 20, defaultCoefficient: 1, schoolLevel: 'SECONDAIRE' },
    { code: 'COMP', name: 'Composition', defaultMaxScore: 20, defaultCoefficient: 2, schoolLevel: 'SECONDAIRE' },
    { code: 'EB', name: 'Examen blanc', defaultMaxScore: 20, defaultCoefficient: 2, schoolLevel: 'SECONDAIRE' },
    { code: 'EP', name: 'Épreuve pratique', defaultMaxScore: 20, defaultCoefficient: 1, schoolLevel: 'SECONDAIRE' },
    { code: 'ORAL', name: 'Oral', defaultMaxScore: 20, defaultCoefficient: 1, schoolLevel: 'SECONDAIRE' },
    { code: 'EM', name: 'Évaluation mensuelle', defaultMaxScore: 20, defaultCoefficient: 1, schoolLevel: 'SECONDAIRE' },
    { code: 'EC', name: 'Évaluation certificative', defaultMaxScore: 20, defaultCoefficient: 2, schoolLevel: 'SECONDAIRE' },
  ],
};

async function main() {
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connecté à Neon DB\n');

    // Récupérer tous les tenants actifs
    const tenants = await client.query("SELECT id, name FROM tenants WHERE status = 'active' ORDER BY name");
    console.log(`Tenants actifs: ${tenants.rows.length}\n`);

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const tenant of tenants.rows) {
      console.log(`── Tenant: ${tenant.name} (${tenant.id.substring(0, 8)}) ──`);

      // Récupérer les education_levels activés pour ce tenant
      const levels = await client.query(
        'SELECT id, name FROM education_levels WHERE "tenantId" = $1 AND "isEnabled" = true ORDER BY name',
        [tenant.id]
      );
      console.log(`  Niveaux activés: ${levels.rows.map((l) => l.name).join(', ')}`);

      for (const level of levels.rows) {
        const levelName = level.name.toUpperCase();
        const typesForLevel = EVALUATION_TYPES_BY_LEVEL[levelName] || [];

        for (const seedType of typesForLevel) {
          // Vérifier si ce type existe déjà pour ce tenant + code + niveau
          const existing = await client.query(
            'SELECT id FROM evaluation_types WHERE "tenantId" = $1 AND code = $2 AND "schoolLevelId" = $3',
            [tenant.id, seedType.code, level.id]
          );

          if (existing.rows.length > 0) {
            totalSkipped++;
            continue;
          }

          // Insérer le type
          await client.query(
            `INSERT INTO evaluation_types (id, "tenantId", name, code, "schoolLevelId", "isSystem", "defaultMaxScore", "defaultCoefficient", "createdAt", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, true, $5, $6, NOW(), NOW())`,
            [tenant.id, seedType.name, seedType.code, level.id, seedType.defaultMaxScore, seedType.defaultCoefficient]
          );
          totalCreated++;
          console.log(`  ✓ [${levelName}] ${seedType.code} — ${seedType.name}`);
        }
      }
      console.log('');
    }

    // Vérification finale
    const final = await client.query(`
      SELECT t.name AS tenant, et.code, et.name AS type_name, el.name AS level
      FROM evaluation_types et
      JOIN tenants t ON t.id = et."tenantId"
      LEFT JOIN education_levels el ON el.id = et."schoolLevelId"
      ORDER BY t.name, el.name, et.code
    `);
    console.log(`═══ Types d'évaluation créés : ${final.rows.length} ═══`);
    final.rows.forEach((r) => {
      console.log(`  • [${r.tenant.substring(0, 30)} | ${r.level}] ${r.code} — ${r.type_name}`);
    });

    console.log(`\n✅ Seed terminé — ${totalCreated} créés, ${totalSkipped} ignorés (déjà existants)`);

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
