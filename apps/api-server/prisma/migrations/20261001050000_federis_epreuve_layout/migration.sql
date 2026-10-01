-- ⭐ Academia Federis — MISE EN PAGE DU SUJET (2026-09-30)
-- Retours utilisateur sur le module « Épreuves et documents » :
--   • MISE EN VALEUR DES INTITULÉS — le patronat peut mettre en gras,
--     souligner, mettre en italique et ajuster la taille des intitulés
--     structurants (« Situation d'évaluation », « Tâche », titres des
--     sections libres : Problème, Exercice, Consigne, Item…) :
--     labelStyle = { bold, underline, italic, fontSize } ;
--   • COPIES DU SUJET PAR PAGE A4 — pour les petites épreuves, le sujet est
--     dupliqué 2 ou 3 fois sur un seul A4 (bandes de hauteur fixe + lignes
--     de découpe ✂) : copiesPerPage = 1 | 2 | 3 ;
--   • FILIGRANE — logo du patronat (module Paramètres de Fédéris) ou texte
--     personnalisé, répété sur toutes les pages du PDF :
--     watermarkMode = none | logo | text (+ watermarkText).
--
-- ⚠️ 100 % IDEMPOTENTE (miroir de l'auto-guérison
-- FederisEpreuveService.ensureSchema — Railway n'exécute pas
-- `prisma migrate deploy` au démarrage, les colonnes sont aussi créées au
-- premier appel du service).

ALTER TABLE "federis_exam_papers"
    ADD COLUMN IF NOT EXISTS "labelStyle" JSONB;

ALTER TABLE "federis_exam_papers"
    ADD COLUMN IF NOT EXISTS "copiesPerPage" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "federis_exam_papers"
    ADD COLUMN IF NOT EXISTS "watermarkMode" TEXT NOT NULL DEFAULT 'none';

ALTER TABLE "federis_exam_papers"
    ADD COLUMN IF NOT EXISTS "watermarkText" TEXT;
