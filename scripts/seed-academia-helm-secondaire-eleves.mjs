/**
 * ============================================================================
 * SEED ÉLÈVES SECONDAIRES — Academia Helm
 * ============================================================================
 *
 * ⚠️ Tenant cible : Academia Helm (178d5b6b) — subdomain academia-helm.
 *
 * Crée des élèves pour les 6 classes secondaires sans élèves :
 *   - 5e, 4e, 3e, 1ère C, Seconde A1, Terminale D
 *
 * Suit rigoureusement le flux d'inscription du module Élève :
 *   1. preRegister : crée `students` (status=ACTIVE) + `student_enrollments`
 *      (status=PRE_REGISTERED)
 *   2. admit : génère le matricule via `student_number_sequences` (atomic),
 *      met à jour `students.matricule` + `students.enrollmentYear` +
 *      `students.studentCode`, passe `student_enrollments.status` → ADMITTED,
 *      crée `student_academic_records`
 *
 * 5 élèves par classe (avec noms HELM — cohérent avec la DB Academia Helm).
 *
 * N'inclut PAS la création de guardians (endpoint séparé, non obligatoire
 * pour tester le module Examen).
 *
 * N'inclut PAS la génération du matricule GLOBAL (AH-STU-YY-XXX) — non
 * automatique, nécessite un appel explicite séparé.
 *
 * Idempotent : ne crée que ce qui manque. Si un élève existe déjà avec le
 * même (firstName, lastName, tenantId), il est skippé.
 * ============================================================================
 */
import pg from 'pg';
import crypto from 'crypto';

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const TENANT_ID = '178d5b6b-d4f3-4246-bc8c-76a2e8fc2e4b'; // ⭐ ACADEMIA HELM
const SECONDAIRE_LEVEL_ID = 'c40ca12e-463c-4bfb-94de-466e897e5962';

