"""Apply cahier_de_tests migration."""
import psycopg2

DATABASE_URL = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"
MIGRATION_FILE = "/home/z/my-project/apps/api-server/prisma/migrations/20260720150000_add_cahier_de_tests/migration.sql"

with open(MIGRATION_FILE) as f:
    sql = f.read()

lines = sql.split("\n")
sql_no_comments = "\n".join([line for line in lines if not line.strip().startswith("--")])
statements = [s.strip() for s in sql_no_comments.split(";") if s.strip()]

conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = True
cur = conn.cursor()

for i, stmt in enumerate(statements):
    try:
        cur.execute(stmt)
        print(f"✅ {i+1}: {stmt[:80].replace(chr(10), ' ')}")
    except Exception as e:
        print(f"❌ {i+1}: {e}")

# Verify table
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'cahier_de_tests' ORDER BY ordinal_position")
print("\n=== cahier_de_tests columns ===")
for row in cur.fetchall():
    print(f"  - {row[0]}: {row[1]}")

cur.close(); conn.close()
print("\n✅ Done")
