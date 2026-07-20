"""Apply migration SQL to Neon database - split into individual statements."""
import os
import re
import psycopg2

DATABASE_URL = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"
MIGRATION_FILE = "/home/z/my-project/apps/api-server/prisma/migrations/20260720140000_add_cahier_journal_fiches_registre_appel/migration.sql"

with open(MIGRATION_FILE, "r") as f:
    sql = f.read()

# Remove comment lines starting with --
lines = sql.split("\n")
sql_no_comments = "\n".join([line for line in lines if not line.strip().startswith("--")])

# Split by semicolon but careful with function bodies (none here)
# Simple approach: split on ";"
statements = [s.strip() for s in sql_no_comments.split(";") if s.strip()]

print(f"Total statements: {len(statements)}")
for i, s in enumerate(statements):
    print(f"  Statement {i+1}: {s[:80].replace(chr(10), ' ')}...")

conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = True
cur = conn.cursor()

for i, stmt in enumerate(statements):
    try:
        cur.execute(stmt)
        preview = stmt[:80].replace("\n", " ")
        print(f"✅ {i+1}: {preview}")
    except Exception as e:
        preview = stmt[:80].replace("\n", " ")
        print(f"❌ {i+1}: {preview}")
        print(f"   Error: {e}")

cur.close()
conn.close()

# Verify tables exist
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()
cur.execute("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('cahier_journal_entries', 'pedagogical_sheets', 'attendance_registers', 'monthly_evaluations', 'monthly_summaries')
    ORDER BY table_name;
""")
print("\n=== Tables created ===")
for row in cur.fetchall():
    print(f"  ✅ {row[0]}")

# Verify column quoting
cur.execute("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'pedagogical_sheets' ORDER BY ordinal_position LIMIT 10;
""")
print("\n=== pedagogical_sheets columns (first 10) ===")
for row in cur.fetchall():
    print(f"  - {row[0]}")
cur.close()
conn.close()
