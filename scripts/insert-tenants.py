#!/usr/bin/env python3
"""
Insère les promoteurs pour les 2 tenants existants dans la DB Neon.

Tenant 1 : CSPEB-Eveil d'Afrique Education (id=59b8c348-ae5f-4d67-8fbd-af6aefa1f394)
  Promoteur : Erhel DEGBE
  Email : salumerhel2036@gmail.com
  Tel : +2290144217065, +2290194878834
  Password : CSPEB.fondé2021
  Hash : $2b$10$KIUsj8lDRcerPRggKl4ry.UR0BGi3gCxj4HEt3ulX9Jt3HaDMXETu

Tenant 2 : Academia Helm (id=4246cd3c-518a-44bb-a5e0-4109b8eca372)
  Promoteur : Dawes AKPOVI
  Email : dawesakpovi@gmail.com
  Tel : +2290195722234, +2290161231487
  Password : AcademiaHelm2021
  Hash : $2b$10$aL21NdMj2DHAqO5WrqW2z.zLkZ91hoW7jVq7W96/hzFxhMH2kxbui
"""

import psycopg2
import uuid
from datetime import datetime

DB_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require'

# Hashes bcrypt générés
HASH_CSPEB = '$2b$10$KIUsj8lDRcerPRggKl4ry.UR0BGi3gCxj4HEt3ulX9Jt3HaDMXETu'
HASH_ACADEMIA = '$2b$10$aL21NdMj2DHAqO5WrqW2z.zLkZ91hoW7jVq7W96/hzFxhMH2kxbui'

TENANT_CSPEB_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
TENANT_ACADEMIA_ID = '4246cd3c-518a-44bb-a5e0-4109b8eca372'

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

now = datetime.now().isoformat()

# ─── User 1 : Erhel DEGBE (CSPEB) ──────────────────────────────────────
user1_id = str(uuid.uuid4())
cur.execute("""
    INSERT INTO users (id, "tenantId", email, "passwordHash", "firstName", "lastName", role, status, "createdAt", "updatedAt")
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (email) DO UPDATE SET
        "tenantId" = EXCLUDED."tenantId",
        "passwordHash" = EXCLUDED."passwordHash",
        "firstName" = EXCLUDED."firstName",
        "lastName" = EXCLUDED."lastName",
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        "updatedAt" = EXCLUDED."updatedAt"
    RETURNING id
""", (
    user1_id,
    TENANT_CSPEB_ID,
    'salumerhel2036@gmail.com',
    HASH_CSPEB,
    'Erhel',
    'DEGBE',
    'PROMOTER',
    'active',
    now,
    now,
))
result1 = cur.fetchone()
user1_id = result1[0] if result1 else user1_id
print(f'✅ User 1 inséré : Erhel DEGBE (salumerhel2036@gmail.com) → id={user1_id}')

# ─── User 2 : Dawes AKPOVI (Academia Helm) ─────────────────────────────
user2_id = str(uuid.uuid4())
cur.execute("""
    INSERT INTO users (id, "tenantId", email, "passwordHash", "firstName", "lastName", role, status, "createdAt", "updatedAt")
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (email) DO UPDATE SET
        "tenantId" = EXCLUDED."tenantId",
        "passwordHash" = EXCLUDED."passwordHash",
        "firstName" = EXCLUDED."firstName",
        "lastName" = EXCLUDED."lastName",
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        "updatedAt" = EXCLUDED."updatedAt"
    RETURNING id
""", (
    user2_id,
    TENANT_ACADEMIA_ID,
    'dawesakpovi@gmail.com',
    HASH_ACADEMIA,
    'Dawes',
    'AKPOVI',
    'PROMOTER',
    'active',
    now,
    now,
))
result2 = cur.fetchone()
user2_id = result2[0] if result2 else user2_id
print(f'✅ User 2 inséré : Dawes AKPOVI (dawesakpovi@gmail.com) → id={user2_id}')

# ─── Vérification ───────────────────────────────────────────────────────
cur.execute("""
    SELECT u.id, u.email, u."firstName", u."lastName", u.role, u.status, t.name as tenant_name
    FROM users u
    LEFT JOIN tenants t ON u."tenantId" = t.id
    WHERE u.email IN ('salumerhel2036@gmail.com', 'dawesakpovi@gmail.com')
""")
for r in cur.fetchall():
    print(f'  ✅ {r[1]} → {r[2]} {r[3]} | role={r[4]} | status={r[5]} | tenant={r[6]}')

conn.commit()
cur.close()
conn.close()
print('\n✅ Insertion terminée avec succès !')
