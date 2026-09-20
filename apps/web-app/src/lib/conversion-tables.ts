/**
 * ============================================================================
 * CONVERSION-TABLES — Tableaux de conversion COMPLETS (CE1 → CM2)
 * ============================================================================
 *
 * ⭐ Retour utilisateur (2026-09-20) : « En ce qui concerne les conversions,
 *    les longueurs, les masses, les capacités, c'est pas vraiment au complet
 *    (…). On ne voit pas quintal, tonne et autres. Il faut tous les types de
 *    tableaux de conversion utiles pour le CE1, le CE2, le CM1, le CM2, avec
 *    les correspondances qu'il y a entre les tableaux (masse et capacité, le
 *    litre) et comment faire ces conversions. »
 *
 * Ce module PUR (aucune dépendance React) décrit CHAQUE tableau de conversion
 * du programme français du CE1 au CM2 et construit le HTML inséré dans les
 * fiches / cahier journal (table inline — rendu identique écran + PDF).
 *
 * ── Couverture ──
 *   • LONGUEURS  : CE1 (m→mm) · CE2→CM2 complète (km→mm)
 *   • MASSES     : CE2 (kg→g) · CM (kg→mg) · CM1-CM2 AVEC TONNE ET QUINTAL
 *   • CAPACITÉS  : CE1/CE2 (L→mL) · CM complète (kL→mL)
 *   • AIRES      : CM1-CM2 (km²→mm², 2 colonnes par unité + ha/a/ca)
 *   • VOLUMES    : CM (m³→cm³) · CM2 complète (km³→mm³, 3 colonnes par unité)
 *   • DURÉES     : équivalences (s/min/h/j/semaine/mois/année — pas un
 *                  tableau à colonnes : 1 h = 60 min, pas 100 !)
 *   • MONNAIE    : euros / centimes
 *   • CORRESPONDANCES : tableau récapitulatif ENTRE grandeurs (L↔dm³,
 *                  kg↔L d'eau, t/q, ha/a/ca, durées, monnaie) + méthode.
 *
 * ── Modèle ──
 *   Un tableau à colonnes = `columns` (chaque unité occupe `span` sous-colonnes
 *   de chiffres : 1 pour longueurs/masses/capacités, 2 pour les aires, 3 pour
 *   les volumes). L'unité de base (m, g, L, m², m³, €) est surlignée.
 *   Un exemple = `digits` posés en partant de la fin vers la gauche,
 *   `endCol` = index de la sous-colonne où se termine le nombre (le chiffre
 *   des unités de la grandeur de départ).
 *   Une table d'équivalences (durées, correspondances) = `pairs`.
 * ============================================================================
 */

/* ── Styles inline (fidélité écran ↔ PDF, mêmes conventions que TableDialog) ── */
const TD = `border:1px solid #cbd5e1;padding:4px 8px;text-align:center;min-width:34px;`;
const TD_HEAD = `border:1px solid #93c5fd;background:#eff6ff;padding:4px 8px;text-align:center;font-weight:700;color:#1e40af;`;
const TD_HEAD_BASE = `border:1px solid #3b82f6;background:#dbeafe;padding:4px 8px;text-align:center;font-weight:700;color:#1e40af;`;
const TD_FIRSTCOL = `border:1px solid #cbd5e1;background:#f8fafc;padding:4px 8px;text-align:center;font-weight:600;color:#334155;`;
const TABLE_STYLE =
  `border-collapse:collapse;margin:8px auto;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;max-width:100%;`;
const CAPTION = `text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#475569;margin:4px auto 2px;max-width:100%;`;

/** Colonne d'un tableau de conversion (une unité ; span = nb de sous-colonnes). */
export interface ConvCol {
  /** Étiquette de l'unité (km, hm, …). Vide = colonne tampon (entre q et kg). */
  label: string;
  /** Nombre de sous-colonnes de chiffres (1 par défaut ; 2 pour les aires ; 3 pour les volumes). */
  span?: number;
}

/** Exemple chiffré posé dans le tableau. */
export interface ConvExample {
  /** Légende affichée sous le tableau (« 1,5 t = 1 500 kg »). */
  caption: string;
  /** Chiffres du nombre, sans virgule ni espace (« 1500 » pour 1,5 t). */
  digits: string;
  /** Index (0-based, en SOUS-COLONNES) où se pose le DERNIER chiffre. */
  endCol: number;
}

