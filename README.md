# Academia Helm — Application Mobile

Application mobile Flutter pour la plateforme Academia Helm.

## Architecture

- **Backend** : API NestJS sur Railway (https://api.academiahelm.com/api)
- **Base de données** : Neon PostgreSQL (partagée avec le web)
- **Frontend** : Flutter (Android + iOS)
- **Auth** : JWT (même que le web)
- **API sync** : /api/sync/pull + /api/sync/push (offline-first)

## Configuration

1. Installer Flutter 3.24.0
2. `flutter pub get`
3. `dart run build_runner build --delete-conflicting-outputs`
4. `flutter run` (debug) ou `flutter build apk --release` (production)

## Variables

- `API_BASE_URL` : https://api.academiahelm.com/api
- `google-services.json` : déjà dans android/app/ (Firebase project: academia-helm-35536)

## Liens

- **Repo principal** : https://github.com/SenaDev007/Academia-Helm
- **API** : https://api.academiahelm.com/api
- **Web app** : https://app.academiahelm.com
