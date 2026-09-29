/**
 * Application de la migration 20260927140000_federis_country_territories
 * en production (Neon) + enregistrement dans _prisma_migrations.
 *
 * La migration crée la table country_territories et y seed les 12
 * départements du Bénin (rattachés au niveau DEPARTMENT). Le SQL est
 * idempotent (CREATE TABLE IF NOT EXISTS / INSERT … WHERE NOT EXISTS).
 */
import pg from 'pg';
import crypto from 'crypto';
import fs from 'fs';

const MIGRATION_DIR =
  '/home/z/my-project/academia-helm/apps/api-server/prisma/migrations/20260927140000_federis_country_territories';
const MIGRATION_NAME = '20260927140000_federis_country_territories';

const pool = new pg.Pool({
  connectionString:
    'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function main() {
  const sql = fs.readFileSync(`${MIGRATION_DIR}/migration.sql`, 'utf8');
  const checksum = crypto.createHash('sha256').update(sql).digest('hex');

  const client = await pool.connect();
  try {
    // Déjà enregistrée ?
    const already = await client.query(
      `SELECT 1 FROM _prisma_migrations WHERE migration_name = $1`,
      [MIGRATION_NAME],
    );
    if (already.rows.length > 0) {
      console.log('Migration déjà enregistrée dans _prisma_migrations.');
    }

    // 1. Exécution du SQL de migration (idempotent)
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ SQL de migration exécuté (table + seed 12 départements du Bénin).');

    // 2. Enregistrement dans _prisma_migrations (si absent)
    if (already.rows.length === 0) {
      await client.query(
        `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
         VALUES ($1, $2, now(), $3, NULL, NULL, now(), 1)`,
        [crypto.randomUUID(), checksum, MIGRATION_NAME],
      );
      console.log('✅ Migration enregistrée dans _prisma_migrations (checksum SHA-256 du fichier).');
    }

    // 3. Vérification
    const territories = await client.query(`
      SELECT ct."name", ct."code", ct."order", ctl."code" AS level_code
      FROM country_territories ct
      LEFT JOIN country_territorial_levels ctl ON ctl."id" = ct."territorialLevelId"
      JOIN countries c ON c."id" = ct."countryId"
      WHERE c."code" = 'BJ'
      ORDER BY ct."order"
    `);
    console.log(`\nDÉPARTEMENTS DU BÉNIN EN BASE (${territories.rows.length}) :`);
    for (const t of territories.rows) {
      console.log(`  ${t.order}. ${t.name} (${t.code}) — niveau ${t.level_code}`);
    }
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    console.error('❌ ERREUR :', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
