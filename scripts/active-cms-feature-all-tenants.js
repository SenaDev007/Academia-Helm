/**
 * active-cms-feature-all-tenants.js — 2026-09-22
 *
 * Contexte : le bouton « Site Institutionnel » (module CMS) était invisible dans
 * la sidebar car le code 'CMS' manquait au FeatureCode enum backend. Le correctif
 * backend (feature-flags.service.ts) l'ajoute à FEATURE_KEYS + DEFAULT_ENABLED_FEATURES,
 * et ensureTenantFeaturesInitialized() créera la ligne à la prochaine ouverture de
 * session — mais uniquement si l'utilisateur passe par /settings/features.
 *
 * Ce script rend l'effet IMMÉDIAT pour tous les tenants actifs :
 *   - upsert d'une ligne tenant_features (CMS, isEnabled=true, status=ACTIVE)
 *     pour chaque tenant active/trial qui n'en a pas encore.
 *   - idempotent : les lignes existantes ne sont pas touchées.
 *
 * Usage : node scripts/active-cms-feature-all-tenants.js [--dry-run]
 */
const { Client } = require('pg');

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('✅ Connecté à Neon\n');

  // Tenants actifs / trial
  const tenants = await client.query(
    "SELECT id, name, slug FROM tenants WHERE status IN ('active', 'trial') ORDER BY name",
  );
  console.log(`🏫 ${tenants.rows.length} tenants actifs :\n`);

  let created = 0;
  let already = 0;

  for (const t of tenants.rows) {
    const existing = await client.query(
      'SELECT "isEnabled", status FROM tenant_features WHERE "tenantId" = $1 AND "featureCode" = $2',
      [t.id, 'CMS'],
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      const ok = row.isEnabled && row.status === 'ACTIVE';
      console.log(`  • ${t.name} — CMS déjà présent (${row.isEnabled ? 'ON' : 'OFF'}, ${row.status})${ok ? '' : ' ⚠️'}`);
      already += 1;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  • ${t.name} — [DRY-RUN] créerait la ligne CMS ACTIVE`);
      created += 1;
      continue;
    }

    await client.query(
      `INSERT INTO tenant_features ("tenantId", "featureCode", "isEnabled", status, "createdAt", "updatedAt")
       VALUES ($1, 'CMS', true, 'ACTIVE', NOW(), NOW())
       ON CONFLICT ("tenantId", "featureCode") DO NOTHING`,
      [t.id],
    );
    console.log(`  • ${t.name} — ✅ ligne CMS créée (ACTIVE)`);
    created += 1;
  }

  console.log(`\n📊 Résumé : ${created} créée(s), ${already} déjà présente(s)${DRY_RUN ? ' (DRY-RUN)' : ''}`);
  await client.end();
}

main().catch((e) => {
  console.error('❌ ERREUR:', e.message);
  process.exit(1);
});
