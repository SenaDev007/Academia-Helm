/**
 * T59 — utilitaire : noms exacts des tables référençant patronats/tenants/users
 * (catalogue information_schema.columns — rapide, sans jointure FK lente).
 */
import pg from 'pg';

const NEON =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const pool = new pg.Pool({ connectionString: NEON, ssl: { rejectUnauthorized: false }, max: 1 });
const c = await pool.connect();
try {
  const r1 = await c.query(
    `SELECT table_name FROM information_schema.columns
     WHERE table_schema='public'
       AND column_name IN ('patronatId','parentPatronatId','ownerPatronatId','receiverPatronatId','requesterPatronatId')
     GROUP BY table_name`,
  );
  console.log('TABLES référençant patronats :', r1.rows.map((x) => x.table_name).join(', '));

  const r2 = await c.query(
    `SELECT table_name FROM information_schema.columns
     WHERE table_schema='public' AND column_name='userId' AND table_name IN ('sessions')
     GROUP BY table_name`,
  );
  console.log('sessions.userId :', r2.rows.map((x) => x.table_name).join(', '));

  const r3 = await c.query(
    `SELECT table_name FROM information_schema.columns
     WHERE table_schema='public' AND column_name='tenantId'
       AND table_name IN ('sessions','academic_years','users','patronats')
     GROUP BY table_name`,
  );
  console.log('tenantId dans sessions/years/users/patronats :', r3.rows.map((x) => x.table_name).join(', '));

  // Vérification : la table sessions a-t-elle aussi un tenantId ?
  const r4 = await c.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='sessions'`,
  );
  console.log('colonnes sessions :', r4.rows.map((x) => x.column_name).join(', '));
} finally {
  c.release();
}
await pool.end();
