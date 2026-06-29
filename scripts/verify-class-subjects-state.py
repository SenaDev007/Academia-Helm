"""
Vérification immédiate de l'état de class_subjects.
"""
import psycopg2

CONN = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"

conn = psycopg2.connect(CONN)
conn.set_session(readonly=True)
cur = conn.cursor()

print("=" * 70)
print("TABLE class_subjects — ÉTAT ACTUEL")
print("=" * 70)

# 1. Total global
cur.execute("SELECT COUNT(*) FROM class_subjects")
print(f"\nTotal global dans class_subjects : {cur.fetchone()[0]}")

# 2. Par tenant
print("\n--- Par tenant ---")
cur.execute("""
    SELECT cs."tenantId", t.name as tenant_name, COUNT(*) as nb
    FROM class_subjects cs
    LEFT JOIN tenants t ON t.id = cs."tenantId"
    GROUP BY cs."tenantId", t.name
    ORDER BY nb DESC
""")
for r in cur.fetchall():
    print(f"  Tenant: {r[1] or '(inconnu)'}")
    print(f"    ID:    {r[0]}")
    print(f"    Nb liens: {r[2]}")

# 3. Par tenant + année
print("\n--- Par tenant + année scolaire ---")
cur.execute("""
    SELECT t.name as tenant_name, ay.name as year_name, COUNT(*) as nb
    FROM class_subjects cs
    LEFT JOIN tenants t ON t.id = cs."tenantId"
    LEFT JOIN academic_years ay ON ay.id = cs."academicYearId"
    GROUP BY t.name, ay.name
    ORDER BY t.name, ay.name
""")
for r in cur.fetchall():
    print(f"  {r[0] or '?':<60} | {r[1] or '?':<15} | {r[2]} liens")

# 4. Vérifier aussi class_subjects pour Eveil Afrique 2026-2027 spécifiquement
print("\n--- Eveil d'Afrique 2026-2027 (vérification ciblée) ---")
cur.execute("""
    SELECT COUNT(*) FROM class_subjects
    WHERE "tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
      AND "academicYearId" = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a'
""")
n = cur.fetchone()[0]
print(f"  Nombre de liens : {n}")

# 5. Vérifier AcademicClass pour Eveil Afrique 2026-2027
print("\n--- AcademicClass pour Eveil Afrique 2026-2027 ---")
cur.execute("""
    SELECT COUNT(*) FROM pedagogy_academic_classes
    WHERE "tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
      AND "academicYearId" = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a'
""")
n = cur.fetchone()[0]
print(f"  Nombre de classes officielles : {n}")

# 6. Vérifier classrooms pour Eveil Afrique 2026-2027
print("\n--- Classrooms pour Eveil Afrique 2026-2027 ---")
cur.execute("""
    SELECT COUNT(*) FROM classrooms
    WHERE "tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
      AND "academicYearId" = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a'
""")
n = cur.fetchone()[0]
print(f"  Nombre de classrooms : {n}")

# 7. Vérifier subjects pour Eveil Afrique 2026-2027
print("\n--- Subjects pour Eveil Afrique 2026-2027 ---")
cur.execute("""
    SELECT COUNT(*) FROM subjects
    WHERE "tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
      AND "academicYearId" = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a'
""")
n = cur.fetchone()[0]
print(f"  Nombre de matières : {n}")

cur.close()
conn.close()
