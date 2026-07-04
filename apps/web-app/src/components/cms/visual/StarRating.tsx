'use client';

/**
 * ============================================================================
 * StarRating — Notation par étoiles cliquables (1 à 5)
 * ============================================================================
 *
 * Remplace les inputs "Note (1-5)" type=number par une UI intuitive.
 *
 * Props :
 *   - value: number             → note actuelle (0 si aucune)
 *   - onChange: (n: number) => void
 *   - size?: 'sm' | 'md' | 'lg' → taille des étoiles
 * ============================================================================
 */

import { useState } from 'react';
import { Star } from 'lucide-react';

const SIZE_CLASS = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
};

interface Props {
  value: number;
  onChange: (n: number) => void;
  size?: keyof typeof SIZE_CLASS;
  label?: string;
}

export function StarRating({ value, onChange, size = 'md', label }: Props) {
  const [hover, setHover] = useState(0);
  const displayed = hover || value;

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      )}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n === value ? 0 : n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5 rounded transition hover:scale-110"
            aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
          >
            <Star
              className={`${SIZE_CLASS[size]} ${
                n <= displayed
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-transparent text-slate-300'
              }`}
            />
          </button>
        ))}
        <span className="ml-2 text-xs text-slate-500">
          {value > 0 ? `${value}/5` : 'Aucune note'}
        </span>
      </div>
    </div>
  );
}
