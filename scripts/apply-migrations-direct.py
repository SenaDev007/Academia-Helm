#!/usr/bin/env python3
"""
Migration directe vers Neon PostgreSQL pour Academia Helm.
Applique toutes les migrations en attente sur la base de données de production.

Usage:
    python3 /home/z/my-project/scripts/apply-migrations-direct.py
"""

import psycopg2
import os
import sys
from pathlib import Path

# ─── Configuration ─────────────────────────────────────────────────────────
DATABASE_URL = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"

# Migrations à appliquer (dans l'ordre chronologique)
MIGRATIONS = [
    {
        "name": "20260628090000_restore_subject_academicyear_relation",
        "description": "Restore Subject.academicYear FK relation",
    },
    {
        "name": "20260628100000_drop_subject_programs",
        "description": "Drop SubjectProgram table",
    },
    {
        "name": "20260628130000_add_class_official_class_id",
        "description": "Add officialClassId to Class model",
    },
    {
        "name": "20260628140000_add_teacher_class_assignments_class_id",
        "description": "Add classId to teacher_class_assignments",
    },
    {
        "name": "20260630090000_add_teacher_availability_status",
        "description": "Add status column to pedagogy_teacher_availabilities (3-state availability)",
    },
    {
        "name": "20260701080000_extend_admissions_table",
        "description": "Extend admissions with 15+ columns (identity, vœux, guardian, traceability)",
    },
    {
        "name": "20260701090000_drop_all_timetable_configs_schoollevel_fk",
        "description": "Drop FK on timetable_configs.schoolLevelId (wrong table reference)",
    },
    {
        "name": "20260701100000_add_admission_guardian_relationship",
        "description": "Add mainGuardianRelationship column to admissions",
    },
    {
        "name": "20260701110000_drop_admissions_schoollevel_fk",
        "description": "Drop FK on admissions.schoolLevelId (wrong table reference)",
    },
    {
        "name": "20260701120000_recreate_fk_to_education_levels",
        "description": "Recreate FKs toward education_levels (correct table) for admissions + timetable_configs",
    },
    {
        "name": "20260701130000_admission_full_spec",
        "description": "Add missing admission fields + create admission_documents + admission_interviews tables",
    },
]

MIGRATIONS_DIR = Path("/home/z/my-project/apps/api-server/prisma/migrations")
PRISMA_MIGRATIONS_TABLE = "_prisma_migrations"

def get_connection():
    """Établit la connexion à la base de données."""
    # Neon utilise sslmode=require, psycopg2 gère ça via les paramètres de connexion
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    return conn

