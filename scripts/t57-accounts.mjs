/**
 * T57 — Étape 2 : comptes patronats (national + territorial), bureau,
 * et essai de cassage du mot de passe connu pour reproduire le login.
 */
import pg from 'pg';
import bcrypt from 'bcryptjs';

const client = new pg.Client({
  connectionString:
    'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

// 1. Tous les users liés aux patronats (via patronat_users) + leurs tenants
const users = await client.query(`
  SELECT u.id, u.email, u.role, u.status, u."tenantId" AS user_tenant, pu."tenantId" AS link_tenant,
         pu.role AS patronat_role, pu."isActive" AS link_active, p.name AS patronat_name, p."orgLevel"
  FROM patronat_users pu
  JOIN users u ON u.id = pu."userId"
  LEFT JOIN patronats p ON p."tenantId" = pu."tenantId"
  ORDER BY p."orgLevel", u.email
`);
console.log('=== Comptes patronats ===');
console.table(users.rows);

// 2. Bureau members du national
const bureau = await client.query(`
  SELECT bm.*, p.name AS patronat_name
  FROM patronat_bureau_members bm
  LEFT JOIN patronats p ON p.id = bm."patronatId"
  ORDER BY p.name, bm.role
`);
console.log('=== Bureau members ===');
for (const b of bureau.rows) {
  console.log(
    `${b.patronat_name} | ${b.firstName} ${b.lastName} | ${b.role} | userId=${b.userId} | email=${b.email} | actif=${b.isActive}`,
  );
}

// 3. Essai bcrypt avec mots de passe historiques
const candidates = ['er7oNlc1b4o', 'Password123!', 'Promoteur2024!', 'Academia2024!', 'Saliou2024!'];
const target = await client.query(
  `SELECT id, email, "passwordHash" FROM users WHERE email = 'dawesakpovi@gmail.com'`,
);
for (const u of target.rows) {
  for (const pwd of candidates) {
    const ok = await bcrypt.compare(pwd, u.passwordHash);
    if (ok) console.log(`\n🔑 MOT DE PASSE VALIDE pour ${u.email}: ${pwd}`);
  }
}

// 4. Tenants de type PATRONAT (vérif configuration)
const tenants = await client.query(`
  SELECT id, name, type, status, subdomain FROM tenants
  WHERE id IN (SELECT "tenantId" FROM patronats) OR type = 'PATRONAT'
`);
console.log('\n=== Tenants patronats ===');
console.table(tenants.rows);

await client.end();
