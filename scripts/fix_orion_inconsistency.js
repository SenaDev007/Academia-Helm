// Vérifie les statuts des enrollments et corrige l'incohérence
const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // 1. Distribution des statuts d'enrollments
  const statusDist = await client.query(`
    SELECT status, COUNT(*)::int as count
    FROM "student_enrollments"
    GROUP BY status
    ORDER BY count DESC
  `);
  console.log('📊 Distribution des statuts student_enrollments :');
  statusDist.rows.forEach(r => console.log(`  - ${r.status} : ${r.count}`));

  // 2. Compter les élèves actifs sans enrollment ACTIVE
  const orionAlert = await client.query(`
    SELECT COUNT(DISTINCT s.id)::int as count
    FROM "students" s
    WHERE s.status = 'ACTIVE'
      AND NOT EXISTS (
        SELECT 1 FROM "student_enrollments" se
        WHERE se."studentId" = s.id AND se.status = 'ACTIVE'
      )
      AND EXISTS (
        SELECT 1 FROM "student_id_cards" sic
        WHERE sic."studentId" = s.id AND sic."isActive" = true AND sic."isRevoked" = false
      )
  `);
  console.log(`\n🚨 Alert ORION actuelle : ${orionAlert.rows[0].count} élève(s) avec incohérence`);

  // 3. Corriger : passer les enrollments ADMITTED/PRE_REGISTERED à ACTIVE
  // si l'élève a une carte scolaire active (preuve qu'il est bien scolarisé)
  console.log('\n🔧 Correction : passage des enrollments ADMITTED → ACTIVE...');
  const fixed = await client.query(`
    UPDATE "student_enrollments" se
    SET status = 'ACTIVE', "updatedAt" = NOW()
    WHERE se.status IN ('ADMITTED', 'PRE_REGISTERED', 'ENROLLED')
      AND EXISTS (
        SELECT 1 FROM "students" s
        WHERE s.id = se."studentId" AND s.status = 'ACTIVE'
      )
      AND EXISTS (
        SELECT 1 FROM "student_id_cards" sic
        WHERE sic."studentId" = se."studentId"
          AND sic."isActive" = true
          AND sic."isRevoked" = false
      )
  `);
  console.log(`✅ ${fixed.rowCount} enrollment(s) mis à jour vers ACTIVE`);

  // 4. Vérifier après correction
  const afterOrion = await client.query(`
    SELECT COUNT(DISTINCT s.id)::int as count
    FROM "students" s
    WHERE s.status = 'ACTIVE'
      AND NOT EXISTS (
        SELECT 1 FROM "student_enrollments" se
        WHERE se."studentId" = s.id AND se.status = 'ACTIVE'
      )
      AND EXISTS (
        SELECT 1 FROM "student_id_cards" sic
        WHERE sic."studentId" = s.id AND sic."isActive" = true AND sic."isRevoked" = false
      )
  `);
  console.log(`\n✨ Alert ORION après correction : ${afterOrion.rows[0].count} élève(s) avec incohérence`);

  await client.end();
}
main().catch(e => { console.error(e); process.exit(1); });
