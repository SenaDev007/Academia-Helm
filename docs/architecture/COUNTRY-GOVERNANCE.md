# 🏛️ Gouvernance Multi-Pays — Academia Hub

## Vue d'ensemble

Document définissant les règles de gouvernance pour l'extension multi-pays d'Academia Hub, garantissant la cohérence, la conformité et la maintenabilité.

---

## 🎯 Principes de Gouvernance

### Principe n°1 : Unicité du Codebase

**Règle** : Un seul codebase pour tous les pays.

**Justification** :
- Maintenance simplifiée
- Évolutions synchronisées
- Pas de duplication

**Application** :
- ✅ Tous les pays utilisent le même code
- ✅ Variabilité gérée par policies uniquement
- ❌ Pas de code spécifique pays

### Principe n°2 : Centralisation des Données

**Règle** : Une seule base de données centrale.

**Justification** :
- Cohérence des données
- Backup centralisé
- Performance optimisée

**Application** :
- ✅ Même schéma pour tous les pays
- ✅ Extension par tables additionnelles
- ✅ Isolation par tenant/pays

### Principe n°3 : Variabilité par Policies

**Règle** : Toute variabilité par pays est gérée par policies.

**Justification** :
- Flexibilité sans code
- Configuration centralisée
- Évolutivité

**Application** :
- ✅ Policies dans `country_policies`
- ✅ Fallback global si policy absente
- ❌ Pas de hardcoding pays

### Principe n°4 : Activation Progressive

**Règle** : Activation pays par pays, avec validation.

**Justification** :
- Réduction des risques
- Validation progressive
- Support adapté

**Application** :
- ✅ Processus d'activation défini
- ✅ Tests obligatoires
- ✅ Monitoring post-activation

---

## 📋 Règles de Gouvernance

### Règle n°1 : Pas de Code Spécifique Pays

#### Interdit

```typescript
// ❌ INTERDIT
if (country === 'BJ') {
  // Code spécifique Bénin
} else if (country === 'SN') {
  // Code spécifique Sénégal
}

// ❌ INTERDIT
const config = {
  BJ: { ... },
  SN: { ... }
};
```

#### Autorisé

```typescript
// ✅ AUTORISÉ
const policy = await policyService.getPolicy(countryId, 'school_year_start');
const startDate = policy || DEFAULT_SCHOOL_YEAR_START;

// ✅ AUTORISÉ
const currency = await policyService.getPolicy(countryId, 'currency_code');
```

### Règle n°2 : Policies Obligatoires

Certaines policies sont **obligatoires** pour chaque pays :

| Policy | Description | Exemple |
|--------|-------------|---------|
| `currency_code` | Code devise ISO 4217 | XOF, XAF |
| `currency_symbol` | Symbole devise | FCFA, FCFA |
| `date_format` | Format date | DD/MM/YYYY |
| `number_format` | Format nombre | 1.000,00 |
| `school_year_start` | Date début année | 09-01 |
| `school_year_end` | Date fin année | 06-30 |
| `payment_methods` | Méthodes paiement | ["fedapay", "mobile_money"] |
| `invoice_format` | Format facture | "benin_standard" |

**Validation** :
- Vérification à l'activation du pays
- Erreur si policy obligatoire manquante
- Documentation des policies obligatoires

### Règle n°3 : Fallback Global

**Principe** : Si une policy n'existe pas pour un pays, utiliser la valeur globale par défaut.

**Hiérarchie** :
1. Policy spécifique pays
2. Policy globale (défaut)
3. Valeur hardcodée (dernier recours)

**Implémentation** :
```typescript
async getPolicyWithFallback(
  countryId: string,
  key: string,
  globalDefault?: any
): Promise<any> {
  // 1. Chercher country-specific
  const countryPolicy = await this.getCountryPolicy(countryId, key);
  if (countryPolicy) return countryPolicy.value;

  // 2. Chercher global
  const globalPolicy = await this.getGlobalPolicy(key);
  if (globalPolicy) return globalPolicy.value;

  // 3. Utiliser globalDefault
  return globalDefault;
}
```

### Règle n°4 : Isolation des Données

**Principe** : Les données restent isolées par tenant, le tenant est associé à un pays.

