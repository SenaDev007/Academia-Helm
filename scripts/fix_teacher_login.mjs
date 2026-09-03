import pg from 'pg';
import bcrypt from 'bcryptjs';

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const CSPEB = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
const GHOST = 'a93c9cc9-65f0-44b4-af9f-4d0aaf87ea0e';
const USER_EMAIL = 'dawesakpovi@gmail.com';
const USER_ID = '85256ffe-c532-4aed-813b-06ebaf8937f6';

console.log('=== FIX 1 : Réassigner le User au tenant CSPEB (infos de Saliou) ===');
const upd = await client.query(`
  UPDATE users SET
    "tenantId" = $1,
    "firstName" = 'Saliou',
    "lastName" = 'AKPAKI'
  WHERE email = $2
  RETURNING id, email, "firstName", "lastName", role, status, "tenantId"
`, [CSPEB, USER_EMAIL]);
console.log(JSON.stringify(upd.rows, null, 2));

console.log('\n=== FIX 2 : Mettre à jour le UserTenant (relation multi-écoles) ===');
const updUt = await client.query(`
  UPDATE user_tenants SET
    "tenantId" = $1,
    role = 'DIRECTEUR_MAT_PRI'
  WHERE "userId" = $2 AND "tenantId" = $3
  RETURNING id, "userId", "tenantId", role
`, [CSPEB, USER_ID, GHOST]);
console.log(JSON.stringify(updUt.rows, null, 2));

console.log('\n=== VÉRIFICATION FINALE : simulation du loginTeacher ===');
// Étape 1 du loginTeacher : trouver le Teacher par matricule + tenant + actif
const teacher = await client.query(`
  SELECT t.matricule, t."firstName", t."lastName", t.email, t.status
  FROM teachers t
  WHERE t."tenantId" = $1 AND t.matricule = 'CSPEBE-26-00008' AND t.status = 'active'
`, [CSPEB]);
console.log('Teacher trouvé:', teacher.rows.length > 0 ? '✅' : '❌', JSON.stringify(teacher.rows[0] || null));

// Étape 2 : trouver le User par teacher.email + tenant + actif
if (teacher.rows[0]) {
  const user = await client.query(`
    SELECT u.id, u.email, u."firstName", u."lastName", u.role, u.status, u."tenantId"
    FROM users u
    WHERE u."tenantId" = $1 AND u.email = $2 AND u.status = 'active'
  `, [CSPEB, teacher.rows[0].email]);
  console.log('User trouvé:', user.rows.length > 0 ? '✅' : '❌', JSON.stringify(user.rows[0] || null));

  // Étape 3 : vérifier le mot de passe
  if (user.rows[0]) {
    const hashRow = await client.query(`SELECT "passwordHash" FROM users WHERE id = $1`, [user.rows[0].id]);
    const match = await bcrypt.compare('er7oNlc1b4o', hashRow.rows[0].passwordHash);
    console.log('Mot de passe er7oNlc1b4o:', match ? '✅ VALIDE' : '❌ INVALIDE');
    console.log('\n🎯 LOGIN ENSEIGNANT : ' + (match ? 'FONCTIONNEL' : 'EN ÉCHEC'));
  }
}

await client.end();
console.log('\n✅ Correction terminée');
