-- ⭐ 2026-11-26 (retour promoteur) — DOUBLE IDENTITÉ E-MAIL PAR NIVEAU SCOLAIRE
-- Les écoles combinées (maternelle/primaire + secondaire — double identité de
-- l'onglet Identité) configurent UNE connexion Google PAR niveau :
--   • MATERNAL_PRIMARY (défaut) — ligne existante, conservée telle quelle ;
--   • SECONDARY — ligne créée par l'école depuis Paramètres > Email.
-- Le routage des envois est automatique : classe de l'élève / niveau du
-- personnel → adresse du niveau ; sans ligne SECONDARY, tout part de la
-- connexion principale (repli transparent, aucun envoi bloqué).
--
-- La contrainte d'unicité passe de (tenantId) à (tenantId, levelCategory).

-- Colonne de catégorie de niveau (idempotent).
ALTER TABLE "school_email_settings"
  ADD COLUMN IF NOT EXISTS "levelCategory" TEXT NOT NULL DEFAULT 'MATERNAL_PRIMARY';

-- Les lignes existantes (une par école) deviennent la connexion
-- maternelle/primaire — aucune perte de configuration.
UPDATE "school_email_settings"
   SET "levelCategory" = 'MATERNAL_PRIMARY'
 WHERE "levelCategory" IS NULL OR "levelCategory" NOT IN ('MATERNAL_PRIMARY', 'SECONDARY');

-- Ancienne unicité par tenant → nouvelle unicité (tenant, niveau).
DROP INDEX IF EXISTS "school_email_settings_tenantId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "school_email_settings_tenantId_levelCategory_key"
  ON "school_email_settings"("tenantId", "levelCategory");
