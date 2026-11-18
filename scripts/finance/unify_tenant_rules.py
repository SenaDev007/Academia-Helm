#!/usr/bin/env python3
"""
TASK « AUCUNE RÈGLE SPÉCIFIQUE À UNE ÉCOLE » — Uniformisation totale.
Retour promoteur : « Il ne doit pas avoir de trigger spécifique pour une école…
le même système de calcul, les mêmes règles pour toutes les écoles… tout doit
être recalculé, mis à jour, de la même manière partout. »

RÈGLE UNIQUE (moteur de calcul — identique pour TOUS les tenants) :
  totalDue       = Σ account_breakdowns (COALESCE(adjustedAmount, initialAmount)) — TOUS types de frais
  totalPaid      = GREATEST(totalPaid_actuel, Σ breakdowns.paidAmount) — conserve le crédit non imputé
  balance        = totalDue − totalPaid
  arrearsAmount  = Σ FeeArrear ouverts (OPEN/PARTIALLY_PAID, balanceDue>0, toutes années)
  carriedArrears = Σ FeeArrear ouverts des années ≠ celle du compte

ÉTAPES :
  1. Inventaire exhaustif des objets tenant-spécifiques (triggers, fonctions,
     contraintes CHECK, vues) contenant un UUID de tenant codé en dur.
  2. BACKUP (comptes concernés + définitions des objets DB supprimés).
  3. --apply : DROP des triggers/fonctions Palmares ; alignement uniforme de
     TOUS les comptes de TOUS les tenants sur la règle unique ; tests
     comportementaux en transaction ROLLBACK.
  4. Vérification finale : plus aucun objet tenant-spécifique + invariants à
     0 anomalie sur toutes les écoles.

Usage :
  python3 unify_tenant_rules.py           # dry-run (inspection + inventaire)
  python3 unify_tenant_rules.py --apply   # backup → drop → alignement → tests → commit
"""
import json
import os
import re
import sys
import time
from datetime import datetime

import psycopg2
import psycopg2.extras

# DSN : variable d'environnement (production) ou fichier local du sandbox (dev)
DSN = os.environ.get("DATABASE_URL") or open("/home/z/my-project/scripts/_working_dsn.txt").read().strip()
APPLY = "--apply" in sys.argv
TS = datetime.now().strftime("%Y%m%d_%H%M")
_HERE = os.path.dirname(os.path.abspath(__file__))
BACKUP_PATH = os.path.join(_HERE, f"backup_unify_tenant_rules_{TS}.json")
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")

TENANT_PALMARES = "92d65007-9df3-4a40-ba63-82ba86fe90ad"

PALMARES_TRIGGERS = [
    ("student_accounts", "zz_palmares_sync_totals"),
    ("account_breakdowns", "zz_palmares_resync_after_breakdown"),
    ("fee_structures", "zz_palmares_fee_type_guard"),
]
PALMARES_FUNCTIONS = [
    "palmares_sync_totals_core_fees",
    "palmares_resync_after_breakdown",
    "palmares_fee_type_guard",
    "palmares_sync_totals_excl_general",  # variante antérieure éventuelle (orpheline)
]


def connect(retries=6, delay=4):
    last = None
    for i in range(retries):
        try:
            conn = psycopg2.connect(DSN)
            conn.autocommit = False
            return conn
        except Exception as e:
            last = e
            time.sleep(delay)
    raise last


def P(*a):
    print(*a, flush=True)


conn = connect()
cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
cur.execute("SET statement_timeout = '120s'")

# ══════════════════════════ 1. INVENTAIRE ══════════════════════════
P("═" * 70)
P("1. INVENTAIRE DES OBJETS TENANT-SPÉCIFIQUES (UUID codé en dur)")
P("═" * 70)

cur.execute("SELECT id::text, name FROM tenants ORDER BY name")
tenants = {r[0]: r[1] for r in cur.fetchall()}
P(f"Tenants ({len(tenants)}) : " + ", ".join(tenants.values()))

