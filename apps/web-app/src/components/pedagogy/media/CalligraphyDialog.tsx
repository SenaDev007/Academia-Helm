"use client";

/**
 * ============================================================================
 * CalligraphyDialog — Lignes calligraphiques pour le graphisme / l'écriture
 * ============================================================================
 *
 * ⭐ Demande utilisateur (2026-09-21) : « pour la préparation des épreuves, il
 *    arrive que l'enseignant doive mettre sur l'épreuve des LIGNES pour le
 *    graphisme, au cas où il y a évaluation sur le graphisme, pour que l'élève
 *    puisse écrire comme si c'était dans un cahier, pour qu'il puisse faire de
 *    la calligraphie. Il faut pouvoir insérer dans notre champ enrichi ces
 *    lignes calligraphiques, avec des modèles de lettres, de mots, selon le
 *    style : écriture SCRIPT ou écriture CURSIVE. »
 *
 * → Disponible dans le RichTextEditor (enableMedia) : profite AUX ÉPREUVES
 *   d'évaluation ET aux fiches pédagogiques.
 *
 * Options :
 *   1. STYLE DE LIGNES :
 *      - Lignes simples (baseline seule)
 *      - Cahier (baseline + ligne médiane pointillée)
 *      - Seyès / grands carreaux (3 interlignes + réglure verticale + marge)
 *   2. Nombre de lignes (1-30, préréglages 3/6/10/15)
 *   3. Interligne : petit / moyen / grand
 *   4. MODÈLE (facultatif) : écriture SCRIPT ou CURSIVE, texte libre ou
 *      préréglages (alphabets, chiffres, voyelles, mots CP), répété sur chaque
 *      ligne / première ligne seulement / texte qui continue ligne à ligne,
 *      affiché « à copier » (gris clair) ou « à tracer » (contour pointillé).
 *
 * ⭐ Génération 100 % HTML inline (aucune dépendance CSS externe) → rendu
 *    identique à l'écran (éditeur) et à l'impression (PDF Puppeteer,
 *    printBackground). Les polices script/cursive utilisent des chaînes de
 *    repli multi-plateformes.
 * ============================================================================
 */

import { useMemo, useState } from "react";
import { PenLine, X, Check, RotateCcw } from "lucide-react";

export interface CalligraphyDialogProps {
  open: boolean;
  onClose: () => void;
  onInsertHtml: (html: string) => void;
}

type LineStyle = "simples" | "cahier" | "seyes";
type WritingStyle = "aucun" | "script" | "cursive";
type ModelPlacement = "chaque" | "premiere" | "continu";
type ModelRender = "copier" | "tracer";
type Interligne = "petit" | "moyen" | "grand";

const LINE_HEIGHTS: Record<Interligne, number> = { petit: 26, moyen: 34, grand: 44 };

/** Chaînes de polices multi-plateformes (navigateur + PDF Chromium). */
const FONT_SCRIPT = "'Comic Sans MS','Patrick Hand','Segoe Print','Chalkboard SE','Calibri',sans-serif";
const FONT_CURSIVE = "'Segoe Script','Caveat','Brush Script MT','Lucida Handwriting','Dancing Script',cursive";

const PRESETS: { label: string; text: string; style: WritingStyle }[] = [
  { label: "Alphabet script (minuscules)", text: "a b c d e f g h i j k l m n o p q r s t u v w x y z", style: "script" },
  { label: "Alphabet script (majuscules)", text: "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z", style: "script" },
  { label: "Alphabet cursive", text: "a b c d e f g h i j k l m n o p q r s t u v w x y z", style: "cursive" },
  { label: "Chiffres", text: "0 1 2 3 4 5 6 7 8 9", style: "script" },
  { label: "Voyelles", text: "a e i o u", style: "cursive" },
  { label: "Mots simples (CP)", text: "papa maman école chat loup", style: "cursive" },
  { label: "Prénom / ligne vierge", text: "", style: "script" },
];

