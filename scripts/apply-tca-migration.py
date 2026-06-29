"""Applique la migration 20260628140000_add_teacher_class_assignments_class_id"""
import psycopg2

CONN_STR = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"

MIGRATION_SQL = """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'teacher_class_assignments' AND column_name = 'classId'
    ) THEN
        ALTER TABLE "teacher_class_assignments" ADD COLUMN "classId" TEXT;
        RAISE NOTICE 'Colonne classId ajoutée.';
    ELSE
        RAISE NOTICE 'Colonne classId existe deja.';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'teacher_class_assignments_classId_fkey'
          AND table_name = 'teacher_class_assignments'
    ) THEN
        ALTER TABLE "teacher_class_assignments"
            ADD CONSTRAINT "teacher_class_assignments_classId_fkey"
            FOREIGN KEY ("classId") REFERENCES "classes"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
        RAISE NOTICE 'FK creee.';
    ELSE
        RAISE NOTICE 'FK existe deja.';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "teacher_class_assignments_classId_idx"
    ON "teacher_class_assignments"("classId");
"""

def main():
    conn = psycopg2.connect(CONN_STR)
    conn.autocommit = False
    cur = conn.cursor()

    print("Application de la migration...")
    cur.execute(MIGRATION_SQL)
    conn.commit()
    print("OK")

    # Vérification
    cur.execute("""SELECT column_name FROM information_schema.columns
                   WHERE table_name = 'teacher_class_assignments' AND column_name = 'classId'""")
    print(f"Colonne classId presente : {bool(cur.fetchone())}")

    cur.execute("""SELECT conname FROM pg_constraint
                   WHERE conrelid = 'teacher_class_assignments'::regclass
                     AND conname = 'teacher_class_assignments_classId_fkey'""")
    print(f"FK presente : {bool(cur.fetchone())}")

    # Enregistrer dans _prisma_migrations
    MIGRATION_NAME = "20260628140000_add_teacher_class_assignments_class_id"
    cur.execute("SELECT 1 FROM _prisma_migrations WHERE migration_name = %s", (MIGRATION_NAME,))
    if not cur.fetchone():
        cur.execute("""
            INSERT INTO _prisma_migrations (id, checksum, migration_name, logs, started_at, finished_at, applied_steps_count, rolled_back_at)
            VALUES (gen_random_uuid(), '', %s, NULL, NOW(), NOW(), 1, NULL)
        """, (MIGRATION_NAME,))
        conn.commit()
        print(f"Migration enregistree dans _prisma_migrations : {MIGRATION_NAME}")
    else:
        print(f"Migration deja enregistree.")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
