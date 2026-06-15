-- Avis / témoignages (Trustpilot-style)
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED');

CREATE TYPE "ReviewSource" AS ENUM ('IN_APP', 'MANUAL', 'IMPORT');

CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT,
    "schoolName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "photoUrl" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "source" "ReviewSource" NOT NULL DEFAULT 'IN_APP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "tenantId" TEXT,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reviews_status_idx" ON "reviews"("status");

CREATE INDEX "reviews_rating_idx" ON "reviews"("rating");

CREATE INDEX "reviews_featured_idx" ON "reviews"("featured");

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
