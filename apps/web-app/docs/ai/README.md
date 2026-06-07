# 🧠 Documentation IA — Academia Hub

## Vue d'ensemble

Cette documentation couvre la stratégie IA complète d'Academia Hub, incluant ORION (actif) et ATLAS (dormant).

---

## 📚 Fichiers de Documentation

### Roadmap et Stratégie

- **`ROADMAP-IA.md`** : Roadmap complète des IA (ORION, ATLAS, Hybride)
  - Statut de chaque phase
  - Objectifs et caractéristiques
  - Tableau comparatif
  - Prochaines étapes

### ORION (Actif)

- **`orion_spec.md`** : Spécification officielle ORION
  - Rôle et positionnement
  - Périmètre fonctionnel
  - Sources de données autorisées
  - Architecture logique
  - Format de réponse standard
  - Sécurité et audit
  - Responsabilité

- **`orion_rules.json`** : Règles officielles ORION (version 1.0)
  - Format JSON standardisé
  - Règles par domaine (FINANCE, RH, PEDAGOGY, SYSTEM)
  - Niveaux de sévérité
  - Conditions déterministes

- **`../ORION-IMPLEMENTATION.md`** : Documentation technique complète
  - Architecture en 4 couches
  - Services backend
  - Routes API
  - Composants frontend
  - Tests unitaires

- **`../ORION-RULES.md`** : Documentation détaillée du système de règles
  - Format JSON
  - Règles par catégorie
  - Versionnement
  - Tests

### ATLAS (Dormant)

- **`atlas_prompt.md`** : Spécification officielle ATLAS
  - Rôle et positionnement
  - Périmètre autorisé
  - Sources autorisées
  - Ton et style
  - Phrase de repli obligatoire
  - Statut

- **`atlas_architecture.md`** : Architecture technique ATLAS
  - Structure préparée
  - Services backend
  - Routes API
  - Composants frontend
  - Feature flags

### Séparation et Gouvernance

- **`ai_governance.md`** : Gouvernance IA officielle
  - Principe fondamental
  - Séparation stricte des IA
  - Feature flags IA
  - Séparation technique
  - Sécurité et accès
  - Audit et conformité
  - Cadre juridique
  - Plan d'évolution

- **`SEPARATION-RULES.md`** : Règles de séparation strictes (détaillées)
  - Séparation des accès
  - Séparation des utilisateurs
  - Séparation des responsabilités
  - Séparation technique
  - Validation continue

### Juridique

- **`../../public/legal/CGU.md`** : Conditions Générales d'Utilisation
  - Section 13 : Assistant Conversationnel ATLAS
  - Limitations et responsabilités
  - Accès et périmètre

---

## 🎯 Statut des IA

### ORION — ✅ ACTIF

- **Type** : IA de direction
- **Statut** : Implémenté et actif
- **Utilisateurs** : Directeurs, Promoteurs, Admins
- **Données** : KPI, bilans, alertes
- **Documentation** : Complète

### ATLAS — ⏸️ DORMANT

- **Type** : IA conversationnelle
- **Statut** : Préparé, non activé
- **Utilisateurs** : Secrétariat, Enseignants, Parents, Élèves
- **Données** : Documentation, UI, FAQ
- **Documentation** : Complète
- **Activation** : Nécessite validation produit

---

## 🔒 Principes Fondamentaux

### Séparation Stricte

1. **Accès** : Données strictement isolées
2. **Utilisateurs** : Rôles distincts
3. **Responsabilités** : Rôles clairs
4. **Technique** : Services, endpoints, logs distincts

### Contraintes Absolues

- ❌ Aucun mélange des données
- ❌ Aucun mélange des utilisateurs
- ❌ Aucun mélange des responsabilités
- ❌ Aucun mélange technique

---

## 📋 Checklist d'Activation ATLAS

### Prérequis

- [ ] Validation produit
- [ ] Tests internes
- [ ] Tests utilisateurs
- [ ] Documentation complète

### Technique

- [ ] Services backend implémentés
- [ ] Routes API créées
- [ ] Composants frontend créés
- [ ] Validation de contenu testée
- [ ] Feature flag configuré

### Activation

- [ ] Feature flag activé (`ATLAS_ENABLED=true`)
- [ ] Monitoring en place
- [ ] Support prêt
- [ ] Communication utilisateurs

---

## 🚀 Prochaines Étapes

### Court Terme (ORION)

1. ✅ Implémentation complète
2. ✅ Tests utilisateurs
3. ✅ Validation produit
4. ✅ Stabilisation

### Moyen Terme (ATLAS)

1. 📝 Finalisation prompt
2. 📝 Implémentation structure (dormante)
3. 📝 Tests internes
4. 📝 Validation produit
5. ⏸️ Activation progressive

### Long Terme (Hybride)

1. 🔮 Étude de faisabilité
2. 🔮 Architecture coordination
3. 🔮 Gouvernance stricte
4. 🔮 Tests utilisateurs

---

## 📞 Contact

Pour toute question sur la stratégie IA :

**YEHI OR Tech**  
Email : contact@academiahub.com

---

**Version** : 1.0  
**Dernière mise à jour** : 2025

