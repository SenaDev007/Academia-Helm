# 🚀 QUICK START - PLATFORM_OWNER

## ⚡ DÉMARRAGE RAPIDE

### 1. Configuration (`.env`)

```env
APP_ENV=development
PLATFORM_OWNER_EMAIL=dev@academia-hub.local
```

### 2. Connexion

Connectez-vous avec l'email `dev@academia-hub.local` (ou celui défini dans `.env`).

### 3. Vérification

```bash
GET /api/dev/platform-owner/status
```

Si vous voyez `"isPlatformOwner": true`, c'est bon ! ✅

### 4. Forçage contexte (optionnel)

Ajoutez ces headers à vos requêtes :

```bash
x-tenant-id: <tenant-id>
x-academic-year-id: <academic-year-id>
```

### 5. Frontend

Le composant `<ArchitectMode />` s'affiche automatiquement en dev.

---

## 🎯 CE QUE VOUS POUVEZ FAIRE

- ✅ Accéder à tous les tenants
- ✅ Bypasser toutes les permissions
- ✅ Forcer le contexte (tenant, année, niveau, classe)
- ✅ Développer sans friction

---

## ⚠️ IMPORTANT

- En production, PLATFORM_OWNER n'existe pas
- Vous n'êtes pas audité (pas de traces)
- ORION vous ignore

---

**C'est tout ! Vous pouvez maintenant développer librement.** 🎉
