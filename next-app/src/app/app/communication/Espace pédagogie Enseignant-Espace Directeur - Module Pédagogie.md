Voici la **documentation spéciale structurée** pour l’**Espace Pédagogique Enseignant** en relation directe avec l’**Espace Directeur(trice)**.

Elle tient compte de la logique que tu as définie : l’enseignant prépare ses documents pédagogiques, les soumet, le Directeur ou la Directrice les reçoit dans son espace, les consulte, les amende, les valide, les rejette ou demande correction. Elle intègre aussi le **cahier de semaine**, dont le document fourni précise le suivi quotidien, le rôle du Semainier, les fiches journalières, le rapport hebdomadaire, les statistiques et les recommandations. 

---

# Academia Helm — Documentation spéciale : Espace Pédagogique Enseignant en relation avec l’Espace Directeur(trice)

## 1. Objectif général

L’**Espace Pédagogique Enseignant** est le centre de production, de soumission et de suivi des documents pédagogiques de l’enseignant.

L’**Espace Directeur(trice)** est le centre de réception, de contrôle, d’amendement, de validation, de rejet et d’archivage des documents pédagogiques soumis par les enseignants.

Les deux espaces fonctionnent ensemble comme un **circuit numérique de gouvernance pédagogique**.

La logique métier est simple :

```txt
Enseignant prépare
→ Enseignant soumet
→ Directeur reçoit
→ Directeur contrôle
→ Directeur valide ou rejette
→ Enseignant corrige si nécessaire
→ Document archivé
```

Ce n’est donc pas un simple dépôt de fichiers. C’est un **workflow pédagogique contrôlé**, avec traçabilité complète.

---

# 2. Principe fondamental

Chaque enseignant dispose d’un espace personnel. Il ne voit que :

```txt
ses propres documents pédagogiques
ses propres soumissions
ses propres retours
ses propres validations
ses propres rejets
ses propres corrections demandées
```

Chaque Directeur(trice) dispose d’un espace de supervision lié à son niveau scolaire ou à son périmètre d’accréditation.

Exemples :

```txt
Directeur(trice) Maternelle : documents pédagogiques de la Maternelle
Directeur(trice) Primaire : documents pédagogiques du Primaire
Responsable Secondaire / Surveillant / Censeur : cahiers de textes et documents pédagogiques du Secondaire selon les droits
Promoteur / Administration générale : vue consolidée selon permissions
Super Admin / Platform Owner : supervision technique et globale
```

La règle est nette : **le front-end affiche selon le rôle, mais le backend verrouille selon les permissions**. Sinon, ce n’est pas de la sécurité, c’est du théâtre.

---

# 3. Acteurs concernés

## 3.1 Côté Enseignant

L’enseignant peut :

```txt
préparer ses fiches pédagogiques
préparer son cahier journal
renseigner son cahier de textes
renseigner le cahier de semaine s’il est désigné Semainier
soumettre ses documents au responsable compétent
recevoir les observations
corriger les documents rejetés ou amendés
consulter l’historique de ses validations
exporter ses documents validés
recevoir des notifications internes, e-mail, SMS ou WhatsApp
```

## 3.2 Côté Directeur(trice)

Le Directeur ou la Directrice peut :

```txt
recevoir les documents soumis par les enseignants
consulter les fiches pédagogiques
consulter les cahiers journaux
consulter les cahiers de textes
consulter les cahiers de semaine
ajouter des observations
amender les documents
valider
rejeter
demander correction
suivre les retards
consulter les statistiques pédagogiques
exploiter les alertes ORION
archiver les documents validés
```

---

# 4. Documents pédagogiques concernés

## 4.1 Fiche pédagogique

La **fiche pédagogique** permet à l’enseignant de préparer une séance d’enseignement.

Elle contient notamment :

```txt
niveau
classe
matière
thème
titre de la leçon
compétence visée
objectifs pédagogiques
prérequis
matériel didactique
déroulement de la séance
activités de l’enseignant
activités des apprenants
stratégie pédagogique
durée
évaluation prévue
observations
pièces jointes
```

---

## 4.2 Cahier journal

