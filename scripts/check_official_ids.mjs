import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const classes = await client.query(`
  SELECT c.id, c.name, c."officialClassId"
  FROM classes c
  JOIN school_levels sl ON sl.id = c."schoolLevelId" AND sl.code = 'PRIMAIRE'
  WHERE c."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    AND c."academicYearId" = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a'
  ORDER BY c.name
`);
console.log('PRIMAIRE classes:');
for (const c of classes.rows) {
  console.log(`  • ${c.name} — id=${c.id} officialClassId=${c.officialClassId||'NULL'}`);
  if (c.officialClassId) {
    const subs = await client.query(`
      SELECT s.name FROM class_subjects cs
      JOIN subjects s ON s.id = cs."subjectId"
      WHERE cs."academicClassId" = $1
    `, [c.officialClassId]);
    console.log(`    → ${subs.rows.length} subjects`);
  }
}

await client.end();
