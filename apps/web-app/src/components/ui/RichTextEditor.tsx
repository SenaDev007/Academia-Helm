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
 * Utilise contentEditable (pas de dépendance externe).
 * Le contenu est stocké en HTML.
 * ============================================================================
 */

import { useRef, useEffect, useCallback, useState } from "react";
import {
  Bold, Italic, Underline, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Image as ImageIcon, DraftingCompass, Sigma, Shapes, LineChart, Table2,
} from "lucide-react";
import { ImageLibraryDialog } from "@/components/pedagogy/media/ImageLibraryDialog";
import { DiagramEditorDialog } from "@/components/pedagogy/media/DiagramEditorDialog";
import { MathPanel } from "@/components/pedagogy/media/MathPanel";
import { FigureLibraryDialog } from "@/components/pedagogy/media/FigureLibraryDialog";
import { GraphChartDialog } from "@/components/pedagogy/media/GraphChartDialog";
import { TableDialog } from "@/components/pedagogy/media/TableDialog";

/** Commandes suivies pour l'état actif (boutons « enfoncés »). */
const TRACKED_COMMANDS = [
  'bold', 'italic', 'underline',
  'insertUnorderedList', 'insertOrderedList',
  'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull',
] as const;

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
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

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
    onChange(el.innerHTML);
  }, [onChange]);

  // Raccourcis clavier
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // ⭐ V5 — le parent peut intercepter (Enter = envoyer, navigation mentions…)
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (disabled) return;
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
  }, [disabled, exec, onKeyDown, refreshActiveStates]);

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
    <div className="w-full border-0">
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
                title="Insérer une image (bibliothèque réaliste, appareil, URL)"
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
        data-placeholder={placeholder}
        className={cn(
          "w-full px-2 py-1 text-xs text-slate-700 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-blue-50/30 overflow-y-auto",
          editorClassName,
          disabled && "bg-slate-50"
        )}
        style={maxHeight !== "none" ? { minHeight, maxHeight } : { minHeight }}
        suppressContentEditableWarning
      />

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
        </>
      )}
    </div>
  );
}

// ⭐ Default export pour compatibilité avec le module RH (RecruitmentWorkspace)
// qui utilise `import RichTextEditor from '...'` (default import)
export default RichTextEditor;
