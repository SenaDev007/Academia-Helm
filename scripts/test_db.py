"""Test rapide des nouvelles fonctionnalités backend via Neon DB direct."""
import psycopg2

DATABASE_URL = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Vérifier que toutes les tables existent
tables = ['cahier_journal_entries', 'primary_pedagogical_fiches', 'attendance_registers', 'monthly_evaluations', 'monthly_summaries']
print("=== Tables existantes ===")
for t in tables:
    cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = %s", (t,))
    count = cur.fetchone()[0]
    print(f"  {'✅' if count else '❌'} {t}")

# Vérifier les colonnes de monthly_evaluations
print("\n=== Colonnes de monthly_evaluations ===")
cur.execute("""
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'monthly_evaluations'
    ORDER BY ordinal_position
""")
for row in cur.fetchall():
    print(f"  - {row[0]}: {row[1]}")

# Vérifier les colonnes de attendance_registers
print("\n=== Colonnes de attendance_registers ===")
cur.execute("""
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'attendance_registers'
    ORDER BY ordinal_position
""")
for row in cur.fetchall():
    print(f"  - {row[0]}: {row[1]}")

# Vérifier le nombre d'enregistrements dans chaque table
print("\n=== Compteurs ===")
for t in tables:
    try:
        cur.execute(f"SELECT COUNT(*) FROM {t}")
        count = cur.fetchone()[0]
        print(f"  - {t}: {count} enregistrement(s)")
    except Exception as e:
        print(f"  ❌ {t}: {e}")

cur.close()
conn.close()
print("\n✅ Vérification terminée")
