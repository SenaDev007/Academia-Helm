Dawes, [01/06/2026 16:16]
ACADEMIA HELM

MODULE RH ENTERPRISE

TOME 1 — VISION PRODUIT ET CAHIER DES CHARGES MÉTIER

Version : 1.0

Statut : Spécification Fonctionnelle

---

1. PRÉSENTATION GÉNÉRALE

1.1 Contexte

Les établissements scolaires, universitaires, entreprises privées, organisations publiques et groupes multisites rencontrent des difficultés importantes dans la gestion du recrutement :

- Volume élevé de candidatures
- Analyse manuelle chronophage
- Risque d'erreurs humaines
- Difficulté à identifier les meilleurs profils
- Absence de standardisation des évaluations
- Mauvaise traçabilité du processus de recrutement

Le module RH d'Academia Helm a pour objectif de digitaliser et d'automatiser l'ensemble du cycle de recrutement grâce à une combinaison de workflows métier et d'intelligence artificielle.

---

2. OBJECTIFS DU MODULE

2.1 Objectif Principal

Permettre aux institutions et entreprises de :

- Publier des offres d'emploi
- Recevoir des candidatures
- Analyser automatiquement les dossiers
- Évaluer les candidats
- Organiser les entretiens
- Prendre des décisions éclairées
- Constituer une base de talents

---

2.2 Objectifs Spécifiques

Automatisation

Réduire de 80 % le temps consacré à la présélection des candidatures.

Qualité

Améliorer la pertinence des recrutements grâce au scoring intelligent.

Traçabilité

Conserver l'historique complet des décisions de recrutement.

Intelligence

Fournir des recommandations basées sur l'IA.

Conformité

Garantir un processus de recrutement transparent et auditable.

---

3. POSITIONNEMENT PRODUIT

Le module RH d'Academia Helm n'est pas un ATS classique.

Il est positionné comme une plateforme d'intelligence du recrutement intégrant :

- ATS
- IA d'analyse documentaire
- IA de matching
- IA d'entretien
- IA d'aide à la décision

Nom interne :

Helm Talent Intelligence Platform (HTIP)

---

4. PERSONAS

4.1 Super Administrateur

Responsabilités :

- Paramétrage global
- Gestion multi-tenant
- Gouvernance

Besoins :

- Contrôle total
- Reporting global

---

4.2 Directeur RH

Responsabilités :

- Validation des recrutements
- Pilotage RH

Besoins :

- Vision consolidée
- Tableaux de bord

---

4.3 Recruteur

Responsabilités :

- Publication des offres
- Analyse des candidatures
- Préqualification

Besoins :

- Gain de temps
- Automatisation

---

4.4 Manager Recruteur

Responsabilités :

- Validation métier

Besoins :

- Évaluation technique
- Comparaison des candidats

---

4.5 Candidat

Responsabilités :

- Déposer sa candidature

Besoins :

- Simplicité
- Transparence
- Suivi de dossier

---

5. PÉRIMÈTRE FONCTIONNEL

Le module doit couvrir :

Gestion des Offres

- Création
- Validation
- Publication
- Archivage

Gestion des Candidatures

- Réception
- Classement
- Historisation

Analyse IA

- CV
- Lettres
- Diplômes
- Certifications

Évaluation

- Matching
- Scoring
- Ranking

Entretiens

- Planification
- Évaluation
- Historique

Décision

- Validation
- Rejet
- Embauche

---

6. PROCESSUS MÉTIER GLOBAL

Étape 1
Création de l'offre

Étape 2
Validation hiérarchique

Étape 3
Publication

Étape 4
Réception des candidatures

Étape 5
Analyse IA

Étape 6
Scoring

Étape 7
Classement

Étape 8
Entretien RH

Étape 9
Entretien Technique

Étape 10
Décision finale

Étape 11
Signature

Étape 12
Intégration collaborateur

---

7. INDICATEURS DE PERFORMANCE

KPI Recrutement

- Nombre de candidatures reçues
- Nombre de recrutements
- Délai moyen de recrutement
- Coût moyen de recrutement
- Taux d'acceptation des offres

KPI IA

- Précision du matching
- Temps moyen d'analyse
- Taux de détection d'incohérences
- Taux d'automatisation

---

8. EXIGENCES NON FONCTIONNELLES

Disponibilité :
99,9 %

