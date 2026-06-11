# Dossier uploads - Stockage des fichiers générés

## Structure

```
uploads/
├── id-cards/           # Cartes scolaires (PDF)
│   └── {tenantId}/
│       └── {academicYearId}/
│           └── id-card-{cardNumber}.pdf
└── README.md           # Ce fichier
```

## Configuration

Le dossier `uploads` est configuré pour stocker les fichiers générés par l'application, notamment :
- **Cartes scolaires** : PDFs des cartes d'identité scolaires générées
- **Documents officiels** : Autres documents PDF générés (bullets, certificats, etc.)

## Permissions

⚠️ **Important** : Assurez-vous que le dossier `uploads` a les permissions d'écriture pour le processus Node.js.

### Linux/Mac
```bash
chmod -R 755 uploads/
chown -R node:node uploads/
```

### Windows
Les permissions sont généralement gérées automatiquement. Vérifiez que le compte utilisateur a les droits d'écriture.

## Sécurité

- ✅ Les fichiers sont isolés par `tenantId` et `academicYearId`
- ✅ Les noms de fichiers incluent des identifiants uniques
- ✅ Aucun fichier sensible ne doit être stocké ici sans chiffrement
- ✅ Les fichiers PDF sont générés de manière sécurisée via Puppeteer

## Nettoyage

Les fichiers peuvent être nettoyés périodiquement (via un job cron) pour :
- Supprimer les fichiers expirés
- Libérer l'espace disque
- Maintenir la conformité RGPD

## Backup

⚠️ **Recommandation** : Configurer un backup automatique du dossier `uploads` pour préserver les documents officiels.

