# ✅ Checklist d'Ajout d'un Nouveau Pays — Academia Hub

## Vue d'ensemble

Checklist complète pour l'ajout d'un nouveau pays à Academia Hub, garantissant une activation réussie et conforme.

---

## 📋 Phase 1 : Préparation (Semaine 1)

### 1.1 Identification du Pays

- [ ] **Pays identifié**
  - [ ] Nom officiel
  - [ ] Code ISO 3166-1 alpha-2
  - [ ] Validation du code ISO

- [ ] **Informations de base collectées**
  - [ ] Devise (code ISO 4217)
  - [ ] Symbole devise
  - [ ] Locale (ex: fr-SN)
  - [ ] Timezone (ex: Africa/Dakar)

- [ ] **Validation**
  - [ ] Pays non déjà présent dans la base
  - [ ] Code ISO valide
  - [ ] Devise identifiée

### 1.2 Recherche et Analyse

- [ ] **Règles légales identifiées**
  - [ ] Règles fiscales (TVA, facturation)
  - [ ] Protection des données (RGPD, lois locales)
  - [ ] Lois éducatives (obligations établissements)
  - [ ] Règles d'inscription élèves

- [ ] **Spécificités pays identifiées**
  - [ ] Dates année scolaire
  - [ ] Méthodes de paiement courantes
  - [ ] Format facturation requis
  - [ ] Système de notation
  - [ ] Format identifiants élèves

- [ ] **Documentation collectée**
  - [ ] Textes de lois pertinents
  - [ ] Guides réglementaires
  - [ ] Exemples de documents officiels

---

## 📋 Phase 2 : Configuration Base de Données (Semaine 1-2)

### 2.1 Création du Pays

- [ ] **Table `countries`**
  ```sql
  INSERT INTO countries (
    code, name, name_fr, currency_code, currency_symbol,
    locale, timezone, is_active
  ) VALUES (
    'SN', 'Senegal', 'Sénégal', 'XOF', 'FCFA',
    'fr-SN', 'Africa/Dakar', false
  );
  ```

  - [ ] Code ISO inséré
  - [ ] Nom officiel (EN et FR)
  - [ ] Devise configurée
  - [ ] Locale configurée
  - [ ] Timezone configurée
  - [ ] `is_active = false` (non activé)

### 2.2 Configuration Policies Obligatoires

- [ ] **Policies de base**
  ```sql
  INSERT INTO country_policies (country_id, policy_key, policy_value, is_mandatory)
  VALUES
    (country_id, 'currency_code', '"XOF"', true),
    (country_id, 'currency_symbol', '"FCFA"', true),
    (country_id, 'date_format', '"DD/MM/YYYY"', true),
    (country_id, 'number_format', '"1.000,00"', true);
  ```

  - [ ] `currency_code` configuré
  - [ ] `currency_symbol` configuré
  - [ ] `date_format` configuré
  - [ ] `number_format` configuré

- [ ] **Policies année scolaire**
  ```sql
  INSERT INTO country_policies (country_id, policy_key, policy_value, is_mandatory)
  VALUES
    (country_id, 'school_year_start', '"10-01"', true),
    (country_id, 'school_year_end', '"07-31"', true);
  ```

  - [ ] `school_year_start` configuré
  - [ ] `school_year_end` configuré

- [ ] **Policies paiements**
  ```sql
  INSERT INTO country_policies (country_id, policy_key, policy_value, is_mandatory)
  VALUES
    (country_id, 'payment_methods', '["orange_money", "wave", "mobile_money"]', true),
    (country_id, 'invoice_format', '"senegal_standard"', true);
  ```

  - [ ] `payment_methods` configuré
  - [ ] `invoice_format` configuré

### 2.3 Configuration Policies Spécifiques

- [ ] **Policies métier**
  ```sql
  INSERT INTO country_policies (country_id, policy_key, policy_value)
  VALUES
    (country_id, 'student_id_format', '"SN-YYYY-NNNN"'),
    (country_id, 'grade_scale', '"0-20"'),
    (country_id, 'attendance_rules', '{"max_absences": 20}'),
    (country_id, 'promotion_criteria', '{"min_average": 10}');
  ```

  - [ ] `student_id_format` configuré
  - [ ] `grade_scale` configuré
  - [ ] `attendance_rules` configuré
  - [ ] `promotion_criteria` configuré

