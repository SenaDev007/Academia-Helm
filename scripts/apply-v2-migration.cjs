const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const fs = require('fs');
const path = require('path');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '../apps/api-server/prisma/migrations/20260901130000_add_v2_features/migration.sql'), 'utf8');
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected to Neon');
  await client.query(sql);
  console.log('✅ V2 migration applied');

  const t1 = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='chat_conversations' AND column_name='inviteToken'`);
  console.log(`✅ chat_conversations.inviteToken: ${t1.rows.length > 0}`);
  const t2 = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_name='chat_scheduled_messages'`);
  console.log(`✅ chat_scheduled_messages table: ${t2.rows.length > 0}`);
  const t3 = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_name='chat_call_history'`);
  console.log(`✅ chat_call_history table: ${t3.rows.length > 0}`);
  await client.end();
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
