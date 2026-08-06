/**
 * Migration SQL — Ajoute 2 nouvelles colonnes à report_cards :
 *   - directorVisa (Text, nullable) : visa/approbation du directeur par élève
 *   - directorVisaUpdatedAt (Timestamp, nullable) : date de dernière mise à jour
 *
 * Ces champs permettent au directeur d'éditer un visa personnalisé par élève,
 * auto-rempli depuis l'appréciation de l'enseignant mais modifiable.
 */
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('✓ Connected to database');

  const statements = [
    `ALTER TABLE "report_cards" ADD COLUMN IF NOT EXISTS "directorVisa" TEXT;`,
    `ALTER TABLE "report_cards" ADD COLUMN IF NOT EXISTS "directorVisaUpdatedAt" TIMESTAMP;`,
  ];

  for (const sql of statements) {
    console.log('→', sql);
    await client.query(sql);
  }

  console.log('\n✓ Migration complete — 2 columns added to report_cards');
  await client.end();
}

main().catch((e) => {
  console.error('✗ Migration failed:', e.message);
  process.exit(1);
});
