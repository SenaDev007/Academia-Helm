"use client";

/**
 * ============================================================================
 * FICHES PÉDAGOGIQUES PRIMAIRE — Structure conforme aux PDFs officiels
 * ============================================================================
 *
 * 6 types : MATH, FRANCAIS, EST (Éducation Scientifique et Technologique),
 *          ES (Éducation Sociale), EA (Éducation Artistique),
 *          EPS (Éducation Physique et Sportive)
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
  FlaskConical, Users, Palette, Download, History, Copy, Dumbbell,
} from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
// ⭐ 2026-09-15 : SignatureCanvas + useAppSession retirés — plus aucune
//    signature sur les fiches pédagogiques, et le user connecté n'est plus
//    affiché (le contexte signature a été supprimé).

interface PedagogicalSheetsTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
  /** ⭐ ID du cahier journal auquel rattacher les nouvelles fiches créées depuis l'UI du cahier journal */
  cahierJournalId?: string;
  /** ⭐ ID de la classe à pré-sélectionner (récupéré depuis le cahier journal) */
  initialClassId?: string;
  /** ⭐ Jour initial (lundi/mardi/...) pour pré-remplir la date de la leçon */
  initialLessonDay?: string;
  /** ⭐ Type de fiche initial (MATH/FRANCAIS/EST/ES/EA) deviné depuis la matière */
  initialSheetType?: string;
  /** ⭐ Matière initiale (clé matière du cahier journal, ex: "francais") */
  initialMatiere?: string;
  /** ⭐ ID d'une fiche existante à ouvrir en édition (depuis "Voir la fiche" dans FichesAPreparer) */
  initialFicheId?: string;
}

const SHEET_TYPES = [
  { type: "MATH", label: "Mathématiques", icon: Sigma, color: "bg-blue-100 text-blue-700 border-blue-200", headerBg: "bg-blue-600", sectionBorder: "border-blue-300" },
  { type: "FRANCAIS", label: "Français", icon: BookOpen, color: "bg-emerald-100 text-emerald-700 border-emerald-200", headerBg: "bg-emerald-600", sectionBorder: "border-emerald-300" },
  { type: "EST", label: "Éducation Scientifique et Technologique", icon: FlaskConical, color: "bg-purple-100 text-purple-700 border-purple-200", headerBg: "bg-purple-600", sectionBorder: "border-purple-300" },
  { type: "ES", label: "Éducation Sociale", icon: Users, color: "bg-amber-100 text-amber-700 border-amber-200", headerBg: "bg-amber-600", sectionBorder: "border-amber-300" },
  { type: "EA", label: "Éducation Artistique", icon: Palette, color: "bg-pink-100 text-pink-700 border-pink-200", headerBg: "bg-pink-600", sectionBorder: "border-pink-300" },
  { type: "EPS", label: "Éducation Physique et Sportive", icon: Dumbbell, color: "bg-cyan-100 text-cyan-700 border-cyan-200", headerBg: "bg-cyan-600", sectionBorder: "border-cyan-300" },
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
  EPS: {
    ibisTitle: "Proposition de nouvelles acquisitions",
    ibisFields: [
      { label: "Annoncer l'objet d'apprentissage (titre de l'activité physique et sportive)", key: "ibis_1", placeholder: "Ex: Annoncer le titre de l'activité physique à apprendre (course, saut, jeu collectif...)" },
      { label: "Pré-conception", key: "ibis_2", placeholder: "Ex: Demander aux enfants s'ils connaissent l'activité à partir du titre, recueillir leurs représentations..." },
    ],
  },
};

