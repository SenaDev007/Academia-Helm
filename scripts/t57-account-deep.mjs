/**
 * T57 — Compare le compte réel (dawesakpovi, national PESP Bénin)
 * avec un compte frais : rôles, tokens révoqués, index critiques.
 */
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const REAL = '82b262e7-257f-43de-a7a6-e60cfd703056'; // dawesakpovi

// 1. L'utilisateur réel — tout
const u = await client.query('SELECT * FROM users WHERE id = $1', [REAL]);
console.log('=== User dawesakpovi ===');
console.log(JSON.stringify(u.rows[0], null, 1).slice(0, 1500));

// 2. Ses rôles (user_roles / role links)
const roleTables = await client.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_name IN ('user_roles','user_role','role_users','user_permissions','sessions','revoked_tokens')
`);
console.log('\nTables liées:', roleTables.rows.map((r) => r.table_name).join(', '));

for (const t of ['user_roles', 'sessions', 'revoked_tokens']) {
  try {
    const cnt = await client.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
    console.log(`${t}: ${cnt.rows[0].n} lignes`);
    if (t === 'user_roles') {
      const mine = await client.query(
        `SELECT * FROM user_roles WHERE user_id = $1 OR "userId" = $1`,
        [REAL],
      );
      console.log('  rôles de dawesakpovi:', JSON.stringify(mine.rows).slice(0, 500));
    }
    if (t === 'sessions') {
      const mine = await client.query(
        `SELECT * FROM sessions WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 5`,
        [REAL],
      );
      console.log('  sessions récentes:', JSON.stringify(mine.rows.map((s) => ({
        id: s.id, createdAt: s.createdAt, expiresAt: s.expiresAt, revoked: s.revoked, ip: s.ipAddress, ua: (s.userAgent||'').slice(0,60)
      })), null, 1));
    }
    const idx = await client.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1`,
      [t],
    );
    console.log('  index:', idx.rows.map((r) => r.indexname).join(', ') || 'AUCUN');
  } catch (e) {
    console.log(`${t}: ERREUR ${e.message.slice(0, 100)}`);
  }
}

// 3. Sessions révoquées récemment ? Tokens révoqués pour ce user
try {
  const revoked = await client.query(
    `SELECT * FROM revoked_tokens ORDER BY "createdAt" DESC LIMIT 5`,
  );
  console.log('\nDerniers revoked_tokens:', JSON.stringify(revoked.rows.map((r) => ({
    token: (r.token || '').slice(-20), createdAt: r.createdAt, userId: r.userId
  })), null, 1));
} catch (e) {
  console.log('revoked_tokens:', e.message.slice(0, 120));
}

// 4. findOneWithRoles — que charge-t-il ? (user + roles + permissions)
const ucols = await client.query(`
  SELECT column_name FROM information_schema.columns WHERE table_name='users'
`);
console.log('\nColonnes users:', ucols.rows.map((r) => r.column_name).join(', '));

// 5. Tentatives de login récentes / statut du compte
const audit = await client.query(`
  SELECT action, "createdAt", "newData"::text FROM audit_logs
  WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 10
`, [REAL]);
console.log('\n=== Audit récent dawesakpovi ===');
for (const a of audit.rows) console.log(`${a.createdAt.toISOString()} ${a.action} ${(a.newData||'').slice(0,120)}`);

await client.end();
