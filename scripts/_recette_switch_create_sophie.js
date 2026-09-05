/**
 * Recette switch — 2e personnel de test : Sophie TEST
 * SECRÉTAIRE-ENSEIGNANTE au sens « rôle admin principal » (comme Aurore AKPOVI
 * en production) : User role SECRETAIRE + Staff ADMIN + profil Teacher actif.
 * → Portail ÉCOLE = /app/secretaire (AdminPortalShell, footer bouton Basculer)
 * → Portail ENSEIGNANT = /app/teacher (TeacherLayout, footer bouton Basculer)
 */
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
const LEVEL_PRIMAIRE = 'bc434610-8cf6-4415-a51a-cc5300cd99da';
const EMAIL = 'recette.sophie@cspeb.test';
const PASSWORD = 'Recette@2026';
const MATRICULE = 'CSPEBE-26-00014';
const GLOBAL_MATRICULE = 'AH-STF-26-000011';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  await client.query(`DELETE FROM users WHERE email = $1`, [EMAIL]);
  await client.query(`DELETE FROM teachers WHERE email = $1`, [EMAIL]);
  await client.query(`DELETE FROM staff WHERE email = $1`, [EMAIL]);
  console.log("✓ Nettoyage préalable effectué");

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // 1. User — rôle SECRETAIRE (casquette école principale)
  const userId = crypto.randomUUID();
  await client.query(
    `INSERT INTO users (id, "tenantId", email, "passwordHash", "firstName", "lastName", role, status, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, 'SECRETAIRE', 'active', now())`,
    [userId, TENANT_ID, EMAIL, passwordHash, 'Sophie', 'TEST'],
  );
  console.log(`✓ User créé: ${EMAIL} (role SECRETAIRE)`);

  // 2. Staff ADMIN (position Secrétaire)
  const staffId = crypto.randomUUID();
  await client.query(
    `INSERT INTO staff (id, "tenantId", "employeeNumber", "globalMatricule", "tenantMatricule",
        "firstName", "lastName", gender, email, position, "roleType", "hireDate", "contractType",
        status, "schoolLevelId", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'F', $8, 'Secrétaire', 'ADMIN', now(), 'CDI', 'ACTIVE', $9, now())`,
    [staffId, TENANT_ID, MATRICULE, GLOBAL_MATRICULE, MATRICULE, 'Sophie', 'TEST', EMAIL, LEVEL_PRIMAIRE],
  );
  console.log(`✓ Staff créé: ${MATRICULE} (ADMIN/ACTIVE, position Secrétaire)`);

  // 3. Profil Teacher actif (casquette enseignante — liaison par email)
  const teacherId = crypto.randomUUID();
  await client.query(
    `INSERT INTO teachers (id, "tenantId", "schoolLevelId", matricule, "firstName", "lastName",
        gender, email, position, "hireDate", "contractType", status, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, 'F', $7, $8, now(), 'CDI', 'active', now())`,
    [teacherId, TENANT_ID, LEVEL_PRIMAIRE, MATRICULE, 'Sophie', 'TEST', EMAIL, 'Instituteur(trice) du Primaire'],
  );
  console.log(`✓ Teacher créé: matricule ${MATRICULE} (actif)`);

  console.log(`\nCredentials Sophie TEST :`);
  console.log(`  Portail ÉCOLE (email): ${EMAIL}`);
  console.log(`  Portail ENSEIGNANT (matricule): ${MATRICULE}`);
  console.log(`  Mot de passe: ${PASSWORD}`);

  await client.end();
}

main().catch((e) => { console.error('ERREUR:', e.message); process.exit(1); });
