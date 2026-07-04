'use client';

/**
 * ============================================================================
 * StatusToggle — Toggle "Publier / Brouillon" sans exposer d'enum technique
 * ============================================================================
 *
 * Cache complètement les enums DRAFT/PUBLISHED, NEW/READ/REPLIED/ARCHIVED,
 * UPCOMING/ONGOING/COMPLETED derrière une interface visuelle simple.
 *
 * Deux modes :
 *   - 'publish' (défaut) → toggle "Publier" / "Brouillon"
 *   - 'contact'         → 4 boutons radio visuels (Nouveau / Lu / Répondu / Archivé)
 *
 * Props :
 *   - mode: 'publish' | 'contact'
 *   - value: string                     → valeur backend actuelle
 *   - onChange: (value: string) => void → renvoie toujours une valeur backend valide
 * ============================================================================
 */

import { Check, FileEdit, Mail, MailOpen, Reply, Archive } from 'lucide-react';

interface BaseProps {
  value: string;
  onChange: (value: string) => void;
}

interface PublishProps extends BaseProps {
  mode: 'publish';
  label?: string;
}

interface ContactProps extends BaseProps {
  mode: 'contact';
}

type Props = PublishProps | ContactProps;

export function StatusToggle(props: Props) {
  if (props.mode === 'contact') {
    return <ContactStatusToggle value={props.value} onChange={props.onChange} />;
  }
  // mode 'publish'
  const { value, onChange, label = 'Publier cet article' } = props;
  const isPublished = value === 'PUBLISHED';

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={isPublished}
        onClick={() => onChange(isPublished ? 'DRAFT' : 'PUBLISHED')}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
          isPublished ? 'bg-emerald-500' : 'bg-slate-300'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
            isPublished ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-slate-800">{label}</span>
        <span className={`text-xs ${isPublished ? 'text-emerald-600' : 'text-slate-500'}`}>
          {isPublished ? (
            <span className="inline-flex items-center gap-1">
              <Check className="w-3 h-3" /> Visible sur le site
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <FileEdit className="w-3 h-3" /> Brouillon (invisible sur le site)
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function ContactStatusToggle({ value, onChange }: BaseProps) {
  const options = [
    { key: 'NEW', label: 'Nouveau', icon: Mail, color: 'bg-blue-500' },
    { key: 'READ', label: 'Lu', icon: MailOpen, color: 'bg-slate-500' },
    { key: 'REPLIED', label: 'Répondu', icon: Reply, color: 'bg-emerald-500' },
    { key: 'ARCHIVED', label: 'Archivé', icon: Archive, color: 'bg-slate-400' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isActive = value === opt.key;
        const Icon = opt.icon;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              isActive
                ? `${opt.color} text-white shadow-md`
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
