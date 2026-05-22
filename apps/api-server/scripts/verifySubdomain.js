const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:SenaDev007@localhost:5432/academia_hub_db' 
});

async function main() {
  try {
    const res = await pool.query('SELECT subdomain FROM tenants WHERE slug = $1', ['default-tenant']);
    console.log('Subdomain for default-tenant:', res.rows[0]?.subdomain);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