Temps de réponse :
< 2 secondes

Temps d'analyse IA :
< 10 secondes

Architecture :
Multi-tenant

Scalabilité :
10 000 à 1 000 000 candidats

Sécurité :
Niveau entreprise

Auditabilité :
100 %

---

9. CRITÈRES DE SUCCÈS

Le projet sera considéré comme réussi lorsque :

- 90 % des candidatures seront analysées automatiquement
- Le temps de présélection sera réduit d'au moins 70 %
- Les recruteurs disposeront

Dawes, [01/06/2026 16:16]
d'un classement fiable des candidats
- Les décisions seront entièrement traçables
- Les rapports RH seront générés automatiquement

FIN DU TOME 1

Dawes, [01/06/2026 16:16]
ACADEMIA HELM

MODULE RH ENTERPRISE

TOME 2 — ARCHITECTURE FONCTIONNELLE DÉTAILLÉE

Version : 1.0

Statut : Spécification Fonctionnelle Détaillée

---

1. OBJECTIF DU TOME

Ce document décrit l'ensemble des fonctionnalités métier du module RH, les parcours utilisateurs, les règles de gestion, les workflows et les interfaces fonctionnelles.

Il constitue la référence principale pour :

- Les Product Owners
- Les UX/UI Designers
- Les Développeurs Frontend
- Les Développeurs Backend
- Les Équipes QA

---

2. ARBORESCENCE DU MODULE RH

RH
├── Tableau de bord
├── Recrutement
│ ├── Offres d'emploi
│ ├── Candidatures
│ ├── Pipeline
│ ├── Entretiens
│ ├── Tests
│ ├── Embauches
│ └── Base de talents
│
├── Collaborateurs
│ ├── Personnel
│ ├── Contrats
│ ├── Affectations
│ ├── Historique
│ └── Organigramme
│
├── IA RH
│ ├── Analyse CV
│ ├── Analyse Lettres
│ ├── Matching
│ ├── Classement
│ ├── Détection Fraude
│ └── Copilote RH
│
├── Rapports
│
└── Paramètres

---

3. TABLEAU DE BORD RH

Objectif

Fournir une vue consolidée de l'activité RH.

---

Widgets

Recrutement

- Offres actives
- Offres clôturées
- Nombre de candidatures
- Entretiens programmés
- Embauches du mois

---

IA

- CV analysés
- Lettres analysées
- Matching effectués
- Alertes fraude
- Score moyen des candidats

---

Performance

- Temps moyen recrutement
- Taux de conversion
- Coût de recrutement
- Délai moyen d'embauche

---

4. MODULE OFFRES D'EMPLOI

Écran Liste des Offres

Colonnes :

- Référence
- Poste
- Département
- Localisation
- Date création
- Date clôture
- Nombre candidats
- Statut

Actions :

- Créer
- Modifier
- Dupliquer
- Publier
- Clôturer
- Archiver

---

États d'une Offre

BROUILLON

EN VALIDATION

VALIDÉE

PUBLIÉE

SUSPENDUE

CLÔTURÉE

ARCHIVÉE

---

Création d'une Offre

Informations Générales

- Référence
- Intitulé
- Département
- Responsable

Détails

- Description
- Missions
- Responsabilités

Profil Recherché

- Niveau académique
- Expérience
- Compétences requises
- Certifications

Conditions

- Salaire
- Contrat
- Localisation

---

5. MODULE CANDIDATURES

Vue Liste

Filtres :

- Poste
- Département
- Score IA
- Date
- Statut
- Sexe
- Niveau d'étude

---

Fiche Candidat

Onglet Identité

- Nom
- Prénoms
- Téléphone
- Email
- Adresse

---

Onglet Documents

- CV
- Lettre motivation
- Lettre demande
- Diplômes
- Certificats

---

Onglet IA

- Score CV
- Score Lettre
- Score Matching
- Risques détectés

---

Onglet Historique

- Date dépôt
- Actions RH
- Entretiens
- Décisions

---

6. PIPELINE DE RECRUTEMENT

Vue Kanban.

Colonnes :

NOUVEAU

ANALYSE IA

PRÉSÉLECTIONNÉ

ENTRETIEN RH

ENTRETIEN TECHNIQUE

TEST

VALIDATION

OFFRE

EMBAUCHÉ

REJETÉ

---

Actions Drag & Drop

Chaque déplacement :

