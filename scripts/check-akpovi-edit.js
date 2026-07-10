/**
 * Vérifie l'état actuel de l'élève AKPOVI pour identifier la cause du 400 sur PUT /students/:id
 */
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    // 1. Trouver AKPOVI
    const res = await client.query(`
      SELECT id, "tenantId", "firstName", "lastName", "dateOfBirth", gender,
             nationality, "placeOfBirth", npi, "photoUrl",
             length("photoUrl") AS photo_url_length,
             "schoolLevelId", "academicYearId", status
      FROM students
      WHERE "lastName" ILIKE '%AKPOVI%' OR "firstName" ILIKE '%AKPOVI%'
         OR "lastName" ILIKE '%Béroukhyah%' OR "firstName" ILIKE '%Béroukhyah%'
      LIMIT 5
    `);
    console.log('=== Élèves AKPOVI trouvés ===');
    res.rows.forEach((r, i) => {
      console.log(`\n--- Élève ${i + 1} ---`);
      console.log(`  id            : ${r.id}`);
      console.log(`  tenantId      : ${r.tenantId}`);
      console.log(`  firstName     : "${r.firstName}"`);
      console.log(`  lastName      : "${r.lastName}"`);
      console.log(`  dateOfBirth   : ${r.dateOfBirth} (type: ${typeof r.dateOfBirth})`);
      console.log(`  gender        : "${r.gender}" (length: ${r.gender?.length})`);
      console.log(`  nationality   : "${r.nationality}"`);
      console.log(`  placeOfBirth  : "${r.placeOfBirth}"`);
      console.log(`  npi           : "${r.npi}"`);
      console.log(`  photoUrl      : ${r.photoUrl ? `[${r.photo_url_length} chars] starts with: ${r.photoUrl.substring(0, 50)}` : 'NULL'}`);
      console.log(`  schoolLevelId : ${r.schoolLevelId}`);
      console.log(`  academicYearId: ${r.academicYearId}`);
      console.log(`  status        : ${r.status}`);
    });

    // 2. Vérifier aussi les guardians existants
    if (res.rows.length > 0) {
      const studentId = res.rows[0].id;
      const guardians = await client.query(`
        SELECT sg."isPrimary", g.id, g."firstName", g."lastName", g.phone, g.email, g.relationship
        FROM student_guardians sg
        JOIN guardians g ON sg."guardianId" = g.id
        WHERE sg."studentId" = $1
      `, [studentId]);
      console.log('\n=== Guardians existants ===');
      console.table(guardians.rows);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
