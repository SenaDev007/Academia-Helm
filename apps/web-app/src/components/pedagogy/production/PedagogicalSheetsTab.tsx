"use client";

/**
 * ============================================================================
 * FICHES PÉDAGOGIQUES PRIMAIRE (5 types: MATH/FRANCAIS/EST/ES/EA)
 * ============================================================================
 *
 * Template officiel des fiches pédagogiques du primaire (maternelle/primaire).
 * 5 types disponibles selon la matière :
 *   - MATH       : Mathématiques
 *   - FRANCAIS   : Français
 *   - EST        : Éducation Scientifique et Technologique
 *   - ES         : Éducation Sociale
 *   - EA         : Éducation Artistique
 *
 * Structure commune :
 *   1. En-tête (école, classe, année, trimestre, semaine, date, heure, durée, maître)
 *   2. Effectifs (G/F/Total, présents/absents)
 *   3. Ruban pédagogique (compétence, habileté, prérequis, contenu, méthodes,
 *      moyens, déroulement, évaluation, référence)
 *   4. Ruban administratif (date, semaine, horaire, durée)
 *   5. Signatures (enseignant + directeur)
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  FileText, Loader2, Plus, Save, RefreshCw, Send, Trash2,
  ChevronLeft, Clock, CheckCircle2, XCircle, BookOpen, Sigma,
  FlaskConical, Users, Palette,
} from "lucide-react";
import { toast } from "sonner";
import { SignatureCanvas } from "@/components/ui/SignatureCanvas";
import { useAppSession } from "@/contexts/AppSessionContext";

interface PedagogicalSheetsTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
}

const SHEET_TYPES = [
  {
    type: "MATH",
    label: "Mathématiques",
    icon: Sigma,
    color: "bg-blue-100 text-blue-700 border-blue-200",
    accentColor: "bg-blue-600",
  },
  {
    type: "FRANCAIS",
    label: "Français",
    icon: BookOpen,
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    accentColor: "bg-emerald-600",
  },
  {
    type: "EST",
    label: "Éducation Scientifique et Technologique",
    icon: FlaskConical,
    color: "bg-purple-100 text-purple-700 border-purple-200",
    accentColor: "bg-purple-600",
  },
  {
    type: "ES",
    label: "Éducation Sociale",
    icon: Users,
    color: "bg-amber-100 text-amber-700 border-amber-200",
    accentColor: "bg-amber-600",
  },
  {
    type: "EA",
    label: "Éducation Artistique",
    icon: Palette,
    color: "bg-pink-100 text-pink-700 border-pink-200",
    accentColor: "bg-pink-600",
  },
] as const;

// ⭐ Configuration des champs spécifiques par type de fiche
// Conforme aux templates officiels extraits des PDFs fournis :
//   - Fiche mathématiques.pdf
//   - Fiche français.pdf
//   - Fiche EST.pdf
//   - Fiche Éducation Sociale.pdf
//   - Fiche EA.pdf
//
// Structure commune (toutes les fiches) :
//   En-tête : SAN°, Séquence N°, Date, Cours, Titre, Durée
//   I- Éléments de planification :
//     - Compétences disciplinaires
//     - Compétences transversales
//     - Compétences transdisciplinaires
//     - Connaissances et techniques
//     - Stratégie objet d'apprentissage
//     - Stratégie d'enseignement/apprentissage/évaluation
//     - Matériel
//   II- Déroulement (tableau N° / Consignes / Résultats attendus)
//   III- Retour et projection (Objectivation, Évaluation, Projection)
//
// Spécificités par type :
//   MATH : Phases préparatoires (Calcule à brûle pourpoint, Comptage/Décomptage,
//          Cadran opératoire, Calcul mental, 2 problèmes à résoudre mentalement)
//          + Démonstration (Règle à dégager, exercices d'application)
//   FRANCAIS : Exercice structural (Unité, Structure, Objectif) + Phase introductive
//              + Phase de systématisation + Phase d'application
//   EST : Activités préliminaires + Situation problème + Réalisation
//         (Hypothèse, Expérimentation, Synthèse) + Retour et projection
//   ES : Activités préliminaires + Mise en situation + Réalisation
//        (Situation départ, Exploration, Traitement) + Synthèse + Retour et projection
//   EA : Proposition de nouvelles acquisitions + Réalisation (exécution, techniques)
//        + Retour et projection (Objectivation, Évaluation, Projection, Réinvestissement)
const SHEET_TYPE_FIELDS: Record<string, {
  competenceLabel: string;
  competencePlaceholder: string;
  habileteLabel: string;
  habiletePlaceholder: string;
  prealableLabel: string;
  prealablePlaceholder: string;
  contenuLabel: string;
  contenuPlaceholder: string;
  methodesLabel: string;
  methodesPlaceholder: string;
  moyensLabel: string;
  moyensPlaceholder: string;
  evaluationLabel: string;
  evaluationPlaceholder: string;
  referenceLabel: string;
  referencePlaceholder: string;
  deroulementLabel: string;
  // ⭐ Sections spécifiques au type de fiche
  specialSectionTitle?: string;
  specialSectionFields?: { label: string; key: string; placeholder: string }[];
}> = {
  MATH: {
    competenceLabel: "Compétences disciplinaires",
    competencePlaceholder: "Ex: Résoudre des problèmes de proportionnalité...",
    habileteLabel: "Compétences transversales",
    habiletePlaceholder: "Ex: Calculer, raisonner, démontrer...",
    prealableLabel: "Compétences transdisciplinaires",
    prealablePlaceholder: "Ex: Esprit critique, autonomie...",
    contenuLabel: "Connaissances et techniques",
    contenuPlaceholder: "Ex: La proportionnalité — échelles et pourcentages...",
    methodesLabel: "Stratégie objet d'apprentissage",
    methodesPlaceholder: "Ex: Situations-problèmes, manipulation...",
    moyensLabel: "Stratégie d'enseignement/apprentissage/évaluation",
    moyensPlaceholder: "Ex: Méthode active, résolution de problèmes, évaluation formative...",
    evaluationLabel: "Matériel",
    evaluationPlaceholder: "Ex: Tableau, ardoise, manuel, calculatrice, matériel manipulable...",
    referenceLabel: "Phases préparatoires (Calcule à brûle pourpoint, Comptage/Décomptage, Cadran opératoire, Calcul mental, 2 problèmes à résoudre mentalement)",
    referencePlaceholder: "Ex: Table de multiplication par 7, calcul mental: 7×8=?, problème: Un vendeur a 35 oranges...",
    deroulementLabel: "Déroulement (Démonstration: Règle à dégager + exercices d'application)",
    specialSectionTitle: "Démonstration",
    specialSectionFields: [
      { label: "Règle à dégager ou à rappeler", key: "regleDegager", placeholder: "Ex: Pour calculer un pourcentage, on multiplie par le taux et on divise par 100..." },
      { label: "Exercices d'application de la règle dégagée", key: "exercicesApplication", placeholder: "Ex: Calculer 15% de 200, 20% de 350..." },
    ],
  },
  FRANCAIS: {
    competenceLabel: "Compétences disciplinaires",
    competencePlaceholder: "Ex: Lire et comprendre un texte narratif...",
    habileteLabel: "Compétences transversales",
    habiletePlaceholder: "Ex: Lire, écrire, parler, écouter...",
    prealableLabel: "Compétences transdisciplinaires",
    prealablePlaceholder: "Ex: Esprit d'analyse, créativité...",
    contenuLabel: "Connaissances et techniques",
    contenuPlaceholder: "Ex: Le conte — structure et personnages, vocabulaire...",
    methodesLabel: "Stratégie objet d'apprentissage",
    methodesPlaceholder: "Ex: Lecture silencieuse, lecture à haute voix, questions...",
    moyensLabel: "Stratégie d'enseignement/apprentissage/évaluation",
    moyensPlaceholder: "Ex: Méthode interrogative, lecture dirigée, évaluation orale...",
    evaluationLabel: "Matériel",
    evaluationPlaceholder: "Ex: Manuel de lecture, tableau, cahier d'exercices, ardoise...",
    referenceLabel: "Exercice structural (Unité, Structure, Objectif)",
    referencePlaceholder: "Ex: Unité: Le conte — Structure: Situation initiale, déroulement, situation finale — Objectif: Identifier la structure d'un conte...",
    deroulementLabel: "Déroulement (Phase introductive, Phase de systématisation, Phase d'application)",
    specialSectionTitle: "Exercice structural",
    specialSectionFields: [
      { label: "Unité N°", key: "uniteNumero", placeholder: "Ex: Unité 3" },
      { label: "Structure", key: "structureFiche", placeholder: "Ex: Situation initiale → élément modificateur → déroulement → situation finale" },
      { label: "Objectif", key: "objectifFiche", placeholder: "Ex: Identifier les étapes d'un récit..." },
    ],
  },
  EST: {
    competenceLabel: "Compétences disciplinaires",
    competencePlaceholder: "Ex: Observer et décrire un phénomène naturel...",
    habileteLabel: "Compétences transversales",
    habiletePlaceholder: "Ex: Observer, expérimenter, hypothéser, conclure...",
    prealableLabel: "Compétences transdisciplinaires",
    prealablePlaceholder: "Ex: Esprit scientifique, rigueur, coopération...",
    contenuLabel: "Connaissances et techniques",
    contenuPlaceholder: "Ex: Les états de la matière — solide, liquide, gazeux...",
    methodesLabel: "Stratégie objet d'apprentissage",
    methodesPlaceholder: "Ex: Situation problème, expérimentation guidée...",
    moyensLabel: "Stratégie d'enseignement/apprentissage/évaluation",
    moyensPlaceholder: "Ex: Démarche scientifique — observation, manipulation, expérimentation, synthèse...",
    evaluationLabel: "Matériel",
    evaluationPlaceholder: "Ex: Béchers, eau, glaçons, loupe, balance, manuel d'EST...",
    referenceLabel: "Activités préliminaires (Rappel de la leçon précédente)",
    referencePlaceholder: "Ex: Questions orales, réponses écrites, récitation de la leçon précédente...",
    deroulementLabel: "Déroulement (Situation problème → Réalisation: Hypothèse, Expérimentation, Synthèse → Retour et projection)",
    specialSectionTitle: "Réalisation scientifique",
    specialSectionFields: [
      { label: "Hypothèse individuelle", key: "hypotheIndividuelle", placeholder: "Ex: Les élèves proposent des explications..." },
      { label: "Hypothèse du groupe", key: "hypotheGroupe", placeholder: "Ex: Le groupe consolide les hypothèses..." },
      { label: "Expérimentation", key: "experimentation", placeholder: "Ex: Manipulation avec du matériel, observation des changements..." },
      { label: "Synthèse", key: "syntheseEST", placeholder: "Ex: Conclusions tirées de l'expérimentation..." },
    ],
  },
  ES: {
    competenceLabel: "Compétences disciplinaires",
    competencePlaceholder: "Ex: Identifier les règles de vie en société...",
    habileteLabel: "Compétences transversales",
    habiletePlaceholder: "Ex: Observer, analyser, respecter, coopérer...",
    prealableLabel: "Compétences transdisciplinaires",
    prealablePlaceholder: "Ex: Esprit civique, sens de la responsabilité...",
    contenuLabel: "Connaissances et techniques",
    contenuPlaceholder: "Ex: Les règles de vie en société — droits et devoirs...",
    methodesLabel: "Stratégie objet d'apprentissage",
    methodesPlaceholder: "Ex: Discussion, jeu de rôle, étude de cas...",
    moyensLabel: "Stratégie d'enseignement/apprentissage/évaluation",
    moyensPlaceholder: "Ex: Méthode active, discussion dirigée, évaluation formative...",
    evaluationLabel: "Matériel",
    evaluationPlaceholder: "Ex: Images, affiches, récits, tableau, manuel d'éducation sociale...",
    referenceLabel: "Activités préliminaires (Rappel de la leçon précédente)",
    referencePlaceholder: "Ex: Questions orales, réponses orales, questions écrites (PLM), récitation et appréciation du cahier...",
    deroulementLabel: "Déroulement (Mise en situation → Réalisation: Situation départ, Exploration, Traitement → Synthèse → Retour et projection)",
    specialSectionTitle: "Réalisation sociale",
    specialSectionFields: [
      { label: "Situation départ", key: "situationDepart", placeholder: "Ex: Présentation d'une situation de la vie quotidienne..." },
      { label: "Exploration/Exploitation de la situation problème", key: "exploration", placeholder: "Ex: Questions d'exploration, références..." },
      { label: "Traitement de l'information et analyse", key: "traitementInfo", placeholder: "Ex: Analyse des informations, comparaison..." },
      { label: "Synthèse", key: "syntheseES", placeholder: "Ex: Résumé des apprentissages..." },
    ],
  },
  EA: {
    competenceLabel: "Compétences disciplinaires",
    competencePlaceholder: "Ex: Produire une création artistique personnelle...",
    habileteLabel: "Compétences transversales",
    habiletePlaceholder: "Ex: Dessiner, peindre, modeler, créer, imaginer, chanter...",
    prealableLabel: "Compétences transdisciplinaires",
    prealablePlaceholder: "Ex: Sensibilité artistique, créativité, expression...",
    contenuLabel: "Connaissances et techniques",
    contenuPlaceholder: "Ex: Le dessin d'observation / Le chant — techniques et expression...",
    methodesLabel: "Stratégie objet d'apprentissage",
    methodesPlaceholder: "Ex: Démonstration, expérimentation, création libre...",
    moyensLabel: "Stratégie d'enseignement/apprentissage/évaluation",
    moyensPlaceholder: "Ex: Démarche artistique — écouter, reproduire, créer, apprécier...",
    evaluationLabel: "Matériel",
    evaluationPlaceholder: "Ex: Crayons, feutres, peinture, pinceaux, papier, instrument de musique...",
    referenceLabel: "Proposition de nouvelles acquisitions (Annoncer l'objet d'apprentissage, Pré-conception)",
    referencePlaceholder: "Ex: Annoncer le titre du chant/dessin, demander aux enfants s'ils connaissent...",
    deroulementLabel: "Déroulement (Réalisation: Première exécution, Techniques d'enseignement → Retour et projection: Objectivation, Évaluation, Projection, Réinvestissement)",
    specialSectionTitle: "Réalisation artistique",
    specialSectionFields: [
      { label: "Première exécution / Présentation", key: "premiereExecution", placeholder: "Ex: Présenter le chant, faire écouter, démontrer la technique..." },
      { label: "Techniques d'enseignement/apprentissage", key: "techniquesEA", placeholder: "Ex: Répétition guidée, pratique individuelle, correction..." },
      { label: "Réinvestissement", key: "reinvestissement", placeholder: "Ex: Faire chanter le morceau comme intermède des séquences de classe..." },
    ],
  },
};

const STATUS_CONFIG = {
  DRAFT: { label: "Brouillon", color: "bg-slate-100 text-slate-600", icon: Clock },
  SUBMITTED: { label: "Soumis", color: "bg-blue-100 text-blue-700", icon: Send },
  VALIDATED: { label: "Validé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  REJECTED: { label: "Rejeté", color: "bg-red-100 text-red-700", icon: XCircle },
} as const;

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toISOString().split("T")[0];
}

function formatDateFR(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function PedagogicalSheetsTab({ tenantId, academicYearId, teacherId }: PedagogicalSheetsTabProps) {
  const { user } = useAppSession();
  const [classes, setClasses] = useState<any[]>([]);
  const [fiches, setFiches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingFiche, setEditingFiche] = useState<any>(null);
  const [filterType, setFilterType] = useState<string>("");

  // Formulaire de création
  const emptyForm = {
    classId: "",
    sheetType: "MATH" as string,
    schoolName: "",
    className: "",
    academicYearLabel: "",
    trimester: 1,
    weekNumber: 1,
    lessonDate: formatDate(new Date().toISOString()),
    lessonTime: "",
    durationMinutes: 30,
    teacherName: "",
    // Effectifs
    boysCount: 0,
    girlsCount: 0,
    totalStudents: 0,
    boysPresent: 0,
    girlsPresent: 0,
    totalPresent: 0,
    boysAbsent: 0,
    girlsAbsent: 0,
    totalAbsent: 0,
    // Ruban pédagogique
    competence: "",
    habilete: "",
    prealable: "",
    contenu: "",
    methodes: "",
    moyensDidactiques: "",
    deroulement: [] as Array<{ etape: string; duree: string; activiteEnseignant: string; activiteEleves: string }>,
    evaluation: "",
    reference: "",
    // Ruban administratif
    adminDate: formatDate(new Date().toISOString()),
    adminWeek: 1,
    adminHoraire: "",
    adminDuree: 30,
  };
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);

  // === Chargement des classes et fiches ===
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

  const loadFiches = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ teacherId, academicYearId });
      if (filterType) params.append("sheetType", filterType);
      const res = await fetch(`/api/pedagogy-space/fiches?${params.toString()}`, { credentials: "include" });
      const data = await res.json();
      setFiches(Array.isArray(data) ? data : []);
    } catch { setFiches([]); }
    finally { setLoading(false); }
  }, [teacherId, academicYearId, filterType]);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => { loadFiches(); }, [loadFiches]);

  // === Création / Mise à jour ===
  const handleCreateOrUpdate = async () => {
    if (!form.classId || !form.sheetType) {
      toast.error("Veuillez sélectionner une classe et un type de fiche");
      return;
    }
    setSaving(true);
    try {
      const url = editingFiche
        ? `/api/pedagogy-space/fiches/${editingFiche.id}`
        : "/api/pedagogy-space/fiches";
      const method = editingFiche ? "PUT" : "POST";
      const body = editingFiche
        ? { ...form }
        : { ...form, academicYearId, teacherId };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      toast.success(editingFiche ? "✅ Fiche mise à jour" : "✅ Fiche créée");
      setShowForm(false);
      setEditingFiche(null);
      setForm(emptyForm);
      loadFiches();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (fiche: any) => {
    setEditingFiche(fiche);
    setForm({
      ...emptyForm,
      ...fiche,
      lessonDate: fiche.lessonDate ? formatDate(fiche.lessonDate) : "",
      adminDate: fiche.adminDate ? formatDate(fiche.adminDate) : "",
      deroulement: Array.isArray(fiche.deroulement) ? fiche.deroulement :
        (typeof fiche.deroulement === "string" ? JSON.parse(fiche.deroulement || "[]") : []),
    });
    setShowForm(true);
  };

  const handleDelete = async (fiche: any) => {
    if (!confirm(`Supprimer cette fiche (${fiche.sheetType}) ?`)) return;
    try {
      const res = await fetch(`/api/pedagogy-space/fiches/${fiche.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("Fiche supprimée");
      loadFiches();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  const handleSubmit = async (fiche: any) => {
    if (!confirm("Soumettre cette fiche au directeur ?")) return;
    try {
      const res = await fetch(`/api/pedagogy-space/fiches/${fiche.id}/submit`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("✅ Fiche soumise");
      loadFiches();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  // === Gestion du déroulement ===
  const addDeroulementStep = () => {
    setForm((prev: any) => ({
      ...prev,
      deroulement: [
        ...(prev.deroulement || []),
        { etape: "", duree: "", activiteEnseignant: "", activiteEleves: "" },
      ],
    }));
  };

  const updateDeroulementStep = (idx: number, field: string, value: string) => {
    setForm((prev: any) => ({
      ...prev,
      deroulement: (prev.deroulement || []).map((s: any, i: number) =>
        i === idx ? { ...s, [field]: value } : s
      ),
    }));
  };

  const removeDeroulementStep = (idx: number) => {
    setForm((prev: any) => ({
      ...prev,
      deroulement: (prev.deroulement || []).filter((_: any, i: number) => i !== idx),
    }));
  };

  const selectedClass = classes.find(c => c.classId === form.classId);

  // Auto-remplir les effectifs quand on choisit une classe
  const onClassChange = (classId: string) => {
    const cls = classes.find(c => c.classId === classId);
    if (cls) {
      setForm((prev: any) => ({
        ...prev,
        classId,
        className: cls.className || "",
        boysCount: cls.boys || 0,
        girlsCount: cls.girls || 0,
        totalStudents: cls.totalStudents || 0,
        boysPresent: cls.boys || 0,
        girlsPresent: cls.girls || 0,
        totalPresent: cls.totalStudents || 0,
        boysAbsent: 0,
        girlsAbsent: 0,
        totalAbsent: 0,
      }));
    }
  };

  // === RENDU ===

  if (showForm) {
    const sheetType = SHEET_TYPES.find(t => t.type === form.sheetType);
    return (
      <div className="space-y-4">
        {/* === Barre d'actions === */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
          <button
            onClick={() => { setShowForm(false); setEditingFiche(null); setForm(emptyForm); }}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg"
          >
            <ChevronLeft className="h-4 w-4" />
            Retour à la liste
          </button>
          <div className="text-sm font-semibold text-slate-700">
            {editingFiche ? "Modifier la fiche" : "Nouvelle fiche pédagogique"}
          </div>
          <button
            onClick={handleCreateOrUpdate}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editingFiche ? "Mettre à jour" : "Créer la fiche"}
          </button>
        </div>

        {/* === Sélection du type de fiche === */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <label className="block text-xs font-bold text-slate-700 uppercase mb-3">
            Type de fiche pédagogique
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {SHEET_TYPES.map((t) => {
              const Icon = t.icon;
              const isActive = form.sheetType === t.type;
              return (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => setForm((p: any) => ({ ...p, sheetType: t.type }))}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 border-2 rounded-lg text-xs font-semibold transition-all",
                    isActive ? t.color : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-center">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* === Formulaire détaillé === */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          {/* 1. En-tête */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 uppercase border-b border-slate-200 pb-2 mb-3">
              En-tête administratif
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Classe *</label>
                <select
                  value={form.classId}
                  onChange={(e) => onClassChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="">— Sélectionner —</option>
                  {classes.map(c => (
                    <option key={c.classId} value={c.classId}>{c.className}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nom de l'école</label>
                <input type="text" value={form.schoolName}
                  onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Année académique</label>
                <input type="text" value={form.academicYearLabel} placeholder="2025-2026"
                  onChange={(e) => setForm({ ...form, academicYearLabel: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Trimestre</label>
                <select value={form.trimester}
                  onChange={(e) => setForm({ ...form, trimester: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option value={1}>1er Trimestre</option>
                  <option value={2}>2e Trimestre</option>
                  <option value={3}>3e Trimestre</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Semaine</label>
                <input type="number" min={1} max={36} value={form.weekNumber}
                  onChange={(e) => setForm({ ...form, weekNumber: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Date de la leçon</label>
                <input type="date" value={form.lessonDate}
                  onChange={(e) => setForm({ ...form, lessonDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Heure</label>
                <input type="text" value={form.lessonTime} placeholder="08:00 - 09:30"
                  onChange={(e) => setForm({ ...form, lessonTime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Durée (minutes)</label>
                <input type="number" min={5} value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: parseInt(e.target.value) || 30 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Enseignant</label>
                <input type="text" value={form.teacherName}
                  onChange={(e) => setForm({ ...form, teacherName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
            </div>
          </section>

          {/* 2. Effectifs */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 uppercase border-b border-slate-200 pb-2 mb-3">
              Effectifs {selectedClass && `(${selectedClass.className})`}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"></th>
                    <th className="border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Garçons</th>
                    <th className="border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Filles</th>
                    <th className="border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Effectif inscrit</td>
                    <td className="border border-slate-200"><input type="number" value={form.boysCount} onChange={(e) => setForm({ ...form, boysCount: parseInt(e.target.value) || 0, totalStudents: (parseInt(e.target.value) || 0) + (form.girlsCount || 0) })} className="w-full px-2 py-1 border-0 text-sm" /></td>
                    <td className="border border-slate-200"><input type="number" value={form.girlsCount} onChange={(e) => setForm({ ...form, girlsCount: parseInt(e.target.value) || 0, totalStudents: (form.boysCount || 0) + (parseInt(e.target.value) || 0) })} className="w-full px-2 py-1 border-0 text-sm" /></td>
                    <td className="border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 bg-slate-50">{form.totalStudents}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Présents</td>
                    <td className="border border-slate-200"><input type="number" value={form.boysPresent} onChange={(e) => setForm({ ...form, boysPresent: parseInt(e.target.value) || 0, totalPresent: (parseInt(e.target.value) || 0) + (form.girlsPresent || 0), boysAbsent: (form.boysCount || 0) - (parseInt(e.target.value) || 0), totalAbsent: ((form.boysCount || 0) - (parseInt(e.target.value) || 0)) + (form.girlsAbsent || 0) })} className="w-full px-2 py-1 border-0 text-sm" /></td>
                    <td className="border border-slate-200"><input type="number" value={form.girlsPresent} onChange={(e) => setForm({ ...form, girlsPresent: parseInt(e.target.value) || 0, totalPresent: (form.boysPresent || 0) + (parseInt(e.target.value) || 0), girlsAbsent: (form.girlsCount || 0) - (parseInt(e.target.value) || 0), totalAbsent: (form.boysAbsent || 0) + ((form.girlsCount || 0) - (parseInt(e.target.value) || 0)) })} className="w-full px-2 py-1 border-0 text-sm" /></td>
                    <td className="border border-slate-200 px-3 py-2 text-sm font-bold text-emerald-700 bg-emerald-50">{form.totalPresent}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Absents</td>
                    <td className="border border-slate-200 px-3 py-2 text-sm text-red-600 bg-red-50/50">{form.boysAbsent}</td>
                    <td className="border border-slate-200 px-3 py-2 text-sm text-red-600 bg-red-50/50">{form.girlsAbsent}</td>
                    <td className="border border-slate-200 px-3 py-2 text-sm font-bold text-red-600 bg-red-50">{form.totalAbsent}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 3. Ruban pédagogique — champs spécifiques au type de fiche */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 uppercase border-b border-slate-200 pb-2 mb-3">
              Ruban pédagogique — {sheetType?.label}
            </h3>
            {(() => {
              const tf = SHEET_TYPE_FIELDS[form.sheetType] || SHEET_TYPE_FIELDS.MATH;
              return (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{tf.competenceLabel}</label>
                <textarea value={form.competence} onChange={(e) => setForm({ ...form, competence: e.target.value })} rows={2}
                  placeholder={tf.competencePlaceholder}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{tf.habileteLabel}</label>
                <textarea value={form.habilete} onChange={(e) => setForm({ ...form, habilete: e.target.value })} rows={2}
                  placeholder={tf.habiletePlaceholder}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{tf.prealableLabel}</label>
                <textarea value={form.prealable} onChange={(e) => setForm({ ...form, prealable: e.target.value })} rows={2}
                  placeholder={tf.prealablePlaceholder}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{tf.contenuLabel}</label>
                <textarea value={form.contenu} onChange={(e) => setForm({ ...form, contenu: e.target.value })} rows={3}
                  placeholder={tf.contenuPlaceholder}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{tf.methodesLabel}</label>
                  <textarea value={form.methodes} onChange={(e) => setForm({ ...form, methodes: e.target.value })} rows={2}
                    placeholder={tf.methodesPlaceholder}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{tf.moyensLabel}</label>
                  <textarea value={form.moyensDidactiques} onChange={(e) => setForm({ ...form, moyensDidactiques: e.target.value })} rows={2}
                    placeholder={tf.moyensPlaceholder}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
              </div>

              {/* Déroulement (étapes) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-600">{tf.deroulementLabel}</label>
                  <button type="button" onClick={addDeroulementStep}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100">
                    <Plus className="h-3 w-3" /> Ajouter une étape
                  </button>
                </div>
                <div className="space-y-2">
                  {(form.deroulement || []).map((step: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 p-2 bg-slate-50 rounded-lg">
                      <input type="text" value={step.etape} placeholder="Étape"
                        onChange={(e) => updateDeroulementStep(idx, "etape", e.target.value)}
                        className="col-span-3 px-2 py-1 border border-slate-200 rounded text-xs" />
                      <input type="text" value={step.duree} placeholder="Durée"
                        onChange={(e) => updateDeroulementStep(idx, "duree", e.target.value)}
                        className="col-span-2 px-2 py-1 border border-slate-200 rounded text-xs" />
                      <input type="text" value={step.activiteEnseignant} placeholder="Activité enseignant"
                        onChange={(e) => updateDeroulementStep(idx, "activiteEnseignant", e.target.value)}
                        className="col-span-3 px-2 py-1 border border-slate-200 rounded text-xs" />
                      <input type="text" value={step.activiteEleves} placeholder="Activité élèves"
                        onChange={(e) => updateDeroulementStep(idx, "activiteEleves", e.target.value)}
                        className="col-span-3 px-2 py-1 border border-slate-200 rounded text-xs" />
                      <button type="button" onClick={() => removeDeroulementStep(idx)}
                        className="col-span-1 flex items-center justify-center text-red-500 hover:bg-red-50 rounded">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {(!form.deroulement || form.deroulement.length === 0) && (
                    <div className="text-xs text-slate-400 italic p-2">Aucune étape. Cliquez sur "Ajouter une étape".</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{tf.evaluationLabel}</label>
                  <textarea value={form.evaluation} onChange={(e) => setForm({ ...form, evaluation: e.target.value })} rows={2}
                    placeholder={tf.evaluationPlaceholder}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{tf.referenceLabel}</label>
                  <textarea value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} rows={2}
                    placeholder={tf.referencePlaceholder}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
              </div>
            </div>
              );
            })()}
          </section>

          {/* 3b. Section spécifique au type de fiche */}
          {(() => {
            const tf = SHEET_TYPE_FIELDS[form.sheetType] || SHEET_TYPE_FIELDS.MATH;
            if (!tf.specialSectionTitle || !tf.specialSectionFields) return null;
            return (
              <section>
                <h3 className="text-sm font-bold text-slate-900 uppercase border-b border-slate-200 pb-2 mb-3">
                  {tf.specialSectionTitle} — {sheetType?.label}
                </h3>
                <div className="space-y-3">
                  {tf.specialSectionFields.map((sf) => (
                    <div key={sf.key}>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">{sf.label}</label>
                      <textarea
                        value={form[sf.key] || ""}
                        onChange={(e) => setForm({ ...form, [sf.key]: e.target.value })}
                        rows={2}
                        placeholder={sf.placeholder}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                  ))}
                </div>
              </section>
            );
          })()}

          {/* 4. Ruban administratif */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 uppercase border-b border-slate-200 pb-2 mb-3">
              Ruban administratif
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                <input type="date" value={form.adminDate} onChange={(e) => setForm({ ...form, adminDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Semaine</label>
                <input type="number" min={1} max={36} value={form.adminWeek}
                  onChange={(e) => setForm({ ...form, adminWeek: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Horaire</label>
                <input type="text" value={form.adminHoraire}
                  onChange={(e) => setForm({ ...form, adminHoraire: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Durée (min)</label>
                <input type="number" min={5} value={form.adminDuree}
                  onChange={(e) => setForm({ ...form, adminDuree: parseInt(e.target.value) || 30 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
            </div>
          </section>

          {/* 5. Signatures (SignatureCanvas comme registre d'appel) */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 uppercase border-b border-slate-200 pb-2 mb-3">
              Signatures
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Signature Enseignant */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-800">Le Maître / La Maîtresse</div>
                    <div className="text-xs text-slate-500">{user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Nom du titulaire'} — Signature</div>
                  </div>
                  {form.teacherSignature && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                      <CheckCircle2 className="h-3 w-3" /> Signé
                    </span>
                  )}
                </div>
                {form.teacherSignature ? (
                  <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2">
                    <img src={form.teacherSignature} alt="Signature Maître" className="max-h-24 mx-auto" />
                  </div>
                ) : (
                  <SignatureCanvas
                    width={400}
                    height={120}
                    placeholder="Signature du Maître / de la Maîtresse"
                    onSignatureChange={(data) => setForm({ ...form, teacherSignature: data })}
                  />
                )}
                {form.teacherSignature && (
                  <button type="button" onClick={() => setForm({ ...form, teacherSignature: null })} className="text-xs text-red-500 hover:underline">
                    Effacer la signature
                  </button>
                )}
              </div>

              {/* Signature Directeur */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-800">Le Directeur / La Directrice</div>
                    <div className="text-xs text-slate-500">Signature et cachet</div>
                  </div>
                  {form.directorSignature && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                      <CheckCircle2 className="h-3 w-3" /> Signé
                    </span>
                  )}
                </div>
                {form.directorSignature ? (
                  <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2">
                    <img src={form.directorSignature} alt="Signature Directeur" className="max-h-24 mx-auto" />
                  </div>
                ) : (
                  <SignatureCanvas
                    width={400}
                    height={120}
                    placeholder="Signature du Directeur"
                    onSignatureChange={(data) => setForm({ ...form, directorSignature: data })}
                  />
                )}
                {form.directorSignature && (
                  <button type="button" onClick={() => setForm({ ...form, directorSignature: null })} className="text-xs text-red-500 hover:underline">
                    Effacer la signature
                  </button>
                )}
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
      {/* === En-tête : filtre + bouton créer === */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase">Type de fiche</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm min-w-[200px]">
            <option value="">Tous les types</option>
            {SHEET_TYPES.map(t => (
              <option key={t.type} value={t.type}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="flex-1" />
        <button onClick={() => loadFiches()} className="p-2 hover:bg-slate-200 rounded-lg" title="Rafraîchir">
          <RefreshCw className="h-4 w-4" />
        </button>
        <button onClick={() => { setForm(emptyForm); setEditingFiche(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          Nouvelle fiche
        </button>
      </div>

      {/* === Liste des fiches === */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Chargement…
        </div>
      )}

      {!loading && fiches.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-slate-300 mb-3" />
          <p className="font-medium text-slate-600">Aucune fiche pédagogique</p>
          <p className="text-sm text-slate-500 mt-1">
            Créez votre première fiche en cliquant sur "Nouvelle fiche".
          </p>
        </div>
      )}

      {!loading && fiches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {fiches.map((fiche) => {
            const sheetType = SHEET_TYPES.find(t => t.type === fiche.sheetType);
            const status = STATUS_CONFIG[fiche.status as keyof typeof STATUS_CONFIG];
            const Icon = sheetType?.icon || FileText;
            return (
              <div key={fiche.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className={cn("flex items-center gap-2 px-2 py-1 rounded text-xs font-bold", sheetType?.color)}>
                    <Icon className="h-3 w-3" />
                    {sheetType?.label || fiche.sheetType}
                  </div>
                  {status && (
                    <div className={cn("flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase", status.color)}>
                      <status.icon className="h-3 w-3" />
                      {status.label}
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate-500 mb-2">
                  {formatDateFR(fiche.lessonDate || fiche.createdAt)} — S{fiche.weekNumber || "—"}
                </div>
                <div className="text-sm font-medium text-slate-800 line-clamp-2 mb-2">
                  {fiche.competence || fiche.contenu || "—"}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                  <span>{fiche.className || "—"}</span>
                  <span>•</span>
                  <span>{fiche.totalStudents || 0} élèves</span>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button onClick={() => handleEdit(fiche)}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded">
                    Modifier
                  </button>
                  {fiche.status === "DRAFT" && (
                    <button onClick={() => handleSubmit(fiche)}
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 rounded">
                      Soumettre
                    </button>
                  )}
                  <button onClick={() => handleDelete(fiche)}
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
