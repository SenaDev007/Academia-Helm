const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:SenaDev007@localhost:5432/academia_hub_db' 
});

async function main() {
  try {
    const res = await pool.query('DELETE FROM tenants WHERE slug = $1', ['yehi-or-tech']);
    console.log('Deleted rows:', res.rowCount);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
