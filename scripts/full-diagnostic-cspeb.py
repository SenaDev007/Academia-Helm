"""
Diagnostic complet pour le tenant CSPEB Éveil d'Afrique.
Vérifie toutes les tables pertinentes pour l'affectation matière-classe.
"""
import psycopg2

CONN = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"
TENANT = "59b8c348-ae5f-4d67-8fbd-af6aefa1f394"  # CSPEB Éveil d'Afrique
YEAR = "a7593470-e4f4-460a-b3b6-4dabe53bec2a"     # 2026-2027

conn = psycopg2.connect(CONN)
conn.set_session(readonly=True)
cur = conn.cursor()

print("=" * 75)
print("DIAGNOSTIC COMPLET — CSPEB Éveil d'Afrique, 2026-2027")
print("=" * 75)

# 1. Vérifier toutes les tables pertinentes
print("\n--- 1. Comptages globaux ---")
tables_to_check = [
    ("subjects", "Matières"),
    ("class_subjects", "Liens matière-classe"),
    ("pedagogy_academic_classes", "Classes officielles"),
    ("classrooms", "Classrooms (Paramètres)"),
    ("classes", "Sections physiques"),
    ("teacher_subjects", "Liens enseignant-matière"),
]
for table, label in tables_to_check:
    cur.execute(f'SELECT COUNT(*) FROM "{table}" WHERE "tenantId" = %s', (TENANT,))
    n_all = cur.fetchone()[0]
    try:
        cur.execute(f'SELECT COUNT(*) FROM "{table}" WHERE "tenantId" = %s AND "academicYearId" = %s', (TENANT, YEAR))
        n_year = cur.fetchone()[0]
        print(f"  {label:<30} → {n_year} (cette année) / {n_all} (total)")
    except Exception:
        conn.rollback()
        print(f"  {label:<30} → {n_all} (pas d'academicYearId)")

# 2. Détail des class_subjects
print("\n--- 2. Détail des class_subjects ---")
cur.execute("""
    SELECT
        cs.id,
        cs."classId",
        cs."academicClassId",
        cs."subjectId",
        cs."weeklyHours",
        cs."coefficient",
        s.name as subject_name,
        s.code as subject_code,
        ac.name as ac_name,
        ac.code as ac_code
    FROM class_subjects cs
    LEFT JOIN subjects s ON s.id = cs."subjectId"
    LEFT JOIN pedagogy_academic_classes ac ON ac.id = cs."academicClassId"
    WHERE cs."tenantId" = %s AND cs."academicYearId" = %s
    ORDER BY ac.name, s.name
    LIMIT 30
""", (TENANT, YEAR))
rows = cur.fetchall()
print(f"  Total : {len(rows)} liens")
for r in rows[:10]:
    print(f"  - id={r[0]}")
    print(f"      classId        = {r[1]}")
    print(f"      academicClassId= {r[2]} (→ {r[7] or '—'})")
    print(f"      subjectId      = {r[3]} (→ {r[6]} / {r[7]})")
    print(f"      hours={r[4]}, coeff={r[5]}")

# 3. Vérifier que les AcademicClass.id correspondent à ce que le frontend charge
print("\n--- 3. AcademicClass actives pour 2026-2027 ---")
cur.execute("""
    SELECT id, name, code, "isActive"
    FROM pedagogy_academic_classes
    WHERE "tenantId" = %s AND "academicYearId" = %s AND "isActive" = true
    ORDER BY name
""", (TENANT, YEAR))
acs = cur.fetchall()
for ac in acs:
    has_subjects = any(r[2] == ac[0] for r in rows)
    marker = "✓ a des matières" if has_subjects else "✗ AUCUNE matière"
    print(f"  - {ac[0]} | {ac[1]} ({ac[2]}) | {marker}")

# 4. Vérifier les subjects pour cette année
print("\n--- 4. Subjects (matières) pour 2026-2027 ---")
cur.execute("""
    SELECT id, name, code, "schoolLevelId", "academicYearId"
    FROM subjects
    WHERE "tenantId" = %s AND "academicYearId" = %s
    ORDER BY name
    LIMIT 10
""", (TENANT, YEAR))
subs = cur.fetchall()
print(f"  Total : {len(subs)} matières (limité à 10 affichées)")
for s in subs:
    print(f"  - id={s[0]} | {s[1]} ({s[2]})")

# 5. Vérifier quels subjects sont référencés dans class_subjects
print("\n--- 5. Subjects référencés dans class_subjects ---")
cur.execute("""
    SELECT DISTINCT cs."subjectId", s.name, s.code
    FROM class_subjects cs
    LEFT JOIN subjects s ON s.id = cs."subjectId"
    WHERE cs."tenantId" = %s AND cs."academicYearId" = %s
""", (TENANT, YEAR))
for r in cur.fetchall():
    print(f"  - subjectId={r[0]} | {r[1] or '(inexistant)'} ({r[2] or '—'})")

cur.close()
conn.close()
print()
print("=" * 75)
print("Diagnostic terminé.")
print("=" * 75)
