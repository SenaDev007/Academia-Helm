# Academia Federis — Règle stricte Année Scolaire / Trimestre

## 1. Décision produit

Academia Federis doit appliquer la même logique académique qu’Academia Helm :

> Aucune donnée métier ne doit exister sans rattachement à une année scolaire.

Cette règle est obligatoire pour garantir la cohérence des examens, des communications, des inscriptions, des résultats, des statistiques et des rapports institutionnels.

## 2. Principe fondamental

Toute donnée créée dans Academia Federis doit être liée au minimum à :

- une année scolaire ;
- un trimestre ou une période académique lorsque le contexte l’exige ;
- un patronat ;
- éventuellement une école ;
- éventuellement un examen ;
- éventuellement une classe d’examen ;
- éventuellement une session.

## 3. Règle métier centrale

```txt
NO ACADEMIC YEAR = NO DATA
```

Aucune donnée opérationnelle ne doit être enregistrée sans `academic_year_id`.

Pour les données liées à une période d’évaluation ou d’examen, le champ `term_id` ou `academic_period_id` devient également obligatoire.

## 4. Données concernées

La règle s’applique à tous les modules d’Academia Federis :

- patronats ;
- écoles rattachées ;
- examens ;
- sessions d’examen ;
- classes d’examen ;
- candidats ;
- centres d’examen ;
- surveillants ;
- correcteurs ;
- compositions ;
- notes ;
- résultats ;
- délibérations ;
- statistiques ;
- rapports ;
- communiqués ;
- messages officiels ;
- groupes de coordination ;
- communautés liées aux examens ;
- documents partagés ;
- notifications ;
- paiements liés à une période scolaire ;
- abonnements opérationnels ;
- audit logs métier.

## 5. Données globales non académiques

Certaines données peuvent exister sans année scolaire uniquement si elles sont purement structurelles :

- compte utilisateur ;
- profil patronat ;
- paramètres globaux du patronat ;
- plan d’abonnement ;
- configuration SaaS ;
- rôles et permissions ;
- paramètres de sécurité ;
- configuration générale de l’application ;
- templates globaux.

Même dans ce cas, dès qu’une donnée devient opérationnelle ou académique, elle doit recevoir un `academic_year_id`.

## 6. Structure recommandée

### 6.1 Table academic_years

```txt
academic_years
- id
- label
- start_date
- end_date
- status
- is_current
- auto_generated
- created_at
- updated_at
```

Statuts possibles :

```txt
DRAFT
ACTIVE
LOCKED
ARCHIVED
```

### 6.2 Table academic_terms

```txt
academic_terms
- id
- academic_year_id
- name
- term_number
- start_date
- end_date
- status
- created_at
- updated_at
```

Exemples :

```txt
Trimestre 1
Trimestre 2
Trimestre 3
Session annuelle
Session spéciale
Session de rattrapage
```

## 7. Automatisation de l’année scolaire

Academia Federis doit reprendre le même système d’automatisation qu’Academia Helm.

Fonctionnalités attendues :

- génération automatique de la nouvelle année scolaire ;
- activation de l’année scolaire courante ;
- verrouillage de l’année précédente ;
- archivage des données anciennes ;
- bascule contrôlée vers la nouvelle année ;
- conservation des historiques ;
- duplication optionnelle de certaines configurations ;
- remise à zéro des données opérationnelles de session ;
- maintien des données structurelles.

## 8. Sélecteur d’année scolaire

Tous les dashboards Academia Federis doivent afficher un sélecteur d’année scolaire.

Emplacements recommandés :

- header principal ;
- filtres des pages de listing ;
- tableaux de bord ;
- rapports ;
- statistiques ;
- pages examens ;
- pages résultats ;
- pages communications.

Le sélecteur doit permettre :

- consulter l’année active ;
- consulter les années archivées ;
- filtrer les examens par année ;
- filtrer les résultats par année ;
- filtrer les statistiques par année ;
- empêcher la modification des années verrouillées sauf permission spéciale.

## 9. Règles de verrouillage

Quand une année scolaire est verrouillée :

- les résultats ne peuvent plus être modifiés ;
- les notes ne peuvent plus être changées ;
- les délibérations sont figées ;
- les rapports restent consultables ;
- les exports restent disponibles ;
- les corrections nécessitent une autorisation spéciale ;
- toute modification exceptionnelle est auditée.

## 10. Impact sur les examens

Chaque examen doit obligatoirement contenir :

