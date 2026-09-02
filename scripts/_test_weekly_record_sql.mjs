/**
 * ⭐ Smoke test SQL — vérifie les nouvelles requêtes du Weekly Record
 *    directement sur la base Neon (sans lancer le serveur NestJS).
 */
import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

await client.connect();

try {
  // 1. getPendingMonthlyPlans avec documentType=WEEKLY_RECORD
  const pending = await client.query(`
    SELECT
      mp."classLevel", mp."month", mp."teacherId", mp."documentType",
      mp."headTeacherInitials", mp."headTeacherDate", mp."weekDates",
      mp."submittedAt", mp."teacherSignature", mp."directorSignature",
      mp."directorObservation", mp."validatedAt",
      COUNT(mp.id) AS "cellCount",
      u."firstName" AS "teacherFirstName", u."lastName" AS "teacherLastName",
      c."name" AS "className"
    FROM "monthly_plans" mp
    LEFT JOIN "users" u ON u.id = mp."teacherId"
    LEFT JOIN "classes" c ON c."officialClassId" = mp."classLevel"
    WHERE mp."tenantId" = $1 AND mp."academicYearId" = $2
      AND mp."status" = $3 AND mp."documentType" = $4
    GROUP BY mp."classLevel", mp."month", mp."teacherId", mp."documentType",
             mp."headTeacherInitials", mp."headTeacherDate", mp."weekDates",
             mp."submittedAt", mp."teacherSignature",
             mp."directorSignature", mp."directorObservation", mp."validatedAt",
             u."firstName", u."lastName", u."role", c."name"
    ORDER BY mp."submittedAt" DESC
  `, ['00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'SUBMITTED', 'WEEKLY_RECORD']);
  console.log('✅ Requête pending (documentType) OK —', pending.rows.length, 'lignes');

  // 2. Catalogue Weekly Records (requête principale)
  const catalogue = await client.query(`
    SELECT mp."id", mp."academicYearId", mp."classLevel", mp."month",
           mp."trimester", mp."status", mp."submittedAt", mp."validatedAt",
           mp."teacherId", mp."documentType", mp."weekDates",
           u."firstName" AS "teacherFirstName", u."lastName" AS "teacherLastName",
           COUNT(mp.id) OVER (PARTITION BY mp."academicYearId", mp."classLevel", mp."month", mp."teacherId") AS "cellCount"
    FROM "monthly_plans" mp
    LEFT JOIN "users" u ON u.id = mp."teacherId"
    WHERE mp."tenantId" = $1 AND mp."documentType" = 'WEEKLY_RECORD'
      AND mp."month" IN ('First Term','Second Term','Third Term')
    ORDER BY mp."trimester" ASC
  `, ['00000000-0000-0000-0000-000000000000']);
  console.log('✅ Requête catalogue OK —', catalogue.rows.length, 'lignes');

  // 3. Résolution des noms de classes (ANY($2::text[]))
  const classLevels = ['CM2'];
  const classRows = await client.query(`
    SELECT "officialClassId", MIN("name") AS "name"
    FROM "classes"
    WHERE "tenantId" = $1 AND "officialClassId" = ANY($2::text[])
    GROUP BY "officialClassId"
  `, ['00000000-0000-0000-0000-000000000000', classLevels]);
  console.log('✅ Requête résolution classes OK —', classRows.rows.length, 'lignes');

  // 4. Insertion d'un Weekly Record de test + lecture + delete (test save/get complet)
  const tenant = await client.query(`SELECT "id" FROM "tenants" LIMIT 1`);
  const year = await client.query(`SELECT "id" FROM "academic_years" WHERE "tenantId" = $1 LIMIT 1`, [tenant.rows[0].id]);
  const schoolLevel = await client.query(`SELECT "id" FROM "school_levels" WHERE "tenantId" = $1 LIMIT 1`, [tenant.rows[0].id]);
  if (year.rows.length && schoolLevel.rows.length) {
    const testId = 'test-wro-' + Date.now();
    await client.query(`
      INSERT INTO "monthly_plans" (
        "id", "tenantId", "academicYearId", "schoolLevelId", "classLevel",
        "teacherId", "trimester", "month", "weekNumber",
        "domain", "subDomain", "content", "isAutoProposed", "isCustom",
        "documentType", "headTeacherInitials", "headTeacherDate", "headTeacherSignature", "weekDates",
        "createdAt", "updatedAt"
      ) VALUES ($1,$2,$3,$4,'TEST_CLS','test-teacher',1,'First Term',0,
        'Mathematics','3','<p>Test content</p>',false,true,
        'WEEKLY_RECORD','J.K.','2026-09-15',NULL,'["2026-09-11"]',
        NOW(), NOW())
    `, [testId, tenant.rows[0].id, year.rows[0].id, schoolLevel.rows[0].id]);
    console.log('✅ Insertion WRO avec documentType + headTeacher + weekDates OK');

    const sel = await client.query(`
      SELECT * FROM "monthly_plans"
      WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "classLevel" = 'TEST_CLS'
        AND "month" = 'First Term' AND "documentType" = 'WEEKLY_RECORD'
    `, [tenant.rows[0].id, year.rows[0].id]);
    const row = sel.rows[0];
    console.log('✅ Lecture filtrée documentType OK —', sel.rows.length, 'ligne(s)');
    console.log('   documentType:', row.documentType, '| headTeacherInitials:', row.headTeacherInitials, '| weekDates:', row.weekDates);

    // 5. Test director-observations (insert DIRECTOR_OBS + update directorObservation)
    await client.query(`
      INSERT INTO "monthly_plans" (
        "id", "tenantId", "academicYearId", "schoolLevelId", "classLevel",
        "teacherId", "trimester", "month", "weekNumber",
        "domain", "subDomain", "content", "isAutoProposed", "isCustom", "documentType",
        "createdAt", "updatedAt"
      ) VALUES ($1,$2,$3,$4,'TEST_CLS','test-teacher',1,'First Term',0,
        'Mathematics','DIRECTOR_OBS','Good work',false,true,'WEEKLY_RECORD',NOW(),NOW())
    `, ['test-wro-obs-' + Date.now(), tenant.rows[0].id, year.rows[0].id, schoolLevel.rows[0].id]);
    await client.query(`
      UPDATE "monthly_plans" SET "directorObservation" = $3, "updatedAt" = NOW()
      WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "classLevel" = 'TEST_CLS'
        AND "month" = 'First Term' AND "teacherId" = 'test-teacher' AND "documentType" = 'WEEKLY_RECORD'
    `, [tenant.rows[0].id, year.rows[0].id, 'General obs test']);
    const check = await client.query(`
      SELECT "directorObservation" FROM "monthly_plans"
      WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "classLevel" = 'TEST_CLS' AND "subDomain" = 'DIRECTOR_OBS'
    `, [tenant.rows[0].id, year.rows[0].id]);
    console.log('✅ Observations directeur OK — general =', check.rows[0].directorObservation);

    // Cleanup
    await client.query(`DELETE FROM "monthly_plans" WHERE "classLevel" = 'TEST_CLS'`);
    console.log('🧹 Nettoyage des données de test OK');
  } else {
    console.log('⚠️ Pas d\'année scolaire/level de test — tests 4-5 ignorés');
  }

  console.log('\n🎉 TOUS LES TESTS SQL PASSENT');
} catch (e) {
  console.error('❌ Test échoué:', e.message);
  process.exit(1);
} finally {
  await client.end();
}
