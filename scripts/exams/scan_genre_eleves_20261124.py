#!/usr/bin/env python3
"""175c — Scan genres : contradictions prénom/genre + NULL, par tenant.
Objectif : identifier les élèves dont le PDF affichera « 1er » à tort
(filles avec genre M ou NULL)."""
import json
import psycopg2

DB_URL = ('postgresql://neondb_owner:npg_cYiR2zofhs0v@'
          'ep-winter-firefly-b9dujjz5-pooler.c-7.eu-central-1.aws.neon.tech/'
          'academia%20helm?sslmode=require')

# Prénoms clairement genrés (contexte béninois/français) — seuls ceux-ci
# déclenchent une « contradiction » ou un backfill. Les prénoms absents de
# ces listes sont considérés AMBIGUS (jamais modifiés automatiquement).
F_NAMES = {
    'marie', 'marie-claire', 'marie-josé', 'grâce', 'grace', 'joséphine', 'josephine',
    'anaïs', 'anais', 'eunice', 'prisca', 'agnès', 'agnes', 'bénédicte', 'benedicte',
    'cécile', 'cecile', 'charlotte', 'claire', 'clémence', 'clemence', 'constance',
    'delphine', 'dorothée', 'dorothee', 'élodie', 'elodie', 'émilie', 'emilie',
    'estelle', 'eugénie', 'eugenie', 'félicité', 'felicite', 'flora', 'flora-marie',
    'georgette', 'gilberte', 'henriette', 'hortense', 'inès', 'ines', 'irène', 'irene',
    'jeanne', 'jocelyne', 'joceline', 'josèphe', 'julienne', 'léa', 'lea', 'lisette',
    'louise', 'lucie', 'madeleine', 'marguerite', 'marthe', 'martine', 'mathilde',
    'michèle', 'michele', 'murielle', 'muriel', 'nadège', 'nadege', 'nathalie',
    'nicole', 'odile', 'pauline', 'pélagie', 'pelagie', 'raphaëlle', 'raphaelle',
    'reine', 'rosalie', 'rose', 'sabine', 'simone', 'sophie', 'sylvie', 'thérèse', 'therese',
    'valérie', 'valerie', 'véronique', 'veronique', 'virginie', 'yolande', 'bernadette',
    'adjoa', 'akouavi', 'amina', 'amoin', 'afiba', 'bintou', 'coumba', 'fatou', 'fatoumata',
    'aïcha', 'aicha', 'aïssata', 'aissata', 'diarra', 'hadiza', 'khadija', 'mariama',
    'nafissatou', 'ramatou', 'salimata', 'zeinab', 'zinab', 'adjoua', 'akossiwa',
    'ewanou', 'surnou', 'léontine', 'leontine', 'clémentine', 'clementine',
    'bernadette', 'consolata', 'scolastique', 'bénigne', 'benigne', 'colombe',
    'espérance', 'esperance', 'miséricorde', 'misericorde', 'raissa', 'rébecca', 'rebecca',
    'mireille', 'gisèle', 'gisele', 'danialè', 'roxane', 'roxanne', 'céline', 'celine',
    'aurélie', 'aurelie', 'caprice', 'chantal', 'christiane', 'christelle', 'cynthia',
    'diane', 'dina', 'edith', 'édith', 'eliane', 'éliane', 'erika', 'estera', 'eva',
    'fanny', 'francine', 'gaëlle', 'gaelle', 'huguette', 'ida', 'idaure', 'isabelle',
    'jocelyne', 'josiane', 'judith', 'kadiatou', 'kadija', 'laure', 'laurence', 'léonie',
    'leonie', 'linda', 'livia', 'lydie', 'magloire', 'marceline', 'marguerite',
    'marielle', 'mariline', 'marina', 'mélissa', 'melissa', 'mimi', 'miriam', 'myriam',
    'nadia', 'nancy', 'nella', 'noémie', 'nomie', 'olivia', 'pascaline', 'prudence',
    'rachelle', 'raïssa', 'rolande', 'rose-marie', 'sandra', 'sarah', 'séraphine',
    'seraphine', 'solange', 'susanne', 'suzanne', 'syntyche', 'tatiana', 'vanessa',
    'yvette', 'yvonne', 'zita', 'alphonsine', 'anastasie', 'angèle', 'angele',
    'annick', 'antoinette', 'aristide', 'assiba', 'athena', 'aurore', 'bérangère',
    'berangere', 'blessing', 'brigitte', 'carine', 'caroline', 'catherine', 'bintou',
    'clarisse', 'compaore', 'damienne', 'dawod', 'déborah', 'deborah', 'diane',
    'dieudonnée', 'dieudonnee', 'douce', 'elise', 'élise', 'emmanuella', 'erica',
    'estelle', 'esthér', 'esther', 'eudoxie', 'eulalie', 'évodie', 'evodie', 'fanta',
    'faustine', 'flavie', 'flore', 'fortune', 'georgia', 'germaine', 'gloria',
    'grâce-dieu', 'gracia', 'guito', 'hellène', 'hellene', 'hyacinthe', 'ida',
    'ifouly', 'périne', 'perine', 'pulchérie', 'pulcherie', 'quiwi', 'rachidatou',
    'renée', 'renee', 'rosine', 'sabine', 'scolastique', 'seraphine', 'sidonie',
    'sylvaine', 'toussaine', 'ulrich', 'vitória', 'vitoria', 'wendi', 'yanique',
}
M_NAMES = {
    'jean', 'pierre', 'emmanuel', 'samuel', 'éric', 'eric', 'étienne', 'etienne',
    'françois', 'francois', 'henri', 'honoré', 'honore', 'joseph', 'jules',
    'louis', 'luc', 'marc', 'mathurin', 'maurice', 'michel', 'olivier', 'pascal',
    'philippe', 'pierre', 'rémy', 'remy', 'richard', 'robert', 'roger', 'roland',
    'sébastien', 'sebastien', 'stéphane', 'stephane', 'sylvestre', 'thibault',
    'thierry', 'thomas', 'vincent', 'xavier', 'yves', 'zacharie', 'abdoulaye',
    'aboubakar', 'abdoul', 'abdou', 'ahmadou', 'amadou', 'moussa', 'ibrahim',
    'yacouba', 'youssouf', 'issouf', 'souleymane', 'mamadou', 'mohamed', 'mohammed',
    'ali', 'omar', 'ousseini', 'brahim', 'kofi', 'kwame', 'kwesi', 'yao', 'kossi',
    'komlan', 'kodjo', 'atchou', 'tetteh', 'sampson', 'isaac', 'ismaël', 'ismael',
    'benjamin', 'daniel', 'david', 'jonathan', 'josué', 'josue', 'nathanaël', 'nathanael',
    'timothée', 'timothee', 'josaphat', 'jésus', 'jesus', 'christ', 'moïse', 'moise',
    'aaron', 'abdias', 'abel', 'achille', 'adolphe', 'aimable', 'alain', 'alexis',
    'alphonse', 'anastase', 'anderson', 'angelo', 'anselme', 'antoine', 'aristide',
    'arnold', 'arsène', 'arsene', 'arthur', 'aubin', 'auguste', 'aurèle', 'aurele',
    'basile', 'bathélémy', 'berenger', 'bertrand', 'bonaventure', 'boniface',
    'brice', 'bruno', 'calixte', 'carlin', 'carmel', 'césaire', 'cesaire', 'charles',
    'chrysostome', 'clet', 'clodomir', 'come', 'come', 'constitutif', 'cosme',
    'cyrille', 'damien', 'daouda', 'délodougou', 'désiré', 'desire', 'didier',
    'dieudonné', 'dieudonne', 'dimitri', 'divin', 'donald', 'donatien', 'dorléans',
    'édgard', 'edgard', 'édouard', 'edouard', 'élie', 'elie', 'éloi', 'eloi',
    'émeric', 'emeric', 'épiphane', 'epiphane', 'ernest', 'espoir', 'esprit',
    'eugène', 'eugene', 'euloge', 'evrard', 'fabien', 'fabrice', 'fidele', 'fidèle',
    'firmin', 'florent', 'francisco', 'frank', 'fulbert', 'gabriel', 'gaël', 'gael',
    'genesis', 'geoffroy', 'georges', 'gerald', 'gérard', 'gerard', 'gervais',
    'ghislain', 'gilbert', 'gilles', 'giovan', 'godfroy', 'gratien', 'gregoire',
    'grégoire', 'guillaume', 'guy', 'harold', 'hector', 'hermann', 'herve', 'hervé',
    'hilaire', 'hippolyte', 'hubert', 'hyacinthe', 'ignace', 'irénée', 'irenee',
    'joslin', 'judes', 'julius', 'julio', 'juste', 'justin', 'kolawolé', 'kolawole',
    'laurent', 'lazare', 'léandre', 'leandre', 'leonel', 'léonel', 'libère', 'libere',
    'logos', 'loïc', 'loic', 'lothaire', 'lucien', 'ludovic', 'macaire', 'magloire',
    'médard', 'medard', 'michel', 'modeste', 'moïse', 'moise', 'narcisse', 'nicodème',
    'nicodeme', 'norbert', 'octave', 'ondine', 'pamphile', 'patrice', 'patrick',
    'paul', 'paul-henri', 'presley', 'privat', 'prosper', 'quintus', 'rachidi',
    'rafael', 'raoul', 'raymond', 'régent', 'regent', 'rémi', 'remi', 'renard',
    'rené', 'rene', 'reynald', 'rigobert', 'romaric', 'romuald', 'roméo', 'romeo',
    'rosaire', 'rostand', 'rudolph', 'ruslan', 'salomon', 'séraphin', 'seraphin',
    'servais', 'séverin', 'severin', 'silvère', 'silvere', 'siméon', 'simeon',
    'stanislas', 'steeve', 'steve', 'sosthène', 'sosthene', 'sydney', 'telesphore',
    'télesphore', 'théodore', 'theodore', 'théophile', 'theophile', 'toussaint',
    'trésor', 'tresor', 'ulrich', 'valère', 'valere', 'vanloc', 'vianney', 'victor',
    'victorin', 'vincent', 'vital', 'wilfried', 'wilfried', 'wilson', 'yanick',
    'yannick', 'zacharie', 'zephirin', 'zéphirin', 'boko', 'hafiz', 'khaled',
    'mahmoud', 'youssef', 'anas', 'bilal', 'hamid', 'karim', 'nabil', 'rachid',
    'tarik', 'tariq', 'walid', 'youcef', 'zakaria', 'idrissa', 'sekou', 'seydou',
    'boubacar', 'mamadou', 'alphonse', 'appolinaire', 'apollinaire', 'arnaud',
    'athanase', 'auberlin', 'augustin', 'aurélien', 'aurelien', 'baptiste',
    'bénédicte', 'bertrand', 'cannabis', 'cédric', 'cedric', 'christian',
    'christophe', 'cyril', 'damian', 'delphin', 'désir', 'dieu-merci', 'donald',
    'elhadji', 'emmerick', 'enny', 'ephrem', 'éphrem', 'evrard', 'fabrice',
}

