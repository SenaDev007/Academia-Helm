# Checklist Offline/Online — Academia Helm (ERP institutionnel)

## Vérification 100 % spec (mapping exact)

| Spec | Implémentation |
|------|----------------|
| **PostgreSQL = source de vérité** | Oui — écritures via API uniquement ; local = cache (IndexedDB/outbox). |
| **Sync batch max 100** | Oui — `BATCH_SIZE = 100` dans `sync-engine.service.ts`. |
| **Détection 30 s** | Oui — `syncInterval30s` 30 s + interval 5 min dans `offline-sync.service.ts`. |
| **Étape 1 : Vérification schéma** | Oui — backend valide `sqliteSchemaHash` / `sqliteVersion` ; si incompatible → 400. |
| **Étape 2 : Lock UI « Synchronisation en cours »** | Oui — badge ambre + spinner dans `OfflineStatusBadge`. |
| **Étape 3 : Push par lot, tri par date, tenant_id** | Oui — outbox triée par `createdAt`, limit 100 ; `tenantId` vérifié (JWT + body). |
| **Étape 4 : Contrôle conflits, sync_status = synced** | Oui — `results[].status` SUCCESS → outbox marqué ACKNOWLEDGED. |
| **Payload push : device_id, tenant_id, operations (table, action, data, version)** | Oui — DTO `table_name`, `operation_type`, `payload` (avec `version`), `device_id` ; `tenantId` au niveau requête. |
| **Réponse : status, synced_ids, conflicts** | Oui — `OfflineSyncResponseDto` : `status`, `synced_ids`, `conflicts` + `results[]`. |
| **Pull : last_sync_at, tenant_id, device_id** | Oui — `SyncPullRequestDto` ; backend retourne entités modifiées après date. |
| **Finance : pas de merge, conflit → blocage, intervention requise** | Oui — `ConflictDetectionService` ; CONFLICT → pas d’écrasement ; message côté front (toast/conflit). |
| **Tables techniques : schema_version, sync_operations, sync_conflicts, device_registry** | Oui — IndexedDB v3 : 4 stores dans `local-db.service.ts`. |
| **Barre : Connecté / Hors ligne / Synchronisation** | Oui — 3 états dans `OfflineStatusBadge`. |
| **Historique : Dernière sync + nombre en attente** | Oui — ligne sous badges ; `lastSyncAt` chargé depuis `getSyncState` + après sync. |
| **GET /devices + Révoquer** | Oui — `GET /api/sync/devices` ; `DELETE /api/auth/devices/:id` ; onglet Paramètres > Appareils autorisés. Accessible uniquement par PLATFORM_OWNER, PLATFORM_ADMIN, Promoteur (PROMOTEUR/PROMOTER), DIRECTOR, ADMIN (backend @Roles + frontend onglet conditionnel). |
| **Device enregistré côté serveur, révocable** | Oui — `UserDevice` (deviceHash, lastSyncAt) ; révocation via `DeviceTrackingService.revokeDevice`. |
| **Blocage si schéma incompatible** | Oui — `SchemaValidatorService.validateSQLiteConformity` avant push. |
| **Retry exponentiel** | Oui — 3 tentatives, backoff 1s / 2s / 4s dans `fetchWithAuth` (sync-engine). |
| **SecurityEvent (SIEM)** | Oui — table `security_events` ; log SYNC_CONFLICT, SYNC_ANOMALY (≥5 échecs). |
| **RLS** | Fichier `prisma/migrations/rls-policies.sql` — à appliquer manuellement. |

---

## Architecture

- [x] **PostgreSQL = source de vérité** — Toutes les écritures métier passent par l’API ; le local est un cache temporaire.
- [x] **Sync contrôlée** — Push par lot (max 100), validation schéma, tenant + device obligatoires.
- [x] **Finance protégée** — Conflit = blocage (pas de merge automatique) ; message « Conflit détecté. Intervention requise. »

## Backend (API NestJS)

