/**
 * Vérifie les contraintes FK sur cash_registers.responsible_user_id
 */
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query(`
      SELECT conname, conrelid::regclass AS table_from, confrelid::regclass AS table_to,
             pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE contype = 'f'
        AND (conrelid::regclass::text = 'cash_registers' OR confrelid::regclass::text = 'cash_registers');
    `);
    console.log(`📋 Contraintes FK sur cash_registers : ${result.rows.length}`);
    for (const row of result.rows) {
      console.log(`   - ${row.conname}: ${row.table_from} → ${row.table_to}`);
      console.log(`     ${row.definition}`);
    }
  } catch (err) {
    console.error('Erreur:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}
main();
