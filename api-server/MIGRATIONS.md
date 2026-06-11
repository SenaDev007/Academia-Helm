# 📋 Règles Strictes de Gestion des Migrations - Academia Hub

**Date** : Documentation des règles de migration  
**Statut** : ✅ **Workflow officiel défini**

---

## 🎯 Principes Fondamentaux

### ❌ JAMAIS

1. **❌ `prisma db push` en production**
   - Raison : Pas de versionnement, pas de rollback possible
   - Impact : Risque de perte de données, pas de traçabilité

2. **❌ Modifications directes de la base**
   - Raison : Pas de synchronisation avec Prisma schema
   - Impact : Schéma Prisma et base désynchronisés

3. **❌ Migrations SQL manuelles hors Prisma**
   - Raison : Prisma ne peut pas les gérer
   - Impact : État des migrations incohérent

### ✅ TOUJOURS

1. **✅ Migration versionnée avec Prisma**
   - Commande : `npx prisma migrate dev`
   - Avantage : Versionnement, rollback, traçabilité

2. **✅ Triggers/complexité SQL dans `prisma/sql/`**
   - Dossier : `prisma/sql/` (hors migrations Prisma)
   - Avantage : Séparation claire, exécution manuelle

3. **✅ PostgreSQL avant SQLite**
   - Principe : PostgreSQL = source de vérité
   - Avantage : Schéma SQLite généré depuis PostgreSQL

---

## 📁 Structure des Migrations

```
apps/api-server/
├── prisma/
│   ├── schema.prisma          # Schéma Prisma (source de vérité)
│   ├── migrations/            # Migrations Prisma versionnées
│   │   ├── YYYYMMDDHHMMSS_migration_name/
│   │   │   └── migration.sql
│   │   └── migration_lock.toml
│   ├── sql/                   # SQL complexe hors Prisma
│   │   ├── functions.sql      # Fonctions PostgreSQL
│   │   ├── triggers.sql       # Triggers PostgreSQL
│   │   └── README.md
│   └── seed.ts                # Données initiales
└── migrations/                # Migrations SQL manuelles (legacy)
    └── *.sql
```

---

## 🔄 Workflow Officiel

### Phase 1 : Développement Local

#### 1.1 Modifier le schéma Prisma

```bash
# Éditer apps/api-server/prisma/schema.prisma
# Ajouter/modifier/supprimer des modèles
```

#### 1.2 Générer la migration

```bash
cd apps/api-server

# Générer la migration
npx prisma migrate dev --name description_changement --schema=prisma/schema.prisma

# Exemples de noms :
# - add_student_guardian_relation
# - add_payment_receipt_table
# - update_fee_regime_structure
```

**Résultat** :
- ✅ Migration créée : `prisma/migrations/YYYYMMDDHHMMSS_description/migration.sql`
- ✅ Prisma Client régénéré
- ✅ Migration appliquée automatiquement sur base locale

#### 1.3 Vérifier la migration

```bash
# Vérifier le statut des migrations
npx prisma migrate status --schema=prisma/schema.prisma

# Vérifier le schéma Prisma
npx prisma validate --schema=prisma/schema.prisma
```

**Résultat attendu** : Aucune migration en attente, schéma valide.

---

### Phase 2 : SQL Complexe (Triggers/Fonctions)

#### 2.1 Ajouter fonctions/triggers dans `prisma/sql/`

**Fichiers** :
- `prisma/sql/functions.sql` - Fonctions PostgreSQL
- `prisma/sql/triggers.sql` - Triggers PostgreSQL

#### 2.2 Appliquer manuellement dans pgAdmin

**Ordre d'exécution** :
1. **D'abord** : `functions.sql` (créer les fonctions)
2. **Ensuite** : `triggers.sql` (créer les triggers)

**Méthode** :
1. Ouvrir pgAdmin Query Tool
2. Charger `prisma/sql/functions.sql`
3. Exécuter (F5)
4. Charger `prisma/sql/triggers.sql`
5. Exécuter (F5)

**Note** : Ces scripts sont **idempotents** (peuvent être relancés).

---

### Phase 3 : Production (Supabase ou PostgreSQL)

#### 3.1 Révision des migrations

