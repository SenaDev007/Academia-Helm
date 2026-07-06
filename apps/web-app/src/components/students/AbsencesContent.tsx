'use client';

/**
 * ============================================================================
 * ABSENCES — Gestion des absences élèves
 * ============================================================================
 *
 * Fonctionnalités :
 *   - Vue par classe : sélectionner une classe → liste des élèves → marquer absents
 *   - Vue par élève : historique des absences avec justification
 *   - Saisie en lot : marquer plusieurs élèves absents pour une date
 *   - Justification d'absence (avec motif + validateur)
 *   - Statistiques (taux d'absentéisme par classe)
 *
 * Backend : /api/absences (CRUD complet)
 *   GET    /api/absences?classId=...&startDate=...&endDate=...
 *   POST   /api/absences  { studentId, classId?, date, isJustified?, justification? }
 *   PATCH  /api/absences/:id  { isJustified, justification? }
 *   DELETE /api/absences/:id
 * ============================================================================
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar, Search, Loader2, CheckCircle2, XCircle, Plus, Trash2,
  Users, AlertCircle, Clock, Filter, TrendingDown,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Absence {
  id: string;
  studentId: string;
  classId?: string;
  date: string;
  isJustified: boolean;
  justification?: string;
  justifiedBy?: string;
  student?: { id: string; firstName: string; lastName: string; matricule?: string };
}

interface SchoolClass {
  id: string;
  name: string;
  code?: string;
  schoolLevelId?: string;
}

export default function AbsencesContent() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();

  // Data
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');

  // Saisie en lot
  const [bulkAbsentIds, setBulkAbsentIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  // Modal justification
  const [justifyModal, setJustifyModal] = useState<Absence | null>(null);
  const [justifyReason, setJustifyReason] = useState('');

  // ─── Load classes ───
  useEffect(() => {
    fetch('/api/all-classes', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setClasses(Array.isArray(d) ? d : (d?.data ?? [])))
      .catch(() => setClasses([]));
  }, []);

  // ─── Load students for selected class ───
  const loadStudents = useCallback(async () => {
    if (!selectedClassId || !academicYear?.id) {
      setStudents([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/students?classId=${encodeURIComponent(selectedClassId)}&academicYearId=${encodeURIComponent(academicYear.id)}&limit=200`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data?.data ?? []);
        setStudents(list);
      } else {
        setStudents([]);
      }
    } catch {
      setStudents([]);
    }
  }, [selectedClassId, academicYear?.id]);

  // ─── Load absences ───
  const loadAbsences = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedClassId) params.set('classId', selectedClassId);
      if (selectedDate) {
        params.set('startDate', selectedDate);
        params.set('endDate', selectedDate);
      }
      const res = await fetch(`/api/absences?${params.toString()}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAbsences(Array.isArray(data) ? data : []);
      } else {
        setAbsences([]);
      }
    } catch {
      setAbsences([]);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, selectedClassId, selectedDate]);

  useEffect(() => {
    loadAbsences();
  }, [loadAbsences]);

  useEffect(() => {
    loadStudents();
    setBulkAbsentIds(new Set());
  }, [loadStudents]);

  // ─── Stats ───
  const stats = useMemo(() => {
    const total = absences.length;
    const justified = absences.filter((a) => a.isJustified).length;
    const unjustified = total - justified;
    const rate = students.length > 0 ? (total / students.length) * 100 : 0;
    return { total, justified, unjustified, rate };
  }, [absences, students.length]);

  // ─── Filtered absences (search) ───
  const filteredAbsences = useMemo(() => {
    if (!searchQuery.trim()) return absences;
    const q = searchQuery.toLowerCase();
    return absences.filter((a) => {
      const name = a.student ? `${a.student.lastName} ${a.student.firstName}` : '';
      return name.toLowerCase().includes(q) || (a.student?.matricule || '').toLowerCase().includes(q);
    });
  }, [absences, searchQuery]);

  // ─── Toggle bulk select ───
  const toggleBulkSelect = (studentId: string) => {
    setBulkAbsentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  // ─── Save bulk absences ───
  const handleSaveBulk = async () => {
    if (bulkAbsentIds.size === 0 || !selectedDate) return;
    setBulkSaving(true);
    try {
      let success = 0;
      let failed = 0;
      for (const studentId of Array.from(bulkAbsentIds)) {
        try {
          await fetch('/api/absences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              studentId,
              classId: selectedClassId || undefined,
              date: selectedDate,
              isJustified: false,
            }),
          });
          success++;
        } catch {
          failed++;
        }
      }
      toast({
        title: success > 0 ? '✅ Absences enregistrées' : 'Erreur',
        description: `${success} absence(s) enregistrée(s)${failed > 0 ? `, ${failed} échouée(s)` : ''} pour le ${new Date(selectedDate).toLocaleDateString('fr-FR')}.`,
        variant: success > 0 ? 'default' : 'destructive',
      });
      setBulkAbsentIds(new Set());
      loadAbsences();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setBulkSaving(false);
    }
  };

  // ─── Justify absence ───
  const handleJustify = async () => {
    if (!justifyModal || !justifyReason.trim()) return;
    try {
      const res = await fetch(`/api/absences/${justifyModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          isJustified: true,
          justification: justifyReason.trim(),
        }),
      });
      if (res.ok) {
        toast({ title: '✅ Absence justifiée', description: 'La justification a été enregistrée.' });
        setJustifyModal(null);
        setJustifyReason('');
        loadAbsences();
      } else {
        throw new Error('Échec de la justification');
      }
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  // ─── Delete absence ───
  const handleDelete = async (absenceId: string) => {
    if (!window.confirm('Supprimer cette absence ?')) return;
    try {
      await fetch(`/api/absences/${absenceId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      toast({ title: '✅ Absence supprimée' });
      loadAbsences();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Absents aujourd\'hui', value: stats.total, icon: Users, color: 'bg-rose-50 text-rose-600' },
          { label: 'Justifiées', value: stats.justified, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Non justifiées', value: stats.unjustified, icon: XCircle, color: 'bg-amber-50 text-amber-600' },
          { label: 'Taux d\'absentéisme', value: `${stats.rate.toFixed(1)}%`, icon: TrendingDown, color: 'bg-blue-50 text-blue-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2.5">
            <div className={cn('p-2 rounded-lg', stat.color)}><stat.icon className="w-4 h-4" /></div>
            <div>
              <p className="text-[10px] font-medium text-slate-500 uppercase">{stat.label}</p>
              <p className="text-base font-bold text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Classe */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Classe</Label>
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Sélectionner une classe" /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Date</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-[180px]"
            />
          </div>

          {/* Recherche */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Rechercher</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nom ou matricule..."
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {/* Saisie en lot */}
        {selectedClassId && students.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Saisie en lot — {bulkAbsentIds.size} élève(s) sélectionné(s)
              </p>
              <Button
                size="sm"
                onClick={handleSaveBulk}
                disabled={bulkAbsentIds.size === 0 || bulkSaving}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {bulkSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                Marquer {bulkAbsentIds.size} absent(s)
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {students.map((s) => {
                const isSelected = bulkAbsentIds.has(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleBulkSelect(s.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                      isSelected
                        ? 'bg-rose-50 border-rose-300 text-rose-700 ring-1 ring-rose-200'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                    )}
                  >
                    {isSelected && '✓ '}{s.lastName} {s.firstName}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tableau des absences */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
        ) : filteredAbsences.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">
              {selectedClassId
                ? `Aucune absence pour le ${new Date(selectedDate).toLocaleDateString('fr-FR')}.`
                : 'Sélectionnez une classe pour voir les absences.'}
            </p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Élève</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Justification</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAbsences.map((a) => (
                  <TableRow key={a.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium">
                      {a.student ? `${a.student.lastName} ${a.student.firstName}` : '—'}
                      {a.student?.matricule && (
                        <span className="ml-2 text-xs font-mono text-slate-400">{a.student.matricule}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {new Date(a.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.isJustified ? 'default' : 'destructive'} className={a.isJustified ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : ''}>
                        {a.isJustified ? 'Justifiée' : 'Non justifiée'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 max-w-xs truncate">
                      {a.justification || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!a.isJustified && (
                          <button
                            onClick={() => { setJustifyModal(a); setJustifyReason(''); }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition"
                            title="Justifier l'absence"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Justifier
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition"
                          title="Supprimer l'absence"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Modal justification */}
      {justifyModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setJustifyModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Justifier l'absence
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                {justifyModal.student ? `${justifyModal.student.lastName} ${justifyModal.student.firstName}` : 'Élève'}
                {' · '}
                {new Date(justifyModal.date).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">
                  Motif de justification
                </Label>
                <textarea
                  value={justifyReason}
                  onChange={(e) => setJustifyReason(e.target.value)}
                  rows={3}
                  placeholder="Ex : Certificat médical, voyage familial, convocation administrative..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setJustifyModal(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition"
              >
                Annuler
              </button>
              <button
                onClick={handleJustify}
                disabled={!justifyReason.trim()}
                className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-50"
              >
                Justifier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
