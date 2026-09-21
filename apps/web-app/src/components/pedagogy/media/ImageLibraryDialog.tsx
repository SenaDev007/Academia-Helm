"use client";

/**
 * ============================================================================
 * ImageLibraryDialog — Bibliothèque d'images pour les fiches pédagogiques
 * ============================================================================
 *
 * ⭐ 4 sources d'images (demande utilisateur : « packs d'images » pour
 *    l'EST — muscles, arbres, anatomie —, les maths, la géologie…) :
 *
 *   1. BIBLIOTHÈQUE — packs d'illustrations SVG pédagogiques intégrés
 *      (anatomie, biologie, géologie, maths, physique, géographie).
 *      Insertion en SVG INLINE (rendu écran + PDF identique, hors-ligne OK).
 *   2. IMPORTER — fichier de l'appareil : redimensionné côté navigateur
 *      (max 1400 px, JPEG qualité 0.85) puis téléversé via /api/tenant-media
 *      (stockage R2 du tenant) → URL publique insérée.
 *   3. MES IMAGES — images déjà téléversées par l'école (tenant-media,
 *      dossier « pedagogie ») pour une réinsertion en un clic.
 *   4. PAR URL — collage d'une URL externe.
 * ============================================================================
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Image as ImageIcon, Upload, Link2, Library, Search, Loader2,
  Check, X, ChevronRight, HardDrive,
} from "lucide-react";
import {
  PEDAGOGY_ASSET_CATEGORIES,
  searchPedagogyAssets,
  type PedagogyAssetItem,
} from "@/lib/pedagogy-assets";
import { toast } from "sonner";

/** Ajoute max-width/height au SVG inline pour qu'il s'adapte à la colonne. */
function adaptInlineSvg(svgText: string): string {
  return svgText
    .replace(/^<\?xml[^>]*\?>\s*/i, "")
    .replace(/<svg([^>]*)>/i, (m, attrs: string) => {
      // retire width/height fixes pour laisser la viewBox piloter la taille
      const cleaned = attrs
        .replace(/\s(width|height)\s*=\s*"[^"]*"/gi, "")
        .replace(/\s(width|height)\s*=\s*'[^']*'/gi, "");
      return `<svg${cleaned} style="max-width:100%;height:auto;" role="img">`;
    });
}

export interface ImageLibraryDialogProps {
  open: boolean;
  onClose: () => void;
  /** Insère le HTML fourni à la position du curseur de l'éditeur. */
  onInsertHtml: (html: string) => void;
}

