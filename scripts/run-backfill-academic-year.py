#!/usr/bin/env python3
"""
Exécute le backfill des academicYearId NULL sur la base Neon.
"""
import psycopg2

DB_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require'

# Lire le fichier de migration
with open('/home/z/my-project/repo/Academia-Helm/apps/api-server/prisma/migrations/20260618120000_backfill_academic_year_id/migration.sql', 'r') as f:
    sql = f.read()

print('=== Backfill academicYearId NULL ===')
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# Vérifier les lignes NULL avant backfill
print('\n=== Avant backfill ===')
tables_to_check = [
    'payments', 'fee_configurations', 'finance_expenses', 'messages',
    'financial_settings', 'generated_documents', 'ged_documents',
    'canteen_attendances', 'canteen_subscriptions', 'transport_zones',
    'library_reports', 'infirmary_reports', 'educast_reports', 'qhse_reports',
    'kpi_snapshots', 'orion_alerts', 'staff_allowances', 'staff_trainings',
    'atlas_conversations', 'atlas_messages', 'activity_logs',
]
for table in tables_to_check:
    cur.execute(f'SELECT COUNT(*) FROM {table} WHERE "academicYearId" IS NULL')
    count = cur.fetchone()[0]
    if count > 0:
        print(f'  {table}: {count} lignes NULL')

print('\nExécution du backfill...')
try:
    cur.execute(sql)
    conn.commit()
    print('✓ Backfill exécuté avec succès')
except Exception as e:
    conn.rollback()
    print(f'❌ Erreur: {e}')
    import sys
    sys.exit(1)

# Vérifier après backfill
print('\n=== Après backfill ===')
for table in tables_to_check:
    cur.execute(f'SELECT COUNT(*) FROM {table} WHERE "academicYearId" IS NULL')
    count = cur.fetchone()[0]
    if count > 0:
        print(f'  ⚠ {table}: {count} lignes encore NULL (tenant sans année ?)')

print('\n✓ Terminé')
cur.close()
conn.close()
