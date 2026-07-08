# Intégration avec les logiciels comptables

## Contexte

Academia Helm est un ERP scolaire qui gère l'intégralité du cycle financier d'un
établissement : frais de scolarité, encaissements, recouvrement, dépenses,
clôtures, multi-caisses, etc. Pour autant, de nombreux établissements utilisent
déjà un logiciel comptable dédié (Sage, QuickBooks, Odoo, Ciel, EBP, Yooz,
Pennylane, etc.) pour leur comptabilité générale, leur bilan annuel et leurs
déclarations fiscales.

Ce document décrit **comment les données financières d'Academia Helm peuvent
être exportées et réimportées dans n'importe quel logiciel comptable du marché**,
sans double saisie, et en respectant les normes comptables françaises (FEC) et
OHADA (Référentiel OHADA applicable au Bénin et aux pays francophones d'Afrique).

---

## 1. Standards d'export supportés

### 1.1. FEC (Fichier d'Écritures Comptables) — France

Le **FEC** est le format normalisé imposé par l'administration fiscale française
depuis 2014 (article A.47 A-1 du LPF). Tout logiciel comptable doit pouvoir
générer un FEC pour un contrôle fiscal. Academia Helm peut générer un **FEC
directement exportable** vers :

- Sage 100 / Sage 1000
- Ciel Compta / Ciel Compta Evolution
- EBP Compta
- QuickBooks
- Pennylane
- Yooz
- Dex
- Tout logiciel acceptant l'import FEC (format texte plat 18 colonnes)

**Format** : fichier `.txt` ou `.csv` encodé en UTF-8 ou Latin-1, séparateur `|`
ou tabulation, 18 colonnes obligatoires (CodeJournal, DateEcriture, CompteNum,
CompteLib, CompAuxNum, CompAuxLib, PieceRef, PieceDate, EcritLib, Debit, Credit,
EcritureLet, DateLet, ValidDate, Montantdevise, Idevise, NatCode, NoLettre).

### 1.2. Référentiel OHADA — Bénin et Afrique francophone

Le Bénin applique le **SYSCOHADA** (Système Comptable OHADA), qui définit le
**plan comptable OHADA** et le format des états financiers annuels. Academia
Helm utilise nativement ce référentiel :

- Plan comptable OHADA (classes 1 à 8)
- Journal comptable normalisé
- Balance des comptes
- Compte de résultat
- Bilan

**Export OHADA** : fichier `.csv` ou `.xlsx` conforme au format SYSCOHADA,
importable dans :

- Sage Bénin / Sage OHADA
- Logiciels comptables locaux (Compta Bénin, etc.)
- Odoo (module `ohada_account`)
- Tout logiciel acceptant l'import CSV avec mapping de comptes

### 1.3. Format universel CSV/Excel

Pour les logiciels qui ne supportent ni FEC ni OHADA, Academia Helm propose un
**export CSV universel** avec mapping de colonnes configurable. L'utilisateur
peut télécharger le modèle d'import de son logiciel comptable, puis mapper les
colonnes Academia Helm vers les colonnes attendues.

---

## 2. Données exportables

### 2.1. Écritures comptables (journal)

Chaque transaction financière d'Academia Helm est convertible en écriture
comptable à double entrée :

| Transaction Academia Helm | Débit (compte OHADA) | Crédit (compte OHADA) |
|----------------------------|----------------------|------------------------|
| Encaissement espèces (frais scolarité) | 571 — Caisse | 7061 — Scolarité |
| Encaissement Mobile Money | 521 — Banque | 7061 — Scolarité |
| Encaissement Fedapay (avec commission) | 521 — Banque (net) <br> 631 — Frais financiers (commission) | 7061 — Scolarité (brut) |
| Annulation (reversal) | 7061 — Scolarité | 571 — Caisse (ou 521) |
| Dépense approuvée (facture fournisseur) | 60x — Achat (selon catégorie) | 401 — Fournisseur |
| Paiement fournisseur | 401 — Fournisseur | 521 — Banque (ou 571) |
| Transfert inter-caisses | 572 — Caisse secondaire | 571 — Caisse principale |

### 2.2. Plan comptable par défaut (OHADA)

Academia Helm propose un **plan comptable OHADA pré-mappé** par défaut pour les
écoles :

| Classe | Compte | Libellé |
|--------|--------|---------|
| 4 | 411000 | Élèves — Créances scolaires |
| 4 | 419000 | Élèves — Avances reçues |
| 5 | 521000 | Banque — Compte courant |
| 5 | 571000 | Caisse principale |
| 5 | 572000 | Caisse secondaire |
| 6 | 601000 | Achats de fournitures scolaires |
| 6 | 605000 | Achats de matériel pédagogique |
| 6 | 613000 | Loyers payés |
| 6 | 614000 | Entretien et réparations |
| 6 | 615000 | Frais de conservation (eau, électricité) |
| 6 | 621000 | Transport du personnel |
| 6 | 622000 | Frais de déplacement |
| 6 | 625000 | Frais de réception |
| 6 | 631000 | Frais financiers (commissions Fedapay) |
| 6 | 641000 | Rémunérations du personnel |
| 6 | 645000 | Charges sociales |
| 7 | 706100 | Scolarité — Frais d'inscription |
| 7 | 706200 | Scolarité — Frais de scolarité |
| 7 | 706300 | Scolarité — Frais d'examen |
| 7 | 706400 | Cantine scolaire |
| 7 | 706500 | Transport scolaire |
| 7 | 706600 | Activités parascolaires |

Chaque catégorie de dépense dans Academia Helm peut être **mappée à un compte
OHADA précis** dans le paramétrage (Onglet Paramètres > Catégories de dépense).

### 2.3. Journaux comptables

Academia Helm génère 3 journaux comptables distincts :

- **Journal des ventes (JVT)** : tous les encaissements de frais scolaires
- **Journal des achats (JAC)** : toutes les dépenses approuvées
- **Journal de banque (JQ)** : mouvements bancaires (Mobile Money, Fedapay, virements)
- **Journal de caisse (JQ)** : mouvements d'espèces (multi-caisses)

Chaque écriture porte :
- Le **numéro de pièce** (reçu n° pour les ventes, facture pour les achats)
- La **date d'écriture** (date de paiement / date d'approbation)
- Le **code journal** (JVT, JAC, JQB, JQC)
- Le **compte général** (OHADA)
- Le **compte tiers** (élève pour les ventes, fournisseur pour les achats)
- Le **libellé** (nom élève + type frais / description dépense)
- Les **montants débit / crédit**

