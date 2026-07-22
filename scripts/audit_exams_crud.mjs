import pg from 'pg';
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

console.log('='.repeat(80));
console.log('AUDIT CRUD MODULE EXAMEN — Vérification BDD');
console.log('='.repeat(80));

// 1. Vérifier les tables du module examen
console.log('\n📋 1. TABLES DU MODULE EXAMEN');
const tables = await client.query(`
  SELECT table_name,
         (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as col_count
  FROM information_schema.tables t
  WHERE table_schema = 'public'
    AND table_name IN (
      'academic_periods', 'school_academic_settings', 'academic_settings_audit_logs',
      'evaluations', 'evaluation_types', 'grade_scales', 'exam_calculation_rules',
      'grade_validation_batches', 'grade_locks', 'student_period_averages',
      'student_subject_averages', 'student_council_decisions',
      'academic_audit_logs', 'grade_correction_requests',
      'qualitative_scales', 'level_evaluation_policies', 'bilingual_pedagogy_policies',
      'bulletin_templates', 'bulletin_publication_policies', 'exam_advanced_settings',
      'academic_mention_rules', 'academic_decision_rules', 'academic_analytics_snapshots',
      'evaluation_sessions', 'evaluation_participants', 'kindergarten_evaluation_domains',
      'evaluation_competencies', 'evaluation_results', 'result_correction_requests',
      'result_import_batches', 'bulletins',
      'exams', 'grades', 'exam_scores', 'report_cards', 'class_councils'
    )
  ORDER BY table_name
`);
console.log(`  ${tables.rows.length} tables trouvées:`);
for (const t of tables.rows) {
  console.log(`  ✓ ${t.table_name.padEnd(40)} ${t.col_count} colonnes`);
}

// 2. Vérifier les données dans chaque table
console.log('\n📋 2. DONNÉES DANS CHAQUE TABLE');
const dataTables = [
  'school_academic_settings', 'evaluations', 'evaluation_types', 'grade_scales',
  'exam_calculation_rules', 'grades', 'exam_scores', 'report_cards',
  'student_period_averages', 'student_subject_averages',
  'class_councils', 'academic_audit_logs', 'grade_locks',
  'qualitative_scales', 'level_evaluation_policies', 'bilingual_pedagogy_policies',
  'bulletin_templates', 'bulletin_publication_policies', 'exam_advanced_settings',
  'academic_mention_rules', 'academic_decision_rules',
  'evaluation_sessions', 'evaluation_results', 'bulletins',
];
for (const table of dataTables) {
  try {
    const count = await client.query(`SELECT COUNT(*)::int as count FROM "${table}"`);
    const countVal = count.rows[0].count;
    const status = countVal > 0 ? '✅' : '⚠️';
    console.log(`  ${status} ${table.padEnd(40)} ${countVal} enregistrement(s)`);
  } catch (err) {
    console.log(`  ❌ ${table.padEnd(40)} ERREUR: ${err.message.substring(0, 50)}`);
  }
}

// 3. Vérifier les periods académiques
console.log('\n📋 3. PÉRIODES ACADÉMIQUES');
const periods = await client.query('SELECT * FROM "academic_periods" LIMIT 10');
if (periods.rows.length === 0) {
  console.log('  ⚠️ Aucune période académique configurée');
} else {
  for (const p of periods.rows) {
    console.log(`  ✓ ${p.name} (${p.type}) — ${p.startdate} → ${p.enddate} — active=${p.isactive}`);
  }
}

// 4. Vérifier les evaluations
console.log('\n📋 4. ÉVALUATIONS');
const evals = await client.query(`
  SELECT e.id, e.title, e.status, e."evaluationDate", e."maxScore", e.coefficient,
         c.name as class_name, s.name as subject_name
  FROM evaluations e
  LEFT JOIN classes c ON c.id = e."classId"
  LEFT JOIN subjects s ON s.id = e."subjectId"
  LIMIT 10
`);
if (evals.rows.length === 0) {
  console.log('  ⚠️ Aucune évaluation créée');
} else {
  for (const e of evals.rows) {
    console.log(`  ✓ ${e.title || 'Sans titre'} | ${e.class_name || '?'} | ${e.subject_name || '?'} | ${e.status} | /${e.maxscore} | coef=${e.coefficient}`);
  }
}

