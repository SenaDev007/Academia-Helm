const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const TENANT = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
  const CLASS_ID = '2f2b0dd1-e41e-4876-aea5-5750f7e076ef';
  const YEAR = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a';

  // 1. class_subjects columns
  const cols = await db.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'class_subjects' ORDER BY ordinal_position
  `);
  console.log('class_subjects columns:', cols.rows.map(c => c.column_name).join(', '));

  // 2. ClassSubject count by classId
  const cs1 = await db.query(`
    SELECT COUNT(*)::int as c FROM class_subjects
    WHERE "classId" = $1 AND "academicYearId" = $2
  `, [CLASS_ID, YEAR]);
  console.log('ClassSubject by classId:', cs1.rows[0].c);

  // 3. ClassSubject count by academicClassId
  const cs2 = await db.query(`
    SELECT COUNT(*)::int as c FROM class_subjects
    WHERE "academicClassId" = $1 AND "academicYearId" = $2
  `, [CLASS_ID, YEAR]);
  console.log('ClassSubject by academicClassId:', cs2.rows[0].c);

  // 4. All class_subjects for this tenant
  const csAll = await db.query(`
    SELECT COUNT(*)::int as c FROM class_subjects WHERE "tenantId" = $1
  `, [TENANT]);
  console.log('All class_subjects for tenant:', csAll.rows[0].c);

  // 5. SchoolAcademicSettings
  const sas = await db.query(`
    SELECT id, status FROM school_academic_settings
    WHERE "tenantId" = $1 AND "schoolYearId" = $2
  `, [TENANT, YEAR]);
  console.log('\nSchoolAcademicSettings:', sas.rows.length, 'found');
  sas.rows.forEach(s => console.log(`  status=${s.status}`));

  // 6. Check if Prisma model ClassSubject uses classId or academicClassId
  // The Prisma schema shows: classId (deprecated) + academicClassId (production)
  // The averages service uses: where: { classId, tenantId, academicYearId }
  // If class_subjects.classId is NULL and only academicClassId is set, the query returns 0

  // 7. Sample class_subjects
  const sample = await db.query(`
    SELECT * FROM class_subjects WHERE "tenantId" = $1 LIMIT 5
  `, [TENANT]);
  console.log('\nSample class_subjects:');
  sample.rows.forEach(cs => {
    console.log(`  classId=${cs.classId?.substring(0,8) || 'NULL'} | academicClassId=${cs.academicClassId?.substring(0,8) || 'NULL'} | subjectId=${cs.subjectId?.substring(0,8)} | coef=${cs.coefficient}`);
  });

  await db.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
