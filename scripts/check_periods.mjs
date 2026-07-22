import pg from 'pg';
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

// Check academic periods in detail
const periods = await client.query(`
  SELECT ap.*, t.name as tenant_name, ay.name as year_name
  FROM "academic_periods" ap
  LEFT JOIN tenants t ON t.id = ap."tenantId"
  LEFT JOIN academic_years ay ON ay.id = ap."academicYearId"
  ORDER BY ap."tenantId", ap."periodOrder"
`);
console.log('Périodes académiques:');
for (const p of periods.rows) {
  console.log(`  ${p.tenant_name || '?'} | ${p.year_name || '?'} | ${p.name} (${p.type}) | ordre=${p.periodorder} | actif=${p.isactive} | fermé=${p.isclosed}`);
}

// Check what academic years exist
const years = await client.query(`
  SELECT ay.id, ay.name, ay.label, t.name as tenant_name, ay."isActive"
  FROM academic_years ay
  LEFT JOIN tenants t ON t.id = ay."tenantId"
  ORDER BY ay."createdAt" DESC
  LIMIT 10
`);
console.log('\nAnnées scolaires:');
for (const y of years.rows) {
  console.log(`  ${y.tenant_name || '?'} | ${y.name} | ${y.label} | active=${y.isactive}`);
}

// Check what classes exist
const classes = await client.query(`
  SELECT c.id, c.name, c.code, sl.code as level_code, sl.name as level_name, t.name as tenant_name
  FROM classes c
  LEFT JOIN school_levels sl ON sl.id = c."schoolLevelId"
  LEFT JOIN tenants t ON t.id = c."tenantId"
  LIMIT 20
`);
console.log(`\nClasses (${classes.rows.length}):`);
for (const c of classes.rows) {
  console.log(`  ${c.tenant_name || '?'} | ${c.name} (${c.code}) | niveau=${c.level_code || '?'} (${c.level_name || '?'})`);
}

// Check subjects
const subjects = await client.query(`
  SELECT s.name, s.code, s.coefficient, sl.code as level_code, s.language
  FROM subjects s
  LEFT JOIN school_levels sl ON sl.id = s."schoolLevelId"
  LIMIT 20
`);
console.log(`\nMatières (${subjects.rows.length}):`);
for (const s of subjects.rows) {
  console.log(`  ${s.name} (${s.code}) | coef=${s.coefficient} | niveau=${s.level_code || '?'} | langue=${s.language || '?'}`);
}

await client.end();
