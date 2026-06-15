/**
 * Script de génération automatique du sitemap
 * 
 * Scanne app/(public)/ et génère automatiquement les entrées du sitemap
 * Usage: npm run generate-sitemap
 */

const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '../src/app');
const sitemapFile = path.join(__dirname, '../src/app/sitemap.ts');

/**
 * Détecte toutes les pages dans app/(public)/
 */
function findPages(dir, basePath = '') {
  const pages = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const urlPath = basePath ? `${basePath}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        // Récursion
        const subPages = findPages(fullPath, urlPath);
        pages.push(...subPages);
      } else if (entry.name === 'page.tsx' || entry.name === 'page.ts') {
        // Page trouvée
        const url = urlPath.replace('/page', '').replace('(public)/', '');
        const cleanUrl = url === '' ? '/' : `/${url}`;
        
        pages.push({
          path: cleanUrl,
          priority: getDefaultPriority(cleanUrl),
          changeFrequency: getChangeFrequency(cleanUrl),
        });
      }
    }
  } catch (error) {
    // Ignorer les erreurs
  }
  
  return pages;
}

function getDefaultPriority(url) {
  if (url === '/') return 1;
  if (url.includes('signup') || url.includes('modules') || url.includes('plateforme')) return 0.9;
  if (url.includes('securite') || url.includes('orion') || url.includes('contact')) return 0.8;
  if (url.includes('legal')) return 0.3;
  return 0.7;
}

function getChangeFrequency(url) {
  if (url === '/') return 'weekly';
  if (url.includes('legal')) return 'yearly';
  return 'monthly';
}

console.log('🔍 Génération automatique du sitemap...\n');

// Trouver toutes les pages
const publicDir = path.join(appDir, '(public)');
const pages = findPages(publicDir);

// Page d'accueil
pages.unshift({
  path: '/',
  priority: 1,
  changeFrequency: 'weekly',
});

console.log(`📄 ${pages.length} page(s) détectée(s):\n`);
pages.forEach(page => {
  console.log(`   ${page.path} (priority: ${page.priority})`);
});

console.log('\n💡 Ajoutez ces pages manuellement dans src/app/sitemap.ts\n');
console.log('📝 Exemple de code à ajouter:\n');

pages.forEach(page => {
  const urlVar = page.path === '/' ? 'baseUrl' : `\`\${baseUrl}${page.path}\``;
  console.log(`    {
      url: ${urlVar},
      lastModified: new Date(),
      changeFrequency: '${page.changeFrequency}',
      priority: ${page.priority},
    },`);
});

console.log('\n✅ Génération terminée !\n');

