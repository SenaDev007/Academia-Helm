/**
 * ============================================================================
 * SEED DASHBOARD DATA — Mon Avenir Plus
 * ============================================================================
 * Peuple les données manquantes pour que le tableau de bord affiche des vraies
 * statistiques : gender, payments, attendance_records, grades.
 *
 * ⚠️ À usage unique — ne pas ré-exécuter.
 * ============================================================================
 */
import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const ACADEMIC_YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

console.log('=== [1] Set random gender for students without gender ===');
const studentsNoGender = await client.query(`
  SELECT id, "firstName", "lastName" FROM students
  WHERE "tenantId" = $1 AND "academicYearId" = $2 AND (gender IS NULL OR gender = '')
`, [TENANT_ID, ACADEMIC_YEAR_ID]);
console.log(`  ${studentsNoGender.rows.length} students without gender`);

// Assign gender based on first name heuristics (common Beninese names)
// Otherwise random 50/50
const femaleNames = ['Fatima', 'Aïcha', 'Ramatou', 'Mariam', 'Aminata', 'Awa', 'Kadidja', 'Zinabou', 'Adélaïde', 'Bénérice', 'Grâce', 'Espérance', 'Bénédicte', 'Lucie', 'Sandra', 'Sahadatou', 'Aïssatou', 'Balkissa', 'Rachida', 'Haoua', 'Zara', 'Nafissa', 'Aminatou', 'Déborah', 'Sandra', 'Charlène', 'Mira', 'Sephora', 'Naomi', 'Sarah', 'Esther', 'Ruth', 'Reine', 'Précieuse', 'Béatrice', 'Cynthia', 'Déborah', 'Edith', 'Flore', 'Gisèle', 'Hélène', 'Irène', 'Julie', 'Karen', 'Linda', 'Monique', 'Nadine', 'Olivia', 'Patricia', 'Sylvie'];
let updatedGender = 0;
for (const s of studentsNoGender.rows) {
  const firstName = (s.firstName || '').trim();
  const isFemale = femaleNames.some(fn => firstName.toLowerCase().startsWith(fn.toLowerCase()));
  const gender = isFemale ? 'F' : (Math.random() > 0.5 ? 'M' : 'F');
  await client.query(`UPDATE students SET gender = $1 WHERE id = $2`, [gender, s.id]);
  updatedGender++;
}
console.log(`  Updated ${updatedGender} students with gender`);

console.log('\n=== [2] Generate sample payments (if none exist) ===');
const existingPayments = await client.query(`SELECT COUNT(*)::int AS n FROM payments WHERE "tenantId" = $1`, [TENANT_ID]);
if (existingPayments.rows[0].n === 0) {
  // Get fee structures for the tenant
  const feeStructures = await client.query(`
    SELECT id, name, amount FROM fee_structures
    WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "isActive" = true
    LIMIT 5
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`  Found ${feeStructures.rows.length} fee structures`);

  // Get active students
  const students = await client.query(`
    SELECT id FROM students WHERE "tenantId" = $1 AND "academicYearId" = $2 AND status = 'ACTIVE' LIMIT 100
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);

  let paymentsCreated = 0;
  for (const s of students.rows) {
    // Create 1-3 payments per student (scolarité, inscription, etc.)
    const numPayments = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < numPayments; i++) {
      const fee = feeStructures.rows[i % feeStructures.rows.length] || { id: 'misc', amount: 50000 };
      const amount = Math.floor(fee.amount * (0.5 + Math.random() * 0.5));
      const paymentDate = new Date();
      paymentDate.setDate(paymentDate.getDate() - Math.floor(Math.random() * 90)); // Last 90 days
      const paymentId = require('crypto').randomUUID();
      const method = ['CASH', 'MOBILE_MONEY', 'BANK_TRANSFER'][Math.floor(Math.random() * 3)];

      await client.query(`
        INSERT INTO payments (id, "tenantId", "academicYearId", "studentId", amount, currency, method, status, "createdAt", "updatedAt", reference, description)
        VALUES ($1, $2, $3, $4, $5, 'XOF', $6, 'COMPLETED', $7, $7, $8, $9)
      `, [
        paymentId, TENANT_ID, ACADEMIC_YEAR_ID, s.id, amount, method,
        paymentDate, `PAY-${paymentId.substring(0, 8)}`, `Paiement ${fee.name || 'scolarité'}`
      ]);
      paymentsCreated++;
    }
  }
  console.log(`  Created ${paymentsCreated} payments for ${students.rows.length} students`);
} else {
  console.log(`  ${existingPayments.rows[0].n} payments already exist — skipping`);
}

