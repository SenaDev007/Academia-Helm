/**
 * Ajoute des élèves de test dans promoter_payment_eligibility pour Mon Avenir Plus
 * afin de reproduire le bug d'affichage signalé par l'utilisateur.
 */
const { Client } = require('pg');
const crypto = require('crypto');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';
const USER_ID = 'e8873cbe-3035-42fb-837f-f575a02e6373'; // Julien OGBON

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Récupère 3 élèves actifs
  const students = await client.query(`
    SELECT s.id, s."lastName", s."firstName"
    FROM students s
    WHERE s."tenantId" = $1 AND s.status != 'WITHDRAWN'
    LIMIT 3
  `, [TENANT_ID]);

  console.log(`Found ${students.rows.length} students to mark`);

  for (const s of students.rows) {
    const id = crypto.randomUUID();
    await client.query(`
      INSERT INTO promoter_payment_eligibility
      (id, tenantid, studentid, academicyearid, isactive, motif, expecteddate,
       advanceamount, inscriptionexpected, reinscriptionexpected, tuitionexpected,
       arrearexpected, totaldue, remainingamount, issettled,
       createdbyid, createdat)
      VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7, $8, $9, $10, $11, $12, $13, FALSE, $14, now())
      ON CONFLICT DO NOTHING
    `, [
      id, TENANT_ID, s.id, YEAR_ID,
      'Paiement direct au fondateur — élève ami du promoteur avec arrangement spécial pour les frais de scolarité de l\'année 2025-2026',
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // +30 jours
      25000,  // advanceAmount
      5000,   // inscriptionExpected
      0,      // reinscriptionExpected
      50000,  // tuitionExpected
      0,      // arrearExpected
      55000,  // totalDue
      30000,  // remainingAmount
      USER_ID,
    ]);
    console.log(`✅ Marked: ${s.lastName} ${s.firstName}`);
  }

  // Vérifie
  const count = await client.query(`SELECT COUNT(*) as c FROM promoter_payment_eligibility WHERE tenantid = $1 AND academicyearid = $2 AND isactive = TRUE`, [TENANT_ID, YEAR_ID]);
  console.log(`\nTotal active promoter-eligible students: ${count.rows[0].c}`);

  await client.end();
}
main().catch(e => console.error(e.message));
