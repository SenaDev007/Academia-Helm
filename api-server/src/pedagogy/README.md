# MODULE 2 — SYSTÈME DE WORKFLOW PÉDAGOGIQUE

## 🎯 Vue d'ensemble

Système complet de workflow pédagogique avec espaces distincts **enseignant ↔ direction**, permettant la gestion structurée des documents pédagogiques avec validation, commentaires, notifications et traçabilité complète.

---

## 🏗️ Architecture

### Espaces distincts

- **Espace Enseignant** : Création, modification, soumission des documents
- **Espace Direction** : Réception, validation/rejet, commentaires, historique

### Sous-modules

1. **Fiches pédagogiques** - Plans de cours structurés
2. **Cahiers journaux** - Planification quotidienne/hebdomadaire
3. **Cahiers de textes** - Compte-rendu après cours (pas de rejet)
4. **Cahier du semainier** - Suivi hebdomadaire avec rotation auto/manuelle

---

## 📦 Schéma Prisma (9 modèles)

### `PedagogicalDocument`
Document unifié pour tous les types pédagogiques :
- Types : `FICHE_PEDAGOGIQUE` | `CAHIER_JOURNAL` | `CAHIER_TEXTE` | `SEMAINIER`
- Statuts : `DRAFT` → `SUBMITTED` → `APPROVED`/`REJECTED`/`ACKNOWLEDGED`

### `PedagogicalDocumentVersion`
Historisation complète des versions pour traçabilité.

### `PedagogicalDocumentReview`
Reviews/validations par la direction avec commentaires par section.

### `PedagogicalDocumentComment`
Commentaires bidirectionnels enseignant ↔ direction.

### `PedagogicalDocumentNotification`
Notifications événementielles avec tracking SMS/WhatsApp/Email.

### `WeeklyDutyAssignment`
Désignation du semainier avec mode AUTO (rotation) ou MANUAL.

### `WeeklySemainier`
Contenu du cahier du semainier avec statuts : `EN_COURS` → `SOUMIS` → `VALIDATED`.

### `WeeklySemainierDailyEntry`
Entrées quotidiennes pour traçabilité jour par jour.

### `WeeklySemainierIncident`
Incidents enregistrés avec escalade automatique vers QHSE si critique.

---

## 🔄 Workflow

### Fiches pédagogiques & Cahiers journaux

```
DRAFT → SOUMIS (enseignant) → APPROVED/REJECTED (direction)
                                   ↓
                            REJECTED → DRAFT (modification possible)
```

### Cahier de textes

```
DRAFT → SOUMIS → ACKNOWLEDGED (pas de rejet, seulement prise en compte)
```

### Cahier du semainier

```
EN_COURS → SOUMIS (fin de semaine) → VALIDATED (direction)
```

---

## 🔧 Services NestJS (5 services)

### `PedagogicalDocumentService`
- CRUD complet des documents
- Filtrage par type, statut, classe, matière
- Statistiques par enseignant
- Documents soumis (direction)

### `PedagogicalWorkflowService`
- Soumission à la direction
- Validation/Rejet avec motif obligatoire
- Prise en compte (cahier de textes)
- Commentaires bidirectionnels
- Historique des versions
- Reviews traçables

### `PedagogicalNotificationService`
- Notifications événementielles automatiques
- SMS/WhatsApp/Email (structure prête pour intégration)
- Notifications à soumission (direction)
- Notifications après validation/rejet (enseignant)
- Notifications commentaires

### `WeeklySemainierService`
- Désignation automatique (rotation circulaire)
- Désignation manuelle (par directeur)
- Création/mise à jour du semainier
- Entrées quotidiennes
- Signalement d'incidents
- Soumission en fin de semaine
- Validation direction

### `PedagogyOrionService`
- KPIs pédagogiques (taux de soumission, validation, rejet)
- Statistiques par type et par enseignant
- Statistiques semainier et incidents
- 7 alertes ORION avec recommandations

---

## 🌐 Controllers REST (3 controllers)

### `PedagogicalTeacherController` - Espace Enseignant

**Documents pédagogiques :**
- `POST /api/pedagogy/teacher/documents` - Créer
- `GET /api/pedagogy/teacher/documents` - Liste (avec filtres)
- `GET /api/pedagogy/teacher/documents/:id` - Détails
- `PUT /api/pedagogy/teacher/documents/:id` - Modifier (DRAFT uniquement)
- `DELETE /api/pedagogy/teacher/documents/:id` - Supprimer (DRAFT uniquement)
- `POST /api/pedagogy/teacher/documents/:id/submit` - Soumettre
- `GET /api/pedagogy/teacher/documents/:id/comments` - Commentaires
- `POST /api/pedagogy/teacher/documents/:id/comments` - Ajouter commentaire
- `GET /api/pedagogy/teacher/documents/:id/versions` - Historique
- `GET /api/pedagogy/teacher/documents/stats` - Statistiques

