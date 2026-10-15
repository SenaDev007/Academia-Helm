/**
 * ============================================================================
 * CANTEEN ATTENDANCE — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint (lecture)     : GET  /modules-complementaires/canteen/attendance
 * Endpoint (présence)    : POST /modules-complementaires/canteen/meal-services
 *
 * Refonte juillet 2026 (Task 7-d) :
 *  - alert() → toast() via useToast()
 *  - <input>/<button> HTML → <Input>/<Button> shadcn
 *  - <table> HTML → <Table> shadcn
 *  - rounded-3xl → rounded-xl, font-black uppercase tracking-widest → font-semibold
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import {
  Search,
  Activity,
  Scan, Tablet, Calendar, Clock, Loader2,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';

interface AttendanceItem {
  id: string;
  student?: string;
  studentName?: string;
  class?: string;
  className?: string;
  time?: string;
  servedAt?: string;
  timestamp?: string;
  status?: string;
  type?: string;
  mealType?: string;
  note?: string;
  comment?: string;
  isSpecial?: boolean;
  [key: string]: any;
}

export default function CanteenAttendance() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { data: attendance, loading, error, refetch } = useModulesList<AttendanceItem>(
    'canteen',
    'attendance',
    academicYear?.id,
  );

  const handleTogglePresence = async (item: AttendanceItem) => {
    const isServed = (item.status ?? '').toLowerCase().includes('servi') || (item.status ?? '').toLowerCase().includes('served');
    const newStatus = isServed ? 'NON_SERVI' : 'SERVI';
    try {
      setActionLoading(item.id);
      await modulesApi.post(
        'canteen/meal-services',
        {
          studentId: item.student ?? item.studentName,
          status: newStatus,
          mealType: item.mealType ?? item.type ?? 'DEJEUNER',
        },
        buildModulesApiOptions(academicYear?.id),
      );
      await refetch();
      toast({
        title: isServed ? 'Élève marqué absent' : 'Présence enregistrée',
        description: `${item.student ?? item.studentName ?? 'Élève'} — ${newStatus === 'SERVI' ? 'repas servi' : 'non servi'}.`,
      });
    } catch (e: any) {
      console.error('Erreur mise à jour présence :', e?.message || e);
      toast({
        title: 'Erreur mise à jour',
        description: e?.message || 'Erreur lors de la mise à jour de la présence',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const total = (attendance ?? []).length;
  const served = (attendance ?? []).filter((a) => {
    const s = (a.status ?? '').toLowerCase();
    return s.includes('servi') || s.includes('served');
  }).length;
  const pending = (attendance ?? []).filter((a) => {
    const s = (a.status ?? '').toLowerCase();
    return s.includes('attente') || s.includes('pending') || s.includes('non');
  }).length;
  const serviceRate = total > 0 ? Math.round((served / total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des présences...</span>
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Service Area */}
        <Card className="lg:col-span-3 p-0 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-slate-900 text-white rounded-xl">
                <Scan className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-navy-900 text-lg">Pointage en Direct</h3>
                <div className="flex items-center space-x-2 mt-1">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <p className="text-red-500 text-xs font-medium">Service en cours</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Numéro de badge, QR, Nom..."
                  className="pl-10 w-64"
                />
              </div>
              <Button variant="outline" size="sm">
                <Tablet className="w-4 h-4 mr-2" />
                Mode Tablette
              </Button>
            </div>
          </div>

          {(attendance ?? []).length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              Aucun pointage enregistré pour cette année scolaire.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Élève</TableHead>
                  <TableHead>Heure</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Type de Repas</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(attendance ?? []).map((row) => (
                  <AttendanceRow
                    key={row.id}
                    attendanceId={row.id}
                    student={row.student ?? row.studentName ?? '—'}
                    class={row.class ?? row.className ?? '—'}
                    time={row.time ?? row.servedAt ?? row.timestamp ?? '—'}
                    status={row.status ?? 'Non Servi'}
                    type={row.type ?? row.mealType ?? 'Standard'}
                    isSpecial={row.isSpecial}
                    note={row.note ?? row.comment}
                    onToggle={() => handleTogglePresence(row)}
                    actionLoading={actionLoading}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Sidebar Statistics */}
        <div className="space-y-6">
          <Card className="p-6 shadow-sm">
            <h4 className="font-semibold text-navy-900 mb-4 flex items-center space-x-2">
              <Activity className="w-5 h-5 text-gray-500" />
              <span>Synthèse Direct</span>
            </h4>
            <div className="space-y-4">
              <ProgressStat label="Prévus" value={String(total)} total={total || 1} color="gray" />
              <ProgressStat label="Servis" value={String(served)} total={total || 1} color="emerald" />
              <ProgressStat label="En Attente" value={String(pending)} total={total || 1} color="amber" />
            </div>
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex justify-between items-end mb-2">
                <p className="text-xs font-medium text-gray-500">Taux de Service</p>
                <p className="text-lg font-semibold text-emerald-600">{serviceRate}%</p>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${serviceRate}%` }} />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-slate-900 text-white border-slate-800 shadow-md">
            <h4 className="font-semibold mb-3 flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-blue-300" />
              <span>Planning</span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Service de demain prévu à <span className="text-white font-semibold">12:00</span> pour{' '}
              <span className="text-white font-semibold">{total || '—'} élèves</span>.
            </p>
            <Button variant="secondary" className="w-full bg-white/10 hover:bg-white/20 text-white">
              Consulter l’historique
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AttendanceRow({ attendanceId, student, class: className, time, status, type, isSpecial, note, onToggle, actionLoading }: any) {
  const statusColors: any = {
    'Servi': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'Non Servi': 'bg-amber-50 text-amber-600 border-amber-100',
    'Refusé': 'bg-red-50 text-red-600 border-red-100',
  };
  const statusStyle = statusColors[status] ?? statusColors['Non Servi'];
  const isLoading = actionLoading === attendanceId;
  const isServed = (status ?? '').toLowerCase().includes('servi') && !(status ?? '').toLowerCase().includes('non');

  return (
    <TableRow className="hover:bg-slate-50">
      <TableCell>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-gray-100 flex items-center justify-center text-blue-600 font-semibold text-xs">
            {typeof student === 'string' ? student.split(' ').map((n: string) => n[0]).join('') : '—'}
          </div>
          <div>
            <p className="text-sm font-semibold text-navy-900">{student}</p>
            <p className="text-xs text-gray-400">{className}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-2">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <p className="text-xs font-medium text-navy-900">{time}</p>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={statusStyle}>
          {status}
        </Badge>
        {note && <p className="text-xs text-red-500 mt-1">{note}</p>}
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-2">
          <p className="text-xs font-medium text-navy-800">{type}</p>
          {isSpecial && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggle}
          disabled={isLoading}
          title={isServed ? 'Marquer absent' : 'Marquer présent'}
          className={
            isServed
              ? 'border-red-200 text-red-600 hover:bg-red-50'
              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
          }
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isServed ? 'Absent' : 'Présent'}
        </Button>
      </TableCell>
    </TableRow>
  );
}

function ProgressStat({ label, value, total, color }: any) {
  const barColors: any = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    gray: 'bg-gray-300',
  };
  const percentage = total > 0 ? (parseInt(value) / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs font-medium">
        <span className="text-gray-500">{label}</span>
        <span className="text-navy-900">{value}</span>
      </div>
      <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColors[color]}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
