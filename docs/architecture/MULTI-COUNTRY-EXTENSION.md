# 🌍 Extension Multi-Pays — Academia Hub

## 🎯 Vision et Objectif

Préparer l'extension d'Academia Hub vers plusieurs pays africains sans refonte du système existant, en utilisant une architecture policy-driven pour gérer les variabilités par pays.

### Objectif Principal

Permettre l'ajout futur de pays sans casser :
- ✅ Le modèle métier existant
- ✅ Les données existantes (Bénin)
- ✅ Les modules fonctionnels
- ✅ L'architecture actuelle

### Principe Fondamental

**Un seul codebase, une seule base centrale, variabilité par policies uniquement.**

---

## 🏗️ Architecture Actuelle

### Contexte

- **Pays initial** : Bénin (BJ)
- **Architecture** : Déjà policy-driven
- **Base de données** : PostgreSQL multi-tenant
- **Codebase** : Next.js App Router + API backend

### Points Forts à Préserver

- ✅ Isolation multi-tenant par sous-domaine
- ✅ Architecture modulaire
- ✅ Système de policies existant
- ✅ Base de données centralisée

---

## 📊 Modèle de Données Multi-Pays

### Table `countries`

Extension de la table existante pour supporter plusieurs pays :

```sql
CREATE TABLE countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(2) NOT NULL UNIQUE,        -- ISO 3166-1 alpha-2 (BJ, SN, CI, etc.)
  name VARCHAR(100) NOT NULL,              -- Nom officiel
  name_fr VARCHAR(100) NOT NULL,           -- Nom en français
  currency_code VARCHAR(3) NOT NULL,      -- ISO 4217 (XOF, XOF, etc.)
  currency_symbol VARCHAR(10) NOT NULL,   -- FCFA, FCFA, etc.
  locale VARCHAR(10) NOT NULL,             -- fr-BJ, fr-SN, etc.
  timezone VARCHAR(50) NOT NULL,           -- Africa/Porto-Novo, etc.
  is_active BOOLEAN DEFAULT false,         -- Pays activé
  activation_date DATE,                   -- Date d'activation
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Index
CREATE INDEX idx_countries_code ON countries(code);
CREATE INDEX idx_countries_active ON countries(is_active);
```

### Table `country_policies`

Association des policies par pays :

```sql
CREATE TABLE country_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID NOT NULL,
  policy_key VARCHAR(100) NOT NULL,       -- Ex: 'school_year_start', 'payment_methods'
  policy_value JSONB NOT NULL,            -- Valeur de la policy (flexible)
  description TEXT,                       -- Description de la policy
  is_mandatory BOOLEAN DEFAULT false,     -- Policy obligatoire
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT fk_country_policy_country FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE,
  CONSTRAINT uq_country_policy_key UNIQUE (country_id, policy_key)
);

-- Index
CREATE INDEX idx_country_policies_country ON country_policies(country_id);
CREATE INDEX idx_country_policies_key ON country_policies(policy_key);
```

### Table `country_legal_rules`

Règles légales spécifiques par pays :

```sql
CREATE TABLE country_legal_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID NOT NULL,
  rule_type VARCHAR(50) NOT NULL,         -- 'tax', 'data_protection', 'education_law'
  rule_key VARCHAR(100) NOT NULL,        -- Clé de la règle
  rule_value JSONB NOT NULL,             -- Valeur de la règle
  description TEXT,
  effective_date DATE,                   -- Date d'entrée en vigueur
  expiry_date DATE,                      -- Date d'expiration (optionnel)
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT fk_country_legal_country FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE
);

-- Index
CREATE INDEX idx_country_legal_country ON country_legal_rules(country_id);
CREATE INDEX idx_country_legal_type ON country_legal_rules(rule_type);
```

### Extension Table `tenants`

Ajout du champ `country_id` :

```sql
ALTER TABLE tenants
ADD COLUMN country_id UUID REFERENCES countries(id);

CREATE INDEX idx_tenants_country ON tenants(country_id);
```

---

## 🔧 Système de Policies

### Architecture Policy-Driven

Le système utilise des policies pour gérer les variabilités par pays :

