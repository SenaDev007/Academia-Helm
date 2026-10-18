# Academia Helm — Application Mobile (Capacitor)

> **UNE SEULE BASE DE CODE** : cette app native Android est une coquille Capacitor
> qui charge l'application web **LIVE** (production Vercel). Toute correction ou
> nouvelle fonctionnalité poussée sur le web se propage **instantanément** au
> mobile — sans republier sur le Play Store.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  APK Android (cette coquille)                               │
│  ├─ WebView Android ──► https://academiahelm.com/portal     │
│  │   (app web LIVE : mêmes portails, mêmes sessions,        │
│  │    Service Worker offline-first fonctionnel)             │
│  ├─ Plugins natifs : Push (FCM), Splash, StatusBar, App     │
│  └─ Icône + splash Academia Helm                            │
└─────────────────────────────────────────────────────────────┘
```

- **`appId`** : `io.academiahelm.mobile` (conforme au client Firebase existant)
- **Firebase** : projet `academia-helm-35536` (config `android/app/google-services.json`)
- **Portée V1** : tous les portails du flux `/portal` — École, Enseignant,
  Parent/Élève, Public. Le patronat n'est pas listé sur `/portal` (absent du
  mobile, par décision du 2026-10-18).
- Navigation WebView autorisée : `*.academiahelm.com` + passerelles paiement
  (`fedapay.com`, `feexpay.com`, `stripe.com`) — tout le reste s'ouvre dans le
  navigateur externe.

## 🚀 Tester dans Android Studio (machine locale)

### Prérequis
1. **Android Studio** (Ladybug ou plus récent recommandé)
2. SDK Android 35 (installé via SDK Manager — Android Studio le propose)
3. JDK 21 (inclus dans Android Studio — « Embedded JDK »)

### Étapes
```bash
cd apps/mobile
npm install            # une seule fois
```
1. Ouvrir Android Studio → **Open** → sélectionner `apps/mobile/android`
2. Laisser le **Gradle Sync** se terminer (télécharge Gradle + dépendances au
   premier lancement — connexion internet requise)
3. Choisir un émulateur (Device Manager → Create Device) ou un téléphone en
   **mode développeur + débogage USB**
4. **Run ▶** → l'APK debug s'installe et lance Academia Helm

### Sur un téléphone physique
- Activer *Options développeur* (7 taps sur « Numéro de build ») + *Débogage USB*
- Brancher en USB → le téléphone apparaît dans la liste des devices → Run ▶

## 🔄 Comment les mises à jour se propagent

| Changement côté web | Action mobile requise |
|---|---|
| Bug corrigé / fonctionnalité ajoutée (web) | **RIEN** — visible dès le déploiement Vercel |
| Nouveau plugin natif (caméra, biométrie…) | Nouvelle APK obligatoire |
| Icône / splash / version | Nouvelle APK |
| Config `capacitor.config.ts` | `npx cap sync android` + nouvelle APK |

## 📲 Déploiement Play Store (plus tard)

1. **Keystore de release** (à générer une fois, à conserver précieusement) :
   ```bash
   keytool -genkey -v -keystore academia-helm-release.keystore \
     -alias academiahelm -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Renseigner la signature dans `android/app/build.gradle`
   ( bloc `signingConfigs.release` )
3. **App Links** : publier `/.well-known/assetlinks.json` sur
   `academiahelm.com` ET `enseignant.academiahelm.com`
   (contient l'empreinte SHA-256 du keystore — cf. doc Android *Verify App Links*)
4. Build AAB : `cd android && ./gradlew bundleRelease`
5. Upload sur la Play Console + fiche store

## 🔔 Notifications push (FCM)

- ✅ Plugin `@capacitor/push-notifications` intégré + `google-services.json`
- ✅ Projet Firebase `academia-helm-35536` (même projet que le web)
- ⏳ **Étape suivante (pont web)** : dans `web-app`, détecter
  `window.Capacitor` → demander le token FCM → l'enregistrer via le module
  `notifications` de l'api-server (cible des envois). À implémenter quand
  l'app sera validée sur Android Studio.

## 🛠️ Commandes utiles

```bash
npm run sync           # cap sync android (après modif config/plugins)
npm run open:android   # ouvre Android Studio directement sur le projet
npx cap sync android   # équivalent manuel
```

## 📁 Contenu

```
apps/mobile/
├── capacitor.config.ts      ← config centrale (server.url, plugins, couleurs)
├── package.json             ← dépendances Capacitor
├── www/index.html           ← fallback hors-ligne (généralement invisible)
└── android/                 ← projet Android Studio (à ouvrir dans l'IDE)
    └── app/google-services.json   ← Firebase academia-helm-35536
```

> Les icônes/splash ont été générés par `scripts/gen_mobile_icons.py`
> (sources dans `docs/mobile-legacy/`). Relancer ce script après remplacement
> du logo source.
