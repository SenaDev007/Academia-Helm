#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tâche 169 — Diagnostic : le fantôme CSPMON-P-26-00021 survit-t-il dans les
miroirs pédagogiques (teachers) alors que la fiche staff a été purgée ?"""
import psycopg2

DSN = open('/home/z/my-project/scripts/_working_dsn.txt').read().strip()
TENANT = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb'
MATRICULE = 'CSPMON-P-26-00021'

conn = psycopg2.connect(DSN)
cur = conn.cursor()

def rows(sql, args=()):
    cur.execute(sql, args)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]

print('── staff (fiche RH) ──')
for r in rows('select id, "employeeNumber", status, "firstName", "lastName" from staff where "tenantId"=%s and "employeeNumber"=%s', (TENANT, MATRICULE)):
    print(r)

print('── teachers (miroir pédagogie) ──')
for r in rows('select id, matricule, "firstName", "lastName", status, "schoolLevelId", position, "createdAt" from teachers where "tenantId"=%s and matricule=%s', (TENANT, MATRICULE)):
    print(r)

print('── teachers aux noms parasites (dictée collée, champs surdimensionnés) ──')
for r in rows('select id, matricule, left("firstName", 60) as fn, left("lastName", 60) as ln, status, "schoolLevelId" from teachers where "tenantId"=%s and (length("firstName") > 40 or length("lastName") > 40)', (TENANT,)):
    print(r)

print('── répartition teachers par school_level ──')
for r in rows('select l.code, count(*) from teachers t join school_levels l on l.id=t."schoolLevelId" where t."tenantId"=%s group by l.code order by 2 desc', (TENANT,)):
    print(r)

print('── teacher_class_assignments du fantôme (affectations pédagogie) ──')
for r in rows('select a.id, a."classId", c.name as class_name, a."subjectId", a."academicYearId" from teacher_class_assignments a left join classes c on c.id=a."classId" where a."teacherId" in (select id from teachers where "tenantId"=%s and matricule=%s)', (TENANT, MATRICULE)):
    print(r)

print('── teacher_academic_profiles du fantôme (profil & disponibilité) ──')
for r in rows('select id, "teacherId", "academicYearId" from teacher_academic_profiles where "teacherId" in (select id from teachers where "tenantId"=%s and matricule=%s)', (TENANT, MATRICULE)):
    print(r)

print('── multigrade_assignments du fantôme ──')
for r in rows('select * from multigrade_assignments where "teacherId" in (select id from teachers where "tenantId"=%s and matricule=%s)', (TENANT, MATRICULE)):
    print(r)

conn.close()
print('fin diagnostic')
