/** Sonde TOUTES les FK (users/staff/teachers) contre les IDs cibles. */
const pg = require('pg');

const STAFF_IDS = [
  'bb5cc801-3d6a-4f17-bf41-9af423dc95f4', // Sophie TEST
  '95dd51f7-2486-4d8b-98d1-f3b42533d113', // Fatou TEST
  '661be553-7857-40b3-914d-9ea96ae88fe5', // Léontine DEVO
  'e105c303-eb89-4d11-b348-5f18c9130b3b', // Jean-Baptiste ADJOVI
];
const EMAILS = ['recette.sophie@cspeb.test','recette.doublecasquette@cspeb.test','senakpondawes@spacegeneration.org','recette.directeur-fr@cspeb.test'];

async function connectWithRetry() {
  for (let i = 0; i < 6; i++) {
    const c = new pg.Client({
      connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
      ssl: { rejectUnauthorized: false },
    });
    try { await c.connect(); return c; } catch (e) {
      await c.end().catch(() => {});
      await new Promise(r => setTimeout(r, 4000 + i * 3000));
    }
  }
  throw new Error('Impossible de se connecter');
}

(async () => {
  const c = await connectWithRetry();

  // IDs liés
  const teachers = (await c.query('SELECT id FROM teachers WHERE email::text = ANY($1::text[])', [EMAILS])).rows.map(r => r.id);
  const users = (await c.query('SELECT id FROM users WHERE email::text = ANY($1::text[])', [EMAILS])).rows.map(r => r.id);
  const idsets = { staff: STAFF_IDS, teachers, users };

  const fk = await c.query(`
    SELECT tc.table_name, kcu.column_name, rc.delete_rule, ccu.table_name AS ref_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name IN ('staff','teachers','users')
    ORDER BY ccu.table_name, tc.table_name`);
  console.log(`Total FK vers staff/teachers/users : ${fk.rows.length}\n`);

  const blocking = [];
  for (const r of fk.rows) {
    const ids = idsets[r.ref_table];
    if (!ids || ids.length === 0) continue;
    try {
      const q = await c.query(`SELECT count(*)::int AS n FROM "${r.table_name}" WHERE "${r.column_name}"::text = ANY($1::text[])`, [ids]);
      if (q.rows[0].n > 0) {
        console.log(`  ${r.ref_table} <- ${r.table_name}.${r.column_name} [${r.delete_rule}] : ${q.rows[0].n} ligne(s)`);
        if (r.delete_rule === 'RESTRICT' || r.delete_rule === 'NO ACTION') blocking.push(r);
      }
    } catch (e) { /* cast impossible */ }
  }

  // Email scan complémentaire (colonnes email de toutes les tables)
  const cols = await c.query(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema='public' AND column_name ILIKE '%email%'`);
  console.log('\nScan colonnes email :');
  for (const col of cols.rows) {
    try {
      const q = await c.query(`SELECT count(*)::int AS n FROM "${col.table_name}" WHERE lower("${col.column_name}"::text) = ANY($1)`, [EMAILS.map(e => e.toLowerCase())]);
      if (q.rows[0].n > 0) console.log(`  ${col.table_name}.${col.column_name} : ${q.rows[0].n}`);
    } catch (e) { /* non-text */ }
  }

  console.log(`\nFK bloquantes (RESTRICT/NO ACTION avec lignes) : ${blocking.length}`);
  blocking.forEach(b => console.log(`  !! ${b.table_name}.${b.column_name} -> ${b.ref_table}`));

  await c.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
