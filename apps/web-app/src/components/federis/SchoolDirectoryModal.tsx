/**
 * SchoolDirectoryModal — RÉPERTOIRE OFFICIEL : fenêtre de sélection
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ 2026-09-30 (demande utilisateur) : les boutons « Créer une école hors
 * Academia Helm » (module Écoles rattachées) et « Ajouter un centre »
 * (module Centres, salles & Surveillants) ouvrent cette FENÊTRE au lieu
 * de présenter un simple champ de saisie :
 *
 *   - la liste INTÉGRALE des établissements du département du patronat est
 *     affichée et scrollable — il voit tout, même sans connaître
 *     l'orthographe exacte d'un nom ;
 *   - un champ de recherche intégré filtre au fil de la frappe (le patronat
 *     peut chercher ET scroller en même temps) ;
 *   - un clic sur un établissement pré-remplit directement la fiche ;
 *   - « Saisir manuellement » (ou fermer) si l'établissement ne figure pas
 *     au répertoire : le formulaire vierge s'ouvre.
 *
 * Données : GET /federis/patronat/schools/directory/search?limit=2000
 * (filtré côté API par le DÉPARTEMENT du patronat ; national = tout le
 * pays). Rendu incrémental par lots (80 lignes) pour rester fluide même
 * sur les grands départements.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Building2,
  ChevronDown,
  MapPin,
  PenLine,
  Phone,
  Search,
  User,
  X,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { DirectoryEntry } from './SchoolDirectoryPicker';

interface DirectorySearchResponse {
  entries: DirectoryEntry[];
  departments: string[];
  nationalScope: boolean;
  totals: { establishments: number; communes: number };
  warning: string | null;
}

interface SchoolDirectoryModalProps {
  /** Fenêtre ouverte. */
  open: boolean;
  /** Fermeture (croix, fond, Échap) — SANS ouvrir le formulaire manuel. */
  onClose: () => void;
  /** Établissement sélectionné dans le répertoire → pré-remplissage. */
  onPick: (entry: DirectoryEntry) => void;
  /** Bouton « Saisir manuellement » (établissement absent du répertoire). */
  onManual?: () => void;
  /** Contexte : « school » (écoles rattachées) | « center » (centres). */
  context?: 'school' | 'center';
  /** Filtre niveau : PRIMAIRE | SECONDAIRE (défaut tous). */
  level?: string;
}

/** Rendu incrémental : nombre de lignes affichées par lot. */
const LOT = 80;

