/**
 * Vérifie l'état des logos dans Neon PostgreSQL.
 * À exécuter avant et après la migration pour constater la différence.
 */
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const db = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    query_timeout: 30000,
  });

  await db.connect();
  console.log('✅ Connecté à Neon\n');

  // tenant_identity_profiles
  const t1 = await db.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE "logoUrl" LIKE 'data:image%')::int AS base64_count,
      COUNT(*) FILTER (WHERE "logoUrl" LIKE 'https://%')::int AS url_count,
      COUNT(*) FILTER (WHERE "logoUrl" IS NULL)::int AS null_count,
      COALESCE(SUM(LENGTH("logoUrl")) FILTER (WHERE "logoUrl" LIKE 'data:image%'), 0)::bigint AS base64_total_bytes
    FROM tenant_identity_profiles
  `);
  const t = t1.rows[0];
  console.log('═══ tenant_identity_profiles ═══');
  console.log(`  Total profils       : ${t.total}`);
  console.log(`  Logos base64        : ${t.base64_count}`);
  console.log(`  Logos URL (https://): ${t.url_count}`);
  console.log(`  Logos NULL          : ${t.null_count}`);
  console.log(`  Taille base64 total : ${(t.base64_total_bytes / 1024 / 1024).toFixed(2)} MB\n`);

  // schools
  const s1 = await db.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE logo LIKE 'data:image%')::int AS base64_count,
      COUNT(*) FILTER (WHERE logo LIKE 'https://%')::int AS url_count,
      COUNT(*) FILTER (WHERE logo IS NULL)::int AS null_count,
      COALESCE(SUM(LENGTH(logo)) FILTER (WHERE logo LIKE 'data:image%'), 0)::bigint AS base64_total_bytes
    FROM schools
  `);
  const s = s1.rows[0];
  console.log('═══ schools ═══');
  console.log(`  Total écoles        : ${s.total}`);
  console.log(`  Logos base64        : ${s.base64_count}`);
  console.log(`  Logos URL (https://): ${s.url_count}`);
  console.log(`  Logos NULL          : ${s.null_count}`);
  console.log(`  Taille base64 total : ${(s.base64_total_bytes / 1024 / 1024).toFixed(2)} MB\n`);

  // Total gain potentiel
  const totalBytes = Number(t.base64_total_bytes) + Number(s.base64_total_bytes);
  console.log('═══ Synthèse ═══');
  console.log(`  Taille base64 totale (DB) : ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Après migration (URLs)    : ~${(((t.base64_count + s.base64_count) * 60) / 1024).toFixed(2)} KB`);
  console.log(`  Gain estimé               : ${(totalBytes / 1024 / 1024).toFixed(2)} MB → ~0 MB\n`);

  // Sample tenant logos (pour visualiser)
  if (t.base64_count > 0) {
    const sample = await db.query(`
      SELECT "tenantId", LEFT("logoUrl", 50) AS prefix, LENGTH("logoUrl") AS len
      FROM tenant_identity_profiles
      WHERE "logoUrl" LIKE 'data:image%'
      LIMIT 5
    `);
    console.log('═══ Échantillon (5 premiers base64) ═══');
    sample.rows.forEach(r => console.log(`  ${r.tenantId}: ${r.prefix}... (${(r.len / 1024).toFixed(0)} KB)`));
    console.log('');
  } else {
    console.log('✅ Aucun logo base64 — migration déjà effectuée !\n');
  }

  await db.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
