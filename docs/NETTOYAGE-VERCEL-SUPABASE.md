# Nettoyage Vercel et Supabase

Ce document résume les changements effectués pour retirer **Vercel** et **Supabase** du projet et préparer l’hébergement sur **OVH** (domaine **academia-hub.pro**).

---

## 1. Suppression de Vercel

- **Fichiers supprimés** : `vercel.json` (racine et `apps/web-app`), tous les `VERCEL-*.md` et `apps/web-app/VERCEL-*.md`.
- **Code** :
  - `apps/web-app/src/lib/utils/urls.ts` : plus de détection `VERCEL_URL` / `VERCEL_ENV` / `.vercel.app` ; uniquement `local` et `production`.
  - `apps/web-app/next.config.js` : commentaire "Vercel" remplacé par "Build standalone pour déploiement Node (OVH, VPS, etc.)".
- **Docs** : `apps/README-STRUCTURE.md` et `docs/POINTS-ATTENTION-CLAIRIFICATION.md` mis à jour (déploiement OVH au lieu de Vercel).
- **`.gitignore`** : l’entrée `.vercel` est conservée (sans effet si vous n’utilisez plus Vercel).

---

## 2. Suppression de Supabase

- **Authentification** : l’app utilisait Supabase pour la session dans le middleware et dans `lib/auth`. Tout a été basculé sur la **session API** (cookies `academia_session` et `academia_token`) fournie par l’API NestJS.
- **Fichiers supprimés** :
  - `apps/web-app/src/utils/supabase/middleware.ts`
  - `apps/web-app/src/utils/supabase/server.ts`
  - `apps/web-app/src/app/api/supabase-example/page.tsx`
  - Tous les `apps/web-app/SUPABASE-*.md`.
- **Code** :
  - `apps/web-app/src/middleware.ts` : lecture du cookie `academia_session` pour obtenir l’utilisateur (plus d’appel Supabase).
  - `apps/web-app/src/middleware-patronat.ts` : même logique basée sur le cookie de session.
  - `apps/web-app/src/lib/auth/index.ts` : réexporte uniquement `getServerSession` depuis `@/lib/auth/session` (cookies).
- **Dépendances** : `@supabase/ssr` et `@supabase/supabase-js` retirées de `apps/web-app/package.json`.
- **Variables d’environnement** : plus besoin de `NEXT_PUBLIC_SUPABASE_*` pour le frontend. La base de données est gérée uniquement par l’API (NestJS + Prisma) ; `DATABASE_URL` / `DIRECT_URL` se configurent dans `apps/api-server/.env` (ex. PostgreSQL OVH).

---

## 3. Hébergement OVH (academia-hub.pro)

- **Document créé** : `docs/HEBERGEMENT-OVH.md` (variables d’environnement, déploiement frontend, base PostgreSQL, DNS, checklist).
- **Exemple production** dans `apps/web-app/ENV-LOCAL-COMPLETE.txt` : `NEXT_PUBLIC_APP_URL=https://academia-hub.pro`, etc.
- **API** : à héberger sur un VPS ou une offre adaptée OVH ; la base PostgreSQL peut être une instance managée OVH ou une installation sur le VPS.

---

## 4. À faire de votre côté

1. **Frontend** : dans `apps/web-app`, exécuter `npm install` pour appliquer la suppression des paquets Supabase.
2. **En production** : configurer sur l’hébergeur (OVH) les variables listées dans `docs/HEBERGEMENT-OVH.md` (sans aucune variable Supabase ou Vercel).
3. **Base de données** : une fois la base PostgreSQL OVH créée, configurer `DATABASE_URL` et `DIRECT_URL` dans `apps/api-server/.env` et exécuter les migrations Prisma.

---

**Date** : après migration vers hébergement OVH (academia-hub.pro).
