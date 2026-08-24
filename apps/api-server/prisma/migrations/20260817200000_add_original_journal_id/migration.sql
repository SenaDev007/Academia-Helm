-- Migration : ajout colonne originalJournalId dans cahier_journal_entries
-- Permet de tracer la provenance d'un cahier journal dupliqué depuis une année précédente
-- (bouton "Réutiliser" dans le Catalogue de l'espace pédagogique enseignant).
-- Quand un cahier journal est créé par duplication, originalJournalId contient l'ID
-- du cahier journal source (année précédente).

ALTER TABLE "cahier_journal_entries"
  ADD COLUMN IF NOT EXISTS "originalJournalId" TEXT;

-- Index pour accélérer les recherches de cahiers journaux dupliqués depuis une source
CREATE INDEX IF NOT EXISTS "cahier_journal_entries_original_journal_id_idx"
  ON "cahier_journal_entries" ("originalJournalId")
  WHERE "originalJournalId" IS NOT NULL;
