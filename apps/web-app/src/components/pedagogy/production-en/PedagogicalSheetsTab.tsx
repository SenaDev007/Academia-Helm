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

import { useState, useEffect, useCallback, useRef } from "react";
// ⭐ 17/10/2026 — FIX deadlock React (miroir FR) : flushSync force le
//    traitement synchrone des mises à jour — voir commentaire détaillé dans
//    production/PedagogicalSheetsTab.tsx.
import { flushSync } from "react-dom";
import {
  FileText, Loader2, Plus, Save, RefreshCw, Send, Trash2,
  ChevronLeft, Clock, CheckCircle2, XCircle, BookOpen, Sigma,
  FlaskConical, Users, Palette, Download, History, Copy, Dumbbell, Languages, AlertTriangle, ScanSearch,
} from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { SignatureCanvas } from "@/components/ui/SignatureCanvas";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useAutoSave, fireKeepaliveSave } from "@/hooks/useAutoSave";
// ⭐ 2026-10-16 — Extraction IA d'une fiche à partir de captures (modèles
//    vision NVIDIA) : transcription du contenu d'une fiche existante
//    (PDF/Word/photocopie avec filigrane) → remplissage automatique des
//    champs vides du formulaire. Miroir de la piste FR (production).
import { FicheAiExtractionModal, type FicheExtractionContext } from "@/components/pedagogy/production/FicheAiExtractionModal";
// ⭐ v4.7.0 (retour terrain mobile 22/09/2026) : lecture de la file offline
//    du Service Worker — les sauvegardes mises en file pendant un glitch
//    réseau mobile sont AFFICHÉES dans la liste (badge « envoi en attente »)
//    au lieu de laisser croire que « rien n'est enregistré » (miroir FR).
import { outboxService } from "@/lib/offline/outbox.service";
import { AutosaveIndicator } from "@/components/pedagogy/media/AutosaveIndicator";

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
  /** ⭐ 2026-09-19 (retour promoteur, miroir FR) : lundi (YYYY-MM-DD) de la
   *    semaine AFFICHÉE dans le cahier journal — source de vérité de la date. */
  initialWeekStartDate?: string;
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
  // ⭐ 2026-09-15 — fiche standard pour l'anglais / l'informatique (spécialiste)
  { type: "STANDARD", label: "Anglais / Informatique (fiche standard)", icon: Languages, color: "bg-violet-100 text-violet-700 border-violet-200", headerBg: "bg-violet-600", sectionBorder: "border-violet-300" },
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

// ⭐ Champs "pédagogiquement significatifs" — utilisés pour décider si un
//    brouillon local de crash mérite d'être proposé à la restauration (on ne
//    remonte pas un bandeau pour un formulaire à peine ouvert).
const CONTENT_FIELDS = [
  "san", "sequence", "cours", "titre", "duree",
  "competence", "habilete", "prealable", "contenu", "methodes", "moyensDidactiques", "evaluation",
  "ibis_1", "ibis_2", "ibis_3", "ibis_4", "ibis_5",
  "phase_introductive", "phase_systematisation", "phase_intro_ens1", "phase_syst_ens",
  "app_col1", "app_col2", "app_col3",
  "objectivation", "evalRetour", "projection",
];
function stripHtml(v: any): string {
  return String(v || "").replace(/<[^>]*>/g, "").trim();
}
// ⭐ 2026-10-16 — Vidage « profond » (extraction IA) : un champ est VIDE si
//    null/undefined, chaîne blanche, ou objet/tableau dont toutes les
//    feuilles sont vides. Ne JAMAIS écraser la saisie de l'enseignant.
function isDeepEmpty(v: any): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0 || v.every(isDeepEmpty);
  if (typeof v === "object") return Object.values(v).every(isDeepEmpty);
  return false;
}
function hasRealContent(f: any): boolean {
  if (!f) return false;
  let filled = 0;
  for (const k of CONTENT_FIELDS) {
    if (stripHtml(f[k]).length >= 3) filled++;
  }
  const der = Array.isArray(f?.deroulement) ? f.deroulement : [];
  const hasSteps = der.some((s: any) =>
    stripHtml(s?.consignes).length >= 3 || stripHtml(s?.resultats).length >= 3,
  );
  return filled >= 2 || (filled >= 1 && hasSteps);
}

// ═════════════════════════════════════════════════════════════════════════
// ⭐ v4.7.0 (retour terrain mobile 22/09/2026) — FICHES EN ATTENTE D'ENVOI
// Miroir FR : fusion des sauvegardes PENDING de la file offline du SW dans
// la liste affichée (badge « envoi en attente ») — le serveur ne connaît
// pas encore la fiche pendant un glitch réseau mobile, mais l'enseignant
// la VOIT et sait qu'elle partira automatiquement. Les événements SYNCED
// ne sont plus PENDING → contenu serveur (source de vérité) repris.
// ═════════════════════════════════════════════════════════════════════════
async function mergePendingOfflineFiches(
  serverList: any[],
  tenantId: string,
  classId: string,
): Promise<any[]> {
  try {
    if (typeof window === "undefined") return serverList;
    const events = await outboxService.getPendingEvents(tenantId);
    if (!Array.isArray(events) || events.length === 0) return serverList;

    const ficheEvents = events.filter((ev: any) => {
      const url = String(ev?.metadata?.request?.url || "");
      if (!url.includes("/api/pedagogy-space/fiches")) return false;
      const method = String(ev?.metadata?.request?.method || ev?.operation || "").toUpperCase();
      return method === "POST" || method === "PUT" || method === "PATCH" || method === "UPDATE" || method === "CREATE";
    });
    if (ficheEvents.length === 0) return serverList;

    const serverIds = new Set(serverList.map((f: any) => String(f?.id)));
    const merged = serverList.map((f: any) => ({ ...f }));

    for (const ev of ficheEvents) {
      const body = ev?.metadata?.request?.body || ev?.payload || {};
      const isCreate = String(ev?.metadata?.request?.method || ev?.operation || "").toUpperCase() === "POST"
        || String(ev?.operation || "").toUpperCase() === "CREATE";
      const ficheId = String(ev?.entityId || body?.id || "");
      if (!ficheId) continue;

      if (isCreate && !serverIds.has(ficheId)) {
        serverIds.add(ficheId);
        merged.push({
          ...body,
          id: ficheId,
          classId: body?.classId || classId,
          status: "DRAFT",
          updatedAt: ev?.createdAt || new Date().toISOString(),
          _pendingSync: true,
        });
      } else if (serverIds.has(ficheId)) {
        const target = merged.find((f: any) => String(f?.id) === ficheId);
        if (target) target._pendingSync = true;
      }
    }
    return merged;
  } catch {
    return serverList;
  }
}

