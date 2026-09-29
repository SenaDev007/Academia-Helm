#!/usr/bin/env node
/**
 * Vérificateur syntaxique de référence — @swc/core (LE parseur de next build Turbopack)
 * ============================================================================
 * Créé Task 66 (après échec de build Vercel que Bun.Transpiler ET esbuild
 * laissaient passer) ; recréé Task 67 (le script original n'a pas survécu au
 * reset du sandbox).
 *
 * Usage : node check_syntax_swc.js <fichier.ts(x)> [autres fichiers...]
 * Exit 0 = syntaxe OK pour Turbopack ; exit 2 = au moins une erreur.
 */

const path = require('node:path');
const fs = require('node:fs');
const swc = require('/home/z/my-project/node_modules/@swc/core');

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('Usage : node check_syntax_swc.js <fichier.ts(x)> [...]');
    process.exit(2);
  }
  let failures = 0;
  for (const file of files) {
    const abs = path.resolve(file);
    if (!fs.existsSync(abs)) {
      console.error(`✗ ${file} : FICHIER INTROUVABLE`);
      failures++;
      continue;
    }
    const isTsx = /\.tsx?$/.test(abs);
    try {
      await swc.parseFile(abs, {
        syntax: 'typescript',
        tsx: isTsx,
        target: 'es2022',
        // module: esnext — le type exact attendu dépend de la version ; parseFile
        // se concentre sur la syntaxe, ce qui est exactement l'objectif ici.
      });
      console.log(`✓ ${file}`);
    } catch (e) {
      console.error(`✗ ${file}`);
      console.error(String(e));
      failures++;
    }
  }
  process.exit(failures > 0 ? 2 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
