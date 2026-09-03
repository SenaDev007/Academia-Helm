/**
 * Diagnostic complet du scénario double-casquette :
 *   - Portail ENSEIGNANT : matricule + mot de passe
 *   - Portail ÉCOLE       : email + mot de passe (poste administratif)
 *
 * Vérifie toutes les étapes des deux flux de connexion pour Saliou AKPAKI.
 */
import pg from 'pg';
import bcrypt from 'bcryptjs';

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const CSPEB = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
const MATRICULE = 'CSPEBE-26-00008';
const PASSWORD = 'er7oNlc1b4o';

console.log('════════════════════════════════════════════════════════════');
console.log('SCÉNARIO 1 : PORTAIL ENSEIGNANT (matricule + mot de passe)');
console.log('════════════════════════════════════════════════════════════');

// Étape 1 : Teacher par matricule (comme loginTeacher)
const teacher = await client.query(`
  SELECT t.id, t.matricule, t."firstName", t."lastName", t.email, t.status, t."tenantId"
  FROM teachers t
  WHERE t."tenantId" = $1 AND t.matricule = $2 AND t.status = 'active'
`, [CSPEB, MATRICULE]);
console.log('\n[1] Teacher par matricule exact:', teacher.rows.length > 0 ? '✅' : '❌');
if (teacher.rows[0]) console.log('    →', JSON.stringify(teacher.rows[0], null, 2));

// Étape 1b : Teacher par matricule INSENSIBLE À LA CASSE (test de robustesse)
const teacherCI = await client.query(`
  SELECT t.matricule FROM teachers t
  WHERE t."tenantId" = $1 AND LOWER(t.matricule) = LOWER($2) AND t.status = 'active'
`, [CSPEB, MATRICULE.toLowerCase()]);
console.log('[1b] Matricule insensible à la casse:', teacherCI.rows.length > 0 ? '✅ (même résultat)' : '❌');

