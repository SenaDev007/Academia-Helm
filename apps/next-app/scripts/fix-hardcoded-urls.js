/**
 * ============================================================================
 * SCRIPT DE NETTOYAGE DES URLs HARDCODÉES
 * ============================================================================
 * 
 * Remplace toutes les URLs hardcodées (localhost, vercel.app) par
 * l'utilisation du helper centralisé getApiBaseUrlForRoutes()
 * 
 * Usage: node scripts/fix-hardcoded-urls.js
 * 
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

const API_ROUTES_DIR = path.join(__dirname, '../src/app/api');

// Patterns à remplacer
const REPLACEMENTS = [
  {
    // Pattern 1: const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
    search: /const\s+API_BASE_URL\s*=\s*process\.env\.NEXT_PUBLIC_API_URL\s*\|\|\s*['"]http:\/\/localhost:\d+\/api['"];?/g,
    replacement: `import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';`,
    after: `const API_BASE_URL = getApiBaseUrlForRoutes();`,
  },
  {
    // Pattern 2: const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
    search: /const\s+API_BASE_URL\s*=\s*process\.env\.API_BASE_URL\s*\|\|\s*['"]http:\/\/localhost:\d+['"];?/g,
    replacement: `import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';`,
    after: `const API_BASE_URL = getApiBaseUrlForRoutes();`,
  },
  {
    // Pattern 3: const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    search: /const\s+API_BASE_URL\s*=\s*process\.env\.NEXT_PUBLIC_API_URL\s*\|\|\s*['"]http:\/\/localhost:\d+['"];?/g,
    replacement: `import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';`,
    after: `const API_BASE_URL = getApiBaseUrlForRoutes();`,
  },
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let hasImport = content.includes("from '@/lib/utils/api-urls'");

  // Vérifier si le fichier a déjà l'import
  if (!hasImport) {
    // Chercher le premier import
    const importMatch = content.match(/^import\s+.*from\s+['"].*['"];?\s*$/m);
    if (importMatch) {
      const importLine = importMatch[0];
      const importIndex = content.indexOf(importLine);
      const nextLineIndex = content.indexOf('\n', importIndex) + 1;
      content = content.slice(0, nextLineIndex) + 
                `import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';\n` +
                content.slice(nextLineIndex);
      modified = true;
    } else {
      // Pas d'import, ajouter au début
      content = `import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';\n` + content;
      modified = true;
    }
  }

  // Remplacer les patterns
  for (const replacement of REPLACEMENTS) {
    if (replacement.search.test(content)) {
      // Remplacer la ligne API_BASE_URL
      content = content.replace(
        replacement.search,
        replacement.after
      );
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      walkDir(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function main() {
  console.log('🔍 Recherche des fichiers avec URLs hardcodées...\n');

  const files = walkDir(API_ROUTES_DIR);
  let modifiedCount = 0;

  files.forEach(file => {
    if (processFile(file)) {
      console.log(`✅ Modifié: ${path.relative(API_ROUTES_DIR, file)}`);
      modifiedCount++;
    }
  });

  console.log(`\n✨ ${modifiedCount} fichier(s) modifié(s) sur ${files.length} fichier(s) analysé(s)`);
}

if (require.main === module) {
  main();
}

module.exports = { processFile, walkDir };
