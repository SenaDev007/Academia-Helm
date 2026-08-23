# Helm Connect — Mobile App (Flutter)

> **Helm Connect** — application mobile Android & iOS Academia Helm.
> Installable comme Telegram ou WhatsApp.

## 🎨 Identité visuelle

| Élément | Couleur | Usage |
|---------|---------|-------|
| Primary | `#1677FF` | Boutons, bulles envoyées, liens |
| Primary Dark | `#0958D9` | États actifs / hover |
| Primary Light | `#E6F4FF` | Bulles, arrière-plans légers |
| Accent Cyan | `#13C2C2` | Statuts, éléments interactifs |
| Background | `#F5F7FA` | Fond général |
| Surface | `#FFFFFF` | Conversations et panneaux |
| Text | `#172033` | Texte principal |
| Muted | `#667085` | Métadonnées |

### 🌙 Dark Mode

| Élément | Couleur |
|---------|---------|
| Background | `#0B1220` |
| Surface | `#111827` |
| Surface 2 | `#182235` |
| Text | `#F8FAFC` |
| Text 2 | `#94A3B8` |
| Primary | `#3B9EFF` |
| Accent | `#22D3EE` |

### 🔒 Règles fonctionnelles (ne changent jamais selon le thème)

- 🔴 Rouge `#DC2626` = danger/erreur
- 🟢 Vert `#16A34A` = succès/validation
- 🟠 Orange `#F59E0B` = avertissement
- 🔵 Bleu = information/action (couleur principale du thème)

## 📁 Structure du projet

```
apps/mobile/helm_connect/
├── lib/
│   ├── main.dart                          # Entry point + StartupGate
│   ├── theme/
│   │   └── helm_theme.dart                # HelmColors + HelmThemes (light/dark)
│   ├── models/
│   │   └── models.dart                    # User, Tenant, Conversation, Message, Announcement
│   ├── services/
│   │   └── api_service.dart               # HTTP client + Auth + Chat + Search
│   ├── screens/
│   │   ├── tenant_selection_screen.dart   # First-launch: pick school
│   │   ├── login_screen.dart              # Email + password login
│   │   ├── chat_screen.dart               # Main conversation list
│   │   ├── conversation_detail_screen.dart# WhatsApp-style chat view
│   │   ├── announcements_screen.dart      # Announcements list
│   │   ├── notification_prefs_screen.dart # DND + filters + quiet hours
│   │   └── global_search_screen.dart      # V2.4 global search
│   ├── widgets/                           # (V2: shared widgets)
│   ├── utils/                             # (V2: helpers)
│   └── ...
├── android/                               # AndroidManifest, build.gradle
├── ios/                                   # Info.plist, Runner.xcodeproj
├── assets/icons/                          # Logos, splash screens
└── pubspec.yaml                           # Dependencies
```

## 🚀 Démarrage

### Prérequis
- Flutter 3.13+ (Dart 3.0+)
- Android Studio / Xcode
- Un backend Academia Helm déployé (API + BFF)

### Installation
```bash
cd apps/mobile/helm_connect
flutter pub get
flutter pub run build_runner build  # génération Hive adapters
```

### Lancer en développement
```bash
flutter run -d chrome   # Web (debug)
flutter run -d android  # Android (debug)
flutter run -d ios      # iOS (debug)
```

### Build de release
```bash
# Android APK
flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk

# Android App Bundle (pour Play Store)
flutter build appbundle --release
# Output: build/app/outputs/bundle/release/app-release.aab

# iOS (sur macOS uniquement)
flutter build ipa --release
# Output: build/ios/ipa/helm_connect.ipa
```

## ⭐ Flux utilisateur

1. **Premier lancement** : l'utilisateur arrive sur l'écran de sélection d'école.
   - Il saisit le nom de son école (ex: "CSPEB-EVEIL D'AFRIQUE EDUCATION")
   - La liste des tenants correspondants s'affiche en temps réel
   - Il sélectionne son école → l'écran de connexion s'ouvre avec le tenant pré-sélectionné