# 1a. Triggers
cur.execute("""
    SELECT c.relname AS tbl, t.tgname, pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal AND n.nspname = 'public'
    ORDER BY c.relname, t.tgname
""")
tenant_specific_triggers = []
all_triggers = cur.fetchall()
for r in all_triggers:
    uuids = set(UUID_RE.findall(r["def"]))
    if uuids:
        tenant_specific_triggers.append((r["tbl"], r["tgname"], uuids))
P(f"Triggers au total : {len(all_triggers)} ; tenant-spécifiques : {len(tenant_specific_triggers)}")
for tbl, name, uuids in tenant_specific_triggers:
    P(f"  !! [{tbl}] {name} -> {uuids}")

# 1b. Fonctions (public, hors triggers set_updated_at etc.)
cur.execute("""
    SELECT p.proname, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
""")
tenant_specific_functions = []
palmares_defs = {}
for r in cur.fetchall():
    uuids = set(UUID_RE.findall(r["def"]))
    if uuids:
        tenant_specific_functions.append((r["proname"], uuids))
    if "palmares" in r["proname"].lower():
        palmares_defs[r["proname"]] = r["def"]
P(f"Fonctions tenant-spécifiques (UUID en dur) : {len(tenant_specific_functions)}")
for name, uuids in tenant_specific_functions:
    P(f"  !! {name} -> {uuids}")

# 1c. Contraintes CHECK + vues
cur.execute("""
    SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint WHERE contype = 'c'
""")
ck_hits = [(r["tbl"], r["conname"]) for r in cur.fetchall() if UUID_RE.search(r["def"] or "")]
cur.execute("SELECT viewname, definition FROM pg_views WHERE schemaname = 'public'")
vw_hits = [r["viewname"] for r in cur.fetchall() if UUID_RE.search(r["definition"] or "")]
P(f"Contraintes CHECK tenant-spécifiques : {len(ck_hits)} {ck_hits}")
P(f"Vues tenant-spécifiques : {len(vw_hits)} {vw_hits}")

# ══════════════════════════ 2. DÉRIVES (règle unique) ══════════════════════════
P("")
P("═" * 70)
P("2. DÉRIVES PAR RAPPORT À LA RÈGLE UNIQUE (tous tenants, toutes années)")
P("═" * 70)

# totaux par compte
cur.execute("""
    SELECT sa.id::text, sa."tenantId"::text, sa."academicYearId"::text,
           sa."totalDue", sa."totalPaid", sa.balance,
           s."matricule", s."lastName", s."firstName",
           COALESCE(agg.due, 0) AS fees_due, COALESCE(agg.paid, 0) AS fees_paid,
           COALESCE(agg.nlines, 0) AS nlines
    FROM student_accounts sa
    JOIN students s ON s.id = sa."studentId"
    LEFT JOIN (
      SELECT b."studentAccountId" AS acc,
             SUM(COALESCE(b."adjustedAmount", b."initialAmount")) AS due,
             SUM(b."paidAmount") AS paid, COUNT(*) AS nlines
      FROM account_breakdowns b GROUP BY b."studentAccountId"
    ) agg ON agg.acc = sa.id
""")
accounts = cur.fetchall()

# arriérés ouverts par élève (toutes années + par année)
cur.execute("""
    SELECT "studentId"::text AS stu, "tenantId"::text AS ten, "academicYearId"::text AS yr,
           SUM("balanceDue") AS open_amt
    FROM fee_arrears
    WHERE status IN ('OPEN', 'PARTIALLY_PAID') AND "balanceDue" > 0
    GROUP BY 1, 2, 3
""")
arrear_rows = cur.fetchall()
open_total = {}
open_by_year = {}
for r in arrear_rows:
    open_total[(r["ten"], r["stu"])] = open_total.get((r["ten"], r["stu"]), 0) + float(r["open_amt"])
    open_by_year[(r["ten"], r["stu"], r["yr"])] = float(r["open_amt"])

