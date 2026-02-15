# 📋 Nomenclature tenantId - Academia Hub

## 🎯 Convention Standard

**Dans le code (TypeScript/JavaScript) :** `tenantId` (camelCase)  
**Dans la base de données PostgreSQL :** `tenant_id` (snake_case)  
**Dans Prisma Schema :** `tenantId` avec `@map("tenant_id")` pour mapper vers la BDD

---

## ✅ Schéma Prisma

Tous les modèles utilisent `tenantId` (camelCase) avec `@map("tenant_id")` pour mapper vers la colonne `tenant_id` (snake_case) dans PostgreSQL.

**Exemple :**
```prisma
model AuditLog {
  tenantId   String   @map("tenant_id")
  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@map("audit_logs")
}
```

**⚠️ IMPORTANT :** Toujours utiliser `@map("tenant_id")` pour mapper explicitement vers la colonne de base de données.

---

## ✅ Base de Données PostgreSQL

Toutes les tables utilisent la colonne `tenant_id` (snake_case, type UUID).

**Structure standard :**
```sql
tenant_id UUID NOT NULL,
CONSTRAINT fk_<table>_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
```

**Index standard :**
```sql
CREATE INDEX IF NOT EXISTS idx_<table>_tenant ON <table>(tenant_id);
```

---

## ✅ Code Backend (NestJS/TypeORM)

### Entités TypeORM

Utiliser `tenantId` (camelCase) dans le code TypeScript, avec `@Column({ name: 'tenant_id' })` pour mapper vers la colonne de base de données.

**Exemple :**
```typescript
@Entity('audit_logs')
export class AuditLog {
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
```

### Services et Controllers

Utiliser `tenantId` (camelCase) dans tout le code TypeScript.

**Exemple :**
```typescript
const tenantId = request['tenantId'];
await this.service.findByTenant(tenantId);
```

---

## ✅ Code Frontend (Next.js/React)

Utiliser `tenantId` (camelCase) dans tout le code frontend.

**Exemple :**
```typescript
const tenantId = tenant.id;
await fetch(`/api/data?tenantId=${tenantId}`);
```

**Headers HTTP :**
```typescript
headers: {
  'X-Tenant-ID': tenantId
}
```

**Cookies :**
```typescript
document.cookie = `x-tenant-id=${tenantId}`;
```

---

## 📊 Tableau Récapitulatif

| Contexte | Nomenclature | Exemple |
|----------|--------------|---------|
| **Prisma Schema** | `tenantId` avec `@map("tenant_id")` | `tenantId String @map("tenant_id")` |
| **PostgreSQL** | `tenant_id` (snake_case, UUID) | `tenant_id UUID NOT NULL` |
| **TypeORM Entity** | `tenantId` avec `name: 'tenant_id'` | `@Column({ name: 'tenant_id' })` |
| **TypeScript Code** | `tenantId` (camelCase) | `const tenantId = '...'` |
| **Frontend** | `tenantId` (camelCase) | `tenantId: tenant.id` |
| **HTTP Headers** | `X-Tenant-ID` (kebab-case) | `'X-Tenant-ID': tenantId` |
| **API Query Params** | `tenant_id` (snake_case) | `?tenant_id=...` |

---

## 🔍 Vérification

Pour vérifier la cohérence :

1. **Schéma Prisma :** Tous les modèles doivent avoir `tenantId` avec `@map("tenant_id")`
2. **Base de données :** Toutes les tables doivent avoir `tenant_id UUID NOT NULL`
3. **Code TypeScript :** Utiliser `tenantId` (camelCase) partout
4. **Frontend :** Utiliser `tenantId` (camelCase) partout

---

## ⚠️ Erreurs Courantes à Éviter

1. ❌ **Ne pas utiliser** `tenant_id` dans le code TypeScript
2. ❌ **Ne pas oublier** `@map("tenant_id")` dans Prisma
3. ❌ **Ne pas créer** de colonnes en double (`tenantId` et `tenant_id`)
4. ❌ **Ne pas mélanger** camelCase et snake_case dans le même contexte

---

## ✅ Checklist de Migration

Lors de l'ajout d'une nouvelle table avec `tenantId` :

- [ ] Ajouter `tenantId String @map("tenant_id")` dans Prisma Schema
- [ ] Ajouter la relation `tenant Tenant @relation(...)`
- [ ] Créer la migration Prisma
- [ ] Vérifier que la colonne `tenant_id UUID NOT NULL` existe dans PostgreSQL
- [ ] Ajouter l'index `idx_<table>_tenant`
- [ ] Utiliser `tenantId` (camelCase) dans le code TypeScript
- [ ] Utiliser `tenantId` (camelCase) dans le frontend

---

**Dernière mise à jour :** 2026-02-08
