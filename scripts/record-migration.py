"""
Enregistre la migration dans _prisma_migrations pour éviter que Prisma
ne tente de la ré-appliquer au prochain redéploiement.
"""
import psycopg2
from datetime import datetime

CONN_STR = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"
MIGRATION_NAME = "20260628130000_add_class_official_class_id"

def main():
    conn = psycopg2.connect(CONN_STR)
    conn.autocommit = False
    cur = conn.cursor()

    # Vérifier si la migration est déjà enregistrée
    cur.execute("SELECT migration_name FROM _prisma_migrations WHERE migration_name = %s", (MIGRATION_NAME,))
    if cur.fetchone():
        print(f"ℹ️  Migration {MIGRATION_NAME} déjà enregistrée dans _prisma_migrations.")
    else:
        # Insérer comme terminée
        cur.execute("""
            INSERT INTO _prisma_migrations (id, checksum, migration_name, logs, started_at, finished_at, applied_steps_count, rolled_back_at)
            VALUES (gen_random_uuid(), '', %s, NULL, NOW(), NOW(), 1, NULL)
        """, (MIGRATION_NAME,))
        conn.commit()
        print(f"✅ Migration {MIGRATION_NAME} enregistrée dans _prisma_migrations.")

    # Vérifier
    cur.execute("SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name = %s", (MIGRATION_NAME,))
    row = cur.fetchone()
    print(f"   → {row[0]} | finished_at={row[1]}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