P(f"Comptes au total : {len(accounts)} ; élèves avec arriérés ouverts : {len(open_total)}")

align_totals = []       # comptes dont due/paid/balance dérivent
align_balance_only = [] # comptes sans lignes : réparation de la seule relation balance = dû − payé
align_mirrors = []      # comptes dont arrearsAmount/carriedArrears dérivent
per_tenant_drift = {}

for a in accounts:
    due, paid, bal = float(a["totalDue"] or 0), float(a["totalPaid"] or 0), float(a["balance"] or 0)
    fees_due, fees_paid = float(a["fees_due"] or 0), float(a["fees_paid"] or 0)
    if int(a["nlines"]) == 0:
        # Aucune ligne de frais : la dette historique reste telle quelle (matérialisée
        # en FeeArrear pour le recouvrement) — due/paid non touchés ; on ne répare QUE
        # la relation balance = dû − payé si elle est rompue (même règle que le fix précédent).
        if abs(bal - (due - paid)) > 1:
            align_balance_only.append((a, due, paid, due - paid))
        continue
    new_due = fees_due
    new_paid = max(paid, fees_paid)
    new_bal = new_due - new_paid
    if abs(due - new_due) > 1 or abs(paid - new_paid) > 1 or abs(bal - new_bal) > 1:
        align_totals.append((a, new_due, new_paid, new_bal))
        key = tenants.get(a["tenantId"], a["tenantId"][:12])
        d = per_tenant_drift.setdefault(key, [0, 0.0])
        d[0] += 1
        d[1] += new_due - due

# miroirs arriérés — passe dédiée (clé par studentId)
cur.execute("""
    SELECT sa.id::text, sa."tenantId"::text, sa."academicYearId"::text, sa."studentId"::text,
           sa."arrearsAmount", sa."carriedArrears"
    FROM student_accounts sa
""")
acc_mirrors = cur.fetchall()
for m in acc_mirrors:
    tot_open = open_total.get((m["tenantId"], m["studentId"]), 0.0)
    same_year = open_by_year.get((m["tenantId"], m["studentId"], m["academicYearId"]), 0.0)
    new_amt = tot_open
    new_car = tot_open - same_year
    if abs(float(m["arrearsAmount"] or 0) - new_amt) > 0.01 or abs(float(m["carriedArrears"] or 0) - new_car) > 0.01:
        align_mirrors.append((m, new_amt, new_car))

P(f"Comptes à aligner (totalDue/totalPaid/balance) : {len(align_totals)}")
for tname, (n, drift) in sorted(per_tenant_drift.items()):
    P(f"    {tname}: {n} comptes, écart de dette cumulé {drift:+,.0f} F")
P(f"Comptes à aligner (miroirs arriérés) : {len(align_mirrors)}")
P(f"Comptes sans lignes (réparation balance seule) : {len(align_balance_only)}")
for a, nd, np_, nb in align_balance_only[:8]:
    P(f"    - {tenants.get(a['tenantId'], '?')[:20]} {a['matricule']} {a['lastName']} {a['firstName']}: "
      f"due={nd:,.0f} paid={np_:,.0f} bal {float(a['balance'] or 0):,.0f}→{nb:,.0f} F")
if len(align_balance_only) > 8:
    P(f"    … (+{len(align_balance_only) - 8} autres)")

# détails Palmares
P("")
P("─ Détail Le Palmares Plus (toutes années) ─")
pal_accounts = [a for a in accounts if a["tenantId"] == TENANT_PALMARES]
P(f"Comptes Palmares : {len(pal_accounts)}")
pal_align = [x for x in align_totals if x[0]["tenantId"] == TENANT_PALMARES]
P(f"  dont à aligner : {len(pal_align)}")
for a, nd, np_, nb in pal_align[:6]:
    P(f"    {a['matricule']} {a['lastName']} {a['firstName']} : due {float(a['totalDue']):,.0f}→{nd:,.0f} F, "
      f"paid {float(a['totalPaid']):,.0f}→{np_:,.0f} F, bal {float(a['balance']):,.0f}→{nb:,.0f} F")