console.log('\n=== [3] Generate sample attendance records ===');
const existingAttendance = await client.query(`SELECT COUNT(*)::int AS n FROM attendance_records WHERE "tenantId" = $1`, [TENANT_ID]);
if (existingAttendance.rows[0].n === 0) {
  // Get active students
  const students = await client.query(`
    SELECT id FROM students WHERE "tenantId" = $1 AND "academicYearId" = $2 AND status = 'ACTIVE' LIMIT 200
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);

  let attendanceCreated = 0;
  // Generate attendance for last 30 days
  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    const dayOfWeek = date.getDay();
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    for (const s of students.rows) {
      // 90% present, 5% absent, 3% late, 2% excused
      const rand = Math.random();
      let status = 'PRESENT';
      if (rand > 0.95) status = 'ABSENT';
      else if (rand > 0.92) status = 'LATE';
      else if (rand > 0.90) status = 'EXCUSED';

      const recordId = require('crypto').randomUUID();
      await client.query(`
        INSERT INTO attendance_records (id, "tenantId", "studentId", date, status, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT DO NOTHING
      `, [recordId, TENANT_ID, s.id, date, status]);
      attendanceCreated++;
    }
  }
  console.log(`  Created ${attendanceCreated} attendance records`);
} else {
  console.log(`  ${existingAttendance.rows[0].n} attendance records already exist — skipping`);
}

console.log('\n=== [4] Generate sample grades ===');
const existingGrades = await client.query(`SELECT COUNT(*)::int AS n FROM grades WHERE "tenantId" = $1`, [TENANT_ID]);
if (existingGrades.rows[0].n === 0) {
  // Get evaluations for the tenant
  const evals = await client.query(`
    SELECT id, "classId" FROM evaluations
    WHERE "tenantId" = $1 AND "academicYearId" = $2 AND status = 'VALIDATED'
    LIMIT 20
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);

  if (evals.rows.length > 0) {
    // Get students for each evaluation's class
    let gradesCreated = 0;
    for (const ev of evals.rows) {
      const students = await client.query(`
        SELECT s.id FROM students s
        JOIN student_enrollments se ON se."studentId" = s.id
        WHERE s."tenantId" = $1 AND se."classId" = $2 AND se.status = 'ACTIVE'
        LIMIT 30
      `, [TENANT_ID, ev.classId]);

      for (const s of students.rows) {
        // Generate a score between 8 and 18 out of 20
        const score = Math.round((8 + Math.random() * 10) * 100) / 100;
        const gradeId = require('crypto').randomUUID();
        await client.query(`
          INSERT INTO grades (id, "tenantId", "evaluationId", "studentId", score, "isAbsent", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
          ON CONFLICT DO NOTHING
        `, [gradeId, TENANT_ID, ev.id, s.id, score]);
        gradesCreated++;
      }
    }
    console.log(`  Created ${gradesCreated} grades for ${evals.rows.length} evaluations`);
  } else {
    console.log(`  No VALIDATED evaluations found — skipping grades`);
  }
} else {
  console.log(`  ${existingGrades.rows[0].n} grades already exist — skipping`);
}

console.log('\n=== [5] Update student_accounts with arrears ===');
const existingAccounts = await client.query(`SELECT COUNT(*)::int AS n FROM student_accounts WHERE "tenantId" = $1 AND "arrearsAmount" > 0`, [TENANT_ID]);
if (existingAccounts.rows[0].n === 0) {
  // Set random arrears for ~15% of students
  const accounts = await client.query(`
    SELECT id, "studentId" FROM student_accounts
    WHERE "tenantId" = $1 AND "academicYearId" = $2
    LIMIT 100
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);

  let updated = 0;
  for (const acc of accounts.rows) {
    if (Math.random() < 0.15) {
      const arrears = Math.floor(10000 + Math.random() * 90000); // 10,000 - 100,000 FCFA
      await client.query(`
        UPDATE student_accounts SET "arrearsAmount" = $1 WHERE id = $2
      `, [arrears, acc.id]);
      updated++;
    }
  }
  console.log(`  Set arrears on ${updated} student accounts`);
} else {
  console.log(`  ${existingAccounts.rows[0].n} accounts with arrears already exist — skipping`);
}

console.log('\n=== [6] Verify final stats ===');
const finalStats = await client.query(`
  SELECT
    (SELECT COUNT(*) FROM students WHERE "tenantId" = $1 AND status = 'ACTIVE') AS active_students,
    (SELECT COUNT(*) FROM students WHERE "tenantId" = $1 AND gender = 'M') AS males,
    (SELECT COUNT(*) FROM students WHERE "tenantId" = $1 AND gender = 'F') AS females,
    (SELECT COUNT(*) FROM students WHERE "tenantId" = $1 AND (gender IS NULL OR gender = '')) AS no_gender,
    (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE "tenantId" = $1 AND status = 'COMPLETED') AS total_revenue,
    (SELECT COUNT(*) FROM payments WHERE "tenantId" = $1 AND status = 'COMPLETED') AS payment_count,
    (SELECT COALESCE(SUM("arrearsAmount"), 0) FROM student_accounts WHERE "tenantId" = $1) AS total_arrears,
    (SELECT COUNT(*) FROM grades WHERE "tenantId" = $1) AS grade_count,
    (SELECT COUNT(*) FROM attendance_records WHERE "tenantId" = $1) AS attendance_count
`, [TENANT_ID]);
console.log(JSON.stringify(finalStats.rows[0], null, 2));

await client.end();
console.log('\n✅ Seed completed!');
