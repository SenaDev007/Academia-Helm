'use client';

/**
 * ============================================================================
 * RichTextEditor — Éditeur de texte riche WYSIWYG léger
 * ============================================================================
 *
 * Toolbar : gras, italique, souligné, listes à puces, listes numérotées,
 * titres H2/H3, liens, alignement, citation.
 *
 * Utilise contentEditable (pas de librairie externe).
 * Le contenu est stocké en HTML.
 * ============================================================================
 */

import { useRef, useEffect } from 'react';
import {
  Bold, Italic, Underline, List, ListOrdered, Heading2, Heading3,
  Link2, Quote, AlignLeft, AlignCenter, AlignRight, Undo, Redo,
} from 'lucide-react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  rows?: number;
}

export function RichTextEditor({ value, onChange, placeholder, rows = 6 }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Sync la valeur initiale et quand value change de l'extérieur
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const exec = (command: string, val?: string) => {
    document.execCommand(command, false, val);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleLink = () => {
    const url = window.prompt('Entrez l\'URL du lien :', 'https://');
    if (url) exec('createLink', url);
  };

  const toolBtn = 'p-1.5 rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition';
  const divider = <div className="w-px h-5 bg-slate-200 mx-0.5" />;

  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-slate-50 border-b border-slate-200 flex-wrap">
        <button type="button" onClick={() => exec('undo')} className={toolBtn} title="Annuler"><Undo className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => exec('redo')} className={toolBtn} title="Rétablir"><Redo className="w-3.5 h-3.5" /></button>
        {divider}
        <button type="button" onClick={() => exec('bold')} className={toolBtn} title="Gras"><Bold className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => exec('italic')} className={toolBtn} title="Italique"><Italic className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => exec('underline')} className={toolBtn} title="Souligné"><Underline className="w-3.5 h-3.5" /></button>
        {divider}
        <button type="button" onClick={() => exec('formatBlock', '<h2>')} className={toolBtn} title="Titre H2"><Heading2 className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => exec('formatBlock', '<h3>')} className={toolBtn} title="Titre H3"><Heading3 className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => exec('formatBlock', '<blockquote>')} className={toolBtn} title="Citation"><Quote className="w-3.5 h-3.5" /></button>
        {divider}
        <button type="button" onClick={() => exec('insertUnorderedList')} className={toolBtn} title="Liste à puces"><List className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => exec('insertOrderedList')} className={toolBtn} title="Liste numérotée"><ListOrdered className="w-3.5 h-3.5" /></button>
        {divider}
        <button type="button" onClick={() => exec('justifyLeft')} className={toolBtn} title="Aligner à gauche"><AlignLeft className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => exec('justifyCenter')} className={toolBtn} title="Centrer"><AlignCenter className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => exec('justifyRight')} className={toolBtn} title="Aligner à droite"><AlignRight className="w-3.5 h-3.5" /></button>
        {divider}
        <button type="button" onClick={handleLink} className={toolBtn} title="Insérer un lien"><Link2 className="w-3.5 h-3.5" /></button>
      </div>

      {/* Zone éditable */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        data-placeholder={placeholder || 'Saisissez votre contenu…'}
        className="px-3 py-2 text-sm text-slate-800 outline-none prose prose-sm max-w-none [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mt-2 [&_h3]:mb-1 [&_blockquote]:border-l-3 [&_blockquote]:border-amber-400 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-600 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_a]:text-blue-600 [&_a]:underline [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-slate-400"
        style={{ minHeight: `${rows * 24}px` }}
        suppressContentEditableWarning
      />
    </div>
  );
}