### 2.4 Configuration Règles Légales

- [ ] **Règles fiscales**
  ```sql
  INSERT INTO country_legal_rules (country_id, rule_type, rule_key, rule_value)
  VALUES
    (country_id, 'tax', 'vat_rate', '{"rate": 18, "applicable": true}'),
    (country_id, 'tax', 'invoice_requirements', '{"vat_number": true}');
  ```

  - [ ] Taux TVA configuré (si applicable)
  - [ ] Règles facturation configurées
  - [ ] Obligations déclaratives configurées

- [ ] **Protection des données**
  ```sql
  INSERT INTO country_legal_rules (country_id, rule_type, rule_key, rule_value)
  VALUES
    (country_id, 'data_protection', 'gdpr_applicable', '{"applicable": false}'),
    (country_id, 'data_protection', 'local_law', '{"law_name": "Loi locale"}');
  ```

  - [ ] Conformité RGPD configurée (si applicable)
  - [ ] Lois locales configurées
  - [ ] Consentements requis configurés

- [ ] **Lois éducatives**
  ```sql
  INSERT INTO country_legal_rules (country_id, rule_type, rule_key, rule_value)
  VALUES
    (country_id, 'education_law', 'enrollment_requirements', '{"age_min": 6}'),
    (country_id, 'education_law', 'evaluation_rules', '{"mandatory_exams": true}');
  ```

  - [ ] Règles d'inscription configurées
  - [ ] Règles d'évaluation configurées
  - [ ] Obligations établissements configurées

---

## 📋 Phase 3 : Tests (Semaine 2-3)

### 3.1 Environnement de Test

- [ ] **Création tenant de test**
  - [ ] Tenant créé
  - [ ] Association au nouveau pays (`country_id`)
  - [ ] Compte admin créé

- [ ] **Configuration test**
  - [ ] Données de test créées
  - [ ] Élèves de test créés
  - [ ] Notes de test créées

### 3.2 Tests Policies

- [ ] **Vérification policies obligatoires**
  - [ ] Toutes les policies obligatoires présentes
  - [ ] Valeurs correctes
  - [ ] Pas d'erreur de validation

- [ ] **Vérification fallback global**
  - [ ] Policy absente → fallback global fonctionne
  - [ ] Policy présente → valeur pays utilisée
  - [ ] Logs de fallback corrects

- [ ] **Vérification policies spécifiques**
  - [ ] Toutes les policies spécifiques présentes
  - [ ] Valeurs correctes
  - [ ] Cohérence avec règles légales

### 3.3 Tests Fonctionnels

- [ ] **Création élève**
  - [ ] Format identifiant correct (`student_id_format`)
  - [ ] Données sauvegardées correctement
  - [ ] Affichage correct

- [ ] **Saisie note**
  - [ ] Échelle de notation correcte (`grade_scale`)
  - [ ] Validation des notes
  - [ ] Affichage correct

- [ ] **Génération facture**
  - [ ] Format facture correct (`invoice_format`)
  - [ ] Devise affichée correctement
  - [ ] Règles fiscales appliquées
  - [ ] PDF généré correctement

- [ ] **Affichage formats**
  - [ ] Format date correct (`date_format`)
  - [ ] Format nombre correct (`number_format`)
  - [ ] Devise affichée correctement
  - [ ] Locale appliquée

- [ ] **Paiements**
  - [ ] Méthodes de paiement disponibles (`payment_methods`)
  - [ ] Intégration paiement fonctionnelle
  - [ ] Notifications correctes

### 3.4 Tests Légaux

- [ ] **Conformité facturation**
  - [ ] Règles fiscales appliquées
  - [ ] Format facture conforme
  - [ ] Informations obligatoires présentes

- [ ] **Conformité protection données**
  - [ ] Consentements requis demandés
  - [ ] Données traitées conformément
  - [ ] Droits utilisateurs respectés

- [ ] **Conformité lois éducatives**
  - [ ] Règles d'inscription respectées
  - [ ] Règles d'évaluation respectées
  - [ ] Obligations établissements respectées

### 3.5 Tests Performance

- [ ] **Performance API**
  - [ ] Temps de réponse acceptable
  - [ ] Pas de dégradation
  - [ ] Cache fonctionnel

