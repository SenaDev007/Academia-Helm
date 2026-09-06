#!/usr/bin/env node
/**
 * _apply_general_fee_migration.js — Applique la migration 20260910000000_add_general_fee_type
 * sur Neon (ajout de la valeur 'GENERAL' à l'enum "FeeType"), idempotent,
 * + enregistrement dans _prisma_migrations (zéro drift pour Railway migrate deploy).
 */
const PG = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const DB = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const NAME = '20260910000000_add_general_fee_type';
const SQL_PATH = '/home/z/my-project/Academia-Helm/apps/api-server/prisma/migrations/' + NAME + '/migration.sql';
const SQL = fs.readFileSync(SQL_PATH, 'utf8');

(async () => {
  const c = new PG.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // 1) Vérifier l'état actuel de l'enum
  const before = await c.query(
    `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'FeeType' ORDER BY e.enumsortorder`
  );
  console.log('Enum FeeType AVANT :', before.rows.map((r) => r.enumlabel).join(', '));

  if (before.rows.some((r) => r.enumlabel === 'GENERAL')) {
    console.log('⏭️  GENERAL déjà présent — aucune modification nécessaire.');
  } else {
    // 2) ALTER TYPE ADD VALUE (⚠️ hors transaction de mise à jour de données)
    try {
      await c.query(`ALTER TYPE "FeeType" ADD VALUE IF NOT EXISTS 'GENERAL'`);
      console.log('✅ ALTER TYPE "FeeType" ADD VALUE \'GENERAL\' exécuté.');
    } catch (e) {
      // pg < 12 n'accepte pas ADD VALUE dans un bloc de transaction — Neon (pg16) l'accepte.
      // Sécurité : nouvelle tentative hors transaction explicite.
      console.log('⚠️ tentative simple échouée (' + e.message + ') — nouvelle tentative...');
      await c.query('COMMIT');
      await c.query(`ALTER TYPE "FeeType" ADD VALUE IF NOT EXISTS 'GENERAL'`);
      console.log('✅ ALTER TYPE exécuté (2e tentative).');
    }
  }

  // 3) Vérification après
  const after = await c.query(
    `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'FeeType' ORDER BY e.enumsortorder`
  );
  console.log('Enum FeeType APRÈS :', after.rows.map((r) => r.enumlabel).join(', '));
  if (!after.rows.some((r) => r.enumlabel === 'GENERAL')) {
    throw new Error('GENERAL absent après application — ÉCHEC');
  }

  // 4) Enregistrement _prisma_migrations (checksum = hash du fichier SQL)
  const exists = await c.query('SELECT id FROM _prisma_migrations WHERE migration_name = $1', [NAME]);
  if (!exists.rows.length) {
    const checksum = crypto.createHash('sha256').update(SQL).digest('hex');
    await c.query(
      `INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count)
       VALUES (gen_random_uuid(), $1, $2, now(), 0)`,
      [checksum, NAME]);
    console.log('✅ Migration enregistrée dans _prisma_migrations (zéro drift)');
  } else {
    console.log('Migration déjà enregistrée dans _prisma_migrations');
  }

  await c.end();
  console.log('\n🎉 Migration GENERAL appliquée avec succès.');
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
