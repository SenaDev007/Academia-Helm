# Academia Helm — Mobile App (Flutter)

Application mobile native iOS/Android construite avec **Flutter**.

## Architecture

```
apps/mobile/
├── lib/
│   ├── main.dart                          # Point d'entrée
│   ├── app/
│   │   └── router.dart                    # GoRouter (navigation)
│   ├── core/
│   │   ├── config/api_config.dart         # URL backend
│   │   ├── theme/app_theme.dart           # Thème Material 3
│   │   └── utils/storage_utils.dart       # SharedPreferences
│   ├── services/
│   │   ├── school_service.dart            # Recherche/sélection école
│   │   └── auth_service.dart              # JWT auth (parent/teacher/school)
│   └── features/
│       ├── school_search/
│       │   └── school_search_page.dart    # Portail public (recherche école)
│       ├── auth/
│       │   └── login_page.dart            # Connexion multi-portail
│       └── dashboard/
│           └── dashboard_page.dart        # Dashboard (parent/teacher/school)
├── pubspec.yaml                           # Dépendances
├── analysis_options.yaml                  # Lints
└── README.md
```

## Flux utilisateur

### Portail public (accès libre)
1. L'app démarre sur **SchoolSearchPage** (`/`)
2. L'utilisateur recherche son école (par nom, ville, pays)
3. Il sélectionne son école → sauvegardée dans SharedPreferences
4. Redirection vers **LoginPage** (`/login`)

### Connexion
5. L'utilisateur choisit son type de portail : **Parent** / **Enseignant** / **École**
6. Il saisit ses identifiants :
   - **Parent** : téléphone ou email (+ mot de passe optionnel)
   - **Enseignant** : matricule + mot de passe
   - **École** : email + mot de passe
7. Authentification via l'API NestJS (JWT)
8. Redirection vers **DashboardPage** (`/dashboard`)

### Dashboard
9. Le dashboard s'adapte au portalType :
   - **Parent** : enfants, paiements, bulletins, présences
   - **Enseignant** : classes, évaluations, cahier journal
   - **École** : pilotage, effectifs, finances

## Prérequis

### Flutter SDK
```bash
# Installer Flutter 3.19+
# https://docs.flutter.dev/get-started/install

flutter --version  # Flutter 3.19+, Dart 3.2+
```

### Android Studio / Xcode
- **Android** : Android Studio + SDK Android
- **iOS** : Xcode (macOS uniquement)

## Installation

```bash
cd apps/mobile

# Installer les dépendances
flutter pub get

# Lancer en mode debug (émulateur ou device)
flutter run

# Build APK (Android)
flutter build apk --release

# Build App Bundle (Android — pour Play Store)
flutter build appbundle --release

# Build iOS (macOS uniquement)
flutter build ios --release
```

## Configuration

### URL de l'API
Dans `lib/core/config/api_config.dart` :
```dart
static const String baseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://api.academiahelm.com/api',
);
```

Pour le dev local avec émulateur Android :
```dart
// 10.0.2.2 = localhost de la machine hôte dans l'émulateur Android
defaultValue: 'http://10.0.2.2:3001/api',
```

### Variables d'environnement (build)
```bash
flutter run --dart-define=API_BASE_URL=https://api.academiahelm.com/api
flutter build apk --dart-define=API_BASE_URL=https://api.academiahelm.com/api
```

### Firebase (push notifications)
1. Créer un projet Firebase
2. Ajouter `google-services.json` (Android) dans `android/app/`
3. Ajouter `GoogleService-Info.plist` (iOS) dans `ios/Runner/`
4. Configurer les clés serveur FCM dans le backend NestJS

## Fonctionnalités à implémenter (TODO)

### Parent
- [ ] Liste des enfants (`/api/parent/children`)
- [ ] Détail enfant (suivi journalier, scolarité, notes)
- [ ] Paiements FedaPay (webview intégrée)
- [ ] Bulletins PDF (syncfusion_flutter_pdfviewer)
- [ ] Cahier journal par semaine
- [ ] Notifications push

### Enseignant
- [ ] Liste des classes assignées
- [ ] Saisie des notes (Module Examen)
- [ ] Cahier journal (Espace Pédagogique)
- [ ] Registre d'appel
- [ ] Messages avec la direction

### École (Direction)
- [ ] Dashboard de pilotage (KPIs, graphiques)
- [ ] Gestion des élèves
- [ ] Gestion financière
- [ ] Communication
- [ ] RH

## État d'avancement

| Module | Statut |
|--------|--------|
| SchoolSearchPage | ✅ Implémenté |
| LoginPage (multi-portail) | ✅ Implémenté |
| DashboardPage (scaffold) | ✅ Implémenté |
| Parent — liste enfants | ⬜ TODO |
| Parent — paiements | ⬜ TODO |
| Parent — bulletins PDF | ⬜ TODO |
| Teacher — classes | ⬜ TODO |
| School — pilotage | ⬜ TODO |
| Push notifications | ⬜ TODO |

## Build et distribution

### Android (Play Store)
```bash
# Générer le keystore de signature
keytool -genkey -v -keystore ~/keystore/academia-helm.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias academia-helm

# Configurer android/key.properties
# Build App Bundle
flutter build appbundle --release
# → build/app/outputs/bundle/release/app-release.aab
```

### iOS (App Store)
```bash
# Nécessite macOS + Xcode
flutter build ios --release
# Ouvrir Xcode → Archive → Distribute
```

## CI/CD (GitHub Actions)

Le workflow `.github/workflows/build-mobile.yml` build l'APK Android
sur chaque push de tag `v*`.
