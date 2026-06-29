"""
Investigation : quelle colonne manque dans la BDD ?
Compare le schéma Prisma avec l'état réel de la BDD.
"""
import psycopg2

CONN_STR = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"

def main():
    conn = psycopg2.connect(CONN_STR)
    conn.set_session(readonly=True)
    cur = conn.cursor()

    print("=== État des tables critiques ===\n")

    # 1. Table 'classes' — vérifier les colonnes
    print("--- 1. Table 'classes' — colonnes présentes en BDD ---")
    cur.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'classes'
        ORDER BY ordinal_position
    """)
    classes_cols = cur.fetchall()
    if classes_cols:
        for col, dtype in classes_cols:
            print(f"  ✓ {col:<30} {dtype}")
    else:
        print("  → table 'classes' n'existe pas !")

    # 2. Table 'pedagogy_academic_classes' — vérifier les colonnes
    print("\n--- 2. Table 'pedagogy_academic_classes' — colonnes présentes ---")
    cur.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'pedagogy_academic_classes'
        ORDER BY ordinal_position
    """)
    for col, dtype in cur.fetchall():
        print(f"  ✓ {col:<30} {dtype}")

    # 3. Vérifier si la FK classes → pedagogy_academic_classes existe
    print("\n--- 3. Foreign keys sur la table 'classes' ---")
    cur.execute("""
        SELECT conname, conrelid::regclass AS table_from, confrelid::regclass AS table_to
        FROM pg_constraint
        WHERE contype = 'f'
          AND conrelid = 'classes'::regclass
    """)
    fks = cur.fetchall()
    if fks:
        for fk_name, t_from, t_to in fks:
            print(f"  ✓ {fk_name}: {t_from} → {t_to}")
    else:
        print("  → AUCUNE foreign key sur la table 'classes' !")
        print("    La colonne 'officialClassId' existe peut-être mais sans FK.")

    # 4. Vérifier les contraintes d'unicité sur classes
    print("\n--- 4. Contraintes uniques sur 'classes' ---")
    cur.execute("""
        SELECT conname, contype
        FROM pg_constraint
        WHERE conrelid = 'classes'::regclass
          AND contype IN ('u', 'p')
    """)
    for name, ctype in cur.fetchall():
        print(f"  ✓ {name} ({ctype})")

    # 5. Tester directement la requête qui échoue
    print("\n--- 5. Test direct : SELECT * FROM classes LIMIT 1 ---")
    try:
        cur.execute('SELECT * FROM "classes" LIMIT 1')
        cols = [d[0] for d in cur.description]
        print(f"  ✓ OK — colonnes retournées: {cols}")
    except Exception as e:
        print(f"  ✗ ERREUR: {e}")

    # 6. Tester avec la jointure officialClass
    print("\n--- 6. Test jointure classes → pedagogy_academic_classes ---")
    try:
        cur.execute("""
            SELECT c.id, c.name, c."officialClassId", ac.name as official_name
            FROM "classes" c
            LEFT JOIN "pedagogy_academic_classes" ac ON ac.id = c."officialClassId"
            LIMIT 3
        """)
        rows = cur.fetchall()
        print(f"  ✓ OK — {len(rows)} lignes")
        for r in rows:
            print(f"    {r}")
    except Exception as e:
        print(f"  ✗ ERREUR: {e}")

    # 7. Vérifier la dernière migration appliquée
    print("\n--- 7. Dernières migrations Prisma appliquées ---")
    cur.execute("""
        SELECT migration_name, finished_at
        FROM "_prisma_migrations"
        ORDER BY finished_at DESC
        LIMIT 10
    """)
    for name, finished in cur.fetchall():
        status = "✓" if finished else "✗ (en cours/échouée)"
        print(f"  {status} {name}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