- Journalisé
- Horodaté
- Auditable

---

7. MODULE ENTRETIENS

Création Entretien

Type :

- RH
- Technique
- Direction
- Panel

---

Planification

- Date
- Heure
- Salle
- Visioconférence

---

Évaluation

Critères :

- Communication
- Leadership
- Expertise
- Motivation
- Adéquation culturelle

Score :

0 à 100

---

8. MODULE TESTS

Types

- Technique
- Psychotechnique
- Aptitude
- Langue

---

Modes

- Manuel
- IA
- QCM
- Cas pratique

---

Résultats

- Score
- Classement
- Analyse IA

---

9. MODULE BASE DE TALENTS

Objectif

Conserver les candidats qualifiés.

---

Fonctionnalités

- Recherche avancée
- Classement
- Segmentation
- Réactivation

---

Filtres

- Métier
- Compétence
- Expérience
- Région
- Disponibilité

---

10. MODULE IA RH

Sous-Module Analyse CV

Bouton :

ANALYSER LE CV

Résultat :

- Compétences détectées
- Expériences détectées
- Formation détectée
- Forces
- Faiblesses

---

Sous-Module Analyse Lettre

Analyse :

- Qualité rédactionnelle
- Cohérence
- Pertinence
- Motivation

---

Sous-Module Matching

Affichage :

Compatibilité :

0 à 100 %

---

Sous-Module Ranking

Classement automatique :

Top 10

Top 20

Top 50

---

Sous-Module Détection Fraude

Alertes :

Niveau Faible

Niveau Moyen

Niveau Élevé

---

Sous-Module Copilote RH

Questions possibles :

"Quels sont les meilleurs candidats ?"

"Pourquoi ce candida

Dawes, [01/06/2026 16:16]
t est-il classé premier ?"

"Prépare un entretien pour ce poste."

"Résume ce dossier."

---

11. MODULE EMBAUCHE

Création Offre d'Emploi

Informations :

- Poste
- Salaire
- Date entrée

---

Validation

Workflow :

Manager

→ RH

→ Direction

---

Transformation

Candidat

→ Collaborateur

---

12. NOTIFICATIONS

Email

SMS

WhatsApp

Push

---

Événements :

- Nouvelle candidature
- Entretien programmé
- Changement statut
- Validation
- Rejet

---

13. RAPPORTS

Recrutement

- Embauches
- Candidatures
- Délais

---

IA

- Scores
- Matching
- Alertes

---

Export

PDF

Excel

CSV

---

14. PARAMÈTRES

Paramètres RH

- Départements
- Postes
- Contrats
- Échelles salariales

---

Paramètres IA

- Pondérations scoring
- Seuils matching
- Seuils fraude

---

15. RÈGLES MÉTIER CRITIQUES

RM-001

Une candidature ne peut être supprimée après analyse.

---

RM-002

Toute décision doit être historisée.

---

RM-003

Tout score IA doit être explicable.

---

RM-004

Toute modification de statut doit être auditée.

---

RM-005

Un candidat rejeté peut être intégré à la base de talents.

---

FIN DU TOME 2

Dawes, [01/06/2026 16:16]
ACADEMIA HELM

MODULE RH ENTERPRISE

TOME 3 — HELM DOCUMENT INTELLIGENCE ENGINE (HDIE)

Version : 1.0

Statut : Architecture IA et Intelligence Documentaire

---

1. PRÉSENTATION DU HDIE

1.1 Définition

Le Helm Document Intelligence Engine (HDIE) est le moteur d'intelligence artificielle du module RH d'Academia Helm.

Son objectif est d'analyser automatiquement tous les documents de candidature afin de :

- Comprendre le profil du candidat
- Évaluer sa pertinence
- Détecter les incohérences
- Générer un score objectif
- Aider à la prise de décision

---

1.2 Documents Pris en Charge

CV

Formats :

- PDF
- DOCX
- DOC
- JPG
- PNG

---

Lettres

- Lettre de motivation
- Lettre de demande d'emploi
- Lettre de recommandation

---

Diplômes

- Diplômes universitaires
- Diplômes professionnels
- Attestations

---

Certifications

- Techniques
- Académiques
- Professionnelles

---

2. ARCHITECTURE GLOBALE DU HDIE

Pipeline :

Document Upload

↓

OCR Engine

↓

Document Classification Engine

