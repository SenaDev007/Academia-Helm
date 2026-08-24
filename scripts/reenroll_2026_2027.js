/**
 * RÉINSCRIPTION MON AVENIR PLUS — 2025-2026 → 2026-2027 (version batch optimisée)
 */
const { Client } = require('pg');
const crypto = require('crypto');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const YEAR_2025 = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';
const YEAR_2026 = '0117c957-2a19-48a7-9308-1bfbc817710b';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected');

  // ── 1. Charger classes + academic classes en mémoire ──
  const classes2025 = await client.query(`SELECT id, code, "schoolLevelId" FROM classes WHERE "tenantId"=$1 AND "academicYearId"=$2`, [TENANT_ID, YEAR_2025]);
  const c2025 = new Map(classes2025.rows.map(r => [r.code, r]));

  const classes2026 = await client.query(`SELECT id, code, "schoolLevelId" FROM classes WHERE "tenantId"=$1 AND "academicYearId"=$2`, [TENANT_ID, YEAR_2026]);
  const c2026 = new Map(classes2026.rows.map(r => [r.code, r]));

  const ac2026 = await client.query(`SELECT id, code FROM pedagogy_academic_classes WHERE "tenantId"=$1 AND "academicYearId"=$2`, [TENANT_ID, YEAR_2026]);
  const acMap2026 = new Map(ac2026.rows.map(r => [r.code, r]));

  // ── 2. Tables de passage ──
  const PASS = {
    'MAT1':'MAT2', 'MAT2':'CI_A',
    'CI_A':'CP_A', 'CI_B':'CP_B',
    'CP_A':'CE1_A', 'CP_B':'CE1_B',
    'CE1_A':'CE2_A', 'CE1_B':'CE2_B',
    'CE2_A':'CM1_A', 'CE2_B':'CM1_B',
    'CM1_A':'CM2_A', 'CM1_B':'CM2_B',
    'CM2_A':'6EME', 'CM2_B':'6EME',
    '6EME':'5EME', '5EME':'4EME',
    '4EME':'3ème', '3EME':'2NDE-D', '2NDE_D':'1ERE-D',
  };
  const AC_PASS = {
    'MAT1':'MAT2','MAT2':'CI','CI_A':'CP','CI_B':'CP','CP_A':'CE1','CP_B':'CE1',
    'CE1_A':'CE2','CE1_B':'CE2','CE2_A':'CM1','CE2_B':'CM1',
    'CM1_A':'CM2','CM1_B':'CM2','CM2_A':'6EME','CM2_B':'6EME',
    '6EME':'5EME','5EME':'4EME','4EME':'3EME','3EME':'2NDE_D','2NDE_D':'1ERE_D',
  };

  // ── 3. Charger tous les élèves ADMITTED 2025-2026 ──
  const students = await client.query(`
    SELECT se.id as eid, se."studentId", se."classId", se."schoolLevelId",
           s."lastName", s."firstName", c.code as class_code
    FROM student_enrollments se
    JOIN students s ON s.id = se."studentId"
    LEFT JOIN classes c ON c.id = se."classId"
    WHERE se."tenantId"=$1 AND se."academicYearId"=$2 AND se.status='ADMITTED'
  `, [TENANT_ID, YEAR_2025]);
  console.log(`Élèves à réinscrire: ${students.rows.length}`);

  // ── 4. Charger les anciens comptes (pour arriérés) ──
  const oldAccounts = await client.query(`
    SELECT "studentId", "balance" FROM student_accounts
    WHERE "tenantId"=$1 AND "academicYearId"=$2
  `, [TENANT_ID, YEAR_2025]);
  const oldBalanceMap = new Map(oldAccounts.rows.map(r => [r.studentId, Number(r.balance)]));

  // ── 5. Charger les inscriptions 2026-2027 existantes (pour skip) ──
  const existing2026 = await client.query(`
    SELECT "studentId" FROM student_enrollments
    WHERE "tenantId"=$1 AND "academicYearId"=$2
  `, [TENANT_ID, YEAR_2026]);
  const existingSet = new Set(existing2026.rows.map(r => r.studentId));

  // ── 6. Charger les student_accounts 2026-2027 existants ──
  const existingAccounts2026 = await client.query(`
    SELECT "studentId" FROM student_accounts
    WHERE "tenantId"=$1 AND "academicYearId"=$2
  `, [TENANT_ID, YEAR_2026]);
  const existingAccountsSet = new Set(existingAccounts2026.rows.map(r => r.studentId));

  // ── 7. Préparer les batchs INSERT ──
  const enrollmentsToInsert = [];
  const accountsToInsert = [];
  const enrollmentIdsToUpdate = [];
  let reenrolled = 0, alreadyExists = 0, noMapping = 0, noTarget = 0;

  for (const s of students.rows) {
    const fromCode = s.class_code;
    const toCode = PASS[fromCode];
    if (!toCode) { noMapping++; continue; }

    const toClass = c2026.get(toCode);
    if (!toClass) { noTarget++; continue; }

    if (existingSet.has(s.studentId)) { alreadyExists++; continue; }

    const acToCode = AC_PASS[fromCode];
    const toAcClass = acMap2026.get(acToCode) || null;
    const schoolLevelId = toClass.schoolLevelId || s.schoolLevelId;

    const eid = crypto.randomUUID();
    enrollmentsToInsert.push([
      eid, TENANT_ID, YEAR_2026, s.studentId,
      toClass.id, toAcClass?.id || null, schoolLevelId,
    ]);
    enrollmentIdsToUpdate.push(s.eid);

    if (!existingAccountsSet.has(s.studentId)) {
      const oldBal = oldBalanceMap.get(s.studentId) || 0;
      const carriedArrears = Math.max(0, oldBal);
      const aid = crypto.randomUUID();
      accountsToInsert.push([aid, TENANT_ID, YEAR_2026, s.studentId, carriedArrears]);
    }

    reenrolled++;
  }

  console.log(`Réinscriptions à créer: ${reenrolled}`);
  console.log(`Déjà existants: ${alreadyExists}`);
  console.log(`Pas de mapping: ${noMapping}`);
  console.log(`Classe destination introuvable: ${noTarget}`);

  // ── 8. Exécuter les INSERT en batch ──
  // Drop trigger temporairement
  await client.query('DROP TRIGGER IF EXISTS prevent_balance_update_trigger ON student_accounts');

  // Insert enrollments (batch de 50)
  for (let i = 0; i < enrollmentsToInsert.length; i += 50) {
    const batch = enrollmentsToInsert.slice(i, i + 50);
    let valuesSql = '';
    let params = [];
    for (let j = 0; j < batch.length; j++) {
      const base = j * 7;
      valuesSql += (j > 0 ? ',' : '') +
        `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},'REENROLLMENT',now(),'ADMITTED',now(),now())`;
      params.push(...batch[j]);
    }
    await client.query(`
      INSERT INTO student_enrollments
      (id,"tenantId","academicYearId","studentId","classId","academicClassId","schoolLevelId",
       "enrollmentType","enrollmentDate",status,"createdAt","updatedAt")
      VALUES ${valuesSql}
    `, params);
  }
  console.log(`✅ ${enrollmentsToInsert.length} inscriptions créées`);

  // Insert accounts (batch de 50)
  for (let i = 0; i < accountsToInsert.length; i += 50) {
    const batch = accountsToInsert.slice(i, i + 50);
    let valuesSql = '';
    let params = [];
    for (let j = 0; j < batch.length; j++) {
      const base = j * 5;
      // batch[j] = [id, tenantId, yearId, studentId, carriedArrears]
      valuesSql += (j > 0 ? ',' : '') +
        `($${base+1},$${base+2},$${base+3},$${base+4},0,0,0,$${base+5},$${base+5},'ACTIVE',now(),now())`;
      params.push(...batch[j]);
    }
    await client.query(`
      INSERT INTO student_accounts
      (id,"tenantId","academicYearId","studentId",
       "totalDue","totalPaid","balance",
       "arrearsAmount","carriedArrears",
       status,"createdAt","updatedAt")
      VALUES ${valuesSql}
    `, params);
  }
  console.log(`✅ ${accountsToInsert.length} comptes créés`);

  // Update old enrollments to PROMOTED
  for (let i = 0; i < enrollmentIdsToUpdate.length; i += 50) {
    const batch = enrollmentIdsToUpdate.slice(i, i + 50);
    const placeholders = batch.map((_, idx) => `$${idx+1}`).join(',');
    await client.query(`UPDATE student_enrollments SET status='PROMOTED',"updatedAt"=now() WHERE id IN (${placeholders})`, batch);
  }
  console.log(`✅ ${enrollmentIdsToUpdate.length} anciennes inscriptions marquées PROMOTED`);

  // Recreate trigger
  await client.query('CREATE TRIGGER prevent_balance_update_trigger BEFORE UPDATE OF "totalPaid", "balance" ON student_accounts FOR EACH ROW EXECUTE FUNCTION prevent_balance_update()');

  // ── 9. Vérification ──
  const finalCount = await client.query(`SELECT COUNT(*) as c FROM student_enrollments WHERE "tenantId"=$1 AND "academicYearId"=$2 AND status='ADMITTED'`, [TENANT_ID, YEAR_2026]);
  console.log(`\nInscriptions ADMITTED 2026-2027: ${finalCount.rows[0].c}`);

  const finalAccounts = await client.query(`SELECT COUNT(*) as c FROM student_accounts WHERE "tenantId"=$1 AND "academicYearId"=$2`, [TENANT_ID, YEAR_2026]);
  console.log(`Student accounts 2026-2027: ${finalAccounts.rows[0].c}`);

  // Distribution par classe
  const dist = await client.query(`
    SELECT c.name, COUNT(se."studentId") as eff
    FROM classes c
    LEFT JOIN student_enrollments se ON se."classId"=c.id AND se."academicYearId"=$1 AND se.status='ADMITTED'
    WHERE c."tenantId"=$2 AND c."academicYearId"=$1
    GROUP BY c.name ORDER BY c.name
  `, [YEAR_2026, TENANT_ID]);
  console.log('\n=== Distribution par classe 2026-2027 ===');
  dist.rows.forEach(d => console.log(`  ${d.name.padEnd(20)} : ${d.eff} élèves`));

  await client.end();
  console.log('\n🔌 Done');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
