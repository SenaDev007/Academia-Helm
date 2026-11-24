#!/usr/bin/env python3
"""175c — Correction des genres élèves en base (dry-run par défaut) :
  1. CONTRADICTIONS : prénom clairement genré ≠ genre saisi → genre corrigé
  2. BACKFILL : genre NULL + prénom clairement genré → genre renseigné
Les prénoms ambigus (604) ne sont JAMAIS modifiés — liste remise au promoteur.

Usage : python3 fix_genre_eleves_175c.py [--apply]
"""
import json
import sys
import datetime
import psycopg2

DB_URL = ('postgresql://neondb_owner:npg_cYiR2zofhs0v@'
          'ep-winter-firefly-b9dujjz5-pooler.c-7.eu-central-1.aws.neon.tech/'
          'academia%20helm?sslmode=require')

APPLY = '--apply' in sys.argv
SCAN = json.load(open('/home/z/my-project/download/scan_genre_eleves_20261124.json', encoding='utf-8'))

contradictions = SCAN['contradictions']
backfills = SCAN['nulls_backfill']

print(f"Mode : {'APPLY (écriture réelle)' if APPLY else 'DRY-RUN (aucune écriture)'}")
print(f"  contradictions à corriger : {len(contradictions)}")
print(f"  NULL à backfiller          : {len(backfills)}")

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# ── 1. Backup de l'état avant ─────────────────────────────────────────────
all_ids = [c['id'] for c in contradictions] + [b['id'] for b in backfills]
cur.execute(
    'SELECT id, "firstName", "lastName", gender, "tenantId" FROM students WHERE id = ANY(%s)',
    (all_ids,))
backup_rows = cur.fetchall()
backup = {
    "date": datetime.datetime.now().isoformat(),
    "operation": "fix_genre_eleves_175c",
    "avant": [{"id": r[0], "prenom": r[1], "nom": r[2], "genre": r[3], "tenantId": r[4]} for r in backup_rows],
    "corrections": [
        {"id": c['id'], "prenom": c['prenom'], "nom": c['nom'], "avant": c['genre_actuel'], "apres": c['genre_attendu'], "ecole": c['ecole']}
        for c in contradictions
    ],
    "backfills": [
        {"id": b['id'], "prenom": b['prenom'], "nom": b['nom'], "avant": None, "apres": b['genre'], "ecole": b['ecole']}
        for b in backfills
    ],
}
bpath = f"/home/z/my-project/download/backup_genre_eleves_{datetime.datetime.now().strftime('%Y%m%d_%H%M')}.json"
with open(bpath, 'w', encoding='utf-8') as f:
    json.dump(backup, f, ensure_ascii=False, indent=2)
print(f"\nBackup écrit : {bpath} ({len(backup_rows)} lignes)")

# ── 2. Application (ou simulation) ────────────────────────────────────────
n_fix = 0
for c in contradictions:
    if APPLY:
        cur.execute('UPDATE students SET gender = %s, "updatedAt" = NOW() WHERE id = %s AND gender = %s',
                    (c['genre_attendu'], c['id'], c['genre_actuel']))
        n_fix += cur.rowcount
    print(f"  [{'OK' if APPLY else 'dry'}] {c['prenom']} {c['nom']} : {c['genre_actuel']} → {c['genre_attendu']} ({c['ecole']})")

n_bf = 0
for b in backfills:
    if APPLY:
        cur.execute('UPDATE students SET gender = %s, "updatedAt" = NOW() WHERE id = %s AND gender IS NULL',
                    (b['genre'], b['id']))
        n_bf += cur.rowcount
print(f"\nBackfills {'appliqués' if APPLY else 'simulés'} : {n_bf if APPLY else len(backfills)}")

