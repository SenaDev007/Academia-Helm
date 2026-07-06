/**
 * ============================================================================
 * TABLE tenant_payment_config — Configuration des paiements en ligne par école
 * ============================================================================
 *
 * Chaque école (tenant) configure son PROPRE compte FeexPay ou Fedapay.
 * L'argent va directement sur le compte de l'école, jamais sur le nôtre.
 *
 * ============================================================================
 */

const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS "tenant_payment_config" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'feexpay', -- 'feexpay' | 'fedapay'
  "isActive" BOOLEAN NOT NULL DEFAULT false,

  -- FeexPay
  "feexpayApiKey" TEXT,
  "feexpayShopId" TEXT,
  "feexpaySecretKey" TEXT,

  -- Fedapay (alternative)
  "fedapayPublicKey" TEXT,
  "fedapaySecretKey" TEXT,

  -- Webhook
  "webhookSecret" TEXT,

  -- Métadonnées
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tenant_payment_config_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "tenant_payment_config_tenantId_unique" UNIQUE ("tenantId")
);

CREATE INDEX IF NOT EXISTS "tenant_payment_config_tenantId_idx" ON "tenant_payment_config"("tenantId");

SELECT 'tenant_payment_config' AS table_name, COUNT(*) AS col_count
FROM information_schema.columns WHERE table_name = 'tenant_payment_config';
`;

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    console.log('🔗 Connexion à Neon...');
    await client.connect();
    console.log('✅ Connecté\n');

    console.log('🔧 Création de la table tenant_payment_config...');
    const result = await client.query(MIGRATION_SQL);
    console.log('✅ Table créée\n');

    const lastResult = result[result.length - 1];
    if (lastResult && lastResult.rows) {
      console.log(`📊 Colonnes: ${lastResult.rows[0].col_count}`);
    }
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
