# 🗺️ Roadmap d'Implémentation ERP Academia Hub

## ✅ MODULES DÉJÀ IMPLÉMENTÉS

### Modules Cœur
- ✅ **Élèves & Scolarité** : StudentsModule, ClassesModule, SubjectsModule
- ✅ **Finances** : PaymentsModule, ExpensesModule, FeeConfigurationsModule, PaymentFlowsModule
- ✅ **RH** : TeachersModule, SalaryPoliciesModule, DepartmentsModule
- ✅ **Évaluation** : ExamsModule, GradesModule, GradingPoliciesModule
- ✅ **Présence & Discipline** : AbsencesModule, DisciplineModule
- ✅ **Communication** : CommunicationModule (annonces, messages)

### Infrastructure
- ✅ **Multi-Tenant** : TenantsModule avec isolation stricte
- ✅ **Bilingue** : AcademicTracksModule, TenantFeaturesModule
- ✅ **Niveaux** : SchoolLevelsModule
- ✅ **Paiements** : PaymentFlowsModule (SAAS/TUITION séparés)
- ✅ **ORION** : OrionBilingualModule (analyse FR vs EN)
- ✅ **Système** : AuthModule, UsersModule, RolesModule, PermissionsModule, AuditLogsModule

---

## 📦 MODULES À CRÉER

### Priorité 1 (Critiques)

#### 1. Planification (Scheduling)
**Fichiers à créer :**
- `apps/api-server/src/scheduling/entities/timetable.entity.ts`
- `apps/api-server/src/scheduling/entities/room-booking.entity.ts`
- `apps/api-server/src/scheduling/entities/event.entity.ts`
- `apps/api-server/src/scheduling/scheduling.module.ts`
- `apps/api-server/src/scheduling/scheduling.service.ts`
- `apps/api-server/src/scheduling/scheduling.controller.ts`

**Fonctionnalités :**
- Emploi du temps par classe
- Réservations de salles
- Événements et calendrier
- Gestion des conflits

#### 2. Bibliothèque (Library)
**Fichiers à créer :**
- `apps/api-server/src/library/entities/book.entity.ts`
- `apps/api-server/src/library/entities/loan.entity.ts`
- `apps/api-server/src/library/library.module.ts`
- `apps/api-server/src/library/library.service.ts`
- `apps/api-server/src/library/library.controller.ts`

**Fonctionnalités :**
- Catalogue de livres
- Emprunts/retours
- Pénuries et réservations
- Statistiques

#### 3. Transport
**Fichiers à créer :**
- `apps/api-server/src/transport/entities/vehicle.entity.ts`
- `apps/api-server/src/transport/entities/route.entity.ts`
- `apps/api-server/src/transport/entities/driver.entity.ts`
- `apps/api-server/src/transport/transport.module.ts`

**Fonctionnalités :**
- Gestion des bus
- Itinéraires
- Conducteurs
- Suivi élèves

### Priorité 2 (Importants)

#### 4. Cantine
**Fichiers à créer :**
- `apps/api-server/src/canteen/entities/menu.entity.ts`
- `apps/api-server/src/canteen/entities/order.entity.ts`
- `apps/api-server/src/canteen/canteen.module.ts`

**Fonctionnalités :**
- Menus quotidiens
- Commandes élèves
- Paiements
- Statistiques consommation

#### 5. Infirmerie
**Fichiers à créer :**
- `apps/api-server/src/infirmary/entities/medical-visit.entity.ts`
- `apps/api-server/src/infirmary/entities/vaccination.entity.ts`
- `apps/api-server/src/infirmary/infirmary.module.ts`

**Fonctionnalités :**
- Visites médicales
- Vaccinations
- Urgences
- Dossiers médicaux

### Priorité 3 (Optionnels)

#### 6. QHSE
**Fichiers à créer :**
- `apps/api-server/src/qhse/entities/inspection.entity.ts`
- `apps/api-server/src/qhse/entities/incident.entity.ts`
- `apps/api-server/src/qhse/qhse.module.ts`

#### 7. Boutique
**Fichiers à créer :**
- `apps/api-server/src/shop/entities/product.entity.ts`
- `apps/api-server/src/shop/entities/order.entity.ts`
- `apps/api-server/src/shop/shop.module.ts`

#### 8. EduCast
**Fichiers à créer :**
- `apps/api-server/src/educast/entities/broadcast.entity.ts`
- `apps/api-server/src/educast/educast.module.ts`

---

## 🤖 IA - ATLAS & ORION

