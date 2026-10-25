# Assets sauvegardés de l'ancien mobile (Flutter) — 2026-10-18

> Ces fichiers ont été extraits de `apps/mobile-app/` (Flutter, supprimé) avant suppression.
> L'historique Git conserve de toute façon l'intégralité du code supprimé.

## Contenu

| Fichier | Origine | Usage |
|---|---|---|
| `google-services.json` | `apps/mobile-app/android/app/` | Firebase **academia-helm-35536**, client Android `io.academiahelm.mobile` — modèle initial de la nouvelle app Capacitor. ⚠️ Depuis le renommage du 2026-10-25, l'app Capacitor utilise le package `com.yehiortech.academiahelm` : ce client doit être (re)créé dans la console Firebase et un NOUVEAU `google-services.json` téléchargé (voir `apps/mobile/PLAY-STORE.md` §4.3) — celui-ci n'est qu'une archive |
| `google-services-helmconnect.json` | `apps/mobile/helm_connect/android/app/` | Même projet Firebase — contient en plus les clients `com.academiahelm.helmconnect` et `io.academiahelm.mobile.debug` (Helm Connect, app de messagerie supprimée) |
| `icon-1024.png` | `apps/mobile-app/assets/icon.png` | Icône officielle Academia Helm 1024×1024 RGBA — source pour tous les mipmaps Android |
| `logo-1024.png` | `apps/mobile-app/assets/images/logo_academia_helm.png` | Logo 1024×1024 pour le splash screen |

## Palette officielle (extraite de l'ancien `colors.xml`)

- `ah_navy` : `#0B2F73` (fond splash / icône adaptive)
- `ah_navy_dark` : `#071D4A`
- `ah_blue` : `#1D4FA5`
- `ah_gold` : `#F5B335`
- `ah_gold_light` : `#FCD779`

## Projet Firebase

- Project ID : `academia-helm-35536`
- L'ajout d'un nouveau client Android (autre package name) se fait dans la console Firebase → Project settings → Android apps.
