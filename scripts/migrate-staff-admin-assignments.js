/**
 * Crée la table staff_admin_assignments
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function main() {
  const client = await pool.connect();
  console.log('✓ Connexion réussie\n');

  try {
    console.log('=== Création table staff_admin_assignments ===');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "staff_admin_assignments" (
        "id" TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "staffId" TEXT NOT NULL,
        "schoolLevelCode" TEXT NOT NULL,
        "adminRole" TEXT NOT NULL,
        "academicYearId" TEXT,
        "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "endDate" TIMESTAMP(3),
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "staff_admin_assignments_staffId_fkey"
          FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE,
        CONSTRAINT "staff_admin_assignments_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "staff_admin_assignments_tenantId_staffId_adminRole_schoolLev_key"
          UNIQUE ("tenantId", "staffId", "adminRole", "schoolLevelCode", "academicYearId")
      );
      CREATE INDEX IF NOT EXISTS "idx_staff_admin_assignments_tenant_staff"
        ON "staff_admin_assignments" ("tenantId", "staffId");
      CREATE INDEX IF NOT EXISTS "idx_staff_admin_assignments_tenant_level"
        ON "staff_admin_assignments" ("tenantId", "schoolLevelCode");
      CREATE INDEX IF NOT EXISTS "idx_staff_admin_assignments_tenant_role_active"
        ON "staff_admin_assignments" ("tenantId", "adminRole", "isActive");
    `);
    console.log('✓ Table staff_admin_assignments créée (ou déjà existante)');

    // Vérification
    const check = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'staff_admin_assignments') AS exists
    `);
    console.log('Vérification:', check.rows[0].exists ? '✓ OK' : '✗ MANQUANT');

    console.log('\n✓ Migration terminée');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => {
  console.error('Erreur:', e.message);
  process.exit(1);
});