```
Country → Policies → Application Logic
```

### Types de Policies

#### 1. Policies Fonctionnelles

**Exemples** :
- `school_year_start` : Date de début d'année scolaire
- `school_year_end` : Date de fin d'année scolaire
- `payment_methods` : Méthodes de paiement acceptées
- `invoice_format` : Format de facturation
- `reporting_periods` : Périodes de reporting

#### 2. Policies UI/UX

**Exemples** :
- `date_format` : Format de date (DD/MM/YYYY, MM/DD/YYYY)
- `number_format` : Format de nombre (1.000,00 vs 1,000.00)
- `currency_display` : Affichage de la devise
- `language` : Langue par défaut

#### 3. Policies Métier

**Exemples** :
- `student_id_format` : Format des identifiants élèves
- `grade_scale` : Échelle de notation (0-20, 0-100, A-F)
- `attendance_rules` : Règles d'assiduité
- `promotion_criteria` : Critères de promotion

### Service de Policies

```typescript
// src/services/country-policy.service.ts

interface CountryPolicy {
  countryId: string;
  key: string;
  value: any;
  isMandatory: boolean;
}

class CountryPolicyService {
  /**
   * Récupère une policy pour un pays
   */
  async getPolicy(
    countryId: string,
    key: string,
    defaultValue?: any
  ): Promise<any> {
    // 1. Chercher dans country_policies
    // 2. Si non trouvé, utiliser defaultValue
    // 3. Si mandatory et non trouvé, throw error
  }

  /**
   * Récupère toutes les policies d'un pays
   */
  async getAllPolicies(countryId: string): Promise<Record<string, any>> {
    // Retourne toutes les policies comme un objet
  }

  /**
   * Récupère une policy avec fallback global
   */
  async getPolicyWithFallback(
    countryId: string,
    key: string,
    globalDefault?: any
  ): Promise<any> {
    // 1. Chercher country-specific
    // 2. Si non trouvé, chercher global
    // 3. Si non trouvé, utiliser globalDefault
  }
}
```

---

## 🌐 Gouvernance Multi-Pays

### Principe de Séparation

#### Global (Commun à Tous les Pays)

- ✅ **Codebase** : Un seul code source
- ✅ **Architecture** : Même architecture pour tous
- ✅ **Modules** : Mêmes modules fonctionnels
- ✅ **API** : Même structure d'API
- ✅ **Base de données** : Même schéma (avec extensions)

#### Spécifique Pays (Variabilité par Policies)

- 🌍 **Policies** : Configurées par pays
- 🌍 **Devises** : Associées au pays
- 🌍 **Règles légales** : Spécifiques au pays
- 🌍 **Formats** : Dates, nombres, devises
- 🌍 **Textes** : Labels, messages (i18n)

### Règles de Gouvernance

#### Règle n°1 : Pas de Code Spécifique Pays

❌ **Interdit** :
```typescript
if (country === 'BJ') {
  // Code spécifique Bénin
} else if (country === 'SN') {
  // Code spécifique Sénégal
}
```

✅ **Autorisé** :
```typescript
const policy = await policyService.getPolicy(countryId, 'school_year_start');
// Utilisation de la policy
```

#### Règle n°2 : Policies Obligatoires

Certaines policies sont obligatoires pour chaque pays :
- `currency_code`
- `date_format`
- `school_year_start`
- `payment_methods`

#### Règle n°3 : Fallback Global

Si une policy n'existe pas pour un pays, utiliser la valeur globale par défaut.

#### Règle n°4 : Isolation des Données

Les données restent isolées par tenant, mais le tenant est associé à un pays.

---

## 📋 Activation Progressive

### Processus d'Activation d'un Nouveau Pays

#### Phase 1 : Préparation

1. **Création du pays** dans la table `countries`
   - Code ISO
   - Nom
   - Devise
   - Locale
   - Timezone
   - `is_active = false`

2. **Configuration des policies** dans `country_policies`
   - Policies obligatoires
   - Policies spécifiques
   - Validation des valeurs

3. **Configuration des règles légales** dans `country_legal_rules`
   - Règles fiscales
   - Protection des données
   - Lois éducatives

