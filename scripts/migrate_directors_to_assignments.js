/**
 * Migration des données : school_directors → staff_admin_assignments + tenant_signatures
 * + copie des signatures
 */
const { Client } = require('pg');
const crypto = require('crypto');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected');

  // Récupérer tous les school_directors avec staffId non null
  const directors = await client.query(`
    SELECT sd.id, sd."tenantId", sd."schoolLevelId", sd.language, sd."fullName",
           sd."functionLabel", sd.email, sd.phone, sd."signatureDataUrl",
           sd."signatureUploadedUrl", sd."staffId", sd."isActive",
           sl.code as level_code
    FROM school_directors sd
    LEFT JOIN school_levels sl ON sl.id = sd."schoolLevelId"
    WHERE sd."staffId" IS NOT NULL
  `);
  console.log(`Found ${directors.rows.length} school_directors to migrate`);

  let migrated = 0, skipped = 0;

  for (const d of directors.rows) {
    // Mapper schoolLevelId → schoolLevelCode
    let levelCode = 'ALL';
    if (d.level_code === 'MATERNELLE') levelCode = 'MAT';
    else if (d.level_code === 'PRIMAIRE') levelCode = 'PRI';
    else if (d.level_code === 'SECONDAIRE') levelCode = 'SEC';

    // Vérifier si l'affectation existe déjà
    const existing = await client.query(`
      SELECT id FROM staff_admin_assignments
      WHERE "tenantId" = $1 AND "staffId" = $2 AND "adminRole" = 'DIRECTEUR'
        AND "schoolLevelCode" = $3 AND "isActive" = true
      LIMIT 1
    `, [d.tenantId, d.staffId, levelCode]);

    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }

    // Créer l'affectation
    const assignmentId = crypto.randomUUID();
    await client.query(`
      INSERT INTO staff_admin_assignments
      (id, "tenantId", "staffId", "schoolLevelCode", "adminRole",
       "functionLabel", "signatureUrl", "signatureDataUrl",
       "isActive", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, 'DIRECTEUR', $5, $6, $7, $8, now(), now())
    `, [
      assignmentId, d.tenantId, d.staffId, levelCode,
      d.functionLabel || null,
      d.signatureUploadedUrl || null,
      d.signatureDataUrl || null,
      d.isActive !== false,
    ]);
    migrated++;
  }

  console.log(`✅ Migrated: ${migrated}, Skipped (already exist): ${skipped}`);

  // Vérifier le résultat
  const count = await client.query(`
    SELECT "adminRole", COUNT(*) as c FROM staff_admin_assignments
    WHERE "isActive" = true GROUP BY "adminRole" ORDER BY "adminRole"
  `);
  console.log('\nStaff admin assignments by role:');
  count.rows.forEach(r => console.log(`  ${r.adminRole}: ${r.c}`));

  await client.end();
  console.log('\n🔌 Done');
}
main().catch(e => console.error('❌', e.message));
