"use client";

/**
 * ============================================================================
 * CalligraphyDialog — Lignes calligraphiques pour le graphisme / l'écriture
 * ============================================================================
 *
 * ⭐ Demande utilisateur (2026-09-21) : lignes pour le graphisme avec modèles
 *    de lettres / mots (script ou cursive) dans le champ enrichi.
 *
 * ⭐ V12 (retour utilisateur 2026-09-22) — réglure PROFESSIONNELLE standard :
 *    « Normalement, pour toute ligne calligraphique, on a la ligne principale
 *    et on a trois interlignes en dehors de la ligne principale. C'est sur la
 *    ligne principale que les lettres se positionnent. »
 *
 *    1. RÉGLURE STANDARD : chaque ligne = 1 LIGNE PRINCIPALE (trait plein,
 *       c'est là que les lettres se posent) + 3 INTERLIGNES pointillés
 *       au-dessus (hauteur du corps = 2 interlignes, 3e interligne = hauteur
 *       des ascendantes) + 1 interligne de descente (jambages).
 *    2. LETTRES POSÉES SUR LA LIGNE PRINCIPALE : le modèle est un <text> SVG
 *       positionné par sa ligne de base (y = ligne principale) — plus jamais
 *       de lettres flottant entre les interlignes.
 *    3. POLICES SCOLAIRES PROFESSIONNELLES :
 *       - Cursive      → « Playwrite FR Moderne » (cursive scolaire française,
 *                         projet Google Fonts dédié à l'enseignement, OFL)
 *       - Cursive trad. → « Playwrite FR Trad » (boucles traditionnelles)
 *       - Script       → « Comic Neue » (lettres imprimées, OFL)
 *       Polices auto-hébergées (/public/fonts) → identiques à l'écran, à
 *       l'impression et hors-ligne (PWA) ; chargées par les templates PDF.
 *
 * → Disponible dans le RichTextEditor (enableMedia) : épreuves d'évaluation
 *   ET fiches pédagogiques. Le bloc inséré garde la classe .calli-lines
 *   (contenteditable=false) → retrait possible via la pastille V10.
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
type WritingStyle = "aucun" | "script" | "cursive" | "cursiveTrad";
type ModelPlacement = "chaque" | "premiere" | "continu";
type ModelRender = "copier" | "tracer";
type Interligne = "petit" | "moyen" | "grand";

// ─── Géométrie de la réglure (unités du viewBox, 720 = largeur utile A4) ────
const PAGE_W = 720;
/** Hauteur d'UN interligne (la ligne d'écriture fait 4 interlignes). */
const LINE_I: Record<Interligne, number> = { petit: 8, moyen: 10, grand: 13 };
/** Marge haute / basse du bloc. */
const PAD_TOP = 8;
const PAD_BOTTOM = 6;

// ─── Polices scolaires (auto-hébergées, métriques mesurées dans le fichier) ─
type StyleKey = "script" | "cursive" | "cursiveTrad";

const FONT_CSS: Record<StyleKey, string> = {
  script: "'Comic Neue','Comic Sans MS','Trebuchet MS',sans-serif",
  cursive: "'Playwrite FR Moderne','Segoe Script','Brush Script MT',cursive",
  cursiveTrad: "'Playwrite FR Trad','Segoe Script','Lucida Handwriting',cursive",
};

/**
 * Échelle police ↔ réglure (taille de police en interlignes) :
 *  - script  : corps des lettres = 2 interlignes (capitales → 3e interligne)
 *  - cursive : ascendantes = 4 interlignes (touchent la ligne principale
 *              précédente — modèle français), corps ≈ 2 interlignes
 *  - trad.   : boucles traditionnelles plus hautes (4,4 interlignes)
 */
const FONT_SCALE: Record<StyleKey, number> = {
  script: 2 / 0.493,
  cursive: 4 / 1.115,
  cursiveTrad: 4.4 / 1.423,
};

/** Interlettrage (en fraction de la taille de police). */
const LETTER_SPACING: Record<StyleKey, number> = {
  script: 0.18, // lettres imprimées séparées (usage CP)
  cursive: 0,   // lettres attachées — espacement nul pour garder les liens
  cursiveTrad: 0,
};