if len(pal_align) > 6:
    P(f"    … (+{len(pal_align) - 6} autres)")

# ══════════════════════════ 3. BACKUP ══════════════════════════
backup = {
    "generated_at": datetime.now().isoformat(),
    "purpose": "Uniformisation totale des règles — suppression objets tenant-spécifiques + alignement uniforme",
    "dropped_db_objects": {
        "triggers": [f"{t}::{n}" for t, n, _ in tenant_specific_triggers],
        "functions": {k: v for k, v in palmares_defs.items()},
    },
    "accounts": [
        {
            "tenant": tenants.get(a["tenantId"], a["tenantId"]),
            "accountId": a["id"], "matricule": a["matricule"],
            "name": f"{a['lastName']} {a['firstName']}",
            "before": {"totalDue": float(a["totalDue"] or 0), "totalPaid": float(a["totalPaid"] or 0),
                       "balance": float(a["balance"] or 0)},
            "after": {"totalDue": nd, "totalPaid": np_, "balance": nb},
        }
        for a, nd, np_, nb in align_totals
    ],
    "mirror_updates": [
        {
            "accountId": m["id"], "tenant": tenants.get(m["tenantId"], m["tenantId"]),
            "before": {"arrearsAmount": float(m["arrearsAmount"] or 0),
                       "carriedArrears": float(m["carriedArrears"] or 0)},
            "after": {"arrearsAmount": amt, "carriedArrears": car},
        }
        for m, amt, car in align_mirrors
    ],
}
with open(BACKUP_PATH, "w", encoding="utf-8") as f:
    json.dump(backup, f, ensure_ascii=False, indent=1)
P(f"\nBackup écrit : {BACKUP_PATH}")

