# SEO automation — exécution quotidienne

## Prérequis

- Définir `ANTHROPIC_API_KEY` (obligatoire)
- Optionnel : `SERPER_API_KEY` (analyse SERP / concurrents)
- Optionnel : Upstash Redis (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) pour stocker leads + historique de positions

## Générer 3 articles / jour (auto-publish)

Depuis `apps/web-app` :

```bash
npm run seo:auto-publish
```

## CRON (Linux)

```cron
0 6 * * * cd /path/to/repo/apps/web-app && /usr/bin/env ANTHROPIC_API_KEY=... SERPER_API_KEY=... SEO_ARTICLES_PER_DAY=3 npm run seo:auto-publish >> /var/log/academia-seo.log 2>&1
```

## GitHub Actions (recommandé)

Créer un workflow planifié qui checkout le repo, installe les deps, exécute `npm run seo:auto-publish`, puis commit/push les fichiers `content/blog/*.mdx`.
