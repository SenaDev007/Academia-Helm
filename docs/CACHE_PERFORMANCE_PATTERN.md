# Pattern de Cache & Performance — Academia Helm

## 🎯 Objectif

Standardiser la stratégie de cache et de timeout sur **toutes les pages, modals et onglets** du projet pour garantir :
- ⚡ Temps de chargement rapide (< 2s après 1ère visite)
- 🔄 Données fraîches (pas de cache empoisonné)
- 🛡️ Résilience (pas de spinner infini en cas de timeout backend)

## 📐 Pattern standardisé

### 1. BFF Route (Next.js App Router)

```typescript
// apps/web-app/src/app/api/<module>/<endpoint>/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl, bffHeaders } from '@/lib/utils/api-urls';

export const dynamic = 'force-dynamic'; // jamais de prerender statique

export async function GET(_request: NextRequest) {
  try {
    const apiUrl = `${getApiBaseUrlForRoutes()}/api/<backend-endpoint>`;

    // ⏱️ TIMEOUT 15s (compromis : ni trop court, ni trop long)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
      response = await fetch(normalizeApiUrl(apiUrl), {
        method: 'GET',
        headers: bffHeaders(),
        cache: 'no-store', // ⚠️ JAMAIS next: { revalidate } — voir "Cache empoisonné" ci-dessous
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        // ✅ Retourner une réponse gracieuse (liste vide) au lieu de 504
        return NextResponse.json(
          { data: [], error: 'timeout', message: 'Délai dépassé' },
          { status: 200, headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } }
        );
      }
      throw fetchError;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();

    // ✅ VALIDATION de la réponse avant de cacher
    const isValid = Array.isArray(data) ? data.length > 0 : !!data?.id;
    const cacheControl = isValid
      ? 'public, s-maxage=60, stale-while-revalidate=300' // 60s cache CDN + 5min stale
      : 'no-cache, no-store, must-revalidate';              // réponse incomplète = pas de cache

    return NextResponse.json(data, {
      headers: { 'Cache-Control': cacheControl },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed', message: error.message }, { status: 500 });
  }
}
```

### 2. Frontend Hook (React Query)

```typescript
// apps/web-app/src/lib/query/use-<entity>.ts

import { useQuery, keepPreviousData } from '@tanstack/react-query';

async function fetchEntity(): Promise<Entity[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // ⏱️ 15s

  try {
    const res = await fetch('/api/<entity>', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.error === 'timeout') return []; // gérer le timeout BFF
    return Array.isArray(data) ? data : (data?.data ?? []);
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') return []; // ✅ dégradation gracieuse
    throw err;
  }
}

export function useEntity() {
  return useQuery<Entity[]>({
    queryKey: ['entity'],
    queryFn: fetchEntity,
    staleTime: 5 * 60 * 1000,      // 5 min de cache React Query
    gcTime: 30 * 60 * 1000,        // 30 min de garbage collection
    retry: 1,                       // 1 retry max (pas de spam backend)
    placeholderData: keepPreviousData, // éviter le flash pendant le re-fetch
    refetchOnWindowFocus: false,   // pas de refetch au focus
    refetchOnReconnect: true,      // refetch quand réseau revient
  });
}
```

### 3. Page/Modal Component

```typescript
// apps/web-app/src/app/app/<module>/page.tsx

const { data, isLoading, error, refetch } = useEntity();

if (isLoading) return <Loader />;
if (error) return <ErrorState onRetry={refetch} />;
if (!data || data.length === 0) return <EmptyState onCreate={handleCreate} />;

return <Table data={data} />;
```

## ⚠️ Leçons apprises (bugs déjà rencontrés)

### 1. Cache Next.js Data Cache empoisonné (`next: { revalidate }`)

**Bug** : `next: { revalidate: 60 }` met en cache côté Vercel Data Cache. Si le backend répond avec une réponse **partielle** (timeout pendant transmission, cold start en cours), le cache sert cette version tronquée pendant 60s, et même après redéploiement le cache peut persister.

**Solution** : JAMAIS `next: { revalidate }`. Utiliser `cache: 'no-store'` + `Cache-Control` HTTP qui est géré par le CDN et peut être purgé.

### 2. Cache sans validation de réponse

**Bug** : Si on cache une réponse sans vérifier qu'elle est complète, on peut cacher une liste vide ou tronquée.

**Solution** : Toujours valider la réponse (`data.length > 0` pour les listes, `!!data?.id` pour les objets) avant de mettre `Cache-Control: public, s-maxage=...`. Sinon, `Cache-Control: no-cache, no-store, must-revalidate`.

### 3. Spinner infini en cas de timeout

**Bug** : Timeout backend à 30s → l'utilisateur attend 30s avant de voir une erreur.

