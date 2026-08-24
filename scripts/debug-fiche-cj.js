const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require' });

async function main() {
  await client.connect();

  // 1. Vérifier la fiche DRAFT
  const fiche = await client.query('SELECT id, "classId", "teacherId", "cahierJournalId", "sheetType", "lessonDate", "adminDate", status FROM "primary_pedagogical_fiches" WHERE status = \'DRAFT\'');
  console.log('Fiches DRAFT:', fiche.rows.length);
  for (const f of fiche.rows) {
    console.log('  Fiche:', f.id.substring(0, 8));
    console.log('    classId:', f.classId);
    console.log('    teacherId:', f.teacherId);
    console.log('    cahierJournalId:', f.cahierJournalId);
    console.log('    sheetType:', f.sheetType);
    console.log('    lessonDate:', f.lessonDate);
    console.log('    adminDate:', f.adminDate);

    // 2. Vérifier le cahier journal lié
    if (f.cahierJournalId) {
      const cj = await client.query('SELECT id, "classId", "teacherId", status, "weekStartDate", "weekEndDate" FROM "cahier_journal_entries" WHERE id = $1', [f.cahierJournalId]);
      if (cj.rows.length > 0) {
        const c = cj.rows[0];
        console.log('  Cahier journal lié:', c.id.substring(0, 8));
        console.log('    classId:', c.classid);
        console.log('    teacherId:', c.teacherid);
        console.log('    status:', c.status);
        console.log('    weekStart:', c.weekstartdate);
        console.log('    weekEnd:', c.weekenddate);
        console.log('    classId match?', c.classid === f.classid);
      }
    }
  }

  // 3. Vérifier tous les cahiers journal pour cette classe
  if (fiche.rows.length > 0) {
    const classId = fiche.rows[0].classid;
    const allCJ = await client.query('SELECT id, "classId", "teacherId", status, "weekStartDate" FROM "cahier_journal_entries" WHERE "classId" = $1 ORDER BY "weekStartDate" DESC', [classId]);
    console.log('\nTous les cahiers journal de cette classe:', allCJ.rows.length);
    for (const c of allCJ.rows) {
      console.log('  -', c.id.substring(0, 8), 'status:', c.status, 'week:', c.weekstartdate, 'teacherId:', c.teacherid?.substring(0, 8));
    }
  }

  await client.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
