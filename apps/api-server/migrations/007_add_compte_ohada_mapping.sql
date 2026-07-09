-- ============================================================================
-- Migration : Ajout des champs compteOhada + compteOhadaLib pour le mapping
--             comptable (export FEC + OHADA)
-- ============================================================================
--
-- Ces champs permettent à chaque établissement de mapper ses catégories de
-- dépenses et de frais sur le plan comptable OHADA, afin de générer des
-- écritures comptables conformes (FEC France / CSV OHADA Bénin).
--
-- Tables modifiées :
--   - expense_categories : ajout compteOhada + compteOhadaLib
--   - fee_categories     : ajout compteOhada + compteOhadaLib
--
-- Les champs sont NULL par défaut. Si NULL, l'export utilise des comptes
-- OHADA par défaut (voir DEFAULT_OHADA_ACCOUNTS dans fec-export.service.ts).
-- ============================================================================

-- 1. expense_categories : ajout des champs de mapping OHADA
ALTER TABLE "expense_categories"
  ADD COLUMN IF NOT EXISTS "compteOhada" TEXT,
  ADD COLUMN IF NOT EXISTS "compteOhadaLib" TEXT;

-- 2. fee_categories : ajout des champs de mapping OHADA
ALTER TABLE "fee_categories"
  ADD COLUMN IF NOT EXISTS "compteOhada" TEXT,
  ADD COLUMN IF NOT EXISTS "compteOhadaLib" TEXT;

-- 3. Valeurs par défaut intelligentes (mapping automatique pour les catégories
--    existantes qui ont un nom/code correspondant à un compte OHADA standard).
--    Ceci évite aux écoles existantes de devoir re-mapper manuellement toutes
--    leurs catégories après la migration.

-- 3.a Catégories de dépenses courantes (classe 6 OHADA)
UPDATE "expense_categories" SET "compteOhada" = '601000', "compteOhadaLib" = 'Achats de fournitures scolaires'
  WHERE "compteOhada" IS NULL AND (
    LOWER(name) LIKE '%fourniture%' OR
    LOWER(name) LIKE '%cahier%' OR
    LOWER(name) LIKE '%papier%'
  );

UPDATE "expense_categories" SET "compteOhada" = '605000', "compteOhadaLib" = 'Achats de matériel pédagogique'
  WHERE "compteOhada" IS NULL AND (
    LOWER(name) LIKE '%matériel%' OR
    LOWER(name) LIKE '%pedagog%' OR
    LOWER(name) LIKE '%livre%'
  );

UPDATE "expense_categories" SET "compteOhada" = '613000', "compteOhadaLib" = 'Loyers payés'
  WHERE "compteOhada" IS NULL AND LOWER(name) LIKE '%loyer%';

UPDATE "expense_categories" SET "compteOhada" = '614000', "compteOhadaLib" = 'Entretien et réparations'
  WHERE "compteOhada" IS NULL AND (
    LOWER(name) LIKE '%entretien%' OR
    LOWER(name) LIKE '%reparation%' OR
    LOWER(name) LIKE '%maintenance%'
  );

UPDATE "expense_categories" SET "compteOhada" = '615000', "compteOhadaLib" = 'Frais de conservation (eau, électricité)'
  WHERE "compteOhada" IS NULL AND (
    LOWER(name) LIKE '%eau%' OR
    LOWER(name) LIKE '%electric%' OR
    LOWER(name) LIKE '%energie%' OR
    LOWER(name) LIKE '%sbee%'
  );

UPDATE "expense_categories" SET "compteOhada" = '621000', "compteOhadaLib" = 'Transport du personnel'
  WHERE "compteOhada" IS NULL AND LOWER(name) LIKE '%transport%';

UPDATE "expense_categories" SET "compteOhada" = '625000', "compteOhadaLib" = 'Frais de réception'
  WHERE "compteOhada" IS NULL AND (
    LOWER(name) LIKE '%reception%' OR
    LOWER(name) LIKE '%reunion%' OR
    LOWER(name) LIKE '%evenement%'
  );