**Solution** :
- Timeout BFF : 15s max
- Timeout client : 15s max (matche BFF)
- En cas de timeout : retourner une liste vide (200) au lieu de 504
- L'UI affiche "Aucune donnée" + bouton "Réessayer"

### 4. Fallback en cascade

**Bug** : Si `/list` échoue, on essaie `/search?q=aa` (10s de plus). Si `/search` échoue, on essaie un 3e endpoint. Total : 45s de spinner.

**Solution** : Un seul endpoint, pas de fallback en cascade. Si l'endpoint échoue, on affiche un bouton "Réessayer".

### 5. fetch() sans timeout

**Bug** : `fetch()` sans `AbortController` peut attendre indéfiniment.

**Solution** : Toujours wrapper avec `AbortController` + `setTimeout(15000)`.

## 📊 Endpoints à migrer vers ce pattern

### Priorité 1 ( critiques)

- [x] `/api/public/schools/list` — ✅ migré
- [x] `/api/public/schools/with-jobs` — ✅ migré (backend fix `type: 'mixte'`)
- [ ] `/api/context/bootstrap` — à migrer
- [ ] `/api/auth/me` — à migrer
- [ ] `/api/academic-years` — à migrer
- [ ] `/api/school-levels` — à migrer

### Priorité 2 (modules)

- [ ] `/api/students/*` — à migrer
- [ ] `/api/finance/*` — à migrer
- [ ] `/api/pedagogy/*` — à migrer
- [ ] `/api/exams/*` — à migrer
- [ ] `/api/hr/*` — à migrer

### Priorité 3 (admin)

- [ ] `/api/platform/*` — à migrer
- [ ] `/api/settings/*` — à migrer

## 🔧 Outils de diagnostic

### Vérifier le cache Vercel

```bash
# Vérifier les headers de cache d'un endpoint
curl -sI "https://academiahelm.com/api/<endpoint>" | grep -i cache

# Bypasser le cache pour tester le backend direct
curl -s "https://academiahelm.com/api/<endpoint>?_t=$(date +%s%N)" -H "Cache-Control: no-cache"
```

### Vérifier le backend direct

```bash
# Comparer backend direct vs BFF
curl -s "https://api.academiahelm.com/api/<endpoint>" | jq length
curl -s "https://academiahelm.com/api/<endpoint>" | jq length
# Les 2 doivent être identiques
```

### Logs Vercel

Dans le BFF route, ajouter :
```typescript
console.log(`[<Endpoint>] Response: ${data.length} items, ${JSON.stringify(data).length} bytes, cache=${isValid ? 'enabled' : 'no-cache'}`);
```

## 📈 Métriques cibles

| Endpoint | 1ère visite | Visites suivantes (1 min) | Après 1 min |
|----------|-------------|---------------------------|-------------|
| `/api/public/schools/list` | < 3s | < 100ms (CDN) | < 200ms (stale-while-revalidate) |
| `/api/context/bootstrap` | < 2s | < 100ms | < 200ms |
| `/api/students/*` | < 2s | < 100ms | < 200ms |

## 🚀 Migration progressive

Pour chaque endpoint, suivre cet ordre :

1. **Ajouter le timeout + cache BFF** (15s timeout, `cache: 'no-store'`, `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` si réponse valide)
2. **Migrer vers React Query** dans le frontend (hook `use<Entity>()` partagé)
3. **Supprimer les `useEffect` + `fetch` locaux** dans les composants
4. **Tester** : 1ère visite + 2e visite + visite après 1 min
5. **Valider** que les données ne sont jamais tronquées (comparer backend direct vs BFF)

---

## ⚠️ Piège : `school_levels` vs `education_levels`

### Règle d'or

**TOUJOURS utiliser `schoolLevelId` (UUID de `school_levels`) pour filtrer les données métier.**

### Pourquoi ?

Le projet a **2 tables** qui représentent les niveaux scolaires :

| Table | Rôle | UUID | Utilisé par |
|-------|------|------|-------------|
| `school_levels` | **Source de vérité business** | `id` | 132 modèles (Classes, Students, Subjects, Grades, etc.) |
| `education_levels` | Configuration "soft" | `id` | Header global, paramètres structure |

### Code correct

```typescript
// ❌ FAUX — utilise education_levels.id (les filtres ne matcheront jamais)
const schoolLevel = useModuleContext().schoolLevel;
classesService.getAll({ schoolLevelId: schoolLevel.id });

// ✅ CORRECT — utilise school_levels.id (UUID business)
const schoolLevel = useModuleContext().schoolLevel;
classesService.getAll({ schoolLevelId: schoolLevel.schoolLevelId });
```

### Hook `useSchoolLevelsQuery()`

Le hook retourne des objets avec **2 IDs** :
- `id` = `education_levels.id` (UUID de configuration)
- `schoolLevelId` = `school_levels.id` (UUID business)

**Toujours utiliser `schoolLevelId` pour les appels API.**
