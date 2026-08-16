-- ============================================================================
-- Migration : PedagogicalSheet — colonnes teacherId + originalSheetId (cross-year reuse)
-- ============================================================================
--
-- Contexte :
-- L'utilisateur veut que les fiches pédagogiques (et cahiers journaux liés)
-- puissent être réutilisées d'une année sur l'autre, même si l'enseignant
-- change. Par exemple : M. ADANDE crée une fiche "Calcul d'aires" pour la 6ème A
-- en 2026-2027. En 2027-2028, Mme HOUNKPE prend la 6ème A — elle doit pouvoir
-- retrouver la fiche de M. ADANDE, la dupliquer vers son année, et l'éditer.
--
-- Cette migration ajoute 2 colonnes :
--   - teacherId : enseignant qui a créé/cette fiche (pour filtrer "mes fiches")
--   - originalSheetId : lien vers la fiche d'origine si dupliquée depuis N-1
--
-- + 3 indexes pour accélérer les requêtes cross-année :
--   - (tenantId, classId, subjectId) : trouver toutes les fiches d'une classe+matière
--   - (teacherId) : "mes fiches"
--   - (originalSheetId) : tracer la lignée d'une fiche
-- ============================================================================

ALTER TABLE "pedagogical_sheets" ADD COLUMN IF NOT EXISTS "teacherId" TEXT;
ALTER TABLE "pedagogical_sheets" ADD COLUMN IF NOT EXISTS "originalSheetId" TEXT;

CREATE INDEX IF NOT EXISTS "pedagogical_sheets_tenant_class_subject_idx"
    ON "pedagogical_sheets"("tenantId", "classId", "subjectId");

CREATE INDEX IF NOT EXISTS "pedagogical_sheets_teacherId_idx"
    ON "pedagogical_sheets"("teacherId")
    WHERE "teacherId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "pedagogical_sheets_originalSheetId_idx"
    ON "pedagogical_sheets"("originalSheetId")
    WHERE "originalSheetId" IS NOT NULL;
