#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
neon-hunt-process-a.py — IDENTIFIER le Process A (cron emails 1/min, hôte inconnu).

Contexte (audit 13/11, docs/NEON-COST-AUDIT.md §5.2) : un process inconnu
interroge scheduled_emails 1×/min en direct sur la base, même quand l'API
Railway est arrêtée. Il est le dernier obstacle au scale-to-zero.

Méthode (100 % lecture + un verrou réversible, aucun dommage) :
  Phase 1 (4 min)  : empreinte complète — delta pg_stat_statements (le mix
                    EXACT de requêtes de Process A) + capture pg_stat_activity
                    continue (sessions persistantes, âges, app names).
  Phase 2 (2.7 min): PIÈGE À VERROU — LOCK ACCESS EXCLUSIVE sur
                    scheduled_emails : au tick suivant, Process A BLOQUE
                    (wait_event Lock) et sa session devient visible avec son
                    identité complète (client_addr = IP réelle si endpoint
                    direct, application_name, usename, backend_start = âge
                    réel de la connexion). Puis ROLLBACK → tout repart.

Zéro risque : aucune école connectée (aucun email dû), sweeps 6 h aux heures
00/06/12/18 (jamais pendant la fenêtre), ROLLBACK systématique.

Usage :
    export NEON_PWD='...'
    python3 scripts/neon-hunt-process-a.py
"""
import os
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone

try:
    import psycopg2
except ImportError:
    sys.exit("psycopg2 manquant : pip install psycopg2-binary")

HOST = os.environ.get("NEON_HOST", "ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech")
DB = os.environ.get("NEON_DB", "AcademiaHelm")
USER = os.environ.get("NEON_USER", "neondb_owner")
PWD = os.environ.get("NEON_PWD") or input("Mot de passe Neon (neondb_owner) : ")

PHASE1_S = 240   # 4 min : 4-5 ticks emails + 1 fenêtre keepalive 4 min éventuelle
PHASE2_S = 160   # piège : couvre 2-3 ticks
ACT_POLL_S = 0.15
TRAP_POLL_S = 0.5

OUR_APPS = ["neon-hunt", "neon-hunt-trap", "neon-verify-sleep", "neon-verify-suspend"]


def conn_new(app):
    c = psycopg2.connect(host=HOST, dbname=DB, user=USER, password=PWD,
                          sslmode="require", connect_timeout=25,
                          application_name=app)
    c.autocommit = True
    return c


ACT_SQL = """
SELECT pid, application_name, COALESCE(client_addr::text, '-'), usename,
       backend_start, state, wait_event_type, wait_event, query_start,
       LEFT(query, 170)
FROM pg_stat_activity
WHERE backend_type = 'client backend'
  AND pid <> pg_backend_pid()
  AND application_name <> ALL(%s)
