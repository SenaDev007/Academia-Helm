-- ═══════════════════════════════════════════════════════════════════════════
-- Paramètres — Règles de calcul : MODÈLE DE CALCUL paramétrable (2026-09-30)
--
-- Suite de 20260930100000_federis_grading_rules : la demande utilisateur exige
-- « la latitude de configurer le modèle de calcul pour les différents niveaux ».
-- La colonne averageModel stocke le choix du patronat :
--   · 'simple'   → moyenne simple   Σ notes / nombre d'épreuves ;
--   · 'ponderee' → moyenne pondérée Σ(note × coef) / Σcoef ;
--   · NULL       → DÉFAUT DU BACKEND (CEP = simple, BEPC/BAC/CAP = pondérée).
--
-- Dès qu'une valeur est définie, elle devient la source de vérité du moteur
-- de calcul (saisie live, registre, relevés, délibération, PDF, palmarès).
--
-- ⚠️ 100 % IDEMPOTENTE — no-op si la colonne existe déjà.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "federis_grading_rules" ADD COLUMN IF NOT EXISTS "averageModel" TEXT;