Le **cahier journal** permet à l’enseignant de planifier les activités pédagogiques prévues.

Il peut contenir :

```txt
date
semaine
classe
matière
plage horaire
activité prévue
objectif de séance
support utilisé
observation
statut de soumission
```

---

## 4.3 Cahier de textes

Le **cahier de textes** permet de renseigner les activités réellement exécutées en classe.

Il peut contenir :

```txt
date
classe
matière
enseignant
notion prévue
notion réellement exécutée
devoirs donnés
observations
écarts constatés
signature ou validation numérique
```

---

## 4.4 Cahier de semaine

Le **cahier de semaine** est rempli par l’enseignant désigné **Semainier**.

Il couvre le suivi quotidien et hebdomadaire de l’établissement.

Il comprend notamment :

```txt
présence du personnel enseignant
présence des élèves
déroulement pédagogique
discipline et vie scolaire
hygiène, sécurité et logistique
visites reçues
communication et circulaires
synthèse globale du jour
rapport de fin de semaine
recommandations stratégiques
```

Le cahier de semaine est donc plus large que la pédagogie pure. Il observe la vie réelle de l’école pendant la semaine.

---

# 5. Architecture fonctionnelle de l’Espace Enseignant

## 5.1 Tableau de bord enseignant

Le tableau de bord doit afficher :

```txt
documents en brouillon
documents soumis
documents validés
documents rejetés
documents à corriger
retours récents du Directeur
échéances pédagogiques
alertes de retard
notifications
accès rapide à Sara AI
```

## 5.2 Menu principal Enseignant

Menus recommandés :

```txt
Tableau de bord
Mes fiches pédagogiques
Mon cahier journal
Mon cahier de textes
Mon cahier de semaine
Documents soumis
Retours du Directeur
Documents validés
Documents rejetés
Archives
Sara AI pédagogique
Notifications
```

## 5.3 Statuts côté Enseignant

Chaque document peut avoir l’un des statuts suivants :

```txt
brouillon
prêt à soumettre
soumis
reçu par la direction
en cours de revue
validé
rejeté
correction demandée
corrigé et renvoyé
archivé
```

---

# 6. Architecture fonctionnelle de l’Espace Directeur(trice)

## 6.1 Tableau de bord Directeur(trice)

Le tableau de bord doit afficher :

```txt
documents reçus aujourd’hui
documents en attente de validation
documents urgents
documents rejetés
documents validés
enseignants en retard
cahiers journaux non soumis
cahiers de textes non renseignés
cahiers de semaine en attente
alertes ORION
statistiques par classe, matière et enseignant
```

## 6.2 Menu principal Directeur(trice)

Menus recommandés :

```txt
Tableau de bord
Documents reçus
Fiches pédagogiques
Cahiers journaux
Cahiers de textes
Cahiers de semaine
Validations en attente
Observations envoyées
Documents rejetés
Documents validés
Alertes ORION
Statistiques pédagogiques
Archives
Paramètres de validation
```

## 6.3 Statuts côté Directeur(trice)

Chaque document reçu peut avoir l’un des statuts suivants :

```txt
nouveau
consulté
en revue
observation ajoutée
amendé
validé
rejeté
correction demandée
retourné à l’enseignant
archivé
```

---

# 7. Workflow complet de soumission et validation

## 7.1 Création du document

L’enseignant crée un document pédagogique depuis son espace.

Il choisit :

```txt
type de document
niveau
classe
matière
période
date
contenu pédagogique
```

Le document est d’abord enregistré comme **brouillon**.

---

## 7.2 Assistance par Sara AI

Avant soumission, l’enseignant peut demander l’aide de **Sara AI** pour :

```txt
structurer le document
améliorer la formulation
proposer des objectifs
générer une progression
vérifier la cohérence pédagogique
proposer des activités
reformuler les observations
```

Sara AI assiste, mais ne valide jamais.

---

## 7.3 Soumission

L’enseignant clique sur **Soumettre**.

Le système vérifie :

```txt
champs obligatoires
cohérence des dates
classe concernée
matière concernée
responsable destinataire
pièces jointes éventuelles
statut du document
```

