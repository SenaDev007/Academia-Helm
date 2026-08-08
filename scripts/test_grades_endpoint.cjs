// Simulate the SQL query to see what columns come back
const pg = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Test with a real student that has grades
  const grades = await client.query(`
    SELECT
      g.id AS grade_id,
      g.score,
      g."maxScore",
      g.coefficient,
      g."isAbsent",
      g."qualitativeCode",
      g.status AS grade_status,
      g."evaluationId",
      e.title AS evaluation_title,
      e."evaluationDate",
      e.status AS evaluation_status,
      et.id AS "evaluationTypeId",
      et.code AS "evaluationTypeCode",
      et.name AS "evaluationTypeName",
      s.id AS "subjectId",
      s.name AS "subjectName",
      s.code AS "subjectCode",
      s.language AS "subjectLanguage",
      c.id AS "classId",
      c.name AS "className",
      sl.code AS "schoolLevelCode",
      q.id AS "quarterId",
      q.name AS "quarterName",
      q.number AS "quarterNumber",
      ap.name AS "periodName"
    FROM grades g
    JOIN evaluations e ON e.id = g."evaluationId"
    LEFT JOIN evaluation_types et ON et.id = e."evaluationTypeId"
    LEFT JOIN subjects s ON s.id = e."subjectId"
    LEFT JOIN classes c ON c.id = e."classId"
    LEFT JOIN school_levels sl ON sl.id = c."schoolLevelId"
    LEFT JOIN quarters q ON q.id = g."periodId"
    LEFT JOIN academic_periods ap ON ap.id = e."periodId"
    WHERE g."studentId" = $1
      AND g."tenantId" = $2
      AND e."academicYearId" = $3
      AND e.status = 'VALIDATED'
    ORDER BY q.number ASC, et.code ASC, s.name ASC
    LIMIT 3
  `, ['c9a4b7d0-fadd-40a8-8ec0-c472772b5708', '59b8c348-ae5f-4d67-8fbd-af6aefa1f394', 'a7593470-e4f4-460a-b3b6-4dabe53bec2a']);
  console.log('Got', grades.rows.length, 'grades');
  if (grades.rows.length > 0) {
    console.log('First row keys:', Object.keys(grades.rows[0]));
    console.log('First row:', grades.rows[0]);
  }

  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
