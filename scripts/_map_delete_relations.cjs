/**
 * Cartographie exhaustive : toutes les colonnes liées aux 4 personnels cibles
 * (staff / teachers / users par id ou email) dans TOUTES les tables de la DB prod.
 */
const pg = require('pg');

const c = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

const STAFF_IDS = [
  'bb5cc801-3d6a-4f17-bf41-9af423dc95f4', // Sophie TEST
  '95dd51f7-2486-4d8b-98d1-f3b42533d113', // Fatou TEST
  '661be553-7857-40b3-914d-9ea96ae88fe5', // Léontine DEVO
  'e105c303-eb89-4d11-b348-5f18c9130b3b', // Jean-Baptiste ADJOVI
];
const EMAILS = [
  'recette.sophie@cspeb.test',
  'recette.doublecasquette@cspeb.test',
  'senakpondawes@spacegeneration.org',
  'recette.directeur-fr@cspeb.test',
];

(async () => {
  await c.connect();

  // 1. Tous les IDs liés (staff, teachers, users)
  const staff = await c.query(`SELECT id, email FROM staff WHERE id::text = ANY($1::text[])`, [STAFF_IDS]);
  const teachers = await c.query(`SELECT id, email FROM teachers WHERE email::text = ANY($1::text[])`, [EMAILS]);
  const users = await c.query(`SELECT id, email FROM users WHERE email::text = ANY($1::text[])`, [EMAILS]);
  const staffIds = staff.rows.map(r => r.id);
  const teacherIds = teachers.rows.map(r => r.id);
  const userIds = users.rows.map(r => r.id);
  console.log('staffIds:', staffIds.length, '| teacherIds:', teacherIds.length, '| userIds:', userIds.length);

  // 2. Toutes les tables avec colonne staffId / teacherId / userId / email
  const cols = await c.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('staffId','teacherId','userId','email','staff_id','teacher_id','user_id')
    ORDER BY table_name
  `);

  const hits = [];
  for (const col of cols.rows) {
    const { table_name: t, column_name: cn } = col;
    let q, params;
    if (cn === 'staffId' || cn === 'staff_id') {
      q = `SELECT count(*)::int AS n FROM "${t}" WHERE "${cn}"::text = ANY($1::text[])`;
      params = [STAFF_IDS];
    } else if (cn === 'teacherId' || cn === 'teacher_id') {
      q = `SELECT count(*)::int AS n FROM "${t}" WHERE "${cn}"::text = ANY($1::text[])`;
      params = [teacherIds.length ? teacherIds : ['__none__']];
    } else if (cn === 'userId' || cn === 'user_id') {
      q = `SELECT count(*)::int AS n FROM "${t}" WHERE "${cn}"::text = ANY($1::text[])`;
      params = [userIds.length ? userIds : ['__none__']];
    } else { // email
      q = `SELECT count(*)::int AS n FROM "${t}" WHERE lower("${cn}"::text) = ANY($1)`;
      params = [EMAILS.map(e => e.toLowerCase())];
    }
    try {
      const r = await c.query(q, params);
      if (r.rows[0].n > 0) hits.push({ table: t, col: cn, n: r.rows[0].n });
    } catch (e) {
      console.log(`  ! ${t}.${cn} : ${e.message}`);
    }
  }

  console.log('\n=== Lignes à supprimer ===');
  hits.forEach(h => console.log(`  ${h.table}.${h.col} : ${h.n}`));

  // 3. Tables de recrutement RH potentielles (candidatures)
  const recTables = ['hr_applications', 'applications', 'job_applications', 'recruitment_applications',
                     'staff_credentials', 'access_requests', 'hr_contracts'];
  for (const t of recTables) {
    const ex = await c.query(`SELECT to_regclass($1) AS t`, [`public.${t}`]);
    if (ex.rows[0].t) {
      const r = await c.query(`SELECT count(*)::int AS n FROM "${t}"`);
      console.log(`  (table ${t} existe — ${r.rows[0].n} lignes au total)`);
    }
  }

  await c.end();
})().catch(e => { console.error('ERREUR:', e.message); process.exit(1); });
