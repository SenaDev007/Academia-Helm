# 🔍 Guide d'Audit Design System — Academia Hub

## 🎯 Objectif

Vérifier la conformité de l'UI avec le Design System officiel et garantir :
- Image institutionnelle
- Crédibilité direction & audits
- Cohérence visuelle totale
- Base solide long terme

---

## 🧪 Checklist d'Audit Complète

### 1️⃣ Audit Visuel

#### ❌ Emojis restants ?

**Vérification** :
```bash
grep -r "[\u{1F300}-\u{1F9FF}]" apps/web-app/src
```

**Action** : Remplacer tous les emojis par `<AppIcon>`

#### ❌ Icônes non centralisées ?

**Vérification** :
```bash
grep -r "from ['\"]lucide-react['\"]" apps/web-app/src
```

**Action** : Utiliser uniquement `<AppIcon>` depuis `@/components/ui/AppIcon`

#### ❌ Gold utilisé hors KPI ?

**Vérification** :
- Chercher `gold-` dans les composants
- Vérifier que l'usage est < 5% du total des couleurs
- Vérifier que c'est uniquement pour KPI majeurs, ORION, badges premium

**Action** : Limiter l'usage de gold aux cas autorisés

#### ❌ Rouge utilisé hors CTA / alertes ?

**Vérification** :
- Chercher `crimson-` dans les composants
- Vérifier que c'est uniquement pour CTA principaux et alertes critiques

**Action** : Limiter crimson aux CTA et alertes critiques uniquement

#### ❌ Trop de couleurs visibles en même temps ?

**Vérification** :
- Compter les couleurs différentes par composant
- Maximum 4 couleurs différentes par composant

**Action** : Simplifier la palette par composant

---

### 2️⃣ Audit Typographie

#### ❌ Tailles de texte incohérentes ?

**Vérification** :
```bash
grep -r "text-\[" apps/web-app/src
```

**Action** : Utiliser uniquement les classes officielles :
- `text-h1`, `text-h2`, `text-h3`, `text-h4`
- `text-body-large`, `text-body`, `text-body-small`
- `text-label`, `text-caption`

#### ❌ Titres sans hiérarchie claire ?

**Vérification** :
- Vérifier que les titres suivent une hiérarchie logique (H1 → H2 → H3)
- Pas de saut de niveau (H1 → H3)

**Action** : Respecter la hiérarchie H1 → H2 → H3 → H4

#### ❌ Labels plus visibles que le contenu ?

**Vérification** :
- Vérifier que les labels utilisent `text-secondary` ou `text-muted`
- Le contenu principal utilise `text-primary`

**Action** : Inverser si nécessaire

#### ❌ Mélange de polices ?

**Vérification** :
```bash
grep -r "font-montserrat\|font-poppins" apps/web-app/src
```

**Action** : Utiliser uniquement Inter dans l'app (sauf landing page)

---

### 3️⃣ Audit UX / Direction

#### ❌ Trop d'éléments "ludiques" ?

**Vérification** :
- Chercher : `emoji`, `fun`, `playful`, `game`, `cartoon`, `animation`, `bounce`, `spin`
- Vérifier l'absence d'animations décoratives

**Action** : Supprimer tous les éléments ludiques

#### ❌ Manque de respiration ?

**Vérification** :
- Vérifier l'usage d'espacements suffisants
- Au moins 0.5 espacement par élément

**Action** : Ajouter des espacements selon le système 8px

#### ❌ CTA trop agressifs ?

**Vérification** :
- Chercher : `blink`, `pulse`, `shake`, `bounce`, `animate-spin`
- Vérifier l'absence d'animations agressives

**Action** : Supprimer les animations agressives

#### ❌ ORION visuellement trop bavard ?

**Vérification** :
- Vérifier que ORION ne domine pas visuellement
- Maximum 10% des éléments visuels pour ORION

**Action** : Simplifier l'interface ORION

---

### 4️⃣ Audit Accessibilité

#### ❌ Contraste suffisant ?

**Vérification** :
- Éviter : `text-gray-400` sur `bg-gray-`
- Éviter : `text-slate-400` sur `bg-slate-`
- Utiliser des outils de vérification de contraste

**Action** : Améliorer les combinaisons de couleurs

#### ❌ Icônes avec labels ?

**Vérification** :
- Toutes les icônes doivent avoir `aria-label` ou `aria-hidden="true"`
- Au moins 80% des icônes avec labels

**Action** : Ajouter les labels manquants

#### ❌ États hover / focus visibles ?

**Vérification** :
- Tous les éléments interactifs doivent avoir des états hover/focus
- Au moins 50% avec états visibles

**Action** : Ajouter les états manquants

#### ❌ Lisibilité en conditions faibles ?

**Vérification** :
- Éviter trop de texte très petit (< 12px)
- Maximum 30% de texte très petit

**Action** : Augmenter les tailles de texte si nécessaire

---

## 🚀 Utilisation des Outils d'Audit

### Audit Automatique

```tsx
import { auditComponent, generateAuditReport } from '@/lib/design-tokens/audit';

// Auditer un composant
const code = `...`; // Code du composant
const audit = auditComponent(code, 'DashboardCard');

console.log(`Score: ${audit.score}%`);
console.log(audit.issues);

// Générer un rapport
const audits = [audit1, audit2, audit3];
const report = generateAuditReport(audits);
console.log(report);
```

### Audit Manuel

1. **Parcourir les composants** un par un
2. **Vérifier chaque point** de la checklist
3. **Documenter les problèmes** trouvés
4. **Corriger** selon les règles du Design System

---

## 📋 Template d'Audit

```markdown
# Audit Composant : [Nom du Composant]

## Score : [X]%

### ✅ Conformité
- [ ] Pas d'emojis
- [ ] Icônes centralisées
- [ ] Gold < 5%
- [ ] Crimson uniquement CTA/alertes
- [ ] Maximum 4 couleurs
- [ ] Tailles de texte cohérentes
- [ ] Hiérarchie titres claire
- [ ] Labels moins visibles que contenu
- [ ] Police Inter uniquement
- [ ] Pas d'éléments ludiques
- [ ] Espacements suffisants
- [ ] CTA non agressifs
- [ ] ORION discret
- [ ] Contraste suffisant
- [ ] Icônes avec labels
- [ ] États hover/focus
- [ ] Lisibilité suffisante

### ❌ Problèmes Identifiés
1. [Description du problème]
2. [Description du problème]

### 🔧 Actions Correctives
1. [Action à prendre]
2. [Action à prendre]
```

---

## 🎯 Objectifs d'Audit

### Score Minimum Acceptable

- **Erreurs critiques** : 0
- **Avertissements** : < 5 par composant
- **Score global** : > 80%

### Priorités

1. **P0 - Critique** : Erreurs bloquantes (emojis, icônes non centralisées, contraste)
2. **P1 - Important** : Avertissements majeurs (gold, crimson, typographie)
3. **P2 - Amélioration** : Optimisations UX (respiration, ORION)

---

## 📚 Références

- **Design System** : `DESIGN-SYSTEM.md`
- **Design Tokens** : `docs/DESIGN-TOKENS.md`
- **Icon System** : `docs/ICON-SYSTEM.md`

---

**Version** : 1.0  
**Dernière mise à jour** : 2025  
**Statut** : ✅ **ACTIF**