// ⭐ Configuration spécifique par type de fiche
// Chaque type a une section "I.bis" différente entre les éléments de planification
// et le déroulement.
const SHEET_TYPE_CONFIG: Record<string, {
  ibisTitle: string;
  ibisFields: { label: string; key: string; placeholder: string; short?: boolean }[];
  phases?: { label: string; key: string }[];
  applicationTable?: { columns: string[]; keys: string[] };
  /** ⭐ 2026-09-19 (retour promoteur) — exercices structuraux du FRANÇAIS en
   *    tableaux 2 colonnes (miroir de la piste FR) : introductive
   *    (Enseignant | Enseignant), systématisation (Enseignant | Apprenant). */
  phaseTables?: { label: string; columns: string[]; keys: string[] }[];
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
    // ⭐ 2026-09-19 (retour promoteur) — EXERCICES STRUCTURAUX en tableaux 2 colonnes
    //    (miroir piste FR) : introductive (Enseignant | Enseignant),
    //    systématisation (Enseignant | Apprenant).
    phaseTables: [
      {
        label: "Phase introductive",
        columns: ["Enseignant", "Enseignant"],
        keys: ["phase_intro_ens1", "phase_intro_ens2"],
      },
      {
        label: "Phase de systématisation",
        columns: ["Enseignant", "Apprenant"],
        keys: ["phase_syst_ens", "phase_syst_app"],
      },
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
  // ⭐ 2026-09-15 — fiche standard (anglais / informatique — spécialiste)
  STANDARD: {
    ibisTitle: "Activités préliminaires",
    ibisFields: [
      { label: "Rappel de la leçon précédente", key: "ibis_1", placeholder: "Ex: Questions orales, révision du vocabulaire/de la notion de la séance précédente..." },
      { label: "Vocabulaire / notions nouvelles de la séance", key: "ibis_2", placeholder: "Ex: Nouveaux mots, expressions ou termes techniques à faire acquérir (anglais) / notions et manipulations préalables (informatique)..." },
    ],
  },
};

export function PedagogicalSheetsTab({ tenantId, academicYearId, teacherId, cahierJournalId, initialClassId, initialLessonDay, initialWeekStartDate, initialSheetType, initialMatiere, initialFicheId }: PedagogicalSheetsTabProps) {
  const { user } = useAppSession();
  const [classes, setClasses] = useState<any[]>([]);
  // ⭐ FIX (miroir FR — « le champ classe affiche parfois — ») : présélection
  //    dès l'initialisation + états de chargement/échec explicites.
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId || "");
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesFailed, setClassesFailed] = useState(false);
  const [fiches, setFiches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingFiche, setEditingFiche] = useState<any>(null);
  const [filterType, setFilterType] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // ⭐ 2026-10-16 — EXTRACTION IA DEPUIS DES CAPTURES (miroir FR) : état
  //    d'ouverture de la modale + fusion des champs extraits (ne remplit que
  //    les champs ENCORE VIDES — l'enseignant garde la main sur sa saisie).
  //    ⭐ v2 (prompt dynamique) : le contexte déclaré AVANT l'import (niveau +
  //    catégorie + sous-matière + classe) reconfigure le formulaire.
  const [showAiExtraction, setShowAiExtraction] = useState(false);

  const handleApplyAiFields = useCallback((fields: Record<string, any>, context?: FicheExtractionContext) => {
    const apply = () => {
    setForm((prev: any) => {
      const next: any = { ...prev };
      // ⭐ CONTEXTE DÉCLARÉ AVANT L'IMPORT — bascule du formulaire sur la
      //    fiche ciblée (type, sous-matière, classe).
      if (context?.sheetType && context.sheetType !== prev.sheetType) {
        next.sheetType = context.sheetType;
      }
      if (context?.matiereSpecifique && isDeepEmpty(prev.matiereSpecifique)) {
        next.matiereSpecifique = context.matiereSpecifique;
      }
      if (context?.className) {
        if (isDeepEmpty(prev.cours)) next.cours = context.className;
        if (isDeepEmpty(prev.className)) next.className = context.className;
      }
      for (const [key, value] of Object.entries(fields)) {
        // II- Déroulement : appliqué seulement si le tableau est encore vide
        if (key === "deroulement") {
          if (Array.isArray(value) && value.length > 0 &&
              (!Array.isArray(prev.deroulement) || prev.deroulement.length === 0)) {
            next.deroulement = value;
          }
          continue;
        }
        // Exception lessonDate : pré-rempli avec la date du jour par défaut
        // → appliqué si l'IA a lu une date valide AAAA-MM-JJ sur la fiche.
        if (key === "lessonDate") {
          if (/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
            next.lessonDate = String(value);
          }
          continue;
        }
        // Champ scalaire — rempli seulement s'il est vide (jamais écrasé)
        if (isDeepEmpty(prev[key]) && !isDeepEmpty(value)) {
          next[key] = value;
        }
      }
      return next;
    });
    }; // fin de apply()
    try { flushSync(apply); } catch { apply(); }
  }, []);

  // (currentSheetTypeLabel est déclaré APRÈS `const [form, setForm]` — il
  //  lit form.sheetType au rendu, il ne doit pas précéder la déclaration.)

  // ⭐ État pour la réutilisation cross-année des fiches
  //    Permet à un enseignant de retrouver les fiches validées des années
  //    précédentes (même classe + matière) et de les dupliquer vers l'année courante.
  const [showPreviousYearsModal, setShowPreviousYearsModal] = useState(false);
  const [previousYearFiches, setPreviousYearFiches] = useState<any[]>([]);
  const [loadingPreviousYears, setLoadingPreviousYears] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

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
    // ⭐ Phases spécifiques au français (legacy — anciennes fiches texte simple)
    phase_introductive: "", phase_systematisation: "",
    // ⭐ 2026-09-19 — Exercices structuraux en tableaux 2 colonnes (miroir FR)
    phase_intro_ens1: "", phase_intro_ens2: "",
    phase_syst_ens: "", phase_syst_app: "",
    // ⭐ Phase d'application (tableau 3 colonnes)
    app_col1: "", app_col2: "", app_col3: "",
    // II- Déroulement (tableau d'étapes)
    deroulement: [] as Array<{ etape: string; consignes: string; resultats: string }>,
    // III- Retour et projection
    objectivation: "", evalRetour: "", projection: "",
    // ⭐ 2026-09-19 (retour promoteur, miroir FR) — Retour et projection EN
    //    TABLEAU : 2e colonne « Résultat attendu » pour Objectivation /
    //    Évaluation / Projection (comme le II- Déroulement) + section
    //    RETENONS (leçon à retenir) en BAS de fiche.
    objectivationResultat: "", evalRetourResultat: "", projectionResultat: "",
    retenons: "",
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

  // ⭐ Libellé lisible du type de fiche courant (pour la modale d'extraction IA)
  const currentSheetTypeLabel = SHEET_TYPES.find((t: any) => t.type === form.sheetType)?.label || form.sheetType;

  // === Chargement ===
  // ⭐ FIX (miroir FR) : refs — plus de refetch en boucle sur chaque changement
  //    de classe/événement du cahier journal.
  const selectedClassIdRef = useRef(selectedClassId);
  useEffect(() => { selectedClassIdRef.current = selectedClassId; }, [selectedClassId]);
  const initialClassIdRef = useRef(initialClassId);
  useEffect(() => { initialClassIdRef.current = initialClassId; }, [initialClassId]);
  const userPickedClassRef = useRef(false);

  const loadClasses = useCallback(async (attempt = 0) => {
    setClassesLoading(true);
    let retryScheduled = false;
    try {
      const res = await fetch(`/api/pedagogy-space/my-classes?teacherId=${teacherId}&academicYearId=${academicYearId}`, { credentials: "include" });
      // ⭐ res.ok OBLIGATOIRE (miroir FR) : un 401/500 produisait une liste
      //    vide silencieuse → « — » sans raison.
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setClasses(list);
      setClassesFailed(false);
      const currentSel = selectedClassIdRef.current;
      if (list.length > 0 && !currentSel) {
        const init = initialClassIdRef.current;
        if (init && list.some(c => c.classId === init)) {
          setSelectedClassId(init);
        } else {
          setSelectedClassId(list[0].classId);
        }
      }
    } catch (e: any) {
      if (attempt === 0) {
        retryScheduled = true;
        setTimeout(() => { void loadClasses(1); }, 1200);
        return;
      }
      setClasses([]);
      setClassesFailed(true);
      console.error("[PedagogicalSheetsTab EN] Erreur chargement classes:", e);
      toast.error("Impossible de charger vos classes", {
        description: "Vérifiez votre connexion puis rechargez la page. Vos fiches déjà enregistrées restent intactes.",
      });
    } finally {
      if (!retryScheduled) setClassesLoading(false);
    }
  }, [teacherId, academicYearId]);

  const loadFiches = useCallback(async () => {
    if (!selectedClassId) { setFiches([]); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ teacherId, academicYearId, classId: selectedClassId });
      if (filterType) params.append("sheetType", filterType);
      const res = await fetch(`/api/pedagogy-space/fiches?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // ⭐ CORRECTION BUG CRITIQUE (plaintes enseignants sept. 2026) : res.json()
      //    ne doit être lu qu'UNE SEULE fois. L'ancien code
      //    `Array.isArray(await res.json()) ? await res.json() : []` consommait
      //    le body DEUX fois → la 2e lecture échouait (body already used) → catch
      //    silencieux → la liste des fiches apparaissait TOUJOURS VIDE alors
      //    qu'elles existaient en base : l'enseignant croyait que sa sauvegarde
      //    avait disparu, puis la retrouvait « plus tard » via les autres
      //    composants qui chargent correctement.
      const data = await res.json();
      const serverList = Array.isArray(data) ? data : [];
      // ⭐ v4.7.0 — FICHES EN ATTENTE D'ENVOI (miroir FR) : fusion des
      //    sauvegardes en file offline du SW dans la liste affichée.
      const merged = await mergePendingOfflineFiches(serverList, tenantId, selectedClassId);
      setFiches(merged);
    } catch (e: any) {
      setFiches([]);
      console.error("[PedagogicalSheetsTab EN] Erreur chargement fiches:", e);
    }
    finally { setLoading(false); }
  }, [teacherId, academicYearId, filterType, selectedClassId, tenantId]);

  // ⭐ v4.7.0 — Rafraîchir la liste quand la file offline évolue (miroir FR).
  useEffect(() => {
    const refresh = () => { loadFiches(); };
    window.addEventListener("outbox-changed", refresh);
    window.addEventListener("sync-end", refresh);
    return () => {
      window.removeEventListener("outbox-changed", refresh);
      window.removeEventListener("sync-end", refresh);
    };
  }, [loadFiches]);

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

  // ⭐ FIX (miroir FR) : mise à jour du cahier journal → resélection SANS refetch.
  useEffect(() => {
    if (!initialClassId || classes.length === 0) return;
    if (userPickedClassRef.current) return;
    if (classes.some(c => c.classId === initialClassId)) {
      setSelectedClassId(initialClassId);
    }
  }, [initialClassId, classes]);

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

  // ⭐ Construire le label "Directeur" ou "Directrice" selon le genre
  const directorLabel = directorInfo?.gender === 'F' ? 'La Directrice' : 'Le Directeur';
  const directorDisplayName = directorInfo?.fullName || 'Nom du directeur';

  // ⭐ Pré-remplissage automatique quand l'utilisateur clique sur "Préparer la fiche"
  //    pour [jour] [matière] depuis le cahier journal.
  useEffect(() => {
    if (!initialSheetType && !initialLessonDay && !initialMatiere) return;
    // ⭐ 2026-09-19 (retour promoteur, miroir FR) — date calculée depuis LA
    //    SEMAINE DU CAHIER JOURNAL (initialWeekStartDate) si fournie, sinon
    //    semaine courante (comportement historique).
    if (initialLessonDay) {
      const dayNums: Record<string, number> = { lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5 };
      const targetDayNum = dayNums[initialLessonDay.toLowerCase()];
      if (targetDayNum !== undefined) {
        let monday: Date;
        // Gère "YYYY-MM-DD" et "YYYY-MM-DDT00:00:00.000Z" (backend)
        const wsDatePart = (initialWeekStartDate || "").slice(0, 10);
        const wsParts = wsDatePart.split("-");
        const wsValid =
          wsParts.length === 3 &&
          wsParts.every((p) => /^\d+$/.test(p)) &&
          wsParts[0].length === 4;
        if (wsValid) {
          monday = new Date(Number(wsParts[0]), Number(wsParts[1]) - 1, Number(wsParts[2]));
        } else {
          const today = new Date();
          const currentDay = today.getDay() === 0 ? 7 : today.getDay(); // 0=dim → 7
          monday = new Date(today);
          monday.setDate(today.getDate() - (currentDay - 1));
        }
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
  }, [initialSheetType, initialLessonDay, initialWeekStartDate, initialMatiere]);

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
    setSaving(true);
    try {
      const url = editingFiche ? `/api/pedagogy-space/fiches/${editingFiche.id}` : "/api/pedagogy-space/fiches";
      const method = editingFiche ? "PUT" : "POST";
      const body = editingFiche
        ? { ...form }
        : { ...form, academicYearId, teacherId, cahierJournalId: cahierJournalId || undefined };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body), keepalive: true });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      // ⭐ v4.7.0 — HONNÊTETÉ (miroir FR) : 200 fabriqué par le SW pendant un
      //    glitch réseau mobile → toast distinct (la fiche est EN FILE, pas
      //    encore sur le serveur) + badge « envoi en attente » dans la liste.
      const queuedOffline = res.headers.get("X-Sync-Status") === "pending";
      if (queuedOffline) {
        toast.warning("Enregistré hors ligne — envoi en attente", {
          description: "La connexion a été interrompue pendant la sauvegarde. Votre fiche est conservée sur cet appareil et sera envoyée automatiquement dès le retour du réseau.",
        });
      } else {
        toast.success(editingFiche ? "✅ Fiche mise à jour" : "✅ Fiche créée");
      }

      // ⭐ Autosave : resynchronise la baseline (évite une double sauvegarde
      //    juste après le clic sur « Mettre à jour / Créer »)
      ficheAutosave.markSaved(ficheSnapshot);

      // ⭐ La fiche est enregistrée côté serveur → supprimer le brouillon local
      //    (le filet anti-rechargement n'est plus nécessaire pour cette fiche)
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }

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
    // ⭐ BROUILLON LOCAL plus récent que le serveur pour CETTE fiche ?
    //    (page rechargée pendant l'édition + coupure réseau) → on l'applique
    //    par-dessus la version serveur pour ne perdre aucune saisie.
    let draftForm: any = null;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        const serverUpdated = fiche.updatedAt ? new Date(fiche.updatedAt).getTime() : 0;
        if (d?.editingFicheId === fiche.id && d.savedAt > serverUpdated + 2000 && hasRealContent(d.form)) {
          draftForm = d.form;
          toast.info("Version non enregistrée restaurée", {
            description: "Une saisie plus récente de cette fiche a été retrouvée localement (rechargement de la page pendant votre édition).",
          });
        }
      }
    } catch { /* ignore */ }

    setEditingFiche(fiche);
    const base: any = { ...emptyForm, ...fiche, ...(draftForm || {}) };
    setForm({
      ...base,
      lessonDate: base.lessonDate ? formatDate(base.lessonDate) : "",
      adminDate: base.adminDate ? formatDate(base.adminDate) : "",
      // ⭐ 2026-09-19 — Compatibilité exercices structuraux (miroir FR) :
      //    ancien texte simple reporté dans la 1re colonne du tableau 2 colonnes.
      phase_intro_ens1: base.phase_intro_ens1 || base.phase_introductive || "",
      phase_syst_ens: base.phase_syst_ens || base.phase_systematisation || "",
      deroulement: Array.isArray(base.deroulement) ? base.deroulement :
        (typeof base.deroulement === "string" ? JSON.parse(base.deroulement || "[]") : []),
    });
    setShowForm(true);
  };

  const handleDelete = async (fiche: any) => {
    if (!confirm(`Supprimer cette fiche (${fiche.sheetType}) ?`)) return;
    try {
      const res = await fetch(`/api/pedagogy-space/fiches/${fiche.id}`, { method: "DELETE", credentials: "include" });
      // ⭐ Vérifier res.ok : sans ça, un échec serveur affichait quand même « Fiche supprimée »
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Fiche supprimée"); loadFiches();
    }
    catch (e: any) { toast.error("Erreur", { description: e.message }); }
  };

  const handleSubmit = async (fiche: any) => {
    if (!confirm("Soumettre cette fiche au directeur ?")) return;
    try {
      const res = await fetch(`/api/pedagogy-space/fiches/${fiche.id}/submit`, { method: "POST", credentials: "include" });
      // ⭐ Vérifier res.ok : sans ça, un échec serveur affichait quand même « Fiche soumise »
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `HTTP ${res.status}`);
      }
      toast.success("✅ Fiche soumise"); loadFiches();
    }
    catch (e: any) { toast.error("Erreur", { description: e.message }); }
  };

  // === Déroulement ===
  const addStep = () => setForm((p: any) => ({ ...p, deroulement: [...(p.deroulement || []), { etape: "", consignes: "", resultats: "" }] }));
  const updateStep = (idx: number, field: string, val: string) => setForm((p: any) => ({ ...p, deroulement: (p.deroulement || []).map((s: any, i: number) => i === idx ? { ...s, [field]: val } : s) }));
  const removeStep = (idx: number) => setForm((p: any) => ({ ...p, deroulement: (p.deroulement || []).filter((_: any, i: number) => i !== idx) }));

  // ⭐ FIX (miroir FR) : champ Classe éditable depuis le formulaire.
  const onClassChange = (classId: string) => {
    if (!classId) return;
    const cls = classes.find(c => c.classId === classId);
    if (cls) setForm((p: any) => ({ ...p, classId, className: cls.className || "", cours: p.cours || cls.className || "", boysCount: cls.boys || 0, girlsCount: cls.girls || 0, totalStudents: cls.totalStudents || 0, boysPresent: cls.boys || 0, girlsPresent: cls.girls || 0, totalPresent: cls.totalStudents || 0, boysAbsent: 0, girlsAbsent: 0, totalAbsent: 0 }));
  };

  const isReadOnly = form.status && form.status !== "DRAFT";
  const sheetType = SHEET_TYPES.find(t => t.type === form.sheetType);
  const typeConfig = SHEET_TYPE_CONFIG[form.sheetType] || SHEET_TYPE_CONFIG.MATH;

  // ═════════════════════════════════════════════════════════════════════════
  // ⭐ SAUVEGARDE AUTOMATIQUE INVISIBLE — toutes les 10 secondes (miroir FR)
  //
  // Exigence utilisateur : sauvegarde chaque 10 s sans que l'utilisateur ne
  // le remarque, sans rechargement, sans perte du travail.
  //
  //   - Fiche EXISTANTE (Brouillon) → PUT silencieux (?source=autosave,
  //     pas d'audit log côté API) sans re-fetch ni fermeture du formulaire
  //   - NOUVELLE fiche (classe + type choisis) → la première sauvegarde
  //     silencieuse CRÉE la fiche (POST), puis les suivantes la mettent à
  //     jour (PUT) — le formulaire reste ouvert, la saisie n'est pas perturbée
  //   - Flush best-effort à la fermeture de l'onglet / F5 (keepalive)
  // ═════════════════════════════════════════════════════════════════════════
  const ficheSnapshot = JSON.stringify(form);
  const ficheAutosave = useAutoSave({
    snapshot: ficheSnapshot,
    enabled: showForm && !isReadOnly && !!form.classId && !!form.sheetType,
    save: async () => {
      const body: any = editingFiche?.id
        ? { ...form }
        : { ...form, academicYearId, teacherId, cahierJournalId: cahierJournalId || undefined };
      if (editingFiche?.id) {
        const res = await fetch(`/api/pedagogy-space/fiches/${editingFiche.id}?source=autosave`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Erreur de sauvegarde automatique");
      } else {
        // Création silencieuse — le formulaire reste ouvert, aucune perturbation
        const res = await fetch(`/api/pedagogy-space/fiches?source=autosave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Erreur de création automatique");
        const created = await res.json();
        if (created?.id) {
          setEditingFiche(created);
        }
      }
    },
    unloadSave: () => {
      const body: any = JSON.parse(ficheSnapshot);
      if (!editingFiche?.id) {
        body.academicYearId = academicYearId;
        body.teacherId = teacherId;
        body.cahierJournalId = cahierJournalId || undefined;
      }
      if (editingFiche?.id) {
        fireKeepaliveSave(`/api/pedagogy-space/fiches/${editingFiche.id}?source=autosave`, "PUT", body);
      } else {
        fireKeepaliveSave(`/api/pedagogy-space/fiches?source=autosave`, "POST", body);
      }
    },
    intervalMs: 10_000,
  });

  // ═════════════════════════════════════════════════════════════════════════
  // ⭐ BROUILLON LOCAL (complément de l'autosave serveur) — filet de sécurité
  //    final contre les rechargements spontanés pendant la préparation d'une
  //    fiche (plaintes enseignants sept. 2026 : « la page se recharge d'elle-
  //    même pendant la préparation, tout est à l'eau, il refait la fiche 5 fois »).
  //
  //    L'autosave serveur (10 s + keepalive au déchargement) couvre le cas
  //    nominal. Ce brouillon localStorage couvre le cas résiduel : rechargement
  //    pendant une coupure réseau — la saisie reste restaurable localement,
  //    à l'identique, via le bandeau « Reprendre la saisie ».
  // ═════════════════════════════════════════════════════════════════════════
  const DRAFT_KEY = `ah-fiche-draft:${tenantId}:${teacherId}`;
  const [recoveredDraft, setRecoveredDraft] = useState<any | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftFormRef = useRef<any>(null);
  const draftEditingRef = useRef<any>(null);

  useEffect(() => { draftFormRef.current = form; }, [form]);
  useEffect(() => { draftEditingRef.current = editingFiche; }, [editingFiche]);

  // Écriture continue (throttle 800 ms après chaque modification du formulaire)
  useEffect(() => {
    if (!showForm) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          form: draftFormRef.current,
          editingFicheId: draftEditingRef.current?.id || null,
          savedAt: Date.now(),
        }));
      } catch { /* localStorage plein/inaccessible — filet best-effort */ }
    }, 800);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, [form, showForm, DRAFT_KEY]);

  // Au montage : détecter un brouillon de crash (page rechargée pendant la saisie)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      const AGE_MAX = 48 * 60 * 60 * 1000;
      if (!d?.savedAt || Date.now() - d.savedAt > AGE_MAX) {
        if (d?.savedAt) localStorage.removeItem(DRAFT_KEY);
        return;
      }
      if (hasRealContent(d.form)) setRecoveredDraft(d);
    } catch { /* brouillon corrompu → ignoré */ }
  }, [DRAFT_KEY]);

  // ⚠️ Voir commentaire flushSync en tête de fichier — watchdog de réparation
  //    (miroir FR) : 80 ms après l'ouverture du formulaire, un render synchrone
  //    purge les lanes d'hydratation orphelins AVANT la première interaction.
  useEffect(() => {
    if (!showForm) return;
    const t = setTimeout(() => {
      try {
        flushSync(() => {
          setForm((p: any) => ({ ...p }));
        });
      } catch { /* non-bloquant */ }
    }, 80);
    return () => clearTimeout(t);
  }, [showForm]);

  // Reprendre la saisie interrompue par un rechargement de page
  const resumeDraft = useCallback(() => {
    if (!recoveredDraft) return;
    flushSync(() => {
      setForm({ ...emptyForm, ...recoveredDraft.form });
      if (recoveredDraft.editingFicheId) setEditingFiche({ id: recoveredDraft.editingFicheId, status: "DRAFT" });
      setShowForm(true);
      setRecoveredDraft(null);
    });
    toast.success("Saisie restaurée", {
      description: "Votre fiche a été retrouvée après le rechargement de la page. La sauvegarde automatique reprend immédiatement.",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoveredDraft]);

  // Ignorer le brouillon de crash
  const discardDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    setRecoveredDraft(null);
  }, [DRAFT_KEY]);

  // ⭐ Retour à la liste : on force d'abord une dernière sauvegarde automatique
  //    (les modifs des < 10 dernières secondes) puis on purge le brouillon local —
  //    plus AUCUNE perte de saisie, même en quittant le formulaire en plein milieu.
  const handleCloseForm = async () => {
    // ⭐ Discriminateur : y a-t-il des modifs non encore sauvegardées ?
    //    (saveNow() retourne false aussi quand il n'y a RIEN à sauvegarder —
    //    cas nominal sans modification, qui ne doit PAS afficher d'alerte)
    const hadPending = ficheAutosave.hasPendingChanges();
    const ok = await ficheAutosave.saveNow().catch(() => false);
    // ⭐ FIX « tout va en fumée » (miroir FR) : purge du brouillon UNIQUEMENT
    //    si sauvegarde serveur réussie ou formulaire vide.
    const formHasContent = hasRealContent(draftFormRef.current);
    if (hadPending && !ok) {
      // Échec réseau avec modifs en attente : conserver le brouillon local
      //    (filet de sécurité — bandeau « Reprendre la saisie » immédiat)
      toast.warning("Modifications non enregistrées", {
        description: "La connexion au serveur a échoué. Votre saisie est conservée localement et pourra être reprise.",
      });
      setRecoveredDraft({ form: draftFormRef.current, editingFicheId: draftEditingRef.current?.id || null, savedAt: Date.now() });
    } else if (!ok && formHasContent) {
      setRecoveredDraft({ form: draftFormRef.current, editingFicheId: draftEditingRef.current?.id || null, savedAt: Date.now() });
      toast.warning("Saisie conservée localement", {
        description: "La fiche n'a pas pu être enregistrée sur le serveur (classe ou connexion manquante). Elle peut être reprise via le bandeau « Reprendre la saisie ».",
      });
    } else {
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    }
    setShowForm(false);
    setEditingFiche(null);
    setForm(emptyForm);
    loadFiches();
  };

  // === RENDU FORMULAIRE ===
  if (showForm) {
    // ⭐ Badge de statut affiché dans la barre d'actions
    const formStatus = STATUS_CONFIG[form.status as keyof typeof STATUS_CONFIG];
    return (
      <div className="space-y-4">
        {/* Barre d'actions */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
          <button onClick={handleCloseForm}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">
            <ChevronLeft className="h-4 w-4" /> Retour à la liste
          </button>
          <div className="flex items-center gap-2">
            {/* ⭐ Micro-indicateur de sauvegarde automatique (très discret —
                l'utilisateur ne doit pas être perturbé par les sauvegardes) */}
            <AutosaveIndicator status={ficheAutosave.status} lastSavedAt={ficheAutosave.lastSavedAt} />
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

        {/* ⭐ 2026-10-16 — EXTRACTION IA DEPUIS DES CAPTURES (miroir FR) :
            bannière d'action sous le sélecteur de type. L'enseignant choisit
            D'ABORD le type de fiche, puis dépose ses captures d'une fiche
            existante — le contenu est transcrit et les champs vides du
            formulaire se remplissent. Vérification + ajustement avant
            enregistrement : la fiche finale est rédigée sous SON compte. */}
        <div className="bg-gradient-to-r from-violet-50 via-white to-white rounded-xl border border-violet-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-violet-900 flex items-center gap-2">
              <ScanSearch className="h-4 w-4 shrink-0" />
              Vous avez déjà cette fiche sur papier ou en PDF&nbsp;?
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              Déposez jusqu'à 6 captures de la fiche <span className="font-semibold">{currentSheetTypeLabel}</span> — l'IA
              transcrit le contenu et remplit les champs vides ci-dessous. Vous vérifiez, vous ajustez, vous enregistrez&nbsp;:
              la fiche finale sera la vôtre, sans filigrane d'origine.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { try { flushSync(() => setShowAiExtraction(true)); } catch { setShowAiExtraction(true); } }}
            disabled={isReadOnly}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            title={isReadOnly ? "Fiche en lecture seule (statut: " + form.status + ")" : "Extraire le contenu d'une fiche existante depuis des captures"}
          >
            <ScanSearch className="h-4 w-4" />
            Extraire depuis des captures (IA)
          </button>
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
                  Vocabulaire thématique, Dictée, Expression écrite, Grammaire… */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Matière spécifique <span className="font-normal text-slate-400">(Vocabulaire, Dictée, Expression écrite, Grammaire, Conjugaison…)</span>
                </label>
                <input type="text" list="fr-mat-spec-sug-en" value={form.matiereSpecifique || ""} disabled={isReadOnly}
                  onChange={e => setForm({ ...form, matiereSpecifique: e.target.value })}
                  placeholder="Ex : Vocabulaire thématique, Dictée, Expression écrite, Lecture…"
                  className="w-full px-3 py-2 border-2 border-emerald-300 rounded-lg text-sm font-semibold bg-emerald-50/40" />
                <datalist id="fr-mat-spec-sug-en">
                  {["Vocabulaire thématique", "Vocabulaire", "Dictée", "Expression écrite", "Expression orale",
                    "Grammaire", "Conjugaison", "Lecture", "Orthographe", "Communication orale",
                    "Exercices structuraux", "Graphisme", "Écriture", "Combinatoire", "Conte", "Récitation", "Poésie"].map(s => (
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
                  {/* ⭐ FIX (miroir FR) : VRAI sélecteur éditable — la classe est
                      toujours visible et corrigeable depuis la fiche. */}
                  <select value={form.classId || ""} onChange={(e) => onClassChange(e.target.value)} disabled={isReadOnly}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm font-medium bg-white">
                    <option value="">
                      {classesLoading ? "Chargement des classes…" : classes.length === 0 ? "Aucune classe — rechargez la page" : "— Sélectionner une classe —"}
                    </option>
                    {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className || c.classId}</option>)}
                    {form.classId && !classes.some((c) => c.classId === form.classId) && (
                      <option value={form.classId}>{form.className || form.classId}</option>
                    )}
                  </select>
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
                  Fn°/Cours/SA/Séquence/Séance/Durée/Date/Classe → DOSSIER N° + THEME →
                  Thème (sous-thème SA) → Titre */}
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
                  {/* ⭐ FIX (miroir FR) : VRAI sélecteur éditable — la classe est
                      toujours visible et corrigeable depuis la fiche. */}
                  <select value={form.classId || ""} onChange={(e) => onClassChange(e.target.value)} disabled={isReadOnly}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm font-medium bg-white">
                    <option value="">
                      {classesLoading ? "Chargement des classes…" : classes.length === 0 ? "Aucune classe — rechargez la page" : "— Sélectionner une classe —"}
                    </option>
                    {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className || c.classId}</option>)}
                    {form.classId && !classes.some((c) => c.classId === form.classId) && (
                      <option value={form.classId}>{form.className || form.classId}</option>
                    )}
                  </select>
                </div>
              </div>
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
                  Fn°/Cours/SA/Séance/Durée/Date/Classe → THEME → Titre */}
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
                  {/* ⭐ FIX (miroir FR) : VRAI sélecteur éditable — la classe est
                      toujours visible et corrigeable depuis la fiche. */}
                  <select value={form.classId || ""} onChange={(e) => onClassChange(e.target.value)} disabled={isReadOnly}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm font-medium bg-white">
                    <option value="">
                      {classesLoading ? "Chargement des classes…" : classes.length === 0 ? "Aucune classe — rechargez la page" : "— Sélectionner une classe —"}
                    </option>
                    {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className || c.classId}</option>)}
                    {form.classId && !classes.some((c) => c.classId === form.classId) && (
                      <option value={form.classId}>{form.className || form.classId}</option>
                    )}
                  </select>
                </div>
              </div>
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
            {/* ⭐ 2026-09-19 — Exercices structuraux en TABLEAUX 2 colonnes (miroir FR) */}
            {typeConfig.phaseTables && (
              <div className="mt-4 space-y-4">
                {typeConfig.phaseTables.map((t) => (
                  <div key={t.label}>
                    <label className="block text-xs font-bold text-slate-700 mb-2">{t.label}</label>
                    <div className="overflow-x-auto border border-slate-300 rounded-lg">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className={cn("text-white", sheetType?.headerBg || "bg-slate-600")}>
                            {t.columns.map((col, i) => (
                              <th key={i} className="border border-slate-300 px-3 py-2 text-xs font-bold uppercase text-center">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {t.keys.map((key, i) => (
                              <td key={i} className="border border-slate-300 p-0 align-top" style={{ minWidth: "200px" }}>
                                <RichTextEditor value={form[key] || ""} onChange={html => setForm({ ...form, [key]: html })} disabled={isReadOnly} minHeight="120px" />
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* ⭐ Ancien rendu des phases (texte simple) — fiches LEGACY uniquement */}
            {typeConfig.phases && !typeConfig.phaseTables && (
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
              {/* ⭐ V14 : table-layout FIXED — Consignes (62 %) toujours plus large
                  que Résultats attendus (38 %), quel que soit le contenu saisi. */}
              <table className="w-full border-collapse text-xs table-fixed">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">N°</th>
                    <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-[62%]">Consignes</th>
                    <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-[38%]">Résultats attendus</th>
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

          {/* III- Retour et projection (tableau Consignes / Résultats attendus,
              EXACTEMENT comme le II- Déroulement — retour promoteur 2026-09-19,
              miroir FR : colonne « Résultat attendu » pour Objectivation,
              Évaluation, Projection) */}
          <section className="border-l-4 border-slate-300 pl-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 bg-slate-100 px-3 py-2 rounded-lg">
              III- Retour et projection
            </h3>
            <div className="overflow-x-auto border border-slate-300 rounded-lg">
              {/* ⭐ V14 : table-layout FIXED — Consignes dominante (62 %). */}
              <table className="w-full border-collapse text-xs table-fixed">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-28">Rubrique</th>
                    <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-[62%]">Consignes</th>
                    <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-[38%]">Résultats attendus</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Objectivation", key: "objectivation", resultKey: "objectivationResultat" },
                    { label: "Évaluation", key: "evalRetour", resultKey: "evalRetourResultat" },
                    { label: "Projection", key: "projection", resultKey: "projectionResultat" },
                  ].map(row => (
                    <tr key={row.key} className="align-top">
                      <td className="border border-slate-300 px-2 py-2 font-bold text-slate-700 bg-slate-50/60 align-middle">{row.label}</td>
                      <td className="border border-slate-300 p-0">
                        <RichTextEditor value={form[row.key] || ""} onChange={html => setForm({ ...form, [row.key]: html })} disabled={isReadOnly} minHeight="80px" />
                      </td>
                      <td className="border border-slate-300 p-0">
                        <RichTextEditor value={form[row.resultKey] || ""} onChange={html => setForm({ ...form, [row.resultKey]: html })} disabled={isReadOnly} minHeight="80px" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

          {/* ⭐ 2026-09-19 (retour promoteur, miroir FR) — IV- RETENONS :
              DERNIÈRE section de la fiche. Un SEUL champ de saisie pour
              « la leçon à retenir » — grand volume possible (croissance
              auto), ré-éditable à volonté, affichée dans le PDF généré. */}
          <section className="border-l-4 border-slate-300 pl-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase bg-slate-100 px-3 py-2 rounded-lg">
                IV- Retenons
              </h3>
              <span className="text-[11px] text-slate-400 font-normal">la leçon à retenir</span>
            </div>
            <RichTextEditor
              value={form.retenons || ""}
              onChange={html => setForm({ ...form, retenons: html })}
              disabled={isReadOnly}
              placeholder="La leçon à retenir de la séance…"
              minHeight="140px"
              maxHeight="none"
            />
          </section>

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
                    <div className="text-xs text-slate-500">
                      {form.status === 'VALIDATED'
                        ? `${directorDisplayName} — Signature et cachet`
                        : `${directorDisplayName} — Signature disponible après validation`}
                    </div>
                  </div>
                  {form.status === 'VALIDATED' && (form.directorSignature || directorInfo?.signatureDataUrl || directorInfo?.signatureUploadedUrl) && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full"><CheckCircle2 className="h-3 w-3" /> Signé</span>}
                  {form.status !== 'VALIDATED' && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">En attente</span>}
                </div>
                {/* ⭐ Signature du directeur : affichée SEULEMENT si la fiche est VALIDATED.
                    Avant validation (DRAFT/SUBMITTED/REJECTED), l'enseignant ne voit pas
                    la signature du directeur — seulement un placeholder "En attente de validation".
                    Une fois le directeur valide, l'enseignant voit la version avec les 2 signatures. */}
                {form.status === 'VALIDATED' ? (
                  <>
                    {form.directorSignature ? (
                      <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2"><img src={form.directorSignature} alt="" className="max-h-24 mx-auto" /></div>
                    ) : (directorInfo?.signatureDataUrl || directorInfo?.signatureUploadedUrl) ? (
                      <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2"><img src={directorInfo.signatureDataUrl || directorInfo.signatureUploadedUrl || ''} alt="" className="max-h-24 mx-auto" /></div>
                    ) : (
                      <div className="border-2 border-dashed border-slate-300 rounded-xl p-2 h-[120px] flex items-center justify-center text-slate-400 text-xs">Signature du directeur non disponible</div>
                    )}
                  </>
                ) : (
                  <div className="border-2 border-dashed border-amber-300 bg-amber-50/30 rounded-xl p-2 h-[120px] flex items-center justify-center text-amber-600 text-xs font-medium">
                    {form.status === 'SUBMITTED'
                      ? 'Fiche soumise — en attente de validation du directeur'
                      : form.status === 'REJECTED'
                      ? 'Fiche rejetée — à corriger et resoumettre'
                      : 'La signature du directeur apparaîtra après validation'}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ⭐ 17/10/2026 — FIX (miroir FR) : la modale vivait dans la VUE
              LISTE au lieu du FORMULAIRE — le bouton « Extraire » posait
              showAiExtraction=true mais la modale n'était jamais montée
              pendant la préparation. Dernier élément du formulaire. */}
          <FicheAiExtractionModal
            open={showAiExtraction}
            onClose={() => { try { flushSync(() => setShowAiExtraction(false)); } catch { setShowAiExtraction(false); } }}
            sheetType={form.sheetType}
            sheetTypeLabel={currentSheetTypeLabel}
            className={classes.find(c => c.classId === selectedClassId)?.className || form.className}
            initialDomainRoman={form.maternelle?.domainNumber}
            initialSousMatiere={form.matiereSpecifique}
            onApply={handleApplyAiFields}
          />
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
          <select value={selectedClassId} onChange={e => { userPickedClassRef.current = true; setSelectedClassId(e.target.value); }}
            disabled={classesLoading}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm min-w-[200px] disabled:bg-slate-100">
            <option value="">
              {classesLoading ? "Chargement des classes…" : classes.length === 0 ? (classesFailed ? "Échec du chargement — rechargez" : "Aucune classe") : "— Sélectionner une classe —"}
            </option>
            {classes.map(c => <option key={c.classId} value={c.classId}>{c.className || c.classId}</option>)}
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

      {/* ⭐ Bandeau de récupération : brouillon de fiche préservé après un
          rechargement de la page (déploiement, ChunkLoadError, coupure réseau,
          fermeture accidentelle…). Complète l'autosave serveur : couvre le cas
          où le serveur était injoignable au moment du rechargement. */}
      {recoveredDraft && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-amber-50 border border-amber-300 rounded-xl">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">Fiche en cours de préparation récupérée</p>
            <p className="text-xs text-amber-800 mt-0.5">
              La page a été rechargée pendant votre saisie
              {recoveredDraft.savedAt ? ` (${new Date(recoveredDraft.savedAt).toLocaleString("fr-FR")})` : ""}.
              Vos données ont été conservées et peuvent être restaurées telles quelles.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={resumeDraft}
              className="px-3 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700">
              Reprendre la saisie
            </button>
            <button onClick={discardDraft}
              className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold">
              Ignorer
            </button>
          </div>
        </div>
      )}

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
                  <div className="flex items-center gap-1">
                    {status && <div className={cn("flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase", status.color)}><status.icon className="h-3 w-3" />{status.label}</div>}
                    {/* ⭐ v4.7.0 — Fiche en attente d'envoi (miroir FR) : file
                        offline du SW, envoi automatique au retour du réseau. */}
                    {fiche._pendingSync && (
                      <div
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200"
                        title="Sauvegardé sur cet appareil — envoi automatique dès le retour de la connexion"
                      >
                        <Clock className="h-3 w-3 animate-pulse" />Envoi en attente
                      </div>
                    )}
                  </div>
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

      {/* ⭐ MODALE : Extraction IA — déplacée dans la vue formulaire (miroir
          FR). Conservée en commentaire ici pour tracer l'historique. */}

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
