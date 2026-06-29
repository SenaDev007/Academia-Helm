"""
Investigation: pourquoi la table `classes` est vide mais `classrooms` a des données ?
"""
import psycopg2
import sys

CONN_STR = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"

def main():
    conn = psycopg2.connect(CONN_STR)
    conn.set_session(readonly=True)
    cur = conn.cursor()

    print("=" * 70)
    print("1. Liste des tables contenant 'class' (toutes variantes)")
    print("=" * 70)
    cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND (table_name LIKE '%class%' OR table_name LIKE '%classe%')
        ORDER BY table_name
    """)
    tables = [r[0] for r in cur.fetchall()]
    for t in tables:
        print(f"  - {t}")

    print()
    print("=" * 70)
    print("2. Comptage des lignes dans chaque table")
    print("=" * 70)
    for t in tables:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "{t}"')
            count = cur.fetchone()[0]
            print(f"  {t:<40} → {count} lignes")
        except Exception as e:
            print(f"  {t:<40} → ERREUR: {e}")
            conn.rollback()

    print()
    print("=" * 70)
    print("3. Structure de la table 'classes'")
    print("=" * 70)
    try:
        cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'classes'
            ORDER BY ordinal_position
        """)
        cols = cur.fetchall()
        if not cols:
            print("  → table 'classes' N'EXISTE PAS")
        else:
            for col, dtype, nullable in cols:
                print(f"  {col:<30} {dtype:<20} nullable={nullable}")
    except Exception as e:
        print(f"  ERREUR: {e}")
        conn.rollback()

    print()
    print("=" * 70)
    print("4. Structure de la table 'classrooms'")
    print("=" * 70)
    try:
        cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'classrooms'
            ORDER BY ordinal_position
        """)
        cols = cur.fetchall()
        if not cols:
            print("  → table 'classrooms' N'EXISTE PAS")
        else:
            for col, dtype, nullable in cols:
                print(f"  {col:<30} {dtype:<20} nullable={nullable}")
    except Exception as e:
        print(f"  ERREUR: {e}")
        conn.rollback()

    print()
    print("=" * 70)
    print("5. Structure de la table 'academic_classes'")
    print("=" * 70)
    try:
        cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'academic_classes'
            ORDER BY ordinal_position
        """)
        cols = cur.fetchall()
        if not cols:
            print("  → table 'academic_classes' N'EXISTE PAS")
        else:
            for col, dtype, nullable in cols:
                print(f"  {col:<30} {dtype:<20} nullable={nullable}")
    except Exception as e:
        print(f"  ERREUR: {e}")
        conn.rollback()

    print()
    print("=" * 70)
    print("6. Échantillon de données dans 'classrooms'")
    print("=" * 70)
    try:
        cur.execute('SELECT * FROM "classrooms" LIMIT 3')
        rows = cur.fetchall()
        colnames = [d[0] for d in cur.description]
        if rows:
            print(f"  Colonnes: {colnames}")
            for r in rows:
                print(f"  {r}")
        else:
            print("  → aucune donnée")
    except Exception as e:
        print(f"  ERREUR: {e}")
        conn.rollback()

    print()
    print("=" * 70)
    print("7. Échantillon de données dans 'academic_classes'")
    print("=" * 70)
    try:
        cur.execute('SELECT * FROM "academic_classes" LIMIT 5')
        rows = cur.fetchall()
        colnames = [d[0] for d in cur.description]
        if rows:
            print(f"  Colonnes: {colnames}")
            for r in rows:
                print(f"  {r}")
        else:
            print("  → aucune donnée")
    except Exception as e:
        print(f"  ERREUR: {e}")
        conn.rollback()

    print()
    print("=" * 70)
    print("8. Échantillon de données dans 'classes' (si elle existe)")
    print("=" * 70)
    try:
        cur.execute('SELECT * FROM "classes" LIMIT 5')
        rows = cur.fetchall()
        colnames = [d[0] for d in cur.description]
        if rows:
            print(f"  Colonnes: {colnames}")
            for r in rows:
                print(f"  {r}")
        else:
            print("  → aucune donnée")
    except Exception as e:
        print(f"  ERREUR: {e}")
        conn.rollback()

    print()
    print("=" * 70)
    print("9. Tenants existants")
    print("=" * 70)
    try:
        cur.execute('SELECT id, name FROM "tenants" ORDER BY name LIMIT 10')
        for r in cur.fetchall():
            print(f"  {r[0]} — {r[1]}")
    except Exception as e:
        print(f"  ERREUR: {e}")
        conn.rollback()

    print()
    print("=" * 70)
    print("10. Classes par tenant (toutes tables confondues)")
    print("=" * 70)
    for t in ['classes', 'academic_classes', 'classrooms']:
        try:
            cur.execute(f"""
                SELECT "tenantId", COUNT(*) as cnt
                FROM "{t}"
                GROUP BY "tenantId"
                ORDER BY cnt DESC
                LIMIT 10
            """)
            rows = cur.fetchall()
            print(f"  Table '{t}':")
            if rows:
                for tid, cnt in rows:
                    print(f"    tenant={tid}  →  {cnt} classes")
            else:
                print(f"    → aucune donnée")
        except Exception as e:
            print(f"  Table '{t}' → ERREUR: {e}")
            conn.rollback()

    cur.close()
    conn.close()
    print()
    print("=" * 70)
    print("Investigation terminée.")
    print("=" * 70)

if __name__ == "__main__":
    main()
