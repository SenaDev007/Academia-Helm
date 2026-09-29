-- ═══════════════════════════════════════════════════════════════════════════
-- Module « Notes et Moyennes » (Academia Federis — 2026-09-29)
--
-- Saisie des notes par examen national (CEP / BEPC / BAC / CAP), registre des
-- notes et relevés de notes. Le marquage des ABSENTS par épreuve exige une
-- colonne dédiée : une note absente existe (score 0 pour respecter la contrainte
-- NOT NULL) mais est EXCLUE des totaux, moyennes et classements.
-- Idempotent (pattern migrations federis 20260929160000 / 20260929170000).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "exam_results" ADD COLUMN IF NOT EXISTS "isAbsent" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "exam_results_examId_isAbsent_idx"
    ON "exam_results"("examId", "isAbsent");