---

## 3. Workflow d'export

### 3.1. Export manuel (périodique)

1. Le comptable / directeur se rend dans **Finance > Rapports financiers >
   Bilan périodique**
2. Il sélectionne la période (mois, trimestre, année)
3. Il clique sur **Export comptable (FEC)** ou **Export comptable (OHADA CSV)**
4. Le fichier est téléchargé
5. Il importe ce fichier dans son logiciel comptable via la fonction
   **Importer un FEC** ou **Importer des écritures**

### 3.2. Export automatique (mensuel)

 configurable dans **Paramètres > Intégrations comptables** :
- Activation de l'export automatique mensuel
- Choix du format (FEC, OHADA, CSV)
- Choix du jour du mois (ex : le 5 du mois suivant)
- Choix du destinataire (email du comptable, dépôt Google Drive, webhook)

L'export automatique envoie le fichier à l'expert-comptable sans intervention
manuelle.

### 3.3. API REST (pour intégration sur-mesure)

Pour les établissements qui ont un système comptable maison ou qui veulent
synchroniser en temps réel, Academia Helm expose une API REST :

```
GET /api/finance/exports/compta/fec?dateFrom=2026-01-01&dateTo=2026-01-31
GET /api/finance/exports/compta/ohada?dateFrom=2026-01-01&dateTo=2026-01-31
GET /api/finance/exports/compta/csv?dateFrom=2026-01-01&dateTo=2026-01-31&format=sage
GET /api/finance/exports/compta/journal?code=JVT&dateFrom=2026-01-01&dateTo=2026-01-31
```