Ensuite, le document est envoyé automatiquement au Directeur ou responsable compétent.

---

## 7.4 Réception côté Directeur(trice)

Le Directeur reçoit une notification.

Dans son espace, il voit :

```txt
nom de l’enseignant
type de document
classe
matière
date de soumission
niveau
statut
priorité
délai de traitement
```

---

## 7.5 Revue du document

Le Directeur peut :

```txt
lire le document
ajouter des commentaires
surligner une section
proposer une correction
ajouter une observation globale
joindre un fichier
demander une correction
valider
rejeter
```

---

## 7.6 Retour à l’enseignant

Après traitement, l’enseignant reçoit :

```txt
notification interne
e-mail si activé
SMS si activé
WhatsApp si activé
```

Le retour contient :

```txt
statut final
observations du Directeur
corrections demandées
délai éventuel de correction
historique des échanges
```

---

## 7.7 Correction et renvoi

Si correction demandée :

```txt
1. l’enseignant ouvre le document
2. il consulte les observations
3. il corrige
4. il renvoie
5. le Directeur reçoit une nouvelle version
6. le cycle continue jusqu’à validation
```

---

## 7.8 Archivage

Après validation, le document devient non modifiable sauf autorisation spéciale.

Il est archivé avec :

```txt
version finale
date de validation
validateur
historique des corrections
signature numérique
horodatage
```

---

# 8. Messagerie pédagogique interne

La relation Enseignant — Directeur doit fonctionner comme une **messagerie spécialisée**.

## 8.1 Boîte de l’Enseignant

Sections recommandées :

```txt
Brouillons
Envoyés
En attente
Retours reçus
À corriger
Validés
Rejetés
Archives
```

## 8.2 Boîte du Directeur

Sections recommandées :

```txt
Nouveaux documents
En attente de revue
En cours
À retourner
Validés
Rejetés
Retards
Archives
```

## 8.3 Règle de confidentialité

```txt
Un enseignant ne voit jamais les documents d’un autre enseignant.

Le Directeur voit uniquement les documents des enseignants relevant de son périmètre.

Le Promoteur ou l’Administration générale peut voir une vue consolidée si les droits sont activés.
```

---

# 9. Notifications

## 9.1 Notifications envoyées au Directeur

Le Directeur est notifié quand :

```txt
un enseignant soumet une fiche pédagogique
un enseignant soumet un cahier journal
un enseignant renseigne un cahier de textes
un Semainier soumet un cahier de semaine
un document corrigé est renvoyé
un délai de validation est dépassé
```

## 9.2 Notifications envoyées à l’Enseignant

L’enseignant est notifié quand :

```txt
son document est reçu
son document est consulté
son document est validé
son document est rejeté
une correction est demandée
une observation est ajoutée
un rappel de soumission est généré
```

## 9.3 Canaux de notification

Canaux possibles :

```txt
notification interne
e-mail
SMS
WhatsApp
```

---

# 10. Règles par niveau scolaire

## 10.1 Maternelle

Documents concernés :

```txt
fiches pédagogiques
cahier journal
cahier de textes
cahier de semaine si l’enseignant est Semainier
```

Destinataire principal :

```txt
Directeur(trice) Maternelle
```

---

## 10.2 Primaire

Documents concernés :

```txt
fiches pédagogiques
cahier journal
cahier de textes
cahier de semaine si l’enseignant est Semainier
```

Destinataire principal :

```txt
Directeur(trice) Primaire
```

---

## 10.3 Secondaire

Documents concernés :

```txt
cahier de textes
planification hebdomadaire
progression pédagogique
documents pédagogiques selon paramétrage
```

Destinataires possibles :

```txt
surveillant
censeur
responsable pédagogique
directeur des études
direction générale selon permissions
```

---

# 11. Gestion des versions

Chaque document doit être versionné.

Exemple :

```txt
Version 1 : brouillon initial
Version 2 : document soumis
Version 3 : document corrigé
Version finale : document validé
```

Chaque version doit conserver :

```txt
auteur
date
modifications
observations
statut
validateur
```

---

# 12. Historique et traçabilité

Le système doit tracer :

