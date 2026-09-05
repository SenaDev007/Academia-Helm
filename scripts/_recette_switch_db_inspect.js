/**
 * Recette switch double casquette — inspection DB Neon (production)
 * Objectif : identifier le tenant CSPEB + patterns existants
 * (users / teachers / staff / staff_admin_assignments) avant création.
 */
const { Client } = require('pg');

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // 1. Tenants
  const tenants = await client.query(`
    SELECT id, name, subdomain, status
    FROM tenants ORDER BY "createdAt"`);
  console.log('=== TENANTS ===');
  for (const t of tenants.rows) {
    console.log(`${t.id} | ${t.name} | sub=${t.subdomain} | ${t.status} | plan=${t.planType}`);
  }

  // 2. Tenant CSPEB (par subdomain)
  const cspeb = tenants.rows.find(
    (t) => (t.subdomain || '').toLowerCase().includes('cspeb') ||
           (t.name || '').toLowerCase().includes('cspeb') ||
           (t.subdomain || '').toLowerCase().includes('eveil'));
  if (!cspeb) { console.log('\n!! Aucun tenant CSPEB trouvé'); await client.end(); return; }

  const tid = cspeb.id;
  console.log(`\n=== TENANT CSPEB: ${cspeb.name} (sub=${cspeb.subdomain}) ===`);

  // 3. Users du tenant
  const users = await client.query(`
    SELECT id, email, role, status, "firstName", "lastName", "lastLogin"
    FROM users WHERE "tenantId" = $1 ORDER BY role, email LIMIT 30`, [tid]);
  console.log('\n--- USERS ---');
  for (const u of users.rows) {
    console.log(`${u.role || '-'} | ${u.email} | ${u.status} | ${u.firstName || ''} ${u.lastName || ''}`);
  }

  // 4. Niveaux d'école du tenant
  const levels = await client.query(`
    SELECT id, code, name FROM school_levels WHERE "tenantId" = $1`, [tid]);
  console.log('\n--- SCHOOL_LEVELS ---');
  for (const l of levels.rows) console.log(`${l.code} | ${l.name} | ${l.id}`);

  // 5. Teachers du tenant (format matricule)
  const teachers = await client.query(`
    SELECT matricule, email, status, "firstName", "lastName", "schoolLevelId"
    FROM teachers WHERE "tenantId" = $1 ORDER BY "createdAt" LIMIT 15`, [tid]);
  console.log('\n--- TEACHERS (échantillon) ---');
  for (const t of teachers.rows) {
    console.log(`${t.matricule} | ${t.email} | ${t.status} | ${t.firstName} ${t.lastName}`);
  }

  // 6. Staff du tenant
  const staff = await client.query(`
    SELECT "employeeNumber", "globalMatricule", "tenantMatricule", "roleType", status, email, position
    FROM staff WHERE "tenantId" = $1 ORDER BY "createdAt" LIMIT 15`, [tid]);
  console.log('\n--- STAFF (échantillon) ---');
  for (const s of staff.rows) {
    console.log(`${s.roleType} | ${s.status} | emp=${s.employeeNumber} | gm=${s.globalMatricule} | tm=${s.tenantMatricule} | ${s.email} | pos=${s.position}`);
  }

  // 7. Affectations admin
  const assigns = await client.query(`
    SELECT sa."adminRole", sa."schoolLevelCode", sa."isActive", s.email, s."roleType", s.status
    FROM staff_admin_assignments sa JOIN staff s ON s.id = sa."staffId"
    WHERE sa."tenantId" = $1 LIMIT 15`, [tid]);
  console.log('\n--- STAFF_ADMIN_ASSIGNMENTS ---');
  for (const a of assigns.rows) {
    console.log(`${a.adminRole} | lvl=${a.schoolLevelCode} | actif=${a.isActive} | staff=${a.email} (${a.roleType}/${a.status})`);
  }

  // 8. Année scolaire courante
  const ay = await client.query(`
    SELECT id, name, "isCurrent" FROM academic_years WHERE "tenantId" = $1 ORDER BY "isCurrent" DESC LIMIT 3`, [tid]);
  console.log('\n--- ACADEMIC YEARS ---');
  for (const y of ay.rows) console.log(`${y.name} | current=${y.isCurrent} | ${y.id}`);

  await client.end();
}

main().catch((e) => { console.error('ERREUR:', e.message); process.exit(1); });
