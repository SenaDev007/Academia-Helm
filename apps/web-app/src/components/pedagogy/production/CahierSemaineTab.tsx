"use client";

/**
 * Cahier de Semaine — Conforme au document officiel Academia Helm.
 *
 * Structure :
 *   1. Sélecteur de semaine (1-36) + trimestre
 *   2. Rapports journaliers (Lundi à Vendredi) avec 8 sections chacun
 *   3. Rapport de fin de semaine (7 sections) + soumission au directeur
 *
 * Chaque section correspond exactement au document :
 *   Section 1: Présence du personnel enseignant
 *   Section 2: Présence des élèves
 *   Section 3: Déroulement pédagogique
 *   Section 4: Discipline & vie scolaire
 *   Section 5: Hygiène, sécurité & logistique
 *   Section 6: Visites reçues
 *   Section 7: Communication & circulaires
 *   Section 8: Synthèse globale du jour
 *
 * Rapport de fin de semaine :
 *   Section 1: Fonctionnement général
 *   Section 2: Synthèse pédagogique
 *   Section 3: Discipline & vie scolaire
 *   Section 4: Infrastructures & logistique
 *   Section 5: Bilan des visites
 *   Section 6: Statistiques de la semaine
 *   Section 7: Recommandations stratégiques
 */

import { useState, useEffect, useCallback } from "react";
import {
  CalendarDays, Loader2, Save, Send, CheckCircle2, XCircle,
  ChevronRight, ArrowLeft, Users, BookOpen, Shield, Wrench,
  Eye, MessageSquare, Star, FileText, Clock,
} from "lucide-react";
import { toast } from "sonner";

interface CahierSemaineTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
}

const DAYS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
];

const SECTION_ICONS = [Users, BookOpen, BookOpen, Shield, Wrench, Eye, MessageSquare, Star];
const SECTION_TITLES = [
  "Présence du personnel enseignant",
  "Présence des élèves",
  "Déroulement pédagogique",
  "Discipline & vie scolaire",
  "Hygiène, sécurité & logistique",
  "Visites reçues",
  "Communication & circulaires",
  "Synthèse globale du jour",
];

const SUMMARY_SECTIONS = [
  "Fonctionnement général de la semaine",
  "Synthèse pédagogique",
  "Synthèse discipline & vie scolaire",
  "Infrastructures & logistique",
  "Bilan des visites de la semaine",
  "Statistiques de la semaine",
  "Recommandations stratégiques pour la semaine suivante",
];