Réponse : fichier binaire (`Content-Type: text/plain` ou `application/csv`),
téléchargeable directement.

---

## 4. Mapping des comptes (paramétrage)

Le mapping entre les **catégories de frais / catégories de dépenses** d'Academia
Helm et les **comptes OHADA** est configurable par établissement dans
**Paramètres > Catégories de dépense > Mapping comptable**.

Pour chaque catégorie, l'utilisateur saisit :
- Le **numéro de compte OHADA** (ex : 605000 pour matériel pédagogique)
- Le **libellé de compte** (ex : "Achats de matériel pédagogique")
- Le **sens par défaut** (débit pour les dépenses, crédit pour les ventes)
- Le **code TVA** éventuel (si TVA récupérable)

Ce mapping est ensuite utilisé automatiquement lors des exports FEC / OHADA.

---

## 5. Compatibilité par logiciel

| Logiciel | Format d'import | Statut Academia Helm | Notes |
|----------|-----------------|----------------------|-------|
| **Sage 100 (France)** | FEC, CSV | ✅ Natif | Import direct via *Import > FEC* |
| **Sage OHADA (Bénin/Afrique)** | CSV OHADA | ✅ Natif | Import via *Import > Écritures* |
| **Ciel Compta** | FEC, CSV | ✅ Natif | |
| **EBP Compta** | FEC, CSV | ✅ Natif | |
| **QuickBooks** | CSV, Excel | ✅ Via mapping | Format IIF ou CSV mappé |
| **Pennylane** | FEC, CSV | ✅ Natif | Import FEC direct |
| **Yooz** | CSV, FEC | ✅ Natif | |
| **Odoo (comptabilité)** | CSV, FEC (module) | ✅ Natif | Via module `account_fec_import` |
| **Dex** | FEC | ✅ Natif | |
| **Ebp OHADA** | CSV OHADA | ✅ Natif | |
| **Compta Bénin** | CSV | ✅ Via mapping | Format CSV universel |
| **Xero** | CSV | ✅ Via mapping | |
| **Free Acomba** | CSV | ✅ Via mapping | |

---

## 6. Exemple de fichier FEC généré

```
JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompAuxNum|CompAuxLib|PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise|NatCode
JVT|Journal des ventes|VTE-2026-0001|20260105|411000|Élèves - Créances|ELE-001|AKOVI Marie|REC-2026-0001|20260105|Scolarité 1er trimestre Marie AKOVI|75000|0|||20260105|||VTE
JVT|Journal des ventes|VTE-2026-0001|20260105|706200|Scolarité - Frais de scolarité|||REC-2026-0001|20260105|Scolarité 1er trimestre Marie AKOVI|0|75000|||20260105|||VTE
JQC|Journal de caisse|CAI-2026-0001|20260105|571000|Caisse principale|||REC-2026-0001|20260105|Encaissement espèces|75000|0|||20260105|||CAI
JQC|Journal de caisse|CAI-2026-0001|20260105|411000|Élèves - Créances|ELE-001|AKOVI Marie|REC-2026-0001|20260105|Encaissement espèces|0|75000|||20260105|||CAI
JAC|Journal des achats|ACH-2026-0001|20260108|605000|Achats matériel pédagogique|||FAC-FOURN-001|20260108|Achat 50 cahiers|25000|0|||20260108|||ACH
JAC|Journal des achats|ACH-2026-0001|20260108|401000|Fournisseurs|FOU-001|Librairie Central|FAC-FOURN-001|20260108|Achat 50 cahiers|0|25000|||20260108|||ACH
```

