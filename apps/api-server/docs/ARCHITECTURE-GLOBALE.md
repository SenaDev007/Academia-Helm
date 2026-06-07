# 🏗️ Architecture Globale - Academia Hub ERP Éducatif

## 📋 Vision d'Ensemble

Academia Hub est un **ERP éducatif panafricain** conçu pour être :
- **Robuste** : Architecture multi-tenant stricte, offline-first, scalable
- **Auditable** : Traçabilité complète, logs immuables, historique
- **Évolutif** : Modules isolés, activables/désactivables, facturables
- **Différenciant** : Bilingue FR/EN, IA décisionnelle (ORION), séparation financière
- **Prêt pour l'international** : Multi-devises, multi-langues, conformité

---

## 🧠 Principes Fondamentaux (Non Négociables)

### 1. Architecture MULTI-TENANT Stricte

**Règle absolue :** Toute table métier DOIT avoir `tenant_id` et être filtrée automatiquement.

```typescript
// ✅ BON
@Entity('students')
export class Student {
  @Column({ type: 'uuid' })
  tenantId: string; // OBLIGATOIRE
  
  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  tenant: Tenant;
}

// ❌ MAUVAIS
@Entity('students')
export class Student {
  // Pas de tenant_id = VIOLATION
}
```

**Guards automatiques :**
- `TenantValidationGuard` : Vérifie que tenant_id est présent
- `TenantIsolationGuard` : Filtre automatiquement par tenant_id

---

### 2. Support BILINGUE FR / EN via Academic Track

**Règle :** Toute donnée pédagogique DOIT être liée à un `academic_track_id`.

```typescript
// ✅ BON
@Entity('exams')
export class Exam {
  @Column({ type: 'uuid', nullable: true })
  academicTrackId: string; // NULL = FR par défaut
  
  @ManyToOne(() => AcademicTrack, { nullable: true })
  academicTrack: AcademicTrack;
}
```

**Services adaptés :**
- Filtrage automatique par track
- Assignation du track par défaut si non fourni
- Isolation stricte FR vs EN

---

### 3. Gestion PAR NIVEAU Scolaire

**Règle :** Toute action DOIT respecter le contexte `school_level_id`.

**Niveaux supportés :**
- Maternelle (PS, MS, GS)
- Primaire (CI, CP, CE1, CE2, CM1, CM2)
- 1er Cycle Secondaire (6ème, 5ème, 4ème, 3ème)
- 2nd Cycle Secondaire (2nde, 1ère, Terminale)

**Context Interceptor :**
- Résout automatiquement le `school_level_id` depuis les headers
- Valide que l'utilisateur a accès au niveau
- Filtre toutes les requêtes par niveau

---

### 4. OFFLINE-FIRST (SQLite local + sync)

**Architecture :**
```
┌─────────────────┐
│   Frontend      │
│  (Next.js)      │
└────────┬────────┘
         │
    ┌────▼────┐
    │ SQLite  │ ← Base locale par tenant
    │  Local  │
    └────┬────┘
         │
    ┌────▼────┐
    │  Sync   │ ← Synchronisation bidirectionnelle
    │ Service │
    └────┬────┘
         │
    ┌────▼────┐
    │ Backend │ ← Source de vérité
    │ (NestJS)│
    └─────────┘
```

**Journal des opérations :**
- Toutes les écritures locales sont journalisées
- Sync résout les conflits (last-write-wins ou merge)
- Résolution manuelle si nécessaire

---

### 5. Séparation ABSOLUE des Flux Financiers

**Règle stricte :** Deux flux distincts, jamais mélangés.

```
┌─────────────────────────────────────┐
│  PAIEMENTS SAAS                     │
│  → Academia Hub                     │
│  - Souscriptions                    │
│  - Abonnements                      │
│  - Options (bilingue, etc.)         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  PAIEMENTS SCOLARITÉ                │
│  → École (tenant)                   │
│  - Frais scolaires                  │
│  - Paiements parents                │
│  - Via Mobile Money / Carte         │
└─────────────────────────────────────┘
```

**Contrainte CHECK en base garantit cette séparation.**

---

### 6. IA - ORION & ATLAS