### ATLAS (Assistant Opérationnel)
**Fichiers à créer :**
- `apps/api-server/src/atlas/atlas.service.ts`
- `apps/api-server/src/atlas/atlas.controller.ts`
- `apps/api-server/src/atlas/atlas.module.ts`
- `apps/api-server/src/atlas/prompts/` (prompts contextuels)

**Fonctionnalités :**
- Réponses contextuelles
- Guide workflows
- Suggestions actions
- Aide à la saisie

### ORION (Amélioration)
**Fichiers à améliorer :**
- `apps/api-server/src/orion/services/orion-analysis.service.ts` (analyse complète)
- `apps/api-server/src/orion/services/orion-alerts.service.ts` (alertes intelligentes)
- `apps/api-server/src/orion/orion.module.ts` (intégration modules)

**Fonctionnalités :**
- Analyse tous modules
- Alertes cross-modules
- Rapports exécutifs
- Prédictions

---

## 🔄 OFFLINE-FIRST

### Architecture
**Fichiers à créer :**
- `apps/api-server/src/offline/entities/operation-log.entity.ts`
- `apps/api-server/src/offline/offline-sync.service.ts`
- `apps/api-server/src/offline/offline-sync.module.ts`
- `apps/api-server/src/offline/conflict-resolver.service.ts`

**Fonctionnalités :**
- SQLite local par tenant
- Journal des opérations
- Sync bidirectionnelle
- Résolution conflits

---

## 💰 TARIFICATION DYNAMIQUE

### Structure
**Fichiers à créer :**
- `apps/api-server/src/pricing/entities/pricing-rule.entity.ts`
- `apps/api-server/src/pricing/entities/tenant-module-pricing.entity.ts`
- `apps/api-server/src/pricing/pricing.service.ts`
- `apps/api-server/src/pricing/pricing.module.ts`

**Fonctionnalités :**
- Règles de calcul
- Prix par module
- Prix par option
- Prix par groupe

---

## 📊 STRUCTURE STANDARD D'UN MODULE

Chaque module suit cette structure :

```
module-name/
├── entities/
│   └── entity-name.entity.ts
├── dto/
│   ├── create-entity-name.dto.ts
│   └── update-entity-name.dto.ts
├── module-name.repository.ts
├── module-name.service.ts
├── module-name.controller.ts
└── module-name.module.ts
```

### Contraintes Obligatoires

1. **Multi-Tenant** : `tenant_id` obligatoire
2. **Niveau Scolaire** : `school_level_id` si applicable
3. **Academic Track** : `academic_track_id` si pédagogique
4. **Audit** : Intégration `AuditLogsService`
5. **Permissions** : Vérification via guards

---

## 🎯 PLAN D'IMPLÉMENTATION

### Phase 1 : Modules Critiques (Semaine 1-2)
1. ✅ Communication
2. ⏳ Planification
3. ⏳ Bibliothèque
4. ⏳ Transport

### Phase 2 : Modules Importants (Semaine 3-4)
5. ⏳ Cantine
6. ⏳ Infirmerie

### Phase 3 : Infrastructure (Semaine 5-6)
7. ⏳ ATLAS
8. ⏳ ORION amélioré
9. ⏳ Offline-First
10. ⏳ Tarification dynamique

### Phase 4 : Modules Optionnels (Semaine 7-8)
11. ⏳ QHSE
12. ⏳ Boutique
13. ⏳ EduCast

---

## 📝 NOTES IMPORTANTES

### Architecture
- Tous les modules respectent le pattern Repository
- Services contiennent la logique métier
- Controllers exposent les endpoints REST
- Guards et Interceptors appliqués automatiquement

### Sécurité
- RBAC strict via RolesGuard
- Isolation tenant via TenantIsolationGuard
- Validation contexte via ContextValidationGuard
- Audit automatique via AuditLogInterceptor

### Performance
- Index sur colonnes fréquemment filtrées
- Relations lazy loading
- Pagination sur listes
- Cache pour données statiques

---

## ✅ CHECKLIST GLOBALE

- [x] Architecture modulaire de base
- [x] Système d'activation/désactivation modules
- [x] Communication module
- [ ] Planification module
- [ ] Bibliothèque module
- [ ] Transport module
- [ ] Cantine module
- [ ] Infirmerie module
- [ ] QHSE module
- [ ] Boutique module
- [ ] EduCast module
- [ ] ATLAS assistant
- [ ] ORION amélioré
- [ ] Offline-First
- [ ] Tarification dynamique
- [ ] Documentation complète

---

**STATUT ACTUEL : 30% Implémenté**

**PROCHAINES ÉTAPES :**
1. Créer les modules critiques (Planification, Bibliothèque, Transport)
2. Créer ATLAS
3. Améliorer ORION
4. Implémenter offline-first
5. Système de tarification