**Application** :
- ✅ Table `tenants` avec `country_id`
- ✅ Isolation stricte par tenant
- ✅ Pas de mélange de données entre pays
- ✅ Filtrage automatique par pays si nécessaire

### Règle n°5 : Conformité Légale

**Principe** : Chaque pays doit avoir ses règles légales configurées.

**Obligations** :
- ✅ Règles fiscales
- ✅ Protection des données
- ✅ Lois éducatives
- ✅ Validation à l'activation

---

## 🔍 Processus de Décision

### Ajout d'une Nouvelle Variabilité

**Question** : Cette variabilité doit-elle être gérée par policy ?

**Critères** :
1. ✅ Variabilité par pays
2. ✅ Pas de logique métier complexe
3. ✅ Configuration simple (JSON)
4. ✅ Pas d'impact sur le code

**Si oui** :
- Créer une policy dans `country_policies`
- Documenter la policy
- Implémenter le fallback

**Si non** :
- Évaluer si c'est vraiment nécessaire
- Considérer une extension de module
- Documenter la décision

### Modification d'une Policy Existante

**Processus** :
1. **Évaluation** : Impact sur les pays existants
2. **Validation** : Test sur environnement de test
3. **Migration** : Mise à jour des policies existantes
4. **Communication** : Information aux établissements
5. **Monitoring** : Surveillance post-modification

---

## 📊 Matrice de Gouvernance

| Élément | Global | Spécifique Pays | Gestion |
|---------|--------|-----------------|---------|
| **Codebase** | ✅ | ❌ | Code unique |
| **Base de données** | ✅ | ❌ | Schéma unique |
| **Modules** | ✅ | ❌ | Modules communs |
| **API** | ✅ | ❌ | Endpoints communs |
| **Devise** | ❌ | ✅ | Policy `currency_code` |
| **Format date** | ❌ | ✅ | Policy `date_format` |
| **Année scolaire** | ❌ | ✅ | Policy `school_year_*` |
| **Paiements** | ❌ | ✅ | Policy `payment_methods` |
| **Facturation** | ❌ | ✅ | Policy `invoice_format` |
| **Règles légales** | ❌ | ✅ | Table `country_legal_rules` |
| **Textes UI** | ❌ | ✅ | i18n par pays |

---

## 🚨 Règles d'Exception

### Exception n°1 : Code Temporaire

**Cas** : Code spécifique pays temporaire (bug fix urgent).

**Processus** :
1. Créer ticket pour policy
2. Implémenter code temporaire avec commentaire `// TODO: Convert to policy`
3. Planifier migration vers policy
4. Supprimer code temporaire après migration

### Exception n°2 : Module Spécifique

**Cas** : Module complètement spécifique à un pays.

**Processus** :
1. Évaluer si vraiment nécessaire
2. Créer module séparé avec feature flag
3. Documenter la décision
4. Prévoir désactivation si non utilisé

---

## 📝 Documentation

### Obligations de Documentation

Pour chaque pays activé :
- [ ] Liste des policies configurées
- [ ] Règles légales documentées
- [ ] Spécificités du pays
- [ ] Guide d'utilisation pays

### Maintenance Documentation

- Mise à jour lors de chaque modification
- Versioning de la documentation
- Accessible aux équipes support

---

## ✅ Checklist de Conformité

### Avant Activation d'un Pays

- [ ] Toutes les policies obligatoires configurées
- [ ] Règles légales documentées
- [ ] Tests fonctionnels passés
- [ ] Tests de conformité passés
- [ ] Documentation complète
- [ ] Support prêt

### Après Activation

- [ ] Monitoring en place
- [ ] Feedback collecté
- [ ] Ajustements si nécessaire
- [ ] Documentation mise à jour

---

## 📝 Résumé

### Principes Clés

1. **Unicité** : Un seul codebase, une seule base
2. **Policies** : Variabilité par configuration
3. **Progression** : Activation pays par pays
4. **Conformité** : Règles légales par pays
5. **Documentation** : Tout documenté

### Règles Strictes

- ❌ Pas de code spécifique pays
- ✅ Policies obligatoires validées
- ✅ Fallback global implémenté
- ✅ Isolation données garantie
- ✅ Conformité légale vérifiée

---

**Version** : 1.0  
**Dernière mise à jour** : 2025

