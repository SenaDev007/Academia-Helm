# 🛡️ Panel Super Admin - Documentation

## Vue d'ensemble

Le Panel Super Admin est un système de gestion centralisé réservé au fondateur d'Academia Hub (YEHI OR Tech). Il permet de gérer l'ensemble de la plateforme avec un accès ultra sécurisé et une journalisation complète.

---

## 🔐 Sécurité

### Rôle Unique : SUPER_ADMIN

- **Un seul utilisateur** peut avoir le rôle `SUPER_ADMIN`
- **Création manuelle** : Le rôle ne peut être attribué que directement en base de données
- **Vérification stricte** : Toutes les routes admin vérifient le rôle avant d'autoriser l'accès

### Protection des Routes

**Côté Frontend (Next.js)** :
- Layout `/admin` vérifie le rôle `SUPER_ADMIN`
- Redirection automatique si rôle incorrect

**Côté Backend** :
- Toutes les routes `/api/admin/*` vérifient :
  1. Authentification JWT valide
  2. Rôle `SUPER_ADMIN` dans le token
  3. Utilisateur actif et non suspendu

### Journalisation Complète (Audit Trail)

**Chaque action** est enregistrée dans `admin_audit_logs` :
- ID de l'admin
- Email de l'admin
- Type d'action
- Entité concernée
- Description
- Métadonnées (JSON)
- Adresse IP
- User Agent
- Timestamp

---

## 📋 Fonctionnalités

### 1. Dashboard Global

**Vue d'ensemble** :
- Statistiques globales (tenants, revenus, utilisateurs)
- Santé du système (API, base de données)
- Établissements récents
- Activité récente (audit logs)
- Témoignages en attente

**Route** : `/admin`

### 2. Gestion des Établissements

**Fonctionnalités** :
- Liste de tous les tenants avec filtres
- Détails d'un tenant (statistiques, activité)
- Actions :
  - **Suspendre** : Bloque l'accès d'un tenant
  - **Activer** : Lève la suspension
  - **Terminer** : Clôture définitive d'un tenant
  - **Modifier l'abonnement** : Change le statut d'abonnement

**Routes** :
- `/admin/tenants` : Liste
- `/admin/tenants/:id` : Détails

**Actions API** :
- `POST /api/admin/tenants/:id/suspend`
- `POST /api/admin/tenants/:id/activate`
- `POST /api/admin/tenants/:id/terminate`
- `POST /api/admin/tenants/:id/subscription`

### 3. Validation des Témoignages

**Fonctionnalités** :
- Liste des témoignages en attente (`PENDING`)
- Approuver un témoignage (avec option "mis en avant")
- Rejeter un témoignage (avec raison obligatoire)

**Route** : `/admin/testimonials`

**Actions API** :
- `GET /api/admin/testimonials/pending`
- `POST /api/admin/testimonials/:id/approve`
- `POST /api/admin/testimonials/:id/reject`

### 4. Journal d'Audit

**Fonctionnalités** :
- Consultation de tous les logs d'audit
- Filtres : action, type d'entité, admin, période
- Export (optionnel)

**Route** : `/admin/audit`

**API** :
- `GET /api/admin/audit-logs` (avec filtres et pagination)

### 5. Statistiques Globales

**Fonctionnalités** :
- Vue détaillée des statistiques
- Graphiques et tendances
- Export de rapports

**Route** : `/admin/stats`

**API** :
- `GET /api/admin/stats`

---

## 🗄️ Modèle de Données

### AdminTenantView

```typescript
interface AdminTenantView {
  id: string;
  name: string;
  subdomain: string;
  slug: string;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt?: string;
  nextPaymentDueAt?: string;
  lastPaymentAt?: string;
  createdAt: string;
  updatedAt: string;
  // Statistiques
  studentCount: number;
  teacherCount: number;
  monthlyRevenue: number;
  lastActivityAt?: string;
  // Groupe scolaire
  groupId?: string;
  groupName?: string;
}
```

### GlobalStats

```typescript
interface GlobalStats {
  totalTenants: number;
  activeSubscriptions: number;
  trialTenants: number;
  suspendedTenants: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalStudents: number;
  totalTeachers: number;
  tenantsByStatus: Record<SubscriptionStatus, number>;
  newTenantsLast30Days: number;
  churnedTenantsLast30Days: number;
}
```

### AdminAuditLog

```typescript
interface AdminAuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: AdminActionType;
  targetType: 'TENANT' | 'TESTIMONIAL' | 'CONTENT' | 'USER' | 'SETTINGS';
  targetId: string;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}
```

---

## 🔄 Workflow des Actions

### Suspension d'un Tenant

1. **Super Admin** sélectionne un tenant
2. **Action** : Clique sur "Suspendre"
3. **Formulaire** : Saisit la raison (obligatoire)
4. **Option** : Notifier l'établissement par email
5. **Backend** :
   - Met à jour `subscriptionStatus = 'SUSPENDED'`
   - Enregistre dans l'audit log
   - Envoie l'email (si demandé)
6. **Résultat** : Le tenant perd l'accès en écriture (lecture seule)

### Validation d'un Témoignage

1. **Super Admin** consulte les témoignages en attente
2. **Action** : Clique sur "Approuver" ou "Rejeter"
3. **Si approuvé** :
   - Option : Marquer comme "mis en avant"
   - Backend : `status = 'APPROVED'`
   - Publication immédiate
4. **Si rejeté** :
   - Raison obligatoire
   - Backend : `status = 'REJECTED'` + `rejectionReason`
