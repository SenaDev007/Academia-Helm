"use client";

/**
 * ============================================================================
 * RICH TEXT EDITOR — Éditeur de texte riche léger pour le Cahier Journal
 * ============================================================================
 *
 * Permet de mettre en forme le texte dans les cellules du cahier journal :
 *   - Gras (Ctrl+B)
 *   - Italique (Ctrl+I)
 *   - Souligné (Ctrl+U)
 *   - Alignement (gauche / centré / droite / justifié)
 *   - Puces (liste à puces)
 *   - Liste numérotée
 *
 * ⭐ 2026-09-19 (retour promoteur) — ÉTAT ACTIF des boutons : le bouton
 *   correspondant à une mise en forme ACTIVE sur la sélection courante
 *   (gras, italique, souligné, listes, alignement) est visuellement
 *   « enfoncé » (fond bleu) — l'utilisateur voit immédiatement ce qui est
 *   activé / désactivé. Implémenté via document.queryCommandState(),
 *   rafraîchi sur selectionchange / keyup / mouseup / focus / input.
 *
 * ⭐ V7 — MODE MÉDIA (fiches pédagogiques) : prop `enableMedia`
 *   Ajoute 3 boutons dans la barre d'outils :
 *   - 🖼 Image    → bibliothèque d'illustrations pédagogiques (packs SVG :
 *                  anatomie, biologie, géologie, maths, physique), import
 *                  depuis l'appareil (tenant-media), images de l'école, URL
 *   - ∆ Diagramme → éditeur de figures géométriques (cercle, triangle,
 *                  rectangle, angle, texte, main levée + préréglages)
 *   - Σ Maths     → symboles mathématiques, opérations posées (addition,
 *                  soustraction, multiplication, division euclidienne),
 *                  fractions, puissances/indices
 *   L'insertion se fait À LA POSITION DU CURSEUR (sauvegarde/restauration de
 *   la sélection), en SVG inline → rendu écran + export PDF identiques.
 *
 * ⭐ V12 (2026-09-22) — Lignes calligraphiques standard (ligne principale +
 *   3 interlignes, lettres posées sur la ligne) + polices scolaires
 *   Playwrite FR (Moderne/Trad) + bibliothèque d'images 2D tracés.
 *
 * ⭐ V13 (2026-09-22 — retour utilisateur « organiser l'interface de travail
 *   comme dans Microsoft Word ») : OUTILS WORD SUR LES INSERTIONS + TEXTE.
 *   A. Insertions (images, figures, dessins, graphiques, tableaux, maths,
 *      calligraphie) :
 *      - REDIMENSIONNER : poignées aux 4 coins (glisser) + boutons ± et
 *        pourcentage dans la barre d'objet ; l'inline SVG suit la largeur
 *        du wrapper (viewBox → ratio préservé) ; les opérations posées
 *        (ah-op, tableaux monospace) se redimensionnent par taille de
 *        police pour préserver l'alignement des chiffres
 *      - DÉPLACER / POSITIONNER : glisser-déposer l'insertion — en modes
 *        « en flux » elle se dépose à la position exacte du curseur texte
 *        sous la souris ; en modes « devant / derrière » elle se positionne
 *        librement (flèches du clavier = déplacement fin, Shift = pas 10 px)
 *      - HABILLAGE DU TEXTE (comme Word) : En ligne / À gauche / À droite /
 *        Centré / Devant le texte / Derrière le texte — persisté en styles
 *        inline (float / position:absolute) → rendu identique en lecture et
 *        dans les PDF
 *      - Barre d'objet flottante au-dessus de l'insertion sélectionnée
 *        (taille, habillage, retirer) — remplace la pastille V10 en gardant
 *        le retrait (bouton + touche Suppr)
 *   B. Texte :
 *      - POLICE : 14 polices professionnelles auto-hébergées (3 scolaires
 *        V12 + Montserrat, Playfair Display, EB Garamond, Merriweather,
 *        Dancing Script, Caveat, Patrick Hand, Lobster Two, Arimo, Tinos,
 *        Carlito) — mêmes fichiers woff2 écran et PDF (base64 api-server)
 *      - TAILLE : 8 → 72 px (menus déroulants, multi-blocs fiable via
 *        execCommand fontSize + conversion font[size] → span px)
 *      - EXPOSANT / INDICE (x², H₂O)
 *      - CASSE : MAJUSCULES / minuscules / Première lettre de phrase /
 *        Première Lettre De Chaque Mot / iNVERSER — transformation en place
 *        des nœuds texte (la mise en forme gras/italique est conservée)
 *   Zéro régression : tout est gated enableMedia pour les outils d'objet ;
 *   police/taille/casse/exposant s'appliquent à tout éditeur avec toolbar.
 *   serializeClean retire désormais aussi .ah-media-selected /
 *   .ah-media-dragging / les transform résiduels (pur écran).
 *
 * ⭐ V14 (2026-09-22 — retour utilisateur) : TABLEAUX VIVANTS + TABULATIONS
 *   + RACCOURCIS WORD FR + FORMES.
 *   A. TABLEAUX (comme Word/Excel) :
 *      - les cellules sont ÉDITABLES en permanence (plus de
 *        contenteditable=false) : clic dans une cellule = curseur, on tape,
 *      - barre « Outils du tableau » (curseur dans le tableau) : insérer/
 *        supprimer lignes et colonnes, FUSIONNER les cellules sélectionnées,
 *        SCISSION d'une cellule fusionnée, supprimer le tableau,
 *      - poignée ⬛ au survol + clic sur la bordure → sélection OBJET du
 *        tableau (barre V13 : habillage, déplacement, taille, retrait),
 *      - SÉPARATEURS DE COLONNES redimensionnables (glisser) exactement
 *        comme Word/Excel — largeur totale constante, minimum 24 px,
 *        persisté (table-layout:fixed + px), identique en lecture/PDF,
 *      - Tab / Shift+Tab : navigation de cellule en cellule ; Tab dans la
 *        dernière cellule → nouvelle ligne (comme Word).
 *   B. TABULATIONS (champs enrichis) : la touche Tab insère un TAQUET de
 *      tabulation (prochain arrêt tous les 48 px — défaut Word) — plus
 *      besoin de marteler la barre d'espace pour indenter un paragraphe.
 *      Shift+Tab retire le taquet précédent. (Le chat garde le Tab natif
 *      pour l'accessibilité clavier.)
 *   C. RACCOURCIS : Ctrl+G = Gras (convention Microsoft Word français) en
 *      plus de Ctrl+B ; Ctrl+I / Ctrl+U inchangés.
 *   D. FORMES Word (ShapesDialog) : rectangles, flèches, étoiles, légendes,
 *      symboles, blocs 3D — couleur/contour/épaisseur/taille au choix,
 *      insérées en SVG inline (span.ah-fig) → tous les outils V13/V14.
 *
 * Utilise contentEditable (pas de dépendance externe).
 * Le contenu est stocké en HTML.
 * ============================================================================
 */

import { useRef, useEffect, useCallback, useState } from "react";
import {
  Bold, Italic, Underline, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Image as ImageIcon, DraftingCompass, Sigma, Shapes, LineChart, Table2, PenLine, Trash2,
  Superscript, Subscript, CaseSensitive, Minus, Plus, Type,
  AlignStartVertical, AlignEndVertical, AlignCenterVertical, BringToFront, SendToBack,
  Rows3, Columns3, TableCellsMerge, TableCellsSplit, GripVertical, Pentagon,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
} from "lucide-react";
import { ImageLibraryDialog } from "@/components/pedagogy/media/ImageLibraryDialog";
import { DiagramEditorDialog } from "@/components/pedagogy/media/DiagramEditorDialog";
import { MathPanel } from "@/components/pedagogy/media/MathPanel";
import { FigureLibraryDialog } from "@/components/pedagogy/media/FigureLibraryDialog";
import { GraphChartDialog } from "@/components/pedagogy/media/GraphChartDialog";
import { TableDialog } from "@/components/pedagogy/media/TableDialog";
import { CalligraphyDialog } from "@/components/pedagogy/media/CalligraphyDialog";
import { ShapesDialog } from "@/components/pedagogy/media/ShapesDialog";

/** Commandes suivies pour l'état actif (boutons « enfoncés »). */
const TRACKED_COMMANDS = [
  'bold', 'italic', 'underline',
  'insertUnorderedList', 'insertOrderedList',
  'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull',
] as const;

/** ⭐ V10 — Éléments « insertion média » retirable d'un clic.
 *    Couvre TOUS les types d'insertion produits par les dialogues média :
 *    - span.ah-fig     : figures de géométrie, dessins, graphiques,
 *                        illustrations SVG des packs (contenteditable=false)
 *    - table.ah-table  : tableaux (simple, proportionnalité, Pythagore,
 *                        conversions) (contenteditable=false)
 *    - div.calli-lines : lignes calligraphiques (contenteditable=false)
 *    - span.ah-op      : opérations posées (addition, soustraction,
 *                        multiplication, division euclidienne)
 *    - span.ah-frac    : fractions empilées
 *    - span.ah-math    : symboles mathématiques
 *    - sup.ah-sup / sub.ah-sub : puissances et indices
 *    - img             : photos réalistes / images URL / images de l'école
 *    - svg             : tout SVG inline non enveloppé (anciennes insertions)
 *    Les sélecteurs fonctionnent sur le contenu DÉJÀ ENREGISTRÉ (mêmes
 *    classes depuis la V7) — pas seulement les nouvelles insertions. */
const MEDIA_SELECTOR = [
  "span.ah-fig", "span.ah-op", "span.ah-frac", "span.ah-math",
  "sup.ah-sup", "sub.ah-sub",
  "table.ah-table", "div.calli-lines",
  "img", "svg",
].join(", ");

/** ⭐ V13 — Insertions REDIMENSIONNABLES (poignées + boutons ±) :
 *    tout sauf les éléments purement textuels insérés par le panneau Maths
 *    (fractions, symboles, exposants/indices) qui vivent dans le flux du
 *    texte. Les opérations posées (span.ah-op) sont incluses : elles se
 *    redimensionnent par TAILLE DE POLICE (l'alignement monospace des
 *    chiffres reste parfait, impossible par la largeur d'un tableau). */
const RESIZABLE_SELECTOR = [
  "span.ah-fig", "span.ah-op", "table.ah-table", "div.calli-lines",
  "img", "svg",
].join(", ");

/** ⭐ V13 — Modes d'habillage du texte (comme Microsoft Word :
 *    « En ligne », « À gauche », « À droite », « Centré »,
 *    « Devant le texte », « Derrière le texte »). */
type WrapMode = "inline" | "left" | "right" | "center" | "front" | "back";

/** ⭐ V13 — Polices professionnelles du menu « Police » (auto-hébergées,
 *    /public/fonts, sous-ensemble latin ; MÊMES fichiers embarqués base64
 *    dans les templates PDF → rendu écran/PDF identique). */
const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "Police par défaut", value: "" },
  { label: "Playwrite FR Moderne — cursive", value: "Playwrite FR Moderne" },
  { label: "Playwrite FR Trad — cursive", value: "Playwrite FR Trad" },
  { label: "Comic Neue — script enfantine", value: "Comic Neue" },
  { label: "Montserrat — moderne", value: "Montserrat" },
  { label: "Playfair Display — élégante", value: "Playfair Display" },
  { label: "EB Garamond — classique", value: "EB Garamond" },
  { label: "Merriweather — lecture", value: "Merriweather" },
  { label: "Dancing Script — script", value: "Dancing Script" },
  { label: "Caveat — manuscrite", value: "Caveat" },
  { label: "Patrick Hand — école", value: "Patrick Hand" },
  { label: "Lobster Two — titre", value: "Lobster Two" },
  { label: "Arimo — type Arial", value: "Arimo" },
  { label: "Tinos — type Times", value: "Tinos" },
  { label: "Carlito — type Calibri", value: "Carlito" },
];

/** ⭐ V13 — Tailles de police proposées (px) — couvre notes de bas de
 *    page (8-9), corps (10-12), intertitres (14-20), titres (24-72). */
const SIZE_OPTIONS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 56, 72];

/** ⭐ V13 — Modes de transformation de la casse (comme Word ▸ Modifier la casse). */
type CaseMode = "upper" | "lower" | "sentence" | "words" | "toggle";
const CASE_MENU: { mode: CaseMode; label: string }[] = [
  { mode: "upper", label: "MAJUSCULES" },
  { mode: "lower", label: "minuscules" },
  { mode: "sentence", label: "Première lettre de phrase" },
  { mode: "words", label: "Première Lettre De Chaque Mot" },
  { mode: "toggle", label: "iNVERSER LA CASSE" },
];

