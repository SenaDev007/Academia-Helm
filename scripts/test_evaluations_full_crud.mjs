/**
 * Test CRUD complet évaluations + types d'évaluation avec schoolLevelId correct.
 * Valide que le pattern fonctionne avec school_levels.id (pas education_levels.id).
 */
import pg from 'pg';

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connecté à Neon DB\n');

    const tenantId = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
    const academicYearId = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a';

    // 1. Récupérer le school_levels UUID pour PRIMAIRE
    const slRes = await client.query("SELECT id, code FROM school_levels WHERE code = 'PRIMAIRE' LIMIT 1");
    const schoolLevelId = slRes.rows[0].id;
    console.log(`school_levels PRIMAIRE id: ${schoolLevelId}`);

    // 2. Vérifier qu'il y a des classes pour ce schoolLevelId
    const classesRes = await client.query('SELECT id, name FROM classes WHERE "schoolLevelId" = $1 LIMIT 5', [schoolLevelId]);
    console.log(`Classes pour PRIMAIRE: ${classesRes.rows.length}`);
    classesRes.rows.forEach(c => console.log(`  - ${c.name}`));

    // 3. Vérifier qu'il y a des matières
    const subjectsRes = await client.query('SELECT id, name FROM subjects WHERE "schoolLevelId" = $1 LIMIT 5', [schoolLevelId]);
    console.log(`\nMatières pour PRIMAIRE: ${subjectsRes.rows.length}`);
    subjectsRes.rows.forEach(s => console.log(`  - ${s.name}`));

    // 4. Vérifier les périodes actives
    const periodsRes = await client.query('SELECT id, name, "isActive" FROM academic_periods WHERE "academicYearId" = $1 ORDER BY "periodOrder"', [academicYearId]);
    console.log(`\nPériodes: ${periodsRes.rows.length}`);
    periodsRes.rows.forEach(p => console.log(`  - ${p.name} | active: ${p.isactive} | id: ${p.id.substring(0, 8)}`));

    // 5. Créer un type d'évaluation avec le BON schoolLevelId
    console.log('\n═══ CREATE type évaluation (PRIMAIRE) ═══');
    const typeRes = await client.query(`
      INSERT INTO evaluation_types (id, "tenantId", name, code, "schoolLevelId", "isSystem", "defaultMaxScore", "defaultCoefficient", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, $3, $4, false, 20, 1, NOW(), NOW())
      RETURNING id, name, code, "schoolLevelId"
    `, [tenantId, 'Devoir surveillé', 'DS', schoolLevelId]);
    const typeId = typeRes.rows[0].id;
    console.log(`✅ Type créé: ${typeRes.rows[0].name} (code: ${typeRes.rows[0].code})`);

    // 6. Lister les types pour PRIMAIRE
    const typesRes = await client.query('SELECT id, name, code FROM evaluation_types WHERE "schoolLevelId" = $1', [schoolLevelId]);
    console.log(`\nTypes pour PRIMAIRE: ${typesRes.rows.length}`);
    typesRes.rows.forEach(t => console.log(`  - ${t.code} | ${t.name}`));

    // 7. Créer une évaluation avec startDate + endDate
    console.log('\n═══ CREATE évaluation (avec intervalle dates) ═══');
    const classId = classesRes.rows[0].id;
    const subjectId = subjectsRes.rows[0].id;
    const periodId = periodsRes.rows.find(p => p.isactive)?.id || periodsRes.rows[0].id;

    const evalRes = await client.query(`
      INSERT INTO evaluations (id, "tenantId", "academicYearId", "classId", "subjectId", "periodId", "evaluationTypeId",
                                title, "evaluationDate", "startDate", "endDate", "maxScore", "coefficient", status, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6,
              $7, NOW(), $8, $9, 20, 1, 'PLANNED', NOW(), NOW())
      RETURNING id, title, "startDate", "endDate", status
    `, [
      tenantId, academicYearId, classId, subjectId, periodId, typeId,
      'Test CRUD évaluation',
      new Date(Date.now() - 86400000), // hier
      new Date(Date.now() + 86400000 * 7), // dans 7 jours
    ]);
    const evalRow = evalRes.rows[0];
    console.log(`✅ Évaluation créée:`);
    console.log(`  ID: ${evalRow.id}`);
    console.log(`  Titre: ${evalRow.title}`);
    console.log(`  StartDate: ${evalRow.startDate}`);
    console.log(`  EndDate: ${evalRow.endDate}`);
    console.log(`  Statut: ${evalRow.status}`);

    // 8. Nettoyer
    await client.query('DELETE FROM evaluations WHERE id = $1', [evalRow.id]);
    await client.query('DELETE FROM evaluation_types WHERE id = $1', [typeId]);
    console.log('\n✅ Test terminé — données de test supprimées');

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