```txt
création
modification
soumission
consultation
commentaire
rejet
validation
correction
archivage
export
```

Chaque action doit être horodatée.

Cette traçabilité protège l’enseignant, le Directeur et l’établissement.

---

# 13. Rôle d’ORION

**ORION** agit comme moteur d’analyse et d’alerte.

Il peut détecter :

```txt
fiches pédagogiques non soumises
cahiers journaux en retard
cahiers de textes non renseignés
enseignants régulièrement en retard
documents souvent rejetés
classes sans suivi pédagogique
responsables avec validations en attente
incohérences entre cahier journal et cahier de textes
problèmes récurrents signalés dans le cahier de semaine
```

ORION peut produire :

```txt
alertes
tableaux de bord
rapports hebdomadaires
indicateurs de conformité
recommandations à la direction
```

Exemple :

```txt
ORION détecte que trois enseignants du Primaire n’ont pas soumis leur cahier journal avant lundi matin.
```

---

# 14. Rôle de Sara AI

**Sara AI** assiste l’enseignant dans la production pédagogique.

Elle peut aider à :

```txt
générer une fiche pédagogique
structurer un cahier journal
reformuler une observation
proposer une activité
préparer une progression
améliorer la clarté d’un document
générer une synthèse du cahier de semaine
proposer des recommandations
```

Sara AI peut aussi assister le Directeur dans :

```txt
la lecture synthétique des documents
la détection d’incohérences
la rédaction d’observations professionnelles
la génération d’un retour clair à l’enseignant
la production d’un rapport pédagogique consolidé
```

Sara AI ne remplace ni l’enseignant ni le Directeur. Elle accélère le travail, mais la responsabilité reste humaine.

---

# 15. Permissions recommandées

## 15.1 Permissions Enseignant

```txt
PEDAGOGY_DOCUMENT_CREATE
PEDAGOGY_DOCUMENT_UPDATE_OWN
PEDAGOGY_DOCUMENT_SUBMIT
PEDAGOGY_DOCUMENT_VIEW_OWN
PEDAGOGY_DOCUMENT_CORRECT
PEDAGOGY_DOCUMENT_EXPORT_OWN
PEDAGOGY_AI_ASSISTANT_USE
WEEKLY_NOTEBOOK_FILL_IF_ASSIGNED
```

## 15.2 Permissions Directeur(trice)

```txt
PEDAGOGY_DOCUMENT_VIEW_ASSIGNED
PEDAGOGY_DOCUMENT_REVIEW
PEDAGOGY_DOCUMENT_COMMENT
PEDAGOGY_DOCUMENT_VALIDATE
PEDAGOGY_DOCUMENT_REJECT
PEDAGOGY_DOCUMENT_REQUEST_CORRECTION
PEDAGOGY_DOCUMENT_ARCHIVE
PEDAGOGY_DASHBOARD_VIEW
PEDAGOGY_REPORT_EXPORT
WEEKLY_NOTEBOOK_VALIDATE
```

## 15.3 Permissions Administration générale

```txt
PEDAGOGY_ALL_VIEW
PEDAGOGY_REPORTS_VIEW
PEDAGOGY_STATISTICS_VIEW
PEDAGOGY_WORKFLOW_CONFIGURE
PEDAGOGY_ARCHIVES_VIEW
PEDAGOGY_ORION_ALERTS_VIEW
```

---

# 16. Tables backend recommandées

## 16.1 Tables principales

```txt
pedagogical_documents
pedagogical_document_versions
pedagogical_submissions
pedagogical_reviews
pedagogical_comments
pedagogical_validations
pedagogical_workflows
pedagogical_notifications
pedagogical_archives
pedagogical_ai_assistance_logs
```

## 16.2 Tables spécialisées

```txt
pedagogical_sheets
daily_journals
class_logbooks
weekly_notebooks
weekly_notebook_days
weekly_notebook_reports
```

## 16.3 Tables de liaison

```txt
teacher_director_assignments
teacher_classes
teacher_subjects
director_levels
pedagogical_document_recipients
pedagogical_document_permissions
```

---

# 17. Modèle de données simplifié