export function PedagogicalSheetsTab({ tenantId, academicYearId, teacherId, cahierJournalId, initialClassId, initialLessonDay, initialSheetType, initialMatiere, initialFicheId }: PedagogicalSheetsTabProps) {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [fiches, setFiches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingFiche, setEditingFiche] = useState<any>(null);
  const [filterType, setFilterType] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // ⭐ État pour la réutilisation cross-année des fiches
  //    Permet à un enseignant de retrouver les fiches validées des années
  //    précédentes (même classe + matière) et de les dupliquer vers l'année courante.
  const [showPreviousYearsModal, setShowPreviousYearsModal] = useState(false);
  const [previousYearFiches, setPreviousYearFiches] = useState<any[]>([]);
  const [loadingPreviousYears, setLoadingPreviousYears] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // ⭐ 2026-09-15 : états teacherName/directorInfo retirés — ils ne servaient
  //    qu'à la section signature (supprimée des fiches pédagogiques).

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
    // ⭐ 2026-09-15 : champs teacherSignature/directorSignature retirés —
    //    plus de signature sur les fiches pédagogiques.
  };
  const [form, setForm] = useState<any>(emptyForm);

  // === Chargement ===
  const loadClasses = useCallback(async () => {
    try {
      const res = await fetch(`/api/pedagogy-space/my-classes?teacherId=${teacherId}&academicYearId=${academicYearId}`, { credentials: "include" });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setClasses(list);
      // ⭐ Pré-sélectionner la classe : priorité à initialClassId (depuis le cahier journal)
      //    sinon la 1ère classe de la liste
      if (list.length > 0 && !selectedClassId) {
        if (initialClassId && list.some(c => c.classId === initialClassId)) {
          setSelectedClassId(initialClassId);
        } else {
          setSelectedClassId(list[0].classId);
        }
      }
    } catch { setClasses([]); }
  }, [teacherId, academicYearId, selectedClassId, initialClassId]);

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

  // ⭐ CROSS-YEAR REUSE : charger les fiches des années précédentes
  //    pour la même classe (et matière si filtrée).
  //    Permet à l'enseignant de retrouver les fiches validées de l'année N-1
  //    et de les dupliquer vers l'année courante.
  const loadPreviousYearFiches = useCallback(async () => {
    if (!selectedClassId) {
      toast.error("Sélectionnez d'abord une classe");
      return;
    }
    setLoadingPreviousYears(true);
    try {
      const params = new URLSearchParams({
        currentAcademicYearId: academicYearId,
        classId: selectedClassId,
      });
      const res = await fetch(
        `/api/pedagogy-space/fiches/previous-years?${params.toString()}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPreviousYearFiches(Array.isArray(data) ? data : []);
      setShowPreviousYearsModal(true);
      if (Array.isArray(data) && data.length === 0) {
        toast.info("Aucune fiche trouvée", {
          description: "Aucune fiche validée des années précédentes pour cette classe.",
        });
      }
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setLoadingPreviousYears(false);
    }
  }, [academicYearId, selectedClassId]);

  // ⭐ CROSS-YEAR REUSE : dupliquer une fiche d'une année précédente vers l'année courante
  //    Crée une nouvelle fiche DRAFT avec le contenu pédagogique copié.
  //    L'enseignant peut ensuite l'éditer (adapter effectifs, dates, observations).
  const handleDuplicateFiche = async (sourceFicheId: string) => {
    setDuplicatingId(sourceFicheId);
    try {
      const res = await fetch(
        `/api/pedagogy-space/fiches/${sourceFicheId}/duplicate-to-year`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            targetAcademicYearId: academicYearId,
            targetTeacherId: teacherId,
            targetClassId: selectedClassId,
          }),
        }
      );
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }
      toast.success("✅ Fiche dupliquée", {
        description: "La fiche a été copiée vers l'année courante (statut: Brouillon). Vous pouvez l'éditer.",
      });
      setShowPreviousYearsModal(false);
      loadFiches(); // Recharger la liste pour voir la nouvelle fiche
    } catch (e: any) {
      toast.error("Erreur lors de la duplication", { description: e.message });
    } finally {
      setDuplicatingId(null);
    }
  };

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => { loadFiches(); }, [loadFiches]);

  // ⭐ 2026-09-15 : l'effet de résolution titulaire/directeur a été retiré —
  //    il ne servait qu'à la section signature (supprimée des fiches pédagogiques).

  // ⭐ Synchroniser form.classId quand selectedClassId change (programmation ou manuel)
  //    Sans ça, le bouton "Créer fiche" échoue car form.classId est vide
  useEffect(() => {
    if (selectedClassId) {
      const cls = classes.find(c => c.classId === selectedClassId);
      setForm(prev => ({
        ...prev,
        classId: selectedClassId,
        className: cls?.className || prev.className || '',
        boysCount: cls?.boys || prev.boysCount || 0,
        girlsCount: cls?.girls || prev.girlsCount || 0,
        totalStudents: cls?.totalStudents || prev.totalStudents || 0,
        boysPresent: cls?.boys || prev.boysPresent || 0,
        girlsPresent: cls?.girls || prev.girlsPresent || 0,
        totalPresent: cls?.totalStudents || prev.totalPresent || 0,
        boysAbsent: 0,
        girlsAbsent: 0,
        totalAbsent: 0,
      }));
    }
  }, [selectedClassId, classes]);

  // ⭐ 2026-09-15 : directorLabel/directorDisplayName retirés — ils ne servaient
  //    qu'à la section signature (supprimée des fiches pédagogiques).

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

  // ⭐ Ouvrir une fiche existante en édition quand initialFicheId est fourni
  //    (depuis le bouton "Voir la fiche" dans FichesAPreparer)
  useEffect(() => {
    if (!initialFicheId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/pedagogy-space/fiches/${initialFicheId}`, { credentials: "include" });
        if (!res.ok) throw new Error("Fiche introuvable");
        const fiche = await res.json();
        if (cancelled) return;
        // Sélectionner la classe de la fiche
        if (fiche.classId) setSelectedClassId(fiche.classId);
        // Ouvrir en édition
        handleEdit(fiche);
      } catch (e: any) {
        if (!cancelled) toast.error("Erreur", { description: e.message });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFicheId]);

  // === CRUD ===
  const handleCreateOrUpdate = async () => {
    if (!form.classId || !form.sheetType) { toast.error("Veuillez sélectionner une classe et un type de fiche"); return; }
    // ⭐ FIX 2026-09-15 (anti-vide) : refuser d'enregistrer une fiche
    //    entièrement vide — au lieu de perséder du vide dans la base.
    const stripHtml = (html: string) => (html || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
    const hasAnyContent =
      stripHtml(form.titre).length > 0 ||
      stripHtml(form.cours).length > 0 ||
      stripHtml(form.competence).length > 0 ||
      stripHtml(form.contenu).length > 0 ||
      stripHtml(form.objectivation).length > 0 ||
      (Array.isArray(form.deroulement) && form.deroulement.some((s: any) =>
        stripHtml(s.consignes).length > 0 || stripHtml(s.resultats).length > 0));
    if (!hasAnyContent) {
      toast.error("Aucun contenu à enregistrer", {
        description: "Vous n'avez rien renseigné dans cette fiche pédagogique. Remplissez au moins un champ (titre, compétences, contenu, déroulement…) avant d'enregistrer.",
      });
      return;
    }
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

      // ⭐ Notifier les autres composants (FichesAPreparer, FichesBadge) qu'une fiche
      //    a été créée/mise à jour, pour qu'ils rechargent leurs données automatiquement.
      //    Sans ça, le compteur "X/Y fiches préparées" ne se met pas à jour tant que
      //    l'utilisateur ne recharge pas la page manuellement.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fiche:saved', {
          detail: {
            cahierJournalId,
            classId: form.classId || selectedClassId,
            academicYearId,
          },
        }));
      }

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
    // ⭐ Badge de statut affiché dans la barre d'actions
    const formStatus = STATUS_CONFIG[form.status as keyof typeof STATUS_CONFIG];
    return (
      <div className="space-y-4">
        {/* Barre d'actions */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
          <button onClick={() => { setShowForm(false); setEditingFiche(null); setForm(emptyForm); }}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">
            <ChevronLeft className="h-4 w-4" /> Retour à la liste
          </button>
          <div className="flex items-center gap-2">
            {/* ⭐ Badge de statut (Soumis / Validé / Rejeté) */}
            {formStatus && form.status !== 'DRAFT' && (
              <span className={cn("flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold uppercase", formStatus.color)}>
                <formStatus.icon className="h-3.5 w-3.5" /> {formStatus.label}
              </span>
            )}
            <div className="text-sm font-semibold text-slate-700">{editingFiche ? "Modifier la fiche" : "Nouvelle fiche pédagogique"}</div>
          </div>
          {/* ⭐ Bouton 'Mettre à jour' désactivé si isReadOnly (fiche soumise/validée/rejetée) */}
          <button onClick={handleCreateOrUpdate} disabled={saving || isReadOnly}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={isReadOnly ? "Fiche en lecture seule (statut: " + form.status + ")" : undefined}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editingFiche ? "Mettre à jour" : "Créer la fiche"}
          </button>
        </div>

        {/* Sélection du type de fiche */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <label className="block text-xs font-bold text-slate-700 uppercase mb-3">Type de fiche pédagogique</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
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

          {/* ⭐ Observation du directeur — Phase préparatoire (IN-LINE, juste après la section I.bis) */}
          {(() => {
            let obs = form.directorSectionObservations;
            if (typeof obs === 'string') { try { obs = JSON.parse(obs); } catch { obs = {}; } }
            const val = (obs as any)?.phase_preparatoire;
            if (!val || !String(val).trim()) return null;
            return (
              <div className="mt-2 mb-4 p-2 bg-red-50 border border-red-300 rounded-lg">
                <div className="text-[10px] font-bold text-red-700 uppercase mb-1">Observation du Directeur — Phase préparatoire</div>
                <div className="text-xs text-red-800 font-semibold whitespace-pre-wrap">{String(val)}</div>
              </div>
            );
          })()}

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

          {/* ⭐ Observation du directeur — Déroulement (IN-LINE, juste après la section II) */}
          {(() => {
            let obs = form.directorSectionObservations;
            if (typeof obs === 'string') { try { obs = JSON.parse(obs); } catch { obs = {}; } }
            const val = (obs as any)?.deroulement;
            if (!val || !String(val).trim()) return null;
            return (
              <div className="mt-2 mb-4 p-2 bg-red-50 border border-red-300 rounded-lg">
                <div className="text-[10px] font-bold text-red-700 uppercase mb-1">Observation du Directeur — Déroulement</div>
                <div className="text-xs text-red-800 font-semibold whitespace-pre-wrap">{String(val)}</div>
              </div>
            );
          })()}

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

          {/* ⭐ Observation du directeur — Retour et projection (IN-LINE, juste après la section III) */}
          {(() => {
            let obs = form.directorSectionObservations;
            if (typeof obs === 'string') { try { obs = JSON.parse(obs); } catch { obs = {}; } }
            const val = (obs as any)?.retour_projection;
            if (!val || !String(val).trim()) return null;
            return (
              <div className="mt-2 mb-4 p-2 bg-red-50 border border-red-300 rounded-lg">
                <div className="text-[10px] font-bold text-red-700 uppercase mb-1">Observation du Directeur — Retour et projection</div>
                <div className="text-xs text-red-800 font-semibold whitespace-pre-wrap">{String(val)}</div>
              </div>
            );
          })()}

          {/* ⭐ Observation générale du directeur (juste avant les signatures, en rouge) */}
          {(form.status === 'VALIDATED' || form.status === 'REJECTED' || form.status === 'SUBMITTED') && (form.directorObservation || (form.status === 'REJECTED' && form.rejectionReason)) && (
            <section className="border-l-4 border-red-400 pl-4">
              <h3 className="text-sm font-bold text-red-700 uppercase mb-3 bg-red-100 px-3 py-2 rounded-lg">
                Observation générale du Directeur
              </h3>
              {form.directorObservation && (
                <div className="text-sm text-red-900 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div dangerouslySetInnerHTML={{ __html: form.directorObservation }} />
                </div>
              )}
              {form.status === 'REJECTED' && form.rejectionReason && (
                <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded">
                  <div className="text-[10px] font-bold text-red-700 uppercase mb-0.5">Motif du rejet</div>
                  <div className="text-xs text-red-800 font-semibold">{form.rejectionReason}</div>
                </div>
              )}
            </section>
          )}

          {/* ⭐ 2026-09-15 : SECTION SIGNATURE SUPPRIMÉE — les fiches pédagogiques
              ne comportent aucune signature (décision utilisateur). Les observations
              du directeur ci-dessus restent affichées. */}
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
        {/* ⭐ Bouton "Réutiliser fiche année précédente" (cross-year reuse) */}
        <button
          onClick={loadPreviousYearFiches}
          disabled={!selectedClassId || loadingPreviousYears}
          title="Retrouver les fiches validées des années précédentes pour cette classe et les dupliquer vers l'année courante"
          className="flex items-center gap-2 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-semibold hover:bg-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loadingPreviousYears ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
          Réutiliser fiche année précédente
        </button>
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
                  {/* ⭐ Bouton export PDF individuel */}
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/pedagogy-space/fiches/${fiche.id}/export-pdf`, { credentials: 'include' });
                        if (!res.ok) throw new Error('Erreur');
                        const blob = await res.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        // ⭐ Nom du fichier : Fiche pédagogique [matière] [jour] [date] période [date] à [date]
                        const SHEET_LABELS: Record<string, string> = {
                          MATH: 'Mathematiques', FRANCAIS: 'Francais', EST: 'EST', ES: 'Education Sociale', EA: 'Education Artistique', EPS: 'Education Physique et Sportive',
                        };
                        const matiere = SHEET_LABELS[fiche.sheetType] || fiche.sheetType || 'Fiche';
                        const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
                        const lessonDate = fiche.lessonDate ? new Date(fiche.lessonDate) : null;
                        const jour = lessonDate ? days[lessonDate.getDay()] : '';
                        const dateStr = lessonDate ? `${lessonDate.getDate()}-${lessonDate.getMonth() + 1}-${lessonDate.getFullYear()}` : '';
                        // Période : semaine du cahier journal si dispo, sinon juste la date
                        const periode = cahierJournalId ? '' : '';
                        const fileName = `Fiche pedagogique ${matiere}${jour ? ' ' + jour : ''}${dateStr ? ' ' + dateStr : ''}${periode}.pdf`;
                        a.download = fileName;
                        a.click();
                        window.URL.revokeObjectURL(url);
                      } catch (e: any) {
                        toast.error('Erreur export PDF', { description: e.message });
                      }
                    }}
                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"
                    title="Exporter en PDF"
                  >
                    <Download className="h-3 w-3" />
                  </button>
                  <button onClick={() => handleDelete(fiche)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ⭐ MODAL : Réutiliser une fiche d'une année précédente (cross-year reuse) */}
      {showPreviousYearsModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowPreviousYearsModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-emerald-600" />
                  Fiches des années précédentes
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sélectionnez une fiche à dupliquer vers l'année courante. Elle sera créée en statut « Brouillon » et vous pourrez l'éditer.
                </p>
              </div>
              <button
                onClick={() => setShowPreviousYearsModal(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Liste */}
            <div className="flex-1 overflow-y-auto p-4">
              {previousYearFiches.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="font-medium text-slate-600">Aucune fiche trouvée</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Aucune fiche validée des années précédentes pour cette classe.
                    Créez une nouvelle fiche ou changez de classe.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {previousYearFiches.map((fiche: any) => (
                    <div
                      key={fiche.id}
                      className="border border-slate-200 rounded-lg p-3 hover:border-emerald-300 hover:bg-emerald-50/30 transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                              {fiche.academicYearName || 'Année précédente'}
                            </span>
                            {fiche.subjectName && (
                              <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                                {fiche.subjectName}
                              </span>
                            )}
                            <span className="text-xs text-slate-400">
                              {formatDateFR(fiche.createdAt)}
                            </span>
                          </div>
                          <p className="font-semibold text-slate-900 mt-1.5 truncate">
                            {fiche.title || fiche.competence || 'Fiche sans titre'}
                          </p>
                          {fiche.contenu && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                              {fiche.contenu.replace(/<[^>]+>/g, '').substring(0, 150)}
                              {fiche.contenu.length > 150 ? '…' : ''}
                            </p>
                          )}
                          {fiche.teacherName && (
                            <p className="text-[10px] text-slate-400 mt-1">
                              Créée par : {fiche.teacherName}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDuplicateFiche(fiche.id)}
                          disabled={duplicatingId === fiche.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {duplicatingId === fiche.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          Dupliquer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 p-3 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {previousYearFiches.length} fiche(s) trouvée(s) des années précédentes
              </p>
              <button
                onClick={() => setShowPreviousYearsModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
