# Academia Helm — Application Desktop

Ce répertoire contient les exécutables desktop Academia Helm.

## Fichiers disponibles

### Windows (recommandé)

| Fichier | Format | Taille | Usage |
|---|---|---|---|
| [academia-helm_1.1.0_x64-setup.exe](./academia-helm_1.1.0_x64-setup.exe) | NSIS Installer | ~9 MB | Installation Windows 64-bit (double-clic pour installer) |

**Lien de téléchargement direct** : https://github.com/SenaDev007/Academia-Helm/raw/main/docs/desktop-builds/academia-helm_1.1.0_x64-setup.exe

### Linux

| Fichier | Format | Taille | Usage |
|---|---|---|---|
| [academia-helm_1.1.0_amd64.deb](./academia-helm_1.1.0_amd64.deb) | Debian package | ~10 MB | Ubuntu/Debian/Mint |
| [academia-helm-desktop-1.1.0-linux-x86_64.tar.gz](./academia-helm-desktop-1.1.0-linux-x86_64.tar.gz) | Tarball | ~10 MB | Binaire portable Linux |

## Installation Windows

1. Téléchargez `academia-helm_1.1.0_x64-setup.exe`
2. Double-cliquez sur le fichier pour lancer l'installation
3. Suivez l'assistant d'installation (NSIS)
4. L'application sera installée dans le menu Démarrer → Academia Helm
5. Lancez l'application depuis le raccourci bureau ou le menu Démarrer

**Configuration requise** :
- Windows 10/11 (64-bit)
- WebView2 Runtime (installé automatiquement sur Windows 11, téléchargé automatiquement sur Windows 10 si manquant)

## Installation Linux

### .deb (Ubuntu/Debian)
```bash
sudo dpkg -i academia-helm_1.1.0_amd64.deb
sudo apt-get install -f  # résoudre les dépendances
academia-helm-desktop
```

### Tarball portable
```bash
tar xzf academia-helm-desktop-1.1.0-linux-x86_64.tar.gz
sudo apt-get install -y libwebkit2gtk-4.1-0 libgtk-3-0 libayatana-appindicator3-1 librsvg2-2
./academia-helm-desktop
```

## Caractéristiques

- **Version** : 1.1.0
- **Architecture** : Tauri 2 (Rust + WebView2/WebKit2GTK)
- **Mode offline** : SQLite local + sync différée
- **Frontend** : Bundlé dans l'exécutable (custom-protocol)
- **Auto-update** : Configuré (updater plugin)

---

Build généré le 11 août 2026.
