#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tâche 164 — Embauche en masse (directement en base) du personnel enseignant
du SECONDAIRE du tenant CSP Mon Avenir Plus N'Dali.

Source : « Agent_MON AVENIR PLUS N'DALI.xls » (14 enseignants ; DOUGLA KOSSI
Narcisse Boris ignoré — déjà en base : CSPMON-P-26-00002).

Workflow répliqué = OnboardingWizard RH (7 étapes) :
  É1 Identité         → INSERT staff (statut initial PENDING_HIRE, puis ACTIVE en fin)
  É2 Classification   → position « Professeur », département « Département Secondaire »,
                         roleType TEACHER, hireDate = date de 1re prise de service
  É3 Pièces           → PASSÉE (instruction utilisateur : sauter les documents)
  É4 Contrat          → CDI, SALARIE_DECLARE (CNSS), baseSalary = SMIG 52 000,
                         startDate = hireDate
  É5 Aperçu/articles  → sans objet (import hors plateforme)
  É6 Signatures       → « contrat déjà signé manuellement » : signedAt/signedBy +
                         terms.{employerSignedAt, signatureMethod:'MANUAL_OFFLINE'}
  É7 Finalisation     → staff ACTIVE, HrApplication EMBAUCHÉ, Teacher pédagogie

Conventions reprises de la production (fiches existantes du tenant) :
  matricules AH-STF-26-XXXXXX / CSPMON-P-26-XXXXX, gender MALE/FEMALE,
  documentPaieType FICHE_DE_PAIE, téléphone normalisé « 01 + 8 chiffres »,
  employerSignerName « Julien OGBON » (signataire des contrats du tenant).