UPDATE "expense_categories" SET "compteOhada" = '631000', "compteOhadaLib" = 'Frais financiers (commissions Fedapay)'
  WHERE "compteOhada" IS NULL AND (
    LOWER(name) LIKE '%commission%' OR
    LOWER(name) LIKE '%fedapay%' OR
    LOWER(name) LIKE '%frais bancaire%' OR
    LOWER(name) LIKE '%frais financier%'
  );

UPDATE "expense_categories" SET "compteOhada" = '641000', "compteOhadaLib" = 'Rémunérations du personnel'
  WHERE "compteOhada" IS NULL AND (
    LOWER(name) LIKE '%salaire%' OR
    LOWER(name) LIKE '%remuneration%' OR
    LOWER(name) LIKE '%paie%'
  );

UPDATE "expense_categories" SET "compteOhada" = '645000', "compteOhadaLib" = 'Charges sociales'
  WHERE "compteOhada" IS NULL AND (
    LOWER(name) LIKE '%charge sociale%' OR
    LOWER(name) LIKE '%cnss%' OR
    LOWER(name) LIKE '%ipres%'
  );

-- 3.b Catégories de frais courantes (classe 7 OHADA)
UPDATE "fee_categories" SET "compteOhada" = '706100', "compteOhadaLib" = 'Scolarité - Frais d''inscription'
  WHERE "compteOhada" IS NULL AND (
    LOWER(name) LIKE '%inscription%' OR
    LOWER(code) = 'inscription'
  );

UPDATE "fee_categories" SET "compteOhada" = '706200', "compteOhadaLib" = 'Scolarité - Frais de scolarité'
  WHERE "compteOhada" IS NULL AND (
    LOWER(name) LIKE '%scolarite%' OR
    LOWER(name) LIKE '%scolarité%' OR
    LOWER(code) = 'scolarite' OR
    LOWER(code) = 'tuition'
  );

UPDATE "fee_categories" SET "compteOhada" = '706300', "compteOhadaLib" = 'Scolarité - Frais d''examen'
  WHERE "compteOhada" IS NULL AND (
    LOWER(name) LIKE '%examen%' OR
    LOWER(code) = 'examen'
  );

UPDATE "fee_categories" SET "compteOhada" = '706400', "compteOhadaLib" = 'Cantine scolaire'
  WHERE "compteOhada" IS NULL AND (
    LOWER(name) LIKE '%cantine%' OR
    LOWER(code) = 'cantine'
  );

UPDATE "fee_categories" SET "compteOhada" = '706500', "compteOhadaLib" = 'Transport scolaire'
  WHERE "compteOhada" IS NULL AND (
    LOWER(name) LIKE '%transport%' OR
    LOWER(code) = 'transport'
  );

UPDATE "fee_categories" SET "compteOhada" = '706600', "compteOhadaLib" = 'Activités parascolaires'
  WHERE "compteOhada" IS NULL AND (
    LOWER(name) LIKE '%parascolaire%' OR
    LOWER(name) LIKE '%activite%' OR
    LOWER(name) LIKE '%activité%' OR
    LOWER(code) = 'activite'
  );

-- 4. Index pour accélérer les requêtes de mapping (utilisé à chaque export)
CREATE INDEX IF NOT EXISTS "idx_expense_categories_compte_ohada"
  ON "expense_categories" ("compteOhada");

CREATE INDEX IF NOT EXISTS "idx_fee_categories_compte_ohada"
  ON "fee_categories" ("compteOhada");

-- ============================================================================
-- Note : Le mapping OHADA par défaut ci-dessus est conservateur. Les
-- établissements peuvent re-mapper individuellement chaque catégorie via
-- l'interface (Onglet Dépenses > Catégories > Modifier).
-- ============================================================================
