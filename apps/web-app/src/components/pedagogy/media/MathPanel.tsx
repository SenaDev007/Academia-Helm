"use client";

/**
 * ============================================================================
 * MathPanel — Insertion mathématique dans les fiches pédagogiques
 * ============================================================================
 *
 * ⭐ Demande utilisateur : « en mathématiques, faire des illustrations, des
 *    diagrammes, poser des opérations propres avec les différents signes
 *    mathématiques »
 *
 * 4 sections :
 *   1. SYMBOLES  — palette complète (× ÷ ± = ≠ ≈ < > ≤ ≥ √ π ∠ ° ∥ ⊥ △ ² ³ …)
 *   2. OPÉRATIONS POSÉES — addition / soustraction / multiplication / division
 *      générées en tableau HTML (colonnes alignées, retenues, potence de la
 *      division) — avec ou sans résultat (exercice à compléter en classe)
 *   3. FRACTIONS — numérateur/dénominateur empilés (fraction simple ou
 *      décimale)
 *   4. PUISSANCES & INDICES — x², x³, aⁿ, H₂O…
 *
 * Tout est inséré en HTML stylé inline → rendu écran + PDF identique.
 * ============================================================================
 */

import { useMemo, useState } from "react";
import { Sigma, X, Check, Trash2, ChevronDown } from "lucide-react";

export interface MathPanelProps {
  open: boolean;
  onClose: () => void;
  onInsertHtml: (html: string) => void;
}

/* ── Palettes de symboles ── */
const SYMBOL_GROUPS: { title: string; symbols: string[] }[] = [
  { title: "Opérations", symbols: ["+", "−", "×", "÷", "±", "=", "≠", "≈"] },
  { title: "Comparaison", symbols: ["<", ">", "≤", "≥", "≡", "∈", "∉", "∞"] },
  { title: "Géométrie", symbols: ["∠", "°", "∥", "⊥", "△", "□", "⌒", "π", "→", "↔", "∟"] },
  { title: "Puissances & racines", symbols: ["²", "³", "ⁿ", "√", "∛", "×10", "%", "‰"] },
  { title: "Fractions usuelles", symbols: ["½", "⅓", "¼", "¾", "⅔", "⅕", "⅛", "⅜", "⅝", "⅞"] },
  { title: "Ensemble & divers", symbols: ["∑", "∏", "∆", "α", "β", "θ", "µ", "Ω", "∴", "∵"] },
];

type OpKind = "addition" | "soustraction" | "multiplication" | "division";