↓

Document Parsing Engine

↓

Skills Intelligence Engine

↓

Candidate Intelligence Engine

↓

Matching Engine

↓

Fraud Detection Engine

↓

Ranking Engine

↓

AI Report Generator

---

3. OCR ENGINE

Mission

Convertir les documents scannés en texte exploitable.

---

Sources

PDF Image

JPG

PNG

TIFF

---

Sorties

Texte brut

Confiance OCR

Structure détectée

---

KPI

Précision minimale :

90 %

Objectif :

95 %

---

4. DOCUMENT CLASSIFICATION ENGINE

Mission

Identifier automatiquement le type de document.

---

Catégories

CV

LETTRE_MOTIVATION

LETTRE_DEMANDE

DIPLOME

CERTIFICATION

RECOMMANDATION

AUTRE

---

Résultat

{
"type":"CV",
"confidence":98.5
}

---

5. CV PARSING ENGINE

Mission

Transformer un CV en données structurées.

---

Informations Personnelles

Extraction :

- Nom
- Prénoms
- Sexe
- Date naissance
- Nationalité

---

Coordonnées

- Téléphone
- Email
- Adresse
- LinkedIn
- Portfolio

---

Formation

Extraction :

- Diplôme
- Établissement
- Année
- Mention

---

Expérience

Extraction :

- Entreprise
- Fonction
- Date début
- Date fin
- Durée

---

Compétences

Extraction :

- Techniques
- Fonctionnelles
- Soft Skills

---

Langues

Extraction :

- Langue
- Niveau

---

Certifications

Extraction :

- Nom
- Organisme
- Date

---

6. LETTER INTELLIGENCE ENGINE

Mission

Analyser les lettres de candidature.

---

Analyse Structurelle

Contrôle :

- Objet
- Introduction
- Développement
- Conclusion
- Signature

---

Analyse Linguistique

Mesures :

- Orthographe
- Grammaire
- Syntaxe

---

Analyse Sémantique

Évaluation :

- Motivation
- Cohérence
- Pertinence

---

Analyse de Personnalisation

Mesure :

- Adaptation au poste
- Référence à l'entreprise
- Mise en valeur du profil

---

Score Final

0 à 100

---

7. SKILLS INTELLIGENCE ENGINE

Mission

Construire une cartographie des compétences.

---

Types

Hard Skills

Exemples :

- Java
- React
- Flutter
- SQL

---

Soft Skills

Exemples :

- Leadership
- Communication
- Gestion d'équipe

---

Classification

Débutant

Intermédiaire

Avancé

Expert

---

Normalisation

Exemple :

JS

JavaScript

ECMAScript

⇒ JavaScript

---

8. CANDIDATE INTELLIGENCE ENGINE

Mission

Créer un profil unifié du candidat.

---

Données Agrégées

CV

+ 

Lettres

+ 

Diplômes

+ 

Certifications

+ 

Historique

---

Résultat

Candidate Profile 360°

---

9. MATCHING ENGINE

Mission

Comparer le candidat à une offre.

---

Facteurs

Compétences

Expérience

Formation

Certifications

Localisation

Langues

Lettre

---

Pondérations Par Défaut

Compétences :

40 %

Expérience :

25 %

Formation :

15 %

Certifications :

10 %

Lettre :

10 %

---

Calcul

Score final :

0 à 100

---

Catégories

95-100

Exceptionnel

90-94

Excellent

80-89

Très Bon

70-79

Bon

60-69

Acceptable

<60

Faible

---

10. FRAUD DETECTION ENGINE

Mission

Identifier les incohérences.

---

Vérifications

Chronologie

Exemple :

Expérience débutée avant l'obtention du diplôme.

---

Durées

Chevauchements impossibles.

---

Diplômes

Diplômes non cohérents.

---

Certifications

Dates invalides.

---

Dawes, [01/06/2026 16:16]
Documents

Copies multiples.

---

Niveau Risque

Faible

Moyen

Élevé

Critique

---

11. RANKING ENGINE

Mission

Classer automatiquement les candidats.

---

Classement

Top 10

Top 20

Top 50

Top 100

---

Méthodes

Score IA

Score Entretien

Score Tests

Score Global

---

12. AI REPORT GENERATOR

Mission

Produire des rapports RH exploitables.

---

Rapport Candidat

Contenu :

Résumé exécutif

