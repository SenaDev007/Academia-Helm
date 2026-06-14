# Academia Helm Mobile — Application Flutter Enterprise

Application mobile multi-tenant pour la gestion scolaire Academia Helm.

## 🏗 Architecture

Architecture en 3 couches avec séparation stricte :

```
lib/
├── core/                    # Infrastructure transversale
│   ├── theme/               # Design System (AH palette, typography, spacing)
│   ├── network/             # Dio client, intercepteurs, API result
│   ├── auth/                # Authentification JWT + refresh
│   ├── tenant/              # Multi-tenant (sélection d'école)
│   ├── router/              # GoRouter + guards
│   ├── utils/               # Validateurs, formatters, constantes
│   └── widgets/             # Composants partagés (adaptive scaffold, etc.)
├── data/                    # Couche Data (implémentations concrètes)
│   ├── datasources/         # API (Retrofit) + Stockage local (Hive)
│   ├── dto/                 # Data Transfer Objects (Freezed)
│   └── repositories/        # Implémentations des repositories
├── domain/                  # Couche Domain (logique pure)
│   ├── entities/            # Modèles métier (Freezed)
│   └── repositories/        # Interfaces abstraites
├── features/                # Couche Features (UI par module)
│   ├── auth/                # Connexion, sélection d'école
│   ├── dashboard/           # Tableau de bord (par rôle)
│   ├── students/            # Module élèves
│   ├── parents/             # Module parents
│   ├── teachers/            # Module enseignants
│   ├── admin/               # Module administration
│   ├── profile/             # Profil utilisateur
│   ├── settings/            # Paramètres
│   └── notifications/       # Notifications
└── main.dart                # Point d'entrée (Riverpod + GoRouter)
```

## 📱 Plateformes supportées

| Plateforme | Support |
|-----------|---------|
| Android Phone | ✅ minSdk 24 (Android 7.0+) |
| Android Tablet | ✅ Toutes tailles |
| iPhone | ✅ iOS 12+ |
| iPad | ✅ Toutes tailles, tous les orientations |

## 🛠 Stack technique

| Composant | Technologie |
|-----------|-------------|
| State Management | Riverpod |
| Navigation | GoRouter |
| Réseau | Dio + Retrofit |
| Modèles | Freezed + Json Serializable |
| Stockage local | Hive + Flutter Secure Storage |
| Notifications | Firebase Cloud Messaging |
| Thème | Material 3 + Design System AH |

## 🎨 Design System

Palette Academia Helm :
- **Navy** : `#0B2F73` (primaire)
- **Gold** : `#F5B335` (accent)
- **Blue** : `#1D4FA5`
- Typographie : Inter

## 🚀 Démarrage

```bash
# Installer les dépendances
flutter pub get

# Générer le code (Freezed, Retrofit, etc.)
dart run build_runner build --delete-conflicting-outputs

# Lancer l'app en debug
flutter run

# Lancer sur une tablette Android
flutter run -d tablet

# Build APK
flutter build apk --release

# Build App Bundle (Play Store)
flutter build appbundle --release

# Build iOS
flutter build ios --release
```

## 🔐 Multi-Tenant

L'application gère le multi-tenant nativement :
1. Connexion avec email/password
2. Sélection de l'école (tenant) parmi les disponibles
3. Toutes les requêtes API incluent le `X-Tenant-Id`
4. Changement de tenant sans re-login

## 📂 Structure des APIs

L'application consomme exclusivement les APIs existantes :
- `POST /api/auth/login` — Connexion
- `POST /api/auth/refresh` — Refresh token
- `GET /api/auth/available-tenants` — Écoles disponibles
- `GET /api/auth/me` — Utilisateur courant
- `GET /api/students` — Liste des élèves
- `GET /api/tenants/by-subdomain/:slug` — Données tenant

## 🧪 Tests

```bash
flutter test
```