- [ ] **Performance base de données**
  - [ ] Requêtes optimisées
  - [ ] Index présents
  - [ ] Pas de blocage

---

## 📋 Phase 4 : Documentation (Semaine 3)

### 4.1 Documentation Policies

- [ ] **Documentation policies pays**
  - [ ] Liste complète des policies
  - [ ] Valeurs configurées
  - [ ] Justification des valeurs
  - [ ] Exemples d'utilisation

- [ ] **Documentation règles légales**
  - [ ] Règles fiscales documentées
  - [ ] Protection données documentée
  - [ ] Lois éducatives documentées
  - [ ] Références légales

### 4.2 Documentation Utilisateur

- [ ] **Guide d'utilisation pays**
  - [ ] Spécificités du pays
  - [ ] Formats utilisés
  - [ ] Méthodes de paiement
  - [ ] FAQ pays

- [ ] **Documentation support**
  - [ ] Procédures support
  - [ ] Contacts locaux (si applicable)
  - [ ] Horaires support

---

## 📋 Phase 5 : Validation et Activation (Semaine 4)

### 5.1 Validation Finale

- [ ] **Checklist complète**
  - [ ] Toutes les étapes précédentes validées
  - [ ] Aucun point bloquant
  - [ ] Documentation complète

- [ ] **Revue par équipe**
  - [ ] Revu technique
  - [ ] Revu légale
  - [ ] Revu produit
  - [ ] Approbation finale

### 5.2 Activation

- [ ] **Activation pays**
  ```sql
  UPDATE countries
  SET is_active = true, activation_date = CURRENT_DATE
  WHERE code = 'SN';
  ```

  - [ ] `is_active = true`
  - [ ] `activation_date` définie
  - [ ] Vérification activation

- [ ] **Communication**
  - [ ] Annonce aux établissements
  - [ ] Documentation publiée
  - [ ] Support informé
  - [ ] Communication marketing (si applicable)

### 5.3 Post-Activation

- [ ] **Monitoring**
  - [ ] Surveillance erreurs
  - [ ] Surveillance performances
  - [ ] Collecte feedback
  - [ ] Dashboard monitoring

- [ ] **Support**
  - [ ] Support prêt
  - [ ] Documentation accessible
  - [ ] Procédures en place
  - [ ] Escalade définie

---

## 📋 Phase 6 : Ajustements (Semaine 5+)

### 6.1 Corrections

- [ ] **Bugs identifiés**
  - [ ] Bugs corrigés
  - [ ] Tests de régression
  - [ ] Déploiement corrections

- [ ] **Ajustements policies**
  - [ ] Policies ajustées si nécessaire
  - [ ] Validation ajustements
  - [ ] Documentation mise à jour

### 6.2 Améliorations

- [ ] **Feedback utilisateurs**
  - [ ] Feedback collecté
  - [ ] Améliorations identifiées
  - [ ] Plan d'amélioration

- [ ] **Optimisations**
  - [ ] Performance optimisée
  - [ ] UX améliorée
  - [ ] Documentation enrichie

---

## 📊 Récapitulatif

### Durée Estimée

- **Phase 1** : 1 semaine
- **Phase 2** : 1-2 semaines
- **Phase 3** : 1-2 semaines
- **Phase 4** : 1 semaine
- **Phase 5** : 1 semaine
- **Phase 6** : Continue

**Total** : 5-7 semaines pour un nouveau pays

### Points Critiques

- ✅ **Policies obligatoires** : Toutes configurées
- ✅ **Règles légales** : Toutes documentées
- ✅ **Tests** : Tous passés
- ✅ **Documentation** : Complète
- ✅ **Support** : Prêt

---

## 📝 Notes

### Dependencies

- Service `CountryPolicyService` opérationnel
- Tables `countries`, `country_policies`, `country_legal_rules` créées
- Migration Bénin effectuée

### Risques

- Policies manquantes → Erreurs fonctionnelles
- Règles légales incomplètes → Non-conformité
- Tests insuffisants → Bugs en production
- Documentation incomplète → Support difficile

### Mitigation

- Checklist stricte
- Validation par équipe
- Tests complets
- Documentation exhaustive

---

**Version** : 1.0  
**Dernière mise à jour** : 2025

