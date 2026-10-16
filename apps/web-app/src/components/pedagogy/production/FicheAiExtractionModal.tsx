"use client";

/**
 * ============================================================================
 * MODALE D'EXTRACTION IA D'UNE FICHE PÉDAGOGIQUE À PARTIR DE CAPTURES
 * ============================================================================
 *
 * ⭐ 2026-10-16 (demande promoteur) — Les enseignants disposent sur le terrain
 * de fiches déjà préparées (PDF / Word / photocopies) portant des filigranes
 * (nom de l'auteur d'origine), refusées par les écoles. Cette modale permet :
 *
 *   1. AVANT L'IMPORT : l'enseignant déclare le CONTEXTE de la fiche qu'il
 *      veut remplir — d'abord le NIVEAU (Maternelle / Primaire), puis la
 *      CATÉGORIE DE FICHE proposée selon ce niveau :
 *        • Maternelle → les fiches par domaine (Domaine I à V, chacun avec
 *          ses activités : Éducation pour la santé, Expression corporelle,
 *          Pré-lecture, Conte…) ;
 *        • Primaire → la matière (Français, Mathématiques, EST, ES, EA, EPS,
 *          Anglais/Informatique), la sous-matière (Dictée, Grammaire, Morale,
 *          Chant…) et la classe (CI à CM2).
 *      ⭐ Le PROMPT D'EXTRACTION N'EST PAS FIGÉ : il est construit
 *      dynamiquement côté backend à partir de CE contexte (niveau × type ×
 *      sous-matière/domaine × classe) pour exiger de l'IA la structure EXACTE
 *      de la fiche visée, champ par champ, zone par zone.
 *   2. de déposer 1 à 6 captures (photos ou captures d'écran) de la fiche ;
 *   3. de lancer l'extraction IA (modèles vision NVIDIA — nemotron omni,
 *      repli llama-3.2-90b-vision) via POST /api/pedagogy-space/fiches/extract-ai ;
 *   4. de prévisualiser les champs extraits puis de les APPLIQUER au
 *      formulaire de préparation de fiche (qui se RECONFIGURE sur le type
 *      choisi : les sections I.bis, tableaux de phases, structure maternelle
 *      suivent automatiquement) ;
 *   5. l'enseignant VÉRIFIE, AJUSTE et ENREGISTRE : la fiche finale est
 *      rédigée sous SON compte — sans filigrane d'origine.
 *
 * Détails techniques :
 *   - Compression côté navigateur (canvas, max 1600 px de grand côté, JPEG
 *     q=0.85, fond blanc) : les data URLs restent sous ~250 Ko chacune pour
 *     respecter la limite JSON body 5 Mo de l'API avec 6 captures.
 *   - L'ordre de dépôt = l'ordre des pages (indiqué à l'enseignant).
 *   - fetch credentials: include (JWT session cookie) — jamais intercepté
 *     par le Service Worker (route NEVER_INTERCEPT, état serveur réel requis).
 * ============================================================================
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, Baby, BookOpen, CheckCircle2, ChevronLeft, Dumbbell,
  FlaskConical, GraduationCap, ImageIcon, Languages, Loader2, Palette,
  ScanSearch, Shapes, Sigma, Trash2, Upload, Users, Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { MATERNELLE_DOMAINES } from "@/lib/pedagogy/maternelle-domaines";
import { suggestionsPourSheetType } from "@/lib/pedagogy/cahier-sous-matieres";

// ─── Constantes (miroir des limites backend) ────────────────────────────────

const MAX_IMAGES = 6;
const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_DIMENSION = 1600; // px — grand côté après compression
const JPEG_QUALITY = 0.85;
const MAX_SOURCE_FILE_MB = 12; // garde-fou fichier source

// ─── Contexte d'extraction (choisi AVANT l'import des captures) ─────────────

export interface FicheExtractionContext {
  /** Niveau déclaré par l'enseignant — détermine les catégories proposées */
  level: "MATERNELLE" | "PRIMAIRE";
  /** Type de fiche cible (DOMAINE | DOMAINE_2 | FRANCAIS | MATH | EST | ES | EA | EPS | STANDARD) */
  sheetType: string;
  /** Libellé lisible du type (affiché + contexte modèle) */
  sheetTypeLabel: string;
  /** Sous-matière (primaire : Dictée, Morale, Chant…) ou activité précise (maternelle) */
  matiereSpecifique?: string;
  /** Maternelle : numéro du domaine visé (1..5) */
  domainNumber?: number;
  /** Maternelle : chiffre romain (I..V) — format du formulaire de fiche */
  domainRoman?: string;
  /** Maternelle : intitulé officiel du domaine (ex: « Expression corporelle ») */
  domainIntitule?: string;
  /** Classe déclarée (ex: CM1, Maternelle 2) */
  className?: string;
}

