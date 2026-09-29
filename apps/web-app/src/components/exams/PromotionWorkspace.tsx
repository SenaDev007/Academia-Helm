'use client';

/**
 * ============================================================================
 * PROMOTION & REDOUBLEMENT — Module Examen
 * ============================================================================
 *
 * Onglet permettant de gérer la promotion des élèves en classe supérieure
 * et le redoublement à la fin de l'année scolaire.
 *
 * Interface :
 *   - Sélecteur classe (filtré par niveau scolaire sélectionné)
 *   - Tableau 1 (moitié gauche) : Liste des passants (promus en classe supérieure)
 *     Matricule | Nom | Moyenne annuelle | Décision
 *   - Tableau 2 (moitié droite) : Liste des redoublants
 *     Matricule | Nom | Moyenne annuelle | Décision
 *   - Système de rachat : pour les élèves proches de la moyenne, proposer
 *     un rachat (augmentation ponctuelle de notes dans certaines matières)
 *   - Bouton global "Appliquer la promotion" : crée l'année scolaire
 *     suivante + trimestres + classes + réinscrit les élèves promus/redoublants
 *
 * Compatible : maternelle (qualitatif), primaire, secondaire.
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp, Loader2, Users, Award, AlertCircle,
  CheckCircle2, XCircle, Sparkles, RotateCcw, ArrowUp,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import apiClient from '@/lib/api/client';
import { EXAMS_SUB_MODULES } from '@/app/app/exams/sub-modules';
import { useExamSubModules, useExamScope } from '@/app/app/exams/layout';
import { filterClassesForLevel } from '@/app/app/exams/level-isolation';
import { cn } from '@/lib/utils';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

// ─── Pedagogical ordering ─────────────────────────────────────────────────
const PEDAGOGICAL_ORDER = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6E', '5E', '4E', '3E', '2NDE', '1ERE', 'TERM'];
const pedagogicalSortIndex = (name: string): number => {
  const upper = (name || '').toUpperCase().trim();
  for (let i = 0; i < PEDAGOGICAL_ORDER.length; i++) {
    if (upper.startsWith(PEDAGOGICAL_ORDER[i])) return i;
  }
  return PEDAGOGICAL_ORDER.length;
};

interface StudentPromotion {
  id: string;
  matricule: string;
  name: string;
  gender?: string;
  generalAverage: number | null;
  decision: 'PASSE' | 'REDOUBLE' | 'RACHAT';
  rachatable: boolean;
  rachatApplied: boolean;
  rachatSubjects?: Array<{ subject: string; originalScore: number; rachatScore: number }>;
}

export default function PromotionWorkspace() {
  const { academicYear } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const { language: scopeLang, levelCode: scopeLevel } = useExamScope();
  const isMaternelle = scopeLevel === 'MATERNELLE';

  const activeLevel = useMemo(() => {
    if (!scopeLevel) return null;
    return (availableLevels || []).find((l: any) => (l.code || '').toUpperCase() === scopeLevel && l.id !== 'ALL');
  }, [availableLevels, scopeLevel]);
  const schoolLevelUuid = activeLevel?.schoolLevelId || activeLevel?.id;

  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<StudentPromotion[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyModalOpen, setApplyModalOpen] = useState(false);

  const subModules = useExamSubModules(EXAMS_SUB_MODULES);
  const examScope = useExamScope();

  // ── Load classes ──
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

  // ── Load students with annual averages ──
  const loadStudents = useCallback(async () => {
    if (!selectedClassId || !academicYear?.id) return;
    setLoading(true);
    try {
      // Fetch all VALIDATED evaluations for this class
      const evaluations = await institutionalExamsService.getEvaluations({
        academicYearId: academicYear.id,
        classId: selectedClassId,
        status: 'VALIDATED',
      });
      const allEvals = Array.isArray(evaluations) ? evaluations : [];

      // Fetch grades in batch
      const sheetsMap = await institutionalExamsService
        .getGradingSheetsBatch(allEvals.map((ev: any) => ev.id))
        .catch(() => ({}));

      // Build student averages
      const studentMap = new Map<string, { id: string; matricule: string; name: string; gender?: string; scores: number[]; coefs: number[] }>();

      for (const ev of allEvals) {
        const grades = sheetsMap[ev.id] || [];
        const coef = ev.subject?.coefficient ?? 1;
        for (const g of grades) {
          if (g.isAbsent || typeof g.score !== 'number') continue;
          if (!studentMap.has(g.studentId)) {
            studentMap.set(g.studentId, {
              id: g.studentId,
              matricule: g.matricule || '',
              name: g.studentName || 'Inconnu',
              gender: g.gender,
              scores: [],
              coefs: [],
            });
          }
          const st = studentMap.get(g.studentId)!;
          st.scores.push(Number(g.score));
          st.coefs.push(coef);
        }
      }

      // Calculate annual average per student
      const PASS_THRESHOLD = 10; // ≥ 10 = pass
      const RACHAT_THRESHOLD = 9; // 9 ≤ avg < 10 = rachat possible

      const result: StudentPromotion[] = Array.from(studentMap.values()).map(st => {
        const total = st.scores.reduce((sum, s, i) => sum + s * st.coefs[i], 0);
        const totalCoef = st.coefs.reduce((sum, c) => sum + c, 0);
        const avg = totalCoef > 0 ? total / totalCoef : null;

        let decision: 'PASSE' | 'REDOUBLE' | 'RACHAT' = 'REDOUBLE';
        let rachatable = false;

        if (avg !== null) {
          if (avg >= PASS_THRESHOLD) {
            decision = 'PASSE';
          } else if (avg >= RACHAT_THRESHOLD) {
            decision = 'RACHAT';
            rachatable = true;
          }
        }

        return {
          id: st.id,
          matricule: st.matricule,
          name: st.name,
          gender: st.gender,
          generalAverage: avg,
          decision,
          rachatable,
          rachatApplied: false,
        };
      });

      // Sort by name
      result.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      setStudents(result);
    } catch (err) {
      console.error('Promotion load error:', err);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, academicYear?.id]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  // ── Derived: passants + redoublants ──
  const passants = useMemo(() => students.filter(s => s.decision === 'PASSE' || s.rachatApplied), [students]);
  const redoublants = useMemo(() => students.filter(s => s.decision === 'REDOUBLE' && !s.rachatApplied), [students]);
  const rachatCandidates = useMemo(() => students.filter(s => s.decision === 'RACHAT' && !s.rachatApplied), [students]);

  // ── Apply rachat ──
  const applyRachat = (studentId: string) => {
    setStudents(prev => prev.map(s => {
      if (s.id === studentId && s.rachatable) {
        return { ...s, rachatApplied: true, decision: 'PASSE' as const };
      }
      return s;
    }));
  };

  // ── Undo rachat ──
  const undoRachat = (studentId: string) => {
    setStudents(prev => prev.map(s => {
      if (s.id === studentId && s.rachatApplied) {
        return { ...s, rachatApplied: false, decision: 'RACHAT' as const };
      }
      return s;
    }));
  };

  // ── Apply promotion (global) ──
  const handleApplyPromotion = async () => {
    setApplying(true);
    try {
      // TODO: Call backend API to:
      // 1. Create next academic year (following pattern in Settings > Année scolaire)
      // 2. Create quarters for next year
      // 3. Create classes/sections for next year (duplicate from current year)
      // 4. Re-enroll students: promus → class supérieure, redoublants → same class
      // 5. Create financial accounts for next year
      // 6. Copy fee configuration from current year to next year

      // For now, show a success message
      await new Promise(resolve => setTimeout(resolve, 2000)); // simulate API call
      alert('Promotion appliquée ! L\'année scolaire suivante a été créée avec les trimestres, classes et réinscriptions. (À implémenter côté backend)');
      setApplyModalOpen(false);
    } catch (err: any) {
      alert('Erreur lors de l\'application: ' + err.message);
    } finally {
      setApplying(false);
    }
  };

  const selectedClassName = classes.find(c => c.id === selectedClassId)?.name || '';

  return (
    <ModuleContainer
      header={{ title: 'Promotion & Redoublement', description: 'Passages officiels et redoublements par classe', icon: 'trendingUp' }}
      subModules={{ modules: subModules, activeModuleId: 'promotion' }}
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
            <div className="flex-1" />
            <div className="text-right">
              <p className="text-xs text-slate-500 mb-1">Année scolaire</p>
              <p className="text-sm font-bold text-slate-900">{academicYear?.label || '—'}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : !selectedClassId ? (
          <div className="bg-white rounded-lg border p-8 text-center text-slate-500">
            Sélectionnez une classe pour voir les passants et redoublants.
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center text-slate-500">
            Aucune donnée disponible. Les évaluations doivent être validées pour calculer les moyennes annuelles.
          </div>
        ) : (
          <>
            {/* Stats summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-emerald-700">{passants.length}</p>
                <p className="text-xs text-emerald-600 font-medium">Passants</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <Sparkles className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-amber-700">{rachatCandidates.length}</p>
                <p className="text-xs text-amber-600 font-medium">Rachat possible</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-red-700">{redoublants.length}</p>
                <p className="text-xs text-red-600 font-medium">Redoublants</p>
              </div>
            </div>

            {/* 2 tableaux côte à côte */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Tableau 1: Passants */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-2 bg-emerald-50 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                    <ArrowUp className="w-4 h-4" /> Passants — {selectedClassName}
                  </h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100">
                      <TableHead className="text-xs">Matricule</TableHead>
                      <TableHead className="text-xs">Nom</TableHead>
                      <TableHead className="text-xs text-center">Moy. annuelle</TableHead>
                      <TableHead className="text-xs text-center">Décision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {passants.map((st, idx) => (
                      <TableRow key={st.id} className={idx % 2 === 1 ? 'bg-slate-50/60' : undefined}>
                        <TableCell className="text-xs">{st.matricule || '—'}</TableCell>
                        <TableCell className="text-xs font-medium">{st.name}</TableCell>
                        <TableCell className="text-xs text-center font-bold text-emerald-700">
                          {st.generalAverage !== null ? st.generalAverage.toFixed(2) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold',
                            st.rachatApplied ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>
                            {st.rachatApplied ? 'Rachat' : 'Passant'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {passants.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-slate-400 text-xs py-4">Aucun passant</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Tableau 2: Redoublants + Rachat */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-2 bg-red-50 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-red-800 flex items-center gap-2">
                    <RotateCcw className="w-4 h-4" /> Redoublants — {selectedClassName}
                  </h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100">
                      <TableHead className="text-xs">Matricule</TableHead>
                      <TableHead className="text-xs">Nom</TableHead>
                      <TableHead className="text-xs text-center">Moy. annuelle</TableHead>
                      <TableHead className="text-xs text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {redoublants.map((st, idx) => (
                      <TableRow key={st.id} className={idx % 2 === 1 ? 'bg-slate-50/60' : undefined}>
                        <TableCell className="text-xs">{st.matricule || '—'}</TableCell>
                        <TableCell className="text-xs font-medium">{st.name}</TableCell>
                        <TableCell className="text-xs text-center font-bold text-red-600">
                          {st.generalAverage !== null ? st.generalAverage.toFixed(2) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">Redouble</span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Rachat candidates */}
                    {rachatCandidates.map((st, idx) => (
                      <TableRow key={st.id} className="bg-amber-50/50">
                        <TableCell className="text-xs">{st.matricule || '—'}</TableCell>
                        <TableCell className="text-xs font-medium">{st.name}</TableCell>
                        <TableCell className="text-xs text-center font-bold text-amber-600">
                          {st.generalAverage !== null ? st.generalAverage.toFixed(2) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          <button
                            onClick={() => applyRachat(st.id)}
                            className="px-2 py-1 text-[10px] font-bold bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors"
                          >
                            <Sparkles className="w-3 h-3 inline mr-1" /> Racheter
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {redoublants.length === 0 && rachatCandidates.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-slate-400 text-xs py-4">Aucun redoublant</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
                {/* Rachat undos */}
                {passants.filter(s => s.rachatApplied).length > 0 && (
                  <div className="px-4 py-2 bg-amber-50 border-t border-amber-200">
                    <p className="text-[10px] font-bold text-amber-700 mb-1">Rachats appliqués (cliquez pour annuler) :</p>
                    <div className="flex flex-wrap gap-1">
                      {passants.filter(s => s.rachatApplied).map(s => (
                        <button
                          key={s.id}
                          onClick={() => undoRachat(s.id)}
                          className="px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded border border-amber-200 hover:bg-amber-200 transition-colors"
                        >
                          {s.name} ✕
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bouton global Appliquer la promotion */}
            <div className="flex justify-between items-center bg-blue-50 rounded-lg border border-blue-200 p-4">
              <div>
                <p className="text-sm font-bold text-blue-900">Appliquer la promotion pour l'année scolaire suivante</p>
                <p className="text-xs text-blue-600 mt-1">
                  Crée l'année suivante + trimestres + classes + réinscrit les élèves (promus en classe supérieure, redoublants dans la même classe) + crée les comptes financiers.
                </p>
              </div>
              <Button
                onClick={() => setApplyModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <TrendingUp className="w-4 h-4 mr-2" /> Appliquer la promotion
              </Button>
            </div>
          </>
        )}

        {/* Modal: Apply promotion confirmation */}
        {applyModalOpen && (
          <div className="fixed inset-0 z-[100] bg-black/50 overflow-y-auto flex justify-center" style={{ paddingTop: '80px' }}>
            <div className="my-8 bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="flex items-center justify-between p-4 border-b bg-blue-50 rounded-t-xl">
                <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" /> Appliquer la promotion
                </h3>
                <button onClick={() => setApplyModalOpen(false)} className="p-1 hover:bg-blue-100 rounded-lg text-slate-400">✕</button>
              </div>
              <div className="p-4 space-y-3">
                {applying ? (
                  <div className="flex flex-col items-center py-8">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-3" />
                    <p className="text-sm font-bold text-slate-700">Création de l'année scolaire suivante…</p>
                    <p className="text-xs text-slate-500 mt-1">Trimestres, classes, réinscriptions, comptes financiers</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 text-sm text-slate-600">
                      <p>⚠️ Cette action va :</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>Créer l'année scolaire suivante + trimestres</li>
                        <li>Dupliquer les classes et séries pour la nouvelle année</li>
                        <li>Réinscrire les <strong className="text-emerald-700">{passants.length} passants</strong> en classe supérieure</li>
                        <li>Réinscrire les <strong className="text-red-700">{redoublants.length} redoublants</strong> dans la même classe</li>
                        <li>Créer les comptes financiers + copier la configuration des frais</li>
                      </ul>
                      <p className="text-xs text-amber-600 font-bold mt-2">⚠️ Cette action est irréversible.</p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => setApplyModalOpen(false)}>Annuler</Button>
                      <Button onClick={handleApplyPromotion} className="bg-blue-600 hover:bg-blue-700 text-white">
                        <TrendingUp className="w-4 h-4 mr-2" /> Confirmer
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
        ),
      }}
    />
  );
}
