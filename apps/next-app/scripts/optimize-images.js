/**
 * Script d'optimisation des images
 * Convertit automatiquement toutes les images PNG/JPG/JPEG en WebP et AVIF
 * Utilise sharp pour la conversion
 * Détecte automatiquement toutes les nouvelles images
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, '../public/images');
const outputDir = imagesDir; // On garde les images dans le même dossier

// Extensions d'images supportées
const supportedExtensions = ['.png', '.jpg', '.jpeg', '.PNG', '.JPG', '.JPEG'];

// Extensions déjà optimisées (pour éviter de re-optimiser)
const optimizedExtensions = ['.webp', '.avif', '.WEBP', '.AVIF'];

/**
 * Détecte automatiquement toutes les images à optimiser
 */
function detectImagesToOptimize() {
  if (!fs.existsSync(imagesDir)) {
    console.warn(`⚠️  Le dossier ${imagesDir} n'existe pas`);
    return [];
  }

  const files = fs.readdirSync(imagesDir);
  const imagesToOptimize = [];

  for (const file of files) {
    const filePath = path.join(imagesDir, file);
    const stat = fs.statSync(filePath);

    // Ignorer les dossiers
    if (!stat.isFile()) continue;

    const ext = path.extname(file);
    
    // Vérifier si c'est une image supportée
    if (!supportedExtensions.includes(ext)) continue;

    // Vérifier si l'image n'est pas déjà optimisée
    const baseName = path.parse(file).name;
    const webpPath = path.join(imagesDir, `${baseName}.webp`);
    const avifPath = path.join(imagesDir, `${baseName}.avif`);

    // Si les versions optimisées existent déjà, vérifier si elles sont plus récentes
    let needsOptimization = true;
    if (fs.existsSync(webpPath) && fs.existsSync(avifPath)) {
      const originalTime = stat.mtime;
      const webpTime = fs.statSync(webpPath).mtime;
      const avifTime = fs.statSync(avifPath).mtime;
      
      // Si les versions optimisées sont plus récentes que l'original, on skip
      if (webpTime >= originalTime && avifTime >= originalTime) {
        needsOptimization = false;
      }
    }

    if (needsOptimization) {
      imagesToOptimize.push(file);
    }
  }

  return imagesToOptimize;
}

async function optimizeImage(inputPath, outputPath, format, quality = 85) {
  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    let output;
    if (format === 'webp') {
      output = image.webp({ quality });
    } else if (format === 'avif') {
      output = image.avif({ quality });
    } else {
      console.log(`Format ${format} non supporté`);
      return false;
    }
    
    await output.toFile(outputPath);
    
    const originalSize = fs.statSync(inputPath).size;
    const optimizedSize = fs.statSync(outputPath).size;
    const reduction = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2);
    
    console.log(`✓ ${path.basename(inputPath)} → ${path.basename(outputPath)}`);
    console.log(`  Réduction: ${reduction}% (${(originalSize / 1024).toFixed(2)}KB → ${(optimizedSize / 1024).toFixed(2)}KB)`);
    
    return true;
  } catch (error) {
    console.error(`✗ Erreur lors de l'optimisation de ${inputPath}:`, error.message);
    return false;
  }
}

async function optimizeAllImages() {
  console.log('🚀 Début de l\'optimisation automatique des images...\n');
  
  if (!fs.existsSync(imagesDir)) {
    console.error(`❌ Le dossier ${imagesDir} n'existe pas`);
    process.exit(1);
  }

  // Détection automatique des images à optimiser
  const imagesToOptimize = detectImagesToOptimize();

  if (imagesToOptimize.length === 0) {
    console.log('✅ Toutes les images sont déjà optimisées !');
    console.log('💡 Ajoutez de nouvelles images PNG/JPG dans public/images pour les optimiser automatiquement.\n');
    return;
  }

  console.log(`📸 ${imagesToOptimize.length} image(s) détectée(s) à optimiser:\n`);
  imagesToOptimize.forEach(img => console.log(`   - ${img}`));
  console.log('');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const imageName of imagesToOptimize) {
    const inputPath = path.join(imagesDir, imageName);
    
    if (!fs.existsSync(inputPath)) {
      console.warn(`⚠️  Image non trouvée: ${imageName}`);
      continue;
    }
    
    const baseName = path.parse(imageName).name;
    
    // Générer WebP
    const webpPath = path.join(outputDir, `${baseName}.webp`);
    const webpSuccess = await optimizeImage(inputPath, webpPath, 'webp');
    if (webpSuccess) successCount++; else errorCount++;
    
    // Générer AVIF (meilleure compression mais moins de support)
    const avifPath = path.join(outputDir, `${baseName}.avif`);
    const avifSuccess = await optimizeImage(inputPath, avifPath, 'avif', 80);
    if (avifSuccess) successCount++; else errorCount++;
  }
  
  console.log(`\n✅ Optimisation terminée: ${successCount} succès, ${errorCount} erreurs`);
  console.log('\n💡 Les images optimisées sont prêtes. Next.js les utilisera automatiquement.');
  console.log('💡 Pour optimiser de nouvelles images, exécutez simplement: npm run optimize-images\n');
}

optimizeAllImages().catch(console.error);

