#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tâche 164 — Template : fiche complète d'un staff SALARIE_DECLARE existant
+ son contrat + hr_candidate/hr_application + employee_cnss, pour répliquer
exactement les conventions de production lors de l'embauche en masse."""
import json
import psycopg2

DSN = open('/home/z/my-project/scripts/_working_dsn.txt').read().strip()
TID = "e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb"
STAFF_IDS = ["73480809-2a0e-4060-8153-ed062b438fcc",  # KOUAGOU (SALARIE_DECLARE)
             "ce17f79f-fc36-42f4-b0ba-65013f91462c"]  # DOUGLA KOSSI (TEACHER secondaire)


def rows(cur):
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, [str(v) if v is not None else None for v in r])) for r in cur.fetchall()]


def main():
    conn = psycopg2.connect(DSN)
    conn.autocommit = True
    cur = conn.cursor()

    for sid in STAFF_IDS:
        print(f"\n########## STAFF {sid} ##########")
        cur.execute('SELECT * FROM staff WHERE id=%s', (sid,))
        st = rows(cur)
        if st:
            print(json.dumps(st[0], ensure_ascii=False, indent=1, default=str))

        cur.execute('SELECT * FROM employment_contracts WHERE "staffId"=%s ORDER BY "createdAt"', (sid,))
        cs = rows(cur)
        print(f"\n--- contracts ({len(cs)}) ---")
        for c in cs:
            print(json.dumps(c, ensure_ascii=False, indent=1, default=str))

        cur.execute('SELECT * FROM hr_applications WHERE "staffId"=%s ORDER BY "createdAt"', (sid,))
        ap = rows(cur)
        print(f"\n--- hr_applications ({len(ap)}) ---")
        for a in ap:
            print(json.dumps(a, ensure_ascii=False, indent=1, default=str))

        cur.execute('SELECT * FROM employee_cnss WHERE "staffId"=%s', (sid,))
        ec = rows(cur)
        print(f"\n--- employee_cnss ({len(ec)}) ---")
        print(json.dumps(ec, ensure_ascii=False, indent=1, default=str))

        cur.execute('SELECT * FROM teachers WHERE email=(SELECT email FROM staff WHERE id=%s) OR matricule=(SELECT "employeeNumber" FROM staff WHERE id=%s) LIMIT 3', (sid, sid))
        tch = rows(cur)
        print(f"\n--- teacher lié ({len(tch)}) ---")
        for t in tch:
            print(json.dumps(t, ensure_ascii=False, indent=1, default=str))

    # users du tenant (contexte credentials)
    cur.execute("SELECT id, email, role FROM users WHERE email = 'sannitabe156@gmail.com' LIMIT 2")
    print("\n=== users (exemple sannitabe) ===")
    print(json.dumps(rows(cur), ensure_ascii=False, default=str))

    # Contrats du tenant (vue d'ensemble rapide)
    cur.execute(
        'SELECT c.id, c."contractType", c.status, c."statutContractuel", c."documentPaieType", '
        'c."startDate"::text, c."endDate"::text, c."baseSalary", c."signedAt"::text, c."signedBy", '
        'c."cddMotif", c."periodeEssaiMois", c."cddChainId"::text '
        'FROM employment_contracts c WHERE c."tenantId"=%s ORDER BY c."createdAt"', (TID,))
    print("\n=== tous les contrats du tenant ===")
    for c in rows(cur):
        print(json.dumps(c, ensure_ascii=False, default=str))

    # hr_candidates du tenant
    cur.execute(
        'SELECT id, "firstName", "lastName", email, "createdAt" FROM hr_candidates WHERE "tenantId"=%s ORDER BY "createdAt" LIMIT 40', (TID,))
    print("\n=== hr_candidates du tenant ===")
    for c in rows(cur):
        print(json.dumps(c, ensure_ascii=False, default=str))

    conn.close()


if __name__ == "__main__":
    main()
