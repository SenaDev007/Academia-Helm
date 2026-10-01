-- ⭐ 2026-10-01 — Ajout du champ educ_master_matricule à la table students
--    Numéro Educmaster (identifiant attribué par la plateforme MEMP du gouvernement béninois).
--    Requis pour l'export Educmaster des élèves de 6e vers la plateforme gouvernementale.
--    Format : 13 chiffres (ex: 1130424010714). Optionnel pour les autres classes.

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "educ_master_matricule" TEXT;

-- ⭐ Index pour accélérer les recherches par matricule Educmaster (utile pour
--    l'export Secondaire qui filtre par cette colonne).
CREATE INDEX IF NOT EXISTS "students_educ_master_matricule_idx"
  ON "students" ("educ_master_matricule")
  WHERE "educ_master_matricule" IS NOT NULL;
