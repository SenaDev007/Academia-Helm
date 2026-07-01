'use client';

/**
 * ============================================================================
 * AUDIT & TRAÇABILITÉ — Filtres + Export CSV
 * ============================================================================
 * Selon MODULE ELEVES.md — Onglet 12
 * Enrichissements : filtres par action/date, export CSV, stats globales.
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Fingerprint, Search, Clock, History, AlertCircle, Loader2, User,
  ChevronRight, Download, Filter, Calendar,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from '@/components/ui/toast';
import { studentsService } from '@/services/students.service';
import { cn } from '@/lib/utils';

const ACTION_META: Record<string, { label: string; color: string }> = {
  PRE_REGISTER: { label: 'Pré-inscription', color: 'bg-blue-50 text-blue-700 border-blue-100' },
  ADMIT: { label: 'Admission', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  RE_ENROLL: { label: 'Réinscription', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  PROMOTE: { label: 'Promotion', color: 'bg-violet-50 text-violet-700 border-violet-100' },
  TRANSFER: { label: 'Transfert', color: 'bg-amber-50 text-amber-700 border-amber-100' },
  UPDATE_STATUS: { label: 'Changement statut', color: 'bg-slate-50 text-slate-700 border-slate-100' },
  UPDATE: { label: 'Modification', color: 'bg-slate-50 text-slate-700 border-slate-100' },
  ARCHIVE: { label: 'Archivage', color: 'bg-gray-50 text-gray-700 border-gray-100' },
  WITHDRAW: { label: 'Retrait', color: 'bg-rose-50 text-rose-700 border-rose-100' },
};

export default function StudentAuditContent() {
  const { academicYear } = useModuleContext();
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtres
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');

  const loadStudents = useCallback(async () => {
    if (!academicYear?.id) return;
    setIsLoadingStudents(true);
    try {
      const data = await studentsService.getAll({ academicYearId: academicYear.id });
      setStudents(Array.isArray(data) ? data : (data?.students ?? []));
    } catch (e: any) {
      console.error('Failed to load students:', e);
    } finally {
      setIsLoadingStudents(false);
    }
  }, [academicYear?.id]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const loadAudit = useCallback(async () => {
    if (!selectedStudentId) return;
    setIsLoadingAudit(true);
    try {
      const data = await fetch(`/api/students/${selectedStudentId}/audit`, { credentials: 'include', cache: 'no-store' });
      if (data.ok) {
        const logs = await data.json();
        setAuditLogs(Array.isArray(logs) ? logs : []);
      } else {
        setAuditLogs([]);
      }
    } catch {
      setAuditLogs([]);
    } finally {
      setIsLoadingAudit(false);
    }
  }, [selectedStudentId]);

  useEffect(() => { loadAudit(); }, [loadAudit]);

  const filteredStudents = students.filter(s =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.matricule?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Logs filtrés
  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (filterAction !== 'ALL' && log.action !== filterAction) return false;
      if (filterDateFrom && log.createdAt && new Date(log.createdAt) < new Date(filterDateFrom)) return false;
      if (filterDateTo && log.createdAt && new Date(log.createdAt) > new Date(filterDateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [auditLogs, filterAction, filterDateFrom, filterDateTo]);

  // Stats
  const actionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const log of auditLogs) {
      counts[log.action] = (counts[log.action] || 0) + 1;
    }
    return counts;
  }, [auditLogs]);

  // Export CSV
  const exportCSV = () => {
    if (filteredLogs.length === 0) {
      toast({ title: 'Aucune donnée', description: 'Rien à exporter', variant: 'error' });
      return;
    }
    const headers = ['Date', 'Action', 'Détails', 'Utilisateur'];
    const rows = filteredLogs.map(log => [
      log.createdAt ? format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr }) : '',
      ACTION_META[log.action]?.label || log.action,
      log.afterData ? (typeof log.afterData === 'string' ? log.afterData : JSON.stringify(log.afterData)).slice(0, 200) : '',
      log.userId || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_${selectedStudent?.lastName || 'eleve'}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: '✅ Export CSV généré', variant: 'success' });
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const availableActions = Object.keys(actionCounts);

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 rounded-xl"><Fingerprint className="w-5 h-5 text-amber-600" /></div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Audit & Traçabilité</h2>
            <p className="text-xs text-slate-500">Historique détaillé des actions sur les dossiers élèves</p>
          </div>
        </div>
        {selectedStudentId && filteredLogs.length > 0 && (
          <button onClick={exportCSV} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* Panneau gauche : sélection élève */}
        <div className="lg:w-72 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Rechercher un élève..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {isLoadingStudents ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-amber-500 animate-spin" /></div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm"><AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />Aucun élève</div>
            ) : (
              <div className="space-y-1">
                {filteredStudents.map(student => (
                  <button key={student.id} onClick={() => setSelectedStudentId(student.id)}
                    className={cn('w-full flex items-center gap-3 p-2.5 rounded-lg transition-all text-left',
                      selectedStudentId === student.id ? 'bg-amber-50 border border-amber-200' : 'hover:bg-slate-50 border border-transparent')}>
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                      {student.firstName?.[0]}{student.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{student.lastName} {student.firstName}</p>
                      <p className="text-[10px] text-slate-400">{student.matricule || 'Pas de matricule'}</p>
                    </div>
                    {selectedStudentId === student.id && <ChevronRight className="w-4 h-4 text-amber-500 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panneau droit : audit logs avec filtres */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {!selectedStudentId ? (
            <div className="flex flex-col items-center justify-center h-full py-16">
              <div className="p-4 bg-slate-50 rounded-full mb-4"><User className="w-10 h-10 text-slate-300" /></div>
              <p className="text-slate-500 font-medium text-center">Sélectionnez un élève<br /><span className="text-xs text-slate-400">pour voir son historique d'audit</span></p>
            </div>
          ) : (
            <>
              {/* Header + filtres */}
              <div className="p-3 border-b border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{selectedStudent?.lastName} {selectedStudent?.firstName}</h3>
                    <p className="text-xs text-slate-400">{auditLogs.length} événement(s) · {filteredLogs.length} après filtres</p>
                  </div>
                </div>
                {/* Filtres */}
                <div className="flex flex-wrap items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500">
                    <option value="ALL">Toutes les actions</option>
                    {availableActions.map(a => <option key={a} value={a}>{ACTION_META[a]?.label || a}</option>)}
                  </select>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500" />
                    <span className="text-slate-400 text-xs">→</span>
                    <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500" />
                  </div>
                  {(filterAction !== 'ALL' || filterDateFrom || filterDateTo) && (
                    <button onClick={() => { setFilterAction('ALL'); setFilterDateFrom(''); setFilterDateTo(''); }}
                      className="text-[10px] text-rose-500 hover:underline">Réinitialiser</button>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="flex-1 overflow-y-auto p-4">
                {isLoadingAudit ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-8 h-8 text-amber-500 animate-spin" /></div>
                ) : filteredLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <History className="w-10 h-10 text-slate-300 mb-3" />
                    <p className="text-slate-500 text-sm">Aucun événement</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {filteredLogs.map((log, idx) => {
                        const meta = ACTION_META[log.action] || { label: log.action, color: 'bg-slate-50 text-slate-700 border-slate-100' };
                        return (
                          <motion.div key={log.id || idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                              </div>
                              {idx < filteredLogs.length - 1 && <div className="w-px flex-1 bg-slate-100 my-1" />}
                            </div>
                            <div className="flex-1 pb-3">
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                <div className="flex items-center justify-between mb-1">
                                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase', meta.color)}>{meta.label}</span>
                                  <span className="text-[10px] text-slate-400">{log.createdAt ? format(new Date(log.createdAt), 'dd MMM yyyy à HH:mm', { locale: fr }) : '—'}</span>
                                </div>
                                {log.afterData && (
                                  <p className="text-xs text-slate-600 mt-1">
                                    {typeof log.afterData === 'string' ? log.afterData : JSON.stringify(log.afterData).slice(0, 200)}
                                  </p>
                                )}
                                {log.userId && <p className="text-[10px] text-slate-400 mt-1">Par : {log.userId.slice(0, 8)}…</p>}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
