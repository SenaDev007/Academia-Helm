# Academia Helm — Desktop App (Tauri 2)

Application desktop Windows/macOS/Linux construite avec **Tauri 2** + **Next.js**.

## Architecture

```
apps/desktop/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs                    # Point d'entrée (binaire)
│   │   └── lib.rs                     # Initialisation + auto-update + SQLite
│   ├── capabilities/
│   │   └── default.json               # Permissions (shell, http, updater, sql, store, notification)
│   ├── migrations/
│   │   └── 001_init_offline_cache.sql # Schéma SQLite local (cache + sync queue)
│   ├── Cargo.toml                     # Dépendances Rust (tauri 2 + plugins)
│   ├── build.rs                       # Script de build Tauri
│   └── tauri.conf.json                # Config Tauri (fenêtre + auto-updater)
└── README.md
```

## Fonctionnalités

### ✅ Auto-update automatique
- L'app vérifie les mises à jour au démarrage (endpoint `https://releases.academiahelm.com/desktop/...`)
- Si une mise à jour est disponible → notification native + badge dans le header web (promoteur uniquement)
- Installation en un clic (mode `passive` sur Windows)

### ✅ Base de données locale SQLite (offline-first)
- **SQLite** embarqué dans l'app (via `tauri-plugin-sql`)
- Cache local pour toutes les entités (élèves, classes, finances, bulletins, cahier journal)
- **File d'attente de synchronisation** (`pending_sync_queue`) pour les écritures offline
- Sync automatique avec **Neon PostgreSQL** (via API NestJS) quand la connexion est rétablie

### ✅ URL distante (pas de rebuild à chaque fois)
- L'app desktop charge `https://app.academiahelm.com/desktop` (URL distante)
- **AUCUN rebuild Tauri nécessaire** quand le web est mis à jour
- L'utilisateur voit toujours la dernière version du web
- Le binaire Tauri (.exe) ne change QUE pour les mises à jour natives (Rust, plugins, config)

## Flux de synchronisation SQLite ↔ Neon

```
┌─────────────────────────────────────────────────────────────┐
│              APP DESKTOP (Tauri + WebView2)                  │
│                                                              │
│   Frontend Next.js ←→ Tauri SQL Plugin ←→ SQLite local       │
│                          │                  │                │
│                          │  Cache tables    │  Sync Queue    │
│                          │  (read-only)     │  (write        │
│                          │                  │   pending)     │
│                          ▼                  ▼                │
│                    ┌──────────────────────────────┐          │
│                    │  offline-sync.ts (frontend)  │          │
│                    │  - readFromCache()           │          │
│                    │  - writeToCache()            │          │
│                    │  - enqueueSync()             │          │
│                    │  - syncPendingQueue()        │          │
│                    └──────────────┬───────────────┘          │
│                                   │ (quand online)           │
└───────────────────────────────────┼──────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────┐
│              API NestJS (api.academiahelm.com)                │
│                          │                                   │
│                          ▼                                   │
│                 Neon PostgreSQL                              │
│                 (source de vérité)                            │
└─────────────────────────────────────────────────────────────┘
```

### Stratégie
1. **ONLINE** : lectures/écritures → API NestJS → Neon. Les résultats sont mis en cache dans SQLite.
2. **OFFLINE** : lectures depuis SQLite. Écritures dans `pending_sync_queue`.
3. **RECONNEXION** : push de la queue vers l'API → confirmation → clear queue.

⚠️ **SQLite n'est JAMAIS la source de vérité** — c'est un cache. Neon PostgreSQL reste la source unique.

## Configuration auto-update

### 1. Générer la paire de clés Tauri
```bash
cd apps/desktop/src-tauri
cargo tauri signer generate -w ~/.tauri/academia-helm.key
```
→ Sauvegarder la clé privée dans GitHub Secrets : `TAURI_UPDATER_PRIVATE_KEY`
→ Sauvegarder le mot de passe : `TAURI_UPDATER_KEY_PASSWORD`
→ Copier la clé publique dans `tauri.conf.json` → `plugins.updater.pubkey`

### 2. Héberger les releases
Les releases sont publiées sur `https://releases.academiahelm.com/desktop/` :
```
releases.academiahelm.com/
├── desktop/
│   ├── windows-x86_64/
│   │   ├── academia-helm_1.0.0.msi.zip
│   │   ├── academia-helm_1.0.0.msi.zip.sig
│   │   └── latest.json
│   ├── darwin-aarch64/
│   │   ├── academia-helm_1.0.0.app.tar.gz
│   │   └── academia-helm_1.0.0.app.tar.gz.sig
│   └── ...
```

### 3. Badge web pour le promoteur
Le composant `DesktopUpdateBadge` (dans `apps/web-app/src/components/header/`) :
- Visible **uniquement** par le rôle `PROMOTER`
- Affiché dans le `PilotageTopBar`
- Bouton "Desktop" + badge "!" si mise à jour disponible
- Modal de téléchargement avec avantages de l'app desktop

## Prérequis pour le build

### Windows
1. **Microsoft Visual Studio C++ Build Tools**
2. **WebView2** (préinstallé sur Windows 11)
3. **Rust** : `winget install Rustlang.Rustup`

### macOS
```bash
xcode-select --install
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## Build

```bash
cd apps/desktop
cargo tauri build

# En production avec auto-update signé :
TAURI_PRIVATE_KEY=~/.tauri/academia-helm.key \
TAURI_KEY_PASSWORD=your_password \
cargo tauri build
```

→ Output : `src-tauri/target/release/bundle/` (.msi, .exe, .dmg)

## GitHub Actions CI

Le workflow `.github/workflows/build-desktop.yml` :
- Trigger : push de tag `v*`
- Build Windows (.msi + .exe) + macOS (.dmg)
- Génère `latest.json` pour l'auto-updater
- Crée une GitHub Release avec les artifacts

## Sécurité

- **CSP** strict dans `tauri.conf.json`
- **Permissions** limitées dans `capabilities/default.json`
- **Pas d'accès système** (fichiers, caméra, micro)
- **HTTPS only** pour toutes les connexions API
- **SQLite** stocké dans le répertoire app data de l'utilisateur (sandboxé)
