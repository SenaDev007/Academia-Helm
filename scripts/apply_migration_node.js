/**
 * Script temporaire pour appliquer la migration create_promoter_payment_eligibility.sql
 * sur Neon via le package pg (Node.js).
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const MIGRATION_FILE = '/home/z/my-project/apps/api-server/prisma/migrations/create_promoter_payment_eligibility.sql';

async function main() {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  console.log('📄 Migration file loaded:', MIGRATION_FILE);
  console.log('📏 Size:', sql.length, 'chars');
  console.log('');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔌 Connecting to Neon...');
    await client.connect();
    console.log('✅ Connected');
    console.log('');

    console.log('🚀 Executing migration...');
    await client.query(sql);
    console.log('✅ Migration applied successfully!');
    console.log('');

    // Vérification
    console.log('🔍 Verification — checking table exists...');
    const res = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'promoter_payment_eligibility'
    `);
    if (res.rows.length > 0) {
      console.log('✅ Table promoter_payment_eligibility exists');
    } else {
      console.log('❌ Table NOT found');
    }

    // Vérifier les index
    const idxRes = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'promoter_payment_eligibility'
    `);
    console.log('📊 Indexes:', idxRes.rows.map(r => r.indexname).join(', '));

    // Vérifier les colonnes
    const colRes = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'promoter_payment_eligibility'
      ORDER BY ordinal_position
    `);
    console.log('📋 Columns:');
    colRes.rows.forEach(r => console.log(`   - ${r.column_name}: ${r.data_type}`));

  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.message.includes('already exists')) {
      console.log('ℹ️  Table already exists — migration is idempotent, this is OK');
    } else {
      process.exit(1);
    }
  } finally {
    await client.end();
    console.log('');
    console.log('🔌 Connection closed');
  }
}

main();
