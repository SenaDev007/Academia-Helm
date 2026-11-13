#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
neon-verify-suspend.py — PROUVE que le compute Neon AcademiaHelm se suspend
(scale-to-zero) après inactivité, et se réveille à la première requête.

Usage :
    export NEON_PWD='...'        # mot de passe neondb_owner (JAMAIS committé)
    python3 scripts/neon-verify-suspend.py [minutes_silence]   # défaut 8

Protocole (à lancer APRÈS neon-verify-sleep.py, verdict OK) :
    T0  : snapshot (postmaster start time, sessions, xacts) puis DÉCONNEXION
    ..  : silence TOTAL (aucune connexion — le timer d'autosuspend 5 min
          est la seule chose qui doit déclencher)
    T1  : re-connexion + snapshot

Verdict automatique :
    SUSPENDED  -> start_time(T1) > start_time(T0) : le compute a redémarré
                  pendant le silence (= suspension + resume). Si en plus
                  l'âge du postmaster à T1 est < 120 s, il s'est réveillé
                  POUR CETTE connexion : il dormait juste avant.
    AWAKE      -> start_time inchangé pendant tout le silence : l'autosuspend
                  ne s'est PAS déclenché (trafic résiduel ? config ?).
    WOKEN-BY-OTHER -> redémarré, mais réveillé bien avant notre connexion :
                  quelqu'un d'autre frappe encore à la porte.
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
SILENCE_MIN = float(sys.argv[1]) if len(sys.argv) > 1 else 8.0
SILENCE_S = int(SILENCE_MIN * 60)


def connect():
    return psycopg2.connect(host=HOST, dbname=DB, user=USER, password=PWD,
                            sslmode="require", connect_timeout=25,
                            application_name="neon-verify-suspend")


def snapshot(conn):
    cur = conn.cursor()
    cur.execute("SELECT now(), pg_postmaster_start_time()")
    now_, start_ = cur.fetchone()
    cur.execute("SELECT count(*) FROM pg_stat_activity WHERE pid <> pg_backend_pid()")
    others = cur.fetchone()[0]
    cur.execute("SELECT xact_commit + xact_rollback FROM pg_stat_database "
                "WHERE datname = current_database()")
    xacts = cur.fetchone()[0]
    return dict(now=now_, start=start_, others=others, xacts=xacts)


def main():
    t_knock_wall = None
    conn = connect()
    conn.autocommit = True
    a = snapshot(conn)
    conn.close()  # le silence total commence ici
    print(f"[T0] {a['now']} | postmaster démarré : {a['start']} | "
          f"autres sessions : {a['others']} | xacts cumulés : {a['xacts']}")
    print(f"[..] SILENCE TOTAL {SILENCE_S}s — aucune connexion autorisée "
          f"(le timer d'autosuspend Neon de 5 min doit être le seul événement)")
    time.sleep(SILENCE_S)

    t_knock_wall = time.time()
    conn = connect()  # doit réveiller le compute s'il dort
    conn.autocommit = True
    knock_latency = time.time() - t_knock_wall
    b = snapshot(conn)
    print(f"[T1] {b['now']} | postmaster démarré : {b['start']} | "
          f"autres sessions : {b['others']} | xacts cumulés : {b['xacts']}")
    print(f"[T1] latence de réveil (connexion) : {knock_latency:.1f}s")

    age_s = (b["now"] - b["start"]).total_seconds()
    delta_x = b["xacts"] - a["xacts"]
    print(f"[T1] âge du postmaster : {age_s:.0f}s | Δxacts fenêtre : {delta_x:+d}")

    if b["start"] > a["start"]:
        if age_s < 120:
            verdict = ("SUSPENDED — preuve : le postmaster a redémarré PENDANT le silence "
                       "et s'est réveillé pour NOTRE connexion (âge {:.0f}s ≈ latence réveil). "
                       "Le compute dormait donc juste avant T1.".format(age_s))
            code = 0
        else:
            verdict = (f"WOKEN-BY-OTHER — le compute a redémarré pendant le silence MAIS "
                       f"il tournait déjà depuis {age_s:.0f}s avant notre connexion : "
                       f"un autre client l'a réveillé en premier (pingeur résiduel ?).")
            code = 1
    else:
        verdict = ("AWAKE — le postmaster n'a JAMAIS redémarré pendant "
                   f"{SILENCE_MIN:.0f} min de silence : l'autosuspend ne s'est pas "
                   "déclenché (trafic résiduel ou configuration).")
        code = 1

    print(f"\n===== VERDICT : {verdict} =====")
    if code == 0:
        print("=> Le scale-to-zero opère. Dans la console Neon, le compute doit")
        print("   maintenant repasser « Suspended » ~5 min après cette dernière requête.")
    conn.close()
    sys.exit(code)


if __name__ == "__main__":
    main()
