/**
 * ============================================================================
 * MIGRATE LOGOS BASE64 → R2
 * ============================================================================
 *
 * Migre les logos stockés en base64 dans Neon PostgreSQL vers Cloudflare R2.
 * Remplace les data:image/...;base64,... par des URLs publiques R2.
 *
 * Tables migrées :
 *   1. tenant_identity_profiles.logoUrl  (logos des tenants/écoles)
 *   2. schools.logo                      (logos des écoles — table legacy)
 *
 * Variables d'environnement requises ( Railway api-server ) :
 *   - DATABASE_URL                 (Neon PostgreSQL — déjà configurée)
 *   - S3_ACCESS_KEY_ID             (R2 access key)
 *   - S3_SECRET_ACCESS_KEY         (R2 secret key)
 *   - S3_BUCKET                    (nom du bucket R2)
 *   - S3_ENDPOINT                  (https://<account_id>.r2.cloudflarestorage.com)
 *   - S3_PUBLIC_URL                (https://downloads.academiahelm.com)
 *
 * Fallback (variables R2_* — scripts locaux) :
 *   - R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL, R2_ACCOUNT_ID
 *
 * Usage :
 *   npm run migrate:logos            # sur Railway via "railway run" ou CLI shell
 *   ts-node scripts/migrate-logos-to-r2.ts --dry-run    # simulation sans écriture
 *
 * Flags :
 *   --dry-run   : affiche ce qui serait migré sans rien écrire dans R2 ni en DB
 *   --verbose   : logs détaillés
 *
 * Le script est idempotent : si un logo est déjà une URL http(s)://, il est ignoré.
 * ============================================================================
 */

