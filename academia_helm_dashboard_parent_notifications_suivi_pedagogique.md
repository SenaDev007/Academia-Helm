# Academia Helm — Notification Parent dans le Dashboard à partir du Suivi Pédagogique Enseignant

## 1. Principe général

À partir des activités pédagogiques créées et suivies par l’enseignant dans l’Espace Pédagogique Enseignant, le parent de chaque élève doit être automatiquement informé dans son dashboard.

Le parent ne doit pas seulement recevoir un message générique.  
Il doit disposer d’un espace structuré lui permettant de vérifier concrètement le travail demandé, le travail réalisé, les retards, les observations et les actions attendues.

---

# 2. Objectif

Permettre au parent de suivre son enfant en temps réel sur :

- les devoirs à faire ;
- les exercices de maison ;
- les travaux de recherche ;
- les exposés à préparer ;
- les leçons à recopier ;
- les leçons à apprendre ;
- les récitations ;
- les lectures ;
- les activités pratiques ;
- les travaux rendus ;
- les travaux non rendus ;
- les retards ;
- les observations de l’enseignant ;
- les corrections ;
- les demandes de reprise ;
- les alertes pédagogiques.

---

# 3. Déclencheurs de notification parent

Le parent doit être notifié lorsqu’un enseignant :

## 3.1 Crée une activité

Exemples :

- nouveau devoir ;
- nouvel exercice ;
- nouvelle recherche ;
- nouveau thème d’exposé ;
- nouvelle leçon à apprendre ;
- nouvelle récitation ;
- nouvelle lecture ;
- nouvelle activité pratique.

## 3.2 Met à jour une activité

Exemples :

- modification de consigne ;
- changement de date limite ;
- ajout de pièce jointe ;
- changement de groupe ;
- modification de priorité ;
- report de présentation.

## 3.3 Renseigne un statut élève

Exemples :

- devoir fait ;
- devoir non fait ;
- devoir incomplet ;
- devoir rendu en retard ;
- leçon copiée ;
- leçon non copiée ;
- récitation réussie ;
- récitation insuffisante ;
- exposé présenté ;
- exposé non présenté ;
- cahier incomplet ;
- travail à reprendre.

## 3.4 Ajoute une observation

Exemples :

- manque de concentration ;
- effort notable ;
- progrès observé ;
- besoin d’accompagnement ;
- travail soigné ;
- travail bâclé ;
- consigne non respectée ;
- participation active ;
- difficulté persistante.

## 3.5 Détecte une alerte

Exemples :

- plusieurs devoirs non faits ;
- plusieurs retards ;
- leçons non copiées répétées ;
- parent qui ne consulte pas les notifications ;
- baisse d’engagement ;
- risque de décrochage ;
- absence de réaction parentale.

---

# 4. Dashboard Parent — Bloc “Suivi pédagogique”

Dans le dashboard parent, il faut ajouter un bloc visible dès l’accueil :

## Bloc : Suivi pédagogique de mon enfant

Ce bloc affiche :

- nombre de devoirs à faire ;
- nombre de devoirs en retard ;
- nombre de travaux non faits ;
- nombre de leçons non copiées ;
- nombre de récitations à préparer ;
- nombre d’exposés à venir ;
- dernières observations enseignant ;
- alertes pédagogiques ;
- actions attendues du parent.

---

# 5. Centre de notifications parent

Le parent doit avoir un centre de notifications avec plusieurs catégories.

## 5.1 Catégories

- Devoirs ;
- Exercices ;
- Recherches ;
- Exposés ;
- Leçons ;
- Récitations ;
- Cahiers ;
- Corrections ;
- Observations ;
- Alertes ;
- Rappels.

## 5.2 Statuts de notification

- non lue ;
- lue ;
- importante ;
- urgente ;
- action requise ;
- expirée ;
- archivée.

## 5.3 Actions possibles

Le parent peut :

- ouvrir le détail ;
- marquer comme lu ;
- accuser réception ;
- commenter si autorisé ;
- poser une question si autorisé ;
- confirmer suivi à la maison ;
- télécharger une pièce jointe ;
- filtrer par enfant ;
- filtrer par matière ;
- filtrer par enseignant ;
- filtrer par période.

---

# 6. Vue détaillée d’une activité côté parent

Lorsqu’un parent clique sur une notification, il doit voir une fiche claire.

## Informations affichées

- nom de l’enfant ;
- classe ;
- matière ;
- enseignant ;
- type d’activité ;
- titre ;
- consigne ;
- objectif ;
- compétence visée ;
- date de publication ;
- date limite ;
- date de présentation si exposé ;
- priorité ;
- statut de l’enfant ;
- observation enseignant ;
- correction ;
- appréciation ou note si applicable ;
- pièces jointes ;
- historique des modifications ;
- action attendue du parent.

---

# 7. Timeline pédagogique de l’élève

Le parent doit pouvoir consulter une timeline chronologique du suivi pédagogique.

## La timeline affiche

- devoirs donnés ;
- devoirs faits ;
- devoirs non faits ;
- leçons copiées ;
- leçons non copiées ;
- récitations ;
- exposés ;
- recherches ;
- observations ;
- corrections ;
- rappels ;
- alertes ;
- accusés de réception.

Cette timeline permet au parent de comprendre l’évolution de son enfant sans chercher dans plusieurs menus.

---

# 8. Synthèse hebdomadaire parent

