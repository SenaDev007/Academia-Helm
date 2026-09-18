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
  Blocks, Shapes, Languages,
} from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { useAppSession } from "@/contexts/AppSessionContext";
// ⭐ 2026-09-15 : SignatureCanvas + useAppSession retirés — plus aucune
//    signature sur les fiches pédagogiques, et le user connecté n'est plus
//    affiché (le contexte signature a été supprimé).
import {
  getMaternelleDomainInfo,
  normalizeFrText as normalizeMatiereName,
} from "@/lib/pedagogy/maternelle-domains";
import { suggestionsPourSheetType } from "@/lib/pedagogy/cahier-sous-matieres";

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
  /** ⭐ Sous-matière initiale renseignée dans le cahier journal (ex :
   *    « Vocabulaire thématique », « Morale », « Arithmétique »…) — pré-remplit
   *    le champ « Matière spécifique / Sous-matière » de la fiche. C'est la
   *    clé de cohérence cahier journal ↔ fiches pédagogiques. */
  initialSousMatiere?: string;
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
  // ⭐ 2026-09-15 — MODÈLE STANDARD pour l'ANGLAIS et l'INFORMATIQUE enseignés
  //    comme matières par un enseignant SPÉCIALISÉ (écoles non bilingues).
  //    Même structure que la fiche standard du primaire : éléments de
  //    planification + activités préliminaires + déroulement + retour et
  //    projection — la matière (Anglais ou Informatique) est celle de
  //    l'enseignant spécialisé (son espace pédagogique ne contient que SA
  //    matière).
  { type: "STANDARD", label: "Anglais / Informatique (fiche standard)", icon: Languages, color: "bg-violet-100 text-violet-700 border-violet-200", headerBg: "bg-violet-600", sectionBorder: "border-violet-300" },
] as const;

// ⭐ 2026-09-15 MATERNELLE — 2 seuls formats de fiches pédagogiques pour les
//    classes de maternelle (conformes aux modèles officiels fournis) :
//      - DOMAINE   : fiche « Domaine » — le numéro du domaine est renseigné
//                    par l'enseignante (ex: 1, 3, IV…)
//      - DOMAINE_2 : fiche « Domaine 2 » — DOMAINE II (Expression corporelle)
//    NB : le DÉROULEMENT de DOMAINE est un tableau 2 colonnes
//    (Consignes | Résultats Attendus) ; celui de DOMAINE_2 un tableau
//    5 colonnes (Plan | Durée | Description des activités | Formation
//    Evolution | Dosage). Les deux se terminent par RÉALISATION, RETOUR ET
//    PROJECTION, RANGEMENT et Notes personnelles.
// ⭐ Libellés lisibles des colonnes de la grille maternelle (clés entries)
const MAT_KEY_LABELS: Record<string, string> = {
  dom1_sante: "Éducation pour la santé",
  dom2_corporelle: "Expression corporelle",
  pre_lecture: "Pré-lecture",
  pre_ecriture: "Pré-écriture",
  pre_mathematiques: "Pré-mathématiques",
  obs_dom: "Observations",
  dom3_sensorielle: "Éducation sensorielle",
  dom3_travaux_manuels: "Travaux manuels",
  dom4_emotionnelle: "Expression émotionnelle",
  dom4_plastique: "Expression plastique",
  dom5_comm_orale: "Communication orale",
  dom5_conte: "Conte",
  dom5_poesie_chant: "Poésie chant comptine",
  dom5_act_libres: "Activités libres",
};

const MATERNELLE_SHEET_TYPES = [
  { type: "DOMAINE", label: "Domaine", sub: "N° du domaine à renseigner par l'enseignante", icon: Blocks, color: "bg-indigo-100 text-indigo-700 border-indigo-200", headerBg: "bg-indigo-600", sectionBorder: "border-indigo-300" },
  { type: "DOMAINE_2", label: "Domaine 2", sub: "Fiche dédiée au DOMAINE II", icon: Shapes, color: "bg-teal-100 text-teal-700 border-teal-200", headerBg: "bg-teal-600", sectionBorder: "border-teal-300" },
] as const;

// ─── ⭐ SOUS-MATIÈRE (2026-09-18 v2) — champ partagé par types de fiche ───────
//     Chaque grande matière a ses sous-matières officielles (catalogue
//     cahier-sous-matieres.ts). Le champ est la clé de cohérence cahier
//     journal ↔ fiche pédagogique (rapprochement backend par
//     matiereSpecifique normalisée) : « fiche de dictée », « fiche de
//     morale », « fiche EA chant »…
//     ⭐ 2026-09-18 (corrections promoteur) : MATH et EPS n'ont PLUS de
//     sous-matières (tout est déjà sur la fiche de préparation) → champ
//     libre facultatif, exactement comme l'EST.
const SOUS_MATIERE_FIELD_CONFIG: Record<string, { label: string; hint: string; placeholder: string }> = {
  MATH: { label: "Sous-matière", hint: "facultatif", placeholder: "Sous-matière / rubrique de la leçon (facultatif)…" },
  ES: { label: "Sous-matière", hint: "Morale, Civisme, Histoire, Géographie", placeholder: "Ex : Morale, Civisme, Histoire, Géographie…" },
  EA: { label: "Sous-matière", hint: "Chant, Poésie, Dessin, Conte, Couture, Atelier, Art dramatique", placeholder: "Ex : Chant, Poésie, Dessin, Conte…" },
  EPS: { label: "Sous-matière", hint: "facultatif", placeholder: "Sous-matière / activité (facultatif)…" },
  EST: { label: "Sous-matière", hint: "facultatif", placeholder: "Sous-matière / domaine scientifique…" },
  STANDARD: { label: "Sous-matière", hint: "facultatif", placeholder: "Sous-matière (ex : Grammar, Reading, Tableur…)" },
};

function SousMatiereField({
  sheetType,
  value,
  onChange,
  disabled,
}: {
  sheetType: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const cfg = SOUS_MATIERE_FIELD_CONFIG[sheetType];
  if (!cfg) return null;
  const suggestions = suggestionsPourSheetType(sheetType);
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {cfg.label}{" "}
        {suggestions.length > 0 && (
          <span className="font-normal text-slate-400">({cfg.hint})</span>
        )}
      </label>
      <input
        type="text"
        list={`dl-sous-matiere-${sheetType}`}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={cfg.placeholder}
        className="w-full px-2 py-1.5 border-2 border-slate-300 rounded text-sm font-semibold bg-slate-50/60"
      />
      <datalist id={`dl-sous-matiere-${sheetType}`}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}

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
  // ⭐ 2026-09-15 — FICHE STANDARD (Anglais / Informatique — enseignant
  //    spécialisé des écoles non bilingues) : structure standard du primaire.
  STANDARD: {
    ibisTitle: "Activités préliminaires",
    ibisFields: [
      { label: "Rappel de la leçon précédente", key: "ibis_1", placeholder: "Ex: Questions orales, révision du vocabulaire/de la notion de la séance précédente..." },
      { label: "Vocabulaire / notions nouvelles de la séance", key: "ibis_2", placeholder: "Ex: Nouveaux mots, expressions ou termes techniques à faire acquérir (anglais) / notions et manipulations préalables (informatique)..." },
    ],
  },
};

