/**
 * Vérifie et applique toutes les migrations manquantes sur Neon.
 * Idempotent : chaque migration utilise CREATE INDEX IF NOT EXISTS / DO $$ BEGIN ... END $$.
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
});

const MIGRATIONS_DIR = '/home/z/my-project/apps/api-server/migrations';

// Liste ordonnée des migrations à appliquer (par numéro)
const migrationsToRun = [
  '009_student_photo_unique.sql',
];

async function main() {
  const client = await pool.connect();
  console.log('=== État initial des migrations sur Neon ===\n');

  // 1. Vérifier l'index unique sur student_photos
  const idxRes = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'student_photos'
    ORDER BY indexname
  `);
  console.log('Indexes sur student_photos :');
  idxRes.rows.forEach(r => console.log(`  - ${r.indexname}: ${r.indexdef.substring(0, 100)}...`));

  // 2. Vérifier les colonnes de student_photos
  const colsRes = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'student_photos'
    ORDER BY ordinal_position
  `);
  console.log('\nColonnes student_photos :');
  console.table(colsRes.rows);

  // 3. Vérifier le nombre de lignes
  const cntRes = await client.query('SELECT COUNT(*) AS cnt FROM student_photos');
  console.log(`Nombre de photos : ${cntRes.rows[0].cnt}`);

  // 4. Vérifier aussi la table students (colonne photoUrl)
  const stuRes = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'students' AND column_name IN ('photoUrl', 'npi', 'placeOfBirth')
    ORDER BY column_name
  `);
  console.log('\nColonnes students (photoUrl, npi, placeOfBirth) :');
  console.table(stuRes.rows);

  // 5. Appliquer les migrations
  console.log('\n=== Application des migrations ===\n');
  for (const migFile of migrationsToRun) {
    const filePath = path.join(MIGRATIONS_DIR, migFile);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Migration ${migFile} introuvable — ignorée`);
      continue;
    }
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`▶ Application de ${migFile}...`);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log(`✅ ${migFile} appliquée avec succès\n`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`❌ Échec ${migFile} : ${err.message}\n`);
    }
  }

  // 6. Vérification finale
  console.log('=== Vérification finale ===\n');
  const finalIdx = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'student_photos'
    ORDER BY indexname
  `);
  console.log('Indexes finaux sur student_photos :');
  finalIdx.rows.forEach(r => console.log(`  - ${r.indexname}`));

  // Test : peut-on faire un upsert basé sur studentId ?
  console.log('\nTest upsert (dry-run, rollback) :');
  try {
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO student_photos (id, "tenantId", "studentId", "originalUrl", "hdUrl", "thumbnailUrl", "createdAt")
      VALUES ('test-upsert-id', '59b8c348-ae5f-4d67-8fbd-af6aefa1f394', 'test-student-id', 'data:test', 'data:test', 'data:test', NOW())
      ON CONFLICT ("studentId") DO UPDATE SET "originalUrl" = EXCLUDED."originalUrl"
      RETURNING id
    `);
    console.log('  ✅ ON CONFLICT ("studentId") fonctionne — upsert prêt');
    await client.query('ROLLBACK');
  } catch (err) {
    await client.query('ROLLBACK');
    console.log(`  ❌ ON CONFLICT échoue : ${err.message}`);
  }
}

main()
  .catch(e => { console.error('Erreur fatale:', e); process.exit(1); })
  .finally(() => pool.end());
