# 🎨 Charte Iconographique Officielle — Academia Hub v1.0

## 🎯 Positionnement

* **Institutionnel**
* **Premium**
* **Sobre**
* **Intemporel**
* **Autorité silencieuse**

👉 L'icône **accompagne l'information**, elle ne la remplace jamais.

---

## 🔧 Librairie Officielle

**Lucide Icons** (choix définitif)

**Pourquoi :**
* Stroke propre
* Neutralité parfaite
* Excellente lisibilité
* Adoption massive en SaaS premium (Stripe-like)

---

## 🎨 Style & Règles Strictes

| Élément            | Règle                             |
| ------------------ | --------------------------------- |
| Style              | Outline uniquement                |
| Stroke             | 1.5px (standard Lucide)           |
| Couleur            | héritée du texte (`currentColor`) |
| Dégradés           | ❌ Interdits                       |
| Emojis             | ❌ Interdits                       |
| Icônes décoratives | ❌ Interdites                      |
| Animations         | ❌ (sauf feedback UX rare)         |

---

## 📐 Tailles Officielles

| Usage           | Taille | Nom dans le code |
| --------------- | ------ | ---------------- |
| Menu principal  | 20px   | `menu`           |
| Sous-menu       | 16px   | `submenu`        |
| Dashboard / KPI | 24px   | `dashboard`      |
| Bouton action   | 16px   | `action`         |
| Alertes         | 18px   | `alert`          |

---

## 🧠 Règle d'Or

> **Une icône = une fonction.  
> Jamais une émotion.**

---

## 🧭 Mapping Icônes par Module

### Modules Principaux

| Module          | Icône Lucide      | Nom dans le code |
| --------------- | ----------------- | ---------------- |
| Tableau de bord | `LayoutDashboard` | `dashboard`      |
| Scolarité       | `GraduationCap`   | `scolarite`      |
| Élèves          | `Users`           | `students`       |
| Classes         | `School`          | `classes`        |
| Examens         | `ClipboardCheck`  | `exams`          |
| Notes           | `FileBarChart`    | `grades`         |
| Finances        | `Wallet`          | `finance`        |
| Paiements       | `CreditCard`      | `payments`       |
| RH              | `Briefcase`       | `rh`             |
| Présences       | `CalendarCheck`   | `attendance`     |
| Cantine         | `Utensils`        | `canteen`        |
| Boutique        | `ShoppingBag`     | `shop`           |
| Communication   | `Megaphone`       | `communication` |
| Rapports        | `FileText`        | `reports`        |
| Paramètres      | `Settings`        | `settings`       |

---

### ORION & Direction

| Élément                  | Icône        | Nom dans le code |
| ------------------------ | ------------ | ---------------- |
| ORION (IA direction)     | `Compass`    | `orion`          |
| Analyse                  | `BarChart3`  | `analysis`       |
| Synthèse                 | `Layers`     | `synthesis`      |
| Tendances                | `TrendingUp` | `trends`         |
| Historique               | `Clock`      | `history`        |
| Décision (lecture seule) | `Eye`        | `view`           |

---

### Alertes & KPI

| Type            | Icône           | Nom dans le code |
| --------------- | --------------- | ---------------- |
| Information     | `Info`          | `info`           |
| Attention       | `AlertCircle`   | `warning`        |
| Alerte critique | `AlertTriangle` | `critical`       |
| Succès          | `CheckCircle`   | `success`        |
| Échec           | `XCircle`       | `error`          |

---

## 🚀 Utilisation

### Composant AppIcon

```tsx
import AppIcon from '@/components/ui/AppIcon';

// Utilisation basique (taille menu = 20px)
<AppIcon name="dashboard" />

// Taille personnalisée
<AppIcon name="finance" size="dashboard" /> // 24px
<AppIcon name="students" size="submenu" />  // 16px
<AppIcon name="warning" size="alert" />     // 18px

// Avec classes personnalisées
<AppIcon 
  name="school" 
  size="dashboard" 
  className="text-navy-900"
/>

// Avec accessibilité
<AppIcon 
  name="critical" 
  size="alert" 
  aria-label="Alerte critique"
/>
```

### Tailles Disponibles