// 5. Vérifier les evaluation_types
console.log('\n📋 5. TYPES D\'ÉVALUATION');
const evalTypes = await client.query('SELECT * FROM "evaluation_types" LIMIT 10');
if (evalTypes.rows.length === 0) {
  console.log('  ⚠️ Aucun type d\'évaluation configuré');
} else {
  for (const t of evalTypes.rows) {
    console.log(`  ✓ ${t.name} | /${t.defaultmaxscore} | coef=${t.defaultcoefficient}`);
  }
}

// 6. Vérifier les grades
console.log('\n📋 6. NOTES (GRADES)');
const grades = await client.query(`
  SELECT g.id, g.score, g."maxScore", g.status, g."qualitativeCode",
         s."firstName", s."lastName"
  FROM grades g
  LEFT JOIN students s ON s.id = g."studentId"
  LIMIT 10
`);
if (grades.rows.length === 0) {
  console.log('  ⚠️ Aucune note saisie');
} else {
  for (const g of grades.rows) {
    console.log(`  ✓ ${g.firstName || '?'} ${g.lastName || '?'} | note=${g.score}/${g.maxscore} | statut=${g.status} | qual=${g.qualitativecode || '—'}`);
  }
}

// 7. Vérifier les school_academic_settings
console.log('\n📋 7. CONFIGURATIONS ACADÉMIQUES');
const settings = await client.query(`
  SELECT id, name, status, "countryCode", "isActive", version
  FROM "school_academic_settings"
  LIMIT 10
`);
if (settings.rows.length === 0) {
  console.log('  ⚠️ Aucune configuration académique créée');
  console.log('  → L\'onglet Paramètres est vide — l\'école n\'a pas encore configuré son système d\'évaluation');
} else {
  for (const s of settings.rows) {
    console.log(`  ✓ ${s.name} | pays=${s.countrycode} | statut=${s.status} | actif=${s.isactive} | v${s.version}`);
  }
}

// 8. Vérifier les bulletins
console.log('\n📋 8. BULLETINS');
const bulletins = await client.query(`
  SELECT b.id, b."bulletinNumber", b.status, b."pdfUrl"
  FROM bulletins b
  LIMIT 10
`);
if (bulletins.rows.length === 0) {
  console.log('  ⚠️ Aucun bulletin généré');
} else {
  for (const b of bulletins.rows) {
    console.log(`  ✓ ${b.bulletinnumber} | statut=${b.status} | PDF=${b.pdfurl ? 'oui' : 'non'}`);
  }
}

// 9. Vérifier les class_councils
console.log('\n📋 9. CONSEILS DE CLASSE');
const councils = await client.query(`
  SELECT cc.id, cc.status, cc."councilDate", c.name as class_name
  FROM class_councils cc
  LEFT JOIN classes c ON c.id = cc."classId"
  LIMIT 10
`);
if (councils.rows.length === 0) {
  console.log('  ⚠️ Aucun conseil de classe programmé');
} else {
  for (const c of councils.rows) {
    console.log(`  ✓ ${c.class_name || '?'} | ${c.status} | date=${c.councildate || '—'}`);
  }
}

// 10. Vérifier les academic_audit_logs
console.log('\n📋 10. AUDIT LOGS');
const auditLogs = await client.query(`
  SELECT "entityType", "action", COUNT(*)::int as count
  FROM "academic_audit_logs"
  GROUP BY "entityType", "action"
  ORDER BY count DESC
  LIMIT 10
`);
if (auditLogs.rows.length === 0) {
  console.log('  ⚠️ Aucun log d\'audit — aucune action n\'a été effectuée dans le module examen');
} else {
  for (const a of auditLogs.rows) {
    console.log(`  ✓ ${a.entitytype} → ${a.action} (${a.count}x)`);
  }
}

// 11. Vérifier les grades_locks
console.log('\n📋 11. VERROUS');
const locks = await client.query('SELECT COUNT(*)::int as count FROM "grade_locks"');
console.log(`  ${locks.rows[0].count > 0 ? '✅' : '⚠️'} ${locks.rows[0].count} verrou(s) actif(s)`);

// 12. Vérifier les qualitative_scales (maternelle)
console.log('\n📋 12. ÉCHELLES QUALITATIVES (MATERNELLE)');
const scales = await client.query('SELECT * FROM "qualitative_scales" LIMIT 10');
if (scales.rows.length === 0) {
  console.log('  ⚠️ Aucune échelle qualitative configurée pour la maternelle');
} else {
  for (const s of scales.rows) {
    console.log(`  ✓ ${s.code} = ${s.label} (rang ${s.rank})`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('FIN DE L\'AUDIT');
console.log('='.repeat(80));

await client.end();
