/**
 * Script : Applique la migration 015 (table lab_settings) sur Neon PostgreSQL.
 */

const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS lab_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" VARCHAR NOT NULL,
  key VARCHAR NOT NULL,
  value TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT lab_settings_tenantId_key_key UNIQUE ("tenantId", key)
);

CREATE INDEX IF NOT EXISTS lab_settings_tenantId_idx ON lab_settings ("tenantId");

COMMENT ON TABLE lab_settings IS 'Paramètres du module Laboratoire (par tenant). key-value pairs.';
`;

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔗 Connexion à Neon PostgreSQL...');
    await client.connect();
    console.log('✅ Connecté.');

    console.log('\n🚀 Application de la migration 015 (lab_settings)...');
    await client.query(MIGRATION_SQL);
    console.log('✅ Migration 015 appliquée avec succès.');

    // Vérification
    const check = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'lab_settings'
      ORDER BY ordinal_position;
    `);
    console.log('\n📊 Vérification — colonnes de lab_settings :');
    check.rows.forEach((r) => console.log(`   - ${r.column_name}: ${r.data_type}`));

    console.log('\n🎉 SUCCÈS : Table lab_settings créée.');
  } catch (err) {
    console.error('\n❌ Erreur :', err.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Connexion fermée.');
  }
}

main();
