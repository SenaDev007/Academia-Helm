# Guide d'Optimisation des Performances - Academia Hub

## 📊 Mesure des Performances avec Lighthouse

### Prérequis
- Node.js installé
- Lighthouse installé (déjà dans les devDependencies)

### Utilisation

1. **Démarrer le serveur de développement :**
   ```bash
   npm run dev
   ```

2. **Dans un autre terminal, exécuter Lighthouse :**
   ```bash
   npm run lighthouse
   ```
   
   Ou manuellement :
   ```bash
   npx lighthouse http://localhost:3001 --view --output=html --output-path=./lighthouse-report.html
   ```

3. **Analyser le rapport :**
   - Le rapport HTML s'ouvrira automatiquement dans votre navigateur
   - Vérifiez les scores pour :
     - **Performance** (objectif: > 90)
     - **Accessibility** (objectif: > 95)
     - **Best Practices** (objectif: > 90)
     - **SEO** (objectif: > 90)

### Options avancées

**Analyse en mode production :**
```bash
npm run build
npm run start
# Dans un autre terminal
npx lighthouse http://localhost:3000 --view
```

**Analyse avec options personnalisées :**
```bash
npx lighthouse http://localhost:3001 \
  --only-categories=performance \
  --output=html,json \
  --output-path=./lighthouse-report \
  --view
```

**Analyse mobile :**
```bash
npx lighthouse http://localhost:3001 \
  --preset=mobile \
  --view
```

## 🖼️ Optimisation des Images

### Détection automatique

Le script `scripts/optimize-images.js` **détecte automatiquement** toutes les images dans `public/images` et les optimise :

```bash
npm run optimize-images
```

**Fonctionnalités automatiques :**
- ✅ Détection de toutes les images PNG/JPG/JPEG
- ✅ Évite la re-optimisation des images déjà optimisées
- ✅ Génère automatiquement WebP et AVIF
- ✅ S'exécute automatiquement avant chaque build (`prebuild`)

### Surveillance en temps réel (optionnel)

Pour optimiser automatiquement les nouvelles images pendant le développement :

```bash
npm run watch-images
```

Le watcher surveille le dossier `public/images` et optimise automatiquement toute nouvelle image ajoutée.

### Images supportées

Toutes les images avec les extensions suivantes sont automatiquement détectées :
- `.png`, `.PNG`
- `.jpg`, `.JPG`
- `.jpeg`, `.JPEG`

### Formats générés

- **WebP** : Format moderne avec excellente compression (support: ~95% des navigateurs)
- **AVIF** : Format le plus récent avec meilleure compression (support: ~85% des navigateurs)

Next.js utilisera automatiquement le meilleur format supporté par le navigateur.

### Ajouter de nouvelles images à optimiser

Modifiez le tableau `imagesToOptimize` dans `scripts/optimize-images.js`.

## ✅ Optimisations déjà appliquées

### 1. Images
- ✅ Utilisation de `next/image` pour toutes les images
- ✅ Lazy loading pour les images non critiques
- ✅ Priority loading pour les images above-the-fold
- ✅ Sizes adaptatifs pour le responsive
- ✅ Formats modernes (WebP/AVIF) via next.config.js

### 2. Code Splitting
- ✅ Chargement dynamique des composants lourds :
  - `SupportChatWidget`
  - `VideoPlayerModal`
  - `OrionParticles`
  - `SecurityParticles`

### 3. Prefetching
- ✅ Prefetch activé sur tous les liens importants
- ✅ Navigation plus rapide grâce au préchargement

### 4. Configuration Next.js
- ✅ Compression activée
- ✅ SWC minification
- ✅ Optimisation CSS
- ✅ Formats d'images modernes configurés

## 📈 Métriques cibles

| Métrique | Cible | Excellent |
|----------|-------|-----------|
| Performance Score | > 80 | > 90 |
| First Contentful Paint (FCP) | < 1.8s | < 1.0s |
| Largest Contentful Paint (LCP) | < 2.5s | < 1.5s |
| Time to Interactive (TTI) | < 3.8s | < 2.5s |
| Total Blocking Time (TBT) | < 200ms | < 100ms |
| Cumulative Layout Shift (CLS) | < 0.1 | < 0.05 |

## 🔧 Améliorations futures

- [ ] Service Worker pour le cache
- [ ] Preload des ressources critiques
- [ ] Compression Brotli
- [ ] CDN pour les assets statiques
- [ ] Analyse continue avec CI/CD

## 📝 Notes

- Les images optimisées sont générées dans le même dossier que les originaux
- Next.js choisira automatiquement le meilleur format
- Les images originales sont conservées pour compatibilité

