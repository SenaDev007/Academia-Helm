import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

console.log('=== CSPEB ReportCards (current year) — DETAILED ===');
const rcs = await client.query(`
  SELECT rc.id, rc.type, rc.status, rc."quarterId", rc."studentId", 
         rc."directorSignedAt", rc."distributedToTeacherAt", rc."teacherSignedAt",
         rc."createdAt", rc."updatedAt",
         s."firstName", s."lastName", se."classId", c.name AS class_name
  FROM report_cards rc
  JOIN students s ON s.id = rc."studentId"
  LEFT JOIN student_enrollments se ON se."studentId" = rc."studentId" AND se."academicYearId" = rc."academicYearId"
  LEFT JOIN classes c ON c.id = se."classId"
  WHERE rc."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    AND rc."academicYearId" = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a'
  ORDER BY rc."createdAt" DESC
`);
console.log(JSON.stringify(rcs.rows, null, 2));

console.log('\n=== Available periods for CSPEB current year ===');
const periods = await client.query(`
  SELECT id, name, "startDate", "endDate", "isActive"
  FROM quarters
  WHERE "tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    AND "academicYearId" = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a'
  ORDER BY "startDate"
`);
console.log(JSON.stringify(periods.rows, null, 2));

console.log('\n=== Evaluation types available for CSPEB ===');
const evalTypes = await client.query(`
  SELECT id, name, code, "schoolLevelId"
  FROM evaluation_types
  WHERE "tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
  ORDER BY name
  LIMIT 20
`);
console.log(JSON.stringify(evalTypes.rows, null, 2));

console.log('\n=== Distinct evaluations for CSPEB current year ===');
const evals = await client.query(`
  SELECT e.id, e.title, e.status, e."evaluationTypeId", et.name AS eval_type_name, et.code AS eval_type_code,
         e."classId", c.name AS class_name, e."periodId", q.name AS period_name
  FROM evaluations e
  LEFT JOIN evaluation_types et ON et.id = e."evaluationTypeId"
  LEFT JOIN classes c ON c.id = e."classId"
  LEFT JOIN quarters q ON q.id = e."periodId"
  WHERE e."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    AND e."academicYearId" = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a'
  ORDER BY e."evaluationDate" DESC
  LIMIT 15
`);
console.log(`Found ${evals.rows.length} evaluations`);
console.log(JSON.stringify(evals.rows, null, 2));

await client.end();
