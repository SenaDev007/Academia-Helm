import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
const YEAR_2025_ID = '88de4271-ce8a-4d6d-a907-dd945ba3d158';

// Check if quarters exist for 2025-2026
const existing = await client.query(`
  SELECT id, name, number FROM quarters
  WHERE "tenantId" = $1 AND "academicYearId" = $2
  ORDER BY number
`, [TENANT_ID, YEAR_2025_ID]);
console.log(`Existing quarters for 2025-2026: ${existing.rowCount}`);

if (existing.rowCount === 0) {
  console.log('Creating quarters for 2025-2026...');

  // Get academic_periods for 2025-2026 to use their dates
  const periods = await client.query(`
    SELECT id, name, "startDate", "endDate" FROM academic_periods
    WHERE "academicYearId" = $1 ORDER BY "startDate"
  `, [YEAR_2025_ID]);

  for (let i = 0; i < periods.rows.length; i++) {
    const p = periods.rows[i];
    const number = i + 1;
    const name = number === 1 ? 'Trimestre 1' : number === 2 ? 'Deuxième Trimestre' : 'Troisième Trimestre';
    const q = await client.query(`
      INSERT INTO quarters (id, "tenantId", "academicYearId", name, number, "startDate", "endDate", "isCurrent", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, false, NOW(), NOW())
      RETURNING id
    `, [TENANT_ID, YEAR_2025_ID, name, number, p.startDate, p.endDate]);
    console.log(`  ✓ Created Q#${number} ${name} — id=${q.rows[0].id.substring(0,8)} (${p.startDate?.toString().substring(0,10)} to ${p.endDate?.toString().substring(0,10)})`);
  }
}

// Now re-run the backfill
console.log('\nBackfilling remaining 546 grades...');
const mapping = await client.query(`
  SELECT ap.id AS ap_id, ap.name,
    (SELECT q.id FROM quarters q
     WHERE q."academicYearId" = ap."academicYearId"
       AND q."tenantId" = ap."tenantId"
       AND ((ap.name ILIKE '%trimestre 1%' AND q.number = 1)
         OR (ap.name ILIKE '%trimestre 2%' AND q.number = 2)
         OR (ap.name ILIKE '%trimestre 3%' AND q.number = 3))
     LIMIT 1) AS q_id
  FROM academic_periods ap WHERE ap."tenantId" = $1
`, [TENANT_ID]);

for (const r of mapping.rows) {
  if (r.q_id) {
    const upd = await client.query(`
      UPDATE grades g SET "periodId" = $1
      FROM evaluations e WHERE e.id = g."evaluationId"
        AND e."periodId" = $2 AND g."periodId" IS NULL
    `, [r.q_id, r.ap_id]);
    if (upd.rowCount > 0) console.log(`  • ${r.name}: backfilled ${upd.rowCount} grades`);
  }
}

// Final check
const final = await client.query(`
  SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE "periodId" IS NULL)::int AS null_period
  FROM grades WHERE "tenantId" = $1
`, [TENANT_ID]);
console.log('\nFinal grades state:', final.rows[0]);

await client.end();