**Cahier du semainier :**
- `GET /api/pedagogy/teacher/semainier/current` - Semainier actuel
- `POST /api/pedagogy/teacher/semainier` - Créer/mettre à jour
- `POST /api/pedagogy/teacher/semainier/:id/daily-entries` - Entrée quotidienne
- `POST /api/pedagogy/teacher/semainier/:id/incidents` - Signaler incident
- `POST /api/pedagogy/teacher/semainier/:id/submit` - Soumettre

**Notifications :**
- `GET /api/pedagogy/teacher/notifications` - Non lues
- `PUT /api/pedagogy/teacher/notifications/:id/read` - Marquer comme lu

### `PedagogicalDirectorController` - Espace Direction

**Réception & contrôle :**
- `GET /api/pedagogy/director/documents/submitted` - Documents soumis (avec filtres)
- `GET /api/pedagogy/director/documents/:id` - Détails
- `POST /api/pedagogy/director/documents/:id/approve` - Valider
- `POST /api/pedagogy/director/documents/:id/reject` - Rejeter (motif obligatoire)
- `POST /api/pedagogy/director/documents/:id/acknowledge` - Prendre en compte (cahier de textes)
- `GET /api/pedagogy/director/documents/:id/comments` - Commentaires
- `POST /api/pedagogy/director/documents/:id/comments` - Ajouter commentaire
- `GET /api/pedagogy/director/documents/:id/reviews` - Reviews/validations
- `GET /api/pedagogy/director/documents/:id/versions` - Historique
- `GET /api/pedagogy/director/documents/stats` - Statistiques

**Gestion semainier :**
- `POST /api/pedagogy/director/semainier/assign/auto` - Désignation auto
- `POST /api/pedagogy/director/semainier/assign/manual` - Désignation manuelle
- `GET /api/pedagogy/director/semainier/submitted` - Semainiers soumis
- `POST /api/pedagogy/director/semainier/:id/validate` - Valider

**Notifications :**
- `GET /api/pedagogy/director/notifications` - Non lues
- `PUT /api/pedagogy/director/notifications/:id/read` - Marquer comme lu

### `PedagogyOrionController` - ORION

- `GET /api/pedagogy/orion/kpis` - KPIs pédagogiques complets
- `GET /api/pedagogy/orion/alerts` - Alertes ORION

---

## 🔔 Notifications Événementielles

### Déclencheurs automatiques

1. **Soumission enseignant** → SMS/WhatsApp à la direction
2. **Validation direction** → SMS/WhatsApp à l'enseignant
3. **Rejet direction** → SMS/WhatsApp à l'enseignant (avec motif)
4. **Prise en compte** → SMS/WhatsApp à l'enseignant (cahier de textes)
5. **Nouveau commentaire** → Notification bidirectionnelle

### Canaux

- **SMS** : Structure prête pour intégration (Twilio, Vonage, etc.)
- **WhatsApp** : Structure prête pour intégration (WhatsApp Business API)
- **Email** : Structure prête pour intégration (SendGrid, AWS SES, etc.)
- **In-app** : Notifications internes avec flag `inAppRead`

### Tracking

Chaque notification est tracée dans `PedagogicalDocumentNotification` avec :
- `smsSent`, `smsSentAt`
- `whatsappSent`, `whatsappSentAt`
- `emailSent`, `emailSentAt`
- `inAppRead`, `inAppReadAt`

---

## 🧠 Intégration ORION

### KPIs Générés

**Documents pédagogiques :**
- Total documents
- Taux de soumission
- Taux de validation
- Taux de rejet
- Statistiques par type
- Statistiques par enseignant

**Cahier du semainier :**
- Total semainiers
- Taux de validation
- Total incidents
- Incidents critiques
- Taux d'incidents

### Alertes ORION (7 types)

1. **Retards de soumission** (MEDIUM)
   - Documents en DRAFT depuis > 7 jours

2. **Taux de rejet élevé** (HIGH)
   - > 30% de documents rejetés

3. **Enseignants non conformes** (HIGH)
   - > 50% de documents rejetés par enseignant

4. **Surcharge pédagogique** (MEDIUM)
   - Enseignants avec > 20 documents

5. **Incidents récurrents** (MEDIUM)
   - Types d'incidents répétés (≥ 5 occurrences)

