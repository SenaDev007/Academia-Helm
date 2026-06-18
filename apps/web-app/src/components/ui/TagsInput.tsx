'use client';

/**
 * ============================================================================
 * TAGS INPUT — Composant réutilisable pour saisir des tags (compétences, atouts)
 * ============================================================================
 *
 * L'utilisateur tape un tag, appuie sur Entrée pour l'ajouter. Les tags sont
 * stockés dans un tableau côté frontend, puis sérialisés en string séparée
 * par virgules lors de l'envoi au backend (compatibilité avec la DB existante).
 *
 * Usage :
 *   <TagsInput
 *     value={skills}
 *     onChange={setSkills}
 *     placeholder="Ex: Excel, Comptabilité..."
 *     color="blue"
 *   />
 * ============================================================================
 */

import { useState, type KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';

export interface TagsInputProps {
  value: string[] | string; // accepte tableau OU string séparée par virgules
  onChange: (tags: string[]) => void;
  placeholder?: string;
  color?: 'blue' | 'amber' | 'emerald';
  className?: string;
}

const COLOR_STYLES = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function TagsInput({
  value,
  onChange,
  placeholder = 'Ajouter...',
  color = 'blue',
  className = '',
}: TagsInputProps) {
  // Normalize value: accept array or comma-separated string
  const tags: string[] = Array.isArray(value)
    ? value
    : typeof value === 'string' && value.trim()
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  const [input, setInput] = useState('');

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      // Remove last tag on Backspace when input is empty
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 min-h-[38px] ${className}`}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${COLOR_STYLES[color]}`}
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="hover:bg-black/10 rounded p-0.5 transition"
            aria-label={`Retirer ${tag}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <div className="flex items-center gap-1 flex-1 min-w-[120px]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => input.trim() && addTag(input)}
          placeholder={tags.length === 0 ? placeholder : 'Ajouter...'}
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400"
        />
        {input.trim() && (
          <button
            type="button"
            onClick={() => addTag(input)}
            className="p-1 rounded text-slate-500 hover:bg-slate-100 transition"
            aria-label="Ajouter"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Helper pour convertir un tableau de tags en string séparée par virgules
 * (format attendu par la DB).
 */
export function tagsToString(tags: string[]): string {
  return tags.join(', ');
}

/**
 * Helper pour parser une string séparée par virgules en tableau de tags.
 */
export function stringToTags(s: string | undefined | null): string[] {
  if (!s || !s.trim()) return [];
  return s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}
