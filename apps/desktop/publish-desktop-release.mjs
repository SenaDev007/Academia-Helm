#!/usr/bin/env node
/**
 * publish-desktop-release.mjs — Publie une version signée de la coquille desktop
 * Academia Helm (Tauri v2) sur le canal de mises à jour releases.academiahelm.com.
 *
 * PRÉREQUIS (voir GUIDE-UPDATER-DESKTOP.md) :
 *   1. `npm run tauri build` (ou `npx tauri build`) exécuté AVEC les variables
 *      d'environnement de signature :
 *        TAURI_SIGNING_PRIVATE_KEY=<chemin ou contenu de academia-helm-updater.key>
 *        TAURI_SIGNING_PRIVATE_KEY_PASSWORD=<mot de passe de la clé>
 *      → produit dans src-tauri/target/release/bundle/ :
 *          nsis/Academia Helm_<version>_x64-setup.exe   + .exe.sig
 *          msi/Academia Helm_<version>_x64_en-US.msi    + .msi.sig
 *   2. Exécuter ce script depuis apps/desktop/ :
 *        node publish-desktop-release.mjs --notes "Correctifs dossier scolaire…"
 *
 * CE QUE FAIT LE SCRIPT (aucune dépendance, Node ≥ 18) :
 *   - lit la version dans src-tauri/tauri.conf.json ;
 *   - vérifie que la clé publique de l'updater n'est PLUS le placeholder ;
 *   - copie chaque installeur + sa signature .sig vers
 *     apps/web-app/public/desktop/{nsis,msi}/x86_64/files/ (nom sans espaces) ;
 *   - régénère apps/web-app/public/desktop/{nsis,msi}/x86_64/latest.json
 *     (manifest Tauri v2 : version, notes, pub_date, signature, URL) ;
 *   - affiche les commandes git de publication (push → déploiement Vercel →
 *     https://releases.academiahelm.com/desktop/... mis à jour).
 *
 * OPTIONS :
 *   --notes "…"       texte affiché dans la notification de mise à jour
 *   --base-url URL    défaut : https://releases.academiahelm.com
 *   --dry-run         affiche sans écrire
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = scriptDir;                                   // apps/desktop
const repoDir = path.resolve(appDir, '..', '..');
const tauriConfPath = path.join(appDir, 'src-tauri', 'tauri.conf.json');
const bundleRoot = path.join(appDir, 'src-tauri', 'target', 'release', 'bundle');
const publicDesktopRoot = path.join(repoDir, 'apps', 'web-app', 'public', 'desktop');

// ---------- arguments ----------
const args = process.argv.slice(2);
const notesIdx = args.indexOf('--notes');
const notes = notesIdx !== -1 ? args[notesIdx + 1] : null;
const baseUrlIdx = args.indexOf('--base-url');
const baseUrl = (baseUrlIdx !== -1 ? args[baseUrlIdx + 1] : 'https://releases.academiahelm.com').replace(/\/$/, '');
const dryRun = args.includes('--dry-run');

const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };
const log = (msg) => console.log(msg);

// ---------- version + pubkey ----------
const conf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
const version = conf.version;
const pubkey = conf.plugins?.updater?.pubkey || '';
if (!version) fail('Version introuvable dans tauri.conf.json');
if (!pubkey || pubkey.includes('PLACEHOLDER')) {
  fail('tauri.conf.json contient encore la pubkey PLACEHOLDER — la signature des artefacts ne serait pas vérifiable par les coquilles. Remplacer d\'abord la clé publique (voir GUIDE-UPDATER-DESKTOP.md).');
}
log(`▸ Version publiée : ${version} (pubkey : ${pubkey.slice(0, 24)}…)`);

// ---------- détection des artefacts ----------
const TARGETS = [
  { name: 'nsis', dir: 'nsis', pick: (f) => f.endsWith('-setup.exe') },
  { name: 'msi', dir: 'msi', pick: (f) => f.endsWith('.msi') },
];

const published = [];
for (const t of TARGETS) {
  const dir = path.join(bundleRoot, t.dir);
  if (!existsSync(dir)) { log(`▸ ${t.name} : pas de bundle (dossier ${dir} absent) — ignoré`); continue; }
  const candidates = readdirSync(dir).filter((f) => t.pick(f) && f.includes(version) && !f.endsWith('.sig'));
  if (candidates.length === 0) { log(`▸ ${t.name} : aucun installeur pour la version ${version} — ignoré`); continue; }
  if (candidates.length > 1) fail(`Plusieurs installeurs ${t.name} pour ${version} : ${candidates.join(', ')}`);
  const installer = candidates[0];
  const sigFile = path.join(dir, installer + '.sig');
  if (!existsSync(sigFile)) {
    fail(`${t.name} : ${installer} n'a pas de .sig associé.\n` +
      '  Le build n\'a probablement pas été lancé avec TAURI_SIGNING_PRIVATE_KEY / TAURI_SIGNING_PRIVATE_KEY_PASSWORD.\n' +
      '  Un artefact non signé serait refusé par toutes les coquilles (clé publique intégrée).');
  }
  const signature = readFileSync(sigFile, 'utf8').trim();

  // nom de fichier sans espaces (les espaces dans les URLs sources de bugs)
  const safeName = installer.replace(/\s+/g, '-');
  const destDir = path.join(publicDesktopRoot, t.name, 'x86_64', 'files');
  const destFile = path.join(destDir, safeName);
  const manifestPath = path.join(publicDesktopRoot, t.name, 'x86_64', 'latest.json');
  const url = `${baseUrl}/desktop/${t.name}/x86_64/files/${safeName}`;

  const manifest = {
    version,
    notes: notes || `Academia Helm Desktop ${version} — mise à jour de la coquille Windows (le contenu applicatif reste servi en direct par le web).`,
    pub_date: new Date().toISOString(),
    platforms: {
      'windows-x86_64': { signature, url },
    },
  };

  if (dryRun) {
    log(`▸ [dry-run] ${t.name} : copierait ${installer} → ${path.relative(repoDir, destFile)} et régénèrerait ${path.relative(repoDir, manifestPath)}`);
    log(`  manifest : version=${version} url=${url}`);
  } else {
    mkdirSync(destDir, { recursive: true });
    copyFileSync(path.join(dir, installer), destFile);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    log(`▸ ${t.name} : ${safeName} copié et latest.json régénéré (signature ${signature.length} caractères)`);
  }
  published.push(t.name);
}

if (published.length === 0) fail('Aucun artefact signé trouvé — rien à publier.');

if (!dryRun) {
  log('');
  log('✔ Publication locale prête. Pour mettre en ligne :');
  log('    git add apps/web-app/public/desktop apps/desktop/src-tauri/tauri.conf.json');
  log('    git commit -m "release(desktop): v' + version + '"');
  log('    git push origin main');
  log('  → Vercel redéploie, puis vérifier :');
  published.forEach((t) => log(`    curl ${baseUrl}/desktop/${t}/x86_64/1.1.0   (manifest version ${version})`));
}
