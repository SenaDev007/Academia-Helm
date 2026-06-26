'use client';

/**
 * ============================================================================
 * TimetableEnginePage — Interface du Smart Timetable Engine
 * ============================================================================
 *
 * 4 étapes :
 *   1. Configuration (jours, créneaux horaires, pauses)
 *   2. Disponibilités enseignants (matrice)
 *   3. Génération (lancer le moteur, voir les solutions)
 *   4. Validation (accepter une solution, voir la grille)
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Settings, Calendar, Zap, CheckCircle, Loader2, Plus, Trash2,
  Clock, AlertCircle, Star, ArrowRight, Eye,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { toast } from '@/components/ui/toast';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';

const DAYS = [
  { value: 1, label: 'Lundi' }, { value: 2, label: 'Mardi' }, { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' }, { value: 5, label: 'Vendredi' }, { value: 6, label: 'Samedi' }, { value: 7, label: 'Dimanche' },
];

export default function TimetableEnginePage() {
  const { academicYear } = useModuleContext();
  const { currentLevel } = useSchoolLevel();
  const [step, setStep] = useState<'config' | 'availability' | 'generate' | 'validate'>('config');
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [solutions, setSolutions] = useState<any[]>([]);
  const [selectedSolution, setSelectedSolution] = useState<any>(null);

  const tid = null; // résolu côté backend via JWT
  const schoolLevelId = currentLevel?.id;
  const academicYearId = academicYear?.id;

  const loadConfig = useCallback(async () => {
    if (!schoolLevelId || !academicYearId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/timetable-engine/config?schoolLevelId=${schoolLevelId}&academicYearId=${academicYearId}`, {
        headers: { ...getClientAuthorizationHeader() },
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [schoolLevelId, academicYearId]);

  const loadSolutions = useCallback(async () => {
    if (!schoolLevelId || !academicYearId) return;
    try {
      const res = await fetch(`/api/timetable-engine/solutions?schoolLevelId=${schoolLevelId}&academicYearId=${academicYearId}`, {
        headers: { ...getClientAuthorizationHeader() },
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setSolutions(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    }
  }, [schoolLevelId, academicYearId]);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { if (step === 'validate' || step === 'generate') loadSolutions(); }, [step, loadSolutions]);

  const handleGenerate = async () => {
    if (!schoolLevelId || !academicYearId) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/timetable-engine/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getClientAuthorizationHeader() },
        credentials: 'include',
        body: JSON.stringify({ academicYearId, schoolLevelId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erreur de génération');
      }
      const solution = await res.json();
      toast({ variant: 'success', title: 'Emploi du temps généré', description: `Score: ${solution.score}% · ${solution.conflictCount} conflit(s)` });
      await loadSolutions();
      setStep('validate');
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err?.message });
    } finally {
      setGenerating(false);
    }
  };

  const handleAccept = async (solutionId: string) => {
    try {
      const res = await fetch(`/api/timetable-engine/solutions/${solutionId}/accept`, {
        method: 'POST',
        headers: { ...getClientAuthorizationHeader() },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erreur');
      toast({ variant: 'success', title: 'Solution acceptée et publiée' });
      await loadSolutions();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err?.message });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /><span className="ml-2 text-slate-600">Chargement…</span></div>;
  }

  if (!schoolLevelId || !academicYearId) {
    return <div className="p-8 text-center text-slate-500">Veuillez sélectionner un niveau scolaire et une année académique.</div>;
  }

  const steps = [
    { id: 'config', label: '1. Configuration', icon: Settings },
    { id: 'availability', label: '2. Disponibilités', icon: Calendar },
    { id: 'generate', label: '3. Génération', icon: Zap },
    { id: 'validate', label: '4. Validation', icon: CheckCircle },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-extrabold mb-1">Smart Timetable Engine</h1>
        <p className="text-blue-100 text-sm">Génération automatique d'emplois du temps optimisés</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
        {steps.map((s) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          return (
            <button key={s.id} onClick={() => setStep(s.id as any)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${isActive ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Icon className="h-3.5 w-3.5" /> {s.label}
            </button>
          );
        })}
      </div>

      {/* Step 1: Config */}
      {step === 'config' && <ConfigStep config={config} schoolLevelId={schoolLevelId} academicYearId={academicYearId} onSaved={loadConfig} />}

      {/* Step 2: Availability */}
      {step === 'availability' && <AvailabilityStep />}

      {/* Step 3: Generate */}
      {step === 'generate' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm text-center">
            <Zap className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">Générer l'emploi du temps</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
              Le moteur va analyser les classes, matières, enseignants, salles et disponibilités pour générer automatiquement un emploi du temps optimisé.
            </p>
            <button onClick={handleGenerate} disabled={generating}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-lg transition">
              {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
              {generating ? 'Génération en cours…' : 'Lancer la génération'}
            </button>
          </div>
          {solutions.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 mb-2">{solutions.length} solution(s) précédente(s)</p>
              <button onClick={() => setStep('validate')} className="text-sm text-blue-600 hover:underline">Voir les solutions →</button>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Validate */}
      {step === 'validate' && (
        <div className="space-y-4">
          {solutions.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
              <p className="text-sm text-slate-400">Aucune solution générée. Allez à l'étape 3 pour générer.</p>
              <button onClick={() => setStep('generate')} className="mt-3 text-sm text-blue-600 hover:underline">Générer →</button>
            </div>
          ) : (
            solutions.map((sol) => (
              <div key={sol.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900">Solution #{solutions.indexOf(sol) + 1}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${sol.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' : sol.status === 'PROPOSED' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{sol.status}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{sol.notes}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-extrabold text-blue-600">{sol.score}%</div>
                    <div className="text-[10px] text-slate-400">Score global</div>
                  </div>
                </div>
                {/* Scores */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { label: 'Faisabilité', value: sol.feasibilityScore, color: 'text-emerald-600' },
                    { label: 'Pédagogie', value: sol.pedagogyScore, color: 'text-blue-600' },
                    { label: 'Confort', value: sol.comfortScore, color: 'text-amber-600' },
                    { label: 'Préférences', value: sol.preferenceScore, color: 'text-violet-600' },
                  ].map((s) => (
                    <div key={s.label} className="bg-slate-50 rounded-lg p-2 text-center">
                      <div className={`text-lg font-bold ${s.color}`}>{s.value}%</div>
                      <div className="text-[10px] text-slate-400">{s.label}</div>
                    </div>
                  ))}
                </div>
                {/* Conflits */}
                {sol.conflictCount > 0 && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs font-semibold text-amber-700 mb-1">{sol.conflictCount} conflit(s) détecté(s)</p>
                    {Array.isArray(sol.conflicts) && sol.conflicts.slice(0, 3).map((c: any, i: number) => (
                      <p key={i} className="text-[11px] text-amber-600">• {c.message}</p>
                    ))}
                  </div>
                )}
                {/* Actions */}
                <div className="flex gap-2">
                  <button onClick={() => setSelectedSolution(sol)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition">
                    <Eye className="w-3.5 h-3.5" /> Voir la grille
                  </button>
                  {sol.status !== 'ACCEPTED' && (
                    <button onClick={() => handleAccept(sol.id)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition">
                      <CheckCircle className="w-3.5 h-3.5" /> Accepter
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal: Grille d'emploi du temps */}
      {selectedSolution && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setSelectedSolution(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h3 className="font-bold text-slate-900">Grille d'emploi du temps — Score {selectedSolution.score}%</h3>
              <button onClick={() => setSelectedSolution(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <div className="p-4">
              <TimetableViewGrid entries={selectedSolution.entries || []} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  COMPOSANT: Configuration
// ═══════════════════════════════════════════════════════════════════════

function ConfigStep({ config, schoolLevelId, academicYearId, onSaved }: any) {
  const [form, setForm] = useState({
    schoolDays: config?.schoolDays || [1, 2, 3, 4, 5],
    timeBlocks: config?.timeBlocks || [
      { start: '08:00', end: '10:00', type: 'BLOCK' },
      { start: '10:00', end: '10:15', type: 'BREAK' },
      { start: '10:15', end: '12:15', type: 'BLOCK' },
      { start: '12:15', end: '14:00', type: 'LUNCH' },
      { start: '14:00', end: '16:00', type: 'BLOCK' },
      { start: '16:00', end: '16:15', type: 'BREAK' },
      { start: '16:15', end: '18:00', type: 'BLOCK' },
    ],
    dayStartTime: config?.dayStartTime || '08:00',
    dayEndTime: config?.dayEndTime || '18:00',
    defaultSessionDuration: config?.defaultSessionDuration || 120,
    saturdayEnabled: config?.saturdayEnabled || false,
  });
  const [saving, setSaving] = useState(false);

  const toggleDay = (day: number) => {
    const days = form.schoolDays.includes(day)
      ? form.schoolDays.filter((d: number) => d !== day)
      : [...form.schoolDays, day].sort();
    setForm({ ...form, schoolDays: days });
  };

  const addBlock = () => setForm({ ...form, timeBlocks: [...form.timeBlocks, { start: '', end: '', type: 'BLOCK' }] });
  const removeBlock = (i: number) => setForm({ ...form, timeBlocks: form.timeBlocks.filter((_: any, idx: number) => idx !== i) });
  const updateBlock = (i: number, field: string, value: string) =>
    setForm({ ...form, timeBlocks: form.timeBlocks.map((b: any, idx: number) => idx === i ? { ...b, [field]: value } : b) });

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/timetable-engine/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getClientAuthorizationHeader() },
        credentials: 'include',
        body: JSON.stringify({ ...form, schoolLevelId, academicYearId }),
      });
      if (!res.ok) throw new Error('Erreur');
      toast({ variant: 'success', title: 'Configuration enregistrée' });
      onSaved();
    } catch {
      toast({ variant: 'error', title: 'Erreur' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-3">Jours d'école</h3>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${form.schoolDays.includes(d.value) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-800">Créneaux horaires</h3>
          <button onClick={addBlock} className="text-xs text-blue-600 hover:underline">+ Ajouter</button>
        </div>
        <div className="space-y-2">
          {form.timeBlocks.map((block: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <input type="time" value={block.start} onChange={(e) => updateBlock(i, 'start', e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded text-sm" />
              <span className="text-slate-400">→</span>
              <input type="time" value={block.end} onChange={(e) => updateBlock(i, 'end', e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded text-sm" />
              <select value={block.type} onChange={(e) => updateBlock(i, 'type', e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded text-sm bg-white">
                <option value="BLOCK">Cours</option>
                <option value="BREAK">Pause</option>
                <option value="LUNCH">Déjeuner</option>
              </select>
              <span className={`px-2 py-1 rounded text-[10px] font-bold ${block.type === 'BLOCK' ? 'bg-blue-50 text-blue-700' : block.type === 'BREAK' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {block.type === 'BLOCK' ? 'Cours' : block.type === 'BREAK' ? 'Pause' : 'Déjeuner'}
              </span>
              <button onClick={() => removeBlock(i)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-md transition">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        Enregistrer la configuration
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  COMPOSANT: Disponibilités (placeholder V1)
// ═══════════════════════════════════════════════════════════════════════

function AvailabilityStep() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm text-center">
      <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <h3 className="text-sm font-bold text-slate-800 mb-1">Matrice de disponibilité</h3>
      <p className="text-xs text-slate-400">La gestion des disponibilités enseignants sera disponible dans la V2. En V1, tous les enseignants sont considérés disponibles sur tous les créneaux.</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  COMPOSANT: Grille d'emploi du temps
// ═══════════════════════════════════════════════════════════════════════

function TimetableViewGrid({ entries }: { entries: any[] }) {
  if (!entries || entries.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">Aucune séance dans cette solution.</p>;
  }

  // Grouper par jour
  const byDay: Record<number, any[]> = {};
  for (const e of entries) {
    if (!byDay[e.dayOfWeek]) byDay[e.dayOfWeek] = [];
    byDay[e.dayOfWeek].push(e);
  }

  // Trier par heure de début
  Object.values(byDay).forEach(dayEntries => dayEntries.sort((a, b) => a.startTime.localeCompare(b.startTime)));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className="p-2 text-left text-xs font-bold text-slate-600 border border-slate-200">Classe</th>
            {DAYS.filter(d => byDay[d.value]).map(d => (
              <th key={d.value} className="p-2 text-center text-xs font-bold text-slate-600 border border-slate-200 min-w-[150px]">{d.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Grouper par classe */}
          {Array.from(new Set(entries.map(e => e.classId))).map(classId => {
            const className = entries.find(e => e.classId === classId)?.className || classId;
            return (
              <tr key={classId}>
                <td className="p-2 font-bold text-slate-800 border border-slate-200 bg-slate-50">{className}</td>
                {DAYS.filter(d => byDay[d.value]).map(d => (
                  <td key={d.value} className="p-1 border border-slate-200 align-top">
                    {(byDay[d.value] || []).filter(e => e.classId === classId).map((e, i) => (
                      <div key={i} className="bg-blue-50 border border-blue-100 rounded-lg p-2 mb-1">
                        <div className="text-[10px] font-bold text-blue-700">{e.startTime} - {e.endTime}</div>
                        <div className="text-xs font-semibold text-slate-800">{e.subjectName}</div>
                        <div className="text-[10px] text-slate-500">{e.teacherName}</div>
                        {e.roomName && <div className="text-[10px] text-slate-400">📍 {e.roomName}</div>}
                      </div>
                    ))}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