// ─── Largeurs de glyphe (avance en em, mesurées dans les fichiers polices) ──
const W_SCRIPT_RAW =
  "!:0.24,':0.2,(:0.35,):0.35,,:0.16,-:0.4,.:0.15,0:0.61,1:0.4,2:0.52,3:0.51,4:0.48,5:0.54,6:0.54,7:0.47,8:0.52,9:0.53,::0.18,;:0.2,?:0.5,A:0.58,B:0.62,C:0.61,D:0.63,E:0.6,F:0.58,G:0.72,H:0.72,I:0.39,J:0.46,K:0.56,L:0.5,M:0.84,N:0.66,O:0.64,P:0.56,Q:0.71,R:0.6,S:0.55,T:0.52,U:0.69,V:0.54,W:0.87,X:0.69,Y:0.59,Z:0.58,a:0.52,b:0.54,c:0.48,d:0.53,e:0.5,f:0.28,g:0.53,h:0.54,i:0.23,j:0.24,k:0.48,l:0.22,m:0.83,n:0.55,o:0.53,p:0.53,q:0.52,r:0.4,s:0.42,t:0.29,u:0.51,v:0.42,w:0.6,x:0.47,y:0.45,z:0.43,À:0.58,Â:0.58,Ä:0.58,Ç:0.61,È:0.6,É:0.6,Ê:0.6,Ë:0.6,Î:0.39,Ï:0.39,Ô:0.64,Ö:0.64,Ù:0.69,Û:0.69,Ü:0.69,à:0.52,â:0.52,ä:0.52,æ:0.82,ç:0.48,è:0.5,é:0.5,ê:0.5,ë:0.5,î:0.23,ï:0.23,ô:0.53,ö:0.53,ù:0.51,û:0.51,ü:0.51,œ:0.86,’:0.18";
const W_CURSIVE_RAW =
  "!:0.43,':0.17,(:0.36,):0.36,,:0.31,-:0.58,.:0.31,0:0.91,1:0.54,2:0.79,3:0.83,4:0.84,5:0.83,6:0.89,7:0.67,8:0.83,9:0.89,::0.31,;:0.31,?:0.62,A:0.9,B:0.87,C:0.93,D:1.04,E:0.79,F:0.75,G:1.05,H:1.06,I:0.41,J:0.78,K:0.82,L:0.75,M:1.26,N:1.06,O:1.11,P:0.84,Q:1.11,R:0.83,S:0.82,T:0.83,U:1.03,V:0.87,W:1.42,X:0.82,Y:0.75,Z:0.73,a:0.62,b:0.61,c:0.52,d:0.64,e:0.53,f:0.37,g:0.61,h:0.65,i:0.3,j:0.28,k:0.55,l:0.3,m:0.96,n:0.65,o:0.59,p:0.6,q:0.61,r:0.45,s:0.53,t:0.39,u:0.65,v:0.51,w:0.8,x:0.53,y:0.63,z:0.49,À:0.9,Â:0.9,Ä:0.9,Ç:0.93,È:0.79,É:0.79,Ê:0.79,Ë:0.79,Î:0.41,Ï:0.41,Ô:1.11,Ö:1.11,Ù:1.03,Û:1.03,Ü:1.03,à:0.62,â:0.62,ä:0.62,æ:0.89,ç:0.52,è:0.53,é:0.53,ê:0.53,ë:0.53,î:0.31,ï:0.31,ô:0.59,ö:0.59,ù:0.65,û:0.65,ü:0.65,œ:0.91,’:0.22";
const W_TRAD_RAW =
  "!:0.54,':0.17,(:0.46,):0.46,,:0.31,-:0.58,.:0.31,0:1.12,1:0.66,2:0.97,3:1.06,4:1.08,5:1.06,6:1.14,7:0.86,8:1.06,9:1.14,::0.31,;:0.31,?:0.8,A:1.52,B:1.31,C:1.14,D:1.49,E:1.02,F:1.09,G:1.41,H:1.52,I:0.79,J:0.86,K:1.52,L:1.18,M:2.12,N:1.65,O:1.36,P:1.22,Q:1.4,R:1.37,S:1.26,T:1.35,U:1.41,V:1.34,W:1.88,X:1.48,Y:1.36,Z:1.28,a:0.62,b:0.61,c:0.52,d:0.63,e:0.44,f:0.44,g:0.62,h:0.68,i:0.3,j:0.32,k:0.56,l:0.39,m:0.99,n:0.67,o:0.59,p:0.64,q:0.65,r:0.57,s:0.55,t:0.39,u:0.65,v:0.6,w:0.89,x:0.64,y:0.64,z:0.47,À:1.1,Â:1.1,Ä:1.1,Ç:1.14,È:0.97,É:0.97,Ê:0.97,Ë:0.97,Î:0.5,Ï:0.5,Ô:1.36,Ö:1.36,Ù:1.27,Û:1.27,Ü:1.27,à:0.62,â:0.62,ä:0.62,æ:0.78,ç:0.51,è:0.53,é:0.53,ê:0.53,ë:0.53,î:0.3,ï:0.3,ô:0.59,ö:0.59,ù:0.65,û:0.65,ü:0.65,œ:0.84,’:0.22";

