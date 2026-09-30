-- ⭐ Academia Federis — RÉPERTOIRE OFFICIEL des établissements du Bénin (2026-09-30)
-- Demande utilisateur : utiliser les listes officielles des écoles privées du
-- Bénin (répertoriées par département) comme base de suggestions pour :
--   1. la création d'ÉCOLES PROVISOIRES hors Academia Helm (module Écoles
--      rattachées) — le patronat recherche dans le répertoire de SON
--      département et crée la fiche en un clic, avec invitation automatique
--      du responsable à créer son école sur Academia Helm ;
--   2. la désignation des CENTRES d'examen (module Centres) — une école du
--      répertoire peut être choisie comme centre d'accueil (pré-remplissage
--      nom / commune / directeur / téléphone), plusieurs centres par examen.
--
-- Source initiale : répertoire ministériel « Les établissements privés
-- d'enseignement secondaire général du Bénin — année scolaire 2022-2023 »
-- (Direction de l'Enseignement Secondaire Général, publié le 17/09/2024) —
-- 1 406 établissements, 12 départements, 77 communes. Le schéma est
-- extensible (level PRIMAIRE/SECONDAIRE, sector PUBLIC/PRIVE) pour
-- accueillir de futurs répertoires (primaire privé, public).
--
-- ⚠️ 100 % IDEMPOTENTE (miroir de l'auto-guérison
-- FederisSchoolDirectoryService.ensureSchemaAndSeed — Railway n'exécute pas
-- `prisma migrate deploy` au démarrage, la table est aussi créée et le seed
-- exécuté au premier appel du service).

CREATE TABLE IF NOT EXISTS "school_directory_entries" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'BJ',
    "externalRef" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "departmentLabel" TEXT,
    "commune" TEXT,
    "arrondissement" TEXT,
    "cycle" TEXT,
    "founderName" TEXT,
    "founderPhone" TEXT,
    "directorName" TEXT,
    "directorPhone" TEXT,
    "classesSummary" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_directory_entries_pkey" PRIMARY KEY ("id")
);

-- Référence stable du répertoire source (idempotence du seed)
CREATE UNIQUE INDEX IF NOT EXISTS "school_directory_entries_externalRef_key"
    ON "school_directory_entries"("externalRef");

-- Recherche par département du patronat (suggestions + centres)
CREATE INDEX IF NOT EXISTS "school_directory_entries_countryCode_department_idx"
    ON "school_directory_entries"("countryCode", "department");

CREATE INDEX IF NOT EXISTS "school_directory_entries_department_sector_level_idx"
    ON "school_directory_entries"("department", "sector", "level");

-- Recherche par nom d'établissement (autocomplétion)
CREATE INDEX IF NOT EXISTS "school_directory_entries_name_idx"
    ON "school_directory_entries"("name");
