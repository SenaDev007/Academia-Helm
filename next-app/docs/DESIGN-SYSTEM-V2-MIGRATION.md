# Design System V2 — Migration Complète

## 🎯 Objectif

Mise à jour complète du design system couleur pour aligner l'UI avec le logo officiel Academia Hub (Bouclier + monogramme AH bleu lumineux + point gold central).

## 📋 Nouvelle Palette Officielle

### 🟦 Royal Institutional Blue (60% de l'UI)
- `blue-900`: `#0A2A5E` — Base, autorité, structure principale
- `blue-800`: `#0D3B85` — Header, sidebar, fonds structurants
- `blue-700`: `#114FC4` — Hover, focus, highlights contrôlés
- `blue-600`: `#1C6FE8` — Éléments actifs, liens importants

### 🟡 Living Gold (≤5% de l'UI)
- `gold-600`: `#CFA63A` — Accent principal (ORION, badges premium)
- `gold-500`: `#F2C94C` — Badges premium, focus, points d'accent
- `gold-400`: `#FFE08A` — Hover très subtil (rare)

### ⚪ Neutres (25% de l'UI)
- `white`: `#FFFFFF` — Fond carte, modale
- `cloud`: `#F7F9FC` — Fond application
- `mist`: `#EEF2F8` — Fond secondaire, séparateurs

### ⚙️ Professional Graphite (10% de l'UI)
- `graphite-900`: `#0F172A` — Texte principal
- `graphite-700`: `#334155` — Texte secondaire
- `graphite-500`: `#64748B` — Labels, méta, texte atténué

### 🔴 Crimson (CTA uniquement)
- `crimson-600`: `#B91C1C` — CTA principal
- `crimson-500`: `#DC2626` — Hover CTA

## ✅ Changements Effectués

### 1. Configuration Tailwind (`tailwind.config.js`)
- ✅ Suppression de l'ancienne palette (navy, slate, anciens gold)
- ✅ Implémentation de la nouvelle palette V2
- ✅ Ajout des couleurs cloud et mist
- ✅ Mise à jour des alias gray pour compatibilité

### 2. Design Tokens (`src/lib/design-tokens/index.ts`)
- ✅ Mise à jour de tous les tokens de couleurs
- ✅ Remplacement navy → blue
- ✅ Remplacement slate → graphite
- ✅ Mise à jour des backgrounds (cloud, mist)
- ✅ Helper functions mises à jour

### 3. Composants Principaux Migrés

#### ✅ Header (`PremiumHeader.tsx`)
- `navy-900` → `blue-900`
- `slate-600` → `graphite-700`
- `gray-50` → `cloud`
- Focus rings mis à jour

#### ✅ Landing Page (`CompleteLandingPage.tsx`)
- `navy-900` → `blue-900` (tous les fonds)
- `navy-600/700/800` → `blue-700/800`
- `slate-300/400` → `graphite-500`
- `gray-50` → `cloud`
- Section ORION avec dominante blue-900 et accent gold-500

#### ✅ Footer (`InstitutionalFooter.tsx`)
- `navy-800` → `blue-800`
- `slate-400/500` → `graphite-500`
- Tous les textes secondaires mis à jour

#### ✅ Testimonials (`TestimonialsSection.tsx`)
- `slate-400` → `graphite-500`
- `navy-700` → `blue-700`

#### ✅ Login (`LoginPage.tsx`)
- `navy-900` → `blue-900`
- `navy-800` → `blue-800`
- `slate-600` → `graphite-700`
- Focus rings mis à jour

#### ✅ ORION (`OrionPanel.tsx`)
- `navy-900/800/700` → `blue-900/800/700`
- `slate-*` → `graphite-*`
- `soft-gold` → `gold-500`
- `gray-50/100` → `cloud/mist`
- Dominante blue-900 avec accents gold discrets

#### ✅ Admin Layout (`AdminLayout.tsx`)
- `navy-900/800/700` → `blue-900/800`
- `soft-gold` → `gold-500`
- `gray-50` → `cloud`
- `gray-300` → `graphite-500`

#### ✅ Global CSS (`globals.css`)
- ✅ Variables CSS mises à jour
- ✅ Body text mis à jour
- ✅ Utilities mises à jour

## 📊 Distribution des Couleurs (Règles Strictes)

- **60%** : Royal Institutional Blue
- **25%** : White / Cloud / Mist
- **10%** : Professional Graphite
- **≤5%** : Living Gold / Crimson

## 🔄 Règles de Migration

### Remplacements Systématiques

```typescript
// Ancien → Nouveau
navy-900 → blue-900
navy-800 → blue-800
navy-700 → blue-700
navy-600 → blue-700 (ou blue-600 selon contexte)

slate-600 → graphite-700
slate-500 → graphite-500
slate-400 → graphite-500
slate-300 → graphite-500

gray-50 → cloud
gray-100 → mist
gray-200 → gray-200 (conservé pour bordures)
gray-300 → graphite-500 (ou gray-300 pour bordures)

soft-gold → gold-500
gold-500 (ancien) → gold-500 (nouveau) ou gold-600 selon contexte
```

### ORION Spécifique
- Dominante : `blue-900`
- Accent : `gold-500` ou `gold-600` (discret)
- Aucun rouge

### CTA
- Principal : `crimson-600`
- Secondaires : outline `blue-700`
- Aucun autre usage du rouge

## 🚧 Fichiers Restants à Migrer

Les fichiers suivants contiennent encore des références à l'ancienne palette et doivent être mis à jour :

1. `DashboardPage.tsx`
2. `DashboardSidebar.tsx`
3. `DashboardHeader.tsx`
4. `DirectionKpiPage.tsx`
5. `ConsolidatedKpiPage.tsx`
6. `BillingHistoryPage.tsx`
7. `TenantSwitcher.tsx`
8. `OrionHistory.tsx`
9. `OrionSummary.tsx`
10. `OrionAlerts.tsx`
11. `AdminDashboard.tsx`
12. Autres composants dashboard/orion/admin

## 📝 Notes Importantes

- Design flat (pas de 3D)
- Pas de dégradés lourds
- Dégradé très subtil autorisé uniquement en hero
- Gold jamais utilisé comme fond plein
- Interface doit respirer, paraître premium et maîtrisée

## ✅ Statut

- [x] Tailwind config mis à jour
- [x] Design tokens mis à jour
- [x] Header migré
- [x] Landing page migrée
- [x] Footer migré
- [x] Testimonials migré
- [x] Login migré
- [x] ORION Panel migré
- [x] Admin Layout migré
- [x] Global CSS mis à jour
- [ ] Composants Dashboard à migrer
- [ ] Autres composants ORION à migrer

---

**Version** : 2.0  
**Date** : 2025  
**Statut** : ✅ **EN COURS** (Composants principaux migrés)