if APPLY:
    conn.commit()
    # ── 3. Vérification post-apply ────────────────────────────────────────
    cur.execute("""
        SELECT COUNT(*) FROM students s
        WHERE s."isActive" = true
          AND (
            (s.gender = 'M' AND LOWER(SPLIT_PART(SPLIT_PART(SPLIT_PART("firstName", ' ', 1), '-', 1), '''', 1)) IN (
              'marie','grâce','grace','joséphine','josephine','anaïs','anais','eunice','prisca','agnès','agnes',
              'bénédicte','benedicte','cécile','cecile','charlotte','claire','estelle','flora','georgette','henriette',
              'inès','ines','irène','irene','jeanne','jocelyne','léa','lea','louise','lucie','madeleine','marthe',
              'michèle','michele','murielle','nathalie','nicole','odile','pauline','pélagie','pelagie','reine',
              'sabine','simone','sophie','sylvie','thérèse','therese','valérie','valerie','véronique','veronique',
              'virginie','yolande','bernadette','adjoa','akouavi','amina','fatou','aïcha','aicha','mariama','raissa',
              'rébecca','rebecca','mireille','céline','celine','aurélie','aurelie','chantal','christiane','christelle',
              'diane','edith','édith','eliane','éliane','fanny','gaëlle','gaelle','isabelle','judith','laure',
              'linda','mélissa','melissa','miriam','myriam','nadia','nancy','olivia','sandra','sarah','solange',
              'suzanne','tatiana','vanessa','yvette','yvonne','anastasie','angèle','angele','antoinette','assiba',
              'aurore','brigitte','caroline','catherine','clarisse','déborah','deborah','elise','élise','emmanuella',
              'esther','gloria','gracia','joséphine','kadiatou','libère','pascaline','rosine','sidonie','espérance',
              'esperance','miséricorde','misericorde','consolata','scolastique','colombe','leontine','léontine'))
            OR (s.gender = 'F' AND LOWER(SPLIT_PART(SPLIT_PART(SPLIT_PART("firstName", ' ', 1), '-', 1), '''', 1)) IN (
              'jean','pierre','emmanuel','samuel','éric','eric','étienne','etienne','françois','francois','henri',
              'honoré','honore','joseph','jules','louis','luc','marc','maurice','michel','olivier','pascal',
              'philippe','rémy','remy','richard','robert','roger','roland','sébastien','sebastien','stéphane',
              'stephane','thierry','thomas','vincent','xavier','yves','zacharie','abdoulaye','aboubakar','ahmadou',
              'amadou','moussa','ibrahim','yacouba','mamadou','mohamed','ali','omar','kofi','kwame','yao','kossi',
              'komlan','kodjo','isaac','ismaël','ismael','benjamin','daniel','david','jonathan','josué','josue',
              'timothée','timothee','moïse','moise','aaron','abel','achille','alain','alexis','alphonse','antoine',
              'arthur','auguste','basile','bertrand','boniface','brice','bruno','césaire','cesaire','charles',
              'cyrille','damien','daouda','désiré','desire','didier','dieudonné','dieudonne','donald','donatien',
              'édouard','edouard','élie','elie','ernest','eugène','eugene','fabien','fabrice','fidèle','fidele',
              'firmin','gabriel','gaël','gael','georges','gérard','gerard','gervais','gilbert','gilles','guillaume',
              'hector','hervé','herve','hilaire','hubert','ignace','justin','laurent','lucien','ludovic','magloire',
              'narcisse','norbert','octave','patrice','patrick','paul','prosper','raoul','raymond','rené','rene',
              'rigobert','romuald','salomon','séraphin','seraphin','siméon','simeon','stanislas','steve','steeve',
              'sosthène','sosthene','théodore','theodore','théophile','theophile','toussaint','ulrich','victor',
              'vincent','walid','bilal','steeve','josué','delphin','vital','espoir','jean'))
          )
    """)
    remaining = cur.fetchone()[0]
    print(f"\nVÉRIFICATION : contradictions restantes après apply = {remaining} (attendu 0)")

    # Statistiques finales par tenant
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
print("\n" + ("✅ OPÉRATION APPLIQUÉE" if APPLY else "Dry-run terminé — relancer avec --apply pour écrire"))
