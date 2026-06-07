# Module Réunions - Documentation Technique

## 🎯 Vue d'ensemble

Module complet de gestion des réunions administratives, pédagogiques et parents d'élèves avec :
- Templates officiels de comptes rendus
- Génération PDF
- Signatures électroniques
- Extraction NLP pour ORION

---

## 📦 Installation des dépendances

### Handlebars (requis)

```bash
npm install handlebars @types/handlebars
```

Handlebars est utilisé pour le rendu avancé des templates de comptes rendus.

### Puppeteer (optionnel mais recommandé)

**⚠️ IMPORTANT :** Puppeteer nécessite des outils de build (Visual Studio Build Tools sur Windows).

#### Installation sur Windows

1. Installer Visual Studio Build Tools :
   - Télécharger depuis : https://visualstudio.microsoft.com/downloads/
   - Installer "Desktop development with C++" workload

2. Installer Puppeteer :
```bash
npm install puppeteer
```

#### Alternative : Puppeteer Core

Si vous ne pouvez pas installer les build tools, utilisez `puppeteer-core` avec un Chrome/Chromium externe :

```bash
npm install puppeteer-core
```

Puis configurer le chemin vers Chrome dans le service.

---

## 🔧 Configuration

### Variables d'environnement

Aucune variable d'environnement spécifique requise. Le service détecte automatiquement si Puppeteer est disponible.

### Répertoire de stockage PDF

Les PDF sont stockés dans : `uploads/meeting-minutes/`

Le répertoire est créé automatiquement si nécessaire.

---

## 📝 Utilisation

### 1. Templates de comptes rendus

#### Initialiser les templates système

```typescript
POST /api/meetings/templates/initialize
```

Crée les 3 templates système :
- **ADMIN** : Réunion administrative
- **PEDAGOGIC** : Réunion pédagogique
- **PARENTS** : Réunion parents d'élèves

#### Générer un compte rendu depuis un template

```typescript
POST /api/meetings/:meetingId/minutes/generate
Body: {
  templateId?: string  // Optionnel, utilise le template système par défaut si non spécifié
}
```

### 2. Génération PDF

#### Générer un PDF

```typescript
POST /api/meetings/:meetingId/minutes/generate-pdf
```

#### Récupérer un PDF existant

```typescript
GET /api/meetings/:meetingId/minutes/pdf
```

**Note :** Si Puppeteer n'est pas installé, une erreur sera retournée. Le service fonctionne en mode dégradé sans PDF.

### 3. Signatures électroniques

#### Signer un compte rendu

```typescript
POST /api/meetings/:meetingId/minutes/sign
Body: {
  signatureType?: "VALIDATION" | "APPROVAL" | "ACKNOWLEDGMENT",
  signatureData?: string  // Données optionnelles (image, certificat, etc.)
}
```

#### Vérifier l'intégrité d'une signature

```typescript
POST /api/meetings/signatures/:signatureId/verify
```

#### Récupérer les signatures d'un compte rendu

```typescript
GET /api/meetings/:meetingId/minutes/signatures
```

### 4. Extraction NLP

#### Extraire les entités d'un compte rendu

```typescript
GET /api/meetings/:meetingId/minutes/nlp/entities
```

Retourne :
- Personnes mentionnées
- Dates
- Montants
- Actions
- Problèmes
- Risques
- Engagements

#### Analyser le sentiment

```typescript
GET /api/meetings/:meetingId/minutes/nlp/sentiment
```

Retourne :
- `sentiment`: "POSITIVE" | "NEGATIVE" | "NEUTRAL"
- `positiveScore`: nombre de mots positifs
- `negativeScore`: nombre de mots négatifs
- `confidence`: niveau de confiance (0-1)

#### Détecter les thèmes récurrents

```typescript
GET /api/meetings/nlp/recurring-themes?academicYearId=xxx
```

Identifie les problèmes et risques qui apparaissent dans plusieurs réunions.

#### Générer des insights ORION

```typescript
GET /api/meetings/nlp/orion-insights?academicYearId=xxx
```

Génère des insights stratégiques basés sur l'analyse des comptes rendus.

---

## 🎨 Syntaxe Handlebars

Les templates utilisent Handlebars avec des helpers personnalisés :

### Variables simples

```
{{tenant_name}}
{{meeting_date}}
{{start_time}}
```

### Boucles

```
{{#each participants.present}}
- {{name}} – {{function}}
{{/each}}
```

### Conditions

```
{{#if risks}}
  {{#each risks}}
  - {{this}}
  {{/each}}
{{else}}
  Aucun point de vigilance particulier.
{{/if}}
```

### Helpers disponibles

- `{{formatDate date}}` : Formate une date
- `{{formatDate date "short"}}` : Format court
- `{{ifEquals arg1 arg2}}` : Condition d'égalité
- `{{isEmpty array}}` : Vérifie si un tableau est vide
- `{{isNotEmpty array}}` : Vérifie si un tableau n'est pas vide
- `{{inc value}}` : Incrémente une valeur (pour index 1-based)
- `{{uppercase str}}` : Met en majuscules
- `{{lowercase str}}` : Met en minuscules
- `{{capitalize str}}` : Capitalise

---

## 🔐 Sécurité

### Signatures électroniques

- Hash SHA-256 pour garantir l'intégrité
- Horodatage automatique
- Enregistrement IP et User-Agent
- Vérification d'intégrité disponible

### Validation des comptes rendus

- Un compte rendu validé ne peut plus être modifié
- Toute modification crée une nouvelle version dans l'historique
- Les versions sont immuables

---

## 📊 Intégration ORION

Le service NLP alimente ORION avec :

1. **Alertes** : Comptes rendus non validés, problèmes récurrents
2. **KPIs** : Taux de validation, sentiment moyen
3. **Insights** : Thèmes récurrents, risques identifiés

Les insights sont accessibles via :
```typescript
GET /api/meetings/nlp/orion-insights?academicYearId=xxx
```

---

## 🐛 Dépannage

### Puppeteer ne se lance pas

**Erreur :** `Puppeteer is not installed`

**Solution :**
1. Installer les Visual Studio Build Tools
2. Réinstaller Puppeteer : `npm install puppeteer`
3. Ou utiliser `puppeteer-core` avec Chrome externe

### Handlebars ne compile pas

**Erreur :** `Template rendering error`

**Solution :**
1. Vérifier la syntaxe Handlebars dans le template
2. Vérifier que toutes les variables sont fournies dans les données
3. Consulter les logs pour plus de détails

### PDF non généré

**Erreur :** Fichier PDF introuvable

**Solution :**
1. Vérifier que Puppeteer est installé
2. Vérifier les permissions d'écriture dans `uploads/meeting-minutes/`
3. Vérifier les logs pour les erreurs Puppeteer

---

## 📚 Références

- [Handlebars Documentation](https://handlebarsjs.com/)
- [Puppeteer Documentation](https://pptr.dev/)
- [Prisma Documentation](https://www.prisma.io/docs)

---

## 🔄 Versions

- **v1.0.0** : Implémentation initiale
- **v1.1.0** : Ajout Handlebars, Puppeteer, Signatures, NLP