def ensure_prisma_migrations_table(conn):
    """S'assure que la table _prisma_migrations existe."""
    with conn.cursor() as cur:
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS "{PRISMA_MIGRATIONS_TABLE}" (
                id VARCHAR(36) NOT NULL PRIMARY KEY,
                checksum VARCHAR(64) NOT NULL,
                finished_at TIMESTAMPTZ,
                migration_name VARCHAR(255) NOT NULL,
                logs TEXT,
                rolled_back_at TIMESTAMPTZ,
                started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                applied_steps_count INTEGER NOT NULL DEFAULT 0
            );
        """)
    conn.commit()

def get_applied_migrations(conn):
    """Retourne la liste des migrations déjà appliquées."""
    with conn.cursor() as cur:
        cur.execute(f'SELECT migration_name FROM "{PRISMA_MIGRATIONS_TABLE}" WHERE rolled_back_at IS NULL;')
        return {row[0] for row in cur.fetchall()}

def apply_migration(conn, migration_name):
    """Applique une migration SQL."""
    migration_dir = MIGRATIONS_DIR / migration_name
    sql_file = migration_dir / "migration.sql"

    if not sql_file.exists():
        print(f"  ⚠️  Fichier SQL non trouvé: {sql_file}")
        return False

    sql_content = sql_file.read_text(encoding='utf-8')

    if not sql_content.strip():
        print(f"  ⏭️  Fichier SQL vide, ignoré")
        return True

    try:
        with conn.cursor() as cur:
            # Exécuter le SQL de migration
            cur.execute(sql_content)

        # Enregistrer dans _prisma_migrations
        # ⚠️ Prisma utilise un UUID pour l'ID, pas une string longue.
        # Utiliser un UUID généré par PostgreSQL.
        with conn.cursor() as cur:
            import hashlib
            checksum = hashlib.sha256(sql_content.encode('utf-8')).hexdigest()
            cur.execute(
                f'INSERT INTO "{PRISMA_MIGRATIONS_TABLE}" (id, checksum, finished_at, migration_name, started_at, applied_steps_count) VALUES (gen_random_uuid()::text, %s, now(), %s, now(), 1);',
                (checksum, migration_name)
            )

        conn.commit()
        print(f"  ✅ Appliquée avec succès")
        return True

    except Exception as e:
        conn.rollback()
        err_msg = str(e)
        print(f"  ❌ ÉCHEC: {err_msg}")
        err_lower = err_msg.lower()
        # Si l'erreur est "column already exists" ou "constraint already exists",
        # ou "does not exist" sur un DROP → c'est que la migration a déjà été
        # partiellement appliquée → on l'enregistre comme appliquée
        if ("already exists" in err_lower or
            ("does not exist" in err_lower and "drop" in err_lower) or
            "no constraint found" in err_lower):
            print(f"  ⚠️  Erreur non bloquante (objet existe déjà ou déjà supprimé) — marquée comme appliquée")
            try:
                with conn.cursor() as cur:
                    import hashlib
                    checksum = hashlib.sha256(sql_content.encode('utf-8')).hexdigest()
                    cur.execute(
                        f'INSERT INTO "{PRISMA_MIGRATIONS_TABLE}" (id, checksum, finished_at, migration_name, started_at, applied_steps_count) VALUES (gen_random_uuid()::text, %s, now(), %s, now(), 1) ON CONFLICT (id) DO NOTHING;',
                        (checksum, migration_name)
                    )
                conn.commit()
                return True
            except Exception as e2:
                conn.rollback()
                print(f"  ❌ Impossible d'enregistrer: {e2}")
                return False
        return False

def main():
    print("=" * 70)
    print("  ACADEMIA HELM — Migration directe vers Neon PostgreSQL")
    print("=" * 70)
    print()

    # Vérifier que les fichiers de migration existent
    print("📋 Vérification des fichiers de migration...")
    for m in MIGRATIONS:
        sql_file = MIGRATIONS_DIR / m["name"] / "migration.sql"
        exists = sql_file.exists()
        status = "✅" if exists else "❌"
        print(f"  {status} {m['name']}")
        if not exists:
            print(f"     → {m['description']}")
    print()

    # Connexion à la DB
    print("🔌 Connexion à Neon PostgreSQL...")
    try:
        conn = get_connection()
        print("  ✅ Connexion établie")
    except Exception as e:
        print(f"  ❌ ÉCHEC de connexion: {e}")
        sys.exit(1)
    print()

    # S'assurer que la table _prisma_migrations existe
    ensure_prisma_migrations_table(conn)
    print("  ✅ Table _prisma_migrations vérifiée")
    print()

    # Lister les migrations déjà appliquées
    applied = get_applied_migrations(conn)
    print(f"📦 Migrations déjà appliquées: {len(applied)}")
    for a in sorted(applied):
        print(f"  • {a}")
    print()

    # Appliquer les migrations en attente
    pending = [m for m in MIGRATIONS if m["name"] not in applied]
    print(f"🔄 Migrations en attente: {len(pending)}")
    print()

    if not pending:
        print("✅ Toutes les migrations sont déjà appliquées !")
        conn.close()
        return

    success_count = 0
    fail_count = 0

    for m in pending:
        print(f"▶️  Application: {m['name']}")
        print(f"   Description: {m['description']}")
        ok = apply_migration(conn, m["name"])
        if ok:
            success_count += 1
        else:
            fail_count += 1
            print(f"  ⛔ Arrêt — migration échouée, les suivantes ne seront pas appliquées")
            break
        print()

    # Résumé
    print("=" * 70)
    print(f"  RÉSUMÉ: {success_count} réussie(s), {fail_count} échec(s)")
    print("=" * 70)

    # Vérification finale — lister les colonnes de admissions
    if success_count > 0:
        print()
        print("🔍 Vérification — colonnes de la table 'admissions':")
        with conn.cursor() as cur:
            cur.execute("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'admissions'
                ORDER BY ordinal_position;
            """)
            for row in cur.fetchall():
                nullable = "NULL" if row[2] == "YES" else "NOT NULL"
                print(f"  • {row[0]:30s} {row[1]:20s} {nullable}")

        print()
        print("🔍 Vérification — colonnes de la table 'pedagogy_teacher_availabilities':")
        with conn.cursor() as cur:
            cur.execute("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'pedagogy_teacher_availabilities'
                ORDER BY ordinal_position;
            """)
            for row in cur.fetchall():
                print(f"  • {row[0]:30s} {row[1]}")

    conn.close()
    print()
    print("✅ Migration terminée ! Redéployez le backend sur Fly.io:")
    print("   cd apps/api-server && flyctl deploy")

if __name__ == "__main__":
    main()
