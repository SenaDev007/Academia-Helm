# 🔌 Guide d'Intégration de Nouveaux Modules

## 📋 Processus d'Intégration

### Étape 1 : Création de la Structure

```bash
# Créer la structure du module
mkdir -p apps/api-server/src/module-name/{entities,dto}
```

### Étape 2 : Créer l'Entité

Suivre le template dans `PATTERNS-DEVELOPPEMENT.md` :
- ✅ `tenant_id` obligatoire
- ✅ `academic_track_id` si pédagogique
- ✅ `school_level_id` si applicable
- ✅ Relations correctes

### Étape 3 : Créer la Migration SQL

```sql
-- Migration : Ajout du module
CREATE TABLE IF NOT EXISTS module_name (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    academic_track_id UUID, -- Si pédagogique
    school_level_id UUID,   -- Si applicable
    -- Champs métier
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_module_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_module_tenant ON module_name(tenant_id);
```

### Étape 4 : Créer Repository, Service, Controller

Suivre les templates dans `PATTERNS-DEVELOPPEMENT.md`.

### Étape 5 : Enregistrer dans AppModule

```typescript
// apps/api-server/src/app.module.ts
import { ModuleNameModule } from './module-name/module-name.module';

@Module({
  imports: [
    // ...
    ModuleNameModule,
  ],
})
export class AppModule {}
```

### Étape 6 : Tests

- Tests unitaires
- Tests d'intégration
- Tests E2E

### Étape 7 : Documentation

- Documentation API
- Guide utilisateur
- Exemples d'utilisation

---

## 🔗 Intégration avec Modules Existants

### Avec Academic Tracks

```typescript
// Si module pédagogique
import { AcademicTracksModule } from '../academic-tracks/academic-tracks.module';
import { AcademicTracksService } from '../academic-tracks/academic-tracks.service';

@Module({
  imports: [AcademicTracksModule],
})
export class ModuleNameModule {}

// Dans le service
constructor(
  private readonly academicTracksService: AcademicTracksService,
) {}

async create(dto: CreateDto, tenantId: string) {
  // Assignation track par défaut
  let academicTrackId = dto.academicTrackId;
  if (!academicTrackId) {
    const defaultTrack = await this.academicTracksService.findDefaultTrack(tenantId);
    academicTrackId = defaultTrack.id;
  }
  // ...
}
```

### Avec Tenant Features

```typescript
// Pour vérifier si une feature est activée
import { TenantFeaturesService } from '../tenant-features/tenant-features.service';
import { FeatureCode } from '../tenant-features/entities/tenant-feature.entity';

async isFeatureEnabled(tenantId: string): Promise<boolean> {
  return this.tenantFeaturesService.isFeatureEnabled(
    FeatureCode.BILINGUAL_TRACK,
    tenantId,
  );
}
```

### Avec Payment Flows

```typescript
// Pour créer un paiement SAAS
import { PaymentFlowsService } from '../payment-flows/payment-flows.service';
import { PaymentFlowType, PaymentServiceProvider } from '../payment-flows/entities/payment-flow.entity';

async createPayment(amount: number, tenantId: string) {
  return this.paymentFlowsService.createPaymentFlow(
    {
      flowType: PaymentFlowType.SAAS,
      amount,
      currency: 'XOF',
      psp: PaymentServiceProvider.FEDAPAY,
      reason: 'Paiement module',
    },
    tenantId,
  );
}
```

### Avec ORION

```typescript
// Créer un service d'analyse
// orion/services/module-analysis.service.ts
@Injectable()
export class ModuleAnalysisService {
  async analyze(tenantId: string): Promise<AnalysisResult> {
    // Lecture seule
    // Analyses, statistiques, alertes
  }
}
```

---

## ✅ Checklist d'Intégration

- [ ] Structure créée
- [ ] Entité conforme
- [ ] Migration SQL créée
- [ ] Repository implémenté
- [ ] Service implémenté
- [ ] Controller implémenté
- [ ] Module enregistré dans AppModule
- [ ] Tests écrits
- [ ] Documentation créée
- [ ] Intégrations avec modules existants
- [ ] Audit logs configurés
- [ ] Permissions RBAC définies

---

**Version :** 1.0.0

