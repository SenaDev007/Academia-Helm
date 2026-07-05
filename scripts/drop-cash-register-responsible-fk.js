/**
 * ============================================================================
 * DROP FK cash_registers_responsibleUserId_fkey
 * ============================================================================
 *
 * Problème : Le schéma Prisma a été modifié pour supprimer la relation
 * CashRegister.responsibleUser → User (car responsibleUserId stocke désormais
 * directement le Staff.id). Mais la contrainte FK physique en DB n'a jamais
 * été supprimée.
 *
 * Conséquence : Prisma lève une erreur P2003 (Foreign key constraint failed)
 * quand on essaie d'assigner un responsable (Staff.id) à une caisse, car
 * la FK pointe vers users(id) et non staff(id).
 *
 * Solution : DROP la FK pour que responsibleUserId soit un simple String
 * sans contrainte de clé étrangère (comme défini dans le schéma Prisma).
 *
 * ============================================================================
 */

const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const MIGRATION_SQL = `
-- 1. Supprimer la FK cash_registers_responsibleUserId_fkey
ALTER TABLE "cash_registers" DROP CONSTRAINT IF EXISTS "cash_registers_responsibleUserId_fkey";

-- 2. Vérifier qu'il ne reste plus de FK sur responsibleUserId
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype = 'f'
  AND conrelid = 'cash_registers'::regclass
  AND conname LIKE '%responsible%';
`;

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    console.log('🔗 Connexion à Neon...');
    await client.connect();
    console.log('✅ Connecté\n');

    console.log('🔧 Suppression de la FK cash_registers_responsibleUserId_fkey...');
    const result = await client.query(MIGRATION_SQL);
    console.log('✅ FK supprimée\n');

    // Vérification
    const lastResult = result[result.length - 1];
    if (lastResult && lastResult.rows) {
      console.log(`📊 FK restantes sur responsibleUserId : ${lastResult.rows.length}`);
      for (const row of lastResult.rows) {
        console.log(`   - ${row.conname}: ${row.definition}`);
      }
      if (lastResult.rows.length === 0) {
        console.log('   ✅ Aucune FK restante — responsibleUserId est maintenant un simple String');
      }
    }
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
