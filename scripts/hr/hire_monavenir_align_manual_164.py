#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tâche 164 (complément) — Alignement des 14 contrats importés sur la
convention « signature manuelle sur papier » du build 1.0.34 (22/11/2026) :
terms.{employerSignerName, employerSignedAt, employerIpAddress,
employerSignatureMethod='MANUSCRITE_PAPIER', signerName, signerRole='EMPLOYE',
signedAt, ipAddress, signatureMethod='MANUSCRITE_PAPIER', signatureMode='MANUEL',
signatureNote} + signedBy = représentant employeur — miroir exact de
ContractPdfService.signContractManual().

Mode : python3 script.py [dry|apply]  (défaut : dry — ROLLBACK)
"""
import sys
import json
import datetime as dt
import psycopg2

DSN = open('/home/z/my-project/scripts/_working_dsn.txt').read().strip()
TID = "e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb"
EMPLOYER_SIGNER = "Julien OGBON"   # signataire employeur des contrats du tenant
SIGNATURE_NOTE = ("Contrat signé manuellement sur papier par les deux parties — "
                  "enregistrement déclaré par le service RH.")

MODE = sys.argv[1] if len(sys.argv) > 1 else "dry"
APPLY = MODE == "apply"
print(f"MODE : {'APPLICATION RÉELLE' if APPLY else 'DRY-RUN (ROLLBACK)'}")

conn = psycopg2.connect(DSN)
conn.autocommit = False
cur = conn.cursor()
now = dt.datetime.now()

try:
    cur.execute(
        'SELECT c.id, c."signedAt"::text, s."employeeNumber", s."firstName", s."lastName", '
        's."hireDate"::text '
        'FROM employment_contracts c JOIN staff s ON s.id=c."staffId" '
        'WHERE c."tenantId"=%s AND s."employeeNumber" BETWEEN \'CSPMON-P-26-00022\' AND \'CSPMON-P-26-00035\' '
        'ORDER BY s."employeeNumber"', (TID,))
    contracts = cur.fetchall()
    assert len(contracts) == 14, f"14 contrats attendus, trouvés : {len(contracts)}"

    for cid, signed_at, emp_num, first, last, hire in contracts:
        # La date de signature conservée = date de 1re prise de service (déjà en base)
        day = (hire or "")[:10] or now.date().isoformat()
        iso = f"{day}T00:00:00.000Z"
        employee_name = f"{first} {last}".strip()
        terms = {
            "employerSignerName": EMPLOYER_SIGNER,
            "employerSignedAt": iso,
            "employerIpAddress": None,
            "employerSignatureMethod": "MANUSCRITE_PAPIER",
            "signerName": employee_name,
            "signerRole": "EMPLOYE",
            "signedAt": iso,
            "ipAddress": None,
            "signatureMethod": "MANUSCRITE_PAPIER",
            "signatureMode": "MANUEL",
            "signatureNote": SIGNATURE_NOTE,
        }
        cur.execute(
            'UPDATE employment_contracts SET terms=%s, "signedBy"=%s, "updatedAt"=%s '
            'WHERE id=%s AND "tenantId"=%s',
            (json.dumps(terms), EMPLOYER_SIGNER, now, cid, TID))
        assert cur.rowcount == 1
        print(f"  {emp_num} → MANUSCRITE_PAPIER ({employee_name}, signé le {iso[:10]})")

    if APPLY:
        conn.commit()
        print("\n✅ COMMIT — les 14 contrats portent la mention MANUSCRITE_PAPIER.")
    else:
        conn.rollback()
        print("\n↩️  DRY-RUN ROLLBACKé.")
except Exception as e:
    conn.rollback()
    print(f"\n❌ ERREUR (rollback) : {e}")
    raise
finally:
    conn.close()