Compétences

Forces

Faiblesses

Risques

Recommandation

---

Rapport Comparatif

Comparaison :

Candidat A

vs

Candidat B

---

Rapport Poste

Analyse globale des candidatures.

---

13. RECRUITMENT COPILOT

Mission

Assistant IA RH conversationnel.

---

Capacités

Analyse CV

Analyse Lettre

Comparaison

Préparation entretien

Résumé dossier

Aide décision

---

Exemples

"Analyse ce candidat."

"Prépare un entretien technique."

"Pourquoi ce candidat est-il premier ?"

"Compare les cinq meilleurs profils."

---

14. EXPLAINABLE AI (XAI)

Objectif

Tous les scores doivent être explicables.

---

Exemple

Score : 91/100

Détail :

Compétences :

38/40

Expérience :

22/25

Formation :

14/15

Certifications :

8/10

Lettre :

9/10

---

15. PERFORMANCE

Analyse CV :

< 5 secondes

Analyse Lettre :

< 3 secondes

Matching :

< 2 secondes

Classement :

< 2 secondes

---

16. OBJECTIFS QUALITÉ

Précision OCR :

≥ 95 %

Précision Parsing :

≥ 95 %

Précision Matching :

≥ 90 %

Disponibilité :

99,9 %

---

17. FEUILLE DE ROUTE IA

Version 1

Analyse documentaire

---

Version 2

Matching avancé

---

Version 3

Prédiction réussite candidat

---

Version 4

Détection avancée fraude

---

Version 5

Recruteur IA autonome

---

18. EXTENSION SPÉCIFIQUE ACADEMIA HELM

Academic Recruitment Intelligence

Analyse spécifique :

- Enseignants
- Formateurs
- Directeurs d'école
- Personnel administratif

---

Vérifications

- Diplômes pédagogiques
- Expériences académiques
- Certifications enseignement

---

Score Pédagogique

Indicateur exclusif Academia Helm.

---

FIN DU TOME 3

Dawes, [01/06/2026 16:18]
ions possibles :

Analyse ce CV.

Compare ces candidats.

Prépare un entretien.

Quels sont les meilleurs profils ?

Pourquoi ce candidat est-il classé premier ?

Qui présente le moins de risques ?

Quels candidats possèdent des compétences similaires ?

---

11. RAPPORTS GÉNÉRÉS

Rapport Candidat

Résumé.

Forces.

Faiblesses.

Risques.

Recommandation.

---

Rapport Comparatif

Comparaison multicritères.

---

Rapport Recrutement

Vue consolidée.

---

Rapport Direction

Synthèse exécutive.

---

12. WORKFLOWS IA

Workflow Analyse Candidat

Upload dossier

↓

Analyse documentaire

↓

Extraction données

↓

Scoring

↓

Rapport IA

↓

Validation RH

---

Workflow Entretien

Sélection candidat

↓

Analyse profil

↓

Génération questions

↓

Conduite entretien

↓

Évaluation

↓

Décision

---

13. EXPLAINABLE AI

Chaque recommandation doit être explicable.

---

Exemple :

Pourquoi le candidat est-il classé premier ?

Réponse :

- Expérience supérieure à la moyenne
- Compétences alignées à 95 %
- Lettre pertinente
- Risque faible

---

14. GARDE-FOUS IA

Le Copilot ne doit jamais :

- Embaucher automatiquement
- Rejeter automatiquement
- Modifier les données RH sans validation
- Supprimer des dossiers

---

Toutes les décisions finales restent humaines.

---

15. PERFORMANCE

Temps de réponse :

< 5 secondes

---

Analyse complète :

< 15 secondes

---

Disponibilité :

99,9 %

---

16. ÉVOLUTION FUTURE

Version 2

Agent vidéo entretien.

---

Version 3

Analyse comportementale.

---

Version 4

Agent négociation salariale.

---

Version 5

Recruteur autonome supervisé.

---

17. DIFFÉRENCIATEUR ACADEMIA HELM

Le Recruitment Copilot doit être capable de comprendre simultanément :

- Le poste
- Le candidat
- L'établissement
- Les politiques RH
- L'historique des recrutements

afin de produire des recommandations contextualisées et explicables.

---

18. OBJECTIF FINAL

Transformer Academia Helm en une plateforme RH assistée par intelligence artificielle où le recruteur est augmenté par un ensemble d'agents spécialisés collaborant en temps réel.