5. **Audit log** : Enregistrement de l'action

---

## 🚨 Actions Critiques

### Actions Irréversibles

Certaines actions sont **irréversibles** et nécessitent une confirmation explicite :

1. **Terminer un tenant** : Suppression définitive (après période de grâce)
2. **Modifier un abonnement** : Impact financier direct
3. **Rejeter un témoignage** : L'école ne peut pas le resoumettre immédiatement

### Confirmation Requise

Pour les actions critiques, une **double confirmation** est requise :
- Première confirmation : Modal avec description de l'action
- Seconde confirmation : Saisie de la raison (obligatoire)

---

## 📊 API Routes Requises (Backend)

### Dashboard

**`GET /api/admin/dashboard`**
- Retourne `AdminDashboardData`
- Vérification `SUPER_ADMIN` obligatoire

### Tenants

**`GET /api/admin/tenants`**
- Liste paginée avec filtres
- Query params : `page`, `limit`, `status`, `search`

**`GET /api/admin/tenants/:id`**
- Détails complets d'un tenant

**`POST /api/admin/tenants/:id/suspend`**
- Body : `{ reason: string, notifyTenant?: boolean }`
- Journalise l'action

**`POST /api/admin/tenants/:id/activate`**
- Body : `{ reason: string, notifyTenant?: boolean }`
- Journalise l'action

**`POST /api/admin/tenants/:id/terminate`**
- Body : `{ reason: string, notifyTenant?: boolean }`
- Journalise l'action

**`POST /api/admin/tenants/:id/subscription`**
- Body : `{ newStatus: SubscriptionStatus, reason: string, effectiveDate?: string, notifyTenant?: boolean }`
- Journalise l'action

### Témoignages

**`GET /api/admin/testimonials/pending`**
- Liste des témoignages `PENDING`

**`POST /api/admin/testimonials/:id/approve`**
- Body : `{ featured?: boolean }`
- Journalise l'action

**`POST /api/admin/testimonials/:id/reject`**
- Body : `{ reason: string }`
- Journalise l'action

### Audit

**`GET /api/admin/audit-logs`**
- Liste paginée avec filtres
- Query params : `page`, `limit`, `action`, `targetType`, `adminId`, `startDate`, `endDate`

### Statistiques

**`GET /api/admin/stats`**
- Retourne `GlobalStats`

---

## 🔒 Sécurité Backend

### Middleware de Vérification

**Toutes les routes `/api/admin/*` doivent** :

1. **Vérifier l'authentification** :
   ```typescript
   const token = extractToken(request);
   if (!token) return 401;
   ```

2. **Vérifier le rôle** :
   ```typescript
   const user = await verifyToken(token);
   if (user.role !== 'SUPER_ADMIN') return 403;
   ```

3. **Journaliser l'accès** :
   ```typescript
   await logAdminAccess(user.id, request.path, request.ip);
   ```

### Journalisation Automatique

**Chaque action admin doit être journalisée** :

```typescript
await createAuditLog({
  adminId: user.id,
  adminEmail: user.email,
  action: 'TENANT_SUSPEND',
  targetType: 'TENANT',
  targetId: tenantId,
  description: `Tenant ${tenantName} suspendu. Raison: ${reason}`,
  metadata: { reason, notifyTenant },
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
});
```

---

## 📝 Exemple d'Utilisation

### Scénario : Suspension d'un Tenant

1. **Super Admin** accède à `/admin/tenants`
2. **Sélectionne** un tenant avec statut `ACTIVE_SUBSCRIBED`
3. **Clique** sur "Suspendre"
4. **Modal** s'ouvre avec formulaire :
   - Raison : "Non-paiement depuis 2 mois"
   - Notifier l'établissement : ✅
5. **Confirme** l'action
6. **Backend** :
   - Met à jour `subscriptionStatus = 'SUSPENDED'`
   - Enregistre dans l'audit log
   - Envoie l'email à l'établissement
7. **Résultat** : Le tenant est suspendu, l'établissement est notifié

---

## ⚠️ Contraintes et Bonnes Pratiques

### Contraintes

- ❌ **Un seul SUPER_ADMIN** : Ne jamais créer plusieurs utilisateurs avec ce rôle
- ❌ **Pas de suppression de logs** : Les logs d'audit sont immuables
- ❌ **Pas d'action sans raison** : Toutes les actions critiques nécessitent une raison
- ✅ **Journalisation complète** : Chaque action doit être tracée
- ✅ **Vérification stricte** : Double vérification du rôle (frontend + backend)

### Bonnes Pratiques

1. **Réactivité** : Répondre rapidement aux actions des tenants
2. **Transparence** : Toujours notifier les établissements des actions
3. **Documentation** : Documenter les raisons des actions dans l'audit log
4. **Sécurité** : Ne jamais exposer les logs d'audit publiquement
5. **Backup** : Sauvegarder régulièrement les logs d'audit

---

## 📝 Résumé

- ✅ **Rôle unique SUPER_ADMIN** : Accès ultra sécurisé
- ✅ **Journalisation complète** : Toutes les actions sont tracées
- ✅ **Gestion globale** : Vue sur tous les tenants, témoignages, statistiques
- ✅ **Actions critiques** : Suspension, activation, modification d'abonnement
- ✅ **Validation témoignages** : Approuver/rejeter avec traçabilité
- ✅ **Sécurité renforcée** : Vérification stricte frontend + backend

**Version** : 1.0.0  
**Dernière mise à jour** : 2025

