/**
 * SchoolDirectoryPicker — Sélecteur du RÉPERTOIRE OFFICIEL des établissements
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ 2026-09-30 (demande utilisateur) : le Bénin dispose de répertoires
 * officiels d'établissements par département (initial : 1 406 établissements
 * secondaires privés 2022-2023). Ce sélecteur propose les établissements du
 * DÉPARTEMENT DU PATRONAT connecté (le filtrage est fait côté API) pour :
 *   1. créer rapidement une école PROVISOIRE (module Écoles rattachées) ;
 *   2. désigner un CENTRE d'examen (module Centres).
 *
 * Comportement : saisie ≥ 2 caractères → recherche debounced (400 ms) sur
 * GET /federis/patronat/schools/directory/search?q=… → liste déroulante des
 * établissements (nom, commune/arrondissement, cycle, directeur, téléphone).
 * La sélection d'une entrée remonte au parent via onPick(entry).
 *
 * Le parent reste maître du formulaire : le picker ne fait QUE suggérer.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, MapPin, Phone, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';

export interface DirectoryEntry {
  id: string;
  externalRef: string;
  name: string;
  level: string;
  sector: string;
  department: string;
  commune: string | null;
  arrondissement: string | null;
  cycle: string | null;
  cycleLabel: string | null;
  founderName: string | null;
  founderPhone: string | null;
  directorName: string | null;
  directorPhone: string | null;
  classesSummary: string | null;
}

interface DirectorySearchResponse {
  entries: DirectoryEntry[];
  departments: string[];
  nationalScope: boolean;
  totals: { establishments: number; communes: number };
  warning: string | null;
}

interface SchoolDirectoryPickerProps {
  /** Appelé à la sélection d'un établissement du répertoire. */
  onPick: (entry: DirectoryEntry) => void;
  /** Libellé du champ (défaut « Rechercher dans le répertoire officiel… »). */
  placeholder?: string;
  /** Filtre niveau : PRIMAIRE | SECONDAIRE (défaut tous). */
  level?: string;
  /** Contexte d'affichage : « école » | « centre » (libellé de l'aide). */
  context?: 'school' | 'center';
  /** Classes Tailwind additionnelles du conteneur. */
  className?: string;
}

export function SchoolDirectoryPicker({
  onPick,
  placeholder,
  level,
  context = 'school',
  className,
}: SchoolDirectoryPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DirectoryEntry[]>([]);
  const [totals, setTotals] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<DirectoryEntry | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Fermeture au clic extérieur
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Recherche debounced
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await apiClient.get<DirectorySearchResponse>(
          '/federis/patronat/schools/directory/search',
          { params: { q, ...(level ? { level } : {}) }, timeout: 15000 },
        );
        setResults(res.data?.entries ?? []);
        setTotals(res.data?.totals?.establishments ?? null);
        setWarning(res.data?.warning ?? null);
        setOpen(true);
      } catch {
        setResults([]);
        setWarning(null);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, level]);

  const handlePick = (entry: DirectoryEntry) => {
    setPicked(entry);
    setQuery(entry.name);
    setOpen(false);
    onPick(entry);
  };

  const helpText =
    context === 'center'
      ? 'Sélectionnez un établissement du répertoire officiel pour pré-remplir la fiche du centre d\u2019accueil.'
      : 'Les établissements hors Academia Helm de votre département sont suggérés — sélectionnez-en un pour pré-remplir la fiche de l\u2019école.';

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
        Répertoire officiel — établissements de votre département
      </label>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPicked(null);
          }}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          placeholder={placeholder ?? 'Nom de l\u2019établissement (ex. CPEG…) — 2 caractères minimum'}
          className="w-full pl-10 pr-10 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/60 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-900/40 focus:border-blue-900/40 transition-all"
        />
        {loading && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-slate-300 border-t-blue-900 animate-spin" />
        )}
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400 font-medium">
        {picked ? (
          <span className="text-emerald-700 font-bold">
            ✓ {picked.name}
            {picked.commune ? ` — ${picked.commune}` : ''} : fiche pré-remplie, complétez puis enregistrez.
          </span>
        ) : (
          <>
            {helpText}
            {totals !== null && totals > 0 && (
              <span className="text-slate-500 font-bold"> {totals.toLocaleString('fr-FR')} établissement(s) référencé(s) dans votre département.</span>
            )}
          </>
        )}
      </p>

      {warning && query.trim().length >= 2 && (
        <p className="mt-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {warning}
        </p>
      )}

      {open && results.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-80 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-xl divide-y divide-slate-50">
          {results.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => handlePick(entry)}
              className="w-full text-left px-4 py-3 hover:bg-blue-50/60 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Building2 className="w-4 h-4 text-blue-900" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800 group-hover:text-blue-900 truncate">
                    {entry.name}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-500 font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {[entry.commune, entry.arrondissement].filter(Boolean).join(', ') || '—'}
                    </span>
                    {entry.cycleLabel && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                        {entry.cycleLabel}
                      </span>
                    )}
                    {entry.directorName && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <User className="w-3 h-3 shrink-0" />
                        {entry.directorName}
                      </span>
                    )}
                    {entry.directorPhone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {entry.directorPhone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && !loading && query.trim().length >= 2 && results.length === 0 && !warning && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl px-4 py-4 text-center">
          <p className="text-xs font-bold text-slate-400">
            Aucun établissement du répertoire officiel ne correspond à « {query.trim()} ».
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            Vous pouvez saisir la fiche manuellement ci-dessous.
          </p>
        </div>
      )}
    </div>
  );
}

export default SchoolDirectoryPicker;
