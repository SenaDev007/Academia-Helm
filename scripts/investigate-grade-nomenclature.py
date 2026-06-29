"""
Investigation : nomenclature des grades pour le tenant Eveil d'Afrique
"""
import psycopg2

CONN_STR = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"
TENANT_ID = "59b8c348-ae5f-4d67-8fbd-af6aefa1f394"

def main():
    conn = psycopg2.connect(CONN_STR)
    conn.set_session(readonly=True)
    cur = conn.cursor()

    print("=" * 70)
    print("Grades avec level + cycle + series (pour analyser la nomenclature)")
    print("=" * 70)
    cur.execute("""
        SELECT
            el.name as level_name,
            ec.name as cycle_name,
            eg.name as grade_name,
            eg.code as grade_code,
            s.code as series_code,
            s.name as series_name
        FROM "education_grades" eg
        LEFT JOIN "education_cycles" ec ON ec.id = eg."cycleId"
        LEFT JOIN "education_levels" el ON el.id = ec."levelId"
        LEFT JOIN "education_series" s ON s.id = eg."seriesId"
        WHERE el."tenantId" = %s
        ORDER BY el."order", ec."order", eg."order"
    """, (TENANT_ID,))
    rows = cur.fetchall()
    print(f"  Total: {len(rows)} grades\n")
    current_level = None
    current_cycle = None
    for r in rows:
        level, cycle, grade, gcode, scode, sname = r
        if level != current_level:
            current_level = level
            print(f"\n  === {level} ===")
            current_cycle = None
        if cycle != current_cycle:
            current_cycle = cycle
            print(f"    --- {cycle} ---")
        series_str = f"  [série: {scode}]" if scode else ""
        print(f"      • {grade} (code={gcode}){series_str}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
