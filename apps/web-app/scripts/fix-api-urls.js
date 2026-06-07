/**
 * Script pour remplacer toutes les URLs hardcodées dans les routes API
 * par l'utilisation du helper centralisé
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const API_ROUTES_DIR = path.join(__dirname, '../src/app/api');

// Patterns à remplacer
const patterns = [
  {
    // Pattern 1: const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
    search: /const API_BASE_URL = process\.env\.NEXT_PUBLIC_API_URL \|\| 'http:\/\/localhost:3000\/api';/g,
    replace: `import { getApiBaseUrl } from '@/lib/utils/urls';\n\nconst API_BASE_URL = getApiBaseUrl();`,
    checkImport: true,
  },
  {
    // Pattern 2: const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    search: /const API_BASE_URL = process\.env\.NEXT_PUBLIC_API_URL \|\| 'http:\/\/localhost:3001';/g,
    replace: `import { getApiBaseUrl } from '@/lib/utils/urls';\n\nconst API_BASE_URL = getApiBaseUrl();`,
    checkImport: true,
  },
];

async function fixApiRoutes() {
  try {
    // Trouver tous les fichiers route.ts dans le dossier API
    const files = await glob('**/route.ts', {
      cwd: API_ROUTES_DIR,
      absolute: true,
    });

    console.log(`Found ${files.length} route files to process`);

    let updatedCount = 0;

    for (const filePath of files) {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;
      let hasImport = content.includes("from '@/lib/utils/urls'");

      for (const pattern of patterns) {
        if (pattern.search.test(content)) {
          // Vérifier si l'import existe déjà
          if (pattern.checkImport && !hasImport) {
            // Ajouter l'import en haut du fichier (après les imports existants)
            const importMatch = content.match(/^(import[^;]+;[\s\n]*)+/m);
            if (importMatch) {
              const lastImport = importMatch[0];
              const importIndex = lastImport.length;
              content = 
                content.slice(0, importIndex) +
                "import { getApiBaseUrl } from '@/lib/utils/urls';\n" +
                content.slice(importIndex);
              hasImport = true;
            } else {
              // Pas d'imports, ajouter au début
              content = "import { getApiBaseUrl } from '@/lib/utils/urls';\n\n" + content;
              hasImport = true;
            }
          }

          // Remplacer le pattern
          content = content.replace(pattern.search, pattern.replace.replace('import { getApiBaseUrl } from \'@/lib/utils/urls\';\n\n', ''));
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        updatedCount++;
        console.log(`✓ Updated: ${path.relative(API_ROUTES_DIR, filePath)}`);
      }
    }

    console.log(`\n✅ Updated ${updatedCount} files`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixApiRoutes();
