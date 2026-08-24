-- ============================================================================
-- Migration : Nettoyage des fiches pédagogiques + cahiers journal soumis
-- ============================================================================
--
-- Objectif : Supprimer toutes les fiches pédagogiques et cahiers journal
-- qui ont été soumis au directeur, pour permettre une nouvelle soumission
-- propre après les corrections (signatures, liaisons, etc.).
--
-- Actions :
--   1. Supprimer TOUTES les fiches pédagogiques (SUBMITTED + VALIDATED + REJECTED)
--   2. Reset les cahiers journal SUBMITTED/VALIDATED/REJECTED → DRAFT
--      (on garde les données du cahier journal, on reset juste le statut)
--   3. Clear les signatures + observations du directeur sur les cahiers journal
--   4. Clear le cahierJournalId sur les fiches supprimées (cascade)
-- ============================================================================

-- ═══ 1. Supprimer TOUTES les fiches pédagogiques soumisées/validées/rejetées ═══
DELETE FROM "primary_pedagogical_fiches"
WHERE "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED');

-- ═══ 2. Reset les cahiers journal SUBMITTED/VALIDATED/REJECTED → DRAFT ═══
UPDATE "cahier_journal_entries"
SET "status" = 'DRAFT',
    "submittedAt" = NULL,
    "directorSignature" = NULL,
    "directorValidatedAt" = NULL,
    "rejectionReason" = NULL,
    "updatedAt" = NOW()
WHERE "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED');

-- ═══ 3. Clear les observations du directeur dans les entries JSON ═══
--    (les entries contiennent des directorObservation qu'on veut effacer)
UPDATE "cahier_journal_entries"
SET "entries" = (
  SELECT jsonb_object_agg(key, value - 'directorObservation')
  FROM jsonb_each("entries"::jsonb)
)
WHERE "entries" IS NOT NULL
  AND "entries"::jsonb ?| array['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];

-- ═══ 4. Reset les registres d'appel soumis → DRAFT (pour cohérence) ═══
UPDATE "attendance_registers"
SET "status" = 'DRAFT',
    "submittedAt" = NULL,
    "directorSignature" = NULL,
    "directeurSignatureDate" = NULL,
    "validatedAt" = NULL,
    "validatedBy" = NULL,
    "rejectionReason" = NULL,
    "updatedAt" = NOW()
WHERE "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED');

-- ═══ 5. Reset les évaluations mensuelles soumises → DRAFT ═══
UPDATE "monthly_evaluations"
SET "status" = 'DRAFT',
    "submittedAt" = NULL,
    "directorSignature" = NULL,
    "validatedAt" = NULL,
    "validatedBy" = NULL,
    "rejectionReason" = NULL,
    "updatedAt" = NOW()
WHERE "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED');

-- ═══ 6. Reset les cahiers de test/texte soumis → DRAFT ═══
UPDATE "cahier_textes"
SET "status" = 'DRAFT',
    "submittedAt" = NULL,
    "directorSignature" = NULL,
    "validatedAt" = NULL,
    "validatedBy" = NULL,
    "rejectionReason" = NULL,
    "updatedAt" = NOW()
WHERE "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED');