export function SchoolDirectoryModal({
  open,
  onClose,
  onPick,
  onManual,
  context = 'school',
  level,
}: SchoolDirectoryModalProps) {
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [allEntries, setAllEntries] = useState<DirectoryEntry[]>([]);
  const [totals, setTotals] = useState<{ establishments: number; communes: number } | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(LOT);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Ouverture : chargement de la liste INTÉGRALE du département ─────────
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setVisible(LOT);
    let cancelled = false;
    setLoading(true);
    setWarning(null);
    (async () => {
      try {
        const res = await apiClient.get<DirectorySearchResponse>(
          '/federis/patronat/schools/directory/search',
          { params: { limit: 2000, ...(level ? { level } : {}) }, timeout: 20000 },
        );
        if (cancelled) return;
        const list = res.data?.entries ?? [];
        setEntries(list);
        setAllEntries(list);
        setTotals(res.data?.totals ?? null);
        setDepartments(res.data?.departments ?? []);
        setWarning(res.data?.warning ?? null);
      } catch {
        if (cancelled) return;
        setEntries([]);
        setAllEntries([]);
        setWarning(
          'Le répertoire officiel est indisponible pour le moment — vous pouvez saisir la fiche manuellement.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, level]);

  // ── Recherche intégrée (debounce 400 ms — ≥ 2 caractères) ───────────────
  useEffect(() => {
    if (!open) return;
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) {
      setEntries(allEntries);
      setVisible(LOT);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<DirectorySearchResponse>(
          '/federis/patronat/schools/directory/search',
          { params: { q, limit: 200, ...(level ? { level } : {}) }, timeout: 15000 },
        );
        setEntries(res.data?.entries ?? []);
        setWarning(res.data?.warning ?? null);
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // allEntries : ne change qu'au chargement d'ouverture (query déjà réinitialisé)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, level, allEntries.length === 0]);

  // ── Échap pour fermer + focus automatique sur la recherche ──────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  // ── Verrouillage du scroll de fond tant que la fenêtre est ouverte ──────
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const handlePick = (entry: DirectoryEntry) => {
    onClose();
    onPick(entry);
  };

  const title =
    context === 'center'
      ? 'Répertoire officiel — choisir un centre d\u2019accueil'
      : 'Répertoire officiel — créer une école hors Academia Helm';
  const subtitle =
    context === 'center'
      ? 'Tous les établissements de votre département sont listés : faites défiler ou recherchez, puis cliquez pour pré-remplir la fiche du centre.'
      : 'Tous les établissements de votre département sont listés : faites défiler ou recherchez, puis cliquez pour pré-remplir la fiche de l\u2019école (création provisoire + invitation du responsable).';
  const manualLabel =
    context === 'center'
      ? 'L\u2019établissement ne figure pas au répertoire — saisir la fiche du centre'
      : 'L\u2019école ne figure pas au répertoire — saisir la fiche manuellement';

  const scopeLabel =
    departments.length === 1
      ? `Département de ${departments[0]}`
      : departments.length > 1
        ? `${departments.length} départements couverts`
        : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
        {/* ── En-tête ── */}
        <div className="px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-blue-900 leading-snug">{title}</h2>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed max-w-lg">
                {subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Recherche intégrée */}
          <div className="relative mt-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisible(LOT);
              }}
              placeholder="Rechercher un établissement (nom, commune, arrondissement)…"
              className="w-full pl-10 pr-10 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/60 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-900/40 focus:border-blue-900/40 transition-all"
            />
            {loading && (
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-slate-300 border-t-blue-900 animate-spin" />
            )}
          </div>

          {/* Compteur / périmètre */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-wide">
            {totals && totals.establishments > 0 && (
              <span className="text-slate-400">
                {totals.establishments.toLocaleString('fr-FR')} établissement(s) ·{' '}
                {totals.communes} commune(s)
              </span>
            )}
            {scopeLabel && (
              <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-blue-900 normal-case">
                {scopeLabel}
              </span>
            )}
            {query.trim().length >= 2 && (
              <span className="text-slate-400 normal-case">
                {entries.length} résultat(s) pour « {query.trim()} »
              </span>
            )}
          </div>
        </div>

        {/* ── Avertissement périmètre ── */}
        {warning && (
          <p className="mx-6 mt-4 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 shrink-0">
            {warning}
          </p>
        )}

        {/* ── Liste scrollable ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && entries.length === 0 ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-bold text-slate-500">
                {query.trim().length >= 2
                  ? `Aucun établissement ne correspond à « ${query.trim()} ».`
                  : 'Aucun établissement du répertoire officiel pour votre périmètre.'}
              </p>
              {onManual && (
                <p className="text-xs text-slate-400 font-medium mt-1.5">
                  Vous pouvez saisir la fiche manuellement ci-dessous.
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {entries.slice(0, visible).map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => handlePick(entry)}
                  className="w-full text-left px-3 py-3 -mx-1 rounded-xl hover:bg-blue-50/60 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-900 group-hover:border-blue-900 transition-colors">
                      <Building2 className="w-[18px] h-[18px] text-blue-900 group-hover:text-white transition-colors" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800 group-hover:text-blue-900 leading-snug">
                        {entry.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-500 font-semibold">
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
                          <span className="inline-flex items-center gap-1 truncate max-w-[220px]">
                            <User className="w-3 h-3 shrink-0" />
                            {entry.directorName}
                          </span>
                        )}
                        {(entry.directorPhone ?? entry.founderPhone) && (
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Phone className="w-3 h-3" />
                            {entry.directorPhone ?? entry.founderPhone}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 self-center text-[10px] font-bold uppercase text-blue-900 opacity-0 group-hover:opacity-100 transition-opacity">
                      Sélectionner
                    </span>
                  </div>
                </button>
              ))}

              {/* Rendu incrémental — protection performance grands départements */}
              {visible < entries.length && (
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + LOT)}
                  className="w-full mt-2 px-4 py-3 rounded-xl border border-blue-100 bg-blue-50/50 text-xs font-bold text-blue-900 hover:bg-blue-50 transition-colors inline-flex items-center justify-center gap-2"
                >
                  <ChevronDown className="w-4 h-4" />
                  Afficher plus d&apos;établissements ({entries.length - visible} restant(s))
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Pied : saisie manuelle / fermer ── */}
        <div className="px-6 py-4 border-t border-slate-100 bg-[#f7f9fc] shrink-0 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
            Répertoire officiel du Bénin — établissements privés d&apos;enseignement
            secondaire. Téléphones au format national « 01 … ».
          </p>
          <div className="flex items-center gap-2.5 shrink-0">
            {onManual && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onManual();
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-blue-900/40 hover:text-blue-900 transition-colors whitespace-nowrap"
              >
                <PenLine className="w-3.5 h-3.5" />
                Saisir manuellement
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-blue-900 text-white text-xs font-bold hover:bg-blue-800 transition-colors whitespace-nowrap"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SchoolDirectoryModal;
