/**
 * ============================================================================
 * SEED EVALUATIONS & NOTES — CSPEB 2026-2027
 * ============================================================================
 *
 * Peuple la base de données avec des évaluations mensuelles et des notes
 * pour l'école CSPEB (Complexe Scolaire Privé Entrepreneurial et Bilingue),
 * année 2026-2027, toutes classes confondues.
 *
 * Structure par trimestre :
 *   T1 : Éval Mensuelle 1 (Juin), Éval Mensuelle 2 (Août), Certificative (Sept)
 *   T2 : Éval Mensuelle 1 (Oct), Éval Mensuelle 2 (Nov), Certificative (Déc)
 *   T3 : Éval Mensuelle 1 (Jan), Éval Mensuelle 2 (Fév), Certificative (Mars)
 *
 * Pour chaque évaluation de chaque classe :
 *   - Crée un AttendanceRegister (si manquant)
 *   - Crée un MonthlyEvaluation avec studentScores peuplé
 *   - Les notes sont aléatoires mais réalistes (8/20 à 18/20)
 *
 * Usage :
 *   node scripts/seed-cspeb-evaluations.js           # Exécution réelle
 *   node scripts/seed-cspeb-evaluations.js --dry-run  # Aperçu sans écriture
 *   node scripts/seed-cspeb-evaluations.js --purge    # Supprime toutes les données de test
 * ============================================================================
 */

const { Client } = require('pg');
const crypto = require('crypto');

// ─── Configuration ─────────────────────────────────────────────────────────
// ⚠️ Utiliser l'endpoint DIRECT (non-poolé) de Neon pour éviter les blocages
// sur les grands payloads JSON. Le pooler PgBouncer a des limitations avec
// les paramètres de grande taille.
const NEON_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const DRY_RUN = process.argv.includes('--dry-run');
const PURGE = process.argv.includes('--purge');

