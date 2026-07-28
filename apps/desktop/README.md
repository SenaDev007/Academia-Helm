# Academia Helm — Desktop App (Tauri)

Application desktop Windows/macOS/Linux construite avec **Tauri 2** + **Next.js**.

## Architecture

```
apps/desktop/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs          # Point d'entrée (binaire)
│   │   └── lib.rs           # Logique Tauri (initialisation)
│   ├── capabilities/
│   │   └── default.json     # Permissions (shell, http)
│   ├── Cargo.toml           # Dépendances Rust
│   ├── build.rs             # Script de build Tauri
│   └── tauri.conf.json      # Configuration Tauri
└── README.md                # Ce fichier
```

Le frontend est le **même** que l'app web (`apps/web-app/`) — pas de recodage.
Tauri encapsule le Next.js dans une fenêtre native (WebView2 sur Windows).

## Flux utilisateur

1. **Premier lancement** : l'utilisateur voit la page `/desktop` qui affiche un sélecteur d'école
2. L'utilisateur recherche son école (par nom, ville, pays)
3. Il sélectionne son école → sauvegardée dans `localStorage`
4. Redirection automatique vers la page de connexion de l'école (`/app?tenant={slug}`)
5. L'utilisateur se connecte avec ses identifiants existants
6. **Lancements suivants** : redirection automatique vers la dernière école utilisée

### Prérequis
- L'école doit déjà avoir un compte sur la version web (academiahelm.com)
- L'utilisateur doit déjà avoir ses identifiants (créés par l'administration)

## Prérequis pour le build

### Windows
1. **Microsoft Visual Studio C++ Build Tools** : https://visualstudio.microsoft.com/visual-cpp-build-tools/
2. **WebView2** (préinstallé sur Windows 11, sinon) : https://developer.microsoft.com/microsoft-edge/webview2/
3. **Rust** : https://rustup.rs/
   ```powershell
   winget install Rustlang.Rustup
   ```

### macOS
```bash
xcode-select --install
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Linux
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## Installation

```bash
# À la racine du monorepo
cd apps/desktop
npm install  # ou: cargo install tauri-cli --version "^2.0.0"

# Mode développement (hot reload)
npm run tauri dev
# ou: cargo tauri dev

# Build production (.exe / .msi sur Windows)
npm run tauri build
# ou: cargo tauri build
```

## Build pour Windows depuis n'importe quel OS

### Option A — Build local sur Windows
1. Cloner le repo sur une machine Windows
2. Installer les prérequis (voir ci-dessus)
3. `cd apps/desktop && npm run tauri build`
4. L'exécutable est dans `src-tauri/target/release/bundle/`

### Option B — GitHub Actions CI (recommandé)
Le workflow `.github/workflows/build-desktop.yml` build automatiquement
l'app desktop sur push de tags `v*`.

### Option C — Cross-compilation depuis Linux
```bash
# Installer la cible Windows
rustup target add x86_64-pc-windows-gnu
# Build (limité — WebView2 nécessite Windows pour le runtime)
cargo build --target x86_64-pc-windows-gnu
```
⚠️ La cross-compilation Tauri vers Windows est limitée. Préférez GitHub Actions ou un build natif Windows.

## Configuration

### Variables d'environnement (frontend)

Le frontend Next.js doit être buildé en mode statique pour Tauri.
Ajouter dans `apps/web-app/next.config.ts` :

```ts
// Pour le build statique Tauri
output: 'export',  // Active quand NEXT_PUBLIC_TAURI=true
```

Ou utiliser le mode `devUrl` (recommandé) qui charge depuis localhost:3000
en développement et depuis les fichiers statiques en production.

### URL de l'API backend

Le frontend utilise les variables d'environnement existantes :
- `NEXT_PUBLIC_API_URL` ou `NEXT_PUBLIC_APP_URL` pour l'API NestJS
- En production desktop, l'API est sur `https://api.academiahelm.com`

## Personnalisation

### Icônes
Remplacer les fichiers dans `src-tauri/icons/` :
- `icon.ico` (Windows)
- `icon.icns` (macOS)
- `32x32.png`, `128x128.png`, `128x128@2x.png`

Générer depuis un PNG :
```bash
cd src-tauri
cargo tauri icon path/to/icon.png
```

### Titre de la fenêtre
Dans `tauri.conf.json` → `app.windows[0].title`

### Taille de la fenêtre
Dans `tauri.conf.json` → `app.windows[0].width` / `height` / `minWidth` / `minHeight`

## Distribution

### Windows
- `.msi` (Windows Installer) — installation silencieuse possible
- `.exe` (NSIS) — installateur avec UI
- Code signing recommandé (certificat EV ou OV)

### macOS
- `.dmg` (disk image)
- Code signing obligatoire (Apple Developer ID)
- Notarization requis pour distribution

### Linux
- `.deb` (Debian/Ubuntu)
- `.AppImage` (universel)
- `.rpm` (Fedora/RHEL)

## Sécurité

- **CSP** : configuré dans `tauri.conf.json` → `app.security.csp`
- **Permissions** : `capabilities/default.json` limite les accès natifs
- **Pas d'accès système** : l'app n'accède pas aux fichiers locaux, caméra, micro
- **HTTPS only** : toutes les connexions API sont en HTTPS

## Troubleshooting

### "WebView2 not found" sur Windows
Installer WebView2 Runtime : https://developer.microsoft.com/microsoft-edge/webview2/

### Écran blanc au lancement
- Vérifier que le frontend est buildé : `cd ../web-app && npm run build`
- Vérifier `tauri.conf.json` → `build.frontendDist` pointe vers `../out`

### Erreur de compilation Rust
```bash
rustup update
cargo clean
cargo build
```
