#!/usr/bin/env python3
"""
Academia Helm — Rescope du COMPTE DE L'ÉLÈVE (moteur unifié, build 1.0.29)
==========================================================================

Application de la règle métier IDENTIQUE pour tous les tenants :
  compte de l'élève = INSCRIPTION + RÉINSCRIPTION + SCOLARITÉ (+ arriérés à
  l'affichage) ; frais généraux / examens / cantine suivis À PART.

Le script applique, dans l'ordre (tous tenants, aucune exception école) :
  1. Le DDL du moteur (migrations/unify_compte_eleve_engine.sql) :
     colonne finance_transactions."arrearsApplied", fonction
     recompute_student_account_totals(), triggers sur account_breakdowns et
     finance_transactions (remplacement de l'incrément aveugle).
  2. L'annotation RÉTROACTIVE du ledger (bypass contrôlé app.allow_closure_override,
     posé uniquement ici — jamais par l'application) :
       R1 : paiements partiellement imputés → la part non imputée a payé des
            arriérés via le FIFO historique → arrearsApplied = montant − imputé ;
       R2 : paiements sans imputation sur les comptes d'une année NON DERNIÈRE
            (encaissements d'arriérés de l'onglet Recouvrement) →
            arrearsApplied = montant.
  3. La RECOMPUTE de TOUS les comptes (tous tenants, toutes années) par la
     fonction moteur + resynchronisation des miroirs d'arriérés.
  4. La VALIDATION des invariants + rapport par tenant.

Usage :
  DATABASE_URL="postgresql://..." python3 rescope_student_accounts.py            # dry-run
  DATABASE_URL="postgresql://..." python3 rescope_student_accounts.py --apply   # exécution
  BACKUP_PATH=... (défaut : backup_rescope_<ts>.json dans le répertoire courant)

Idempotent : ré-exécutable sans effet supplémentaire (après déploiement, pour
resorber d'éventuels paiements passés pendant la fenêtre de mise en production).
"""

import json
import os
import sys
import time
from datetime import datetime

import psycopg2

DRY_RUN = "--apply" not in sys.argv
DDL_ONLY = "--ddl-only" in sys.argv

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MIGRATION_PATH = os.path.join(
    REPO_ROOT, "apps", "api-server", "prisma", "migrations", "unify_compte_eleve_engine.sql"
)

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    print("ERROR: DATABASE_URL env var required")
    sys.exit(1)

BACKUP_PATH = os.environ.get(
    "BACKUP_PATH",
    f"backup_rescope_student_accounts_{datetime.now().strftime('%Y%m%d_%H%M')}.json",
)


def connect(retries=6, delay=4):
    last = None
    for _ in range(retries):
        try:
            return psycopg2.connect(DB_URL)
        except Exception as e:  # pooler parfois instable — retries
            last = e
            time.sleep(delay)
    raise last


def q(cur, sql, params=None):
    cur.execute(sql, params or ())
    return cur.fetchall()


def fmt(n):
    return f"{round(float(n)):,}".replace(",", " ")


