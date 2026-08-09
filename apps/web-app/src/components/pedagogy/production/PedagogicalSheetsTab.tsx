"use client";

/**
 * ============================================================================
 * FICHES PÉDAGOGIQUES PRIMAIRE — Structure conforme aux PDFs officiels
 * ============================================================================
 *
 * 5 types : MATH, FRANCAIS, EST (Éducation Scientifique et Technologique),
 *          ES (Éducation Sociale), EA (Éducation Artistique)
 *
 * Structure commune (conforme aux PDFs) :
 *   En-tête : SAN°, Séquence N°, Date, Cours, Titre, Durée
 *   I- Éléments de planification :
 *     1. Compétences disciplinaires
 *     2. Compétences transversales
 *     3. Compétences transdisciplinaires
 *     4. Connaissances et techniques
 *     5. Stratégie objet d'apprentissage
 *     6. Stratégie d'enseignement/apprentissage/évaluation
 *     7. Matériel
 *   I.bis- Section spécifique au type (Phases préparatoires / Exercice structural / etc.)
 *   II- Déroulement (tableau N° / Consignes / Résultats attendus)
 *        avec phases : Introduction, Réalisation, Retour et projection
 *   III- Retour et projection : Objectivation, Évaluation, Projection
 *   Signatures : Maître/Maîtresse + Directeur/Directrice
 *
 * Tous les champs utilisent RichTextEditor (gras, italique, souligné, puces).
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  FileText, Loader2, Plus, Save, RefreshCw, Send, Trash2,
  ChevronLeft, Clock, CheckCircle2, XCircle, BookOpen, Sigma,
  FlaskConical, Users, Palette,
} from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { SignatureCanvas } from "@/components/ui/SignatureCanvas";
import { useAppSession } from "@/contexts/AppSessionContext";

interface PedagogicalSheetsTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
  /** ⭐ ID du cahier journal auquel rattacher les nouvelles fiches créées depuis l'UI du cahier journal */
  cahierJournalId?: string;
  /** ⭐ Jour initial (lundi/mardi/...) pour pré-remplir la date de la leçon */
  initialLessonDay?: string;
  /** ⭐ Type de fiche initial (MATH/FRANCAIS/EST/ES/EA) deviné depuis la matière */
  initialSheetType?: string;
  /** ⭐ Matière initiale (clé matière du cahier journal, ex: "francais") */
  initialMatiere?: string;
}

const SHEET_TYPES = [
  { type: "MATH", label: "Mathématiques", icon: Sigma, color: "bg-blue-100 text-blue-700 border-blue-200", headerBg: "bg-blue-600", sectionBorder: "border-blue-300" },
  { type: "FRANCAIS", label: "Français", icon: BookOpen, color: "bg-emerald-100 text-emerald-700 border-emerald-200", headerBg: "bg-emerald-600", sectionBorder: "border-emerald-300" },
  { type: "EST", label: "Éducation Scientifique et Technologique", icon: FlaskConical, color: "bg-purple-100 text-purple-700 border-purple-200", headerBg: "bg-purple-600", sectionBorder: "border-purple-300" },
  { type: "ES", label: "Éducation Sociale", icon: Users, color: "bg-amber-100 text-amber-700 border-amber-200", headerBg: "bg-amber-600", sectionBorder: "border-amber-300" },
  { type: "EA", label: "Éducation Artistique", icon: Palette, color: "bg-pink-100 text-pink-700 border-pink-200", headerBg: "bg-pink-600", sectionBorder: "border-pink-300" },
] as const;

