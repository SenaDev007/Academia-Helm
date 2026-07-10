'use client';

/**
 * ============================================================================
 * AFFECTATIONS & MOUVEMENTS — Onglet unifié (fusion Affectations + Mouvements)
 * ============================================================================
 *
 * 4 sous-onglets :
 *   1. Tableau de bord — stats globales
 *   2. Affectations — changement de classe + changement de série
 *   3. Mouvements — transferts, abandons, sorties, exclusions, réintégrations
 *   4. Historique — timeline globale de tous les mouvements
 *
 * Backend endpoints :
 *   POST /students/change-class        — changement de classe
 *   POST /students/change-series       — changement de série (via change-class filtré)
 *   POST /students/withdraw            — abandon / départ
 *   POST /students/exclude             — exclusion administrative (NOUVEAU)
 *   POST /students/exit                — sortie fin d'année (NOUVEAU)
 *   POST /students/reintegrate         — réintégration
 *   POST /students/transfer            — transfert inter-écoles
 *   POST /students/:id/archive         — archivage
 *   GET  /students/movement-history    — historique global (NOUVEAU)
 * ============================================================================
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Share2, History, LogOut, Search, Loader2, ArrowRightLeft, RotateCcw,
  Archive, Users, Filter, ChevronLeft, ChevronRight, MoreHorizontal,
  ArrowRight, CheckCircle2, AlertCircle, FileText, Ban, DoorOpen,
  LayoutDashboard, BookOpen, Layers,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { studentsService } from '@/services/students.service';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

// ─── Types ───

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  matricule?: string | null;
  studentCode?: string;
  status: string;
  isActive: boolean;
  schoolLevelId?: string;
  photoUrl?: string | null;
  dateOfBirth?: string | null;
}

interface ClassInfo {
  id: string;
  name: string;
  schoolLevelId: string;
  schoolLevel?: { id: string; name: string; code?: string };
  academicTrackId?: string | null;
}

interface Enrollment {
  id: string;
  student: Student;
  class?: { id: string; name: string };
  status: string;
}

interface MovementHistoryItem {
  id: string;
  action: string;
  date: string;
  beforeData: any;
  afterData: any;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    matricule?: string;
    photoUrl?: string;
    status: string;
    levelName: string;
  } | null;
}

// ─── Helpers ───

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  WITHDRAWN: { label: 'Retiré', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: LogOut },
  ARCHIVED: { label: 'Archivé', color: 'bg-slate-50 text-slate-600 border-slate-200', icon: Archive },
  TRANSFERRED: { label: 'Transféré', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: ArrowRightLeft },
  ACTIVE: { label: 'Actif', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Users },
  EXCLUDED: { label: 'Exclu', color: 'bg-red-50 text-red-700 border-red-200', icon: Ban },
  INACTIVE: { label: 'Inactif', color: 'bg-slate-50 text-slate-600 border-slate-200', icon: Archive },
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CHANGE_CLASS: { label: 'Changement de classe', color: 'text-blue-600' },
  WITHDRAW: { label: 'Abandon / Départ', color: 'text-rose-600' },
  EXCLUDE: { label: 'Exclusion administrative', color: 'text-red-600' },
  EXIT: { label: 'Sortie fin d\'année', color: 'text-amber-600' },
  REINTEGRATE: { label: 'Réintégration', color: 'text-emerald-600' },
  TRANSFER: { label: 'Transfert', color: 'text-indigo-600' },
  ARCHIVE: { label: 'Archivage', color: 'text-slate-600' },
  PRE_REGISTER: { label: 'Pré-inscription', color: 'text-cyan-600' },
  ADMIT: { label: 'Admission', color: 'text-teal-600' },
  RE_ENROLL: { label: 'Réinscription', color: 'text-purple-600' },
  PROMOTE: { label: 'Promotion', color: 'text-green-600' },
};

const LEVEL_ORDER: Record<string, number> = { MATERNELLE: 1, MAT: 1, PRIMAIRE: 2, PRIMARY: 2, SECONDAIRE: 3, SECONDARY: 3 };
function getLevelOrder(code?: string): number { return LEVEL_ORDER[code?.toUpperCase() || ''] || 99; }

function StudentAvatar({ student, size = 'md' }: { student: Student; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-9 w-9 text-xs' : 'h-8 w-8 text-[10px]';
  if (student.photoUrl) {
    return <img src={student.photoUrl} alt={`${student.firstName} ${student.lastName}`} className={cn(cls, 'rounded-full object-cover shrink-0 border border-slate-200')} />;
  }
  return <div className={cn(cls, 'rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 shrink-0')}>{student.lastName?.[0] || '?'}{student.firstName?.[0] || ''}</div>;
}

// ─── Composant principal ───

type SubTab = 'dashboard' | 'affectations' | 'mouvements' | 'historique';

export default function StudentAffectationsMouvementsContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [subTab, setSubTab] = useState<SubTab>('dashboard');

  const subTabs: Array<{ id: SubTab; label: string; icon: any }> = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'affectations', label: 'Affectations', icon: Share2 },
    { id: 'mouvements', label: 'Mouvements', icon: History },
    { id: 'historique', label: 'Historique', icon: FileText },
  ];

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Sous-onglets */}
      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition',
              subTab === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenu du sous-onglet */}
      {subTab === 'dashboard' && <DashboardSubTab academicYear={academicYear} />}
      {subTab === 'affectations' && <AffectationsSubTab academicYear={academicYear} schoolLevel={schoolLevel} />}
      {subTab === 'mouvements' && <MouvementsSubTab academicYear={academicYear} schoolLevel={schoolLevel} />}
      {subTab === 'historique' && <HistoriqueSubTab academicYear={academicYear} />}
    </div>
  );
}

