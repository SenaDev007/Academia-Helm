# 📐 Patterns de Développement - Academia Hub

## 🎯 Principes Généraux

### 1. Source Unique de Vérité
- **Backend = source de vérité** : Tous les calculs, validations, règles métier
- **Frontend = présentation** : Aucune logique métier, uniquement affichage

### 2. Isolation par Tenant
- **Toujours filtrer par `tenant_id`** : Guards automatiques
- **Jamais de données cross-tenant** : Isolation stricte

### 3. Support Bilingue
- **Toujours considérer `academic_track_id`** : Si module pédagogique
- **NULL = FR par défaut** : Compatibilité ascendante

### 4. Audit Complet
- **Toutes les écritures** : Journalisées dans `audit_logs`
- **Traçabilité** : Qui, quand, quoi, pourquoi

---

## 🏗️ Structure Standard d'un Module

### Arborescence

```
module-name/
├── entities/
│   └── module-name.entity.ts
├── dto/
│   ├── create-module-name.dto.ts
│   └── update-module-name.dto.ts
├── module-name.repository.ts
├── module-name.service.ts
├── module-name.controller.ts
└── module-name.module.ts
```

### Template Entité

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { AcademicTrack } from '../../academic-tracks/entities/academic-track.entity';
import { SchoolLevel } from '../../school-levels/entities/school-level.entity';

@Entity('module_name')
export class ModuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // OBLIGATOIRE : Tenant isolation
  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  // Si module pédagogique
  @Column({ type: 'uuid', nullable: true })
  academicTrackId?: string;

  @ManyToOne(() => AcademicTrack, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'academic_track_id' })
  academicTrack?: AcademicTrack;

  // Si dépend du niveau scolaire
  @Column({ type: 'uuid', nullable: true })
  schoolLevelId?: string;

  @ManyToOne(() => SchoolLevel, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'school_level_id' })
  schoolLevel?: SchoolLevel;

  // Champs métier spécifiques
  @Column({ type: 'varchar', length: 255 })
  name: string;

  // Audit
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
```

### Template Repository

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModuleEntity } from './entities/module-name.entity';

@Injectable()
export class ModuleRepository {
  constructor(
    @InjectRepository(ModuleEntity)
    private readonly repository: Repository<ModuleEntity>,
  ) {}

  async create(data: Partial<ModuleEntity>): Promise<ModuleEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findAll(
    tenantId: string,
    schoolLevelId?: string,
    academicTrackId?: string,
  ): Promise<ModuleEntity[]> {
    const where: any = { tenantId };
    if (schoolLevelId) where.schoolLevelId = schoolLevelId;
    if (academicTrackId) where.academicTrackId = academicTrackId;
    
    return this.repository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<ModuleEntity | null> {
    return this.repository.findOne({
      where: { id, tenantId },
    });
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<ModuleEntity>,
  ): Promise<ModuleEntity> {
    await this.repository.update({ id, tenantId }, data);
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.repository.delete({ id, tenantId });
  }
}
```

### Template Service

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ModuleRepository } from './module-name.repository';
import { CreateModuleDto } from './dto/create-module-name.dto';
import { UpdateModuleDto } from './dto/update-module-name.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AcademicTracksService } from '../academic-tracks/academic-tracks.service';

@Injectable()
export class ModuleService {
  constructor(
    private readonly repository: ModuleRepository,
    private readonly auditLogsService: AuditLogsService,
    private readonly academicTracksService: AcademicTracksService,
  ) {}

  async create(
    createDto: CreateModuleDto,
    tenantId: string,
    userId?: string,
  ): Promise<ModuleEntity> {
    // Validation
    await this.validateCreate(createDto, tenantId);

    // Assignation track par défaut si pédagogique
    let academicTrackId = createDto.academicTrackId;
    if (!academicTrackId && this.isPedagogicalModule()) {
      const defaultTrack = await this.academicTracksService.findDefaultTrack(tenantId);
      academicTrackId = defaultTrack?.id;
    }

    // Création
    const entity = await this.repository.create({
      ...createDto,
      tenantId,
      academicTrackId,
    });

    // Audit
    await this.auditLogsService.create(
      {
        action: 'MODULE_CREATED',
        resource: 'module_name',
        resourceId: entity.id,
        changes: createDto,
      },
      tenantId,
      userId,
    );

    return entity;
  }

  async findAll(
    tenantId: string,
    schoolLevelId?: string,
    academicTrackId?: string,
  ): Promise<ModuleEntity[]> {
    return this.repository.findAll(tenantId, schoolLevelId, academicTrackId);
  }

  async findOne(id: string, tenantId: string): Promise<ModuleEntity> {
    const entity = await this.repository.findOne(id, tenantId);
    if (!entity) {
      throw new NotFoundException(`Module with ID ${id} not found`);
    }
    return entity;
  }

  async update(
    id: string,
    updateDto: UpdateModuleDto,
    tenantId: string,
    userId?: string,
  ): Promise<ModuleEntity> {
    await this.findOne(id, tenantId); // Vérifie existence

    const entity = await this.repository.update(id, tenantId, updateDto);

    // Audit
    await this.auditLogsService.create(
      {
        action: 'MODULE_UPDATED',
        resource: 'module_name',
        resourceId: id,
        changes: updateDto,
      },
      tenantId,
      userId,
    );

    return entity;
  }

