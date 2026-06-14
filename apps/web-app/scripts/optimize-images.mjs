#!/usr/bin/env node
/**
 * ============================================================================
 * OPTIMISEUR D'IMAGES — Academia Helm
 * ============================================================================
 *
 * Script Node.js qui optimise toutes les images du dossier /public :
 *   - Convertit les PNG/JPG volumineux en WebP (qualité 80)
 *   - Redimensionne les images trop grandes (max 1920px de large)
 *   - Supprime les métadonnées EXIF inutiles
 *   - Génère un rapport de compression
 *
 * Utilisation :
 *   node scripts/optimize-images.mjs
 *   node scripts/optimize-images.mjs --dry-run    # Voir sans modifier
 *   node scripts/optimize-images.mjs --force       # Ré-optimiser même les fichiers déjà traités
 *
 * Prérequis :
 *   npm install sharp --save-dev
 *
 * ============================================================================
 */

import { readdir, stat, readFile, writeFile, mkdir } from 'fs/promises';
import { join, extname, basename, dirname } from 'path';
import { existsSync } from 'fs';

const PUBLIC_DIR = join(process.cwd(), 'public');
const MAX_WIDTH = 1920;
const WEBP_QUALITY = 80;
const JPEG_QUALITY = 80;
const PNG_QUALITY = 80;

// Extensions à traiter
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);

// Dossiers à ignorer
const IGNORE_DIRS = new Set(['node_modules', '.next', 'cache']);

let totalSaved = 0;
let totalProcessed = 0;
let totalSkipped = 0;
const isDryRun = process.argv.includes('--dry-run');
const isForce = process.argv.includes('--force');

async function getFileSize(filePath) {
  const s = await stat(filePath);
  return s.size;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function optimizeImage(filePath, sharp) {
  const originalSize = await getFileSize(filePath);
  const ext = extname(filePath).toLowerCase();

  // Si c'est déjà un WebP/AVIF optimisé et qu'on ne force pas, on skip
  if ((ext === '.webp' || ext === '.avif') && !isForce) {
    // Vérifier si un fichier source original existe encore
    const baseName = basename(filePath, ext);
    const hasOriginal = ['.png', '.jpg', '.jpeg'].some(e =>
      existsSync(join(dirname(filePath), baseName + e))
    );
    if (!hasOriginal) {
      totalSkipped++;
      return null;
    }
  }

  const buffer = await readFile(filePath);
  const image = sharp(buffer);
  const metadata = await image.metadata();

  let needsResize = metadata.width && metadata.width > MAX_WIDTH;
  let needsConversion = ext === '.png' || ext === '.jpg' || ext === '.jpeg';

  if (!needsResize && !needsConversion && !isForce) {
    totalSkipped++;
    return null;
  }

  let pipeline = sharp(buffer);

  // Redimensionner si trop grand
  if (needsResize) {
    pipeline = pipeline.resize(MAX_WIDTH, null, {
      withoutEnlargement: true,
      fit: 'inside',
    });
  }

  // Convertir en WebP ou optimiser le format existant
  let outputExt = ext;
  if (needsConversion) {
    pipeline = pipeline.webp({ quality: WEBP_QUALITY, effort: 6 });
    outputExt = '.webp';
  } else if (ext === '.webp') {
    pipeline = pipeline.webp({ quality: WEBP_QUALITY, effort: 6 });
  } else if (ext === '.avif') {
    pipeline = pipeline.avif({ quality: WEBP_QUALITY, effort: 6 });
  } else if (ext === '.png') {
    pipeline = pipeline.png({ quality: PNG_QUALITY, effort: 6 });
  } else if (ext === '.jpg' || ext === '.jpeg') {
    pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, effort: 6 });
  }

  const outputBuffer = await pipeline.toBuffer();
  const saved = originalSize - outputBuffer.length;
  const savedPercent = ((saved / originalSize) * 100).toFixed(1);

  // Si l'optimisation ne gagne rien, on garde l'original
  if (saved <= 0 && !needsConversion) {
    totalSkipped++;
    return null;
  }

  if (isDryRun) {
    console.log(`  [DRY] ${basename(filePath)}: ${formatBytes(originalSize)} → ${formatBytes(outputBuffer.length)} (-${savedPercent}%)`);
    totalProcessed++;
    totalSaved += saved;
    return null;
  }

  // Si on convertit en WebP, écrire le nouveau fichier et optionnellement supprimer l'ancien
  if (needsConversion && outputExt !== ext) {
    const newPath = filePath.replace(new RegExp(`\\${ext}$`), outputExt);
    await writeFile(newPath, outputBuffer);
    // Garder l'original comme fallback (les liens existants peuvent le référencer)
    console.log(`  ✅ ${basename(filePath)} → ${basename(newPath)}: ${formatBytes(originalSize)} → ${formatBytes(outputBuffer.length)} (-${savedPercent}%)`);
  } else {
    await writeFile(filePath, outputBuffer);
    console.log(`  ✅ ${basename(filePath)}: ${formatBytes(originalSize)} → ${formatBytes(outputBuffer.length)} (-${savedPercent}%)`);
  }

  totalProcessed++;
  totalSaved += saved;
  return true;
}

async function walkDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      await walkDir(fullPath);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext)) {
        try {
          await optimizeImage(fullPath, sharp);
        } catch (err) {
          console.warn(`  ⚠️  Erreur sur ${entry.name}: ${err.message}`);
        }
      }
    }
  }
}

// ── Point d'entrée ──
console.log('\n🖼️  Optimiseur d\'images — Academia Helm');
console.log('━'.repeat(50));
if (isDryRun) console.log('📋 Mode DRY-RUN (aucune modification)');
console.log(`📁 Dossier: ${PUBLIC_DIR}`);
console.log(`📐 Largeur max: ${MAX_WIDTH}px | Qualité WebP: ${WEBP_QUALITY}%`);
console.log('━'.repeat(50));

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('\n❌ Le module "sharp" n\'est pas installé.');
  console.error('   Installez-le avec: npm install sharp --save-dev');
  console.error('   Puis relancez: node scripts/optimize-images.mjs\n');
  process.exit(1);
}

await walkDir(PUBLIC_DIR);

console.log('━'.repeat(50));
console.log(`\n📊 Résultats:`);
console.log(`   Images traitées: ${totalProcessed}`);
console.log(`   Images ignorées: ${totalSkipped}`);
console.log(`   Espace économisé: ${formatBytes(totalSaved)}`);
if (isDryRun) console.log('   ⚠️  Mode DRY-RUN — aucune modification apportée');
console.log('');
