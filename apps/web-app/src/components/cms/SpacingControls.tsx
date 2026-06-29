'use client';

/**
 * ============================================================================
 * SpacingControls — Sliders d'espacement par section
 * ============================================================================
 *
 * Permet à l'utilisateur de contrôler le padding haut/bas d'une section.
 * Valeurs : 0 à 128px (de 0 à 8rem).
 *
 * Usage :
 *   <SpacingControls value={{ paddingTop: 64, paddingBottom: 64 }} onChange={(v) => update('spacing', v)} />
 * ============================================================================
 */

interface Spacing {
  paddingTop: number;
  paddingBottom: number;
}

interface Props {
  value: Spacing;
  onChange: (v: Spacing) => void;
}

export function SpacingControls({ value, onChange }: Props) {
  const presets = [
    { label: 'Compact', paddingTop: 32, paddingBottom: 32 },
    { label: 'Normal', paddingTop: 64, paddingBottom: 64 },
    { label: 'Aéré', paddingTop: 96, paddingBottom: 96 },
    { label: 'Très aéré', paddingTop: 128, paddingBottom: 128 },
  ];

  return (
    <div className="space-y-3">
      {/* Presets */}
      <div className="flex gap-1.5">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange({ paddingTop: p.paddingTop, paddingBottom: p.paddingBottom })}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
              value.paddingTop === p.paddingTop && value.paddingBottom === p.paddingBottom
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Sliders */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Espacement haut</label>
          <span className="text-xs font-bold text-slate-700">{value.paddingTop}px</span>
        </div>
        <input
          type="range"
          min="0"
          max="128"
          step="4"
          value={value.paddingTop}
          onChange={(e) => onChange({ ...value, paddingTop: Number(e.target.value) })}
          className="w-full"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Espacement bas</label>
          <span className="text-xs font-bold text-slate-700">{value.paddingBottom}px</span>
        </div>
        <input
          type="range"
          min="0"
          max="128"
          step="4"
          value={value.paddingBottom}
          onChange={(e) => onChange({ ...value, paddingBottom: Number(e.target.value) })}
          className="w-full"
        />
      </div>
    </div>
  );
}
