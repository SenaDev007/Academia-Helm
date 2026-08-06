const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const TENANT = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';

  // 1. school_levels
  const sl = await db.query('SELECT id, code, name FROM school_levels WHERE "tenantId" = $1', [TENANT]);
  console.log('school_levels:');
  sl.rows.forEach(l => console.log(`  ${l.code} | id=${l.id.substring(0,8)}`));

  // 2. Classes with schoolLevelId
  const classes = await db.query('SELECT id, name, "schoolLevelId", "officialClassId" FROM classes WHERE "tenantId" = $1 ORDER BY name', [TENANT]);
  console.log('\nClasses:');
  classes.rows.forEach(c => {
    console.log(`  ${c.name} | schoolLevelId=${c.schoolLevelId?.substring(0,8)} | officialClassId=${c.officialClassId?.substring(0,8) || 'NULL'}`);
  });

  // 3. Evaluations by class
  const evalByClass = await db.query(`
    SELECT c.name, e.status, COUNT(*) as cnt
    FROM evaluations e
    JOIN classes c ON c.id = e."classId"
    WHERE e."tenantId" = $1
    GROUP BY c.name, e.status
    ORDER BY c.name, e.status
  `, [TENANT]);
  console.log('\nEvaluations by class:');
  evalByClass.rows.forEach(r => console.log(`  ${r.name} | ${r.status} | ${r.cnt}`));

  // 4. Check the schoolLevelId I used in the API test
  console.log('\n=== Cross-check ===');
  console.log('MATERNELLE schoolLevelId:', sl.rows.find(l=>l.code==='MATERNELLE')?.id);
  console.log('PRIMAIRE schoolLevelId:', sl.rows.find(l=>l.code==='PRIMAIRE')?.id);

  // Check if PRIMAIRE evaluations exist but with wrong schoolLevelId
  const primaireClasses = classes.rows.filter(c => c.schoolLevelId === sl.rows.find(l=>l.code==='PRIMAIRE')?.id);
  console.log('\nPRIMAIRE classes:', primaireClasses.map(c=>c.name));

  // Check evaluations for primaire classes
  if (primaireClasses.length > 0) {
    const primaireClassIds = primaireClasses.map(c => c.id);
    const primaireEvals = await db.query(`
      SELECT e.title, e.status, c.name
      FROM evaluations e
      JOIN classes c ON c.id = e."classId"
      WHERE e."tenantId" = $1 AND e."classId" = ANY($2::text[])
      LIMIT 10
    `, [TENANT, primaireClassIds]);
    console.log(`PRIMAIRE evaluations: ${primaireEvals.rows.length}`);
    primaireEvals.rows.forEach(e => console.log(`  ${e.title} | ${e.status} | ${e.name}`));
  }

  await db.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