ORDER BY backend_start
"""

STMTS_SQL = "SELECT queryid, calls, LEFT(query, 90) FROM pg_stat_statements WHERE calls > 0"


def fmt_row(r):
    pid, app, addr, user, bstart, state, wet, we, qstart, q = r
    return (f"pid={pid} | app={app!r} | addr={addr} | user={user} | "
            f"connecté depuis={bstart} | state={state} | wait={wet}/{we} | "
            f"query={q!r}")


def main():
    c1 = conn_new("neon-hunt")
    cur = c1.cursor()
    print(f"[hunt] {time.strftime('%H:%M:%S')} — Phase 1 : empreinte {PHASE1_S}s "
          f"(ticks attendus à chaque :00-:02)")

    cur.execute(STMTS_SQL)
    base = {r[0]: (r[1], r[2]) for r in cur.fetchall()}
    sessions = {}   # key -> (first_seen, last_seen, nb, row)
    t0 = time.time()
    while time.time() - t0 < PHASE1_S:
        try:
            cur.execute(ACT_SQL, (OUR_APPS,))
            rows = cur.fetchall()
        except Exception as e:
            print(f"[hunt] err poll: {e}")
            time.sleep(1)
            continue
        ts = time.strftime("%H:%M:%S")
        for r in rows:
            key = (r[0], str(r[4]))   # (pid, backend_start)
            if key not in sessions:
                sessions[key] = [ts, ts, 1, r]
                print(f"  [{ts}] NOUVELLE SESSION : {fmt_row(r)}")
            else:
                sessions[key][1] = ts
                sessions[key][2] += 1
        time.sleep(ACT_POLL_S)

    cur.execute(STMTS_SQL)
    after = {r[0]: (r[1], r[2]) for r in cur.fetchall()}
    print(f"\n[hunt] Phase 1 fin — {len(sessions)} session(s) distincte(s) observée(s)")
    for (pid, bs), (first, last, nb, row) in sessions.items():
        print(f"  session pid={pid} connectée le={bs} — vue {nb}x ({first}→{last})")
        print(f"    identité : app={row[1]!r} addr={row[2]} user={row[3]} "
              f"state={row[5]} wait={row[6]}/{row[7]}")
        print(f"    dernière requête : {row[9]!r}")

    print("\n[hunt] Delta pg_stat_statements (requêtes exécutées pendant la fenêtre) :")
    deltas = []
    for qid, (calls, q) in after.items():
        prev = base.get(qid, (0, q))[0]
        d = calls - prev
        if d > 0:
            deltas.append((d, q))
    deltas.sort(reverse=True)
    for d, q in deltas:
        tag = " <-- NOS REQUÊTES" if ("pg_stat_activity" in q or "pg_stat_statements" in q) else ""
        print(f"  +{d:5d}  {q!r}{tag}")

    print(f"\n[hunt] {time.strftime('%H:%M:%S')} — Phase 2 : PIÈGE À VERROU "
          f"{PHASE2_S}s sur scheduled_emails (ROLLBACK garanti)")
    c2 = conn_new("neon-hunt-trap")
    c2.autocommit = False
    cur2 = c2.cursor()
    cur2.execute("BEGIN")
    cur2.execute("LOCK TABLE scheduled_emails IN ACCESS EXCLUSIVE MODE")
    trapped = {}
    t0 = time.time()
    try:
        while time.time() - t0 < PHASE2_S:
            try:
                cur.execute(ACT_SQL, (OUR_APPS + ["neon-hunt-trap"],))
                rows = cur.fetchall()
            except Exception as e:
                print(f"[hunt] err poll piège: {e}")
                time.sleep(1)
                continue
            ts = time.strftime("%H:%M:%S")
            for r in rows:
                if r[6] == "Lock" or "scheduled_emails" in (r[9] or ""):
                    key = (r[0], str(r[4]))
                    if key not in trapped:
                        trapped[key] = (ts, r)
                        print(f"  ⚠️  [{ts}] SESSION BLOQUÉE PAR LE PIÈGE : {fmt_row(r)}")
                    else:
                        trapped[key] = (ts, r)
            time.sleep(TRAP_POLL_S)
    finally:
        cur2.execute("ROLLBACK")
        c2.close()
        print(f"[hunt] {time.strftime('%H:%M:%S')} — verrou relâché (ROLLBACK), "
              f"{len(trapped)} session(s) piégée(s)")

    if trapped:
        print("\n===== IDENTITÉ DE PROCESS A =====")
        for (pid, bs), (last, r) in trapped.items():
            bs_dt = datetime.fromisoformat(str(bs)) if isinstance(bs, str) else bs
            age_min = (datetime.now(timezone.utc) - bs_dt).total_seconds() / 60
            print(f"  pid={pid} | app={r[1]!r} | client_addr={r[2]} | user={r[3]}")
            print(f"  connexion ouverte le {bs} (≈ {age_min:.0f} min d'âge au moment du piège)")
            print(f"  requête bloquée : {r[9]!r}")
    else:
        print("\n===== AUCUNE session bloquée — Process A n'est PAS passé pendant le piège "
              "(cadence > 2.7 min ? bizarre) =====")

    c1.close()
    print(f"\n[hunt] terminé {time.strftime('%H:%M:%S')}")


if __name__ == "__main__":
    main()
