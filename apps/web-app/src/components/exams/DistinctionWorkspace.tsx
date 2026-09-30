'use client';

/**
 * ============================================================================
 * DISTINCTION / TABLEAU D'HONNEUR — Module Examen
 * ============================================================================
 *
 * Onglet permettant de générer les tableaux d'honneur et certificats de
 * distinction pour une classe, à partir des moyennes des élèves.
 *
 * Adapté par niveau scolaire :
 *   - Maternelle : Étoile d'Or / Argent / Bronze / Petit Explorateur
 *   - Primaire : Félicitations / Encouragements / Honneur / Courage
 *   - Secondaire : Félicitations / Encouragements / Honneur + Prix spéciaux
 *
 * Le système récupère les moyennes des élèves pour la période sélectionnée
 * et applique les règles de distinction automatiquement.
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Award, Loader2, Download, Users, Trophy, Medal,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import apiClient from '@/lib/api/client';
import { EXAMS_SUB_MODULES } from '@/app/app/exams/sub-modules';
import { useExamSubModules, useExamScope } from '@/app/app/exams/layout';
import { filterClassesForLevel } from '@/app/app/exams/level-isolation';
import { cn } from '@/lib/utils';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const PEDAGOGICAL_ORDER = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6E', '5E', '4E', '3E', '2NDE', '1ERE', 'TERM'];
const pedagogicalSortIndex = (name: string): number => {
  const upper = (name || '').toUpperCase().trim();
  for (let i = 0; i < PEDAGOGICAL_ORDER.length; i++) {
    if (upper.startsWith(PEDAGOGICAL_ORDER[i])) return i;
  }
  return PEDAGOGICAL_ORDER.length;
};

interface DistinctionStudent {
  id: string;
  name: string;
  matricule: string;
  average: number | null;
  rank: number | null;
  distinction: string | null;
  distinctionLabel: string | null;
}

export default function DistinctionWorkspace() {
  const { academicYear } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const { language: scopeLang, levelCode: scopeLevel } = useExamScope();
  const isMaternelle = scopeLevel === 'MATERNELLE';
  const isSecondaire = scopeLevel === 'SECONDAIRE';

  const activeLevel = useMemo(() => {
    if (!scopeLevel) return null;
    return (availableLevels || []).find((l: any) => (l.code || '').toUpperCase() === scopeLevel && l.id !== 'ALL');
  }, [availableLevels, scopeLevel]);
  const schoolLevelUuid = activeLevel?.schoolLevelId || activeLevel?.id;

  const [classes, setClasses] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [students, setStudents] = useState<DistinctionStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const subModules = useExamSubModules(EXAMS_SUB_MODULES);

  // Load classes
  useEffect(() => {
    if (!academicYear?.id || !schoolLevelUuid) return;
    (async () => {
      try {
        const res = await fetch(`/api/all-classes?academicYearId=${academicYear.id}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const all = Array.isArray(data) ? data : [];
          const filtered = filterClassesForLevel(all, schoolLevelUuid, scopeLang);
          filtered.sort((a: any, b: any) => {
            const idxA = pedagogicalSortIndex(a.name);
            const idxB = pedagogicalSortIndex(b.name);
            return idxA !== idxB ? idxA - idxB : (a.name || '').localeCompare(b.name || '', 'fr');
          });
          setClasses(filtered);
          if (filtered.length > 0 && !selectedClassId) setSelectedClassId(filtered[0].id);
        }
      } catch { setClasses([]); }
    })();
  }, [academicYear?.id, schoolLevelUuid, scopeLang]);

  // Load periods
  useEffect(() => {
    if (!academicYear?.id) return;
    (async () => {
      try {
        const res = await fetch(`/api/settings/academic-years/${academicYear.id}/periods`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data?.items || []);
          setPeriods(list);
          if (list.length > 0) setSelectedPeriodId(list[0].id);
        }
      } catch { setPeriods([]); }
    })();
  }, [academicYear?.id]);

  // Load students with averages
  const loadData = useCallback(async () => {
    if (!selectedClassId || !selectedPeriodId || !academicYear?.id) return;
    setLoading(true);
    try {
      // Use the promotion endpoint to get averages (it already computes them)
      const response = await apiClient.get(`/exams/promotion/class/${encodeURIComponent(selectedClassId)}`, {
        params: { academicYearId: academicYear.id },
      });
      const data = response.data;
      const list: DistinctionStudent[] = Array.isArray(data) ? data.map((s: any) => {
        // Map the distinction code to a label
        let distinctionLabel: string | null = null;
        if (s.decision === 'PASSE' && s.generalAverage !== null) {
          const pct = (s.generalAverage / (isMaternelle ? 3 : 20)) * 100;
          if (isMaternelle) {
            distinctionLabel = pct >= 90 ? "Étoile d'Or" : pct >= 75 ? "Étoile d'Argent" : pct >= 60 ? 'Étoile de Bronze' : 'Petit Explorateur';
          } else if (isSecondaire) {
            distinctionLabel = pct >= 80 ? 'Félicitations' : pct >= 70 ? 'Encouragements' : pct >= 60 ? 'Honneur' : null;
          } else {
            distinctionLabel = pct >= 80 ? 'Félicitations' : pct >= 70 ? 'Encouragements' : pct >= 60 ? 'Honneur' : pct >= 50 ? 'Courage' : null;
          }
        }
        return {
          id: s.id,
          name: s.name,
          matricule: s.matricule || '',
          average: s.generalAverage,
          rank: null, // will be computed below
          distinction: distinctionLabel ? 'AWARDED' : null,
          distinctionLabel,
        };
      }) : [];

      // Compute ranks
      const sorted = [...list].sort((a, b) => (b.average ?? -1) - (a.average ?? -1));
      sorted.forEach((s, i) => { s.rank = i + 1; });

      setStudents(sorted);
    } catch (err) {
      console.error('Distinction load error:', err);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, selectedPeriodId, academicYear?.id, isMaternelle, isSecondaire]);

  useEffect(() => { loadData(); }, [loadData]);

  const awardedStudents = useMemo(() => students.filter(s => s.distinctionLabel !== null), [students]);
  const selectedClassName = classes.find(c => c.id === selectedClassId)?.name || '';
  const selectedPeriodName = periods.find(p => p.id === selectedPeriodId)?.name || '';

  const handleGenerateBoard = async () => {
    if (!selectedClassId || !selectedPeriodId) return;
    setGenerating(true);
    try {
      const response = await apiClient.post('/institutional-exams/distinctions/generate-class', {
        classId: selectedClassId,
        periodId: selectedPeriodId,
        academicYearId: academicYear?.id,
        level: scopeLevel || 'PRIMAIRE',
      }, { responseType: 'blob', timeout: 120000 });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeClass = selectedClassName.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      link.download = `tableau_honneur_${safeClass}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Erreur lors de la génération du tableau: ' + (err.response?.data?.message || err.message));
    } finally {
      setGenerating(false);
    }
  };

  const levelLabel = isMaternelle ? 'Maternelle' : isSecondaire ? 'Secondaire' : 'Primaire';

  return (
    <ModuleContainer
      header={{ title: 'Distinction — Tableau d\'honneur', description: `Distinctions et certificats — Niveau ${levelLabel}`, icon: 'award' }}
      subModules={{ modules: subModules, activeModuleId: 'distinction' }}
      content={{
        layout: 'full',
        children: (
      <div className="space-y-4">
        {/* Header + selectors */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Classe</label>
              <select
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg min-w-[200px]"
              >
                <option value="">— Sélectionner une classe —</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Période</label>
              <select
                value={selectedPeriodId}
                onChange={e => setSelectedPeriodId(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg min-w-[200px]"
              >
                <option value="">— Sélectionner —</option>
                {periods.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1" />
            <Button
              onClick={handleGenerateBoard}
              disabled={generating || awardedStudents.length === 0}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {generating ? 'Génération…' : 'Générer le tableau d\'honneur'}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-600" /></div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center text-slate-500">
            Aucune donnée disponible. Les évaluations doivent être validées pour calculer les moyennes.
          </div>
        ) : (
          <>
            {/* Stats summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <Trophy className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-amber-700">{awardedStudents.length}</p>
                <p className="text-xs text-amber-600 font-medium">Distinctions</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                <Users className="w-5 h-5 text-slate-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-slate-700">{students.length}</p>
                <p className="text-xs text-slate-600 font-medium">Élèves</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <Medal className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-blue-700">{students.filter(s => s.average !== null).length}</p>
                <p className="text-xs text-blue-600 font-medium">Avec notes</p>
              </div>
            </div>

            {/* Tableau des élèves avec distinctions */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-4 py-2 bg-amber-50 border-b border-slate-200">
                <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                  <Award className="w-4 h-4" /> Tableau d'honneur — {selectedClassName} — {selectedPeriodName}
                </h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100">
                    <TableHead className="text-xs">Rang</TableHead>
                    <TableHead className="text-xs">Matricule</TableHead>
                    <TableHead className="text-xs">Nom</TableHead>
                    <TableHead className="text-xs text-center">Moyenne</TableHead>
                    <TableHead className="text-xs text-center">Distinction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((st, idx) => (
                    <TableRow key={st.id} className={cn(
                      idx % 2 === 1 && 'bg-slate-50/60',
                      st.distinctionLabel && 'bg-amber-50/50',
                    )}>
                      <TableCell className="text-xs font-bold">
                        {st.rank === 1 ? <Trophy className="w-4 h-4 text-amber-500" /> :
                         st.rank === 2 ? <Medal className="w-4 h-4 text-slate-400" /> :
                         st.rank === 3 ? <Award className="w-4 h-4 text-amber-700" /> :
                         st.rank || '—'}
                      </TableCell>
                      <TableCell className="text-xs">{st.matricule || '—'}</TableCell>
                      <TableCell className="text-xs font-medium">{st.name}</TableCell>
                      <TableCell className={cn('text-xs text-center font-bold', st.average !== null && st.average >= (isMaternelle ? 2 : 10) ? 'text-emerald-700' : 'text-red-600')}>
                        {st.average !== null ? st.average.toFixed(2) : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        {st.distinctionLabel ? (
                          <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold',
                            st.distinctionLabel.includes('Or') ? 'bg-yellow-100 text-yellow-800' :
                            st.distinctionLabel.includes('Argent') ? 'bg-gray-100 text-gray-700' :
                            st.distinctionLabel.includes('Bronze') ? 'bg-orange-100 text-orange-700' :
                            st.distinctionLabel.includes('Félicitations') ? 'bg-emerald-100 text-emerald-700' :
                            st.distinctionLabel.includes('Encouragements') ? 'bg-blue-100 text-blue-700' :
                            st.distinctionLabel.includes('Honneur') ? 'bg-purple-100 text-purple-700' :
                            st.distinctionLabel.includes('Courage') ? 'bg-orange-100 text-orange-700' :
                            'bg-teal-100 text-teal-700')}>
                            {st.distinctionLabel}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
        ),
      }}
    />
  );
}
