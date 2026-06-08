# 🚀 AUDIT PERFORMANCE - Academia Hub

**Date:** $(date)  
**Problème:** Navigation jusqu'à 50 secondes  
**Objectif:** Navigation < 1s, pages lourdes < 2s

---

## 📊 ÉTAT ACTUEL

### Métriques observées
- Navigation interne: **Jusqu'à 50 secondes** ❌
- Chargement lourd: **Non mesuré**
- Données critiques: **Non mesuré**

### Objectifs cibles
- Navigation interne: **< 800ms** ✅
- Page lourde: **< 2s** ✅
- Recherche: **< 500ms** ✅
- Dashboard: **< 1.5s** ✅
- Sync background: **Invisible** ✅

---

## 🔍 DIAGNOSTIC - 7 CAUSES PROBABLES

### 1️⃣ Requêtes API non optimisées
**Symptôme:** clic → attente longue → réponse unique tardive

**Causes probables:**
- [ ] Requêtes SQL sans index
- [ ] Jointures lourdes
- [ ] Absence de pagination
- [ ] Chargement de TOUT au lieu de blocs

**Action:** Auditer toutes les routes API avec `EXPLAIN ANALYZE`

---

### 2️⃣ Absence de cache
**Symptôme:** Rechargement des mêmes données à chaque clic

**À mettre en place:**
- [ ] Cache mémoire backend (Redis ou Node LRU)
- [ ] Cache navigateur (SWR / React Query)
- [ ] Cache données stables (paramètres, années, niveaux)

---

### 3️⃣ Sync offline bloquante
**Symptôme:** Chaque navigation déclenche sync complète

**Problème:** Sync vérifie SQLite → PostgreSQL à chaque clic

**Solution:**
- [ ] Sync asynchrone en arrière-plan
- [ ] Découplée du rendu UI
- [ ] Non bloquante

---

### 4️⃣ App Router Next.js mal structuré
**Symptôme:** Page attend TOUT avant de s'afficher

**Problèmes probables:**
- [ ] fetch() bloquants dans layouts
- [ ] Trop de données dans page.tsx
- [ ] Mauvaise utilisation de Suspense

---

### 5️⃣ Composants lourds chargés dès l'entrée
**Exemples destructeurs:**
- [ ] Charts lourds partout
- [ ] ORION chargé systématiquement
- [ ] Tables complètes sans pagination

**Solution:** Chargement par priorité visuelle

---

### 6️⃣ Problème de connexion PostgreSQL
**Symptôme:** Chaque requête attend sa connexion

**À vérifier:**
- [ ] Pool de connexions configuré
- [ ] Limites définies
- [ ] Timeout propre

---

### 7️⃣ Bundle frontend énorme
**Symptôme:** Premier affichage lent, navigation lente

**Causes:**
- [ ] Trop de librairies lourdes
- [ ] Pas de code splitting
- [ ] Pas de dynamic import

---

## 🛠️ PLAN D'ACTION

### Phase 1 - Audit & Diagnostic (EN COURS)
- [x] Créer plan d'audit
- [ ] Auditer routes API critiques
- [ ] Mesurer temps de réponse
- [ ] Identifier requêtes lentes
- [ ] Vérifier index PostgreSQL

### Phase 2 - Optimisations Backend
- [ ] Ajouter index FK critiques
- [ ] Implémenter pagination partout
- [ ] Optimiser requêtes lourdes
- [ ] Configurer connection pooling
- [ ] Ajouter cache backend

### Phase 3 - Optimisations Frontend
- [ ] Implémenter React Query/SWR
- [ ] Dynamic imports pour composants lourds
- [ ] Suspense par blocs
- [ ] Skeleton loaders
- [ ] Code splitting

### Phase 4 - Refactoring Sync Offline
- [ ] Découpler sync du rendu
- [ ] Rendre sync non bloquante
- [ ] Journaliser séparément
- [ ] Sync en background uniquement

---

## 📈 MÉTRIQUES DE SUCCÈS

| Métrique | Avant | Cible | Après |
|----------|-------|-------|-------|
| Navigation interne | 50s | < 800ms | ? |
| Page lourde | ? | < 2s | ? |
| Recherche | ? | < 500ms | ? |
| Dashboard | ? | < 1.5s | ? |
| TTFB API | ? | < 200ms | ? |

---

## 🔧 COMMANDES UTILES

```bash
# Analyser une requête PostgreSQL
EXPLAIN ANALYZE SELECT * FROM students WHERE tenant_id = 'xxx';

# Vérifier les index existants
SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public';

# Vérifier la taille des tables
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```
