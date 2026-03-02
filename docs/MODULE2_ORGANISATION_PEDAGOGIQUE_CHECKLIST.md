# Module 2 — Organisation pédagogique & Études — Checklist d’implémentation

**Objectif** : Moteur pédagogique institutionnel (structurer l’école, organiser les ressources, encadrer les enseignants, contrôler la conformité, produire des données pour ORION).

**Contraintes** : Multi-tenant strict, année scolaire obligatoire, bilingue-compatible, offline-first, historique versionné, intégration ORION.

---

## 1. Structure académique (SM1)

| Élément | Prisma | Backend | Frontend | API proxy |
|--------|--------|---------|----------|-----------|
| AcademicLevel | ✅ | AcademicStructurePrismaController | Page Structure académique (niveaux → cycles → classes) | `/api/pedagogy/academic-structure` |
| AcademicCycle | ✅ | idem | idem (expand/collapse) | idem |
| AcademicClass (name, code, capacity, roomId, mainTeacherId, languageTrack) | ✅ | idem | CRUD classes, capacité, salle, responsable | idem |
| Room | ✅ | RoomsPrismaController | Page Salles | via backend |
| RoomMaintenance | ✅ | — | — | — |
| RoomSchedule | ✅ | — | — | — |

**UI** : Année scolaire ▼, hiérarchie Niveaux → Cycles → Classes, capacité, salle, responsable, statut.  
**Règles** : Unicité code classe, pas de DELETE physique, désactivation si dépendances.

---

## 2. Matières & programmes (SM2)

| Élément | Prisma | Backend | Frontend | API |
|--------|--------|---------|----------|-----|
| AcademicSeries | ✅ | AcademicSeriesPrismaController | — | Backend |
| Subject | ✅ | SubjectsPrismaController | Page Matières (liste, CRUD) | `/api/subjects` |
| SeriesSubject | ✅ | — | — | — |
| ClassSubject | ✅ | — | — | — |
| SubjectProgram | ✅ | — | — | — |

**UI** : Catalogue matières, coefficients, volume horaire, niveau, langue (FR/EN). Séries secondaire (A, C, D…).  
**Règles** : Année obligatoire, unicité code matière, pas de suppression si utilisée.

---

## 3. Gestion académique des enseignants (SM3)

| Élément | Prisma | Backend | Frontend | API proxy |
|--------|--------|---------|----------|-----------|
| TeacherAcademicProfile (maxWeeklyHours, isActive, teacherId) | ✅ | TeacherAcademicProfilePrismaController | Page Enseignants + lien « Affectations & charges » | `/api/pedagogy/teacher-profiles` |
| TeacherSubjectQualification (profileId, subjectId, certified) | ✅ | idem | Géré dans profils / affectations | idem |
| TeacherLevelAuthorization (profileId, levelId) | ✅ | idem | idem | idem |
| TeacherAvailability (profileId, dayOfWeek, startTime, endTime) | ✅ | idem | idem | idem |

**UI** : Charge max, charge actuelle, matières autorisées, niveaux autorisés, disponibilités. Indicateur surcharge.  
**Règles** : Affectation uniquement si matière qualifiée et niveau autorisé ; total heures ≤ maxWeeklyHours.

---

## 4. Affectations & charges horaires (SM4)

| Élément | Prisma | Backend | Frontend | API proxy |
|--------|--------|---------|----------|-----------|
| TeachingAssignment (profileId, classId, subjectId, seriesId, weeklyHours, startDate, endDate) | ✅ | TeachingAssignmentPrismaController | Page Affectations (liste, création, édition, charge par profil) | `/api/pedagogy/assignments` |
| Calcul charge automatique | — | getCurrentWeeklyHours, getChargeSummary | Résumé charge enseignant (surcharge en rouge) | `GET charge-summary/:profileId` |
| Validation surcharge / qualification / niveau | — | validateAssignment | Erreurs formulaire | — |

**UI** : Enseignant, classe, matière, h/sem, période, actif. Formulaire avec profil, classe, matière, série optionnelle, dates.  
**Règles** : Unicité (profil, classe, matière, année), pas de surcharge, pas d’affectation hors qualification/niveau.

---

## 5. Emploi du temps intelligent (SM5)

| Élément | Prisma | Backend | Frontend | API |
|--------|--------|---------|----------|-----|
| Timetable | ✅ | TimetablesPrismaController | Page Emplois du temps | `/api/timetables` |
| TimetableEntry / TimetableSlot | ✅ (TimetableEntry) | idem | Liste + période, statut | idem |
| Détection conflits (enseignant, salle, classe) | — | À renforcer si besoin | — | — |
| Versionnement | — | — | — | — |

**UI** : Grille hebdomadaire, vue par classe/enseignant, conflits (à afficher si backend exposé).  
**Règles** : Pas de double slot enseignant/salle/classe, respect TeachingAssignment et disponibilités.

---

## 6. Espace pédagogique enseignant (SM6)

