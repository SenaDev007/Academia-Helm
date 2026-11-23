#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tâche 164 — Vérification post-import (lecture seule, connexion fraîche)."""
import json
import psycopg2

DSN = open('/home/z/my-project/scripts/_working_dsn.txt').read().strip()
TID = "e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb"
LEVEL_SEC = "95fae326-6da3-4a4a-a95c-6f5164dd5024"


def rows(cur):
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def main():
    conn = psycopg2.connect(DSN)
    conn.autocommit = True
    cur = conn.cursor()

    # 1. Les 14 nouvelles fiches
    cur.execute(
        'SELECT "employeeNumber", "globalMatricule", "firstName", "lastName", gender, '
        '"birthDate"::text, phone, email, position, department, "roleType", '
        '"hireDate"::text, "contractType", status, "schoolLevelId"::text, nationality, '
        '"nationalId", "ifuNumber", "statutContractuel", "documentPaieType", "cnssNumber" '
        'FROM staff WHERE "tenantId"=%s '
        'AND "employeeNumber" BETWEEN \'CSPMON-P-26-00022\' AND \'CSPMON-P-26-00035\' '
        'ORDER BY "employeeNumber"', (TID,))
    st = rows(cur)
    print("=== Fiches staff importées ===")
    for r in st:
        print(json.dumps(r, ensure_ascii=False, default=str))
    print(f"→ {len(st)} fiches (attendu 14)")

    # 2. Contrats correspondants
    cur.execute(
        'SELECT c."contractType", c.status, c."statutContractuel", c."documentPaieType", '
        'c."startDate"::text, c."endDate"::text, c."baseSalary", c."paymentMode", '
        'c."signedAt"::text, c."signedBy", c."periodeEssaiMois", c."cddRenouvellements", '
        'c.terms->>\'signatureMethod\' AS sig_method, '
        'c.terms->>\'employerSignerName\' AS employer, '
        'c.terms->>\'employerSignedAt\' AS emp_signed_at, '
        's."employeeNumber", s."firstName", s."lastName" '
        'FROM employment_contracts c JOIN staff s ON s.id=c."staffId" '
        'WHERE c."tenantId"=%s '
        'AND s."employeeNumber" BETWEEN \'CSPMON-P-26-00022\' AND \'CSPMON-P-26-00035\' '
        'ORDER BY s."employeeNumber"', (TID,))
    cs = rows(cur)
    print(f"\n=== Contrats ({len(cs)} — attendu 14) ===")
    for c in cs:
        print(json.dumps(c, ensure_ascii=False, default=str))

    # 3. Teachers
    cur.execute(
        'SELECT matricule, "firstName", "lastName", "schoolLevelId"::text, position, '
        '"contractType", status, email '
        'FROM teachers WHERE "tenantId"=%s '
        'AND matricule BETWEEN \'CSPMON-P-26-00022\' AND \'CSPMON-P-26-00035\' '
        'ORDER BY matricule', (TID,))
    tch = rows(cur)
    print(f"\n=== Teachers ({len(tch)} — attendu 14) ===")
    for t in tch:
        lvl = "SECONDAIRE OK" if t["schoolLevelId"] == LEVEL_SEC else "WARN " + str(t["schoolLevelId"])
        print(f"{t['matricule']} | {t['firstName']} {t['lastName']} | {lvl} | {t['position']} | {t['status']}")

    # 4. HrApplications
    cur.execute(
        'SELECT a.status, s."employeeNumber", j.ref '
        'FROM hr_applications a '
        'JOIN staff s ON s.id=a."staffId" '
        'JOIN hr_jobs j ON j.id=a."jobId" '
        'WHERE a."tenantId"=%s '
        'AND s."employeeNumber" BETWEEN \'CSPMON-P-26-00022\' AND \'CSPMON-P-26-00035\' '
        'ORDER BY s."employeeNumber"', (TID,))
    ap = rows(cur)
    print(f"\n=== HrApplications ({len(ap)} — attendu 14) ===")
    for a in ap:
        print(f"{a['employeeNumber']} | {a['status']} | job={a['ref']}")

    # 5. Séquence + position + département
    cur.execute('SELECT "current" FROM staff_number_sequences WHERE "tenantId"=%s', (TID,))
    print("\nstaff_number_sequences.current =", cur.fetchone()[0], "(attendu 35)")
    cur.execute('SELECT id, name, category FROM positions WHERE "tenantId"=%s AND name=%s',
                (TID, 'Professeur'))
    print("positions Professeur :", rows(cur))
    cur.execute('SELECT id, name FROM departments WHERE "tenantId"=%s AND name=%s',
                (TID, 'Département Secondaire'))
    print("departments Département Secondaire :", rows(cur))

    # 6. Cohérence : doublons éventuels (même email dans le tenant)
    cur.execute(
        'SELECT lower(email), COUNT(*) FROM staff WHERE "tenantId"=%s '
        'GROUP BY lower(email) HAVING COUNT(*) > 1', (TID,))
    print("\nDoublons email staff :", rows(cur))

    # 7. Effectifs totaux
    cur.execute('SELECT COUNT(*) FROM staff WHERE "tenantId"=%s', (TID,))
    print("Effectif staff total du tenant :", cur.fetchone()[0], "(attendu 35 = 21 + 14)")
    cur.execute('SELECT COUNT(*) FROM staff WHERE "tenantId"=%s AND "schoolLevelId"=%s AND status=%s',
                (TID, LEVEL_SEC, 'ACTIVE'))
    print("Enseignants ACTIFS secondaire :", cur.fetchone()[0], "(attendu 15 = DOUGLA + 14)")

    conn.close()


if __name__ == "__main__":
    main()
