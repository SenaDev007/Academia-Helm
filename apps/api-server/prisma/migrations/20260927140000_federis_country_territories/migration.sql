-- ⭐ Academia Federis — Unités territoriales de référence par pays
-- Liste des départements / régions / provinces de chaque pays pour alimenter
-- les sélecteurs « Département » de l'inscription (/federis/register) et de
-- la création de patronats territoriaux : fin de la saisie libre, une liste
-- fiable par pays (cahier des charges Federis multi-pays §2.2).
--
-- Conventions :
--   • Idempotent (CREATE TABLE IF NOT EXISTS / NOT EXISTS sur les seeds)
--   • Rattachement optionnel au niveau territorial (ex: DEPARTMENT au Bénin)
--   • Les autres pays seront configurés après validation de leur
--     organisation réelle — le formulaire bascule alors automatiquement
--     du champ texte vers le sélecteur.

-- ═══════════════════════════════════════════════════════════════════
-- 1. Table des unités territoriales
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "country_territories" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "territorialLevelId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "country_territories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "country_territories_countryId_name_key"
    ON "country_territories"("countryId", "name");
CREATE INDEX IF NOT EXISTS "country_territories_countryId_idx"
    ON "country_territories"("countryId");

ALTER TABLE "country_territories" DROP CONSTRAINT IF EXISTS "country_territories_countryId_fkey";
ALTER TABLE "country_territories"
    ADD CONSTRAINT "country_territories_countryId_fkey"
    FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE;

ALTER TABLE "country_territories" DROP CONSTRAINT IF EXISTS "country_territories_territorialLevelId_fkey";
ALTER TABLE "country_territories"
    ADD CONSTRAINT "country_territories_territorialLevelId_fkey"
    FOREIGN KEY ("territorialLevelId") REFERENCES "country_territorial_levels"("id");

-- ═══════════════════════════════════════════════════════════════════
-- 2. Seed défensif — les 12 départements du Bénin (pays BJ)
--    Rattachés au niveau DEPARTMENT (créé par la migration précédente
--    20260927000000_federis_patronat_hierarchy) ; ordre alphabétique.
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO "country_territories" ("id", "countryId", "territorialLevelId", "name", "code", "order", "isActive", "createdAt", "updatedAt")
SELECT
    uuid_generate_v4(),
    c."id",
    (SELECT ctl."id" FROM "country_territorial_levels" ctl
     WHERE ctl."countryId" = c."id" AND ctl."code" = 'DEPARTMENT'
     LIMIT 1),
    d."name",
    d."code",
    d."order",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "countries" c
CROSS JOIN (
    VALUES
        ('Alibori',   'BJ-AL', 1),
        ('Atacora',   'BJ-AK', 2),
        ('Atlantique','BJ-AQ', 3),
        ('Borgou',    'BJ-BO', 4),
        ('Collines',  'BJ-CO', 5),
        ('Couffo',    'BJ-KO', 6),
        ('Donga',     'BJ-DO', 7),
        ('Littoral',  'BJ-LI', 8),
        ('Mono',      'BJ-MO', 9),
        ('Ouémé',     'BJ-OU', 10),
        ('Plateau',   'BJ-PL', 11),
        ('Zou',       'BJ-ZO', 12)
) AS d("name", "code", "order")
WHERE c."code" = 'BJ'
  AND NOT EXISTS (
    SELECT 1 FROM "country_territories" ct
    WHERE ct."countryId" = c."id" AND ct."name" = d."name"
);
