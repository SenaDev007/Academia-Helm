# Addendum Offline-First — Transfert inter-écoles et double identification de l’élève

## 1. Objet de l’addendum

Cet addendum complète le document :

```txt
Cahier technique Offline-First — Academia Helm + Academia Federis
```

Il ajoute un point critique oublié : la gestion du **transfert inter-écoles des élèves** avec distinction obligatoire entre :

```txt
1. Identifiant global Academia Helm
2. Matricule local spécifique à chaque école
```

Cette règle doit être intégrée dans l’architecture Offline-First, dans le module Élèves, dans le transfert inter-écoles et dans les synchronisations avec Academia Federis.

---

# 2. Décision produit officielle

Dans Academia Helm, chaque élève doit disposer de deux niveaux d’identification :

```txt
global_student_id
local_student_matricule
```

## 2.1 Identifiant global Academia Helm

L’identifiant global est l’identité permanente de l’élève dans tout l’écosystème Academia Helm.

Il reste stable même si l’élève change :

- d’école ;
- de niveau ;
- de classe ;
- de cycle ;
- d’année scolaire ;
- de tenant scolaire ;
- de patronat associé via Academia Federis.

Nom technique recommandé :

```txt
global_student_id
```

Exemple :

```txt
AH-STU-2026-000000123
```

ou, en version UUID technique :

```txt
student_global_uuid
```

## 2.2 Matricule local de l’école

Le matricule local est l’identifiant administratif attribué par une école selon ses propres standards internes.

Nom technique recommandé :

```txt
local_student_matricule
```

Exemples :

```txt
ELV-2026-045
CSL/PRIM/2026/012
MAT-SEC-3E-089
```

---

# 3. Règle centrale

```txt
Un élève garde toujours le même identifiant global Academia Helm.
Chaque école peut lui attribuer son propre matricule local.
```

Donc :

```txt
global_student_id = identité système permanente
local_student_matricule = identité administrative locale dans l’école
```

Cette séparation est obligatoire.

---

# 4. Transfert inter-écoles

Lorsqu’un élève est transféré d’une école A vers une école B :

- l’élève conserve son `global_student_id` ;
- l’école A conserve son historique local ;
- l’école B crée une nouvelle inscription locale ;
- l’école B attribue son propre `local_student_matricule` ;
- le dossier scolaire transféré est rattaché au même identifiant global ;
- les historiques restent séparés par école, année scolaire et inscription.

## 4.1 Exemple fonctionnel

```txt
Élève : KOFFI David

Identifiant global Academia Helm :
AH-STU-2026-000000123

École A :
Matricule local : EPA/2026/045
Année scolaire : 2026-2027
Classe : CM1

Transfert vers École B :
Identifiant global conservé : AH-STU-2026-000000123
Nouveau matricule local : EPB/2027/018
Année scolaire : 2027-2028
Classe : CM2
```

Le système doit donc comprendre qu’il s’agit du même élève, mais avec deux contextes scolaires différents.

---

# 5. Modèle de données recommandé

## 5.1 Table students

```txt
students
- id
- global_student_id
- first_name
- last_name
- gender
- birth_date
- birth_place
- national_identifier_optional
- status
- created_at
- updated_at
```

## 5.2 Table student_school_enrollments

```txt
student_school_enrollments
- id
- global_student_id
- school_id
- academic_year_id
- academic_term_id
- local_student_matricule
- level
- class_id
- enrollment_status
- entry_date
- exit_date
- transfer_status
- created_at
- updated_at
```

## 5.3 Table student_transfers

```txt
student_transfers
- id
- global_student_id
- source_school_id
- destination_school_id
- source_academic_year_id
- destination_academic_year_id
- source_local_matricule
- destination_local_matricule
- transfer_reason
- transfer_status
- requested_by
- approved_by_source
- approved_by_destination
- requested_at
- approved_at
- completed_at
- created_at
- updated_at
```

---

# 6. Statuts de transfert

```txt
DRAFT
REQUESTED
SENT_TO_DESTINATION
ACCEPTED_BY_DESTINATION
REJECTED_BY_DESTINATION
APPROVED_BY_SOURCE
COMPLETED
CANCELLED
ARCHIVED
```

---

# 7. Données transférables

Lors d’un transfert, l’école source peut transmettre :

- identité de l’élève ;
- dossier scolaire ;
- bulletins ;
- notes ;
- présences ;
- absences ;
- discipline ;
- observations pédagogiques ;
- documents administratifs ;
- historique de classe ;
- situation financière selon autorisation ;
- pièces jointes ;
- certificat de scolarité ;
- certificat de transfert.

