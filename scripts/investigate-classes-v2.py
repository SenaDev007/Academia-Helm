"""
Investigation approfondie : tenant 59b8c348-ae5f-4d67-8fbd-af6aefa1f394
(Eveil d'Afrique Education — le tenant client en production)
"""
import psycopg2

CONN_STR = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"

TENANT_ID = "59b8c348-ae5f-4d67-8fbd-af6aefa1f394"  # Eveil d'Afrique

def main():
    conn = psycopg2.connect(CONN_STR)
    conn.set_session(readonly=True)
    cur = conn.cursor()

    print("=" * 70)
    print(f"Tenant: {TENANT_ID} (Eveil d'Afrique Education)")
    print("=" * 70)

    # 1. Années scolaires du tenant
    print("\n--- 1. Années scolaires du tenant ---")
    cur.execute("""
        SELECT id, name, "isActive", "startDate", "endDate"
        FROM "academic_years"
        WHERE "tenantId" = %s
        ORDER BY "startDate" DESC
    """, (TENANT_ID,))
    years = cur.fetchall()
    for y in years:
        print(f"  {y[0]} | {y[1]} | active={y[2]} | {y[3]} → {y[4]}")

    # 2. Classrooms (classes officielles) par année
    print("\n--- 2. Classrooms (classes officielles) par année ---")
    cur.execute("""
        SELECT "academicYearId", COUNT(*)
        FROM "classrooms"
        WHERE "tenantId" = %s
        GROUP BY "academicYearId"
        ORDER BY "academicYearId"
    """, (TENANT_ID,))
    for r in cur.fetchall():
        print(f"  Année {r[0]} → {r[1]} classrooms")

    # 3. pedagogy_academic_classes par année
    print("\n--- 3. pedagogy_academic_classes par année ---")
    cur.execute("""
        SELECT "academicYearId", COUNT(*)
        FROM "pedagogy_academic_classes"
        WHERE "tenantId" = %s
        GROUP BY "academicYearId"
        ORDER BY "academicYearId"
    """, (TENANT_ID,))
    for r in cur.fetchall():
        print(f"  Année {r[0]} → {r[1]} academic_classes")

    # 4. classes (classes physiques) par année
    print("\n--- 4. classes (physiques) par année ---")
    cur.execute("""
        SELECT "academicYearId", COUNT(*)
        FROM "classes"
        WHERE "tenantId" = %s
        GROUP BY "academicYearId"
    """, (TENANT_ID,))
    rows = cur.fetchall()
    if rows:
        for r in rows:
            print(f"  Année {r[0]} → {r[1]} classes physiques")
    else:
        print("  → AUCUNE classe physique dans la table 'classes' pour ce tenant")

    # 5. Échantillon classrooms
    print("\n--- 5. Échantillon classrooms (5 premières) ---")
    cur.execute("""
        SELECT id, name, code, "gradeId", "academicYearId", "isActive", "isArchived"
        FROM "classrooms"
        WHERE "tenantId" = %s
        ORDER BY "createdAt" DESC
        LIMIT 5
    """, (TENANT_ID,))
    for r in cur.fetchall():
        print(f"  id={r[0]}")
        print(f"    name={r[1]} | code={r[2]} | gradeId={r[3]}")
        print(f"    yearId={r[4]} | active={r[5]} | archived={r[6]}")

    # 6. Échantillon pedagogy_academic_classes
    print("\n--- 6. Échantillon pedagogy_academic_classes (5 premières) ---")
    cur.execute("""
        SELECT id, name, code, "levelId", "cycleId", "academicYearId", "isActive"
        FROM "pedagogy_academic_classes"
        WHERE "tenantId" = %s
        ORDER BY "createdAt" DESC
        LIMIT 5
    """, (TENANT_ID,))
    for r in cur.fetchall():
        print(f"  id={r[0]}")
        print(f"    name={r[1]} | code={r[2]} | levelId={r[3]} | cycleId={r[4]}")
        print(f"    yearId={r[5]} | active={r[6]}")

    # 7. class_subjects (liens classe↔matière)
    print("\n--- 7. class_subjects (liens) ---")
    cur.execute("""
        SELECT COUNT(*), "academicYearId"
        FROM "class_subjects"
        WHERE "tenantId" = %s
        GROUP BY "academicYearId"
    """, (TENANT_ID,))
    for r in cur.fetchall():
        print(f"  Année {r[1]} → {r[0]} liens class_subjects")

    # 8. Structure de class_subjects
    print("\n--- 8. Structure class_subjects ---")
    cur.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'class_subjects'
        ORDER BY ordinal_position
    """)
    for r in cur.fetchall():
        print(f"  {r[0]:<30} {r[1]}")

    # 9. Vérifier si class_subjects.classId pointe vers academic_classes ou classes
    print("\n--- 9. Liens class_subjects → classe réelle ---")
    cur.execute("""
        SELECT cs."classId", COUNT(*) as nb
        FROM "class_subjects" cs
        WHERE cs."tenantId" = %s
        GROUP BY cs."classId"
        ORDER BY nb DESC
        LIMIT 5
    """, (TENANT_ID,))
    sample_class_ids = []
    for r in cur.fetchall():
        print(f"  classId={r[0]} → {r[1]} liens")
        sample_class_ids.append(r[0])

    # Pour chaque classId, voir dans quelle table il est
    print("\n--- 10. Où se trouvent ces classIds ? ---")
    for cid in sample_class_ids[:3]:
        # chercher dans pedagogy_academic_classes
        cur.execute('SELECT id, name, code FROM "pedagogy_academic_classes" WHERE id = %s', (cid,))
        r = cur.fetchone()
        if r:
            print(f"  {cid} → trouvé dans pedagogy_academic_classes: {r[1]} ({r[2]})")
            continue
        # chercher dans classes
        cur.execute('SELECT id, name, code FROM "classes" WHERE id = %s', (cid,))
        r = cur.fetchone()
        if r:
            print(f"  {cid} → trouvé dans classes: {r[1]} ({r[2]})")
            continue
        # chercher dans classrooms
        cur.execute('SELECT id, name, code FROM "classrooms" WHERE id = %s', (cid,))
        r = cur.fetchone()
        if r:
            print(f"  {cid} → trouvé dans classrooms: {r[1]} ({r[2]})")
            continue
        print(f"  {cid} → INTROUVABLE dans toutes les tables de classes !")

    # 11. education_levels + grades pour ce tenant
    print("\n--- 11. Education levels, cycles, grades (settings) ---")
    cur.execute("""
        SELECT el.id, el.name, el."isEnabled"
        FROM "education_levels" el
        WHERE el."tenantId" = %s
        ORDER BY el."order"
    """, (TENANT_ID,))
    edu_levels = cur.fetchall()
    for el in edu_levels:
        print(f"  Level: {el[1]} (id={el[0]}, enabled={el[2]})")
        # cycles
        cur.execute("""
            SELECT c.id, c.name, c."order"
            FROM "education_cycles" c
            WHERE c."levelId" = %s
            ORDER BY c."order"
        """, (el[0],))
        for c in cur.fetchall():
            print(f"    Cycle: {c[1]} (id={c[0]}, order={c[2]})")
            # grades
            cur.execute("""
                SELECT g.id, g.name, g.code, g."order"
                FROM "education_grades" g
                WHERE g."cycleId" = %s
                ORDER BY g."order"
            """, (c[0],))
            for g in cur.fetchall():
                print(f"      Grade: {g[1]} (code={g[2]}, id={g[0]}, order={g[3]})")

    cur.close()
    conn.close()
    print()
    print("=" * 70)
    print("Investigation terminée.")
    print("=" * 70)

if __name__ == "__main__":
    main()
