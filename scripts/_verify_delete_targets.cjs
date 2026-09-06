/** Vérification pré-suppression : contrats, candidature, affectations (avec retry). */
const pg = require('pg');

const STAFF_IDS = [
  'bb5cc801-3d6a-4f17-bf41-9af423dc95f4', // Sophie TEST
  '95dd51f7-2486-4d8b-98d1-f3b42533d113', // Fatou TEST
  '661be553-7857-40b3-914d-9ea96ae88fe5', // Léontine DEVO
  'e105c303-eb89-4d11-b348-5f18c9130b3b', // Jean-Baptiste ADJOVI
];

async function connectWithRetry() {
  for (let i = 0; i < 5; i++) {
    const c = new pg.Client({
      connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
      ssl: { rejectUnauthorized: false },
    });
    try {
      await c.connect();
      return c;
    } catch (e) {
      console.log(`  (connexion tentative ${i + 1} échouée: ${e.message.split('\n')[0]} — retry)`);
      await c.end().catch(() => {});
      await new Promise(r => setTimeout(r, 4000 + i * 3000));
    }
  }
  throw new Error('Impossible de se connecter après 5 tentatives');
}

(async () => {
  const c = await connectWithRetry();

  const ec = await c.query('SELECT id, "staffId", "contractType", status FROM employment_contracts WHERE "staffId"::text = ANY($1::text[])', [STAFF_IDS]);
  console.log('employment_contracts:', JSON.stringify(ec.rows, null, 1));

  const ha = await c.query('SELECT * FROM hr_applications');
  if (ha.rows[0]) {
    console.log('hr_applications cols:', Object.keys(ha.rows[0]).join(', '));
    console.log('hr_applications:', JSON.stringify(ha.rows, null, 1).slice(0, 900));
  } else {
    console.log('hr_applications: vide');
  }

  const sa = await c.query('SELECT id, "staffId", "adminRole", "isActive" FROM staff_admin_assignments WHERE "staffId"::text = ANY($1::text[])', [STAFF_IDS]);
  console.log('staff_admin_assignments:', JSON.stringify(sa.rows, null, 1));

  const fk = await c.query(`
    SELECT tc.table_name, kcu.column_name, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name IN ('staff','teachers','users')
    ORDER BY tc.table_name`);
  console.log('\nFK vers staff/teachers/users (règles):');
  fk.rows.forEach(r => console.log(`  ${r.table_name}.${r.column_name} -> ${r.delete_rule}`));

  await c.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
