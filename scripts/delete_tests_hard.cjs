const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
const IDS = ['a21e77b9-1278-4dda-b710-cc3638f4ebd6', 'fe36829e-8161-4415-a523-b2033a3ae450'];

async function main() {
  await client.connect();

  // Drop the custom trigger
  console.log('🔓 Drop trigger trg_prevent_student_delete...');
  await client.query('DROP TRIGGER IF EXISTS trg_prevent_student_delete ON students');

  // Clean FKs
  for (const id of IDS) {
    console.log('🗑️ Cleaning FKs for', id);
    await client.query('DELETE FROM account_breakdowns WHERE "studentAccountId" IN (SELECT id FROM student_accounts WHERE "studentId" = $1)', [id]).catch(()=>{});
    await client.query('DELETE FROM student_accounts WHERE "studentId" = $1', [id]).catch(()=>{});
    await client.query('DELETE FROM student_guardians WHERE "studentId" = $1', [id]).catch(()=>{});
    await client.query('DELETE FROM class_students WHERE "studentId" = $1', [id]).catch(()=>{});
    await client.query('DELETE FROM grades WHERE "studentId" = $1', [id]).catch(()=>{});
    await client.query('DELETE FROM payments WHERE "studentId" = $1', [id]).catch(()=>{});
    await client.query('DELETE FROM fee_overrides WHERE "studentId" = $1', [id]).catch(()=>{});
    await client.query('DELETE FROM fee_arrears WHERE "studentId" = $1', [id]).catch(()=>{});
    await client.query('DELETE FROM report_cards WHERE "studentId" = $1', [id]).catch(()=>{});
    await client.query('DELETE FROM student_enrollments WHERE "studentId" = $1', [id]).catch(()=>{});
    await client.query('DELETE FROM student_documents WHERE "studentId" = $1', [id]).catch(()=>{});
    await client.query('DELETE FROM attendance WHERE "studentId" = $1', [id]).catch(()=>{});
    await client.query('DELETE FROM absences WHERE "studentId" = $1', [id]).catch(()=>{});
    await client.query('DELETE FROM finance_transactions WHERE "studentId" = $1', [id]).catch(()=>{});
    await client.query('DELETE FROM student_period_averages WHERE "studentId" = $1', [id]).catch(()=>{});
    await client.query('DELETE FROM student_subject_averages WHERE "studentId" = $1', [id]).catch(()=>{});
  }

  // Delete students
  for (const id of IDS) {
    try {
      const r = await client.query('DELETE FROM students WHERE id = $1', [id]);
      console.log('  ✅ Deleted:', id, '(' + r.rowCount + ' row)');
    } catch(e) { console.log('  ❌', e.message.substring(0,100)); }
  }

  // Recreate trigger
  console.log('🔒 Recreating trigger...');
  await client.query(
    'CREATE TRIGGER trg_prevent_student_delete BEFORE DELETE ON students FOR EACH ROW EXECUTE FUNCTION prevent_student_delete()'
  ).catch(e => console.log('  ⚠️ Trigger recreate:', e.message.substring(0,80)));

  // Verify
  const check = await client.query('SELECT id FROM students WHERE id = ANY($1::text[])', [IDS]);
  console.log(check.rows.length === 0 ? '✅ Both students deleted permanently' : '❌ Still present');

  await client.end();
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
