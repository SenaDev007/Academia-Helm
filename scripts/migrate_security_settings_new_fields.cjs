/**
 * Migration SQL — Ajoute 3 nouvelles colonnes à security_settings
 * pour supporter la refonte de l'onglet Sécurité :
 *   - inactivityLockMinutes (Int, default 15) : minutes d'inactivité avant verrouillage
 *   - deviceFingerprintEnabled (Bool, default true) : reconnaissance des appareils
 *   - notifyOnNewDevice (Bool, default true) : notification email sur nouvelle connexion
 *
 * Idempotent : utilise DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN END; $$
 */
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('✓ Connected to database');

  const statements = [
    `ALTER TABLE "security_settings" ADD COLUMN IF NOT EXISTS "inactivityLockMinutes" INTEGER NOT NULL DEFAULT 15;`,
    `ALTER TABLE "security_settings" ADD COLUMN IF NOT EXISTS "deviceFingerprintEnabled" BOOLEAN NOT NULL DEFAULT true;`,
    `ALTER TABLE "security_settings" ADD COLUMN IF NOT EXISTS "notifyOnNewDevice" BOOLEAN NOT NULL DEFAULT true;`,
  ];

  for (const sql of statements) {
    console.log('→', sql);
    await client.query(sql);
  }

  console.log('\n✓ Migration complete — 3 columns added to security_settings');
  await client.end();
}

main().catch((e) => {
  console.error('✗ Migration failed:', e.message);
  process.exit(1);
});
