import { Pool } from 'pg';
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

const r = await pool.query(`
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_name IN ('chat_announcements','chat_dynamic_groups','chat_notification_preferences','chat_conversation_mutes')
    AND table_name IN ('chat_dynamic_groups','chat_notification_preferences','chat_conversation_mutes')
  ORDER BY table_name, ordinal_position
`);
console.log('⭐ Helm Connect V2 tables:');
for (const row of r.rows) console.log(`  ${row.table_name}.${row.column_name} = ${row.data_type}`);

const r2 = await pool.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'chat_announcements' AND column_name = 'scheduledAt'
`);
console.log('\n⭐ chat_announcements.scheduledAt:');
for (const row of r2.rows) console.log(`  ${row.column_name} = ${row.data_type}`);

await pool.end();