function parseWidths(raw: string): { space: number; chars: Record<string, number> } {
  const chars: Record<string, number> = {};
  for (const pair of raw.split(",")) {
    const m = /^(.):(\d+(?:\.\d+)?)$/.exec(pair);
    if (m) chars[m[1]] = parseFloat(m[2]);
  }
  return { space: 0.3, chars };
}

const WIDTHS: Record<StyleKey, { space: number; chars: Record<string, number> }> = {
  script: { space: 0.334, chars: parseWidths(W_SCRIPT_RAW).chars },
  cursive: parseWidths(W_CURSIVE_RAW),
  cursiveTrad: parseWidths(W_TRAD_RAW),
};

const PRESETS: { label: string; text: string; style: WritingStyle }[] = [
  { label: "Alphabet script (minuscules)", text: "a b c d e f g h i j k l m n o p q r s t u v w x y z", style: "script" },
  { label: "Alphabet script (majuscules)", text: "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z", style: "script" },
  { label: "Alphabet cursive", text: "a b c d e f g h i j k l m n o p q r s t u v w x y z", style: "cursive" },
  { label: "Chiffres", text: "0 1 2 3 4 5 6 7 8 9", style: "script" },
  { label: "Voyelles", text: "a e i o u", style: "cursive" },
  { label: "Mots simples (CP)", text: "papa maman école chat loup", style: "cursive" },
  { label: "Prénom / ligne vierge", text: "", style: "script" },
];

// ─── Mesure & découpe du texte (vraies métriques des polices) ───────────────

function measureText(text: string, styleKey: StyleKey, fontSize: number, letterSpacing: number): number {
  const tbl = WIDTHS[styleKey];
  let w = 0;
  for (const ch of text) {
    w += (ch === " " ? tbl.space : (tbl.chars[ch] ?? 0.55)) * fontSize;
    w += letterSpacing;
  }
  return w;
}

/** Découpe gloutonne mot par mot (découpe par caractères si un mot déborde). */
function wrapWords(words: string[], styleKey: StyleKey, fontSize: number, ls: number, maxW: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (measureText(test, styleKey, fontSize, ls) <= maxW) { cur = test; continue; }
    if (cur) { out.push(cur); cur = ""; }
    if (measureText(w, styleKey, fontSize, ls) > maxW) {
      let piece = "";
      for (const ch of w) {
        if (piece && measureText(piece + ch, styleKey, fontSize, ls) > maxW) { out.push(piece); piece = ch; }
        else piece += ch;
      }
      cur = piece;
    } else cur = w;
  }
  if (cur) out.push(cur);
  return out;
}

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ─── Génération du bloc SVG (réglure + modèles posés sur la ligne principale) ─

interface CalliOptions {
  lineStyle: LineStyle;
  linesCount: number;
  interligne: Interligne;
  writingStyle: WritingStyle;
  modelText: string;
  placement: ModelPlacement;
  renderMode: ModelRender;
}

