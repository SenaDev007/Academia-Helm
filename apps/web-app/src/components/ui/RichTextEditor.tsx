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
 * ⭐ V9 — Lignes calligraphiques (prop enableMedia) : modèles script/cursive.
 *
 * ⭐ V10 (2026-09-21 — retour utilisateur « retirer une insertion ») :
 *   QUEL QUE SOIT le type d'insertion (image, figure, dessin, graphique,
 *   tableau, maths, lignes calligraphiques), il est désormais possible de
 *   la RETIRER :
 *   - survol d'une insertion → contour pointillé (affordance)
 *   - clic sur une insertion → sélectionnée ENTIÈREMENT (surlignage bleu)
 *     + pastille flottante « Retirer l'insertion » (corbeille rouge)
 *   - suppression via la pastille, la touche Suppr ou Retour arrière
 *     (l'élément est retiré d'un seul bloc + nettoyage du &nbsp; et du
 *     paragraphe vide insérés avec lui, onChange propagé → save/autosave)
 *   - fonctionne AUSSI sur les insertions déjà enregistrées (sélecteurs de
 *     classes communs .ah-fig / .ah-table / .ah-op / .ah-frac / .ah-math /
 *     .calli-lines / img / svg), pas seulement les nouvelles
 *   - actif UNIQUEMENT en mode média + édition (les fiches, cahier journal,
 *     épreuves) — chat / RH / CMS strictement inchangés (enableMedia=false)
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
} from "lucide-react";
import { ImageLibraryDialog } from "@/components/pedagogy/media/ImageLibraryDialog";
import { DiagramEditorDialog } from "@/components/pedagogy/media/DiagramEditorDialog";
import { MathPanel } from "@/components/pedagogy/media/MathPanel";
import { FigureLibraryDialog } from "@/components/pedagogy/media/FigureLibraryDialog";
import { GraphChartDialog } from "@/components/pedagogy/media/GraphChartDialog";
import { TableDialog } from "@/components/pedagogy/media/TableDialog";
import { CalligraphyDialog } from "@/components/pedagogy/media/CalligraphyDialog";

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
  //    pastille ou Suppr/Retour arrière). chip : position de la pastille
  //    flottante « Retirer l'insertion » (relative au wrapper de l'éditeur).
  //    hoverElRef : insertion survolée (contour pointillé = affordance).
  const wrapRef = useRef<HTMLDivElement>(null);
  const mediaElRef = useRef<HTMLElement | null>(null);
  const hoverElRef = useRef<HTMLElement | null>(null);
  const [chip, setChip] = useState<{ top: number; left: number } | null>(null);

  /** ⭐ V10 — Sérialise le HTML SANS la classe de survol .ah-media-hover :
   *    contour pointillé = pur affichage écran, il ne doit JAMAIS être
   *    persisté en base (sinon il réapparaîtrait en consultation et en
   *    export PDF). Appelé par CHAQUE propagation onChange. */
  const serializeClean = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return "";
    if (editor.querySelector(".ah-media-hover")) {
      editor.querySelectorAll(".ah-media-hover").forEach((el) => el.classList.remove("ah-media-hover"));
      hoverElRef.current = null;
    }
    return editor.innerHTML;
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
    //    sélection media + masquer la pastille.
    if (mediaElRef.current && !mediaElRef.current.isConnected) {
      mediaElRef.current = null;
      setChip(null);
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
        mediaElRef.current = null;
        setChip(null);
      }
    }
    const next: Record<string, boolean> = {};
    if (inside) {
      for (const cmd of TRACKED_COMMANDS) {
        try { next[cmd] = document.queryCommandState(cmd); } catch { next[cmd] = false; }
      }
    }
    // Comparaison pour éviter les re-renders inutiles
    setActiveCmds((prev) => {
      const changed = TRACKED_COMMANDS.some((cmd) => (prev[cmd] || false) !== (next[cmd] || false));
      return changed ? next : prev;
    });
  }, [disabled]);

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
   *    Restaure la sélection, puis insertHTML + propagation onChange.
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
      const ok = document.execCommand("insertHTML", false, html);
      if (!ok) throw new Error("insertHTML refusé");
    } catch {
      // Fallback : ajout à la fin (certains navigateurs/nested contenteditable)
      el.insertAdjacentHTML("beforeend", html);
    }
    // Re-sauvegarde la sélection post-insertion + propagation
    if (sel && sel.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    isInternalChange.current = true;
    onChange(serializeClean());
  }, [onChange, serializeClean]);

  // ═══════════════════════════════════════════════════════════════════
  // ⭐ V10 — RETRAIT DES INSERTIONS (quel que soit le type)
  // ═══════════════════════════════════════════════════════════════════

  /** Oublie la sélection media courante + masque la pastille. */
  const clearMediaSelection = useCallback(() => {
    mediaElRef.current = null;
    setChip(null);
  }, []);

  /** Sélectionne l'insertion ENTIÈRE (surlignage natif bleu) et positionne
   *  la pastille « Retirer l'insertion » au-dessus (ou en dessous si elle
   *  dépasserait le haut de l'éditeur). */
  const selectMedia = useCallback((el: HTMLElement) => {
    const editor = editorRef.current;
    if (!editor || !editor.contains(el)) return;
    mediaElRef.current = el;
    // Sélection visible = l'élément entier → Suppr/Retour arrière le
    // retirent d'un bloc (comportement natif) et la frappe le remplace.
    try {
      const sel = window.getSelection();
      const rng = document.createRange();
      rng.selectNode(el);
      if (sel) { sel.removeAllRanges(); sel.addRange(rng); }
    } catch { /* sélection impossible → la pastille reste utilisable */ }
    // Position de la pastille (relative au wrapper, position:relative)
    const wrap = wrapRef.current;
    if (wrap) {
      const wr = wrap.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      let top = r.top - wr.top - 30;
      if (top < 0) top = Math.min(r.bottom - wr.top + 4, Math.max(0, wr.height - 26));
      const left = Math.min(
        Math.max(r.left - wr.left, 4),
        Math.max(4, wr.width - 160),
      );
      setChip({ top, left });
    } else {
      setChip({ top: 0, left: 0 });
    }
  }, []);

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

  /** Clic dans la zone éditable : sur une insertion → sélection entière +
   *  pastille ; ailleurs → comportement normal (curseur) + pastille masquée. */
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    if (disabled || !enableMedia) return;
    const el = findMediaElement(e.target, editorRef.current);
    if (!el) { clearMediaSelection(); return; }
    e.preventDefault();
    selectMedia(el);
  }, [disabled, enableMedia, clearMediaSelection, selectMedia]);

  /** Survol : contour pointillé sur l'insertion (affordance « cliquer pour
   *  retirer »). Résolution identique au clic — idempotent, sans timer. */
  const handleEditorMouseMove = useCallback((e: React.MouseEvent) => {
    if (disabled || !enableMedia) return;
    const el = findMediaElement(e.target, editorRef.current);
    if (hoverElRef.current && hoverElRef.current !== el) {
      hoverElRef.current.classList.remove("ah-media-hover");
      if (!el) hoverElRef.current = null;
    }
    if (el && hoverElRef.current !== el) {
      hoverElRef.current = el;
      el.classList.add("ah-media-hover");
    }
  }, [disabled, enableMedia]);

  /** Quitte la zone éditable → retire le contour de survol. */
  const handleEditorMouseLeave = useCallback(() => {
    if (hoverElRef.current) {
      hoverElRef.current.classList.remove("ah-media-hover");
      hoverElRef.current = null;
    }
  }, []);

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

  // Raccourcis clavier
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // ⭐ V5 — le parent peut intercepter (Enter = envoyer, navigation mentions…)
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (disabled) return;
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
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
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
  }, [disabled, exec, onKeyDown, refreshActiveStates, enableMedia, removeSelectedMedia, clearMediaSelection]);

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
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec('bold'); }}
            className={btn('bold')}
            title="Gras (Ctrl+B)"
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
        data-placeholder={placeholder}
        className={cn(
          "w-full px-2 py-1 text-xs text-slate-700 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-blue-50/30 overflow-y-auto",
          editorClassName,
          disabled && "bg-slate-50"
        )}
        style={maxHeight !== "none" ? { minHeight, maxHeight } : { minHeight }}
        suppressContentEditableWarning
      />

      {/* ⭐ V10 — Pastille flottante « Retirer l'insertion » : visible dès
          qu'une insertion (image, figure, dessin, graphique, tableau, maths,
          calligraphie…) est sélectionnée par un clic. Positionnée dans le
          wrapper (position:relative) → jamais rognée par l'overflow de la
          zone éditable. */}
      {enableMedia && !disabled && chip && (
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); }}
          onClick={(e) => { e.stopPropagation(); removeSelectedMedia(); }}
          className="absolute z-40 flex items-center gap-1 px-2 py-1 rounded-md bg-red-600 text-white text-[11px] font-semibold shadow-lg hover:bg-red-700 active:bg-red-800 transition-colors whitespace-nowrap"
          style={{ top: chip.top, left: chip.left }}
          title="Retirer cette insertion (ou touche Suppr / Retour arrière)"
        >
          <Trash2 className="h-3 w-3" />
          Retirer l&apos;insertion
        </button>
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
        </>
      )}
    </div>
  );
}

// ⭐ Default export pour compatibilité avec le module RH (RecruitmentWorkspace)
// qui utilise `import RichTextEditor from '...'` (default import)
export default RichTextEditor;
