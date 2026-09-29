/**
 * Application de la migration 20260928160000_federis_unique_national_per_country
 * en production (Neon) + enregistrement dans _prisma_migrations.
 *
 * Index unique partiel : un seul patronat NATIONAL par pays.
 */
import pg from 'pg';
import crypto from 'crypto';
import fs from 'fs';

const MIGRATION_DIR =
  '/home/z/my-project/academia-helm/apps/api-server/prisma/migrations/20260928160000_federis_unique_national_per_country';
const MIGRATION_NAME = '20260928160000_federis_unique_national_per_country';

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
    const already = await client.query(
      `SELECT 1 FROM _prisma_migrations WHERE migration_name = $1`,
      [MIGRATION_NAME],
    );

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Index unique partiel créé (1 patronat NATIONAL par pays).');

    if (already.rows.length === 0) {
      await client.query(
        `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
         VALUES ($1, $2, now(), $3, NULL, NULL, now(), 1)`,
        [crypto.randomUUID(), checksum, MIGRATION_NAME],
      );
      console.log('✅ Migration enregistrée dans _prisma_migrations.');
    }

    // Vérification : l'index existe-t-il ?
    const idx = await client.query(`
      SELECT indexname FROM pg_indexes WHERE indexname = 'patronats_unique_national_per_country'
    `);
    console.log(`Index présent : ${idx.rows.length > 0 ? 'OUI' : 'NON'}`);

    // Test de la contrainte dans une transaction annulée (rollback)
    await client.query('BEGIN');
    try {
      const bj = await client.query(`SELECT "id" FROM countries WHERE "code" = 'BJ'`);
      await client.query(
        `INSERT INTO patronats ("id", "tenantId", "name", "orgLevel", "countryId", "scope", "subscriptionPlan", "subscriptionStatus", "status", "createdAt", "updatedAt")
         VALUES ($1, $2, 'TEST-UNICITE-ROLLBACK', 'NATIONAL', $3, 'NATIONAL', 'ESSENTIEL', 'PENDING_PAYMENT', 'ACTIVE', now(), now())`,
        [crypto.randomUUID(), 'test-unicite-tenant', bj.rows[0].id],
      );
      console.log('⚠️ L’insertion d’un second NATIONAL a RÉUSSI — la contrainte ne fonctionne pas !');
    } catch (err) {
      if (err.message.includes('patronats_unique_national_per_country')) {
        console.log('✅ Contrainte vérifiée : un second patronat NATIONAL pour le Bénin est REJETÉ par la base.');
      } else {
        console.log('Note :', err.message.slice(0, 120));
      }
    } finally {
      await client.query('ROLLBACK');
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