// Étape 2 : User par teacher.email (comme loginTeacher)
const teacherEmail = teacher.rows[0]?.email;
if (teacherEmail) {
  const user = await client.query(`
    SELECT u.id, u.email, u."firstName", u."lastName", u.role, u.status, u."tenantId"
    FROM users u
    WHERE u."tenantId" = $1 AND u.email = $2 AND u.status = 'active'
  `, [CSPEB, teacherEmail]);
  console.log('\n[2] User par teacher.email (exact):', user.rows.length > 0 ? '✅' : '❌');
  if (user.rows[0]) {
    console.log('    →', JSON.stringify(user.rows[0], null, 2));

    // Étape 3 : mot de passe
    const hash = await client.query(`SELECT u."passwordHash" FROM users u WHERE u.id = $1`, [user.rows[0].id]);
    const pwdOk = await bcrypt.compare(PASSWORD, hash.rows[0].passwordHash);
    console.log('\n[3] Mot de passe vérifié (bcrypt):', pwdOk ? '✅' : '❌');

    // Étape 4 : rôle — liste allowedTeacherRoles de loginTeacher
    const allowedTeacherRoles = [
      'TEACHER', 'ENSEIGNANT', 'TEACHER_RESP',
      'COMPTABLE', 'DIRECTOR', 'ADMIN', 'PROMOTER',
      'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT',
      'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'SUPER_DIRECTOR',
    ];
    const role = user.rows[0].role || '';
    const inList = allowedTeacherRoles.some((r) => role.toUpperCase() === r);
    console.log('[4] Rôle dans allowedTeacherRoles:', inList ? '✅' : '❌ (' + role + ')');

    // Étape 4b : fallback profil teacher (email == user.email)
    const profile = await client.query(`
      SELECT t.matricule FROM teachers t
      WHERE t."tenantId" = $1 AND t.email = $2 AND t.status = 'active'
    `, [CSPEB, user.rows[0].email]);
    console.log('[4b] Fallback profil enseignant actif:', profile.rows.length > 0 ? '✅' : '❌');

    console.log('\n>>> VERDICT PORTAIL ENSEIGNANT :',
      teacher.rows.length > 0 && user.rows.length > 0 && pwdOk && (inList || profile.rows.length > 0)
        ? '✅✅✅ CONNEXION OK'
        : '❌ BLOQUÉ — voir étapes ci-dessus');

    // ── Vérification email casse exacte vs insensible ──
    const emailCase = await client.query(`
      SELECT u.email FROM users u WHERE u."tenantId" = $1 AND LOWER(u.email) = LOWER($2)
    `, [CSPEB, teacherEmail]);
    if (emailCase.rows.length > 0 && emailCase.rows[0].email !== teacherEmail) {
      console.log('\n⚠️  DIFFÉRENCE DE CASSE détectée :');
      console.log('    teacher.email =', JSON.stringify(teacherEmail));
      console.log('    users.email   =', JSON.stringify(emailCase.rows[0].email));
      console.log('    → loginTeacher (match exact) ÉCHOUERAIT alors que le user existe !');
    }

    // ═══════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('SCÉNARIO 2 : PORTAIL ÉCOLE (email + mot de passe)');
    console.log('════════════════════════════════════════════════════════════');

    // Flux /api/auth/login : email direct → findByEmail
    const user2 = await client.query(`
      SELECT u.id, u.email, u.role, u.status, u."tenantId"
      FROM users u WHERE LOWER(u.email) = LOWER($1)
    `, [user.rows[0].email]);
    console.log('\n[5] User par email (recherche unifiée):', user2.rows.length > 0 ? '✅' : '❌');

    // getAllowedPortalsForRole — simulation (listes de auth.service.ts)
    const schoolRoles = [
      'SCHOOL_OWNER', 'BOARD_PRESIDENT', 'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR',
      'PROMOTER', 'PROMOTEUR',
      'SCHOOL_ADMIN', 'ADMIN_AGENT', 'RESP_SCOLARITE', 'DATA_MANAGER', 'INTERNAL_AUDITOR',
      'RESP_MATERNELLE', 'PEDAGOGIC_COORDINATOR', 'EXAM_MANAGER', 'SECRETARY', 'MONITOR',
      'TEACHING_ASSISTANT', 'ACTIVITIES_MANAGER', 'RESP_PRIMAIRE', 'RESP_SECONDAIRE', 'CENSOR',
      'GENERAL_MONITOR', 'ORIENTATION_MANAGER', 'CFO', 'FINANCE_MANAGER', 'ACCOUNTANT', 'CASHIER',
      'RECOVERY_MANAGER', 'PEDAGOGIC_DIRECTOR', 'SCHOOL_LIFE_MANAGER', 'COMMUNICATION_MANAGER',
      'COMMUNICATION_AGENT', 'HR_MANAGER', 'PAYROLL_MANAGER', 'IT_MANAGER', 'LIBRARIAN',
      'CANTEEN_MANAGER', 'TRANSPORT_MANAGER', 'BOARDING_MANAGER', 'HEALTH_MANAGER',
      'SECURITY_MANAGER', 'SETTINGS_MANAGER',
      'DIRECTOR', 'SUPER_DIRECTOR', 'ADMIN', 'DISCIPLINE_MASTER', 'EDUCATION_INSPECTOR',
      'GENERAL_SUPERVISOR', 'BOARDING_MASTER', 'DAYCARE_MANAGER', 'LABORATORY_MANAGER',
      'RECRUITMENT_OFFICER', 'CNSS_MANAGER', 'LEAVE_MANAGER', 'CONTRACT_MANAGER', 'STAFF_MANAGER',
      'QUALITY_MANAGER', 'QHSE_MANAGER', 'EVENT_MANAGER', 'ALUMNI_MANAGER', 'PARTNERSHIP_MANAGER',
      'FUNDING_MANAGER', 'GRANT_MANAGER', 'MAINTENANCE_MANAGER', 'RECEPTIONIST', 'ASSISTANT_DIRECTOR',
      'DEAN_OF_STUDIES', 'PEDAGOGICAL_COORDINATOR', 'LEVEL_HEAD', 'DEPARTMENT_HEAD', 'INTERNSHIP_MANAGER',
      'ORIENTATION_COUNSELOR', 'SOCIAL_WORKER', 'NURSE', 'INFIRMARY_MANAGER', 'SHOP_MANAGER',
      'SCOLARITE', 'CAISSIER', 'COMPTABLE', 'ECONOME',
      'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'CENSEUR', 'SURVEILLANT_GENERAL',
    ];
    const teacherRoles = ['TEACHER', 'HEAD_TEACHER', 'SUBSTITUTE_TEACHER', 'TEACHER_ASSISTANT',
      'DEPARTMENT_COORDINATOR', 'PEDAGOGIC_ADVISOR', 'TEACHER_RESP', 'TEACHER_INTERNSHIP', 'TUTOR',
      'MENTOR', 'EXAMINER', 'TEACHER_RESPONSIBLE', 'CORRECTOR', 'SUPERVISOR', 'ANIMATOR',
      'CONSULTANT', 'INSTITUTEUR'];

    const role2 = user2.rows[0]?.role || '';
    const isSchool = schoolRoles.includes(role2);
    const isTeacherRole = teacherRoles.includes(role2);
    // NB : les rôles non reconnus tombent sur le DÉFAUT SCHOOL (compat arrière)
    const effective = isSchool ? 'SCHOOL (liste)' : isTeacherRole ? 'TEACHER (liste)' : 'SCHOOL (DÉFAUT)';
    console.log('[6] Rôle User :', JSON.stringify(role2));
    console.log('    → getAllowedPortalsForRole =', effective);
    if (!isSchool && !isTeacherRole && role2 === 'ENSEIGNANT') {
      console.log('    ⚠️  ENSEIGNANT n\'est dans AUCUNE liste → tombe sur le DÉFAUT SCHOOL');
      console.log('    → un enseignant PUR pourrait se connecter au portail ÉCOLE (faille de design !)');
    }
    const levelSpecific = /^(DIRECTEUR|SECRETAIRE_COMPTABLE|SECRETAIRE|COMPTABLE|SURVEILLANT_GENERAL|SURVEILLANT|CENSEUR)_(MAT|PRI|SEC|MAT_PRI)$/;
    if (levelSpecific.test(role2)) {
      console.log('    ⚠️  Rôle niveau-spécifique → tombe sur le DÉFAUT SCHOOL (OK pour portail école, mais non listé explicitement)');
    }
    console.log('\n>>> VERDICT PORTAIL ÉCOLE :',
      (isSchool || (!isTeacherRole && role2 !== 'ENSEIGNANT'))
        ? '✅✅✅ CONNEXION OK (rôle ' + effective + ')'
        : '❌ BLOQUÉ pour ce rôle');
  }
}