/** Définition complète d'un tableau de conversion. */
export interface ConvDef {
  id: string;
  /** Groupe (Longueurs, Masses, Capacités, Aires, Volumes, Durées, Monnaie, Correspondances). */
  group: ConvGroup;
  /** Libellé de la variante affiché dans le sélecteur. */
  variant: string;
  /** Niveau(x) concerné(s). */
  level: string;
  /** Description courte (dialogue). */
  desc: string;
  /** Colonnes — absent pour les tables d'équivalences (pairs). */
  columns?: ConvCol[];
  /** Étiquette de l'unité de base à surligner (m, g, L, m², m³, €). */
  baseLabel?: string;
  /** Exemple posé dans la première rangée. */
  example?: ConvExample;
  /** Équivalences clés (affichées sous le tableau si demandé). */
  note?: string;
  /** Table d'équivalences (Durées, Correspondances). */
  pairs?: [string, string][];
  /** En-têtes des 2 colonnes de la table d'équivalences. */
  pairHeader?: [string, string];
}

export type ConvGroup =
  | "Longueurs" | "Masses" | "Capacités" | "Aires"
  | "Volumes" | "Durées" | "Monnaie" | "Correspondances";

export const CONV_GROUPS: ConvGroup[] = [
  "Longueurs", "Masses", "Capacités", "Aires",
  "Volumes", "Durées", "Monnaie", "Correspondances",
];

/** Méthode générique de conversion par tableau (le « comment faire »). */
const METHOD =
  "Méthode : placer le chiffre des unités du nombre dans la colonne de son unité de départ, puis lire le nombre dans la colonne de l'unité d'arrivée (en ajoutant des zéros ou en plaçant la virgule).";

/* ════════════════════════ DÉFINITIONS ════════════════════════ */

