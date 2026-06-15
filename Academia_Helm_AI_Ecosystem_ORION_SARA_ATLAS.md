
# Academia Helm AI Ecosystem
# ORION • SARA AI • ATLAS

## Architecture complète, rôles, collaboration et intégration temps réel

## Vision générale

Academia Helm repose sur trois intelligences artificielles spécialisées :

- ORION : IA analytique, prédictive et décisionnelle.
- SARA AI : IA conversationnelle et assistante intelligente.
- ATLAS : IA d'automatisation, d'exécution et de production documentaire.

Ces IA ne doivent pas fonctionner comme des chatbots isolés.

Elles doivent être connectées :
- à leurs bases de connaissances ;
- aux API internes ;
- à la base de données ;
- aux événements temps réel ;
- aux permissions utilisateurs ;
- aux modules métiers.

Objectif :
fournir des réponses et des actions basées sur les données réelles de l'établissement.

---

# ORION

## Mission

ORION est le cerveau analytique de la plateforme.

Il observe, analyse, prédit et recommande.

ORION n'est pas conçu pour exécuter des actions administratives.

Il produit :
- alertes ;
- recommandations ;
- prédictions ;
- analyses ;
- indicateurs ;
- rapports décisionnels.

## Domaines couverts

### Académique

- performances élèves ;
- performances classes ;
- performances enseignants ;
- risques d'échec ;
- risques de redoublement ;
- matières critiques ;
- anomalies de notes ;
- cohérence pédagogique.

### RH

- absentéisme ;
- surcharge enseignants ;
- sous-effectif ;
- besoins futurs ;
- performance pédagogique.

### Finance

- impayés ;
- prévisions ;
- trésorerie ;
- évolution des recettes ;
- dépenses anormales.

### Administratif

- dossiers incomplets ;
- anomalies EDUCMASTER ;
- incohérences administratives ;
- conformité documentaire.

### Sécurité

- accès suspects ;
- activités inhabituelles ;
- modifications sensibles ;
- anomalies d'audit.

---

# SARA AI

## Mission

SARA AI est l'assistante intelligente de tous les utilisateurs.

Elle constitue l'interface conversationnelle principale.

Utilisateurs :
- promoteur ;
- direction ;
- comptable ;
- enseignant ;
- surveillant ;
- parent ;
- élève ;
- administrateur.

## Capacités

### Recherche intelligente

Exemples :

- Combien d'élèves sont inscrits ?
- Quels sont les impayés ?
- Quels enseignants sont absents ?
- Quels bulletins sont publiés ?

### Assistance enseignant

- préparation pédagogique ;
- génération d'exercices ;
- génération d'évaluations ;
- recherche documentaire ;
- accès bibliothèque pédagogique.

### Assistance direction

- synthèses ;
- rapports ;
- résumés ORION ;
- recommandations.

### Assistance parents

- résultats ;
- absences ;
- factures ;
- communications.

---

# ATLAS

## Mission

ATLAS est l'IA d'exécution.

Là où ORION analyse et SARA dialogue, ATLAS agit.

Toujours selon les permissions.

## Capacités

### Documents

- attestations ;
- certificats ;
- bulletins ;
- contrats ;
- lettres ;
- rapports.

### Automatisation

- notifications ;
- relances ;
- workflows ;
- tâches planifiées ;
- campagnes.

### Reporting

- PDF ;
- Excel ;
- exports ;
- statistiques.

### Archivage

- classement ;
- indexation ;
- archivage documentaire.

---

# Collaboration entre les IA

## ORION → SARA

ORION détecte une anomalie.

SARA l'explique à l'utilisateur.

## ORION → ATLAS

ORION détecte un problème.

ATLAS exécute les actions autorisées.

## SARA → ORION

SARA demande une analyse approfondie.

ORION répond.

## SARA → ATLAS

L'utilisateur demande une action.

ATLAS l'exécute.

---

# Architecture technique recommandée

## Couche IA

AI Gateway

- ORION Service
- SARA Service
- ATLAS Service

## Couche outils

- Student Tool
- Academic Tool
- Finance Tool
- HR Tool
- Communication Tool
- Analytics Tool
- Audit Tool
- Document Tool

## Couche données

- PostgreSQL
- Neon
- Prisma
- Redis
- Object Storage
- Audit Logs

---

# Connexion temps réel

Les IA doivent recevoir :

- nouvelles notes ;
- nouvelles absences ;
- nouveaux paiements ;
- nouvelles inscriptions ;
- nouveaux bulletins ;
- nouvelles alertes ;
- nouveaux audits.

Technologies recommandées :

- WebSocket ;
- Event Bus ;
- Redis Streams ;
- Queue Workers.

---

# Sécurité

Toutes les IA doivent respecter :

- multi-tenant ;
- RBAC ;
- audit ;
- permissions ;
- isolation des données.

Aucune IA ne doit contourner les droits utilisateurs.

---

# RAG

Chaque IA doit disposer d'une base de connaissances dédiée.

Sources :

- documentation Academia Helm ;
- procédures ;
- règlements ;
- guides ;
- FAQ ;
- modèles de documents ;
- politiques internes.

Les réponses doivent fusionner :

- connaissances ;
- données temps réel ;
- permissions utilisateur.

---

# Résultat attendu

ORION :
analyse, prédit et recommande.

SARA :
dialogue, explique et assiste.

ATLAS :
automatise, génère et exécute.

Ensemble, ils forment le système nerveux intelligent complet de Academia Helm.
