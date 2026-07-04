'use client';

/**
 * ============================================================================
 * SlugField — Génération automatique du lien de page, zéro jargon
 * ============================================================================
 *
 * L'utilisateur saisit un titre → on génère automatiquement le lien
 * (slug) en français, sans accents, espaces remplacées par -.
 *
 * Affichage :
 *   "Lien de la page : /mon-actualite"
 *
 * Bouton "Modifier le lien" (avancé) — permet de personnaliser si besoin,
 * avec une preview en temps réel.
 *
 * Aucune mention de "slug", "URL", "identifiant", "permalien".
 *
 * Props :
 *   - title: string                         → titre depuis lequel générer le slug
 *   - value: string                         → slug actuel
 *   - onChange: (slug: string) => void
 *   - basePath?: string                     → ex: "/" pour les pages, "/actualites/" pour les articles
 *   - label?: string                        → par défaut "Lien de la page"
 * ============================================================================
 */

import { useState, useEffect, useMemo } from 'react';
import { Pencil, Check, X } from 'lucide-react';

function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // accents
    .replace(/[^a-zA-Z0-9\s-]/g, '') // caractères spéciaux
    .trim()
    .replace(/\s+/g, '-')            // espaces → tirets
    .replace(/-+/g, '-')             // tirets multiples
    .toLowerCase()
    .substring(0, 80);
}

interface Props {
  title: string;
  value: string;
  onChange: (slug: string) => void;
  basePath?: string;
  label?: string;
}

export function SlugField({
  title,
  value,
  onChange,
  basePath = '/',
  label = 'Lien de la page',
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  // Auto-générer tant que l'utilisateur n'a pas personnalisé manuellement
  const autoSlug = useMemo(() => slugify(title), [title]);

  useEffect(() => {
    if (!editing) {
      // Si value est vide ou égal à l'ancien auto-slug, on suit le titre
      if (!value || value === draft) {
        onChange(autoSlug);
        setDraft(autoSlug);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSlug]);

  const startEdit = () => {
    setDraft(value || autoSlug);
    setEditing(true);
  };

  const saveEdit = () => {
    const cleaned = slugify(draft);
    onChange(cleaned || autoSlug);
    setDraft(cleaned || autoSlug);
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-stretch rounded-lg overflow-hidden border border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
            <span className="inline-flex items-center px-3 bg-slate-100 text-slate-500 text-sm">
              {basePath}
            </span>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              className="flex-1 px-3 py-2 text-sm outline-none bg-white"
              placeholder="mon-article"
            />
          </div>
          <button
            type="button"
            onClick={saveEdit}
            className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition"
            title="Enregistrer"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition"
            title="Annuler"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Le lien doit contenir uniquement des lettres, chiffres et tirets.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
        <span className="text-sm text-slate-500">
          {basePath}
          <span className="font-semibold text-slate-800">{value || autoSlug || 'à-completer'}</span>
        </span>
        <button
          type="button"
          onClick={startEdit}
          className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800"
        >
          <Pencil className="w-3 h-3" />
          Modifier le lien
        </button>
      </div>
    </div>
  );
}