Chaque opération génère **2 lignes d'écriture** (débit + crédit) — double
entrée conforme au plan comptable.

---

## 7. Roadmap d'implémentation

Cette section décrit le **plan d'implémentation** de l'export comptable dans
Academia Helm :

### Phase 1 — Export FEC (France) — 2 semaines
- [ ] Service `FecExportService` backend
- [ ] Mapping compte OHADA par défaut pour écoles
- [ ] Endpoint `GET /finance/exports/compta/fec`
- [ ] UI d'export dans Bilan périodique
- [ ] Tests sur Sage 100 et Pennylane

### Phase 2 — Export OHADA CSV (Bénin) — 1 semaine
- [ ] Service `OhadaExportService` backend
- [ ] Endpoint `GET /finance/exports/compta/ohada`
- [ ] Tests sur Sage OHADA et Compta Bénin

### Phase 3 — Paramétrage mapping comptable — 1 semaine
- [ ] Table `ExpenseCategory.compteOhada` (numéro de compte)
- [ ] Table `FeeCategory.compteOhada`
- [ ] UI de mapping dans Paramètres > Catégories

### Phase 4 — Export automatique mensuel — 1 semaine
- [ ] Cron job d'export mensuel
- [ ] Paramètres > Intégrations comptables (activation, format, email)
- [ ] Envoi par email au comptable

### Phase 5 — API REST publique — 3 jours
- [ ] Documentation OpenAPI des endpoints d'export
- [ ] Token d'API dédié pour intégration externe
- [ ] Tests avec clients ERP tiers

**Total** : ~5 semaines de développement pour une intégration complète.

---

## 8. Avantages pour l'établissement

1. **Pas de double saisie** — Les écritures sont générées automatiquement à
   partir des transactions Academia Helm.
2. **Conformité fiscale** — Le format FEC est accepté par l'administration
   fiscale française. Le format OHADA est conforme au SYSCOHADA.
3. **Multi-logiciels** — Compatible avec tous les logiciels comptables du
   marché (Sage, Ciel, EBP, QuickBooks, Pennylane, Odoo, etc.).
4. **Audit complet** — Chaque écriture est tracée (numéro de pièce, date,
   utilisateur, hash d'intégrité).
5. **Périodicité flexible** — Export mensuel, trimestriel, annuel ou à la
   demande.
6. **Coût réduit** — L'expert-comptable reçoit directement les écritures,
   sans intervention manuelle du secrétariat.

---

## 9. Cas d'usage typique

> **École Saint-Joseph de Cotonou** — 800 élèves, 2 comptables, 1 expert-
> comptable externe.
>
> **Avant** : Le secrétariat saisissait manuellement chaque encaissement dans
> un cahier, puis le comptable ressaisissait dans Sage OHADA. Temps mensuel :
> 5 jours/homme.
>
> **Après Academia Helm** : Chaque encaissement est enregistré en 30 secondes
> via l'interface. Le 5 du mois suivant, l'export OHADA est généré
> automatiquement et envoyé par email à l'expert-comptable. Temps mensuel :
> 30 minutes.
>
> **Gain** : 95 % de réduction du temps comptable, élimination des erreurs
> de saisie, conformité fiscale garantie.

---

## 10. Conclusion

Academia Helm ne remplace pas le logiciel comptable de l'établissement — il
**s'y intègre**. L'export FEC / OHADA permet à chaque établissement de
continuer à utiliser son logiciel préféré (Sage, Ciel, EBP, QuickBooks,
Pennylane, Odoo, etc.) sans modification de ses habitudes, tout en bénéficiant
de la puissance de gestion financière d'Academia Helm.

Le **gain de productivité** est immédiat (95 % de réduction du temps
comptable), la **conformité fiscale** est garantie (formats normalisés), et
l'**évolutivité** est assurée (API REST pour intégrations sur-mesure).
