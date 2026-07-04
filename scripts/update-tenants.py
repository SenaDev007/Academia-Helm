#!/usr/bin/env python3
"""
1. Insère les numéros de téléphone des promoteurs
2. Supprime les users avec emails directeur@eveilafrique.com, directeur@test.com
3. Remplace dev@academia-hub.local par s.akpovitohou@gmail.com
"""

import psycopg2

DB_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require'

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# 1. Vérifier les colonnes phone dans users
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name ILIKE '%phone%'")
phone_cols = [r[0] for r in cur.fetchall()]
print(f'Phone cols in users: {phone_cols}')

# 2. Supprimer les users de test
print('\n=== Suppression users de test ===')
for email in ['directeur@eveilafrique.com', 'directeur@test.com']:
    cur.execute('SELECT id, email FROM users WHERE email = %s', (email,))
    found = cur.fetchone()
    if found:
        uid = found[0]
        print(f'  Suppression: {found[1]} (id={uid})')
        # Récupérer le tenantId du user à supprimer
        cur.execute('SELECT "tenantId" FROM users WHERE id = %s', (uid,))
        tenant_row = cur.fetchone()
        tenant_id = tenant_row[0] if tenant_row else None

        # Trouver un user de remplacement dans le même tenant (le promoteur)
        replacement_uid = None
        if tenant_id:
            cur.execute('SELECT id FROM users WHERE "tenantId" = %s AND id != %s AND status = \'active\' LIMIT 1', (tenant_id, uid))
            rep = cur.fetchone()
            if rep:
                replacement_uid = rep[0]

        if replacement_uid:
            print(f'  Redirection depenses vers user {replacement_uid}')
            cur.execute('UPDATE finance_expenses SET "requestedById" = %s WHERE "requestedById" = %s', (replacement_uid, uid))
        else:
            # Pas de remplacement — marquer comme REJECTED et mettre requestedById à un UUID vide
            print(f'  Pas de user de remplacement — marquage REJECTED')
            cur.execute("UPDATE finance_expenses SET status = 'REJECTED' WHERE \"requestedById\" = %s", (uid,))

        # Détacher les autres références
        cur.execute("UPDATE audit_logs SET \"userId\" = NULL WHERE \"userId\" = %s", (uid,))
        cur.execute("UPDATE activity_logs SET \"userId\" = NULL WHERE \"userId\" = %s", (uid,))
        cur.execute("DELETE FROM sessions WHERE \"userId\" = %s", (uid,))
        cur.execute("DELETE FROM user_roles WHERE \"userId\" = %s", (uid,))
        cur.execute("DELETE FROM user_devices WHERE \"userId\" = %s", (uid,))
        # Détacher les références FK supplémentaires (noms de colonnes corrigés)
        if replacement_uid:
            cur.execute('UPDATE material_movements SET "performedById" = %s WHERE "performedById" = %s', (replacement_uid, uid))
            cur.execute('UPDATE daily_logs SET "validatedBy" = %s WHERE "validatedBy" = %s', (replacement_uid, uid))
            cur.execute('UPDATE daily_closures SET "createdBy" = %s WHERE "createdBy" = %s', (replacement_uid, uid))
        else:
            cur.execute('UPDATE material_movements SET "performedById" = NULL WHERE "performedById" = %s', (uid,))
            cur.execute('UPDATE daily_logs SET "validatedBy" = NULL WHERE "validatedBy" = %s', (uid,))
            cur.execute('UPDATE daily_closures SET "createdBy" = NULL WHERE "createdBy" = %s', (uid,))
        # Supprimer le user
        cur.execute('DELETE FROM users WHERE id = %s', (uid,))
        print(f'  OK supprime')
    else:
        print(f'  Non trouve: {email}')

# 3. Remplacer dev@academia-hub.local
print('\n=== Remplacement dev@academia-hub.local ===')
cur.execute('SELECT id, email, "tenantId", role FROM users WHERE email = %s', ('dev@academia-hub.local',))
dev_user = cur.fetchone()
if dev_user:
    print(f'  Trouve: {dev_user[1]} tenant={dev_user[2]} role={dev_user[3]}')
    cur.execute('SELECT id FROM users WHERE email = %s', ('s.akpovitohou@gmail.com',))
    existing = cur.fetchone()
    if existing:
        print(f'  s.akpovitohou@gmail.com existe deja → suppression de dev@academia-hub.local')
        cur.execute('DELETE FROM users WHERE email = %s', ('dev@academia-hub.local',))
    else:
        cur.execute('UPDATE users SET email = %s, "updatedAt" = NOW() WHERE email = %s',
                    ('s.akpovitohou@gmail.com', 'dev@academia-hub.local'))
        print(f'  OK: dev@academia-hub.local → s.akpovitohou@gmail.com')
else:
    print('  Non trouve: dev@academia-hub.local')

# 4. Telephones
print('\n=== Telephones ===')
cur.execute("SELECT id, email FROM users WHERE email IN ('salumerhel2036@gmail.com', 'dawesakpovi@gmail.com')")
user_map = {r[1]: r[0] for r in cur.fetchall()}

if phone_cols:
    col = phone_cols[0]
    if 'salumerhel2036@gmail.com' in user_map:
        cur.execute(f'UPDATE users SET {col} = %s WHERE id = %s',
                    ('+2290144217065, +2290194878834', user_map['salumerhel2036@gmail.com']))
        print(f'  OK Erhel: +2290144217065, +2290194878834')
    if 'dawesakpovi@gmail.com' in user_map:
        cur.execute(f'UPDATE users SET {col} = %s WHERE id = %s',
                    ('+2290195722234, +2290161231487', user_map['dawesakpovi@gmail.com']))
        print(f'  OK Dawes: +2290195722234, +2290161231487')
else:
    print('  Pas de colonne phone dans users')

# 5. Verification
print('\n=== Verification ===')
cur.execute("""
    SELECT u.email, u."firstName", u."lastName", u.role, t.name
    FROM users u LEFT JOIN tenants t ON u."tenantId" = t.id
    WHERE u.email IN ('salumerhel2036@gmail.com', 'dawesakpovi@gmail.com', 's.akpovitohou@gmail.com')
""")
for r in cur.fetchall():
    print(f'  {r[0]} → {r[1]} {r[2]} | {r[3]} | {r[4]}')

cur.execute("SELECT email FROM users WHERE email IN ('directeur@eveilafrique.com', 'directeur@test.com', 'dev@academia-hub.local')")
remaining = cur.fetchall()
print(f'  Emails supprimes restants: {[r[0] for r in remaining] if remaining else "Aucun (OK)"}')

conn.commit()
cur.close()
conn.close()
print('\nOK!')
