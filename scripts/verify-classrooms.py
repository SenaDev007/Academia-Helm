"""
Vérification : classrooms pour l'année en cours (tenant Eveil d'Afrique)
"""
import psycopg2

CONN_STR = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"
TENANT_ID = "59b8c348-ae5f-4d67-8fbd-af6aefa1f394"
CURRENT_YEAR_ID = "a7593470-e4f4-460a-b3b6-4dabe53bec2a"  # 2026-2027

def main():
    conn = psycopg2.connect(CONN_STR)
    conn.set_session(readonly=True)
    cur = conn.cursor()

    print("=" * 70)
    print("1. Classrooms (table 'classrooms') créés via Paramètres > Structure > Classe physique par année")
    print("   pour le tenant Eveil d'Afrique, année 2026-2027")
    print("=" * 70)
    cur.execute("""
        SELECT c.id, c.name, c.code, c."gradeId",
               eg.name as grade_name, eg.code as grade_code,
               ec.name as cycle_name, el.name as level_name
        FROM "classrooms" c
        LEFT JOIN "education_grades" eg ON eg.id = c."gradeId"
        LEFT JOIN "education_cycles" ec ON ec.id = eg."cycleId"
        LEFT JOIN "education_levels" el ON el.id = ec."levelId"
        WHERE c."tenantId" = %s AND c."academicYearId" = %s
        ORDER BY el."order", ec."order", eg."order"
    """, (TENANT_ID, CURRENT_YEAR_ID))
    rows = cur.fetchall()
    print(f"  → {len(rows)} classrooms trouvés :")
    for r in rows:
        print(f"    - id={r[0]}")
        print(f"      name={r[1]} | code={r[2]}")
        print(f"      grade={r[4]} ({r[5]}) | cycle={r[6]} | level={r[7]}")

    print()
    print("=" * 70)
    print("2. pedagogy_academic_classes (synchronisées depuis classrooms)")
    print("=" * 70)
    cur.execute("""
        SELECT ac.id, ac.name, ac.code, ac."isActive"
        FROM "pedagogy_academic_classes" ac
        WHERE ac."tenantId" = %s AND ac."academicYearId" = %s
        ORDER BY ac.code
    """, (TENANT_ID, CURRENT_YEAR_ID))
    rows = cur.fetchall()
    print(f"  → {len(rows)} academic_classes trouvées :")
    for r in rows:
        active_marker = "✓" if r[3] else "✗"
        print(f"    {active_marker} {r[2]:<10} | {r[1]}")

    print()
    print("=" * 70)
    print("3. classes (table 'classes' — subdivisions A/B/C, JAMAIS utilisé par l'UI)")
    print("=" * 70)
    cur.execute("""
        SELECT COUNT(*)
        FROM "classes"
        WHERE "tenantId" = %s
    """, (TENANT_ID,))
    count = cur.fetchone()[0]
    print(f"  → {count} lignes (table non peuplée — concept non implémenté dans l'UI)")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
