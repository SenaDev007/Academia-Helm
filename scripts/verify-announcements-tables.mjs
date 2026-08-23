import { Pool } from 'pg';
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

const r = await pool.query(`
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_name IN ('chat_announcements', 'chat_announcement_reads')
  ORDER BY table_name, ordinal_position
`);
console.log('⭐ Helm Connect announcements tables:');
for (const row of r.rows) console.log(`  ${row.table_name}.${row.column_name} = ${row.data_type}`);

await pool.end();