def norm_first(name: str | None) -> str:
    if not name:
        return ''
    n = name.strip().lower()
    # premier mot composant (Marie Rose → marie ; Jean-Baptiste → jean)
    for sep in (' ', '-', "'"):
        if sep in n:
            n = n.split(sep)[0]
            break
    return n.strip('’\'') if n else n

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# Actifs, avec prénom normalisé
cur.execute("""
    SELECT s.id, s."firstName", s."lastName", s.gender, t.name
    FROM students s JOIN tenants t ON t.id = s."tenantId"
    WHERE s."isActive" = true
""")
rows = cur.fetchall()
conn.close()

contradictions = []   # genre en contradiction avec un prénom NON ambigu
nulls_unambiguous = []  # NULL mais prénom clair → backfill possible
nulls_ambiguous = []  # NULL et prénom ambigu → liste manuelle

for sid, first, last, gender, tenant in rows:
    nf = norm_first(first)
    if gender in ('M', 'F'):
        if gender == 'M' and nf in F_NAMES:
            contradictions.append((sid, first, last, 'M', tenant, 'F attendu'))
        elif gender == 'F' and nf in M_NAMES:
            contradictions.append((sid, first, last, 'F', tenant, 'M attendu'))
    elif gender is None:
        if nf in F_NAMES:
            nulls_unambiguous.append((sid, first, last, 'F', tenant))
        elif nf in M_NAMES:
            nulls_unambiguous.append((sid, first, last, 'M', tenant))
        else:
            nulls_ambiguous.append((sid, first, last, tenant))