- [x] **POST /api/sync/push** — JWT, tenant_id, device_id (optionnel), validation schéma (sqliteSchemaHash / sqliteVersion), détection conflits, écriture PostgreSQL, mise à jour `UserDevice.lastSyncAt`, réponse au format spec : `status` ('success'|'partial'|'error'), `synced_ids[]`, `conflicts[]`, `successful_operations`, `conflicted_operations`, `failed_operations`, `results[]`.
- [x] **POST /api/sync/pull** — `last_sync_at`, `tenant_id`, `device_id` ; retour des entités modifiées (students, studentEnrollments, payments) avec mise à jour `lastSyncAt` si device fourni.
- [x] **GET /api/sync/devices** — Liste des appareils du tenant (rôles spec : PLATFORM_OWNER, PLATFORM_ADMIN, PROMOTEUR/PROMOTER, DIRECTOR, ADMIN).
- [x] **Validation** — JWT, tenant, device autorisé et non révoqué.
- [x] **Conflits** — Version / updatedAt ; règles métier (reçu émis, élève supprimé).
- [x] **SecurityEvent** — Enregistrement SYNC_CONFLICT et SYNC_ANOMALY (≥5 échecs).
- [x] **Table `security_events`** — Migration appliquée.
- [x] **UserDevice.lastSyncAt** — Migration appliquée.

## Frontend (PWA / Next.js)

- [x] **SyncEngine** — `runSync(tenantId, deviceId)` : récupération schema-hash, push (batch 100), mise à jour statuts outbox (ACKNOWLEDGED / CONFLICT / FAILED), pull, mise à jour `last_sync_at` dans `sync_state`.
- [x] **Version dans payload** — `event.localVersion` (ou 1) envoyé pour détection conflits côté serveur.
- [x] **Retry exponentiel** — Jusqu’à 3 tentatives avec backoff (1s, 2s, 4s) sur erreur HTTP 5xx / réseau.
- [x] **Détection online** — `navigator.onLine` + sync automatique toutes les **30 s** si opérations en attente, et toutes les 5 min en secours.
- [x] **Barre d’état** — Connecté / Hors ligne / Synchronisation (badge ambre + spinner). Historique : Dernière sync HH:MM + X en attente sous les badges.
- [x] **Tables techniques IndexedDB** — `schema_version`, `sync_operations`, `sync_conflicts`, `device_registry_local` (créées en v3).
- [x] **Conflits enregistrés** — Chaque conflit push enregistré dans `sync_conflicts` (table_name, local_data, server_data, detected_at).

## Tableau admin appareils

- [x] **Page Paramètres > Appareils autorisés** — Visible et accessible uniquement pour PLATFORM_OWNER, PLATFORM_ADMIN, Promoteur (PROMOTEUR/PROMOTER), DIRECTOR, ADMIN. Liste (nom, utilisateur, dernière sync, statut) + bouton **Révoquer**. Si accès direct sans droit : message « Accès réservé ».
- [x] **GET /api/sync/devices** — Alimente la liste (proxy Next.js → backend).
- [x] **DELETE /api/auth/devices/:deviceId** — Proxy vers backend pour révoquer l’appareil.

## Sécurité

- [x] **Device binding** — device_id optionnel dans push/pull ; si fourni, vérification et mise à jour `lastSyncAt`.
- [x] **Blocage schéma incompatible** — Backend rejette si `sqliteSchemaHash` / `sqliteVersion` invalides.
- [x] **RLS PostgreSQL** — Fichier `prisma/migrations/rls-policies.sql` à appliquer manuellement sur la base (isolation tenant).
- [x] **Pas de merge finance** — Conflit → statut CONFLICT, pas d’écrasement automatique.

## Limites offline (toujours online)

- Paiement Fedapay, modification plan SaaS, création tenant, paramètres critiques, ORION plateforme : non gérés en offline (hors périmètre sync actuel).

## Fichiers clés

| Rôle | Fichier |
|------|--------|
| Backend push/pull | `apps/api-server/src/sync/` (controller, offline-sync.service, DTOs) |
| Backend devices | `apps/api-server/src/auth/services/device-tracking.service.ts` (getTenantDevices) |
| Frontend sync | `apps/web-app/src/lib/offline/sync-engine.service.ts`, `offline-sync.service.ts` |
| Frontend barre | `apps/web-app/src/components/offline/OfflineStatusBadge.tsx` |
| Proxy API | `apps/web-app/src/app/api/sync/[...path]/route.ts`, `apps/web-app/src/app/api/auth/devices/[deviceId]/route.ts` |
| Paramètres > Appareils | `apps/web-app/src/app/app/settings/page.tsx` (onglet « Appareils autorisés ») |
| IndexedDB v3 | `apps/web-app/src/lib/offline/local-db.service.ts` (schema_version, sync_operations, sync_conflicts, device_registry_local) |
