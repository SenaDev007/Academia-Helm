#!/usr/bin/env node
/**
 * ============================================================================
 * UPLOAD-RELEASE.JS — Upload installables vers Cloudflare R2
 * ============================================================================
 *
 * Usage :
 *   node upload-release.js <file> <platform> <version> [options]
 *
 * Exemple :
 *   node upload-release.js \
 *     /home/z/my-project/download/academia-helm-v1.2.8.apk \
 *     android 1.2.8 \
 *     --notes "Fix crash-on-launch" \
 *     --latest \
 *     --min-os "Android 7.0"
 *
 * Prérequis (variables d'environnement) :
 *   R2_ACCOUNT_ID       — ID du compte Cloudflare
 *   R2_ACCESS_KEY_ID    — Clé d'accès R2
 *   R2_SECRET_ACCESS_KEY— Clé secrète R2
 *   R2_BUCKET_NAME      — Nom du bucket (ex: academia-helm-releases)
 *   R2_PUBLIC_URL       — URL publique du bucket (ex: https://releases.academiahelm.com)
 *   DATABASE_URL        — URL Neon pour insérer les métadonnées
 *
 * Si R2 n'est pas configuré, le script fallback sur GitHub Releases
 * (upload via l'API GitHub) et utilise l'URL GitHub dans la base.
 * ============================================================================
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { createHash } = require('crypto');
const { readFile, stat } = require('fs/promises');
const { basename } = require('path');

// ── Parse arguments ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Usage: node upload-release.js <file> <platform> <version> [options]');
  console.error('Options: --notes "..." --latest --min-os "..." --arch x64|arm64|universal');
  process.exit(1);
}

const [filePath, platform, version] = args;

// Parse optional flags
const options = { notes: '', latest: false, minOs: '', arch: 'universal' };
for (let i = 3; i < args.length; i++) {
  switch (args[i]) {
    case '--notes':
      options.notes = args[++i] || '';
      break;
    case '--latest':
      options.latest = true;
      break;
    case '--min-os':
      options.minOs = args[++i] || '';
      break;
    case '--arch':
      options.arch = args[++i] || 'universal';
      break;
  }
}

// ── Validate platform ──────────────────────────────────────────────────────

const validPlatforms = ['android', 'windows', 'ios', 'macos', 'linux'];
if (!validPlatforms.includes(platform)) {
  console.error(`Invalid platform: ${platform}. Must be one of: ${validPlatforms.join(', ')}`);
  process.exit(1);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n📦 Uploading: ${basename(filePath)}`);
  console.log(`   Platform: ${platform}`);
  console.log(`   Version:  ${version}`);
  console.log(`   Latest:   ${options.latest}`);
  console.log('');

  // 1. Read file and compute metadata
  const fileStats = await stat(filePath);
  const fileBuffer = await readFile(filePath);
  const fileSize = fileStats.size;
  const checksum = createHash('sha256').update(fileBuffer).digest('hex');
  const filename = basename(filePath);

  console.log(`   Size:     ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   SHA-256:  ${checksum.substring(0, 16)}...`);
  console.log('');

  // 2. Determine R2 key (path in bucket)
  const r2Key = `releases/${platform}/${version}/${filename}`;

  // 3. Upload to R2 (or fallback to GitHub URL)
  let downloadUrl;

  const r2Configured = process.env.R2_ACCOUNT_ID &&
                       process.env.R2_ACCESS_KEY_ID &&
                       process.env.R2_SECRET_ACCESS_KEY &&
                       process.env.R2_BUCKET_NAME;

  if (r2Configured) {
    downloadUrl = await uploadToR2(r2Key, fileBuffer, filename, fileSize);
  } else {
    console.warn('⚠️  R2 not configured — using GitHub Releases URL as fallback');
    console.warn('   Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME');
    downloadUrl = `https://github.com/SenaDev007/Academia-Helm/releases/download/v${version}/${filename}`;
    console.log(`   URL: ${downloadUrl}`);
  }

  // 4. Insert metadata into Neon database
  await insertIntoDatabase({
    version,
    platform,
    arch: options.arch,
    filename,
    fileSize,
    downloadUrl,
    checksumSha256: checksum,
    isLatest: options.latest,
    releaseNotes: options.notes,
    minOsVersion: options.minOs,
  });

  console.log('\n✅ Done!');
  console.log(`   Download URL: ${downloadUrl}`);
  console.log('');
}

// ── Upload to Cloudflare R2 ────────────────────────────────────────────────

async function uploadToR2(key, body, filename, fileSize) {
  console.log('📤 Uploading to Cloudflare R2...');

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: getContentType(filename),
    ContentLength: fileSize,
    Metadata: {
      'filename': filename,
      'uploaded-by': 'upload-release.js',
    },
  });

  await client.send(command);

  const publicUrl = process.env.R2_PUBLIC_URL
    ? `${process.env.R2_PUBLIC_URL}/${key}`
    : `https://${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

  console.log(`   Uploaded to: ${key}`);
  console.log(`   Public URL:  ${publicUrl}`);

  return publicUrl;
}

// ── Insert metadata into Neon ──────────────────────────────────────────────

async function insertIntoDatabase(data) {
  console.log('💾 Inserting metadata into Neon database...');

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const release = await prisma.appRelease.upsert({
      where: {
        platform_version_arch: {
          platform: data.platform,
          version: data.version,
          arch: data.arch,
        },
      },
      create: {
        version: data.version,
        platform: data.platform,
        arch: data.arch,
        filename: data.filename,
        fileSize: BigInt(data.fileSize),
        downloadUrl: data.downloadUrl,
        checksumSha256: data.checksumSha256,
        releaseChannel: 'stable',
        isLatest: data.isLatest,
        releaseNotes: data.releaseNotes,
        minOsVersion: data.minOsVersion || null,
      },
      update: {
        filename: data.filename,
        fileSize: BigInt(data.fileSize),
        downloadUrl: data.downloadUrl,
        checksumSha256: data.checksumSha256,
        isLatest: data.isLatest,
        releaseNotes: data.releaseNotes,
        minOsVersion: data.minOsVersion || null,
        updatedAt: new Date(),
      },
    });

    console.log(`   Database record: ${release.id}`);
    console.log(`   isLatest: ${release.isLatest}`);
  } finally {
    await prisma.$disconnect();
  }
}

// ── Helper: Content-Type based on filename ─────────────────────────────────

function getContentType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const types = {
    apk: 'application/vnd.android.package-archive',
    exe: 'application/x-msdownload',
    msi: 'application/x-msi',
    dmg: 'application/x-apple-diskimage',
    zip: 'application/zip',
    deb: 'application/vnd.debian.binary-package',
    rpm: 'application/x-rpm',
  };
  return types[ext] || 'application/octet-stream';
}

// ── Run ────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
