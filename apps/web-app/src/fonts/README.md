# Polices Locales - Academia Hub

## 📁 Structure

Les polices Google Fonts sont téléchargées et stockées localement dans ce dossier pour :
- ✅ Éviter les problèmes de connexion Internet
- ✅ Améliorer les performances (pas de requête externe)
- ✅ Fonctionner même si Google Fonts est inaccessible
- ✅ Meilleur contrôle et optimisation par Next.js

## 🔤 Polices Disponibles

### Inter
- **Dossier**: `inter/`
- **Poids disponibles**: 100, 200, 300, 400, 500, 600, 700, 800, 900
- **Format**: TTF (TrueType Font)
- **Utilisation**: Police principale de l'application

## 📥 Téléchargement de Nouvelles Polices

Pour télécharger ou mettre à jour les polices :

```bash
cd apps/web-app
node scripts/download-fonts.js
```

Le script télécharge automatiquement toutes les polices configurées depuis Google Fonts et les stocke dans `src/fonts/`.

## 🔧 Configuration

Les polices sont configurées dans `src/app/layout.tsx` avec `next/font/local`.

Pour ajouter une nouvelle police :

1. Ajoutez-la dans `scripts/download-fonts.js` :
```javascript
const fonts = [
  {
    name: 'Inter',
    // ... configuration existante
  },
  {
    name: 'NouvellePolice',
    family: 'Nouvelle Police',
    weights: [400, 700],
    styles: ['normal'],
    subsets: ['latin'],
  },
];
```

2. Exécutez le script de téléchargement
3. Configurez-la dans `layout.tsx` avec `localFont()`

## 📝 Notes

- Les polices sont optimisées automatiquement par Next.js
- Le fallback système est toujours disponible en cas de problème
- Les fichiers de police sont versionnés dans Git (pas dans .gitignore)