Mode : python3 script.py [dry|apply]  (défaut : dry — transaction ROLLBACKée)
"""
import sys
import json
import uuid
import datetime as dt
import psycopg2

DSN = open('/home/z/my-project/scripts/_working_dsn.txt').read().strip()
TID = "e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb"          # CSP Mon Avenir Plus N'Dali
YEAR = "0117c957-2a19-48a7-9308-1bfbc817710b"          # 2026-2027 (active)
LEVEL_SEC = "95fae326-6da3-4a4a-a95c-6f5164dd5024"     # Secondaire
INTERNAL_JOB = "60929f6a-f8a7-4783-9f46-d45a0c4b3ed8"  # hr_jobs ref INTERNAL
SCHOOL_CODE = "CSPMON"
EMPLOYER_SIGNER = "Julien OGBON"
SMIG = 52000.00
TODAY = dt.date(2026, 11, 23)
IMPORT_NOTE = ("Import RH 23/11/2026 : embauche en masse du secondaire "
               "(fichier Agent_MON AVENIR PLUS N'DALI.xls) — contrat CDI "
               "signé manuellement (hors plateforme).")

# ── Les 14 enseignants (DOUGLA KOSSI Narcisse Boris exclus — déjà en base) ──
# (nom, prénoms, sexe, naissance, lieu, tel, email, prise de service,
#  npi, ifu, matricule antérieur FE/ACDPE/AME, id ANPE)
PEOPLE = [
    ("CHABI GUIA", "Saleck", "M", "24/12/1995", "N'Dali", "69013318",
     "Saleckchabiguia12@gmail.com", "16/10/2020", "1982325739", "0202242839076", None, None),
    ("ABOU", "Olatoundjio Abdou Ramane", "M", "11/08/1989", "Savè", "94800475",
     "abouRamane03@gmail.com", "décembre 2016", None, "0202113694666", None, None),
    ("SABI DOHOU", "Sikanédé", "M", "15/12/1993", "Kérou", "95418591",
     "sabidohosikanédé@gmail.com", "30/09/2019", "3754193319", "0201911094399",
     "20210005936", "E0001536"),
    ("BA-AGBA", "Nadjimou", "M", "09/09/1977", "Parakou", "97163642",
     "nadjimagba@gmail.com", "2013", "7991951405", "0202012015544", None, None),
    ("ASSOUMA TOURE", "Mikaila", "M", "10/09/1988", "Parakou", "95675433",
     "mikaïlaassoumatouré@gmail.com", "16/10/2014", None, "0202378186995", None, None),
    ("YAROU", "Monra Zoulkanéri", "M", "10/11/1992", "Ouenou", "94484670",
     "sekezoulkanel@gmail.com", "2020", "1967727780", "0202337908273", None, None),
    ("MAMA", "Abasse", "M", "20/07/1995", "Ouenou", "64176226",
     "mamaabasse4@gmail.com", "20/11/2020", None, "0202280483381",
     "20210021347", "E0024277"),
    ("DAOUDOU", "Adégbola Kayodé Méschac", "M", "25/12/1989", "Parakou", "95673191",
     "kayorach@gmail.com", "2013", "8406531852", "0201910958686",
     "20210004553", "E0005352"),
    ("NARI", "Bio Sika", "M", "28/02/1995", "Cotonou", "55520283",
     "biosikaalbertnari@gmail.com", "16/09/2024", "4877777791", "0202463124992", None, None),
    ("ADJOUDEME", "François", "M", "15/02/1980", "Banikoara", "97806043",
     "françois4@gmail.com", "16/10/2010", "6634036456", "0202214321491", None, None),
    ("ISSAKA", "Akim", "M", "01/01/1993", "Parakou", "95272622",
     "issakaakim21@gmail.com", "septembre 2020", None, "0202233671587", None, None),
    ("KOUMAI", "Bouraima", "M", "01/01/1984", "Ouaké", "95646683",
     "koumaibouraima47@gmail.com", "Octobre 2015", "7137809427", "0201910960771",
     "20210000020", "E0004651"),
    ("OVOUDOUGNON", "Atêkou Séraphin", "M", "03/05/1978", "DASSA-ZOUME", "66417229",
     "seraphibatekou23@gmail.com", "Octobre 2018", "3027243881", None, "3188", None),
    ("AWO", "Flora", "F", "23/12/2001", "Kouandé", "196457835",
     "floraawo38@gmail.com", "septembre 2023", "6584887376", "0202276624741", None, None),
]

MOIS = {"janvier": 1, "février": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6,
        "juillet": 7, "août": 8, "septembre": 9, "octobre": 10, "novembre": 11, "décembre": 12}


def parse_birth(s):
    d, m, y = s.split("/")
    return dt.date(int(y), int(m), int(d))


def parse_prise(s):
    """« 16/10/2020 » | « décembre 2016 » | « 2013 » | « septembre2020 » → date."""
    s = (s or "").strip()
    if not s:
        return None
    if "/" in s:
        d, m, y = s.split("/")
        return dt.date(int(y), int(m), int(d))
    digits = "".join(ch for ch in s if ch.isdigit())
    letters = "".join(ch for ch in s if ch.isalpha()).lower()
    if letters and letters in MOIS and len(digits) == 4:
        return dt.date(int(digits), MOIS[letters], 1)
    if letters and letters.startswith("septembre") and len(digits) == 8:
        # « septembre2020 » → lettres septembre + 2020 (digits vaut 8 ? non : 2020=4)
        pass
    if letters and len(digits) == 4:  # mois collé : «septembre2020» → letters=septembre
        for mname, mnum in MOIS.items():
            if letters.startswith(mname):
                return dt.date(int(digits), mnum, 1)
    if digits and len(digits) == 4 and not letters:
        return dt.date(int(digits), 1, 1)
    return None


def norm_phone(p):
    """8 chiffres → 01+8 ; 9 chiffres commençant par 1 → 0+9 (convention base)."""
    p = (p or "").strip()
    if p.isdigit() and len(p) == 8:
        return "01" + p
    if p.isdigit() and len(p) == 9 and p.startswith("1"):
        return "0" + p
    return p


def iso(d):
    return d.strftime("%Y-%m-%dT00:00:00.000Z")


MODE = sys.argv[1] if len(sys.argv) > 1 else "dry"
APPLY = MODE == "apply"
print(f"MODE : {'APPLICATION RÉELLE' if APPLY else 'DRY-RUN (ROLLBACK)'}")
print(f"Personnel à embaucher : {len(PEOPLE)} (DOUGLA KOSSI Narcisse Boris ignoré)")

conn = psycopg2.connect(DSN)
conn.autocommit = False
cur = conn.cursor()
now = dt.datetime.now()

try:
    # ── 0. Garde-fous ─────────────────────────────────────────────────────
    cur.execute('SELECT "current" FROM staff_number_sequences WHERE "tenantId"=%s', (TID,))
    seq = cur.fetchone()
    assert seq and seq[0] == 21, f"staff_number_sequences.current != 21 : {seq}"
    cur.execute("SELECT COALESCE(MAX(NULLIF(regexp_replace(\"globalMatricule\", '^AH-STF-26-', ''), '')::int), 0) "
                "FROM staff WHERE \"globalMatricule\" ~ '^AH-STF-26-[0-9]+$'")
    gmax = cur.fetchone()[0]
    assert gmax == 37, f"max globalMatricule AH-STF-26- != 37 : {gmax}"
    emails = [p[6].lower() for p in PEOPLE]
    cur.execute('SELECT lower(email) FROM staff WHERE "tenantId"=%s', (TID,))
    existing = {r[0] for r in cur.fetchall()}
    dup = existing.intersection(emails)
    assert not dup, f"Collisions email staff : {dup}"
    cur.execute('SELECT lower(email) FROM users')
    dup_u = {r[0] for r in cur.fetchall()}.intersection(emails)
    assert not dup_u, f"Collisions email users : {dup_u}"

    # ── 1. Poste « Professeur » (sélecteur) + Département Secondaire ──────
    cur.execute('SELECT id FROM positions WHERE "tenantId"=%s AND name=%s', (TID, 'Professeur'))
    row = cur.fetchone()
    if row:
        pos_professeur_id = row[0]
        print("Poste « Professeur » déjà présent :", pos_professeur_id)
    else:
        pos_professeur_id = str(uuid.uuid4())
        cur.execute('INSERT INTO positions (id, "tenantId", name, description, category, "createdAt", "updatedAt") '
                    'VALUES (%s,%s,%s,%s,%s,%s,%s)',
                    (pos_professeur_id, TID, 'Professeur', None, 'TEACHER', now, now))
        print("Poste « Professeur » créé :", pos_professeur_id)

    cur.execute('SELECT id FROM departments WHERE "tenantId"=%s AND name=%s', (TID, 'Département Secondaire'))
    row = cur.fetchone()
    if row:
        dep_sec_id = row[0]
        print("Département « Département Secondaire » déjà présent :", dep_sec_id)
    else:
        dep_sec_id = str(uuid.uuid4())
        cur.execute('INSERT INTO departments (id, "tenantId", name, description, "createdAt", "updatedAt") '
                    'VALUES (%s,%s,%s,%s,%s,%s)',
                    (dep_sec_id, TID, 'Département Secondaire', 'Département du secondaire — enseignants du secondaire', now, now))
        print("Département « Département Secondaire » créé :", dep_sec_id)

    # ── 2. Embauche des 14 enseignants ────────────────────────────────────
    results = []
    for i, (nom, prenoms, sexe, birth, lieu, tel, email, prise, npi, ifu, mat_old, anpe) in enumerate(PEOPLE):
        # Matricules (miroir StaffMatriculeService)
        tenant_seq = 22 + i
        global_seq = 38 + i
        tenant_mat = f"{SCHOOL_CODE}-P-26-{tenant_seq:05d}"
        global_mat = f"AH-STF-26-{global_seq:06d}"

        birth_d = parse_birth(birth)
        hire_d = parse_prise(prise)
        phone = norm_phone(tel)
        gender = "MALE" if sexe == "M" else "FEMALE"
        full_name = f"{prenoms} {nom}"

        # notes : lieu de naissance + matricules antérieurs + traçabilité import
        ne = "Né à" if sexe == "M" else "Née à"
        parts = [f"{ne} {lieu}."]
        if mat_old:
            parts.append(f"Matricule antérieur (FE/ACDPE/AME) : {mat_old}.")
        if anpe:
            parts.append(f"Id ANPE (AME) : {anpe}.")
        parts.append(IMPORT_NOTE)
        notes = " ".join(parts)

        staff_id = str(uuid.uuid4())
        contract_id = str(uuid.uuid4())
        teacher_id = str(uuid.uuid4())
        cand_id = str(uuid.uuid4())
        app_id = str(uuid.uuid4())

        # ── É1+É2+É4 : fiche staff complète, statut final ACTIVE ──
        cur.execute("""
            INSERT INTO staff (id, "tenantId", "academicYearId", "schoolLevelId",
                "employeeNumber", "globalMatricule", "tenantMatricule",
                "firstName", "lastName", gender, "birthDate", phone, email,
                position, department, "roleType", "hireDate", "contractType",
                status, salary, nationality, "nationalId", "ifuNumber",
                "statutContractuel", "documentPaieType", "statutContractuelLockedAt",
                notes, "createdAt", "updatedAt")
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (staff_id, TID, YEAR, LEVEL_SEC,
              tenant_mat, global_mat, tenant_mat,
              prenoms, nom, gender, birth_d, phone, email,
              'Professeur', 'Département Secondaire', 'TEACHER', hire_d, 'CDI',
              'ACTIVE', None, 'Béninoise', npi, ifu,
              'SALARIE_DECLARE', 'FICHE_DE_PAIE', now,
              notes, now, now))

        # ── É4+É6 : contrat CDI signé manuellement (hors plateforme) ──
        terms = {
            "employerSignedAt": iso(hire_d),
            "employerSignerName": EMPLOYER_SIGNER,
            "employerSignatureMethod": "MANUAL_OFFLINE",
            "signedAt": iso(hire_d),
            "signerName": full_name,
            "signerRole": "EMPLOYE",
            "signatureMethod": "MANUAL_OFFLINE",
            "manualSigningNote": "Contrat déjà signé manuellement (papier) avant l'import dans Academia Helm. "
                                  + IMPORT_NOTE,
        }
        cur.execute("""
            INSERT INTO employment_contracts (id, "tenantId", "academicYearId", "staffId",
                "contractType", "statutContractuel", "documentPaieType",
                "startDate", "endDate", "baseSalary", "paymentMode", status, terms,
                "signedAt", "signedBy", "periodeEssaiMois", "cddRenouvellements",
                "createdAt", "updatedAt")
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (contract_id, TID, YEAR, staff_id,
              'CDI', 'SALARIE_DECLARE', 'FICHE_DE_PAIE',
              hire_d, None, SMIG, 'BANK', 'ACTIVE', json.dumps(terms),
              dt.datetime.combine(hire_d, dt.time()), full_name, 0, 0,
              now, now))

        # ── Pont HR → Pédagogie : Teacher du secondaire ──
        cur.execute("""
            INSERT INTO teachers (id, "tenantId", "schoolLevelId", matricule,
                "firstName", "lastName", gender, "dateOfBirth", phone, email,
                position, "academicYearId", "hireDate", "contractType", status,
                "createdAt", "updatedAt")
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (teacher_id, TID, LEVEL_SEC, tenant_mat,
              prenoms, nom, gender,
              dt.datetime.combine(birth_d, dt.time()) if birth_d else None,
              phone, email,
              'Professeur', YEAR,
              dt.datetime.combine(hire_d, dt.time()) if hire_d else None,
              'CDI', 'active', now, now))

        # ── É1 (candidat interne) + É7 (application EMBAUCHÉ) ──
        cur.execute("""
            INSERT INTO hr_candidates (id, "tenantId", "firstName", "lastName",
                email, phone, gender, "dateOfBirth", "createdAt", "updatedAt")
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (cand_id, TID, prenoms, nom, email, phone, gender,
              dt.datetime.combine(birth_d, dt.time()) if birth_d else None, now, now))
        cur.execute("""
            INSERT INTO hr_applications (id, "tenantId", "jobId", "candidateId",
                status, score, "scoreCV", "scoreLetter", "scoreMatching",
                risks, "matchDetail", "staffId", "createdAt", "updatedAt")
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (app_id, TID, INTERNAL_JOB, cand_id,
              'EMBAUCHÉ', 0, 0, 0, 0, 'Aucun',
              "Recrutement interne — éligible par défaut (processus d'embauche directe).",
              staff_id, now, now))

        results.append((tenant_mat, global_mat, full_name, phone, hire_d.isoformat()))

    # ── 3. Avance la séquence matricule tenant (21 → 35) ───────────────────
    cur.execute('UPDATE staff_number_sequences SET current=%s, "updatedAt"=%s WHERE "tenantId"=%s',
                (21 + len(PEOPLE), now, TID))
    assert cur.rowcount == 1, "staff_number_sequences non mis à jour"

    # ── 4. Vérification dans la transaction ────────────────────────────────
    cur.execute('SELECT COUNT(*) FROM staff WHERE "tenantId"=%s AND status=%s AND "roleType"=%s '
                'AND "schoolLevelId"=%s', (TID, 'ACTIVE', 'TEACHER', LEVEL_SEC))
    n_sec = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM employment_contracts WHERE "tenantId"=%s AND status=%s',
                (TID, 'ACTIVE'))
    n_con = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM teachers WHERE "tenantId"=%s AND "schoolLevelId"=%s',
                (TID, LEVEL_SEC))
    n_tch = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM hr_applications WHERE \"tenantId\"=%s AND status='EMBAUCHÉ'", (TID,))
    n_app = cur.fetchone()[0]

    print("\n── Récapitulatif ──")
    for r in results:
        print(f"  {r[0]} | {r[2]:38} | tel {r[3]:11} | prise de service {r[4]}  ({r[1]})")
    print(f"\nEnseignants ACTIFS du secondaire (après import) : {n_sec}")
    print(f"Contrats ACTIVE du tenant (après import)        : {n_con}")
    print(f"Teachers secondaire (après import)              : {n_tch}")
    print(f"HrApplications EMBAUCHÉ (après import)          : {n_app}")

    if APPLY:
        conn.commit()
        print("\n✅ TRANSACTION COMMITÉE — embauche enregistrée en base.")
    else:
        conn.rollback()
        print("\n↩️  DRY-RUN — transaction ROLLBACKée (rien n'a été écrit).")
except Exception as e:
    conn.rollback()
    print(f"\n❌ ERREUR (rollback) : {e}")
    raise
finally:
    conn.close()
