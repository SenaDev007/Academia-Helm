const { Client } = require('/home/z/my-project/node_modules/pg');
const crypto = require('crypto');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&connect_timeout=30';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connecté à Neon DB\n');

  const tenants = await client.query(`
    SELECT DISTINCT "tenantId" FROM finance_transactions
    WHERE "paymentMethod" IN ('FEDAPAY', 'FEEXPAY')
  `);
  console.log(`Tenants avec transactions en ligne: ${tenants.rows.length}`);

  for (const { tenantId } of tenants.rows) {
    console.log(`\n--- Tenant: ${tenantId} ---`);

    let onlineReg = await client.query(
      `SELECT id FROM cash_registers WHERE "tenantId" = $1 AND code = 'ONLINE'`,
      [tenantId]
    );

    let onlineRegisterId;
    if (onlineReg.rows.length === 0) {
      const newId = crypto.randomUUID();
      await client.query(`
        INSERT INTO cash_registers (id, "tenantId", code, name, description, location, "openingBalance", "currentBalance", "isOpen", "isActive", "openedAt", "createdAt", "updatedAt")
        VALUES ($1, $2, 'ONLINE', 'Caisse Paiements en Ligne', 'Caisse virtuelle pour les paiements Fedapay et FeexPay', 'En ligne', 0, 0, true, true, NOW(), NOW(), NOW())
      `, [newId, tenantId]);
      onlineRegisterId = newId;
      console.log(`  ✅ Caisse ONLINE créée: ${onlineRegisterId}`);
    } else {
      onlineRegisterId = onlineReg.rows[0].id;
      console.log(`  ℹ️  Caisse ONLINE existante: ${onlineRegisterId}`);
    }

    const updated = await client.query(`
      UPDATE finance_transactions
      SET "cashRegisterId" = $1
      WHERE "tenantId" = $2
        AND "paymentMethod" IN ('FEDAPAY', 'FEEXPAY')
        AND "cashRegisterId" IS NULL
    `, [onlineRegisterId, tenantId]);
    console.log(`  ✅ ${updated.rowCount} transaction(s) rattachée(s)`);

    const total = await client.query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM finance_transactions
      WHERE "tenantId" = $1 AND "paymentMethod" IN ('FEDAPAY', 'FEEXPAY') AND "cashRegisterId" = $2
    `, [tenantId, onlineRegisterId]);
    const totalAmount = Number(total.rows[0].total);

    await client.query(`UPDATE cash_registers SET "currentBalance" = $1, "updatedAt" = NOW() WHERE id = $2`, [totalAmount, onlineRegisterId]);
    console.log(`  ✅ Solde caisse ONLINE: ${totalAmount} FCFA`);
  }

  console.log('\n✅ Rétrofit terminé');
  await client.end();
}
main().catch(err => { console.error('❌', err.message); process.exit(1); });
