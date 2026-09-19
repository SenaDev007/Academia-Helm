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
 *   - Alignement : gauche / centré / droite / justifié (⭐ 2026-09-19 —
 *     retour promoteur « pas de moyen de justifier le texte »)
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
 * Utilise contentEditable (pas de dépendance externe).
 * Le contenu est stocké en HTML.
 * ============================================================================
 */

import { useRef, useEffect, useCallback, useState } from "react";
import {
  Bold, Italic, Underline, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
} from "lucide-react";

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
  /** ⭐ 2026-09-19 — hauteur max de la zone éditable. Défaut "200px"
   *  (scroll interne). Passer "none" pour une croissance AUTO du champ —
   *  utilisée par la section RETENONS des fiches de préparation, qui doit
   *  pouvoir accueillir un grand volume de texte sans zone scrollable. */
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
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);
  // ⭐ 2026-09-19 — état actif des commandes (boutons « enfoncés »)
  const [activeCmds, setActiveCmds] = useState<Record<string, boolean>>({});

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
  const refreshActiveStates = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || disabled) return;
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    const inside = !!sel && !!sel.anchorNode && editor.contains(sel.anchorNode);
    const next: Record<string, boolean> = {};
    if (inside) {
      for (const cmd of TRACKED_COMMANDS) {
        try { next[cmd] = document.queryCommandState(cmd); } catch { next[cmd] = false; }
      }
    }
    // Comparaison pour éviter les re-rendus inutiles
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
    </div>
  );
}

// ⭐ Default export pour compatibilité avec le module RH (RecruitmentWorkspace)
// qui utilise `import RichTextEditor from '...'` (default import)
export default RichTextEditor;
