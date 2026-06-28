"""
Vérification du contenu de la table 'classrooms' (classes officielles)
pour identifier à quel tenant appartiennent les données.
"""
import psycopg2

CONN_STR = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"

def main():
    conn = psycopg2.connect(CONN_STR)
    conn.set_session(readonly=True)
    cur = conn.cursor()

    print("=" * 75)
    print("TABLE 'classrooms' — CLASSES OFFICIELLES PAR ANNÉE")
    print("=" * 75)

    # 1. Vue d'ensemble : combien de classrooms par tenant
    print("\n--- 1. Comptage par tenant ---")
    cur.execute("""
        SELECT c."tenantId", t.name as tenant_name, COUNT(*) as nb_classrooms
        FROM "classrooms" c
        LEFT JOIN "tenants" t ON t.id = c."tenantId"
        GROUP BY c."tenantId", t.name
        ORDER BY nb_classrooms DESC
    """)
    rows = cur.fetchall()
    if not rows:
        print("  → La table 'classrooms' est VIDE.")
    else:
        for tid, tname, n in rows:
            print(f"  Tenant: {tname or '(sans nom)'}")
            print(f"    ID:    {tid}")
            print(f"    Nb classrooms: {n}")
            print()

    # 2. Vue d'ensemble : combien par tenant + année scolaire
    print("--- 2. Comptage par tenant + année scolaire ---")
    cur.execute("""
        SELECT
            t.name as tenant_name,
            ay.name as year_name,
            COUNT(*) as nb_classrooms
        FROM "classrooms" c
        LEFT JOIN "tenants" t ON t.id = c."tenantId"
        LEFT JOIN "academic_years" ay ON ay.id = c."academicYearId"
        GROUP BY t.name, ay.name
        ORDER BY t.name, ay.name
    """)
    rows = cur.fetchall()
    for tname, yname, n in rows:
        print(f"  {tname or '(?)':<60} | {yname or '(?)':<15} | {n} classrooms")

    # 3. Détail complet des classrooms
    print("\n--- 3. Détail des classrooms (tous tenants confondus) ---")
    cur.execute("""
        SELECT
            t.name as tenant_name,
            ay.name as year_name,
            c.name as classroom_name,
            c.code as classroom_code,
            c."isActive",
            c."isArchived",
            c."createdAt",
            el.name as level_name,
            ec.name as cycle_name,
            eg.name as grade_name,
            eg.code as grade_code
        FROM "classrooms" c
        LEFT JOIN "tenants" t ON t.id = c."tenantId"
        LEFT JOIN "academic_years" ay ON ay.id = c."academicYearId"
        LEFT JOIN "education_grades" eg ON eg.id = c."gradeId"
        LEFT JOIN "education_cycles" ec ON ec.id = eg."cycleId"
        LEFT JOIN "education_levels" el ON el.id = ec."levelId"
        ORDER BY t.name, ay.name, el."order", ec."order", eg."order"
    """)
    rows = cur.fetchall()
    if not rows:
        print("  → Aucun classroom en BDD.")
    else:
        current_tenant = None
        current_year = None
        for r in rows:
            (tname, yname, cname, ccode, cactive, carchived, ccreated,
             lname, cycname, gname, gcode) = r
            if tname != current_tenant:
                current_tenant = tname
                current_year = None
                print(f"\n  ▼ TENANT: {tname or '(sans nom)'}")
            if yname != current_year:
                current_year = yname
                print(f"    ▶ Année scolaire: {yname or '(?)'}")
            status = "✓ actif" if cactive and not carchived else "✗ inactif/archived"
            print(f"      • {cname:<25} | code={ccode or '—':<20} | {status}")
            print(f"        grade: {gname} ({gcode}) | cycle: {cycname} | niveau: {lname}")
            print(f"        créé le: {ccreated}")

    # 4. Total
    print(f"\n--- 4. Total ---")
    cur.execute('SELECT COUNT(*) FROM "classrooms"')
    total = cur.fetchone()[0]
    print(f"  Total classrooms en BDD: {total}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
