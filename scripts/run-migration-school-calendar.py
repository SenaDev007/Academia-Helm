#!/usr/bin/env python3
"""
Exécute la migration 20260618000000_add_school_calendar_config sur la base Neon.
Lit le fichier migration.sql et l'exécute via psycopg2.
"""
import psycopg2
import sys

DB_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require'
MIGRATION_FILE = '/home/z/my-project/repo/Academia-Helm/apps/api-server/prisma/migrations/20260618000000_add_school_calendar_config/migration.sql'

# Lire le fichier de migration
with open(MIGRATION_FILE, 'r') as f:
    sql = f.read()

print(f'=== Migration: add_school_calendar_config ===')
print(f'Fichier: {MIGRATION_FILE}')
print(f'Taille: {len(sql)} caractères')
print()

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# Vérifier si la table existe déjà
cur.execute("""
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'school_calendar_configs'
    )
""")
exists = cur.fetchone()[0]
print(f'Table school_calendar_configs existe déjà : {exists}')

if not exists:
    print('\nExécution de la migration...')
    try:
        cur.execute(sql)
        conn.commit()
        print('✓ Migration exécutée avec succès')
    except Exception as e:
        conn.rollback()
        print(f'❌ Erreur: {e}')
        sys.exit(1)
else:
    print('→ Table déjà existante, skip')

# Vérification
print('\n=== Vérification ===')
cur.execute("""
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'school_calendar_configs'
    ORDER BY ordinal_position
""")
cols = cur.fetchall()
print(f'Colonnes ({len(cols)}):')
for col in cols:
    print(f'  {col[0]:25} {col[1]:20} default={col[2]}')

cur.execute("""
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'school_calendar_configs'
""")
indexes = cur.fetchall()
print(f'\nIndex ({len(indexes)}):')
for idx in indexes:
    print(f'  {idx[0]}: {idx[1]}')

cur.execute("""
    SELECT conname, conrelid::regclass AS table_from, confrelid::regclass AS table_to
    FROM pg_constraint
    WHERE conrelid = 'school_calendar_configs'::regclass AND contype = 'f'
""")
fks = cur.fetchall()
print(f'\nForeign keys ({len(fks)}):')
for fk in fks:
    print(f'  {fk[0]}: {fk[1]} → {fk[2]}')

# Vérifier qu'il n'y a pas déjà d'enregistrement
cur.execute('SELECT COUNT(*) FROM school_calendar_configs')
count = cur.fetchone()[0]
print(f'\nEnregistrements actuels : {count} (tous les tenants utilisent les valeurs par défaut Bénin)')

cur.close()
conn.close()
print('\n✓ Terminé')
