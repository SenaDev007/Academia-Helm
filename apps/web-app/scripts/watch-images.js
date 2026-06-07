/**
 * Watcher pour optimiser automatiquement les nouvelles images
 * Surveille le dossier public/images et optimise les nouvelles images
 * 
 * Usage: npm run watch-images (en développement)
 */

const chokidar = require('chokidar');
const { exec } = require('child_process');
const path = require('path');

const imagesDir = path.join(__dirname, '../public/images');

console.log('👀 Surveillance du dossier images...');
console.log(`📁 Dossier surveillé: ${imagesDir}\n`);

const watcher = chokidar.watch(imagesDir, {
  ignored: /(^|[\/\\])\../, // Ignorer les fichiers cachés
  persistent: true,
  ignoreInitial: true, // Ne pas traiter les fichiers existants au démarrage
});

watcher
  .on('add', (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const supportedExtensions = ['.png', '.jpg', '.jpeg'];
    
    if (supportedExtensions.includes(ext)) {
      console.log(`🆕 Nouvelle image détectée: ${path.basename(filePath)}`);
      console.log('⚡ Optimisation en cours...\n');
      
      exec('npm run optimize-images', (error, stdout, stderr) => {
        if (error) {
          console.error(`❌ Erreur lors de l'optimisation: ${error.message}`);
          return;
        }
        console.log(stdout);
      });
    }
  })
  .on('change', (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const supportedExtensions = ['.png', '.jpg', '.jpeg'];
    
    if (supportedExtensions.includes(ext)) {
      console.log(`🔄 Image modifiée: ${path.basename(filePath)}`);
      console.log('⚡ Ré-optimisation en cours...\n');
      
      exec('npm run optimize-images', (error, stdout, stderr) => {
        if (error) {
          console.error(`❌ Erreur lors de l'optimisation: ${error.message}`);
          return;
        }
        console.log(stdout);
      });
    }
  })
  .on('error', (error) => {
    console.error(`❌ Erreur du watcher: ${error}`);
  });

console.log('✅ Watcher actif. Ajoutez des images dans public/images pour les optimiser automatiquement.');
console.log('💡 Appuyez sur Ctrl+C pour arrêter.\n');

