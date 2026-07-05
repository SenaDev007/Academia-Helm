/**
 * Identifier quels education_levels et school_levels sont réellement utilisés
 * pour pouvoir supprimer les doublons orphelins
 */
const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // 1. Pour chaque education_level, compter les élèves et classes liés
  console.log('\n=== education_levels avec leur utilisation ===');
  const el = await client.query(`
    SELECT el.id, el.name,
      (SELECT COUNT(*) FROM students s WHERE s."schoolLevelId" = el.id) AS students_count,
      (SELECT COUNT(*) FROM admissions a WHERE a."schoolLevelId" = el.id) AS admissions_count
    FROM education_levels el
    ORDER BY el.name
  `);
  for (const row of el.rows) {
    console.log(`  ${row.name.padEnd(12)} | id=${row.id} | students=${row.students_count} | admissions=${row.admissions_count}`);
  }

  // 2. Pour chaque school_level, compter les classes et élèves liés
  console.log('\n=== school_levels avec leur utilisation ===');
  const sl = await client.query(`
    SELECT sl.id, sl.code, sl.name,
      (SELECT COUNT(*) FROM classes c WHERE c."schoolLevelId" = sl.id) AS classes_count,
      (SELECT COUNT(*) FROM fee_regimes fr WHERE fr."schoolLevelId" = sl.id) AS regimes_count,
      (SELECT COUNT(*) FROM fee_structures fs WHERE fs."levelId" = sl.id) AS structures_count
    FROM school_levels sl
    ORDER BY sl.code
  `);
  for (const row of sl.rows) {
    console.log(`  ${row.code.padEnd(12)} | id=${row.id} | classes=${row.classes_count} | regimes=${row.regimes_count} | structures=${row.structures_count}`);
  }

  // 3. Voir l'élève Akpovi en détail
  console.log('\n=== Élève Akpovi (détails) ===');
  const akpovi = await client.query(`
    SELECT id, "firstName", "lastName", "schoolLevelId", "academicYearId", status, "isActive"
    FROM students
    WHERE "lastName" ILIKE '%Akpovi%' OR "firstName" ILIKE '%Akpovi%'
       OR "lastName" ILIKE '%Beroukhyah%' OR "firstName" ILIKE '%Beroukhyah%'
  `);
  for (const row of akpovi.rows) {
    console.log(`  ${row.firstname} ${row.lastname} | schoolLevelId=${row.schoollevelid} | status=${row.status}`);
  }

  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