6. **Semainiers non soumis** (LOW)
   - Semainiers non soumis après fin de semaine

7. **Documents non traités** (HIGH)
   - Documents soumis depuis > 5 jours non traités

Chaque alerte inclut :
- Sévérité (CRITICAL, HIGH, MEDIUM, LOW)
- Catégorie
- Description
- Recommandation automatique
- Compteur

---

## 🔐 Règles Métier

### Multi-tenant
- Tous les modèles incluent `tenantId`
- Isolation stricte entre établissements

### Année scolaire & Niveau
- `academicYearId` obligatoire
- `schoolLevelId` obligatoire
- Historique préservé par année

### Statuts & Validations
- ❌ Modification impossible si statut ≠ DRAFT
- ❌ Suppression impossible si statut ≠ DRAFT
- ❌ Rejet impossible sans motif obligatoire
- ❌ Validation impossible si document non soumis
- ✅ Cahier de textes : pas de rejet, seulement prise en compte

### Traçabilité
- ✅ Historique complet des versions
- ✅ Reviews/validations traçables
- ✅ Commentaires horodatés
- ✅ Notifications tracées
- ✅ Aucune suppression destructive

### RBAC (Role-Based Access Control)
- **Enseignant** : Accès uniquement à ses documents
- **Direction** : Accès à tous les documents soumis
- **Admin** : Accès complet

---

## 🎨 Cahier du Semainier

### Désignation automatique
- Rotation circulaire entre enseignants actifs
- Calcul automatique du prochain enseignant
- Pas de conflit (un seul semainier actif par semaine)

### Désignation manuelle
- Par directeur ou admin
- Motif obligatoire si changement exceptionnel
- Désactive automatiquement l'assignation auto si existante

### Contenu structuré
- Entrées quotidiennes (observations, actions, événements)
- Incidents signalés (absences, retards, discipline, sécurité)
- Séverité des incidents (LOW, MEDIUM, HIGH, CRITICAL)
- Escalade automatique vers QHSE si incident critique

### Workflow
- **EN_COURS** : Semainier en cours de remplissage
- **SOUMIS** : Soumission en fin de semaine
- **VALIDATED** : Validation par la direction

---

## 📊 Statistiques

### Par enseignant
- Nombre total de documents
- Documents soumis
- Documents validés/rejetés
- Taux de conformité

### Par type de document
- Fiches pédagogiques
- Cahiers journaux
- Cahiers de textes
- Semainiers

### Par période
- Statistiques mensuelles
- Statistiques trimestrielles
- Comparaison année en cours vs précédente

---

## 🚀 Utilisation

### Pour les enseignants

1. **Créer un document** : `POST /api/pedagogy/teacher/documents`
2. **Modifier** (si DRAFT) : `PUT /api/pedagogy/teacher/documents/:id`
3. **Soumettre** : `POST /api/pedagogy/teacher/documents/:id/submit`
4. **Consulter commentaires** : `GET /api/pedagogy/teacher/documents/:id/comments`
5. **Ajouter commentaire** : `POST /api/pedagogy/teacher/documents/:id/comments`

### Pour la direction

1. **Voir documents soumis** : `GET /api/pedagogy/director/documents/submitted`
2. **Valider** : `POST /api/pedagogy/director/documents/:id/approve`
3. **Rejeter** (avec motif) : `POST /api/pedagogy/director/documents/:id/reject`
4. **Prendre en compte** : `POST /api/pedagogy/director/documents/:id/acknowledge`
5. **Désigner semainier** : `POST /api/pedagogy/director/semainier/assign/auto` ou `/assign/manual`

---

## 📋 Prochaines Étapes

1. **Générer les migrations** : `npx prisma migrate dev`
2. **Intégrer service SMS/WhatsApp réel** : Modifier `PedagogicalNotificationService`
3. **Créer UI frontend** : Pages enseignant et direction
4. **Tester le workflow** : Scénarios complets
5. **Configurer la rotation automatique** : Job cron pour désignation hebdomadaire

---

## 🔗 Intégrations

### Communication Module
- Structure prête pour SMS/WhatsApp/Email
- À connecter avec le service de communication réel

### QHSE Module
- Escalade automatique des incidents critiques
- Lien avec le module QHSE pour suivi

### ORION Module
- KPIs et alertes intégrés
- Dashboards ORION avec insights pédagogiques

---

## 📚 Références

- [Prisma Documentation](https://www.prisma.io/docs)
- [NestJS Documentation](https://docs.nestjs.com)
- [ORION Module Documentation](../orion/README.md)

