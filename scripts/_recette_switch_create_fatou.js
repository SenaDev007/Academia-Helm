/**
 * Recette switch double casquette — CRÉATION du personnel de test
 * Fatou TEST — secrétaire-enseignante (Staff TEACHER + affectation admin
 * SECRETAIRE + profil Teacher actif + User ENSEIGNANT), conformément aux
 * patterns réels du tenant CSPEB (matricules, statuts, niveaux).
 *
 * Idempotent : supprime d'abord les éventuelles lignes de test existantes.
 */
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'; // CSPEB Eveil d'Afrique
const LEVEL_PRIMAIRE = 'bc434610-8cf6-4415-a51a-cc5300cd99da';
const EMAIL = 'recette.doublecasquette@cspeb.test';
const PASSWORD = 'Recette@2026';
const MATRICULE = 'CSPEBE-26-00013';
const GLOBAL_MATRICULE = 'AH-STF-26-000010';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // ── Nettoyage préalable (idempotence) ──
  await client.query(`DELETE FROM users WHERE email = $1`, [EMAIL]);
  await client.query(`DELETE FROM teachers WHERE email = $1`, [EMAIL]);
  await client.query(`DELETE FROM staff WHERE email = $1`, [EMAIL]); // cascade assignments
  console.log("✓ Lignes de test préexistantes supprimées (s'il y en avait)");

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ── 1. User (compte unique — rôle ENSEIGNANT comme le ferait le
  //       StaffCredentialService pour un staff TEACHER) ──
  const userId = crypto.randomUUID();
  await client.query(
    `INSERT INTO users (id, "tenantId", email, "passwordHash", "firstName", "lastName", role, status, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', now())`,
    [userId, TENANT_ID, EMAIL, passwordHash, 'Fatou', 'TEST', 'ENSEIGNANT'],
  );
  console.log(`✓ User créé: ${EMAIL} (role ENSEIGNANT, actif) — id ${userId}`);

  // ── 2. Staff (roleType TEACHER, ACTIVE — comme une secrétaire-enseignante
  //       embauchée comme enseignante puis dotée d'un poste admin) ──
  const staffId = crypto.randomUUID();
  await client.query(
    `INSERT INTO staff (id, "tenantId", "employeeNumber", "globalMatricule", "tenantMatricule",
        "firstName", "lastName", gender, email, position, "roleType", "hireDate", "contractType",
        status, "schoolLevelId", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'F', $8, $9, 'TEACHER', now(), 'CDI', 'ACTIVE', $10, now())`,
    [staffId, TENANT_ID, MATRICULE, GLOBAL_MATRICULE, MATRICULE,
     'Fatou', 'TEST', EMAIL, 'Instituteur(trice) du Primaire', LEVEL_PRIMAIRE],
  );
  console.log(`✓ Staff créé: ${MATRICULE} (TEACHER/ACTIVE) — id ${staffId}`);

  // ── 3. Profil Teacher actif (casquette enseignante — liaison par email) ──
  const teacherId = crypto.randomUUID();
  await client.query(
    `INSERT INTO teachers (id, "tenantId", "schoolLevelId", matricule, "firstName", "lastName",
        gender, email, position, "hireDate", "contractType", status, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, 'F', $7, $8, now(), 'CDI', 'active', now())`,
    [teacherId, TENANT_ID, LEVEL_PRIMAIRE, MATRICULE, 'Fatou', 'TEST',
     EMAIL, 'Instituteur(trice) du Primaire'],
  );
  console.log(`✓ Teacher créé: matricule ${MATRICULE} (actif, Primaire) — id ${teacherId}`);

  // ── 4. Affectation admin SECRETAIRE (casquette école — la 2e casquette) ──
  const assignmentId = crypto.randomUUID();
  await client.query(
    `INSERT INTO staff_admin_assignments (id, "tenantId", "staffId", "schoolLevelCode",
        "adminRole", "isActive", "updatedAt")
     VALUES ($1, $2, $3, 'MAT_PRI', 'SECRETAIRE', true, now())`,
    [assignmentId, TENANT_ID, staffId],
  );
  console.log(`✓ Affectation admin créée: SECRETAIRE / MAT_PRI (active) — id ${assignmentId}`);

  // ── Récapitulatif ──
  const check = await client.query(`
    SELECT
      (SELECT count(*) FROM users WHERE email = $1 AND role = 'ENSEIGNANT' AND status = 'active') AS user_ok,
      (SELECT count(*) FROM teachers WHERE email = $1 AND matricule = $2 AND status = 'active') AS teacher_ok,
      (SELECT count(*) FROM staff WHERE email = $1 AND "roleType" = 'TEACHER' AND status = 'ACTIVE') AS staff_ok,
      (SELECT count(*) FROM staff_admin_assignments sa JOIN staff s ON s.id = sa."staffId"
        WHERE s.email = $1 AND sa."adminRole" = 'SECRETAIRE' AND sa."isActive" = true) AS assignment_ok`,
    [EMAIL, MATRICULE]);
  const c = check.rows[0];
  console.log(`\n=== VÉRIFICATION === user=${c.user_ok} teacher=${c.teacher_ok} staff=${c.staff_ok} assignment=${c.assignment_ok} (attendu: 1/1/1/1)`);
  console.log(`\nCredentials recette :`);
  console.log(`  Portail ÉCOLE     → email:      ${EMAIL}`);
  console.log(`  Portail ENSEIGNANT → matricule:  ${MATRICULE}`);
  console.log(`  Mot de passe      : ${PASSWORD}`);

  await client.end();
}

main().catch((e) => { console.error('ERREUR:', e.message); process.exit(1); });
