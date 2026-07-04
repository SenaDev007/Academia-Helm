'use client';

/**
 * ============================================================================
 * DateField — Champ date simple (input type=date natif)
 * ============================================================================
 *
 * Remplace les inputs "Date début / Date fin" type=text qui demandaient
 * à l'utilisateur de saisir "2026-09-15" manuellement.
 *
 * Affiche un input natif type=date (calendrier natif du navigateur).
 *
 * Props :
 *   - value: string    → valeur ISO (YYYY-MM-DD) ou vide
 *   - onChange: (iso: string) => void
 * ============================================================================
 */

interface Props {
  value: string;
  onChange: (iso: string) => void;
  label?: string;
  includeTime?: boolean;
}

export function DateField({ value, onChange, label, includeTime = false }: Props) {
  // Si la valeur est un datetime complet (2026-09-15T10:00:00.000Z),
  // on extrait la partie pertinente pour l'input.
  let displayValue = '';
  if (value) {
    if (includeTime) {
      // type=datetime-local attend YYYY-MM-DDTHH:mm
      displayValue = value.substring(0, 16);
    } else {
      displayValue = value.substring(0, 10);
    }
  }

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      )}
      <input
        type={includeTime ? 'datetime-local' : 'date'}
        value={displayValue}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
      />
    </div>
  );
}