```bash
# Vérifier les migrations en attente
npx prisma migrate status --schema=prisma/schema.prisma

# Vérifier les différences
npx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource prisma/schema.prisma \
  --script
```

#### 3.2 Application des migrations

**⚠️ IMPORTANT** : Utiliser `migrate deploy` (pas `migrate dev`) en production.

```bash
cd apps/api-server

# Déployer toutes les migrations en attente
npx prisma migrate deploy --schema=prisma/schema.prisma
```

**Résultat** :
- ✅ Toutes les migrations appliquées
- ✅ Aucune migration en attente
- ✅ Base de production à jour

#### 3.3 Application SQL complexe

**Après** les migrations Prisma, appliquer manuellement :

1. `prisma/sql/functions.sql` (dans Supabase SQL Editor ou pgAdmin)
2. `prisma/sql/triggers.sql` (dans Supabase SQL Editor ou pgAdmin)

---

### Phase 4 : Génération SQLite (Post-Migration PostgreSQL)

#### 4.1 Générer le schéma SQLite

```bash
# Générer le schéma SQLite depuis Prisma
npm run generate:sqlite-schema
```

**Fichier généré** : `prisma/sqlite-schema.sql`

#### 4.2 Appliquer sur SQLite local

```bash
# Appliquer le schéma SQLite (si nécessaire)
# Généralement géré automatiquement par l'app
```

---

## 📊 Commandes de Migration

### Développement Local

| Commande | Usage | Quand |
|----------|-------|-------|
| `prisma migrate dev` | Générer + appliquer migration | Après modification schema.prisma |
| `prisma migrate status` | Vérifier statut migrations | Avant/après migration |
| `prisma validate` | Valider schéma Prisma | Avant migration |
| `prisma db seed` | Exécuter seed données | Initialisation base |

### Production

| Commande | Usage | Quand |
|----------|-------|-------|
| `prisma migrate deploy` | Appliquer migrations | Déploiement production |
| `prisma migrate status` | Vérifier migrations en attente | Avant déploiement |
| `prisma db pull` | Synchroniser schema depuis DB | Vérification uniquement |

### SQL Complexe

| Fichier | Usage | Quand |
|---------|-------|-------|
| `prisma/sql/functions.sql` | Créer fonctions PostgreSQL | Après migrations Prisma |
| `prisma/sql/triggers.sql` | Créer triggers PostgreSQL | Après fonctions |

---

## ⚠️ Erreurs Courantes à Éviter

### ❌ Erreur 1 : `db push` en production

```bash
# ❌ NE PAS FAIRE
npx prisma db push
```

**Problème** : Pas de versionnement, pas de rollback.

**Solution** : Utiliser `prisma migrate dev` en local, `prisma migrate deploy` en prod.

---

### ❌ Erreur 2 : Triggers dans migrations Prisma

```sql
-- ❌ NE PAS FAIRE dans migration Prisma
CREATE TRIGGER trigger_test ON payments ...;
```

**Problème** : Prisma ne peut pas gérer les triggers complexes.

**Solution** : Mettre dans `prisma/sql/triggers.sql` et appliquer manuellement.

---

### ❌ Erreur 3 : Modifications directes de la base

```sql
-- ❌ NE PAS FAIRE
ALTER TABLE students ADD COLUMN new_field TEXT;
```

**Problème** : Schéma Prisma désynchronisé.

**Solution** : Modifier `schema.prisma`, puis générer migration.

---

### ❌ Erreur 4 : Migrations SQL manuelles

```sql
-- ❌ NE PAS CRÉER dans migrations/ sans Prisma
CREATE TABLE custom_table (...);
```

**Problème** : Prisma ne peut pas les gérer.

**Solution** : Utiliser migrations Prisma ou `prisma/sql/` pour SQL complexe.

---

## ✅ Checklist Migration

### Avant Migration

- [ ] Schéma Prisma validé (`prisma validate`)
- [ ] Migrations en attente vérifiées (`prisma migrate status`)
- [ ] Backup base de production (si applicable)
- [ ] Tests locaux passent

### Pendant Migration

- [ ] Migration générée avec nom descriptif
- [ ] Migration vérifiée (SQL généré correct)
- [ ] Migration appliquée localement avec succès
- [ ] Données seedées (si nécessaire)

### Après Migration

