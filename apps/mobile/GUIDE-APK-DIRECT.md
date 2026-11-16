# Guide — Distribution APK directe (sans Play Store)

> **Objectif** : permettre l'installation de l'app mobile Android **directement
> depuis notre plateforme** (page `/downloads` + bouton sidebar « Téléchargements »),
> via le même canal d'hébergement que le desktop :
> `https://releases.academiahelm.com` (alias Vercel du web-app, dossier
> `apps/web-app/public/`).

## 1. Architecture

```
┌─────────────────────────────┐        ┌──────────────────────────────────┐
│ Page /downloads + sidebar   │  GET   │ API NestJS /api/releases         │
│ (web-app, bouton actif)     │───────>│ (table app_releases dans Neon)   │
└──────────────┬──────────────┘        └──────────────────────────────────┘
               │ 302/GET fichier binaire
               v
┌─────────────────────────────────────────────────────────────────────────┐
│ https://releases.academiahelm.com/mobile/files/academia-helm-X.Y.Z.apk  │
│ (fichier committé dans apps/web-app/public/mobile/files/ → servi Vercel)│
└─────────────────────────────────────────────────────────────────────────┘
```

- **L'APK n'est PAS une application séparée** : la coquille Capacitor charge
  l'application web LIVE (`server.url = https://academiahelm.com/portal`).
  Toute correction web est instantanément visible dans l'app, sans nouvelle APK.
- **Signature = clé Play Store** (`academia-helm-release.keystore`, empreinte
  SHA-256 `2124E36E…` — identique à `assetlinks.json` en production) :
  - les **App Links** (liens mails/WhatsApp) s'auto-vérifient ;
  - quand l'app sera publiée sur Play, une mise à jour Play pourra s'installer
    **par-dessus** l'APK direct (même identité de signature).
- Play Store reste le canal « officiel » à terme ; en attendant la validation
  de la fiche, l'APK direct est le chemin principal affiché sur `/downloads`.

## 2. Construire l'APK signée

### Option A — Machine avec Android Studio (recommandé)

```bash
cd apps/mobile
npx cap sync android
# Placer (une seule fois, JAMAIS commités — gitignore déjà en place) :
#   android/keystore.properties            ← voir download/play-store/
#   android/app/academia-helm-release.keystore
cd android
./gradlew assembleRelease
# Sortie : android/app/build/outputs/apk/release/app-release.apk
```

### Option B — Machine sans Android Studio (Linux, JDK 21 + SDK cmdline-tools)

```bash
export JAVA_HOME=<jdk-21>            # JDK complet (javac requis)
export ANDROID_HOME=<android-sdk>    # platforms;android-35 + build-tools;35.0.0
export GRADLE_USER_HOME=<cache-gradle>
./gradlew assembleRelease --no-daemon
```

Vérifications avant publication (build-tools/35.0.0) :

```bash
apksigner verify --print-certs app-release.apk | grep SHA-256
#   doit afficher : 2124e36e3833ea52d4e4d6d932e51ef23589a10e9cb2f81a08ad2202ae1c8552
aapt dump badging app-release.apk | grep package:
#   package: name='com.yehiortech.academiahelm' versionCode='N' versionName='X.Y.Z'
```

## 3. Publier une nouvelle version

1. **Bump** : `apps/mobile/android/app/build.gradle` → `versionCode` + `versionName`.
2. **Construire** (§2) puis copier :
   ```bash
   cp android/app/build/outputs/apk/release/app-release.apk \
      ../web-app/public/mobile/files/academia-helm-X.Y.Z.apk
   ```
3. **Manifest** : mettre à jour `apps/web-app/public/mobile/latest.json`
   (version, url, sha256, size, versionCode, publishedAt).
   ```bash
   sha256sum apps/web-app/public/mobile/files/academia-helm-X.Y.Z.apk
   ```
4. **Métadonnées dynamiques** — upsert dans Neon (table `app_releases`) pour que
   la page `/downloads` affiche la nouvelle version :
   ```sql
   INSERT INTO app_releases (version, platform, arch, filename, file_size,
     download_url, checksum_sha256, release_channel, is_latest, release_notes, min_os_version)
   VALUES ('X.Y.Z', 'android', 'universal', 'academia-helm-X.Y.Z.apk', <taille-octets>,
     'https://releases.academiahelm.com/mobile/files/academia-helm-X.Y.Z.apk',
     '<sha256>', 'stable', true, '<notes>', 'Android 8.0+')
   ON CONFLICT (platform, version, arch) DO UPDATE SET
     filename=EXCLUDED.filename, file_size=EXCLUDED.file_size,
     download_url=EXCLUDED.download_url, checksum_sha256=EXCLUDED.checksum_sha256,
     is_latest=EXCLUDED.is_latest, release_notes=EXCLUDED.release_notes,
     min_os_version=EXCLUDED.min_os_version, uploaded_at=now(), updated_at=now();
   ```
   (Le trigger `trg_app_releases_set_latest` démarre automatiquement l'ancienne
   ligne de la plateforme.)
5. **Pousser** : `git add apps/web-app/public/mobile && git commit && git push`
   → Vercel déploie → l'APK est servise sur releases.academiahelm.com
   (cache `immutable` 1 an — le nom de fichier contient la version).
6. **Vérifier** :
   ```bash
   curl -I https://releases.academiahelm.com/mobile/files/academia-helm-X.Y.Z.apk
   curl -s https://api.academiahelm.com/api/releases?channel=stable | jq '.[] | select(.platform=="android")'
   ```
   puis ouvrir `https://app.academiahelm.com/downloads` (onglet Mobile).

> **Mise à jour d'une installation existante** : l'app charge le web LIVE —
> l'APK ne change QUE pour les plugins natifs. Les utilisateurs reinstallent
> simplement la nouvelle APK par-dessus (même clé → mise à jour sans
> désinstallation, données WebView conservées).

## 4. Règle d'or — le keystore

- `academia-helm-release.keystore` = **l'identité définitive de l'app**.
- Jamais commité (`.gitignore` android : `*.keystore`, `keystore.properties`).
- Perte = impossible de mettre à jour l'app (APK direct ET Play Store).
- Copie de secours tenue hors dépôt par le promoteur (voir
  `download/play-store/README-SIGNING.txt`).

## 5. Relation avec le Play Store (fiche en cours de validation)

| | APK direct | Play Store |
|---|---|---|
| Disponibilité | Immédiate (notre canal) | Après validation de la fiche |
| Mise à jour web | Instantanée (web LIVE) | Instantanée (web LIVE) |
| Mise à jour coquille | Re-téléchargement APK | Automatique (Play) |
| Notifications FCM | Oui (dès l'enregistrement Firebase du package `com.yehiortech.academiahelm`) | Oui |
| Signature | Même clé | Même clé |

Quand la fiche Play sera validée : remplacer sur `/downloads` le bloc
« Play Store — En cours de validation » par un lien réel vers
`https://play.google.com/store/apps/details?id=com.yehiortech.academiahelm`
(le balisage à réactiver est commenté dans
`apps/web-app/src/app/downloads/page.tsx`, section MobileDownloads).

## 6. Voir aussi

- `apps/desktop/GUIDE-UPDATER-DESKTOP.md` — canal desktop (manifests Tauri
  signés, `publish-desktop-release.mjs`).
- `apps/mobile/PLAY-STORE.md` — préparation de la fiche Play.
- `docs/desktop-builds/README.md` — installateurs desktop hébergés.
