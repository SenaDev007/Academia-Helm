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
├── android/                                # ⭐ Complete Android scaffolding
│   ├── build.gradle                        # Project-level Gradle
│   ├── settings.gradle                     # Flutter SDK resolver
│   ├── gradle.properties                   # JVM args + AndroidX
│   ├── local.properties.example            # Template (rename to local.properties)
│   ├── gradle/wrapper/gradle-wrapper.properties  # Gradle 7.5
│   └── app/
│       ├── build.gradle                    # App config (compileSdk 34, minSdk 21)
│       └── src/main/
│           ├── AndroidManifest.xml         # Permissions + activity declarations
│           ├── kotlin/com/academiahelm/helmconnect/MainActivity.kt
│           └── res/
│               ├── values/styles.xml       # LaunchTheme + NormalTheme
│               ├── values-night/styles.xml  # Dark mode styles
│               ├── values/colors.xml        # Helm color palette
│               ├── drawable/launch_background.xml
│               ├── drawable-v21/launch_background.xml
│               ├── drawable/ic_launcher_background.xml  # Azure vector
│               ├── drawable/ic_launcher_foreground.xml  # Speech bubble + dots
│               ├── mipmap-anydpi-v26/ic_launcher.xml    # Adaptive icon
│               ├── mipmap-anydpi-v26/ic_launcher_round.xml
│               └── xml/network_security_config.xml      # HTTPS enforcement
├── ios/Runner/Info.plist                  # iOS permissions + URL scheme
├── assets/icons/                           # (Placeholder for app icons)
├── pubspec.yaml                           # Dependencies
├── analysis_options.yaml                  # Dart linting rules
└── README.md
```

## 🚀 Démarrage avec Android Studio

### Prérequis (à installer avant d'ouvrir le projet)

1. **Android Studio** (Hedgehog 2023.1.1 ou plus récent)
   - Téléchargement : https://developer.android.com/studio
   - Lors de l'installation, cochez : "Android SDK", "Android SDK Platform", "Android Virtual Device"

2. **Flutter SDK** (3.13.0 ou plus récent)
   - Téléchargement : https://docs.flutter.dev/get-started/install
   - Ajoutez `flutter` à votre PATH

3. **Vérifier l'installation** :
   ```bash
   flutter doctor
   ```
   Vous devriez voir ✓ pour Flutter, Android toolchain, Android Studio.

### Configuration initiale (5 minutes)

1. **Clonez le dépôt** :
   ```bash
   git clone https://github.com/SenaDev007/Academia-Helm.git
   cd Academia-Helm/apps/mobile/helm_connect
   ```

2. **Créez `local.properties`** :
   ```bash
   cp android/local.properties.example android/local.properties
   ```
   Éditez `android/local.properties` et remplacez le chemin `sdk.dir` par votre chemin Flutter SDK réel. Vous pouvez le trouver avec :
   ```bash
   which flutter   # /usr/local/bin/flutter  → le SDK est /usr/local/bin
   # ou
   flutter --version --machine | grep flutterRoot
   ```

3. **Téléchargez les dépendances** :
   ```bash
   flutter pub get
   ```

### Lancer en développement

#### Option A : Android Studio (recommandé)

1. **Ouvrez Android Studio** → `File` → `Open` → sélectionnez le dossier `apps/mobile/helm_connect/android`
2. Attendez que Gradle sync (peut prendre 5-10 min la première fois — téléchargement des dépendances)
3. **Sélectionnez un device** dans la toolbar (un émulateur ou un device physique)
4. **Cliquez sur ▶️ Run** (ou `Shift+F10`)

#### Option B : Ligne de commande

```bash
# Lister les devices disponibles
flutter devices

# Lancer en mode debug sur Chrome (test rapide UI)
flutter run -d chrome

# Lancer sur un émulateur Android
flutter run -d emulator-5554

# Lancer sur un device physique (USB debugging activé)
flutter run -d <device-id>
```

### Build de release

```bash
# Android APK (installable directement)
flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk

# Android App Bundle (pour Play Store)
flutter build appbundle --release
# Output: build/app/outputs/bundle/release/app-release.aab

# iOS (sur macOS uniquement, Xcode requis)
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

Pour modifier l'URL en développement (tester contre un backend local) :

```dart
// Dans lib/services/api_service.dart, classe ApiConfig :
static const String _defaultBase = 'http://10.0.2.2:3001';
// 10.0.2.2 = localhost de l'ordinateur hôte vu depuis l'émulateur Android
```

