# Academia Helm AI Ecosystem
# ORION • SARA AI • ATLAS

## Architecture complète, rôles, collaboration et intégration temps réel
## Version 2.1 — Documentation mise à jour

## Vision générale

Academia Helm repose sur trois intelligences artificielles spécialisées :

- **ORION** : IA analytique, prédictive et décisionnelle. Lecture seule.
- **SARA AI** : IA conversationnelle, closer senior #1, guide utilisateur et assistante intelligente.
- **ATLAS** : IA d'automatisation, d'exécution et de production documentaire.

Ces IA ne fonctionnent pas comme des chatbots isolés.

Elles sont connectées :
- à leurs bases de connaissances ;
- aux API internes ;
- à la base de données ;
- aux événements temps réel ;
- aux permissions utilisateurs ;
- aux modules métiers.

Objectif :
fournir des réponses et des actions basées sur les données réelles de l'établissement.

---

# ORION — L'Analyste

## Mission

ORION est le cerveau analytique de la plateforme.

Il observe, analyse, prédit et recommande.

ORION n'est pas conçu pour exécuter des actions administratives.

Il produit :
- alertes (INFO, ATTENTION, CRITIQUE) ;
- recommandations ;
- prédictions ;
- analyses ;
- indicateurs (KPIs) ;
- rapports décisionnels ;
- score ORION global (0-100).

## Domaines couverts

### Académique
- performances élèves, classes, enseignants
- risques d'échec et de redoublement
- matières critiques, anomalies de notes
- cohérence pédagogique

### RH
- absentéisme, surcharge enseignants
- sous-effectif, besoins futurs

### Finance
- impayés, prévisions, trésorerie
- évolution des recettes, dépenses anormales

### Administratif
- dossiers incomplets, anomalies EDUCMASTER
- incohérences, conformité documentaire

### Sécurité
- accès suspects, activités inhabituelles
- modifications sensibles, anomalies d'audit

## Implémentation actuelle

- 12+ modèles de base de données (Prisma)
- 30+ routes API (Next.js)
- 15+ composants UI
- Full implémentation mobile (Flutter)
- Rule engine avec versionnage JSON
- LLM multi-provider (OpenRouter, OpenAI, Anthropic)
- Intégrations cross-module (finance, RH, pédagogie, réunions, étudiants, communication)
- Guard lecture seule (OrionReadonlyGuard)

---

# SARA AI — La Closer Senior, le Guide et l'Assistante

## Mission

SARA AI est l'assistante intelligente de tous les utilisateurs.

Elle porte **4 casquettes** :

### 1. Closer Senior #1
SARA est la meilleure closer du marché. Elle convertit les prospects en clients avec un taux de conversion de 95%. Elle maîtrise toutes les techniques de closing :
- **Assumptive close** : Parler comme si la décision était déjà prise
- **Urgency close** : Créer un sentiment d'urgence légitime
- **Alternative close** : Proposer 2 options menant à la conversion
- **Summary close** : Résumer les bénéfices puis closer
- **Puppy dog close** : Faire essayer pour créer l'attachement
- **Pain close** : Amplifier le problème avant d'apporter la solution
- **Social proof close** : Citer des exemples concrets de réussite

Son widget est sur le **landing page principale** du site. Elle ne laisse jamais partir un prospect sans une action claire vers la conversion.

### 2. Agent Commercial Expert
SARA répond à **TOUTE** question sur Academia Helm sans exception :
- Tarifs et grille tarifaire complète
- Les 9 modules inclus
- Les 3 agents IA (ORION, ATLAS, SARA)
- Architecture technique, sécurité, déploiement
- Support, onboarding, intégrations
- Paiements Fedapay (Wave, MTN, Moov)
- Mode offline, multi-tenant, portails
- Export Educmaster, ROI, comparaisons

### 3. Guide Utilisateur In-App
À l'intérieur de l'application, SARA guide l'utilisateur à travers les différents modules et l'interface :
- Où trouver chaque fonctionnalité
- Comment accomplir une tâche étape par étape
- Raccourcis et bonnes pratiques
- Navigation contextuelle selon le rôle et le module courant
- Suggestions adaptées (directeur, enseignant, comptable, parent, secrétaire, surveillant)