---

# 8. Données non transférables automatiquement

Certaines données ne doivent pas être transférées sans autorisation explicite :

- données financières détaillées ;
- informations sensibles ;
- sanctions disciplinaires sensibles ;
- documents confidentiels ;
- données médicales éventuelles ;
- informations internes propres à l’école source.

---

# 9. Impact Offline-First

Le transfert inter-écoles est une action sensible.

## 9.1 Hors ligne, l’utilisateur peut préparer

```txt
brouillon de demande de transfert
sélection des documents à transférer
préparation du dossier
commentaire administratif
prévisualisation du certificat
```

## 9.2 Internet obligatoire pour

```txt
envoi officiel de la demande
notification de l’école destination
acceptation ou rejet du transfert
validation finale
création officielle de l’inscription dans l’école destination
attribution définitive du nouveau matricule local
synchronisation du dossier complet
```

## 9.3 Règle offline critique

```txt
Aucun transfert inter-écoles ne devient officiel sans synchronisation serveur.
```

Le mode offline peut préparer le transfert, mais ne peut pas le finaliser.

---

# 10. Gestion des conflits

Conflits possibles :

- deux écoles tentent de créer le même élève ;
- une école destination attribue un matricule déjà utilisé ;
- l’école source modifie le dossier pendant la demande ;
- le parent fournit des informations différentes ;
- l’année scolaire active change pendant le processus ;
- le même élève est inscrit deux fois avec deux identités locales différentes.

Résolution recommandée :

```txt
MANUAL_REVIEW
ROLE_PRIORITY
AUDIT_REQUIRED
NO_AUTOMATIC_MERGE_FOR_SENSITIVE_DATA
```

---

# 11. Règles de sécurité

- seul un utilisateur habilité peut initier un transfert ;
- l’école source doit valider l’envoi ;
- l’école destination doit accepter ;
- toutes les actions doivent être journalisées ;
- le parent peut être notifié selon configuration ;
- le dossier transféré doit rester traçable ;
- l’identifiant global ne doit jamais être modifié manuellement ;
- le matricule local doit respecter les règles de l’école destination.

---

# 12. Impact Academia Federis

Academia Federis doit utiliser le `global_student_id` lorsqu’un élève participe à un examen patronal.

Cela permet :

- d’éviter les doublons de candidats ;
- de suivre un élève même s’il change d’école ;
- de conserver l’historique des examens ;
- de rattacher correctement les résultats aux parents ;
- de synchroniser les résultats vers Academia Helm.

Cependant, dans les rapports par école, Academia Federis doit aussi afficher le `local_student_matricule` de l’école concernée.

Les résultats Federis doivent donc pouvoir afficher :

```txt
global_student_id
local_student_matricule
school_id
academic_year_id
exam_id
candidate_number
```

---

# 13. Impact sur la synchronisation

La synchronisation doit toujours distinguer :

```txt
identité globale de l’élève
inscription locale dans une école
matricule local de cette école
année scolaire concernée
```

Il ne faut jamais synchroniser un élève uniquement sur la base du matricule local.

Le matricule local peut être identique dans deux écoles différentes. Il n’est donc pas une clé globale.

La clé globale est :

```txt
global_student_id
```

---

# 14. Règles métier critiques à ajouter au cahier Offline-First

```txt
1. Aucun élève ne doit être identifié globalement par son matricule local.
2. Le matricule local appartient à une école et à une inscription.
3. Le global_student_id appartient à l’élève dans tout Academia Helm.
4. Un transfert conserve toujours le global_student_id.
5. L’école destination attribue son propre local_student_matricule.
6. Le transfert peut être préparé hors ligne mais jamais finalisé hors ligne.
7. Toute finalisation de transfert nécessite une synchronisation serveur.
8. Academia Federis doit utiliser global_student_id pour éviter les doublons candidats.
9. Les rapports par école doivent afficher le matricule local de l’école concernée.
10. Toute modification sensible liée au transfert doit être auditée.
```

---

# 15. Conclusion

La gestion des élèves dans Academia Helm doit impérativement distinguer :

```txt
Identité globale système
Identité locale école
```

Cette séparation rend le système plus robuste, plus professionnel et plus réaliste.

Elle permet à Academia Helm de gérer proprement :

- les transferts inter-écoles ;
- les historiques scolaires ;
- les examens Academia Federis ;
- les statistiques longitudinales ;
- les synchronisations offline-first ;
- les dossiers élèves sans doublons ;
- les rapports par école avec matricule local.

Cette règle doit être intégrée dans le document Offline-First principal et dans le module Élèves d’Academia Helm.
