# Academia Helm — Application Mobile (Flutter)

> ⚠️ **Migration effectuée le 2026-08-07** : ce projet a été réintégré dans le monorepo principal `Academia-Helm` à l'emplacement `apps/mobile-app/`. L'ancien dépôt `Academia-Helm-mobile` est désormais archivé en lecture seule.

## Architecture

Application mobile Flutter (Android + iOS) pour la plateforme Academia Helm.

- **Backend** : API NestJS sur Railway (https://api.academiahelm.com/api)
- **Base de données** : Neon PostgreSQL (partagée avec le web et le desktop)
- **Frontend** : Flutter (Android + iOS)
- **Auth** : JWT (même que le web, mais avec 3 endpoints séparés :
  - `/api/auth/login` pour SCHOOL / PLATFORM
  - `/api/portal/auth/teacher` pour TEACHER
  - `/api/portal/auth/parent` pour PARENT)
- **API sync** : `/api/sync/pull` + `/api/sync/push` (offline-first)
- **Stockage local** : Hive (cache) + flutter_secure_storage (tokens)

## Configuration

1. Installer Flutter 3.24.0+ (`flutter --version`)
2. À la racine de `apps/mobile-app/`, exécuter :
   ```bash
   flutter pub get
   dart run build_runner build --delete-conflicting-outputs
   flutter run            # debug
   flutter build apk --release   # production
   ```

## Variables

- `API_BASE_URL` : https://api.academiahelm.com/api
- `google-services.json` : déjà dans `android/app/` (Firebase project: `academia-helm-35536`)

## CI/CD

- **Codemagic** : workflows définis dans `/codemagic.yaml` à la racine du monorepo
  (chemin `working_directory: apps/mobile-app`).
- **GitHub Actions** : `.github/workflows/build-mobile.yml` à la racine du monorepo.

Les deux CI buildent l'APK + l'AAB sur les tags `v*` (release) et créent une
GitHub Release automatiquement.

## Liens

- **Repo monorepo** : https://github.com/SenaDev007/Academia-Helm (dossier `apps/mobile-app/`)
- **Repo mobile archivé (lecture seule)** : https://github.com/SenaDev007/Academia-Helm-mobile
- **API** : https://api.academiahelm.com/api
- **Web app** : https://app.academiahelm.com

## Synchronisation web ↔ mobile

Le mobile partage la même API backend que le web et le desktop. Quand une
modification est faite sur le web (changement d'endpoint, ajout de module, etc.),
il suffit de mettre à jour :

- `lib/core/network/api_config.dart` (endpoints)
- `lib/data/dto/` (DTOs)
- `lib/features/<module>/` (écrans + providers + services)

Tout est dans le même repo désormais, ce qui facilite les commits atomiques.
