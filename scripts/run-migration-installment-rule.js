/**
 * Exécute la migration installment_due_date_rule.sql sur Neon DB.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const sqlPath = path.join(__dirname, '..', 'apps', 'api-server', 'prisma', 'migrations', '20260703120000_installment_due_date_rule.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✓ Connecté à Neon DB');
    console.log(`✓ SQL chargé : ${sqlPath} (${sql.length} octets)`);

    // Exécuter le script SQL en bloc (DO $$ ... $$; ne fonctionne pas en multi-query simple)
    // On découpe manuellement sur les points-virgules de fin de statement
    // mais on doit préserver les blocs DO $$ ... $$;
    await client.query(sql);
    console.log('✓ Migration exécutée avec succès');

    // Vérification
    const { rows } = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'fee_structure_installments'
        AND column_name IN ('dueDateType', 'daysOffset', 'dueDate')
      ORDER BY column_name
    `);
    console.log('\nVérification des colonnes :');
    rows.forEach(r => console.log(`  - ${r.column_name} : ${r.data_type} | nullable=${r.is_nullable} | default=${r.column_default || 'none'}`));

    // Vérifier le type enum
    const { rows: enumRows } = await client.query(`
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'installment_due_date_type'
      ORDER BY e.enumsortorder
    `);
    console.log('\nValeurs enum installment_due_date_type :');
    enumRows.forEach(r => console.log(`  - ${r.enumlabel}`));

  } catch (err) {
    console.error('✗ Erreur :', err.message);
    if (err.detail) console.error('  Détail :', err.detail);
    if (err.hint) console.error('  Hint :', err.hint);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✓ Connexion fermée');
  }
}

main();