export function PedagogicalSheetsTab({ tenantId, academicYearId, teacherId, cahierJournalId, initialClassId, initialLessonDay, initialSheetType, initialMatiere, initialSousMatiere, initialFicheId }: PedagogicalSheetsTabProps) {
  const { user } = useAppSession();
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
    // ⭐ 2026-09-17 — EN-TÊTE CONFORME AUX MODÈLES OFFICIELS (captures école) :
    //   MATH : Fn°, DOSSIER N°, THEME, Thème (sous-thème SA), Séance N°
    //   ES/EST/EA/EPS/STANDARD : Fn°, THEME, Séance N°
    //   FRANÇAIS : Matière spécifique (Dictée, Vocabulaire, Expression écrite…),
    //             Unité N°, Étape N°
    //   (persistés en base — migration 20260917100000)
    fn: "", dossier: "", theme: "", saTheme: "", seance: "",
    unite: "", etape: "", matiereSpecifique: "",
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
    // ⭐ 2026-09-15 MATERNELLE — contenu structuré des fiches DOMAINE/DOMAINE_2
    //    (persisté dans la colonne JSONB maternelleContent).
    maternelle: {
      ficheDe: "", domainNumber: "", domaineDu: "",
      composante: "", sousComposante: "", activiteNumero: "",
      theme: "", titre: "", section: "", duree: "", materiel: "",
      competence: "", capacite: "", habiletes: "", strategies: "",
      // DOMAINE_2 — tableau 5 colonnes
      der5: [] as Array<{ plan: string; duree: string; description: string; formationEvolution: string; dosage: string }>,
      // DOMAINE — tableau 2 colonnes (Consignes | Résultats Attendus) avec INTRODUCTION
      deroulementIntro: {
        miseEnSituation: { consignes: "", resultats: "" },
        acquisAnterieurs: { consignes: "", resultats: "" },
        annonceApprentissage: { consignes: "", resultats: "" },
      },
      // DOMAINE_2 — INTRODUCTION en 3 zones
      intro: { miseEnSituation: "", acquisAnterieurs: "", annonceApprentissage: "" },
      // RÉALISATION (+ sous-structure DOMAINE_2)
      realisation: "", situationProbleme: "", questionComprehension: "",
      activites: { a1: "", nb2: "", a2: "", nb3: "", a3: "" },
      // RETOUR ET PROJECTION
      retour: "", evaluation: "", connexion: "", projection: "",
      // RANGEMENT + Notes personnelles
      rangement: "", notesPersonnelles: "",
    },
  };
  const [form, setForm] = useState<any>(emptyForm);

  // ⭐ MATERNELLE — MATIÈRES DYNAMIQUES : matières configurées pour la classe
  //    sélectionnée (module Pédagogie → « Matières & programmes »), chargées
  //    via /subjects/available. Utilisées par le sélecteur « Matière » du
  //    formulaire DOMAINE/DOMAINE_2 pour que la préparation des fiches
  //    pédagogiques tienne compte des matières réellement paramétrées.
  const [matSubjects, setMatSubjects] = useState<any[]>([]);

  // ⭐ 2026-09-15 MATERNELLE : la classe sélectionnée est-elle une classe de
  //    maternelle ? (my-classes renvoie schoolLevelCode/schoolLevelName)
  //    → seuls les 2 formats maternelle (DOMAINE | DOMAINE_2) s'affichent.
  const selectedClassInfo = classes.find(c => c.classId === selectedClassId);
  const isMaternelleClass =
    (selectedClassInfo?.schoolLevelCode || "").toUpperCase() === "MATERNELLE" ||
    (selectedClassInfo?.schoolLevelName || "").toLowerCase() === "maternelle";
  const sheetTypesForClass: readonly any[] = isMaternelleClass ? MATERNELLE_SHEET_TYPES : SHEET_TYPES;

  // ⭐ MATERNELLE : chargement des matières de la classe (dynamiques).
  //    Uniquement pour les classes maternelle (le sélecteur matière ne
  //    concerne que les fiches DOMAINE / DOMAINE_2).
  useEffect(() => {
    if (!isMaternelleClass || !selectedClassId) { setMatSubjects([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/pedagogy-space/subjects/available?academicYearId=${academicYearId}&classId=${selectedClassId}&teacherId=${teacherId}`,
          { credentials: "include" },
        );
        const data = await res.json();
        if (!cancelled) setMatSubjects(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setMatSubjects([]);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMaternelleClass, selectedClassId, academicYearId, teacherId]);

  // ⭐ MATERNELLE : quand on vient de « Préparer la fiche » (initialMatiere =
  //    nom de la matière du cahier journal), sélectionner automatiquement la
  //    matière correspondante du sélecteur (subjectId + n° du domaine) dès
  //    que les matières sont chargées. Ne remplit que les champs vides.
  useEffect(() => {
    if (!isMaternelleClass || !initialMatiere || matSubjects.length === 0) return;
    const subj = matSubjects.find((s: any) => s.subjectName === initialMatiere)
      || matSubjects.find((s: any) => normalizeMatiereName(s.subjectName) === normalizeMatiereName(initialMatiere));
    if (!subj) return;
    const info = getMaternelleDomainInfo(subj.subjectName);
    setForm((p: any) => ({
      ...p,
      subjectId: p.subjectId || subj.subjectId,
      maternelle: {
        ...p.maternelle,
        domainNumber: p.maternelle?.domainNumber || info.roman || "",
        domaineDu: p.maternelle?.domaineDu || info.domainLabel || "",
      },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matSubjects, initialMatiere, isMaternelleClass]);

  // ⭐ MATERNELLE : lecture/écriture des champs imbriqués de form.maternelle
  const getMat = (path: string): any => {
    let v: any = form.maternelle;
    for (const k of path.split(".")) v = (v || {})[k];
    return v ?? "";
  };
  const setMat = (path: string, value: any) => setForm((p: any) => {
    const mat = { ...(p.maternelle || {}) };
    const keys = path.split(".");
    let obj: any = mat;
    for (let i = 0; i < keys.length - 1; i++) {
      obj[keys[i]] = { ...(obj[keys[i]] || {}) };
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    return { ...p, maternelle: mat };
  });
  // ⭐ MATERNELLE (DOMAINE_2) : lignes du tableau DÉROULEMENT 5 colonnes
  const addDer5Row = () => setMat("der5", [...(form.maternelle?.der5 || []), { plan: "", duree: "", description: "", formationEvolution: "", dosage: "" }]);
  const updateDer5Row = (idx: number, field: string, val: string) => setMat("der5", (form.maternelle?.der5 || []).map((r: any, i: number) => i === idx ? { ...r, [field]: val } : r));
  const removeDer5Row = (idx: number) => setMat("der5", (form.maternelle?.der5 || []).filter((_: any, i: number) => i !== idx));

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
  // ⭐ 2026-09-17 : « Cours » pré-rempli avec le nom de la classe (ex : CM1)
  //    conformément aux modèles officiels (« Cours : CM1 ») si le champ est vide.
  useEffect(() => {
    if (selectedClassId) {
      const cls = classes.find(c => c.classId === selectedClassId);
      setForm(prev => ({
        ...prev,
        classId: selectedClassId,
        className: cls?.className || prev.className || '',
        cours: prev.cours || cls?.className || '',
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
  //    pour [jour] [matière] [sous-matière] depuis le cahier journal.
  useEffect(() => {
    if (!initialSheetType && !initialLessonDay && !initialMatiere && !initialSousMatiere) return;
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
      // ⭐ MATERNELLE : pour les fiches DOMAINE/DOMAINE_2, remplir le champ
      //    Titre du contenu maternelle avec le libellé lisible du domaine.
      //    ⭐ 2026-09-15 (demande utilisateur) : le NUMÉRO du domaine est
      //    attribué AUTOMATIQUEMENT — le système vérifie dans quel domaine se
      //    trouve la matière (nom configuré ou libellé de colonne du cahier
      //    journal) : éducation → I, expression corporelle → II, pré-lecture/
      //    pré-écriture/pré-mathématiques/observations/éducation sensorielle/
      //    travaux manuels → III, expression émotionnelle/plastique → IV,
      //    communication orale/conte/poésie chant comptine/activités libres → V.
      const isMatType = initialSheetType === "DOMAINE" || initialSheetType === "DOMAINE_2";
      const matLabel = MAT_KEY_LABELS[initialMatiere] || initialMatiere.charAt(0).toUpperCase() + initialMatiere.slice(1);
      const domInfo = getMaternelleDomainInfo(initialMatiere);
      const autoRoman = domInfo.roman || "";
      const autoDomaineDu = domInfo.domainLabel || "";
      // ⭐ SOUS-MATIÈRE (2026-09-18 v2) : pré-remplit le champ dédié — c'est la
      //    clé de cohérence cahier journal ↔ fiche (rapprochement backend par
      //    matiereSpecifique normalisée).
      const sousMatiere = (initialSousMatiere || "").trim();
      setForm((p: any) => ({
        ...p,
        cours: p.cours || initialMatiere.charAt(0).toUpperCase() + initialMatiere.slice(1),
        titre: p.titre || (sousMatiere ? `Fiche ${sousMatiere}` : `Fiche ${matLabel}`),
        matiereSpecifique: p.matiereSpecifique || sousMatiere,
        ...(isMatType ? {
          maternelle: {
            ...p.maternelle,
            titre: p.maternelle?.titre || (sousMatiere || matLabel),
            domainNumber: p.maternelle?.domainNumber
              || (initialSheetType === "DOMAINE_2" ? "II" : (autoRoman || p.maternelle?.domainNumber || "")),
            domaineDu: p.maternelle?.domaineDu || autoDomaineDu || "",
          },
        } : {}),
      }));
    } else if (initialSousMatiere) {
      // ⭐ Sécurité : sous-matière fournie seule (sans matière) — on pré-remplit
      //    quand même le champ dédié + le titre.
      const sousMatiere = initialSousMatiere.trim();
      setForm((p: any) => ({
        ...p,
        titre: p.titre || `Fiche ${sousMatiere}`,
        matiereSpecifique: p.matiereSpecifique || sousMatiere,
      }));
    }
    // Ouvrir automatiquement le formulaire
    setShowForm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSheetType, initialLessonDay, initialMatiere, initialSousMatiere]);

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
      stripHtml(form.theme).length > 0 ||
      stripHtml(form.matiereSpecifique).length > 0 ||
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
    // ⭐ MATERNELLE : anti-vide sur le contenu structuré maternelleContent
    const isMaternelleFiche = isMaternelleClass || form.sheetType === "DOMAINE" || form.sheetType === "DOMAINE_2";
    if (isMaternelleFiche) {
      const m = form.maternelle || {};
      const str = (v: any) => stripHtml(String(v ?? ""));
      const matHasContent =
        [m.domaineDu, m.composante, m.sousComposante, m.theme, m.titre, m.section, m.duree, m.materiel,
         m.competence, m.capacite, m.habiletes, m.strategies, m.realisation, m.situationProbleme,
         m.questionComprehension, m.retour, m.evaluation, m.connexion, m.projection, m.rangement,
         m.notesPersonnelles, m.intro?.miseEnSituation, m.intro?.acquisAnterieurs, m.intro?.annonceApprentissage,
         m.activites?.a1, m.activites?.a2, m.activites?.a3, m.activites?.nb2, m.activites?.nb3]
          .some((v: any) => str(v).length > 0)
        || (Array.isArray(m.der5) && m.der5.some((r: any) => Object.values(r || {}).some((v: any) => String(v || "").trim().length > 0)))
        || Object.values(m.deroulementIntro || {}).some((cell: any) =>
          str(cell?.consignes).length > 0 || str(cell?.resultats).length > 0);
      if (!matHasContent) {
        toast.error("Aucun contenu à enregistrer", {
          description: "Vous n'avez rien renseigné dans cette fiche maternelle. Remplissez au moins un champ (thème, composante, déroulement, réalisation…) avant d'enregistrer.",
        });
        return;
      }
    }
    setSaving(true);
    try {
      const url = editingFiche ? `/api/pedagogy-space/fiches/${editingFiche.id}` : "/api/pedagogy-space/fiches";
      const method = editingFiche ? "PUT" : "POST";
      const body: any = editingFiche
        ? { ...form }
        : { ...form, academicYearId, teacherId, cahierJournalId: cahierJournalId || undefined };
      // ⭐ MATERNELLE : miroir des champs clés dans les colonnes de liste +
      //    contenu structuré complet dans maternelleContent (JSONB).
      if (isMaternelleFiche) {
        body.titre = form.maternelle?.titre || form.titre || "";
        body.duree = form.maternelle?.duree || form.duree || "";
        body.competence = form.maternelle?.competence || "";
        body.maternelleContent = form.maternelle;
      }
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
    // ⭐ MATERNELLE : parser maternelleContent (JSONB ou string) et fusionner
    //    avec les défauts pour que les objets imbriqués existent toujours.
    let mc: any = {};
    if (fiche.maternelleContent) {
      try { mc = typeof fiche.maternelleContent === "string" ? JSON.parse(fiche.maternelleContent) : fiche.maternelleContent; } catch { mc = {}; }
    }
    setForm({
      ...emptyForm, ...fiche,
      lessonDate: fiche.lessonDate ? formatDate(fiche.lessonDate) : "",
      adminDate: fiche.adminDate ? formatDate(fiche.adminDate) : "",
      deroulement: Array.isArray(fiche.deroulement) ? fiche.deroulement :
        (typeof fiche.deroulement === "string" ? JSON.parse(fiche.deroulement || "[]") : []),
      maternelle: {
        ...emptyForm.maternelle, ...mc,
        der5: Array.isArray(mc.der5) ? mc.der5 : [],
        deroulementIntro: {
          ...emptyForm.maternelle.deroulementIntro, ...(mc.deroulementIntro || {}),
          miseEnSituation: { ...emptyForm.maternelle.deroulementIntro.miseEnSituation, ...(mc.deroulementIntro?.miseEnSituation || {}) },
          acquisAnterieurs: { ...emptyForm.maternelle.deroulementIntro.acquisAnterieurs, ...(mc.deroulementIntro?.acquisAnterieurs || {}) },
          annonceApprentissage: { ...emptyForm.maternelle.deroulementIntro.annonceApprentissage, ...(mc.deroulementIntro?.annonceApprentissage || {}) },
        },
        intro: { ...emptyForm.maternelle.intro, ...(mc.intro || {}) },
        activites: { ...emptyForm.maternelle.activites, ...(mc.activites || {}) },
      },
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
    // ⭐ 2026-09-15 MATERNELLE — formulaire dédié aux fiches DOMAINE | DOMAINE_2
    //    (structure conforme aux modèles officiels de la maternelle : ÉCOLE
    //    MATERNELLE, FICHE DE, DOMAINE [n°], Domaine du, Composante, Date,
    //    Sous-composante, ACTIVITÉS D'APPRENTISSAGE N°, champs, DÉROULEMENT,
    //    INTRODUCTION, RÉALISATION, RETOUR ET PROJECTION, RANGEMENT,
    //    Notes personnelles).
    const isMaternelleFicheForm = isMaternelleClass || form.sheetType === "DOMAINE" || form.sheetType === "DOMAINE_2";
    if (isMaternelleFicheForm) {
      const matType = MATERNELLE_SHEET_TYPES.find(t => t.type === form.sheetType) || MATERNELLE_SHEET_TYPES[0];
      const isDom2 = form.sheetType === "DOMAINE_2";
      return (
        <div className="space-y-4">
          {/* Barre d'actions */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <button onClick={() => { setShowForm(false); setEditingFiche(null); setForm(emptyForm); }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">
              <ChevronLeft className="h-4 w-4" /> Retour à la liste
            </button>
            <div className="flex items-center gap-2">
              {formStatus && form.status !== 'DRAFT' && (
                <span className={cn("flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold uppercase", formStatus.color)}>
                  <formStatus.icon className="h-3.5 w-3.5" /> {formStatus.label}
                </span>
              )}
              <div className="text-sm font-semibold text-slate-700">{editingFiche ? "Modifier la fiche maternelle" : "Nouvelle fiche maternelle"}</div>
            </div>
            <button onClick={handleCreateOrUpdate} disabled={saving || isReadOnly}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title={isReadOnly ? "Fiche en lecture seule (statut: " + form.status + ")" : undefined}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingFiche ? "Mettre à jour" : "Créer la fiche"}
            </button>
          </div>

          {/* Sélection du format de fiche maternelle */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-3">Format de fiche pédagogique maternelle</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MATERNELLE_SHEET_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <button key={t.type} type="button"
                    onClick={() => setForm((p: any) => ({ ...p, sheetType: t.type }))}
                    className={cn("flex items-center gap-3 p-3 border-2 rounded-lg text-left transition-all",
                      form.sheetType === t.type ? t.color : "bg-white text-slate-500 border-slate-200 hover:border-slate-300")}>
                    <Icon className="h-6 w-6 shrink-0" />
                    <div>
                      <div className="text-sm font-bold">{t.label}</div>
                      <div className="text-[11px] opacity-75">{t.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* === Document — Modèle officiel maternelle === */}
          <div className="bg-white rounded-xl border-2 border-slate-800 p-6 space-y-6">
            {/* En-tête ÉCOLE MATERNELLE */}
            <div className="text-center border-b-2 pb-4 rounded-t-lg -mx-6 -mt-6 px-6 py-3 bg-slate-800">
              <h2 className="text-lg font-bold text-white uppercase tracking-wide">ÉCOLE MATERNELLE</h2>
              <div className="text-xs text-slate-300 mt-0.5">
                Fiche pédagogique — {isDom2 ? "DOMAINE II" : "DOMAINE"} · {form.className || classes.find(c => c.classId === form.classId)?.className || "—"}
              </div>
            </div>

            {/* FICHE DE + DOMAINE [n°] + Domaine du */}
            <div className="space-y-3">
              {/* ⭐ MATIÈRE (dynamique — « Matières & programmes ») */}
              <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-lg">
                <label className="block text-xs font-bold text-indigo-800 mb-1.5">
                  Matière / Domaine d'activité
                  <span className="ml-2 font-normal text-indigo-400">— matières configurées dans Pédagogie → Matières &amp; programmes</span>
                </label>
                {matSubjects.length > 0 ? (
                  <select
                    value={form.subjectId || ""}
                    onChange={(e) => {
                      const subj = matSubjects.find((s: any) => s.subjectId === e.target.value);
                      if (!subj) {
                        // Désélection — on vide le rattachement matière
                        setForm((p: any) => ({ ...p, subjectId: "" }));
                        return;
                      }
                      const info = getMaternelleDomainInfo(subj.subjectName);
                      setForm((p: any) => ({
                        ...p,
                        subjectId: subj.subjectId,
                        cours: p.cours || subj.subjectName,
                        titre: p.titre || subj.subjectName,
                        // ⭐ Format auto : Expression corporelle → DOMAINE II
                        sheetType: info.domainKey === "dom2" ? "DOMAINE_2" : (p.sheetType === "DOMAINE_2" && info.domainKey !== "dom2" ? "DOMAINE" : p.sheetType),
                        maternelle: {
                          ...p.maternelle,
                          titre: p.maternelle?.titre || subj.subjectName,
                          // N° romain auto (I→V) ; vide pour le groupe
                          // « DOMAINE [n° à renseigner] » (l'enseignante complète)
                          domainNumber: info.domainKey === "dom2"
                            ? p.maternelle?.domainNumber
                            : (info.roman || p.maternelle?.domainNumber || ""),
                          domaineDu: p.maternelle?.domaineDu || info.domainLabel || subj.subjectName,
                        },
                      }));
                    }}
                    disabled={isReadOnly}
                    className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-400 outline-none"
                  >
                    <option value="">— Sélectionner la matière (optionnel) —</option>
                    {matSubjects.map((s: any) => (
                      <option key={s.subjectId} value={s.subjectId}>
                        {s.subjectName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    Aucune matière configurée pour cette classe — l'administration doit d'abord
                    paramétrer les matières dans le module Pédagogie → « Matières &amp; programmes ».
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-bold text-slate-700 whitespace-nowrap">FICHE DE :</label>
                <input type="text" value={getMat("ficheDe")} onChange={e => setMat("ficheDe", e.target.value)} disabled={isReadOnly}
                  placeholder="Nom de l'enseignante" className="flex-1 min-w-[220px] px-3 py-1.5 border-b-2 border-slate-300 focus:border-indigo-500 outline-none text-sm bg-transparent" />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 bg-indigo-600 text-white font-bold text-sm px-4 py-1.5 rounded-md">DOMAINE</span>
                {!isDom2 ? (
                  <input type="text" value={getMat("domainNumber")} onChange={e => setMat("domainNumber", e.target.value)} disabled={isReadOnly}
                    placeholder="N° du domaine (à renseigner)" className="w-28 px-3 py-1.5 border-2 border-indigo-300 rounded-md text-center text-sm font-bold focus:border-indigo-500 outline-none" />
                ) : (
                  <span className="px-3 py-1.5 bg-slate-100 border-2 border-slate-300 rounded-md text-sm font-bold text-slate-700">II</span>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Domaine du :</label>
                <textarea value={getMat("domaineDu")} onChange={e => setMat("domaineDu", e.target.value)} disabled={isReadOnly} rows={2}
                  placeholder="Intitulé du domaine…" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
              </div>
            </div>

            {/* Composante / Date / Sous-composante / Activité N° */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Composante :</label>
                <input type="text" value={getMat("composante")} onChange={e => setMat("composante", e.target.value)} disabled={isReadOnly}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Date :</label>
                <input type="date" value={form.lessonDate || ""} onChange={e => setForm({ ...form, lessonDate: e.target.value })} disabled={isReadOnly}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Sous-composante :</label>
                <input type="text" value={getMat("sousComposante")} onChange={e => setMat("sousComposante", e.target.value)} disabled={isReadOnly}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div className="flex items-end gap-2">
                <span className="inline-flex items-center h-[38px] bg-indigo-600 text-white font-bold text-xs px-3 rounded-md whitespace-nowrap">
                  {isDom2 ? "ACTIVITÉ D'APPRENTISSAGE N°" : "ACTIVITÉS D'APPRENTISSAGE N°"}
                </span>
                <input type="text" value={getMat("activiteNumero")} onChange={e => setMat("activiteNumero", e.target.value)} disabled={isReadOnly}
                  className="flex-1 min-w-[60px] px-3 py-1.5 border-2 border-indigo-300 rounded-md text-center text-sm font-bold focus:border-indigo-500 outline-none" />
              </div>
            </div>

            {/* Champs pédagogiques */}
            <section className="border-l-4 border-slate-300 pl-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 bg-slate-100 px-3 py-2 rounded-lg">Champs de la fiche</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                {[
                  { label: "Thème :", key: "theme" },
                  { label: "Titre :", key: "titre" },
                  { label: "Section :", key: "section" },
                  { label: "Durée :", key: "duree" },
                  { label: isDom2 ? "Matériels :" : "Matériel :", key: "materiel" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{f.label}</label>
                    <input type="text" value={getMat(f.key)} onChange={e => setMat(f.key, e.target.value)} disabled={isReadOnly}
                      className="w-full px-3 py-1.5 border-b border-slate-300 focus:border-indigo-500 outline-none text-sm bg-transparent" />
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {[
                  { label: "Compétence :", key: "competence" },
                  { label: isDom2 ? "Capacités :" : "Capacité :", key: "capacite" },
                  { label: "Habilités :", key: "habiletes" },
                  { label: "Stratégies D'ens/Apprent/Eval :", key: "strategies" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{f.label}</label>
                    <RichTextEditor value={getMat(f.key)} onChange={html => setMat(f.key, html)} disabled={isReadOnly} minHeight="60px" />
                  </div>
                ))}
              </div>
            </section>

            {/* ⭐ Observation du directeur — Champs */}
            {(() => {
              let obs = form.directorSectionObservations;
              if (typeof obs === 'string') { try { obs = JSON.parse(obs); } catch { obs = {}; } }
              const val = (obs as any)?.en_tete;
              if (!val || !String(val).trim()) return null;
              return (
                <div className="p-2 bg-red-50 border border-red-300 rounded-lg">
                  <div className="text-[10px] font-bold text-red-700 uppercase mb-1">Observation du Directeur — Champs de la fiche</div>
                  <div className="text-xs text-red-800 font-semibold whitespace-pre-wrap">{String(val)}</div>
                </div>
              );
            })()}

            {/* DÉROULEMENT */}
            <section className="border-l-4 border-slate-300 pl-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 bg-slate-100 px-3 py-2 rounded-lg">DÉROULEMENT</h3>

              {isDom2 ? (
                /* DOMAINE 2 — Tableau 5 colonnes : Plan | Durée | Description des activités | Formation Evolution | Dosage */
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] text-slate-500">Tableau du déroulement — 5 colonnes</div>
                    {!isReadOnly && (
                      <button type="button" onClick={addDer5Row} className="flex items-center gap-1 px-2 py-1 text-xs bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100">
                        <Plus className="h-3 w-3" /> Ajouter une ligne
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto border border-slate-300 rounded-lg">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Plan</th>
                          <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-20">Durée</th>
                          <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase">Description des activités</th>
                          <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-40">Formation Evolution</th>
                          <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Dosage</th>
                          {!isReadOnly && <th className="border border-slate-300 px-2 py-2 w-10"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {(form.maternelle?.der5 || []).map((row: any, idx: number) => (
                          <tr key={idx}>
                            <td className="border border-slate-300 p-1"><input type="text" value={row.plan || ""} onChange={e => updateDer5Row(idx, "plan", e.target.value)} disabled={isReadOnly} className="w-full px-1 py-1 text-center bg-transparent outline-none" /></td>
                            <td className="border border-slate-300 p-1"><input type="text" value={row.duree || ""} onChange={e => updateDer5Row(idx, "duree", e.target.value)} disabled={isReadOnly} className="w-full px-1 py-1 text-center bg-transparent outline-none" /></td>
                            <td className="border border-slate-300 p-1"><input type="text" value={row.description || ""} onChange={e => updateDer5Row(idx, "description", e.target.value)} disabled={isReadOnly} className="w-full px-1 py-1 bg-transparent outline-none" /></td>
                            <td className="border border-slate-300 p-1"><input type="text" value={row.formationEvolution || ""} onChange={e => updateDer5Row(idx, "formationEvolution", e.target.value)} disabled={isReadOnly} className="w-full px-1 py-1 bg-transparent outline-none" /></td>
                            <td className="border border-slate-300 p-1"><input type="text" value={row.dosage || ""} onChange={e => updateDer5Row(idx, "dosage", e.target.value)} disabled={isReadOnly} className="w-full px-1 py-1 text-center bg-transparent outline-none" /></td>
                            {!isReadOnly && (
                              <td className="border border-slate-300 px-1 py-1 text-center">
                                <button type="button" onClick={() => removeDer5Row(idx)} className="text-red-500 hover:bg-red-50 rounded p-1"><Trash2 className="h-3 w-3" /></button>
                              </td>
                            )}
                          </tr>
                        ))}
                        {(!form.maternelle?.der5 || form.maternelle.der5.length === 0) && (
                          <tr><td colSpan={isReadOnly ? 5 : 6} className="border border-slate-300 px-4 py-4 text-center text-slate-400 text-xs italic">Aucune ligne. Cliquez sur « Ajouter une ligne ».</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* DOMAINE — Tableau 2 colonnes : Consignes | Résultats Attendus — avec INTRODUCTION */
                <div className="overflow-x-auto border border-slate-300 rounded-lg">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-left">Consignes :</th>
                        <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-left w-[38%]">Résultats Attendus :</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td colSpan={2} className="border border-slate-300 px-3 py-1.5 font-bold text-slate-700 bg-indigo-50 text-[11px] uppercase tracking-wide">INTRODUCTION</td></tr>
                      {[
                        { label: "Mise en situation :", key: "miseEnSituation" },
                        { label: "Prise en compte des acquis antérieurs :", key: "acquisAnterieurs" },
                        { label: "Annonce de l'apprentissage du jour :", key: "annonceApprentissage" },
                      ].map(row => (
                        <tr key={row.key} className="align-top">
                          <td className="border border-slate-300 p-1">
                            <div className="text-[11px] font-bold text-slate-600 mb-1">{row.label}</div>
                            <RichTextEditor value={getMat(`deroulementIntro.${row.key}.consignes`)} onChange={html => setMat(`deroulementIntro.${row.key}.consignes`, html)} disabled={isReadOnly} minHeight="60px" />
                          </td>
                          <td className="border border-slate-300 p-0">
                            <RichTextEditor value={getMat(`deroulementIntro.${row.key}.resultats`)} onChange={html => setMat(`deroulementIntro.${row.key}.resultats`, html)} disabled={isReadOnly} minHeight="76px" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ⭐ Observation du directeur — Déroulement */}
            {(() => {
              let obs = form.directorSectionObservations;
              if (typeof obs === 'string') { try { obs = JSON.parse(obs); } catch { obs = {}; } }
              const val = (obs as any)?.deroulement;
              if (!val || !String(val).trim()) return null;
              return (
                <div className="p-2 bg-red-50 border border-red-300 rounded-lg">
                  <div className="text-[10px] font-bold text-red-700 uppercase mb-1">Observation du Directeur — Déroulement</div>
                  <div className="text-xs text-red-800 font-semibold whitespace-pre-wrap">{String(val)}</div>
                </div>
              );
            })()}

            {/* INTRODUCTION — DOMAINE_2 (3 zones côte à côte) */}
            {isDom2 && (
              <section className="border-l-4 border-slate-300 pl-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 bg-slate-100 px-3 py-2 rounded-lg">INTRODUCTION</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[
                    { label: "Mise en situation", key: "miseEnSituation" },
                    { label: "Prise en compte des acquis antérieurs", key: "acquisAnterieurs" },
                    { label: "Annonce de l'apprentissage du jour", key: "annonceApprentissage" },
                  ].map(z => (
                    <div key={z.key} className="border border-slate-300 rounded-lg overflow-hidden">
                      <div className="bg-indigo-50 text-indigo-800 text-[11px] font-bold px-2 py-1.5 border-b border-slate-300">{z.label}</div>
                      <RichTextEditor value={getMat(`intro.${z.key}`)} onChange={html => setMat(`intro.${z.key}`, html)} disabled={isReadOnly} minHeight="90px" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* RÉALISATION — Construction de nouveaux savoirs */}
            <section className="border-l-4 border-slate-300 pl-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 bg-slate-100 px-3 py-2 rounded-lg">
                RÉALISATION — Construction de nouveaux savoirs
              </h3>
              <RichTextEditor value={getMat("realisation")} onChange={html => setMat("realisation", html)} disabled={isReadOnly} minHeight="100px" />

              {/* DOMAINE_2 — Suite : Situation problème, Question de compréhension, Activités 1-3 */}
              {isDom2 && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Situation problème :</label>
                    <RichTextEditor value={getMat("situationProbleme")} onChange={html => setMat("situationProbleme", html)} disabled={isReadOnly} minHeight="60px" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Question de compréhension :</label>
                    <RichTextEditor value={getMat("questionComprehension")} onChange={html => setMat("questionComprehension", html)} disabled={isReadOnly} minHeight="60px" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {[
                      { label: "Activité n° 1", key: "a1", nbKey: null as string | null },
                      { label: "Activité n° 2", key: "a2", nbKey: "nb2" },
                      { label: "Activité n° 3", key: "a3", nbKey: "nb3" },
                    ].map(a => (
                      <div key={a.key} className="border border-slate-300 rounded-lg overflow-hidden">
                        <div className="bg-indigo-50 text-indigo-800 text-[11px] font-bold px-2 py-1.5 border-b border-slate-300">{a.label}</div>
                        <RichTextEditor value={getMat(`activites.${a.key}`)} onChange={html => setMat(`activites.${a.key}`, html)} disabled={isReadOnly} minHeight="80px" />
                        {a.nbKey && (
                          <div className="px-2 py-1.5 border-t border-slate-200 flex items-center gap-2 bg-slate-50">
                            <span className="text-[11px] font-bold text-slate-600">NB :</span>
                            <input type="text" value={getMat(`activites.${a.nbKey}`)} onChange={e => setMat(`activites.${a.nbKey}`, e.target.value)} disabled={isReadOnly}
                              className="flex-1 text-xs bg-transparent outline-none border-b border-slate-300 focus:border-indigo-500" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* ⭐ Observation du directeur — Réalisation */}
            {(() => {
              let obs = form.directorSectionObservations;
              if (typeof obs === 'string') { try { obs = JSON.parse(obs); } catch { obs = {}; } }
              const val = (obs as any)?.realisation;
              if (!val || !String(val).trim()) return null;
              return (
                <div className="p-2 bg-red-50 border border-red-300 rounded-lg">
                  <div className="text-[10px] font-bold text-red-700 uppercase mb-1">Observation du Directeur — Réalisation</div>
                  <div className="text-xs text-red-800 font-semibold whitespace-pre-wrap">{String(val)}</div>
                </div>
              );
            })()}

            {/* RETOUR ET PROJECTION */}
            <section className="border-l-4 border-slate-300 pl-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 bg-slate-100 px-3 py-2 rounded-lg">RETOUR ET PROJECTION</h3>
              <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-2">
                {[
                  { label: "Retour :", key: "retour" },
                  { label: "Evaluation :", key: "evaluation" },
                  { label: "Connexion :", key: "connexion" },
                  { label: "Projection :", key: "projection" },
                ].map(f => (
                  <div key={f.key} className="contents">
                    <div className="flex items-start pt-2"><label className="text-xs font-bold text-slate-700">{f.label}</label></div>
                    <RichTextEditor value={getMat(f.key)} onChange={html => setMat(f.key, html)} disabled={isReadOnly} minHeight="56px" />
                  </div>
                ))}
              </div>
            </section>

            {/* ⭐ Observation du directeur — Retour et projection */}
            {(() => {
              let obs = form.directorSectionObservations;
              if (typeof obs === 'string') { try { obs = JSON.parse(obs); } catch { obs = {}; } }
              const val = (obs as any)?.retour_projection;
              if (!val || !String(val).trim()) return null;
              return (
                <div className="p-2 bg-red-50 border border-red-300 rounded-lg">
                  <div className="text-[10px] font-bold text-red-700 uppercase mb-1">Observation du Directeur — Retour et projection</div>
                  <div className="text-xs text-red-800 font-semibold whitespace-pre-wrap">{String(val)}</div>
                </div>
              );
            })()}

            {/* RANGEMENT */}
            <section className="border-l-4 border-slate-300 pl-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 bg-slate-100 px-3 py-2 rounded-lg">RANGEMENT</h3>
              <RichTextEditor value={getMat("rangement")} onChange={html => setMat("rangement", html)} disabled={isReadOnly} minHeight="60px" />
            </section>

            {/* ⭐ Observation du directeur — Rangement */}
            {(() => {
              let obs = form.directorSectionObservations;
              if (typeof obs === 'string') { try { obs = JSON.parse(obs); } catch { obs = {}; } }
              const val = (obs as any)?.rangement;
              if (!val || !String(val).trim()) return null;
              return (
                <div className="p-2 bg-red-50 border border-red-300 rounded-lg">
                  <div className="text-[10px] font-bold text-red-700 uppercase mb-1">Observation du Directeur — Rangement</div>
                  <div className="text-xs text-red-800 font-semibold whitespace-pre-wrap">{String(val)}</div>
                </div>
              );
            })()}

            {/* Notes personnelles */}
            <div className="flex items-center gap-3 border-t-2 border-slate-200 pt-4">
              <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Notes personnelles :</label>
              <input type="text" value={getMat("notesPersonnelles")} onChange={e => setMat("notesPersonnelles", e.target.value)} disabled={isReadOnly}
                className="flex-1 px-2 py-1 border-b border-slate-300 focus:border-indigo-500 outline-none text-sm bg-transparent" />
            </div>

            {/* ⭐ Observation générale du directeur */}
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
          </div>
        </div>
      );
    }
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
              {(() => {
                const raw = form.sheetType === "MATH" ? "MATHÉMATIQUE" : form.sheetType === "FRANCAIS" ? "FRANÇAIS" : (sheetType?.label || "").toUpperCase();
                const de = /^[AEÉÈÊIÎOÔUÛHY]/.test(raw) ? "D'" : "DE ";
                return `FICHE ${de}${raw}`;
              })()}
            </h2>
          </div>

          {/* ⭐ 2026-09-17 — EN-TÊTE OFFICIEL PAR TYPE (captures modèles école) */}
          {form.sheetType === "FRANCAIS" ? (
            <>
              {/* FRANÇAIS — champ « Matière spécifique » JUSTE APRÈS l'en-tête :
                  Dictée, Grammaire, Conjugaison, Lecture… */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Matière spécifique <span className="font-normal text-slate-400">(Dictée, Grammaire, Conjugaison, Orthographe, Lecture…)</span>
                </label>
                <input type="text" list="fr-matiere-specifique-suggestions" value={form.matiereSpecifique || ""} disabled={isReadOnly}
                  onChange={e => setForm({ ...form, matiereSpecifique: e.target.value })}
                  placeholder="Ex : Dictée, Grammaire, Lecture oralisée, Conjugaison…"
                  className="w-full px-3 py-2 border-2 border-emerald-300 rounded-lg text-sm font-semibold bg-emerald-50/40" />
                <datalist id="fr-matiere-specifique-suggestions">
                  {/* ⭐ Catalogue partagé cahier-sous-matieres.ts (officiel + variantes) */}
                  {suggestionsPourSheetType("FRANCAIS").map(s => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {[
                  { label: "Cours", key: "cours" }, { label: "Durée", key: "duree" },
                  { label: "Unité N°", key: "unite" }, { label: "Étape N°", key: "etape" },
                  { label: "Date", key: "lessonDate", type: "date" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
                    <input type={f.type || "text"} value={form[f.key] || ""} onChange={e => setForm({ ...form, [f.key]: e.target.value })} disabled={isReadOnly}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Classe</label>
                  <div className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm font-medium bg-slate-50">
                    {form.className || classes.find(c => c.classId === form.classId)?.className || "—"}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Titre</label>
                <input type="text" value={form.titre || ""} onChange={e => setForm({ ...form, titre: e.target.value })} disabled={isReadOnly}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
              </div>
            </>
          ) : form.sheetType === "MATH" ? (
            <>
              {/* MATH — modèle officiel « dossiers » :
                  Fn°/Cours/Classe → DOSSIER N° → THEME → SA N° + Thème (sous-thème) →
                  Séquence N° / Séance N° / Durée / Date → Titre */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {[
                  { label: "Fn°", key: "fn", placeholder: "N° de la fiche" },
                  { label: "Cours", key: "cours", placeholder: "Ex : CM1" },
                  { label: "SA N°", key: "san", placeholder: "Ex : 1" },
                  { label: "Séquence N°", key: "sequence", placeholder: "Ex : 0" },
                  { label: "Séance N°", key: "seance", placeholder: "Ex : 0" },
                  { label: "Durée", key: "duree", placeholder: "Ex : 60 min" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
                    <input type="text" value={form[f.key] || ""} onChange={e => setForm({ ...form, [f.key]: e.target.value })} disabled={isReadOnly}
                      placeholder={f.placeholder} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                  <input type="date" value={form.lessonDate || ""} onChange={e => setForm({ ...form, lessonDate: e.target.value })} disabled={isReadOnly}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Classe</label>
                  <div className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm font-medium bg-slate-50">
                    {form.className || classes.find(c => c.classId === form.classId)?.className || "—"}
                  </div>
                </div>
              </div>
              {/* ⭐ SOUS-MATIÈRE (MATH) — facultatif (tout est déjà sur la fiche
                  de préparation) ; clé de cohérence cahier journal */}
              <SousMatiereField
                sheetType="MATH"
                value={form.matiereSpecifique || ""}
                onChange={(v) => setForm({ ...form, matiereSpecifique: v })}
                disabled={isReadOnly}
              />
              <div className="grid grid-cols-2 md:grid-cols-[160px_1fr] gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">DOSSIER N°</label>
                  <input type="text" value={form.dossier || ""} onChange={e => setForm({ ...form, dossier: e.target.value })} disabled={isReadOnly}
                    placeholder="Ex : 1" className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">THEME</label>
                  <input type="text" value={form.theme || ""} onChange={e => setForm({ ...form, theme: e.target.value })} disabled={isReadOnly}
                    placeholder="Ex : La coopérative agricole" className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Thème <span className="font-normal text-slate-400">(sous-thème de la SA)</span></label>
                <input type="text" value={form.saTheme || ""} onChange={e => setForm({ ...form, saTheme: e.target.value })} disabled={isReadOnly}
                  placeholder="Ex : L'organisation de la production" className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Titre</label>
                <input type="text" value={form.titre || ""} onChange={e => setForm({ ...form, titre: e.target.value })} disabled={isReadOnly}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
              </div>
            </>
          ) : (
            <>
              {/* ES / EST / EA / EPS / STANDARD — modèle officiel :
                  Fn°/Cours/Classe → THEME → SA N° / Séance N° / Durée / Date → Titre */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {[
                  { label: "Fn°", key: "fn", placeholder: "N° de la fiche" },
                  { label: "Cours", key: "cours", placeholder: "Ex : CM1" },
                  { label: "SA N°", key: "san", placeholder: "Ex : 6" },
                  { label: "Séance N°", key: "seance", placeholder: "Ex : 7" },
                  { label: "Durée", key: "duree", placeholder: "Ex : 60 min" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
                    <input type="text" value={form[f.key] || ""} onChange={e => setForm({ ...form, [f.key]: e.target.value })} disabled={isReadOnly}
                      placeholder={f.placeholder} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                  <input type="date" value={form.lessonDate || ""} onChange={e => setForm({ ...form, lessonDate: e.target.value })} disabled={isReadOnly}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Classe</label>
                  <div className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm font-medium bg-slate-50">
                    {form.className || classes.find(c => c.classId === form.classId)?.className || "—"}
                  </div>
                </div>
              </div>
              {/* ⭐ SOUS-MATIÈRE (ES : Morale/Civisme/Histoire/Géographie ;
                  EA : Chant/Poésie/Dessin/Conte/Couture/Atelier/Art dramatique ;
                  EPS : facultatif — comme l'EST) —
                  clé de cohérence avec le cahier journal */}
              <SousMatiereField
                sheetType={form.sheetType}
                value={form.matiereSpecifique || ""}
                onChange={(v) => setForm({ ...form, matiereSpecifique: v })}
                disabled={isReadOnly}
              />
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">THEME</label>
                <input type="text" value={form.theme || ""} onChange={e => setForm({ ...form, theme: e.target.value })} disabled={isReadOnly}
                  placeholder="Ex : Élaboration de documents présentant quelques aspects géographiques du Bénin" className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Titre</label>
                <input type="text" value={form.titre || ""} onChange={e => setForm({ ...form, titre: e.target.value })} disabled={isReadOnly}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
              </div>
            </>
          )}

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
            {sheetTypesForClass.map((t: any) => <option key={t.type} value={t.type}>{t.label}</option>)}
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
              // ⭐ MATERNELLE : type par défaut = DOMAINE (n° à renseigner)
              sheetType: isMaternelleClass ? "DOMAINE" : emptyForm.sheetType,
              // ⭐ MATERNELLE : pré-remplir « FICHE DE » avec le nom du user connecté
              maternelle: {
                ...emptyForm.maternelle,
                ficheDe: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "",
              },
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
            const st = sheetTypesForClass.find((t: any) => t.type === fiche.sheetType)
              || (fiche.sheetType === "DOMAINE" || fiche.sheetType === "DOMAINE_2"
                ? MATERNELLE_SHEET_TYPES.find(t => t.type === fiche.sheetType) : undefined);
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
                <div className="text-xs text-slate-500 mb-2">
                  {formatDateFR(fiche.lessonDate || fiche.createdAt)}
                  {fiche.sheetType === "DOMAINE" || fiche.sheetType === "DOMAINE_2"
                    ? (() => {
                        let mc: any = fiche.maternelleContent;
                        if (typeof mc === "string") { try { mc = JSON.parse(mc); } catch { mc = {}; } }
                        return ` — Domaine ${mc?.domainNumber || (fiche.sheetType === "DOMAINE_2" ? "II" : "—")}`;
                      })()
                    : fiche.sheetType === "FRANCAIS"
                      ? ` — ${fiche.matiereSpecifique ? fiche.matiereSpecifique.replace(/<[^>]*>/g, '') : "Français"}${fiche.unite ? ` · Unité ${fiche.unite}` : ""}${fiche.etape ? ` · Étape ${fiche.etape}` : ""}`
                      : fiche.matiereSpecifique
                        // ⭐ SOUS-MATIÈRE (MATH/ES/EA/EPS/EST/STANDARD) : affichée
                        //    en priorité quand elle est renseignée (ex : « — Morale »)
                        ? ` — ${String(fiche.matiereSpecifique).replace(/<[^>]*>/g, '')}${fiche.seance ? ` · Séance ${fiche.seance}` : ""}`
                        : ` — ${fiche.fn ? `Fn°${fiche.fn}` : `SA N°${fiche.san || "—"}`}${fiche.seance ? ` · Séance ${fiche.seance}` : ""}`}
                </div>
                {fiche.theme && (
                  <div className="text-[11px] text-slate-400 line-clamp-1 mb-1" title={String(fiche.theme).replace(/<[^>]*>/g, '')}>
                    Thème : {String(fiche.theme).replace(/<[^>]*>/g, '')}
                  </div>
                )}
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
                          DOMAINE: 'Domaine', DOMAINE_2: 'Domaine 2',
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
