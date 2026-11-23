#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tâche 165 — Purge du brouillon parasite CSPMON-P-26-00021 (staff f8e03511…).

Réplique EXACTEMENT ContractPdfService.abortOnboarding (fix 165) :
  gardes  : staff ONBOARDING_DRAFT (pas ACTIVE/INACTIVE/SUSPENDED)
            + aucun contrat signé/actif (signedAt non nul OU status ACTIVE)
  purge   : hr_candidates explicites (SetNull sinon orphelin) → staff DELETE
            (cascade contracts / staff_documents / staff_allowances / …)
Basé sur le script Task 164 (même DSN, hors dépôt)."""
import sys
import psycopg2

DSN = open('/home/z/my-project/scripts/_working_dsn.txt').read().strip()
STAFF_ID = 'f8e03511-0156-42e3-ba23-348ce4bd8a9d'
TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb'

DRY = '--apply' not in sys.argv

conn = psycopg2.connect(DSN)
conn.autocommit = False
cur = conn.cursor()


def q(sql, args=()):
    cur.execute(sql, args)
    return cur.fetchone()


# ─── Gardes (miroir du service corrigé) ─────────────────────────────────────
staff = q('SELECT "employeeNumber", "status" FROM staff WHERE "id"=%s AND "tenantId"=%s', (STAFF_ID, TENANT_ID))
if not staff:
    print("GARDE KO : staff introuvable (déjà purgé ?) — rien à faire.")
    conn.rollback()
    sys.exit(0)
emp_num, status = staff
print(f"staff : {emp_num} — {status}")
assert status not in ('ACTIVE', 'INACTIVE', 'SUSPENDED'), f"statut {status} : abandon refusé (débauche)"

signed = q(
    'SELECT "id", "signedAt" FROM employment_contracts '
    'WHERE "staffId"=%s AND "tenantId"=%s '
    'AND ("signedAt" IS NOT NULL OR status = \'ACTIVE\') LIMIT 1',
    (STAFF_ID, TENANT_ID),
)
assert not signed, f"contrat signé {signed} : abandon refusé (débauche)"
print("garde OK : aucun contrat signé/actif → purge autorisée")

# ─── Décomptes avant purge ─────────────────────────────────────────────────
# (candidature liée = HrApplication.staffId — FIX 165 ; HrCandidate n'a pas staffId)
n_apps = q('SELECT count(*) FROM hr_applications WHERE "staffId"=%s AND "tenantId"=%s', (STAFF_ID, TENANT_ID))[0]
n_contracts = q('SELECT count(*) FROM employment_contracts WHERE "staffId"=%s AND "tenantId"=%s', (STAFF_ID, TENANT_ID))[0]
n_documents = q('SELECT count(*) FROM staff_documents WHERE "staffId"=%s AND "tenantId"=%s', (STAFF_ID, TENANT_ID))[0]
n_allowances = q('SELECT count(*) FROM staff_allowances WHERE "staffId"=%s AND "tenantId"=%s', (STAFF_ID, TENANT_ID))[0]
print(f"avant purge : {n_contracts} contrat(s), {n_documents} document(s), {n_allowances} indemnité(s), {n_apps} application(s) liée(s)")

if DRY:
    print("DRY-RUN — rien supprimé (relancer avec --apply)")
    conn.rollback()
    sys.exit(0)

# ─── Purge (transaction, miroir du service corrigé) ──────────────────────────
# 1. Candidature liée : applications avec staffId → candidats dont TOUTES les
#    applications appartiennent à ce staff (candidature « pure » du wizard),
#    suppression du candidat (cascade applications/documents/…). Un candidat
#    public multi-offres garde son historique (SetNull sur l'application liée).
cur.execute('SELECT "candidateId" FROM hr_applications WHERE "staffId"=%s AND "tenantId"=%s', (STAFF_ID, TENANT_ID))
candidate_ids = list({row[0] for row in cur.fetchall() if row[0]})
purged_candidates = 0
if candidate_ids:
    cur.execute(
        'DELETE FROM hr_candidates c WHERE c.id = ANY(%s) AND NOT EXISTS ('
        '  SELECT 1 FROM hr_applications a WHERE a."candidateId" = c.id AND a."staffId" IS DISTINCT FROM %s'
        ')', (candidate_ids, STAFF_ID))
    purged_candidates = cur.rowcount

# 2-4. Contrats/documents/indemnités : cascade avec le staff (déjà comptés).
# 5. Fiche personnel — suppression dure, TOUT le reste cascade.
cur.execute('DELETE FROM staff WHERE "id"=%s', (STAFF_ID,))
assert cur.rowcount == 1, "échec suppression staff"
conn.commit()

# ─── Vérification post-purge ───────────────────────────────────────────────
cur = conn.cursor()
for table, col in [('staff', 'id'), ('employment_contracts', '"staffId"'),
                   ('staff_documents', '"staffId"'), ('staff_allowances', '"staffId"'),
                   ('hr_applications', '"staffId"')]:
    cur.execute(f'SELECT count(*) FROM {table} WHERE {col}=%s', (STAFF_ID,))
    n = cur.fetchone()[0]
    print(f"post-purge {table:22s}: {n}")
print(f"✅ purge effectuée : staff 1, contracts {n_contracts}, documents {n_documents}, "
      f"allowances {n_allowances}, candidates {purged_candidates}")
conn.close()
