-- ============================================================================
-- SaisieMaster Testimonials — table pour les avis utilisateurs
-- ============================================================================
-- Les utilisateurs authentifiés SaisieMaster peuvent laisser un avis qui
-- s'affiche sur la landing page après modération (is_published = true).
-- ============================================================================

CREATE TABLE IF NOT EXISTS "saisiemaster_testimonials" (
    "id"            TEXT            NOT NULL,
    "prospect_id"   TEXT,
    "author_name"   TEXT            NOT NULL,
    "author_role"   TEXT            NOT NULL,
    "school_name"   TEXT            NOT NULL,
    "city"          TEXT,
    "rating"        INTEGER         NOT NULL,
    "content"       TEXT            NOT NULL,
    "is_published"  BOOLEAN         NOT NULL DEFAULT false,
    "is_featured"   BOOLEAN         NOT NULL DEFAULT false,
    "created_at"    TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3)    NOT NULL,
    "published_at"  TIMESTAMP(3),

    CONSTRAINT "saisiemaster_testimonials_pkey" PRIMARY KEY ("id")
);

-- Index pour la lecture publique (landing page)
CREATE INDEX IF NOT EXISTS "saisiemaster_testimonials_is_published_idx"
    ON "saisiemaster_testimonials" ("is_published");

CREATE INDEX IF NOT EXISTS "saisiemaster_testimonials_is_featured_idx"
    ON "saisiemaster_testimonials" ("is_featured");

CREATE INDEX IF NOT EXISTS "saisiemaster_testimonials_prospect_id_idx"
    ON "saisiemaster_testimonials" ("prospect_id");

-- Contrainte de clé étrangère vers les prospects SaisieMaster
-- SetNull : si un prospect est supprimé, son témoignage reste (dénormalisé)
ALTER TABLE "saisiemaster_testimonials"
    ADD CONSTRAINT "saisiemaster_testimonials_prospect_id_fkey"
    FOREIGN KEY ("prospect_id") REFERENCES "saisiemaster_prospects" ("id")
    ON DELETE SET NULL;

-- Contrainte : rating doit être entre 1 et 5
ALTER TABLE "saisiemaster_testimonials"
    ADD CONSTRAINT "saisiemaster_testimonials_rating_check"
    CHECK ("rating" >= 1 AND "rating" <= 5);
