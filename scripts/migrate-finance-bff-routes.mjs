#!/usr/bin/env node
/**
 * Migration automatique des routes BFF finance vers le pattern standardisé.
 *
 * Pour chaque route GET simple-proxy (fetch backend + return json), on :
 *   1. Ajoute fetchWithTimeout (15s timeout)
 *   2. Remplace fetch() par fetchWithTimeout()
 *   3. Ajoute cache: 'no-store'
 *   4. Ajoute Cache-Control: public, s-maxage=60, stale-while-revalidate=300
 *
 * Les routes déjà complexes (avec logique custom) sont skippées.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const FINANCE_API_DIR = '/home/z/my-project/apps/web-app/src/app/api/finance';

// Trouver toutes les routes BFF finance
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
console.log(`Found ${routeFiles.length} route.ts files in finance/`);

let migrated = 0;
let skipped = 0;
let alreadyMigrated = 0;

for (const file of routeFiles) {
  const content = fs.readFileSync(file, 'utf8');

  // Skip si déjà migré (contient fetchWithTimeout ou bffFetch)
  if (content.includes('fetchWithTimeout') || content.includes('bffFetch')) {
    alreadyMigrated++;
    continue;
  }

  // Skip si pas un simple proxy GET (trop complexe)
  if (!content.includes('export async function GET')) {
    skipped++;
    continue;
  }

  // Pattern : fetch(normalizeApiUrl(...), { headers })
  // → fetchWithTimeout(normalizeApiUrl(...), { headers, cache: 'no-store' }, 15000)
  let newContent = content;

  // 1. Ajouter l'import de fetchWithTimeout si pas déjà là
  if (!newContent.includes("from '@/lib/api/fetch-with-timeout'")) {
    // Trouver le dernier import
    const importMatch = newContent.match(/^import .* from .*;\s*$/m);
    if (importMatch) {
      const lastImportIndex = newContent.lastIndexOf(importMatch[0]) + importMatch[0].length;
      newContent =
        newContent.slice(0, lastImportIndex) +
        "\nimport { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';" +
        newContent.slice(lastImportIndex);
    }
  }

  // 2. Remplacer fetch( par fetchWithTimeout( et ajouter cache: 'no-store' + timeout
  // Pattern : fetch(url, { headers }) → fetchWithTimeout(url, { headers, cache: 'no-store' }, 15000)
  // Pattern : fetch(url, { ...opts, headers }) → fetchWithTimeout(url, { ...opts, headers, cache: 'no-store' }, 15000)
  newContent = newContent.replace(
    /fetch\((normalizeApiUrl\([^)]+\)|`[^`]+`|[^,]+),\s*(\{[^}]*\})\)/g,
    (match, url, opts) => {
      // Si déjà cache: dans opts, skip
      if (opts.includes('cache:')) return match;
      // Ajouter cache: 'no-store' avant la fermeture
      const newOpts = opts.replace(/\}$/, ", cache: 'no-store' }");
      return `fetchWithTimeout(${url}, ${newOpts}, 15000)`;
    }
  );

  // 3. Ajouter Cache-Control header sur les NextResponse.json(data) simple
  // Pattern : return NextResponse.json(data, { status: response.status })
  // → return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
  // Seulement pour les GET qui retournent data (pas d'erreur)
  if (newContent.includes('return NextResponse.json(data')) {
    newContent = newContent.replace(
      /return NextResponse\.json\(data,\s*\{\s*status:\s*response\.status\s*\}\s*\)/g,
      "return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })"
    );
  }

  if (newContent !== content) {
    fs.writeFileSync(file, newContent);
    migrated++;
    console.log(`  ✓ Migrated: ${file.replace(FINANCE_API_DIR, 'finance')}`);
  } else {
    skipped++;
  }
}

console.log(`\n=== Migration Summary ===`);
console.log(`Total routes: ${routeFiles.length}`);
console.log(`Migrated: ${migrated}`);
console.log(`Already migrated: ${alreadyMigrated}`);
console.log(`Skipped (complex or no GET): ${skipped}`);