// ═══════════════════════════════════════════════════════════
console.log('\n════════════════════════════════════════════════════════════');
console.log('SCÉNARIO 3 : DOUBLE CASQUETTE (postes administratifs de Saliou)');
console.log('════════════════════════════════════════════════════════════');

// Staff record (table mappée "staff" en base)
const staff = await client.query(`
  SELECT s.id, s."tenantMatricule", s."globalMatricule", s."employeeNumber",
         s."roleType", s.position, s.status, s.email
  FROM staff s
  WHERE s."tenantId" = $1 AND s."tenantMatricule" = $2
`, [CSPEB, MATRICULE]);
console.log('\n[7] Staff par tenantMatricule:', staff.rows.length > 0 ? '✅' : '❌');
if (staff.rows[0]) console.log('    →', JSON.stringify(staff.rows[0], null, 2));

// Admin assignments (poste administratif)
if (staff.rows[0]) {
  const assign = await client.query(`
    SELECT a."adminRole", a."schoolLevelCode", a."isActive", a."startDate", a."endDate"
    FROM staff_admin_assignments a
    WHERE a."staffId" = $1 AND a."tenantId" = $2
    ORDER BY a."startDate" DESC
  `, [staff.rows[0].id, CSPEB]);
  console.log('\n[8] Affectations administratives:', assign.rows.length > 0 ? '' : '(aucune)');
  assign.rows.forEach(a => console.log('    →', JSON.stringify(a)));

  if (assign.rows.length === 0) {
    console.log('    ℹ️  Saliou n\'a pas de poste administratif → scénario pure enseignant.');
    console.log('    (Le test du double-casquette utilisera un roleType/position similaire.)');
  }
}

// Vérifier la cohérence Staff.email ↔ Teacher.email ↔ User.email
if (staff.rows[0] && teacher.rows[0]) {
  console.log('\n[9] Cohérence des emails :');
  console.log('    staff.email   =', JSON.stringify(staff.rows[0].email));
  console.log('    teacher.email =', JSON.stringify(teacher.rows[0].email));
  const same = (staff.rows[0].email || '').toLowerCase() === (teacher.rows[0].email || '').toLowerCase();
  console.log('    →', same ? '✅ cohérents' : '⚠️  INCOHÉRENTS (liaison User par email fragile)');
}

await client.end();
console.log('\n════════════ FIN DU DIAGNOSTIC ════════════');