---

FIN DU TOME 4

Dawes, [01/06/2026 16:19]
Bruteforce

---

18. AUDIT

Toutes les actions critiques doivent être tracées.

---

Exemples

Création offre

Modification candidature

Analyse IA

Décision recrutement

---

19. SAUVEGARDE

Base PostgreSQL

Toutes les 6 heures

---

Documents

Temps réel

---

Rétention

365 jours

---

20. HAUTE DISPONIBILITÉ

Objectif

99,9 %

---

Composants

Load Balancer

Serveurs multiples

Cluster PostgreSQL

Cluster Redis

Stockage distribué

---

21. PERFORMANCE CIBLE

Temps réponse API :

< 500 ms

---

Chargement dashboard :

< 2 secondes

---

Analyse CV :

< 5 secondes

---

Matching :

< 2 secondes

---

Recherche Elasticsearch :

< 500 ms

---

22. DÉPLOIEMENT

Environnements

Développement

Préproduction

Production

---

Conteneurisation

Docker

---

Orchestration

Kubernetes

---

CI/CD

GitHub Actions

---

23. ÉVOLUTION FUTURE

Migration progressive :

Modular Monolith

↓

Hybrid Services

↓

Microservices

↓

AI Services Cluster

---

24. ARCHITECTURE CIBLE ACADEMIA HELM

À terme, le module RH doit devenir un domaine autonome de l'écosystème Academia Helm tout en partageant :

- Authentification centrale
- Gestion des organisations
- Gestion documentaire
- Copilot IA global
- Notifications centralisées
- Audit centralisé

---

25. CRITÈRES D'ACCEPTATION

Scalabilité :

1000+ organisations

---

100 000+ utilisateurs

---

1 000 000+ candidats

---

Disponibilité :

99,9 %

---

Temps moyen analyse IA :

< 10 secondes

---

Architecture totalement multi-tenant

---

Prête pour l'intégration avec les autres modules Academia Helm

---

FIN DU TOME 5

Dawes, [01/06/2026 16:20]
communication
leadership
technical_skills
motivation
global_score

---

19. TESTS

hr_tests

id
name
type
description

---

hr_test_results

id
test_id
candidate_id
score
result

---

20. RAPPORTS IA

ai_reports

id
candidate_id
application_id
report_type
content
generated_at

---

21. TALENT POOL

talent_pool

id
candidate_id
category
status

---

talent_tags

id
name

---

talent_pool_tags

talent_pool_id
tag_id

---

22. NOTIFICATIONS

notifications

id
user_id
type
title
message
status

---

23. AUDIT

audit_logs

id
entity_type
entity_id
action
old_value
new_value
performed_by
performed_at

---

24. TABLES SPÉCIFIQUES ACADEMIA HELM

academic_profiles

id
candidate_id
teaching_level
subjects
pedagogical_experience

---

teaching_certifications

id
candidate_id
certification_name
issuer

---

academic_scores

id
candidate_id
pedagogical_score
academic_score
global_score

---

25. INDEXES STRATÉGIQUES

idx_candidates_email

idx_candidates_phone

idx_applications_status

idx_jobs_status

idx_matching_score

idx_candidate_skills

idx_candidate_experience

idx_documents_type

---

26. RELATIONS CRITIQUES

Job

→ Applications

→ Candidate

→ Documents

→ AI Analysis

→ Interviews

→ Reports

---

27. VOLUME CIBLE

Organisation :

100 000 candidats

---

Plateforme :

10 000 000+ candidats

---

Documents :

100 To+

---

28. ÉVOLUTIONS FUTURES

Préparation pour :

- Data Warehouse
- Data Lake
- Analytics IA
- Prédiction RH
- Recruteur autonome

---

29. CRITÈRES D'ACCEPTATION

- Intégrité référentielle totale
- Multi-tenancy natif
- Audit complet
- Historisation complète
- Scalabilité horizontale
- Compatible PostgreSQL Enterprise

---

FIN DU TOME 6

Dawes, [01/06/2026 16:21]
heduled

---

Candidate Hired

candidate.hired

---

20. GRAPHQL

Endpoint

/graphql

---

Query Exemple

query {
  candidates {
    id
    firstName
    lastName
  }
}

---

Mutation Exemple