function buildCalligraphyHtml(o: CalliOptions): string {
  const i = LINE_I[o.interligne];
  const unit = 4 * i; // 3 interlignes au-dessus de la ligne principale + 1 de descente
  const seyes = o.lineStyle === "seyes";
  const padLeft = seyes ? 66 : 10;
  const padRight = 12;
  const availW = PAGE_W - padLeft - padRight;
  const lines = Math.max(1, Math.min(30, o.linesCount));
  const H = PAD_TOP + lines * unit + PAD_BOTTOM;

  const hasModel = o.writingStyle !== "aucun" && o.modelText.trim().length > 0;
  const styleKey: StyleKey =
    o.writingStyle === "script" ? "script" : o.writingStyle === "cursiveTrad" ? "cursiveTrad" : "cursive";
  const fontSize = FONT_SCALE[styleKey] * i;
  const ls = LETTER_SPACING[styleKey] * fontSize;

  // Répartition du modèle sur les lignes
  let perLine: string[] = [];
  const words = hasModel ? o.modelText.trim().split(/\s+/).filter(Boolean) : [];
  if (hasModel && words.length > 0) {
    const wrapped = wrapWords(words, styleKey, fontSize, ls, availW);
    if (o.placement === "chaque" && wrapped.length === 1) {
      // Le modèle tient sur une ligne → répété sur chaque ligne (classique)
      perLine = Array.from({ length: lines }, () => wrapped[0]);
    } else if (o.placement === "continu") {
      // Répartition équilibrée sur toutes les lignes si elle tient en largeur
      const per = Math.max(1, Math.ceil(words.length / lines));
      const even = Array.from({ length: lines }, (_, n) =>
        words.slice(n * per, (n + 1) * per).join(" "));
      if (even.every((l) => !l || measureText(l, styleKey, fontSize, ls) <= availW)) {
        perLine = even;
      } else {
        perLine = Array.from({ length: lines }, (_, n) => wrapped[n] || "");
      }
    } else {
      // « Première ligne » (ou modèle long) → flux naturel
      perLine = Array.from({ length: lines }, (_, n) => wrapped[n] || "");
    }
  }

  // Construction du SVG
  const parts: string[] = [];
  parts.push(`<rect x="0" y="0" width="${PAGE_W}" height="${H}" fill="#ffffff"/>`);

  // Seyès : réglure verticale + marge rouge
  if (seyes) {
    for (let x = 24; x < PAGE_W; x += 24) {
      parts.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#d7e2f0" stroke-width="1"/>`);
    }
    parts.push(`<line x1="56" y1="0" x2="56" y2="${H}" stroke="#e2a9a9" stroke-width="1.6"/>`);
  }

  const modelAttrs =
    o.renderMode === "copier"
      ? `fill="#b7c3d4"`
      : `fill="none" stroke="#8fa3bd" stroke-width="1"`;

  for (let n = 0; n < lines; n++) {
    const y0 = PAD_TOP + n * unit;
    const base = y0 + 3 * i; // ligne principale : les lettres se posent ICI
    // Trois interlignes pointillés au-dessus de la ligne principale
    if (o.lineStyle !== "simples") {
      for (let k = 1; k <= 3; k++) {
        const y = base - k * i;
        parts.push(`<line x1="0" y1="${y}" x2="${PAGE_W}" y2="${y}" stroke="#c3cede" stroke-width="1" stroke-dasharray="5 4"/>`);
      }
    }
    // Ligne principale (trait plein)
    parts.push(`<line x1="0" y1="${base}" x2="${PAGE_W}" y2="${base}" stroke="#64748b" stroke-width="1.6"/>`);
    // Modèle posé sur la ligne principale (y = ligne de base exacte)
    const text = perLine[n];
    if (text) {
      parts.push(
        `<text x="${padLeft}" y="${base}" ${modelAttrs} font-family="${FONT_CSS[styleKey]}" font-size="${fontSize.toFixed(1)}"${ls ? ` letter-spacing="${ls.toFixed(1)}"` : ""}>${escapeXml(text)}</text>`,
      );
    }
  }

  return (
    `<div class="calli-lines" contenteditable="false" style="margin:10px 0;">` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_W} ${H}" width="100%" role="img" ` +
    `style="height:auto;display:block;background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;">` +
    parts.join("") +
    `</svg></div>`
  );
}

// ─── Dialogue ───────────────────────────────────────────────────────────────

export function CalligraphyDialog({ open, onClose, onInsertHtml }: CalligraphyDialogProps) {
  const [lineStyle, setLineStyle] = useState<LineStyle>("cahier");
  const [linesCount, setLinesCount] = useState(6);
  const [interligne, setInterligne] = useState<Interligne>("moyen");
  const [writingStyle, setWritingStyle] = useState<WritingStyle>("cursive");
  const [modelText, setModelText] = useState("a b c d e f");
  const [placement, setPlacement] = useState<ModelPlacement>("chaque");
  const [renderMode, setRenderMode] = useState<ModelRender>("copier");

  const opts: CalliOptions = {
    lineStyle, linesCount, interligne, writingStyle, modelText, placement, renderMode,
  };
  const previewHtml = useMemo(() => buildCalligraphyHtml(opts), [
    lineStyle, linesCount, interligne, writingStyle, modelText, placement, renderMode,
  ]);

  const insert = () => {
    onInsertHtml(buildCalligraphyHtml(opts));
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
                Ligne principale + 3 interlignes — les lettres se posent sur la ligne principale
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
                ["simples", "Lignes simples", "Ligne principale seule"],
                ["cahier", "Cahier (3 interlignes)", "Ligne principale + 3 interlignes"],
                ["seyes", "Seyès (grands carreaux)", "3 interlignes + réglure + marge"],
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
              {([
                ["aucun", "Aucun", "Lignes vierges"],
                ["script", "Script", "Lettres imprimées"],
                ["cursive", "Cursive", "Attachées (moderne)"],
                ["cursiveTrad", "Cursive trad.", "Boucles classiques"],
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
                        ["tracer", "À tracer (creux)"],
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
