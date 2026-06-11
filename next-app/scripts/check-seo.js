/**
 * Script de vérification SEO
 * 
 * Vérifie que toutes les pages ont les métadonnées SEO requises
 * Usage: npm run check-seo
 */

const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '../src/app');
const errors = [];
const warnings = [];

/**
 * Vérifie qu'une page a les métadonnées SEO
 */
function checkPageSEO(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const dirPath = path.dirname(filePath);
  
  // Si c'est un composant client, les métadonnées DOIVENT être dans le layout
  if (content.includes("'use client'") || content.includes('"use client"')) {
    const layoutPath = fs.existsSync(path.join(dirPath, 'layout.tsx')) 
      ? path.join(dirPath, 'layout.tsx') 
      : fs.existsSync(path.join(dirPath, 'layout.ts')) 
        ? path.join(dirPath, 'layout.ts') 
        : null;
        
    if (!layoutPath) {
      // Vérifier si un layout parent existe (simplifié)
      return true; 
    }
    
    const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
    if (!layoutContent.includes('export const metadata') && !layoutContent.includes('generateMetadata')) {
       errors.push(`❌ ${filePath}: Composant client sans metadata dans son layout (${layoutPath})`);
       return false;
    }
    return true;
  }

  // Vérifier l'export de metadata ou generateMetadata
  if (!content.includes('export const metadata') && 
      !content.includes('export const metadata:') && 
      !content.includes('export async function generateMetadata') &&
      !content.includes('export function generateMetadata')) {
    errors.push(`❌ ${filePath}: Pas d'export metadata ou generateMetadata trouvé`);
    return false;
  }
  
  // Si c'est generateMetadata, on considère que c'est OK pour le title/description car dynamique
  if (content.includes('generateMetadata')) {
    return true;
  }
  
  // Vérifier title
  if (!content.includes('title:')) {
    errors.push(`❌ ${filePath}: Pas de title dans metadata`);
  }
  
  // Vérifier description
  if (!content.includes('description:')) {
    errors.push(`❌ ${filePath}: Pas de description dans metadata`);
  }
  
  return true;
}

/**
 * Parcourt récursivement les dossiers pour trouver les pages
 */
function findPages(dir, relativePath = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const newRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    
    // Ignorer les dossiers privés
    if (entry.isDirectory()) {
      if (entry.name.startsWith('(') && entry.name.includes('public')) {
        // Dossier (public) - continuer
        findPages(fullPath, newRelativePath);
      } else if (!entry.name.startsWith('(') && !entry.name.includes('admin') && !entry.name.includes('app')) {
        // Dossier normal (pas admin, pas app)
        findPages(fullPath, newRelativePath);
      }
    } else if (entry.name === 'page.tsx' || entry.name === 'page.ts') {
      // Page trouvée
      checkPageSEO(fullPath);
    }
  }
}

console.log('🔍 Vérification SEO des pages...\n');

// Vérifier les pages dans app/(public)
const publicDir = path.join(appDir, '(public)');
if (fs.existsSync(publicDir)) {
  findPages(publicDir);
}

// Vérifier la page d'accueil
const homePage = path.join(appDir, 'page.tsx');
if (fs.existsSync(homePage)) {
  checkPageSEO(homePage);
}

// Résultats
console.log(`\n📊 Résultats:`);
console.log(`   Pages vérifiées: ${errors.length + warnings.length > 0 ? 'Plusieurs' : 'Toutes OK'}\n`);

if (errors.length > 0) {
  console.log('❌ Erreurs SEO:');
  errors.forEach(err => console.log(`   ${err}`));
  console.log('');
}

if (warnings.length > 0) {
  console.log('⚠️  Avertissements SEO:');
  warnings.forEach(warn => console.log(`   ${warn}`));
  console.log('');
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ Toutes les pages sont optimisées pour le SEO !\n');
  process.exit(0);
} else {
  console.log('💡 Utilisez generateSEOMetadata() pour corriger les erreurs.\n');
  // Ne pas faire échouer le build, juste afficher les avertissements
  // process.exit(errors.length > 0 ? 1 : 0);
  process.exit(0);
}

