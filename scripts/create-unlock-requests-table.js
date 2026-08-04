/**
 * Crée la table exam_unlock_requests pour le workflow de demande de déverrouillage
 * des notes par les enseignants → validation par la direction.
 */
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  console.log('✅ Connected to Neon\n');

  // 1. Créer la table exam_unlock_requests
  console.log('─── Creating exam_unlock_requests table ───');
  await db.query(`
    CREATE TABLE IF NOT EXISTS "exam_unlock_requests" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "evaluationId" TEXT NOT NULL,
      "requestedById" TEXT NOT NULL,
      "reason" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "reviewedById" TEXT,
      "reviewComment" TEXT,
      "reviewedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "exam_unlock_requests_pkey" PRIMARY KEY ("id")
    )
  `);
  console.log('✅ Table created');

  // 2. Index pour recherches rapides
  await db.query(`CREATE INDEX IF NOT EXISTS "exam_unlock_requests_tenantId_idx" ON "exam_unlock_requests"("tenantId")`);
  await db.query(`CREATE INDEX IF NOT EXISTS "exam_unlock_requests_status_idx" ON "exam_unlock_requests"("status")`);
  await db.query(`CREATE INDEX IF NOT EXISTS "exam_unlock_requests_evaluationId_idx" ON "exam_unlock_requests"("evaluationId")`);
  console.log('✅ Indexes created');

  // 3. Vérification
  const count = await db.query('SELECT COUNT(*)::int as c FROM exam_unlock_requests');
  console.log(`\n✅ Table ready. Current rows: ${count.rows[0].c}`);

  await db.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
