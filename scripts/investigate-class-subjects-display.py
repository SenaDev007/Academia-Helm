import psycopg2

CONN = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"
TENANT = "59b8c348-ae5f-4d67-8fbd-af6aefa1f394"
YEAR = "a7593470-e4f4-460a-b3b6-4dabe53bec2a"

conn = psycopg2.connect(CONN)
conn.set_session(readonly=True)
cur = conn.cursor()

print("=== class_subjects pour Eveil Afrique, 2026-2027 ===")
cur.execute("SELECT COUNT(*) FROM class_subjects WHERE \"tenantId\" = %s", (TENANT,))
print(f"  Total (toutes années) : {cur.fetchone()[0]} liens")

cur.execute("SELECT COUNT(*) FROM class_subjects WHERE \"tenantId\" = %s AND \"academicYearId\" = %s", (TENANT, YEAR))
print(f"  Pour 2026-2027 : {cur.fetchone()[0]} liens")

print()
print("=== Distribution des colonnes classId / academicClassId ===")
cur.execute("""
    SELECT
        COUNT(*) FILTER (WHERE "classId" IS NOT NULL) AS with_class_id,
        COUNT(*) FILTER (WHERE "classId" IS NULL) AS with_null_class_id,
        COUNT(*) FILTER (WHERE "academicClassId" IS NOT NULL) AS with_academic_class_id,
        COUNT(*) FILTER (WHERE "academicClassId" IS NULL) AS with_null_academic_class_id,
        COUNT(*) AS total
    FROM class_subjects
    WHERE "tenantId" = %s AND "academicYearId" = %s
""", (TENANT, YEAR))
r = cur.fetchone()
print(f"  Total : {r[4]}")
print(f"  Avec classId non-null : {r[0]}")
print(f"  Avec classId NULL : {r[1]}")
print(f"  Avec academicClassId non-null : {r[2]}")
print(f"  Avec academicClassId NULL : {r[3]}")

print()
print("=== 5 premiers class_subjects ===")
cur.execute('SELECT id, "classId", "academicClassId", "subjectId" FROM class_subjects WHERE "tenantId" = %s AND "academicYearId" = %s LIMIT 5', (TENANT, YEAR))
for r in cur.fetchall():
    print(f"  id={r[0]}")
    print(f"    classId = {r[1]}")
    print(f"    academicClassId = {r[2]}")
    print(f"    subjectId = {r[3]}")

print()
print("=== pedagogy_academic_classes pour 2026-2027 ===")
cur.execute('SELECT id, name, code FROM pedagogy_academic_classes WHERE "tenantId" = %s AND "academicYearId" = %s ORDER BY name', (TENANT, YEAR))
acs = cur.fetchall()
print(f"  Total : {len(acs)}")
for ac in acs:
    print(f"  - id={ac[0]} | {ac[1]} ({ac[2]})")

print()
print("=== Vérification : les academicClassId pointent vers pedagogy_academic_classes ? ===")
cur.execute("""
    SELECT cs."academicClassId",
           ac.id as ac_id,
           ac.name as ac_name
    FROM class_subjects cs
    LEFT JOIN pedagogy_academic_classes ac ON ac.id = cs."academicClassId"
    WHERE cs."tenantId" = %s AND cs."academicYearId" = %s
    GROUP BY cs."academicClassId", ac.id, ac.name
""", (TENANT, YEAR))
for r in cur.fetchall():
    if r[1]:
        print(f"  OK academicClassId={r[0]} -> {r[2]}")
    else:
        print(f"  BAD academicClassId={r[0]} -> INTROUVABLE")

cur.close()
conn.close()
