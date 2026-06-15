# 🚀 Optimisation Automatique des Images - Academia Hub

## ✨ Détection Automatique

Le système d'optimisation des images a été configuré pour **détecter automatiquement toutes les nouvelles images** ajoutées au projet.

## 🔄 Fonctionnement Automatique

### 1. Avant chaque Build
Les images sont automatiquement optimisées avant chaque build grâce au hook `prebuild` :

```bash
npm run build
# → Exécute automatiquement: npm run optimize-images
```

### 2. Détection Intelligente
Le script `optimize-images.js` :
- ✅ **Scanne automatiquement** le dossier `public/images`
- ✅ **Détecte toutes les images** PNG, JPG, JPEG (majuscules et minuscules)
- ✅ **Évite la re-optimisation** des images déjà optimisées
- ✅ **Génère WebP et AVIF** pour chaque nouvelle image
- ✅ **Affiche un rapport détaillé** avec les réductions de taille

### 3. Surveillance en Temps Réel (Optionnel)
Pour optimiser automatiquement les images pendant le développement :

```bash
npm run watch-images
```

Le watcher surveille le dossier `public/images` et optimise automatiquement toute nouvelle image ajoutée ou modifiée.

## 📋 Utilisation

### Optimisation Manuelle
```bash
npm run optimize-images
```

### Optimisation Automatique (Watcher)
```bash
npm run watch-images
```

### Vérification
Le script affiche :
- ✅ Liste des images détectées
- ✅ Réduction de taille pour chaque format
- ✅ Statistiques globales

## 🎯 Images Supportées

Toutes les images avec ces extensions sont automatiquement détectées :
- `.png`, `.PNG`
- `.jpg`, `.JPG`
- `.jpeg`, `.JPEG`

## 🔍 Logique de Détection

Le script :
1. **Scanne** le dossier `public/images`
2. **Filtre** les fichiers avec extensions supportées
3. **Vérifie** si les versions optimisées existent déjà
4. **Compare** les dates de modification
5. **Optimise** uniquement les images nouvelles ou modifiées

## 📊 Exemple de Sortie

```
🚀 Début de l'optimisation automatique des images...

📸 2 image(s) détectée(s) à optimiser:

   - nouvelle-image.png
   - autre-logo.jpg

✓ nouvelle-image.png → nouvelle-image.webp
  Réduction: 85.15% (319.05KB → 47.38KB)
✓ nouvelle-image.png → nouvelle-image.avif
  Réduction: 88.20% (319.05KB → 37.66KB)
...

✅ Optimisation terminée: 4 succès, 0 erreurs

💡 Les images optimisées sont prêtes. Next.js les utilisera automatiquement.
💡 Pour optimiser de nouvelles images, exécutez simplement: npm run optimize-images
```

## 🛠️ Configuration

### Scripts Disponibles

| Script | Description |
|--------|-------------|
| `npm run optimize-images` | Optimise toutes les images détectées |
| `npm run watch-images` | Surveille et optimise automatiquement |
| `npm run build` | Optimise automatiquement avant le build |

### Fichiers Générés

Pour chaque image optimisée, le script génère :
- `{nom-image}.webp` - Format WebP (support ~95%)
- `{nom-image}.avif` - Format AVIF (meilleure compression, support ~85%)

Next.js choisira automatiquement le meilleur format selon le navigateur.

## ✅ Avantages

1. **Zéro Configuration** : Ajoutez simplement vos images dans `public/images`
2. **Automatique** : Optimisation avant chaque build
3. **Intelligent** : Évite la re-optimisation inutile
4. **Rapide** : Seules les nouvelles images sont traitées
5. **Transparent** : Rapport détaillé de chaque optimisation

## 🚨 Notes Importantes

- Les images originales sont **conservées** (pas de suppression)
- Les versions optimisées sont générées **à côté** des originaux
- Next.js utilise automatiquement le meilleur format disponible
- Le script est **idempotent** : peut être exécuté plusieurs fois sans problème

## 📝 Workflow Recommandé

1. **Ajouter une nouvelle image** dans `public/images`
2. **Exécuter** `npm run optimize-images` (ou laisser le prebuild le faire)
3. **Utiliser** l'image dans votre code avec `next/image`
4. **Next.js** choisira automatiquement WebP ou AVIF selon le navigateur

## 🔄 Maintenance

Aucune maintenance requise ! Le système fonctionne automatiquement :
- ✅ Détection automatique des nouvelles images
- ✅ Optimisation avant chaque build
- ✅ Pas de configuration supplémentaire nécessaire