#### ORION (Analyse & Décision)
- **Lecture seule** : Ne modifie jamais les données
- **Analyse** : Performance, finance, RH, pédagogie
- **Alertes** : Détection d'anomalies, recommandations
- **Rapports** : Synthèses exécutives, KPIs

#### ATLAS (Assistance Opérationnelle)
- **Guidage** : Workflows, formulaires, processus
- **Assistance** : Réponses contextuelles, suggestions
- **Respect permissions** : Accès selon RBAC

---

### 7. Tarification Dynamique

**Facteurs de pricing :**
- **Modules** : Chaque module peut être facturé séparément
- **Options** : Bilingue, Cambridge, IB, etc.
- **Groupes scolaires** : Tarifs dégressifs par nombre d'écoles

**Feature flags :**
- `BILINGUAL_TRACK` : +15 000 FCFA/mois
- Futures options : Extensible

---

### 8. Sécurité, Audit, Traçabilité

**RBAC strict :**
- Rôles : SUPER_ADMIN, ADMIN, DIRECTOR, TEACHER, PARENT, STUDENT
- Permissions granulaires par module
- Isolation par tenant + niveau + track

**Audit complet :**
- Toutes les écritures journalisées
- Logs immuables dans `audit_logs`
- Historique des modifications
- Exports légaux

---

## 🏗️ Architecture Modulaire

### Structure Standard d'un Module

```
module-name/
├── entities/
│   └── module-name.entity.ts      # Entité TypeORM
├── dto/
│   ├── create-module-name.dto.ts
│   └── update-module-name.dto.ts
├── module-name.repository.ts      # Accès données
├── module-name.service.ts         # Logique métier
├── module-name.controller.ts      # Endpoints API
└── module-name.module.ts         # Module NestJS
```

### Contraintes Obligatoires

**Toute entité DOIT avoir :**
```typescript
@Entity('module_name')
export class ModuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string; // OBLIGATOIRE

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  tenant: Tenant;

  // Si pédagogique :
  @Column({ type: 'uuid', nullable: true })
  academicTrackId?: string; // Si applicable

  @Column({ type: 'uuid', nullable: true })
  schoolLevelId?: string; // Si applicable

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
```

---

## 📦 Modules Cœur (Toujours Actifs)

### 1. Élèves & Scolarité
- **StudentsModule** : Gestion des élèves
- **ClassesModule** : Organisation des classes
- **AbsencesModule** : Suivi des absences
- **DisciplineModule** : Gestion disciplinaire
- **AcademicYearsModule** : Années scolaires
- **QuartersModule** : Trimestres/périodes

### 2. Finances
- **PaymentsModule** : Paiements scolarité
- **PaymentFlowsModule** : Flux SAAS/TUITION
- **FeeConfigurationsModule** : Configuration frais
- **ExpensesModule** : Dépenses

### 3. RH
- **TeachersModule** : Gestion enseignants
- **SalaryPoliciesModule** : Politiques salariales
- **DepartmentsModule** : Départements

### 4. Planification
- **SubjectsModule** : Matières
- **RoomsModule** : Salles
- **ScheduleModule** : Emplois du temps (à créer)

### 5. Examens
- **ExamsModule** : Examens
- **GradesModule** : Notes
- **GradingPoliciesModule** : Politiques de notation

### 6. Communication
- **NotificationsModule** : Notifications (à créer)
- **MessagesModule** : Messagerie (à créer)

---

## 🔌 Modules Additionnels (Optionnels)

### Bibliothèque
- **LibraryModule** : Gestion bibliothèque
- **BooksModule** : Catalogue livres
- **LoansModule** : Prêts

### Transport
- **TransportModule** : Gestion transport
- **VehiclesModule** : Véhicules
- **RoutesModule** : Itinéraires

### Cantine
- **CanteenModule** : Gestion cantine
- **MenusModule** : Menus
- **OrdersModule** : Commandes

### Infirmerie
- **InfirmaryModule** : Gestion infirmerie
- **MedicalRecordsModule** : Dossiers médicaux
- **VaccinationsModule** : Vaccinations

### QHSE
- **Qhsemodule** : Qualité, Hygiène, Sécurité, Environnement
- **IncidentsModule** : Incidents
- **InspectionsModule** : Inspections

### Boutique
- **ShopModule** : Boutique école
- **ProductsModule** : Produits
- **SalesModule** : Ventes

