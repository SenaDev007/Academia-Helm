'use client';

/**
 * ============================================================================
 * AFFECTATIONS — Changement de classe des élèves
 * ============================================================================
 *
 * Nouveau concept (depuis le 2026-07-09) :
 *   Au cours des admissions/inscriptions, la classe de l'élève est désormais
 *   obligatoire. L'ancien panneau "Élèves non affectés" ne sert donc plus.
 *
 *   Cet onglet sert maintenant au CHANGEMENT DE CLASSE :
 *     - Panneau gauche : classe de DÉPART (sélection + liste des élèves à transférer)
 *     - Panneau droit : classe d'ARRIVÉE (sélection + preview des élèves déjà présents)
 *     - Bouton "Transférer →" au milieu pour déplacer les élèves sélectionnés
 *
 * Règles :
 *   - On ne peut pas transférer vers la même classe (validation)
 *   - Multi-sélection possible dans le panneau gauche
 *   - Après transfert, les listes sont rafraîchies
 * ============================================================================
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Share2, Search, Loader2, ArrowRight, ChevronDown, ChevronRight,
  Users, ArrowRightLeft, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { studentsService } from '@/services/students.service';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

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
}

interface Enrollment {
  id: string;
  student: Student;
  class?: { id: string; name: string };
  status: string;
}

// Ordre pédagogique des niveaux (Maternelle < Primaire < Secondaire)
const LEVEL_ORDER: Record<string, number> = {
  MATERNELLE: 1, MAT: 1,
  PRIMAIRE: 2, PRIMARY: 2,
  SECONDAIRE: 3, SECONDARY: 3, SECOND: 3,
};

function getLevelOrder(code?: string): number {
  if (!code) return 99;
  return LEVEL_ORDER[code.toUpperCase()] || 99;
}

// Composant Avatar réutilisable
function StudentAvatar({ student, size = 'md' }: { student: Student; size?: 'sm' | 'md' }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-9 w-9 text-xs' };
  const cls = sizes[size];
  if (student.photoUrl) {
    return (
      <img src={student.photoUrl} alt={`${student.firstName} ${student.lastName}`}
        className={cn(cls, 'rounded-full object-cover shrink-0 border border-slate-200')} />
    );
  }
  return (
    <div className={cn(cls, 'rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 shrink-0')}>
      {student.lastName?.[0] || '?'}{student.firstName?.[0] || ''}
    </div>
  );
}

export default function StudentAssignmentsContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  // ⭐ Nouveau state : classe de départ + classe d'arrivée
  const [fromClassId, setFromClassId] = useState<string>('');
  const [toClassId, setToClassId] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (academicYear) loadData();
  }, [academicYear, schoolLevel]);

  const loadData = async () => {
    if (!academicYear) return;
    setIsLoading(true);
    try {
      const [classesRes, enrollmentsData] = await Promise.all([
        fetch(`/api/all-classes`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []),
        studentsService.getEnrollments({ academicYearId: academicYear.id }),
      ]);
      setClasses(Array.isArray(classesRes) ? classesRes : []);
      setEnrollments(Array.isArray(enrollmentsData) ? enrollmentsData : []);
    } catch (e: any) {
      console.error('Failed to load assignments:', e);
      toast({ title: 'Erreur', description: e.message || 'Impossible de charger les données', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Classes triées par ordre pédagogique puis par nom
  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => {
      const orderA = getLevelOrder(a.schoolLevel?.code);
      const orderB = getLevelOrder(b.schoolLevel?.code);
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
  }, [classes]);

  // Map classId → élèves inscrits dans cette classe
  const studentsByClass = useMemo(() => {
    const m = new Map<string, Enrollment[]>();
    enrollments.forEach(e => {
      if (e.class?.id) {
        if (!m.has(e.class.id)) m.set(e.class.id, []);
        m.get(e.class.id)!.push(e);
      }
    });
    // Trier chaque liste par nom
    m.forEach(list => list.sort((a, b) =>
      a.student.lastName.localeCompare(b.student.lastName) ||
      a.student.firstName.localeCompare(b.student.firstName)
    ));
    return m;
  }, [enrollments]);

  // Élèves de la classe de départ (avec filtre recherche)
  const fromClassStudents = useMemo(() => {
    if (!fromClassId) return [];
    const list = studentsByClass.get(fromClassId) || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(e =>
      `${e.student.firstName} ${e.student.lastName}`.toLowerCase().includes(q) ||
      (e.student.matricule || '').toLowerCase().includes(q)
    );
  }, [fromClassId, studentsByClass, searchQuery]);

  // Élèves de la classe d'arrivée (preview)
  const toClassStudents = useMemo(() => {
    if (!toClassId) return [];
    return studentsByClass.get(toClassId) || [];
  }, [toClassId, studentsByClass]);

  const fromClassName = useMemo(() => classes.find(c => c.id === fromClassId)?.name || '', [classes, fromClassId]);
  const toClassName = useMemo(() => classes.find(c => c.id === toClassId)?.name || '', [classes, toClassId]);

  // Toggle sélection élève dans le panneau gauche
  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  // Sélectionner / désélectionner tous les élèves visibles
  const toggleSelectAll = () => {
    const visibleIds = fromClassStudents.map(e => e.student.id);
    const allSelected = visibleIds.every(id => selectedStudents.has(id));
    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // ⭐ Transférer les élèves sélectionnés vers la classe d'arrivée
  const handleTransfer = async () => {
    if (!academicYear || !fromClassId || !toClassId || selectedStudents.size === 0) return;
    if (fromClassId === toClassId) {
      toast({ title: 'Erreur', description: 'La classe de départ et d\'arrivée doivent être différentes.', variant: 'error' });
      return;
    }
    setIsTransferring(true);
    try {
      const studentIds = Array.from(selectedStudents);
      // Transférer un par un (endpoint /students/change-class)
      const results = await Promise.allSettled(
        studentIds.map(studentId =>
          apiFetch('/students/change-class', {
            method: 'POST',
            body: JSON.stringify({
              studentId,
              academicYearId: academicYear.id,
              newClassId: toClassId,
            }),
          })
        )
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed === 0) {
        toast({
          title: '✅ Transfert réussi',
          description: `${succeeded} élève(s) transféré(s) de "${fromClassName}" vers "${toClassName}".`,
          variant: 'success',
        });
      } else {
        toast({
          title: '⚠️ Transfert partiel',
          description: `${succeeded} réussi(s), ${failed} échec(s) sur ${studentIds.length} élève(s).`,
          variant: 'success',
        });
      }
      // Reset sélection + reload
      setSelectedStudents(new Set());
      loadData();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || 'Échec du transfert', variant: 'error' });
    } finally {
      setIsTransferring(false);
    }
  };

  const canTransfer = fromClassId && toClassId && fromClassId !== toClassId && selectedStudents.size > 0 && !isTransferring;

  // Stats
  const stats = useMemo(() => ({
    totalClasses: classes.length,
    totalAssigned: enrollments.filter(e => e.class?.id).length,
    selected: selectedStudents.size,
    fromClassCount: fromClassId ? (studentsByClass.get(fromClassId)?.length || 0) : 0,
    toClassCount: toClassId ? (studentsByClass.get(toClassId)?.length || 0) : 0,
  }), [classes, enrollments, selectedStudents, fromClassId, toClassId, studentsByClass]);

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Classes', value: stats.totalClasses, icon: Share2, color: 'bg-blue-50 text-blue-600' },
          { label: 'Élèves affectés', value: stats.totalAssigned, icon: Users, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Classe départ', value: stats.fromClassCount, icon: ArrowRight, color: 'bg-amber-50 text-amber-600' },
          { label: 'Classe arrivée', value: stats.toClassCount, icon: CheckCircle2, color: 'bg-indigo-50 text-indigo-600' },
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

      {/* Toolbar — sélecteurs de classes */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-blue-600" />
            Changement de classe
          </h3>
          <p className="text-xs text-slate-500">
            Sélectionnez une classe de départ, choisissez les élèves à transférer, puis sélectionnez la classe d'arrivée.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
          {/* Classe de départ */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Classe de départ</label>
            <select
              value={fromClassId}
              onChange={(e) => { setFromClassId(e.target.value); setSelectedStudents(new Set()); }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">— Sélectionner —</option>
              {sortedClasses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.schoolLevel?.name ? `${c.schoolLevel.name} · ` : ''}{c.name}
                </option>
              ))}
            </select>
          </div>
          {/* Bouton transférer */}
          <div className="flex flex-col items-center">
            <button
              onClick={handleTransfer}
              disabled={!canTransfer}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition',
                canTransfer
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              )}
              title={fromClassId === toClassId ? 'Classes identiques' : 'Transférer les élèves sélectionnés'}
            >
              {isTransferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {isTransferring ? 'Transfert...' : 'Transférer'}
            </button>
            <span className="text-[10px] text-slate-400 mt-1">
              {selectedStudents.size} sélectionné(s)
            </span>
          </div>
          {/* Classe d'arrivée */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Classe d'arrivée</label>
            <select
              value={toClassId}
              onChange={(e) => setToClassId(e.target.value)}
              className={cn(
                'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2',
                fromClassId === toClassId && toClassId ? 'ring-2 ring-red-400 border-red-300' : 'focus:ring-indigo-500'
              )}
            >
              <option value="">— Sélectionner —</option>
              {sortedClasses.map(c => (
                <option key={c.id} value={c.id} disabled={c.id === fromClassId}>
                  {c.schoolLevel?.name ? `${c.schoolLevel.name} · ` : ''}{c.name}{c.id === fromClassId ? ' (départ)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        {fromClassId === toClassId && toClassId && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle className="w-3.5 h-3.5" />
            La classe d'arrivée doit être différente de la classe de départ.
          </div>
        )}
      </div>

      {/* Panneaux gauche / droit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* ─── Panneau gauche : élèves de la classe de départ ─── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-amber-50/50">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
                {fromClassName ? `Départ : ${fromClassName}` : 'Classe de départ'}
              </h4>
              {fromClassStudents.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className="text-[10px] font-semibold text-blue-600 hover:text-blue-800"
                >
                  {fromClassStudents.every(e => selectedStudents.has(e.student.id)) ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              )}
            </div>
            {fromClassId && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-amber-500 animate-spin" /></div>
            ) : !fromClassId ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Share2 className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-xs text-slate-500">Sélectionnez une classe de départ</p>
              </div>
            ) : fromClassStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-xs text-slate-500">Aucun élève dans cette classe</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {fromClassStudents.map(enr => {
                  const isSelected = selectedStudents.has(enr.student.id);
                  return (
                    <label
                      key={enr.student.id}
                      className={cn(
                        'flex items-center gap-2.5 p-2.5 cursor-pointer hover:bg-amber-50/50 transition',
                        isSelected && 'bg-amber-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleStudentSelection(enr.student.id)}
                        className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 shrink-0"
                      />
                      <StudentAvatar student={enr.student} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {enr.student.lastName.toUpperCase()} {enr.student.firstName}
                        </p>
                        <p className="text-[10px] font-mono text-slate-400">
                          {enr.student.matricule || enr.student.studentCode || '—'}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          {fromClassStudents.length > 0 && (
            <div className="p-2 border-t border-slate-100 bg-slate-50/50 text-[10px] text-slate-500 text-center">
              {fromClassStudents.length} élève(s) · {selectedStudents.size} sélectionné(s)
            </div>
          )}
        </div>

        {/* ─── Panneau droit : preview classe d'arrivée ─── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-indigo-50/50">
            <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
              {toClassName ? `Arrivée : ${toClassName}` : 'Classe d\'arrivée'}
            </h4>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {toClassId
                ? `${toClassStudents.length} élève(s) déjà dans cette classe`
                : 'Sélectionnez une classe d\'arrivée pour voir les élèves déjà présents'}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!toClassId ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-xs text-slate-500">Sélectionnez une classe d'arrivée</p>
              </div>
            ) : toClassStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-xs text-slate-500">Aucun élève dans cette classe</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {toClassStudents.map(enr => (
                  <div key={enr.student.id} className="flex items-center gap-2.5 p-2.5">
                    <StudentAvatar student={enr.student} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {enr.student.lastName.toUpperCase()} {enr.student.firstName}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400">
                        {enr.student.matricule || enr.student.studentCode || '—'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {toClassId && toClassStudents.length > 0 && (
            <div className="p-2 border-t border-slate-100 bg-slate-50/50 text-[10px] text-slate-500 text-center">
              {toClassStudents.length} élève(s) dans la classe d'arrivée
            </div>
          )}
        </div>
      </div>

      {/* Récapitulatif transfert */}
      {canTransfer && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <ArrowRightLeft className="w-4 h-4" />
            <span>
              <strong>{selectedStudents.size}</strong> élève(s) seront transférés de
              <strong className="mx-1">{fromClassName}</strong> vers
              <strong className="mx-1">{toClassName}</strong>
            </span>
          </div>
          <button
            onClick={handleTransfer}
            disabled={isTransferring}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition"
          >
            {isTransferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Confirmer le transfert
          </button>
        </div>
      )}
    </div>
  );
}
