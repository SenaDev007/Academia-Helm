const { Client } = require('/tmp/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to Neon\n');

  // Get all tables in public schema
  const tables = await client.query(`
    SELECT
      table_name,
      (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
    FROM information_schema.tables t
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  console.log(`Found ${tables.rows.length} tables:\n`);

  // For each table, get the full CREATE TABLE statement
  const schemas = [];

  for (const row of tables.rows) {
    const tableName = row.table_name;
    console.log(`  Exporting: ${tableName} (${row.column_count} columns)`);

    // Get columns
    const columns = await client.query(`
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        is_nullable,
        column_default,
        udt_name
      FROM information_schema.columns
      WHERE table_name = '${tableName}'
        AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);

    // Get primary key
    const pk = await client.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = '${tableName}'
        AND tc.constraint_type = 'PRIMARY KEY';
    `);

    // Get unique constraints
    const uniques = await client.query(`
      SELECT
        tc.constraint_name,
        string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = '${tableName}'
        AND tc.constraint_type = 'UNIQUE'
      GROUP BY tc.constraint_name;
    `);

    // Get indexes
    const indexes = await client.query(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = '${tableName}'
        AND indexname NOT IN (
          SELECT constraint_name FROM information_schema.table_constraints
          WHERE table_name = '${tableName}'
        );
    `);

    // Get foreign keys
    const fks = await client.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = '${tableName}'
        AND tc.constraint_type = 'FOREIGN KEY';
    `);

    schemas.push({
      tableName,
      columns: columns.rows,
      primaryKey: pk.rows.map(r => r.column_name),
      uniques: uniques.rows,
      indexes: indexes.rows,
      foreignKeys: fks.rows,
    });
  }

  // Save to JSON file
  const fs = require('fs');
  fs.writeFileSync(
    '/home/z/my-project/apps/desktop/src-tauri/migrations/postgres-schema.json',
    JSON.stringify(schemas, null, 2)
  );

  console.log(`\n✅ Schema exported: ${schemas.length} tables`);
  console.log('Saved to: postgres-schema.json');

  // Print summary
  console.log('\n=== Summary ===');
  console.log(`Tables: ${schemas.length}`);
  console.log(`Total columns: ${schemas.reduce((sum, s) => sum + s.columns.length, 0)}`);
  console.log(`Total indexes: ${schemas.reduce((sum, s) => sum + s.indexes.length, 0)}`);
  console.log(`Total foreign keys: ${schemas.reduce((sum, s) => sum + s.foreignKeys.length, 0)}`);

  await client.end();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
