const { Client } = require('pg');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const db = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    query_timeout: 60000,
  });

  const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  const BUCKET = process.env.R2_BUCKET_NAME || 'academia-helm-releases';
  const PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://downloads.academiahelm.com';

  await db.connect();
  console.log('Connected to Neon\n');

  // 1. Migrate tenant_identity_profiles.logoUrl
  console.log('=== Migrating tenant_identity_profiles.logoUrl ===');
  const profiles = await db.query(`
    SELECT id, "tenantId", "logoUrl"
    FROM tenant_identity_profiles
    WHERE "logoUrl" IS NOT NULL 
      AND "logoUrl" LIKE 'data:image%'
      AND "isActive" = true
  `);

  console.log(`Found ${profiles.rows.length} active profiles with base64 logos\n`);

  for (const profile of profiles.rows) {
    const logoData = profile.logoUrl;
    const tenantId = profile.tenantId;

    // Parse base64 data
    const match = logoData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) {
      console.log(`  SKIP ${tenantId}: not base64 format`);
      continue;
    }

    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    const hash = crypto.createHash('md5').update(buffer).digest('hex').substring(0, 8);
    const key = `logos/tenants/${tenantId}/logo-${hash}.${ext}`;
    const r2Url = `${PUBLIC_URL}/${key}`;

    console.log(`  Uploading ${tenantId} logo (${(buffer.length / 1024).toFixed(0)} KB)...`);

    try {
      await r2.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: `image/${match[1]}`,
        CacheControl: 'public, max-age=31536000, immutable',
      }));

      // Update database: replace base64 with R2 URL
      await db.query(
        `UPDATE tenant_identity_profiles SET "logoUrl" = $1 WHERE id = $2`,
        [r2Url, profile.id]
      );

      console.log(`  ✅ ${tenantId}: ${r2Url}`);
    } catch (e) {
      console.log(`  ❌ ${tenantId}: ${e.message}`);
    }
  }

  // 2. Migrate schools.logo
  console.log('\n=== Migrating schools.logo ===');
  const schools = await db.query(`
    SELECT id, "tenantId", logo
    FROM schools
    WHERE logo IS NOT NULL
      AND logo LIKE 'data:image%'
  `);

  console.log(`Found ${schools.rows.length} schools with base64 logos\n`);

  for (const school of schools.rows) {
    const logoData = school.logo;
    const schoolId = school.id;

    const match = logoData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) continue;

    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    const hash = crypto.createHash('md5').update(buffer).digest('hex').substring(0, 8);
    const key = `logos/schools/${schoolId}/logo-${hash}.${ext}`;
    const r2Url = `${PUBLIC_URL}/${key}`;

    console.log(`  Uploading school ${schoolId} logo (${(buffer.length / 1024).toFixed(0)} KB)...`);

    try {
      await r2.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: `image/${match[1]}`,
        CacheControl: 'public, max-age=31536000, immutable',
      }));

      await db.query(
        `UPDATE schools SET logo = $1 WHERE id = $2`,
        [r2Url, school.id]
      );

      console.log(`  ✅ ${schoolId}: ${r2Url}`);
    } catch (e) {
      console.log(`  ❌ ${schoolId}: ${e.message}`);
    }
  }

  // 3. Verify
  console.log('\n=== Verification ===');
  const verify1 = await db.query(`
    SELECT COUNT(*) as count FROM tenant_identity_profiles 
    WHERE "logoUrl" LIKE 'data:image%'
  `);
  console.log(`Profiles with base64 logos remaining: ${verify1.rows[0].count}`);

  const verify2 = await db.query(`
    SELECT COUNT(*) as count FROM schools WHERE logo LIKE 'data:image%'
  `);
  console.log(`Schools with base64 logos remaining: ${verify2.rows[0].count}`);

  const verify3 = await db.query(`
    SELECT id, LEFT("logoUrl", 60) as prefix FROM tenant_identity_profiles WHERE "isActive" = true LIMIT 5
  `);
  console.log('\nSample logos:');
  verify3.rows.forEach(r => console.log(`  ${r.prefix}...`));

  await db.end();
  console.log('\n✅ Migration complete!');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
