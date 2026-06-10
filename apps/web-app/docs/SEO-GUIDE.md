# 📖 Guide SEO pour Développeurs - Academia Hub

## 🎯 Objectif

Ce guide garantit que **tous les futurs composants, pages, modals, etc.** seront automatiquement optimisés pour le SEO.

## 📋 Règles d'Or

### 1. ✅ Toutes les pages DOIVENT avoir des métadonnées SEO

```tsx
// ✅ CORRECT
import { Metadata } from 'next';
import { generateSEOMetadata } from '@/lib/seo';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Ma Nouvelle Page',
  description: 'Description optimisée pour le SEO (120-160 caractères)',
  keywords: ['mot-clé 1', 'mot-clé 2', 'mot-clé 3'],
  path: '/ma-page',
});

// ❌ INCORRECT - Pas de métadonnées
export default function MaPage() {
  return <div>Contenu</div>;
}
```

### 2. ✅ Utiliser le Template de Page

Pour créer une nouvelle page, utilisez le template :

```tsx
import { PageTemplate, generatePageMetadata } from '@/templates/PageTemplate';

export const metadata = generatePageMetadata({
  title: 'Ma Nouvelle Page',
  description: 'Description optimisée',
  keywords: ['mot-clé 1', 'mot-clé 2'],
  path: '/ma-page',
});

export default function MaNouvellePage() {
  return (
    <PageTemplate
      title="Ma Nouvelle Page"
      description="Description optimisée"
      keywords={['mot-clé 1', 'mot-clé 2']}
      path="/ma-page"
    >
      {/* Contenu */}
    </PageTemplate>
  );
}
```

### 3. ✅ Toutes les images DOIVENT avoir un alt text descriptif

```tsx
// ✅ CORRECT
<Image
  src="/images/logo.png"
  alt="Academia Hub - Logo de la plateforme de gestion scolaire"
  width={120}
  height={120}
/>

// ❌ INCORRECT
<Image
  src="/images/logo.png"
  alt=""
  width={120}
  height={120}
/>
```

**Utiliser `SEOImage` helper :**
```tsx
import { SEOImage } from '@/lib/seo-helpers';

<SEOImage
  src="/images/logo.png"
  alt="Description descriptive obligatoire"
  width={120}
  height={120}
/>
```

### 4. ✅ Utiliser le Template de Modal

Pour créer un nouveau modal :

```tsx
import { ModalTemplate } from '@/templates/ModalTemplate';

export function MonModal({ isOpen, onClose }) {
  return (
    <ModalTemplate
      isOpen={isOpen}
      onClose={onClose}
      title="Titre du Modal"
      ariaLabel="Description accessible du modal"
    >
      {/* Contenu */}
    </ModalTemplate>
  );
}
```

### 5. ✅ Structure HTML Sémantique

```tsx
// ✅ CORRECT
<main>
  <section>
    <h1>Titre Principal</h1>
    <h2>Sous-titre</h2>
    <p>Contenu</p>
  </section>
</main>

// ❌ INCORRECT
<div>
  <div>
    <div>Titre</div>
  </div>
</div>
```

## 🔄 Détection Automatique

### Sitemap Automatique

Le sitemap détecte automatiquement toutes les nouvelles pages dans `app/(public)/` :

- ✅ Détection automatique des `page.tsx` et `page.ts`
- ✅ Priorités par défaut selon le chemin
- ✅ Pas besoin de modification manuelle du sitemap

### Validation en Développement

Les métadonnées sont validées automatiquement en développement :

```tsx
import { useSEOValidation } from '@/lib/seo-helpers';

// Dans votre composant
useSEOValidation({
  title: 'Ma Page',
  description: 'Description',
  keywords: ['mot-clé'],
});
```

## 📝 Checklist pour Nouvelle Page

- [ ] Page créée dans `app/(public)/`
- [ ] Métadonnées SEO exportées avec `generateSEOMetadata()`
- [ ] Title optimisé (50-60 caractères)
- [ ] Description optimisée (120-160 caractères)
- [ ] Keywords définis (minimum 3)
- [ ] Path défini pour canonical URL
- [ ] Images avec alt text descriptif
- [ ] Structure HTML sémantique (h1, h2, section, etc.)
- [ ] Testé avec Lighthouse SEO

## 📝 Checklist pour Nouveau Composant

- [ ] Images avec alt text descriptif
- [ ] Structure HTML sémantique
- [ ] Liens avec anchor text descriptif
- [ ] Accessibilité (ARIA labels si nécessaire)