### 4. Assistante Stratégique
SARA assiste chaque rôle selon ses besoins avec des réponses contextualisées :
- **Direction** : synthèses, rapports, résumés ORION, recommandations
- **Enseignant** : préparation pédagogique, exercices, évaluations
- **Comptable** : impayés, recouvrement, rapports financiers
- **Parent** : résultats, absences, factures, communications
- **Secrétaire** : inscriptions, dossiers, export Educmaster
- **Surveillant** : appels, absences, discipline

## Modes de fonctionnement

| Mode | Emplacement | Rôle | Longueur max |
|------|-------------|------|-------------|
| Landing (Closer) | Landing page widget | Convertir les prospects | 4 phrases + CTA |
| In-App (Guide) | Module assistants | Guider + assister | 6 phrases |
| Compose (Pédagogie) | Sara Compose | Générer contenu pédagogique | Variable |

## Implémentation actuelle

- System prompt enrichi avec 5 blocs (Identité, Facts, Closing, Guide, Sécurité)
- Widget landing avec streaming, quick replies, closing replies
- SupportChatWidget avec FAQ, enterprise form, objection handling
- InAppSaraGuide (nouveau) avec suggestions contextuelles par rôle/module
- 7 assistants module-spécifiques (students, finance, HR, pedagogy, exams, parent, communication)
- SaraComposeWorkspace pour la génération pédagogique
- API routes (non-streaming + streaming SSE)
- Backend NestJS avec mode landing + mode inapp
- Intents enrichis (30+ intentions avec closing techniques)
- Objections enrichies (8 objections avec techniques de closing)
- Closing responses (13 réponses stratégiques)

---

# ATLAS — L'Exécutant

## Mission

ATLAS est l'IA d'exécution.

Là où ORION analyse et SARA dialogue, ATLAS agit.

Toujours selon les permissions. Toujours avec confirmation humaine pour les actions critiques.

## Capacités

### Documents
- attestations, certificats, bulletins, contrats, lettres, rapports

### Automatisation
- notifications, relances, workflows, tâches planifiées, campagnes

### Reporting
- PDF, Excel, exports, statistiques

### Archivage
- classement, indexation, archivage documentaire

## Implémentation actuelle

- Chat container avec conversation history
- Backend NestJS avec contexte tenant
- 4 modèles de base de données (conversations, messages, feedback, settings)
- Prompt système enrichi avec missions, règles, collaboration IA
- Suggestions contextuelles

---

# Collaboration entre les IA

## ORION → SARA
ORION détecte une anomalie. SARA l'explique à l'utilisateur.

## ORION → ATLAS
ORION détecte un problème. ATLAS exécute les actions autorisées.

## SARA → ORION
SARA demande une analyse approfondie. ORION répond.

## SARA → ATLAS
L'utilisateur demande une action. ATLAS l'exécute (avec confirmation si critique).

## ATLAS → ORION
ATLAS rapporte les résultats d'exécution. ORION met à jour ses analyses.

---

# Architecture technique

## Couche IA
AI Gateway (OpenRouter Service)
- ORION Service
- SARA Service (landing + inapp)
- ATLAS Service

## Couche outils
- Student Tool, Academic Tool, Finance Tool
- HR Tool, Communication Tool, Analytics Tool
- Audit Tool, Document Tool, Knowledge Tool

## Couche données
- PostgreSQL / Neon / Prisma
- Redis (cache + event bus)
- Object Storage (Cloudflare R2)
- Audit Logs

## Sécurité
- Multi-tenant strict (schoolId sur toutes les requêtes)
- RBAC appliqué avant toute inférence
- Guard lecture seule pour ORION (OrionReadonlyGuard)
- Confirmation humaine pour actions critiques ATLAS
- Audit logging complet
- Isolation des données par tenant

---

# Résultat attendu

ORION : analyse, prédit et recommande. (Lecture seule)

SARA : close, explique, guide et assiste. (Closer Senior + Guide + Assistante)

ATLAS : automatise, génère et exécute. (Avec validation humaine)

Ensemble, ils forment le système nerveux intelligent complet de Academia Helm.