export function ImageLibraryDialog({ open, onClose, onInsertHtml }: ImageLibraryDialogProps) {
  const [tab, setTab] = useState<"biblio" | "upload" | "mesimages" | "url">("biblio");
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [insertedSlug, setInsertedSlug] = useState<string | null>(null);

  // Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Mes images
  const [myImages, setMyImages] = useState<any[]>([]);
  const [loadingMyImages, setLoadingMyImages] = useState(false);

  // URL
  const [urlInput, setUrlInput] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Charge « mes images » du tenant (dossier pedagogie + autres images)
  const loadMyImages = useCallback(async () => {
    setLoadingMyImages(true);
    try {
      const res = await fetch(`/api/tenant-media?limit=60&type=image`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data?.data || data?.items || []);
        // Priorité au dossier pedagogie, puis les autres images
        const sorted = [...(list || [])].sort((a: any, b: any) =>
          (a?.folder === "pedagogie" ? -1 : 0) - (b?.folder === "pedagogie" ? -1 : 0),
        );
        setMyImages(sorted);
      }
    } catch { /* silencieux */ } finally { setLoadingMyImages(false); }
  }, []);

  useEffect(() => {
    if (open && tab === "mesimages" && myImages.length === 0 && !loadingMyImages) {
      void loadMyImages();
    }
  }, [open, tab, myImages.length, loadingMyImages, loadMyImages]);

  if (!open) return null;

  // ── Insertion d'un élément de la bibliothèque ──
  //    photo réaliste → <img> avec URL ABSOLUE (rendu écran + PDF Puppeteer)
  //    illustration SVG → fetch + SVG INLINE (vectoriel, hors-ligne)
  const insertPackAsset = async (asset: PedagogyAssetItem) => {
    try {
      if (asset.kind === "photo") {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const abs = `${origin}${asset.file}`;
        const safe = escapeAttr(asset.label);
        onInsertHtml(`<img src="${escapeAttr(abs)}" alt="${safe}" style="max-width:100%;height:auto;border-radius:4px;" />&nbsp;`);
        setInsertedSlug(asset.slug);
        setTimeout(() => { setInsertedSlug(null); onClose(); }, 450);
        return;
      }
      const res = await fetch(asset.file);
      if (!res.ok) throw new Error("Illustration introuvable");
      const text = await res.text();
      const inline = adaptInlineSvg(text);
      const html = `<span class="ah-fig" contenteditable="false" data-asset="${asset.slug}" title="${asset.label}" style="display:inline-block;max-width:100%;">${inline}</span>&nbsp;`;
      onInsertHtml(html);
      setInsertedSlug(asset.slug);
      setTimeout(() => { setInsertedSlug(null); onClose(); }, 450);
    } catch (e: any) {
      toast.error("Impossible d'insérer cette illustration", { description: e?.message });
    }
  };

  // ── Upload d'un fichier de l'appareil ──
  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez choisir un fichier image (JPG, PNG, WebP…)");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error("Image trop volumineuse (max 12 Mo)");
      return;
    }
    setUploading(true);
    try {
      // Redimensionnement côté navigateur (préserve la bande passante)
      const dataUrl = await resizeImage(file, 1400, 0.85);
      const res = await fetch("/api/tenant-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fileDataUrl: dataUrl,
          fileName: file.name,
          mimeType: dataUrl.startsWith("data:image/png") ? "image/png" : "image/jpeg",
          folder: "pedagogie",
          alt: `Illustration pédagogique — ${file.name}`,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `Erreur ${res.status}`);
      }
      const media = await res.json();
      const url = media?.originalUrl || media?.hdUrl || media?.url;
      if (!url) throw new Error("URL de l'image non reçue");
      insertImgTag(url, file.name);
      toast.success("Image importée et insérée");
      onClose();
    } catch (e: any) {
      toast.error("Échec de l'import", { description: e?.message });
    } finally {
      setUploading(false);
    }
  };

  const insertImgTag = (url: string, alt: string) => {
    const safe = escapeAttr(alt || "Illustration");
    const safeUrl = /^(https?:|\/|data:image\/)/i.test(url) ? url : "";
    if (!safeUrl) { toast.error("URL d'image invalide"); return; }
    onInsertHtml(`<img src="${escapeAttr(safeUrl)}" alt="${safe}" style="max-width:100%;height:auto;border-radius:4px;" />&nbsp;`);
  };

  // ── Rendu ──
  const cats = activeCat === "all"
    ? PEDAGOGY_ASSET_CATEGORIES
    : PEDAGOGY_ASSET_CATEGORIES.filter((c) => c.id === activeCat);
  const assets = query.trim()
    ? searchPedagogyAssets(query)
    : cats.flatMap((c) => c.items.map((i) => ({ ...i, catLabel: c.label })));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-6">
      {/* Fond */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      {/* Panneau */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-blue-600" />
            <div>
              <div className="text-sm font-bold text-slate-800">Insérer une image</div>
              <div className="text-[11px] text-slate-500">Illustrations pédagogiques, imports et images de l&apos;école</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200 text-slate-500" title="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Onglets */}
        <div className="flex border-b border-slate-200 bg-white">
          {([
            ["biblio", "Bibliothèque", <Library key="l" className="h-3.5 w-3.5" />],
            ["upload", "Importer", <Upload key="u" className="h-3.5 w-3.5" />],
            ["mesimages", "Mes images", <HardDrive key="m" className="h-3.5 w-3.5" />],
            ["url", "Par URL", <Link2 key="r" className="h-3.5 w-3.5" />],
          ] as const).map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => setTab(id as typeof tab)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                tab === id
                  ? "text-blue-600 border-blue-600 bg-blue-50/50"
                  : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "biblio" && (
            <div className="space-y-3">
              {/* Recherche + catégories */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher (ex : digestif, muscles, cercle, volcan…)"
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-300 outline-none"
                  />
                </div>
                <select
                  value={activeCat}
                  onChange={(e) => { setActiveCat(e.target.value); setQuery(""); }}
                  className="px-2 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  <option value="all">Toutes les catégories</option>
                  {PEDAGOGY_ASSET_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Bandeaux de catégorie (quand pas de recherche) */}
              {!query.trim() && activeCat === "all" && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {PEDAGOGY_ASSET_CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setActiveCat(c.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    >
                      <span className={`px-1.5 py-0.5 rounded ${c.chip}`}>{c.items.length}</span>
                      {c.label}
                      <ChevronRight className="h-3 w-3 text-slate-400" />
                    </button>
                  ))}
                </div>
              )}

              {/* Grille d'illustrations */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {assets.map((a: any) => (
                  <button
                    key={a.slug}
                    onClick={() => void insertPackAsset(a)}
                    className="group border border-slate-200 rounded-xl overflow-hidden hover:border-blue-400 hover:shadow-md transition-all bg-white text-left"
                    title={`${a.label}${a.catLabel ? ` — ${a.catLabel}` : ""} (cliquer pour insérer)`}
                  >
                    <div className="h-28 bg-slate-50 flex items-center justify-center p-2 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.file} alt={a.label} className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform" loading="lazy" />
                    </div>
                    <div className="px-2 py-1.5 flex items-center justify-between gap-1">
                      <span className="text-[10.5px] font-semibold text-slate-700 leading-tight line-clamp-2">{a.label}</span>
                      {insertedSlug === a.slug && (
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
                {assets.length === 0 && (
                  <div className="col-span-full py-10 text-center text-xs text-slate-400">
                    Aucune illustration ne correspond à « {query} »
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Tracés 2D standardisés et professionnels (anatomie légendée, objets du quotidien,
                animaux, végétaux — activités de graphisme et d’observation) + photographies
                (animaux, botanique) + schémas vectoriels pour les maths, la physique et la
                géographie. Cliquer sur une image pour l’insérer.
              </p>
            </div>
          )}

          {tab === "upload" && (
            <div className="py-6">
              <label
                className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-300 rounded-2xl p-10 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void handleFile(f); }}
              >
                {uploading ? (
                  <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
                ) : (
                  <Upload className="h-10 w-10 text-slate-400" />
                )}
                <div className="text-center">
                  <div className="text-sm font-semibold text-slate-700">
                    {uploading ? "Import en cours…" : "Choisir une image ou la glisser ici"}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    JPG, PNG, WebP — redimensionnée automatiquement (max 1400 px)
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.currentTarget.value = ""; }}
                />
              </label>
            </div>
          )}

          {tab === "mesimages" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-500">
                  Images déjà importées par votre établissement (dossier « pedagogie » en premier)
                </p>
                <button onClick={() => void loadMyImages()} className="text-[11px] text-blue-600 font-semibold hover:underline">
                  Actualiser
                </button>
              </div>
              {loadingMyImages ? (
                <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
              ) : myImages.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  Aucune image importée pour l&apos;instant — utilisez l&apos;onglet « Importer »
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                  {myImages.map((m: any) => (
                    <button
                      key={m.id}
                      onClick={() => insertImgTag(m.originalUrl || m.hdUrl || m.thumbnailUrl, m.alt || m.name)}
                      className="border border-slate-200 rounded-lg overflow-hidden hover:border-blue-400 hover:shadow transition-all bg-white"
                      title={`${m.name || "Image"}${m.folder ? ` (${m.folder})` : ""} — cliquer pour insérer`}
                    >
                      <div className="h-20 bg-slate-50 flex items-center justify-center overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.thumbnailUrl || m.hdUrl || m.originalUrl} alt={m.alt || m.name} className="max-h-full max-w-full object-contain" loading="lazy" />
                      </div>
                      <div className="px-1.5 py-1 text-[9px] text-slate-500 truncate">{m.name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "url" && (
            <div className="py-4 space-y-3 max-w-lg mx-auto">
              <label className="block text-xs font-bold text-slate-700">Adresse (URL) de l&apos;image</label>
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://exemple.fr/illustration.jpg"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-300 outline-none"
              />
              {urlInput && /^(https?:)\/\//i.test(urlInput) && (
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-center h-40 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urlInput} alt="Aperçu" className="max-h-full max-w-full object-contain" />
                </div>
              )}
              <button
                onClick={() => { if (urlInput.trim()) { insertImgTag(urlInput.trim(), "Image"); onClose(); } }}
                disabled={!urlInput.trim()}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-40"
              >
                Insérer cette image
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Utilitaires ── */

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Redimensionne une image côté navigateur (canvas) et retourne un data URL JPEG/PNG. */
async function resizeImage(file: File, maxSide: number, quality: number): Promise<string> {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Image illisible"));
      el.src = bitmapUrl;
    });
    const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * ratio));
    const h = Math.max(1, Math.round(img.height * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas non disponible");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h); // fond blanc (transparence PNG → JPEG propre)
    ctx.drawImage(img, 0, 0, w, h);
    // PNG petits → garder PNG (net pour schémas) ; sinon JPEG compressé
    if (file.type === "image/png" && file.size < 400 * 1024) {
      return canvas.toDataURL("image/png");
    }
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}
