"""
Investigation : AcademicLevel pour le tenant Eveil d'Afrique.
"""
import psycopg2

CONN_STR = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"
TENANT_ID = "59b8c348-ae5f-4d67-8fbd-af6aefa1f394"

def main():
    conn = psycopg2.connect(CONN_STR)
    conn.set_session(readonly=True)
    cur = conn.cursor()

    print("--- pedagogy_academic_levels pour ce tenant ---")
    cur.execute("""
        SELECT id, name, "academicYearId", "isActive"
        FROM "pedagogy_academic_levels"
        WHERE "tenantId" = %s
        ORDER BY "academicYearId", "orderIndex"
    """, (TENANT_ID,))
    for r in cur.fetchall():
        print(f"  id={r[0]} | name={r[1]} | yearId={r[2]} | active={r[3]}")

    print()
    print("--- AcademicClass avec son level.name ---")
    cur.execute("""
        SELECT ac.id, ac.name, ac.code, al.name as level_name,
               ac."levelId", ac."academicYearId", ac."isActive"
        FROM "pedagogy_academic_classes" ac
        LEFT JOIN "pedagogy_academic_levels" al ON al.id = ac."levelId"
        WHERE ac."tenantId" = %s
        ORDER BY ac."academicYearId", al.name, ac.name
    """, (TENANT_ID,))
    rows = cur.fetchall()
    print(f"  Total: {len(rows)} classes")
    current_year = None
    for r in rows:
        if r[5] != current_year:
            current_year = r[5]
            print(f"\n  --- Année {current_year} ---")
        print(f"    {r[2]:<10} | {r[1]:<25} | level={r[3]} | active={r[6]}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
