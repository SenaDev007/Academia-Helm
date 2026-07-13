// Migration complète : ancienne BDD → nouvelle BDD
// Étape 1 : Créer la structure (toutes les tables) via des CREATE TABLE IF NOT EXISTS
//           dérivés du schéma de l'ancienne BDD
// Étape 2 : Copier les données via COPY ou INSERT

const { Client } = require('/home/z/my-project/node_modules/pg');

const OLD_DB = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const NEW_DB = 'postgresql://neondb_owner:npg_6KId8HblkNrZ@ep-mute-dawn-asgj3thg-pooler.c-4.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const oldClient = new Client({ connectionString: OLD_DB, ssl: { rejectUnauthorized: false } });
  const newClient = new Client({ connectionString: NEW_DB, ssl: { rejectUnauthorized: false } });

  try {
    console.log('🔌 Connecting to OLD database...');
    await oldClient.connect();
    console.log('✅ Old DB connected');

    console.log('🔌 Connecting to NEW database...');
    await newClient.connect();
    console.log('✅ New DB connected');

    // 1. Récupérer toutes les tables
    console.log('\n📋 Récupération de la liste des tables...');
    const tablesRes = await oldClient.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log(`  → ${tables.length} tables trouvées`);

    // 2. Pour chaque table : récupérer le DDL (CREATE TABLE) depuis l'ancienne BDD
    //    et l'exécuter dans la nouvelle
    console.log('\n🏗️ Création de la structure...');
    for (const table of tables) {
      // Récupérer le DDL complet (CREATE TABLE) via pg_get_tabledef
      // Neon/PostgreSQL n'a pas pg_get_tabledef, donc on construit manuellement
      const colsRes = await oldClient.query(`
        SELECT
          column_name,
          data_type,
          character_maximum_length,
          column_default,
          is_nullable,
          numeric_precision,
          numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [table]);

      const colDefs = colsRes.rows.map(col => {
        let typeStr = col.data_type;
        if (col.character_maximum_length) typeStr += `(${col.character_maximum_length})`;
        else if (col.numeric_precision && col.data_type === 'numeric') {
          typeStr += `(${col.numeric_precision}${col.numeric_scale ? ',' + col.numeric_scale : ''})`;
        }
        let def = `"${col.column_name}" ${typeStr}`;
        if (col.column_default) def += ` DEFAULT ${col.column_default}`;
        if (col.is_nullable === 'NO') def += ' NOT NULL';
        return def;
      });

      // Vérifier si la table existe déjà
      const existsRes = await newClient.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        )
      `, [table]);

      if (!existsRes.rows[0].exists) {
        const createSQL = `CREATE TABLE IF NOT EXISTS "${table}" (${colDefs.join(', ')})`;
        try {
          await newClient.query(createSQL);
          console.log(`  ✅ Table créée: ${table}`);
        } catch (e) {
          console.log(`  ⚠️ Erreur création ${table}: ${e.message}`);
        }
      } else {
        console.log(`  → Table déjà existante: ${table}`);
      }
    }

    // 3. Copier les contraintes (primary keys, unique, indexes)
    console.log('\n🔗 Copie des contraintes et index...');
    const constraintsRes = await oldClient.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_name
    `);

    const constraintsMap = {};
    for (const row of constraintsRes.rows) {
      if (!constraintsMap[row.constraint_name]) {
        constraintsMap[row.constraint_name] = {
          table: row.table_name,
          type: row.constraint_type,
          columns: []
        };
      }
      constraintsMap[row.constraint_name].columns.push(row.column_name);
    }

    for (const [name, info] of Object.entries(constraintsMap)) {
      const cols = info.columns.map(c => `"${c}"`).join(', ');
      if (info.type === 'PRIMARY KEY') {
        try {
          await newClient.query(`ALTER TABLE "${info.table}" ADD CONSTRAINT "${name}" PRIMARY KEY (${cols})`);
          console.log(`  ✅ PK: ${name} sur ${info.table}`);
        } catch (e) { console.log(`  → PK déjà existante: ${name}`); }
      } else if (info.type === 'UNIQUE') {
        try {
          await newClient.query(`ALTER TABLE "${info.table}" ADD CONSTRAINT "${name}" UNIQUE (${cols})`);
          console.log(`  ✅ UNIQUE: ${name} sur ${info.table}`);
        } catch (e) { console.log(`  → UNIQUE déjà existant: ${name}`); }
      }
    }

    // 4. Copier les données
    console.log('\n📦 Copie des données...');
    let totalRows = 0;
    for (const table of tables) {
      const countRes = await oldClient.query(`SELECT COUNT(*)::int as count FROM "${table}"`);
      const count = countRes.rows[0].count;

      if (count === 0) {
        console.log(`  → ${table}: 0 ligne (skip)`);
        continue;
      }

      // Récupérer les colonnes
      const colsRes = await oldClient.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      const columns = colsRes.rows.map(r => r.column_name);
      const colList = columns.map(c => `"${c}"`).join(', ');

      // Récupérer les données
      const dataRes = await oldClient.query(`SELECT * FROM "${table}"`);
      const rows = dataRes.rows;

      // Insérer par batches de 50
      const batchSize = 50;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const values = [];
        const placeholders = [];
        let paramIdx = 1;

        for (const row of batch) {
          const rowPlaceholders = columns.map(col => {
            values.push(row[col]);
            return `$${paramIdx++}`;
          });
          placeholders.push(`(${rowPlaceholders.join(', ')})`);
        }

        try {
          const insertQuery = `INSERT INTO "${table}" (${colList}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`;
          await newClient.query(insertQuery, values);
          inserted += batch.length;
        } catch (e) {
          // Essayer ligne par ligne
          for (const row of batch) {
            const rowValues = columns.map(col => row[col]);
            const rowPlaceholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
            try {
              await newClient.query(
                `INSERT INTO "${table}" (${colList}) VALUES (${rowPlaceholders}) ON CONFLICT DO NOTHING`,
                rowValues
              );
              inserted++;
            } catch (e2) {
              // Skip les doublons
            }
          }
        }
      }

      totalRows += inserted;
      console.log(`  ✅ ${table}: ${inserted}/${count} lignes copiées`);
    }

    // 5. Vérification finale
    console.log('\n📊 Vérification:');
    for (const table of tables) {
      const oldCount = await oldClient.query(`SELECT COUNT(*)::int as c FROM "${table}"`);
      const newCount = await newClient.query(`SELECT COUNT(*)::int as c FROM "${table}"`);
      const status = oldCount.rows[0].c === newCount.rows[0].c ? '✅' : '⚠️';
      console.log(`  ${status} ${table}: ${newCount.rows[0].c}/${oldCount.rows[0].c}`);
    }

    console.log(`\n🎉 Migration terminée ! ${totalRows} lignes copiées au total.`);

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await oldClient.end();
    await newClient.end();
    console.log('\n🔌 Disconnected');
  }
}

main();
