/**
 * Restaure les valeurs d'AKPOVI après les tests (prenom "Béroukhyah", nom "AKPOVI TOHOU")
 */
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      UPDATE students
      SET "firstName" = 'Béroukhyah',
          "lastName" = 'AKPOVI TOHOU',
          "dateOfBirth" = '2023-08-20',
          "updatedAt" = NOW()
      WHERE id = 'c9a4b7d0-fadd-40a8-8ec0-c472772b5708'
      RETURNING "firstName", "lastName", "dateOfBirth"
    `);
    console.log('Restauration OK:', res.rows[0]);
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
