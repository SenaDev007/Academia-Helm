// Diagnose 3 issues:
// 1. Stock not displaying after add — check findAll includes stocks relation
// 2. Subjects showing "Aucune" — check what subjects exist per schoolLevelId
// 3. Get list of teachers with their school level + classes (for redesigning Distribution)

const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 30000,
    query_timeout: 60000,
  });
  await client.connect();

  // 1. Check material_stocks count
  const stocksCount = await client.query(`SELECT COUNT(*) FROM "material_stocks";`);
  console.log(`material_stocks rows: ${stocksCount.rows[0].count}`);

  // 2. Show all material_stocks entries
  const stocks = await client.query(`
    SELECT ms.*, pm."name" as material_name, pm."code" as material_code
    FROM "material_stocks" ms
    LEFT JOIN "pedagogical_materials" pm ON pm."id" = ms."materialId"
    ORDER BY ms."createdAt" DESC LIMIT 10;
  `);
  console.log(`\n=== material_stocks (latest 10) ===`);
  for (const r of stocks.rows) {
    console.log(JSON.stringify({
      id: r.id,
      materialName: r.material_name,
      materialCode: r.material_code,
      quantityTotal: r.quantityTotal,
      quantityAvailable: r.quantityAvailable,
      academicYearId: r.academicYearId,
      schoolLevelId: r.schoolLevelId,
      classId: r.classId,
    }));
  }

  // 3. Check material_movements (PURCHASE = add stock)
  const movements = await client.query(`
    SELECT mm.*, pm."name" as material_name
    FROM "material_movements" mm
    LEFT JOIN "pedagogical_materials" pm ON pm."id" = mm."materialId"
    ORDER BY mm."createdAt" DESC LIMIT 10;
  `);
  console.log(`\n=== material_movements (latest 10) ===`);
  for (const r of movements.rows) {
    console.log(JSON.stringify({
      id: r.id,
      materialName: r.material_name,
      movementType: r.movementType,
      quantity: r.quantity,
      academicYearId: r.academicYearId,
      createdAt: r.createdAt,
    }));
  }

  // 4. Subjects by schoolLevelId
  const subs = await client.query(`
    SELECT s."id", s."name", s."code", s."schoolLevelId", sl."name" as level_name
    FROM "subjects" s
    LEFT JOIN "school_levels" sl ON sl."id" = s."schoolLevelId"
    ORDER BY sl."name", s."name" LIMIT 20;
  `);
  console.log(`\n=== subjects (with school level) ===`);
  for (const r of subs.rows) {
    console.log(`  [${r.level_name || '—'}] ${r.name} (${r.code}) — schoolLevelId=${r.schoolLevelId}`);
  }

  // 5. List teachers grouped by their schoolLevelId
  const teachers = await client.query(`
    SELECT t."id", t."firstName", t."lastName", t."email",
           t."schoolLevelId", sl."name" as level_name, t."matricule"
    FROM "teachers" t
    LEFT JOIN "school_levels" sl ON sl."id" = t."schoolLevelId"
    ORDER BY sl."name", t."lastName" LIMIT 20;
  `);
  console.log(`\n=== teachers (with school level) ===`);
  for (const r of teachers.rows) {
    console.log(`  [${r.level_name || '—'}] ${r.firstName} ${r.lastName} <${r.email}> — matricule=${r.matricule}`);
  }

  // 6. Show all pedagogical_materials with their schoolLevelId
  const mats = await client.query(`
    SELECT pm."id", pm."name", pm."code", pm."category",
           pm."schoolLevelId", sl."name" as level_name
    FROM "pedagogical_materials" pm
    LEFT JOIN "school_levels" sl ON sl."id" = pm."schoolLevelId"
    ORDER BY pm."createdAt" DESC LIMIT 20;
  `);
  console.log(`\n=== pedagogical_materials (latest 20) ===`);
  for (const r of mats.rows) {
    console.log(`  [${r.level_name || '—'}] ${r.name} (${r.code}) category=${r.category}`);
  }

  await client.end();
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
