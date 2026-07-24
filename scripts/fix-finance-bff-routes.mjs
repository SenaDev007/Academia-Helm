#!/usr/bin/env node
/**
 * Fix les routes cassées par le script migrate-finance-bff-routes.mjs.
 *
 * Le problème : le regex ne gérait pas les opts multi-lignes :
 *   fetch(url, {
 *     method: 'DELETE',
 *     headers,
 *   , cache: 'no-store' }, 15000);
 *
 * Devient :
 *   fetchWithTimeout(url, {
 *     method: 'DELETE',
 *     headers,
 *     cache: 'no-store',
 *   }, 15000);
 */
import fs from 'fs';
import path from 'path';

const FINANCE_API_DIR = '/home/z/my-project/apps/web-app/src/app/api/finance';

function findRouteFiles(dir) {
  let results = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(findRouteFiles(fullPath));
    } else if (item === 'route.ts') {
      results.push(fullPath);
    }
  }
  return results;
}

const routeFiles = findRouteFiles(FINANCE_API_DIR);
let fixed = 0;

for (const file of routeFiles) {
  let content = fs.readFileSync(file, 'utf8');

  // Pattern cassé : ", cache: 'no-store' }, 15000);" après une ligne sans virgule
  // Le corriger en : ",\n    cache: 'no-store',\n  }, 15000);"
  // Plus précisément : remplacer "  , cache: 'no-store' }" par "    cache: 'no-store',\n  }"

  const original = content;

  // Pattern : ligne se terminant par "headers," ou "headers," suivi de ", cache: 'no-store' }"
  // → remplacer par "headers,\n      cache: 'no-store',\n    }"
  content = content.replace(
    /(\w+),\s*\n\s*,\s*cache:\s*'no-store'\s*\}/g,
    '$1,\n      cache: \'no-store\',\n    }'
  );

  // Pattern alternatif : "headers,\n    , cache: 'no-store' }"
  content = content.replace(
    /,\s*\n(\s*),\s*cache:\s*'no-store'\s*\}/g,
    ',\n$1  cache: \'no-store\',\n$1}'
  );

  // Pattern simple : ", cache: 'no-store' }," sur une ligne seule
  content = content.replace(
    /^\s*,\s*cache:\s*'no-store'\s*\},\s*(\d+)\);/gm,
    '    cache: \'no-store\',\n  }, $1);'
  );

  if (content !== original) {
    fs.writeFileSync(file, content);
    fixed++;
    console.log(`  ✓ Fixed: ${file.replace(FINANCE_API_DIR, 'finance')}`);
  }
}

console.log(`\nFixed ${fixed} files`);