| Nom       | Pixels | Usage                    |
| --------- | ------ | ------------------------ |
| `menu`    | 20px   | Menu principal (défaut)  |
| `submenu` | 16px   | Sous-menu                |
| `dashboard` | 24px | Dashboard / KPI          |
| `action`  | 16px   | Bouton action            |
| `alert`   | 18px   | Alertes                  |

---

## 📊 Alignement Icônes ↔ ORION & KPI

### Principe

> **ORION parle en données.  
> Les icônes renforcent la hiérarchie visuelle.**

---

### KPI Dashboard

| KPI               | Icône         | Rôle        |
| ----------------- | ------------- | ----------- |
| Recettes          | `Wallet`      | Financier   |
| Taux recouvrement | `TrendingUp`  | Performance |
| Absences          | `AlertCircle` | Attention   |
| Réussite examens  | `CheckCircle` | Succès      |
| Échecs            | `XCircle`     | Risque      |

---

### Alertes ORION

| Niveau   | Icône           | Couleur | Nom dans le code |
| -------- | --------------- | ------- | ---------------- |
| Info     | `Info`          | Neutral | `info`           |
| Warning  | `AlertCircle`   | Amber   | `warning`        |
| Critique | `AlertTriangle` | Red     | `critical`       |

---

### ORION Panel

* Icône fixe ORION : `Compass` (`orion`)
* Jamais animée
* Toujours visible
* Symbole d'orientation, pas d'action

---

## 🚨 Interdictions Strictes

### Ne Jamais

1. ❌ Importer directement depuis `lucide-react`
   ```tsx
   // ❌ MAUVAIS
   import { School } from 'lucide-react';
   <School />
   
   // ✅ BON
   import AppIcon from '@/components/ui/AppIcon';
   <AppIcon name="classes" />
   ```

2. ❌ Utiliser des emojis Unicode
   ```tsx
   // ❌ MAUVAIS
   <span>📊 Dashboard</span>
   
   // ✅ BON
   <AppIcon name="dashboard" /> Dashboard
   ```

3. ❌ Créer des icônes personnalisées sans passer par le système
   ```tsx
   // ❌ MAUVAIS
   <CustomIcon />
   
   // ✅ BON
   // Ajouter l'icône dans IconMapping puis utiliser AppIcon
   ```

4. ❌ Utiliser des tailles arbitraires
   ```tsx
   // ❌ MAUVAIS
   <AppIcon name="dashboard" size={17} />
   
   // ✅ BON
   <AppIcon name="dashboard" size="menu" />
   ```

5. ❌ Modifier le stroke width (sauf cas exceptionnel)
   ```tsx
   // ❌ MAUVAIS (sauf cas exceptionnel)
   <AppIcon name="dashboard" strokeWidth={2} />
   
   // ✅ BON
   <AppIcon name="dashboard" /> // strokeWidth = 1.5px par défaut
   ```

---

## 🏗️ Architecture

### Fichiers

- **`src/lib/icons/index.ts`** : Mapping centralisé des icônes
- **`src/components/ui/AppIcon.tsx`** : Composant AppIcon
- **`src/lib/utils.ts`** : Fonction `cn()` pour merge des classes

### Structure

```
src/
├── lib/
│   ├── icons/
│   │   └── index.ts          # Mapping des icônes
│   └── utils.ts              # Utilitaires (cn)
└── components/
    └── ui/
        └── AppIcon.tsx       # Composant AppIcon
```

---

## ✅ Checklist d'Implémentation

- [x] Système d'icônes centralisé créé
- [x] Composant AppIcon implémenté
- [x] Tailles officielles définies
- [x] Stroke width 1.5px (standard Lucide)
- [x] Mapping modules officiel
- [x] Mapping ORION officiel
- [x] Mapping alertes officiel
- [x] Documentation complète

---

## 🏁 Conclusion

Avec cette charte :

* ❌ Plus aucun emoji
* ✅ Cohérence visuelle totale
* ✅ Image ERP / institutionnelle
* ✅ Crédibilité direction & audits
* ✅ Base solide long terme

👉 **Academia Hub adopte un langage visuel de décideurs.**

---

## 📚 Références

- **Lucide Icons** : https://lucide.dev/
- **Design System** : `DESIGN-SYSTEM.md`
- **Architecture** : `ARCHITECTURE.md`

---

**Version** : 1.0  
**Dernière mise à jour** : 2025  
**Statut** : ✅ **OFFICIEL**
