const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('🧹 Deleting ALL shop data from Neon DB...\n');

  // Delete in correct order (FK constraints)
  const tables = [
    'shop_wallet_transactions',
    'shop_loyalty_cards',
    'shop_deliveries',
    'shop_returns',
    'shop_school_kit_items',
    'shop_school_kits',
    'shop_purchase_order_items',
    'shop_purchase_orders',
    'shop_order_items',
    'shop_orders',
    'shop_sale_items',
    'shop_sales',
    'shop_stock_movements',
    'shop_stocks',
    'shop_products',
    'shop_categories',
    'shop_suppliers',
    'shop_discounts',
    'shop_settings',
  ];

  for (const table of tables) {
    try {
      const res = await client.query(`DELETE FROM "${table}"`);
      console.log(`  ${table}: ${res.rowCount} rows deleted`);
    } catch (e) {
      console.log(`  ${table}: ${e.message} (may not exist yet)`);
    }
  }

  console.log('\n✅ All shop data deleted. Ready for fresh testing.');
  await client.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
