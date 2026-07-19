-- ============================================================================
-- SaisieMaster Testimonials — table pour les avis utilisateurs
-- ============================================================================
-- Les utilisateurs authentifiés SaisieMaster peuvent laisser un avis qui
-- s'affiche sur la landing page après modération (isPublished = true).
--
-- ⚠️ Convention : colonnes en camelCase (comme saisiemaster_prospects et
--    saisiemaster_sessions) car Prisma ne mappe pas automatiquement les
--    noms de colonnes — il faut qu'elles correspondent au champ du modèle.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "saisiemaster_testimonials" (
    "id"            TEXT            NOT NULL,
    "prospectId"    TEXT,
    "authorName"    TEXT            NOT NULL,
    "authorRole"    TEXT            NOT NULL,
    "schoolName"    TEXT            NOT NULL,
    "city"          TEXT,
    "rating"        INTEGER         NOT NULL,
    "content"       TEXT            NOT NULL,
    "isPublished"   BOOLEAN         NOT NULL DEFAULT false,
    "isFeatured"    BOOLEAN         NOT NULL DEFAULT false,
    "createdAt"     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3)    NOT NULL,
    "publishedAt"   TIMESTAMP(3),

    CONSTRAINT "saisiemaster_testimonials_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "saisiemaster_testimonials_rating_check"
        CHECK ("rating" >= 1 AND "rating" <= 5)
);

-- Index pour la lecture publique (landing page)
CREATE INDEX IF NOT EXISTS "saisiemaster_testimonials_isPublished_idx"
    ON "saisiemaster_testimonials" ("isPublished");

CREATE INDEX IF NOT EXISTS "saisiemaster_testimonials_isFeatured_idx"
    ON "saisiemaster_testimonials" ("isFeatured");

CREATE INDEX IF NOT EXISTS "saisiemaster_testimonials_prospectId_idx"
    ON "saisiemaster_testimonials" ("prospectId");

-- Contrainte de clé étrangère vers les prospects SaisieMaster
-- SetNull : si un prospect est supprimé, son témoignage reste (dénormalisé)
ALTER TABLE "saisiemaster_testimonials"
    ADD CONSTRAINT "saisiemaster_testimonials_prospectId_fkey"
    FOREIGN KEY ("prospectId") REFERENCES "saisiemaster_prospects" ("id")
    ON DELETE SET NULL;