## 🔔 Firebase Cloud Messaging (push notifications) — CONFIGURÉ ✅

**Projet Firebase** : `academia-helm-35536`

**google-services.json** placé dans `android/app/google-services.json` — contient 3 packages Android :
- `com.academiahelm.helmconnect` ← Helm Connect (notre app)
- `io.academiahelm.mobile` ← Academia Helm mobile app
- `io.academiahelm.mobile.debug` ← debug variant

**Activation dans le projet** :
- `android/build.gradle` : `classpath 'com.google.gms:google-services:4.4.0'`
- `android/app/build.gradle` : `apply plugin: 'com.google.gms.google-services'` + `firebase-bom:32.3.1` + `firebase-messaging`
- `android/app/src/main/AndroidManifest.xml` : `<service android:name=".HelmConnectFirebaseMessagingService">` activé
- `pubspec.yaml` : `firebase_core`, `firebase_messaging`, `flutter_local_notifications` décommentés
- `HelmConnectFirebaseMessagingService.kt` : service Kotlin prêt (récupère les notifications en arrière-plan)

**Endpoints backend liés** (déjà disponibles dans l'API NestJS) :
- `POST /api/chat/push/subscribe` — enregistre le token FCM de l'utilisateur
- `POST /api/chat/push/unsubscribe` — supprime un token FCM
- `GET /api/chat/push/vapid-public-key` — clé VAPID (pour Web Push)
- `POST /api/chat/push/send` — envoi manuel de push (admin/testing)

**Étapes de test des push notifications** :
1. Build l'app : `flutter run -d android`
2. Au démarrage, l'app s'enregistre auprès de Firebase et obtient un token FCM
3. Le token FCM est imprimé dans les logs (Logcat) via `HelmConnectFirebaseMessagingService.onNewToken()`
4. Envoyer le token au backend : `POST /api/chat/push/subscribe { userId, subscription: { token: "FCM_TOKEN" } }`
5. Tester l'envoi : `POST /api/chat/push/send { userId, title: "Test", body: "Hello from Academia Helm!" }`
6. L'app doit recevoir la notification — visible dans la barre de notifications Android

## 🔐 Permissions Android

| Permission | Usage |
|-----------|-------|
| `INTERNET` | Appels API + WebSocket |
| `RECORD_AUDIO` | Messages vocaux |
| `CAMERA` | Photos + vidéos (V2) |
| `READ_MEDIA_IMAGES/VIDEO/AUDIO` | Pièces jointes (Android 13+) |
| `READ/WRITE_EXTERNAL_STORAGE` | Pièces jointes (Android ≤ 12) |
| `POST_NOTIFICATIONS` | Push notifications (Android 13+) |
| `VIBRATE` | Notifications vibration |
| `RECEIVE_BOOT_COMPLETED` | Relancer services au redémarrage |
| `FOREGROUND_SERVICE` | Appels audio/vidéo (V2) |
| `WAKE_LOCK` | Garder service en vie pendant un appel |

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
- Configuration Android complète (AndroidManifest, build.gradle, MainActivity, ressources, icônes adaptatives vectorielles)

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

## 🐛 Dépannage

### `Flutter SDK not found`
Vérifiez que `android/local.properties` contient :
```
sdk.dir=/chemin/vers/votre/flutter/sdk
```

### `Could not resolve all files for configuration ':classpath'`
Vérifiez votre connexion internet. Gradle télécharge les dépendances lors du premier sync.

### `Permission denied (microphone)`
Sur Android 6+, les permissions dangereuses doivent être demandées à runtime. Le package `permission_handler` sera ajouté en V2.

### `Cleartext HTTP traffic not permitted`
Le `network_security_config.xml` bloque par défaut le trafic non-HTTPS. Pour le développement local, utilisez `http://10.0.2.2:3001` qui est autorisé dans la config.

### Build fails with `minSdkVersion 21`
Assurez-vous d'utiliser Flutter 3.13+. Si vous devez supporter Android 4.x (rare), changez `minSdk 21` à `minSdk 19` dans `android/app/build.gradle`.

## 🔐 Sécurité

- JWT stocké dans SharedPreferences (V2: migrer vers flutter_secure_storage)
- Communication HTTPS uniquement (configuré via `network_security_config.xml`)
- Tenant ID vérifié côté backend (TenantGuard) — pas d'usurpation cross-tenant
- V2 : authentification biométrique (Face ID / Touch ID) optionnelle
- V3 : E2E chiffrement (Web Crypto + RSA-OAEP)

## 📜 Licence

Propriétaire — Academia Helm (© 2026)
