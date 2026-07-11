'use client';

/**
 * ============================================================================
 * AFFECTATION VERS CLASSE PHYSIQUE — 1er sous-onglet du module Affectations
 * ============================================================================
 *
 * Workflow :
 *   1. L'élève a été admis/inscrit dans une classe OFFICIELLE (AcademicClass)
 *      — ex: CP, CE1, 6ème — mais n'a pas encore de classe PHYSIQUE (classId NULL).
 *   2. L'école sélectionne l'élève dans la liste de gauche.
 *   3. L'école choisit une classe PHYSIQUE (Class — ex: CE1-A, CE1-B) dans la liste de droite.
 *   4. Bouton "Affecter →" pour valider.
 *
 * Endpoints :
 *   - GET  /api/students/students-without-physical-class
 *   - GET  /api/all-classes (classes physiques)
 *   - POST /api/students/assign-physical-class
 * ============================================================================
 */

import { useState, useEffect, useMemo } from 'react';
import {
  UserCheck, Search, Loader2, ArrowRight, AlertCircle, CheckCircle2, Users, Building,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { studentsService } from '@/services/students.service';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface StudentInfo {
  id: string;
  firstName: string;
  lastName: string;
  matricule?: string | null;
  studentCode?: string;
  photoUrl?: string | null;
}

interface AcademicClassInfo {
  id: string;
  name: string;
  code?: string;
  level?: { id: string; name: string; code?: string };
  cycle?: { id: string; name: string };
  series?: { id: string; name: string; code?: string } | null;
}

interface PhysicalClassInfo {
  id: string;
  name: string;
  code?: string;
  schoolLevelId: string;
  schoolLevel?: { id: string; name: string; code?: string };
  officialClassId?: string | null;
  capacity?: number | null;
}

interface StudentWithoutClass {
  id: string;
  studentId: string;
  academicClassId: string | null;
  academicClass?: AcademicClassInfo;
  classId: string | null;
  student: StudentInfo;
  schoolLevelId: string;
  status: string;
}

export default function AffectationVersClassePhysique() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [studentsWithoutClass, setStudentsWithoutClass] = useState<StudentWithoutClass[]>([]);
  const [physicalClasses, setPhysicalClasses] = useState<PhysicalClassInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  // Sélection : élève + classe physique cible
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [targetClassId, setTargetClassId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAcademicClassId, setFilterAcademicClassId] = useState<string>('');

  useEffect(() => {
    if (academicYear?.id) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear?.id, schoolLevel?.id]);

  const loadData = async () => {
    if (!academicYear?.id) return;
    setIsLoading(true);
    try {
      const [studentsData, classesRes] = await Promise.all([
        studentsService.getStudentsWithoutPhysicalClass(academicYear.id).catch(() => []),
        fetch('/api/all-classes', { cache: 'no-store' })
          .then(r => r.ok ? r.json() : [])
          .catch(() => []),
      ]);
      setStudentsWithoutClass(Array.isArray(studentsData) ? studentsData : []);
      setPhysicalClasses(Array.isArray(classesRes) ? classesRes : []);
    } catch (e: any) {
      console.error('Failed to load:', e);
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Classes officielles distinctes (pour filtre)
  const academicClasses = useMemo(() => {
    const map = new Map<string, AcademicClassInfo>();
    studentsWithoutClass.forEach(s => {
      if (s.academicClass && !map.has(s.academicClass.id)) {
        map.set(s.academicClass.id, s.academicClass);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [studentsWithoutClass]);

  // Élèves filtrés (par recherche + filtre classe officielle)
  const filteredStudents = useMemo(() => {
    let list = studentsWithoutClass;
    if (filterAcademicClassId) {
      list = list.filter(s => s.academicClassId === filterAcademicClassId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        `${s.student.firstName} ${s.student.lastName}`.toLowerCase().includes(q) ||
        (s.student.matricule || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [studentsWithoutClass, filterAcademicClassId, searchQuery]);

  // Classes physiques disponibles, groupées par classe officielle
  const physicalClassesByOfficial = useMemo(() => {
    const map = new Map<string, PhysicalClassInfo[]>();
    physicalClasses.forEach(c => {
      const officialId = c.officialClassId || 'unassigned';
      if (!map.has(officialId)) map.set(officialId, []);
      map.get(officialId)!.push(c);
    });
    return map;
  }, [physicalClasses]);

  // Map classId → nombre d'élèves déjà affectés (réservé pour usage futur : afficher le remplissage des classes)
  // const classStudentCounts = useMemo(() => { ... }, [studentsWithoutClass]);

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const visibleIds = filteredStudents.map(s => s.id);
    const allSelected = visibleIds.every(id => selectedStudentIds.has(id));
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // ⭐ Affecter les élèves sélectionnés vers la classe physique cible
  const handleAssign = async () => {
    if (!academicYear?.id || !targetClassId || selectedStudentIds.size === 0) return;
    setIsAssigning(true);
    try {
      const enrollmentIds = Array.from(selectedStudentIds);
      const targetClassName = physicalClasses.find(c => c.id === targetClassId)?.name || '';
      // Appel individuel pour chaque élève (endpoint /students/assign-physical-class)
      const results = await Promise.allSettled(
        enrollmentIds.map(enrollmentId => {
          // Récupérer le studentId à partir de l'enrollment
          const enr = studentsWithoutClass.find(s => s.id === enrollmentId);
          if (!enr) throw new Error('Enrollment introuvable');
          return studentsService.assignPhysicalClass({
            studentId: enr.studentId,
            academicYearId: academicYear.id,
            physicalClassId: targetClassId,
          });
        })
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed === 0) {
        toast({
          title: '✅ Affectation réussie',
          description: `${succeeded} élève(s) affecté(s) vers la classe physique "${targetClassName}".`,
          variant: 'success',
        });
      } else {
        toast({
          title: '⚠️ Affectation partielle',
          description: `${succeeded} réussi(s), ${failed} échec(s) sur ${enrollmentIds.length} élève(s).`,
          variant: 'success',
        });
      }
      setSelectedStudentIds(new Set());
      setTargetClassId('');
      loadData();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    } finally {
      setIsAssigning(false);
    }
  };

  const canAssign = targetClassId && selectedStudentIds.size > 0 && !isAssigning;

  // Stats
  const stats = useMemo(() => ({
    totalToAssign: studentsWithoutClass.length,
    filtered: filteredStudents.length,
    selected: selectedStudentIds.size,
    availablePhysicalClasses: physicalClasses.length,
  }), [studentsWithoutClass, filteredStudents, selectedStudentIds, physicalClasses]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'À affecter', value: stats.totalToAssign, icon: UserCheck, color: 'bg-amber-50 text-amber-600' },
          { label: 'Filtrés', value: stats.filtered, icon: Users, color: 'bg-blue-50 text-blue-600' },
          { label: 'Sélectionnés', value: stats.selected, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Classes physiques', value: stats.availablePhysicalClasses, icon: Building, color: 'bg-indigo-50 text-indigo-600' },
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
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-blue-600" />
            Affectation vers classe physique
          </h3>
          <p className="text-xs text-slate-500">
            Sélectionnez les élèves (admis en classe officielle), puis choisissez la section physique cible.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
          {/* Filtre classe officielle */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Filtrer par classe officielle
            </label>
            <select
              value={filterAcademicClassId}
              onChange={(e) => setFilterAcademicClassId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Toutes les classes officielles</option>
              {academicClasses.map(ac => (
                <option key={ac.id} value={ac.id}>
                  {ac.level?.name ? `${ac.level.name} · ` : ''}{ac.name}
                </option>
              ))}
            </select>
          </div>
          {/* Bouton affecter */}
          <div className="flex flex-col items-center">
            <button
              onClick={handleAssign}
              disabled={!canAssign}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition',
                canAssign
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              )}
            >
              {isAssigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {isAssigning ? 'Affectation...' : 'Affecter →'}
            </button>
            <span className="text-[10px] text-slate-400 mt-1">
              {selectedStudentIds.size} sélectionné(s)
            </span>
          </div>
          {/* Classe physique cible */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Classe physique cible
            </label>
            <select
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">— Sélectionner —</option>
              {/* Si des élèves sont sélectionnés avec une classe officielle commune,
                  on affiche en priorité les sections correspondantes. */}
              {(() => {
                // Détecter la classe officielle des élèves sélectionnés
                const selectedEnrs = studentsWithoutClass.filter(s => selectedStudentIds.has(s.id));
                const commonAcademicClassId = selectedEnrs.length > 0
                  ? selectedEnrs[0].academicClassId
                  : null;
                const allSameOfficial = commonAcademicClassId &&
                  selectedEnrs.every(s => s.academicClassId === commonAcademicClassId);

                if (allSameOfficial && commonAcademicClassId) {
                  const matchingClasses = physicalClassesByOfficial.get(commonAcademicClassId) || [];
                  const otherClasses = physicalClasses.filter(c => c.officialClassId !== commonAcademicClassId);
                  return (
                    <>
                      <optgroup label={`Sections correspondantes (${matchingClasses.length})`}>
                        {matchingClasses.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.schoolLevel?.name ? `${c.schoolLevel.name} · ` : ''}{c.name}
                            {c.capacity ? ` (cap. ${c.capacity})` : ''}
                          </option>
                        ))}
                      </optgroup>
                      {otherClasses.length > 0 && (
                        <optgroup label="Autres sections">
                          {otherClasses.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.schoolLevel?.name ? `${c.schoolLevel.name} · ` : ''}{c.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  );
                }
                // Pas de sélection commune : afficher toutes les classes physiques
                return physicalClasses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.schoolLevel?.name ? `${c.schoolLevel.name} · ` : ''}{c.name}
                  </option>
                ));
              })()}
            </select>
          </div>
        </div>
      </div>

      {/* Panneau principal : élèves à affecter */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden flex-1 min-h-0">
        <div className="p-3 border-b border-slate-100 bg-amber-50/50">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-amber-600" />
              Élèves sans classe physique
            </h4>
            {filteredStudents.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className="text-[10px] font-semibold text-blue-600 hover:text-blue-800"
              >
                {filteredStudents.every(s => selectedStudentIds.has(s.id)) ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un élève..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-300 mb-2" />
              <p className="text-sm font-medium text-slate-700">Tous les élèves ont été affectés</p>
              <p className="text-xs text-slate-500 mt-1">
                Aucun élève en attente d'affectation vers une classe physique.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filteredStudents.map(enr => {
                const isSelected = selectedStudentIds.has(enr.id);
                return (
                  <label
                    key={enr.id}
                    className={cn(
                      'flex items-center gap-2.5 p-2.5 cursor-pointer hover:bg-amber-50/50 transition',
                      isSelected && 'bg-amber-50'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleStudentSelection(enr.id)}
                      className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 shrink-0"
                    />
                    {/* Avatar */}
                    {enr.student.photoUrl ? (
                      <img src={enr.student.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover border border-slate-200" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs shrink-0">
                        {enr.student.lastName?.[0] || '?'}{enr.student.firstName?.[0] || ''}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {enr.student.lastName.toUpperCase()} {enr.student.firstName}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400">
                        {enr.student.matricule || enr.student.studentCode || '—'}
                      </p>
                    </div>
                    {/* Badge classe officielle */}
                    {enr.academicClass && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        {enr.academicClass.name}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>
        {filteredStudents.length > 0 && (
          <div className="p-2 border-t border-slate-100 bg-slate-50/50 text-[10px] text-slate-500 text-center">
            {filteredStudents.length} élève(s) · {selectedStudentIds.size} sélectionné(s)
          </div>
        )}
      </div>

      {/* Récapitulatif affectation */}
      {canAssign && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <ArrowRight className="w-4 h-4" />
            <span>
              <strong>{selectedStudentIds.size}</strong> élève(s) seront affectés vers la classe physique{' '}
              <strong className="mx-1">{physicalClasses.find(c => c.id === targetClassId)?.name}</strong>
            </span>
          </div>
          <button
            onClick={handleAssign}
            disabled={isAssigning}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition"
          >
            {isAssigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Confirmer l'affectation
          </button>
        </div>
      )}

      {/* Avertissement si pas d'élèves à affecter */}
      {!isLoading && studentsWithoutClass.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-800">
            <strong>Parfait !</strong> Tous les élèves admis/inscrits ont déjà une classe physique.
            <p className="text-xs text-emerald-700 mt-0.5">
              Vous pouvez utiliser le sous-onglet « Changement de classe » pour déplacer des élèves entre sections,
              ou « Historique » pour consulter les mouvements passés.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
