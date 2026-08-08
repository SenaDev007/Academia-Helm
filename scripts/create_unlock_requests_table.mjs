/**
 * Create evaluation_unlock_requests table for persisting unlock requests
 * from teachers (asking director/admin to unlock validated evaluations
 * so they can be modified).
 */
import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

console.log('Creating evaluation_unlock_requests table...');

await client.query(`
  CREATE TABLE IF NOT EXISTS evaluation_unlock_requests (
    id              text PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId"      text NOT NULL,
    "evaluationId"  text NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    "requestedById" text NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    "classId"       text NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    "subjectId"     text REFERENCES subjects(id) ON DELETE SET NULL,
    "periodId"      text,
    "schoolLevelId" text,
    reason          text NOT NULL,
    status          text NOT NULL DEFAULT 'PENDING',
    "reviewedById"  text REFERENCES users(id) ON DELETE SET NULL,
    "reviewedAt"    timestamp,
    "reviewComment" text,
    "createdAt"     timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

console.log('✓ Table created');

await client.query(`
  CREATE INDEX IF NOT EXISTS idx_eval_unlock_requests_tenant
  ON evaluation_unlock_requests ("tenantId")
`);
await client.query(`
  CREATE INDEX IF NOT EXISTS idx_eval_unlock_requests_status
  ON evaluation_unlock_requests (status)
`);
await client.query(`
  CREATE INDEX IF NOT EXISTS idx_eval_unlock_requests_eval
  ON evaluation_unlock_requests ("evaluationId")
`);
await client.query(`
  CREATE INDEX IF NOT EXISTS idx_eval_unlock_requests_class
  ON evaluation_unlock_requests ("classId")
`);

console.log('✓ Indexes created');

// Verify
const r = await client.query(`
  SELECT column_name, data_type, is_nullable FROM information_schema.columns
  WHERE table_name='evaluation_unlock_requests' ORDER BY ordinal_position
`);
console.log('\nSchema:');
for (const c of r.rows) console.log(`  - ${c.column_name.padEnd(20)} ${c.data_type.padEnd(20)} nullable=${c.is_nullable}`);

await client.end();
