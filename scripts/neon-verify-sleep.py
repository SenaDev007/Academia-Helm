#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
neon-verify-sleep.py — Vérifie que la base AcademiaHelm DORT sans utilisateur.

Usage :
    export NEON_PWD='...'        # mot de passe neondb_owner (JAMAIS committé)
    python3 scripts/neon-verify-sleep.py [duree_minutes]

Verdict AUTOMATIQUE :
    OK    -> aucun poller < 15 min détecté : le compute doit se suspendre
             ≤ 5 min après la dernière requête (console Neon : « Suspended »).
    FAIL  -> un cron emails 1/min (process A ou API non redéployée) et/ou
             les intervals 30 s / 60 s (code antérieur au 03/11) tournent
             encore : voir docs/NEON-COST-AUDIT.md §5.5.

Dépendance : pip install psycopg2-binary
"""
import os
import sys
import time

try:
    import psycopg2
except ImportError:
    sys.exit("psycopg2 manquant : pip install psycopg2-binary")

HOST = os.environ.get("NEON_HOST", "ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech")
DB = os.environ.get("NEON_DB", "AcademiaHelm")
USER = os.environ.get("NEON_USER", "neondb_owner")
PWD = os.environ.get("NEON_PWD") or input("Mot de passe Neon (neondb_owner) : ")

DURATION_S = int(float(sys.argv[1]) * 60) if len(sys.argv) > 1 else 600
FREQ_S = 2

TRACK = [
    ("emails_due", "SELECT * FROM scheduled_emails"),
    ("community", "community_scheduled_posts"),
    ("chat", "chat_scheduled_messages"),
]

def snap(cur):
    cur.execute("SELECT queryid, calls FROM pg_stat_statements WHERE calls>0")
    return {r[0]: r[1] for r in cur.fetchall()}

def match_all(cur):
    cur.execute("SELECT queryid, calls, left(query,70) FROM pg_stat_statements WHERE calls>0")
    out = {}
    for qid, calls, q in cur.fetchall():
        for name, pat in TRACK:
            if pat in q:
                out[qid] = (name, calls)
    return out

def main():
    conn = psycopg2.connect(host=HOST, dbname=DB, user=USER, password=PWD,
                            sslmode="require", connect_timeout=15,
                            application_name="neon-verify-sleep")
    conn.autocommit = True
    cur = conn.cursor()
    print(f"[verify] surveillance {DURATION_S}s (echantillon {FREQ_S}s) — {time.strftime('%H:%M:%S')}")
    print("[verify] Ctrl+C pour arreter plus tot\n")

    watch = match_all(cur)
    print(f"[verify] {len(watch)} requetes poller suivies")
    t0 = time.time()
    jumps = []
    while time.time() - t0 < DURATION_S:
        time.sleep(FREQ_S)
        try:
            qs = snap(cur)
        except Exception as e:
            print(f"[verify] err: {e}")
            continue
        ts = time.strftime('%H:%M:%S')
        for qid, calls in qs.items():
            if qid in watch:
                name, prev = watch[qid]
                if calls > prev:
                    print(f"  {ts}  +{calls-prev} {name}")
                    jumps.append((ts, name, calls - prev))
                    watch[qid] = (name, calls)
            else:
                pass

    window_m = (time.time() - t0) / 60
    print(f"\n===== VERDICT ({window_m:.0f} min) =====")
    per_name = {}
    for ts, name, n in jumps:
        per_name.setdefault(name, []).append(ts)

    failure = False
    for name, times_ in per_name.items():
        rate = len(times_) / window_m
        if rate >= 0.9:  # ~1 fire/min ou plus
            print(f"  FAIL  {name}: {len(times_)} appels en {window_m:.0f} min "
                  f"(~{rate:.0f}/min) -> POLLER TOUJOURS ACTIF (cadence <= 1 min = code anterieur au 03/11)")
            failure = True
        elif rate >= 0.15:  # ~2/min (30 s) ou plus
            print(f"  FAIL  {name}: {len(times_)} appels en {window_m:.0f} min "
                  f"(~{rate:.1f}/min) -> POLLER TOUJOURS ACTIF (cadence 30-60 s = code anterieur au 03/11)")
            failure = True
        else:
            print(f"  ok    {name}: {len(times_)} appel(s) isole(s) en {window_m:.0f} min (trafic residuel acceptable)")

    if not per_name:
        print("  AUCUN poller vu — trafic de fond nul.")

    if failure:
        print("\n=> CONCLUSION : la base ne DORT pas. Redeployer l'API depuis main"
              " (Railway) et chasser le 2e process — voir docs/NEON-COST-AUDIT.md §5.5.")
        sys.exit(1)
    else:
        print("\n=> CONCLUSION : OK — aucun poller periodique detecte. Le compute doit se"
              " suspendre (console Neon -> 'Suspended') et se reveiller ~500 ms a la 1re requete utilisateur.")
        sys.exit(0)

if __name__ == "__main__":
    main()
