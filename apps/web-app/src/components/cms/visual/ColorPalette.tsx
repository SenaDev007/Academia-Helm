'use client';

/**
 * ============================================================================
 * ColorPalette — Palette de couleurs 100% visuelle, zéro code hex visible
 * ============================================================================
 *
 * L'utilisateur choisit 2 à 4 couleurs via le color picker natif du navigateur.
 * Aucune saisie manuelle de #0b2f73 ou autre code hexadécimal.
 *
 * Affichage :
 *   - Chaque couleur = une ligne avec un grand carré coloré cliquable + nom
 *   - Bouton "Ajouter une couleur" (max 4)
 *   - Aperçu live de la palette
 *   - Description des rôles en langage naturel (pas de "header/hero/gradient/footer")
 *
 * Props :
 *   - value: { name: string; value: string }[]
 *   - onChange: (palette) => void
 * ============================================================================
 */

import { Plus, Trash2, Palette } from 'lucide-react';

const ROLE_LABELS = [
  'Couleur principale (bandeau du haut)',
  'Couleur des boutons',
  'Couleur des dégradés',
  'Couleur du bas de page',
];

interface Color {
  name: string;
  value: string;
}

interface Props {
  value: Color[];
  onChange: (palette: Color[]) => void;
  max?: number;
}

export function ColorPalette({ value, onChange, max = 4 }: Props) {
  const addColor = () => {
    if (value.length >= max) return;
    const next: Color = {
      name: `Couleur ${value.length + 1}`,
      value: '#1d4fa5',
    };
    onChange([...value, next]);
  };

  const removeColor = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
  };

  const updateColor = (i: number, patch: Partial<Color>) => {
    onChange(value.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  return (
    <div className="space-y-4">
      {/* Aperçu de la palette */}
      {value.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
          <p className="text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wide">
            Aperçu de votre palette
          </p>
          <div className="flex gap-3 flex-wrap">
            {value.map((c, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div
                  className="w-16 h-16 rounded-2xl shadow-sm border-2 border-white"
                  style={{ background: c.value }}
                />
                <span className="text-[11px] text-slate-600 font-medium max-w-[100px] text-center">
                  {c.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* État vide */}
      {value.length === 0 && (
        <div className="text-center py-10 px-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
          <Palette className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-1">Aucune couleur personnalisée</p>
          <p className="text-xs text-slate-400 mb-4">
            Votre site utilisera automatiquement les couleurs par défaut d'Academia Helm
            (bleu marine, bleu, doré).
          </p>
        </div>
      )}

      {/* Liste des couleurs */}
      {value.map((color, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-3 rounded-xl border border-slate-200 bg-white"
        >
          {/* Color picker natif (grand carré cliquable) */}
          <label className="relative cursor-pointer shrink-0">
            <div
              className="w-14 h-14 rounded-xl shadow-sm border-2 border-white ring-1 ring-slate-200"
              style={{ background: color.value }}
            />
            <input
              type="color"
              value={color.value}
              onChange={(e) => updateColor(i, { value: e.target.value })}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label={`Couleur ${i + 1}`}
            />
          </label>

          {/* Nom + rôle */}
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={color.name}
              onChange={(e) => updateColor(i, { name: e.target.value })}
              placeholder={`Couleur ${i + 1}`}
              className="w-full px-2 py-1 text-sm font-semibold text-slate-800 border-0 border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:ring-0 outline-none bg-transparent"
            />
            <p className="text-xs text-slate-500 mt-1">
              {ROLE_LABELS[i] || `Couleur ${i + 1}`}
            </p>
          </div>

          {/* Bouton supprimer */}
          <button
            type="button"
            onClick={() => removeColor(i)}
            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition shrink-0"
            title="Retirer cette couleur"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      {/* Bouton ajouter */}
      {value.length < max && (
        <button
          type="button"
          onClick={addColor}
          className="w-full py-3 border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 rounded-xl text-sm font-semibold text-slate-600 hover:text-blue-700 transition flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Ajouter une couleur ({value.length}/{max})
        </button>
      )}

      {/* Note pédagogique */}
      <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <p className="text-xs text-blue-800 leading-relaxed">
          Astuce : choisissez 2 couleurs au minimum pour personnaliser votre identité.
          Vous pouvez modifier chaque couleur en cliquant sur le carré coloré.
        </p>
      </div>
    </div>
  );
}