// Élèves à créer par classe (5 par classe — cohérent avec la DB Academia Helm)
// Prénoms choisis pour éviter les conflits avec les élèves existants
// (Céleste, Julien, Hortense, Maïté, Bahia, Rosalie, Cyrille, Viviane, Gaëlle,
//  Penda, Iris, Gabrielle, Lionel, Régis, Renée, Kévin, Édouard, Mariam,
//  Séverine, Morgane, Abel, Armand, Caroline, Melvin, Ousmane, Aminata,
//  Florence, Diane, Émile, Larissa, Marius, Octave, Priscilla, Quentin,
//  Régine, Sylvain, Thérèse, Ulysse, etc. existent déjà).
const STUDENTS_BY_CLASS = {
  '5e': [
    { firstName: 'Bertin', lastName: 'HELM', gender: 'M', dateOfBirth: '2013-03-15' },
    { firstName: 'Cassia', lastName: 'HELM', gender: 'F', dateOfBirth: '2013-07-22' },
    { firstName: 'Donatien', lastName: 'HELM', gender: 'M', dateOfBirth: '2013-11-08' },
    { firstName: 'Eléonore', lastName: 'HELM', gender: 'F', dateOfBirth: '2014-01-30' },
    { firstName: 'Fiacre', lastName: 'HELM', gender: 'M', dateOfBirth: '2014-05-17' },
  ],
  '4e': [
    { firstName: 'Ginoua', lastName: 'HELM', gender: 'F', dateOfBirth: '2012-09-12' },
    { firstName: 'Hermance', lastName: 'HELM', gender: 'F', dateOfBirth: '2012-12-03' },
    { firstName: 'Igor', lastName: 'HELM', gender: 'M', dateOfBirth: '2013-02-25' },
    { firstName: 'Jovanna', lastName: 'HELM', gender: 'F', dateOfBirth: '2013-06-19' },
    { firstName: 'Kpatcha', lastName: 'HELM', gender: 'M', dateOfBirth: '2013-08-14' },
  ],
  '3e': [
    { firstName: 'Léontine', lastName: 'HELM', gender: 'F', dateOfBirth: '2011-04-21' },
    { firstName: 'Maxime', lastName: 'HELM', gender: 'M', dateOfBirth: '2011-09-09' },
    { firstName: 'Nadeige', lastName: 'HELM', gender: 'F', dateOfBirth: '2011-11-30' },
    { firstName: 'Olaf', lastName: 'HELM', gender: 'M', dateOfBirth: '2012-02-15' },
    { firstName: 'Prosper', lastName: 'HELM', gender: 'M', dateOfBirth: '2012-06-28' },
  ],
  '1ère C': [
    { firstName: 'Régina', lastName: 'HELM', gender: 'F', dateOfBirth: '2008-03-08' },
    { firstName: 'Sylviane', lastName: 'HELM', gender: 'F', dateOfBirth: '2008-07-14' },
    { firstName: 'Théo', lastName: 'HELM', gender: 'M', dateOfBirth: '2008-10-22' },
    { firstName: 'Urbain', lastName: 'HELM', gender: 'M', dateOfBirth: '2009-01-04' },
    { firstName: 'Vianney', lastName: 'HELM', gender: 'M', dateOfBirth: '2009-04-18' },
  ],
  'Seconde A1': [
    { firstName: 'Wilfried', lastName: 'HELM', gender: 'M', dateOfBirth: '2009-08-12' },
    { firstName: 'Xavier', lastName: 'HELM', gender: 'M', dateOfBirth: '2009-12-03' },
    { firstName: 'Yannig', lastName: 'HELM', gender: 'M', dateOfBirth: '2010-03-25' },
    { firstName: 'Zabella', lastName: 'HELM', gender: 'F', dateOfBirth: '2010-06-17' },
    { firstName: 'Aïssatou', lastName: 'HELM', gender: 'F', dateOfBirth: '2010-10-09' },
  ],
  'Terminale D': [
    { firstName: 'Biokou', lastName: 'HELM', gender: 'M', dateOfBirth: '2007-02-28' },
    { firstName: 'Désiré', lastName: 'HELM', gender: 'M', dateOfBirth: '2007-05-15' },
    { firstName: 'Espérance', lastName: 'HELM', gender: 'F', dateOfBirth: '2007-09-21' },
    { firstName: 'Félicie', lastName: 'HELM', gender: 'F', dateOfBirth: '2007-11-04' },
    { firstName: 'Gérald', lastName: 'HELM', gender: 'M', dateOfBirth: '2008-01-19' },
  ],
};

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected to Neon DB\n');

  // ── VÉRIFICATION DE SÉCURITÉ ──────────────────────────────────────────
  console.log('═'.repeat(80));
  console.log('VÉRIFICATION DE SÉCURITÉ — tenant cible');
  console.log('═'.repeat(80));
  const check = await client.query(`SELECT name, subdomain FROM tenants WHERE id = $1`, [TENANT_ID]);
  if (check.rows.length === 0 || check.rows[0].subdomain !== 'academia-helm') {
    console.error('❌ MAUVAIS TENANT ! ABORT');
    process.exit(1);
  }
  console.log(`✓ Tenant : ${check.rows[0].name} (subdomain=${check.rows[0].subdomain})\n`);

  // ── Année académique active ──────────────────────────────────────────
  const activeYear = await client.query(`
    SELECT id, label FROM academic_years
     WHERE "tenantId" = $1 AND "isActive" = true
     ORDER BY "startDate" DESC LIMIT 1
  `, [TENANT_ID]);
  const ACADEMIC_YEAR_ID = activeYear.rows[0].id;
  const ACADEMIC_YEAR_LABEL = activeYear.rows[0].label;
  console.log(`✓ Année active : ${ACADEMIC_YEAR_LABEL} (id=${ACADEMIC_YEAR_ID.substring(0,8)})\n`);

  // ── Trouver l'année d'inscription (enrollmentYear) ────────────────────
  // Le service backend utilise academicYear.name (regex \d{4}) ou startDate.getFullYear()
  const ayDetails = await client.query(`
    SELECT name, "startDate" FROM academic_years WHERE id = $1
  `, [ACADEMIC_YEAR_ID]);
  const yearMatch = ayDetails.rows[0].name.match(/\d{4}/);
  const ENROLLMENT_YEAR = yearMatch ? parseInt(yearMatch[0]) : new Date(ayDetails.rows[0].startDate).getFullYear();
  const YEAR_2 = ENROLLMENT_YEAR.toString().slice(-2);
  console.log(`✓ Enrollment year : ${ENROLLMENT_YEAR} (YY=${YEAR_2})\n`);

  // ── Trouver le schoolCode ─────────────────────────────────────────────
  console.log('━'.repeat(80));
  console.log('Résolution du schoolCode (pour matricule)');
  console.log('━'.repeat(80));
  // ⚠️ On utilise le préfixe déjà en vigueur pour les matricules existants
  // (AHE-E-26-XXX). On lit le préfixe du matricule le plus récent.
  const lastMatricule = await client.query(`
    SELECT matricule FROM students
     WHERE "tenantId" = $1 AND matricule IS NOT NULL
     ORDER BY matricule DESC LIMIT 1
  `, [TENANT_ID]);
  let schoolCode;
  if (lastMatricule.rows.length > 0) {
    // Format : <CODE>-E-<YY>-<XXX>  → on extrait le CODE
    const match = lastMatricule.rows[0].matricule.match(/^([A-Z0-9]+)-E-\d{2}-\d{3}$/);
    schoolCode = match ? match[1] : 'AH';
    console.log(`  schoolCode (extrait des matricules existants) = ${schoolCode}`);
  } else {
    // Fallback : tenant_identity_profiles.schoolAcronym sanitizé
    const identity = await client.query(`
      SELECT "schoolAcronym" FROM tenant_identity_profiles
       WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT 1
    `, [TENANT_ID]);
    if (identity.rows.length > 0 && identity.rows[0].schoolAcronym) {
      schoolCode = identity.rows[0].schoolAcronym
        .toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]/g, '').slice(0, 6);
    } else {
      schoolCode = 'AH';
    }
    console.log(`  schoolCode (fallback tenant_identity_profiles) = ${schoolCode}`);
  }
  console.log();

  // ── Vérifier la séquence actuelle + derniers matricules existants ────
  const seqState = await client.query(`
    SELECT current FROM student_number_sequences WHERE "tenantId" = $1
  `, [TENANT_ID]);
  console.log(`  Séquence actuelle (avant sync) : ${seqState.rows[0]?.current || 'NOT FOUND'}`);

  const lastMatricules = await client.query(`
    SELECT matricule FROM students WHERE "tenantId" = $1 AND matricule IS NOT NULL
     ORDER BY matricule DESC LIMIT 5
  `, [TENANT_ID]);
  console.log('  Derniers matricules :');
  lastMatricules.rows.forEach(r => console.log(`    • ${r.matricule}`));

  // ⭐ Sync de la séquence avec le matricule le plus élevé existant
  // (au cas où la séquence n'a pas été incrémentée correctement)
  if (lastMatricules.rows.length > 0) {
    const lastSeqMatch = lastMatricules.rows[0].matricule.match(/-(\d+)$/);
    if (lastSeqMatch) {
      const lastSeq = parseInt(lastSeqMatch[1]);
      const currentSeq = seqState.rows[0]?.current || 0;
      if (lastSeq > currentSeq) {
        // Réinitialiser la séquence à lastSeq (prochain élève sera lastSeq+1)
        console.log(`  ⚠️ Séquence désynchronisée — recalage de ${currentSeq} → ${lastSeq}`);
        await client.query(`
          UPDATE student_number_sequences
             SET current = $1, "updatedAt" = NOW()
           WHERE "tenantId" = $2
        `, [lastSeq, TENANT_ID]);
      }
    }
  }
  console.log();

  // ── Classes secondaires concernées ────────────────────────────────────
  console.log('━'.repeat(80));
  console.log('Classes secondaires à peupler');
  console.log('━'.repeat(80));
  const classes = await client.query(`
    SELECT id, name, "officialClassId" FROM classes
     WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "schoolLevelId" = $3
     ORDER BY name
  `, [TENANT_ID, ACADEMIC_YEAR_ID, SECONDAIRE_LEVEL_ID]);

  for (const cls of classes.rows) {
    const students = await client.query(`
      SELECT COUNT(*)::int AS cnt FROM student_enrollments
       WHERE "classId" = $1 AND "academicYearId" = $2 AND status = 'ACTIVE'
    `, [cls.id, ACADEMIC_YEAR_ID]);
    console.log(`  • ${cls.name} (id=${cls.id.substring(0,8)}, officialId=${cls.officialClassId ? cls.officialClassId.substring(0,8) : 'NULL'}) — ${students.rows[0].cnt} élève(s)`);
  }
  console.log();

  // ── Boucle de création des élèves ────────────────────────────────────
  let totalCreated = 0;
  let totalSkipped = 0;

  for (const cls of classes.rows) {
    const studentsToCreate = STUDENTS_BY_CLASS[cls.name];
    if (!studentsToCreate) {
      console.log(`── ${cls.name} : pas dans STUDENTS_BY_CLASS — SKIP`);
      continue;
    }

    console.log('═'.repeat(80));
    console.log(`Classe : ${cls.name} — ${studentsToCreate.length} élèves à créer`);
    console.log('═'.repeat(80));

    for (const stu of studentsToCreate) {
      // Vérifier si l'élève existe déjà (même firstName + lastName + tenantId)
      const existing = await client.query(`
        SELECT id FROM students
         WHERE "tenantId" = $1 AND "firstName" = $2 AND "lastName" = $3
         LIMIT 1
      `, [TENANT_ID, stu.firstName, stu.lastName]);

      if (existing.rows.length > 0) {
        console.log(`  ⚠️ ${stu.firstName} ${stu.lastName} existe déjà — SKIP`);
        totalSkipped++;
        continue;
      }

      // ── ÉTAPE 1 : preRegister ───────────────────────────────────────
      // Crée student + student_enrollment (status=PRE_REGISTERED)
      const studentId = crypto.randomUUID();
      const enrollmentId = crypto.randomUUID();
      const enrollmentDate = new Date();

      // Insert student
      await client.query(`
        INSERT INTO students (
          id, "tenantId", "academicYearId", "currentAcademicYearId", "schoolLevelId",
          "firstName", "lastName", "dateOfBirth", gender, nationality,
          status, "isActive", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, 'Béninoise', 'ACTIVE', true, NOW(), NOW())
      `, [
        studentId, TENANT_ID, ACADEMIC_YEAR_ID, SECONDAIRE_LEVEL_ID,
        stu.firstName, stu.lastName,
        new Date(stu.dateOfBirth).toISOString(),
        stu.gender || null,
      ]);

      // Insert student_enrollment (status=PRE_REGISTERED)
      await client.query(`
        INSERT INTO student_enrollments (
          id, "tenantId", "academicYearId", "schoolLevelId", "studentId",
          "classId", "academicClassId", "enrollmentType", "enrollmentDate",
          status, "createdAt", "updatedAt", "previousArrears"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'NEW', $8, 'PRE_REGISTERED', NOW(), NOW(), 0)
      `, [
        enrollmentId, TENANT_ID, ACADEMIC_YEAR_ID, SECONDAIRE_LEVEL_ID,
        studentId,
        cls.id,                       // classId (classe physique)
        cls.officialClassId,           // academicClassId (classe officielle)
        enrollmentDate,
      ]);

      // ── ÉTAPE 2 : admit ─────────────────────────────────────────────
      // Génère le matricule via student_number_sequences (atomic)
      // La table student_number_sequences a un id NOT NULL sans default,
      // donc on doit gérer l'UPSERT manuellement (la séquence existe déjà).
      let seqNum;
      const existingSeq = await client.query(`
        SELECT current FROM student_number_sequences WHERE "tenantId" = $1
      `, [TENANT_ID]);
      if (existingSeq.rows.length === 0) {
        // Créer la séquence avec un UUID
        const newSeqId = crypto.randomUUID();
        const ins = await client.query(`
          INSERT INTO student_number_sequences (id, "tenantId", current, "updatedAt")
          VALUES ($1, $2, 1, NOW())
          RETURNING current
        `, [newSeqId, TENANT_ID]);
        seqNum = ins.rows[0].current;
      } else {
        // Incrémenter atomiquement
        const upd = await client.query(`
          UPDATE student_number_sequences
             SET current = current + 1, "updatedAt" = NOW()
           WHERE "tenantId" = $1
           RETURNING current
        `, [TENANT_ID]);
        seqNum = upd.rows[0].current;
      }
      const matricule = `${schoolCode}-E-${YEAR_2}-${String(seqNum).padStart(3, '0')}`;

      // Update student with matricule
      await client.query(`
        UPDATE students
           SET matricule = $1, "enrollmentYear" = $2, "studentCode" = $1,
               "currentAcademicYearId" = $3, "updatedAt" = NOW()
         WHERE id = $4
      `, [matricule, ENROLLMENT_YEAR, ACADEMIC_YEAR_ID, studentId]);

      // Update enrollment status → ADMITTED
      await client.query(`
        UPDATE student_enrollments
           SET status = 'ADMITTED', "updatedAt" = NOW()
         WHERE id = $1
      `, [enrollmentId]);

      // Créer student_academic_record
      const sarId = crypto.randomUUID();
      await client.query(`
        INSERT INTO student_academic_records (
          id, "tenantId", "studentId", "academicYearId", "schoolLevelId",
          "classId", "enrollmentStatus", "totalAbsences", "totalIncidents", "totalSanctions",
          "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, 'ADMITTED', 0, 0, 0, NOW(), NOW())
        ON CONFLICT ("studentId", "academicYearId") DO UPDATE SET
          "enrollmentStatus" = 'ADMITTED',
          "classId" = $6,
          "updatedAt" = NOW()
      `, [sarId, TENANT_ID, studentId, ACADEMIC_YEAR_ID, SECONDAIRE_LEVEL_ID, cls.id]);

      console.log(`  ✓ ${stu.firstName} ${stu.lastName} (matricule=${matricule})`);
      totalCreated++;
    }
    console.log();
  }

  // ── Stats finales ─────────────────────────────────────────────────────
  console.log('═'.repeat(80));
  console.log('CRÉATION D\'ÉLÈVES TERMINÉE (Academia Helm)');
  console.log('═'.repeat(80));
  console.log(`  Élèves créés : ${totalCreated}`);
  console.log(`  Élèves skippés (existaient déjà) : ${totalSkipped}`);

  // Vérification par classe
  console.log('\nVérification par classe secondaire :');
  const finalClasses = await client.query(`
    SELECT c.id, c.name FROM classes c
     WHERE c."tenantId" = $1 AND c."academicYearId" = $2 AND c."schoolLevelId" = $3
     ORDER BY c.name
  `, [TENANT_ID, ACADEMIC_YEAR_ID, SECONDAIRE_LEVEL_ID]);
  for (const cls of finalClasses.rows) {
    const cnt = await client.query(`
      SELECT COUNT(*)::int AS cnt FROM student_enrollments
       WHERE "classId" = $1 AND "academicYearId" = $2 AND status = 'ADMITTED'
    `, [cls.id, ACADEMIC_YEAR_ID]);
    console.log(`  • ${cls.name} : ${cnt.rows[0].cnt} élève(s) ADMITTED`);
  }

  // Total students
  const total = await client.query(`
    SELECT COUNT(*)::int AS cnt FROM students
     WHERE "tenantId" = $1 AND "schoolLevelId" = $2
  `, [TENANT_ID, SECONDAIRE_LEVEL_ID]);
  console.log(`\nTotal élèves secondaires (Academia Helm) : ${total.rows[0].cnt}`);

  await client.end();
  console.log('\n✅ Création terminée');
}

main().catch(err => {
  console.error('❌ FATAL:', err);
  console.error(err.stack);
  process.exit(1);
});
