-- ============================================================================
-- Migration 019 : CMS Carte Scolaire — Templates de design + snapshot
-- ============================================================================
-- Task 19-a (Phase 2) :
--   1. Création de la table `card_design_templates` (4 presets système par
--      tenant + templates personnalisés).
--   2. Ajout des colonnes `templateId` (FK → card_design_templates) et
--      `designSnapshot` (JSON) sur `student_id_cards`.
--
-- Le snapshot garantit qu'une carte déjà émise conserve son design d'origine
-- même si l'admin modifie le TenantIdentityProfile ou le template après coup.
-- ============================================================================

-- ── 1. Table card_design_templates ──────────────────────────────────────────
-- ⚠️ id en TEXT (pas UUID) car student_id_cards.templateId est TEXT pour compatibilité
CREATE TABLE IF NOT EXISTS "card_design_templates" (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"  TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  key         TEXT        NOT NULL,
  layout      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "isSystem"  BOOLEAN     NOT NULL DEFAULT false,
  "isActive"  BOOLEAN     NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "card_design_templates_tenantId_key_key" UNIQUE ("tenantId", key),
  CONSTRAINT "card_design_templates_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "card_design_templates_tenantId_isActive_idx"
  ON "card_design_templates" ("tenantId", "isActive");
CREATE INDEX IF NOT EXISTS "card_design_templates_tenantId_isSystem_idx"
  ON "card_design_templates" ("tenantId", "isSystem");

COMMENT ON TABLE "card_design_templates" IS
  'Task 19-a : Templates de design de carte scolaire (CMS). 4 presets système + templates personnalisés.';

-- ── 2. Ajout colonnes sur student_id_cards ──────────────────────────────────
ALTER TABLE "student_id_cards"
  ADD COLUMN IF NOT EXISTS "templateId"     TEXT,
  ADD COLUMN IF NOT EXISTS "designSnapshot" JSONB;

-- FK optionnelle vers card_design_templates.
-- ⚠️ Pas de CASCADE sur la suppression d'un template : on met templateId à
-- NULL (SetNull) pour préserver l'historique des cartes émises.
ALTER TABLE "student_id_cards"
  DROP CONSTRAINT IF EXISTS "student_id_cards_templateId_fkey";

ALTER TABLE "student_id_cards"
  ADD CONSTRAINT "student_id_cards_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "card_design_templates"("id")
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "student_id_cards_templateId_idx"
  ON "student_id_cards" ("templateId");

COMMENT ON COLUMN "student_id_cards"."templateId" IS
  'Task 19-a : Template utilisé à la génération (null = design par défaut).';
COMMENT ON COLUMN "student_id_cards"."designSnapshot" IS
  'Task 19-a : Snapshot JSON du design (couleurs, flags, texts) au moment de la génération.';
