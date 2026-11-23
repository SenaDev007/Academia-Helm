#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tâche 164 — Inspection (lecture seule) avant embauche en masse du personnel
du SECONDAIRE du tenant CSP Mon Avenir Plus N'Dali (Mon Avenir Plus).

Vérifie : tenant + acronym (matricule), school_levels (Secondaire), année active,
positions/departments du tenant, séquence staff, hr_jobs INTERNAL, collisions
email (staff / teachers / users), max globalMatricule 2026.
"""
import json
import psycopg2

DSN = open('/home/z/my-project/scripts/_working_dsn.txt').read().strip()
TID = "e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb"  # CSP Mon Avenir Plus N'Dali

EMAILS = [
    "Saleckchabiguia12@gmail.com",
    "abouRamane03@gmail.com",
    "sabidohosikanédé@gmail.com",
    "nadjimagba@gmail.com",
    "mikaïlaassoumatouré@gmail.com",
    "sekezoulkanel@gmail.com",
    "mamaabasse4@gmail.com",
    "kayorach@gmail.com",
    "biosikaalbertnari@gmail.com",
    "françois4@gmail.com",
    "issakaakim21@gmail.com",
    "koumaibouraima47@gmail.com",
    "seraphibatekou23@gmail.com",
    "floraawo38@gmail.com",
]


def rows(cur):
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def main():
    conn = psycopg2.connect(DSN)
    conn.autocommit = True
    cur = conn.cursor()

    # 1. Tenant
    cur.execute('SELECT id, name, slug, subdomain, "createdAt" FROM tenants WHERE id=%s', (TID,))
    t = rows(cur)
    print("=== Tenant ===")
    print(json.dumps(t, ensure_ascii=False, default=str))

    # 2. Identité (acronym pour matricule)
    cur.execute(
        'SELECT "schoolAcronym", "schoolName", "createdAt" FROM tenant_identity_profiles '
        'WHERE "tenantId"=%s ORDER BY "createdAt" DESC', (TID,))
    ident = rows(cur)
    print("\n=== tenant_identity_profiles (acronym) ===")
    print(json.dumps(ident, ensure_ascii=False, default=str))

    # 3. School levels
    cur.execute('SELECT id, name, code, "order", "isActive" FROM school_levels WHERE "tenantId"=%s ORDER BY "order"', (TID,))
    lv = rows(cur)
    print("\n=== school_levels ===")
    print(json.dumps(lv, ensure_ascii=False, default=str))

    # 4. Année active
    cur.execute(
        'SELECT id, name, "isActive", "startDate", "endDate" FROM academic_years '
        'WHERE "tenantId"=%s ORDER BY "startDate" DESC LIMIT 5', (TID,))
    ay = rows(cur)
    print("\n=== academic_years (5 récents) ===")
    print(json.dumps(ay, ensure_ascii=False, default=str))

    # 5. Positions du tenant
    cur.execute('SELECT id, name, category FROM positions WHERE "tenantId"=%s ORDER BY category, name', (TID,))
    pos = rows(cur)
    print(f"\n=== positions ({len(pos)}) ===")
    print(json.dumps(pos, ensure_ascii=False, default=str))

    # 6. Departments du tenant
    cur.execute('SELECT id, name FROM departments WHERE "tenantId"=%s ORDER BY name', (TID,))
    dep = rows(cur)
    print("\n=== departments ===")
    print(json.dumps(dep, ensure_ascii=False, default=str))

    # 7. Séquence staff du tenant
    cur.execute('SELECT "current" FROM staff_number_sequences WHERE "tenantId"=%s', (TID,))
    seq = cur.fetchall()
    print("\n=== staff_number_sequences.current ===", seq)

    # 8. Max globalMatricule AH-STF-26-
    cur.execute(
        "SELECT COALESCE(MAX(NULLIF(regexp_replace(\"globalMatricule\", '^AH-STF-26-', ''), '')::int), 0) "
        "FROM staff WHERE \"globalMatricule\" ~ '^AH-STF-26-[0-9]+$'")
    gmax = cur.fetchone()[0]
    print("=== max globalMatricule AH-STF-26-XXXXXX ===", gmax)

    # 9. hr_jobs INTERNAL
    cur.execute("SELECT id, ref, title, status FROM hr_jobs WHERE \"tenantId\"=%s AND ref='INTERNAL'", (TID,))
    ij = rows(cur)
    print("\n=== hr_jobs INTERNAL ===")
    print(json.dumps(ij, ensure_ascii=False, default=str))

    # 10. Staff existant du tenant
    cur.execute(
        'SELECT id, "employeeNumber", "firstName", "lastName", email, status, "roleType", '
        '"schoolLevelId", "statutContractuel" FROM staff WHERE "tenantId"=%s ORDER BY "createdAt"', (TID,))
    st = rows(cur)
    print(f"\n=== staff existant du tenant ({len(st)}) ===")
    for s in st:
        print(json.dumps(s, ensure_ascii=False, default=str))

    # 11. Collisions email (staff)
    cur.execute(
        'SELECT email, "tenantId", "firstName", "lastName" FROM staff WHERE lower(email) = ANY(%s)',
        ([e.lower() for e in EMAILS],))
    col = rows(cur)
    print(f"\n=== collisions email staff ({len(col)}) ===")
    print(json.dumps(col, ensure_ascii=False, default=str))

    # 12. Collisions email (users)
    cur.execute(
        'SELECT email, id, role FROM users WHERE lower(email) = ANY(%s)',
        ([e.lower() for e in EMAILS],))
    colu = rows(cur)
    print(f"\n=== collisions email users ({len(colu)}) ===")
    print(json.dumps(colu, ensure_ascii=False, default=str))

    # 13. Collisions email (teachers)
    cur.execute(
        'SELECT email, id, "firstName", "lastName" FROM teachers WHERE lower(email) = ANY(%s)',
        ([e.lower() for e in EMAILS],))
    colt = rows(cur)
    print(f"\n=== collisions email teachers ({len(colt)}) ===")
    print(json.dumps(colt, ensure_ascii=False, default=str))

    # 14. Teachers du secondaire existants (contexte)
    cur.execute(
        'SELECT t.id, t.matricule, t."firstName", t."lastName", t."schoolLevelId", t.position '
        'FROM teachers t JOIN school_levels sl ON sl.id=t."schoolLevelId" '
        'WHERE t."tenantId"=%s ORDER BY t."createdAt"', (TID,))
    tch = rows(cur)
    print(f"\n=== teachers du tenant ({len(tch)}) ===")
    for x in tch:
        print(json.dumps(x, ensure_ascii=False, default=str))

    # 15. SMIG en vigueur (information)
    cur.execute(
        'SELECT "countryCode", smig, "effectiveFrom" FROM payroll_fiscal_rates '
        'WHERE "countryCode"=%s ORDER BY "effectiveFrom" DESC LIMIT 2', ('BJ',))
    sm = rows(cur)
    print("\n=== payroll_fiscal_rates BJ ===")
    print(json.dumps(sm, ensure_ascii=False, default=str))

    # 16. Colonnes staff utiles
    cur.execute(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_name='staff' AND column_name IN "
        "('dateOfBirth','birthDate','nationalId','ifuNumber','statutContractuel',"
        "'documentPaieType','statutContractuelLockedAt','cnssDeclarationDate','salary')")
    cols = rows(cur)
    print("\n=== colonnes staff (vérif) ===")
    print(json.dumps(cols, ensure_ascii=False, default=str))

    conn.close()


if __name__ == "__main__":
    main()
