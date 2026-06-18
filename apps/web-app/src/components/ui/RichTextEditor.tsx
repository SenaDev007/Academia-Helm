'use client';

/**
 * ============================================================================
 * RICH TEXT EDITOR — Tiptap-based
 * ============================================================================
 *
 * Éditeur de texte riche pour les champs description, missions, responsabilités
 * des offres d'emploi. Permet :
 *   - Listes à puces (bullet lists)
 *   - Listes numérotées (ordered lists)
 *   - Gras / Italique / Souligné
 *   - Titres (H2, H3)
 *   - Paragraphes
 *
 * Le contenu est stocké en HTML dans la DB (champ String). Le rendu côté
 * page publique se fait via `dangerouslySetInnerHTML` après sanitisation.
 *
 * Usage :
 *   <RichTextEditor
 *     value={html}
 *     onChange={(html) => setField(html)}
 *     placeholder="Décrivez la mission..."
 *     minHeight={120}
 *   />
 * ============================================================================
 */

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Undo,
  Redo,
  Quote,
} from 'lucide-react';

const PRIMARY = '#1A2BA6';

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Saisissez votre contenu...',
  minHeight = 120,
  className = '',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Disable code blocks & horizontal rules — not needed for job descriptions
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: 'tiptap-content prose prose-sm max-w-none focus:outline-none px-3 py-2',
        style: `min-height: ${minHeight}px;`,
      },
    },
  });

  // Sync external value changes (e.g. when editing a different job)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        className={`rounded-lg border border-slate-200 bg-slate-50 ${className}`}
        style={{ minHeight: minHeight + 40 }}
      />
    );
  }

  const ToolbarButton = ({
    onClick,
    isActive,
    title,
    children,
  }: {
    onClick: () => void;
    isActive?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition ${
        isActive
          ? 'bg-slate-200 text-slate-900'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className={`rounded-lg border border-slate-200 overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 bg-slate-50 border-b border-slate-200">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Gras (Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italique (Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Titre"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Sous-titre"
        >
          <Heading3 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Liste à puces"
        >
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Liste numérotée"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Citation"
        >
          <Quote className="w-3.5 h-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="Annuler (Ctrl+Z)"
        >
          <Undo className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="Rétablir (Ctrl+Y)"
        >
          <Redo className="w-3.5 h-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />

      {/* Styles for the editor content */}
      <style jsx global>{`
        .tiptap-content {
          font-size: 13px;
          color: #334155;
          line-height: 1.6;
        }
        .tiptap-content :where(p) {
          margin: 0 0 0.5em 0;
        }
        .tiptap-content :where(p):last-child {
          margin-bottom: 0;
        }
        .tiptap-content :where(ul) {
          list-style: disc;
          padding-left: 1.5em;
          margin: 0 0 0.5em 0;
        }
        .tiptap-content :where(ol) {
          list-style: decimal;
          padding-left: 1.5em;
          margin: 0 0 0.5em 0;
        }
        .tiptap-content :where(li) {
          margin: 0.25em 0;
        }
        .tiptap-content :where(li) > p {
          margin: 0;
        }
        .tiptap-content :where(h2) {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          margin: 0.8em 0 0.4em 0;
        }
        .tiptap-content :where(h3) {
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
          margin: 0.6em 0 0.3em 0;
        }
        .tiptap-content :where(blockquote) {
          border-left: 3px solid ${PRIMARY};
          padding-left: 1em;
          margin: 0.5em 0;
          color: #64748b;
          font-style: italic;
        }
        .tiptap-content :where(strong) {
          font-weight: 700;
        }
        .tiptap-content :where(em) {
          font-style: italic;
        }
        .tiptap-content.is-editor-empty::before {
          content: attr(data-placeholder);
          float: left;
          color: #94a3b8;
          pointer-events: none;
          height: 0;
          font-style: italic;
        }
        .tiptap-content:focus {
          outline: 2px solid ${PRIMARY}40;
          outline-offset: -2px;
        }
      `}</style>
    </div>
  );
}
