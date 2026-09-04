-- ⭐ V10e — Annotations anglophones des bulletins (page 2 du carnet EN)
-- Ces colonnes existaient dans le schéma Prisma (ReportCard) mais AUCUNE
-- migration ne les avait créées → P2022 « Colonne manquante » sur
-- PATCH /institutional-exams/bulletins/annotations (remarques Head Teacher,
-- broadsheet EN page 2). Colonnes nullable TEXT — ALTER sûr.

ALTER TABLE "report_cards" ADD COLUMN "enTeacherComment" TEXT;
ALTER TABLE "report_cards" ADD COLUMN "enDirectorComment" TEXT;
ALTER TABLE "report_cards" ADD COLUMN "enAffectiveAssessment" TEXT;
ALTER TABLE "report_cards" ADD COLUMN "enPsychomotorAssessment" TEXT;
