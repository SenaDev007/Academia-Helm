#!/usr/bin/env python3
"""Vérifie le role des 2 promoteurs insérés dans la DB Neon."""
import psycopg2

DB_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require'

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

print('=== Users avec emails promoteurs ===')
cur.execute("""
    SELECT u.email, u."firstName", u."lastName", u.role, u.status, t.name, t.slug
    FROM users u LEFT JOIN tenants t ON u."tenantId" = t.id
    WHERE u.email IN ('salumerhel2036@gmail.com', 'dawesakpovi@gmail.com', 's.akpovitohou@gmail.com')
""")
for r in cur.fetchall():
    print(f'  {r[0]} → {r[1]} {r[2]} | role={r[3]} | status={r[4]} | tenant={r[5]} ({r[6]})')

print('\n=== Tous les rôles distincts présents dans users ===')
cur.execute('SELECT role, COUNT(*) FROM users GROUP BY role ORDER BY COUNT(*) DESC')
for r in cur.fetchall():
    print(f'  {r[0]}: {r[1]}')

cur.close()
conn.close()
