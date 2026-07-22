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
 *   - Puces (liste à puces)
 *   - Liste numérotée
 *
 * Utilise contentEditable (pas de dépendance externe).
 * Le contenu est stocké en HTML.
 * ============================================================================
 */

import { useRef, useEffect, useCallback } from "react";
import { Bold, Italic, Underline, List, ListOrdered } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "—",
  disabled = false,
  minHeight = "96px",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

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

  // Commandes de mise en forme
  const exec = useCallback((command: string, value?: string) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    handleInput();
  }, [disabled, handleInput]);

  // Raccourcis clavier
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
  }, [disabled, exec]);

  const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(" ");

  return (
    <div className="w-full border-0">
      {/* Barre d'outils (masquée si disabled) */}
      {!disabled && (
        <div className="flex items-center gap-0.5 border-b border-slate-200 px-1 py-0.5 bg-slate-50/50">
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec('bold'); }}
            className="p-1 hover:bg-slate-200 rounded text-slate-600"
            title="Gras (Ctrl+B)"
          >
            <Bold className="h-3 w-3" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec('italic'); }}
            className="p-1 hover:bg-slate-200 rounded text-slate-600"
            title="Italique (Ctrl+I)"
          >
            <Italic className="h-3 w-3" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec('underline'); }}
            className="p-1 hover:bg-slate-200 rounded text-slate-600"
            title="Souligné (Ctrl+U)"
          >
            <Underline className="h-3 w-3" />
          </button>
          <div className="w-px h-4 bg-slate-200 mx-0.5" />
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }}
            className="p-1 hover:bg-slate-200 rounded text-slate-600"
            title="Liste à puces"
          >
            <List className="h-3 w-3" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec('insertOrderedList'); }}
            className="p-1 hover:bg-slate-200 rounded text-slate-600"
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
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        className={cn(
          "w-full px-2 py-1 text-xs text-slate-700 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-blue-50/30 overflow-y-auto",
          disabled && "bg-slate-50"
        )}
        style={{ minHeight, maxHeight: "200px" }}
        suppressContentEditableWarning
      />
    </div>
  );
}

// ⭐ Default export pour compatibilité avec le module RH (RecruitmentWorkspace)
// qui utilise `import RichTextEditor from '...'` (default import)
export default RichTextEditor;