// ─── Sous-onglet 1 : Tableau de bord ───

function DashboardSubTab({ academicYear }: { academicYear: any }) {
  const [stats, setStats] = useState({ total: 0, active: 0, withdrawn: 0, archived: 0, transferred: 0, excluded: 0 });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (academicYear?.id) loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear?.id]);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const data = await studentsService.getAll({ academicYearId: academicYear.id, limit: '200' });
      const all: Student[] = Array.isArray(data) ? data : (data?.data || []);
      setStats({
        total: all.length,
        active: all.filter(s => s.status === 'ACTIVE' && s.isActive).length,
        withdrawn: all.filter(s => s.status === 'WITHDRAWN').length,
        archived: all.filter(s => s.status === 'ARCHIVED').length,
        transferred: all.filter(s => s.status === 'TRANSFERRED').length,
        excluded: all.filter(s => s.status === 'EXCLUDED').length,
      });
    } catch { } finally { setIsLoading(false); }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>;

  const cards = [
    { label: 'Total élèves', value: stats.total, icon: Users, color: 'bg-slate-50 text-slate-600' },
    { label: 'Actifs', value: stats.active, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Retirés / Abandons', value: stats.withdrawn, icon: LogOut, color: 'bg-rose-50 text-rose-600' },
    { label: 'Exclus', value: stats.excluded, icon: Ban, color: 'bg-red-50 text-red-600' },
    { label: 'Transférés', value: stats.transferred, icon: ArrowRightLeft, color: 'bg-blue-50 text-blue-600' },
    { label: 'Archivés', value: stats.archived, icon: Archive, color: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card, i) => (
        <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2.5">
          <div className={cn('p-2 rounded-lg', card.color)}><card.icon className="w-4 h-4" /></div>
          <div>
            <p className="text-[10px] font-medium text-slate-500 uppercase">{card.label}</p>
            <p className="text-base font-bold text-slate-900">{card.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Sous-onglet 2 : Affectations (changement de classe + série) ───

function AffectationsSubTab({ academicYear, schoolLevel }: { academicYear: any; schoolLevel: any }) {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [fromClassId, setFromClassId] = useState('');
  const [toClassId, setToClassId] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  // ⭐ Mode : 'class' (changement de classe) ou 'series' (changement de série/track)
  const [mode, setMode] = useState<'class' | 'series'>('class');
  const [fromTrackId, setFromTrackId] = useState('');
  const [toTrackId, setToTrackId] = useState('');
  const [tracks, setTracks] = useState<Array<{ id: string; name: string; code: string }>>([]);

  useEffect(() => {
    fetch('/api/all-classes', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then(data => setClasses(Array.isArray(data) ? data : []))
      .catch(() => setClasses([]));
    fetch('/api/academic-tracks', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then(data => setTracks(Array.isArray(data) ? data : []))
      .catch(() => setTracks([]));
  }, []);

  useEffect(() => {
    if (academicYear?.id) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear?.id]);

  const loadData = async () => {
    if (!academicYear) return;
    setIsLoading(true);
    try {
      const enrollmentsData = await studentsService.getEnrollments({ academicYearId: academicYear.id });
      setEnrollments(Array.isArray(enrollmentsData) ? enrollmentsData : []);
    } catch { } finally { setIsLoading(false); }
  };

  const sortedClasses = useMemo(() => [...classes].sort((a, b) => {
    const oa = getLevelOrder(a.schoolLevel?.code);
    const ob = getLevelOrder(b.schoolLevel?.code);
    return oa !== ob ? oa - ob : a.name.localeCompare(b.name);
  }), [classes]);

  // Classes filtrées par track (pour le mode série)
  const fromClasses = useMemo(() => {
    if (mode === 'series' && fromTrackId) return sortedClasses.filter(c => c.academicTrackId === fromTrackId);
    return sortedClasses;
  }, [sortedClasses, mode, fromTrackId]);

  const toClasses = useMemo(() => {
    if (mode === 'series' && toTrackId) return sortedClasses.filter(c => c.academicTrackId === toTrackId);
    return sortedClasses;
  }, [sortedClasses, mode, toTrackId]);

  const studentsByClass = useMemo(() => {
    const m = new Map<string, Enrollment[]>();
    enrollments.forEach(e => {
      if (e.class?.id) {
        if (!m.has(e.class.id)) m.set(e.class.id, []);
        m.get(e.class.id)!.push(e);
      }
    });
    m.forEach(list => list.sort((a, b) => a.student.lastName.localeCompare(b.student.lastName)));
    return m;
  }, [enrollments]);

  const fromClassStudents = useMemo(() => {
    if (!fromClassId) return [];
    const list = studentsByClass.get(fromClassId) || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(e => `${e.student.firstName} ${e.student.lastName}`.toLowerCase().includes(q));
  }, [fromClassId, studentsByClass, searchQuery]);

  const toClassStudents = useMemo(() => {
    if (!toClassId) return [];
    return studentsByClass.get(toClassId) || [];
  }, [toClassId, studentsByClass]);

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleTransfer = async () => {
    if (!academicYear || !fromClassId || !toClassId || selectedStudents.size === 0) return;
    if (fromClassId === toClassId) {
      toast({ title: 'Erreur', description: 'La classe de départ et d\'arrivée doivent être différentes.', variant: 'error' });
      return;
    }
    setIsTransferring(true);
    try {
      const studentIds = Array.from(selectedStudents);
      const results = await Promise.allSettled(
        studentIds.map(studentId =>
          apiFetch('/students/change-class', { method: 'POST', body: JSON.stringify({ studentId, academicYearId: academicYear.id, newClassId: toClassId }) })
        )
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      toast({
        title: failed === 0 ? '✅ Transfert réussi' : '⚠️ Transfert partiel',
        description: `${succeeded} réussi(s), ${failed} échec(s) sur ${studentIds.length} élève(s).`,
        variant: failed === 0 ? 'success' : 'success',
      });
      setSelectedStudents(new Set());
      loadData();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    } finally { setIsTransferring(false); }
  };

  const canTransfer = fromClassId && toClassId && fromClassId !== toClassId && selectedStudents.size > 0 && !isTransferring;

  return (
    <div className="space-y-4">
      {/* Sélection mode : classe ou série */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setMode('class'); setFromTrackId(''); setToTrackId(''); }}
          className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition',
            mode === 'class' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50')}
        >
          <BookOpen className="w-3.5 h-3.5" /> Changement de classe
        </button>
        <button
          onClick={() => setMode('series')}
          className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition',
            mode === 'series' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50')}
        >
          <Layers className="w-3.5 h-3.5" /> Changement de série
        </button>
      </div>

      {/* Mode série : sélecteurs de track */}
      {mode === 'series' && (
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Série de départ</label>
            <select value={fromTrackId} onChange={(e) => { setFromTrackId(e.target.value); setFromClassId(''); }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500">
              <option value="">— Sélectionner —</option>
              {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Série d'arrivée</label>
            <select value={toTrackId} onChange={(e) => { setToTrackId(e.target.value); setToClassId(''); }}
              className={cn('w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2',
                fromTrackId === toTrackId && toTrackId ? 'ring-2 ring-red-400 border-red-300' : 'focus:ring-indigo-500')}>
              <option value="">— Sélectionner —</option>
              {tracks.map(t => <option key={t.id} value={t.id} disabled={t.id === fromTrackId}>{t.name}{t.id === fromTrackId ? ' (départ)' : ''}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Sélecteurs de classes */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              {mode === 'series' ? 'Classe de départ (série sélectionnée)' : 'Classe de départ'}
            </label>
            <select value={fromClassId} onChange={(e) => { setFromClassId(e.target.value); setSelectedStudents(new Set()); }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500">
              <option value="">— Sélectionner —</option>
              {fromClasses.map(c => <option key={c.id} value={c.id}>{c.schoolLevel?.name ? `${c.schoolLevel.name} · ` : ''}{c.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col items-center">
            <button onClick={handleTransfer} disabled={!canTransfer}
              className={cn('inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition',
                canTransfer ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' : 'bg-slate-100 text-slate-400 cursor-not-allowed')}>
              {isTransferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {isTransferring ? 'Transfert...' : 'Transférer'}
            </button>
            <span className="text-[10px] text-slate-400 mt-1">{selectedStudents.size} sélectionné(s)</span>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              {mode === 'series' ? 'Classe d\'arrivée (série sélectionnée)' : 'Classe d\'arrivée'}
            </label>
            <select value={toClassId} onChange={(e) => setToClassId(e.target.value)}
              className={cn('w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2',
                fromClassId === toClassId && toClassId ? 'ring-2 ring-red-400 border-red-300' : 'focus:ring-indigo-500')}>
              <option value="">— Sélectionner —</option>
              {toClasses.map(c => <option key={c.id} value={c.id} disabled={c.id === fromClassId}>{c.schoolLevel?.name ? `${c.schoolLevel.name} · ` : ''}{c.name}{c.id === fromClassId ? ' (départ)' : ''}</option>)}
            </select>
          </div>
        </div>
        {fromClassId === toClassId && toClassId && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600"><AlertCircle className="w-3.5 h-3.5" />La classe d'arrivée doit être différente.</div>
        )}
      </div>

      {/* Panneaux gauche / droit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* Panneau gauche */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-amber-50/50">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
                {fromClassId ? `Départ : ${classes.find(c => c.id === fromClassId)?.name || ''}` : 'Classe de départ'}
              </h4>
              {fromClassStudents.length > 0 && (
                <button onClick={() => {
                  const allIds = fromClassStudents.map(e => e.student.id);
                  const allSelected = allIds.every(id => selectedStudents.has(id));
                  setSelectedStudents(prev => {
                    const next = new Set(prev);
                    allSelected ? allIds.forEach(id => next.delete(id)) : allIds.forEach(id => next.add(id));
                    return next;
                  });
                }} className="text-[10px] font-semibold text-blue-600 hover:text-blue-800">
                  {fromClassStudents.every(e => selectedStudents.has(e.student.id)) ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              )}
            </div>
            {fromClassId && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-amber-500" />
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-amber-500 animate-spin" /></div>
              : !fromClassId ? <div className="flex flex-col items-center justify-center py-12 text-center"><Share2 className="w-10 h-10 text-slate-300 mb-2" /><p className="text-xs text-slate-500">Sélectionnez une classe de départ</p></div>
              : fromClassStudents.length === 0 ? <div className="flex flex-col items-center justify-center py-12 text-center"><Users className="w-10 h-10 text-slate-300 mb-2" /><p className="text-xs text-slate-500">Aucun élève</p></div>
              : <div className="divide-y divide-slate-50">
                  {fromClassStudents.map(enr => {
                    const isSelected = selectedStudents.has(enr.student.id);
                    return (
                      <label key={enr.student.id} className={cn('flex items-center gap-2.5 p-2.5 cursor-pointer hover:bg-amber-50/50 transition', isSelected && 'bg-amber-50')}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleStudent(enr.student.id)} className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 shrink-0" />
                        <StudentAvatar student={enr.student} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{enr.student.lastName.toUpperCase()} {enr.student.firstName}</p>
                          <p className="text-[10px] font-mono text-slate-400">{enr.student.matricule || '—'}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
            }
          </div>
        </div>

        {/* Panneau droit */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-indigo-50/50">
            <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
              {toClassId ? `Arrivée : ${classes.find(c => c.id === toClassId)?.name || ''}` : 'Classe d\'arrivée'}
            </h4>
            <p className="text-[10px] text-slate-500 mt-0.5">{toClassId ? `${toClassStudents.length} élève(s) déjà présent(s)` : 'Sélectionnez une classe d\'arrivée'}</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!toClassId ? <div className="flex flex-col items-center justify-center py-12 text-center"><CheckCircle2 className="w-10 h-10 text-slate-300 mb-2" /><p className="text-xs text-slate-500">Sélectionnez une classe d'arrivée</p></div>
              : toClassStudents.length === 0 ? <div className="flex flex-col items-center justify-center py-12 text-center"><Users className="w-10 h-10 text-slate-300 mb-2" /><p className="text-xs text-slate-500">Aucun élève</p></div>
              : <div className="divide-y divide-slate-50">
                  {toClassStudents.map(enr => (
                    <div key={enr.student.id} className="flex items-center gap-2.5 p-2.5">
                      <StudentAvatar student={enr.student} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{enr.student.lastName.toUpperCase()} {enr.student.firstName}</p>
                        <p className="text-[10px] font-mono text-slate-400">{enr.student.matricule || '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sous-onglet 3 : Mouvements ───

function MouvementsSubTab({ academicYear, schoolLevel }: { academicYear: any; schoolLevel: any }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterLevelId, setFilterLevelId] = useState('');
  const [filterClassId, setFilterClassId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, totalPages: 1 });
  const [globalStats, setGlobalStats] = useState({ total: 0, active: 0, withdrawn: 0, archived: 0, transferred: 0 });

  // Modal d'action
  const [actionStudent, setActionStudent] = useState<Student | null>(null);
  const [actionType, setActionType] = useState<'archive' | 'withdraw' | 'reactivate' | 'transfer' | 'exclude' | 'exit' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transferSearchQuery, setTransferSearchQuery] = useState('');
  const [allSchools, setAllSchools] = useState<any[]>([]);
  const [transferSelectedSchool, setTransferSelectedSchool] = useState<any | null>(null);
  const [transferExternalSchoolName, setTransferExternalSchoolName] = useState('');

  const effectiveYearId = academicYear?.id || '';
  const PAGE_SIZE = 50;

  useEffect(() => {
    fetch('/api/all-classes', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : []).then(data => setClasses(Array.isArray(data) ? data : [])).catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    if (effectiveYearId) { setCurrentPage(1); loadData(); loadGlobalStats(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveYearId]);

  useEffect(() => {
    if (effectiveYearId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, filterStatus]);

  const loadData = async () => {
    if (!effectiveYearId) return;
    setIsLoading(true);
    try {
      const params: Record<string, string> = { academicYearId: effectiveYearId, page: String(currentPage), limit: String(PAGE_SIZE) };
      if (filterStatus !== 'ALL') params.status = filterStatus;
      const [studentsData, enrollmentsData] = await Promise.all([
        studentsService.getAll(params),
        studentsService.getEnrollments({ academicYearId: effectiveYearId }),
      ]);
      if (Array.isArray(studentsData)) {
        setStudents(studentsData);
        setPagination({ total: studentsData.length, page: 1, limit: studentsData.length, totalPages: 1 });
      } else if (studentsData?.data) {
        setStudents(studentsData.data);
        setPagination({ total: studentsData.total || 0, page: studentsData.page || 1, limit: studentsData.limit || PAGE_SIZE, totalPages: studentsData.totalPages || 1 });
      } else { setStudents([]); setPagination({ total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1 }); }
      setEnrollments(Array.isArray(enrollmentsData) ? enrollmentsData : []);
    } catch { } finally { setIsLoading(false); }
  };

  const loadGlobalStats = async () => {
    try {
      const data = await studentsService.getAll({ academicYearId: effectiveYearId, limit: '200' });
      const all: Student[] = Array.isArray(data) ? data : (data?.data || []);
      setGlobalStats({
        total: all.length,
        active: all.filter(s => s.status === 'ACTIVE' && s.isActive).length,
        withdrawn: all.filter(s => s.status === 'WITHDRAWN').length,
        archived: all.filter(s => s.status === 'ARCHIVED').length,
        transferred: all.filter(s => s.status === 'TRANSFERRED').length,
      });
    } catch { }
  };

  const studentClassMap = useMemo(() => {
    const m = new Map<string, string>();
    enrollments.forEach(e => { if (e.class?.id) m.set(e.student.id, e.class.id); });
    return m;
  }, [enrollments]);

  const levels = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    classes.forEach(c => { if (c.schoolLevelId && !map.has(c.schoolLevelId)) map.set(c.schoolLevelId, { id: c.schoolLevelId, name: c.schoolLevel?.name || 'Niveau' }); });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [classes]);

  const filteredClasses = useMemo(() => filterLevelId ? classes.filter(c => c.schoolLevelId === filterLevelId) : classes, [classes, filterLevelId]);

  const filteredStudents = useMemo(() => students.filter(s => {
    if (filterStatus !== 'ALL' && s.status !== filterStatus) return false;
    if (filterLevelId && s.schoolLevelId !== filterLevelId) return false;
    if (filterClassId && studentClassMap.get(s.id) !== filterClassId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) || (s.matricule || '').toLowerCase().includes(q);
    }
    return true;
  }), [students, filterStatus, searchQuery, filterLevelId, filterClassId, studentClassMap]);

  const handleAction = async () => {
    if (!actionStudent || !actionType || !effectiveYearId) return;
    setIsProcessing(true);
    try {
      if (actionType === 'archive') {
        await apiFetch(`/students/${actionStudent.id}/archive`, { method: 'POST' });
      } else if (actionType === 'withdraw') {
        await studentsService.withdrawStudent({ studentId: actionStudent.id, academicYearId: effectiveYearId, exitReason: actionReason || 'Abandon' });
      } else if (actionType === 'reactivate') {
        await studentsService.reintegrateStudent({ studentId: actionStudent.id, academicYearId: effectiveYearId, schoolLevelId: schoolLevel?.id || actionStudent.schoolLevelId || '' });
      } else if (actionType === 'exclude') {
        await apiFetch('/students/exclude', { method: 'POST', body: JSON.stringify({ studentId: actionStudent.id, academicYearId: effectiveYearId, reason: actionReason || 'Exclusion administrative' }) });
      } else if (actionType === 'exit') {
        await apiFetch('/students/exit', { method: 'POST', body: JSON.stringify({ studentId: actionStudent.id, academicYearId: effectiveYearId, exitReason: actionReason || 'Sortie fin d\'année' }) });
      } else if (actionType === 'transfer') {
        if (transferSelectedSchool) {
          await studentsService.transferStudent({ studentId: actionStudent.id, academicYearId: effectiveYearId, exitReason: actionReason || 'Transfert' });
        } else if (transferExternalSchoolName.trim()) {
          await apiFetch(`/students/${actionStudent.id}/archive`, { method: 'POST', body: JSON.stringify({ reason: `Transfert vers ${transferExternalSchoolName}`, status: 'TRANSFERRED' }) });
        }
      }
      toast({ title: '✅ Action effectuée', variant: 'success' });
      setActionStudent(null); setActionType(null); setActionReason(''); setTransferSelectedSchool(null); setTransferExternalSchoolName('');
      loadData(); loadGlobalStats();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    } finally { setIsProcessing(false); }
  };

  const openAction = (student: Student, type: typeof actionType) => {
    setActionStudent(student); setActionType(type); setActionReason(''); setTransferSelectedSchool(null); setTransferExternalSchoolName(''); setTransferSearchQuery('');
    if (type === 'transfer') {
      if (allSchools.length === 0) {
        fetch('/api/public/schools/list', { credentials: 'include' }).then(r => r.ok ? r.json() : []).then(data => setAllSchools(Array.isArray(data) ? data : (data?.schools || []))).catch(() => setAllSchools([]));
      }
    }
  };

  const resetFilters = () => { setFilterStatus('ALL'); setFilterLevelId(''); setFilterClassId(''); setSearchQuery(''); };

  const stats = globalStats;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: Users, color: 'bg-slate-50 text-slate-600' },
          { label: 'Actifs', value: stats.active, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Retirés', value: stats.withdrawn, icon: LogOut, color: 'bg-rose-50 text-rose-600' },
          { label: 'Archivés', value: stats.archived, icon: Archive, color: 'bg-amber-50 text-amber-600' },
          { label: 'Transférés', value: stats.transferred, icon: ArrowRightLeft, color: 'bg-blue-50 text-blue-600' },
        ].map((s, i) => (
          <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2.5">
            <div className={cn('p-2 rounded-lg', s.color)}><s.icon className="w-4 h-4" /></div>
            <div><p className="text-[10px] font-medium text-slate-500 uppercase">{s.label}</p><p className="text-base font-bold text-slate-900">{s.value}</p></div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIVE">Actifs</option>
            <option value="WITHDRAWN">Retirés</option>
            <option value="EXCLUDED">Exclus</option>
            <option value="ARCHIVED">Archivés</option>
            <option value="TRANSFERRED">Transférés</option>
            <option value="INACTIVE">Inactifs</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={filterLevelId} onChange={(e) => { setFilterLevelId(e.target.value); setFilterClassId(''); }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Tous les niveaux</option>
            {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select value={filterClassId} onChange={(e) => setFilterClassId(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Toutes les classes</option>
            {filteredClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {(filterStatus !== 'ALL' || filterLevelId || filterClassId || searchQuery) && (
            <button onClick={resetFilters} className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100">✕ Réinitialiser</button>
          )}
          <div className="ml-auto text-xs text-slate-400">{pagination.total} élève(s) · page {pagination.page}/{pagination.totalPages}</div>
        </div>
      </div>

      {/* Liste */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
        {isLoading ? <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
          : filteredStudents.length === 0 ? <div className="flex flex-col items-center justify-center py-12"><History className="w-12 h-12 text-slate-300 mb-3" /><p className="text-sm text-slate-500">Aucun élève</p></div>
          : <div className="overflow-y-auto flex-1">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Élève</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Classe</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Statut</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map(student => {
                    const statusInfo = STATUS_LABELS[student.status] || STATUS_LABELS.ACTIVE;
                    const Icon = statusInfo.icon;
                    const studentClassId = studentClassMap.get(student.id);
                    const studentClass = classes.find(c => c.id === studentClassId);
                    return (
                      <tr key={student.id} className="hover:bg-slate-50/80 transition group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <StudentAvatar student={student} size="md" />
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{student.lastName.toUpperCase()} {student.firstName}</p>
                              <p className="text-[10px] text-slate-400">{student.matricule || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{studentClass ? <span className="px-2 py-1 rounded-md bg-slate-100 text-xs">{studentClass.name}</span> : <span className="text-slate-400 text-xs italic">Non affecté</span>}</td>
                        <td className="px-4 py-3"><span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border', statusInfo.color)}><Icon className="w-3 h-3" />{statusInfo.label}</span></td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {student.status === 'ACTIVE' && student.isActive && (
                              <>
                                <button onClick={() => openAction(student, 'withdraw')} className="px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200" title="Retirer (abandon)"><LogOut className="w-3 h-3 inline" /> Retirer</button>
                                <button onClick={() => openAction(student, 'exclude')} className="px-2 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200" title="Exclusion administrative"><Ban className="w-3 h-3 inline" /> Exclure</button>
                                <button onClick={() => openAction(student, 'exit')} className="px-2 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200" title="Sortie fin d'année"><DoorOpen className="w-3 h-3 inline" /> Sortie</button>
                                <button onClick={() => openAction(student, 'transfer')} className="px-2 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200" title="Transférer"><ArrowRightLeft className="w-3 h-3 inline" /> Transférer</button>
                                <button onClick={() => openAction(student, 'archive')} className="px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200" title="Archiver"><Archive className="w-3 h-3 inline" /> Archiver</button>
                              </>
                            )}
                            {(student.status === 'WITHDRAWN' || student.status === 'ARCHIVED' || student.status === 'EXCLUDED') && (
                              <button onClick={() => openAction(student, 'reactivate')} className="px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200" title="Réintégrer"><RotateCcw className="w-3 h-3 inline" /> Réintégrer</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
        }
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && <Pagination currentPage={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={pagination.limit} onPageChange={setCurrentPage} isLoading={isLoading} />}

      {/* Modal d'action */}
      {actionStudent && actionType && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setActionStudent(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                {actionType === 'archive' && 'Archiver l\'élève'}
                {actionType === 'withdraw' && 'Retirer l\'élève (abandon)'}
                {actionType === 'exclude' && 'Exclure l\'élève (administratif)'}
                {actionType === 'exit' && 'Sortie fin d\'année'}
                {actionType === 'reactivate' && 'Réintégrer l\'élève'}
                {actionType === 'transfer' && 'Transférer l\'élève'}
              </h3>
              <div className="flex items-center gap-2 mt-2"><StudentAvatar student={actionStudent} size="sm" /><p className="text-sm text-slate-600">{actionStudent.firstName} {actionStudent.lastName}{actionStudent.matricule && ` · ${actionStudent.matricule}`}</p></div>
            </div>
            <div className="px-6 py-4 space-y-3">
              {(actionType === 'archive' || actionType === 'withdraw' || actionType === 'exclude' || actionType === 'exit') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Motif {actionType === 'exclude' ? '(obligatoire)' : '(optionnel)'}</label>
                  <textarea value={actionReason} onChange={(e) => setActionReason(e.target.value)} rows={3}
                    placeholder={actionType === 'withdraw' ? 'Ex: Déménagement...' : actionType === 'exclude' ? 'Ex: Faute disciplinaire grave...' : actionType === 'exit' ? 'Ex: Fin d\'année scolaire...' : 'Ex: Fin d\'année...'}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
              )}
              {actionType === 'transfer' && (
                <div className="space-y-3">
                  <input type="text" value={transferSearchQuery} onChange={(e) => setTransferSearchQuery(e.target.value)} placeholder="Rechercher une école..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  <div className="border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
                    {allSchools.filter(s => !transferSearchQuery.trim() || (s.name || '').toLowerCase().includes(transferSearchQuery.toLowerCase())).map(school => (
                      <button key={school.id} onClick={() => { setTransferSelectedSchool(school); setTransferExternalSchoolName(''); }}
                        className={cn('w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-slate-50 last:border-b-0', transferSelectedSchool?.id === school.id && 'bg-blue-50 font-semibold text-blue-700')}>
                        {school.name} {school.subdomain && <span className="text-xs text-slate-400 ml-2">{school.subdomain}</span>}
                      </button>
                    ))}
                  </div>
                  {!transferSelectedSchool && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ou nom de l'école (si externe)</label>
                      <input type="text" value={transferExternalSchoolName} onChange={(e) => setTransferExternalSchoolName(e.target.value)} placeholder="Ex: École Saint-Joseph" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    </div>
                  )}
                </div>
              )}
              {actionType === 'reactivate' && <p className="text-sm text-slate-600">L'élève sera réintégré avec le statut <strong>ACTIF</strong>.</p>}
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-2">
              <button onClick={() => setActionStudent(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg">Annuler</button>
              <button onClick={handleAction} disabled={isProcessing || (actionType === 'exclude' && !actionReason.trim()) || (actionType === 'transfer' && !transferSelectedSchool && !transferExternalSchoolName.trim())}
                className={cn('px-4 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50', actionType === 'reactivate' ? 'bg-emerald-600 hover:bg-emerald-700' : actionType === 'exclude' ? 'bg-red-600 hover:bg-red-700' : actionType === 'transfer' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-rose-600 hover:bg-rose-700')}>
                {isProcessing ? 'Traitement...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sous-onglet 4 : Historique ───

function HistoriqueSubTab({ academicYear }: { academicYear: any }) {
  const [history, setHistory] = useState<MovementHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterAction, setFilterAction] = useState('');

  useEffect(() => {
    if (academicYear?.id) loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear?.id]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/students/movement-history?limit=200');
      setHistory(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.warn('Failed to load history:', e);
      setHistory([]);
    } finally { setIsLoading(false); }
  };

  const filteredHistory = useMemo(() => {
    if (!filterAction) return history;
    return history.filter(h => h.action === filterAction);
  }, [history, filterAction]);

  return (
    <div className="space-y-4">
      {/* Filtre par type d'action */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400" />
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Tous les types de mouvement</option>
          {Object.entries(ACTION_LABELS).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
        </select>
        <span className="ml-auto text-xs text-slate-400">{filteredHistory.length} mouvement(s)</span>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
          : filteredHistory.length === 0 ? <div className="flex flex-col items-center justify-center py-12"><FileText className="w-12 h-12 text-slate-300 mb-3" /><p className="text-sm text-slate-500">Aucun mouvement enregistré</p></div>
          : <div className="divide-y divide-slate-100">
              {filteredHistory.map(item => {
                const actionInfo = ACTION_LABELS[item.action] || { label: item.action, color: 'text-slate-600' };
                return (
                  <div key={item.id} className="flex items-start gap-3 p-3 hover:bg-slate-50/80 transition">
                    <div className={cn('p-2 rounded-lg bg-slate-100', actionInfo.color)}>
                      <History className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-xs font-bold', actionInfo.color)}>{actionInfo.label}</span>
                        <span className="text-[10px] text-slate-400">{new Date(item.date).toLocaleString('fr-FR')}</span>
                      </div>
                      {item.student && (
                        <p className="text-sm text-slate-700 mt-0.5">
                          {item.student.lastName.toUpperCase()} {item.student.firstName}
                          {item.student.matricule && <span className="text-[10px] font-mono text-slate-400 ml-2">{item.student.matricule}</span>}
                          {item.student.levelName && <span className="text-[10px] text-slate-400 ml-2">· {item.student.levelName}</span>}
                        </p>
                      )}
                      {item.afterData?.reason && <p className="text-[10px] text-slate-500 mt-0.5 italic">Motif : {item.afterData.reason}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
        }
      </div>
    </div>
  );
}

// ─── Composant Pagination (réutilisable) ───

function Pagination({ currentPage, totalPages, total, limit, onPageChange, isLoading }: {
  currentPage: number; totalPages: number; total: number; limit: number; onPageChange: (p: number) => void; isLoading?: boolean;
}) {
  if (totalPages <= 1) return null;
  const start = (currentPage - 1) * limit + 1;
  const end = Math.min(currentPage * limit, total);
  const pages: (number | 'ellipsis')[] = [];
  const add = (p: number) => { if (!pages.includes(p)) pages.push(p); };
  add(1);
  if (currentPage - 1 > 2) pages.push('ellipsis');
  for (let p = Math.max(2, currentPage - 1); p <= Math.min(totalPages - 1, currentPage + 1); p++) add(p);
  if (currentPage + 1 < totalPages - 1) pages.push('ellipsis');
  if (totalPages > 1) add(totalPages);

  return (
    <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
      <div className="text-xs text-slate-500">Affichage <strong className="text-slate-700">{start}-{end}</strong> sur <strong className="text-slate-700">{total}</strong> élève(s)</div>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1 || isLoading} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-40">
          <ChevronLeft className="w-3.5 h-3.5" /> Précédent
        </button>
        <div className="flex items-center gap-0.5">
          {pages.map((p, i) => p === 'ellipsis' ? <span key={`e-${i}`} className="px-2 text-slate-400"><MoreHorizontal className="w-3.5 h-3.5" /></span>
            : <button key={p} onClick={() => onPageChange(p)} disabled={isLoading} className={cn('min-w-[28px] h-7 px-2 text-xs font-bold rounded-lg transition disabled:opacity-50', p === currentPage ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200')}>{p}</button>
          )}
        </div>
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages || isLoading} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-40">
          Suivant <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
