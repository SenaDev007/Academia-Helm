#!/usr/bin/env python3
"""175c — Passe 2 : backfill des genres NULL restants avec les conventions
de nommage musulmanes/béninoises À HAUTE CONFIANCE uniquement :
  - féminin : suffixe -atou/-ath/-iatou/-anatou (Kadidjath, Rihanatou…) ;
    prénoms arabes féminins courants (Imane, Ikram, Mariam, Divine…)
  - masculin : Mouhamadou, Adamou, Ousmane, Aboubakari, Hamdane, …
Les prénoms réellement ambigus (Exaucé, Ange, Miracle, Merveille, Chancelle,
Rayane, Yassine…) restent NULL — liste remise au promoteur.
Usage : python3 fix_genre_eleves_p2_175c.py [--apply]
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
    'imane', 'ikram', 'divine', 'mariam', 'mariama', 'prunelle', 'belvida',
    'aichatou', 'noura', 'houlda', 'youssoura', 'faouzane', 'hayath',
    'annaelle', 'kaouchara', 'samsiatou', 'aichatou', 'fatimath', 'ramatoulaye',
}
M_EXTRA = {
    'mouhamadou', 'adamou', 'ousmane', 'aboubakari', 'hamdane', 'badrane',
    'ramadane', 'icham', 'amir', 'samir', 'imad', 'nazif', 'afdal', 'fayad',
    'josias', 'bacharou', 'prince', 'junior', 'johannès', 'johannes',
    'rouchdane', 'salami', 'abdoul', 'aziz', 'rachid', 'said', 'saïd',
}

def norm_first(name: str | None) -> str:
    if not name:
        return ''
    n = name.strip().lower()
    for sep in (' ', '-', "'"):
        if sep in n:
            n = n.split(sep)[0]
            break
    return n.strip("''")

def guess(nf: str) -> str | None:
    """Retourne 'F'/'M' si haute confiance, sinon None."""
    if not nf or len(nf) < 4:
        return None
    if nf in F_EXTRA:
        return 'F'
    if nf in M_EXTRA:
        return 'M'
    # Suffixes féminins musulmans (béninois) : -atou, -iatou, -anatou, -ounath
    for suf in ('iatou', 'anatou', 'atou', 'ounath', 'ath'):
        if nf.endswith(suf) and len(nf) >= 6:
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
print(f"Mode : {'APPLY' if APPLY else 'DRY-RUN'} — élèves actifs sans genre : {len(rows)}")

fixes, still_null = [], []
for sid, first, last, tenant in rows:
    nf = norm_first(first)
    g = guess(nf)
    if g:
        fixes.append((sid, first, last, g, tenant))
    else:
        still_null.append((sid, first, last, tenant))

print(f"Backfill possible (haute confiance) : {len(fixes)}")
by_tenant = {}
for f in fixes:
    by_tenant.setdefault(f[4], [0, 0])
    by_tenant[f[4]][0 if f[3] == 'F' else 1] += 1
for t, (fcount, mcount) in sorted(by_tenant.items()):
    print(f"   {t}: {fcount} filles + {mcount} garçons")

# Backup
backup = {
    "date": datetime.datetime.now().isoformat(),
    "operation": "fix_genre_eleves_p2_175c",
    "backfills": [{"id": f[0], "prenom": f[1], "nom": f[2], "avant": None, "apres": f[3], "ecole": f[4]} for f in fixes],
}
bpath = f"/home/z/my-project/download/backup_genre_eleves_p2_{datetime.datetime.now().strftime('%Y%m%d_%H%M')}.json"
with open(bpath, 'w', encoding='utf-8') as fh:
    json.dump(backup, fh, ensure_ascii=False, indent=2)
print(f"Backup : {bpath}")

for sid, first, last, g, tenant in fixes:
    print(f"  [{'OK' if APPLY else 'dry'}] {first} {last} → {g} ({tenant})")
    if APPLY:
        cur.execute('UPDATE students SET gender = %s, "updatedAt" = NOW() WHERE id = %s AND gender IS NULL', (g, sid))

if APPLY:
    conn.commit()
    cur.execute("""
        SELECT t.name, COUNT(*) FILTER (WHERE s.gender = 'F'), COUNT(*) FILTER (WHERE s.gender = 'M'),
               COUNT(*) FILTER (WHERE s.gender IS NULL)
        FROM students s JOIN tenants t ON t.id = s."tenantId"
        WHERE s."isActive" = true GROUP BY t.name ORDER BY 2 + 3 + 4 DESC
    """)
    print("\nRépartition après passe 2 (tenant | F | M | NULL) :")
    for r in cur.fetchall():
        print(f"   {r[0][:36]:36} {r[1]:>4} {r[2]:>4} {r[3]:>4}")
else:
    print(f"\nResteraient NULL (ambigus) : {len(still_null)}")

conn.close()
print("\n" + ("✅ PASSE 2 APPLIQUÉE" if APPLY else "Dry-run — relancer avec --apply"))
