/**
 * ============================================================================
 * SCRIPT DE NETTOYAGE FINAL DES URLs HARDCODÉES
 * ============================================================================
 * 
 * Remplace les patterns restants qui n'ont pas été capturés par le premier script
 * 
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

const API_ROUTES_DIR = path.join(__dirname, '../src/app/api');
const LIB_DIR = path.join(__dirname, '../src/lib');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Vérifier si le fichier a déjà l'import
  const hasImport = content.includes("from '@/lib/utils/api-urls'") || 
                    content.includes("from '@/lib/utils/urls'");
  
  // Pattern 1: const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  if (/const\s+API_URL\s*=\s*process\.env\.NEXT_PUBLIC_API_URL\s*\|\|\s*['"]http:\/\/localhost:\d+['"];?/.test(content)) {
    if (!hasImport) {
      // Ajouter l'import
      const importMatch = content.match(/^import\s+.*from\s+['"].*['"];?\s*$/m);
      if (importMatch) {
        const importLine = importMatch[0];
        const importIndex = content.indexOf(importLine);
        const nextLineIndex = content.indexOf('\n', importIndex) + 1;
        const isApiRoute = filePath.includes('/api/');
        const importPath = isApiRoute 
          ? "import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';"
          : "import { getApiBaseUrl } from '@/lib/utils/urls';";
        content = content.slice(0, nextLineIndex) + 
                  `${importPath}\n` +
                  content.slice(nextLineIndex);
        modified = true;
      } else {
        const isApiRoute = filePath.includes('/api/');
        const importPath = isApiRoute 
          ? "import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';"
          : "import { getApiBaseUrl } from '@/lib/utils/urls';";
        content = importPath + '\n' + content;
        modified = true;
      }
    }
    
    // Remplacer la ligne
    const isApiRoute = filePath.includes('/api/');
    const replacement = isApiRoute 
      ? 'const API_URL = getApiBaseUrlForRoutes();'
      : 'const API_URL = getApiBaseUrl();';
    
    content = content.replace(
      /const\s+API_URL\s*=\s*process\.env\.NEXT_PUBLIC_API_URL\s*\|\|\s*['"]http:\/\/localhost:\d+['"];?/g,
      replacement
    );
    modified = true;
  }
  
  // Pattern 2: const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
  if (/const\s+API_URL\s*=\s*process\.env\.API_URL\s*\|\|\s*process\.env\.NEXT_PUBLIC_API_URL\s*\|\|\s*['"]http:\/\/localhost:\d+\/api['"];?/.test(content)) {
    if (!hasImport) {
      const importMatch = content.match(/^import\s+.*from\s+['"].*['"];?\s*$/m);
      if (importMatch) {
        const importLine = importMatch[0];
        const importIndex = content.indexOf(importLine);
        const nextLineIndex = content.indexOf('\n', importIndex) + 1;
        const isApiRoute = filePath.includes('/api/');
        const importPath = isApiRoute 
          ? "import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';"
          : "import { getApiBaseUrl } from '@/lib/utils/urls';";
        content = content.slice(0, nextLineIndex) + 
                  `${importPath}\n` +
                  content.slice(nextLineIndex);
        modified = true;
      }
    }
    
    const isApiRoute = filePath.includes('/api/');
    const replacement = isApiRoute 
      ? 'const API_URL = getApiBaseUrlForRoutes();'
      : 'const API_URL = getApiBaseUrl();';
    
    content = content.replace(
      /const\s+API_URL\s*=\s*process\.env\.API_URL\s*\|\|\s*process\.env\.NEXT_PUBLIC_API_URL\s*\|\|\s*['"]http:\/\/localhost:\d+\/api['"];?/g,
      replacement
    );
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

function walkDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  
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
  console.log('🔍 Recherche des fichiers restants avec URLs hardcodées...\n');

  const apiFiles = walkDir(API_ROUTES_DIR);
  const libFiles = walkDir(LIB_DIR);
  const allFiles = [...apiFiles, ...libFiles];
  
  let modifiedCount = 0;

  allFiles.forEach(file => {
    if (processFile(file)) {
      console.log(`✅ Modifié: ${path.relative(path.join(__dirname, '..'), file)}`);
      modifiedCount++;
    }
  });

  console.log(`\n✨ ${modifiedCount} fichier(s) modifié(s) sur ${allFiles.length} fichier(s) analysé(s)`);
}

if (require.main === module) {
  main();
}

module.exports = { processFile, walkDir };