#### Phase 2 : Tests

1. **Environnement de test**
   - Création d'un tenant de test
   - Association au nouveau pays
   - Tests des policies
   - Tests des fonctionnalités

2. **Validation**
   - Vérification des policies
   - Vérification des formats
   - Vérification des règles légales

#### Phase 3 : Activation

1. **Activation du pays**
   ```sql
   UPDATE countries
   SET is_active = true, activation_date = CURRENT_DATE
   WHERE code = 'SN';
   ```

2. **Communication**
   - Annonce aux établissements
   - Documentation mise à jour
   - Support prêt

#### Phase 4 : Monitoring

1. **Surveillance**
   - Monitoring des erreurs
   - Monitoring des performances
   - Feedback utilisateurs

2. **Ajustements**
   - Correction des policies si nécessaire
   - Amélioration des règles légales

---

## 🔍 Ce qui est Global vs Spécifique

### Global (Commun)

| Élément | Description |
|---------|-------------|
| **Codebase** | Un seul code source pour tous les pays |
| **Architecture** | Même architecture multi-tenant |
| **Modules** | Mêmes modules (Scolarité, Finances, RH, etc.) |
| **API** | Même structure d'endpoints |
| **Base de données** | Même schéma (avec extensions) |
| **Authentification** | Même système JWT |
| **Multi-tenant** | Même logique d'isolation |
| **UI/UX** | Même design system (avec i18n) |

### Spécifique Pays (Policies)

| Élément | Description | Exemple |
|---------|-------------|---------|
| **Devise** | Devise du pays | XOF (Bénin, Sénégal), XAF (Cameroun) |
| **Format date** | Format d'affichage | DD/MM/YYYY (BJ), MM/DD/YYYY (US) |
| **Format nombre** | Format numérique | 1.000,00 (BJ), 1,000.00 (US) |
| **Année scolaire** | Dates début/fin | Septembre-Juin (BJ), Octobre-Juillet (SN) |
| **Méthodes paiement** | Paiements acceptés | Fedapay (BJ), Orange Money (SN) |
| **Format facture** | Format de facturation | Selon réglementation locale |
| **Échelle notation** | Système de notes | 0-20 (BJ), 0-100 (US) |
| **Règles légales** | Conformité locale | RGPD, lois locales |
| **Textes** | Labels et messages | i18n par pays |

---

## 🚀 Plan d'Extension

### Étape 1 : Préparation Infrastructure (Semaine 1-2)

- [ ] Extension table `countries`
- [ ] Création table `country_policies`
- [ ] Création table `country_legal_rules`
- [ ] Extension table `tenants` (ajout `country_id`)
- [ ] Service `CountryPolicyService`
- [ ] Migration données Bénin existantes

### Étape 2 : Refactoring Code (Semaine 3-4)

- [ ] Remplacement hardcoded values par policies
- [ ] Implémentation fallback global
- [ ] Tests des policies
- [ ] Documentation des policies

### Étape 3 : Premier Pays Pilote (Semaine 5-6)

- [ ] Sélection pays pilote (ex: Sénégal)
- [ ] Configuration policies Sénégal
- [ ] Tests en environnement de test
- [ ] Validation fonctionnelle

### Étape 4 : Activation Pays Pilote (Semaine 7)

- [ ] Activation Sénégal
- [ ] Monitoring
- [ ] Ajustements si nécessaire

### Étape 5 : Extension Autres Pays (Semaine 8+)

- [ ] Répétition du processus pour autres pays
- [ ] Documentation des spécificités
- [ ] Support multi-pays

---

## 📝 Checklist d'Ajout d'un Nouveau Pays

### Prérequis

- [ ] Pays identifié et validé
- [ ] Code ISO 3166-1 alpha-2 disponible
- [ ] Devise identifiée (ISO 4217)
- [ ] Locale et timezone définies

### Configuration Base de Données

- [ ] Création entrée dans `countries`
  - [ ] Code ISO
  - [ ] Nom officiel
  - [ ] Devise
  - [ ] Locale
  - [ ] Timezone
  - [ ] `is_active = false`

### Configuration Policies