export const CONV_DEFS: ConvDef[] = [
  /* ── LONGUEURS ── */
  {
    id: "longueurs-ce1",
    group: "Longueurs",
    variant: "CE1 · m → mm",
    level: "CE1",
    desc: "Premier tableau de longueurs : le mètre et ses subdivisions (comparer, estimer, mesurer des segments).",
    columns: [
      { label: "m" }, { label: "dm" }, { label: "cm" }, { label: "mm" },
    ],
    baseLabel: "m",
    example: { caption: "Exemple : 25 cm → 2 dans dm, 5 dans cm (25 cm = 2 dm et 5 cm)", digits: "25", endCol: 2 },
    note: "1 m = 10 dm = 100 cm = 1 000 mm",
  },
  {
    id: "longueurs",
    group: "Longueurs",
    variant: "CE2 → CM2 · km → mm (complète)",
    level: "CE2, CM1, CM2",
    desc: "Tableau complet des longueurs du kilomètre au millimètre — conversions par déplacement de virgule ou ajout de zéros.",
    columns: [
      { label: "km" }, { label: "hm" }, { label: "dam" }, { label: "m" },
      { label: "dm" }, { label: "cm" }, { label: "mm" },
    ],
    baseLabel: "m",
    example: { caption: "Exemple : 12,5 m → 1 dans dam, 2 dans m, 5 dans dm", digits: "125", endCol: 4 },
    note: "1 km = 10 hm = 100 dam = 1 000 m · 1 m = 10 dm = 100 cm = 1 000 mm",
  },

  /* ── MASSES ── */
  {
    id: "masses-ce2",
    group: "Masses",
    variant: "CE2 · kg → g",
    level: "CE2",
    desc: "Masses usuelles : le kilogramme et ses subdivisions jusqu'au gramme.",
    columns: [
      { label: "kg" }, { label: "hg" }, { label: "dag" }, { label: "g" },
    ],
    baseLabel: "g",
    example: { caption: "Exemple : 2,375 kg = 2 375 g", digits: "2375", endCol: 3 },
    note: "1 kg = 10 hg = 100 dag = 1 000 g",
  },
  {
    id: "masses",
    group: "Masses",
    variant: "CM · kg → mg (complète)",
    level: "CM1, CM2",
    desc: "Tableau complet des masses du kilogramme au milligramme.",
    columns: [
      { label: "kg" }, { label: "hg" }, { label: "dag" }, { label: "g" },
      { label: "dg" }, { label: "cg" }, { label: "mg" },
    ],
    baseLabel: "g",
    example: { caption: "Exemple : 12,5 g = 12 500 mg", digits: "125", endCol: 4 },
    note: "1 kg = 1 000 g · 1 g = 10 dg = 100 cg = 1 000 mg",
  },
  {
    id: "masses-tq",
    group: "Masses",
    variant: "CM1-CM2 · avec tonne (t) et quintal (q)",
    level: "CM1, CM2",
    desc: "Le grand tableau des masses AVEC la tonne et le quintal — la colonne tampon entre q et kg est volontairement vide (1 q = 100 kg).",
    columns: [
      { label: "t" }, { label: "q" }, { label: "" }, { label: "kg" },
      { label: "hg" }, { label: "dag" }, { label: "g" },
      { label: "dg" }, { label: "cg" }, { label: "mg" },
    ],
    baseLabel: "g",
    example: { caption: "Exemple : 1,5 t → 1 dans t, 5 dans q (1,5 t = 15 q = 1 500 kg)", digits: "1500", endCol: 3 },
    note: "1 t = 1 000 kg · 1 q = 100 kg · 1 t = 10 q",
  },

  /* ── CAPACITÉS ── */
  {
    id: "capacites-ce2",
    group: "Capacités",
    variant: "CE1/CE2 · L → mL",
    level: "CE1, CE2",
    desc: "Contenances usuelles : le litre, le décilitre, le centilitre et le millilitre.",
    columns: [
      { label: "L" }, { label: "dL" }, { label: "cL" }, { label: "mL" },
    ],
    baseLabel: "L",
    example: { caption: "Exemple : 2,5 L = 25 dL = 2 500 mL", digits: "25", endCol: 1 },
    note: "1 L = 10 dL = 100 cL = 1 000 mL",
  },
  {
    id: "capacites",
    group: "Capacités",
    variant: "CM · kL → mL (complète)",
    level: "CM1, CM2",
    desc: "Tableau complet des capacités du kilolitre au millilitre, avec les correspondances capacité ↔ volume.",
    columns: [
      { label: "kL" }, { label: "hL" }, { label: "daL" }, { label: "L" },
      { label: "dL" }, { label: "cL" }, { label: "mL" },
    ],
    baseLabel: "L",
    example: { caption: "Exemple : 3,4 L = 3 400 mL", digits: "34", endCol: 4 },
    note: "1 L = 10 dL = 100 cL = 1 000 mL · 1 hL = 100 L · 1 kL = 1 000 L · Correspondances : 1 L = 1 dm³ · 1 mL = 1 cm³ · 1 000 L = 1 m³",
  },

  /* ── AIRES ── */
  {
    id: "aires",
    group: "Aires",
    variant: "CM1-CM2 · km² → mm² (+ ha, a, ca)",
    level: "CM1, CM2",
    desc: "Tableau des aires : chaque unité occupe 2 colonnes de chiffres (1 unité d'aire = 100 fois la suivante). Hectare, are et centiare en équivalences.",
    columns: [
      { label: "km²", span: 2 }, { label: "hm²", span: 2 }, { label: "dam²", span: 2 },
      { label: "m²", span: 2 }, { label: "dm²", span: 2 }, { label: "cm²", span: 2 },
      { label: "mm²", span: 2 },
    ],
    baseLabel: "m²",
    example: { caption: "Exemple : 7,2 dam² = 720 m²", digits: "720", endCol: 7 },
    note: "Chaque unité d'aire vaut 100 fois la suivante (2 colonnes par unité) · 1 ha = 1 hm² = 10 000 m² · 1 a = 1 dam² = 100 m² · 1 ca = 1 m² · 1 ha = 100 a",
  },

  /* ── VOLUMES ── */
  {
    id: "volumes",
    group: "Volumes",
    variant: "CM · m³ → cm³ (usuelles)",
    level: "CM1, CM2",
    desc: "Volumes usuels : le mètre cube, le décimètre cube et le centimètre cube — chaque unité occupe 3 colonnes (× 1 000).",
    columns: [
      { label: "m³", span: 3 }, { label: "dm³", span: 3 }, { label: "cm³", span: 3 },
    ],
    baseLabel: "m³",
    example: { caption: "Exemple : 2,5 m³ = 2 500 dm³", digits: "2500", endCol: 5 },
    note: "1 m³ = 1 000 dm³ · 1 dm³ = 1 000 cm³ · Correspondances : 1 dm³ = 1 L · 1 cm³ = 1 mL · 1 m³ = 1 000 L",
  },
  {
    id: "volumes-full",
    group: "Volumes",
    variant: "CM2 · km³ → mm³ (complète)",
    level: "CM2",
    desc: "Le tableau complet des volumes du kilomètre cube au millimètre cube (21 colonnes de chiffres).",
    columns: [
      { label: "km³", span: 3 }, { label: "hm³", span: 3 }, { label: "dam³", span: 3 },
      { label: "m³", span: 3 }, { label: "dm³", span: 3 }, { label: "cm³", span: 3 },
      { label: "mm³", span: 3 },
    ],
    baseLabel: "m³",
    example: { caption: "Exemple : 2,5 m³ = 2 500 dm³", digits: "2500", endCol: 14 },
    note: "1 m³ = 1 000 dm³ · 1 dm³ = 1 000 cm³ · 1 dm³ = 1 L · 1 m³ = 1 000 L (1 kL)",
  },

  /* ── DURÉES ── */
  {
    id: "durees",
    group: "Durées",
    variant: "CE1 → CM2 · équivalences (s, min, h, j…)",
    level: "CE1, CE2, CM1, CM2",
    desc: "Les durées ne se convertissent PAS dans un tableau à colonnes (1 h = 60 min, pas 100 !) — on les convertit par calculs successifs.",
    pairs: [
      ["1 seconde (s)", "unité de base des durées"],
      ["1 minute (min)", "60 s"],
      ["1 heure (h)", "60 min = 3 600 s"],
      ["1 jour (j)", "24 h"],
      ["1 semaine", "7 jours"],
      ["1 mois", "28, 29, 30 ou 31 jours"],
      ["1 trimestre", "3 mois"],
      ["1 année", "12 mois = 365 ou 366 jours (année bissextile)"],
    ],
    pairHeader: ["Unité de durée", "Équivalence"],
    note: "Attention : les durées ne se convertissent pas comme les longueurs — 1 h = 60 min (et non 100). Exemple : 2 h 30 min = 2 × 60 + 30 = 150 min.",
  },

  /* ── MONNAIE ── */
  {
    id: "monnaie",
    group: "Monnaie",
    variant: "CE1 → CM2 · euros et centimes",
    level: "CE1, CE2, CM1, CM2",
    desc: "La virgule des euros : le chiffre des euros et les deux chiffres des centimes (1 € = 100 centimes).",
    columns: [
      { label: "€" }, { label: "centimes", span: 2 },
    ],
    baseLabel: "€",
    example: { caption: "Exemple : 2,45 € = 245 centimes", digits: "245", endCol: 2 },
    note: "1 € = 100 centimes · 1 centime = 0,01 €",
  },

  /* ── CORRESPONDANCES ENTRE GRANDEURS ── */
  {
    id: "correspondances",
    group: "Correspondances",
    variant: "CE2 → CM2 · tableau récapitulatif (toutes grandeurs)",
    level: "CE2, CM1, CM2",
    desc: "Toutes les correspondances ENTRE les tableaux : capacités ↔ volumes, masses ↔ capacités (le litre d'eau), tonne/quintal, hectare/are, durées, monnaie — plus la méthode de conversion.",
    pairs: [
      ["Longueurs", "1 km = 1 000 m · 1 m = 100 cm = 1 000 mm · 1 dm = 10 cm"],
      ["Masses", "1 t = 1 000 kg · 1 q = 100 kg · 1 t = 10 q · 1 kg = 1 000 g · 1 g = 1 000 mg"],
      ["Capacités", "1 L = 10 dL = 100 cL = 1 000 mL · 1 hL = 100 L · 1 kL = 1 000 L"],
      ["Capacités ↔ Volumes", "1 L = 1 dm³ · 1 mL = 1 cm³ · 1 m³ = 1 000 L = 1 kL"],
      ["Masses ↔ Capacités (eau)", "1 L d'eau pèse environ 1 kg · 1 mL d'eau pèse environ 1 g"],
      ["Aires", "1 m² = 100 dm² = 10 000 cm² · 1 dam² = 100 m² · 1 ha = 100 a = 10 000 m² · 1 a = 100 m²"],
      ["Volumes", "1 m³ = 1 000 dm³ · 1 dm³ = 1 000 cm³"],
      ["Durées", "1 min = 60 s · 1 h = 60 min · 1 j = 24 h · 1 semaine = 7 jours · 1 année = 365 ou 366 jours"],
      ["Monnaie", "1 € = 100 centimes"],
    ],
    pairHeader: ["Grandeur", "Équivalences utiles"],
    note: METHOD,
  },
];

