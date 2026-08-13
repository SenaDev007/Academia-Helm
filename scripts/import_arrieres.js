/**
 * Import des arriérés depuis les fichiers Excel vers student_arrears + fee_arrears
 * + mise à jour des StudentAccounts.arrearsAmount
 */
const { Client } = require('pg');
const XLSX = require('xlsx');
const crypto = require('crypto');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const FILES = [
  '/home/z/my-project/upload/POINT PRIMAIRE 2025-2026.xlsx',
  '/home/z/my-project/upload/POINT SECONDAIRE  2025-2026.xlsx',
];

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected');

  // Drop trigger
  await client.query('DROP TRIGGER IF EXISTS prevent_balance_update_trigger ON student_accounts');

  const tenantId = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
  const yearId = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

  // Students
  const students = (await client.query('SELECT id, "firstName", "lastName" FROM students WHERE "tenantId"=$1 AND status!=\'WITHDRAWN\'', [tenantId])).rows;
  const byName = new Map();
  for (const s of students) {
    byName.set((s.lastName + ' ' + s.firstName).trim().toLowerCase().replace(/\s+/g, ' '), s);
    byName.set((s.lastName || '').trim().toLowerCase(), s);
  }

  // Accounts
  const accs = (await client.query('SELECT id, "studentId" FROM student_accounts WHERE "tenantId"=$1 AND "academicYearId"=$2', [tenantId, yearId])).rows;
  const accByStud = new Map(accs.map(r => [r.studentId, r.id]));

  let imported = 0, notFound = 0, skipped = 0;

  for (const f of FILES) {
    console.log('\n📄', f.split('/').pop());
    const wb = XLSX.readFile(f);

    for (const sn of wb.SheetNames) {
      if (sn === 'RECAP') continue;
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true });
      if (rows.length < 5) continue;

      let hr = 3;
      for (let i = 0; i < Math.min(8, rows.length); i++) {
        if (rows[i] && rows[i].some(c => String(c || '').toUpperCase().includes('NOM') && String(c || '').toUpperCase().includes('PRENOM'))) {
          hr = i; break;
        }
      }
      const header = rows[hr] || [];
      let nc = 1, ac = -1;
      for (let j = 0; j < header.length; j++) {
        const h = String(header[j] || '').toUpperCase();
        if (h.includes('NOM')) nc = j;
        if (h.includes('ARRI')) ac = j;
      }
      if (ac === -1) { console.log('  ⚠️', sn, '- no Arriéré column'); continue; }

      for (let ri = hr + 2; ri < rows.length; ri++) {
        const row = rows[ri];
        if (!row || !row[nc]) continue;
        const rawName = String(row[nc]).trim();
        if (!rawName || rawName.toUpperCase().includes('TOTAL') || /^\d+$/.test(rawName)) continue;

        const arriereAmount = Number(row[ac]) || 0;
        if (arriereAmount <= 0) { skipped++; continue; }

        const nm = rawName.toLowerCase().replace(/\s+/g, ' ').trim();
        let st = byName.get(nm);
        if (!st) {
          const ps = nm.split(' ').filter(p => p.length > 2);
          for (const p of ps) { if (byName.has(p)) { st = byName.get(p); break; } }
        }
        if (!st) { notFound++; continue; }

        const aid = accByStud.get(st.id);
        if (!aid) { skipped++; continue; }

        // 1. Créer un student_arrear
        const saId = crypto.randomUUID();
        await client.query(`
          INSERT INTO student_arrears (id, "tenantId", "studentId", "fromAcademicYearId", "toAcademicYearId", "amountDue", "amountPaid", "balanceDue", status, "generatedAt", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $4, $5, 0, $5, 'OPEN', now(), now(), now())
          ON CONFLICT DO NOTHING
        `, [saId, tenantId, st.id, yearId, arriereAmount]);

        // 2. Créer un fee_arrear
        const faId = crypto.randomUUID();
        await client.query(`
          INSERT INTO fee_arrears (id, "tenantId", "academicYearId", "studentId", "totalDue", "totalPaid", "balanceDue", "arrearsLevel", status, "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, 0, $5, 'PRIOR_YEAR', 'OPEN', now(), now())
          ON CONFLICT DO NOTHING
        `, [faId, tenantId, yearId, st.id, arriereAmount]);

        // 3. Mettre à jour le StudentAccount
        await client.query(`
          UPDATE student_accounts
          SET "arrearsAmount" = "arrearsAmount" + $1,
              "totalDue" = "totalDue" + $1,
              "balance" = "balance" + $1,
              "updatedAt" = now()
          WHERE id = $2
        `, [arriereAmount, aid]);

        imported++;
        console.log(`  ✅ ${rawName}: ${arriereAmount} FCFA d'arriéré`);
      }
    }
  }

  // Recreate trigger
  await client.query('DROP TRIGGER IF EXISTS prevent_balance_update_trigger ON student_accounts');
  // Note: CREATE TRIGGER IF NOT EXISTS n'existe pas en PostgreSQL, on vérifie d'abord
  const tgExists = await client.query("SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='prevent_balance_update_trigger')");
  if (!tgExists.rows[0].exists) {
    await client.query('CREATE TRIGGER prevent_balance_update_trigger BEFORE UPDATE OF "totalPaid", "balance" ON student_accounts FOR EACH ROW EXECUTE FUNCTION prevent_balance_update()');
  }
  console.log('\n✅ Trigger recreated');

  // Verify
  const saCount = await client.query('SELECT COUNT(*) as c FROM student_arrears WHERE "tenantId"=$1', [tenantId]);
  const faCount = await client.query('SELECT COUNT(*) as c FROM fee_arrears WHERE "tenantId"=$1', [tenantId]);
  const totalArriere = await client.query('SELECT SUM("arrearsAmount") as total FROM student_accounts WHERE "tenantId"=$1 AND "academicYearId"=$2', [tenantId, yearId]);

  console.log('\n======== RÉSUMÉ ========');
  console.log('✅ Arriérés créés:', imported);
  console.log('⏭️ Skippés (montant=0 ou pas de compte):', skipped);
  console.log('❌ Non trouvés:', notFound);
  console.log('student_arrears:', saCount.rows[0].c);
  console.log('fee_arrears:', faCount.rows[0].c);
  console.log('Total arrearsAmount dans student_accounts:', totalArriere.rows[0].total);

  await client.end();
  console.log('🔌 Done');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
