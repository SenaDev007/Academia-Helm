import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const rcs = await client.query(`
  SELECT rc.id, rc.status, rc."evaluationTypeId", rc."evaluationTypeName", rc."evaluationTypeCode",
         rc."quarterId", s."firstName", s."lastName", c.name AS class_name
  FROM report_cards rc
  JOIN students s ON s.id = rc."studentId"
  LEFT JOIN student_enrollments se ON se."studentId" = rc."studentId" AND se."academicYearId" = rc."academicYearId"
  LEFT JOIN classes c ON c.id = se."classId"
  WHERE rc."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    AND rc."academicYearId" = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a'
  ORDER BY c.name, s."lastName"
`);
console.log(JSON.stringify(rcs.rows, null, 2));
await client.end();
