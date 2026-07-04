#!/usr/bin/env python3
"""Exécute la migration add_language_to_class_and_exam sur Neon."""
import psycopg2

DB_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require'

with open('/home/z/my-project/repo/Academia-Helm/apps/api-server/prisma/migrations/20260619000000_add_language_to_class_and_exam/migration.sql', 'r') as f:
    sql = f.read()

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

print('=== Migration: add_language_to_class_and_exam ===')
try:
    cur.execute(sql)
    conn.commit()
    print('✓ Migration exécutée avec succès')
except Exception as e:
    conn.rollback()
    print(f'❌ Erreur: {e}')
finally:
    # Vérification
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='classes' AND column_name='language'")
    print(f'  classes.language existe: {cur.fetchone() is not None}')
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='exams' AND column_name='language'")
    print(f'  exams.language existe: {cur.fetchone() is not None}')
    cur.execute("SELECT COUNT(*) FROM classes WHERE language = 'FR'")
    print(f'  classes backfillées FR: {cur.fetchone()[0]}')
    cur.execute("SELECT COUNT(*) FROM exams WHERE language = 'FR'")
    print(f'  exams backfillés FR: {cur.fetchone()[0]}')
    cur.close()
    conn.close()