mutation {
  createCandidate(
    input: {
      firstName: "Jean"
      lastName: "Dupont"
    }
  ) {
    id
  }
}

---

21. VALIDATIONS

Email

RFC 5322

---

Téléphone

E.164

---

Fichier

Max :

20 MB

---

CV

Formats autorisés :

PDF

DOCX

DOC

---

22. GESTION DES ERREURS

Format standard

{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email"
  }
}

---

23. RATE LIMITING

Utilisateur :

100 requêtes/minute

---

Copilot IA :

30 requêtes/minute

---

API publiques :

60 requêtes/minute

---

24. INTÉGRATIONS EXTERNES

Email

SMTP

Microsoft 365

Google Workspace

---

SMS

Twilio

Infobip

---

WhatsApp

Meta Cloud API

---

Signature Électronique

DocuSign

Adobe Sign

---

IA

OpenAI

Mistral

Anthropic

---

25. CONTRAT D'INTÉGRATION ACADEMIA HELM

Le module RH doit pouvoir communiquer avec :

- Module Finance
- Module Scolarité
- Module Administration
- Module GED
- Module IA Global
- Module Notifications
- Module Audit

---

26. OBJECTIFS DE PERFORMANCE

Temps moyen API :

< 500 ms

---

Recherche :

< 300 ms

---

Matching :

< 2 secondes

---

Copilot :

< 5 secondes

---

27. CRITÈRES D'ACCEPTATION

100 % des endpoints documentés

---

Swagger généré automatiquement

---

Validation centralisée

---

Versionnement garanti

---

Compatibilité REST + GraphQL

---

Prêt pour intégration mobile et web

---

FIN DU TOME 7

Dawes, [01/06/2026 16:21]
Suggestions

Analyser ce candidat

Comparer candidats

Préparer entretien

Créer rapport

---

Réponses

Rich Cards

Graphiques

Rapports

Actions rapides

---

19. RAPPORTS

Dashboard Analytics

Temps recrutement

Sources candidats

Qualité recrutements

---

Exports

PDF

Excel

CSV

---

20. NOTIFICATIONS

Centre unifié.

---

Types :

Information

Alerte

Validation

IA

---

21. MODE MOBILE

Fonctionnalités

Consultation

Validation

Entretiens

Notifications

Copilot

---

Optimisation

Responsive complet.

---

22. ACCESSIBILITÉ

Conformité WCAG.

---

Support :

Clavier

Lecteurs écran

Contraste élevé

Navigation simplifiée

---

23. MULTI-LANGUE

Support natif :

Français

Anglais

Espagnol

Arabe

Portugais

---

24. PERSONNALISATION

Tenant Branding.

---

Personnalisable :

Logo

Couleurs

Nom organisation

Templates emails

---

25. EXPÉRIENCE IA

Objectif :

Que l'utilisateur ait l'impression de travailler avec un recruteur expert assisté par une intelligence artificielle explicable.

---

Chaque écran doit :

- Fournir des recommandations
- Expliquer les scores
- Mettre en évidence les risques
- Réduire la charge cognitive

---

26. MÉTRIQUES UX

Temps création offre :

< 3 minutes

---

Temps analyse candidat :

< 1 minute

---

Temps décision recrutement :

< 5 minutes

---

27. CRITÈRES D'ACCEPTATION

- Responsive complet
- Accessibilité WCAG
- Compatible desktop/tablette/mobile
- Intégration Copilot sur tous les écrans
- Cohérence avec le Design System Academia Helm
- Expérience IA native

---

28. OBJECTIF FINAL

Faire du module RH d'Academia Helm une expérience de recrutement moderne, fluide et assistée par IA, capable de traiter des milliers de candidatures tout en conservant une excellente expérience utilisateur.

---

FIN DU TOME 8

Dawes, [01/06/2026 16:22]
données

Gestionnaire données

Auditeur

Administrateur

---

20. CONSERVATION DES DONNÉES

Candidatures

5 ans

---

Journaux

10 ans

---

Documents

Selon politique institution

---

21. DROITS DES UTILISATEURS

Consultation

Rectification

Téléchargement

Suppression (selon règles)

Portabilité

---

22. CONFORMITÉ

Le système doit permettre la conformité avec :

- Réglementations locales
- Normes de protection des données
- Politiques internes des institutions

---

23. SAUVEGARDE

Base PostgreSQL

Toutes les 6 heures

---

