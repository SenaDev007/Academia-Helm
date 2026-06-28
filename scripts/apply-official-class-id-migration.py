"""
Applique la migration 20260628130000_add_class_official_class_id manuellement.
"""
import psycopg2

CONN_STR = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"

MIGRATION_SQL = """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'classes' AND column_name = 'officialClassId'
    ) THEN
        ALTER TABLE "classes" ADD COLUMN "officialClassId" TEXT;
        RAISE NOTICE 'Colonne officialClassId ajoutée à la table classes.';
    ELSE
        RAISE NOTICE 'Colonne officialClassId existe déjà — skipped.';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'classes_officialClassId_fkey'
          AND table_name = 'classes'
    ) THEN
        ALTER TABLE "classes"
            ADD CONSTRAINT "classes_officialClassId_fkey"
            FOREIGN KEY ("officialClassId") REFERENCES "pedagogy_academic_classes"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
        RAISE NOTICE 'FK classes_officialClassId_fkey créée.';
    ELSE
        RAISE NOTICE 'FK classes_officialClassId_fkey existe déjà — skipped.';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "classes_officialClassId_idx" ON "classes"("officialClassId");
"""

def main():
    print("Connexion à Neon BDD...")
    conn = psycopg2.connect(CONN_STR)
    conn.autocommit = False
    cur = conn.cursor()

    print("Application de la migration...")
    try:
        cur.execute(MIGRATION_SQL)
        conn.commit()
        print("✅ Migration appliquée avec succès.")
    except Exception as e:
        conn.rollback()
        print(f"❌ Erreur: {e}")
        return

    # Vérification
    print("\n--- Vérification post-migration ---")
    cur.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'classes' AND column_name = 'officialClassId'
    """)
    row = cur.fetchone()
    if row:
        print(f"  ✓ Colonne officialClassId présente: {row[0]} ({row[1]})")
    else:
        print(f"  ✗ Colonne officialClassId TOUJOURS absente !")

    cur.execute("""
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'classes'::regclass AND conname = 'classes_officialClassId_fkey'
    """)
    if cur.fetchone():
        print("  ✓ FK classes_officialClassId_fkey présente")
    else:
        print("  ✗ FK manquante")

    cur.execute("""
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'classes' AND indexname = 'classes_officialClassId_idx'
    """)
    if cur.fetchone():
        print("  ✓ Index classes_officialClassId_idx présent")
    else:
        print("  ✗ Index manquant")

    # Test de la jointure
    print("\n--- Test jointure classes → pedagogy_academic_classes ---")
    try:
        cur.execute("""
            SELECT c.id, c.name, c."officialClassId", ac.name as official_name
            FROM "classes" c
            LEFT JOIN "pedagogy_academic_classes" ac ON ac.id = c."officialClassId"
            LIMIT 3
        """)
        rows = cur.fetchall()
        print(f"  ✓ OK — {len(rows)} lignes")
        for r in rows:
            print(f"    {r}")
    except Exception as e:
        print(f"  ✗ ERREUR: {e}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