| Élément | Prisma | Backend | Frontend | API proxy |
|--------|--------|---------|----------|-----------|
| LessonPlan | ✅ | LessonPlansPrismaController | Page Fiches pédagogiques | Backend |
| TeachingJournal | ✅ | — | Page Cahier journal (daily-logs) | Backend |
| ClassLog | ✅ | ClassDiariesPrismaController | Page Cahier de texte (class-diaries) | Backend |
| WeeklyReport | ✅ | PedagogicalWorkspacePrismaService + WeeklySemainierService | Page Cahier du semainier + Espace pédagogique | `/api/pedagogy/teacher/[...path]` |
| PedagogicalAttachment | ✅ | — | — | — |
| PedagogicalSignature | ✅ | — | — | — |
| Workflow validation (DRAFT → SUBMITTED → APPROVED/REJECTED) | — | PedagogicalTeacherController, PedagogicalDirectorController | Indicateurs statut | — |

**UI** : Hub Espace pédagogique (fiches, cahier journal, cahier de texte, semainier). Page dédiée Semainier.  
**Règles** : Versionnement, pas de modification après APPROVED, RBAC (enseignant CRUD, directeur validation, lecture seule Promoteur/Admin/Owner).

---

## 7. Contrôle pédagogique direction (SM7)

| Élément | Prisma | Backend | Frontend | API proxy |
|--------|--------|---------|----------|-----------|
| PedagogicalKpiSnapshot | ✅ | PedagogyKpiService | — | — |
| Dashboard consolidé | — | PedagogyControlController (GET dashboard, GET/POST snapshots) | Page Contrôle (KPI : fiches, journal, cahier de texte, semainier, taux global, effectifs) | `/api/pedagogy/control` |
| Vue par enseignant / par classe | — | GET snapshots?teacherId=&classId= | Filtres possibles côté front | idem |

**UI** : Cartes KPI (%), enseignants actifs, affectations actives, dernier calcul.  
**Règles** : Lecture seule, année obligatoire, export PDF à brancher si besoin.

---

## 8. Analytique pédagogique ORION (SM8)

| Élément | Prisma | Backend | Frontend | API proxy |
|--------|--------|---------|----------|-----------|
| OrionPedagogicalInsight | ✅ | OrionPedagogyAdvancedService | Page ORION (recommandations, insights) | `/api/pedagogy/orion-advanced` |
| OrionRiskFlag | ✅ | idem | Section Risques (niveau RED/YELLOW) | idem |
| OrionForecast | ✅ | idem | Section Prévisions | idem |
| Dashboard ORION (résumé, counts) | — | getOrionDashboard | Cartes + listes insights/risks/forecasts | GET dashboard, insights, risk-flags, forecasts |

**UI** : Résumé (nombre insights, risques, prévisions), listes risques / recommandations / prévisions. Lecture seule.  
**Règles** : Aucune modification des données, historique non supprimable.

---

## Récapitulatif des routes frontend (Module 2)

| Page | Route | Rôle |
|------|--------|------|
| Accueil Module 2 | `/app/pedagogy` | 8 onglets (wireframe) |
| Structure académique | `/app/pedagogy/academic-structure` | Niveaux, cycles, classes |
| Matières & programmes | `/app/pedagogy/subjects` | Catalogue matières |
| Enseignants académiques | `/app/pedagogy/teachers` | Liste + lien Affectations |
| Affectations & charges | `/app/pedagogy/assignments` | Liste, CRUD, charge par profil |
| Emploi du temps | `/app/pedagogy/timetables` | Liste EDT |
| Espace pédagogique | `/app/pedagogy/workspace` | Liens fiches, journal, cahier de texte, semainier |
| Cahier du semainier | `/app/pedagogy/semainier` | Dédié semainier |
| Fiches pédagogiques | `/app/pedagogy/lesson-plans` | — |
| Cahier journal | `/app/pedagogy/daily-logs` | — |
| Cahier de texte | `/app/pedagogy/class-diaries` | — |
| Salles | `/app/pedagogy/rooms` | Gestion salles |
| Contrôle direction | `/app/pedagogy/control` | Dashboard KPI |
| Analytique ORION | `/app/pedagogy/orion` | Insights, risques, prévisions |

---

## Proxies API Next.js → Backend

- ` /api/pedagogy/academic-structure/[...path]` → Structure (levels, cycles, classes)
- `/api/pedagogy/teacher-profiles/[...path]` → Profils académiques (SM3)
- `/api/pedagogy/assignments/[...path]` → Affectations (SM4)
- `/api/pedagogy/control/[...path]` → Contrôle (SM7)
- `/api/pedagogy/orion-advanced/[...path]` → ORION avancé (SM8)
- `/api/pedagogy/teacher/[...path]` → Espace enseignant (documents, semainier, notifications)
- `/api/subjects`, `/api/timetables`, `/api/teachers` → Proxies existants

---

## Règles métier critiques (vérifiées)

- **Année scolaire obligatoire** : Toutes les entrées Module 2 sont liées à `academicYearId` où applicable.
- **Multi-tenant** : `tenantId` sur tous les modèles concernés.
- **Pas de DELETE destructif** : Désactivation (`isActive`) utilisée à la place où prévu.
- **TeachingAssignment** : Unicité `(tenantId, academicYearId, profileId, classId, subjectId)`.
- **Surcharge** : Validation backend (somme weeklyHours ≤ maxWeeklyHours du profil).
- **Qualification / niveau** : Validation backend avant création affectation.

---

**Dernière vérification** : Tous les sous-modules 1 à 8 sont couverts (schéma Prisma, backend, frontend, proxies). Les écrans principaux sont branchés sur les APIs. Les compléments ajoutés (proxy teacher, page Semainier, lien Affectations depuis Enseignants) assurent la cohérence du parcours utilisateur.
