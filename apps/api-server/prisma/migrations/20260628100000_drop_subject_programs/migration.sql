-- ============================================================================
-- Drop du modèle SubjectProgram (« Programme officiel »)
-- ============================================================================
-- Contexte :
-- La fonctionnalité « Programme officiel » était un simple dépôt de PDF
-- (base64 en BDD) attaché à chaque matière, avec un workflow d'approbation.
-- Après analyse, cette fonctionnalité n'est consommée par AUCUN autre module
-- (l'IA qui prétendait l'utiliser échouait silencieusement sur des colonnes
-- inexistantes). Sa valeur métier réelle est faible par rapport à un simple
-- dossier Google Drive, et son coût de maintenance (DB bloat, bugs, dette
-- technique) est élevé.
--
-- Décision produit : suppression pure et simple. Si un vrai besoin se
-- manifeste plus tard (IA pédagogique, inspection académique), on repartira
-- sur un modèle structuré (SubjectProgram → ProgramChapter → ProgramLesson)
-- au lieu d'un simple dépôt de PDF.
--
-- Cette migration est idempotente : DROP TABLE IF EXISTS.
-- ============================================================================

DROP TABLE IF EXISTS "pedagogy_subject_programs";

-- Aucun index à supprimer explicitement — ils étaient attachés à la table
-- et sont donc supprimés automatiquement avec elle.
