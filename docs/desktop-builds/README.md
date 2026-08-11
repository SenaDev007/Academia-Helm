# Academia Helm — Application Desktop (Linux)

Ce répertoire contient les exécutables desktop Academia Helm pour Linux x86_64.

## Fichiers disponibles

| Fichier | Format | Taille | Usage |
|---|---|---|---|
| [academia-helm_1.1.0_amd64.deb](./academia-helm_1.1.0_amd64.deb) | Debian package | ~10 MB | Installation sur Ubuntu/Debian/Mint |
| [academia-helm-desktop-1.1.0-linux-x86_64.tar.gz](./academia-helm-desktop-1.1.0-linux-x86_64.tar.gz) | Tarball | ~10 MB | Binaire portable (sans installation) |

## Liens de téléchargement direct (GitHub)

- **.deb** : https://github.com/SenaDev007/Academia-Helm/raw/main/docs/desktop-builds/academia-helm_1.1.0_amd64.deb
- **.tar.gz** : https://github.com/SenaDev007/Academia-Helm/raw/main/docs/desktop-builds/academia-helm-desktop-1.1.0-linux-x86_64.tar.gz

## Installation

### Option 1 : Package .deb (recommandé pour Ubuntu/Debian)

```bash
# Télécharger puis installer
sudo dpkg -i academia-helm_1.1.0_amd64.deb
sudo apt-get install -f  # résoudre les dépendances manquantes si nécessaire

# Lancer
academia-helm-desktop
```

**Dépendances système** (installées automatiquement par dpkg) :
- `libwebkit2gtk-4.1-0` (moteur web)
- `libgtk-3-0` (interface graphique)
- `libayatana-appindicator3-1` (icône de notification)
- `librsvg2-2` (rendu SVG)

### Option 2 : Tarball portable (sans installation)

```bash
# Télécharger et extraire
tar xzf academia-helm-desktop-1.1.0-linux-x86_64.tar.gz

# Lancer directement
./academia-helm-desktop
```

**Note** : Le tarball nécessite que les dépendances système soient déjà installées :
```bash
sudo apt-get install -y libwebkit2gtk-4.1-0 libgtk-3-0 libayatana-appindicator3-1 librsvg2-2
```

## Caractéristiques

- **Version** : 1.1.0
- **Plateforme** : Linux x86_64 (64-bit)
- **Taille** : ~32 MB (binaire), ~10 MB (compressé)
- **Architecture** : Tauri 2 (Rust + WebKit2GTK)
- **Mode offline** : SQLite local + sync differée
- **Cible** : Ubuntu 20.04+, Debian 11+, Mint 20+

## Notes de version

- Splash screen corrigé (HTML/CSS)
- Synchronisation offline SQLite opérationnelle
- Intégration web-app (frontendDist chargé depuis le bundle)
- Mises à jour automatiques (updater plugin configuré)

---

Build généré le 11 août 2026.