## 📝 Checklist pour Nouveau Modal

- [ ] Utilise `ModalTemplate`
- [ ] Title et ariaLabel définis
- [ ] Accessibilité (focus trap, Escape key)
- [ ] Pas d'impact SEO négatif (pas de contenu dupliqué)

## 🚨 Erreurs Communes à Éviter

### ❌ Page sans métadonnées
```tsx
// ❌ INCORRECT
export default function MaPage() {
  return <div>Contenu</div>;
}
```

### ❌ Image sans alt text
```tsx
// ❌ INCORRECT
<Image src="/logo.png" alt="" />
```

### ❌ Title trop long
```tsx
// ❌ INCORRECT
title: 'Academia Hub - Une très très très longue description qui dépasse 60 caractères et qui n\'est pas optimale pour le SEO'
```

### ❌ Description trop courte
```tsx
// ❌ INCORRECT
description: 'Gestion scolaire'
```

## 🛠️ Outils Utiles

### Templates Disponibles

1. **PageTemplate** - `@/templates/PageTemplate`
   - Métadonnées SEO automatiques
   - Header et Footer inclus
   - Structure optimisée

2. **ModalTemplate** - `@/templates/ModalTemplate`
   - Accessibilité complète
   - Focus trap
   - Fermeture avec Escape

### Helpers Disponibles

1. **generateSEOMetadata()** - `@/lib/seo`
   - Génère toutes les métadonnées SEO
   - Open Graph et Twitter Cards inclus

2. **SEOImage** - `@/lib/seo-helpers`
   - Force l'utilisation d'alt text
   - Validation automatique

3. **validateSEOMetadata()** - `@/lib/seo-helpers`
   - Valide les métadonnées en développement

## 📊 Monitoring

### Vérification Automatique

- ✅ Sitemap mis à jour automatiquement
- ✅ Validation en développement
- ✅ Warnings console pour erreurs SEO

### Vérification Manuelle

1. **Lighthouse SEO Score**
   ```bash
   npm run lighthouse
   ```

2. **Google Rich Results Test**
   - https://search.google.com/test/rich-results

3. **Facebook Sharing Debugger**
   - https://developers.facebook.com/tools/debug/

## 🎓 Exemples Complets

### Exemple 1 : Nouvelle Page Simple

```tsx
// app/(public)/nouvelle-page/page.tsx
import { Metadata } from 'next';
import { generateSEOMetadata } from '@/lib/seo';
import PremiumHeader from '@/components/layout/PremiumHeader';
import InstitutionalFooter from '@/components/public/InstitutionalFooter';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Ma Nouvelle Page',
  description: 'Description optimisée pour le SEO avec 120-160 caractères pour une meilleure visibilité dans les résultats de recherche.',
  keywords: ['gestion scolaire', 'Academia Hub', 'nouvelle fonctionnalité'],
  path: '/nouvelle-page',
});

export default function NouvellePage() {
  return (
    <>
      <PremiumHeader />
      <main className="min-h-screen bg-white">
        <section className="py-16 px-4">
          <h1>Ma Nouvelle Page</h1>
          <p>Contenu de la page</p>
        </section>
      </main>
      <InstitutionalFooter />
    </>
  );
}
```

### Exemple 2 : Nouveau Modal

```tsx
// components/public/MonModal.tsx
'use client';

import { ModalTemplate } from '@/templates/ModalTemplate';

interface MonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MonModal({ isOpen, onClose }: MonModalProps) {
  return (
    <ModalTemplate
      isOpen={isOpen}
      onClose={onClose}
      title="Titre du Modal"
      ariaLabel="Description accessible du modal pour les lecteurs d'écran"
      size="md"
    >
      <p>Contenu du modal</p>
    </ModalTemplate>
  );
}
```

## ✅ Résumé

- ✅ **Templates** : Utilisez `PageTemplate` et `ModalTemplate`
- ✅ **Métadonnées** : Toujours exporter `metadata` avec `generateSEOMetadata()`
- ✅ **Images** : Toujours un alt text descriptif
- ✅ **Structure** : HTML sémantique (h1, h2, section, etc.)
- ✅ **Validation** : Automatique en développement
- ✅ **Sitemap** : Détection automatique des nouvelles pages

**Tous les futurs composants, pages et modals seront automatiquement optimisés pour le SEO !** 🚀