  async delete(id: string, tenantId: string, userId?: string): Promise<void> {
    await this.findOne(id, tenantId); // Vérifie existence

    await this.repository.delete(id, tenantId);

    // Audit
    await this.auditLogsService.create(
      {
        action: 'MODULE_DELETED',
        resource: 'module_name',
        resourceId: id,
      },
      tenantId,
      userId,
    );
  }

  private async validateCreate(dto: CreateModuleDto, tenantId: string): Promise<void> {
    // Validations spécifiques au module
  }

  private isPedagogicalModule(): boolean {
    // Retourne true si le module est pédagogique
    return false; // À adapter
  }
}
```

### Template Controller

```typescript
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ModuleService } from './module-name.service';
import { CreateModuleDto } from './dto/create-module-name.dto';
import { UpdateModuleDto } from './dto/update-module-name.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('module-name')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ModuleController {
  constructor(private readonly service: ModuleService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.DIRECTOR)
  create(
    @Body() createDto: CreateModuleDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.create(createDto, tenantId, user.id);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.DIRECTOR, UserRole.TEACHER)
  findAll(
    @TenantId() tenantId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('academicTrackId') academicTrackId?: string,
  ) {
    return this.service.findAll(tenantId, schoolLevelId, academicTrackId);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.DIRECTOR, UserRole.TEACHER)
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.findOne(id, tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.DIRECTOR)
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateModuleDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, updateDto, tenantId, user.id);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  remove(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.delete(id, tenantId, user.id);
  }
}
```

### Template Module

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModuleService } from './module-name.service';
import { ModuleController } from './module-name.controller';
import { ModuleRepository } from './module-name.repository';
import { ModuleEntity } from './entities/module-name.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AcademicTracksModule } from '../academic-tracks/academic-tracks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ModuleEntity]),
    AuditLogsModule,
    AcademicTracksModule, // Si module pédagogique
  ],
  controllers: [ModuleController],
  providers: [ModuleService, ModuleRepository],
  exports: [ModuleService, ModuleRepository],
})
export class ModuleNameModule {}
```

---

## 🔐 Patterns de Sécurité

### Décorateurs Personnalisés

```typescript
// @TenantId() : Extrait tenant_id depuis token
@Get()
findAll(@TenantId() tenantId: string) {
  // tenantId automatiquement injecté
}

// @CurrentUser() : Extrait utilisateur depuis token
@Post()
create(@CurrentUser() user: User) {
  // user automatiquement injecté
}

// @SchoolLevelId() : Extrait school_level_id depuis headers
@Get()
findAll(@SchoolLevelId() schoolLevelId: string) {
  // schoolLevelId automatiquement injecté
}
```

### Guards Automatiques

```typescript
// TenantValidationGuard : Vérifie tenant_id
// TenantIsolationGuard : Filtre par tenant_id
// ContextValidationGuard : Valide tenant + school_level + module
// RolesGuard : Vérifie permissions RBAC
```

---

## 📊 Patterns ORION

### Service d'Analyse

```typescript
@Injectable()
export class ModuleAnalysisService {
  constructor(
    @InjectRepository(ModuleEntity)
    private readonly repository: Repository<ModuleEntity>,
  ) {}

  // Analyse (lecture seule)
  async analyze(tenantId: string): Promise<AnalysisResult> {
    const data = await this.repository.find({ where: { tenantId } });
    
    // Calculs, statistiques
    return {
      total: data.length,
      average: this.calculateAverage(data),
      trends: this.analyzeTrends(data),
    };
  }

  // Alertes
  async generateAlerts(tenantId: string): Promise<Alert[]> {
    const data = await this.repository.find({ where: { tenantId } });
    const alerts: Alert[] = [];

    // Détection d'anomalies
    if (this.detectAnomaly(data)) {
      alerts.push({
        type: 'ANOMALY',
        severity: 'HIGH',
        message: 'Anomalie détectée',
      });
    }

    return alerts;
  }
}
```

---

## 🔄 Patterns Offline-First

### Service de Sync

```typescript
@Injectable()
export class ModuleSyncService {
  // Sync vers backend
  async syncToBackend(tenantId: string, operations: Operation[]): Promise<void> {
    for (const op of operations) {
      try {
        await this.applyOperation(op);
        await this.markAsSynced(op.id);
      } catch (error) {
        await this.markAsFailed(op.id, error);
      }
    }
  }

  // Sync depuis backend
  async syncFromBackend(tenantId: string): Promise<void> {
    const updates = await this.fetchUpdates(tenantId);
    for (const update of updates) {
      await this.applyUpdate(update);
    }
  }
}
```

---

## ✅ Checklist de Conformité

Pour tout nouveau module, vérifier :

- [ ] Entité avec `tenant_id` obligatoire
- [ ] Filtrage automatique par tenant
- [ ] Support `academic_track_id` si pédagogique
- [ ] Support `school_level_id` si applicable
- [ ] Audit logs pour toutes les écritures
- [ ] Permissions RBAC définies
- [ ] Guards appliqués
- [ ] Tests unitaires
- [ ] Tests d'intégration
- [ ] Documentation

---

**Version :** 1.0.0  
**Dernière mise à jour :** 2024

