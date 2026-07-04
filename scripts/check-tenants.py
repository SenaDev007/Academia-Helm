#!/usr/bin/env python3
"""Script pour vérifier et insérer les tenants et promoteurs dans la DB Neon."""

import psycopg2

DB_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require'

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# 1. Vérifier les tenants existants
cur.execute("""
    SELECT id, name, slug, subdomain, status, "subscriptionStatus"
    FROM tenants
    WHERE name ILIKE '%CSPEB%' OR name ILIKE '%Academia%Helm%'
       OR slug ILIKE '%cspeb%' OR slug ILIKE '%academia%helm%'
""")
rows = cur.fetchall()
print('=== TENANTS ===')
for r in rows:
    print(f'  id={r[0]}')
    print(f'  name={r[1]}')
    print(f'  slug={r[2]}')
    print(f'  subdomain={r[3]}')
    print(f'  status={r[4]}')
    print(f'  subscriptionStatus={r[5]}')
    print()

# 2. Vérifier les users existants
cur.execute("""
    SELECT id, email, "tenantId", role, status, "firstName", "lastName"
    FROM users
    WHERE email ILIKE '%salumerhel%' OR email ILIKE '%dawesakpovi%'
       OR email ILIKE '%degbe%' OR email ILIKE '%akpovi%'
""")
users = cur.fetchall()
print('=== USERS ===')
for u in users:
    print(f'  id={u[0]}')
    print(f'  email={u[1]}')
    print(f'  tenant_id={u[2]}')
    print(f'  role={u[3]}')
    print(f'  status={u[4]}')
    print(f'  name={u[5]} {u[6]}')
    print()

# 3. Vérifier le country du Bénin
cur.execute("""
    SELECT id, name FROM countries
    WHERE name ILIKE '%Benin%' LIMIT 5
""")
countries = cur.fetchall()
print('=== COUNTRIES ===')
for c in countries:
    print(f'  id={c[0]} name={c[1]}')

cur.close()
conn.close()
