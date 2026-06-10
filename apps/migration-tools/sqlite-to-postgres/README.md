# Migration SQLite → PostgreSQL

Scripts pour migrer les données existantes d'Academia Hub Desktop (SQLite) vers la plateforme SaaS PostgreSQL.

## Principe

1. **Lecture SQLite** : Connexion à `academia-hub.db`
2. **Mapping** : Conversion des données SQLite → PostgreSQL
3. **Injection tenant_id** : Attribution d'un tenant_id pour chaque école
4. **Insertion PostgreSQL** : Injection dans la base SaaS
5. **Validation** : Vérification de l'intégrité des données

## Structure

```
migration-tools/
├── sqlite-to-postgres/
│   ├── index.ts                 # Point d'entrée
│   ├── sqlite-reader.ts         # Lecture SQLite
│   ├── postgres-writer.ts       # Écriture PostgreSQL
│   ├── mappers/                 # Mappers par table
│   │   ├── students.mapper.ts
│   │   ├── teachers.mapper.ts
│   │   └── ...
│   └── validators/              # Validateurs
│       └── data-validator.ts
```

## Usage

```bash
# Migration d'une école spécifique
npm run migrate:school -- --sqlite-path ./academia-hub.db --tenant-id <uuid>

# Migration avec création automatique du tenant
npm run migrate:school -- --sqlite-path ./academia-hub.db --school-name "École ABC"
```

## Sécurité

- ✅ Migration non destructive (SQLite non modifié)
- ✅ Logs détaillés de chaque étape
- ✅ Rollback possible
- ✅ Validation des données avant insertion
- ✅ Transaction PostgreSQL (rollback en cas d'erreur)