def main():
    with open(MIGRATION_PATH, "r", encoding="utf-8") as f:
        ddl = f.read()

    conn = connect()
    conn.autocommit = False
    cur = conn.cursor()

    print("=" * 78)
    print(f"RESCOPE COMPTE ÉLÈVE — moteur unifié ({'DRY-RUN' if DRY_RUN else 'APPLY'})")
    print("=" * 78)

    # ── 0. État avant (backup + snapshot) ─────────────────────────────────────
    print("\n[0] Snapshot AVANT (tous tenants)")
    cur.execute("""
        SELECT t.name, count(*), round(sum(sa."totalDue")), round(sum(sa."totalPaid")),
               round(sum(sa."balance")), round(sum(sa."arrearsAmount"))
        FROM student_accounts sa JOIN tenants t ON t.id = sa."tenantId"
        GROUP BY t.name ORDER BY t.name
    """)
    before = {r[0]: r[1:] for r in cur.fetchall()}
    for name, row in before.items():
        print(f"    {name[:52]:<52} comptes={row[0]:<5} dû={fmt(row[1]):>12} payé={fmt(row[2]):>12} "
              f"solde={fmt(row[3]):>12} arr={fmt(row[4]):>12}")

    # Candidats d'annotation (lecture seule)
    cur.execute("""
        SELECT count(*), round(sum(ft.amount - a.tot))
        FROM finance_transactions ft
        JOIN (SELECT "financeTransactionId", sum(amount) AS tot
              FROM finance_transaction_allocations GROUP BY 1) a
          ON a."financeTransactionId" = ft.id
        WHERE ft.type = 'PAYMENT' AND ft.amount - a.tot > 0.005
          AND NOT EXISTS (SELECT 1 FROM finance_transactions r
                          WHERE r."reversedFromId" = ft.id AND r.type = 'REVERSAL')
    """)
    r1_n, r1_sum = cur.fetchone()
    cur.execute("""
        SELECT count(*), round(sum(ft.amount))
        FROM finance_transactions ft
        WHERE ft.type = 'PAYMENT'
          AND NOT EXISTS (SELECT 1 FROM finance_transaction_allocations a
                          WHERE a."financeTransactionId" = ft.id)
          AND NOT EXISTS (SELECT 1 FROM finance_transactions r
                          WHERE r."reversedFromId" = ft.id AND r.type = 'REVERSAL')
          AND EXISTS (SELECT 1 FROM student_accounts sa
                      JOIN academic_years ay ON ay.id = sa."academicYearId"
                      JOIN academic_years ly ON ly."tenantId" = sa."tenantId"
                          AND ly."startDate" > ay."startDate"
                      WHERE sa.id = ft."studentAccountId")
    """)
    r2_n, r2_sum = cur.fetchone()
    print(f"\n[0.b] Annotation rétroactive — candidats ledger-purs :")
    print(f"    R1 (FIFO historique, part non imputée) : {r1_n} tx, {fmt(r1_sum)} F")
    print(f"    R2 (encaissements arriérés années non dernières) : {r2_n} tx, {fmt(r2_sum)} F")

    if DDL_ONLY:
        conn.rollback()
        conn.autocommit = True
        print("\n[DDL-ONLY] Application du DDL du moteur (idempotent)…")
        cur.execute(ddl)
        print("    OK — colonne arrearsApplied + fonctions + triggers en place "
              "(l'ancien trigger aveugle est supprimé).")
        conn.close()
        print("\n>>> DDL APPLIQUÉ. Relancer sans flag pour la simulation, "
              "puis --apply pour l'alignement complet.")
        return

    # Simulation des nouveaux totaux (formule du moteur, sans écriture)
    # (requiert le DDL appliqué au préalable : --ddl-only)
    print("\n[0.c] Simulation des nouveaux totaux (formule moteur, lecture seule)")
    cur.execute("""
        SELECT t.name, count(*) FILTER (WHERE abs(sim.due - sa."totalDue") > 0.01
                                        OR abs(sim.paid - sa."totalPaid") > 0.01),
               round(sum(sa."totalDue")), round(sum(sim.due)),
               round(sum(sa."totalPaid")), round(sum(sim.paid)),
               round(sum(sa."balance")), round(sum(sim.due - sim.paid))
        FROM student_accounts sa
        JOIN tenants t ON t.id = sa."tenantId"
        JOIN LATERAL (
          SELECT
            coalesce((SELECT sum(ab."initialAmount") FROM account_breakdowns ab
                      JOIN fee_structures fs ON fs.id = ab."feeStructureId"
                      WHERE ab."studentAccountId" = sa.id
                        AND fs."feeType" IN ('INSCRIPTION','REINSCRIPTION','TUITION')), 0) AS due,
            coalesce((SELECT sum(ab."paidAmount") FROM account_breakdowns ab
                      JOIN fee_structures fs ON fs.id = ab."feeStructureId"
                      WHERE ab."studentAccountId" = sa.id
                        AND fs."feeType" IN ('INSCRIPTION','REINSCRIPTION','TUITION')), 0)
            + public.student_account_advance(sa.id) AS paid
        ) sim ON true
        GROUP BY t.name ORDER BY t.name
    """)
    sim = {r[0]: r[1:] for r in cur.fetchall()}
    for name, row in sim.items():
        print(f"    {name[:52]:<52} comptes à corriger={row[0]:<5} "
              f"dû {fmt(row[1])} → {fmt(row[2])} | payé {fmt(row[3])} → {fmt(row[4])} | "
              f"solde {fmt(row[5])} → {fmt(row[6])}")

    if DRY_RUN:
        conn.rollback()
        print("\n>>> DRY-RUN TERMINÉ (aucune écriture). Relancer avec --apply pour exécuter.")
        conn.close()
        return

    # ── 1. Backup complet (avant toute écriture) ──────────────────────────────
    print(f"\n[1] Backup → {BACKUP_PATH}")
    backup = {"generatedAt": datetime.now().isoformat(), "tenantAccounts": {}, "transactions": []}
    cur.execute("""
        SELECT sa.id, t.name, sa."studentId", sa."academicYearId", sa."totalDue", sa."totalPaid",
               sa."balance", sa."arrearsAmount", sa."carriedArrears"
        FROM student_accounts sa JOIN tenants t ON t.id = sa."tenantId"
        ORDER BY t.name, sa.id
    """)
    for r in cur.fetchall():
        backup["tenantAccounts"].setdefault(r[1], []).append(
            {"id": r[0], "studentId": r[2], "academicYearId": r[3],
             "totalDue": float(r[4]), "totalPaid": float(r[5]), "balance": float(r[6]),
             "arrearsAmount": float(r[7]), "carriedArrears": float(r[8])}
        )
    cur.execute("""
        SELECT ft.id, ft."studentAccountId", ft.type, ft.amount, ft."arrearsApplied"
        FROM finance_transactions ft ORDER BY ft.id
    """)
    for r in cur.fetchall():
        backup["transactions"].append(
            {"id": r[0], "studentAccountId": r[1], "type": r[2],
             "amount": float(r[3]), "arrearsApplied": float(r[4])}
        )
    with open(BACKUP_PATH, "w", encoding="utf-8") as f:
        json.dump(backup, f, ensure_ascii=False)
    print(f"    {len(backup['transactions'])} transactions, "
          f"{sum(len(v) for v in backup['tenantAccounts'].values())} comptes sauvegardés.")

    # ── 2. DDL du moteur (idempotent) ─────────────────────────────────────────
    print("\n[2] DDL du moteur (unify_compte_eleve_engine.sql)")
    conn.rollback()
    conn.autocommit = True
    cur.execute(ddl)
    conn.autocommit = False
    print("    OK — colonne arrearsApplied + fonctions + triggers en place.")

    # ── 3. Annotation rétroactive (bypass contrôlé) ──────────────────────────
    print("\n[3] Annotation rétroactive du ledger")
    cur.execute("SET LOCAL app.allow_closure_override = 'true'")
    cur.execute("""
        UPDATE finance_transactions ft
        SET "arrearsApplied" = ft.amount - a.tot
        FROM (SELECT "financeTransactionId", sum(amount) AS tot
              FROM finance_transaction_allocations GROUP BY 1) a
        WHERE ft.id = a."financeTransactionId"
          AND ft.type = 'PAYMENT' AND ft.amount - a.tot > 0.005
          AND NOT EXISTS (SELECT 1 FROM finance_transactions r
                          WHERE r."reversedFromId" = ft.id AND r.type = 'REVERSAL')
    """)
    print(f"    R1 : {cur.rowcount} transactions annotées (part FIFO arriérés).")
    cur.execute("""
        UPDATE finance_transactions ft
        SET "arrearsApplied" = ft.amount
        WHERE ft.type = 'PAYMENT'
          AND NOT EXISTS (SELECT 1 FROM finance_transaction_allocations a
                          WHERE a."financeTransactionId" = ft.id)
          AND NOT EXISTS (SELECT 1 FROM finance_transactions r
                          WHERE r."reversedFromId" = ft.id AND r.type = 'REVERSAL')
          AND EXISTS (SELECT 1 FROM student_accounts sa
                      JOIN academic_years ay ON ay.id = sa."academicYearId"
                      JOIN academic_years ly ON ly."tenantId" = sa."tenantId"
                          AND ly."startDate" > ay."startDate"
                      WHERE sa.id = ft."studentAccountId")
    """)
    print(f"    R2 : {cur.rowcount} transactions annotées (encaissements arriérés, années passées).")
    conn.commit()

    # ── 4. Recompute de TOUS les comptes (moteur) ────────────────────────────
    print("\n[4] Recompute de tous les comptes (fonction moteur)")
    cur.execute("SELECT count(*) FROM student_accounts")
    total_accounts = cur.fetchone()[0]
    cur.execute("SELECT public.recompute_student_account_totals(sa.id) FROM student_accounts sa")
    conn.commit()
    print(f"    {total_accounts} comptes recalculés (tous tenants, toutes années).")

    # ── 5. Miroirs d'arriérés resynchronisés (tous tenants) ───────────────────
    print("\n[5] Miroirs d'arriérés (arrearsAmount / carriedArrears)")
    cur.execute("SET LOCAL app.allow_balance_update = 'true'")
    cur.execute("""
        UPDATE student_accounts sa
        SET "arrearsAmount" = coalesce(agg.total_open, 0),
            "carriedArrears" = coalesce(agg.other_open, 0),
            "updatedAt" = now()
        FROM (
          SELECT a.id,
                 sum(fa."balanceDue") AS total_open,
                 sum(fa."balanceDue") FILTER (WHERE fa."academicYearId" <> a."academicYearId") AS other_open
          FROM student_accounts a
          LEFT JOIN fee_arrears fa
            ON fa."studentId" = a."studentId" AND fa."tenantId" = a."tenantId"
           AND fa.status IN ('OPEN','PARTIALLY_PAID') AND fa."balanceDue" > 0
          GROUP BY a.id
        ) agg
        WHERE agg.id = sa.id
          AND (sa."arrearsAmount" <> coalesce(agg.total_open, 0)
               OR sa."carriedArrears" <> coalesce(agg.other_open, 0))
    """)
    print(f"    {cur.rowcount} comptes de miroirs resynchronisés (Σ FeeArrear ouverts).")
    conn.commit()

    # ── 6. Validation des invariants (tous tenants) ───────────────────────────
    print("\n[6] Validation des invariants")
    checks = [
        ("I1 dû = Σ lignes cœur (INSCRIPTION/RÉINSCRIPTION/TUITION)", """
            SELECT count(*) FROM student_accounts sa
            WHERE abs(sa."totalDue" - coalesce((
                SELECT sum(ab."initialAmount") FROM account_breakdowns ab
                JOIN fee_structures fs ON fs.id = ab."feeStructureId"
                WHERE ab."studentAccountId" = sa.id
                  AND fs."feeType" IN ('INSCRIPTION','REINSCRIPTION','TUITION')), 0)) > 0.01
        """),
        ("I2 solde = dû − payé", """
            SELECT count(*) FROM student_accounts sa
            WHERE abs(sa."totalDue" - sa."totalPaid" - sa."balance") > 0.01
        """),
        ("I3 payé = Σ payé cœur + avance (moteur)", """
            SELECT count(*) FROM student_accounts sa
            WHERE abs(sa."totalPaid" - (coalesce((
                SELECT sum(ab."paidAmount") FROM account_breakdowns ab
                JOIN fee_structures fs ON fs.id = ab."feeStructureId"
                WHERE ab."studentAccountId" = sa.id
                  AND fs."feeType" IN ('INSCRIPTION','REINSCRIPTION','TUITION')), 0)
                + public.student_account_advance(sa.id))) > 0.01
        """),
        ("I4 payé ≥ 0", "SELECT count(*) FROM student_accounts WHERE \"totalPaid\" < -0.01"),
        ("I5 miroirs arriérés exacts", """
            SELECT count(*) FROM student_accounts sa
            WHERE abs(sa."arrearsAmount" - coalesce((
                SELECT sum(fa."balanceDue") FROM fee_arrears fa
                WHERE fa."studentId" = sa."studentId" AND fa."tenantId" = sa."tenantId"
                  AND fa.status IN ('OPEN','PARTIALLY_PAID') AND fa."balanceDue" > 0), 0)) > 0.01
        """),
    ]
    all_ok = True
    for label, sql in checks:
        cur.execute(sql)
        n = cur.fetchone()[0]
        ok = n == 0
        all_ok = all_ok and ok
        print(f"    {'OK ' if ok else 'ÉCHEC'} {label} : {n} anomalie(s)")

    # ── 7. État après + échantillon de contrôle (compte élève affiché) ───────
    print("\n[7] État APRÈS (tous tenants)")
    cur.execute("""
        SELECT t.name, count(*), round(sum(sa."totalDue")), round(sum(sa."totalPaid")),
               round(sum(sa."balance")), round(sum(sa."arrearsAmount"))
        FROM student_accounts sa JOIN tenants t ON t.id = sa."tenantId"
        GROUP BY t.name ORDER BY t.name
    """)
    for name, n, due, paid, bal, arr in cur.fetchall():
        print(f"    {name[:52]:<52} comptes={n:<5} dû={fmt(due):>12} payé={fmt(paid):>12} "
              f"solde={fmt(bal):>12} arr={fmt(arr):>12}")

    print("\n[7.b] Échantillon de contrôle — compte élève AFFICHÉ (dû = scolarité + arriérés)")
    cur.execute("""
        SELECT t.name, s."lastName", s."firstName",
               round(sa."totalDue"), round(sa."totalPaid"), round(sa."balance"),
               round(sa."arrearsAmount"),
               round(sa."totalDue" + sa."arrearsAmount"),
               round(sa."balance" + sa."arrearsAmount")
        FROM student_accounts sa
        JOIN tenants t ON t.id = sa."tenantId"
        JOIN students s ON s.id = sa."studentId"
        WHERE sa."arrearsAmount" > 0
        ORDER BY sa."arrearsAmount" DESC
        LIMIT 8
    """)
    for r in cur.fetchall():
        print(f"    {r[0][:28]:<28} {r[1]} {r[2]:<14} dû={fmt(r[3]):>10} payé={fmt(r[4]):>10} "
              f"solde={fmt(r[5]):>10} | arriérés={fmt(r[6]):>10} → DÛ AFFICHÉ={fmt(r[7]):>10} "
              f"SOLDE AFFICHÉ={fmt(r[8]):>10}")

    conn.commit()
    conn.close()
    print("\n" + "=" * 78)
    print(f"TERMINÉ — invariants {'TOUS OK' if all_ok else 'ÉCHECS DÉTECTÉS'} ; "
          f"backup : {BACKUP_PATH}")
    print("=" * 78)
    sys.exit(0 if all_ok else 2)


if __name__ == "__main__":
    main()
