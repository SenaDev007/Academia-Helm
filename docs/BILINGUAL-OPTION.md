# Option Bilingue — Academia Helm

## Vue d'ensemble

L'option bilingue permet aux écoles français + anglais d'avoir une **séparation nette** entre les matières, classes, notes et bulletins du français (FR) et de l'anglais (EN).

## Source de vérité unique

`SettingsBilingual.isEnabled` (table `settings_bilingual`) est la **source de vérité unique**. Quand cette valeur change :
- `TenantFeature.BILINGUAL_TRACK` est synchronisé automatiquement (activation → crée l'`AcademicTrack` EN, désactivation → le supprime)
- `Subscription.bilingualEnabled` est mis à jour (pour la facturation)
- Le frontend est notifié via l'événement `settings-bilingual-updated`

## Règles métier

1. **Activation** : Paramètres → Bilingue → Activer → migration des données existantes (FR par défaut, EN inféré depuis `AcademicClass.languageTrack`)
2. **Séparation des matières** : `Subject.language` ('FR' ou 'EN') — filtré dans `findAllSubjects`
3. **Séparation des classes** : `Class.language` et `AcademicClass.languageTrack` — filtrés dans les listes
4. **Séparation des notes/examens** : `Exam.language`, `ExamScore.language`, `Grade.language` — filtrés dans `findAllExams`
5. **Bulletins séparés** : `ReportCard.language` — si `separateGrades=true`, deux bulletins par élève (FR + EN)
6. **Les élèves ne sont PAS dupliqués** — ils restent les mêmes, seule la structure pédagogique se sépare

## Modules affectés

| Module | Sélection FR/EN | Filtre par langue |
|---|---|---|
| **Pédagogie → Matières** | Sélecteur FR/EN | `?language=FR\|EN` sur GET subjects |
| **Pédagogie → Classes** | Tabs "Vue FR \| Vue EN" | Filtre côté client par `languageTrack` |
| **Pédagogie → EDT** | Sélecteur FR/EN | Filtre par `Subject.language` |
| **Pédagogie → Affectations** | Sélecteur FR/EN | Filtre par langue de la matière |
| **Examens → Notes** | Sélecteur FR/EN | `?language=FR\|EN` sur GET exams |
| **Examens → Bulletins** | Sélecteur FR/EN | `?language=FR\|EN` sur GET report-cards |
| **Examens → Évaluations** | Sélecteur FR/EN | `?language=FR\|EN` |
| **Examens → Validation** | Sélecteur FR/EN | Filtre client par `subject.language` |
| **Examens → Moyennes** | Sélecteur FR/EN | `?language=FR\|EN` |
| **Examens → Statistiques** | Sélecteur FR/EN | (UI statique) |

## Migration (M1)

`BilingualSettingsService.startMigration()` effectue :
1. Création de l'`AcademicTrack` EN (via feature flag)
2. Inférence de la langue depuis `AcademicClass.languageTrack='EN'` → marque les Subjects/Exams/Grades liés comme EN
3. Backfill FR sur toutes les données restantes sans langue (Subject, Grade, ExamScore, ReportCard)
4. Backfill `Class.language` depuis `AcademicClass.languageTrack`
5. Backfill `Exam.language` depuis `Subject.language`

## Fichiers clés

### Backend
- `settings/services/bilingual-settings.service.ts` — Service principal (source de vérité + migration)
- `pedagogy/subjects-prisma.service.ts` — Filtre `language` sur `findAllSubjects`
- `pedagogy/subjects-prisma.controller.ts` — `@Query('language')` exposé
- `exams-grades/exams-prisma.service.ts` — Filtre `language` sur `findAllExams` + `createExam` déduit la langue
- `exams-grades/exams-prisma.controller.ts` — `@Query('language')` exposé
- `exams-grades/report-cards-prisma.service.ts` — Bulletins séparés FR/EN

### Frontend
- `contexts/BilingualContext.tsx` — Contexte React (isEnabled, currentTrack, setCurrentTrack)
- `components/pedagogy/subjects/SubjectsWorkspace.tsx` — Sélecteur FR/EN + filtre
- `components/pedagogy/academic-structure/AcademicStructureWorkspace.tsx` — Tabs Vue FR/EN
- `components/pedagogy/timetables/TimetablesWorkspace.tsx` — Sélecteur + filtre
- `components/pedagogy/assignments/AssignmentsWorkspace.tsx` — Sélecteur + filtre
- `app/(app)/exams/*/page.tsx` — Sélecteur FR/EN sur 6 pages examens
- `app/(app)/settings/page.tsx` — Onglet Bilingue (masqué si plan non éligible)

### Schéma Prisma
- `Subject.language` (String?) — FR/EN
- `Grade.language` (String?) — FR/EN
- `ExamScore.language` (String?) — FR/EN
- `ReportCard.language` (String?) — FR/EN
- `Exam.language` (String?) — FR/EN (ajouté migration 20260619)
- `Class.language` (String?) — FR/EN (ajouté migration 20260619)
- `AcademicClass.languageTrack` (String?) — FR/EN (existant)
- `SettingsBilingual` — Configuration bilingue par tenant

## Composants dépréciés
- `components/settings/PedagogicalOptionsSettings.tsx` — Orphelin, marqué @deprecated. L'activation se fait via l'onglet Bilingue de Settings.