```txt
academic_year_id
academic_term_id / academic_period_id
patronat_id
exam_type
exam_level
session_id
status
```

Exemples :

```txt
CEP Blanc Départemental — 2026-2027 — Trimestre 2
BEPC Blanc Inter-écoles — 2026-2027 — Trimestre 3
BAC Blanc Patronat Atlantique — 2026-2027 — Session annuelle
```

## 11. Impact sur les écoles rattachées

Le rattachement d’une école à un patronat peut être global, mais sa participation opérationnelle doit être annuelle.

Créer une table de liaison annuelle :

```txt
federis_school_year_memberships
- id
- patronat_id
- school_id
- academic_year_id
- status
- total_students_snapshot
- cm2_students_snapshot
- troisieme_students_snapshot
- terminale_students_snapshot
- created_at
- updated_at
```

## 12. Impact sur Federis Connect

Les communications doivent aussi être contextualisées.

Champs recommandés à ajouter :

```txt
academic_year_id
academic_term_id
exam_id
school_year_membership_id
```

Règle :

- un communiqué général institutionnel peut être global ;
- un communiqué lié à une année scolaire doit avoir `academic_year_id` ;
- un communiqué lié à un examen doit avoir `exam_id` et `academic_year_id` ;
- un groupe de coordination d’examen doit être lié à l’année scolaire et à l’examen.

## 13. Impact sur les statistiques

Toutes les statistiques doivent être filtrables par :

- année scolaire ;
- trimestre ;
- patronat ;
- école ;
- examen ;
- niveau ;
- commune ;
- centre ;
- sexe si disponible ;
- statut candidat.

## 14. Impact sur les parents via Academia Helm

Les notifications envoyées aux parents doivent préciser :

- année scolaire ;
- examen ;
- trimestre ou session ;
- école ;
- classe ;
- résultat ou performance.

## 15. Schéma technique minimal à imposer

Toutes les tables métier doivent contenir :

```txt
academic_year_id String
academic_term_id String?
```

Tables critiques :

```txt
federis_exams
federis_exam_sessions
federis_exam_candidates
federis_exam_centers
federis_exam_subjects
federis_exam_marks
federis_exam_results
federis_deliberations
federis_school_year_memberships
federis_official_notices
federis_groups
federis_communities
federis_messages
federis_shared_documents
federis_reports
federis_statistics_snapshots
```

## 16. Middleware / Guard recommandé

Créer un guard applicatif :

```txt
requireAcademicYear()
```

Rôle :

- vérifier qu’une année scolaire active existe ;
- empêcher la création de données sans année scolaire ;
- injecter automatiquement l’année scolaire active si le contexte le permet ;
- bloquer les écritures sur une année verrouillée ;
- autoriser les exceptions uniquement aux rôles habilités.

## 17. Permissions recommandées

```txt
FEDERIS_ACADEMIC_YEAR_VIEW
FEDERIS_ACADEMIC_YEAR_CREATE
FEDERIS_ACADEMIC_YEAR_ACTIVATE
FEDERIS_ACADEMIC_YEAR_LOCK
FEDERIS_ACADEMIC_YEAR_ARCHIVE
FEDERIS_ACADEMIC_YEAR_REOPEN
FEDERIS_TERM_MANAGE
FEDERIS_YEAR_SWITCH
FEDERIS_LOCKED_YEAR_EDIT
```

## 18. Règles UI/UX

L’interface doit toujours afficher :

- année scolaire active ;
- trimestre actif si applicable ;
- statut de l’année ;
- badge année verrouillée si nécessaire ;
- filtre d’année sur toutes les pages sensibles ;
- message d’alerte si aucune année active n’existe.

Message recommandé :

```txt
Aucune année scolaire active n’est configurée. Veuillez activer une année scolaire avant de créer des données.
```

## 19. Règles d’importation

Lorsqu’un patronat importe des écoles, candidats ou résultats :

- l’année scolaire doit être demandée ;
- le trimestre ou la session doit être demandé si nécessaire ;
- l’import doit être refusé si l’année est verrouillée ;
- chaque ligne importée doit hériter de `academic_year_id`.

## 20. Conclusion

Academia Federis doit être strictement aligné sur Academia Helm :

```txt
Année scolaire obligatoire
Trimestre ou période obligatoire selon contexte
Aucune donnée métier hors année scolaire
Automatisation de l’année scolaire
Verrouillage et archivage
Filtrage global
Audit des modifications sensibles
```
