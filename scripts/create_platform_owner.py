"""Create PLATFORM_OWNER account for senakponakpovi@academiahelm.com."""
import psycopg2
import bcrypt

DATABASE_URL = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"
EMAIL = "senakponakpovi@academiahelm.com"
PASSWORD = "Sèna.akpoviadminAH"
FIRST_NAME = "Sèna"
LAST_NAME = "AKPOVI"

# Hash the password
hashed = bcrypt.hashpw(PASSWORD.encode('utf-8'), bcrypt.gensalt(10)).decode('utf-8')

conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = True
cur = conn.cursor()

# Check if user already exists
cur.execute('SELECT id, role, status FROM "users" WHERE email = %s', (EMAIL,))
existing = cur.fetchone()
if existing:
    print(f"User already exists: id={existing[0]}, role={existing[1]}, status={existing[2]}")
    # Update password and role
    cur.execute(
        'UPDATE "users" SET "passwordHash" = %s, role = %s, status = %s WHERE email = %s',
        (hashed, 'PLATFORM_OWNER', 'active', EMAIL)
    )
    print(f"Updated: role=PLATFORM_OWNER, password reset")
else:
    # Create new user
    import uuid
    user_id = str(uuid.uuid4())
    cur.execute(
        '''INSERT INTO "users" (id, email, "passwordHash", "firstName", "lastName", role, status, "createdAt", "updatedAt")
           VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())''',
        (user_id, EMAIL, hashed, FIRST_NAME, LAST_NAME, 'PLATFORM_OWNER', 'active')
    )
    print(f"Created: id={user_id}, role=PLATFORM_OWNER")

# Verify
cur.execute('SELECT id, email, role, status FROM "users" WHERE email = %s', (EMAIL,))
row = cur.fetchone()
print(f"\nFinal: id={row[0]}, email={row[1]}, role={row[2]}, status={row[3]}")

cur.close()
conn.close()
print("\n✅ Done")
