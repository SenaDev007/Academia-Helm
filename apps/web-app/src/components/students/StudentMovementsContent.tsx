'use client';

/**
 * ============================================================================
 * MOUVEMENTS SCOLAIRES — Sorties, départs, abandons, réintégrations
 * ============================================================================
 *
 * Selon MODULE ELEVES.md — Onglet 7
 * Fonctionnalités :
 *   - Stats : sorties, transferts, abandons
 *   - Liste des élèves archivés/retirés (movements historique)
 *   - Action : Archiver/Retirer un élève (avec motif)
 *   - Action : Réintégrer un élève
 *
 * Note : Les transferts inter-écoles sont gérés dans l'onglet dédié
 * "Transferts & Mobilité" (StudentTransferContent).
 * ============================================================================
 */

import { useState, useEffect, useMemo } from 'react';
import {
  History, LogOut, UserMinus, Search, Loader2,
  ArrowRightLeft, RotateCcw, Archive, Users,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { studentsService } from '@/services/students.service';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/toast';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  matricule?: string | null;
  studentCode?: string;
  status: string;
  isActive: boolean;
  gender?: string | null;
  updatedAt?: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  WITHDRAWN: { label: 'Retiré', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: LogOut },
  ARCHIVED: { label: 'Archivé', color: 'bg-slate-50 text-slate-600 border-slate-200', icon: Archive },
  TRANSFERRED: { label: 'Transféré', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: ArrowRightLeft },
  ACTIVE: { label: 'Actif', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Users },
};

export default function StudentMovementsContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [actionStudent, setActionStudent] = useState<Student | null>(null);
  const [actionType, setActionType] = useState<'archive' | 'withdraw' | 'reactivate' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (academicYear) loadData();
  }, [academicYear, schoolLevel]);

  const loadData = async () => {
    if (!academicYear) return;
    setIsLoading(true);
    try {
      const data = await studentsService.getAll({ academicYearId: academicYear.id });
      setStudents(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Failed to load students:', e);
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrer les élèves selon le statut et la recherche
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      // Filtre statut
      if (filterStatus !== 'ALL' && s.status !== filterStatus) return false;
      // Filtre recherche
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
          (s.matricule || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [students, filterStatus, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    withdrawn: students.filter(s => s.status === 'WITHDRAWN').length,
    archived: students.filter(s => s.status === 'ARCHIVED').length,
    transferred: students.filter(s => s.status === 'TRANSFERRED').length,
    active: students.filter(s => s.status === 'ACTIVE' && s.isActive).length,
  }), [students]);

  const handleAction = async () => {
    if (!actionStudent || !actionType) return;
    setIsProcessing(true);
    try {
      if (actionType === 'archive') {
        await apiFetch(`/students/${actionStudent.id}/archive`, { method: 'POST' });
        toast({ title: '✅ Élève archivé', description: `${actionStudent.firstName} ${actionStudent.lastName}`, variant: 'success' });
      } else if (actionType === 'withdraw') {
        // Withdraw = set status to WITHDRAWN (désactivation)
        await apiFetch(`/students/${actionStudent.id}/archive`, {
          method: 'POST',
          body: JSON.stringify({ reason: actionReason || 'Retrait', status: 'WITHDRAWN' }),
        });
        toast({ title: '✅ Élève retiré', description: `${actionStudent.firstName} ${actionStudent.lastName}`, variant: 'success' });
      } else if (actionType === 'reactivate') {
        // Réactiver
        await apiFetch(`/students/${actionStudent.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'ACTIVE', isActive: true }),
        });
        toast({ title: '✅ Élève réintégré', description: `${actionStudent.firstName} ${actionStudent.lastName}`, variant: 'success' });
      }
      setActionStudent(null);
      setActionType(null);
      setActionReason('');
      loadData();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || 'Action échouée', variant: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const openAction = (student: Student, type: 'archive' | 'withdraw' | 'reactivate') => {
    setActionStudent(student);
    setActionType(type);
    setActionReason('');
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Actifs', value: stats.active, icon: Users, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Retirés', value: stats.withdrawn, icon: LogOut, color: 'bg-rose-50 text-rose-600' },
          { label: 'Archivés', value: stats.archived, icon: Archive, color: 'bg-slate-50 text-slate-600' },
          { label: 'Transférés', value: stats.transferred, icon: ArrowRightLeft, color: 'bg-blue-50 text-blue-600' },
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
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un élève..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">Tous les statuts</option>
          <option value="ACTIVE">Actifs</option>
          <option value="WITHDRAWN">Retirés</option>
          <option value="ARCHIVED">Archivés</option>
          <option value="TRANSFERRED">Transférés</option>
        </select>
      </div>

      {/* Liste des élèves */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">Aucun élève trouvé</p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Élève</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Matricule</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map(student => {
                  const statusInfo = STATUS_LABELS[student.status] || STATUS_LABELS.ACTIVE;
                  const Icon = statusInfo.icon;
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors shrink-0">
                            {student.lastName[0]}{student.firstName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{student.lastName.toUpperCase()} {student.firstName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">{student.matricule || student.studentCode || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border', statusInfo.color)}>
                          <Icon className="w-3 h-3" />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {student.status === 'ACTIVE' && student.isActive && (
                            <>
                              <button
                                onClick={() => openAction(student, 'withdraw')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition"
                                title="Retirer l'élève (sortie définitive)"
                              >
                                <LogOut className="w-3.5 h-3.5" /> Retirer
                              </button>
                              <button
                                onClick={() => openAction(student, 'archive')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
                                title="Archiver (fin d'année)"
                              >
                                <Archive className="w-3.5 h-3.5" /> Archiver
                              </button>
                            </>
                          )}
                          {(student.status === 'WITHDRAWN' || student.status === 'ARCHIVED') && (
                            <button
                              onClick={() => openAction(student, 'reactivate')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition"
                              title="Réintégrer l'élève"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Réintégrer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal d'action */}
      {actionStudent && actionType && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setActionStudent(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                {actionType === 'archive' && 'Archiver l\'élève'}
                {actionType === 'withdraw' && 'Retirer l\'élève'}
                {actionType === 'reactivate' && 'Réintégrer l\'élève'}
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                {actionStudent.firstName} {actionStudent.lastName}
                {actionStudent.matricule && ` · ${actionStudent.matricule}`}
              </p>
            </div>
            <div className="px-6 py-4 space-y-3">
              {(actionType === 'archive' || actionType === 'withdraw') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {actionType === 'withdraw' ? 'Motif du retrait' : 'Motif de l\'archivage'}
                  </label>
                  <textarea
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    rows={3}
                    placeholder={actionType === 'withdraw' ? 'Ex : Déménagement, changement d\'école...' : 'Ex : Fin d\'année scolaire...'}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              )}
              {actionType === 'reactivate' && (
                <p className="text-sm text-slate-600">
                  L'élève sera réintégré avec le statut <strong>ACTIF</strong>. Il retrouvera l'accès à tous les services.
                </p>
              )}
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setActionStudent(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition"
              >
                Annuler
              </button>
              <button
                onClick={handleAction}
                disabled={isProcessing}
                className={cn(
                  'px-4 py-2 text-sm font-bold text-white rounded-lg transition disabled:opacity-50',
                  actionType === 'reactivate' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                )}
              >
                {isProcessing ? 'Traitement...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
