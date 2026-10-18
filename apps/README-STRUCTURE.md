# 📁 Structure des Applications - Academia Helm

## 🎯 Clarification de l'Architecture

### `apps/web-app/` - **FRONTEND WEB (PRODUCTION) - PWA**

**Type** : Next.js 16 App Router + PWA
**Usage** : Application Web SaaS installable (Progressive Web App)
**Public** : Oui (accessible via navigateur, installable)
**Base de données** : API REST uniquement (PostgreSQL via backend) + IndexedDB pour offline

**Fichiers** : `apps/web-app/src/`

**Fonctionnalités PWA** :
- ✅ Service Worker pour cache offline
- ✅ Installation native (bouton d'installation)
- ✅ Mode standalone
- ✅ Page offline dédiée

**Déploiement** : Vercel (academiahelm.com + sous-domaines par école)

---

### `apps/mobile/` - **APPLICATION MOBILE ANDROID (CAPACITOR)**

**Type** : Coquille native Capacitor chargeant le web LIVE
**Usage** : Application Android Play Store — **même code que le web**
**Public** : Oui (Google Play Store)

**Principe « une seule base de code »** :
- Le WebView charge `https://academiahelm.com/portal` (app web Vercel)
- Toute correction web se propage instantanément au mobile, SANS nouvelle APK
- Seules les modifications natives (plugins, icônes, version) exigent une APK

**Portée V1** : tous les portails du flux `/portal` (École, Enseignant,
Parent/Élève, Public) — patronat exclu.

**Fichiers** : `apps/mobile/` (`capacitor.config.ts` = config centrale)

**Documentation** : `apps/mobile/README.md` (test Android Studio, Play Store, FCM)

---

### `apps/api-server/` - **BACKEND API**

**Type** : NestJS
**Usage** : API REST pour toutes les applications (Web, Mobile)
**Base de données** : PostgreSQL (Neon)
**Déploiement** : Railway (api.academiahelm.com)

---

### `apps/desktop/` - **APPLICATION DESKTOP (Tauri)**

Builds bureau Windows/Linux/macOS — voir `docs/desktop-builds/`.

---

### `apps/community-mobile/` - **ACADEMIA COMMUNITY (Flutter)**

App communautaire séparée (espace communautaire Academia Helm).

---

## 🔄 Workflow de Développement

### Frontend Web (et Mobile par extension)

1. **Modifier** : `apps/web-app/src/`
2. **Tester** : `cd apps/web-app && npm run dev`
3. **Déployer** : push GitHub → Vercel auto-déploie → web ET mobile à jour

### Application Mobile (coquille native uniquement)

1. **Modifier** : `apps/mobile/capacitor.config.ts` (rare)
2. **Synchroniser** : `cd apps/mobile && npm run sync`
3. **Tester** : Android Studio → ouvrir `apps/mobile/android` → Run ▶
4. **Publier** : AAB signé → Play Store

---

**Dernière mise à jour** : 2026-10-18 (migration Flutter → Capacitor)