- [ ] Policies obligatoires configurées
  - [ ] `currency_code`
  - [ ] `currency_symbol`
  - [ ] `date_format`
  - [ ] `number_format`
  - [ ] `school_year_start`
  - [ ] `school_year_end`
  - [ ] `payment_methods`
  - [ ] `invoice_format`

- [ ] Policies spécifiques configurées
  - [ ] `student_id_format`
  - [ ] `grade_scale`
  - [ ] `attendance_rules`
  - [ ] `promotion_criteria`

### Configuration Règles Légales

- [ ] Règles fiscales
  - [ ] Taux de TVA (si applicable)
  - [ ] Règles de facturation
  - [ ] Obligations déclaratives

- [ ] Protection des données
  - [ ] Conformité RGPD (si applicable)
  - [ ] Lois locales protection données
  - [ ] Consentements requis

- [ ] Lois éducatives
  - [ ] Obligations légales établissements
  - [ ] Règles d'inscription
  - [ ] Règles d'évaluation

### Tests

- [ ] Création tenant de test
- [ ] Association au nouveau pays
- [ ] Tests des policies
  - [ ] Vérification valeurs
  - [ ] Vérification fallback
  - [ ] Vérification obligatoires

- [ ] Tests fonctionnels
  - [ ] Création élève
  - [ ] Saisie note
  - [ ] Génération facture
  - [ ] Affichage formats (date, nombre, devise)

- [ ] Tests légaux
  - [ ] Conformité facturation
  - [ ] Conformité protection données
  - [ ] Conformité lois éducatives

### Documentation

- [ ] Documentation policies pays
- [ ] Documentation règles légales
- [ ] Guide d'utilisation pays
- [ ] FAQ pays spécifique

### Activation

- [ ] Validation finale
- [ ] Activation pays (`is_active = true`)
- [ ] Communication établissements
- [ ] Support prêt

### Post-Activation

- [ ] Monitoring erreurs
- [ ] Monitoring performances
- [ ] Collecte feedback
- [ ] Ajustements si nécessaire

---

## 🔒 Sécurité et Conformité

### Isolation des Données

- Les données restent isolées par tenant
- Le tenant est associé à un pays
- Pas de mélange de données entre pays

### Conformité Légale

- Chaque pays a ses règles légales configurées
- Validation automatique des règles
- Audit trail des conformités

### Protection des Données

- Respect des réglementations locales
- Configuration par pays des règles de protection
- Consentements selon pays

---

## 📊 Exemples de Policies

### Bénin (BJ)

```json
{
  "currency_code": "XOF",
  "currency_symbol": "FCFA",
  "date_format": "DD/MM/YYYY",
  "number_format": "1.000,00",
  "school_year_start": "09-01",
  "school_year_end": "06-30",
  "payment_methods": ["fedapay", "mobile_money"],
  "invoice_format": "benin_standard",
  "grade_scale": "0-20",
  "student_id_format": "BJ-YYYY-NNNN"
}
```

### Sénégal (SN)

```json
{
  "currency_code": "XOF",
  "currency_symbol": "FCFA",
  "date_format": "DD/MM/YYYY",
  "number_format": "1.000,00",
  "school_year_start": "10-01",
  "school_year_end": "07-31",
  "payment_methods": ["orange_money", "wave", "mobile_money"],
  "invoice_format": "senegal_standard",
  "grade_scale": "0-20",
  "student_id_format": "SN-YYYY-NNNN"
}
```

---

## 📝 Résumé

### Principes Fondamentaux

1. **Un seul codebase** : Pas de duplication de code
2. **Une seule base** : Même schéma pour tous
3. **Variabilité par policies** : Configuration, pas code
4. **Activation progressive** : Pays par pays
5. **Isolation stricte** : Données par tenant/pays

### Avantages

- ✅ Pas de refonte nécessaire
- ✅ Extension progressive
- ✅ Maintenance simplifiée
- ✅ Conformité légale par pays
- ✅ Scalabilité

### Prochaines Étapes

1. Extension tables base de données
2. Service de policies
3. Refactoring code existant
4. Premier pays pilote
5. Extension autres pays

---

**Version** : 1.0  
**Dernière mise à jour** : 2025

