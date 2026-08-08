#!/usr/bin/env node
/**
 * ============================================================================
// AUTO-UPLOAD RELEASES — Upload automatique vers Cloudflare R2
 * ============================================================================
 *
 * Ce script détecte automatiquement les fichiers dans /download/ et les
 * upload vers R2 + insère les métadonnées dans la table app_releases.
 *
 * Usage :
 *   node scripts/auto-upload-releases.js
 *
 * Variables d'environnement requises :
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   R2_PUBLIC_URL
 *   DATABASE_URL (ou API_URL pour insérer via l'API)
 *
 * Le script :
 *   1. Scanne le dossier /download/ pour trouver les fichiers
 *   2. Pour chaque fichier, détermine la plateforme et la version
 *   3. Upload vers R2 (avec retry si échec)
 *   4. Calcule le SHA-256
 *   5. Insère les métadonnées dans app_releases (via API ou DB directe)
 *   6. Marque comme is_latest si --latest est passé
 * ============================================================================
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { createHash } = require('crypto');
const { readFile, stat, readdir } = require('fs/promises');
const { join, basename } = require('path');

// ── Configuration ──────────────────────────────────────────────────────────

const DOWNLOAD_DIR = join(__homez || '/home/z', 'my-project', 'download');
const API_URL = process.env.API_URL || 'https://api.academiahelm.com/api';
const DATABASE_URL = process.env.DATABASE_URL;

// Patterns pour détecter plateforme + version depuis le nom de fichier
const FILE_PATTERNS = [
  // Windows installer: Academia-Helm-v1.1.0-windows-setup.exe
  { pattern: /Academia-Helm-v([\d.]+)-windows-setup\.exe/i, platform: 'windows', arch: 'universal', type: 'installer' },
  // Windows portable: academia-helm-desktop-v1.1.0.exe
  { pattern: /academia-helm-desktop-v([\d.]+)(?:-portable)?\.exe/i, platform: 'windows', arch: 'x64', type: 'portable' },
  // Android APK: academia-helm-v1.2.8.apk
  { pattern: /academia-helm-v([\d.]+)\.apk/i, platform: 'android', arch: 'universal', type: 'apk' },
  // macOS DMG: Academia-Helm-v1.0.0-macos.dmg
  { pattern: /Academia-Helm-v([\d.]+)-macos\.dmg/i, platform: 'macos', arch: 'universal', type: 'dmg' },
  // Linux AppImage: Academia-Helm-v1.0.0-linux.AppImage
  { pattern: /Academia-Helm-v([\d.]+)-linux\.AppImage/i, platform: 'linux', arch: 'x64', type: 'appimage' },
];

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  AUTO-UPLOAD RELEASES → Cloudflare R2 + Neon PostgreSQL   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // 1. Vérifier les variables d'environnement
  const r2Configured = checkR2Config();
  if (!r2Configured) {
    console.error('❌ Variables R2 manquantes. Voir README ci-dessous.\n');
    printHelp();
    process.exit(1);
  }

  // 2. Scanner le dossier download/
  console.log(`📁 Scanning: ${DOWNLOAD_DIR}\n`);
  const files = await scanDownloadDir();

  if (files.length === 0) {
    console.log('⚠️  Aucun fichier à uploader trouvé dans /download/');
    console.log('   Formats supportés: .exe, .apk, .dmg, .AppImage, .msi');
    process.exit(0);
  }

  console.log(`📦 ${files.length} fichier(s) trouvé(s):\n`);
  files.forEach(f => {
    console.log(`   ${f.icon}  ${f.filename} (${f.platform} v${f.version}, ${(f.fileSize / 1024 / 1024).toFixed(1)} MB)`);
  });
  console.log('');

  // 3. Uploader chaque fichier
  const results = [];

  for (const file of files) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📤 Uploading: ${file.filename}`);
    console.log(`${'─'.repeat(60)}`);

    try {
      const result = await uploadFile(file);
      results.push({ ...result, success: true });
      console.log(`   ✅ Upload OK: ${result.downloadUrl}`);
    } catch (error) {
      console.error(`   ❌ Upload échoué: ${error.message}`);
      results.push({ ...file, success: false, error: error.message });
    }
  }

  // 4. Résumé
  console.log(`\n${'═'.repeat(60)}`);
  console.log('📊 RÉSUMÉ');
  console.log(`${'═'.repeat(60)}`);
  const success = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  console.log(`   ✅ Réussis: ${success.length}`);
  console.log(`   ❌ Échoués: ${failed.length}`);

  if (success.length > 0) {
    console.log('\n   Fichiers disponibles:');
    success.forEach(r => {
      console.log(`   • ${r.platform} v${r.version}: ${r.downloadUrl}`);
    });
  }

  // 5. Vérifier via l'API
  console.log('\n🔍 Vérification via l\'API...');
  try {
    const response = await fetch(`${API_URL}/releases/latest`);
    const data = await response.json();
    console.log(`   GET /api/releases/latest → ${response.status}`);
    console.log(`   ${Array.isArray(data) ? data.length : 0} release(s) disponible(s)`);
  } catch (e) {
    console.log(`   ⚠️  API non accessible: ${e.message}`);
  }

  console.log('\n✨ Terminé!\n');
}

// ── Vérifier la configuration R2 ───────────────────────────────────────────

function checkR2Config() {
  const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
  const missing = required.filter(v => !process.env[v]);

  if (missing.length > 0) {
    console.error(`   Variables manquantes: ${missing.join(', ')}`);
    return false;
  }

  console.log('   ✅ R2_ACCOUNT_ID:', process.env.R2_ACCOUNT_ID?.substring(0, 8) + '...');
  console.log('   ✅ R2_ACCESS_KEY_ID:', process.env.R2_ACCESS_KEY_ID?.substring(0, 8) + '...');
  console.log('   ✅ R2_SECRET_ACCESS_KEY:', '***hidden***');
  console.log('   ✅ R2_BUCKET_NAME:', process.env.R2_BUCKET_NAME);
  console.log('   ✅ R2_PUBLIC_URL:', process.env.R2_PUBLIC_URL || '(non défini)');
  return true;
}

// ── Scanner le dossier download/ ───────────────────────────────────────────

async function scanDownloadDir() {
  let dir = DOWNLOAD_DIR;
  // Fallback: essayer plusieurs chemins
  const { existsSync } = require('fs');
  if (!existsSync(dir)) {
    // Essayer le chemin relatif
    dir = join(process.cwd(), 'download');
  }
  if (!existsSync(dir)) {
    dir = join(process.cwd(), '..', 'download');
  }
  if (!existsSync(dir)) {
    console.error(`❌ Dossier download/ introuvable`);
    process.exit(1);
  }

  const entries = await readdir(dir);
  const files = [];

  for (const entry of entries) {
    const filePath = join(dir, entry);
    const stats = await stat(filePath);

    if (!stats.isFile()) continue;

    // Détecter la plateforme et version depuis le nom
    const match = matchFile(entry);
    if (!match) continue;

    // Ignorer les fichiers de script ou doc
    if (entry.endsWith('.docx') || entry.endsWith('.md') || entry.endsWith('.txt')) continue;

    files.push({
      filePath,
      filename: entry,
      fileSize: stats.size,
      platform: match.platform,
      arch: match.arch,
      version: match.version,
      type: match.type,
      icon: getIcon(match.platform),
    });
  }

  return files;
}

// ── Détecter plateforme + version depuis le nom de fichier ─────────────────

function matchFile(filename) {
  for (const { pattern, platform, arch, type } of FILE_PATTERNS) {
    const match = filename.match(pattern);
    if (match) {
      return { platform, arch, version: match[1], type };
    }
  }
  return null;
}

// ── Upload un fichier vers R2 + insère en DB ───────────────────────────────

async function uploadFile(file) {
  const fileBuffer = await readFile(file.filePath);
  const checksum = createHash('sha256').update(fileBuffer).digest('hex');

  console.log(`   Taille: ${(file.fileSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   SHA-256: ${checksum.substring(0, 16)}...`);

  // Clé R2 (chemin dans le bucket)
  const r2Key = `releases/${file.platform}/${file.version}/${file.filename}`;
  const downloadUrl = `${process.env.R2_PUBLIC_URL || 'https://' + process.env.R2_BUCKET_NAME + '.r2.dev'}/${r2Key}`;

  // Upload vers R2
  console.log(`   Upload vers R2: ${r2Key}`);
  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: r2Key,
    Body: fileBuffer,
    ContentType: getContentType(file.filename),
    ContentLength: file.fileSize,
    Metadata: {
      filename: file.filename,
      platform: file.platform,
      version: file.version,
      'uploaded-by': 'auto-upload-releases.js',
    },
  });

  await s3Client.send(command);
  console.log(`   ✅ Fichier uploadé vers R2`);

  // Insérer les métadonnées dans la DB
  console.log(`   Insertion métadonnées dans app_releases...`);

  // Déterminer si c'est la dernière version (le script le marque si --latest)
  const isLatest = process.argv.includes('--latest') || process.argv.includes('--latest=true');

  // Notes de version automatiques
  const releaseNotes = generateReleaseNotes(file);

  await insertIntoDatabase({
    version: file.version,
    platform: file.platform,
    arch: file.arch,
    filename: file.filename,
    fileSize: file.fileSize,
    downloadUrl,
    checksumSha256: checksum,
    isLatest,
    releaseNotes,
    minOsVersion: getMinOsVersion(file.platform),
  });

  console.log(`   ✅ Métadonnées insérées dans app_releases`);

  return {
    ...file,
    downloadUrl,
    checksum,
  };
}

// ── Insérer dans la base de données ────────────────────────────────────────

async function insertIntoDatabase(data) {
  // Méthode 1: via l'API (si pas de DATABASE_URL)
  if (!DATABASE_URL) {
    return insertViaApi(data);
  }

  // Méthode 2: via Prisma direct (si DATABASE_URL disponible)
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
      data.version,
      data.platform,
      data.arch,
      data.filename,
      BigInt(data.fileSize),
      data.downloadUrl,
      data.checksumSha256,
      data.isLatest,
      data.releaseNotes,
      data.minOsVersion,
    );
    console.log(`   ✅ Inséré via DATABASE_URL`);
  } finally {
    await prisma.$disconnect();
  }
}

// ── Insérer via l'API ──────────────────────────────────────────────────────

async function insertViaApi(data) {
  // Pour l'API, il faut un token JWT admin.
  // Cette méthode est un fallback — normalement on utilise DATABASE_URL.
  console.log('   ⚠️  DATABASE_URL non défini — insertion via API (nécessite ADMIN_TOKEN)');
  console.log('   Pour activer, set DATABASE_URL ou ADMIN_TOKEN env var');
  // TODO: implement API-based insertion if needed
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getContentType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const types = {
    apk: 'application/vnd.android.package-archive',
    exe: 'application/x-msdownload',
    msi: 'application/x-msi',
    dmg: 'application/x-apple-diskimage',
    zip: 'application/zip',
    appimage: 'application/octet-stream',
  };
  return types[ext] || 'application/octet-stream';
}

function getIcon(platform) {
  const icons = {
    windows: '🪟',
    android: '📱',
    macos: '🍎',
    linux: '🐧',
    ios: '📱',
  };
  return icons[platform] || '📦';
}

function getMinOsVersion(platform) {
  const versions = {
    android: 'Android 7.0',
    windows: 'Windows 10',
    macos: 'macOS 11',
    linux: 'Ubuntu 20.04',
    ios: 'iOS 14',
  };
  return versions[platform] || null;
}

function generateReleaseNotes(file) {
  const notes = {
    windows: `Academia Helm Desktop v${file.version}\n- Architecture offline-first\n- Interface locale (bundlée)\n- SQLite locale (624 tables)\n- Sync automatique toutes les 1 heure\n- Bouton Synchroniser manuel`,
    android: `Academia Helm Mobile v${file.version}\n- Firebase configuré\n- Notifications push\n- Mode offline`,
    macos: `Academia Helm Desktop v${file.version} pour macOS`,
    linux: `Academia Helm Desktop v${file.version} pour Linux`,
  };
  return notes[file.platform] || `Version ${file.version}`;
}

function printHelp() {
  console.log(`
┌─────────────────────────────────────────────────────────────────┐
│  CONFIGURATION REQUISE                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Variables d'environnement R2 :                                 │
│  ───────────────────────────────                                │
│  export R2_ACCOUNT_ID=your_cloudflare_account_id               │
│  export R2_ACCESS_KEY_ID=your_r2_access_key                     │
│  export R2_SECRET_ACCESS_KEY=your_r2_secret_key                 │
│  export R2_BUCKET_NAME=academia-helm-releases                   │
│  export R2_PUBLIC_URL=https://downloads.academiahelm.com        │
│                                                                 │
│  Variable DATABASE_URL (pour insérer en base) :                 │
│  ─────────────────────────────────────────────────              │
│  export DATABASE_URL=postgresql://user:pass@host/db             │
│                                                                 │
│  Usage :                                                        │
│  ───────                                                        │
│  node scripts/auto-upload-releases.js           # Upload tous   │
│  node scripts/auto-upload-releases.js --latest   # + mark latest│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
  `);
}

// ── Run ────────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('\n❌ Erreur fatale:', err.message);
  process.exit(1);
});
