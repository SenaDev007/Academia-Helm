/**
 * ============================================================================
 * CANTEEN STUDENTS — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint : GET /modules-complementaires/canteen/enrollments?academicYearId=...
 *
 * Réutilise l'endpoint enrollments mais présente une vue "élèves inscrits".
 *
 * Refonte juillet 2026 (Task 7-d) :
 *  - <input>/<label>/<button> HTML → <Input>/<Label>/<Button> shadcn
 *  - <table> HTML → <Table> shadcn
 *  - rounded-3xl → rounded-xl, font-black uppercase tracking-widest → font-semibold
 * ============================================================================
 */

'use client';

import React from 'react';
import {
  Search, Filter, Download,
  ChevronLeft, ChevronRight, MoreHorizontal,
  Mail, Phone, AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface EnrollmentItem {
  id: string;
  student?: string;
  studentName?: string;
  name?: string;
  studentId?: string;
  matricule?: string;
  class?: string;
  className?: string;
  level?: string;
  schoolLevel?: string;
  plan?: string;
  subscriptionPlan?: string;
  diet?: string;
  dietType?: string;
  regime?: string;
  health?: string;
  medicalNote?: string;
  attendance?: string;
  attendanceRate?: number;
  presenceRate?: number;
  [key: string]: any;
}

export default function CanteenStudents() {
  const { academicYear } = useModuleContext();
  const { data: enrollments, loading, error } = useModulesList<EnrollmentItem>(
    'canteen',
    'enrollments',
    academicYear?.id,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des élèves inscrits...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      <Card className="p-0 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-navy-900 text-lg">Effectif Cantine</h3>
            <p className="text-gray-500 text-sm mt-1">{enrollments.length} élève(s) bénéficiaire(s) du service</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Rechercher un élève..."
                className="pl-10 w-64"
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="w-4 h-4" />
            </Button>
            <Button>
              <Download className="w-4 h-4 mr-2" />
              Exporter
            </Button>
          </div>
        </div>

        {enrollments.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            Aucun élève inscrit à la cantine pour cette année scolaire.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Élève</TableHead>
                <TableHead>Classe & Niveau</TableHead>
                <TableHead>Abonnement Actif</TableHead>
                <TableHead>Régime & Santé</TableHead>
                <TableHead className="text-center">Présence (Mois)</TableHead>
                <TableHead className="text-right">Contact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.map((enr) => {
                const name = enr.student ?? enr.studentName ?? enr.name ?? '—';
                const id = enr.studentId ?? enr.matricule ?? enr.id ?? '—';
                const className = enr.class ?? enr.className ?? '—';
                const level = enr.level ?? enr.schoolLevel ?? '—';
                const plan = enr.plan ?? enr.subscriptionPlan ?? '—';
                const diet = enr.diet ?? enr.dietType ?? enr.regime ?? 'Standard';
                const health = enr.health ?? enr.medicalNote;
                const attendance = enr.attendance ?? enr.attendanceRate ?? enr.presenceRate ?? 0;
                const attendancePct = typeof attendance === 'number' ? attendance : parseInt(attendance, 10) || 0;
                return (
                  <StudentRow
                    key={enr.id}
                    name={name}
                    id={id}
                    class={className}
                    level={level}
                    plan={plan}
                    diet={diet}
                    health={health}
                    attendance={`${attendancePct}%`}
                  />
                );
              })}
            </TableBody>
          </Table>
        )}

        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">Page 1 sur 1</p>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="icon">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function StudentRow({ name, id, class: className, level, plan, diet, health, attendance }: any) {
  return (
    <TableRow className="hover:bg-slate-50">
      <TableCell>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-gray-100 flex items-center justify-center text-blue-600 font-semibold text-xs">
            {typeof name === 'string' ? name.split(' ').map((n: string) => n[0]).join('') : '—'}
          </div>
          <div>
            <p className="text-sm font-semibold text-navy-900">{name}</p>
            <p className="text-xs text-gray-400">{id}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <p className="text-sm font-medium text-navy-800">{className}</p>
        <p className="text-xs text-gray-500">{level}</p>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">{plan}</Badge>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-600">{diet}</p>
          {health && (
            <Badge variant="outline" className="text-red-600 bg-red-50 border-red-100">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {health}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="inline-flex flex-col items-center">
          <p className="text-sm font-semibold text-navy-900">{attendance}</p>
          <div className="w-12 bg-gray-100 h-1 rounded-full mt-1 overflow-hidden">
            <div className="bg-emerald-500 h-full" style={{ width: attendance }} />
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end space-x-1">
          <Button variant="ghost" size="icon">
            <Mail className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Phone className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