Le système doit générer une synthèse hebdomadaire.

## Contenu de la synthèse

- devoirs donnés cette semaine ;
- devoirs faits ;
- devoirs non faits ;
- devoirs en retard ;
- leçons à apprendre ;
- leçons non copiées ;
- récitations réalisées ;
- exposés à venir ;
- observations importantes ;
- recommandations de suivi ;
- alertes éventuelles.

## Canaux possibles

- dashboard ;
- email ;
- WhatsApp ;
- SMS résumé ;
- notification mobile.

---

# 9. Accusé de réception parent

Pour les activités importantes, l’école peut exiger un accusé de réception.

## Cas concernés

- devoir important ;
- exposé à préparer ;
- travail non fait ;
- leçon non copiée répétée ;
- alerte pédagogique ;
- convocation pédagogique ;
- observation critique ;
- demande de reprise.

## Statuts

- envoyé ;
- reçu ;
- lu ;
- accusé réception ;
- non consulté ;
- relancé.

---

# 10. Gestion multi-enfants

Si un parent a plusieurs enfants dans l’école, son dashboard doit permettre :

- vue globale de tous les enfants ;
- filtre par enfant ;
- résumé par enfant ;
- alertes par enfant ;
- devoirs par enfant ;
- notifications séparées ;
- priorité des urgences.

---

# 11. Rappels automatiques

Le système doit envoyer des rappels intelligents.

## Types de rappels

- rappel avant échéance ;
- rappel le jour de l’échéance ;
- rappel après retard ;
- rappel si parent n’a pas lu ;
- rappel si activité urgente ;
- rappel avant présentation d’exposé ;
- rappel avant récitation ;
- rappel de leçon non copiée répétée.

---

# 12. Intégration ORION

ORION peut analyser le comportement pédagogique de l’élève et du parent.

## ORION détecte

- élève avec plusieurs devoirs non faits ;
- élève avec retards fréquents ;
- élève avec leçons non copiées répétées ;
- élève avec récitations insuffisantes ;
- parent qui ne consulte pas les notifications ;
- parent qui n’accuse jamais réception ;
- matière avec trop de non-rendus ;
- classe avec faible engagement ;
- risque de décrochage.

## ORION recommande

- notifier le parent ;
- créer une alerte direction ;
- informer le professeur principal ;
- proposer une remédiation ;
- planifier un entretien parent ;
- suivre l’élève sur une période ;
- générer un rapport pédagogique.

---

# 13. Intégration Sara AI

Sara AI peut aider à produire des messages clairs pour les parents.

## Sara AI peut générer

- message de notification parent ;
- résumé hebdomadaire ;
- reformulation d’observation enseignant ;
- message de relance ;
- message bienveillant pour travail non fait ;
- message de félicitation ;
- recommandation de suivi à la maison ;
- explication simplifiée d’une consigne.

---

# 14. Backend attendu

Tables possibles :

- parent_notifications
- parent_notification_categories
- parent_notification_statuses
- parent_notification_reads
- parent_acknowledgements
- parent_dashboard_widgets
- parent_pedagogical_timelines
- parent_weekly_summaries
- parent_reminders
- parent_child_filters
- parent_notification_preferences
- parent_notification_delivery_logs

---

# 15. Relations avec les tables pédagogiques

Les notifications parent doivent être liées aux tables suivantes :

- pedagogical_tasks
- pedagogical_task_students
- pedagogical_task_statuses
- pedagogical_task_comments
- pedagogical_task_evaluations
- lesson_copy_tracking
- recitation_tracking
- presentation_topics
- research_assignments
- student_engagement_metrics

---

# 16. Permissions

Permissions recommandées :

- PARENT_NOTIFICATION_VIEW
- PARENT_NOTIFICATION_READ
- PARENT_NOTIFICATION_ACKNOWLEDGE
- PARENT_NOTIFICATION_COMMENT
- PARENT_PEDAGOGICAL_TIMELINE_VIEW
- PARENT_WEEKLY_SUMMARY_VIEW
- PARENT_TASK_DETAIL_VIEW
- PARENT_ATTACHMENT_DOWNLOAD
- PARENT_FOLLOWUP_CONFIRM

---

# 17. Règles métier

- Le parent ne voit que les informations de ses propres enfants.
- Une notification doit toujours être liée à un élève précis.
- Les notifications critiques doivent exiger un accusé de réception si l’école l’active.
- Les enseignants ne doivent pas voir les réponses des parents hors de leur périmètre.
- Les directions peuvent consulter les historiques selon permissions.
- Les notifications doivent être historisées.
- Les rappels doivent respecter les préférences et règles de l’école.
- Les informations sensibles doivent être protégées.
- Les parents doivent pouvoir filtrer les notifications.
- Les notifications importantes ne doivent pas être noyées dans les messages ordinaires.

---

# 18. Conclusion

À partir du suivi pédagogique enseignant, le parent doit être automatiquement notifié dans son dashboard.

Le parent peut alors :

1. voir le travail demandé ;
2. vérifier ce qui est fait ou non fait ;
3. lire les observations ;
4. consulter les échéances ;
5. accuser réception ;
6. suivre l’évolution de son enfant ;
7. recevoir des rappels ;
8. agir avant que les difficultés ne deviennent graves.

Cette logique renforce fortement le lien école-parent et donne à Academia Helm une vraie valeur de suivi pédagogique quotidien.