### EduCast
- **EduCastModule** : Diffusion contenu éducatif
- **ContentModule** : Contenus
- **SubscriptionsModule** : Abonnements

---

## 🔄 Patterns de Développement

### Pattern Repository

```typescript
@Injectable()
export class ModuleRepository {
  constructor(
    @InjectRepository(ModuleEntity)
    private readonly repository: Repository<ModuleEntity>,
  ) {}

  async findAll(
    tenantId: string,
    schoolLevelId?: string,
    academicTrackId?: string,
  ): Promise<ModuleEntity[]> {
    const where: any = { tenantId };
    if (schoolLevelId) where.schoolLevelId = schoolLevelId;
    if (academicTrackId) where.academicTrackId = academicTrackId;
    
    return this.repository.find({ where });
  }
}
```

### Pattern Service

```typescript
@Injectable()
export class ModuleService {
  constructor(
    private readonly repository: ModuleRepository,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(
    createDto: CreateModuleDto,
    tenantId: string,
    userId?: string,
  ): Promise<ModuleEntity> {
    const entity = await this.repository.create({
      ...createDto,
      tenantId,
    });

    // Audit
    await this.auditLogsService.create(
      { action: 'MODULE_CREATED', resource: 'module', resourceId: entity.id },
      tenantId,
      userId,
    );

    return entity;
  }
}
```

### Pattern Controller

```typescript
@Controller('modules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ModuleController {
  constructor(private readonly service: ModuleService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  findAll(@TenantId() tenantId: string) {
    return this.service.findAll(tenantId);
  }
}
```

---

## 🔐 Sécurité & Permissions

### RBAC (Role-Based Access Control)

```typescript
enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',    // Accès total
  ADMIN = 'ADMIN',                 // Admin établissement
  DIRECTOR = 'DIRECTOR',           // Directeur
  TEACHER = 'TEACHER',             // Enseignant
  PARENT = 'PARENT',               // Parent
  STUDENT = 'STUDENT',             // Élève
}
```

### Permissions Granulaires

```typescript
enum Permission {
  // Module Students
  STUDENTS_READ = 'STUDENTS_READ',
  STUDENTS_WRITE = 'STUDENTS_WRITE',
  STUDENTS_DELETE = 'STUDENTS_DELETE',
  
  // Module Payments
  PAYMENTS_READ = 'PAYMENTS_READ',
  PAYMENTS_WRITE = 'PAYMENTS_WRITE',
  // etc.
}
```

---

## 📊 Intégration ORION

### Structure Standard

```typescript
// orion/services/module-analysis.service.ts
@Injectable()
export class ModuleAnalysisService {
  // Analyse du module
  async analyze(tenantId: string): Promise<AnalysisResult> {
    // Lecture seule
    // Calculs, statistiques, alertes
  }
  
  // Génération d'alertes
  async generateAlerts(tenantId: string): Promise<Alert[]> {
    // Détection d'anomalies
  }
}
```

---

## 🔄 Offline-First

### Service de Synchronisation

```typescript
@Injectable()
export class OfflineSyncService {
  // Sync vers backend
  async syncToBackend(tenantId: string): Promise<void> {
    // Envoie les opérations locales
  }
  
  // Sync depuis backend
  async syncFromBackend(tenantId: string): Promise<void> {
    // Récupère les mises à jour
  }
  
  // Résolution de conflits
  async resolveConflicts(tenantId: string): Promise<void> {
    // Stratégie de résolution
  }
}
```

---

## 📝 Checklist de Conformité

### Pour Tout Nouveau Module

- [ ] Entité avec `tenant_id` obligatoire
- [ ] Filtrage automatique par tenant
- [ ] Support `academic_track_id` si pédagogique
- [ ] Support `school_level_id` si applicable
- [ ] Audit logs pour toutes les écritures
- [ ] Permissions RBAC définies
- [ ] Tests unitaires
- [ ] Tests d'intégration
- [ ] Documentation

---

## 🎯 Objectifs Finaux

- ✅ ERP éducatif panafricain robuste
- ✅ Architecture scalable et maintenable
- ✅ Zéro dette technique
- ✅ Prêt pour l'international
- ✅ Différenciant et compétitif

---

**Version :** 1.0.0  
**Date :** 2024  
**Auteur :** Architecture Team