export function CalligraphyDialog({ open, onClose, onInsertHtml }: CalligraphyDialogProps) {
  const [lineStyle, setLineStyle] = useState<LineStyle>("cahier");
  const [linesCount, setLinesCount] = useState(6);
  const [interligne, setInterligne] = useState<Interligne>("moyen");
  const [writingStyle, setWritingStyle] = useState<WritingStyle>("cursive");
  const [modelText, setModelText] = useState("a b c d e f");
  const [placement, setPlacement] = useState<ModelPlacement>("chaque");
  const [renderMode, setRenderMode] = useState<ModelRender>("copier");

  /** Génère le HTML des lignes calligraphiques (inline styles uniquement). */
  const buildHtml = (): string => {
    const h = LINE_HEIGHTS[interligne];
    const lineHeight = lineStyle === "seyes" ? Math.max(h, 36) : h;
    const font = writingStyle === "cursive" ? FONT_CURSIVE : FONT_SCRIPT;
    const fontSize = Math.round(lineHeight * 0.62);

    // Style du modèle : « à copier » (gris clair plein) ou « à tracer »
    // (contour — Chrome/Chromium : éditeur ET PDF Puppeteer)
    const modelStyle =
      renderMode === "copier"
        ? `color:#b7c3d4;-webkit-text-stroke:0;`
        : `color:transparent;-webkit-text-stroke:1px #8fa3bd;`;

    // Répartition du texte sur les lignes
    const words = modelText.trim().split(/\s+/).filter(Boolean);
    const perLine: string[] = [];
    if (placement === "continu" && words.length > 0) {
      // Le texte continue ligne à ligne (mots répartis)
      const per = Math.max(1, Math.ceil(words.length / Math.max(1, linesCount)));
      for (let i = 0; i < linesCount; i++) {
        perLine.push(words.slice(i * per, (i + 1) * per).join(" "));
      }
    } else {
      for (let i = 0; i < linesCount; i++) {
        perLine.push(placement === "chaque" || i === 0 ? modelText : "");
      }
    }

    // Lignes verticales (seyès) : réglure + marge rouge à gauche
    const verticals =
      lineStyle === "seyes"
        ? `background:repeating-linear-gradient(to right,transparent 0px,transparent 23px,#dbe7f5 23px,#dbe7f5 24px);`
        : "";
    const marge = lineStyle === "seyes" ? `<div style="position:absolute;left:56px;top:0;bottom:0;width:1.5px;background:#e2a9a9;"></div>` : "";

    // Lignes intermédiaires pointillées
    const interlines: string[] = [];
    if (lineStyle === "cahier") {
      interlines.push(`<div style="position:absolute;left:0;right:0;top:50%;border-bottom:1px dashed #c3cede;"></div>`);
    } else if (lineStyle === "seyes") {
      interlines.push(`<div style="position:absolute;left:0;right:0;top:33%;border-bottom:1px dashed #c3cede;"></div>`);
      interlines.push(`<div style="position:absolute;left:0;right:0;top:66%;border-bottom:1px dashed #c3cede;"></div>`);
    }

    const linesHtml = perLine
      .map((text) => {
        const model = text
          ? `<span style="position:absolute;left:${lineStyle === "seyes" ? 66 : 8}px;top:0;line-height:${lineHeight}px;font-family:${font};font-size:${fontSize}px;letter-spacing:${Math.round(fontSize * 0.35)}px;white-space:nowrap;${modelStyle}">${escapeHtml(text)}</span>`
          : "";
        return `<div style="position:relative;height:${lineHeight}px;border-bottom:1.5px solid #64748b;${verticals}">${marge}${interlines.join("")}${model}</div>`;
      })
      .join("");

    return `<div class="calli-lines" contenteditable="false" style="margin:10px 0;padding:4px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#ffffff;">${linesHtml}</div>`;
  };

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const previewHtml = useMemo(() => buildHtml(), [
    lineStyle, linesCount, interligne, writingStyle, modelText, placement, renderMode,
  ]);

  const insert = () => {
    onInsertHtml(buildHtml());
    onClose();
  };

  if (!open) return null;

  const radioBtn = "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer";
  const radioOn = "border-blue-400 bg-blue-50 text-blue-700";
  const radioOff = "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50";

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-2 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-amber-600" />
            <div>
              <div className="text-sm font-bold text-slate-800">Lignes calligraphiques</div>
              <div className="text-[11px] text-slate-500">
                Graphisme & écriture — modèles de lettres et de mots, script ou cursive
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200 text-slate-500" title="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 1. Style de lignes */}
          <div>
            <div className="text-xs font-bold text-slate-700 mb-1.5">1. Style de lignes</div>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["simples", "Lignes simples", "Baseline seule"],
                ["cahier", "Cahier", "Ligne médiane pointillée"],
                ["seyes", "Seyès (grands carreaux)", "3 interlignes + marge"],
              ] as const).map(([id, label, hint]) => (
                <button
                  key={id}
                  onClick={() => setLineStyle(id)}
                  className={`${radioBtn} flex-col items-start ${lineStyle === id ? radioOn : radioOff}`}
                >
                  <span className="font-semibold">{label}</span>
                  <span className="text-[10px] opacity-70">{hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Nombre de lignes + interligne */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-bold text-slate-700 mb-1.5">2. Nombre de lignes</div>
              <div className="flex items-center gap-2">
                {[3, 6, 10, 15].map((n) => (
                  <button
                    key={n}
                    onClick={() => setLinesCount(n)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold ${linesCount === n ? radioOn : radioOff}`}
                  >
                    {n}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={linesCount}
                  onChange={(e) => setLinesCount(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-700 mb-1.5">3. Interligne</div>
              <div className="flex gap-2">
                {(["petit", "moyen", "grand"] as const).map((id) => (
                  <button
                    key={id}
                    onClick={() => setInterligne(id)}
                    className={`${radioBtn} capitalize ${interligne === id ? radioOn : radioOff}`}
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Modèle */}
          <div className="border-t border-slate-100 pt-3">
            <div className="text-xs font-bold text-slate-700 mb-1.5">
              4. Modèle de lettres / mots <span className="font-normal text-slate-400">(facultatif)</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {([
                ["aucun", "Aucun", "Lignes vierges"],
                ["script", "Script", "Lettres imprimées"],
                ["cursive", "Cursive", "Lettres attachées"],
              ] as const).map(([id, label, hint]) => (
                <button
                  key={id}
                  onClick={() => setWritingStyle(id)}
                  className={`${radioBtn} flex-col items-start ${writingStyle === id ? radioOn : radioOff}`}
                >
                  <span className="font-semibold">{label}</span>
                  <span className="text-[10px] opacity-70">{hint}</span>
                </button>
              ))}
            </div>

            {writingStyle !== "aucun" && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={modelText}
                  onChange={(e) => setModelText(e.target.value)}
                  placeholder="Texte du modèle (lettres, mots, phrase…)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => { setModelText(p.text); setWritingStyle(p.style); }}
                      className="px-2 py-1 rounded-md border border-slate-200 text-[10px] text-slate-600 hover:bg-amber-50 hover:border-amber-300"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 mb-1">Position du modèle</div>
                    <div className="flex flex-wrap gap-1.5">
                      {([
                        ["chaque", "Chaque ligne"],
                        ["premiere", "1ʳᵉ ligne"],
                        ["continu", "Continue"],
                      ] as const).map(([id, label]) => (
                        <button
                          key={id}
                          onClick={() => setPlacement(id)}
                          className={`px-2 py-1 rounded-md border text-[10px] font-medium ${placement === id ? radioOn : radioOff}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 mb-1">Affichage</div>
                    <div className="flex flex-wrap gap-1.5">
                      {([
                        ["copier", "À copier (gris)"],
                        ["tracer", "À tracer (pointillé)"],
                      ] as const).map(([id, label]) => (
                        <button
                          key={id}
                          onClick={() => setRenderMode(id)}
                          className={`px-2 py-1 rounded-md border text-[10px] font-medium ${renderMode === id ? radioOn : radioOff}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Aperçu */}
          <div className="border-t border-slate-100 pt-3">
            <div className="text-xs font-bold text-slate-700 mb-1.5">Aperçu (rendu écran &amp; impression)</div>
            <div
              className="rounded-lg border border-slate-200 bg-white p-2 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>

        {/* Pied */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <button
            onClick={() => {
              setLineStyle("cahier"); setLinesCount(6); setInterligne("moyen");
              setWritingStyle("cursive"); setModelText("a b c d e f");
              setPlacement("chaque"); setRenderMode("copier");
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-500 hover:bg-slate-200"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200">
              Annuler
            </button>
            <button
              onClick={insert}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 shadow"
            >
              <Check className="h-4 w-4" /> Insérer les lignes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
