# API Comptable — Documentation OpenAPI

## Endpoints d'export comptable

Cette documentation décrit les 4 endpoints d'export comptable d'Academia Helm,
permettant à un établissement de générer des fichiers d'écritures comptables
conformes aux normes **FEC** (France), **OHADA** (Bénin/Afrique) et **CSV
universel** (mappable dans n'importe quel logiciel).

---

## Base URL

```
https://api.academiahelm.com/finance/exports/compta
```

## Authentification

Tous les endpoints nécessitent un token JWT valide dans l'en-tête `Authorization` :

```
Authorization: Bearer <jwt_token>
```

Le token est obtenu via `POST /auth/login`. L'utilisateur doit avoir un rôle
lui permettant d'accéder au module Finance (comptable, directeur, promoteur,
admin, etc.).

## Multi-tenant

Le `tenantId` est extrait automatiquement du token JWT. Les écritures retournées
sont filtrées sur le tenant de l'utilisateur connecté.

---

## 1. Export FEC (France)

### `GET /finance/exports/compta/fec`

Génère un **Fichier d'Écritures Comptables** au format texte, 18 colonnes
séparées par `|`, conforme à la norme fiscale française (article A.47 A-1 du LPF).

**Compatible avec** : Sage 100, Sage 1000, Ciel Compta, EBP Compta, QuickBooks,
Pennylane, Yooz, Dex, Odoo (module `account_fec_import`), tout logiciel
acceptant l'import FEC.

### Paramètres

| Paramètre       | Type   | Obligatoire | Description                                     |
|-----------------|--------|-------------|-------------------------------------------------|
| `dateFrom`      | string | ✅ oui      | Date de début (format `YYYY-MM-DD`, incluse)    |
| `dateTo`        | string | ✅ oui      | Date de fin (format `YYYY-MM-DD`, incluse)      |
| `academicYearId`| string | ❌ non       | ID de l'année scolaire (filtre supplémentaire)  |

### Exemple de requête

```http
GET /finance/exports/compta/fec?dateFrom=2026-01-01&dateTo=2026-01-31 HTTP/1.1
Host: api.academiahelm.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Réponse

- **Status 200** : fichier texte téléchargeable
- **Status 400** : paramètres manquants (`dateFrom` ou `dateTo`)
- **Status 401** : token JWT invalide ou expiré
- **Status 500** : erreur interne du serveur

**Headers de réponse** :
```
Content-Type: text/plain; charset=utf-8
Content-Disposition: attachment; filename="export-compta-fec-2026-01-01_2026-01-31.txt"
```

**Format du corps** (extrait) :
```
JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompAuxNum|CompAuxLib|PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise
JQC|Journal de caisse|00000001|20260105|571000|Caisse principale|||REC-2026-0001|20260105|Encaissement - Marie AKOVI|75000,00|0,00|||20260105|0,00|XOF
JQC|Journal de caisse|00000002|20260105|411000|Élèves - Créances scolaires|ELE-001|Marie AKOVI|REC-2026-0001|20260105|Scolarité - Marie AKOVI|0,00|75000,00|||20260105|0,00|XOF
JAC|Journal des achats|00000003|20260108|605000|Achats de matériel pédagogique|||FAC-FOURN-001|20260108|Achat 50 cahiers|25000,00|0,00|||20260108|0,00|XOF
JAC|Journal des achats|00000004|20260108|401000|Fournisseurs|FOU-001|Librairie Central|FAC-FOURN-001|20260108|Achat 50 cahiers|0,00|25000,00|||20260108|0,00|XOF
```

### Colonnes FEC (18 colonnes)

| #  | Colonne         | Description                                          |
|----|-----------------|------------------------------------------------------|
| 1  | JournalCode     | Code journal (JVT, JAC, JQC, JQB)                    |
| 2  | JournalLib      | Libellé journal                                      |
| 3  | EcritureNum     | Numéro séquentiel (8 chiffres)                       |
| 4  | EcritureDate    | Date d'écriture (YYYYMMDD)                           |
| 5  | CompteNum       | Numéro de compte OHADA                               |
| 6  | CompteLib       | Libellé du compte                                    |
| 7  | CompAuxNum      | N° compte auxiliaire (élève/fournisseur)             |
| 8  | CompAuxLib      | Libellé auxiliaire                                   |
| 9  | PieceRef        | N° de pièce (reçu/facture)                           |
| 10 | PieceDate       | Date de pièce (YYYYMMDD)                             |
| 11 | EcritLib        | Libellé écriture                                     |
| 12 | Debit           | Montant débit (virgule décimale)                     |
| 13 | Credit          | Montant crédit (virgule décimale)                    |
| 14 | EcritureLet     | Lettrage (vide si non lettré)                        |
| 15 | DateLet         | Date de lettrage                                     |
| 16 | ValidDate       | Date de validation                                   |
| 17 | Montantdevise   | Montant en devise (0 si mono-devise)                 |
| 18 | Idevise         | Code ISO devise (XOF)                                |

---

## 2. Export OHADA (Bénin / Afrique francophone)

### `GET /finance/exports/compta/ohada`

Génère un fichier CSV au format **SYSCOHADA** (séparateur `;`), conforme au
Référentiel OHADA applicable au Bénin et aux pays francophones d'Afrique.

**Compatible avec** : Sage OHADA, Sage Bénin, Compta Bénin, EBP OHADA,
Odoo (module `ohada_account`), tout logiciel acceptant l'import CSV OHADA.

### Paramètres

Identiques à `/fec` (voir ci-dessus).

### Exemple de requête

```http
GET /finance/exports/compta/ohada?dateFrom=2026-01-01&dateTo=2026-01-31 HTTP/1.1
Host: api.academiahelm.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Réponse