## 17.1 `pedagogical_documents`

Champs recommandés :

```txt
id
school_id
academic_year_id
teacher_id
document_type
level_id
class_id
subject_id
title
content
status
current_version
submitted_at
validated_at
rejected_at
archived_at
created_at
updated_at
```

## 17.2 `pedagogical_reviews`

Champs recommandés :

```txt
id
document_id
reviewer_id
review_status
global_comment
decision
correction_deadline
reviewed_at
```

## 17.3 `pedagogical_comments`

Champs recommandés :

```txt
id
document_id
reviewer_id
comment_type
section_reference
comment
created_at
```

## 17.4 `pedagogical_notifications`

Champs recommandés :

```txt
id
school_id
sender_id
recipient_id
document_id
notification_type
channel
status
sent_at
read_at
```

---

# 18. UI/UX recommandée

## 18.1 Côté Enseignant

L’interface doit être simple, directe et orientée action.

Priorités :

```txt
créer rapidement
sauvegarder facilement
soumettre clairement
voir les retours sans confusion
corriger rapidement
retrouver les documents validés
```

Composants utiles :

```txt
cartes de statut
timeline de validation
bouton Soumettre
bouton Corriger
badge Validé / Rejeté / À corriger
panneau d’observations
assistant Sara AI latéral
historique des versions
```

## 18.2 Côté Directeur(trice)

L’interface doit être orientée supervision et décision.

Priorités :

```txt
voir ce qui attend validation
filtrer par enseignant, classe, matière, niveau et statut
commenter vite
valider ou rejeter sans perdre de temps
suivre les retards
accéder aux statistiques
```

Composants utiles :

```txt
file d’attente de validation
filtres avancés
vue document + panneau commentaire
bouton Valider
bouton Rejeter
bouton Demander correction
indicateurs ORION
tableau des retards
archives consultables
```

---

# 19. Exports recommandés

Le système doit permettre l’export :

```txt
PDF
Excel
Word
archive annuelle
rapport par enseignant
rapport par classe
rapport par niveau
rapport par période
rapport global de conformité pédagogique
```

---

# 20. Règles de verrouillage

Après validation :

```txt
le document ne peut plus être modifié par l’enseignant
toute modification nécessite une demande de réouverture
la réouverture doit être autorisée par le Directeur
l’ancienne version reste conservée
la nouvelle version est historisée
```

---

# 21. Cas particuliers

## 21.1 Enseignant absent

Si l’enseignant est absent :

```txt
le document peut rester en attente
un rappel peut être généré
la direction peut désigner un remplaçant
le système conserve le retard
```

## 21.2 Directeur absent

Si le Directeur est absent :

```txt
les documents restent en attente
un responsable suppléant peut être désigné
les validations peuvent être transférées selon permissions
```

## 21.3 Document urgent

Un document peut être marqué urgent si :

```txt
inspection prévue
visite pédagogique
retard critique
demande de la direction
période d’évaluation
```

---

# 22. Indicateurs clés

Indicateurs à prévoir :

```txt
nombre de documents créés
nombre de documents soumis
nombre de documents validés
nombre de documents rejetés
taux de validation
délai moyen de validation
taux de retard enseignant
taux de retard direction
documents par classe
documents par matière
documents par niveau
alertes ORION ouvertes
alertes ORION traitées
```

---

# 23. Conclusion

L’**Espace Pédagogique Enseignant** et l’**Espace Directeur(trice)** doivent fonctionner comme un système unique de pilotage pédagogique.

```txt
L’enseignant produit la matière pédagogique.
Le Directeur contrôle la qualité.
Sara AI assiste la rédaction.
ORION surveille les retards, les incohérences et les risques.
Le système archive tout.
```

La formule opérationnelle est :

```txt
Créer → Préparer → Soumettre → Revoir → Corriger → Valider → Archiver → Analyser
```

C’est cette mécanique qui donnera à Academia Helm une vraie supériorité métier sur les solutions scolaires classiques.

En clair : **l’enseignant ne travaille plus dans son coin, le Directeur ne court plus derrière les papiers, et l’école gagne une mémoire pédagogique exploitable.**

---
