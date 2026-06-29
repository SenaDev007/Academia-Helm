"""
Investigation : où sont vraiment les liens class_subjects ?
"""
import psycopg2

CONN_STR = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"
TENANT_ID = "59b8c348-ae5f-4d67-8fbd-af6aefa1f394"

def main():
    conn = psycopg2.connect(CONN_STR)
    conn.set_session(readonly=True)
    cur = conn.cursor()

    print("--- Distribution des liens class_subjects ---")
    # Combien avec classId null vs non-null
    cur.execute("""
        SELECT
            COUNT(*) FILTER (WHERE "classId" IS NOT NULL) AS with_class_id,
            COUNT(*) FILTER (WHERE "classId" IS NULL) AS with_null_class_id,
            COUNT(*) FILTER (WHERE "academicClassId" IS NOT NULL) AS with_academic_class_id,
            COUNT(*) FILTER (WHERE "academicClassId" IS NULL) AS with_null_academic_class_id,
            COUNT(*) AS total
        FROM "class_subjects"
        WHERE "tenantId" = %s
    """, (TENANT_ID,))
    r = cur.fetchone()
    print(f"  Total: {r[4]}")
    print(f"  Avec classId non-null: {r[0]}")
    print(f"  Avec classId NULL: {r[1]}")
    print(f"  Avec academicClassId non-null: {r[2]}")
    print(f"  Avec academicClassId NULL: {r[3]}")

    # Échantillon
    print("\n--- Échantillon de class_subjects ---")
    cur.execute("""
        SELECT id, "classId", "academicClassId", "subjectId", "academicYearId"
        FROM "class_subjects"
        WHERE "tenantId" = %s
        LIMIT 5
    """, (TENANT_ID,))
    for r in cur.fetchall():
        print(f"  id={r[0]}")
        print(f"    classId={r[1]}")
        print(f"    academicClassId={r[2]}")
        print(f"    subjectId={r[3]}")
        print(f"    yearId={r[4]}")

    # Pour les liens avec academicClassId non-null, vérifier qu'ils existent dans pedagogy_academic_classes
    print("\n--- Vérification : academicClassId existe bien dans pedagogy_academic_classes ? ---")
    cur.execute("""
        SELECT cs."academicClassId",
               ac.id as ac_id,
               ac.name as ac_name,
               ac.code as ac_code
        FROM "class_subjects" cs
        LEFT JOIN "pedagogy_academic_classes" ac ON ac.id = cs."academicClassId"
        WHERE cs."tenantId" = %s
        LIMIT 5
    """, (TENANT_ID,))
    for r in cur.fetchall():
        print(f"  academicClassId={r[0]} → match ac_id={r[1]}, name={r[2]}, code={r[3]}")

    # Pour les liens avec classId non-null, vérifier
    print("\n--- Vérification : classId existe dans quelle table ? ---")
    cur.execute("""
        SELECT cs."classId",
               (SELECT name FROM "classes" WHERE id = cs."classId") AS classes_name,
               (SELECT name FROM "classrooms" WHERE id = cs."classId") AS classrooms_name,
               (SELECT name FROM "pedagogy_academic_classes" WHERE id = cs."classId") AS ac_name
        FROM "class_subjects" cs
        WHERE cs."tenantId" = %s AND cs."classId" IS NOT NULL
        LIMIT 5
    """, (TENANT_ID,))
    rows = cur.fetchall()
    if rows:
        for r in rows:
            print(f"  classId={r[0]} → classes.name={r[1]}, classrooms.name={r[2]}, ac.name={r[3]}")
    else:
        print("  → aucun class_subjects avec classId non-null pour ce tenant")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