export function CahierSemaineTab({ tenantId, academicYearId, teacherId }: CahierSemaineTabProps) {
  const [weekNumber, setWeekNumber] = useState(1);
  const [trimester, setTrimester] = useState(1);
  const [view, setView] = useState<"overview" | "daily" | "summary">("overview");
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [dailyReports, setDailyReports] = useState<any[]>([]);
  const [currentReport, setCurrentReport] = useState<any | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Charger les rapports journaliers de la semaine
  const loadDailyReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/pedagogy-space/weekly-log/daily-reports?academicYearId=${academicYearId}&weekNumber=${weekNumber}`,
        { credentials: "include" }
      );
      const data = await res.json();
      setDailyReports(Array.isArray(data) ? data : []);
    } catch { setDailyReports([]); }
    finally { setLoading(false); }
  }, [academicYearId, weekNumber]);

  // Charger ou créer le rapport de fin de semaine
  const loadWeeklySummary = useCallback(async () => {
    try {
      // Calculer les dates de la semaine
      const now = new Date();
      const monday = new Date(now);
      monday.setDate(now.getDate() - now.getDay() + 1);
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);

      const res = await fetch("/api/pedagogy-space/weekly-log/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          academicYearId, weekNumber, trimester,
          weekStartDate: monday.toISOString().split("T")[0],
          weekEndDate: friday.toISOString().split("T")[0],
          filledBy: teacherId,
        }),
      });
      const data = await res.json();
      setWeeklySummary(data);
    } catch { setWeeklySummary(null); }
  }, [academicYearId, weekNumber, trimester, teacherId]);

  useEffect(() => {
    loadDailyReports();
    loadWeeklySummary();
  }, [loadDailyReports, loadWeeklySummary]);

  // Ouvrir un rapport journalier
  const openDailyReport = async (day: number) => {
    setSelectedDay(day);
    setView("daily");
    // Chercher le rapport existant
    const existing = dailyReports.find(r => r.dayOfWeek === day);
    if (existing) {
      setCurrentReport(existing);
    } else {
      // Créer un nouveau rapport
      try {
        const reportDate = new Date();
        reportDate.setDate(reportDate.getDate() - reportDate.getDay() + day);
        const res = await fetch("/api/pedagogy-space/weekly-log/daily-reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            academicYearId, weekNumber, trimester, dayOfWeek: day,
            reportDate: reportDate.toISOString().split("T")[0],
            filledBy: teacherId,
          }),
        });
        const data = await res.json();
        setCurrentReport(data);
        setDailyReports(prev => [...prev, data]);
      } catch (e: any) {
        toast.error("Erreur", { description: e.message });
      }
    }
  };

  // Sauvegarder un rapport journalier
  const saveDailyReport = async (data: any) => {
    if (!currentReport) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/pedagogy-space/weekly-log/daily-reports/${currentReport.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, status: "COMPLETED" }),
      });
      if (!res.ok) throw new Error("Erreur");
      const updated = await res.json();
      setCurrentReport(updated);
      setDailyReports(prev => prev.map(r => r.id === updated.id ? updated : r));
      toast.success("✅ Rapport journalier enregistré");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally { setSaving(false); }
  };

  // Sauvegarder le rapport de fin de semaine
  const saveWeeklySummary = async (data: any) => {
    if (!weeklySummary) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/pedagogy-space/weekly-log/summary/${weeklySummary.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erreur");
      const updated = await res.json();
      setWeeklySummary(updated);
      toast.success("✅ Rapport de fin de semaine enregistré");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally { setSaving(false); }
  };

  // Soumettre le rapport de fin de semaine
  const submitWeeklySummary = async () => {
    if (!weeklySummary) return;
    if (!confirm("Confirmer la soumission du rapport de fin de semaine au directeur ?")) return;
    try {
      const res = await fetch(`/api/pedagogy-space/weekly-log/summary/${weeklySummary.id}/submit`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erreur");
      const updated = await res.json();
      setWeeklySummary(updated);
      toast.success("✅ Rapport soumis au directeur");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  // ===== VUE OVERVIEW (liste des jours + accès rapport fin semaine) =====
  if (view === "overview") {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Cahier de Semaine</h3>
            <p className="text-sm text-slate-500">Semaine {weekNumber} · Trimestre {trimester}</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={weekNumber} onChange={e => setWeekNumber(Number(e.target.value))} className="h-9 px-3 rounded-lg border border-slate-200 text-sm">
              {Array.from({ length: 36 }, (_, i) => i + 1).map(w => <option key={w} value={w}>Semaine {w}</option>)}
            </select>
            <select value={trimester} onChange={e => setTrimester(Number(e.target.value))} className="h-9 px-3 rounded-lg border border-slate-200 text-sm">
              <option value={1}>Trimestre 1</option>
              <option value={2}>Trimestre 2</option>
              <option value={3}>Trimestre 3</option>
            </select>
          </div>
        </div>

        {/* Cartes jours */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {DAYS.map(day => {
            const report = dailyReports.find(r => r.dayOfWeek === day.value);
            const isCompleted = report?.status === "COMPLETED";
            return (
              <button
                key={day.value}
                onClick={() => openDailyReport(day.value)}
                className="text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-900">{day.label}</span>
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-slate-300" />
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {isCompleted ? "Rapport complété" : "À remplir"}
                </p>
              </button>
            );
          })}
        </div>

        {/* Rapport de fin de semaine */}
        <div className="mt-6">
          <button
            onClick={() => setView("summary")}
            className="w-full text-left flex items-center justify-between p-5 rounded-xl border-2 border-blue-200 bg-blue-50/50 hover:bg-blue-50 transition-all"
          >
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-blue-600" />
              <div>
                <p className="font-bold text-slate-900">Rapport de fin de semaine</p>
                <p className="text-sm text-slate-500">
                  {weeklySummary?.status === "DRAFT" && "Brouillon — à compléter"}
                  {weeklySummary?.status === "SUBMITTED" && "Soumis au directeur — en attente de validation"}
                  {weeklySummary?.status === "VALIDATED" && "✅ Validé par le directeur"}
                  {weeklySummary?.status === "REJECTED" && "❌ Rejeté — à reprendre"}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </button>
        </div>
      </div>
    );
  }

  // ===== VUE RAPPORT JOURNALIER =====
  if (view === "daily" && currentReport) {
    return (
      <DailyReportForm
        report={currentReport}
        dayLabel={DAYS.find(d => d.value === selectedDay)?.label || ""}
        weekNumber={weekNumber}
        onSave={saveDailyReport}
        onBack={() => setView("overview")}
        saving={saving}
      />
    );
  }

  // ===== VUE RAPPORT FIN SEMAINE =====
  if (view === "summary" && weeklySummary) {
    return (
      <WeeklySummaryForm
        summary={weeklySummary}
        onSave={saveWeeklySummary}
        onSubmit={submitWeeklySummary}
        onBack={() => setView("overview")}
        saving={saving}
      />
    );
  }

  return null;
}

// ============================================================================
// Formulaire rapport journalier (8 sections)
// ============================================================================

function DailyReportForm({
  report, dayLabel, weekNumber, onSave, onBack, saving,
}: {
  report: any;
  dayLabel: string;
  weekNumber: number;
  onSave: (data: any) => void;
  onBack: () => void;
  saving: boolean;
}) {
  const [data, setData] = useState<any>({});

  useEffect(() => {
    setData({
      staffSummary: report.staffSummary || "",
      studentAttendanceRate: report.studentAttendanceRate || "",
      highAbsenceClasses: report.highAbsenceClasses || "",
      parentNotifiedAbsences: report.parentNotifiedAbsences || "",
      lateCount: report.lateCount || 0,
      specialCases: report.specialCases || "",
      scheduleRespected: report.scheduleRespected || "",
      modifiedCourses: report.modifiedCourses || "",
      remarkableActivities: report.remarkableActivities || "",
      classClimate: report.classClimate || "",
      positiveBehaviors: report.positiveBehaviors || "",
      problematicBehaviors: report.problematicBehaviors || "",
      correctiveMeasures: report.correctiveMeasures || "",
      roomCleanliness: report.roomCleanliness || "",
      toiletsCondition: report.toiletsCondition || "",
      waterStatus: report.waterStatus || "",
      electricityStatus: report.electricityStatus || "",
      urgentRepairs: report.urgentRepairs || "",
      adminVisit: report.adminVisit || false,
      pedagoVisit: report.pedagoVisit || false,
      parentVisit: report.parentVisit || false,
      visitDetails: report.visitDetails || "",
      directorInstructions: report.directorInstructions || "",
      urgentNeeds: report.urgentNeeds || "",
      strengths: report.strengths || "",
      improvements: report.improvements || "",
      recommendations: report.recommendations || "",
    });
  }, [report]);

  const set = (key: string, value: any) => setData((prev: any) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h3 className="text-lg font-bold text-slate-900">{dayLabel} — Semaine {weekNumber}</h3>
          <p className="text-sm text-slate-500">Rapport journalier du cahier de semaine</p>
        </div>
      </div>

      {/* Section 1: Présence du personnel */}
      <SectionCard icon={Users} title="1. Présence du personnel enseignant" color="blue">
        <TextArea label="Synthèse de la présence" value={data.staffSummary} onChange={(v) => set("staffSummary", v)} />
      </SectionCard>

      {/* Section 2: Présence des élèves */}
      <SectionCard icon={BookOpen} title="2. Présence des élèves" color="cyan">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Taux de présence global (%)" type="number" value={data.studentAttendanceRate} onChange={(v) => set("studentAttendanceRate", v ? Number(v) : null)} />
          <Input label="Classes avec +10% d'absences" value={data.highAbsenceClasses} onChange={(v) => set("highAbsenceClasses", v)} />
          <Input label="Nombre de retards" type="number" value={data.lateCount} onChange={(v) => set("lateCount", v ? Number(v) : 0)} />
          <Input label="Cas particuliers observés" value={data.specialCases} onChange={(v) => set("specialCases", v)} />
        </div>
        <TextArea label="Absences signalées par les parents" value={data.parentNotifiedAbsences} onChange={(v) => set("parentNotifiedAbsences", v)} />
      </SectionCard>

      {/* Section 3: Déroulement pédagogique */}
      <SectionCard icon={BookOpen} title="3. Déroulement pédagogique" color="indigo">
        <RadioGroup label="Respect de l'emploi du temps" value={data.scheduleRespected} onChange={(v) => set("scheduleRespected", v)} options={["OUI", "NON", "PARTIEL"]} />
        <RadioGroup label="Climat des classes" value={data.classClimate} onChange={(v) => set("classClimate", v)} options={["CALME", "MOYEN", "PERTURBE"]} />
        <TextArea label="Cours non assurés ou modifiés" value={data.modifiedCourses} onChange={(v) => set("modifiedCourses", v)} />
        <TextArea label="Activités pédagogiques remarquables" value={data.remarkableActivities} onChange={(v) => set("remarkableActivities", v)} />
      </SectionCard>

      {/* Section 4: Discipline & vie scolaire */}
      <SectionCard icon={Shield} title="4. Discipline & vie scolaire" color="amber">
        <TextArea label="Comportements positifs observés" value={data.positiveBehaviors} onChange={(v) => set("positiveBehaviors", v)} />
        <TextArea label="Comportements problématiques" value={data.problematicBehaviors} onChange={(v) => set("problematicBehaviors", v)} />
        <TextArea label="Mesures correctives appliquées" value={data.correctiveMeasures} onChange={(v) => set("correctiveMeasures", v)} />
      </SectionCard>

      {/* Section 5: Hygiène, sécurité & logistique */}
      <SectionCard icon={Wrench} title="5. Hygiène, sécurité & logistique" color="emerald">
        <RadioGroup label="Propreté des salles" value={data.roomCleanliness} onChange={(v) => set("roomCleanliness", v)} options={["TRES_BONNE", "BONNE", "ACCEPTABLE", "INSUFFISANTE"]} />
        <RadioGroup label="Toilettes" value={data.toiletsCondition} onChange={(v) => set("toiletsCondition", v)} options={["TRES_PROPRES", "CORRECTES", "A_REVOIR", "INSALUBRES"]} />
        <RadioGroup label="Eau" value={data.waterStatus} onChange={(v) => set("waterStatus", v)} options={["NORMALE", "INSTABLE", "COUPURE"]} />
        <RadioGroup label="Électricité" value={data.electricityStatus} onChange={(v) => set("electricityStatus", v)} options={["NORMALE", "INSTABLE", "COUPURE"]} />
        <TextArea label="Points de réparation urgente" value={data.urgentRepairs} onChange={(v) => set("urgentRepairs", v)} />
      </SectionCard>

      {/* Section 6: Visites reçues */}
      <SectionCard icon={Eye} title="6. Visites reçues" color="purple">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Checkbox label="Visite administrative" checked={data.adminVisit} onChange={(v) => set("adminVisit", v)} />
          <Checkbox label="Visite pédagogique" checked={data.pedagoVisit} onChange={(v) => set("pedagoVisit", v)} />
          <Checkbox label="Visite de parents" checked={data.parentVisit} onChange={(v) => set("parentVisit", v)} />
        </div>
        <TextArea label="Détails (visiteur, objet, durée)" value={data.visitDetails} onChange={(v) => set("visitDetails", v)} />
      </SectionCard>

      {/* Section 7: Communication & circulaires */}
      <SectionCard icon={MessageSquare} title="7. Communication & circulaires" color="pink">
        <TextArea label="Instructions reçues de la direction" value={data.directorInstructions} onChange={(v) => set("directorInstructions", v)} />
        <TextArea label="Besoins urgents communiqués" value={data.urgentNeeds} onChange={(v) => set("urgentNeeds", v)} />
      </SectionCard>

      {/* Section 8: Synthèse globale du jour */}
      <SectionCard icon={Star} title="8. Synthèse globale du jour" color="rose">
        <TextArea label="Points forts" value={data.strengths} onChange={(v) => set("strengths", v)} />
        <TextArea label="Points à améliorer" value={data.improvements} onChange={(v) => set("improvements", v)} />
        <TextArea label="Recommandations" value={data.recommendations} onChange={(v) => set("recommendations", v)} />
      </SectionCard>

      {/* Save button */}
      <div className="sticky bottom-0 z-10 flex justify-end gap-2 pt-4 pb-2 bg-white border-t border-slate-100">
        <button onClick={onBack} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">
          Annuler
        </button>
        <button
          onClick={() => onSave(data)}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer le rapport
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Formulaire rapport de fin de semaine (7 sections)
// ============================================================================

function WeeklySummaryForm({
  summary, onSave, onSubmit, onBack, saving,
}: {
  summary: any;
  onSave: (data: any) => void;
  onSubmit: () => void;
  onBack: () => void;
  saving: boolean;
}) {
  const [data, setData] = useState<any>({});

  useEffect(() => {
    setData({
      globalLevel: summary.globalLevel || "",
      generalObservations: summary.generalObservations || "",
      scheduleRespect: summary.scheduleRespect || "",
      engagedTeachers: summary.engagedTeachers || "",
      recurringDifficulties: summary.recurringDifficulties || "",
      studentBehavior: summary.studentBehavior || "",
      specialFollowUp: summary.specialFollowUp || "",
      criticalPoints: summary.criticalPoints || "",
      urgentInterventions: summary.urgentInterventions || "",
      weeklyVisits: summary.weeklyVisits || "",
      visitorRecommendations: summary.visitorRecommendations || "",
      priorityActions: summary.priorityActions || "",
    });
  }, [summary]);

  const set = (key: string, value: any) => setData((prev: any) => ({ ...prev, [key]: value }));
  const isSubmitted = summary.status !== "DRAFT";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Rapport de fin de semaine {summary.weekNumber}</h3>
            <p className="text-sm text-slate-500">
              Du {new Date(summary.weekStartDate).toLocaleDateString("fr-FR")} au {new Date(summary.weekEndDate).toLocaleDateString("fr-FR")}
            </p>
          </div>
        </div>
        {summary.status === "SUBMITTED" && <span className="px-3 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold">En attente de validation</span>}
        {summary.status === "VALIDATED" && <span className="px-3 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold">✅ Validé</span>}
        {summary.status === "REJECTED" && <span className="px-3 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-bold">❌ Rejeté</span>}
      </div>

      {summary.rejectionReason && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <strong>Motif du rejet :</strong> {summary.rejectionReason}
        </div>
      )}

      {/* Section 1: Fonctionnement général */}
      <SectionCard icon={Star} title="1. Fonctionnement général de la semaine" color="blue">
        <RadioGroup label="Niveau global de fonctionnement" value={data.globalLevel} onChange={(v) => set("globalLevel", v)} options={["EXCELLENT", "BON", "MOYEN", "A_RENFORCER"]} disabled={isSubmitted} />
        <TextArea label="Observations générales" value={data.generalObservations} onChange={(v) => set("generalObservations", v)} disabled={isSubmitted} />
      </SectionCard>

      {/* Section 2: Synthèse pédagogique */}
      <SectionCard icon={BookOpen} title="2. Synthèse pédagogique" color="indigo">
        <TextArea label="Respect global des emplois du temps" value={data.scheduleRespect} onChange={(v) => set("scheduleRespect", v)} disabled={isSubmitted} />
        <TextArea label="Enseignants ayant montré un engagement remarquable" value={data.engagedTeachers} onChange={(v) => set("engagedTeachers", v)} disabled={isSubmitted} />
        <TextArea label="Difficultés pédagogiques récurrentes" value={data.recurringDifficulties} onChange={(v) => set("recurringDifficulties", v)} disabled={isSubmitted} />
      </SectionCard>

      {/* Section 3: Discipline & vie scolaire */}
      <SectionCard icon={Shield} title="3. Synthèse discipline & vie scolaire" color="amber">
        <TextArea label="Comportement global des élèves" value={data.studentBehavior} onChange={(v) => set("studentBehavior", v)} disabled={isSubmitted} />
        <TextArea label="Cas ayant nécessité un suivi particulier" value={data.specialFollowUp} onChange={(v) => set("specialFollowUp", v)} disabled={isSubmitted} />
      </SectionCard>

      {/* Section 4: Infrastructures & logistique */}
      <SectionCard icon={Wrench} title="4. Infrastructures & logistique" color="emerald">
        <TextArea label="Points critiques observés cette semaine" value={data.criticalPoints} onChange={(v) => set("criticalPoints", v)} disabled={isSubmitted} />
        <TextArea label="Interventions urgentes recommandées" value={data.urgentInterventions} onChange={(v) => set("urgentInterventions", v)} disabled={isSubmitted} />
      </SectionCard>

      {/* Section 5: Bilan des visites */}
      <SectionCard icon={Eye} title="5. Bilan des visites de la semaine" color="purple">
        <TextArea label="Visites officielles" value={data.weeklyVisits} onChange={(v) => set("weeklyVisits", v)} disabled={isSubmitted} />
        <TextArea label="Recommandations / retours des visiteurs" value={data.visitorRecommendations} onChange={(v) => set("visitorRecommendations", v)} disabled={isSubmitted} />
      </SectionCard>

      {/* Section 6: Statistiques de la semaine — tableau */}
      <SectionCard icon={FileText} title="6. Statistiques de la semaine" color="cyan">
        <p className="text-xs text-slate-500 mb-2">Tableau récapitulatif des indicateurs (Lun→Ven + Moyenne)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2 font-semibold text-slate-700">Indicateur</th>
              <th className="text-center px-3 py-2 font-semibold text-slate-700">Lun</th>
              <th className="text-center px-3 py-2 font-semibold text-slate-700">Mar</th>
              <th className="text-center px-3 py-2 font-semibold text-slate-700">Mer</th>
              <th className="text-center px-3 py-2 font-semibold text-slate-700">Jeu</th>
              <th className="text-center px-3 py-2 font-semibold text-slate-700">Ven</th>
              <th className="text-center px-3 py-2 font-semibold text-slate-700">Moy.</th>
            </tr></thead>
            <tbody>
              {["Taux présence (%)", "Retards", "Absences"].map(indic => (
                <tr key={indic} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-700">{indic}</td>
                  {Array.from({ length: 6 }, (_, i) => <td key={i} className="px-3 py-2 text-center text-slate-400">—</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Section 7: Recommandations stratégiques */}
      <SectionCard icon={Star} title="7. Recommandations stratégiques pour la semaine suivante" color="rose">
        <TextArea label="Actions prioritaires" value={data.priorityActions} onChange={(v) => set("priorityActions", v)} disabled={isSubmitted} />
      </SectionCard>

      {/* Actions */}
      {!isSubmitted && (
        <div className="sticky bottom-0 z-10 flex justify-end gap-2 pt-4 pb-2 bg-white border-t border-slate-100">
          <button onClick={onBack} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">
            Annuler
          </button>
          <button
            onClick={() => onSave(data)}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Soumettre au directeur
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Composants UI réutilisables
// ============================================================================

function SectionCard({ icon: Icon, title, color, children }: { icon: any; title: string; color: string; children: React.ReactNode }) {
  const colorMap: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50/30",
    cyan: "border-cyan-200 bg-cyan-50/30",
    indigo: "border-indigo-200 bg-indigo-50/30",
    amber: "border-amber-200 bg-amber-50/30",
    emerald: "border-emerald-200 bg-emerald-50/30",
    purple: "border-purple-200 bg-purple-50/30",
    pink: "border-pink-200 bg-pink-50/30",
    rose: "border-rose-200 bg-rose-50/30",
  };
  const iconColorMap: Record<string, string> = {
    blue: "text-blue-600 bg-blue-100",
    cyan: "text-cyan-600 bg-cyan-100",
    indigo: "text-indigo-600 bg-indigo-100",
    amber: "text-amber-600 bg-amber-100",
    emerald: "text-emerald-600 bg-emerald-100",
    purple: "text-purple-600 bg-purple-100",
    pink: "text-pink-600 bg-pink-100",
    rose: "text-rose-600 bg-rose-100",
  };
  return (
    <div className={`rounded-xl border p-4 sm:p-5 ${colorMap[color] || "border-slate-200 bg-white"}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`grid place-items-center h-8 w-8 rounded-lg ${iconColorMap[color] || "bg-slate-100 text-slate-600"}`}>
          <Icon className="h-4 w-4" />
        </div>
        <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function TextArea({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={2}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-slate-50 disabled:text-slate-400"
      />
    </div>
  );
}

