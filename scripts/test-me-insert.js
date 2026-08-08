/**
 * Test d'INSERT MonthlyEvaluation avec JSON inline (pas de paramètre)
 */
const { Client } = require('pg');
const crypto = require('crypto');

const NEON_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new Client({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('✅ Connected');

  const tenantId = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
  const yearId = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a';
  const classId = '3c28f595-8a35-4d80-b3a1-5cdec5e9a0d0'; // CE1
  const teacherId = '11518938-3fdb-4f70-860b-b6a088807c5b';

  // Get students
  const students = await client.query(
    `SELECT s.id, s."firstName", s."lastName", s.gender FROM students s
     JOIN student_enrollments se ON se."studentId" = s.id
     WHERE se."tenantId" = $1 AND se."classId" = $2 AND se."academicYearId" = $3 AND se.status = 'ACTIVE'`,
    [tenantId, classId, yearId]
  );
  console.log('Students:', students.rows.length);

  // Get subjects
  const subjects = await client.query(
    `SELECT s.id, s.name FROM subjects s
     JOIN class_subjects cs ON cs."subjectId" = s.id
     WHERE cs."tenantId" = $1 AND cs."classId" = $2`,
    [tenantId, classId]
  );
  console.log('Subjects:', subjects.rows.length);

  const subs = subjects.rows.slice(0, 8);

  // Build scores JSON
  const scores = students.rows.map(st => ({
    studentId: st.id,
    nom: st.lastName,
    prenom: st.firstName,
    sexe: st.gender || 'M',
    scores: subs.map(su => ({
      subjectId: su.id,
      subjectName: su.name,
      cm: Math.round((8 + Math.random() * 10) * 10) / 10,
      cp: Math.round(Math.random() * 20) / 10,
      total: 14.0,
    })),
    totalGeneral: 42.0,
    seuilAtteint: true,
  }));

  const scoresJson = JSON.stringify(scores);
  const configJson = JSON.stringify(subs.map(s => ({ subjectId: s.id, subjectName: s.name })));
  console.log('JSON size:', scoresJson.length, 'bytes');

  // Create AR
  const arId = crypto.randomUUID();
  await client.query(
    `INSERT INTO attendance_registers (id, "tenantId", "academicYearId", "classId", "teacherId", month, year, "studentsData", status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 6, 2026, '[]', 'DRAFT', NOW(), NOW())`,
    [arId, tenantId, yearId, classId, teacherId]
  );
  console.log('AR created');

  // Test 1: INSERT with parameterized query (the approach that hangs)
  console.log('\n--- Test 1: Parameterized INSERT ---');
  const meId1 = crypto.randomUUID();
  try {
    const me1 = await client.query(
      `INSERT INTO monthly_evaluations (id, "tenantId", "academicYearId", "classId", "attendanceRegisterId", month, year, "evaluationNumber", "etapeNumber", "subjectsConfig", "studentScores", "seuilReussite", status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 6, 2026, 1, 1, $6, $7, 10.0, 'SUBMITTED', NOW(), NOW()) RETURNING id`,
      [meId1, tenantId, yearId, classId, arId, configJson, scoresJson]
    );
    console.log('✅ Test 1 ME created:', me1.rows[0].id);
    await client.query('DELETE FROM monthly_evaluations WHERE id = $1', [meId1]);
  } catch (err) {
    console.error('❌ Test 1 failed:', err.message);
  }

  // Test 2: INSERT with inline JSON (no parameters for JSON)
  console.log('\n--- Test 2: Inline JSON INSERT ---');
  const meId2 = crypto.randomUUID();
  try {
    const escapedConfig = configJson.replace(/'/g, "''");
    const escapedScores = scoresJson.replace(/'/g, "''");
    const sql = `INSERT INTO monthly_evaluations (id, "tenantId", "academicYearId", "classId", "attendanceRegisterId", month, year, "evaluationNumber", "etapeNumber", "subjectsConfig", "studentScores", "seuilReussite", status, "createdAt", "updatedAt")
      VALUES ('${meId2}', '${tenantId}', '${yearId}', '${classId}', '${arId}', 6, 2026, 1, 1, '${escapedConfig}'::jsonb, '${escapedScores}'::jsonb, 10.0, 'SUBMITTED', NOW(), NOW()) RETURNING id`;

    const me2 = await client.query(sql);
    console.log('✅ Test 2 ME created:', me2.rows[0].id);
    await client.query('DELETE FROM monthly_evaluations WHERE id = $1', [meId2]);
  } catch (err) {
    console.error('❌ Test 2 failed:', err.message);
  }

  // Clean up AR
  await client.query('DELETE FROM attendance_registers WHERE id = $1', [arId]);
  console.log('\nCleaned up');

  await client.end();
}

main().catch(err => console.error('FATAL:', err.message));
