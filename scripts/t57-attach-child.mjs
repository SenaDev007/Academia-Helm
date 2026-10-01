/**
 * T57 — Créer un patronat TERRITORIAL enfant sous le national BF de test
 * (directement en base, réversible), puis re-tester les endpoints du national.
 */
import pg from 'pg';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const NAT_ID = '048980bf-4508-429d-95b2-dd041cf43f8c'; // Patronat QA T57 Nat (BF)
const nat = (
  await client.query('SELECT * FROM patronats WHERE id = $1', [NAT_ID])
).rows[0];
console.log(`National: ${nat.name} | countryId=${nat.countryId} | tenant=${nat.tenantId}`);

// Colonnes du patronat pour un insert minimal
const cols = (
  await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='patronats'`,
  )
).rows.map((r) => r.column_name);
console.log('Colonnes patronats:', cols.join(', '));

// Colonnes de tenants
const tcols = (
  await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='tenants'`,
  )
).rows.map((r) => r.column_name);
console.log('Colonnes tenants:', tcols.join(', '));

// Créer le tenant enfant
const childTenantId = randomUUID();
await client.query(
  `INSERT INTO tenants (id, name, slug, "countryId", type, status, "createdAt", "updatedAt")
   VALUES ($1, 'QA T57 Dept Centre', $2, $3, 'PATRONAT', 'active', NOW(), NOW())`,
  [childTenantId, `qa-t57-dept-${Date.now().toString(36)}`, nat.countryId],
);

// Créer le patronat enfant (mêmes champs que le parent, niveau TERRITORIAL)
const childId = randomUUID();
await client.query(
  `INSERT INTO patronats (id, "tenantId", name, "orgLevel", "territoryName", status,
     "parentPatronatId", "countryId", "subscriptionPlan", "subscriptionStatus",
     "createdAt", "updatedAt")
   VALUES ($1, $2, 'Patronat QA T57 Dept Centre', 'TERRITORIAL', 'Centre', 'ACTIVE',
     $3, $4, 'ESSENTIEL', 'PENDING_PAYMENT', NOW(), NOW())`,
  [childId, childTenantId, NAT_ID, nat.countryId],
);
console.log(`\n✅ Enfant créé: id=${childId} tenant=${childTenantId}`);

// Année scolaire active pour le tenant enfant (comme les vrais patronats)
const year = (
  await client.query(`SELECT * FROM academic_years WHERE "tenantId" = $1 AND "isActive" = true LIMIT 1`, [
    nat.tenantId,
  ])
).rows[0];
if (year) {
  await client.query(
    `INSERT INTO academic_years (id, "tenantId", name, label, "startDate", "endDate", "isActive", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())`,
    [
      randomUUID(),
      childTenantId,
      year.name,
      year.label,
      year.startDate,
      year.endDate,
    ],
  );
  console.log('✅ Année scolaire active créée pour le tenant enfant');
}

// Vérif
const kids = await client.query(
  `SELECT id, name, "tenantId", status FROM patronats WHERE "parentPatronatId" = $1`,
  [NAT_ID],
);
console.log('\nEnfants du national BF:', JSON.stringify(kids.rows, null, 1));

console.log(`\nCHILD_TENANT=${childTenantId}`);
console.log(`CHILD_ID=${childId}`);
await client.end();