/** Définitions d'un groupe donné. */
export function convDefsByGroup(group: ConvGroup): ConvDef[] {
  return CONV_DEFS.filter((d) => d.group === group);
}

/** Définition par identifiant. */
export function convDefById(id: string): ConvDef | undefined {
  return CONV_DEFS.find((d) => d.id === id);
}

/* ════════════════════════ CONSTRUCTION DU HTML ════════════════════════ */

export interface BuildConversionOptions {
  /** Rangées vides sous l'en-tête (tableaux à colonnes). */
  rows?: number;
  /** Poser l'exemple chiffré dans la première rangée. */
  showExample?: boolean;
  /** Inclure les équivalences + la méthode sous le tableau. */
  showNote?: boolean;
}

const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Index de la 1re sous-colonne de chaque unité + nb total de sous-colonnes. */
function columnLayout(columns: ConvCol[]): { starts: number[]; total: number } {
  const starts: number[] = [];
  let c = 0;
  for (const col of columns) {
    starts.push(c);
    c += col.span && col.span > 0 ? col.span : 1;
  }
  return { starts, total: c };
}

/**
 * Construit le HTML du tableau de conversion (table inline + légendes).
 * Le rendu est identique à l'écran et dans les exports PDF.
 */
export function buildConversionHtml(def: ConvDef, opts: BuildConversionOptions = {}): string {
  const rows = Math.max(1, Math.min(8, opts.rows ?? 2));
  const showExample = opts.showExample !== false && !!def.example;
  const showNote = opts.showNote !== false && !!def.note;

  /* ── Table d'équivalences (Durées, Correspondances) ── */
  if (def.pairs) {
    const [h1, h2] = def.pairHeader || ["Unité", "Équivalence"];
    const trs = def.pairs.map(
      ([a, b]) =>
        `<tr><td style="${TD_FIRSTCOL}text-align:left;">${esc(a)}</td><td style="${TD}text-align:left;">${esc(b)}</td></tr>`,
    );
    const head = `<tr><td style="${TD_HEAD}">${esc(h1)}</td><td style="${TD_HEAD}">${esc(h2)}</td></tr>`;
    let html = `<table class="ah-table" contenteditable="false" data-table="conversion-eq" data-conv="${esc(def.id)}" style="${TABLE_STYLE}">${head}${trs.join("")}</table>`;
    if (showNote && def.note) {
      html += `<p style="${CAPTION}">${esc(def.note)}</p>`;
    }
    return html + `<p>&nbsp;</p>`;
  }

  /* ── Tableau à colonnes de chiffres ── */
  const columns = def.columns || [];
  const { starts, total } = columnLayout(columns);

  // En-tête : une cellule par unité, colspan = span ; unité de base surlignée.
  const head = `<tr>${columns
    .map((col) => {
      const span = col.span && col.span > 0 ? col.span : 1;
      const isBase = def.baseLabel && col.label === def.baseLabel;
      const style = isBase ? TD_HEAD_BASE : TD_HEAD;
      return `<td colspan="${span}" style="${style}${total > 14 ? "padding:4px 3px;font-size:10.5px;" : ""}">${esc(col.label)}</td>`;
    })
    .join("")}</tr>`;

  // Exemple : chiffres posés en partant de endCol vers la gauche.
  const ex = def.example;
  const digitAt = (colIdx: number, rowIdx: number): string => {
    if (!showExample || !ex || rowIdx !== 0) return "";
    const start = ex.endCol - (ex.digits.length - 1);
    if (colIdx < start || colIdx > ex.endCol) return "";
    return ex.digits[colIdx - start] ?? "";
  };

  const cellFont = total > 14 ? "font-size:10.5px;min-width:18px;" : total > 10 ? "font-size:11.5px;min-width:24px;" : "";
  const body: string[] = [];
  for (let r = 0; r < rows; r++) {
    const tds: string[] = [];
    for (let c = 0; c < total; c++) {
      const isUnitStart = starts.includes(c);
      // Séparation forte entre unités, fine entre sous-colonnes d'une même unité.
      const leftBorder = isUnitStart ? "border-left:2px solid #64748b;" : "border-left:1px solid #e2e8f0;";
      const digit = digitAt(c, r);
      const boldDigit = r === 0 && digit ? "font-weight:700;color:#1e40af;" : "";
      tds.push(`<td style="${TD}${leftBorder}${cellFont}height:26px;${boldDigit}">${esc(digit)}</td>`);
    }
    body.push(`<tr>${tds.join("")}</tr>`);
  }

  let html =
    `<table class="ah-table" contenteditable="false" data-table="conversion" data-conv="${esc(def.id)}" style="${TABLE_STYLE}${total > 14 ? "font-size:11px;" : ""}">${head}${body.join("")}</table>`;

  if (showExample && ex) {
    html += `<p style="${CAPTION}">${esc(ex.caption)}</p>`;
  }
  if (showNote && def.note) {
    html += `<p style="${CAPTION}">${esc(def.note)}</p>`;
    if (def.group !== "Correspondances" && def.id !== "durees") {
      html += `<p style="${CAPTION}">${esc(METHOD)}</p>`;
    }
  }
  return html + `<p>&nbsp;</p>`;
}