// ─── Catalogues de catégories (miroir des types du formulaire de fiche) ─────

const PRIMAIRE_MATIERES = [
  { type: "FRANCAIS", label: "Français", icon: BookOpen, hasSousMatiere: true },
  { type: "MATH", label: "Mathématiques", icon: Sigma, hasSousMatiere: false },
  { type: "EST", label: "EST", icon: FlaskConical, hasSousMatiere: false },
  { type: "ES", label: "Éducation Sociale", icon: Users, hasSousMatiere: true },
  { type: "EA", label: "Éducation Artistique", icon: Palette, hasSousMatiere: true },
  { type: "EPS", label: "EPS", icon: Dumbbell, hasSousMatiere: false },
  { type: "STANDARD", label: "Anglais / Informatique", icon: Languages, hasSousMatiere: false },
] as const;

const PRIMAIRE_CLASSES = ["CI", "CP", "CE1", "CE2", "CM1", "CM2"];
const MATERNELLE_CLASSES = ["Maternelle 1", "Maternelle 2", "PS", "MS", "GS"];

/** Romains → nombre (le formulaire maternelle stocke le romain) */
const ROMAIN_TO_NUM: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5 };

interface CapturedImage {
  id: string;
  dataUrl: string; // data:image/jpeg;base64,... (compressée)
  sizeKb: number;
}

interface ExtractedField {
  key: string;
  value: string;
}

interface FicheAiExtractionModalProps {
  open: boolean;
  onClose: () => void;
  /** Type de fiche courant du formulaire (pré-sélection du contexte si cohérent) */
  sheetType?: string;
  /** Libellé lisible du type courant (affiché en repli) */
  sheetTypeLabel?: string;
  /** Nom de la classe courante (pré-remplissage du champ classe) */
  className?: string;
  /** Maternelle : n° du domaine courant du formulaire (romain I..V) pour pré-sélection */
  initialDomainRoman?: string;
  /** Sous-matière / matière spécifique courante du formulaire (pré-remplissage) */
  initialSousMatiere?: string;
  /**
   * Appelé avec les champs extraits (clés plates ; clés « maternelle.x.y »
   * en pointillé pour les fiches maternelle ; « deroulement » = tableau)
   * ET le contexte déclaré avant l'import — le parent fusionne dans son
   * état de formulaire et RECONFIGURE le type de fiche si nécessaire.
   */
  onApply: (fields: Record<string, any>, context: FicheExtractionContext) => void;
}

/** Compresse une image via canvas : max 1600 px, JPEG, fond blanc. */
async function compressImage(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Image illisible"));
      image.src = objectUrl;
    });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponible");
    ctx.fillStyle = "#FFFFFF"; // fond blanc (photocopies, transparence PNG)
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Détecte le niveau depuis le contexte passé à la modale. */
function detectInitialLevel(sheetType?: string, className?: string): "MATERNELLE" | "PRIMAIRE" {
  const st = String(sheetType || "").toUpperCase();
  if (st === "DOMAINE" || st === "DOMAINE_2" || /^DOMAINE_[1-5]$/.test(st)) return "MATERNELLE";
  const c = String(className || "").toUpperCase();
  if (/\b(MATERNELLE|MATERNEL)\b/.test(c) || /\b(PS|MS|GS)\b/.test(c)) return "MATERNELLE";
  return "PRIMAIRE";
}

