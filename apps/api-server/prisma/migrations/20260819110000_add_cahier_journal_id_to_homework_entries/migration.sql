-- ⭐ Migration : ajout du champ cahierJournalId sur homework_entries
--    Permet de rattacher un devoir/leçon/récitation à une case précise du cahier journal
--    (jour + matière) pour afficher "par rapport à la leçon X du jour Y, voici les exercices donnés"

ALTER TABLE "homework_entries"
  ADD COLUMN IF NOT EXISTS "cahierJournalId" TEXT;

-- ⭐ Index pour filtrer rapidement les homeworks d'un cahier journal donné
CREATE INDEX IF NOT EXISTS "homework_entries_cahier_journal_id_idx"
  ON "homework_entries" ("cahierJournalId");
