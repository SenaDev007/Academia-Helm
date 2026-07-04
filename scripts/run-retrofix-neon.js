/**
 * Script rétro-fix : crée les Teachers manquants pour les Staff existants.
 * Version Node.js avec pg (sans Prisma, pour exécution directe).
 */
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Rétro-fix : création des Teachers manquants pour les Staff ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connecté à Neon\n');

    // 1. Récupérer l'année académique active (globale — tous tenants)
    const activeYearRes = await client.query(`
      SELECT id, name, "tenantId" FROM "academic_years" WHERE "isActive" = true LIMIT 1
    `);
    if (activeYearRes.rows.length === 0) {
      console.log('⚠️ Aucune année académique active trouvée.');
      return;
    }
    const activeYear = activeYearRes.rows[0];
    console.log(`Année active : ${activeYear.name} (tenant: ${activeYear.tenantId})`);

    // 2. Récupérer tous les Staff qui ont un schoolLevelId défini
    const staffRes = await client.query(`
      SELECT id, email, "employeeNumber", "firstName", "lastName", phone, gender,
             position, department, "hireDate", "contractType", "schoolLevelId",
             "tenantId", "roleType", "assignedLanguages"
      FROM "staff"
      WHERE "schoolLevelId" IS NOT NULL
      ORDER BY "lastName", "firstName"
    `);
    console.log(`\nStaff avec schoolLevelId défini : ${staffRes.rows.length}`);

    if (staffRes.rows.length === 0) {
      console.log('→ Aucun Staff à traiter.');
      return;
    }

    let existingCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const s of staffRes.rows) {
      try {
        // Match par email ou matricule (employeeNumber)
        let teacherRes;
        if (s.email) {
          teacherRes = await client.query(`
            SELECT id, "schoolLevelId", "assignedLanguages" FROM "teachers"
            WHERE "tenantId" = $1 AND (email = $2 OR matricule = $3)
            LIMIT 1
          `, [s.tenantId, s.email, s.employeeNumber]);
        } else {
          teacherRes = await client.query(`
            SELECT id, "schoolLevelId", "assignedLanguages" FROM "teachers"
            WHERE "tenantId" = $1 AND matricule = $2
            LIMIT 1
          `, [s.tenantId, s.employeeNumber]);
        }

        if (teacherRes.rows.length > 0) {
          // Teacher existe déjà
          existingCount++;
          const teacher = teacherRes.rows[0];

          // Mettre à jour schoolLevelId si différent + init assignedLanguages si null
          if (teacher.schoolLevelId !== s.schoolLevelId || teacher.assignedLanguages === null) {
            await client.query(`
              UPDATE "teachers" SET
                "schoolLevelId" = $1,
                "assignedLanguages" = COALESCE("assignedLanguages", '["FR","EN"]'::jsonb),
                "updatedAt" = NOW()
              WHERE id = $2
            `, [s.schoolLevelId, teacher.id]);
            updatedCount++;
            console.log(`  ↻ Teacher ${teacher.id} mis à jour pour Staff ${s.firstName} ${s.lastName}`);
          }
        } else {
          // Aucun Teacher — on le crée
          const teacherId = require('crypto').randomUUID();
          const matricule = s.employeeNumber || `STF-${s.id.slice(-8)}`;
          await client.query(`
            INSERT INTO "teachers" (
              id, "tenantId", "schoolLevelId", matricule, "firstName", "lastName",
              gender, phone, email, position, "hireDate", "contractType",
              status, "academicYearId", "assignedLanguages",
              "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', $13, '["FR","EN"]'::jsonb, NOW(), NOW())
          `, [
            teacherId, s.tenantId, s.schoolLevelId, matricule,
            s.firstName, s.lastName, s.gender, s.phone, s.email, s.position,
            s.hireDate, s.contractType, activeYear.id,
          ]);
          createdCount++;
          console.log(`  ✅ Teacher créé ${teacherId} pour Staff ${s.firstName} ${s.lastName} (${s.email || s.employeeNumber})`);
        }
      } catch (err) {
        errorCount++;
        console.error(`  ❌ Erreur pour Staff ${s.id} (${s.firstName} ${s.lastName}): ${err.message}`);
      }
    }

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                        RÉCAPITULATIF                          ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Staff avec niveau : ${String(staffRes.rows.length).padEnd(4)}                                      ║`);
    console.log(`║  Teachers existants: ${String(existingCount).padEnd(4)}                                      ║`);
    console.log(`║  Teachers mis à jour: ${String(updatedCount).padEnd(3)}                                     ║`);
    console.log(`║  Teachers créés : ${String(createdCount).padEnd(4)}                                        ║`);
    console.log(`║  Erreurs : ${String(errorCount).padEnd(4)}                                                 ║`);
    console.log('╚══════════════════════════════════════════════════════════════╝');

    if (errorCount > 0) {
      console.log(`\n⚠️ ${errorCount} erreur(s) — vérifiez les logs ci-dessus.`);
    } else {
      console.log(`\n✅ Rétro-fix terminé sans erreur.`);
    }

  } catch (err) {
    console.error('❌ Erreur fatale:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