export function MathPanel({ open, onClose, onInsertHtml }: MathPanelProps) {
  const [tab, setTab] = useState<"symboles" | "operations" | "fractions" | "puissances">("symboles");

  // Opérations posées
  const [opKind, setOpKind] = useState<OpKind>("addition");
  const [opA, setOpA] = useState("345");
  const [opB, setOpB] = useState("128");
  const [withResult, setWithResult] = useState(true);
  const [retenues, setRetenues] = useState(true);

  // Fraction
  const [fracNum, setFracNum] = useState("3");
  const [fracDen, setFracDen] = useState("4");

  // Puissances
  const [powBase, setPowBase] = useState("x");
  const [powExp, setPowExp] = useState("2");

  const insert = (html: string) => {
    onInsertHtml(html);
    // ne ferme pas : l'enseignant insère souvent plusieurs symboles d'affilée
  };

  const close = () => onClose();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-2 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/40" onClick={close} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[86vh] flex flex-col overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Sigma className="h-5 w-5 text-blue-600" />
            <div>
              <div className="text-sm font-bold text-slate-800">Insertion mathématique</div>
              <div className="text-[11px] text-slate-500">Symboles, opérations posées, fractions et puissances</div>
            </div>
          </div>
          <button onClick={close} className="p-2 rounded-lg hover:bg-slate-200 text-slate-500" title="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Onglets */}
        <div className="flex border-b border-slate-200 bg-white overflow-x-auto">
          {([
            ["symboles", "Symboles"],
            ["operations", "Opérations posées"],
            ["fractions", "Fractions"],
            ["puissances", "Puissances / indices"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
                tab === id ? "text-blue-600 border-blue-600 bg-blue-50/50" : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "symboles" && (
            <div className="space-y-4">
              {SYMBOL_GROUPS.map((g) => (
                <div key={g.title}>
                  <div className="text-[11px] font-bold text-slate-500 uppercase mb-1.5">{g.title}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.symbols.map((sym) => (
                      <button
                        key={sym}
                        onClick={() => insert(`<span class="ah-math" style="font-family:'Cambria Math','Times New Roman',serif;font-weight:600;">${sym === "×10" ? "× 10" : sym}</span>`)}
                        className="min-w-[40px] h-10 px-2 border border-slate-200 rounded-lg text-lg font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50 font-serif"
                        title={`Insérer ${sym}`}
                      >
                        {sym}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-slate-400">Le panneau reste ouvert — insérez plusieurs symboles à la suite, puis fermez-le.</p>
            </div>
          )}

          {tab === "operations" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Type d&apos;opération</span>
                  <div className="relative">
                    <select
                      value={opKind}
                      onChange={(e) => setOpKind(e.target.value as OpKind)}
                      className="mt-1 w-full px-3 py-2 pr-8 text-sm border border-slate-200 rounded-lg appearance-none bg-white"
                    >
                      <option value="addition">Addition (+)</option>
                      <option value="soustraction">Soustraction (−)</option>
                      <option value="multiplication">Multiplication (×)</option>
                      <option value="division">Division (÷ euclidienne)</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">1<sup>er</sup> nombre</span>
                    <input value={opA} onChange={(e) => setOpA(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric"
                      className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">2<sup>e</sup> nombre</span>
                    <input value={opB} onChange={(e) => setOpB(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric"
                      className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono" />
                  </label>
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={withResult} onChange={(e) => setWithResult(e.target.checked)} className="accent-blue-600" />
                  Afficher le résultat (sinon : exercice à compléter)
                </label>
                {opKind !== "division" && (
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" checked={retenues} onChange={(e) => setRetenues(e.target.checked)} className="accent-blue-600" />
                    Ligne de retenues
                  </label>
                )}
              </div>
              {/* Aperçu */}
              <div className="border border-slate-200 rounded-xl bg-slate-50 p-4 flex justify-center overflow-x-auto">
                <div className="bg-white rounded-lg shadow-sm px-6 py-4 border border-slate-100" style={{ minWidth: 180 }}>
                  <div dangerouslySetInnerHTML={{ __html: buildPosedOperation(opKind, opA, opB, { withResult, retenues }) }} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setOpA(""); setOpB(""); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-500 hover:bg-slate-100 border border-slate-200"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Effacer
                </button>
                <button
                  onClick={() => insert(buildPosedOperation(opKind, opA, opB, { withResult, retenues }))}
                  disabled={!opA || !opB}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-40"
                >
                  <Check className="h-4 w-4" /> Insérer l&apos;opération
                </button>
              </div>
            </div>
          )}

          {tab === "fractions" && (
            <div className="space-y-4 max-w-sm mx-auto">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Numérateur (haut)</span>
                  <input value={fracNum} onChange={(e) => setFracNum(e.target.value.replace(/[^\d/]/g, ""))} inputMode="numeric"
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Dénominateur (bas)</span>
                  <input value={fracDen} onChange={(e) => setFracDen(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric"
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono" />
                </label>
              </div>
              <div className="border border-slate-200 rounded-xl bg-slate-50 p-4 flex justify-center">
                <div className="bg-white rounded-lg shadow-sm px-8 py-3 border border-slate-100 text-xl">
                  <div dangerouslySetInnerHTML={{ __html: buildFraction(fracNum, fracDen) }} />
                </div>
              </div>
              <button
                onClick={() => insert(buildFraction(fracNum, fracDen))}
                disabled={!fracNum || !fracDen || fracDen === "0"}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-40"
              >
                <Check className="h-4 w-4" /> Insérer la fraction
              </button>
            </div>
          )}

          {tab === "puissances" && (
            <div className="space-y-4 max-w-sm mx-auto">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Base</span>
                  <input value={powBase} onChange={(e) => setPowBase(e.target.value.slice(0, 6))}
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Exposant / indice</span>
                  <input value={powExp} onChange={(e) => setPowExp(e.target.value.slice(0, 4))}
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => insert(`<span>${escHtml(powBase)}<sup class="ah-sup">${escHtml(powExp)}</sup></span>`)}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                >
                  Insérer {powBase}<sup>{powExp}</sup> (exposant)
                </button>
                <button
                  onClick={() => insert(`<span>${escHtml(powBase)}<sub class="ah-sub">${escHtml(powExp)}</sub></span>`)}
                  className="flex-1 py-2.5 bg-slate-700 text-white rounded-lg text-sm font-semibold hover:bg-slate-800"
                >
                  Insérer {powBase}<sub>{powExp}</sub> (indice)
                </button>
              </div>
              <p className="text-[10px] text-slate-400 text-center">Exemples : 10³, cm², aⁿ (exposant) — H₂O, x₁ (indice)</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ Générateurs HTML ═══════════════════ */

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Opération posée classique (tableau aligné à droite, style cahier). */
export function buildPosedOperation(
  kind: OpKind,
  aStr: string,
  bStr: string,
  opts: { withResult: boolean; retenues: boolean },
): string {
  const a = (aStr || "0").replace(/\D/g, "");
  const b = (bStr || "0").replace(/\D/g, "");
  const A = parseInt(a || "0", 10);
  const B = parseInt(b || "0", 10);

  if (kind === "division") {
    const q = B === 0 ? 0 : Math.floor(A / B);
    const r = A - q * B;
    const res = opts.withResult ? String(q) : "?";
    const rest = opts.withResult ? String(r) : "?";
    return `<span class="ah-op" style="display:inline-block;font-family:'Courier New',monospace;font-size:15px;line-height:1.5;color:#0f172a;border:1px solid #cbd5e1;border-radius:6px;padding:8px 12px;background:#fff;">
<table style="border-collapse:collapse;text-align:right;"><tbody>
<tr><td style="padding:0 10px 0 18px;border-bottom:2px solid #0f172a;font-weight:bold;">${escHtml(a)}</td><td style="padding:0 12px;border-left:2px solid #0f172a;border-bottom:2px solid #0f172a;font-weight:bold;">${escHtml(b)}</td></tr>
<tr><td style="padding:6px 10px 0 18px;">${escHtml(rest)}</td><td style="padding:6px 12px;border-left:2px solid #0f172a;font-weight:bold;color:#1d4ed8;">${escHtml(res)}</td></tr>
</tbody></table>
<div style="font-size:9px;color:#64748b;margin-top:2px;">reste | quotient</div>
</span>&nbsp;`;
  }

  const sign = kind === "addition" ? "+" : kind === "soustraction" ? "−" : "×";
  const result = kind === "addition" ? A + B : kind === "soustraction" ? A - B : A * B;
  const width = Math.max(a.length, b.length + 1, String(Math.abs(result)).length) + 1;

  // Chiffres alignés à droite
  const row = (numStr: string, padSign = "") => {
    const pad = "‎ ".repeat(Math.max(0, width - numStr.length - (padSign ? 1 : 0)));
    return `<tr><td style="padding:1px 10px;text-align:right;white-space:pre;font-family:'Courier New',monospace;">${padSign}${pad}${escHtml(numStr)}</td></tr>`;
  };

  // Retenues (addition/soustraction)
  let carryRow = "";
  if (opts.retenues && kind !== "multiplication") {
    let carry = "";
    if (kind === "addition") {
      let c = 0;
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const da = parseInt(a[a.length - 1 - i] || "0", 10);
        const db = parseInt(b[b.length - 1 - i] || "0", 10);
        const s = da + db + c;
        c = s >= 10 ? 1 : 0;
        carry = (c ? "1" : " ") + carry;
      }
    } else {
      let borrow = 0;
      for (let i = 0; i < a.length; i++) {
        const da = parseInt(a[a.length - 1 - i] || "0", 10);
        const db = i < b.length ? parseInt(b[b.length - 1 - i] || "0", 10) : 0;
        if (da - borrow < db) { carry = "1" + carry; borrow = 1; } else { carry = " " + carry; borrow = 0; }
      }
    }
    carry = carry.replace(/\s+$/, "");
    if (carry.trim()) {
      const pad = " ".repeat(Math.max(0, width - carry.length));
      carryRow = `<tr><td style="padding:0 10px;text-align:right;white-space:pre;font-family:'Courier New',monospace;font-size:11px;color:#dc2626;">${pad}${escHtml(carry.trim())}</td></tr>`;
    }
  }

  const resRow = opts.withResult
    ? row(String(result))
    : `<tr><td style="padding:1px 10px;text-align:right;white-space:pre;font-family:'Courier New',monospace;color:#94a3b8;">${"·".repeat(width - 1)}</td></tr>`;

  return `<span class="ah-op" style="display:inline-block;border:1px solid #cbd5e1;border-radius:6px;padding:6px 4px;background:#fff;vertical-align:middle;">
<table style="border-collapse:collapse;"><tbody>
${carryRow}
${row(a)}
${row(b, sign)}
<tr><td colspan="1" style="border-top:2px solid #0f172a;"></td></tr>
${resRow}
</tbody></table>
</span>&nbsp;`;
}

/** Fraction empilée (rendu écran + PDF).
 *  ⭐ 2026-10-01 — ATOME INLINE INSÉCABLE : contenteditable="false" posé
 *    sur le span. Dans le champ de saisie enrichi, la fraction vit DANS le
 *    flux du texte (ex : « A) ¾   B) ⅝   C) ½ » sur UNE seule ligne) :
 *    - le curseur ne peut pas entrer dedans (structure numérateur /
 *      dénominateur protégée) ;
 *    - un clic sélectionne l'atome ENTIER (surlignage bleu natif) ;
 *    - glisser-déposer NATIF du navigateur : la fraction se déplace sur la
 *      ligne, le caret d'insertion s'affiche, la ligne n'est jamais
 *      coupée (plus d'habillage qui déforme) ;
 *    - Suppr / Retour arrière la retirent d'un seul bloc. */
export function buildFraction(num: string, den: string): string {
  const n = escHtml(num || "1");
  const d = escHtml(den || "1");
  return `<span class="ah-frac" contenteditable="false" style="display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;line-height:1.1;margin:0 3px;font-family:'Cambria Math','Times New Roman',serif;font-size:0.95em;">
<span style="padding:0 4px;border-bottom:2px solid #0f172a;">${n}</span>
<span style="padding:0 4px;">${d}</span>
</span>`;
}