// ─── Structure des trimestres ──────────────────────────────────────────────
const TRIMESTERS = [
  {
    number: 1,
    name: 'Premier Trimestre',
    evaluations: [
      { evalNumber: 1, type: 'Mensuelle 1', month: 6, year: 2026 },
      { evalNumber: 2, type: 'Mensuelle 2', month: 8, year: 2026 },
      { evalNumber: 3, type: 'Certificative', month: 9, year: 2026 },
    ],
  },
  {
    number: 2,
    name: 'Deuxième Trimestre',
    evaluations: [
      { evalNumber: 1, type: 'Mensuelle 1', month: 10, year: 2026 },
      { evalNumber: 2, type: 'Mensuelle 2', month: 11, year: 2026 },
      { evalNumber: 3, type: 'Certificative', month: 12, year: 2026 },
    ],
  },
  {
    number: 3,
    name: 'Troisième Trimestre',
    evaluations: [
      { evalNumber: 1, type: 'Mensuelle 1', month: 1, year: 2027 },
      { evalNumber: 2, type: 'Mensuelle 2', month: 2, year: 2027 },
      { evalNumber: 3, type: 'Certificative', month: 3, year: 2027 },
    ],
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function randomScore() {
  return Math.round((8 + Math.random() * 10) * 10) / 10;
}

function computeTotal(cm, cp) {
  return Math.round((cm + cp) * 10) / 10;
}

function uuid() {
  return crypto.randomUUID();
}

function log(msg) {
  console.log(`[${new Date().toISOString().substring(11, 19)}] ${msg}`);
}

// ─── Script principal ──────────────────────────────────────────────────────

async function main() {
  const client = new Client({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false },
    query_timeout: 60000, // 60s par requête — évite les blocages Neon
    connectionTimeoutMillis: 15000,
  });

  await client.connect();
  log('✅ Connecté à Neon PostgreSQL');

  // ── Mode PURGE ──
  if (PURGE) {
    await purgeTestData(client);
    await client.end();
    return;
  }

  // ── 1. Trouver CSPEB ──
  log('🔍 Recherche du tenant CSPEB...');
  const tenantRes = await client.query(
    `SELECT id, name FROM tenants WHERE slug ILIKE '%cspeb%' OR name ILIKE '%Entrepreneurial et Bilingue%' LIMIT 1`,
  );
  if (tenantRes.rows.length === 0) {
    console.error('❌ Tenant CSPEB non trouvé');
    await client.end();
    process.exit(1);
  }
  const tenantId = tenantRes.rows[0].id;
  log(`✅ Tenant : ${tenantRes.rows[0].name}`);

  // ── 2. Trouver l'année académique 2026-2027 ──
  log('🔍 Recherche année 2026-2027...');
  const yearRes = await client.query(
    `SELECT id, name FROM academic_years WHERE "tenantId" = $1 AND name ILIKE '%2026-2027%' LIMIT 1`,
    [tenantId],
  );
  if (yearRes.rows.length === 0) {
    console.error('❌ Année 2026-2027 non trouvée pour CSPEB');
    await client.end();
    process.exit(1);
  }
  const academicYearId = yearRes.rows[0].id;
  log(`✅ Année : ${yearRes.rows[0].name}`);

  // ── 3. Vérifier/créer les trimestres ──
  log('🔍 Vérification des trimestres...');
  const existingQuarters = await client.query(
    `SELECT id, number FROM quarters WHERE "tenantId" = $1 AND "academicYearId" = $2 ORDER BY number`,
    [tenantId, academicYearId],
  );

  const quarterMap = {};
  for (const q of existingQuarters.rows) {
    quarterMap[q.number] = q.id;
  }

  if (Object.keys(quarterMap).length < 3 && !DRY_RUN) {
    const quarterDefs = [
      { name: 'Premier Trimestre', number: 1, start: '2026-06-01', end: '2026-09-30' },
      { name: 'Deuxième Trimestre', number: 2, start: '2026-10-01', end: '2026-12-31' },
      { name: 'Troisième Trimestre', number: 3, start: '2027-01-01', end: '2027-03-31' },
    ];
    for (const qd of quarterDefs) {
      if (!quarterMap[qd.number]) {
        const qRes = await client.query(
          `INSERT INTO quarters (id, "tenantId", "academicYearId", name, number, "startDate", "endDate", "isCurrent", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW()) RETURNING id`,
          [uuid(), tenantId, academicYearId, qd.name, qd.number, qd.start, qd.end],
        );
        quarterMap[qd.number] = qRes.rows[0].id;
        log(`   ✅ Trimestre ${qd.number} créé`);
      }
    }
  }
  log(`✅ ${Object.keys(quarterMap).length} trimestres disponibles`);

  // ── 4. Trouver toutes les classes ──
  log('🔍 Recherche des classes...');
  const classesRes = await client.query(
    `SELECT id, name FROM classes WHERE "tenantId" = $1 ORDER BY name`,
    [tenantId],
  );
  const classes = classesRes.rows;
  log(`✅ ${classes.length} classe(s)`);

  // ── 5. Trouver les matières ──
  log('🔍 Recherche des matières...');
  const subjectsRes = await client.query(
    `SELECT id, name FROM subjects WHERE "tenantId" = $1 ORDER BY name`,
    [tenantId],
  );
  const allSubjects = subjectsRes.rows;
  log(`✅ ${allSubjects.length} matière(s)`);

  // ── 5b. Trouver un enseignant par défaut (pour AttendanceRegister) ──
  log('🔍 Recherche enseignant par défaut...');
  const teacherRes = await client.query(
    `SELECT id FROM teachers WHERE "tenantId" = $1 LIMIT 1`,
    [tenantId],
  );
  const defaultTeacherId = teacherRes.rows[0]?.id;
  if (defaultTeacherId) {
    log(`✅ Enseignant par défaut : ${defaultTeacherId}`);
  } else {
    log('⚠️  Aucun enseignant trouvé — utilisera NULL');
  }

  // ── 6. Pour chaque classe, créer les évaluations ──
  let totalEvalsCreated = 0;
  let totalScoresCreated = 0;

  for (const cls of classes) {
    log(`\n📋 Classe : ${cls.name}`);

    // Trouver les élèves via student_enrollments (status = 'ACTIVE')
    let studentsRes = await client.query(
      `SELECT s.id, s."firstName", s."lastName", s.gender
       FROM students s
       JOIN student_enrollments se ON se."studentId" = s.id
       WHERE se."tenantId" = $1 AND se."classId" = $2 AND se."academicYearId" = $3
             AND se.status = 'ACTIVE' AND s."isActive" = true
       ORDER BY s."lastName", s."firstName"`,
      [tenantId, cls.id, academicYearId],
    );

    const students = studentsRes.rows;
    if (students.length === 0) {
      log(`   ⚠️  Aucun élève — ignoré`);
      continue;
    }
    log(`   👥 ${students.length} élève(s)`);

    // Trouver les matières de cette classe via class_subjects
    let classSubjectsRes = await client.query(
      `SELECT s.id, s.name FROM subjects s
       JOIN class_subjects cs ON cs."subjectId" = s.id
       WHERE cs."tenantId" = $1 AND cs."classId" = $2
       ORDER BY s.name`,
      [tenantId, cls.id],
    );
    let classSubjects = classSubjectsRes.rows;

    // Fallback: utiliser toutes les matières (limité à 8)
    if (classSubjects.length === 0) {
      classSubjects = allSubjects.slice(0, Math.min(allSubjects.length, 8));
    }
    log(`   📚 ${classSubjects.length} matière(s)`);

    const subjectsConfig = classSubjects.map(s => ({ subjectId: s.id, subjectName: s.name }));

    // ── Pour chaque trimestre ──
    for (const trimester of TRIMESTERS) {
      for (const evalConfig of trimester.evaluations) {
        if (DRY_RUN) {
          log(`   [DRY-RUN] T${trimester.number} ${evalConfig.type} (${evalConfig.month}/${evalConfig.year})`);
          totalEvalsCreated++;
          totalScoresCreated += students.length * classSubjects.length;
          continue;
        }

        // Vérifier/créer l'AttendanceRegister
        log(`   🔍 T${trimester.number} ${evalConfig.type} — vérif AR...`);
        let arRes = await client.query(
          `SELECT id FROM attendance_registers
           WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "classId" = $3 AND month = $4 AND year = $5
           LIMIT 1`,
          [tenantId, academicYearId, cls.id, evalConfig.month, evalConfig.year],
        );

        let attendanceRegisterId;
        if (arRes.rows.length > 0) {
          attendanceRegisterId = arRes.rows[0].id;
        } else {
          log(`   📝 Création AR...`);
          const createAr = await client.query(
            `INSERT INTO attendance_registers (id, "tenantId", "academicYearId", "classId", "teacherId", month, year, "studentsData", status, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, '[]', 'DRAFT', NOW(), NOW()) RETURNING id`,
            [uuid(), tenantId, academicYearId, cls.id, defaultTeacherId, evalConfig.month, evalConfig.year],
          );
          attendanceRegisterId = createAr.rows[0].id;
        }

        // Vérifier si MonthlyEvaluation existe déjà
        log(`   🔍 Vérif ME existant...`);
        const existingEval = await client.query(
          `SELECT id FROM monthly_evaluations WHERE "attendanceRegisterId" = $1`,
          [attendanceRegisterId],
        );
        if (existingEval.rows.length > 0) {
          log(`   ⏭️  T${trimester.number} ${evalConfig.type} — déjà existant`);
          continue;
        }

        log(`   📝 Génération scores...`);

        // ── Générer les studentScores ──
        const studentScores = students.map(student => {
          const scores = classSubjects.map(subject => {
            const cm = randomScore(); // 0-18
            const cp = Math.round(Math.random() * 20) / 10; // 0-2
            return {
              subjectId: subject.id,
              subjectName: subject.name,
              cm,
              cp,
              total: computeTotal(cm, cp),
            };
          });
          const totalGeneral = Math.round(scores.reduce((sum, s) => sum + s.total, 0) * 10) / 10;
          return {
            studentId: student.id,
            nom: student.lastName,
            prenom: student.firstName,
            sexe: student.gender || 'M',
            scores,
            totalGeneral,
            seuilAtteint: totalGeneral / classSubjects.length >= 10.0,
          };
        });

        // Stats
        const totalStudents = students.length;
        const garcons = students.filter(s => (s.gender || 'M').toUpperCase() === 'M').length;
        const filles = totalStudents - garcons;
        const ayantAtteint = studentScores.filter(s => s.seuilAtteint).length;
        const pourcentageReussite = totalStudents > 0 ? Math.round((ayantAtteint / totalStudents) * 10000) / 100 : 0;

        // Insérer en 2 étapes pour éviter le blocage Neon sur les grands JSON
        // Étape 1 : INSERT avec studentScores vide
        log(`   💾 INSERT ME (vide)...`);
        const meInsert = await client.query(
          `INSERT INTO monthly_evaluations
           (id, "tenantId", "academicYearId", "classId", "attendanceRegisterId",
            month, year, "evaluationNumber", "etapeNumber",
            "subjectsConfig", "studentScores", "seuilReussite",
            "effectifTotalGarcons", "effectifTotalFilles", "effectifTotalClasse",
            "ayantComposeG", "ayantComposeF", "ayantComposeTotal",
            "ayantAtteintSeuilG", "ayantAtteintSeuilF", "ayantAtteintSeuilTotal",
            "nAyantPasAtteintG", "nAyantPasAtteintF", "nAyantPasAtteintTotal",
            "pourcentageReussiteG", "pourcentageReussiteF", "pourcentageReussiteTotal",
            status, "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'[]',10.0,$11,$12,$13,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,'SUBMITTED',NOW(),NOW())
           RETURNING id`,
          [
            uuid(), tenantId, academicYearId, cls.id, attendanceRegisterId,
            evalConfig.month, evalConfig.year, evalConfig.evalNumber, trimester.number,
            JSON.stringify(subjectsConfig),
            garcons, filles, totalStudents,
            Math.round(garcons * 0.6), Math.round(filles * 0.6), ayantAtteint,
            Math.round(garcons * 0.4), Math.round(filles * 0.4), totalStudents - ayantAtteint,
            60.0, 60.0, pourcentageReussite,
          ],
        );

        // Étape 2 : UPDATE avec le studentScores complet
        log(`   💾 UPDATE ME (scores)...`);
        await client.query(
          `UPDATE monthly_evaluations SET "studentScores" = $1, "updatedAt" = NOW() WHERE id = $2`,
          [JSON.stringify(studentScores), meInsert.rows[0].id],
        );

        log(`   ✅ T${trimester.number} ${evalConfig.type} — ${students.length}×${classSubjects.length} = ${students.length * classSubjects.length} notes`);
        totalEvalsCreated++;
        totalScoresCreated += students.length * classSubjects.length;
      }
    }
  }

  log(`\n═══════════════════════════════════════════════════════`);
  log(`📊 RÉCAPITULATIF ${DRY_RUN ? '(DRY-RUN)' : ''}`);
  log(`   Évaluations : ${totalEvalsCreated}`);
  log(`   Notes       : ${totalScoresCreated}`);
  log(`   Classes     : ${classes.length}`);
  log(`   Trimestres  : 3 × 3 évaluations = 9 par classe`);
  log(`═══════════════════════════════════════════════════════`);

  if (!DRY_RUN) {
    log(`\n✅ Données injectées. Visibles dans :`);
    log(`   - UI Enseignant → Évaluations mensuelles`);
    log(`   - UI Admin → Examens → Évaluations mensuelles`);
    log(`\n   Purge : node scripts/seed-cspeb-evaluations.js --purge`);
  }

  await client.end();
}

// ─── Purge ─────────────────────────────────────────────────────────────────

async function purgeTestData(client) {
  log('🗑️  PURGE des données de test...');

  const tenantRes = await client.query(
    `SELECT id FROM tenants WHERE slug ILIKE '%cspeb%' OR name ILIKE '%Entrepreneurial et Bilingue%' LIMIT 1`,
  );
  if (tenantRes.rows.length === 0) {
    log('❌ CSPEB non trouvé');
    return;
  }
  const tenantId = tenantRes.rows[0].id;

  const yearRes = await client.query(
    `SELECT id FROM academic_years WHERE "tenantId" = $1 AND name ILIKE '%2026-2027%' LIMIT 1`,
    [tenantId],
  );
  if (yearRes.rows.length === 0) {
    log('❌ Année 2026-2027 non trouvée');
    return;
  }
  const academicYearId = yearRes.rows[0].id;

  // Supprimer dans l'ordre des dépendances
  const meRes = await client.query(
    `DELETE FROM monthly_evaluations WHERE "tenantId" = $1 AND "academicYearId" = $2 RETURNING id`,
    [tenantId, academicYearId],
  );
  log(`   ✅ ${meRes.rowCount} MonthlyEvaluation(s) supprimé(s)`);

  const arRes = await client.query(
    `DELETE FROM attendance_registers WHERE "tenantId" = $1 AND "academicYearId" = $2 RETURNING id`,
    [tenantId, academicYearId],
  );
  log(`   ✅ ${arRes.rowCount} AttendanceRegister(s) supprimé(s)`);

  // Note: on ne supprime pas les quarters car ils peuvent être référencés
  // par grade_validation_batches. Les trimestres sont structuraux, pas de test.

  log('\n✅ Purge terminée');
}

// ─── Run ───────────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('\n❌ Erreur:', error.message);
  process.exit(1);
});