/** Type de fiche effectif pour un domaine maternelle (domaine 2 → DOMAINE_2). */
function sheetTypeForDomaine(domainNumber: number): "DOMAINE" | "DOMAINE_2" {
  return domainNumber === 2 ? "DOMAINE_2" : "DOMAINE";
}

export function FicheAiExtractionModal({
  open, onClose, sheetType, sheetTypeLabel, className,
  initialDomainRoman, initialSousMatiere, onApply,
}: FicheAiExtractionModalProps) {
  // ── Étapes : contexte (AVANT l'import) → dépôt → résultat ────────────────
  const [step, setStep] = useState<"context" | "upload">("context");

  // ── Contexte déclaré par l'enseignant ───────────────────────────────────
  const [level, setLevel] = useState<"MATERNELLE" | "PRIMAIRE">("PRIMAIRE");
  const [primaireMatiere, setPrimaireMatiere] = useState<string>("FRANCAIS");
  const [sousMatiere, setSousMatiere] = useState<string>("");
  const [domainNumber, setDomainNumber] = useState<number>(1);
  const [activiteDomaine, setActiviteDomaine] = useState<string>("");
  const [classe, setClasse] = useState<string>("");

  // ── Captures + extraction (inchangé) ────────────────────────────────────
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractedFields, setExtractedFields] = useState<ExtractedField[] | null>(null);
  const [rawFields, setRawFields] = useState<Record<string, any> | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [modelUsed, setModelUsed] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // ⭐ v3 asynchrone — polling du job d'extraction + chrono affiché à l'utilisateur
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const cancelPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Arrêt du polling au démontage de la modale
  useEffect(() => () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
  }, []);

  // ── Initialisation du contexte à l'ouverture ────────────────────────────
  useEffect(() => {
    if (!open) return;
    const detected = detectInitialLevel(sheetType, className);
    setLevel(detected);
    setStep("context");
    setImages([]);
    setExtractedFields(null);
    setRawFields(null);
    setWarnings([]);
    setModelUsed("");
    setDragOver(false);

    // Pré-sélections fidèles au formulaire courant
    const st = String(sheetType || "").toUpperCase();
    if (detected === "PRIMAIRE" && PRIMAIRE_MATIERES.some(m => m.type === st)) {
      setPrimaireMatiere(st);
      setSousMatiere(initialSousMatiere || "");
    } else {
      setSousMatiere(initialSousMatiere || "");
    }
    if (detected === "MATERNELLE") {
      const fromForm = ROMAIN_TO_NUM[String(initialDomainRoman || "").toUpperCase()];
      const fromSheetType = st === "DOMAINE_2" ? 2 : /^\d$/.test(String(initialDomainRoman || "")) ? Number(initialDomainRoman) : NaN;
      setDomainNumber(Number.isFinite(fromForm) ? fromForm : (Number.isFinite(fromSheetType) ? fromSheetType : 1));
      setActiviteDomaine(initialSousMatiere || "");
    }
    setClasse(className || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Contexte effectif (envoyé au backend + rendu au parent) ─────────────
  const effectiveContext: FicheExtractionContext =
    level === "MATERNELLE"
      ? (() => {
          const domaine = MATERNELLE_DOMAINES.find(d => d.number === domainNumber) || MATERNELLE_DOMAINES[0];
          const st = sheetTypeForDomaine(domainNumber);
          return {
            level,
            sheetType: st,
            sheetTypeLabel: st === "DOMAINE_2"
              ? `Fiche Domaine ${domaine.roman} — ${domaine.subColumns[0]?.label || ""}`
              : `Fiche Domaine ${domaine.roman}`,
            matiereSpecifique: activiteDomaine || undefined,
            domainNumber,
            domainRoman: domaine.roman,
            domainIntitule: domaine.subColumns.map(sc => sc.label).join(", "),
            className: classe || undefined,
          };
        })()
      : (() => {
          const matiere = PRIMAIRE_MATIERES.find(m => m.type === primaireMatiere) || PRIMAIRE_MATIERES[0];
          return {
            level,
            sheetType: matiere.type,
            sheetTypeLabel: matiere.label,
            matiereSpecifique: sousMatiere || undefined,
            className: classe || undefined,
          };
        })();

  const reset = useCallback(() => {
    cancelPolling();
    setStep("context");
    setImages([]);
    setExtractedFields(null);
    setRawFields(null);
    setWarnings([]);
    setModelUsed("");
    setCompressing(false);
    setExtracting(false);
    setElapsedSec(0);
    setDragOver(false);
  }, [cancelPolling]);

  const handleClose = useCallback(() => {
    if (extracting) return; // pas de fermeture pendant l'appel IA
    reset();
    onClose();
  }, [extracting, reset, onClose]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_IMAGES} captures`, {
        description: "Importez d'abord les captures actuelles, puis les suivantes.",
      });
      return;
    }
    if (list.length > remaining) {
      toast.warning(`Seules les ${remaining} première(s) capture(s) seront ajoutées`, {
        description: `Maximum ${MAX_IMAGES} captures par extraction.`,
      });
    }

    setCompressing(true);
    const added: CapturedImage[] = [];
    try {
      for (const file of list.slice(0, remaining)) {
        if (!ACCEPTED_MIME.includes(file.type)) {
          toast.warning(`« ${file.name} » ignoré`, { description: "Formats acceptés : PNG, JPEG, WebP." });
          continue;
        }
        if (file.size > MAX_SOURCE_FILE_MB * 1024 * 1024) {
          toast.warning(`« ${file.name} » ignoré`, { description: `Fichier trop volumineux (max ${MAX_SOURCE_FILE_MB} Mo).` });
          continue;
        }
        try {
          const dataUrl = await compressImage(file);
          added.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            dataUrl,
            sizeKb: Math.round((dataUrl.length * 3) / 4 / 1024),
          });
        } catch {
          toast.warning(`« ${file.name} » illisible`, { description: "L'image n'a pas pu être traitée." });
        }
      }
    } finally {
      setCompressing(false);
    }
    if (added.length > 0) {
      setImages(prev => [...prev, ...added]);
      // Nouvelles captures → invalider l'extraction précédente
      setExtractedFields(null);
      setRawFields(null);
      setWarnings([]);
    }
  }, [images.length]);

  const removeImage = useCallback((id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
    setExtractedFields(null);
    setRawFields(null);
    setWarnings([]);
  }, []);

  const launchExtraction = useCallback(async () => {
    if (images.length === 0) {
      toast.error("Ajoutez au moins une capture de la fiche.");
      return;
    }
    setExtracting(true);
    setExtractedFields(null);
    setRawFields(null);
    setWarnings([]);
    setElapsedSec(0);
    try {
      // ⭐ PROMPT DYNAMIQUE : le contexte déclaré (niveau × type × sous-matière
      //    × domaine × classe) est envoyé au backend, qui construit le prompt
      //    d'extraction à partir de la structure EXACTE de cette fiche cible.
      // ⭐ v3 ASYNCHRONE : le POST rend immédiatement un jobId (l'IA vision
      //    peut prendre 1 à 2 min — fenêtre proxy 60 s dépassée sinon), puis
      //    on suit l'avancement en interrogeant le statut du job.
      const res = await fetch("/api/pedagogy-space/fiches/extract-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sheetType: effectiveContext.sheetType,
          level: effectiveContext.level,
          className: effectiveContext.className,
          matiereSpecifique: effectiveContext.matiereSpecifique,
          domainNumber: effectiveContext.domainNumber,
          images: images.map(img => img.dataUrl),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // ⭐ 504 = la fonction proxy Vercel (60 s) a expiré avant la réponse
        //    du modèle vision — message actionnable plutôt qu'un « Erreur 504 »
        //    cryptique. 502/503 = coupure réseau amont ponctuelle.
        if (res.status === 504 || res.status === 502 || res.status === 503) {
          throw new Error(
            "Le modèle de vision IA n'a pas répondu assez vite. Réessayez dans quelques instants — " +
            "si le problème persiste, utilisez une capture unique, nette et bien cadrée.",
          );
        }
        const message = data?.message || `Erreur ${res.status}`;
        throw new Error(Array.isArray(message) ? message.join(" ") : message);
      }
      if (!data?.jobId) {
        throw new Error("Réponse inattendue du serveur (jobId manquant).");
      }

      // ── Polling du job (toutes les 2,5 s, pendant au plus ~3,5 min) ──────
      const job: { fields: Record<string, any>; model?: string; warnings?: string[] } =
        await new Promise((resolve, reject) => {
          const startedAt = Date.now();
          const POLL_INTERVAL_MS = 2500;
          const POLL_MAX_MS = 210_000;
          const tick = async () => {
            try {
              const r = await fetch(`/api/pedagogy-space/fiches/extract-ai/${data.jobId}`, {
                credentials: "include",
              });
              const j = await r.json().catch(() => ({}));
              if (!r.ok) {
                reject(new Error(j?.message || `Erreur ${r.status} pendant l'extraction.`));
                return;
              }
              if (j?.status === "done" && j.fields) {
                resolve(j);
                return;
              }
              if (j?.status === "error") {
                reject(new Error(j?.error || "L'extraction IA a échoué."));
                return;
              }
              if (Date.now() - startedAt > POLL_MAX_MS) {
                reject(new Error(
                  "L'extraction prend anormalement longtemps (plus de 3 minutes 30). " +
                  "Réessayez dans quelques instants — le service IA est peut-être momentanément saturé.",
                ));
                return;
              }
              setElapsedSec(Math.round((Date.now() - startedAt) / 1000));
              pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
            } catch (e: any) {
              reject(e);
            }
          };
          void tick();
        });

      // Mise en plat pour la prévisualisation
      const flat: ExtractedField[] = [];
      for (const [key, value] of Object.entries(job.fields)) {
        if (key === "deroulement" || key === "maternelle.der5") {
          if (Array.isArray(value) && value.length > 0) {
            flat.push({
              key,
              value: `${value.length} étape(s)/ligne(s) — ex: ${JSON.stringify(value[0]).substring(0, 120)}…`,
            });
          }
        } else if (key === "maternelle.deroulementIntro" && value && typeof value === "object") {
          const phases = Object.keys(value);
          if (phases.length > 0) flat.push({ key, value: `${phases.length} phase(s) d'introduction remplies` });
        } else {
          const text = String(value ?? "").trim();
          if (text) flat.push({ key, value: text });
        }
      }
      if (flat.length === 0) {
        throw new Error("Aucun champ n'a pu être extrait de ces captures. Essayez des images plus nettes et mieux cadrées.");
      }

      setExtractedFields(flat);
      setRawFields(job.fields);
      setWarnings(Array.isArray(job.warnings) ? job.warnings : []);
      setModelUsed(String(job.model || ""));
      toast.success(`${flat.length} champ(s) extraits`, {
        description: "Vérifiez le contenu puis appliquez-le au formulaire.",
      });
    } catch (e: any) {
      toast.error("Extraction IA impossible", {
        description: e?.message || "Erreur réseau — vérifiez votre connexion puis réessayez.",
      });
    } finally {
      cancelPolling();
      setExtracting(false);
      setElapsedSec(0);
    }
  }, [images, effectiveContext, cancelPolling]);

  const applyToForm = useCallback(() => {
    if (!rawFields) return;
    onApply(rawFields, effectiveContext);
    reset();
    onClose();
    toast.success("Champs reportés dans le formulaire", {
      description: "⚠️ Vérifiez et ajustez chaque champ avant d'enregistrer la fiche.",
      duration: 7000,
    });
  }, [rawFields, effectiveContext, onApply, reset, onClose]);

  if (!open) return null;

  const totalKb = images.reduce((sum, img) => sum + img.sizeKb, 0);
  const sousMatiereSuggestions = level === "PRIMAIRE"
    ? suggestionsPourSheetType(primaireMatiere)
    : [];
  const activitesDomaine = level === "MATERNELLE"
    ? (MATERNELLE_DOMAINES.find(d => d.number === domainNumber) || MATERNELLE_DOMAINES[0]).subColumns
    : [];
  const classesSuggestions = level === "MATERNELLE" ? MATERNELLE_CLASSES : PRIMAIRE_CLASSES;

  const contextReady = level === "MATERNELLE"
    ? !!domainNumber
    : !!primaireMatiere;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <ScanSearch className="w-5 h-5 text-violet-600" />
              Extraire une fiche depuis des captures
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {step === "context" ? (
                <>Étape 1/2 — Déclarez d&apos;abord <span className="font-semibold text-slate-700">le niveau et la fiche à remplir</span> : le prompt d&apos;extraction sera construit sur cette structure.</>
              ) : (
                <>Étape 2/2 — L&apos;IA lit vos captures de la fiche <span className="font-semibold text-slate-700">{effectiveContext.sheetTypeLabel}</span> et remplit le formulaire. Vous vérifiez, ajustez, puis enregistrez.</>
              )}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={extracting}
            className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* ── Corps ──────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* ══════ ÉTAPE 1 — CONTEXTE (AVANT L'IMPORT) ══════ */}
          {step === "context" && (
            <>
              {/* Niveau */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  1. Niveau de la fiche
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLevel("MATERNELLE")}
                    className={`flex items-center gap-3 p-3 border-2 rounded-xl text-left transition-all ${
                      level === "MATERNELLE"
                        ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <Baby className="h-6 w-6 shrink-0" />
                    <div>
                      <div className="text-sm font-bold">Maternelle</div>
                      <div className="text-[11px] opacity-75">Fiches par domaine (I à V)</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLevel("PRIMAIRE")}
                    className={`flex items-center gap-3 p-3 border-2 rounded-xl text-left transition-all ${
                      level === "PRIMAIRE"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <GraduationCap className="h-6 w-6 shrink-0" />
                    <div>
                      <div className="text-sm font-bold">Primaire</div>
                      <div className="text-[11px] opacity-75">CI, CP, CE1, CE2, CM1, CM2</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Catégorie selon le niveau */}
              {level === "MATERNELLE" ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                    2. Domaine de la fiche maternelle
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {MATERNELLE_DOMAINES.map(d => (
                      <button
                        key={d.number}
                        type="button"
                        onClick={() => {
                          setDomainNumber(d.number);
                          setActiviteDomaine("");
                        }}
                        className={`p-3 border-2 rounded-xl text-left transition-all ${
                          domainNumber === d.number
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="text-sm font-bold text-slate-800">
                          Domaine {d.roman}
                          {d.number === 2 && (
                            <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-100 text-teal-700">
                              format Domaine 2
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          {d.subColumns.map(sc => sc.label).join(" · ")}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Activité précise du domaine (facultatif) */}
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Activité précise <span className="font-normal text-slate-400">(facultatif — affine le ciblage de l&apos;IA)</span>
                    </label>
                    <select
                      value={activiteDomaine}
                      onChange={e => setActiviteDomaine(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">— Toutes les activités du domaine —</option>
                      {activitesDomaine.map(sc => (
                        <option key={sc.label} value={sc.label}>{sc.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                    2. Matière de la fiche primaire
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {PRIMAIRE_MATIERES.map(m => {
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.type}
                          type="button"
                          onClick={() => {
                            setPrimaireMatiere(m.type);
                            // Recharger les suggestions de sous-matière
                            setSousMatiere("");
                          }}
                          className={`flex flex-col items-center gap-1.5 p-3 border-2 rounded-xl text-center transition-all ${
                            primaireMatiere === m.type
                              ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-[11px] font-semibold leading-tight">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Sous-matière (Dictée, Grammaire, Morale, Chant…) */}
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Sous-matière <span className="font-normal text-slate-400">({sousMatiereSuggestions.length > 0 ? "suggestions officielles" : "facultatif"})</span>
                    </label>
                    <input
                      type="text"
                      list="dl-extraction-sous-matiere"
                      value={sousMatiere}
                      onChange={e => setSousMatiere(e.target.value)}
                      placeholder={
                        sousMatiereSuggestions.length > 0
                          ? "Ex : Dictée, Grammaire, Lecture, Morale, Chant…"
                          : "Sous-matière / rubrique de la leçon (facultatif)…"
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <datalist id="dl-extraction-sous-matiere">
                      {sousMatiereSuggestions.map(s => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>
                </div>
              )}

              {/* Classe */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  3. Classe {level === "PRIMAIRE" ? "(ex : CM1)" : "(ex : Maternelle 2)"}
                </label>
                <input
                  type="text"
                  list="dl-extraction-classe"
                  value={classe}
                  onChange={e => setClasse(e.target.value)}
                  placeholder={level === "PRIMAIRE" ? "CI, CP, CE1, CE2, CM1 ou CM2" : "Maternelle 1, Maternelle 2, PS, MS ou GS"}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                />
                <datalist id="dl-extraction-classe">
                  {classesSuggestions.map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              {/* Explication du fonctionnement */}
              <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
                <p className="text-xs text-violet-900">
                  <Shapes className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                  Le prompt d&apos;extraction n&apos;est pas figé : il est <b>construit dynamiquement</b> à partir de votre déclaration
                  {level === "MATERNELLE" ? (
                    <> — l&apos;IA recevra la structure <b>exacte</b> de la fiche du domaine {MATERNELLE_DOMAINES.find(d => d.number === domainNumber)?.roman}{activiteDomaine ? ` (activité : ${activiteDomaine})` : ""}, zone par zone.</>
                  ) : (
                    <> — l&apos;IA recevra la structure <b>exacte</b> de la fiche de {(PRIMAIRE_MATIERES.find(m => m.type === primaireMatiere)?.label || "").toLowerCase()}{sousMatiere ? ` (${sousMatiere})` : ""}{classe ? ` pour la classe de ${classe}` : ""}, champ par champ.</>
                  )}
                </p>
              </div>
            </>
          )}

          {/* ══════ ÉTAPE 2 — DÉPÔT DES CAPTURES ══════ */}
          {step === "upload" && !extractedFields && (
            <>
              {/* Récapitulatif du contexte choisi */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
                      {level === "MATERNELLE" ? "Maternelle" : "Primaire"}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-violet-100 text-violet-700">
                      {effectiveContext.sheetTypeLabel}
                    </span>
                    {effectiveContext.matiereSpecifique && (
                      <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                        {effectiveContext.matiereSpecifique}
                      </span>
                    )}
                    {effectiveContext.className && (
                      <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                        {effectiveContext.className}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep("context")}
                    disabled={extracting}
                    className="shrink-0 text-xs font-semibold text-slate-500 hover:text-slate-800 underline disabled:opacity-40"
                  >
                    Modifier
                  </button>
                </div>
              </div>

              {/* Zone de dépôt */}
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center transition ${
                  dragOver ? "border-violet-400 bg-violet-50" : "border-slate-300 bg-slate-50/50"
                }`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOver(false);
                  if (!extracting) void addFiles(e.dataTransfer.files);
                }}
              >
                <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">
                  Déposez ici les captures de la fiche
                  {compressing && <Loader2 className="inline-block h-3.5 w-3.5 animate-spin text-violet-600 ml-2" />}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  PNG, JPEG ou WebP — 6 captures maximum. Une fiche sur plusieurs pages = une capture par page,{" "}
                  <span className="font-semibold">dans l&apos;ordre</span>.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={extracting || compressing || images.length >= MAX_IMAGES}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ImageIcon className="h-4 w-4" />
                  Choisir des images
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_MIME.join(",")}
                  multiple
                  className="hidden"
                  onChange={e => {
                    if (e.target.files) void addFiles(e.target.files);
                    e.target.value = ""; // permettre de re-sélectionner le même fichier
                  }}
                />
              </div>

              {/* Vignettes */}
              {images.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-2">
                    Captures prêtes ({images.length}/{MAX_IMAGES} — ≈{totalKb} Ko)
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {images.map((img, idx) => (
                      <div key={img.id} className="relative group border border-slate-200 rounded-lg overflow-hidden bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.dataUrl} alt={`Capture ${idx + 1}`} className="w-full h-24 object-cover" />
                        <span className="absolute top-1 left-1 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                          Page {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeImage(img.id)}
                          disabled={extracting}
                          className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition disabled:opacity-40"
                          aria-label="Retirer la capture"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conseils qualité */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> Pour une extraction réussie
                </p>
                <ul className="text-xs text-amber-700 mt-1.5 space-y-0.5 list-disc list-inside">
                  <li>Image nette et bien cadrée (la fiche entière, à la verticale)</li>
                  <li>Préférez une <b>capture d&apos;écran</b> du PDF/Word à une photo de l&apos;écran</li>
                  <li>Texte lisible : évitez reflets, ombres et flou</li>
                </ul>
              </div>
            </>
          )}

          {/* Extraction en cours */}
          {extracting && (
            <div className="text-center py-10">
              <Loader2 className="h-10 w-10 text-violet-600 animate-spin mx-auto mb-3" />
              <p className="font-semibold text-slate-800">
                L&apos;IA lit vos captures…
                {elapsedSec > 2 && <span className="ml-2 text-violet-600 tabular-nums">{elapsedSec} s</span>}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Transcription du contenu de la fiche {effectiveContext.sheetTypeLabel} — cela peut prendre
                une à deux minutes selon la charge du service IA. Cette page reste ouverte, aucune action requise.
              </p>
            </div>
          )}

          {/* Résultat */}
          {extractedFields && !extracting && (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-emerald-800">
                    {extractedFields.length} champ(s) extrait(s) avec succès
                  </p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    {modelUsed && <>Modèle : <span className="font-mono">{modelUsed}</span> — </>}
                    Le contenu sera reporté dans le formulaire. Vous pourrez tout vérifier et ajuster avant d&apos;enregistrer.
                  </p>
                </div>
              </div>

              {warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-800">Avertissements</p>
                  <ul className="text-xs text-amber-700 mt-1 list-disc list-inside">
                    {warnings.slice(0, 5).map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {extractedFields.map(({ key, value }) => (
                  <div key={key} className="p-2.5 flex gap-3">
                    <span className="text-xs font-mono font-semibold text-slate-500 w-44 shrink-0 truncate" title={key}>
                      {key}
                    </span>
                    <span className="text-xs text-slate-800 flex-1 line-clamp-2">{value.substring(0, 220)}{value.length > 220 ? "…" : ""}</span>
                  </div>
                ))}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-xs text-slate-600">
                  💡 Les champs existants du formulaire ne sont <b>pas écrasés s&apos;ils sont déjà remplis</b> — seuls les champs
                  vides (et le déroulement) seront complétés. Le formulaire passera sur le type <b>{effectiveContext.sheetTypeLabel}</b> si nécessaire.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="border-t border-slate-200 p-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 hidden sm:block">
            {step === "context"
              ? "Le niveau et la catégorie déterminent la structure envoyée à l'IA."
              : extractedFields
                ? "Extraction terminée — vérifiez puis appliquez."
                : "Les captures sont envoyées au modèle vision NVIDIA pour transcription."}
          </p>
          <div className="flex items-center gap-2 ml-auto">
            {step === "context" ? (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  onClick={() => setStep("upload")}
                  disabled={!contextReady}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuer vers les captures
                  <ChevronLeft className="h-4 w-4 rotate-180" />
                </button>
              </>
            ) : !extractedFields ? (
              <>
                <button
                  onClick={() => setStep("context")}
                  disabled={extracting || compressing}
                  className="flex items-center gap-1 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" /> Contexte
                </button>
                <button
                  onClick={() => void launchExtraction()}
                  disabled={extracting || compressing || images.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {extracting ? "Extraction en cours…" : "Lancer l'extraction IA"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setExtractedFields(null); setRawFields(null); }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Recommencer
                </button>
                <button
                  onClick={applyToForm}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Remplir le formulaire
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
