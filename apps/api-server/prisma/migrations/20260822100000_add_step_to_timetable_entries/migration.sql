-- ⭐ Ajout de la colonne `step` sur timetable_entries
--    Permet de spécifier l'étape (1 à 8) couverte par une séance de Lecture-Écriture
--    au CI/CP. L'utilisateur peut saisir :
--      - Une étape unique : "Étape 1", "Étape 2", ..., "Étape 8"
--      - Une plage d'étapes : "Étapes 1-2", "Étapes 2-3", ..., "Étapes 7-8"
--    Le champ est optionnel (NULL) — n'affecte pas les séances sans étape.
--
--    Exemples d'usage :
--      - Séance "Lecture-Écriture" avec étape 1 → step = "Étape 1"
--      - Séance "Lecture-Écriture" avec étapes 1 et 2 → step = "Étapes 1-2"
--      - Séance "Mathématiques" sans étape → step = NULL

ALTER TABLE "timetable_entries" ADD COLUMN "step" TEXT;