**Headers de réponse** :
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="export-compta-ohada-2026-01-01_2026-01-31.csv"
```

**Format du corps** (extrait) :
```
Date;Journal;N° Pièce;N° Compte;Libellé Compte;Tiers;Libellé Tiers;Libellé Écriture;Débit;Crédit;N° Écriture
05/01/2026;JQC;REC-2026-0001;571000;Caisse principale;;;"Encaissement - Marie AKOVI";75000.00;0.00;00000001
05/01/2026;JQC;REC-2026-0001;411000;Élèves - Créances scolaires;ELE-001;Marie AKOVI;"Scolarité - Marie AKOVI";0.00;75000.00;00000002
08/01/2026;JAC;FAC-FOURN-001;605000;Achats de matériel pédagogique;;;"Achat 50 cahiers";25000.00;0.00;00000003
08/01/2026;JAC;FAC-FOURN-001;401000;Fournisseurs;FOU-001;Librairie Central;"Achat 50 cahiers";0.00;25000.00;00000004
```

**Note** : le fichier commence par un BOM UTF-8 (`\uFEFF`) pour qu'Excel
français décode correctement les accents.

---

## 3. Export CSV universel

### `GET /finance/exports/compta/csv`

Génère un fichier CSV (séparateur `,`) avec en-tête explicite, mappable
librement dans n'importe quel logiciel comptable via la fonction « Import CSV ».

**Compatible avec** : Sage 100, QuickBooks, Xero, Free Acomba, et tout
logiciel acceptant l'import CSV avec mapping de colonnes.

### Paramètres

Identiques à `/fec` (voir ci-dessus).

### Réponse

**Headers de réponse** :
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="export-compta-csv-2026-01-01_2026-01-31.csv"
```

**Format du corps** (extrait) :
```
Date,Journal,Numéro écriture,Numéro pièce,Compte,Libellé compte,Tiers,Libellé tiers,Libellé,Débit,Crédit,Devise
05/01/2026,JQC,00000001,REC-2026-0001,571000,Caisse principale,,,"Encaissement - Marie AKOVI",75000.00,0.00,XOF
05/01/2026,JQC,00000002,REC-2026-0001,411000,Élèves - Créances scolaires,ELE-001,Marie AKOVI,"Scolarité - Marie AKOVI",0.00,75000.00,XOF
08/01/2026,JAC,00000003,FAC-FOURN-001,605000,Achats de matériel pédagogique,,,"Achat 50 cahiers",25000.00,0.00,XOF
08/01/2026,JAC,00000004,FAC-FOURN-001,401000,Fournisseurs,FOU-001,Librairie Central,"Achat 50 cahiers",0.00,25000.00,XOF
```

---

## 4. Export comptable automatique mensuel

### `POST /finance/settings/send-compta-export`

Déclenche **manuellement** l'envoi de l'export comptable mensuel au comptable
configuré dans les paramètres financiers (`comptaAutoExportEmail`).

> ℹ️ Cet endpoint est normalement appelé automatiquement par le cron job
> `ComptaAutoExportService` le jour du mois configuré (`comptaAutoExportDay`).
> L'appel manuel est utile pour tester la configuration sans attendre le
> jour prévu.

### Prérequis

Les paramètres financiers du tenant doivent avoir :
- `comptaAutoExportEnabled` = `true`
- `comptaAutoExportEmail` ≠ `null` (email du comptable)
- `comptaAutoExportFormat` ∈ {`FEC`, `OHADA`, `CSV`}

### Paramètres

Aucun (le body est vide). La configuration est lue depuis `FinancialSettings`.

### Exemple de requête

```http
POST /finance/settings/send-compta-export HTTP/1.1
Host: api.academiahelm.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json
```

### Réponse

**Status 200** :
```json
{
  "success": true,
  "message": "Export envoyé à comptable@ecole.bj (156 écritures)"
}
```

**Status 200 (échec métier)** :
```json
{
  "success": false,
  "message": "Export comptable automatique non activé. Activez-le dans les paramètres."
}
```

### Comportement

1. Charge les paramètres financiers du tenant
2. Vérifie que l'export auto est activé et l'email configuré
3. Calcule la période : **mois précédent complet** (1er → dernier jour)
4. Génère les écritures via `ComptaExportService.getAllEcritures()`
5. Construit le fichier selon `comptaAutoExportFormat` (FEC / OHADA / CSV)
6. Envoie un email HTML structuré au comptable avec le fichier en pièce jointe
7. Met à jour `comptaAutoExportLastSent` (anti-doublon)

