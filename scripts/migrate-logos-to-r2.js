const { Client } = require('pg');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

// ─── Configuration (Railway S3_* naming + R2_* fallback for local use) ─────
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

if (!ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !ENDPOINT) {
  console.error('\n❌ Variables manquantes. Configure :');
  console.error('   S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT, S3_BUCKET');
  console.error('   (ou R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID, R2_BUCKET_NAME)');
  process.exit(1);
}

async function main() {
  const db = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    query_timeout: 120000,
  });

  const r2 = new S3Client({
    region: 'auto',
    endpoint: ENDPOINT,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Mode      : ${DRY_RUN ? '🔍 DRY-RUN' : '⚡ RÉEL'}`);
  console.log(`  Bucket    : ${BUCKET_NAME}`);
  console.log(`  Endpoint  : ${ENDPOINT}`);
  console.log(`  Public URL: ${PUBLIC_URL}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  await db.connect();
  console.log('✅ Connecté à Neon\n');

  async function migrateTable({ table, column, idCol, tenantCol, folder, label }) {
    console.log(`─── ${label} ───`);
    const rows = await db.query(`
      SELECT ${idCol} AS id, ${tenantCol || 'NULL'} AS "tenantId", ${column} AS data
      FROM ${table}
      WHERE ${column} IS NOT NULL AND ${column} LIKE 'data:image%'
    `);
    console.log(`   ${rows.rows.length} entrée(s) avec base64\n`);

    let ok = 0, skip = 0, err = 0;
    for (const row of rows.rows) {
      const m = row.data.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!m) { skip++; continue; }
      const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
      const buf = Buffer.from(m[2], 'base64');
      const hash = crypto.createHash('md5').update(buf).digest('hex').slice(0, 8);
      const id = row.tenantId || row.id;
      const key = `${folder}/${id}/logo-${hash}.${ext}`;
      const url = `${PUBLIC_URL}/${key}`;
      console.log(`   ▶️  ${id} (${(buf.length / 1024).toFixed(0)} KB)`);
      try {
        if (!DRY_RUN) {
          await r2.send(new PutObjectCommand({
            Bucket: BUCKET_NAME, Key: key, Body: buf,
            ContentType: `image/${m[1]}`,
            CacheControl: 'public, max-age=31536000, immutable',
          }));
          await db.query(`UPDATE ${table} SET ${column} = $1 WHERE ${idCol} = $2`, [url, row.id]);
        }
        console.log(`      ✅ ${url}`);
        ok++;
      } catch (e) {
        console.log(`      ❌ ${e.message}`);
        err++;
      }
    }
    console.log(`\n   Total: ${ok} ok, ${skip} skip, ${err} err\n`);
    return { ok, skip, err };
  }

  const r1 = await migrateTable({
    table: 'tenant_identity_profiles', column: '"logoUrl"', idCol: 'id',
    tenantCol: '"tenantId"', folder: 'logos/tenants',
    label: 'tenant_identity_profiles.logoUrl',
  });
  const r2r = await migrateTable({
    table: 'schools', column: 'logo', idCol: 'id',
    tenantCol: '"tenantId"', folder: 'logos/schools',
    label: 'schools.logo',
  });

  console.log('─── Vérification ───');
  const v1 = await db.query(`SELECT COUNT(*) FROM tenant_identity_profiles WHERE "logoUrl" LIKE 'data:image%'`);
  const v2 = await db.query(`SELECT COUNT(*) FROM schools WHERE logo LIKE 'data:image%'`);
  const v3 = await db.query(`SELECT COUNT(*) FROM tenant_identity_profiles WHERE "logoUrl" LIKE 'https://%'`);
  console.log(`   tenant base64 restants : ${v1.rows[0].count}`);
  console.log(`   tenant URLs R2         : ${v3.rows[0].count}`);
  console.log(`   schools base64 restants: ${v2.rows[0].count}\n`);

  await db.end();
  console.log(DRY_RUN ? '✅ Dry-run terminé.' : '✅ Migration terminée !');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
