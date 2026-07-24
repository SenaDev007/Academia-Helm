#!/usr/bin/env node
/**
 * Migration automatique des routes BFF vers le pattern standardisé.
 * Version générique — accepte une liste de dossiers à traiter.
 *
 * Usage : node scripts/migrate-bff-routes.mjs
 *
 * Pour chaque route GET simple-proxy :
 *   1. fetchWithTimeout(15s) au lieu de fetch() sans timeout
 *   2. cache: 'no-store' au lieu de next: { revalidate }
 *   3. Cache-Control: public, s-maxage=60, stale-while-revalidate=300
 */
import fs from 'fs';
import path from 'path';

const API_DIR = '/home/z/my-project/apps/web-app/src/app/api';

// Dossiers à migrer (P2 + P3 + P4)
const MODULES = [
  // P2
  'pedagogy', 'pedagogy-space', 'lesson-plans', 'council-decisions',
  'timetables', 'timetable-engine', 'multigrade', 'academic-tracks',
  'settings',
  // P3
  'hr', 'exams', 'communication', 'tenant-website', 'tenant-theme',
  'tenant-media', 'public',
  // P4
  'platform', 'onboarding', 'billing', 'positions', 'absences',
  'discipline', 'report-cards', 'staff-admin-assignments',
];

function findRouteFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
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

let totalMigrated = 0;
let totalSkipped = 0;
let totalAlreadyMigrated = 0;
let totalFiles = 0;

for (const module of MODULES) {
  const moduleDir = path.join(API_DIR, module);
  const routeFiles = findRouteFiles(moduleDir);

  if (routeFiles.length === 0) {
    console.log(`\n=== ${module} : 0 routes (dossier introuvable) ===`);
    continue;
  }

  console.log(`\n=== ${module} : ${routeFiles.length} routes ===`);
  let migrated = 0, skipped = 0, alreadyMigrated = 0;

  for (const file of routeFiles) {
    totalFiles++;
    const content = fs.readFileSync(file, 'utf8');

    // Skip si déjà migré
    if (content.includes('fetchWithTimeout') || content.includes('bffFetch')) {
      alreadyMigrated++;
      totalAlreadyMigrated++;
      continue;
    }

    // Skip si pas de GET
    if (!content.includes('export async function GET')) {
      skipped++;
      totalSkipped++;
      continue;
    }

    let newContent = content;

    // 1. Ajouter l'import de fetchWithTimeout
    if (!newContent.includes("from '@/lib/api/fetch-with-timeout'") &&
        !newContent.includes("from \"@/lib/api/fetch-with-timeout\"")) {
      const importMatch = newContent.match(/^import .* from .*;\s*$/m);
      if (importMatch) {
        const lastImportIndex = newContent.lastIndexOf(importMatch[0]) + importMatch[0].length;
        newContent =
          newContent.slice(0, lastImportIndex) +
          "\nimport { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';" +
          newContent.slice(lastImportIndex);
      }
    }

    // 2. Remplacer fetch( par fetchWithTimeout( + ajouter cache: 'no-store' + timeout 15s
    // Gère les opts single-line ET multi-line
    newContent = newContent.replace(
      /fetch\((normalizeApiUrl\([^)]+\)|`[^`]+`|"[^"]+"|'[^']+'|[^,)]+),\s*(\{[^}]*\})\)/g,
      (match, url, opts) => {
        if (opts.includes('cache:')) return match;
        const newOpts = opts.replace(/\}\s*$/, ", cache: 'no-store' }");
        return `fetchWithTimeout(${url}, ${newOpts}, 15000)`;
      }
    );

    // Fix pour opts multi-lignes : si on a "headers,\n    , cache: 'no-store' }"
    // le remplacer par "headers,\n      cache: 'no-store',\n    }"
    newContent = newContent.replace(
      /(\w+),\s*\n\s*,\s*cache:\s*'no-store'\s*\}/g,
      '$1,\n      cache: \'no-store\',\n    }'
    );

    // 3. Ajouter Cache-Control sur les NextResponse.json(data, { status: response.status })
    if (newContent.includes('return NextResponse.json(data')) {
      newContent = newContent.replace(
        /return NextResponse\.json\(data,\s*\{\s*status:\s*response\.status\s*\}\s*\)/g,
        "return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })"
      );
    }

    if (newContent !== content) {
      fs.writeFileSync(file, newContent);
      migrated++;
      totalMigrated++;
      const relPath = file.replace(API_DIR, '');
      console.log(`  ✓ ${relPath}`);
    } else {
      skipped++;
      totalSkipped++;
    }
  }

  console.log(`  → ${module}: ${migrated} migrées, ${alreadyMigrated} déjà faites, ${skipped} skippées`);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`TOTAL: ${totalFiles} fichiers traités`);
console.log(`  ✓ Migrés: ${totalMigrated}`);
console.log(`  ⊙ Déjà migrés: ${totalAlreadyMigrated}`);
console.log(`  ⊘ Skippés (complexes): ${totalSkipped}`);
