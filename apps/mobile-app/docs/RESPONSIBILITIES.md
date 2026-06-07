# ⚖️ Limites de Responsabilités — Application Mobile Academia Hub

## Vue d'ensemble

Ce document définit clairement les limites de responsabilités de l'application mobile Academia Hub, de l'éditeur (YEHI OR Tech), et des établissements utilisateurs.

---

## 🎯 Responsabilités de l'Application Mobile

### ✅ Consultation de Données

L'application mobile est responsable de :

- **Affichage correct** des données reçues de l'API
- **Mise en cache** des données pour consultation offline limitée
- **Sécurité** des données en transit et au repos
- **Performance** de l'affichage et de la navigation
- **Accessibilité** selon les standards iOS/Android

### ✅ Notifications

L'application mobile est responsable de :

- **Réception** des notifications push
- **Affichage** des notifications
- **Redirection** vers le contenu concerné
- **Gestion** des préférences de notification

### ✅ Authentification

L'application mobile est responsable de :

- **Validation** des identifiants côté client
- **Stockage sécurisé** des tokens JWT
- **Renouvellement automatique** des tokens
- **Déconnexion** en cas d'expiration

### ✅ Expérience Utilisateur

L'application mobile est responsable de :

- **Interface intuitive** et accessible
- **Messages d'erreur** clairs et compréhensibles
- **États de chargement** visibles
- **Feedback** utilisateur approprié

---

## ❌ Responsabilités Exclues de l'Application Mobile

### Gestion Administrative

L'application mobile **ne peut pas** :

- ❌ Modifier des données administratives
- ❌ Créer des élèves ou utilisateurs
- ❌ Modifier des notes ou évaluations
- ❌ Gérer les paiements (paiement direct)
- ❌ Prendre des décisions administratives

### Données Tierces

L'application mobile **ne peut pas** :

- ❌ Accéder aux données d'autres élèves
- ❌ Accéder aux données d'autres parents
- ❌ Accéder aux KPI ou bilans directionnels
- ❌ Accéder aux données d'autres établissements

### Décisions

L'application mobile **ne peut pas** :

- ❌ Prendre des décisions
- ❌ Générer des recommandations stratégiques
- ❌ Interpréter des données de manière décisionnelle
- ❌ Suggérer des actions administratives

---

## 🏢 Responsabilités de l'Établissement

### Exactitude des Données

L'établissement est responsable de :

- **Exactitude** des données saisies dans le système
- **Mise à jour** régulière des informations
- **Validation** des données avant publication
- **Correction** des erreurs de données

### Communications

L'établissement est responsable de :

- **Contenu** des messages envoyés aux parents/élèves
- **Pertinence** des communications
- **Respect** de la vie privée dans les communications
- **Conformité** légale des communications

### Paiements

L'établissement est responsable de :

- **Gestion** des paiements (hors application mobile)
- **Facturation** correcte
- **Suivi** des paiements
- **Émission** des reçus et factures

### Accès Utilisateurs

L'établissement est responsable de :

- **Création** des comptes parents et élèves
- **Gestion** des identifiants
- **Révocation** d'accès en cas de besoin
- **Sécurité** des identifiants distribués

---

## 🏛️ Responsabilités de YEHI OR Tech (Éditeur)

### Disponibilité de l'API

YEHI OR Tech est responsable de :

- **Disponibilité** de l'API backend (SLA 99.5%)
- **Performance** de l'API (temps de réponse)
- **Maintenance** programmée annoncée
- **Support technique** de l'API

### Sécurité

YEHI OR Tech est responsable de :

- **Protection** des données en transit (HTTPS)
- **Protection** des données au repos (chiffrement)
- **Authentification** sécurisée (JWT)
- **Isolation** multi-tenant stricte

### Application Mobile

YEHI OR Tech est responsable de :

- **Développement** de l'application mobile
- **Mise à jour** de l'application
- **Correction** des bugs
- **Support technique** de l'application

### Conformité

YEHI OR Tech est responsable de :

- **Respect** des réglementations (RGPD, etc.)
- **Protection** des données personnelles
- **Audit** de sécurité régulier
- **Documentation** technique et utilisateur

---

## 🚫 Limites de Responsabilité

### Données Incorrectes

**Responsabilité** : Établissement

Si des données incorrectes sont affichées dans l'application mobile, la responsabilité incombe à l'établissement qui a saisi ces données. YEHI OR Tech n'est pas responsable de l'exactitude des données saisies par l'établissement.

