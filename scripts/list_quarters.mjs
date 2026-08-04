import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

console.log('[A] All quarters for tenant 59b8c348:');
const q = await client.query(`
  SELECT id, name, number, "academicYearId", "startDate", "endDate", "isCurrent"
  FROM quarters
  WHERE "tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
  ORDER BY "academicYearId", number
`);
for (const r of q.rows) {
  console.log(`  • #${r.number} ${r.name} — year=${r.academicYearId?.substring(0,8)} current=${r.isCurrent} id=${r.id.substring(0,8)}`);
}

console.log('\n[B] Mapping: academic_periods ↔ quarters (same year, same number):');
const ap = await client.query(`
  SELECT id, name, "academicYearId" FROM academic_periods
  WHERE "tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    AND "academicYearId" = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a'
  ORDER BY "startDate"
`);
const qs = await client.query(`
  SELECT id, name, number FROM quarters
  WHERE "tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    AND "academicYearId" = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a'
  ORDER BY number
`);
console.log('  academic_periods (evaluations):');
for (const r of ap.rows) console.log(`    • ${r.name} → ${r.id}`);
console.log('  quarters (grades):');
for (const r of qs.rows) console.log(`    • #${r.number} ${r.name} → ${r.id}`);

await client.end();
