import pg from 'pg';
const NEON = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const pool = new pg.Pool({ connectionString: NEON, ssl: { rejectUnauthorized: false }, max: 1 });
const c = await pool.connect();
try {
  const n = await c.query(`SELECT count(*)::int n FROM patronats WHERE name ILIKE '%QA%' OR id IN (SELECT "parentPatronatId" FROM patronats WHERE name ILIKE '%QA%')`);
  console.log(`patronats QA restants : ${n.rows[0].n}`);
  const u = await c.query(`SELECT count(*)::int n FROM users WHERE email LIKE '%@academiahelm.test'`);
  console.log(`users de test restants : ${u.rows[0].n}`);
  const ch = await c.query(`SELECT name FROM patronats WHERE "parentPatronatId"='62df0f31-94bc-4260-886d-d7ee255d964f'`);
  console.log(`enfants du national : ${ch.rows.map(r=>r.name).join(', ')}`);
} finally { c.release(); }
await pool.end();