### Paiements Non Traités

**Responsabilité** : Établissement / Processus de Paiement

L'application mobile ne traite pas les paiements directement. La responsabilité des paiements incombe à l'établissement et au processus de paiement externe (Fedapay, etc.).

### Décisions Basées sur les Données

**Responsabilité** : Utilisateur / Établissement

Les décisions prises sur la base des données affichées dans l'application mobile sont sous la responsabilité de l'utilisateur (parent/élève) ou de l'établissement. L'application mobile ne prend aucune décision.

### Perte de Données

**Responsabilité** : Partagée

- **Données en cache** : YEHI OR Tech n'est pas responsable de la perte de données en cache (données temporaires)
- **Données serveur** : YEHI OR Tech est responsable de la sauvegarde et de la disponibilité des données serveur

### Interruptions de Service

**Responsabilité** : YEHI OR Tech (dans les limites du SLA)

YEHI OR Tech est responsable des interruptions de service dans les limites du SLA (99.5% de disponibilité). Les interruptions dues à la force majeure ne sont pas couvertes.

---

## 📋 Cadre Juridique

### Conditions Générales d'Utilisation (CGU)

L'utilisation de l'application mobile est régie par les Conditions Générales d'Utilisation d'Academia Hub, disponibles sur le site web.

### Protection des Données

L'application mobile respecte les réglementations en vigueur concernant la protection des données personnelles (RGPD, lois locales).

### Propriété Intellectuelle

L'application mobile et son code source sont la propriété exclusive de YEHI OR Tech. Toute reproduction est interdite.

---

## 🔒 Sécurité et Confidentialité

### Données Personnelles

**Responsabilité** : YEHI OR Tech

YEHI OR Tech est responsable de la protection des données personnelles selon les standards de sécurité en vigueur.

### Accès Non Autorisé

**Responsabilité** : YEHI OR Tech (sécurité) / Utilisateur (identifiants)

- **Sécurité système** : Responsabilité de YEHI OR Tech
- **Protection identifiants** : Responsabilité de l'utilisateur

### Violation de Données

**Responsabilité** : YEHI OR Tech

En cas de violation de données due à une faille de sécurité, YEHI OR Tech est responsable de la notification et de la correction.

---

## 📊 Tableau Récapitulatif

| Élément | Responsabilité | Limites |
|---------|---------------|---------|
| **Affichage données** | Application | Données reçues de l'API |
| **Exactitude données** | Établissement | Données saisies |
| **Paiements** | Établissement / Processus externe | Pas de traitement dans l'app |
| **Communications** | Établissement | Contenu des messages |
| **Sécurité système** | YEHI OR Tech | Protection données |
| **Disponibilité API** | YEHI OR Tech | SLA 99.5% |
| **Décisions** | Utilisateur / Établissement | Aucune décision par l'app |
| **Support technique** | YEHI OR Tech | Application et API |

---

## ✅ Checklist de Responsabilités

### Pour l'Établissement

- [ ] Saisie exacte des données
- [ ] Mise à jour régulière
- [ ] Gestion des comptes utilisateurs
- [ ] Contenu des communications
- [ ] Gestion des paiements

### Pour YEHI OR Tech

- [ ] Disponibilité de l'API
- [ ] Sécurité des données
- [ ] Développement de l'app
- [ ] Support technique
- [ ] Conformité réglementaire

### Pour l'Application Mobile

- [ ] Affichage correct des données
- [ ] Sécurité des tokens
- [ ] Performance de l'interface
- [ ] Gestion des notifications
- [ ] Expérience utilisateur

---

## 📝 Résumé

### Principes Fondamentaux

1. **Consultation uniquement** : L'app ne modifie pas de données critiques
2. **Responsabilité partagée** : Chaque partie a ses responsabilités claires
3. **Limites définies** : Les limites sont explicites et documentées
4. **Cadre juridique** : Respect des CGU et réglementations

### Points Clés

- ✅ L'app affiche les données, l'établissement les saisit
- ✅ L'app ne traite pas les paiements
- ✅ L'app ne prend pas de décisions
- ✅ YEHI OR Tech garantit la disponibilité et la sécurité
- ✅ L'établissement garantit l'exactitude des données

---

**Version** : 1.0  
**Dernière mise à jour** : 2025