const STATUS_CONFIG = {
  DRAFT: { label: "Brouillon", color: "bg-slate-100 text-slate-600", icon: Clock },
  SUBMITTED: { label: "Soumis", color: "bg-blue-100 text-blue-700", icon: Send },
  VALIDATED: { label: "Validé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  REJECTED: { label: "Rejeté", color: "bg-red-100 text-red-700", icon: XCircle },
} as const;

function cn(...c: (string | false | undefined)[]) { return c.filter(Boolean).join(" "); }
function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function formatDateFR(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ⭐ Configuration spécifique par type de fiche
// Chaque type a une section "I.bis" différente entre les éléments de planification
// et le déroulement.
const SHEET_TYPE_CONFIG: Record<string, {
  ibisTitle: string;
  ibisFields: { label: string; key: string; placeholder: string; short?: boolean }[];
  phases?: { label: string; key: string }[];
  applicationTable?: { columns: string[]; keys: string[] };
}> = {
  MATH: {
    ibisTitle: "Phases préparatoires",
    ibisFields: [
      { label: "Calcule à brûle pourpoint", key: "ibis_1", placeholder: "Ex: Activité de calcul rapide..." },
      { label: "Comptage/Décomptage ou table de multiplication", key: "ibis_2", placeholder: "Ex: Table de 7, comptage de 10 en 10..." },
      { label: "Cadran opératoire (en rapport avec les opérations étudiées)", key: "ibis_3", placeholder: "Ex: Addition, soustraction..." },
      { label: "Calcul mental", key: "ibis_4", placeholder: "Ex: Technique de calcul mental à faire acquérir..." },
      { label: "Deux problèmes à résoudre mentalement", key: "ibis_5", placeholder: "Ex: Problème 1: ..., Problème 2: ..." },
    ],
  },
  FRANCAIS: {
    ibisTitle: "Exercice structural",
    ibisFields: [
      { label: "Unité N°", key: "ibis_1", placeholder: "Ex: Unité 3", short: true },
      { label: "Structure", key: "ibis_2", placeholder: "Ex: Situation initiale → élément modificateur → déroulement → situation finale", short: true },
      { label: "Objectif", key: "ibis_3", placeholder: "Ex: Identifier les étapes d'un récit...", short: true },
      { label: "Fiche N°", key: "ibis_4", placeholder: "Ex: Fiche 1", short: true },
      { label: "Durée (10 minutes)", key: "ibis_5", placeholder: "Ex: 10 min", short: true },
    ],
    phases: [
      { label: "Phase introductive", key: "phase_introductive" },
      { label: "Phase de systématisation", key: "phase_systematisation" },
    ],
    // ⭐ Phase d'application = tableau 3 colonnes (conforme au PDF)
    applicationTable: {
      columns: ["Entrées Enseignant(e) ou élève", "Structure Élève 1", "Réduction Élève 2"],
      keys: ["app_col1", "app_col2", "app_col3"],
    },
  },
  EST: {
    ibisTitle: "Activités préliminaires",
    ibisFields: [
      { label: "Rappel de la leçon précédente", key: "ibis_1", placeholder: "Ex: Questions orales, réponses écrites (PLM), récitation..." },
    ],
  },
  ES: {
    ibisTitle: "Activités préliminaires",
    ibisFields: [
      { label: "Rappel de la leçon précédente", key: "ibis_1", placeholder: "Ex: Questions orales, réponses orales, questions écrites (PLM)..." },
    ],
  },
  EA: {
    ibisTitle: "Proposition de nouvelles acquisitions",
    ibisFields: [
      { label: "Annoncer l'objet d'apprentissage (titre du chant/dessin)", key: "ibis_1", placeholder: "Ex: Annoncer le titre du chant à apprendre..." },
      { label: "Pré-conception", key: "ibis_2", placeholder: "Ex: Demander aux enfants s'ils connaissent le chant à partir du titre..." },
    ],
  },
};

export function PedagogicalSheetsTab({ tenantId, academicYearId, teacherId, cahierJournalId, initialLessonDay, initialSheetType, initialMatiere }: PedagogicalSheetsTabProps) {
  const { user } = useAppSession();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [fiches, setFiches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingFiche, setEditingFiche] = useState<any>(null);
  const [filterType, setFilterType] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // ⭐ États pour les noms résolus (titulaire + directeur)
  const [teacherName, setTeacherName] = useState<string>("");
  const [directorInfo, setDirectorInfo] = useState<{
    fullName: string;
    gender: string | null;
    signatureDataUrl: string | null;
    signatureUploadedUrl: string | null;
  } | null>(null);

  const emptyForm: any = {
    classId: "", sheetType: "MATH",
    schoolName: "", className: "", academicYearLabel: "",
    san: "", sequence: "", lessonDate: formatDate(new Date().toISOString()),
    cours: "", titre: "", duree: "",
    // I- Éléments de planification (7 champs — tous RichTextEditor)
    competence: "", habilete: "", prealable: "", contenu: "",
    methodes: "", moyensDidactiques: "", evaluation: "",
    // I.bis- Section spécifique (champs dynamiques ibis_1, ibis_2, etc.)
    ibis_1: "", ibis_2: "", ibis_3: "", ibis_4: "", ibis_5: "",
    // ⭐ Phases spécifiques au français
    phase_introductive: "", phase_systematisation: "",
    // ⭐ Phase d'application (tableau 3 colonnes)
    app_col1: "", app_col2: "", app_col3: "",
    // II- Déroulement (tableau d'étapes)
    deroulement: [] as Array<{ etape: string; consignes: string; resultats: string }>,
    // III- Retour et projection
    objectivation: "", evalRetour: "", projection: "",
    // Ruban administratif
    adminDate: formatDate(new Date().toISOString()),
    adminWeek: 1, adminHoraire: "", adminDuree: 30,
    // Effectifs
    boysCount: 0, girlsCount: 0, totalStudents: 0,
    boysPresent: 0, girlsPresent: 0, totalPresent: 0,
    boysAbsent: 0, girlsAbsent: 0, totalAbsent: 0,
    // Signatures
    teacherSignature: null as string | null,
    directorSignature: null as string | null,
  };
  const [form, setForm] = useState<any>(emptyForm);

  // === Chargement ===
  const loadClasses = useCallback(async () => {
    try {
      const res = await fetch(`/api/pedagogy-space/my-classes?teacherId=${teacherId}&academicYearId=${academicYearId}`, { credentials: "include" });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setClasses(list);
      // ⭐ Auto-sélectionner la 1ère classe si aucune sélectionnée (pour pré-remplir les signatures)
      if (list.length > 0 && !selectedClassId) setSelectedClassId(list[0].classId);
    } catch { setClasses([]); }
  }, [teacherId, academicYearId, selectedClassId]);

  const loadFiches = useCallback(async () => {
    if (!selectedClassId) { setFiches([]); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ teacherId, academicYearId, classId: selectedClassId });
      if (filterType) params.append("sheetType", filterType);
      const res = await fetch(`/api/pedagogy-space/fiches?${params.toString()}`, { credentials: "include" });
      setFiches(Array.isArray(await res.json()) ? await res.json() : []);
    } catch { setFiches([]); }
    finally { setLoading(false); }
  }, [teacherId, academicYearId, filterType, selectedClassId]);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => { loadFiches(); }, [loadFiches]);

  // ⭐ Résoudre le VRAI titulaire de la classe + le directeur dès que la classe change
  //    (même si c'est le promoteur qui est connecté, on doit afficher le titulaire réel)
  useEffect(() => {
    if (!selectedClassId) {
      setTeacherName("");
      setDirectorInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      // 1. Récupérer le titulaire de la classe via TeacherClassAssignment
      try {
        const res = await fetch(`/api/pedagogy/teacher-class-assignments?classId=${encodeURIComponent(selectedClassId)}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const assignments = Array.isArray(data) ? data : (data?.items || []);
          const firstAssignment = assignments[0];
          if (firstAssignment && !cancelled) {
            const firstName = firstAssignment.teacherFirstName || firstAssignment.teacher?.firstName || '';
            const lastName = firstAssignment.teacherLastName || firstAssignment.teacher?.lastName || '';
            const gender = firstAssignment.teacherGender || firstAssignment.teacher?.gender || null;
            const civility = gender === 'F' ? 'Mme' : (gender === 'M' ? 'M.' : '');
            const name = (lastName || firstName) ? `${civility} ${(lastName || '').toUpperCase()} ${firstName}`.trim() : '';
            setTeacherName(name);
          } else if (!cancelled) {
            // Fallback sur le user connecté
            setTeacherName(user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '');
          }
        }
      } catch {
        if (!cancelled) {
          setTeacherName(user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '');
        }
      }

      // 2. Récupérer le directeur depuis school_directors (par niveau scolaire de la classe)
      try {
        // D'abord récupérer le schoolLevelId de la classe sélectionnée
        const cls = classes.find(c => c.classId === selectedClassId);
        const schoolLevelId = cls?.schoolLevelId || cls?.school_level_id;
        if (schoolLevelId) {
          const dirRes = await fetch(`/api/hr/school-directors/by-level?schoolLevelId=${encodeURIComponent(schoolLevelId)}&language=FR`, { credentials: 'include' });
          let dirData = null;
          if (dirRes.ok) {
            dirData = await dirRes.json();
          } else {
            // Fallback EN
            const dirRes2 = await fetch(`/api/hr/school-directors/by-level?schoolLevelId=${encodeURIComponent(schoolLevelId)}&language=EN`, { credentials: 'include' });
            if (dirRes2.ok) dirData = await dirRes2.json();
          }
          if (!cancelled && dirData) {
            setDirectorInfo({
              fullName: dirData.fullName || '',
              gender: dirData.gender || null,
              signatureDataUrl: dirData.signatureDataUrl || null,
              signatureUploadedUrl: dirData.signatureUploadedUrl || null,
            });
          }
        }
      } catch {
        // Silent fail — directorInfo reste null
      }
    })();
    return () => { cancelled = true; };
  }, [selectedClassId, classes, user]);

  // ⭐ Construire le label "Directeur" ou "Directrice" selon le genre
  const directorLabel = directorInfo?.gender === 'F' ? 'La Directrice' : 'Le Directeur';
  const directorDisplayName = directorInfo?.fullName || 'Nom du directeur';

  // ⭐ Pré-remplissage automatique quand l'utilisateur clique sur "Préparer la fiche"
  //    pour [jour] [matière] depuis le cahier journal.
  useEffect(() => {
    if (!initialSheetType && !initialLessonDay && !initialMatiere) return;
    // Calculer la date de la leçon à partir du jour de la semaine (lundi=1, ..., vendredi=5)
    // en utilisant la semaine courante.
    if (initialLessonDay) {
      const dayNums: Record<string, number> = { lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5 };
      const targetDayNum = dayNums[initialLessonDay.toLowerCase()];
      if (targetDayNum !== undefined) {
        const today = new Date();
        const monday = new Date(today);
        const currentDay = today.getDay() === 0 ? 7 : today.getDay(); // 0=dim → 7
        monday.setDate(today.getDate() - (currentDay - 1)); // revenir à lundi
        const lessonDate = new Date(monday);
        lessonDate.setDate(monday.getDate() + (targetDayNum - 1));
        const y = lessonDate.getFullYear();
        const m = String(lessonDate.getMonth() + 1).padStart(2, "0");
        const d = String(lessonDate.getDate()).padStart(2, "0");
        setForm((p: any) => ({ ...p, lessonDate: `${y}-${m}-${d}` }));
      }
    }
    if (initialSheetType) {
      setForm((p: any) => ({ ...p, sheetType: initialSheetType }));
    }
    if (initialMatiere) {
      // Mettre le nom de la matière dans le champ "titre" ou "cours"
      setForm((p: any) => ({
        ...p,
        cours: p.cours || initialMatiere.charAt(0).toUpperCase() + initialMatiere.slice(1),
        titre: p.titre || `Fiche ${initialMatiere}`,
      }));
    }
    // Ouvrir automatiquement le formulaire
    setShowForm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSheetType, initialLessonDay, initialMatiere]);

  // === CRUD ===
  const handleCreateOrUpdate = async () => {
    if (!form.classId || !form.sheetType) { toast.error("Veuillez sélectionner une classe et un type de fiche"); return; }
    setSaving(true);
    try {
      const url = editingFiche ? `/api/pedagogy-space/fiches/${editingFiche.id}` : "/api/pedagogy-space/fiches";
      const method = editingFiche ? "PUT" : "POST";
      const body = editingFiche
        ? { ...form }
        : { ...form, academicYearId, teacherId, cahierJournalId: cahierJournalId || undefined };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      toast.success(editingFiche ? "✅ Fiche mise à jour" : "✅ Fiche créée");
      setShowForm(false); setEditingFiche(null); setForm(emptyForm); loadFiches();
    } catch (e: any) { toast.error("Erreur", { description: e.message }); }
    finally { setSaving(false); }
  };

  const handleEdit = (fiche: any) => {
    setEditingFiche(fiche);
    setForm({
      ...emptyForm, ...fiche,
      lessonDate: fiche.lessonDate ? formatDate(fiche.lessonDate) : "",
      adminDate: fiche.adminDate ? formatDate(fiche.adminDate) : "",
      deroulement: Array.isArray(fiche.deroulement) ? fiche.deroulement :
        (typeof fiche.deroulement === "string" ? JSON.parse(fiche.deroulement || "[]") : []),
    });
    setShowForm(true);
  };

  const handleDelete = async (fiche: any) => {
    if (!confirm(`Supprimer cette fiche (${fiche.sheetType}) ?`)) return;
    try { await fetch(`/api/pedagogy-space/fiches/${fiche.id}`, { method: "DELETE", credentials: "include" }); toast.success("Fiche supprimée"); loadFiches(); }
    catch (e: any) { toast.error("Erreur", { description: e.message }); }
  };

  const handleSubmit = async (fiche: any) => {
    if (!confirm("Soumettre cette fiche au directeur ?")) return;
    try { await fetch(`/api/pedagogy-space/fiches/${fiche.id}/submit`, { method: "POST", credentials: "include" }); toast.success("✅ Fiche soumise"); loadFiches(); }
    catch (e: any) { toast.error("Erreur", { description: e.message }); }
  };

  // === Déroulement ===
  const addStep = () => setForm((p: any) => ({ ...p, deroulement: [...(p.deroulement || []), { etape: "", consignes: "", resultats: "" }] }));
  const updateStep = (idx: number, field: string, val: string) => setForm((p: any) => ({ ...p, deroulement: (p.deroulement || []).map((s: any, i: number) => i === idx ? { ...s, [field]: val } : s) }));
  const removeStep = (idx: number) => setForm((p: any) => ({ ...p, deroulement: (p.deroulement || []).filter((_: any, i: number) => i !== idx) }));

  const onClassChange = (classId: string) => {
    const cls = classes.find(c => c.classId === classId);
    if (cls) setForm((p: any) => ({ ...p, classId, className: cls.className || "", boysCount: cls.boys || 0, girlsCount: cls.girls || 0, totalStudents: cls.totalStudents || 0, boysPresent: cls.boys || 0, girlsPresent: cls.girls || 0, totalPresent: cls.totalStudents || 0, boysAbsent: 0, girlsAbsent: 0, totalAbsent: 0 }));
  };

  const isReadOnly = form.status && form.status !== "DRAFT";
  const sheetType = SHEET_TYPES.find(t => t.type === form.sheetType);
  const typeConfig = SHEET_TYPE_CONFIG[form.sheetType] || SHEET_TYPE_CONFIG.MATH;

  // === RENDU FORMULAIRE ===
  if (showForm) {
    return (
      <div className="space-y-4">
        {/* Barre d'actions */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
          <button onClick={() => { setShowForm(false); setEditingFiche(null); setForm(emptyForm); }}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">
            <ChevronLeft className="h-4 w-4" /> Retour à la liste
          </button>
          <div className="text-sm font-semibold text-slate-700">{editingFiche ? "Modifier la fiche" : "Nouvelle fiche pédagogique"}</div>
          <button onClick={handleCreateOrUpdate} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editingFiche ? "Mettre à jour" : "Créer la fiche"}
          </button>
        </div>

        {/* Sélection du type de fiche */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <label className="block text-xs font-bold text-slate-700 uppercase mb-3">Type de fiche pédagogique</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {SHEET_TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.type} type="button"
                  onClick={() => setForm((p: any) => ({ ...p, sheetType: t.type }))}
                  className={cn("flex flex-col items-center gap-2 p-3 border-2 rounded-lg text-xs font-semibold transition-all",
                    form.sheetType === t.type ? t.color : "bg-white text-slate-500 border-slate-200 hover:border-slate-300")}>
                  <Icon className="h-5 w-5" /><span className="text-center">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* === Document — Structure conforme au PDF === */}
        <div className={cn("bg-white rounded-xl border-2 p-6 space-y-6", sheetType?.sectionBorder || "border-slate-800")}>
          {/* En-tête avec couleur spécifique au type */}
          <div className={cn("text-center border-b-2 pb-3 rounded-t-lg -mx-6 -mt-6 px-6 py-3", sheetType?.headerBg || "bg-slate-800")}>
            <h2 className="text-lg font-bold text-white uppercase">
              FICHE DE {form.sheetType === "MATH" ? "MATHÉMATIQUE" : form.sheetType === "FRANCAIS" ? "FRANÇAIS" : sheetType?.label.toUpperCase()}
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: "SAN°", key: "san" }, { label: "Séquence N°", key: "sequence" },
              { label: "Date", key: "lessonDate", type: "date" }, { label: "Cours", key: "cours" },
              { label: "Titre", key: "titre" }, { label: "Durée", key: "duree" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
                <input type={f.type || "text"} value={form[f.key] || ""} onChange={e => setForm({ ...form, [f.key]: e.target.value })} disabled={isReadOnly}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Classe</label>
              {/* ⭐ Classe pré-remplie depuis la sélection (read-only) */}
              <div className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm font-medium bg-slate-50">
                {form.className || classes.find(c => c.classId === form.classId)?.className || "—"}
              </div>
            </div>
          </div>

          {/* I- Éléments de planification (7 champs RichTextEditor) */}
          <section className="border-l-4 border-slate-300 pl-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 bg-slate-100 px-3 py-2 rounded-lg">
              I- Éléments de planification
            </h3>
            <div className="space-y-3">
              {[
                { label: "Compétences disciplinaires", key: "competence" },
                { label: "Compétences transversales", key: "habilete" },
                { label: "Compétences transdisciplinaires", key: "prealable" },
                { label: "Connaissances et techniques", key: "contenu" },
                { label: "Stratégie objet d'apprentissage", key: "methodes" },
                { label: "Stratégie d'enseignement/apprentissage/évaluation", key: "moyensDidactiques" },
                { label: "Matériel", key: "evaluation" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{f.label}</label>
                  <RichTextEditor value={form[f.key] || ""} onChange={html => setForm({ ...form, [f.key]: html })} disabled={isReadOnly} minHeight="60px" />
                </div>
              ))}
            </div>
          </section>

          {/* I.bis- Section spécifique au type */}
          <section className="border-l-4 pl-4" style={{ borderColor: sheetType?.headerBg?.replace('bg-', '') || '#3b82f6' }}>
            <h3 className={cn("text-sm font-bold text-white uppercase mb-3 px-3 py-2 rounded-lg", sheetType?.headerBg || "bg-slate-600")}>
              {typeConfig.ibisTitle} — {sheetType?.label}
            </h3>
            <div className={cn("space-y-3", typeConfig.ibisFields.some(f => f.short) ? "grid grid-cols-1 md:grid-cols-3 gap-3" : "")}>
              {typeConfig.ibisFields.map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{f.label}</label>
                  {f.short ? (
                    /* ⭐ Champ court (input text) — pour Unité, Structure, Objectif, Fiche N°, Durée */
                    <input type="text" value={form[f.key] || ""} onChange={e => setForm({ ...form, [f.key]: e.target.value })} disabled={isReadOnly}
                      placeholder={f.placeholder} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  ) : (
                    /* ⭐ Champ long (RichTextEditor) */
                    <RichTextEditor value={form[f.key] || ""} onChange={html => setForm({ ...form, [f.key]: html })} disabled={isReadOnly} minHeight="60px" />
                  )}
                </div>
              ))}
            </div>
            {/* ⭐ Phases spécifiques (Phase introductive, systématisation) */}
            {typeConfig.phases && (
              <div className="mt-4 space-y-3">
                {typeConfig.phases.map(p => (
                  <div key={p.key}>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{p.label}</label>
                    <RichTextEditor value={form[p.key] || ""} onChange={html => setForm({ ...form, [p.key]: html })} disabled={isReadOnly} minHeight="60px" />
                  </div>
                ))}
              </div>
            )}
            {/* ⭐ Phase d'application (tableau 3 colonnes — spécifique au français) */}
            {typeConfig.applicationTable && (
              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-700 mb-2">Phase d'application</label>
                <div className="overflow-x-auto border border-slate-300 rounded-lg">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className={cn("text-white", sheetType?.headerBg || "bg-slate-600")}>
                        {typeConfig.applicationTable.columns.map((col, i) => (
                          <th key={i} className="border border-slate-300 px-3 py-2 text-xs font-bold uppercase text-center">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {typeConfig.applicationTable.keys.map((key, i) => (
                          <td key={i} className="border border-slate-300 p-0 align-top" style={{ minWidth: "200px" }}>
                            <RichTextEditor value={form[key] || ""} onChange={html => setForm({ ...form, [key]: html })} disabled={isReadOnly} minHeight="120px" />
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* II- Déroulement (tableau N° / Consignes / Résultats attendus) */}
          <section className="border-l-4 border-slate-300 pl-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase bg-slate-100 px-3 py-2 rounded-lg">
                II- Déroulement
              </h3>
              {!isReadOnly && (
                <button type="button" onClick={addStep} className="flex items-center gap-1 px-2 py-1 ml-2 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100">
                  <Plus className="h-3 w-3" /> Ajouter une ligne
                </button>
              )}
            </div>
            <div className="overflow-x-auto border border-slate-300 rounded-lg">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">N°</th>
                    <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase">Consignes</th>
                    <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase">Résultats attendus</th>
                    {!isReadOnly && <th className="border border-slate-300 px-2 py-2 w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {(form.deroulement || []).map((step: any, idx: number) => (
                    <tr key={idx}>
                      <td className="border border-slate-300 px-2 py-1 text-center font-bold">{idx + 1}</td>
                      <td className="border border-slate-300 p-0">
                        <RichTextEditor value={step.consignes || ""} onChange={html => updateStep(idx, "consignes", html)} disabled={isReadOnly} minHeight="60px" />
                      </td>
                      <td className="border border-slate-300 p-0">
                        <RichTextEditor value={step.resultats || ""} onChange={html => updateStep(idx, "resultats", html)} disabled={isReadOnly} minHeight="60px" />
                      </td>
                      {!isReadOnly && (
                        <td className="border border-slate-300 px-2 py-1 text-center">
                          <button type="button" onClick={() => removeStep(idx)} className="text-red-500 hover:bg-red-50 rounded p-1"><Trash2 className="h-3 w-3" /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {(!form.deroulement || form.deroulement.length === 0) && (
                    <tr><td colSpan={isReadOnly ? 3 : 4} className="border border-slate-300 px-4 py-4 text-center text-slate-400 text-xs italic">Aucune ligne. Cliquez sur "Ajouter une ligne".</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* III- Retour et projection */}
          <section className="border-l-4 border-slate-300 pl-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 bg-slate-100 px-3 py-2 rounded-lg">
              III- Retour et projection
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Objectivation</label>
                <RichTextEditor value={form.objectivation || ""} onChange={html => setForm({ ...form, objectivation: html })} disabled={isReadOnly} minHeight="60px" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Évaluation</label>
                <RichTextEditor value={form.evalRetour || ""} onChange={html => setForm({ ...form, evalRetour: html })} disabled={isReadOnly} minHeight="60px" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Projection</label>
                <RichTextEditor value={form.projection || ""} onChange={html => setForm({ ...form, projection: html })} disabled={isReadOnly} minHeight="60px" />
              </div>
            </div>
          </section>

          {/* Signatures (SignatureCanvas) */}
          <section className="border-t-2 border-slate-300 pt-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase mb-3">Signatures</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-800">Le Maître / La Maîtresse</div>
                    <div className="text-xs text-slate-500">
                      {/* ⭐ Afficher le VRAI titulaire de la classe (résolu via TeacherClassAssignment) */}
                      {teacherName || (user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '')}
                    </div>
                  </div>
                  {form.teacherSignature && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full"><CheckCircle2 className="h-3 w-3" /> Signé</span>}
                </div>
                {form.teacherSignature ? (
                  <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2"><img src={form.teacherSignature} alt="" className="max-h-24 mx-auto" /></div>
                ) : (
                  <SignatureCanvas width={400} height={120} disabled={isReadOnly} placeholder="Signature" onSignatureChange={d => setForm({ ...form, teacherSignature: d })} />
                )}
                {form.teacherSignature && !isReadOnly && <button type="button" onClick={() => setForm({ ...form, teacherSignature: null })} className="text-xs text-red-500 hover:underline">Effacer</button>}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    {/* ⭐ Label dynamique : "Le Directeur" ou "La Directrice" selon le genre */}
                    <div className="text-sm font-bold text-slate-800">{directorLabel} / La Directrice</div>
                    <div className="text-xs text-slate-500">{directorDisplayName} — Signature et cachet</div>
                  </div>
                  {(form.directorSignature || directorInfo?.signatureDataUrl || directorInfo?.signatureUploadedUrl) && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full"><CheckCircle2 className="h-3 w-3" /> Signé</span>}
                </div>
                {/* ⭐ Afficher la signature du directeur depuis RH si dispo, sinon le canvas */}
                {form.directorSignature ? (
                  <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2"><img src={form.directorSignature} alt="" className="max-h-24 mx-auto" /></div>
                ) : (directorInfo?.signatureDataUrl || directorInfo?.signatureUploadedUrl) ? (
                  <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2"><img src={directorInfo.signatureDataUrl || directorInfo.signatureUploadedUrl || ''} alt="" className="max-h-24 mx-auto" /></div>
                ) : (
                  <SignatureCanvas width={400} height={120} disabled={isReadOnly} placeholder="Signature" onSignatureChange={d => setForm({ ...form, directorSignature: d })} />
                )}
                {form.directorSignature && !isReadOnly && <button type="button" onClick={() => setForm({ ...form, directorSignature: null })} className="text-xs text-red-500 hover:underline">Effacer</button>}
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // === Vue liste ===
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
        {/* ⭐ Sélecteur de classe (obligatoire avant "Nouvelle fiche") */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase">Classe</label>
          <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm min-w-[200px]">
            <option value="">— Sélectionner une classe —</option>
            {classes.map(c => <option key={c.classId} value={c.classId}>{c.className}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase">Type de fiche</label>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm min-w-[200px]">
            <option value="">Tous les types</option>
            {SHEET_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
          </select>
        </div>
        <div className="flex-1" />
        <button onClick={() => loadFiches()} disabled={!selectedClassId} className="p-2 hover:bg-slate-200 rounded-lg disabled:opacity-30"><RefreshCw className="h-4 w-4" /></button>
        {/* ⭐ Bouton "Nouvelle fiche" désactivé tant qu'aucune classe n'est sélectionnée */}
        <button
          onClick={() => {
            const cls = classes.find(c => c.classId === selectedClassId);
            setForm({
              ...emptyForm,
              classId: selectedClassId,
              className: cls?.className || "",
              boysCount: cls?.boys || 0,
              girlsCount: cls?.girls || 0,
              totalStudents: cls?.totalStudents || 0,
              boysPresent: cls?.boys || 0,
              girlsPresent: cls?.girls || 0,
              totalPresent: cls?.totalStudents || 0,
            });
            setEditingFiche(null);
            setShowForm(true);
          }}
          disabled={!selectedClassId}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
          <Plus className="h-4 w-4" /> Nouvelle fiche
        </button>
      </div>

      {loading && <div className="flex items-center justify-center py-12 text-slate-500"><Loader2 className="h-6 w-6 animate-spin mr-2" />Chargement…</div>}

      {!loading && !selectedClassId && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-slate-300 mb-3" />
          <p className="font-medium text-slate-600">Sélectionnez une classe</p>
          <p className="text-sm text-slate-500 mt-1">Choisissez une classe pour voir et créer des fiches pédagogiques.</p>
        </div>
      )}

      {!loading && selectedClassId && fiches.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-slate-300 mb-3" />
          <p className="font-medium text-slate-600">Aucune fiche pédagogique</p>
          <p className="text-sm text-slate-500 mt-1">Créez votre première fiche en cliquant sur "Nouvelle fiche".</p>
        </div>
      )}

      {!loading && fiches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {fiches.map(fiche => {
            const st = SHEET_TYPES.find(t => t.type === fiche.sheetType);
            const status = STATUS_CONFIG[fiche.status as keyof typeof STATUS_CONFIG];
            const Icon = st?.icon || FileText;
            return (
              <div key={fiche.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className={cn("flex items-center gap-2 px-2 py-1 rounded text-xs font-bold", st?.color)}>
                    <Icon className="h-3 w-3" />{st?.label || fiche.sheetType}
                  </div>
                  {status && <div className={cn("flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase", status.color)}><status.icon className="h-3 w-3" />{status.label}</div>}
                </div>
                <div className="text-xs text-slate-500 mb-2">{formatDateFR(fiche.lessonDate || fiche.createdAt)} — SAN°{fiche.san || "—"}</div>
                <div className="text-sm font-medium text-slate-800 line-clamp-2 mb-2">{fiche.titre || fiche.contenu?.replace(/<[^>]*>/g, '').substring(0, 80) || "—"}</div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-3"><span>{fiche.className || "—"}</span><span>•</span><span>{fiche.totalStudents || 0} élèves</span></div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button onClick={() => handleEdit(fiche)} className="flex-1 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded">Modifier</button>
                  {fiche.status === "DRAFT" && <button onClick={() => handleSubmit(fiche)} className="px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 rounded">Soumettre</button>}
                  <button onClick={() => handleDelete(fiche)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
