#!/usr/bin/env node
/**
 * ============================================================================
// CI/CD AUTO-UPLOAD — S'exécute après le build (GitHub Actions / Codemagic)
 * ============================================================================
 *
 * Ce script est conçu pour être exécuté par CI/CD après qu'un build
 * d'installable est terminé. Il :
 *
 *   1. Détecte les fichiers générés dans le dossier de build
 *   2. Les upload vers Cloudflare R2
 *   3. Insère les métadonnées dans app_releases
 *   4. Marque automatiquement comme is_latest = true
 *
 * Variables d'environnement (définies dans CI/CD secrets) :
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   R2_PUBLIC_URL
 *   DATABASE_URL
 *   VERSION (ou extrait du tag git)
 *
 * Usage dans GitHub Actions :
 *   - name: Upload to R2
 *     run: node scripts/ci-upload-releases.js
 *     env:
 *       R2_ACCOUNT_ID: ${{ secrets.R2_ACCOUNT_ID }}
 *       R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
 *       R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
 *       R2_BUCKET_NAME: academia-helm-releases
 *       R2_PUBLIC_URL: https://downloads.academiahelm.com
 *       DATABASE_URL: ${{ secrets.DATABASE_URL }}
 * ============================================================================
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { createHash } = require('crypto');
const { readFile, stat } = require('fs/promises');
const { basename, join } = require('path');

// ── Configuration ──────────────────────────────────────────────────────────

const API_URL = process.env.API_URL || 'https://api.academiahelm.com/api';

// Dossiers de build (où les installables sont générés)
const BUILD_DIRS = [
  // Desktop (Tauri)
  'apps/desktop/src-tauri/target/release/bundle/nsis',
  'apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis',
  'apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/nsis/x64',
  // Mobile (Flutter)
  'apps/mobile-app/build/app/outputs/flutter-apk',
  'apps/mobile-app/build/app/outputs/bundle/release',
  // Download folder (manual builds)
  'download',
];

// Extensions de fichiers d'installable
const INSTALLER_EXTENSIONS = ['.exe', '.msi', '.apk', '.aab', '.dmg', '.AppImage', '.deb'];

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 CI/CD Auto-Upload Releases\n');

  // Vérifier la configuration
  if (!checkConfig()) {
    process.exit(1);
  }

  // Déterminer la version depuis le tag git ou env
  const version = process.env.VERSION || extractVersionFromGit();
  if (!version) {
    console.error('❌ Impossible de déterminer la version. Set VERSION env var.');
    process.exit(1);
  }
  console.log(`📋 Version: ${version}\n`);

  // Scanner les dossiers de build
  const files = await scanBuildDirs();
  if (files.length === 0) {
    console.log('⚠️  Aucun installable trouvé dans les dossiers de build');
    process.exit(0);
  }

  console.log(`📦 ${files.length} fichier(s) trouvé(s):\n`);
  files.forEach(f => console.log(`   ${f.filename} (${(f.fileSize / 1024 / 1024).toFixed(1)} MB)`));
  console.log('');

  // Uploader chaque fichier
  for (const file of files) {
    await uploadAndRegister(file, version);
  }

  console.log('\n✅ Tous les fichiers ont été uploadés et enregistrés!\n');

  // Vérifier via l'API
  await verifyApi();
}

// ── Scanner les dossiers de build ──────────────────────────────────────────

async function scanBuildDirs() {
  const { existsSync } = require('fs');
  const files = [];

  for (const dir of BUILD_DIRS) {
    const fullPath = join(process.cwd(), dir);
    if (!existsSync(fullPath)) continue;

    const entries = await readdirSafe(fullPath);
    for (const entry of entries) {
      const filePath = join(fullPath, entry);
      const stats = await stat(filePath);

      if (!stats.isFile()) continue;

      const ext = '.' + entry.split('.').pop().toLowerCase();
      if (!INSTALLER_EXTENSIONS.includes(ext)) continue;

      // Ignorer les fichiers temporaires
      if (entry.endsWith('.sha1') || entry.endsWith('.json')) continue;

      const match = matchFile(entry);
      files.push({
        filePath,
        filename: entry,
        fileSize: stats.size,
        platform: match?.platform || guessPlatform(entry),
        arch: match?.arch || 'universal',
        version: match?.version || 'unknown',
      });
    }
  }

  return files;
}

async function readdirSafe(dir) {
  try {
    return await require('fs/promises').readdir(dir);
  } catch {
    return [];
  }
}

// ── Upload + Register ──────────────────────────────────────────────────────

async function uploadAndRegister(file, defaultVersion) {
  console.log(`\n📤 ${file.filename}`);

  const version = file.version !== 'unknown' ? file.version : defaultVersion;
  const fileBuffer = await readFile(file.filePath);
  const checksum = createHash('sha256').update(fileBuffer).digest('hex');

  // Upload vers R2
  const r2Key = `releases/${file.platform}/${version}/${file.filename}`;
  const downloadUrl = `${process.env.R2_PUBLIC_URL}/${r2Key}`;

  console.log(`   Upload → R2: ${r2Key}`);

  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: r2Key,
    Body: fileBuffer,
    ContentType: getContentType(file.filename),
    ContentLength: file.fileSize,
  }));

  console.log(`   ✅ R2: ${downloadUrl}`);

  // Insérer en DB
  await insertIntoDatabase({
    version,
    platform: file.platform,
    arch: file.arch,
    filename: file.filename,
    fileSize: file.fileSize,
    downloadUrl,
    checksumSha256: checksum,
    isLatest: true,
    releaseNotes: `Build ${version} from CI/CD`,
    minOsVersion: getMinOsVersion(file.platform),
  });

  console.log(`   ✅ DB: app_releases (${file.platform} v${version})`);
}

// ── Insérer dans la DB ─────────────────────────────────────────────────────

async function insertIntoDatabase(data) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO app_releases (id, version, platform, arch, filename, file_size, download_url, checksum_sha256, release_channel, is_latest, release_notes, min_os_version)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, 'stable', $8, $9, $10)
       ON CONFLICT (platform, version, arch) DO UPDATE SET
         filename = EXCLUDED.filename,
         file_size = EXCLUDED.file_size,
         download_url = EXCLUDED.download_url,
         checksum_sha256 = EXCLUDED.checksum_sha256,
         is_latest = EXCLUDED.is_latest,
         release_notes = EXCLUDED.release_notes,
         updated_at = now()`,
      data.version, data.platform, data.arch, data.filename,
      BigInt(data.fileSize), data.downloadUrl, data.checksumSha256,
      data.isLatest, data.releaseNotes, data.minOsVersion,
    );
  } finally {
    await prisma.$disconnect();
  }
}

// ── Vérifier via l'API ─────────────────────────────────────────────────────

async function verifyApi() {
  try {
    const res = await fetch(`${API_URL}/releases/latest`);
    const data = await res.json();
    console.log(`🔍 API /releases/latest: ${res.status} — ${Array.isArray(data) ? data.length : 0} releases`);
  } catch (e) {
    console.log(`⚠️  API check: ${e.message}`);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function checkConfig() {
  const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'DATABASE_URL'];
  const missing = required.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error(`❌ Variables manquantes: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

function extractVersionFromGit() {
  try {
    const tag = require('child_process').execSync('git describe --tags --abbrev=0 2>/dev/null || echo ""', { encoding: 'utf-8' }).trim();
    return tag.replace(/^v/, '') || null;
  } catch {
    return null;
  }
}

function matchFile(filename) {
  const patterns = [
    { pattern: /Academia-Helm-v?([\d.]+)-windows-setup\.exe/i, platform: 'windows', arch: 'universal' },
    { pattern: /academia-helm-desktop-v?([\d.]+).*\.exe/i, platform: 'windows', arch: 'x64' },
    { pattern: /academia-helm-v?([\d.]+)\.apk/i, platform: 'android', arch: 'universal' },
    { pattern: /Academia-Helm-v?([\d.]+)-macos\.dmg/i, platform: 'macos', arch: 'universal' },
    { pattern: /Academia-Helm_([\d.]+)_x64-setup\.exe/i, platform: 'windows', arch: 'universal' },
  ];
  for (const { pattern, platform, arch } of patterns) {
    const m = filename.match(pattern);
    if (m) return { platform, arch, version: m[1] };
  }
  return null;
}

function guessPlatform(filename) {
  if (filename.endsWith('.apk') || filename.endsWith('.aab')) return 'android';
  if (filename.endsWith('.exe') || filename.endsWith('.msi')) return 'windows';
  if (filename.endsWith('.dmg')) return 'macos';
  if (filename.endsWith('.AppImage') || filename.endsWith('.deb')) return 'linux';
  return 'unknown';
}

function getContentType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return { apk: 'application/vnd.android.package-archive', exe: 'application/x-msdownload', msi: 'application/x-msi', dmg: 'application/x-apple-diskimage' }[ext] || 'application/octet-stream';
}

function getMinOsVersion(platform) {
  return { android: 'Android 7.0', windows: 'Windows 10', macos: 'macOS 11', linux: 'Ubuntu 20.04' }[platform] || null;
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
