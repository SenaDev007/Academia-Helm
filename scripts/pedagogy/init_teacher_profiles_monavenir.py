#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tâche 170 — Initialisation des profils académiques manquants (Mon Avenir
Plus, année 2026-2027) — correctif de données conformes au bouton
« Initialiser tous les profils » du module Pédagogie (mêmes défauts :
maxWeeklyHours 18, non semainier).

Contexte (retour promoteur 23/11/2026) : les 14 enseignants du secondaire
embauchés via Excel (CSPMON-P-26-00022 → 00035) + 1 enseignante maternelle
(OGBON, CSPMON-P-26-00003) n'avaient PAS de profil académique 2026-2027.
Or les modals d'affectation par classe listent les enseignants depuis les
PROFILS académiques → ces enseignants étaient invisibles pour affecter les
classes du secondaire (« les autres enseignants ne s'affichent pas »).

Le code a également été corrigé (union profils + sans profil) ; ce script
matérialise les profils pour que la charge horaire et le reste du module
aient des données cohérentes dès maintenant.
"""
import sys
import uuid
from datetime import datetime, timezone

import psycopg2

DSN = open('/home/z/my-project/scripts/_working_dsn.txt').read().strip()
TENANT = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb'  # CSP Mon Avenir Plus (N'Dali)
DRY_RUN = '--apply' not in sys.argv


def main():
    conn = psycopg2.connect(DSN)
    conn.autocommit = False
    cur = conn.cursor()

    # Année courante du tenant (la plus récente commencée)
    cur.execute(
        'select id, name from academic_years where "tenantId" = %s '
        'order by "startDate" desc limit 1', (TENANT,))
    row = cur.fetchone()
    if not row:
        print('Aucune année académique — abandon.')
        return
    ay_id, ay_name = row
    print(f'Année académique cible : {ay_name} ({ay_id})')

    # Enseignants actifs sans profil pour cette année
    cur.execute(
        '''
        select t.id, t.matricule, t."firstName", t."lastName", l.name as niveau
        from teachers t
        left join school_levels l on l.id = t."schoolLevelId"
        where t."tenantId" = %s
          and (t.status = 'active' or t.status is null)
          and not exists (
            select 1 from pedagogy_teacher_academic_profiles tap
            where tap."teacherId" = t.id and tap."academicYearId" = %s
          )
        order by l.name, t.matricule
        ''', (TENANT, ay_id))
    missing = cur.fetchall()
    if not missing:
        print('Aucun profil manquant — rien à faire.')
        return

    print(f'{len(missing)} enseignant(s) sans profil académique {ay_name} :')
    for m in missing:
        print(f'  - {m[1]} | {m[3]} {m[2]} | niveau={m[4]}')

    if DRY_RUN:
        print('\nDRY RUN — relancer avec --apply pour créer les profils.')
        conn.rollback()
        return

    now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
    created = 0
    for t_id, matricule, first, last, niveau in missing:
        cur.execute(
            '''
            insert into pedagogy_teacher_academic_profiles
              (id, "tenantId", "academicYearId", "teacherId",
               "maxWeeklyHours", "isActive", "isSemainier",
               "createdAt", "updatedAt")
            values (%s, %s, %s, %s, 18, true, false, %s, %s)
            ''',
            (str(uuid.uuid4()), TENANT, ay_id, t_id, now, now))
        created += 1
    conn.commit()
    print(f'\n{created} profil(s) académique(s) créé(s) (18h/sem max, non semainier).')

    # Vérification
    cur.execute(
        '''
        select l.name, count(*)
        from pedagogy_teacher_academic_profiles tap
        join teachers t on t.id = tap."teacherId"
        left join school_levels l on l.id = t."schoolLevelId"
        where tap."tenantId" = %s and tap."academicYearId" = %s
        group by l.name
        ''', (TENANT, ay_id))
    print('Répartition des profils par niveau :')
    for r in cur.fetchall():
        print(f'  {r[0]} : {r[1]}')
    conn.close()


if __name__ == '__main__':
    main()
