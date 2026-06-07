# 🎨 Design Tokens System — Academia Hub

## 📋 Vue d'Ensemble

Système de design tokens pour abstraire Tailwind et garantir la cohérence du Design System.

**OBJECTIF** : Ne plus jamais écrire de classes arbitraires.

---

## 🎯 Règle d'Or

> **La couleur n'est jamais décorative.  
> Elle est hiérarchique, fonctionnelle et rare.**

---

## 🧭 Tokens de Couleurs

### Brand Colors

```tsx
import { colors } from '@/lib/design-tokens';

// Utilisation
<div className={bgColor('sidebar')}> // bg-navy-900
<div className={textColor('primary')}> // text-gray-900
```

| Token | Couleur | Usage | Pourcentage |
|-------|---------|-------|-------------|
| `brand.primary` | navy-900 | Autorité, structure | 60-70% |
| `brand.secondary` | white | Respiration, lisibilité | 20-25% |
| `brand.accent` | gold-500 | Premium (RARE) | < 5% |
| `brand.danger` | crimson-600 | CTA, alertes critiques | - |

### Text Colors

```tsx
import { textColor } from '@/lib/design-tokens';

<p className={textColor('primary')}>Texte principal</p>
<p className={textColor('secondary')}>Texte secondaire</p>
<p className={textColor('muted')}>Texte atténué</p>
```

### Background Colors

```tsx
import { bgColor } from '@/lib/design-tokens';

<div className={bgColor('app')}>Fond application</div>
<div className={bgColor('card')}>Fond carte</div>
<div className={bgColor('sidebar')}>Fond sidebar</div>
```

### Border Colors

```tsx
import { borderColor } from '@/lib/design-tokens';

<div className={`border ${borderColor('subtle')}`}>Bordure légère</div>
<div className={`border ${borderColor('strong')}`}>Bordure forte</div>
```

---

## 📐 Tokens Typographiques

### Headings

```tsx
import { typo } from '@/lib/design-tokens';

<h1 className={typo('h1')}>Titre H1</h1>
<h2 className={typo('h2')}>Titre H2</h2>
<h3 className={typo('h3')}>Titre H3</h3>
```

### Body Text

```tsx
<p className={typo('body-large')}>Texte large</p>
<p className={typo('body')}>Texte standard</p>
<p className={typo('body-small')}>Texte petit</p>
```

### Labels & Captions

```tsx
<label className={typo('label')}>Label</label>
<span className={typo('caption')}>Caption</span>
```

---

## 🧩 Tokens UI

### Radius

```tsx
import { radius } from '@/lib/design-tokens';

<button className={radius.button}>Bouton</button>
<div className={radius.card}>Carte</div>
<div className={radius.modal}>Modale</div>
```

### Shadow

```tsx
import { shadow } from '@/lib/design-tokens';

<div className={shadow.card}>Carte</div>
<div className={shadow.cardHover}>Carte hover</div>
```

---

## 🔗 Alignement Texte ↔ Icônes

### Règles

| Élément | Règle |
|---------|-------|
| Icône + texte | Icône toujours AVANT le texte |
| Taille icône | = taille du texte ou +2px |
| Couleur icône | `currentColor` (hérite du texte) |
| Icône seule | Jamais sans label accessible |

### Exemple

```tsx
import AppIcon from '@/components/ui/AppIcon';
import { typo, textColor } from '@/lib/design-tokens';

<div className="flex items-center space-x-2">
  <AppIcon 
    name="dashboard" 
    size="menu" 
    className={textColor('primary')}
    aria-hidden="true"
  />
  <span className={typo('body')}>Tableau de bord</span>
</div>
```

👉 **L'icône ne crie jamais plus fort que le texte.**

---

## 🚀 Utilisation Complète

### Exemple de Composant

```tsx
import { 
  bgColor, 
  textColor, 
  typo, 
  radius, 
  shadow 
} from '@/lib/design-tokens';
import AppIcon from '@/components/ui/AppIcon';

export function DashboardCard() {
  return (
    <div className={`
      ${bgColor('card')}
      ${radius.card}
      ${shadow.card}
      p-6
    `}>
      <div className="flex items-center space-x-2 mb-4">
        <AppIcon name="dashboard" size="dashboard" />
        <h3 className={typo('h3')}>Tableau de bord</h3>
      </div>
      <p className={textColor('secondary')}>
        Contenu de la carte
      </p>
    </div>
  );
}
```

---

## 🧪 Audit & Vérification

### Checklist d'Audit

```tsx
import { auditComponent, generateAuditReport } from '@/lib/design-tokens/audit';

const code = `...`; // Code du composant
const audit = auditComponent(code, 'DashboardCard');
console.log(audit.score); // Score de conformité
console.log(audit.issues); // Liste des problèmes
```

### Catégories d'Audit

1. **Audit Visuel**
   - Emojis restants ?
   - Icônes non centralisées ?
   - Gold utilisé hors KPI ?
   - Rouge utilisé hors CTA / alertes ?
   - Trop de couleurs visibles ?

2. **Audit Typographie**
   - Tailles de texte incohérentes ?
   - Titres sans hiérarchie claire ?
   - Labels plus visibles que le contenu ?
   - Mélange de polices ?

3. **Audit UX / Direction**
   - Trop d'éléments "ludiques" ?
   - Manque de respiration ?
   - CTA trop agressifs ?
   - ORION visuellement trop bavard ?

4. **Audit Accessibilité**
   - Contraste suffisant ?
   - Icônes avec labels ?
   - États hover / focus visibles ?
   - Lisibilité en conditions faibles ?

---

## ✅ Bonnes Pratiques

### ✅ À Faire

```tsx
// ✅ Utiliser les tokens
<div className={bgColor('card')}>
  <h2 className={typo('h2')}>Titre</h2>
</div>

// ✅ Icône avec texte
<div className="flex items-center space-x-2">
  <AppIcon name="dashboard" size="menu" />
  <span className={typo('body')}>Dashboard</span>
</div>
```

### ❌ À Éviter

```tsx
// ❌ Classes arbitraires
<div className="bg-[#0B1F3B]">
  <h2 className="text-[24px]">Titre</h2>
</div>

// ❌ Icône sans label
<AppIcon name="dashboard" />

// ❌ Gold sur gros aplat
<div className="bg-gold-500 p-20">...</div>
```

---

## 📚 Références

- **Design System** : `DESIGN-SYSTEM.md`
- **Icon System** : `docs/ICON-SYSTEM.md`
- **Tailwind Config** : `tailwind.config.js`

---

**Version** : 1.0  
**Dernière mise à jour** : 2025  
**Statut** : ✅ **OFFICIEL**

