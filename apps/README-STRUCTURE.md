# 📁 Structure des Applications - Academia Hub

## 🎯 Clarification de l'Architecture

### `apps/web-app/` - **FRONTEND WEB (PRODUCTION) - PWA**

**Type** : Next.js App Router + PWA  
**Usage** : Application Web SaaS installable (Progressive Web App)  
**Public** : Oui (accessible via navigateur, installable)  
**Base de données** : API REST uniquement (PostgreSQL via backend) + IndexedDB pour offline

**Fichiers** : `apps/web-app/src/`

**Fonctionnalités PWA** :
- ✅ Service Worker pour cache offline
- ✅ Installation native (bouton d'installation)
- ✅ Mode standalone
- ✅ Page offline dédiée

**Déploiement** : Vercel (production)

**Documentation** :
- `apps/web-app/MIGRATION-DESKTOP-TO-PWA.md` : Checklist de migration
- `STRATEGIE-PWA-WEB-MOBILE.md` : Stratégie PWA

---

### `apps/mobile-app/` - **APPLICATION MOBILE NATIVE**

**Type** : Flutter (Android & iOS)  
**Usage** : Application mobile native pour parents et élèves  
**Public** : Oui (App Store & Play Store)  
**Base de données** : API REST + Cache local (Hive/SQLite)

**Fichiers** : `apps/mobile-app/lib/`

**Fonctionnalités** :
- Consultation des notes
- Suivi des paiements
- Messages de l'école
- Notifications push

**Déploiement** : App Store & Google Play Store

**Documentation** :
- `apps/mobile-app/README.md` : Vue d'ensemble
- `apps/mobile-app/docs/MOBILE-SPECIFICATION.md` : Spécification complète
- `apps/mobile-app/docs/USER-JOURNEYS.md` : Parcours utilisateur

---

### `apps/api-server/` - **BACKEND API**

**Type** : NestJS  
**Usage** : API REST pour toutes les applications (Web, Mobile)  
**Base de données** : PostgreSQL

**Déploiement** : Serveur dédié / Railway / Supabase

---

## 🔄 Workflow de Développement

### Pour le Frontend Web (Production - PWA)

1. **Modifier** : `apps/web-app/src/`
2. **Tester** : `cd apps/web-app && npm run dev`
3. **Build PWA** : `cd apps/web-app && npm run build` (génère Service Worker)
4. **Déployer** : Vercel (automatique via Git)

### Pour l'Application Mobile

1. **Modifier** : `apps/mobile-app/lib/`
2. **Tester** : `cd apps/mobile-app && flutter run`
3. **Build** : `flutter build apk` (Android) ou `flutter build ios` (iOS)
4. **Déployer** : App Store & Play Store

---

## 📱 Migration Desktop → PWA

L'application Desktop (Electron) a été remplacée par une Progressive Web App (PWA) installable.

**Avantages** :
- ✅ Pas d'installation système requise
- ✅ Mise à jour automatique
- ✅ Multi-plateforme (Windows, Mac, Linux)
- ✅ Déploiement simplifié

**Voir** : `apps/web-app/MIGRATION-DESKTOP-TO-PWA.md` pour la checklist complète.

---

**Dernière mise à jour** : 2025-01-XX

