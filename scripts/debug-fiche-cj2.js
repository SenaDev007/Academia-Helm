const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require' });

async function main() {
  await client.connect();

  // 1. Vérifier le cahier journal lié avec les bonnes colonnes
  const cj = await client.query(`
    SELECT id, "classId", "teacherId", status, "weekStartDate", "weekEndDate", "academicYearId"
    FROM "cahier_journal_entries"
    WHERE id = '28dd34ca-d53d-4ad6-b4cf-ade71a8440be'
  `);
  if (cj.rows.length > 0) {
    const c = cj.rows[0];
    console.log('Cahier journal lié:');
    console.log('  id:', c.id);
    console.log('  classId:', c.classId);
    console.log('  teacherId:', c.teacherId);
    console.log('  status:', c.status);
    console.log('  weekStart:', c.weekStartDate);
    console.log('  weekEnd:', c.weekEndDate);
    console.log('  academicYearId:', c.academicYearId);
  }

  // 2. Vérifier la fiche
  const fiche = await client.query(`
    SELECT id, "classId", "teacherId", "cahierJournalId", "academicYearId", "sheetType", "lessonDate", "adminDate", status
    FROM "primary_pedagogical_fiches"
    WHERE "cahierJournalId" = '28dd34ca-d53d-4ad6-b4cf-ade71a8440be'
  `);
  console.log('\nFiches liées au cahier journal:', fiche.rows.length);
  for (const f of fiche.rows) {
    console.log('  Fiche:', f.id);
    console.log('    classId:', f.classId);
    console.log('    teacherId:', f.teacherId);
    console.log('    academicYearId:', f.academicYearId);
    console.log('    sheetType:', f.sheetType);
    console.log('    lessonDate:', f.lessonDate);
    console.log('    adminDate:', f.adminDate);
    console.log('    status:', f.status);
  }

  // 3. Vérifier tous les cahiers journal de cette classe
  const allCJ = await client.query(`
    SELECT id, "classId", "teacherId", status, "weekStartDate"
    FROM "cahier_journal_entries"
    WHERE "classId" = '2f2b0dd1-e41e-4876-aea5-5750f7e076ef'
    ORDER BY "weekStartDate" DESC
  `);
  console.log('\nTous les cahiers journal de cette classe:', allCJ.rows.length);
  for (const c of allCJ.rows) {
    console.log('  -', c.id.substring(0, 8), 'status:', c.status, 'week:', c.weekStartDate);
  }

  await client.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
