/**
 * ============================================================================
 * CRÉATION TABLE cash_register_transfers + cash_register_transactions
 * ============================================================================
 *
 * Problème :
 * - finance_transactions a studentAccountId NOT NULL → inutilisable pour les
 *   transferts inter-caisses (pas d'élève impliqué)
 * - Le service transfer() utilise transactionType (champ inexistant) → erreur
 *   silencieuse → aucun audit → stats à 0
 *
 * Solution :
 * 1. Créer cash_register_transfers (from, to, amount, note, reference, userId)
 * 2. Créer cash_register_transactions (historique global : transferts,
 *    ouvertures, fermetures, ajustements manuels)
 * 3. Le service transfer() insère dans cash_register_transfers au lieu de
 *    finance_transactions
 * 4. getStats() lit depuis cash_register_transfers + finance_transactions
 *    (pour les encaissements liés aux élèves)
 *
 * ============================================================================
 */

const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const MIGRATION_SQL = `
-- 1. Table des transferts inter-caisses
CREATE TABLE IF NOT EXISTS "cash_register_transfers" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "fromCashRegisterId" TEXT NOT NULL,
  "toCashRegisterId" TEXT NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "note" TEXT,
  "reference" TEXT,
  "userId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_register_transfers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "cash_register_transfers_from_fkey" FOREIGN KEY ("fromCashRegisterId") REFERENCES "cash_registers"("id"),
  CONSTRAINT "cash_register_transfers_to_fkey" FOREIGN KEY ("toCashRegisterId") REFERENCES "cash_registers"("id")
);
CREATE INDEX IF NOT EXISTS "cash_register_transfers_tenantId_idx" ON "cash_register_transfers"("tenantId");
CREATE INDEX IF NOT EXISTS "cash_register_transfers_from_idx" ON "cash_register_transfers"("fromCashRegisterId");
CREATE INDEX IF NOT EXISTS "cash_register_transfers_to_idx" ON "cash_register_transfers"("toCashRegisterId");
CREATE INDEX IF NOT EXISTS "cash_register_transfers_createdAt_idx" ON "cash_register_transfers"("createdAt");

-- 2. Table des transactions de caisse (historique global)
CREATE TABLE IF NOT EXISTS "cash_register_transactions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "cashRegisterId" TEXT NOT NULL,
  "transactionType" TEXT NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "direction" TEXT NOT NULL DEFAULT 'NEUTRAL',
  "note" TEXT,
  "reference" TEXT,
  "userId" TEXT,
  "relatedTransferId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_register_transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "cash_register_transactions_cashRegister_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "cash_registers"("id")
);
CREATE INDEX IF NOT EXISTS "cash_register_transactions_tenantId_idx" ON "cash_register_transactions"("tenantId");
CREATE INDEX IF NOT EXISTS "cash_register_transactions_cashRegisterId_idx" ON "cash_register_transactions"("cashRegisterId");
CREATE INDEX IF NOT EXISTS "cash_register_transactions_createdAt_idx" ON "cash_register_transactions"("createdAt");
CREATE INDEX IF NOT EXISTS "cash_register_transactions_type_idx" ON "cash_register_transactions"("transactionType");

-- 3. Vérification
SELECT 'cash_register_transfers' AS table_name, COUNT(*) AS col_count
FROM information_schema.columns WHERE table_name = 'cash_register_transfers'
UNION ALL
SELECT 'cash_register_transactions', COUNT(*)
FROM information_schema.columns WHERE table_name = 'cash_register_transactions';
`;

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    console.log('🔗 Connexion à Neon...');
    await client.connect();
    console.log('✅ Connecté\n');

    console.log('🔧 Création des tables cash_register_transfers + cash_register_transactions...');
    const result = await client.query(MIGRATION_SQL);
    console.log('✅ Tables créées\n');

    const lastResult = result[result.length - 1];
    if (lastResult && lastResult.rows) {
      for (const row of lastResult.rows) {
        console.log(`  ${row.table_name}: ${row.col_count} colonnes`);
      }
    }
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
