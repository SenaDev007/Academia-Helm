/**
 * ============================================================================
 * MIGRATE LOGOS BASE64 → R2 (version simplifiée et robuste)
 * ============================================================================
 */
const { Client } = require('pg');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

// ─── Config ─────────────────────────────────────────────────────────────────
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '';
const SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '';
const BUCKET_NAME = process.env.S3_BUCKET || process.env.R2_BUCKET_NAME || 'academia-helm-releases';
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const ENDPOINT =
  process.env.S3_ENDPOINT ||
  (ACCOUNT_ID ? `https://${ACCOUNT_ID}.r2.cloudflarestorage.com` : '');
const PUBLIC_URL =
  process.env.S3_PUBLIC_URL || process.env.R2_PUBLIC_URL || 'https://downloads.academiahelm.com';

const DRY_RUN = process.argv.includes('--dry-run');

console.log('═══════════════════════════════════════════════════════════');
console.log(`  Mode      : ${DRY_RUN ? '🔍 DRY-RUN' : '⚡ RÉEL'}`);
console.log(`  Bucket    : ${BUCKET_NAME}`);
console.log(`  Endpoint  : ${ENDPOINT}`);
console.log(`  Public URL: ${PUBLIC_URL}`);
console.log(`  DB host   : ${DATABASE_URL.match(/@([^/]+)\//)?.[1] || '?'}`);
console.log('═══════════════════════════════════════════════════════════\n');

if (!ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !ENDPOINT) {
  console.error('❌ Variables manquantes');
  process.exit(1);
}

async function main() {
  // 1. Init S3 client (lazy — no network call)
  console.log('▶️  Initialisation S3 client...');
  const r2 = new S3Client({
    region: 'auto',
    endpoint: ENDPOINT,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
  console.log('   ✅ S3 client créé\n');

  // 2. Init pg client
  console.log('▶️  Initialisation Neon client...');
  const db = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    query_timeout: 120000,
  });
  console.log('   ✅ Neon client créé\n');

  // 3. Connect to Neon
  console.log('▶️  Connexion à Neon...');
  await db.connect();
  console.log('   ✅ Connecté à Neon\n');

  // 4. Helper: upload (or simulate) one logo
  async function migrateOne({ table, column, idCol, tenantCol, folder, row }) {
    const m = row.data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!m) return { status: 'skip', reason: 'not-base64' };

    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const buf = Buffer.from(m[2], 'base64');
    const hash = crypto.createHash('md5').update(buf).digest('hex').slice(0, 8);
    const id = row.tenantId || row.id;
    const key = `${folder}/${id}/logo-${hash}.${ext}`;
    const url = `${PUBLIC_URL}/${key}`;
    const sizeKB = (buf.length / 1024).toFixed(1);

    process.stdout.write(`   ▶️  ${table}/${id} (${sizeKB} KB)... `);

    try {
      if (!DRY_RUN) {
        // Upload to R2
        await r2.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: buf,
          ContentType: `image/${m[1]}`,
          CacheControl: 'public, max-age=31536000, immutable',
        }));

        // Update DB
        await db.query(
          `UPDATE ${table} SET ${column} = $1 WHERE ${idCol} = $2`,
          [url, row.id]
        );
      }
      console.log(`✅ ${url}`);
      return { status: 'ok', url };
    } catch (e) {
      console.log(`❌ ${e.name}: ${e.message}`);
      return { status: 'err', error: e.message };
    }
  }

  // 5. Migrate tenant_identity_profiles
  console.log('─── 1/2  tenant_identity_profiles.logoUrl ───');
  const tenants = await db.query(`
    SELECT id, "tenantId", "logoUrl" AS data
    FROM tenant_identity_profiles
    WHERE "logoUrl" IS NOT NULL AND "logoUrl" LIKE 'data:image%'
  `);
  console.log(`   ${tenants.rows.length} profil(s) à migrer\n`);

  const r1 = { ok: 0, skip: 0, err: 0 };
  for (const row of tenants.rows) {
    const r = await migrateOne({
      table: 'tenant_identity_profiles',
      column: '"logoUrl"',
      idCol: 'id',
      tenantCol: '"tenantId"',
      folder: 'logos/tenants',
      row,
    });
    r1[r.status]++;
  }

  // 6. Migrate schools
  console.log('\n─── 2/2  schools.logo ───');
  const schools = await db.query(`
    SELECT id, "tenantId", logo AS data
    FROM schools
    WHERE logo IS NOT NULL AND logo LIKE 'data:image%'
  `);
  console.log(`   ${schools.rows.length} école(s) à migrer\n`);

  const r2r = { ok: 0, skip: 0, err: 0 };
  for (const row of schools.rows) {
    const r = await migrateOne({
      table: 'schools',
      column: 'logo',
      idCol: 'id',
      tenantCol: '"tenantId"',
      folder: 'logos/schools',
      row,
    });
    r2r[r.status]++;
  }

  // 7. Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  RÉCAPITULATIF');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Tenants : ${r1.ok} migrés, ${r1.skip} ignorés, ${r1.err} erreurs`);
  console.log(`  Schools : ${r2r.ok} migrés, ${r2r.skip} ignorés, ${r2r.err} erreurs`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // 8. Verification
  console.log('─── Vérification finale ───');
  const v1 = await db.query(`SELECT COUNT(*)::int AS c FROM tenant_identity_profiles WHERE "logoUrl" LIKE 'data:image%'`);
  const v2 = await db.query(`SELECT COUNT(*)::int AS c FROM schools WHERE logo LIKE 'data:image%'`);
  const v3 = await db.query(`SELECT COUNT(*)::int AS c FROM tenant_identity_profiles WHERE "logoUrl" LIKE 'https://%'`);
  const v4 = await db.query(`SELECT COUNT(*)::int AS c FROM schools WHERE logo LIKE 'https://%'`);
  console.log(`   tenant_identity_profiles — base64 restants : ${v1.rows[0].c}`);
  console.log(`   tenant_identity_profiles — URLs R2       : ${v3.rows[0].c}`);
  console.log(`   schools                 — base64 restants : ${v2.rows[0].c}`);
  console.log(`   schools                 — URLs R2       : ${v4.rows[0].c}\n`);

  await db.end();

  if (DRY_RUN) {
    console.log('✅ Dry-run terminé — aucune modification écrite.');
    console.log('   Relance sans --dry-run pour exécuter réellement.');
  } else {
    console.log('✅ Migration terminée ! Les logos sont servis depuis R2.');
  }
}

main().catch(e => {
  console.error('\n❌ ERREUR FATALE');
  console.error('   message :', e.message || '(empty)');
  console.error('   name    :', e.name);
  console.error('   code    :', e.code);
  console.error('   stack   :', e.stack?.split('\n').slice(0, 5).join('\n   '));
  process.exit(1);
});