function Input({ label, value, onChange, type, disabled }: { label: string; value: any; onChange: (v: string) => void; type?: string; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input
        type={type || "text"}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-slate-50 disabled:text-slate-400"
      />
    </div>
  );
}

function RadioGroup({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (v: string) => void; options: string[]; disabled?: boolean }) {
  const labelMap: Record<string, string> = {
    OUI: "Oui", NON: "Non", PARTIEL: "Partiel",
    CALME: "Calme", MOYEN: "Moyen", PERTURBE: "Perturbé",
    TRES_BONNE: "Très bonne", BONNE: "Bonne", ACCEPTABLE: "Acceptable", INSUFFISANTE: "Insuffisante",
    TRES_PROPRES: "Très propres", CORRECTES: "Correctes", A_REVOIR: "À revoir", INSALUBRES: "Insalubres",
    NORMALE: "Normale", INSTABLE: "Instable", COUPURE: "Coupure",
    EXCELLENT: "Excellent", BON: "Bon", A_RENFORCER: "À renforcer",
  };
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              value === opt
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {labelMap[opt] || opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
        checked ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
      )}
    >
      <div className={cn("h-4 w-4 rounded border-2 flex items-center justify-center", checked ? "bg-emerald-500 border-emerald-500" : "border-slate-300")}>
        {checked && <CheckCircle2 className="h-3 w-3 text-white" />}
      </div>
      {label}
    </button>
  );
}

function cn(...c: (string | boolean | undefined)[]) { return c.filter(Boolean).join(" "); }
