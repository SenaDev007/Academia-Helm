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
 *   1. de déposer 1 à 6 captures (photos ou captures d'écran) de la fiche ;
 *   2. de lancer l'extraction IA (modèles vision NVIDIA — nemotron omni,
 *      repli llama-3.2-90b-vision) via POST /api/pedagogy-space/fiches/extract-ai ;
 *   3. de prévisualiser les champs extraits puis de les APPLIQUER au
 *      formulaire de préparation de fiche ;
 *   4. l'enseignant VÉRIFIE, AJUSTE et ENREGISTRE : la fiche finale est
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

import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle2, ImageIcon, Loader2, ScanSearch,
  Trash2, Upload, Wand2,
} from "lucide-react";
import { toast } from "sonner";

// ─── Constantes (miroir des limites backend) ────────────────────────────────

const MAX_IMAGES = 6;
const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_DIMENSION = 1600; // px — grand côté après compression
const JPEG_QUALITY = 0.85;
const MAX_SOURCE_FILE_MB = 12; // garde-fou fichier source

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
  /** Type de fiche courant du formulaire (MATH/FRANCAIS/EST/ES/EA/EPS/STANDARD/DOMAINE/DOMAINE_2) */
  sheetType: string;
  /** Libellé lisible du type (affiché) */
  sheetTypeLabel: string;
  /** Nom de la classe (contexte envoyé au modèle) */
  className?: string;
  /**
   * Appelé avec les champs extraits (clés plates ; clés « maternelle.x.y »
   * en pointillé pour les fiches maternelle ; « deroulement » = tableau).
   * Le parent fusionne dans son état de formulaire.
   */
  onApply: (fields: Record<string, any>) => void;
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

export function FicheAiExtractionModal({
  open, onClose, sheetType, sheetTypeLabel, className, onApply,
}: FicheAiExtractionModalProps) {
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractedFields, setExtractedFields] = useState<ExtractedField[] | null>(null);
  const [rawFields, setRawFields] = useState<Record<string, any> | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [modelUsed, setModelUsed] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setImages([]);
    setExtractedFields(null);
    setRawFields(null);
    setWarnings([]);
    setModelUsed("");
    setCompressing(false);
    setExtracting(false);
    setDragOver(false);
  }, []);

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
    try {
      const res = await fetch("/api/pedagogy-space/fiches/extract-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sheetType,
          className: className || undefined,
          images: images.map(img => img.dataUrl),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data?.message || `Erreur ${res.status}`;
        throw new Error(Array.isArray(message) ? message.join(" ") : message);
      }
      if (!data?.ok || !data?.fields) {
        throw new Error("Réponse inattendue du serveur.");
      }

      // Mise en plat pour la prévisualisation
      const flat: ExtractedField[] = [];
      for (const [key, value] of Object.entries(data.fields)) {
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
      setRawFields(data.fields);
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      setModelUsed(String(data.model || ""));
      toast.success(`${flat.length} champ(s) extraits`, {
        description: "Vérifiez le contenu puis appliquez-le au formulaire.",
      });
    } catch (e: any) {
      toast.error("Extraction IA impossible", {
        description: e?.message || "Erreur réseau — vérifiez votre connexion puis réessayez.",
      });
    } finally {
      setExtracting(false);
    }
  }, [images, sheetType, className]);

  const applyToForm = useCallback(() => {
    if (!rawFields) return;
    onApply(rawFields);
    reset();
    onClose();
    toast.success("Champs reportés dans le formulaire", {
      description: "⚠️ Vérifiez et ajustez chaque champ avant d'enregistrer la fiche.",
      duration: 7000,
    });
  }, [rawFields, onApply, reset, onClose]);

  if (!open) return null;

  const totalKb = images.reduce((sum, img) => sum + img.sizeKb, 0);

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
              L'IA lit vos captures de fiche <span className="font-semibold text-slate-700">{sheetTypeLabel}</span> et remplit
              automatiquement les champs ci-dessous dans le formulaire. Vous vérifiez, ajustez, puis enregistrez — la fiche finale sera la vôtre.
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
          {/* Zone de dépôt */}
          {!extractedFields && (
            <>
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
                  <span className="font-semibold">dans l'ordre</span>.
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
                  <li>Préférez une <b>capture d'écran</b> du PDF/Word à une photo de l'écran</li>
                  <li>Texte lisible : évitez reflets, ombres et flou</li>
                </ul>
              </div>
            </>
          )}

          {/* Extraction en cours */}
          {extracting && (
            <div className="text-center py-10">
              <Loader2 className="h-10 w-10 text-violet-600 animate-spin mx-auto mb-3" />
              <p className="font-semibold text-slate-800">L'IA lit vos captures…</p>
              <p className="text-sm text-slate-500 mt-1">
                Transcription du contenu de la fiche {sheetTypeLabel} — cela peut prendre jusqu'à une minute.
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
                    Le contenu sera reporté dans le formulaire. Vous pourrez tout vérifier et ajuster avant d'enregistrer.
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
                  💡 Les champs existants du formulaire ne sont <b>pas écrasés s'ils sont déjà remplis</b> — seuls les champs
                  vides (et le déroulement) seront complétés. Vous gardez la main.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="border-t border-slate-200 p-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 hidden sm:block">
            {extractedFields
              ? "Extraction terminée — vérifiez puis appliquez."
              : "Les captures sont envoyées au modèle vision NVIDIA pour transcription."}
          </p>
          <div className="flex items-center gap-2 ml-auto">
            {!extractedFields ? (
              <>
                <button
                  onClick={handleClose}
                  disabled={extracting || compressing}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-40"
                >
                  Annuler
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
