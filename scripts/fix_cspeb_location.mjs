/**
 * ⭐ Data fix (2026-09-29) — CSPEB (« Complexe Scolaire Privé Entrepreneurial
 * et Bilingue - Eveil d'Afrique Education », id 59b8c348…) :
 * son tenant existe mais AUCUNE fiche School ne lui est rattachée → aucune
 * ville/département → invisible dans la découverte territoriale du patronat
 * du Borgou (rapprochement par ville/département impossible).
 *
 * Correctif : CRÉATION de la fiche School manquante avec
 * city = 'Parakou', department = 'Borgou' (localisation réelle de l'école).
 * (Le code prévoit désormais AUSSI un groupe « Localisation non renseignée »
 * pour les écoles sans localisation — mais la fiche doit exister et être juste.)
 */
import pg from 'pg';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const CSPEB_TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';

// 1. État avant
const tenant = await client.query(`SELECT id, name FROM tenants WHERE id = $1`, [CSPEB_TENANT_ID]);
if (!tenant.rows[0]) {
  console.log('ERREUR : tenant CSPEB introuvable.');
  process.exit(1);
}
console.log(`Tenant : ${tenant.rows[0].name}`);

const before = await client.query(
  `SELECT id, city, department FROM schools WHERE "tenantId" = $1`,
  [CSPEB_TENANT_ID],
);

if (before.rows[0]) {
  // 2a. Fiche existante — complète la localisation si absente
  const updated = await client.query(
    `UPDATE schools SET city = COALESCE(city, 'Parakou'), department = COALESCE(department, 'Borgou'), "updatedAt" = NOW()
     WHERE "tenantId" = $1 AND (city IS NULL OR department IS NULL) RETURNING city, department`,
    [CSPEB_TENANT_ID],
  );
  console.log('Fiche existante mise à jour :', JSON.stringify(updated.rows[0] ?? 'aucun changement nécessaire'));
} else {
  // 2b. AUCUNE fiche School — création avec la localisation réelle
  const created = await client.query(
    `INSERT INTO schools (id, "tenantId", name, city, department, "primaryColor", "secondaryColor", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'Parakou', 'Borgou', '#3b82f6', '#10b981', NOW(), NOW())
     RETURNING id, name, city, department`,
    [randomUUID(), CSPEB_TENANT_ID, tenant.rows[0].name],
  );
  console.log('Fiche School CRÉÉE :', JSON.stringify(created.rows[0]));
}

// 3. Vérification
const after = await client.query(
  `SELECT t.name, s.city, s.department FROM schools s JOIN tenants t ON t.id = s."tenantId" WHERE s."tenantId" = $1`,
  [CSPEB_TENANT_ID],
);
console.log('VÉRIFICATION :', JSON.stringify(after.rows[0]));

await client.end();

