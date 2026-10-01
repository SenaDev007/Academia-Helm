// T59b — recrée un membre QA éphémère pour le test navigateur du login patché, puis le supprime.
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
const NEON = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const NAT_TENANT = '97c57b3c-8d92-4d3f-b1c8-76c2f9c1c9ac';
const NAT_PATRONAT = '62df0f31-94bc-4260-886d-d7ee255d964f';
const EMAIL = `qa.t59b.${Date.now().toString(36)}@academiahelm.test`;
const PASSWORD = 'T59bQa#2026Login';
const pool = new pg.Pool({ connectionString: NEON, ssl: { rejectUnauthorized: false }, max: 1 });
const c = await pool.connect();
try {
  if (process.argv[2] === 'CLEANUP') {
    const r = await c.query(`SELECT id FROM users WHERE email LIKE 'qa.t59b.%'`);
    const ids = r.rows.map((x) => x.id);
    if (ids.length) {
      await c.query('BEGIN');
      await c.query(`DELETE FROM sessions WHERE "userId" = ANY($1)`, [ids]);
      await c.query(`DELETE FROM patronat_users WHERE "userId" = ANY($1)`, [ids]);
      await c.query(`DELETE FROM users WHERE id = ANY($1)`, [ids]);
      await c.query('COMMIT');
      console.log(`🗑 nettoyé: ${ids.length} user(s) t59b`);
    } else console.log('rien à nettoyer');
  } else {
    const userId = randomUUID();
    const hash = await bcrypt.hash(PASSWORD, 10);
    await c.query(`INSERT INTO users (id, "tenantId", email, "passwordHash", "firstName", "lastName", role, status, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, 'QA', 'T59b BrowserTest', 'PATRONAT_COORDONNATEUR', 'active', NOW(), NOW())`,
      [userId, NAT_TENANT, EMAIL, hash]);
    await c.query(`INSERT INTO patronat_users (id, "patronatId", "tenantId", "userId", role, "isActive", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, 'COORDONNATEUR', true, NOW(), NOW())`,
      [randomUUID(), NAT_PATRONAT, NAT_TENANT, userId]);
    console.log(`✅ ${EMAIL} / ${PASSWORD} / user=${userId}`);
  }
} finally { c.release(); }
await pool.end();
