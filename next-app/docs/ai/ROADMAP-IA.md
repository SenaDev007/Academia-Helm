# 🧠 Roadmap IA Complète — Academia Hub

## 🎯 Vision Globale

> **Une seule plateforme.  
> Deux IA.  
> Des rôles strictement séparés.**

---

## 🟢 PHASE 1 — ORION (EN COURS / PRIORITAIRE)

**Statut** : ✅ **ACTIF** — Fondation posée

### Caractéristiques

- **Type** : IA de direction institutionnelle
- **Mode** : Lecture seule (100%)
- **Données** : KPI, bilans, alertes
- **Utilisateurs** : Décideurs uniquement (Directeur, Promoteur, Admin)
- **Ton** : Institutionnel, professionnel, sobre

### Objectif

👉 **Crédibilité, contrôle, gouvernance**

### Implémentation

- ✅ Services backend créés
- ✅ Routes API fonctionnelles
- ✅ Composants frontend intégrés
- ✅ Système de règles versionnées JSON
- ✅ Tables KPI IA dédiées
- ✅ Documentation complète

### Accès

- **Rôles autorisés** : `DIRECTOR`, `SUPER_DIRECTOR`, `ADMIN`
- **Endpoint** : `/api/orion/*`
- **UI** : Dashboard direction (intégré)

---

## 🟡 PHASE 2 — ATLAS (BASES POSÉES, DORMANTES)

**Statut** : ⏸️ **PRÉPARÉ** — Non exposé, non activé

### Caractéristiques

- **Type** : IA conversationnelle guidée
- **Mode** : Assistance opérationnelle
- **Données** : Documentation, métadonnées UI, FAQ
- **Utilisateurs** : Opérationnels (Secrétariat, Enseignants, Parents, Élèves)
- **Ton** : Pédagogique, clair, neutre

### Objectif

👉 **Réduire la friction utilisateur**

### Implémentation

- 📝 Prompt défini (`docs/ai/atlas_prompt.md`)
- 📝 Structure technique préparée (non activée)
- 📝 Règles de séparation documentées
- 📝 Cadre juridique prêt (CGU)

### Accès

- **Rôles autorisés** : `SECRETARY`, `TEACHER`, `PARENT`, `STUDENT`
- **Endpoint** : `/api/atlas/*` (dormant)
- **UI** : Non exposée (feature flag désactivé)

### Activation Future

L'activation d'ATLAS nécessitera :
1. Validation produit
2. Tests utilisateurs
3. Activation du feature flag
4. Déploiement progressif

---

## 🔵 PHASE 3 — IA HYBRIDE (LONG TERME)

**Statut** : 🔮 **VISION** — Non planifié

### Concept

- **ORION** = Analyse stratégique
- **ATLAS** = Interaction opérationnelle
- **Coordination indirecte** : ATLAS peut orienter vers ORION si besoin
- **Gouvernance stricte** : Aucun mélange des responsabilités

### Objectif

👉 **Maturité plateforme**

### Prérequis

- ORION stabilisé et validé
- ATLAS activé et validé
- Séparation technique garantie
- Gouvernance claire

---

## 📊 Tableau Comparatif

| Élément | ORION | ATLAS |
|---------|-------|-------|
| **Type** | IA de direction | IA conversationnelle |
| **Mode** | Lecture seule | Assistance guidée |
| **Données** | KPI, bilans, alertes | Documentation, UI |
| **Utilisateurs** | Décideurs | Opérationnels |
| **Ton** | Institutionnel | Pédagogique |
| **Décisions** | ❌ Jamais | ❌ Jamais |
| **Analyses** | ✅ Oui | ❌ Non |
| **Guidage** | ❌ Non | ✅ Oui |
| **Statut** | ✅ Actif | ⏸️ Dormant |

---

## 🔒 Règles de Séparation Strictes

### Règle n°1 — Séparation des Accès

| Élément | ORION | ATLAS |
|---------|-------|-------|
| KPI | ✅ | ❌ |
| Données financières | ✅ | ❌ |
| Données RH | ✅ | ❌ |
| Données pédagogiques | ✅ | ❌ |
| Documentation | ❌ | ✅ |
| Métadonnées UI | ❌ | ✅ |
| FAQ | ❌ | ✅ |

### Règle n°2 — Séparation des Utilisateurs

| Rôle | ORION | ATLAS |
|------|-------|-------|
| Directeur | ✅ | ❌ |
| Promoteur | ✅ | ❌ |
| Admin global | ✅ | ❌ |
| Secrétariat | ❌ | ✅ |
| Enseignant | ❌ | ✅ |
| Parent / Élève | ❌ | ✅ |

### Règle n°3 — Séparation des Responsabilités

**ORION** :
- Éclaire (analyse factuelle)
- Synthétise (résumés structurés)
- Alerte (points de vigilance)

**ATLAS** :
- Explique (fonctionnalités)
- Guide (navigation)
- Assiste (questions opérationnelles)

👉 **Aucune IA ne fait les deux.**

### Règle n°4 — Séparation Technique

- ✅ Services backend distincts
- ✅ Prompts distincts
- ✅ Logs distincts
- ✅ Endpoints distincts
- ✅ Feature flags séparés
- ✅ Validation stricte des accès

---

## 📝 Documentation Associée

- **ORION** : `ORION-IMPLEMENTATION.md`, `ORION-RULES.md`
- **ATLAS** : `docs/ai/atlas_prompt.md`, `docs/ai/atlas_architecture.md`
- **Séparation** : `docs/ai/SEPARATION-RULES.md`
- **Juridique** : `public/legal/CGU.md` (section ATLAS)

---

## 🚀 Prochaines Étapes

### Court Terme (ORION)

1. ✅ Implémentation complète ORION
2. ✅ Tests utilisateurs (directeurs)
3. ✅ Validation produit
4. ✅ Stabilisation

### Moyen Terme (ATLAS)

1. 📝 Finalisation prompt ATLAS
2. 📝 Implémentation structure technique (dormante)
3. 📝 Tests internes
4. 📝 Validation produit
5. ⏸️ Activation progressive (feature flag)

### Long Terme (Hybride)

1. 🔮 Étude de faisabilité
2. 🔮 Architecture coordination
3. 🔮 Gouvernance stricte
4. 🔮 Tests utilisateurs

---

**Version** : 1.0  
**Dernière mise à jour** : 2025  
**Statut** : ORION actif, ATLAS préparé