- [ ] Migration déployée en production (`migrate deploy`)
- [ ] Fonctions SQL appliquées (`prisma/sql/functions.sql`)
- [ ] Triggers SQL appliqués (`prisma/sql/triggers.sql`)
- [ ] Vérification fonctionnelle (tests)
- [ ] Schéma SQLite régénéré (si applicable)

---

## 📋 Règles par Environnement

### Développement Local

| Action | Méthode | Commande |
|--------|---------|----------|
| **Modifier schéma** | Éditer `schema.prisma` | - |
| **Créer migration** | `prisma migrate dev` | `npx prisma migrate dev --name ...` |
| **Appliquer SQL complexe** | pgAdmin manuel | Charger `prisma/sql/*.sql` |
| **Seed données** | `prisma db seed` | `npx prisma db seed` |

### Production (Supabase/PostgreSQL)

| Action | Méthode | Commande |
|--------|---------|----------|
| **Déployer migrations** | `prisma migrate deploy` | `npx prisma migrate deploy` |
| **Appliquer SQL complexe** | Supabase SQL Editor | Copier-coller `prisma/sql/*.sql` |
| **Vérifier état** | `prisma migrate status` | `npx prisma migrate status` |

---

## 🔄 Ordre d'Application Recommandé

### 1. Migrations Prisma (Automatique)

```bash
# Étape 1 : Migration Prisma
npx prisma migrate dev --name add_new_feature --schema=prisma/schema.prisma
```

### 2. SQL Complexe (Manuel)

```sql
-- Étape 2 : Fonctions SQL
-- Fichier : prisma/sql/functions.sql
-- Exécuter dans pgAdmin

-- Étape 3 : Triggers SQL
-- Fichier : prisma/sql/triggers.sql
-- Exécuter dans pgAdmin
```

### 3. Vérification

```bash
# Étape 4 : Vérifier état
npx prisma migrate status --schema=prisma/schema.prisma

# Étape 5 : Valider schéma
npx prisma validate --schema=prisma/schema.prisma
```

---

## 📊 Types de Changements

### Changements Gérés par Prisma

✅ **Générer migration automatique** :
- Ajout/modification/suppression de modèles
- Ajout/modification/suppression de champs
- Modifications de types de colonnes
- Ajout/modification de relations
- Ajout/modification d'index
- Ajout/modification de contraintes (UNIQUE, etc.)

### Changements Hors Prisma

❌ **DOIVENT être dans `prisma/sql/`** :
- Fonctions PostgreSQL complexes
- Triggers PostgreSQL
- Vues matérielles
- Extensions PostgreSQL
- Politiques RLS (Row Level Security)
- Rôles PostgreSQL

---

## ✅ Workflow Complet

### Scenario : Ajouter une nouvelle table

#### Étape 1 : Modifier schéma Prisma

```prisma
// Dans apps/api-server/prisma/schema.prisma
model NewFeature {
  id        String   @id @default(uuid())
  tenantId  String
  // ... autres champs
  @@map("new_features")
}
```

#### Étape 2 : Générer migration

```bash
npx prisma migrate dev --name add_new_feature_table --schema=prisma/schema.prisma
```

#### Étape 3 : Si nécessaire, ajouter trigger

```sql
-- Dans apps/api-server/prisma/sql/triggers.sql
CREATE TRIGGER trigger_new_feature ...
```

#### Étape 4 : Appliquer trigger manuellement

Dans pgAdmin :
1. Ouvrir `prisma/sql/triggers.sql`
2. Exécuter (F5)

#### Étape 5 : Production

```bash
# Déployer migration Prisma
npx prisma migrate deploy --schema=prisma/schema.prisma

# Appliquer triggers manuellement dans Supabase SQL Editor
```

---

## 🎯 Règles Strictes Résumées

1. **❌ JAMAIS `db push` en production**
2. **✅ TOUJOURS migration versionnée (`migrate dev` / `migrate deploy`)**
3. **✅ SQL complexe dans `prisma/sql/` (hors migrations Prisma)**
4. **✅ PostgreSQL avant SQLite (source de vérité)**
5. **✅ Idempotent : scripts SQL relançables**

---

**Le workflow de migration est maintenant documenté et prêt à être suivi !** ✅