print(f"TOTAL élèves actifs scannés : {len(rows)}")
print(f"\n1) CONTRADICTIONS prénom/genre (à corriger) : {len(contradictions)}")
for c in contradictions:
    print(f"   {c[1]} {c[2]} | genre={c[3]} | {c[4]} | → {c[5]}")

print(f"\n2) NULL + prénom clair (backfill possible) : {len(nulls_unambiguous)}")
by_tenant = {}
for n in nulls_unambiguous:
    by_tenant.setdefault(n[4], [0, 0])
    by_tenant[n[4]][0 if n[3] == 'F' else 1] += 1
for t, (f, m) in sorted(by_tenant.items(), key=lambda x: -(x[1][0] + x[1][1])):
    print(f"   {t}: {f} filles + {m} garçons = {f + m}")

print(f"\n3) NULL + prénom ambigu (à saisir manuellement) : {len(nulls_ambiguous)}")
by_tenant2 = {}
for n in nulls_ambiguous:
    by_tenant2[n[3]] = by_tenant2.get(n[3], 0) + 1
for t, c in sorted(by_tenant2.items(), key=lambda x: -x[1]):
    print(f"   {t}: {c}")

# Sauvegarde des listes pour l'opération de correction
out = {
    "contradictions": [
        {"id": c[0], "prenom": c[1], "nom": c[2], "genre_actuel": c[3], "ecole": c[4], "genre_attendu": c[5].split()[0]}
        for c in contradictions
    ],
    "nulls_backfill": [
        {"id": n[0], "prenom": n[1], "nom": n[2], "genre": n[3], "ecole": n[4]}
        for n in nulls_unambiguous
    ],
    "nulls_ambigus": [
        {"id": n[0], "prenom": n[1], "nom": n[2], "ecole": n[3]}
        for n in nulls_ambiguous
    ],
}
with open('/home/z/my-project/download/scan_genre_eleves_20261124.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print("\nListes sauvegardées : download/scan_genre_eleves_20261124.json")