Documents

Temps réel

---

Configuration

Quotidienne

---

24. PLAN DE REPRISE D'ACTIVITÉ

RPO

15 minutes

---

RTO

2 heures

---

25. HAUTE DISPONIBILITÉ

Architecture :

Load Balancer

↓

Instances Applicatives

↓

Cluster PostgreSQL

↓

Cluster Redis

↓

Stockage Distribué

---

Disponibilité cible :

99,9 %

---

26. GESTION DES INCIDENTS

Cycle :

Détection

Qualification

Confinement

Correction

Analyse

Rapport

---

27. AUDITS DE SÉCURITÉ

Périodicité :

Trimestrielle

---

Types :

Audit technique

Audit fonctionnel

Audit accès

Audit IA

---

28. TESTS DE SÉCURITÉ

SAST

DAST

Tests pénétration

Tests API

Tests IA

---

29. CONFORMITÉ IA

Le système doit conserver :

- Historique prompts
- Historique réponses
- Historique décisions

---

Traçabilité complète.

---

30. CENTRE DE SÉCURITÉ

Écran dédié :

Tableau de bord sécurité

Alertes

Incidents

Logs

Conformité

---

31. INDICATEURS DE SÉCURITÉ

Nombre incidents

Temps résolution

Tentatives bloquées

Anomalies IA

Taux MFA

---

32. OBJECTIF FINAL

Garantir que le module RH d'Academia Helm puisse être déployé dans :

- Écoles
- Universités
- Grandes entreprises
- Institutions publiques
- Organisations internationales

tout en assurant un niveau de sécurité, de traçabilité et de gouvernance conforme aux exigences des environnements critiques.

---

33. CRITÈRES D'ACCEPTATION

- MFA opérationnel
- RBAC et ABAC implémentés
- Chiffrement AES-256
- TLS 1.3
- Audit complet
- Journalisation immuable
- Sauvegardes automatisées
- PRA documenté
- Isolation multi-tenant vérifiée
- IA explicable et traçable

---

FIN DU TOME 9

Dawes, [01/06/2026 16:23]
rch

Quotidien

---

26. PLAN DE REPRISE

RPO

15 minutes

---

RTO

2 heures

---

27. SCALABILITÉ

Utilisateurs

100 000+

---

Organisations

10 000+

---

Candidats

10 000 000+

---

Documents

100 To+

---

28. OPTIMISATION PERFORMANCE

Redis

CDN

Lazy Loading

Compression

Pagination

Indexation

---

29. MAINTENANCE

Maintenance planifiée.

---

Fenêtres :

Dimanche

00h00 – 04h00

---

30. GESTION DES VERSIONS

Format :

MAJOR.MINOR.PATCH

---

Exemple :

1.0.0

1.1.0

1.1.1

---

31. RELEASE MANAGEMENT

Chaque version doit inclure :

Release Notes

Scripts migration

Plan rollback

Tests validation

---

32. GESTION DES MIGRATIONS

Outil :

Prisma Migrations

---

Règles :

Migration versionnée

Rollback possible

Historisation

---

33. EXPLOITATION

Centre d'exploitation :

- État plateforme
- État IA
- État APIs
- État Base de données
- État Stockage

---

34. CENTRE D'ADMINISTRATION TECHNIQUE

Fonctionnalités :

Logs

Queues

Caches

Workers

Services IA

Monitoring

---

35. GESTION DES FILES D'ATTENTE

RabbitMQ :

cv_analysis_queue

letter_analysis_queue

matching_queue

report_queue

notification_queue

audit_queue

---

36. INDICATEURS DEVOPS

Taux succès déploiement

Temps moyen déploiement

Temps moyen restauration

Disponibilité

Temps moyen incident

---

37. OBJECTIF FINAL

Permettre au module RH Academia Helm de fonctionner à l'échelle Enterprise avec :

- Haute disponibilité
- Déploiement automatisé
- Scalabilité horizontale
- Observabilité complète
- Supervision temps réel
- Résilience maximale

---

38. CRITÈRES D'ACCEPTATION

- Déploiement Kubernetes opérationnel
- CI/CD automatisé
- Monitoring complet
- Tracing distribué
- Sauvegardes automatiques
- PRA validé
- Scalabilité horizontale
- Disponibilité ≥ 99,9 %
- Observabilité complète

---

FIN DU TOME 10
