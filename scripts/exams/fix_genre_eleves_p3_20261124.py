#!/usr/bin/env python3
"""175c — Passe 3 (finale) : backfill des genres NULL restants.
Jeux de prénoms classiques français/internationaux + arabes/béninois à
HAUTE CONFIANCE + suffixes féminins (-atou/-ath/-iatou/-anatou/-athou/-elle).
Les prénoms ambigus (Exaucé, Ange, Miracle, Merveille, Chancelle, Rayane,
Yassine, Amal, Camille, Alex…) restent NULL.
Usage : python3 fix_genre_eleves_p3_175c.py [--apply]
"""
import json
import sys
import datetime
import psycopg2

DB_URL = ('postgresql://neondb_owner:npg_cYiR2zofhs0v@'
          'ep-winter-firefly-b9dujjz5-pooler.c-7.eu-central-1.aws.neon.tech/'
          'academia%20helm?sslmode=require')
APPLY = '--apply' in sys.argv

F_EXTRA = {
    # classiques FR/international
    'adèle', 'adele', 'béatrice', 'beatrice', 'dénise', 'denise', 'dorine',
    'anna', 'amanda', 'cecilia', 'elvira', 'ingrid', 'iris', 'joyce', 'judy',
    'justine', 'karine', 'malika', 'manal', 'michelle', 'gabrielle', 'florence',
    'francisca', 'fatima', 'faith', 'joana', 'joanita', 'johanna', 'kadidja',
    'joannith', 'janviette', 'evayane', 'eleonnore', 'éléonore', 'eleonore',
    'arielle', 'elielle', 'abimaelle', 'abigael', 'darelle', 'brunelle',
    'charmelle', 'maelyse', 'mariella', 'laurencia', 'fidélia', 'fidelia',
    'filicité', 'felicite', 'immaculée', 'immaculee', 'kleilane', 'kétsia',
    'ketsia', 'kevine', 'bernice', 'angelle', 'anifa', 'akilah', 'awa', 'afi',
    'adjaritou', 'barikissou', 'housna', 'housnat', 'ihssane', 'ilihame',
    'iletou', 'maryamou', 'minatoulaye', 'farahan', 'izath', 'daradjathou',
}
M_EXTRA = {
    'adrien', 'alexandre', 'adnane', 'adriel', 'ahmed', 'ahamadou', 'amine',
    'adam', 'assouman', 'ayman', 'ayouba', 'azim', 'balthazar', 'bernadin',
    'carlos', 'clovis', 'charbel', 'cherif', 'desmond', 'esaie', 'ésaïe',
    'ezékiel', 'ezekiel', 'aboubacar', 'abdala', 'aboul', 'abass', 'adjimal',
    'amarou', 'amdjad', 'bassamou', 'brouhanou', 'daoudou', 'djabarou',
    'djalal', 'djamal', 'djawad', 'djelil', 'epaphas', 'fabiano', 'fahad',
    'farouk', 'farès', 'fares', 'ferdinand', 'fernando', 'fidel', 'fidèl',
    'francis', 'gaston', 'glorieux', 'halilou', 'hiliamou', 'ibahim',
    'idrissou', 'imorou', 'imourou', 'inoussa', 'irchad', 'islam', 'isma',
    'ismail', 'ismaïl', 'israel', 'joel', 'joël', 'jered', 'judicael',
    'kamal', 'kawil', 'kevin', 'khalick', 'loukmane', 'léopold', 'leopold',
    'maahir', 'madjuid', 'mafaz', 'maguid', 'mamoudou', 'mardochée',
    'mardochee', 'mariano', 'maskour', 'moctar', 'mohamadou', 'moubarak',
    'mael', 'maël',
}

def norm_first(name):
    if not name:
        return ''
    n = name.strip().lower()
    for sep in (' ', '-', "'"):
        if sep in n:
            n = n.split(sep)[0]
            break
    return n.strip("''")

def guess(nf):
    if not nf or len(nf) < 3:
        return None
    if nf in F_EXTRA:
        return 'F'
    if nf in M_EXTRA:
        return 'M'
    for suf in ('iatou', 'anatou', 'atou', 'athou', 'ounath', 'ath'):
        if nf.endswith(suf) and len(nf) >= 6:
            return 'F'
    if nf.endswith('elle') and len(nf) >= 7:
        return 'F'
    return None

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()
cur.execute("""
    SELECT s.id, s."firstName", s."lastName", t.name
    FROM students s JOIN tenants t ON t.id = s."tenantId"
    WHERE s."isActive" = true AND s.gender IS NULL
""")
rows = cur.fetchall()
print(f"Mode : {'APPLY' if APPLY else 'DRY-RUN'} — NULL restants : {len(rows)}")

fixes, still = [], []
for sid, first, last, tenant in rows:
    nf = norm_first(first)
    g = guess(nf)
    (fixes if g else still).append((sid, first, last, g, tenant))

print(f"Backfill passe 3 : {len(fixes)}")
for sid, first, last, g, tenant in fixes:
    print(f"  [{'OK' if APPLY else 'dry'}] {first} {last} → {g} ({tenant})")
    if APPLY:
        cur.execute('UPDATE students SET gender = %s, "updatedAt" = NOW() WHERE id = %s AND gender IS NULL', (g, sid))

if APPLY:
    backup = {
        "date": datetime.datetime.now().isoformat(),
        "operation": "fix_genre_eleves_p3_175c",
        "backfills": [{"id": f[0], "prenom": f[1], "nom": f[2], "avant": None, "apres": f[3], "ecole": f[4]} for f in fixes],
    }
    bpath = f"/home/z/my-project/download/backup_genre_eleves_p3_{datetime.datetime.now().strftime('%Y%m%d_%H%M')}.json"
    with open(bpath, 'w', encoding='utf-8') as fh:
        json.dump(backup, fh, ensure_ascii=False, indent=2)
    print(f"Backup : {bpath}")
    conn.commit()
    cur.execute("""
        SELECT t.name, COUNT(*) FILTER (WHERE s.gender = 'F'), COUNT(*) FILTER (WHERE s.gender = 'M'),
               COUNT(*) FILTER (WHERE s.gender IS NULL)
        FROM students s JOIN tenants t ON t.id = s."tenantId"
        WHERE s."isActive" = true GROUP BY t.name ORDER BY 2 + 3 + 4 DESC
    """)
    print("\nRépartition finale (tenant | F | M | NULL) :")
    for r in cur.fetchall():
        print(f"   {r[0][:36]:36} {r[1]:>4} {r[2]:>4} {r[3]:>4}")

conn.close()
print(f"\nRestent NULL (ambigus) : {len(still)}")
print(("✅ PASSE 3 APPLIQUÉE" if APPLY else "Dry-run — relancer avec --apply"))
