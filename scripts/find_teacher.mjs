import pg from 'pg';
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

// Search by matricule
const teachers = await client.query(`
  SELECT s.id, s."firstName", s."lastName", s.email,
         s."globalMatricule", s."tenantMatricule", s."employeeNumber",
         u.email as user_email, u.role
  FROM staff s
  LEFT JOIN users u ON u.email = s.email
  WHERE s."tenantMatricule" = 'CSPEBE-26-00008'
     OR s."globalMatricule" = 'CSPEBE-26-00008'
     OR s."employeeNumber" = 'CSPEBE-26-00008'
     OR s."tenantMatricule" LIKE '%CSPEBE-26-00008%'
  LIMIT 5
`);
console.log('Teacher found by matricule:');
for (const t of teachers.rows) {
  console.log(`  ${t.firstName} ${t.lastName} | email=${t.email} | matricule=${t.tenantMatricule || t.globalMatricule} | user_email=${t.user_email} | role=${t.role}`);
}

// Also check enseignant users
const enseignants = await client.query(`
  SELECT email, role, "firstName", "lastName"
  FROM users
  WHERE role = 'ENSEIGNANT' OR role = 'TEACHER'
  LIMIT 10
`);
console.log('\nEnseignant users:');
for (const u of enseignants.rows) {
  console.log(`  ${u.email} | ${u.role} | ${u.firstName} ${u.lastName}`);
}

await client.end();
