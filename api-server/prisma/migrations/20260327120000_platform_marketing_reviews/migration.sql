-- Témoignages publics (landing) — avis vérifiés côté produit
CREATE TABLE IF NOT EXISTS "platform_marketing_reviews" (
    "id" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "author_label" TEXT NOT NULL,
    "role_label" TEXT NOT NULL,
    "organization_label" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "collect_method" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_marketing_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "platform_marketing_reviews_published_sort_order_idx" ON "platform_marketing_reviews"("published", "sort_order");
