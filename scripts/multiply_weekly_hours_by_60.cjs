// ⭐ Migration : convertit les weeklyHours existants en MINUTES.
//    Avant la refonte du 2026-08-20, weeklyHours était en HEURES (default=4).
//    Après la refonte, weeklyHours est en MINUTES (default=120 = 2h).
//    Sans cette migration, les anciens sujets ont weeklyHours=4 qui s'affiche
//    comme "4 min" (au lieu de "4h = 240 min" en réalité).
//
//    Stratégie : on multiplie par 60 toutes les valeurs weeklyHours < 24
//    (hypothèse : aucune matière ne dépasse 24h/semaine, donc toute valeur
//    < 24 est en heures et doit être convertie en minutes).
//    Les valeurs >= 24 sont déjà en minutes (ex: 120, 240) et restent inchangées.
//
//    Cette approche est conservatrice : si une matière a été créée récemment
//    avec weeklyHours=10 (signifiant 10 minutes, ce qui serait absurde),
//    elle serait convertie en 600 (10h en minutes) — mais c'est très improbable.

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
  console.log('✅ Connected to Neon prod DB');

  // 1. Inspecter les valeurs actuelles
  const before = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE "weeklyHours" IS NULL OR "weeklyHours" = 0) as zero_or_null,
      COUNT(*) FILTER (WHERE "weeklyHours" > 0 AND "weeklyHours" < 24) as needs_conversion,
      COUNT(*) FILTER (WHERE "weeklyHours" >= 24) as already_minutes,
      MIN("weeklyHours") FILTER (WHERE "weeklyHours" > 0) as min_val,
      MAX("weeklyHours") as max_val
    FROM "subjects";
  `);
  console.log('\n=== subjects.weeklyHours BEFORE migration ===');
  console.log(JSON.stringify(before.rows[0], null, 2));

  const beforeCS = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE "weeklyHours" IS NULL OR "weeklyHours" = 0) as zero_or_null,
      COUNT(*) FILTER (WHERE "weeklyHours" > 0 AND "weeklyHours" < 24) as needs_conversion,
      COUNT(*) FILTER (WHERE "weeklyHours" >= 24) as already_minutes
    FROM "class_subjects";
  `);
  console.log('\n=== class_subjects.weeklyHours BEFORE migration ===');
  console.log(JSON.stringify(beforeCS.rows[0], null, 2));

  // 2. Convertir : weeklyHours < 24 → multiplier par 60
  const result1 = await client.query(`
    UPDATE "subjects"
    SET "weeklyHours" = "weeklyHours" * 60
    WHERE "weeklyHours" > 0 AND "weeklyHours" < 24
    RETURNING "id", "name", "code", "weeklyHours";
  `);
  console.log(`\n✅ subjects: ${result1.rowCount} row(s) converted (×60)`);
  for (const r of result1.rows.slice(0, 5)) {
    console.log(`   ${r.name} (${r.code}) → ${r.weeklyHours} min`);
  }
  if (result1.rows.length > 5) console.log(`   ... and ${result1.rows.length - 5} more`);

  const result2 = await client.query(`
    UPDATE "class_subjects"
    SET "weeklyHours" = "weeklyHours" * 60
    WHERE "weeklyHours" > 0 AND "weeklyHours" < 24
    RETURNING "id", "weeklyHours";
  `);
  console.log(`\n✅ class_subjects: ${result2.rowCount} row(s) converted (×60)`);

  // 3. Vérifier après
  const after = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE "weeklyHours" IS NULL OR "weeklyHours" = 0) as zero_or_null,
      COUNT(*) FILTER (WHERE "weeklyHours" > 0 AND "weeklyHours" < 24) as still_needs_conversion,
      COUNT(*) FILTER (WHERE "weeklyHours" >= 24) as now_minutes,
      MIN("weeklyHours") FILTER (WHERE "weeklyHours" > 0) as min_val,
      MAX("weeklyHours") as max_val
    FROM "subjects";
  `);
  console.log('\n=== subjects.weeklyHours AFTER migration ===');
  console.log(JSON.stringify(after.rows[0], null, 2));

  await client.end();
  console.log('\n✅ Done');
}

main().catch(err => {
  console.error('❌ Migration failed:', err.message);
  console.error(err);
  process.exit(1);
});