### Email envoyé

L'email contient :
- Un en-tête avec le nom de l'établissement
- Un tableau récapitulatif (période, format, nombre d'écritures, nom du fichier)
- Le fichier comptable en pièce jointe
- Un lien vers les paramètres pour modifier la configuration

---

## Codes d'erreur communs

| Status | Cause                                | Action corrective                          |
|--------|--------------------------------------|--------------------------------------------|
| 400    | Paramètres `dateFrom`/`dateTo` manquants | Ajouter les paramètres à l'URL          |
| 401    | Token JWT invalide                   | Se reconnecter via `POST /auth/login`      |
| 403    | Rôle insuffisant                     | Contacter un administrateur                |
| 404    | Tenant introuvable                   | Vérifier le token JWT                      |
| 500    | Erreur interne                       | Consulter les logs serveur                 |

---

## Journaux comptables générés

| Code | Libellé              | Source des écritures                          |
|------|----------------------|-----------------------------------------------|
| JVT  | Journal des ventes   | Encaissements (frais scolaires) — non utilisé directement, embedded dans JQC/JQB |
| JAC  | Journal des achats   | Dépenses approuvées                          |
| JQC  | Journal de caisse    | Encaissements en espèces (CASH, CHECK)       |
| JQB  | Journal de banque    | Encaissements Mobile Money, Fedapay, virement |

Chaque transaction génère **2 lignes d'écriture** (débit + crédit) — double
entrée conforme au plan comptable OHADA.

---

## Mapping des comptes OHADA

Le mapping des comptes est configurable par établissement :

1. **Catégories de dépense** → compte de charge (classe 6)
   - Configurable dans `Dépenses → Catégories → Modifier → Compte OHADA`
   - Défaut : `607000` (Autres achats) si non mappé

2. **Catégories de frais** → compte de produit (classe 7)
   - Configurable dans la table `fee_categories.compteOhada`
   - Défaut : `706200` (Scolarité - Frais de scolarité) si non mappé

3. **Méthode de paiement** → compte de trésorerie (classe 5)
   - `CASH`, `CHECK` → `571000` (Caisse principale) ou `572000` (Caisse secondaire)
   - `MOBILE_MONEY`, `FEDAPAY`, `WIRE`, `BANK` → `521000` (Banque)

Voir `docs/INTEGRATION-COMPTABILITE.md` pour le plan comptable OHADA complet
pré-mappé pour les écoles.

---

## Rate limiting

- 100 exports par heure par tenant
- 1000 exports par jour par tenant

Au-delà, l'API retourne `429 Too Many Requests`.

---

## Exemples d'intégration

### cURL

```bash
# Export FEC pour janvier 2026
curl -X GET \
  "https://api.academiahelm.com/finance/exports/compta/fec?dateFrom=2026-01-01&dateTo=2026-01-31" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -o "export-fec-janvier-2026.txt"

# Export OHADA pour le 1er trimestre 2026
curl -X GET \
  "https://api.academiahelm.com/finance/exports/compta/ohada?dateFrom=2026-01-01&dateTo=2026-03-31" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -o "export-ohada-q1-2026.csv"

# Déclencher manuellement l'envoi mensuel au comptable
curl -X POST \
  "https://api.academiahelm.com/finance/settings/send-compta-export" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### JavaScript (fetch)

```javascript
// Export CSV universel
const response = await fetch(
  'https://api.academiahelm.com/finance/exports/compta/csv?dateFrom=2026-01-01&dateTo=2026-01-31',
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
    },
  }
);
const blob = await response.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'export-compta.csv';
a.click();
```

### Python (requests)

```python
import requests

jwt_token = "eyJhbGciOiJIUzI1NiIs..."
headers = {"Authorization": f"Bearer {jwt_token}"}
params = {"dateFrom": "2026-01-01", "dateTo": "2026-01-31"}

response = requests.get(
    "https://api.academiahelm.com/finance/exports/compta/fec",
    headers=headers,
    params=params,
)
with open("export-fec-janvier-2026.txt", "wb") as f:
    f.write(response.content)
print(f"Export téléchargé : {len(response.content)} octets")
```

---

## Changelog

- **v1.0** (2026-07) : Implémentation initiale — endpoints FEC, OHADA, CSV universel
- **v1.1** (2026-07) : Ajout endpoint `POST /send-compta-export` (déclenchement manuel)
- **v1.2** (planned) : Mapping fin par catégorie de frais (via PaymentAllocation)

---

## Voir aussi

- [docs/INTEGRATION-COMPTABILITE.md](./INTEGRATION-COMPTABILITE.md) — Documentation complète d'intégration
- [Plan comptable OHADA pré-mappé](./INTEGRATION-COMPTABILITE.md#2-données-exportables)
- [Table de compatibilité par logiciel](./INTEGRATION-COMPTABILITE.md#5-compatibilité-par-logiciel)
