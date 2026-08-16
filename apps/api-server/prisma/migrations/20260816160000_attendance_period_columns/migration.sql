-- ============================================================================
-- Migration : Colonnes dédiées par période pour AttendanceRecord
-- ============================================================================
--
-- Contexte :
-- Le modèle AttendanceRecord utilisait un hack JSON dans `notes` pour stocker
-- les statuts par demi-journée : {morning: 'ABSENT', afternoon: 'PRESENT', late: false}.
-- Cela causait plusieurs problèmes :
--   1. Parsing fragile (si JSON corrompu → défaut PRESENT → élève apparaît présent)
--   2. Pas queryable (impossible de compter les absents du matin sans parser)
--   3. Limite à 2 périodes (matin/après-midi) — pas de soirée
--   4. Pas de statut EXCUSED (excusé) par période
--
-- Cette migration ajoute 5 colonnes typées :
--   - amStatus      : PRESENT | ABSENT | EXCUSED (matin)
--   - pmStatus      : PRESENT | ABSENT | EXCUSED (après-midi)
--   - eveningStatus : PRESENT | ABSENT | EXCUSED (soir — nullable pour écoles sans soirée)
--   - late          : Boolean (retard — booléen séparé du statut)
--   - lateMinutes   : Int? (retard en minutes — optionnel)
--
-- Le champ `notes` est conservé mais redevient un vrai champ texte libre
-- (observations de l'enseignant), plus de JSON.
--
-- Backfill : les records existants sont migrés depuis le JSON `notes`.
-- ============================================================================

DO $$
BEGIN
    -- 1. amStatus (TEXT NOT NULL DEFAULT 'PRESENT')
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attendance_records' AND column_name = 'amStatus'
    ) THEN
        ALTER TABLE "attendance_records" ADD COLUMN "amStatus" TEXT NOT NULL DEFAULT 'PRESENT';
        RAISE NOTICE 'Colonne amStatus ajoutée à attendance_records.';
    ELSE
        RAISE NOTICE 'Colonne amStatus existe déjà — skipped.';
    END IF;

    -- 2. pmStatus (TEXT NOT NULL DEFAULT 'PRESENT')
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attendance_records' AND column_name = 'pmStatus'
    ) THEN
        ALTER TABLE "attendance_records" ADD COLUMN "pmStatus" TEXT NOT NULL DEFAULT 'PRESENT';
        RAISE NOTICE 'Colonne pmStatus ajoutée à attendance_records.';
    ELSE
        RAISE NOTICE 'Colonne pmStatus existe déjà — skipped.';
    END IF;

    -- 3. eveningStatus (TEXT, nullable, default 'PRESENT')
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attendance_records' AND column_name = 'eveningStatus'
    ) THEN
        ALTER TABLE "attendance_records" ADD COLUMN "eveningStatus" TEXT DEFAULT 'PRESENT';
        RAISE NOTICE 'Colonne eveningStatus ajoutée à attendance_records.';
    ELSE
        RAISE NOTICE 'Colonne eveningStatus existe déjà — skipped.';
    END IF;

    -- 4. late (BOOLEAN NOT NULL DEFAULT false)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attendance_records' AND column_name = 'late'
    ) THEN
        ALTER TABLE "attendance_records" ADD COLUMN "late" BOOLEAN NOT NULL DEFAULT false;
        RAISE NOTICE 'Colonne late ajoutée à attendance_records.';
    ELSE
        RAISE NOTICE 'Colonne late existe déjà — skipped.';
    END IF;

    -- 5. lateMinutes (INTEGER, nullable)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attendance_records' AND column_name = 'lateMinutes'
    ) THEN
        ALTER TABLE "attendance_records" ADD COLUMN "lateMinutes" INTEGER;
        RAISE NOTICE 'Colonne lateMinutes ajoutée à attendance_records.';
    ELSE
        RAISE NOTICE 'Colonne lateMinutes existe déjà — skipped.';
    END IF;
END $$;

-- ============================================================================
-- Backfill : migrer les records existants depuis le JSON `notes`
-- ============================================================================
-- Le champ `notes` contenait : {"morning":"ABSENT","afternoon":"PRESENT","late":true}
-- On extrait ces valeurs vers les nouvelles colonnes.
-- Si le JSON est absent ou corrompu, on laisse les defaults (PRESENT / false).

UPDATE "attendance_records"
SET
    "amStatus" = COALESCE(
        NULLIF(("notes"::jsonb ->> 'morning'), ''),
        NULLIF(("notes"::json ->> 'morning'), ''),
        'PRESENT'
    ),
    "pmStatus" = COALESCE(
        NULLIF(("notes"::jsonb ->> 'afternoon'), ''),
        NULLIF(("notes"::json ->> 'afternoon'), ''),
        'PRESENT'
    ),
    "late" = COALESCE(
        (("notes"::jsonb ->> 'late')::boolean),
        (("notes"::json ->> 'late')::boolean),
        false
    )
WHERE "notes" IS NOT NULL
  AND "notes" LIKE '%morning%'
  AND "notes" LIKE '%afternoon%';

-- Valider les valeurs (ne garder que PRESENT/ABSENT/EXCUSED)
UPDATE "attendance_records" SET "amStatus" = 'PRESENT' WHERE "amStatus" NOT IN ('PRESENT', 'ABSENT', 'EXCUSED');
UPDATE "attendance_records" SET "pmStatus" = 'PRESENT' WHERE "pmStatus" NOT IN ('PRESENT', 'ABSENT', 'EXCUSED');
UPDATE "attendance_records" SET "eveningStatus" = 'PRESENT' WHERE "eveningStatus" IS NOT NULL AND "eveningStatus" NOT IN ('PRESENT', 'ABSENT', 'EXCUSED');

-- ============================================================================
-- Index pour accélérer les requêtes par classe + date (pattern principal)
-- ============================================================================
CREATE INDEX IF NOT EXISTS "attendance_records_class_date_idx"
    ON "attendance_records"("classId", "date")
    WHERE "classId" IS NOT NULL;

-- Index pour filtrer par statut (utile pour les statistiques d'absence)
CREATE INDEX IF NOT EXISTS "attendance_records_amStatus_idx"
    ON "attendance_records"("amStatus")
    WHERE "amStatus" IN ('ABSENT', 'EXCUSED');

CREATE INDEX IF NOT EXISTS "attendance_records_pmStatus_idx"
    ON "attendance_records"("pmStatus")
    WHERE "pmStatus" IN ('ABSENT', 'EXCUSED');

-- Migration terminée.
