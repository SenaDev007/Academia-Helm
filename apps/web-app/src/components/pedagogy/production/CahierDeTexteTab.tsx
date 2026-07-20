"use client";

/**
 * ============================================================================
 * CAHIER DE TEST (SECONDAIRE) — Évaluations et compositions
 * ============================================================================
 *
 * Module pour les enseignants du secondaire permettant de gérer les
 * évaluations (devoirs, compositions, interrogations) par classe et matière.
 *
 * Structure :
 *   1. Liste des cahiers de test (cards avec filtres)
 *   2. Formulaire de création/édition (en-tête + configuration des notes)
 *   3. Saisie des notes par élève (avec calcul auto des statistiques)
 *   4. Statistiques (moyenne, médiane, % réussite, répartition par sexe)
 *   5. Signatures + workflow DRAFT → SUBMITTED → VALIDATED / REJECTED
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  FileText, Loader2, Plus, Save, RefreshCw, Send, Trash2,
  ChevronLeft, Clock, CheckCircle2, XCircle, BookOpen,
  Users, BarChart3, Eye, Edit3, Award,
} from "lucide-react";
import { toast } from "sonner";

interface CahierDeTexteTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
}

const TEST_TYPES = [
  { value: "DEVOIR", label: "Devoir", color: "bg-blue-100 text-blue-700" },
  { value: "COMPOSITION", label: "Composition", color: "bg-purple-100 text-purple-700" },
  { value: "INTERROGATION", label: "Interrogation", color: "bg-amber-100 text-amber-700" },
  { value: "TEST", label: "Test", color: "bg-emerald-100 text-emerald-700" },
] as const;

const STATUS_CONFIG = {
  DRAFT: { label: "Brouillon", color: "bg-slate-100 text-slate-600", icon: Clock },
  SUBMITTED: { label: "Soumis", color: "bg-blue-100 text-blue-700", icon: Send },
  VALIDATED: { label: "Validé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  REJECTED: { label: "Rejeté", color: "bg-red-100 text-red-700", icon: XCircle },
} as const;

const TRIMESTER_LABELS = ["", "1er Trimestre", "2e Trimestre", "3e Trimestre"];

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatDateFR(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function CahierDeTexteTab({ tenantId, academicYearId, teacherId }: CahierDeTexteTabProps) {
  const [classes, setClasses] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTest, setEditingTest] = useState<any>(null);
  const [viewingTest, setViewingTest] = useState<any>(null);
  const [filterType, setFilterType] = useState<string>("");
  const [filterTrimester, setFilterTrimester] = useState<string>("");

  const emptyForm = {
    classId: "",
    subjectId: "",
    testType: "DEVOIR" as string,
    testNumber: 1,
    testTitle: "",
    trimester: 1,
    testDate: new Date().toISOString().split("T")[0],
    durationMinutes: 60,
    maxScore: 20.0,
    passingScore: 10.0,
    coefficient: 1.0,
    pedagogicalObservations: "",
    recommandations: "",
  };
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);

  // === Chargement classes et tests ===
  const loadClasses = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/pedagogy-space/my-classes?teacherId=${teacherId}&academicYearId=${academicYearId}`,
        { credentials: "include" }
      );
      const data = await res.json();
      setClasses(Array.isArray(data) ? data : []);
    } catch { setClasses([]); }
  }, [teacherId, academicYearId]);

  const loadTests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ teacherId, academicYearId });
      if (filterType) params.append("testType", filterType);
      if (filterTrimester) params.append("trimester", filterTrimester);
      const res = await fetch(`/api/pedagogy-space/cahier-textes?${params.toString()}`, { credentials: "include" });
      const data = await res.json();
      setTests(Array.isArray(data) ? data : []);
    } catch { setTests([]); }
    finally { setLoading(false); }
  }, [teacherId, academicYearId, filterType, filterTrimester]);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => { loadTests(); }, [loadTests]);

  // Toutes les matières (collectées depuis les classes)
  const allSubjects = classes.flatMap(c => c.subjects || []);

  // === Création/Mise à jour ===
  const handleCreateOrUpdate = async () => {
    if (!form.classId || !form.testTitle) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    setSaving(true);
    try {
      const url = editingTest
        ? `/api/pedagogy-space/cahier-textes/${editingTest.id}`
        : "/api/pedagogy-space/cahier-textes";
      const method = editingTest ? "PUT" : "POST";
      const body = editingTest
        ? { ...form }
        : { ...form, academicYearId, teacherId };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      toast.success(editingTest ? "✅ Cahier de test mis à jour" : "✅ Cahier de test créé");
      setShowForm(false);
      setEditingTest(null);
      setForm(emptyForm);
      loadTests();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (test: any) => {
    setEditingTest(test);
    setForm({
      ...emptyForm,
      ...test,
      testDate: test.testDate ? test.testDate.split("T")[0] : "",
    });
    setShowForm(true);
  };

  const handleDelete = async (test: any) => {
    if (!confirm(`Supprimer le cahier de test "${test.testTitle}" ?`)) return;
    try {
      const res = await fetch(`/api/pedagogy-space/cahier-textes/${test.id}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("Cahier de test supprimé");
      loadTests();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  const handleSubmit = async (test: any) => {
    if (!confirm("Soumettre ce cahier de test au directeur ?")) return;
    try {
      const res = await fetch(`/api/pedagogy-space/cahier-textes/${test.id}/submit`, {
        method: "POST", credentials: "include",
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("✅ Cahier de test soumis");
      loadTests();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  const handleView = async (test: any) => {
    try {
      const res = await fetch(`/api/pedagogy-space/cahier-textes/${test.id}`, { credentials: "include" });
      const data = await res.json();
      setViewingTest(data);
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  // === Vue formulaire ===
  if (showForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
          <button onClick={() => { setShowForm(false); setEditingTest(null); setForm(emptyForm); }}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">
            <ChevronLeft className="h-4 w-4" /> Retour
          </button>
          <div className="text-sm font-semibold text-slate-700">
            {editingTest ? "Modifier le cahier de test" : "Nouveau cahier de test"}
          </div>
          <button onClick={handleCreateOrUpdate} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editingTest ? "Mettre à jour" : "Créer"}
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          {/* Type de test */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 uppercase border-b border-slate-200 pb-2 mb-3">
              Type d'évaluation
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {TEST_TYPES.map(t => (
                <button key={t.value} type="button"
                  onClick={() => setForm({ ...form, testType: t.value })}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 border-2 rounded-lg text-xs font-semibold transition-all",
                    form.testType === t.value ? t.color + " border-current" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                  )}>
                  <Award className="h-4 w-4" />
                  {t.label}
                </button>
              ))}
            </div>
          </section>

          {/* En-tête */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 uppercase border-b border-slate-200 pb-2 mb-3">
              En-tête
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Classe *</label>
                <select value={form.classId}
                  onChange={(e) => setForm({ ...form, classId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option value="">— Sélectionner —</option>
                  {classes.map(c => (
                    <option key={c.classId} value={c.classId}>{c.className}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Matière</label>
                <select value={form.subjectId}
                  onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option value="">— Sélectionner —</option>
                  {allSubjects.map((s: any) => (
                    <option key={s.subjectId} value={s.subjectId}>{s.subjectName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Trimestre *</label>
                <select value={form.trimester}
                  onChange={(e) => setForm({ ...form, trimester: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option value={1}>1er Trimestre</option>
                  <option value={2}>2e Trimestre</option>
                  <option value={3}>3e Trimestre</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">N° du test</label>
                <input type="number" min={1} value={form.testNumber}
                  onChange={(e) => setForm({ ...form, testNumber: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Date du test</label>
                <input type="date" value={form.testDate}
                  onChange={(e) => setForm({ ...form, testDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Durée (min)</label>
                <input type="number" min={5} value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: parseInt(e.target.value) || 60 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Titre du test *</label>
              <input type="text" value={form.testTitle}
                onChange={(e) => setForm({ ...form, testTitle: e.target.value })}
                placeholder="Ex: Composition n°1 du 1er trimestre"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
          </section>

          {/* Configuration des notes */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 uppercase border-b border-slate-200 pb-2 mb-3">
              Configuration des notes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Note maximale</label>
                <input type="number" step="0.5" min={1} value={form.maxScore}
                  onChange={(e) => setForm({ ...form, maxScore: parseFloat(e.target.value) || 20.0 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Seuil de réussite</label>
                <input type="number" step="0.5" min={0} value={form.passingScore}
                  onChange={(e) => setForm({ ...form, passingScore: parseFloat(e.target.value) || 10.0 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Coefficient</label>
                <input type="number" step="0.5" min={0.5} value={form.coefficient}
                  onChange={(e) => setForm({ ...form, coefficient: parseFloat(e.target.value) || 1.0 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
            </div>
          </section>

          {/* Observations pédagogiques */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 uppercase border-b border-slate-200 pb-2 mb-3">
              Observations pédagogiques
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Observations</label>
                <textarea value={form.pedagogicalObservations}
                  onChange={(e) => setForm({ ...form, pedagogicalObservations: e.target.value })}
                  rows={3}
                  placeholder="Difficultés rencontrées, points forts, points faibles..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Recommandations</label>
                <textarea value={form.recommandations}
                  onChange={(e) => setForm({ ...form, recommandations: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
            </div>
          </section>

          {editingTest && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <strong>💡 Astuce :</strong> Après avoir créé le test, utilisez le bouton "Voir" dans la liste pour
              saisir les notes des élèves. Les statistiques seront calculées automatiquement.
            </div>
          )}
        </div>
      </div>
    );
  }

  // === Vue saisie des notes ===
  if (viewingTest) {
    return <TestScoreEditor test={viewingTest} onClose={() => { setViewingTest(null); loadTests(); }} />;
  }

  // === Vue liste ===
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase">Type</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm min-w-[150px]">
            <option value="">Tous</option>
            {TEST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase">Trimestre</label>
          <select value={filterTrimester} onChange={(e) => setFilterTrimester(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm min-w-[150px]">
            <option value="">Tous</option>
            <option value="1">1er Trimestre</option>
            <option value="2">2e Trimestre</option>
            <option value="3">3e Trimestre</option>
          </select>
        </div>
        <div className="flex-1" />
        <button onClick={loadTests} className="p-2 hover:bg-slate-200 rounded-lg" title="Rafraîchir">
          <RefreshCw className="h-4 w-4" />
        </button>
        <button onClick={() => { setForm(emptyForm); setEditingTest(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Nouveau test
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Chargement…
        </div>
      )}

      {!loading && tests.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-slate-300 mb-3" />
          <p className="font-medium text-slate-600">Aucun cahier de test</p>
          <p className="text-sm text-slate-500 mt-1">Créez votre premier test en cliquant sur "Nouveau test".</p>
        </div>
      )}

      {!loading && tests.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {tests.map(test => {
            const typeConfig = TEST_TYPES.find(t => t.value === test.testType);
            const status = STATUS_CONFIG[test.status as keyof typeof STATUS_CONFIG];
            return (
              <div key={test.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className={cn("flex items-center gap-1 px-2 py-1 rounded text-xs font-bold", typeConfig?.color || "bg-slate-100 text-slate-700")}>
                    {typeConfig?.label || test.testType} N°{test.testNumber}
                  </div>
                  {status && (
                    <div className={cn("flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase", status.color)}>
                      <status.icon className="h-3 w-3" /> {status.label}
                    </div>
                  )}
                </div>
                <h4 className="font-semibold text-slate-900 text-sm mb-1 line-clamp-2">{test.testTitle}</h4>
                <div className="text-xs text-slate-500 space-y-1">
                  <div>📅 {formatDateFR(test.testDate)}</div>
                  <div>🏫 {test.classNameResolved || "—"}</div>
                  {test.subjectName && <div>📚 {test.subjectName}</div>}
                  <div>📊 Sur {test.maxScore} — Seuil: {test.passingScore} — Coef: {test.coefficient}</div>
                  <div className="text-slate-400">{TRIMESTER_LABELS[test.trimester]}</div>
                </div>

                {test.averageScore !== null && test.averageScore !== undefined && (
                  <div className="grid grid-cols-3 gap-1 mt-3 p-2 bg-slate-50 rounded text-center text-xs">
                    <div>
                      <div className="font-bold text-blue-700">{test.averageScore?.toFixed(2) || "—"}</div>
                      <div className="text-[10px] text-slate-500">Moyenne</div>
                    </div>
                    <div>
                      <div className="font-bold text-emerald-700">{test.passRate?.toFixed(1) || "—"}%</div>
                      <div className="text-[10px] text-slate-500">Réussite</div>
                    </div>
                    <div>
                      <div className="font-bold text-amber-700">{test.totalStudents || 0}</div>
                      <div className="text-[10px] text-slate-500">Élèves</div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1 pt-2 mt-2 border-t border-slate-100">
                  <button onClick={() => handleView(test)}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded">
                    <Eye className="h-3 w-3" /> Notes
                  </button>
                  <button onClick={() => handleEdit(test)}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded">
                    <Edit3 className="h-3 w-3" /> Modifier
                  </button>
                  {test.status === "DRAFT" && (
                    <button onClick={() => handleSubmit(test)}
                      className="flex items-center justify-center px-2 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 rounded" title="Soumettre">
                      <Send className="h-3 w-3" />
                    </button>
                  )}
                  <button onClick={() => handleDelete(test)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// EDITEUR DE NOTES — Saisie des scores par élève
// ============================================================================

function TestScoreEditor({ test, onClose }: { test: any; onClose: () => void }) {
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const loadTest = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pedagogy-space/cahier-textes/${test.id}`, { credentials: "include" });
      const data = await res.json();
      const sc = typeof data.studentScores === "string"
        ? JSON.parse(data.studentScores || "[]")
        : (data.studentScores || []);
      setScores(sc);
      // Calculer les stats
      const computed = computeStats(sc, data.maxScore || 20, data.passingScore || 10);
      setStats(computed);
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally { setLoading(false); }
  }, [test.id]);

  useEffect(() => { loadTest(); }, [loadTest]);

  const computeStats = (sc: any[], maxScore: number, passingScore: number) => {
    let total = 0, present = 0, absent = 0;
    let sum = 0, highest = -Infinity, lowest = Infinity;
    let passed = 0, failed = 0;
    let totalG = 0, totalF = 0, sumG = 0, sumF = 0, passedG = 0, passedF = 0;

    for (const s of sc) {
      total++;
      const sexe = (s.sexe || "").toUpperCase();
      if (sexe === "M" || sexe === "G") totalG++;
      else if (sexe === "F") totalF++;

      if (s.absent) { absent++; failed++; continue; }
      if (s.score === null || s.score === undefined || s.score === "") continue;
      present++;
      const score = parseFloat(s.score);
      if (isNaN(score)) continue;
      sum += score;
      if (score > highest) highest = score;
      if (score < lowest) lowest = score;
      const isPassed = score >= passingScore;
      if (isPassed) {
        passed++;
        if (sexe === "M" || sexe === "G") passedG++;
        else if (sexe === "F") passedF++;
      } else failed++;

      if (sexe === "M" || sexe === "G") sumG += score;
      else if (sexe === "F") sumF += score;
    }
    return {
      totalStudents: total, totalPresent: present, totalAbsent: absent,
      averageScore: present > 0 ? Math.round((sum / present) * 100) / 100 : 0,
      highestScore: highest === -Infinity ? 0 : highest,
      lowestScore: lowest === Infinity ? 0 : lowest,
      passedCount: passed, failedCount: failed,
      passRate: present > 0 ? Math.round((passed / present) * 10000) / 100 : 0,
      boysCount: totalG, girlsCount: totalF,
      boysAverage: totalG > 0 ? Math.round((sumG / totalG) * 100) / 100 : 0,
      girlsAverage: totalF > 0 ? Math.round((sumF / totalF) * 100) / 100 : 0,
      boysPassed: passedG, girlsPassed: passedF,
    };
  };

  const updateScore = (idx: number, field: string, value: any) => {
    setScores(prev => {
      const newScores = [...prev];
      newScores[idx] = { ...newScores[idx], [field]: value };
      const newStats = computeStats(newScores, test.maxScore || 20, test.passingScore || 10);
      setStats(newStats);
      return newScores;
    });
  };

  const handleInitStudents = async () => {
    if (!confirm("Charger la liste des élèves de cette classe ?")) return;
    try {
      const res = await fetch(`/api/pedagogy-space/cahier-textes/${test.id}/init-students`, {
        method: "POST", credentials: "include",
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("✅ Élèves chargés");
      loadTest();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const sc = computeStats(scores, test.maxScore || 20, test.passingScore || 10);
      const res = await fetch(`/api/pedagogy-space/cahier-textes/${test.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          studentScores: scores,
          ...sc,
        }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("✅ Notes enregistrées");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>;
  }

  const maxScore = test.maxScore || 20;
  const passingScore = test.passingScore || 10;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
        <button onClick={onClose}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">
          <ChevronLeft className="h-4 w-4" /> Retour à la liste
        </button>
        <div className="text-center">
          <div className="text-sm font-bold text-slate-900">{test.testTitle}</div>
          <div className="text-xs text-slate-500">{test.classNameResolved} — {formatDateFR(test.testDate)}</div>
        </div>
        <div className="flex gap-2">
          {scores.length === 0 && (
            <button onClick={handleInitStudents}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700">
              <Users className="h-4 w-4" /> Charger les élèves
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
        </div>
      </div>

      {/* === Configuration affichée === */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
        <strong>Configuration :</strong> Sur {maxScore} — Seuil réussite: {passingScore} — Coefficient: {test.coefficient} — {TRIMESTER_LABELS[test.trimester]}
      </div>

      {/* === Statistiques calculées === */}
      {stats && scores.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatCard label="Effectif" value={stats.totalStudents} icon={Users} color="bg-slate-50 text-slate-700" />
          <StatCard label="Présents" value={stats.totalPresent} icon={CheckCircle2} color="bg-emerald-50 text-emerald-700" />
          <StatCard label="Absents" value={stats.totalAbsent} icon={XCircle} color="bg-red-50 text-red-700" />
          <StatCard label="Moyenne" value={stats.averageScore?.toFixed(2) || "—"} icon={BarChart3} color="bg-blue-50 text-blue-700" />
          <StatCard label="Note max" value={stats.highestScore?.toFixed(2) || "—"} icon={Award} color="bg-purple-50 text-purple-700" />
          <StatCard label="Note min" value={stats.lowestScore?.toFixed(2) || "—"} icon={BarChart3} color="bg-amber-50 text-amber-700" />
        </div>
      )}

      {/* === Répartition par sexe === */}
      {stats && scores.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase mb-3">Répartition par sexe</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-200 px-3 py-2 text-left">Indicateur</th>
                  <th className="border border-slate-200 px-3 py-2 text-center">Garçons</th>
                  <th className="border border-slate-200 px-3 py-2 text-center">Filles</th>
                  <th className="border border-slate-200 px-3 py-2 text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-200 px-3 py-2 font-semibold">Effectif</td>
                  <td className="border border-slate-200 px-3 py-2 text-center">{stats.boysCount}</td>
                  <td className="border border-slate-200 px-3 py-2 text-center">{stats.girlsCount}</td>
                  <td className="border border-slate-200 px-3 py-2 text-center font-bold">{stats.totalStudents}</td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-3 py-2 font-semibold">Moyenne</td>
                  <td className="border border-slate-200 px-3 py-2 text-center text-blue-700">{stats.boysAverage?.toFixed(2) || "—"}</td>
                  <td className="border border-slate-200 px-3 py-2 text-center text-blue-700">{stats.girlsAverage?.toFixed(2) || "—"}</td>
                  <td className="border border-slate-200 px-3 py-2 text-center font-bold text-blue-700">{stats.averageScore?.toFixed(2) || "—"}</td>
                </tr>
                <tr className="bg-emerald-50/50">
                  <td className="border border-slate-200 px-3 py-2 font-semibold">Ont réussi</td>
                  <td className="border border-slate-200 px-3 py-2 text-center text-emerald-700">{stats.boysPassed}</td>
                  <td className="border border-slate-200 px-3 py-2 text-center text-emerald-700">{stats.girlsPassed}</td>
                  <td className="border border-slate-200 px-3 py-2 text-center font-bold text-emerald-700">{stats.passedCount}</td>
                </tr>
                <tr className="bg-red-50/50">
                  <td className="border border-slate-200 px-3 py-2 font-semibold">Ont échoué</td>
                  <td className="border border-slate-200 px-3 py-2 text-center text-red-700">{stats.boysCount - stats.boysPassed}</td>
                  <td className="border border-slate-200 px-3 py-2 text-center text-red-700">{stats.girlsCount - stats.girlsPassed}</td>
                  <td className="border border-slate-200 px-3 py-2 text-center font-bold text-red-700">{stats.failedCount}</td>
                </tr>
                <tr className="bg-blue-50/50">
                  <td className="border border-slate-200 px-3 py-2 font-bold">% réussite</td>
                  <td className="border border-slate-200 px-3 py-2 text-center font-bold text-blue-700">
                    {stats.boysCount > 0 ? ((stats.boysPassed / stats.boysCount) * 100).toFixed(1) : "—"}%
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-center font-bold text-blue-700">
                    {stats.girlsCount > 0 ? ((stats.girlsPassed / stats.girlsCount) * 100).toFixed(1) : "—"}%
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-center font-bold text-blue-800">{stats.passRate}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === Tableau de saisie des notes === */}
      {scores.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase mb-3">Saisie des notes</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-200 px-2 py-2 w-12">N°</th>
                  <th className="border border-slate-200 px-2 py-2 text-left" style={{ minWidth: "200px" }}>Nom et prénom</th>
                  <th className="border border-slate-200 px-2 py-2 w-16">Sexe</th>
                  <th className="border border-slate-200 px-2 py-2 w-32">Note /{maxScore}</th>
                  <th className="border border-slate-200 px-2 py-2 w-24">Absent</th>
                  <th className="border border-slate-200 px-2 py-2" style={{ minWidth: "150px" }}>Appréciation</th>
                  <th className="border border-slate-200 px-2 py-2 w-24">Statut</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s, idx) => {
                  const score = parseFloat(s.score);
                  const isPassed = !isNaN(score) && score >= passingScore;
                  const isAbsent = s.absent;
                  return (
                    <tr key={s.studentId || idx} className={cn("hover:bg-slate-50", idx % 2 === 1 && "bg-slate-50/50")}>
                      <td className="border border-slate-200 px-2 py-1 text-center font-semibold">{s.numero || idx + 1}</td>
                      <td className="border border-slate-200 px-2 py-1 font-medium">{s.nom} {s.prenom}</td>
                      <td className="border border-slate-200 px-2 py-1 text-center">{s.sexe}</td>
                      <td className="border border-slate-200 p-0">
                        <input type="number" step="0.25" min={0} max={maxScore}
                          value={s.score ?? ""}
                          onChange={(e) => updateScore(idx, "score", e.target.value)}
                          disabled={isAbsent}
                          className={cn(
                            "w-full px-2 py-1 text-center text-sm border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent",
                            !isAbsent && isPassed && "text-emerald-700 font-bold",
                            !isAbsent && !isNaN(score) && !isPassed && "text-red-700 font-bold",
                            isAbsent && "opacity-40"
                          )} />
                      </td>
                      <td className="border border-slate-200 p-0 text-center">
                        <input type="checkbox" checked={!!s.absent}
                          onChange={(e) => updateScore(idx, "absent", e.target.checked)}
                          className="h-4 w-4" />
                      </td>
                      <td className="border border-slate-200 p-0">
                        <input type="text" value={s.appreciation || ""}
                          onChange={(e) => updateScore(idx, "appreciation", e.target.value)}
                          placeholder="Très bien, Bien, Passable, Insuffisant..."
                          className="w-full px-2 py-1 text-xs border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent" />
                      </td>
                      <td className="border border-slate-200 px-2 py-1 text-center">
                        {isAbsent ? (
                          <span className="text-xs text-slate-500">Absent</span>
                        ) : !isNaN(score) ? (
                          isPassed ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                          )
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="font-medium text-slate-600">Aucun élève chargé</p>
          <p className="text-sm text-slate-500 mt-1 mb-3">Cliquez sur "Charger les élèves" pour récupérer la liste des inscrits.</p>
          <button onClick={handleInitStudents}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700">
            <Users className="h-4 w-4" /> Charger les élèves
          </button>
        </div>
      )}

      {/* === Observations pédagogiques === */}
      {test.pedagogicalObservations && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="text-xs font-bold text-amber-700 uppercase mb-2">Observations pédagogiques</h4>
          <p className="text-sm text-slate-700">{test.pedagogicalObservations}</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: any; icon: any; color: string }) {
  return (
    <div className={cn("flex items-center gap-3 p-3 rounded-xl border", color)}>
      <Icon className="h-5 w-5 flex-shrink-0" />
      <div>
        <div className="text-lg font-bold">{value}</div>
        <div className="text-[10px] uppercase font-semibold opacity-70">{label}</div>
      </div>
    </div>
  );
}
