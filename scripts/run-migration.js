const { Client } = require('/home/z/my-project/node_modules/pg');
const fs = require('fs');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&connect_timeout=30';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connecté à Neon DB');

  const sql = fs.readFileSync('/home/z/my-project/scripts/create-payment-initiations-table.sql', 'utf8');
  console.log('Exécution du SQL...');
  
  try {
    await client.query(sql);
    console.log('Table payment_initiations créée avec succès');
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('Table déjà existante');
    } else {
      throw err;
    }
  }

  const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'payment_initiations' ORDER BY ordinal_position");
  console.log('\nColonnes:');
  res.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

  await client.end();
}

main().catch(err => {
  console.error('Erreur:', err.message);
  process.exit(1);
});
