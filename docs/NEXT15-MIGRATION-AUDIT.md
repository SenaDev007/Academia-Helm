# Audit migration Next.js — Academia Helm (`apps/web-app`)

**Date de l’audit :** 2026-03-29  
**Mise à jour effectuée (2026-03-29) :** passage à **`next@16.2.1`**, **`react@19.2.4`**, **`@clerk/nextjs@7`**, **`eslint@9`** + **`eslint-config-next@16`**. Build prod : `next build --webpack` (compat **`next-pwa`** — Turbopack seul refuse un `webpack` custom sans config équivalente).

---

## Ancienne stack (référence audit initial)

**Stack avant bump :** `next@^14.2.0`, `react@^18.3.1`, `eslint-config-next@^14.2.0`, `tailwindcss@^3.4.7`

**Versions cibles actuelles :** **Next 16.2.x** + **React 19.2.x** (npm `latest` au moment du bump).

---

## Verdict faisabilité

| Critère | Évaluation |
|--------|------------|
| **Faisabilité globale** | **Oui** — pas de obstacle architectural majeur. |
| **Effort principal** | **Homogénéiser** les Route Handlers (`app/api/**/route.ts`) et **1** utilitaire serveur (`headers()`). |
| **Risque pages UI** | **Faible** : routes dynamiques type `[token]`, `[studentId]` sont en **`'use client'` + `useParams()`** (pas de props `params` async côté RSC sur ces fichiers). |
| **Risque API routes** | **Moyen** : beaucoup de fichiers encore au format **sync** `{ params: { id: string } }`. |

---

## État actuel du dépôt (constat factuel)

### 1. `cookies()` — déjà en mode async

La majorité des usages font **`await cookies()`** (`session.ts`, `proxy-auth.ts`, routes settings, etc.). **Peu ou pas de dette** sur ce point.

### 2. `headers()` — **1 point à corriger**

| Fichier | Problème |
|---------|----------|
| `src/lib/tenant/resolver.ts` | `headers()` appelé **sans `await`** (`const headersList = headers();`). En Next 15+, **`headers()` est async** : il faudra `await headers()` et rendre les fonctions appelantes `async` si ce n’est pas déjà le cas. |

**Impact :** tous les appelants de `extractSubdomain()` / résolution tenant basés sur ce module devront être revus (chaîne d’appels serveur).

### 3. Route Handlers — **double standard**

Le projet **anticipe déjà** Next 15 sur une partie des routes :

- **Déjà typées** avec `{ params }: { params: Promise<...> }` : exemples sous `app/api/settings/**`, `app/api/pedagogy/**/[...path]`, `app/api/sync/[...path]`, `app/api/auth/devices/[deviceId]`, `app/api/finance/expenses-v2/**`, etc.
- **Encore en sync** `{ params }: { params: { id: string } }` (ou équivalent) : **très nombreux** fichiers sous `app/api/**` (finances, élèves, communication, RH, réunions, etc.).

À la migration officielle vers **Next 15**, il faudra pour chaque handler :

- typer `params` comme **`Promise<{ ... }>`** si ce n’est pas déjà le cas ;
- faire **`const { id } = await params`** (ou équivalent) au début du handler.

**Estimation de volume :** de l’ordre de **~100+ fichiers `route.ts`** avec au moins une occurrence du pattern synchrone (recherche interne : nombreuses occurrences ; à traiter par lots ou script de codemod).

### 4. Pages `app/**/page.tsx` — **peu d’exposition**

- Les segments dynamiques repérés (`verify/[token]`, `students/[studentId]/dossier`) sont des **Client Components** avec **`useParams()`** → **pas** soumis au changement `params` / `searchParams` async des **Server Components**.
- Les `searchParams` / `useSearchParams` côté client restent côté **hooks** ; le travail Next 15 concerne surtout les **pages serveur** qui recevraient `searchParams` en props (peu de cas dans l’échantillon analysé).

### 5. Middleware

`src/middleware.ts` utilise l’API **Edge** `NextRequest` / `NextResponse` — généralement **stable** entre 14 et 15, mais à **retester** après montée de version (cookies, chemins, matcher).

### 6. Dépendances à valider après bump

| Paquet | Commentaire |
|--------|-------------|
| **Clerk** | Actuellement `@clerk/nextjs@5` (compatible Next 14). **Next 15+** permet d’envisager **Clerk 6/7** selon la doc officielle au moment du bump. |
| **next-pwa** | Vérifier la **compatibilité** avec la version cible de Next (souvent sensible). |
| **@sentry/nextjs** | S’aligner sur la version recommandée pour la version Next choisie. |
| **Tailwind / Shadcn** | Projet en **Tailwind 3** + tokens CSS ; pas bloquant pour Next 15. Une future **Tailwind 4** serait un chantier **séparé**. |

---

## Plan de migration recommandé (ordre)

1. **Branche dédiée** + `next@15` + `react@19` + `eslint-config-next@15` (versions exactes selon doc officielle au moment du merge).
2. Corriger **`resolver.ts`** (`await headers()`) puis compiler et corriger la chaîne d’imports.
3. **Passer en revue** tous les `route.ts` avec `params` synchrone → `Promise` + `await`.
4. **`next build`** + tests manuels (auth, multi-tenant, flux critiques).
5. Monter **Clerk / Sentry / PWA** en suivant les guides des versions compatibles.

---

## Conclusion

La migration **Next 15+ est faisable** sans tout reconstruire : le code est **déjà partiellement aligné** (nombreuses routes avec `params: Promise<...>`). Le travail restant est **surtout mécanique et traçable** (handlers + `headers()`), pas une refonte métier.

Pour une **dernière version** à date de cet audit, consulter **npm** / `nextjs.org` : la « dernière » peut être **15.x** ou **16.x** selon la politique de release au moment où vous migrez ; l’audit ci-dessus reste valide pour **toute montée 14 → 15+** avec les mêmes types de changements API.
