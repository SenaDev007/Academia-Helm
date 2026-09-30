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
import { useRouter } from 'next/navigation';
import {
  TrendingUp, Loader2, Users, Award, AlertCircle,
  CheckCircle2, XCircle, Sparkles, RotateCcw, ArrowUp, Download,
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
  const router = useRouter();
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
  const [generatingPdf, setGeneratingPdf] = useState(false);
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
  //    ⭐ 2026-09-30 — OPTIMISATION : on utilise le nouvel endpoint backend
  //    GET /api/exams/promotion/class/:classId qui calcule les moyennes
  //    annuelles côté backend (3 requêtes Prisma au total) au lieu de
  //    getEvaluations + getGradingSheetsBatch (N requêtes HTTP côté frontend).
  //    Avant : 30 élèves × 24 évaluations = 24 fetchs HTTP + parsing → lent
  //    (5-10s) + élèves manquants (roster fetch + grades fetch séparés).
  //    Désormais : 1 seul fetch HTTP → ~1s + tous les élèves figurent.
  //    ⭐ Le backend récupère TOUS les élèves inscrits (status ACTIVE) dans
  //    la classe → passants + redoublants = total de la classe (exigence
  //    promoteur). Les élèves sans note ont avg=null → REDOUBLE.
  const loadStudents = useCallback(async () => {
    if (!selectedClassId || !academicYear?.id) return;
    setLoading(true);
    try {
      // ⭐ 2026-09-30 — FIX : utiliser apiClient (axios avec baseURL) au lieu de
      //    fetch (qui allait vers Next.js au lieu du backend → pas de route BFF
      //    → 404 → "aucune donnée disponible").
      const response = await apiClient.get(`/exams/promotion/class/${encodeURIComponent(selectedClassId)}`, {
        params: { academicYearId: academicYear.id },
      });
      const data = response.data;
      const list: StudentPromotion[] = Array.isArray(data) ? data : [];
      setStudents(list);
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
  //    ⭐ 2026-09-30 — Le rachat ne suffit pas de cliquer pour que l'élève
  //    passe en classe supérieure. Il faut rediriger vers les notes de
  //    l'élève pour qu'on puisse voir où appliquer des corrections de
  //    rachat pour que l'élève ait la moyenne requise.
  //    On redirige vers l'onglet Bulletins (où l'on peut voir les notes
  //    par élève et par matière) avec les paramètres de la classe +
  //    l'élève sélectionné.
  const applyRachat = (studentId: string, studentName?: string) => {
    // Rediriger vers les notes de l'élève (onglet Bulletins)
    // On passe les paramètres : classId + academicYearId + studentId
    // pour que l'onglet Bulletins affiche directement l'élève concerné.
    const url = `/app/exams/bulletins?classId=${encodeURIComponent(selectedClassId)}&academicYearId=${encodeURIComponent(academicYear?.id || '')}&studentId=${encodeURIComponent(studentId)}&rachat=1`;
    router.push(url);
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

  // ── Apply promotion (global) — calls backend API ──
  const handleApplyPromotion = async () => {
    setApplying(true);
    try {
      const payload = {
        academicYearId: academicYear?.id,
        students: students.map(s => ({
          studentId: s.id,
          matricule: s.matricule,
          name: s.name,
          generalAverage: s.generalAverage,
          decision: s.decision,
          rachatApplied: s.rachatApplied,
          currentClassId: selectedClassId,
        })),
      };

      // ⭐ 2026-09-30 — FIX : utiliser apiClient (axios avec baseURL).
      const res = await apiClient.post('/exams/promotion/apply', payload);
      const result = res.data;
      alert(
        `✅ Promotion appliquée !\n\n` +
        `Année suivante : ${result.nextYearLabel}\n` +
        `Élèves promus : ${result.promoted}\n` +
        `Redoublants réinscrits : ${result.repeated}\n` +
        `Comptes financiers créés : ${result.accountsCreated}\n\n` +
        result.steps?.join('\n') || ''
      );
      setApplyModalOpen(false);
    } catch (err: any) {
      alert('Erreur lors de l\'application: ' + err.message);
    } finally {
      setApplying(false);
    }
  };

  const selectedClassName = classes.find(c => c.id === selectedClassId)?.name || '';

  // ── Generate PDF (calls backend /institutional-exams/pv-stats-promotion/promotion) ──
  //    A4 paysage + en-tête officiel + tableau passants + tableau redoublants + pied de page.
  const handleGeneratePromotionPdf = async () => {
    if (!selectedClassId || students.length === 0) {
      alert('Veuillez sélectionner une classe et avoir des données à exporter.');
      return;
    }
    setGeneratingPdf(true);
    try {
      const payload = {
        academicYearName: academicYear?.label || '',
        className: selectedClassName,
        passants: passants.map(s => ({
          id: s.id,
          matricule: s.matricule,
          name: s.name,
          gender: s.gender,
          generalAverage: s.generalAverage,
          decision: s.decision,
          rachatApplied: s.rachatApplied,
        })),
        redoublants: redoublants.map(s => ({
          id: s.id,
          matricule: s.matricule,
          name: s.name,
          gender: s.gender,
          generalAverage: s.generalAverage,
          decision: s.decision,
          rachatApplied: s.rachatApplied,
        })),
        rachatCandidates: rachatCandidates.map(s => ({
          id: s.id,
          matricule: s.matricule,
          name: s.name,
          gender: s.gender,
          generalAverage: s.generalAverage,
          decision: s.decision,
        })),
        scopeLang: scopeLang || 'FR',
      };

      // ⭐ 2026-09-30 — FIX : utiliser apiClient (axios avec baseURL) au lieu de
      //    fetch (qui allait vers Next.js au lieu du backend → pas de route BFF
      //    → 404 → "Échec de chargement du document PDF").
      const response = await apiClient.post('/institutional-exams/pv-stats-promotion/promotion', payload, {
        responseType: 'blob',
        timeout: 120000,
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeClass = selectedClassName.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      link.download = `promotion_${safeClass}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Erreur lors de la génération du PDF: ' + err.message);
    } finally {
      setGeneratingPdf(false);
    }
  };

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
                <p className="text-xs text-amber-600 font-medium">Rachat (9-10)</p>
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
                          {st.generalAverage !== null ? st.generalAverage.toFixed(2) : <span className="text-slate-400 italic font-normal">Pas de notes</span>}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold',
                            st.generalAverage === null ? 'bg-slate-200 text-slate-700' : 'bg-red-100 text-red-700')}>
                            {st.generalAverage === null ? 'Pas de notes' : 'Redouble'}
                          </span>
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
                            onClick={() => applyRachat(st.id, st.name)}
                            className="px-2 py-1 text-[10px] font-bold bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors"
                            title={`Voir les notes de ${st.name} pour appliquer un rachat`}
                          >
                            <Sparkles className="w-3 h-3 inline mr-1" /> Voir les notes
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

            {/* Boutons globaux : générer PDF + Appliquer la promotion */}
            <div className="flex justify-between items-center bg-blue-50 rounded-lg border border-blue-200 p-4">
              <div>
                <p className="text-sm font-bold text-blue-900">Actions promotion — {selectedClassName}</p>
                <p className="text-xs text-blue-600 mt-1">
                  Génère le PDF (passants + redoublants par classe) ou applique la promotion (crée l'année suivante + trimestres + classes + réinscrit les élèves + crée les comptes financiers).
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleGeneratePromotionPdf}
                  disabled={generatingPdf}
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  {generatingPdf ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {generatingPdf ? 'Génération…' : 'Générer PDF'}
                </Button>
                <Button
                  onClick={() => setApplyModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <TrendingUp className="w-4 h-4 mr-2" /> Appliquer la promotion
                </Button>
              </div>
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
