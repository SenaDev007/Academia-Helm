import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

// Check EvaluationStatus enum values
console.log('[A] EvaluationStatus enum values:');
const enums = await client.query(`
  SELECT e.enumlabel FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'EvaluationStatus'
  ORDER BY e.enumsortorder
`);
console.log('  Values:', enums.rows.map(r => r.enumlabel).join(', '));

// Try a test INSERT with all the right fields
console.log('\n[B] Test INSERT (dry-run with transaction rollback):');
await client.query('BEGIN');
try {
  const r = await client.query(`
    INSERT INTO evaluations (
      id, "tenantId", "academicYearId", "classId", "subjectId",
      "periodId", "evaluationTypeId", title, "evaluationDate",
      "maxScore", coefficient, "teacherId", status,
      "validatedAt", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(),
      '59b8c348-ae5f-4d67-8fbd-af6aefa1f394',
      'a7593470-e4f4-460a-b3b6-4dabe53bec2a',
      '3c28f595-8a35-4d80-b3a1-5cdec5e9a0d0',  -- CE1 class
      'a70d9f7b-f92e-450a-9bbb-0e3d67808af5',  -- first subject from class_subjects
      '0e65f84b-2fa3-4c88-a4aa-8a52b278200c',  -- Trimestre 1
      'b05bf89d-7c4a-4f4a-9d7e-1e2b3c4d5e6f',  -- EM1 type (placeholder)
      'Test EM1 - T1',
      NOW(),
      20.0, 1.0,
      '9ed8201c-42e0-431d-abd6-71ec6a4c4501',
      'VALIDATED',
      NOW(), NOW(), NOW()
    ) RETURNING id
  `);
  console.log('  ✓ INSERT succeeded, id:', r.rows[0].id.substring(0,8));
} catch (err) {
  console.log('  ❌ INSERT failed:', err.message);
} finally {
  await client.query('ROLLBACK');
  console.log('  (rolled back)');
}

// Get a real subjectId from CE1's class_subjects
console.log('\n[C] Real EM1 type ID:');
const t = await client.query(`
  SELECT id FROM evaluation_types
  WHERE "tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    AND "schoolLevelId" = 'bc434610-8cf6-4415-a51a-cc5300cd99da'
    AND code = 'EM1'
`);
console.log('  EM1 id:', t.rows[0]?.id);

// Real subject for CE1
console.log('\n[D] First real subject for CE1 (officialClassId=b76636fc-06ea-4bb0-9b5a-83f8a5c49d18):');
const s = await client.query(`
  SELECT s.id, s.name FROM class_subjects cs
  JOIN subjects s ON s.id = cs."subjectId"
  WHERE cs."academicClassId" = 'b76636fc-06ea-4bb0-9b5a-83f8a5c49d18'
  LIMIT 1
`);
console.log('  Subject:', s.rows[0]);

// Real INSERT with proper values
console.log('\n[E] Real test INSERT (rollback):');
await client.query('BEGIN');
try {
  const r = await client.query(`
    INSERT INTO evaluations (
      id, "tenantId", "academicYearId", "classId", "subjectId",
      "periodId", "evaluationTypeId", title, "evaluationDate",
      "maxScore", coefficient, "teacherId", status,
      "validatedAt", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(),
      '59b8c348-ae5f-4d67-8fbd-af6aefa1f394',
      'a7593470-e4f4-460a-b3b6-4dabe53bec2a',
      '3c28f595-8a35-4d80-b3a1-5cdec5e9a0d0',
      $1,
      '0e65f84b-2fa3-4c88-a4aa-8a52b278200c',
      $2,
      'Test EM1 - T1',
      NOW(),
      20.0, 1.0,
      '9ed8201c-42e0-431d-abd6-71ec6a4c4501',
      'VALIDATED',
      NOW(), NOW(), NOW()
    ) RETURNING id
  `, [s.rows[0].id, t.rows[0].id]);
  console.log('  ✓ INSERT succeeded, id:', r.rows[0].id.substring(0,8));
} catch (err) {
  console.log('  ❌ INSERT failed:', err.message);
  console.log('  Detail:', err.detail);
  console.log('  Constraint:', err.constraint);
} finally {
  await client.query('ROLLBACK');
  console.log('  (rolled back)');
}

await client.end();