import { Client } from 'pg';
import {
  S3Client,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { createHash } from 'crypto';

// ─── Args parsing ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

// ─── Configuration (Railway S3_* naming + R2_* fallback) ────────────────────

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const ACCESS_KEY_ID =
  process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '';
const SECRET_ACCESS_KEY =
  process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '';
const BUCKET_NAME =
  process.env.S3_BUCKET || process.env.R2_BUCKET_NAME || 'academia-helm-releases';

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const ENDPOINT =
  process.env.S3_ENDPOINT ||
  (ACCOUNT_ID ? `https://${ACCOUNT_ID}.r2.cloudflarestorage.com` : '');

const PUBLIC_URL =
  process.env.S3_PUBLIC_URL || process.env.R2_PUBLIC_URL || 'https://downloads.academiahelm.com';

// ─── Validation ─────────────────────────────────────────────────────────────

function validateConfig() {
  const missing: string[] = [];
  if (!ACCESS_KEY_ID) missing.push('S3_ACCESS_KEY_ID / R2_ACCESS_KEY_ID');
  if (!SECRET_ACCESS_KEY) missing.push('S3_SECRET_ACCESS_KEY / R2_SECRET_ACCESS_KEY');
  if (!BUCKET_NAME) missing.push('S3_BUCKET / R2_BUCKET_NAME');
  if (!ENDPOINT) missing.push('S3_ENDPOINT / R2_ACCOUNT_ID');
  if (missing.length > 0) {
    console.error('\n❌ Variables d\'environnement manquantes :');
    missing.forEach((m) => console.error(`   - ${m}`));
    console.error('\nConfigure ces variables sur Railway (service api-server) ou localement dans .env');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  MIGRATION LOGOS BASE64 → R2');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Mode         : ${DRY_RUN ? '🔍 DRY-RUN (simulation)' : '⚡ RÉEL (écriture)'}`);
  console.log(`  Bucket       : ${BUCKET_NAME}`);
  console.log(`  Endpoint     : ${ENDPOINT}`);
  console.log(`  Public URL   : ${PUBLIC_URL}`);
  console.log(`  Database     : ${DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// ─── R2 client ──────────────────────────────────────────────────────────────

const r2 = new S3Client({
  region: 'auto',
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

// ─── Helpers ────────────────────────────────────────────────────────────────

interface LogoRow {
  id: string;
  tenantId?: string;
  logoData: string;
}

function parseBase64(logoData: string): { ext: string; buffer: Buffer; mime: string } | null {
  const match = logoData.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return null;
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const buffer = Buffer.from(match[2], 'base64');
  return { ext, buffer, mime: `image/${match[1]}` };
}

async function uploadToR2(
  key: string,
  buffer: Buffer,
  mime: string,
): Promise<void> {
  if (DRY_RUN) {
    console.log(`     [DRY-RUN] skip upload → ${key}`);
    return;
  }
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mime,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// ─── Migration : tenant_identity_profiles.logoUrl ──────────────────────────

async function migrateTenantLogos(db: Client): Promise<{ ok: number; skip: number; err: number }> {
  console.log('─── 1/2  tenant_identity_profiles.logoUrl ───\n');
  const result = await db.query<LogoRow>(`
    SELECT id, "tenantId", "logoUrl" AS "logoData"
    FROM tenant_identity_profiles
    WHERE "logoUrl" IS NOT NULL
      AND "logoUrl" LIKE 'data:image%'
  `);

  console.log(`   ${result.rows.length} profil(s) avec logo base64\n`);

  let ok = 0, skip = 0, err = 0;
  for (const row of result.rows) {
    const tenantId = row.tenantId || 'unknown';
    const parsed = parseBase64(row.logoData);
    if (!parsed) {
      console.log(`   ⏭️  ${tenantId}: format base64 invalide — skip`);
      skip++;
      continue;
    }

    const hash = createHash('md5').update(parsed.buffer).digest('hex').slice(0, 8);
    const key = `logos/tenants/${tenantId}/logo-${hash}.${parsed.ext}`;
    const r2Url = `${PUBLIC_URL}/${key}`;

    console.log(`   ▶️  ${tenantId} (${fmtSize(parsed.buffer)})`);

    try {
      await uploadToR2(key, parsed.buffer, parsed.mime);

      if (!DRY_RUN) {
        await db.query(
          `UPDATE tenant_identity_profiles SET "logoUrl" = $1 WHERE id = $2`,
          [r2Url, row.id],
        );
      }

      console.log(`      ✅ ${r2Url}`);
      ok++;
    } catch (e: any) {
      console.log(`      ❌ ${e.message}`);
      err++;
    }
  }

  console.log(`\n   Total: ${ok} migrés, ${skip} ignorés, ${err} erreurs\n`);
  return { ok, skip, err };
}

// ─── Migration : schools.logo ──────────────────────────────────────────────

async function migrateSchoolLogos(db: Client): Promise<{ ok: number; skip: number; err: number }> {
  console.log('─── 2/2  schools.logo ───\n');
  const result = await db.query<LogoRow>(`
    SELECT id, "tenantId", logo AS "logoData"
    FROM schools
    WHERE logo IS NOT NULL
      AND logo LIKE 'data:image%'
  `);

  console.log(`   ${result.rows.length} école(s) avec logo base64\n`);

  let ok = 0, skip = 0, err = 0;
  for (const row of result.rows) {
    const schoolId = row.id;
    const parsed = parseBase64(row.logoData);
    if (!parsed) {
      console.log(`   ⏭️  ${schoolId}: format base64 invalide — skip`);
      skip++;
      continue;
    }

    const hash = createHash('md5').update(parsed.buffer).digest('hex').slice(0, 8);
    const key = `logos/schools/${schoolId}/logo-${hash}.${parsed.ext}`;
    const r2Url = `${PUBLIC_URL}/${key}`;

    console.log(`   ▶️  ${schoolId} (${fmtSize(parsed.buffer)})`);

    try {
      await uploadToR2(key, parsed.buffer, parsed.mime);

      if (!DRY_RUN) {
        await db.query(
          `UPDATE schools SET logo = $1 WHERE id = $2`,
          [r2Url, row.id],
        );
      }

      console.log(`      ✅ ${r2Url}`);
      ok++;
    } catch (e: any) {
      console.log(`      ❌ ${e.message}`);
      err++;
    }
  }

  console.log(`\n   Total: ${ok} migrés, ${skip} ignorés, ${err} erreurs\n`);
  return { ok, skip, err };
}

// ─── Vérification finale ────────────────────────────────────────────────────

async function verify(db: Client): Promise<void> {
  console.log('─── Vérification ───\n');

  const v1 = await db.query(`
    SELECT COUNT(*)::int AS count FROM tenant_identity_profiles
    WHERE "logoUrl" LIKE 'data:image%'
  `);
  const v2 = await db.query(`
    SELECT COUNT(*)::int AS count FROM schools WHERE logo LIKE 'data:image%'
  `);
  const v3 = await db.query(`
    SELECT COUNT(*)::int AS count FROM tenant_identity_profiles
    WHERE "logoUrl" LIKE 'https://%'
  `);
  const v4 = await db.query(`
    SELECT COUNT(*)::int AS count FROM schools WHERE logo LIKE 'https://%'
  `);

  console.log(`   tenant_identity_profiles — base64 restants : ${v1.rows[0].count}`);
  console.log(`   tenant_identity_profiles — URLs R2       : ${v3.rows[0].count}`);
  console.log(`   schools                 — base64 restants : ${v2.rows[0].count}`);
  console.log(`   schools                 — URLs R2       : ${v4.rows[0].count}\n`);

  if (DRY_RUN) {
    console.log('   ℹ️  Mode DRY-RUN : aucune modification écrite en DB.');
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  validateConfig();

  const db = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    query_timeout: 120000,
  });

  await db.connect();
  console.log('✅ Connecté à Neon PostgreSQL\n');

  try {
    const r1 = await migrateTenantLogos(db);
    const r2r = await migrateSchoolLogos(db);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  RÉCAPITULATIF');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Tenants : ${r1.ok} migrés, ${r1.skip} ignorés, ${r1.err} erreurs`);
    console.log(`  Schools : ${r2r.ok} migrés, ${r2r.skip} ignorés, ${r2r.err} erreurs`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    await verify(db);

    if (!DRY_RUN) {
      console.log('✅ Migration terminée ! Les logos sont désormais servis depuis R2.');
      console.log(`   URL publique : ${PUBLIC_URL}/logos/...`);
    } else {
      console.log('✅ Dry-run terminé. Relance sans --dry-run pour exécuter réellement.');
    }
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error('\n❌ Erreur fatale :', e.message);
  if (VERBOSE) console.error(e.stack);
  process.exit(1);
});
