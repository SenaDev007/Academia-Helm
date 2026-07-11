'use client';

/**
 * ============================================================================
 * CHANGEMENT DE SÉRIE — 3e sous-onglet du module Affectations
 * ============================================================================
 *
 * Workflow :
 *   1. L'utilisateur sélectionne un élève (recherche + filtre par classe physique).
 *   2. Le système affiche la série officielle actuelle de l'élève (via academicClass.series).
 *   3. L'utilisateur choisit une nouvelle série (parmi AcademicSeries du niveau).
 *   4. Bouton "Changer de série" → POST /api/students/change-series
 *
 * Notes :
 *   - La liste des classes affichée est physique (CE1-A, CE1-B…) — l'utilisateur
 *     sélectionne un élève par sa section réelle.
 *   - Le changement de série met à jour academicClassId de l'inscription (vers une
 *     AcademicClass équivalente avec la nouvelle série), sans toucher à la classe physique.
 * ============================================================================
 */

import { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw, Search, Loader2, AlertCircle, CheckCircle2, Users, Building,
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

interface SeriesInfo {
  id: string;
  name: string;
  code?: string;
}

interface AcademicClassInfo {
  id: string;
  name: string;
  code?: string;
  level?: { id: string; name: string; code?: string };
  cycle?: { id: string; name: string };
  series?: SeriesInfo | null;
}

interface EnrollmentInfo {
  id: string;
  studentId: string;
  student: StudentInfo;
  classId: string | null;
  class?: { id: string; name: string; schoolLevel?: { id: string; name: string; code?: string } };
  academicClassId: string | null;
  academicClass?: AcademicClassInfo;
  status: string;
}

interface PhysicalClassInfo {
  id: string;
  name: string;
  code?: string;
  schoolLevelId: string;
  schoolLevel?: { id: string; name: string; code?: string };
}

export default function ChangementDeSerie() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [enrollments, setEnrollments] = useState<EnrollmentInfo[]>([]);
  const [physicalClasses, setPhysicalClasses] = useState<PhysicalClassInfo[]>([]);
  const [availableSeries, setAvailableSeries] = useState<SeriesInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  // Filtres + sélection
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClassId, setFilterClassId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [targetSeriesId, setTargetSeriesId] = useState<string>('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (academicYear?.id) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear?.id, schoolLevel?.id]);

  const loadData = async () => {
    if (!academicYear?.id) return;
    setIsLoading(true);
    try {
      const [enrollmentsData, classesRes] = await Promise.all([
        studentsService.getEnrollments({ academicYearId: academicYear.id }).catch(() => []),
        fetch('/api/all-classes', { cache: 'no-store' })
          .then(r => r.ok ? r.json() : [])
          .catch(() => []),
      ]);
      setEnrollments(Array.isArray(enrollmentsData) ? enrollmentsData : []);
      setPhysicalClasses(Array.isArray(classesRes) ? classesRes : []);
    } catch (e: any) {
      console.error('Failed to load:', e);
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Charger les séries disponibles selon le niveau de l'élève sélectionné
  useEffect(() => {
    if (!selectedStudentId) {
      setAvailableSeries([]);
      setTargetSeriesId('');
      return;
    }
    const selectedEnr = enrollments.find(e => e.student.id === selectedStudentId);
    if (!selectedEnr) return;

    // Charger les séries via /api/academic-series ou /api/education-series
    // Pour simplifier, on peut utiliser les AcademicClass existantes :
    // on récupère toutes les séries distinctes des AcademicClass du même niveau.
    fetch('/api/academic-classes?isActive=true', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const allClasses = Array.isArray(data) ? data : (data?.data || data?.classes || []);
        // Filtrer par niveau (levelId) de l'élève sélectionné
        const selectedLevelId = selectedEnr.academicClass?.level?.id;
        const sameLevelClasses = selectedLevelId
          ? allClasses.filter((c: any) => c.level?.id === selectedLevelId)
          : allClasses;
        // Extraire les séries distinctes
        const seriesMap = new Map<string, SeriesInfo>();
        sameLevelClasses.forEach((c: any) => {
          if (c.series && !seriesMap.has(c.series.id)) {
            seriesMap.set(c.series.id, c.series);
          }
        });
        setAvailableSeries(Array.from(seriesMap.values()).sort((a, b) =>
          (a.name || a.code || '').localeCompare(b.name || b.code || '')
        ));
        // Pré-sélectionner la série courante si elle est dans la liste
        const currentSeriesId = selectedEnr.academicClass?.series?.id;
        if (currentSeriesId) {
          setTargetSeriesId(''); // Forcer l'utilisateur à choisir explicitement la nouvelle
        }
      })
      .catch(() => setAvailableSeries([]));
  }, [selectedStudentId, enrollments]);

  // Élèves filtrés (par recherche + classe physique)
  const filteredEnrollments = useMemo(() => {
    let list = enrollments;
    // Exclure les élèves sans classe officielle (impossible de changer la série)
    list = list.filter(e => e.academicClassId);
    if (filterClassId) {
      list = list.filter(e => e.class?.id === filterClassId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e =>
        `${e.student.firstName} ${e.student.lastName}`.toLowerCase().includes(q) ||
        (e.student.matricule || '').toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) =>
      `${a.student.lastName} ${a.student.firstName}`.localeCompare(
        `${b.student.lastName} ${b.student.firstName}`
      )
    );
  }, [enrollments, filterClassId, searchQuery]);

  // Élève actuellement sélectionné
  const selectedEnrollment = useMemo(() => {
    return enrollments.find(e => e.student.id === selectedStudentId);
  }, [enrollments, selectedStudentId]);

  // Série actuelle
  const currentSeries = selectedEnrollment?.academicClass?.series;
  const currentSeriesLabel = currentSeries
    ? `${currentSeries.name}${currentSeries.code ? ` (${currentSeries.code})` : ''}`
    : '— Aucune série —';

  // ⭐ Effectuer le changement de série
  const handleChangeSeries = async () => {
    if (!academicYear?.id || !selectedStudentId || !targetSeriesId) return;
    if (targetSeriesId === currentSeries?.id) {
      toast({
        title: 'Aucun changement',
        description: 'L\'élève est déjà dans cette série.',
        variant: 'info',
      });
      return;
    }
    setIsChanging(true);
    try {
      await studentsService.changeSeries({
        studentId: selectedStudentId,
        academicYearId: academicYear.id,
        newSeriesId: targetSeriesId,
        reason: reason || undefined,
      });
      const newSeries = availableSeries.find(s => s.id === targetSeriesId);
      toast({
        title: '✅ Série changée',
        description: `${selectedEnrollment?.student.lastName} ${selectedEnrollment?.student.firstName} est maintenant en série "${newSeries?.name || newSeries?.code}".`,
        variant: 'success',
      });
      setSelectedStudentId('');
      setTargetSeriesId('');
      setReason('');
      loadData();
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e.message || 'Échec du changement de série',
        variant: 'error',
      });
    } finally {
      setIsChanging(false);
    }
  };

  const canChange = selectedStudentId && targetSeriesId && targetSeriesId !== currentSeries?.id && !isChanging;

  // Stats
  const stats = useMemo(() => ({
    totalEnrollments: enrollments.filter(e => e.academicClassId).length,
    filtered: filteredEnrollments.length,
    availableSeries: availableSeries.length,
  }), [enrollments, filteredEnrollments, availableSeries]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Élèves avec série', value: stats.totalEnrollments, icon: Users, color: 'bg-blue-50 text-blue-600' },
          { label: 'Filtrés', value: stats.filtered, icon: Search, color: 'bg-amber-50 text-amber-600' },
          { label: 'Séries disponibles', value: stats.availableSeries, icon: RefreshCw, color: 'bg-indigo-50 text-indigo-600' },
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 flex-1 min-h-0">
        {/* ─── Panneau gauche : sélection de l'élève ─── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-amber-50/50">
            <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5 mb-2">
              <Users className="w-3.5 h-3.5 text-amber-600" />
              1. Sélectionner l'élève
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-2">
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
              <select
                value={filterClassId}
                onChange={(e) => setFilterClassId(e.target.value)}
                className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">Toutes les classes physiques</option>
                {physicalClasses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.schoolLevel?.name ? `${c.schoolLevel.name} · ` : ''}{c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
              </div>
            ) : filteredEnrollments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-xs text-slate-500">Aucun élève avec série</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Les élèves doivent avoir une classe officielle (avec série) pour pouvoir changer de série.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {filteredEnrollments.map(enr => {
                  const isSelected = enr.student.id === selectedStudentId;
                  return (
                    <button
                      key={enr.student.id}
                      onClick={() => setSelectedStudentId(enr.student.id)}
                      className={cn(
                        'w-full flex items-center gap-2.5 p-2.5 text-left hover:bg-amber-50/50 transition',
                        isSelected && 'bg-amber-50'
                      )}
                    >
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
                      {/* Badges : classe physique + série actuelle */}
                      <div className="flex flex-col items-end gap-1">
                        {enr.class?.name && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {enr.class.name}
                          </span>
                        )}
                        {enr.academicClass?.series && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            Série : {enr.academicClass.series.name || enr.academicClass.series.code}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ─── Panneau droit : changement de série ─── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-indigo-50/50">
            <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
              2. Choisir la nouvelle série
            </h4>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {!selectedStudentId ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <RefreshCw className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">Sélectionnez d'abord un élève</p>
                <p className="text-xs text-slate-400 mt-1">
                  Choisissez un élève dans le panneau de gauche pour voir sa série actuelle et les séries disponibles.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Élève sélectionné */}
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-1">Élève sélectionné</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {selectedEnrollment?.student.lastName.toUpperCase()} {selectedEnrollment?.student.firstName}
                  </p>
                  <p className="text-[10px] font-mono text-slate-400">
                    {selectedEnrollment?.student.matricule || selectedEnrollment?.student.studentCode || '—'}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">Classe physique :</span>{' '}
                      <strong className="text-slate-700">{selectedEnrollment?.class?.name || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Classe officielle :</span>{' '}
                      <strong className="text-slate-700">{selectedEnrollment?.academicClass?.name || '—'}</strong>
                    </div>
                  </div>
                </div>

                {/* Série actuelle */}
                <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                  <p className="text-xs font-bold text-purple-700 uppercase mb-1">Série actuelle</p>
                  <p className="text-sm font-semibold text-purple-900">{currentSeriesLabel}</p>
                </div>

                {/* Nouvelle série */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Nouvelle série
                  </label>
                  {availableSeries.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                      <AlertCircle className="w-4 h-4 inline mr-1" />
                      Aucune série disponible pour ce niveau. Créez d'abord les classes officielles avec séries dans le module Pédagogie.
                    </div>
                  ) : (
                    <select
                      value={targetSeriesId}
                      onChange={(e) => setTargetSeriesId(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">— Sélectionner —</option>
                      {availableSeries.map(s => (
                        <option key={s.id} value={s.id} disabled={s.id === currentSeries?.id}>
                          {s.name}{s.code ? ` (${s.code})` : ''}{s.id === currentSeries?.id ? ' (actuelle)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Motif (optionnel) */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Motif (optionnel)
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ex: Réorientation, choix de l'élève…"
                    rows={2}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                {/* Bouton changer */}
                <button
                  onClick={handleChangeSeries}
                  disabled={!canChange}
                  className={cn(
                    'w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition',
                    canChange
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  )}
                >
                  {isChanging ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {isChanging ? 'Changement...' : 'Changer de série'}
                </button>

                {/* Avertissement */}
                {selectedStudentId && availableSeries.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    <strong>Note :</strong> Le changement de série met à jour la classe officielle de l'élève (AcademicClass)
                    sans modifier sa classe physique (section). L'élève restera dans la même section (ex: 6e-A) mais avec
                    une nouvelle série officielle (ex: D au lieu de A).
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
