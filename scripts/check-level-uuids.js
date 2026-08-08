const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const TENANT = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';

  // 1. Classes
  console.log('=== Classes for CSPEB ===');
  const classes = await db.query(`
    SELECT c.id, c.name, c."schoolLevelId", sl.code as level_code
    FROM classes c
    LEFT JOIN school_levels sl ON sl.id = c."schoolLevelId"
    WHERE c."tenantId" = $1
    ORDER BY c.name
  `, [TENANT]);
  classes.rows.forEach(c => {
    console.log(`  ${c.name} | schoolLevelId=${c.schoolLevelId?.substring(0,8)} | code=${c.level_code}`);
  });

  // 2. school_levels
  console.log('\n=== school_levels ===');
  const sl = await db.query('SELECT id, code, name FROM school_levels WHERE "tenantId" = $1', [TENANT]);
  sl.rows.forEach(l => console.log(`  ${l.code} | id=${l.id.substring(0,8)} | name=${l.name}`));

  // 3. education_levels
  console.log('\n=== education_levels ===');
  const el = await db.query('SELECT id, code, name FROM education_levels WHERE "tenantId" = $1', [TENANT]);
  el.rows.forEach(l => console.log(`  ${l.code} | id=${l.id.substring(0,8)} | name=${l.name}`));

  // 4. Check evaluations for MATERNELLE
  const maternelleLevel = sl.rows.find(l => l.code === 'MATERNELLE');
  if (maternelleLevel) {
    console.log(`\n=== Evaluations for MATERNELLE (schoolLevelId=${maternelleLevel.id.substring(0,8)}) ===`);
    const evals = await db.query(`
      SELECT e.title, e.status, c.name as className
      FROM evaluations e
      INNER JOIN classes c ON c.id = e."classId"
      WHERE e."tenantId" = $1 AND c."schoolLevelId" = $2
      LIMIT 20
    `, [TENANT, maternelleLevel.id]);
    console.log(`Found: ${evals.rows.length} evaluations`);
    evals.rows.forEach(e => console.log(`  ${e.title} | status=${e.status} | class=${e.className}`));
  }

  // 5. PRIMAIRE
  const primaireLevel = sl.rows.find(l => l.code === 'PRIMAIRE');
  if (primaireLevel) {
    console.log(`\n=== Evaluations for PRIMAIRE (schoolLevelId=${primaireLevel.id.substring(0,8)}) ===`);
    const evals = await db.query(`
      SELECT e.title, e.status, c.name as className
      FROM evaluations e
      INNER JOIN classes c ON c.id = e."classId"
      WHERE e."tenantId" = $1 AND c."schoolLevelId" = $2
      LIMIT 20
    `, [TENANT, primaireLevel.id]);
    console.log(`Found: ${evals.rows.length} evaluations`);
    evals.rows.forEach(e => console.log(`  ${e.title} | status=${e.status} | class=${e.className}`));
  }

  // 6. Cross-check UUIDs
  const elMaternelle = el.rows.find(l => l.code === 'MATERNELLE');
  if (elMaternelle && maternelleLevel) {
    console.log('\n=== Cross-check UUIDs ===');
    console.log(`education_levels MATERNELLE id: ${elMaternelle.id.substring(0,8)}`);
    console.log(`school_levels MATERNELLE id: ${maternelleLevel.id.substring(0,8)}`);
    console.log(`Same? ${elMaternelle.id === maternelleLevel.id ? 'YES' : 'NO (different!)'}`);

    const matchSL = await db.query('SELECT COUNT(*)::int as c FROM classes WHERE "schoolLevelId" = $1', [maternelleLevel.id]);
    const matchEL = await db.query('SELECT COUNT(*)::int as c FROM classes WHERE "schoolLevelId" = $1', [elMaternelle.id]);
    console.log(`Classes matching school_levels.id: ${matchSL.rows[0].c}`);
    console.log(`Classes matching education_levels.id: ${matchEL.rows[0].c}`);
  }

  await db.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