# ══════════════════════════ 4. APPLY ══════════════════════════
if APPLY:
    P("")
    P("═" * 70)
    P("4. APPLY — drop objets tenant-spécifiques + alignement uniforme")
    P("═" * 70)

    # 4a. DROP triggers + fonctions
    for tbl, trg in PALMARES_TRIGGERS:
        cur.execute(f'DROP TRIGGER IF EXISTS "{trg}" ON "{tbl}"')
        P(f"  DROP TRIGGER {trg} ON {tbl} -> {cur.statusmessage}")
    for fn in PALMARES_FUNCTIONS:
        cur.execute(f'DROP FUNCTION IF EXISTS "{fn}"()')
        P(f"  DROP FUNCTION {fn}() -> {cur.statusmessage}")

    # 4b. Alignement uniforme des totaux (règle unique) — lignes complètes + réparation balance seule
    batch = align_totals + align_balance_only
    if batch:
        cur.execute("SET LOCAL app.allow_balance_update = 'true'")
        cur.execute("""
            UPDATE student_accounts sa SET
                "totalDue" = m.due, "totalPaid" = m.paid, "balance" = m.due - m.paid,
                "updatedAt" = NOW()
            FROM unnest(%s::text[], %s::numeric[], %s::numeric[], %s::numeric[]) AS m(acc, due, paid, bal)
            WHERE sa.id = m.acc
        """, (
            [a["id"] for a, *_ in batch],
            [nd for _, nd, _, _ in batch],
            [np_ for _, _, np_, _ in batch],
            [nb for _, _, _, nb in batch],
        ))
        P(f"  Alignement totaux : {cur.rowcount} comptes mis à jour "
          f"({len(align_totals)} avec lignes + {len(align_balance_only)} balance seule)")

    # 4c. Miroirs arriérés (règle unique)
    if align_mirrors:
        cur.execute("SET LOCAL app.allow_balance_update = 'true'")
        cur.execute("""
            UPDATE student_accounts sa SET
                "arrearsAmount" = m.amt, "carriedArrears" = m.car, "updatedAt" = NOW()
            FROM unnest(%s::text[], %s::numeric[], %s::numeric[]) AS m(acc, amt, car)
            WHERE sa.id = m.acc
        """, (
            [m["id"] for m, *_ in align_mirrors],
            [amt for _, amt, _ in align_mirrors],
            [car for _, _, car in align_mirrors],
        ))
        P(f"  Miroirs arriérés : {cur.rowcount} comptes mis à jour")

    conn.commit()
    P("  COMMIT effectué.")

    # 4d. Tests comportementaux (transactions séparées, ROLLBACK systématique)
    P("")
    P("─ Tests comportementaux (ROLLBACK — aucune écriture définitive) ─")

    # T1 : un compte Palmares accepte désormais une écriture de totaux sans écrasement
    test_acc = next((a for a, *_ in align_totals if a["tenantId"] == TENANT_PALMARES), None)
    if not test_acc:
        test_acc = next((a for a in pal_accounts if int(a["nlines"]) > 0), None)
    if test_acc:
        try:
            cur.execute('SELECT "totalDue" FROM student_accounts WHERE id = %s', (test_acc["id"],))
            before = float(cur.fetchone()[0])
            conn.commit()
            cur.execute("BEGIN")
            cur.execute("SET LOCAL app.allow_balance_update = 'true'")
            cur.execute(
                'UPDATE student_accounts SET "totalDue" = "totalDue" + 1 WHERE id = %s',
                (test_acc["id"],),
            )
            cur.execute('SELECT "totalDue" FROM student_accounts WHERE id = %s', (test_acc["id"],))
            got = float(cur.fetchone()[0])
            ok = abs(got - before - 1) < 0.01
            P(f"  T1 Palmares écriture totaux persiste (avant {before:,.0f} → lu {got:,.0f}) -> "
              f"{'OK — plus d\'écrasement' if ok else 'ÉCHEC'}")
            conn.rollback()
        except Exception as e:
            conn.rollback()
            P(f"  T1 ÉCHEC : {e}")

    # T2 : sans valve, l'écriture directe reste bloquée pour TOUT le monde (garde-fou générique)
    try:
        cur.execute("BEGIN")
        cur.execute(
            'UPDATE student_accounts SET "totalDue" = "totalDue" + 1 WHERE id = %s',
            (test_acc["id"] if test_acc else accounts[0]["id"],),
        )
        P("  T2 sans valve : ÉCHEC — l'update est passé alors qu'il devait être bloqué")
        conn.rollback()
    except Exception as e:
        conn.rollback()
        P(f"  T2 sans valve : bloqué comme attendu ({str(e).split(chr(10))[0][:70]}…) OK")

    # T3 : feeType CANTEEN/OTHER/EXAMEN autorisés pour Palmares (mêmes règles que les autres)
    cur.execute("""
        SELECT fs.id::text, fs."feeType", fs.name FROM fee_structures fs
        WHERE fs."tenantId" = %s AND fs."feeType" IN ('INSCRIPTION', 'TUITION', 'GENERAL')
        LIMIT 1
    """, (TENANT_PALMARES,))
    fs_row = cur.fetchone()
    if fs_row:
        for probe in ("CANTEEN", "OTHER", "EXAMEN"):
            try:
                cur.execute("BEGIN")
                cur.execute('UPDATE fee_structures SET "feeType" = %s WHERE id = %s', (probe, fs_row["id"]))
                P(f"  T3 Palmares feeType={probe} : accepté (uniforme) OK")
                conn.rollback()
            except Exception as e:
                conn.rollback()
                P(f"  T3 Palmares feeType={probe} : ENCORE BLOQUÉ ({str(e)[:70]}) — À CORRIGER")

    # ══════════════════════════ 5. VÉRIFICATION FINALE ══════════════════════════
    P("")
    P("═" * 70)
    P("5. VÉRIFICATION FINALE — invariants sur TOUS les tenants (règle unique)")
    P("═" * 70)

    cur.execute("""
        SELECT c.relname AS tbl, t.tgname FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE NOT t.tgisinternal AND n.nspname = 'public' AND t.tgname LIKE '%palmares%'
    """)
    left = cur.fetchall()
    P(f"Triggers palmares restants : {len(left)} (attendu 0)")

    cur.execute("""
        SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname ILIKE '%palmares%'
    """)
    P(f"Fonctions palmares restantes : {len(cur.fetchall())} (attendu 0)")

    # Inv-A : totalDue == Σ breakdowns (tous tenants, toutes années)
    cur.execute("""
        SELECT COUNT(*) FROM student_accounts sa
        LEFT JOIN (SELECT b."studentAccountId" AS acc, SUM(COALESCE(b."adjustedAmount", b."initialAmount")) AS due,
                          SUM(b."paidAmount") AS paid, COUNT(*) AS n
                   FROM account_breakdowns b GROUP BY b."studentAccountId") agg ON agg.acc = sa.id
        WHERE COALESCE(agg.n, 0) > 0
          AND ABS(sa."totalDue" - COALESCE(agg.due, 0)) > 1
    """)
    P(f"Inv-A totalDue == Σ lignes de frais : {cur.fetchone()[0]} anomalie(s) (attendu 0)")

    # Inv-B : balance == totalDue − totalPaid
    cur.execute("""
        SELECT COUNT(*) FROM student_accounts sa WHERE ABS(sa.balance - (sa."totalDue" - sa."totalPaid")) > 1
    """)
    P(f"Inv-B balance == dû − payé : {cur.fetchone()[0]} anomalie(s) (attendu 0)")

    # Inv-C : totalPaid >= Σ paidAmount (argent imputé jamais survendu)
    cur.execute("""
        SELECT COUNT(*) FROM student_accounts sa
        LEFT JOIN (SELECT b."studentAccountId" AS acc, SUM(b."paidAmount") AS paid
                   FROM account_breakdowns b GROUP BY b."studentAccountId") agg ON agg.acc = sa.id
        WHERE COALESCE(agg.paid, 0) > sa."totalPaid" + 1
    """)
    P(f"Inv-C totalPaid >= Σ payé lignes : {cur.fetchone()[0]} anomalie(s) (attendu 0)")

    # Inv-D : miroirs arriérés exacts
    cur.execute("""
        SELECT COUNT(*) FROM student_accounts sa
        LEFT JOIN (
          SELECT fa."studentId" AS stu, fa."tenantId" AS ten,
                 SUM(fa."balanceDue") AS tot
          FROM fee_arrears fa WHERE fa.status IN ('OPEN','PARTIALLY_PAID') AND fa."balanceDue" > 0
          GROUP BY 1, 2
        ) o ON o.ten = sa."tenantId" AND o.stu = sa."studentId"
        LEFT JOIN (
          SELECT fa."studentId" AS stu, fa."tenantId" AS ten, fa."academicYearId" AS yr,
                 SUM(fa."balanceDue") AS yr_tot
          FROM fee_arrears fa WHERE fa.status IN ('OPEN','PARTIALLY_PAID') AND fa."balanceDue" > 0
          GROUP BY 1, 2, 3
        ) y ON y.ten = sa."tenantId" AND y.stu = sa."studentId" AND y.yr = sa."academicYearId"
        WHERE ABS(sa."arrearsAmount" - COALESCE(o.tot, 0)) > 0.01
           OR ABS(sa."carriedArrears" - (COALESCE(o.tot, 0) - COALESCE(y.yr_tot, 0))) > 0.01
    """)
    P(f"Inv-D miroirs arriérés (Σ FeeArrear ouverts) : {cur.fetchone()[0]} anomalie(s) (attendu 0)")

    conn.commit()
else:
    conn.rollback()
    P("\nDRY-RUN (rollback) — relancer avec --apply pour exécuter.")

conn.close()
