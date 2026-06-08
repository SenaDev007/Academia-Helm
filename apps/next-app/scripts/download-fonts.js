/**
 * ============================================================================
 * SCRIPT DE TÉLÉCHARGEMENT DES POLICES GOOGLE FONTS
 * ============================================================================
 * 
 * Ce script télécharge les polices Google Fonts nécessaires et les stocke
 * localement dans le projet pour éviter les problèmes de connexion.
 * 
 * Usage: node scripts/download-fonts.js
 * 
 * ============================================================================
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration des polices à télécharger
const fonts = [
  {
    name: 'Inter',
    family: 'Inter',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    styles: ['normal'],
    subsets: ['latin'],
  },
];

// Base URL Google Fonts API
const GOOGLE_FONTS_API = 'https://fonts.googleapis.com/css2';
const GOOGLE_FONTS_STATIC = 'https://fonts.gstatic.com/s';

/**
 * Télécharge un fichier depuis une URL
 */
function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Suivre les redirections
        return downloadFile(response.headers.location, filePath)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(filePath);
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      reject(err);
    });
  });
}

/**
 * Extrait les URLs des fichiers de police depuis le CSS
 */
function extractFontUrls(css) {
  const urls = [];
  const regex = /url\(([^)]+)\)/g;
  let match;
  
  while ((match = regex.exec(css)) !== null) {
    const url = match[1].replace(/['"]/g, '');
    if (url.startsWith('http')) {
      urls.push(url);
    } else if (url.startsWith('//')) {
      urls.push('https:' + url);
    }
  }
  
  return urls;
}

/**
 * Télécharge une police depuis Google Fonts
 */
async function downloadFont(font) {
  console.log(`\n📥 Téléchargement de la police ${font.name}...`);
  
  // Stocker les polices dans src/fonts pour que Next.js les optimise automatiquement
  const fontsDir = path.join(__dirname, '..', 'src', 'fonts', font.name.toLowerCase());
  
  // Créer le dossier si nécessaire
  if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
  }
  
  // Construire l'URL de la requête CSS
  const weights = font.weights.join(';');
  const cssUrl = `${GOOGLE_FONTS_API}?family=${encodeURIComponent(font.family)}:wght@${weights}&display=swap`;
  
  console.log(`   URL CSS: ${cssUrl}`);
  
  try {
    // Télécharger le CSS
    const cssPath = path.join(fontsDir, 'font.css');
    await downloadFile(cssUrl, cssPath);
    console.log(`   ✅ CSS téléchargé: ${cssPath}`);
    
    // Lire le CSS pour extraire les URLs des fichiers de police
    const css = fs.readFileSync(cssPath, 'utf-8');
    const fontUrls = extractFontUrls(css);
    
    console.log(`   📦 ${fontUrls.length} fichiers de police à télécharger...`);
    
    // Télécharger chaque fichier de police
    for (let i = 0; i < fontUrls.length; i++) {
      const url = fontUrls[i];
      const fileName = path.basename(url.split('?')[0]); // Enlever les query params
      const filePath = path.join(fontsDir, fileName);
      
      try {
        await downloadFile(url, filePath);
        console.log(`   ✅ ${i + 1}/${fontUrls.length}: ${fileName}`);
      } catch (error) {
        console.error(`   ❌ Erreur lors du téléchargement de ${fileName}:`, error.message);
      }
    }
    
    // Mettre à jour le CSS pour utiliser les chemins relatifs
    let updatedCss = css;
    fontUrls.forEach((url) => {
      const fileName = path.basename(url.split('?')[0]);
      updatedCss = updatedCss.replace(url, `./${fileName}`);
    });
    
    fs.writeFileSync(cssPath, updatedCss);
    console.log(`   ✅ CSS mis à jour avec les chemins relatifs`);
    
    console.log(`\n✅ Police ${font.name} téléchargée avec succès!`);
    console.log(`   📁 Dossier: ${fontsDir}`);
    console.log(`   💡 Les polices sont maintenant stockées localement et seront optimisées par Next.js`);
    
  } catch (error) {
    console.error(`\n❌ Erreur lors du téléchargement de ${font.name}:`, error.message);
    throw error;
  }
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🚀 Démarrage du téléchargement des polices Google Fonts...\n');
  
  try {
    for (const font of fonts) {
      await downloadFont(font);
    }
    
    console.log('\n✨ Toutes les polices ont été téléchargées avec succès!');
    console.log('\n📝 Prochaines étapes:');
    console.log('   1. Vérifiez que les fichiers sont dans public/fonts/');
    console.log('   2. Mettez à jour layout.tsx pour utiliser next/font/local');
    console.log('   3. Redémarrez le serveur de développement\n');
    
  } catch (error) {
    console.error('\n❌ Erreur lors du téléchargement:', error);
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  main();
}

module.exports = { downloadFont, fonts };