/** ⭐ V13 — Transformation de casse (accents français gérés). */
function transformCase(text: string, mode: CaseMode): string {
  switch (mode) {
    case "upper":
      return text.toUpperCase();
    case "lower":
      return text.toLowerCase();
    case "sentence":
      return text
        .toLowerCase()
        .replace(/(^|[.!?…]\s+|\n\s*)([a-zàâäéèêëîïôöùûüÿœæç])/g, (_, p: string, c: string) => p + c.toUpperCase());
    case "words":
      return text
        .toLowerCase()
        .replace(/(^|[\s'’\-])(\p{L})/gu, (_, p: string, c: string) => p + c.toUpperCase());
    case "toggle":
      return Array.from(text)
        .map((c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()))
        .join("");
  }
}

/** ⭐ V13 — Position du curseur texte sous un point (x, y) — pour déposer
 *    une insertion glissée à l'endroit exact sous la souris. Chromium :
 *    caretRangeFromPoint ; Firefox : caretPositionFromPoint. */
function caretRangeFromPointSafe(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  try {
    if (typeof doc.caretRangeFromPoint === "function") return doc.caretRangeFromPoint(x, y);
    const pos = doc.caretPositionFromPoint?.(x, y);
    if (pos) {
      const r = document.createRange();
      r.setStart(pos.offsetNode, pos.offset);
      r.collapse(true);
      return r;
    }
  } catch { /* point hors document */ }
  return null;
}

/** Résout l'élément « insertion média » englobant une cible de clic.
 *  Remonte au WRAPPER le plus externe : un clic sur le SVG interne d'une
 *  figure (span.ah-fig) ou sur la table interne d'une opération posée
 *  (span.ah-op) retire l'insertion ENTIÈRE, pas un fragment. */
function findMediaElement(target: EventTarget | null, root: HTMLElement | null): HTMLElement | null {
  if (!target || !(target instanceof Element) || !root) return null;
  let el = target.closest(MEDIA_SELECTOR) as HTMLElement | null;
  if (el && !root.contains(el)) return null;
  if (el) {
    // wrapper externe prioritaire (svg/img cliqué directement dans .ah-fig / .ah-op)
    const wrapper = el.closest("span.ah-fig, span.ah-op") as HTMLElement | null;
    if (wrapper && wrapper !== el && root.contains(wrapper)) el = wrapper;
  }
  return el;
}

/** ⭐ V10 — La sélection désigne-t-elle EXACTEMENT cet élément (insertion
 *  sélectionnée par selectNode) ? Comparaison des bornes du Range :
 *  startContainer = endContainer = parent de l'élément, offsets encadrant
 *  l'élément. ⚠️ On ne peut PAS utiliser Selection.containsNode(el, false) :
 *  Chromium renvoie false pour une sélection d'élément exacte (vérifié en
 *  navigateur) — piège documenté ici pour ne pas le réintroduire. */
function selectionWrapsElement(sel: Selection | null, el: Element | null): boolean {
  if (!sel || !el || sel.rangeCount === 0) return false;
  const rng = sel.getRangeAt(0);
  const p = el.parentNode;
  if (!p) return false;
  if (rng.startContainer !== p || rng.endContainer !== p) return false;
  const idx = Array.prototype.indexOf.call(p.childNodes, el);
  return idx >= 0 && rng.startOffset === idx && rng.endOffset === idx + 1;
}

// ═══════════════════════════════════════════════════════════════
// ⭐ V14 — OUTILS TABLEAU (helpers DOM purs, niveau module)
// ═══════════════════════════════════════════════════════════════

/** ⭐ V14 — Le clic vise-t-il une CELLULE (td/th) d'un tableau ah-table ?
 *    Un clic dans une cellule = ÉDITION (curseur natif, comportement Word),
 *    PAS une sélection d'objet : les tableaux sont désormais modifiables à
 *    tout moment après insertion. */
function isInsideTableCell(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const cell = target.closest("td,th");
  return !!cell && !!cell.closest("table.ah-table");
}

/** ⭐ V14 — Modèle de GRILLE d'un tableau (gère colSpan/rowSpan) :
 *    grid[r][c] = cellule occupant la case (r,c). */
function tableGrid(table: HTMLTableElement): (HTMLTableCellElement | null)[][] {
  const grid: (HTMLTableCellElement | null)[][] = [];
  const seen: Record<string, HTMLTableCellElement> = {};
  Array.from(table.rows).forEach((tr, r) => {
    let c = 0;
    for (const cell of Array.from(tr.cells)) {
      while (seen[`${r},${c}`]) c++;
      const rs = cell.rowSpan || 1;
      const cs = cell.colSpan || 1;
      for (let dr = 0; dr < rs; dr++) {
        for (let dc = 0; dc < cs; dc++) {
          seen[`${r + dr},${c + dc}`] = cell;
          (grid[r + dr] = grid[r + dr] || [])[c + dc] = cell;
        }
      }
      c += cs;
    }
  });
  return grid;
}

/** ⭐ V14 — Position (r,c) d'une cellule dans la grille. */
function cellGridPos(grid: (HTMLTableCellElement | null)[][], cell: HTMLTableCellElement): { r: number; c: number } | null {
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    for (let c = 0; c < row.length; c++) if (row[c] === cell) return { r, c };
  }
  return null;
}

/** ⭐ V14 — Place le curseur texte au DÉBUT d'une cellule. */
function placeCaretInCell(cell: HTMLTableCellElement) {
  try {
    const sel = window.getSelection();
    const rng = document.createRange();
    rng.selectNodeContents(cell);
    rng.collapse(true);
    if (sel) { sel.removeAllRanges(); sel.addRange(rng); }
  } catch { /* sans conséquence */ }
}

/** ⭐ V14 — Style nettoyé pour une NOUVELLE cellule créée par les outils
 *    tableau : bordures/padding/alignement conservés ; fond d'en-tête,
 *    graisse et couleur de texte retirés (la nouvelle cellule est « neutre »
 *    — l'enseignant la met en forme ensuite avec la barre d'outils). */
function cleanCellStyle(style: string): string {
  const kept = style
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && !/^(background(?:-color)?|font-weight|color|font-size|font-family)\s*:/i.test(s));
  return kept.length ? kept.join("; ") + ";" : "";
}

/** ⭐ V14 — Cellules d'un tableau intersectées par la SÉLECTION courante,
 *    si elles forment un RECTANGLE exact de la grille (condition pour la
 *    fusion, comme Word : « Fusionner les cellules » n'agit que sur une
 *    sélection rectangulaire). Retourne null sinon. */
function selectedCellsRect(
  table: HTMLTableElement,
  sel: Selection,
  editor: HTMLElement,
): { cells: HTMLTableCellElement[]; r1: number; r2: number; c1: number; c2: number } | null {
  if (sel.rangeCount === 0 || sel.isCollapsed) return null;
  const rng = sel.getRangeAt(0);
  if (!editor.contains(rng.commonAncestorContainer)) return null;
  if (!table.contains(rng.commonAncestorContainer) && !rng.intersectsNode(table)) return null;
  const grid = tableGrid(table);
  const selected = new Set<HTMLTableCellElement>();
  for (const row of grid) {
    for (const c of row) {
      if (c && !selected.has(c)) {
        try { if (rng.intersectsNode(c)) selected.add(c); } catch { /* détachée */ }
      }
    }
  }
  if (selected.size < 2) return null;
  let r1 = Infinity, r2 = -1, c1 = Infinity, c2 = -1;
  grid.forEach((row, r) => row.forEach((c, cc) => {
    if (c && selected.has(c)) {
      r1 = Math.min(r1, r); r2 = Math.max(r2, r);
      c1 = Math.min(c1, cc); c2 = Math.max(c2, cc);
    }
  }));
  for (let r = r1; r <= r2; r++) {
    for (let cc = c1; cc <= c2; cc++) {
      const c = grid[r]?.[cc];
      if (!c || !selected.has(c)) return null; // trou → pas un rectangle
    }
  }
  // chaque cellule sélectionnée doit être ENTIÈREMENT dans le rectangle
  for (const c of selected) {
    let outside = false;
    grid.forEach((row, r) => row.forEach((x, cc) => {
      if (x === c && (r < r1 || r > r2 || cc < c1 || cc > c2)) outside = true;
    }));
    if (outside) return null;
  }
  // ordre DOM (pour fusionner les contenus dans l'ordre de lecture)
  const cells: HTMLTableCellElement[] = [];
  for (const tr of Array.from(table.rows)) {
    for (const c of Array.from(tr.cells)) if (selected.has(c)) cells.push(c);
  }
  return { cells, r1, r2, c1, c2 };
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: string;
  /** ⭐ V6.2 — hauteur max de la zone éditable (« none » = illimitée). */
  maxHeight?: string;
  /** ⭐ V5 — passthrough clavier : appelé AVANT les raccourcis internes.
   *  Si le handler parent appelle e.preventDefault(), l'événement est
   *  complètement intercepté (ex : Enter = envoyer dans le chat). */
  onKeyDown?: (e: React.KeyboardEvent) => void;
  /** ⭐ V6.1 (fix « carré restreint » mobile) — masque la barre de mise en
   *  forme (gras/italique/listes). Le chat n'en a pas besoin (syntaxe
   *  markdown + raccourcis Ctrl+B/I subsistent) : la barre consommait de
   *  la HAUTEUR inutile dans le composer mobile et écrasait visuellement
   *  la zone de saisie en « carré restreint ». */
  showToolbar?: boolean;
  /** ⭐ V6.1 — classes Tailwind additionnelles pour la zone éditable
   *  (ex : taille de police spécifique au chat mobile). */
  editorClassName?: string;
  /** ⭐ V7 — active les boutons Image / Diagramme / Maths (fiches pédagogiques
   *  et champs riches du cahier journal). Faux par défaut (chat, RH…) : le
   *  composant reste inchangé pour tous les autres usages. */
  enableMedia?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "—",
  disabled = false,
  minHeight = "96px",
  maxHeight = "200px",
  onKeyDown,
  showToolbar = true,
  editorClassName = "",
  enableMedia = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);
  // ⭐ 2026-09-19 — état actif des commandes (boutons « enfoncés »)
  const [activeCmds, setActiveCmds] = useState<Record<string, boolean>>({});

  // ⭐ V7 — Sélection sauvegardée pour l'insertion d'images/diagrammes/maths
  //    à la position exacte du curseur (même après que le focus soit passé
  //    dans la boîte de dialogue).
  const savedRangeRef = useRef<Range | null>(null);

  // ⭐ V7 — Dialogues média (un seul ouvert à la fois par éditeur)
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showDiagramDialog, setShowDiagramDialog] = useState(false);
  const [showMathPanel, setShowMathPanel] = useState(false);
  // ⭐ V8 — Figures (catalogue), graphiques/diagrammes, tableaux
  const [showFigureLibrary, setShowFigureLibrary] = useState(false);
  const [showGraphChart, setShowGraphChart] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  // ⭐ V9 (2026-09-21) — Lignes calligraphiques (graphisme / écriture) :
  //    épreuves d'évaluation + fiches pédagogiques. Modèles de lettres/mots
  //    selon le style d'écriture script ou cursive.
  const [showCalligraphy, setShowCalligraphy] = useState(false);

  // ⭐ V10 (2026-09-21) — RETRAIT DES INSERTIONS.
  //    mediaElRef : insertion actuellement sélectionnée (retirable via la
  //    barre d'objet ou Suppr/Retour arrière). chip : position de la barre
  //    d'objet flottante (relative au wrapper de l'éditeur).
  //    hoverElRef : insertion survolée (contour pointillé = affordance).
  const wrapRef = useRef<HTMLDivElement>(null);
  const mediaElRef = useRef<HTMLElement | null>(null);
  const hoverElRef = useRef<HTMLElement | null>(null);
  const [chip, setChip] = useState<{ top: number; left: number } | null>(null);
  // ⭐ V13 — Garde anti-« click retargeté » : setPointerCapture (drag des
  //    insertions) RETARGET l'événement click suivant vers la zone éditable
  //    (DIV) au lieu de l'insertion — sans cette garde, handleEditorClick ne
  //    trouverait PAS le média sous le clic et EFFACERAIT la sélection (la
  //    barre d'objet n'aurait jamais survécu à un vrai clic souris). Tout
  //    click < 400 ms après un pointerup de drag est déjà traité → ignoré.
  const clickGuardRef = useRef(0);

  // ⭐ V13 — Outils Word sur l'insertion sélectionnée :
  //    mediaBox : rectangle de l'insertion (poignées de taille, coordonnées
  //    du wrapper) ; mediaWrap : mode d'habillage courant ; mediaPct :
  //    largeur relative à la zone éditable (%) ; mediaResizable : l'insertion
  //    accepte le redimensionnement (images/figures/tableaux/calligraphie/
  //    opérations posées — pas les fractions/symboles textuels).
  const [mediaBox, setMediaBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [mediaWrap, setMediaWrap] = useState<WrapMode>("inline");
  const [mediaPct, setMediaPct] = useState(100);
  const [mediaResizable, setMediaResizable] = useState(false);

  // ⭐ V13 — Police / taille inline de la sélection (affichage des menus) et
  //    menu « Modifier la casse » (fermeture au clic extérieur).
  const [activeFont, setActiveFont] = useState("");
  const [activeSize, setActiveSize] = useState("");
  const [caseMenuOpen, setCaseMenuOpen] = useState(false);
  const caseMenuRef = useRef<HTMLDivElement | null>(null);

  // ⭐ V14 — OUTILS DU TABLEAU :
  //    tableCtxRef : tableau + cellule du curseur (détection sur
  //    selectionchange — via refreshActiveStates) ; tableBar : position de
  //    la barre flottante « Outils du tableau » ; tableOps : disponibilité
  //    des opérations (fusion : sélection rectangulaire ; scission : cellule
  //    fusionnée ; locked : tableaux pédagogiques à structure fixe —
  //    conversions, Pythagore) ; tableHandle/tableHandleForRef : poignée ⬛
  //    de sélection objet au survol d'un tableau ; colHandles : séparateurs
  //    de colonnes redimensionnables (tableau sélectionné).
  const tableCtxRef = useRef<{ table: HTMLTableElement; cell: HTMLTableCellElement | null } | null>(null);
  const [tableBar, setTableBar] = useState<{ top: number; left: number } | null>(null);
  const [tableOps, setTableOps] = useState({ canMerge: false, canSplit: false, locked: false, hasCell: false });
  const tableHandleForRef = useRef<HTMLTableElement | null>(null);
  const [tableHandle, setTableHandle] = useState<{ top: number; left: number } | null>(null);
  const [colHandles, setColHandles] = useState<{ left: number; bi: number }[]>([]);
  // ⭐ V14 — dialogue FORMES Word.
  const [showShapes, setShowShapes] = useState(false);

  /** ⭐ V10/V13 — Sérialise le HTML SANS les états d'affichage écran :
   *    .ah-media-hover (survol), .ah-media-selected (sélection),
   *    .ah-media-dragging (fantôme de déplacement) et les transform
   *    résiduels (drag interrompu). Rien de tout cela ne doit être persisté
   *    en base (sinon il réapparaîtrait en consultation et en export PDF).
   *    Appelé par CHAQUE propagation onChange. */
  const serializeClean = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return "";
    if (editor.querySelector(".ah-media-hover, .ah-media-selected, .ah-media-dragging")) {
      editor.querySelectorAll(".ah-media-hover, .ah-media-selected, .ah-media-dragging").forEach((el) => {
        el.classList.remove("ah-media-hover");
        el.classList.remove("ah-media-selected");
        el.classList.remove("ah-media-dragging");
      });
      hoverElRef.current = null;
    }
    // ⭐ V13 — filet de sécurité : un style transform résiduel (glisser
    //    interrompu) ne doit jamais être sérialisé.
    editor.querySelectorAll(MEDIA_SELECTOR).forEach((el) => {
      const h = el as HTMLElement;
      if (h.style.transform) h.style.transform = "";
    });
    return editor.innerHTML;
  }, []);

  /** ⭐ V14 — Positionne (ou masque) la barre « Outils du tableau » d'après
   *    tableCtxRef. Déclarée AVANT refreshActiveStates (pattern TDZ du
   *    fichier : les helpers positionnels précèdent leurs consommateurs).
   *    Masquée quand une insertion est sélectionnée comme OBJET (mode barre
   *    d'objet V13) pour ne pas superposer deux barres. */
  const positionTableBar = useCallback(() => {
    const ctx = tableCtxRef.current;
    const wrap = wrapRef.current;
    if (!ctx || !wrap || !ctx.table.isConnected || !wrap.contains(ctx.table) || mediaElRef.current) {
      setTableBar((prev) => (prev === null ? prev : null));
      return;
    }
    const wr = wrap.getBoundingClientRect();
    const r = ctx.table.getBoundingClientRect();
    let top = r.top - wr.top - 34;
    if (top < 0) top = Math.min(r.bottom - wr.top + 4, Math.max(0, wr.height - 30));
    const left = Math.min(Math.max(r.left - wr.left, 2), Math.max(2, wr.width - 620));
    setTableBar((prev) =>
      prev && Math.abs(prev.top - top) < 2 && Math.abs(prev.left - left) < 2 ? prev : { top, left });
  }, []);

  /** ⭐ V14 — Positionne (ou masque) la poignée ⬛ de sélection objet d'un
   *    tableau (affichée au SURVOL du tableau — comme la poignée de
   *    déplacement de Word/Google Docs). */
  const updateTableHandle = useCallback((el: HTMLTableElement | null) => {
    const wrap = wrapRef.current;
    if (!el || !wrap || !el.isConnected || !wrap.contains(el) || mediaElRef.current) {
      tableHandleForRef.current = null;
      setTableHandle(null);
      return;
    }
    tableHandleForRef.current = el;
    const wr = wrap.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const top = Math.max(0, r.top - wr.top - 15);
    const left = Math.max(2, r.left - wr.left - 15);
    setTableHandle((prev) =>
      prev && Math.abs(prev.top - top) < 2 && Math.abs(prev.left - left) < 2 ? prev : { top, left });
  }, []);

  // Sync external value → editor (seulement si différent)
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || "";
      }
    }
    isInternalChange.current = false;
  }, [value]);

  // Gérer le changement
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(serializeClean());
    }
    // ⭐ V10 — si l'insertion sélectionnée a disparu (frappe après
    //    sélection = remplacement natif par le navigateur), oublier la
    //    sélection media + masquer la barre d'objet.
    if (mediaElRef.current && !mediaElRef.current.isConnected) {
      mediaElRef.current.classList.remove("ah-media-selected");
      mediaElRef.current = null;
      setChip(null);
      setMediaBox(null);
    }
  }, [onChange, serializeClean]);

  // ⭐ Rafraîchit l'état actif des boutons (queryCommandState) — seulement
  //    si la sélection / le focus est DANS cet éditeur ; sinon on remet les
  //    boutons au neutre (l'utilisateur a quitté ce champ).
  //    ⭐ V7 : sauvegarde AUSSI la sélection courante (Range) pour permettre
  //    l'insertion d'images/figures/maths à la position exacte du curseur
  //    après que le focus soit passé dans une boîte de dialogue.
  const refreshActiveStates = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || disabled) return;
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    const inside = !!sel && !!sel.anchorNode && editor.contains(sel.anchorNode);
    if (inside && sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
    // ⭐ V10 — la sélection ne désigne plus l'insertion media courante
    //    (flèches, clic ailleurs, autre champ, sélection de texte…) →
    //    masquer la pastille « Retirer l'insertion ». Inline volontaire :
    //    clearMediaSelection est déclaré plus bas (TDZ) et refs/setChip
    //    sont stables. ⚠️ selectionWrapsElement (et NON containsNode —
    //    faux négatif Chromium sur sélection d'élément exacte).
    if (mediaElRef.current) {
      if (!selectionWrapsElement(sel, mediaElRef.current)) {
        mediaElRef.current.classList.remove("ah-media-selected");
        mediaElRef.current = null;
        setChip(null);
        setMediaBox(null);
      }
    }
    const next: Record<string, boolean> = {};
    if (inside) {
      for (const cmd of TRACKED_COMMANDS) {
        try { next[cmd] = document.queryCommandState(cmd); } catch { next[cmd] = false; }
      }
    }
    // ⭐ V13 — police / taille inline de la sélection (remonte le DOM depuis
    //    l'ancre de la sélection jusqu'à la racine de l'éditeur). Seuls les
    //    styles POSÉS PAR LES MENUS sont reflétés — la police héritée du
    //    thème n'écrase pas l'affichage (« Police par défaut »).
    let font = "";
    let size = "";
    if (inside && sel && sel.anchorNode) {
      let node: HTMLElement | null =
        sel.anchorNode.nodeType === Node.ELEMENT_NODE
          ? (sel.anchorNode as HTMLElement)
          : sel.anchorNode.parentElement;
      while (node && node !== editor) {
        if (!font && node.style && node.style.fontFamily) {
          font = node.style.fontFamily.replace(/["']/g, "").split(",")[0].trim();
        }
        if (!size && node.style && node.style.fontSize) {
          size = node.style.fontSize;
        }
        node = node.parentElement;
      }
    }
    setActiveFont((prev) => (prev === font ? prev : font));
    setActiveSize((prev) => (prev === size ? prev : size));
    // ⭐ V14 — CONTEXTE TABLEAU : le curseur est-il dans une cellule d'un
    //    tableau ah-table ? → barre « Outils du tableau » + disponibilité des
    //    opérations (fusion = sélection rectangulaire, scission = cellule
    //    fusionnée, locked = tableaux pédagogiques à structure fixe).
    if (inside && sel && sel.anchorNode) {
      const anchorEl = sel.anchorNode.nodeType === Node.ELEMENT_NODE
        ? (sel.anchorNode as HTMLElement)
        : sel.anchorNode.parentElement;
      const cellEl = (anchorEl?.closest("td,th") as HTMLTableCellElement | null) || null;
      const tbl = cellEl && editor.contains(cellEl)
        ? (cellEl.closest("table.ah-table") as HTMLTableElement | null)
        : null;
      if (tbl && editor.contains(tbl)) {
        tableCtxRef.current = { table: tbl, cell: cellEl };
        positionTableBar();
        const rect = selectedCellsRect(tbl, sel, editor);
        const cs = !!cellEl && ((cellEl.colSpan || 1) > 1 || (cellEl.rowSpan || 1) > 1);
        const locked = /^(conversion|conversion-eq|pythagore)$/.test(tbl.getAttribute("data-table") || "");
        setTableOps((p) =>
          p.canMerge === !!rect && p.canSplit === cs && p.locked === locked && p.hasCell === !!cellEl
            ? p
            : { canMerge: !!rect, canSplit: cs, locked, hasCell: !!cellEl });
      } else if (tableCtxRef.current) {
        tableCtxRef.current = null;
        positionTableBar();
        setTableOps((p) => (p.canMerge || p.canSplit || p.locked || p.hasCell ? { canMerge: false, canSplit: false, locked: false, hasCell: false } : p));
      }
    } else if (tableCtxRef.current) {
      tableCtxRef.current = null;
      positionTableBar();
    }
    // Comparaison pour éviter les re-renders inutiles
    setActiveCmds((prev) => {
      const changed = TRACKED_COMMANDS.some((cmd) => (prev[cmd] || false) !== (next[cmd] || false));
      return changed ? next : prev;
    });
    // ⭐ V14 — positionTableBar est stable (deps []) : référencée ici sans
    //    risque de boucle de re-renders.
  }, [disabled, positionTableBar]);

  // ⭐ Écoute globale de changement de sélection (curseur déplacé au clavier,
  //    clic dans un autre champ, sélection à la souris…)
  useEffect(() => {
    if (disabled) return;
    const doc = typeof document !== "undefined" ? document : null;
    if (!doc) return;
    const onSelectionChange = () => refreshActiveStates();
    doc.addEventListener("selectionchange", onSelectionChange);
    return () => doc.removeEventListener("selectionchange", onSelectionChange);
  }, [disabled, refreshActiveStates]);

  // Commandes de mise en forme
  const exec = useCallback((command: string, value?: string) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    handleInput();
    refreshActiveStates();
  }, [disabled, handleInput, refreshActiveStates]);

  /**
   * ⭐ V7 — Insère du HTML à la position du curseur sauvegardée.
   *    ⭐ V13 — CRITICAL FIX : execCommand("insertHTML") est remplacé par
   *    Range.createContextualFragment + insertNode : la sanitisation
   *    Chromium de insertHTML RETIRE les attributs style des éléments SVG
   *    (contenu « étranger ») — les illustrations de la bibliothèque
   *    d'images étaient donc insérées SANS style ni dimensions → largeur
   *    calculée 0 px dans leur wrapper inline-block (shrink-to-fit) →
   *    INVISIBLES depuis la V7. Le fragment de contexte insère EXACTEMENT
   *    le HTML fourni, à la même position (curseur sauvegardé), sans
   *    altération. Fallback : ajout à la fin.
   */
  const insertHtmlAtCursor = useCallback((html: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const sel = window.getSelection();
    try {
      if (sel) {
        if (savedRangeRef.current && el.contains(savedRangeRef.current.startContainer)) {
          sel.removeAllRanges();
          sel.addRange(savedRangeRef.current);
        } else if (!sel.anchorNode || !el.contains(sel.anchorNode)) {
          // pas de sélection valide → curseur à la fin
          const rng = document.createRange();
          rng.selectNodeContents(el);
          rng.collapse(false);
          sel.removeAllRanges();
          sel.addRange(rng);
        }
      }
      let inserted = false;
      if (sel && sel.rangeCount > 0) {
        const rng = sel.getRangeAt(0);
        if (el.contains(rng.startContainer)) {
          const frag = rng.createContextualFragment(html);
          const lastNode = frag.lastChild;
          rng.insertNode(frag);
          inserted = true;
          // curseur juste après l'insertion (comportement execCommand)
          if (lastNode && sel) {
            try {
              const after = document.createRange();
              after.setStartAfter(lastNode);
              after.collapse(true);
              sel.removeAllRanges();
              sel.addRange(after);
            } catch { /* positionnement impossible → sans conséquence */ }
          }
        }
      }
      if (!inserted) throw new Error("aucune position d'insertion valide");
    } catch {
      // Fallback : ajout à la fin (certains navigateurs/nested contenteditable)
      el.insertAdjacentHTML("beforeend", html);
    }
    // Re-sauvegarde la sélection post-insertion + propagation
    if (sel && sel.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    isInternalChange.current = true;
    onChange(serializeClean());
  }, [onChange, serializeClean]);

  // ═══════════════════════════════════════════════════════════════
  // ⭐ V10/V13 — INSERTIONS : retrait + OUTILS WORD (taille, position,
  // habillage du texte) — barre d'objet flottante
  // ═════════════════════════════════════════════════════════════

  /** Oublie la sélection media courante + masque la barre d'objet. */
  const clearMediaSelection = useCallback(() => {
    if (mediaElRef.current) mediaElRef.current.classList.remove("ah-media-selected");
    mediaElRef.current = null;
    setChip(null);
    setMediaBox(null);
  }, []);

  /** ⭐ V13 — Recalcule la position de la barre d'objet + des poignées de
   *    taille d'après la position ACTUELLE de l'insertion sélectionnée
   *    (appelé à la sélection, pendant le glisser, au scroll, au resize).
   *    ⭐ V14 : rafraîchit AUSSI les overlays tableau (barre d'outils du
   *    tableau, poignée ⬛) et calcule les SÉPARATEURS DE COLONNES du
   *    tableau sélectionné (positions des frontières entre cellules de la
   *    1re ligne — les frontières DANS un colspan n'ont pas de poignée). */
  const repositionMediaUI = useCallback(() => {
    // ⭐ V14 — les overlays tableau suivent le scroll/resize/repositionnement
    positionTableBar();
    if (tableHandleForRef.current) updateTableHandle(tableHandleForRef.current);
    const el = mediaElRef.current;
    const wrap = wrapRef.current;
    if (!el || !wrap || !el.isConnected || !wrap.contains(el)) {
      setChip(null);
      setMediaBox(null);
      setColHandles((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const wr = wrap.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setMediaBox({ top: r.top - wr.top, left: r.left - wr.left, width: r.width, height: r.height });
    // Barre d'objet au-dessus de l'insertion (ou en dessous si elle
    // dépasserait le haut de l'éditeur) — largeur ~420 px, bornée au wrapper.
    let top = r.top - wr.top - 36;
    if (top < 0) top = Math.min(r.bottom - wr.top + 6, Math.max(0, wr.height - 32));
    const left = Math.min(Math.max(r.left - wr.left, 4), Math.max(4, wr.width - 430));
    setChip({ top, left });
    const editor = editorRef.current;
    if (editor) setMediaPct(Math.round((r.width / Math.max(1, editor.clientWidth)) * 100));
    // ⭐ V14 — séparateurs de colonnes (tableau sélectionné comme objet)
    if (el instanceof HTMLTableElement) {
      const grid = tableGrid(el);
      const firstRow = grid[0] || [];
      const out: { left: number; bi: number }[] = [];
      for (let c = 1; c < firstRow.length; c++) {
        const prevCell = firstRow[c - 1];
        const cell = firstRow[c];
        if (!cell || !prevCell || cell === prevCell) continue; // frontière interne d'un colspan
        const cr = cell.getBoundingClientRect();
        if (!cr.width && !cr.height) continue;
        out.push({ left: Math.round(cr.left - wr.left), bi: c });
      }
      setColHandles((prev) => {
        if (prev.length === out.length && prev.every((p, i) => Math.abs(p.left - out[i].left) < 2 && p.bi === out[i].bi)) return prev;
        return out;
      });
    } else {
      setColHandles((prev) => (prev.length === 0 ? prev : []));
    }
  }, [positionTableBar, updateTableHandle]);

  /** Sélectionne l'insertion ENTIÈRE (surlignage natif bleu + contour bleu)
   *  et positionne la barre d'objet (taille / habillage / retirer) au-dessus.
   *  ⭐ V13 : alimente AUSSI mediaWrap (mode d'habillage courant),
   *  mediaResizable (poignées oui/non) et le rectangle des poignées. */
  const selectMedia = useCallback((el: HTMLElement) => {
    const editor = editorRef.current;
    if (!editor || !editor.contains(el)) return;
    if (mediaElRef.current && mediaElRef.current !== el) {
      mediaElRef.current.classList.remove("ah-media-selected");
    }
    mediaElRef.current = el;
    el.classList.add("ah-media-selected");
    setMediaResizable(el.matches(RESIZABLE_SELECTOR));
    setMediaWrap(((el as HTMLElement).dataset?.ahWrap as WrapMode) || "inline");
    // ⭐ V14 — mode objet : la poignée ⬛ de tableau n'a plus de sens
    updateTableHandle(null);
    // Sélection visible = l'élément entier → Suppr/Retour arrière le
    // retirent d'un bloc (comportement natif) et la frappe le remplace.
    try {
      const sel = window.getSelection();
      const rng = document.createRange();
      rng.selectNode(el);
      if (sel) { sel.removeAllRanges(); sel.addRange(rng); }
    } catch { /* sélection impossible → la barre d'objet reste utilisable */ }
    repositionMediaUI();
  }, [repositionMediaUI, updateTableHandle]);

  /** Retire l'insertion sélectionnée : suppression DOM précise (el.remove()).
   *    ⚠️ PAS de document.execCommand("delete") : testé en navigateur, il
   *    SURSUPPRIME — dans Chromium, avec une sélection d'élément inline
   *    adjacente à un bloc contenteditable=false (ex : fraction suivie des
   *    lignes calligraphiques), la commande efface AUSSI le bloc voisin.
   *    Perte de contenu inacceptable → retrait DOM chirurgical + nettoyage
   *    des voisins orphelins (&nbsp; collé, paragraphe vide des tableaux).
   *    Les voisins sont capturés AVANT suppression. Propage onChange →
   *    la sauvegarde / l'autosave (10 s) persiste le retrait. */
  const removeSelectedMedia = useCallback(() => {
    const el = mediaElRef.current;
    const editor = editorRef.current;
    if (!el || !editor || !el.isConnected || !editor.contains(el)) {
      clearMediaSelection();
      return;
    }
    // ⭐ captures AVANT suppression
    const nextText = el.nextSibling;
    const nextEl = el.nextElementSibling;
    // suppression chirurgical de l'insertion entière
    el.remove();
    // nettoyage des voisins devenus orphelins :
    //    &nbsp; inséré juste après l'insertion (tous les dialogues l'ajoutent)
    if (nextText && nextText.isConnected &&
        nextText.nodeType === Node.TEXT_NODE &&
        /^(\u00A0|\s)*$/.test(nextText.textContent || "")) {
      nextText.remove();
    }
    //    <p>&nbsp;</p> vide inséré après les tableaux.
    //    ⚠️ exclusion des insertions elles-mêmes : div.calli-lines a un
    //    textContent « vide » (lignes stylées) mais est visuellement PLEIN —
    //    sans le matches() il serait supprimé par erreur (bug vu en test).
    if (nextEl && nextEl.isConnected && /^(P|DIV)$/.test(nextEl.tagName) &&
        !nextEl.matches(MEDIA_SELECTOR) &&
        /^(\u00A0|\s)*$/.test((nextEl.textContent || "").replace(/\u00A0/g, " ")) &&
        !nextEl.querySelector("img, svg, table")) {
      nextEl.remove();
    }
    // sélection effacée (l'élément n'existe plus) + propagation
    try {
      const sel = window.getSelection();
      if (sel) sel.removeAllRanges();
    } catch { /* sans conséquence */ }
    clearMediaSelection();
    isInternalChange.current = true;
    onChange(serializeClean());
  }, [onChange, clearMediaSelection, serializeClean]);

  // ═══════════════════════════════════════════════════════════════
  // ⭐ V14 — OUTILS DU TABLEAU (comme Word) : structure, fusion,
  // colonnes, navigation clavier
  // ═══════════════════════════════════════════════════════════════

  /** ⭐ V14 — Opération de structure sur le tableau du contexte courant
   *    (barre « Outils du tableau ») : lignes/colonnes insérées ou
   *    supprimées, FUSION de la sélection rectangulaire, SCISSION d'une
   *    cellule fusionnée, suppression du tableau, sélection objet.
   *    Toute opération modifie le DOM puis propage onChange → la
   *    sauvegarde / l'autosave (10 s) persiste la structure. */
  const tableOp = useCallback((op: string) => {
    const ctx = tableCtxRef.current;
    const editor = editorRef.current;
    if (!ctx || !editor || !ctx.table.isConnected || !editor.contains(ctx.table)) return;
    const table = ctx.table;
    const cell = ctx.cell && ctx.cell.isConnected && table.contains(ctx.cell) ? ctx.cell : null;
    const commit = () => {
      isInternalChange.current = true;
      onChange(serializeClean());
      // re-détecte le contexte (les cellules ont bougé/disparu)
      setTimeout(() => refreshActiveStates(), 0);
      repositionMediaUI();
    };
    const removeTable = () => {
      const nextText = table.nextSibling;
      const nextEl = table.nextElementSibling;
      table.remove();
      if (nextText && nextText.isConnected && nextText.nodeType === Node.TEXT_NODE &&
          /^(\u00A0|\s)*$/.test(nextText.textContent || "")) nextText.remove();
      if (nextEl && nextEl.isConnected && /^(P|DIV)$/.test(nextEl.tagName) &&
          !nextEl.matches(MEDIA_SELECTOR) &&
          /^(\u00A0|\s)*$/.test((nextEl.textContent || "").replace(/\u00A0/g, " ")) &&
          !nextEl.querySelector("img, svg, table")) nextEl.remove();
      tableCtxRef.current = null;
      positionTableBar();
      setColHandles((prev) => (prev.length === 0 ? prev : []));
    };
    switch (op) {
      case "select": {
        selectMedia(table);
        return;
      }
      case "row-above":
      case "row-below": {
        const tr = (cell?.closest("tr") || table.rows[table.rows.length - 1]) as HTMLTableRowElement | null;
        if (!tr) return;
        const newTr = document.createElement("tr");
        for (const c of Array.from(tr.cells)) {
          const td = document.createElement(c.tagName === "TH" ? "th" : "td");
          td.setAttribute("style", cleanCellStyle(c.getAttribute("style") || ""));
          if ((c.colSpan || 1) > 1) td.colSpan = c.colSpan;
          td.innerHTML = "&nbsp;"; // cellule éditable (évite la collapse de ligne)
          newTr.appendChild(td);
        }
        tr.parentElement?.insertBefore(newTr, op === "row-above" ? tr : tr.nextSibling);
        commit();
        return;
      }
      case "col-left":
      case "col-right": {
        if (!cell) return;
        const idx = cell.cellIndex;
        // tableau figé par un redimensionnement de colonnes : retour au
        // layout auto le temps de l'insertion (sinon la nouvelle colonne
        // hériterait d'une largeur nulle en table-layout:fixed)
        if (table.getAttribute("data-ah-fixed") === "1") {
          table.style.tableLayout = "";
          table.removeAttribute("data-ah-fixed");
          table.style.width = "";
          Array.from(table.rows[0]?.cells || []).forEach((c) => { (c as HTMLElement).style.width = ""; });
          table.querySelectorAll("colgroup").forEach((cg) => cg.remove());
        }
        for (const tr of Array.from(table.rows)) {
          const ref = tr.cells[idx] || null;
          const src = ref || tr.cells[tr.cells.length - 1];
          if (!src) continue;
          const td = document.createElement(src.tagName === "TH" ? "th" : "td");
          td.setAttribute("style", cleanCellStyle(src.getAttribute("style") || ""));
          td.innerHTML = "&nbsp;";
          if (op === "col-left" && ref) tr.insertBefore(td, ref);
          else if (ref) tr.insertBefore(td, ref.nextSibling);
          else tr.appendChild(td);
        }
        commit();
        return;
      }
      case "row-delete": {
        const tr = cell?.closest("tr") as HTMLTableRowElement | null;
        if (!tr) return;
        tr.remove();
        if (table.rows.length === 0) removeTable();
        commit();
        return;
      }
      case "col-delete": {
        if (!cell) return;
        const idx = cell.cellIndex;
        for (const tr of Array.from(table.rows)) {
          const c = tr.cells[idx];
          if (c) c.remove();
          if (tr.cells.length === 0) tr.remove();
        }
        // colgroup simple (largeurs égales V14) : retirer la colonne miroir
        const cols = table.querySelectorAll("colgroup > col");
        const firstRowCells = table.rows[0]?.cells.length || 0;
        if (cols.length === firstRowCells + 1 && cols[idx]) cols[idx].remove();
        if (table.rows.length === 0 || firstRowCells === 0) removeTable();
        commit();
        return;
      }
      case "table-delete": {
        removeTable();
        commit();
        return;
      }
      case "merge": {
        const sel = typeof window !== "undefined" ? window.getSelection() : null;
        const rect = sel ? selectedCellsRect(table, sel, editor) : null;
        if (!rect) return;
        const { cells, r1, r2, c1, c2 } = rect;
        const grid = tableGrid(table);
        const target = grid[r1]?.[c1] || cells[0];
        // fusionne les contenus dans l'ordre de lecture (séparés d'une
        // espace si les deux fragments ne sont pas vides — comme Word)
        for (const c of cells) {
          if (c === target) continue;
          const hasContent = (c.textContent || "").replace(/\u00A0|\s/g, "");
          if (hasContent && (target.textContent || "").trim()) {
            target.appendChild(document.createTextNode(" "));
          }
          while (c.firstChild) target.appendChild(c.firstChild);
          c.remove();
        }
        target.colSpan = c2 - c1 + 1;
        target.rowSpan = r2 - r1 + 1;
        placeCaretInCell(target);
        commit();
        return;
      }
      case "split": {
        if (!cell) return;
        const grid = tableGrid(table);
        const pos = cellGridPos(grid, cell);
        if (!pos) return;
        const { r, c } = pos;
        const rs = cell.rowSpan || 1;
        const cs = cell.colSpan || 1;
        if (rs === 1 && cs === 1) return;
        cell.rowSpan = 1;
        cell.colSpan = 1;
        const style = cleanCellStyle(cell.getAttribute("style") || "");
        // recrée les cellules des cases libérées, à la position DOM exacte
        for (let dr = 0; dr < rs; dr++) {
          const tr = table.rows[r + dr];
          if (!tr) continue;
          for (let dc = 0; dc < cs; dc++) {
            if (dr === 0 && dc === 0) continue;
            const td = document.createElement(cell.tagName === "TH" ? "th" : "td");
            td.setAttribute("style", style);
            td.innerHTML = "&nbsp;";
            // insérer AVANT la cellule occupant la case (r+dr, c+dc+1)…
            let refCell: HTMLTableCellElement | null = null;
            const rowCells = grid[r + dr];
            for (let cc = c + dc + 1; rowCells && cc < rowCells.length; cc++) {
              const cand = rowCells[cc];
              if (cand && cand !== cell && cand.closest("tr") === tr) { refCell = cand; break; }
            }
            if (refCell) tr.insertBefore(td, refCell);
            else tr.appendChild(td);
          }
        }
        placeCaretInCell(cell);
        commit();
        return;
      }
    }
  }, [onChange, serializeClean, refreshActiveStates, repositionMediaUI, selectMedia, positionTableBar]);

  /** ⭐ V14 — Navigation clavier de cellule en cellule (Tab / Shift+Tab,
   *    comme Word). Tab dans la DERNIÈRE cellule → ajoute une ligne et y
   *    place le curseur (comportement Word exact). */
  const tabNavigate = useCallback((cell: HTMLTableCellElement, shift: boolean): boolean => {
    const table = cell.closest("table.ah-table") as HTMLTableElement | null;
    if (!table || !table.isConnected) return false;
    const grid = tableGrid(table);
    const ordered: HTMLTableCellElement[] = [];
    const seen = new Set<HTMLTableCellElement>();
    grid.forEach((row) => row.forEach((c) => { if (c && !seen.has(c)) { seen.add(c); ordered.push(c); } }));
    const idx = ordered.indexOf(cell);
    if (idx < 0) return false;
    if (shift) {
      placeCaretInCell(ordered[Math.max(0, idx - 1)]);
      return true;
    }
    const next = ordered[idx + 1];
    if (next) {
      placeCaretInCell(next);
      return true;
    }
    // dernière cellule → nouvelle ligne (comme Word)
    const tr = cell.closest("tr") as HTMLTableRowElement | null;
    const src = tr || table.rows[table.rows.length - 1];
    if (!src) return false;
    const newTr = document.createElement("tr");
    for (const c of Array.from(src.cells)) {
      const td = document.createElement(c.tagName === "TH" ? "th" : "td");
      td.setAttribute("style", cleanCellStyle(c.getAttribute("style") || ""));
      if ((c.colSpan || 1) > 1) td.colSpan = c.colSpan;
      td.innerHTML = "&nbsp;";
      newTr.appendChild(td);
    }
    src.parentElement?.insertBefore(newTr, src.nextSibling);
    isInternalChange.current = true;
    onChange(serializeClean());
    if (newTr.cells[0]) placeCaretInCell(newTr.cells[0]);
    return true;
  }, [onChange, serializeClean]);

  /** ⭐ V14 — Redimensionnement des COLONNES (comme Word/Excel) : glisser
   *    un séparateur entre deux colonnes. La colonne de gauche grandit de
   *    ce que celle de droite perd (largeur totale constante), minimum
   *    24 px par colonne. Persisté en px sur les cellules de la 1re ligne
   *    + table-layout:fixed → rendu identique écran / lecture / PDF. */
  const startColResize = useCallback((e: React.PointerEvent<HTMLDivElement>, bi: number) => {
    const table = mediaElRef.current as HTMLTableElement | null;
    const editor = editorRef.current;
    if (!table || !(table instanceof HTMLTableElement) || !editor || disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    try { handle.setPointerCapture(e.pointerId); } catch { /* capture refusée */ }
    const grid = tableGrid(table);
    const firstRow = grid[0] || [];
    const boundaryCell = firstRow[bi];
    const leftCell = firstRow[bi - 1];
    if (!boundaryCell || !leftCell) return;
    // largeurs courantes de CHAQUE colonne de la grille (px)
    const nCols = firstRow.length;
    const colW: number[] = new Array(nCols).fill(0);
    const counted = new Set<HTMLTableCellElement>();
    for (let c = 0; c < nCols; c++) {
      const cellEl = firstRow[c];
      if (!cellEl || counted.has(cellEl)) continue;
      counted.add(cellEl);
      const w = cellEl.getBoundingClientRect().width / (cellEl.colSpan || 1);
      for (let k = 0; k < (cellEl.colSpan || 1) && c + k < nCols; k++) colW[c + k] = w;
    }
    const boundary0 = boundaryCell.getBoundingClientRect().left;
    const leftColStart = leftCell.getBoundingClientRect().left;
    const MINW = 24;
    // applique les largeurs (px) sur les cellules de la 1re ligne ; le
    // colgroup est retiré au départ (ses % battraient les cellules en
    // priorité CSS) — sans saut visuel : mêmes largeurs, en px.
    const applyWidths = (widths: number[]) => {
      table.style.tableLayout = "fixed";
      table.setAttribute("data-ah-fixed", "1");
      table.style.width = `${Math.round(widths.reduce((s, w) => s + w, 0))}px`;
      const countedCells = new Set<HTMLTableCellElement>();
      for (let c = 0; c < firstRow.length; c++) {
        const cellEl = firstRow[c];
        if (!cellEl || countedCells.has(cellEl)) continue;
        countedCells.add(cellEl);
        const span = cellEl.colSpan || 1;
        let w = 0;
        for (let k = 0; k < span && c + k < widths.length; k++) w += widths[c + k] || 0;
        cellEl.style.width = `${Math.max(0, Math.round(w))}px`;
      }
    };
    applyWidths(colW);
    table.querySelectorAll("colgroup").forEach((cg) => cg.remove());
    const onMove = (ev: PointerEvent) => {
      const boundary = Math.max(leftColStart + MINW, ev.clientX);
      const delta = boundary - boundary0;
      let leftW = colW[bi - 1] + delta;
      let rightW = colW[bi] - delta;
      if (leftW < MINW) { leftW = MINW; rightW = colW[bi - 1] + colW[bi] - MINW; }
      if (rightW < MINW) { rightW = MINW; leftW = colW[bi - 1] + colW[bi] - MINW; }
      const widths = [...colW];
      widths[bi - 1] = leftW;
      widths[bi] = rightW;
      applyWidths(widths);
      repositionMediaUI();
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      clickGuardRef.current = Date.now(); // le click retargeté par la capture est déjà traité
      isInternalChange.current = true;
      onChange(serializeClean());
      if (mediaElRef.current) mediaElRef.current.classList.add("ah-media-selected");
      repositionMediaUI();
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }, [disabled, repositionMediaUI, onChange, serializeClean]);

  // ═══════════════════════════════════════════════════════════════
  // ⭐ V13 — OUTILS WORD : police, taille, casse, exposant/indice
  // ═══════════════════════════════════════════════════════════════

  /** Sélection courante valide DANS cet éditeur (le focus vient peut-être de
   *  passer dans la barre d'outils / un menu) ; sinon restaure la dernière
   *  sélection sauvegardée. Retourne null si aucune sélection exploitable. */
  const ensureSelection = useCallback((): Selection | null => {
    const editor = editorRef.current;
    if (!editor) return null;
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) return sel;
    if (savedRangeRef.current && editor.contains(savedRangeRef.current.startContainer)) {
      editor.focus({ preventScroll: true });
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current.cloneRange());
      }
      return sel;
    }
    return null;
  }, []);

  /** ⭐ V13 — Applique une police de caractère à la sélection (styleWithCSS
   *    + fontName → spans style="font-family:…" robustes multi-blocs ; le
   *    navigateur découpe lui-même la sélection en runs). Avec un simple
   *    curseur, la police s'applique à la frappe suivante (comportement Word).
   *    styleWithCSS est REMIS à false ensuite : les autres commandes (gras,
   *    italique…) continuent de produire <b>/<i> — zéro changement de
   *    sérialisation pour l'existant. */
  const applyFontFamily = useCallback((family: string) => {
    if (disabled) return;
    if (!ensureSelection()) return;
    try {
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand("fontName", false, family || "inherit");
      document.execCommand("styleWithCSS", false, "false");
    } catch { /* commande refusée → sans effet */ }
    isInternalChange.current = true;
    onChange(serializeClean());
    refreshActiveStates();
  }, [disabled, ensureSelection, onChange, serializeClean, refreshActiveStates]);

  /** ⭐ V13 — Applique une taille de police (px) à la sélection. execCommand
   *    fontSize ne gère que 1-7 : on pose la taille 7 (balises <font size="7">
   *    découpées nativement par le navigateur, fiable multi-blocs) puis on
   *    REMPLACE chaque balise par un span style="font-size: Npx". */
  const applyFontSize = useCallback((px: string) => {
    const editor = editorRef.current;
    if (!editor || disabled || !px) return;
    if (!ensureSelection()) return;
    try {
      document.execCommand("styleWithCSS", false, "false");
      document.execCommand("fontSize", false, "7");
    } catch { /* commande refusée → sans effet */ }
    editor.querySelectorAll("font[size]").forEach((f) => {
      const span = document.createElement("span");
      span.style.fontSize = px;
      while (f.firstChild) span.appendChild(f.firstChild);
      f.replaceWith(span);
    });
    isInternalChange.current = true;
    onChange(serializeClean());
    refreshActiveStates();
  }, [disabled, ensureSelection, onChange, serializeClean, refreshActiveStates]);

  /** ⭐ V13 — Modifie la casse de la sélection SANS toucher à la mise en
   *    forme : chaque nœud texte intersecté par la sélection est transformé
   *    en place (le gras/italique/polis de chaque fragment est conservé,
   *    exactement comme Word ▸ Modifier la casse). */
  const applyCase = useCallback((mode: CaseMode) => {
    const editor = editorRef.current;
    if (!editor || disabled) return;
    const sel = ensureSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const rng = sel.getRangeAt(0);
    if (!editor.contains(rng.commonAncestorContainer)) return;
    // nœuds texte intersectés par la sélection
    const nodes: Text[] = [];
    if (rng.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
      nodes.push(rng.commonAncestorContainer as Text);
    } else {
      const walker = document.createTreeWalker(rng.commonAncestorContainer, NodeFilter.SHOW_TEXT);
      let n: Node | null = walker.currentNode;
      if (n && n.nodeType === Node.TEXT_NODE) nodes.push(n as Text);
      while ((n = walker.nextNode())) {
        if (rng.intersectsNode(n)) nodes.push(n as Text);
      }
    }
    let touched = false;
    for (const t of nodes) {
      const full = t.data;
      let s = 0;
      let e = full.length;
      if (t === rng.startContainer) s = rng.startOffset;
      if (t === rng.endContainer) e = rng.endOffset;
      if (e <= s) continue;
      t.data = full.slice(0, s) + transformCase(full.slice(s, e), mode) + full.slice(e);
      touched = true;
    }
    if (touched) {
      isInternalChange.current = true;
      onChange(serializeClean());
    }
    refreshActiveStates();
  }, [disabled, ensureSelection, onChange, serializeClean, refreshActiveStates]);

  /** ⭐ V14 — Insère un TAQUET DE TABULATION à la position du curseur
   *    (comme Word : avance jusqu'au prochain arrêt — taquets réguliers de
   *    48 px). L'enseignant peut enfin indenter ses paragraphes sans
   *    marteler la barre d'espace. Le taquet est un span.ah-tab : supprimé
   *    d'un seul Backspace, rendu identique en lecture/PDF. (Déclaré APRÈS
   *    ensureSelection — dépendance de closure résolue au moment de l'appel.) */
  const insertTabStop = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || disabled) return;
    const sel = ensureSelection();
    if (!sel || sel.rangeCount === 0) return;
    const rng = sel.getRangeAt(0);
    if (!editor.contains(rng.startContainer)) return;
    const STEP = 48;
    let width = STEP;
    try {
      const rect = rng.getBoundingClientRect();
      const edRect = editor.getBoundingClientRect();
      if (rect && rect.width === 0 && rect.left > edRect.left) {
        width = STEP - Math.round((rect.left - edRect.left) % STEP);
        if (width < 4) width = STEP;
      }
    } catch { /* mesure impossible → taquet plein */ }
    const span = document.createElement("span");
    span.className = "ah-tab";
    span.setAttribute("data-ah-tab", "1");
    span.style.display = "inline-block";
    span.style.width = `${Math.max(6, Math.min(STEP, width))}px`;
    try { rng.insertNode(span); } catch { return; }
    try {
      const after = document.createRange();
      after.setStartAfter(span);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);
    } catch { /* sans conséquence */ }
    if (sel.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    isInternalChange.current = true;
    onChange(serializeClean());
  }, [disabled, ensureSelection, onChange, serializeClean]);

  /** ⭐ V14 — Shift+Tab : retire le taquet qui précède immédiatement le
   *    curseur (retrait d'un niveau d'indentation). ⚠️ le « frère précédent
   *    du curseur » dépend du type de nœud d'ancrage : dans un nœud TEXTE à
   *    l'offset 0 c'est previousSibling ; dans un ÉLÉMENT c'est l'enfant à
   *    anchorOffset-1 (le curseur est ENTRE les enfants) — sans cette
   *    distinction, le taquet inséré juste avant le curseur (curseur sur le
   *    parent) n'était jamais trouvé (bug vu au harnais V14, test E3). */
  const removePrevTabStop = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || disabled) return;
    const sel = ensureSelection();
    if (!sel || sel.rangeCount === 0 || !sel.anchorNode) return;
    const node = sel.anchorNode;
    const offset = sel.anchorOffset;
    let prev: Node | null = null;
    if (node.nodeType === Node.TEXT_NODE) {
      if (offset > 0) return; // du texte précède → pas de taquet adjacent
      prev = node.previousSibling;
    } else {
      prev = offset > 0 ? (node.childNodes[offset - 1] || null) : node.previousSibling;
    }
    while (prev && prev.nodeType === Node.TEXT_NODE && !(prev.textContent || "").trim()) prev = prev.previousSibling;
    if (prev && prev instanceof HTMLElement && prev.classList.contains("ah-tab")) {
      prev.remove();
      isInternalChange.current = true;
      onChange(serializeClean());
    }
  }, [disabled, ensureSelection, onChange, serializeClean]);

  // ═══════════════════════════════════════════════════════════════
  // ⭐ V13 — HABILLAGE DU TEXTE + REDIMENSIONNEMENT + DÉPLACEMENT
  // ═══════════════════════════════════════════════════════════════

  /** Bloc d'ancrage d'une insertion (habillage devant/derrière) : le plus
   *  proche ancêtre bloc — la racine éditeur est EXCLUE (elle n'est pas dans
   *  innerHTML : un position:relative posé dessus ne serait jamais sérialisé
   *  → la position se perdrait en lecture/PDF). Renvoie null quand le parent
   *  direct est la racine → setWrapMode crée un wrapper dédié div.ah-anchor
   *  (position:relative, sérialisé dans le HTML). */
  const anchorBlockFor = useCallback((el: HTMLElement): HTMLElement | null => {
    const editor = editorRef.current;
    if (!editor) return null;
    let p: HTMLElement | null = el.parentElement;
    while (p && p !== editor &&
           !/^(P|DIV|LI|UL|OL|TD|TH|SECTION|ARTICLE|BLOCKQUOTE|H[1-6]|PRE)$/.test(p.tagName)) {
      p = p.parentElement;
    }
    return p && p !== editor ? p : null;
  }, []);

  /** ⭐ V13 — Applique un mode d'habillage du texte (comme Word) à
   *  l'insertion sélectionnée. Styles inline persistés → rendu identique en
   *  consultation et dans les PDF (float / position:absolute + ancre
   *  position:relative, toutes deux dans le HTML sérialisé). */
  const setWrapMode = useCallback((mode: WrapMode) => {
    const el = mediaElRef.current;
    const editor = editorRef.current;
    if (!el || !editor || !el.isConnected || !editor.contains(el)) return;

    // retire un éventuel wrapper d'ancrage V13 (l'élément redevient en flux)
    const unwrapAnchor = () => {
      const parent = el.parentElement;
      if (parent && parent !== editor && parent.classList.contains("ah-anchor")) {
        parent.replaceWith(el);
      }
    };
    // nettoie les styles d'habillage précédents. ⚠️ le display d'ORIGINE de
    // l'insertion (inline-block des .ah-fig posé à l'insertion) est RESTAURÉ :
    // le mode « centré » l'a fait passer en block — on ne doit pas le perdre.
    const clearWrapStyles = () => {
      if (el.dataset.ahDisplay !== undefined) {
        el.style.display = el.dataset.ahDisplay || "";
        delete el.dataset.ahDisplay;
      } else {
        el.style.display = "";
      }
      el.style.float = "";
      el.style.position = "";
      el.style.left = "";
      el.style.top = "";
      el.style.zIndex = "";
      el.style.margin = "";
      el.classList.remove("ah-float-devant", "ah-float-derriere");
    };

    clearWrapStyles();

    if (mode === "inline") {
      unwrapAnchor();
    } else if (mode === "left" || mode === "right") {
      unwrapAnchor();
      el.style.float = mode;
      el.style.margin = "4px 12px";
    } else if (mode === "center") {
      unwrapAnchor();
      // mémorise le display d'origine (restauré au changement de mode)
      if (el.dataset.ahDisplay === undefined) el.dataset.ahDisplay = el.style.display || "";
      el.style.display = "block";
      el.style.marginLeft = "auto";
      el.style.marginRight = "auto";
      el.style.marginTop = "4px";
      el.style.marginBottom = "4px";
    } else {
      // « Devant le texte » / « Derrière le texte » : positionnement libre
      // ancré au bloc conteneur (le texte coule par-dessus / en dessous).
      const inlineRect = el.getBoundingClientRect(); // position avant détachement
      let anchor = anchorBlockFor(el);
      if (!anchor) {
        // parent direct = éditeur racine → wrapper dédié sérialisable
        const div = document.createElement("div");
        div.className = "ah-anchor";
        el.replaceWith(div);
        div.appendChild(el);
        anchor = div;
      }
      if (getComputedStyle(anchor).position === "static") {
        anchor.style.position = "relative";
      }
      const ar = anchor.getBoundingClientRect();
      el.style.position = "absolute";
      el.style.zIndex = mode === "front" ? "5" : "-1";
      el.classList.add(mode === "front" ? "ah-float-devant" : "ah-float-derriere");
      el.style.left = `${Math.max(0, Math.round(inlineRect.left - ar.left))}px`;
      el.style.top = `${Math.max(0, Math.round(inlineRect.top - ar.top))}px`;
    }

    el.dataset.ahWrap = mode;
    setMediaWrap(mode);
    isInternalChange.current = true;
    onChange(serializeClean());
    selectMedia(el); // APRÈS sérialisation → re-pose le contour de sélection (pur écran)
  }, [anchorBlockFor, selectMedia, onChange, serializeClean]);

  /** ⭐ V13 — Applique une largeur cible à l'insertion. SVG inline : la
   *  viewBox pil le ratio (width:100% sur le SVG interne). Opérations posées
   *  (tableaux monospace) : redimensionnement par TAILLE DE POLICE —
   *  l'alignement des chiffres reste parfait. */
  const applyMediaWidth = useCallback((el: HTMLElement, targetW: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    const maxW = Math.max(40, editor.clientWidth - 8);
    const w = Math.max(40, Math.min(targetW, maxW));
    if (el.classList.contains("ah-op")) {
      const startW = Math.max(1, el.getBoundingClientRect().width);
      const startFs = parseFloat(getComputedStyle(el).fontSize) || 15;
      const ratio = w / startW;
      const fs = Math.max(9, Math.min(44, startFs * ratio));
      el.style.fontSize = `${Math.round(fs)}px`;
    } else {
      el.style.width = `${Math.round(w)}px`;
      if (el.tagName === "IMG") el.style.height = "auto";
      el.querySelectorAll("svg").forEach((s) => {
        (s as SVGElement).style.width = "100%";
        (s as SVGElement).style.height = "auto";
      });
    }
  }, []);

  /** ⭐ V13 — Boutons ± de la barre d'objet : ±10 % de la largeur courante. */
  const stepMediaSize = useCallback((dir: 1 | -1) => {
    const el = mediaElRef.current;
    if (!el || !el.isConnected) return;
    const cur = el.getBoundingClientRect().width;
    applyMediaWidth(el, cur + dir * Math.max(12, cur * 0.1));
    isInternalChange.current = true;
    onChange(serializeClean());
    // re-pose le contour + repositionne barre/poignées (pur écran)
    el.classList.add("ah-media-selected");
    repositionMediaUI();
  }, [applyMediaWidth, repositionMediaUI, onChange, serializeClean]);

  /** ⭐ V13 — Glisser une poignée de coin pour redimensionner (pointer
   *    events + capture : le pointeur ne peut pas « échapper » à la poignée,
   *    y compris hors fenêtre). Redimensionnement proportionnel : la hauteur
   *    suit la largeur (ratio du viewBox / de l'image). */
  const startResize = useCallback((e: React.PointerEvent<HTMLDivElement>, dir: string) => {
    const el = mediaElRef.current;
    const editor = editorRef.current;
    if (!el || !editor || disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    try { handle.setPointerCapture(e.pointerId); } catch { /* capture refusée */ }
    const startX = e.clientX;
    const startW = el.getBoundingClientRect().width;
    const isOp = el.classList.contains("ah-op");
    const startFs = parseFloat(getComputedStyle(el).fontSize) || 15;
    el.classList.add("ah-media-dragging");
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const east = dir.includes("e"); // se/ne → suit la souris ; sw/nw → inverse
      const w = east ? startW + dx : startW - dx;
      if (isOp) {
        const ratio = w / Math.max(1, startW);
        const fs = Math.max(9, Math.min(44, startFs * ratio));
        el.style.fontSize = `${Math.round(fs)}px`;
      } else {
        applyMediaWidth(el, w);
      }
      repositionMediaUI();
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      el.classList.remove("ah-media-dragging");
      isInternalChange.current = true;
      onChange(serializeClean());
      el.classList.add("ah-media-selected"); // contour re-posé après sérialisation
      repositionMediaUI();
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }, [disabled, applyMediaWidth, repositionMediaUI, onChange, serializeClean]);

  /** ⭐ V13 — Glisser-déposer l'insertion pour la DÉPLACER / la POSITIONNER :
   *    - modes en flux (en ligne / gauche / droite / centré) : l'insertion se
   *      dépose à la position EXACTE du curseur texte sous la souris ;
   *    - modes devant / derrière : position libre (left/top dans le bloc
   *      d'ancrage, re-ancré sous le curseur si déposé dans un autre
   *      paragraphe — comme « Déplacer avec le texte » dans Word).
   *    Un simple clic (sans mouvement) reste un clic : sélection seule. */
  const startMediaDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || !enableMedia) return;
    const editor = editorRef.current;
    if (!editor) return;
    const el = findMediaElement(e.target, editor);
    if (!el) return; // texte normal → comportement d'édition inchangé
    // ⭐ V14 — cellule de tableau : PAS de drag (le curseur doit se placer
    //    nativement pour éditer la cellule — comportement Word). La
    //    sélection OBJET du tableau passe par la poignée ⬛, la barre
    //    « Outils du tableau » ou un clic sur la bordure extérieure.
    if (isInsideTableCell(e.target)) return;
    e.preventDefault(); // bloque le drag natif des <img> et la sélection texte
    selectMedia(el);
    const wrapMode = (el.dataset.ahWrap as WrapMode) || "inline";
    const startX = e.clientX;
    const startY = e.clientY;
    const startRect = el.getBoundingClientRect();
    const grabDx = startX - startRect.left; // décalage du point de saisie
    const grabDy = startY - startRect.top;
    let moved = false;
    const zone = e.currentTarget;
    try { zone.setPointerCapture(e.pointerId); } catch { /* capture refusée */ }
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      if (!moved) { moved = true; el.classList.add("ah-media-dragging"); }
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      repositionMediaUI();
    };
    const onUp = (ev: PointerEvent) => {
      zone.removeEventListener("pointermove", onMove);
      zone.removeEventListener("pointerup", onUp);
      zone.removeEventListener("pointercancel", onUp);
      el.classList.remove("ah-media-dragging");
      el.style.transform = "";
      // ⭐ click retargeté par la capture → ignoré par handleEditorClick
      clickGuardRef.current = Date.now();
      if (!moved) return; // simple clic → la sélection suffit (le click suivant est ignoré)
      const absolute = wrapMode === "front" || wrapMode === "back";
      if (absolute) {
        // bloc sous le point de dépôt → re-ancrage (Word « déplacer avec le texte »)
        const caret = caretRangeFromPointSafe(ev.clientX, ev.clientY);
        let node: HTMLElement | null = null;
        if (caret && caret.startContainer) {
          node = caret.startContainer.nodeType === Node.ELEMENT_NODE
            ? (caret.startContainer as HTMLElement)
            : caret.startContainer.parentElement;
        }
        const block = node
          ? (node.closest("p,div,li,td,th,section,article,blockquote,h1,h2,h3,h4,h5,h6,pre") as HTMLElement | null)
          : null;
        let anchor = anchorBlockFor(el) || editor;
        if (block && editor.contains(block) && !block.contains(el) && !block.contains?.(anchor)) {
          if (getComputedStyle(block).position === "static") block.style.position = "relative";
          const oldParent = el.parentElement;
          block.appendChild(el);
          // nettoie un éventuel wrapper d'ancrage devenu vide (ré-ancrage)
          if (oldParent && oldParent !== editor && oldParent !== block &&
              oldParent.classList.contains("ah-anchor") && !oldParent.hasChildNodes()) {
            oldParent.remove();
          }
          anchor = block;
        }
        const ar = anchor.getBoundingClientRect();
        const r2 = el.getBoundingClientRect();
        const left = Math.max(0, Math.min(ev.clientX - grabDx - ar.left, Math.max(0, ar.width - r2.width)));
        const top = Math.max(0, Math.min(ev.clientY - grabDy - ar.top, Math.max(0, ar.height - Math.min(r2.height, 20))));
        el.style.left = `${Math.round(left)}px`;
        el.style.top = `${Math.round(top)}px`;
      } else {
        // dépôt à la position du curseur texte sous la souris
        const caret = caretRangeFromPointSafe(ev.clientX, ev.clientY);
        if (caret && editor.contains(caret.startContainer)) {
          try { caret.insertNode(el); } catch { /* dépôt annulé */ }
        }
      }
      selectMedia(el);
      isInternalChange.current = true;
      onChange(serializeClean());
    };
    zone.addEventListener("pointermove", onMove);
    zone.addEventListener("pointerup", onUp);
    zone.addEventListener("pointercancel", onUp);
  }, [disabled, enableMedia, selectMedia, anchorBlockFor, repositionMediaUI, onChange, serializeClean]);

  /** Clic dans la zone éditable : sur une insertion → sélection entière +
   *  barre d'objet ; ailleurs → comportement normal (curseur) + barre
   *  masquée. ⭐ V13 — le garde clickGuardRef ignore le click RETARGETÉ par
   *  la capture pointer d'un drag/clic sur insertion (déjà traité par
   *  startMediaDrag : pointerdown = sélection, pointerup = dépôt). */
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    if (disabled || !enableMedia) return;
    if (Date.now() - clickGuardRef.current < 400) return; // click de drag — déjà traité
    // ⭐ V14 — clic dans une CELLULE de tableau : ÉDITION (curseur natif,
    //    comportement Word) — pas une sélection d'objet. La barre « Outils
    //    du tableau » apparaît d'elle-même via selectionchange.
    if (isInsideTableCell(e.target)) { clearMediaSelection(); return; }
    const el = findMediaElement(e.target, editorRef.current);
    if (!el) { clearMediaSelection(); return; }
    e.preventDefault();
    selectMedia(el);
  }, [disabled, enableMedia, clearMediaSelection, selectMedia]);

  /** Survol : contour pointillé sur l'insertion (affordance « cliquer pour
   *  retirer »). Résolution identique au clic — idempotent, sans timer.
   *  ⭐ V14 — au survol d'un TABLEAU : affiche la poignée ⬛ de sélection
   *  objet (coin supérieur gauche — comme Word / Google Docs). */
  const handleEditorMouseMove = useCallback((e: React.MouseEvent) => {
    if (disabled || !enableMedia) return;
    const el = findMediaElement(e.target, editorRef.current);
    if (hoverElRef.current && hoverElRef.current !== el) {
      hoverElRef.current.classList.remove("ah-media-hover");
      if (!el) { hoverElRef.current = null; updateTableHandle(null); }
    }
    if (el && hoverElRef.current !== el) {
      hoverElRef.current = el;
      el.classList.add("ah-media-hover");
      updateTableHandle(el instanceof HTMLTableElement ? el : null);
    }
  }, [disabled, enableMedia, updateTableHandle]);

  /** Quitte la zone éditable → retire le contour de survol (+ la poignée ⬛
   *    de tableau, sauf si le curseur est DANS un tableau — la barre
   *    « Outils du tableau » reste alors seule affichée). */
  const handleEditorMouseLeave = useCallback(() => {
    if (hoverElRef.current) {
      hoverElRef.current.classList.remove("ah-media-hover");
      hoverElRef.current = null;
    }
    if (!tableCtxRef.current) updateTableHandle(null);
  }, [updateTableHandle]);

  // ⭐ V10 — clic en dehors de CET éditeur (autre champ, autre module…) →
  //    masquer la pastille. Le clic DANS cet éditeur est géré par
  //    handleEditorClick (mousedown ici ne fait rien pour ne pas voler le
  //    focus / le curseur).
  useEffect(() => {
    if (disabled || !enableMedia) return;
    const onDocMouseDown = (ev: MouseEvent) => {
      const t = ev.target as Node | null;
      if (t && wrapRef.current && wrapRef.current.contains(t)) return;
      clearMediaSelection();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [disabled, enableMedia, clearMediaSelection]);

  // ⭐ V10 — édition désactivée / démontage → tout nettoyer (sécurité).
  useEffect(() => {
    if (disabled) { clearMediaSelection(); handleEditorMouseLeave(); }
  }, [disabled, clearMediaSelection, handleEditorMouseLeave]);

  // ⭐ V13 — repositionne la barre d'objet / les poignées quand la fenêtre
  //    est redimensionnée ou quand la zone éditable défile (l'insertion
  //    sélectionnée bouge à l'écran → l'overlay doit suivre).
  useEffect(() => {
    if (disabled || !enableMedia) return;
    const onWinResize = () => repositionMediaUI();
    window.addEventListener("resize", onWinResize);
    return () => window.removeEventListener("resize", onWinResize);
  }, [disabled, enableMedia, repositionMediaUI]);

  // ⭐ V13 — ferme le menu « Modifier la casse » au clic extérieur.
  useEffect(() => {
    if (!caseMenuOpen) return;
    const onDocDown = (ev: MouseEvent) => {
      const t = ev.target as Node | null;
      if (t && caseMenuRef.current && caseMenuRef.current.contains(t)) return;
      setCaseMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [caseMenuOpen]);

  // Raccourcis clavier
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // ⭐ V5 — le parent peut intercepter (Enter = envoyer, navigation mentions…)
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (disabled) return;
    // ⭐ V13 — insertion en habillage « devant / derrière » sélectionnée :
    //    les flèches la déplacent au pixel (Shift = pas de 10 px) —
    //    positionnement fin comme dans Word.
    if (enableMedia && mediaElRef.current && mediaElRef.current.isConnected) {
      const wm = mediaElRef.current.dataset.ahWrap as WrapMode | undefined;
      if ((wm === "front" || wm === "back") &&
          ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        const el = mediaElRef.current;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 2;
        const curL = parseInt(el.style.left || "0", 10) || 0;
        const curT = parseInt(el.style.top || "0", 10) || 0;
        if (e.key === "ArrowLeft") el.style.left = `${Math.max(0, curL - step)}px`;
        if (e.key === "ArrowRight") el.style.left = `${curL + step}px`;
        if (e.key === "ArrowUp") el.style.top = `${Math.max(0, curT - step)}px`;
        if (e.key === "ArrowDown") el.style.top = `${curT + step}px`;
        repositionMediaUI();
        isInternalChange.current = true;
        onChange(serializeClean());
        el.classList.add("ah-media-selected");
        return;
      }
    }
    // ⭐ V10 — Suppr / Retour arrière pendant qu'une insertion est
    //    sélectionnée → la retirer d'un seul bloc (déterministe, même sur
    //    les éléments contenteditable=false où le navigateur hésite).
    //    ⚠️ vérifie que la sélection désigne BIEN l'insertion (et pas une
    //    sélection de texte faite juste après — sinon Backspace supprimerait
    //    l'insertion par erreur).
    if (enableMedia && mediaElRef.current && (e.key === "Delete" || e.key === "Backspace")) {
      const sel = typeof window !== "undefined" ? window.getSelection() : null;
      if (selectionWrapsElement(sel, mediaElRef.current)) {
        e.preventDefault();
        removeSelectedMedia();
        return;
      }
      // la sélection a bougé (flèches, sélection de texte) → comportement clavier normal
      clearMediaSelection();
    }
    // ⭐ V14 — TABULATION (comme Word) : taquet de tabulation pour indenter
    //    / former les paragraphes ; DANS un tableau : navigation de cellule
    //    en cellule (Tab / Shift+Tab) + nouvelle ligne depuis la dernière
    //    cellule. Le chat (showToolbar=false) garde le Tab NATIF (sortie de
    //    champ — accessibilité clavier inchangée).
    if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey && showToolbar) {
      e.preventDefault();
      if (enableMedia) {
        const sel = typeof window !== "undefined" ? window.getSelection() : null;
        const anchorEl = sel?.anchorNode
          ? (sel.anchorNode.nodeType === Node.ELEMENT_NODE
              ? (sel.anchorNode as HTMLElement)
              : sel.anchorNode.parentElement)
          : null;
        const cell = (anchorEl?.closest("td,th") as HTMLTableCellElement | null) || null;
        if (cell && editorRef.current?.contains(cell) && cell.closest("table.ah-table")) {
          tabNavigate(cell, e.shiftKey);
          return;
        }
      }
      if (e.shiftKey) removePrevTabStop();
      else insertTabStop();
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
        case 'g': // ⭐ V14 — Ctrl+G = Gras (convention Microsoft Word français)
          e.preventDefault();
          exec('bold');
          break;
        case 'i':
          e.preventDefault();
          exec('italic');
          break;
        case 'u':
          e.preventDefault();
          exec('underline');
          break;
      }
    }
    // ⭐ état actif : les déplacements de curseur (flèches) changent la
    //    mise en forme courante → rafraîchir après le déplacement.
    setTimeout(refreshActiveStates, 0);
  }, [disabled, exec, onKeyDown, refreshActiveStates, enableMedia, showToolbar, removeSelectedMedia, clearMediaSelection, repositionMediaUI, onChange, serializeClean, tabNavigate, insertTabStop, removePrevTabStop]);

  const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(" ");

  // ⭐ Classe d'un bouton de barre d'outils : « enfoncé » (actif) quand la
  //    commande est active sur la sélection courante — sinon aspect neutre.
  const btn = (cmd: string) =>
    cn(
      "p-1 rounded transition-colors",
      activeCmds[cmd]
        ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
        : "hover:bg-slate-200 text-slate-600",
    );

  return (
    <div ref={wrapRef} className="relative w-full border-0">
      {/* Barre d'outils (masquée si disabled — ou showToolbar=false pour le
          chat : fix « carré restreint » mobile, V6.1) */}
      {!disabled && showToolbar && (
        <div className="flex items-center flex-wrap gap-0.5 border-b border-slate-200 px-1 py-0.5 bg-slate-50/50">
          {/* ⭐ V13 — POLICE DE CARACTÈRE : 14 polices professionnelles
              auto-hébergées (mêmes fichiers que les PDF). Chaque option
              s'affiche dans SA propre police (aperçu direct).
              ⭐ 2026-09-26 (fix mobile « tout est en noir ») : couleurs
              explicites claires sur les <option> + color-scheme light
              global — le popup natif reste lisible même quand l'OS du
              smartphone est en mode sombre. */}
          <select
            value={activeFont}
            onChange={(e) => { applyFontFamily(e.target.value); e.currentTarget.blur(); }}
            className="rte-tool-select h-6 mr-0.5 px-1 border border-slate-200 rounded text-[11px] text-slate-700 bg-white max-w-[128px] hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
            title="Police de caractère"
            data-touch="sm"
          >
            {FONT_OPTIONS.map((f) => (
              <option
                key={f.value || "defaut"}
                value={f.value}
                style={{
                  color: "#0f172a",
                  backgroundColor: "#ffffff",
                  fontFamily: f.value ? `"${f.value}"` : undefined,
                }}
              >
                {f.label}
              </option>
            ))}
          </select>
          {/* ⭐ V13 — TAILLE DE POLICE (8 → 72 px) : titres, sous-titres, corps.
              ⭐ 2026-09-26 — mêmes couleurs explicites (lisibilité mobile). */}
          <select
            value={activeSize}
            onChange={(e) => { applyFontSize(e.target.value); e.currentTarget.blur(); }}
            className="rte-tool-select h-6 mr-0.5 px-1 border border-slate-200 rounded text-[11px] text-slate-700 bg-white hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
            title="Taille de police (px)"
            data-touch="sm"
          >
            <option value="" style={{ color: "#0f172a", backgroundColor: "#ffffff" }}>Taille</option>
            {SIZE_OPTIONS.map((s) => (
              <option
                key={s}
                value={`${s}px`}
                style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
              >
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec('bold'); }}
            className={btn('bold')}
            title="Gras (Ctrl+B ou Ctrl+G)"
          >
            <Bold className="h-3 w-3" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec('italic'); }}
            className={btn('italic')}
            title="Italique (Ctrl+I)"
          >
            <Italic className="h-3 w-3" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec('underline'); }}
            className={btn('underline')}
            title="Souligné (Ctrl+U)"
          >
            <Underline className="h-3 w-3" />
          </button>
          {/* ⭐ V13 — EXPOSANT / INDICE (x², H₂O — comme Word). */}
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec('superscript'); }}
            className={btn('superscript')}
            title="Exposant (x²)"
          >
            <Superscript className="h-3 w-3" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec('subscript'); }}
            className={btn('subscript')}
            title="Indice (H₂O)"
          >
            <Subscript className="h-3 w-3" />
          </button>
          {/* ⭐ V13 — MODIFIER LA CASSE (comme Word ▸ Modifier la casse) :
              MAJUSCULES, minuscules, première lettre de phrase, Première
              Lettre De Chaque Mot, iNVERSER. La mise en forme (gras,
              italique, police, taille) de chaque fragment est conservée. */}
          <div className="relative" ref={caseMenuRef}>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setCaseMenuOpen((o) => !o); }}
              className={cn(
                "p-1 rounded transition-colors",
                caseMenuOpen
                  ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                  : "hover:bg-slate-200 text-slate-600",
              )}
              title="Modifier la casse (MAJUSCULES, minuscules, Première Lettre De Chaque Mot…)"
            >
              <CaseSensitive className="h-3 w-3" />
            </button>
            {caseMenuOpen && (
              <div className="absolute top-full left-0 z-50 mt-1 w-56 bg-white border border-slate-200 rounded-md shadow-lg py-1">
                {CASE_MENU.map((c) => (
                  <button
                    key={c.mode}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); applyCase(c.mode); setCaseMenuOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 hover:bg-blue-50"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* ⭐ 2026-09-19 — ALIGNEMENT DU TEXTE (gauche / centré / droite /
              justifié) : retour promoteur « il n'y a pas de moyen de pouvoir
              justifier le texte » — execCommand justify* s'applique au
              bloc / paragraphe courant. */}
          <div className="w-px h-4 bg-slate-200 mx-0.5" />
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec('justifyLeft'); }}
            className={btn('justifyLeft')}
            title="Aligner à gauche"
          >
            <AlignLeft className="h-3 w-3" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec('justifyCenter'); }}
            className={btn('justifyCenter')}
            title="Centrer"
          >
            <AlignCenter className="h-3 w-3" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec('justifyRight'); }}
            className={btn('justifyRight')}
            title="Aligner à droite"
          >
            <AlignRight className="h-3 w-3" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec('justifyFull'); }}
            className={btn('justifyFull')}
            title="Justifier le texte"
          >
            <AlignJustify className="h-3 w-3" />
          </button>
          <div className="w-px h-4 bg-slate-200 mx-0.5" />
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }}
            className={btn('insertUnorderedList')}
            title="Liste à puces"
          >
            <List className="h-3 w-3" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec('insertOrderedList'); }}
            className={btn('insertOrderedList')}
            title="Liste numérotée"
          >
            <ListOrdered className="h-3 w-3" />
          </button>
          {/* ⭐ V7/V8 — Boutons média (fiches pédagogiques + cahier journal) */}
          {enableMedia && (
            <>
              <div className="w-px h-4 bg-slate-200 mx-0.5" />
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); }}
                onClick={() => setShowImageDialog(true)}
                className="p-1 hover:bg-blue-100 rounded text-blue-600 transition-colors"
                title="Insérer une image (bibliothèque pédagogique, appareil, URL)"
              >
                <ImageIcon className="h-3 w-3" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); }}
                onClick={() => setShowFigureLibrary(true)}
                className="p-1 hover:bg-purple-100 rounded text-purple-600 transition-colors"
                title="Figures de géométrie — catalogue complet maternelle → CM2 (triangles, polygones, solides, symétrie…)"
              >
                <Shapes className="h-3 w-3" />
              </button>
              {/* ⭐ V14 — FORMES Word : rectangles, flèches, étoiles, légendes,
                  symboles, blocs 3D — couleur/contour/épaisseur/taille au
                  choix ; ensuite redimensionnables/déplaçables/habillables. */}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); }}
                onClick={() => setShowShapes(true)}
                className="p-1 hover:bg-rose-100 rounded text-rose-600 transition-colors"
                title="Formes (comme Word) : rectangles, flèches, étoiles, légendes, symboles — couleur et contour au choix"
              >
                <Pentagon className="h-3 w-3" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); }}
                onClick={() => setShowDiagramDialog(true)}
                className="p-1 hover:bg-purple-100 rounded text-purple-600 transition-colors"
                title="Dessiner une figure librement (cercle, polygone, angle, main levée…)"
              >
                <DraftingCompass className="h-3 w-3" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); }}
                onClick={() => setShowGraphChart(true)}
                className="p-1 hover:bg-teal-100 rounded text-teal-600 transition-colors"
                title="Graphiques & diagrammes : repère, proportionnalité, bâtons, circulaire, histogramme, courbe"
              >
                <LineChart className="h-3 w-3" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); }}
                onClick={() => setShowTableDialog(true)}
                className="p-1 hover:bg-indigo-100 rounded text-indigo-600 transition-colors"
                title="Tableau professionnel : simple, proportionnalité, table de Pythagore, conversions"
              >
                <Table2 className="h-3 w-3" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); }}
                onClick={() => setShowMathPanel(true)}
                className="p-1 hover:bg-indigo-100 rounded text-indigo-600 font-bold transition-colors"
                title="Symboles et opérations mathématiques"
              >
                <Sigma className="h-3 w-3" />
              </button>
              {/* ⭐ V9 (2026-09-21) — Lignes calligraphiques pour le graphisme
                  (évaluation d'écriture) : lignes seyès / cahier / simples
                  + modèles de lettres et mots (script ou cursive). */}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); }}
                onClick={() => setShowCalligraphy(true)}
                className="p-1 hover:bg-amber-100 rounded text-amber-600 transition-colors"
                title="Lignes calligraphiques (graphisme) — modèles de lettres/mots, écriture script ou cursive"
              >
                <PenLine className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Zone éditable */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={() => { handleInput(); refreshActiveStates(); }}
        onKeyDown={handleKeyDown}
        onMouseUp={() => refreshActiveStates()}
        onFocus={() => refreshActiveStates()}
        onClick={handleEditorClick}
        onMouseMove={handleEditorMouseMove}
        onMouseLeave={handleEditorMouseLeave}
        onPointerDown={startMediaDrag}
        onScroll={repositionMediaUI}
        data-placeholder={placeholder}
        className={cn(
          "w-full px-2 py-1 text-xs text-slate-700 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-blue-50/30 overflow-y-auto",
          editorClassName,
          disabled && "bg-slate-50"
        )}
        style={maxHeight !== "none" ? { minHeight, maxHeight } : { minHeight }}
        suppressContentEditableWarning
      />

      {/* ⭐ V13 — BARRE D'OBJET flottante (comme Word) : visible dès qu'une
          insertion (image, figure, dessin, graphique, tableau, opération,
          calligraphie…) est sélectionnée par un clic. Contient :
          - la taille (boutons ± et pourcentage de la largeur de la zone)
          - l'HABILLAGE DU TEXTE : En ligne / À gauche / À droite / Centré /
            Devant le texte / Derrière le texte
          - le RETRAIT (bouton historique V10 + touche Suppr)
          Positionnée dans le wrapper (position:relative) → jamais rognée
          par l'overflow de la zone éditable. */}
      {enableMedia && !disabled && chip && (
        <div
          className="absolute z-40 flex items-center flex-wrap gap-0.5 px-1 py-0.5 rounded-md bg-white/95 backdrop-blur border border-slate-200 shadow-lg"
          style={{ top: chip.top, left: chip.left, maxWidth: "max(96%, 430px)" }}
          onMouseDown={(e) => { e.preventDefault(); }}
        >
          {/* Taille */}
          {mediaResizable && (
            <>
              <button
                type="button"
                onClick={() => stepMediaSize(-1)}
                className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors"
                title="Réduire la taille de l'insertion"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="text-[10px] text-slate-500 tabular-nums px-0.5 min-w-[32px] text-center select-none">
                {mediaPct}%
              </span>
              <button
                type="button"
                onClick={() => stepMediaSize(1)}
                className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors"
                title="Agrandir la taille de l'insertion"
              >
                <Plus className="h-3 w-3" />
              </button>
              <div className="w-px h-4 bg-slate-200 mx-0.5" />
            </>
          )}
          {/* Habillage du texte (Word : « Réagencer ») */}
          {([
            { mode: "inline" as WrapMode, Icon: Type, label: "En ligne — l'insertion suit le texte" },
            { mode: "left" as WrapMode, Icon: AlignStartVertical, label: "À gauche — le texte s'habille à droite" },
            { mode: "right" as WrapMode, Icon: AlignEndVertical, label: "À droite — le texte s'habille à gauche" },
            { mode: "center" as WrapMode, Icon: AlignCenterVertical, label: "Centré sur sa propre ligne" },
            { mode: "front" as WrapMode, Icon: BringToFront, label: "Devant le texte — position libre (flèches pour ajuster)" },
            { mode: "back" as WrapMode, Icon: SendToBack, label: "Derrière le texte — position libre (flèches pour ajuster)" },
          ]).map(({ mode, Icon, label }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setWrapMode(mode)}
              className={cn(
                "p-1 rounded transition-colors",
                mediaWrap === mode
                  ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                  : "hover:bg-slate-200 text-slate-600",
              )}
              title={`Habillage : ${label}`}
            >
              <Icon className="h-3 w-3" />
            </button>
          ))}
          <div className="w-px h-4 bg-slate-200 mx-0.5" />
          {/* Retrait (V10) */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeSelectedMedia(); }}
            className="flex items-center gap-1 px-1.5 py-1 rounded text-[11px] font-semibold text-red-600 hover:bg-red-100 transition-colors whitespace-nowrap"
            title="Retirer cette insertion (ou touche Suppr / Retour arrière)"
          >
            <Trash2 className="h-3 w-3" />
            Retirer
          </button>
        </div>
      )}

      {/* ⭐ V13 — POIGNÉES DE REDIMENSIONNEMENT (4 coins) sur l'insertion
          sélectionnée redimensionnable. Rendues dans le wrapper (jamais
          dans le DOM éditable → jamais sérialisées). Glisser une poignée
          ajuste la largeur en direct ; la hauteur suit (ratio conservé). */}
      {enableMedia && !disabled && mediaBox && mediaResizable && (
        <>
          {(["nw", "ne", "sw", "se"] as const).map((dir) => (
            <div
              key={dir}
              data-dir={dir}
              className="ah-handle"
              style={{
                top: mediaBox.top + (dir === "nw" || dir === "ne" ? -5 : mediaBox.height - 5),
                left: mediaBox.left + (dir === "nw" || dir === "sw" ? -5 : mediaBox.width - 5),
              }}
              onPointerDown={(e) => startResize(e, dir)}
            />
          ))}
        </>
      )}

      {/* ⭐ V14 — POIGNÉE DE SÉLECTION DU TABLEAU (au survol) : clic →
          sélection OBJET → barre d'objet V13 (habillage, déplacement,
          taille, retrait) + séparateurs de colonnes. Coin supérieur GAUCHE
          du tableau — comme la poignée de déplacement de Word / Google
          Docs. Rendue dans le wrapper → jamais sérialisée. */}
      {enableMedia && !disabled && tableHandle && !chip && (
        <div
          className="ah-tablehandle"
          style={{ top: tableHandle.top, left: tableHandle.left }}
          title="Sélectionner le tableau — déplacer, habiller, redimensionner, retirer"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const t = tableHandleForRef.current;
            if (t) selectMedia(t);
          }}
        />
      )}

      {/* ⭐ V14 — SÉPARATEURS DE COLONNES (tableau sélectionné comme objet) :
          glisser une séparation pour ajuster la largeur de chaque colonne
          EXACTEMENT comme dans Word/Excel. La colonne de gauche grandit de
          ce que la droite perd (largeur totale constante), minimum 24 px.
          Persisté (table-layout:fixed + px) → identique en lecture/PDF. */}
      {enableMedia && !disabled && mediaBox && mediaResizable && colHandles.length > 0 && (
        <>
          {colHandles.map((h, i) => (
            <div
              key={`ah-colh-${i}`}
              className="ah-colhandle"
              style={{ top: Math.max(0, mediaBox.top - 11), left: h.left - 3 }}
              title="Glisser : ajuster la largeur des colonnes (comme Word)"
              onPointerDown={(e) => startColResize(e, h.bi)}
            />
          ))}
        </>
      )}

      {/* ⭐ V14 — BARRE « OUTILS DU TABLEAU » (curseur dans un tableau, à la
          Word) : sélectionner l'objet, insérer/supprimer lignes et colonnes,
          fusionner la sélection rectangulaire, scinder une cellule fusionnée,
          supprimer le tableau. Tableaux pédagogiques à structure FIXE
          (conversions, Pythagore) : opérations de structure masquées. */}
      {enableMedia && !disabled && tableBar && !chip && (
        <div
          className="absolute z-40 flex items-center flex-wrap gap-0.5 px-1 py-0.5 rounded-md bg-white/95 backdrop-blur border border-slate-200 shadow-lg"
          style={{ top: tableBar.top, left: tableBar.left, maxWidth: "max(96%, 640px)" }}
          onMouseDown={(e) => { e.preventDefault(); }}
        >
          <span className="hidden sm:inline text-[10px] font-bold text-slate-400 pl-1 pr-0.5 select-none">TABLEAU</span>
          <button
            type="button"
            onClick={() => tableOp("select")}
            className="p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors"
            title="Sélectionner le tableau — déplacer, habiller le texte, redimensionner, retirer"
          >
            <GripVertical className="h-3 w-3" />
          </button>
          {!tableOps.locked && (
            <>
              <div className="w-px h-4 bg-slate-200 mx-0.5" />
              <button type="button" onClick={() => tableOp("row-above")} disabled={!tableOps.hasCell}
                className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Insérer une ligne au-dessus">
                <span className="relative inline-flex items-center justify-center">
                  <Rows3 className="h-3 w-3" />
                  <ArrowUp className="absolute -top-1 -right-2 h-2 w-2 text-blue-600" />
                </span>
              </button>
              <button type="button" onClick={() => tableOp("row-below")} disabled={!tableOps.hasCell}
                className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Insérer une ligne en dessous">
                <span className="relative inline-flex items-center justify-center">
                  <Rows3 className="h-3 w-3" />
                  <ArrowDown className="absolute -top-1 -right-2 h-2 w-2 text-blue-600" />
                </span>
              </button>
              <button type="button" onClick={() => tableOp("col-left")} disabled={!tableOps.hasCell}
                className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Insérer une colonne à gauche">
                <span className="relative inline-flex items-center justify-center">
                  <Columns3 className="h-3 w-3" />
                  <ArrowLeft className="absolute -top-1 -right-2 h-2 w-2 text-blue-600" />
                </span>
              </button>
              <button type="button" onClick={() => tableOp("col-right")} disabled={!tableOps.hasCell}
                className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Insérer une colonne à droite">
                <span className="relative inline-flex items-center justify-center">
                  <Columns3 className="h-3 w-3" />
                  <ArrowRight className="absolute -top-1 -right-2 h-2 w-2 text-blue-600" />
                </span>
              </button>
              <div className="w-px h-4 bg-slate-200 mx-0.5" />
              <button type="button" onClick={() => tableOp("row-delete")} disabled={!tableOps.hasCell}
                className="p-1 rounded hover:bg-red-100 text-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Supprimer la ligne">
                <span className="relative inline-flex items-center justify-center">
                  <Rows3 className="h-3 w-3" />
                  <span className="absolute -top-1 -right-2 h-2 w-2 rounded-sm bg-red-500" />
                </span>
              </button>
              <button type="button" onClick={() => tableOp("col-delete")} disabled={!tableOps.hasCell}
                className="p-1 rounded hover:bg-red-100 text-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Supprimer la colonne">
                <span className="relative inline-flex items-center justify-center">
                  <Columns3 className="h-3 w-3" />
                  <span className="absolute -top-1 -right-2 h-2 w-2 rounded-sm bg-red-500" />
                </span>
              </button>
              <div className="w-px h-4 bg-slate-200 mx-0.5" />
              <button type="button" onClick={() => tableOp("merge")} disabled={!tableOps.canMerge}
                className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Fusionner les cellules sélectionnées (sélection rectangulaire)">
                <TableCellsMerge className="h-3 w-3" />
              </button>
              <button type="button" onClick={() => tableOp("split")} disabled={!tableOps.canSplit}
                className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Scinder la cellule fusionnée">
                <TableCellsSplit className="h-3 w-3" />
              </button>
            </>
          )}
          <div className="w-px h-4 bg-slate-200 mx-0.5" />
          <button
            type="button"
            onClick={() => tableOp("table-delete")}
            className="flex items-center gap-1 px-1.5 py-1 rounded text-[11px] font-semibold text-red-600 hover:bg-red-100 transition-colors whitespace-nowrap"
            title="Supprimer tout le tableau"
          >
            <Trash2 className="h-3 w-3" />
            <span className="hidden sm:inline">Supprimer</span>
          </button>
        </div>
      )}

      {/* ⭐ V7/V8 — Dialogues média (rendus uniquement si ouverts) */}
      {enableMedia && (
        <>
          <ImageLibraryDialog
            open={showImageDialog}
            onClose={() => setShowImageDialog(false)}
            onInsertHtml={insertHtmlAtCursor}
          />
          <FigureLibraryDialog
            open={showFigureLibrary}
            onClose={() => setShowFigureLibrary(false)}
            onInsertHtml={insertHtmlAtCursor}
          />
          <DiagramEditorDialog
            open={showDiagramDialog}
            onClose={() => setShowDiagramDialog(false)}
            onInsertHtml={insertHtmlAtCursor}
          />
          <GraphChartDialog
            open={showGraphChart}
            onClose={() => setShowGraphChart(false)}
            onInsertHtml={insertHtmlAtCursor}
          />
          <TableDialog
            open={showTableDialog}
            onClose={() => setShowTableDialog(false)}
            onInsertHtml={insertHtmlAtCursor}
          />
          <MathPanel
            open={showMathPanel}
            onClose={() => setShowMathPanel(false)}
            onInsertHtml={insertHtmlAtCursor}
          />
          <CalligraphyDialog
            open={showCalligraphy}
            onClose={() => setShowCalligraphy(false)}
            onInsertHtml={insertHtmlAtCursor}
          />
          {/* ⭐ V14 — Formes Word (rectangles, flèches, étoiles, légendes…) */}
          <ShapesDialog
            open={showShapes}
            onClose={() => setShowShapes(false)}
            onInsertHtml={insertHtmlAtCursor}
          />
        </>
      )}
    </div>
  );
}

// ⭐ Default export pour compatibilité avec le module RH (RecruitmentWorkspace)
// qui utilise `import RichTextEditor from '...'` (default import)
export default RichTextEditor;
