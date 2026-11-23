#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tâche 169 — Purge du fantôme pédagogique CSPMON-P-26-00021.

Miroir EXACT du correctif service (purgePedagogyTeacherMirror de
staff-prisma.service.ts / contract-pdf.service.ts) : la fiche staff RH a déjà
été purgée (165) mais le miroir Teacher créé par le pont RH→Pédagogie au
moment du brouillon du wizard survivait — le promoteur le retrouve dans
Pédagogie > Enseignants / Affectations. FK Restrict purgées avant le Teacher.

Usage : python3 purge_ghost_teacher_169.py [--apply]
"""
import json
import sys
from datetime import datetime

import psycopg2

DSN = open('/home/z/my-project/scripts/_working_dsn.txt').read().strip()
TENANT = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb'
MATRICULE = 'CSPMON-P-26-00021'
TEACHER_ID = 'ff8d0342-7613-4d37-ba2f-dacc0b1b46f4'

DRY = '--apply' not in sys.argv

conn = psycopg2.connect(DSN)
conn.autocommit = False
cur = conn.cursor()


def rows(sql, args=()):
    cur.execute(sql, args)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


# ─── État AVANT (backup) ────────────────────────────────────────────────────
teacher = rows('select * from teachers where id=%s and "tenantId"=%s', (TEACHER_ID, TENANT))
assert len(teacher) == 1, f"Teacher fantôme introuvable ({len(teacher)} ligne(s)) — relancer le diagnostic"
teacher = teacher[0]

multigrade = rows('select * from multigrade_assignments where "teacherId"=%s', (TEACHER_ID,))
materials = rows('select * from teacher_material_assignments where "teacherId"=%s', (TEACHER_ID,))
supplies = rows('select * from annual_teacher_supplies where "teacherId"=%s', (TEACHER_ID,))
profiles = rows('select * from pedagogy_teacher_academic_profiles where "teacherId"=%s', (TEACHER_ID,))
class_assign = rows('select * from teacher_class_assignments where "teacherId"=%s', (TEACHER_ID,))

backup = {
    'date': datetime.now().isoformat(),
    'tenant': TENANT,
    'teacher': teacher,
    'multigrade_assignments': multigrade,
    'teacher_material_assignments': materials,
    'annual_teacher_supplies': supplies,
    'pedagogy_teacher_academic_profiles': profiles,
    'teacher_class_assignments': class_assign,
}
with open('/home/z/my-project/download/backup_purge_ghost_teacher_169.json', 'w', encoding='utf-8') as f:
    json.dump(backup, f, ensure_ascii=False, indent=2, default=str)
print(f"backup: teacher + {len(multigrade)} multigrade + {len(materials)} matériel + "
      f"{len(supplies)} fournitures + {len(profiles)} profil(s) + {len(class_assign)} affectation(s) classe")

# Garde : le fantôme doit correspondre au matricule visé
assert teacher['matricule'] == MATRICULE, f"matricule inattendu: {teacher['matricule']}"

print(f"fantôme: {TEACHER_ID} — matricule {MATRICULE} — status {teacher['status']} — "
      f"noms parasite ({len(teacher['firstName'])} car.)")

if DRY:
    conn.rollback()
    print('DRY-RUN — relancer avec --apply pour purger réellement')
    sys.exit(0)

# ─── Purge (miroir du service) ──────────────────────────────────────────────
# FK Restrict d'abord
cur.execute('delete from multigrade_assignments where "teacherId"=%s', (TEACHER_ID,))
n_mg = cur.rowcount
cur.execute('delete from teacher_material_assignments where "teacherId"=%s', (TEACHER_ID,))
n_ma = cur.rowcount
cur.execute('delete from annual_teacher_supplies where "teacherId"=%s', (TEACHER_ID,))
n_as = cur.rowcount
# Le Teacher (les profils académiques / affectations de classe cascadent)
cur.execute('delete from teachers where id=%s', (TEACHER_ID,))
n_t = cur.rowcount
conn.commit()
print(f"purge appliquée : teacher={n_t}, multigrade={n_mg}, matériel={n_ma}, fournitures={n_as}")

# ─── Vérification ───────────────────────────────────────────────────────────
left = rows('select id, matricule from teachers where "tenantId"=%s and matricule=%s', (TENANT, MATRICULE))
staff_left = rows('select id from staff where "tenantId"=%s and "employeeNumber"=%s', (TENANT, MATRICULE))
assert not left, f"il reste {len(left)} miroir(s) teachers !"
assert not staff_left, "une fiche staff existe ?!"
print(f"vérification : 0 teacher / 0 staff pour {MATRICULE} ✓")

# Cohérence : le matricule ne doit plus apparaître nulle part en pédagogie
cur.execute("select count(*) from teacher_class_assignments a join teachers t on t.id=a.\"teacherId\" where t.\"tenantId\"=%s", (TENANT,))
print(f"teacher_class_assignments restantes (tenant) : {cur.fetchone()[0]}")
conn.close()
print('fin — fantôme CSPMON-P-26-00021 purgé du module Pédagogie')
