/**
 * Création des 3 tables manquantes en BDD Neon
 */
const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const SQL_STATEMENTS = [
  // 1. tenant_theme_settings
  `CREATE TABLE IF NOT EXISTS "tenant_theme_settings" (
    "id" TEXT PRIMARY KEY,
    "tenant_id" TEXT NOT NULL UNIQUE,
    "theme_id" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'auto',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_theme_settings_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS "idx_tenant_theme_settings_tenant" ON "tenant_theme_settings" ("tenant_id");`,

  // 2. tenant_block_selections
  `CREATE TABLE IF NOT EXISTS "tenant_block_selections" (
    "id" TEXT PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "color_overrides" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_block_selections_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
    CONSTRAINT "tenant_block_selections_tenant_category_unique"
      UNIQUE ("tenant_id", "category")
  );
  CREATE INDEX IF NOT EXISTS "idx_tenant_block_selections_tenant" ON "tenant_block_selections" ("tenant_id");`,

  // 3. tenant_media
  `CREATE TABLE IF NOT EXISTS "tenant_media" (
    "id" TEXT PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "alt" TEXT,
    "type" TEXT NOT NULL,
    "original_url" TEXT NOT NULL,
    "hd_url" TEXT,
    "thumbnail_url" TEXT,
    "mime_type" TEXT NOT NULL,
    "size" BIGINT NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,
    "folder" TEXT NOT NULL DEFAULT 'general',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "uploaded_by_id" TEXT,
    "usages_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_media_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS "idx_tenant_media_tenant_created" ON "tenant_media" ("tenant_id", "created_at" DESC);
  CREATE INDEX IF NOT EXISTS "idx_tenant_media_tenant_folder" ON "tenant_media" ("tenant_id", "folder");
  CREATE INDEX IF NOT EXISTS "idx_tenant_media_tenant_type" ON "tenant_media" ("tenant_id", "type");`,
];

async function main() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  console.log('Connexion à Neon...');
  try {
    const client = await pool.connect();
    console.log('✓ Connexion réussie\n');

    for (let i = 0; i < SQL_STATEMENTS.length; i++) {
      const tableName = ['tenant_theme_settings', 'tenant_block_selections', 'tenant_media'][i];
      console.log(`Création de ${tableName}...`);
      try {
        await client.query(SQL_STATEMENTS[i]);
        console.log(`✓ ${tableName} créée (ou déjà existante)`);
      } catch (err) {
        console.error(`✗ Erreur sur ${tableName}: ${err.message}`);
      }
    }

    // Vérification finale
    console.log('\n=== Vérification finale ===');
    const tables = ['tenant_theme_settings', 'tenant_block_selections', 'tenant_media'];
    for (const t of tables) {
      const res = await client.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1) AS exists`,
        [t]
      );
      console.log(`${res.rows[0]?.exists ? '✓' : '✗'} ${t}: ${res.rows[0]?.exists ? 'OK' : 'STILL MISSING'}`);
    }

    client.release();
  } catch (err) {
    console.error('Erreur:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