2. **Connexion** : l'utilisateur saisit son email et mot de passe Academia Helm.
   - Le token JWT + userId + tenantId sont stockés dans SharedPreferences (persistant)
   - L'URL de base est mise à jour pour pointer vers le sous-domaine du tenant
   - L'utilisateur est redirigé vers la ChatScreen (route remplacée — pas de retour arrière)

3. **ChatScreen** : liste des conversations avec :
   - Badge non lus (bulle bleue #1677FF)
   - Prévisualisation du dernier message
   - Horodatage relatif
   - Icône mode silencieux si mute
   - Pull-to-refresh

4. **ConversationDetailScreen** : vue de chat style WhatsApp avec :
   - Bulles envoyées sur fond #E6F4FF (Azure light)
   - Bulles reçues sur fond #FFFFFF
   - Indicateur de lecture (✓✓ cyan)
   - Polling 10s (V2: Socket.io pour temps réel)
   - Support pièces jointes (V2)

5. **AnnouncementsScreen** : liste des annonces officielles avec badges priorité.

6. **NotificationPrefsScreen** : mode silencieux 1h/8h/24h/∞ + filtres par type.

7. **GlobalSearchScreen** : recherche transversale (messages, personnes, groupes, fichiers, annonces).

## 🔌 Configuration backend

L'API utilisée par défaut est :
- `https://academiahelm.com` — pour la recherche de tenants
- `https://<tenant-slug>.acadiahelm.com` — après sélection du tenant

Pour modifier l'URL en développement :
```dart
// Dans lib/services/api_service.dart, classe ApiConfig :
static const String _defaultBase = 'http://10.0.2.2:3001';  // Emulateur Android
```

## 📦 Dépendances principales

| Package | Usage |
|---------|-------|
| `http` | Appels API REST |
| `socket_io_client` | Temps réel (Socket.io) |
| `provider` | State management |
| `shared_preferences` | Stockage léger (token, tenant) |
| `flutter_secure_storage` | Stockage sécurisé (V2: refresh tokens) |
| `hive` + `hive_flutter` | Offline-first (messages mis en cache) |
| `image_picker` | Photos + vidéos |
| `file_picker` | Documents |
| `record` + `audioplayers` | Messages vocaux |
| `firebase_core` + `firebase_messaging` | Push notifications |
| `flutter_local_notifications` | Notifications locales |
| `encrypt` + `pointycastle` | Chiffrement E2E (V2) |

## 🎯 Roadmap

### ✅ V2.4 (livré ici)
- Écrans : tenant selection, login, chat list, conversation, announcements, notif prefs, global search
- Thème Azure + Cyan + Dark mode
- API service complet (auth, chat, announcements, search)

### ⏳ À venir
- **Temps réel** : Socket.io client (instant delivery + typing + presence)
- **Offline-first** : Hive pour messages, file d'attente, sync auto
- **Pièces jointes** : photos, vidéos, audio, documents
- **Messages vocaux** : enregistrement + vitesse de lecture + transcription IA (V3)
- **Appels audio/vidéo** : WebRTC
- **Push notifications** : Firebase Cloud Messaging
- **E2E** : RSA-OAEP + Web Crypto (comme la version web)
- **Thèmes personnalisables** : Azure/Emerald/Violet/Amber/Midnight + tenant theme

### 🧠 V3
- IA ORION (analyses institutionnelles)
- IA ATLAS (assistant conversationnel)
- Transcription vocale automatique
- Traduction automatique
- Recherche sémantique

## 🔐 Sécurité

- JWT stocké dans SharedPreferences (V2: migrer vers flutter_secure_storage)
- Communication HTTPS uniquement (pas de cleartext en production)
- Tenant ID vérifié côté backend (TenantGuard) — pas d'usurpation cross-tenant
- V2 : authentification biométrique (Face ID / Touch ID) optionnelle
- V3 : E2E chiffrement (Web Crypto + RSA-OAEP)

## 📜 Licence

Propriétaire — Academia Helm (© 2026)
