/**
 * ============================================================================
 * SCHOOL SEARCH COMPONENT — SÉLECTEUR INTELLIGENT D'ÉTABLISSEMENT
 * ============================================================================
 *
 * Composant sélecteur avec recherche intelligente et liste complète.
 * La liste des écoles est intégrée directement dans le modal (pas de dropdown)
 * pour une visibilité maximale en format portrait.
 *
 * Palette Academia Helm : Navy (#0b2f73) / Blue (#1d4fa5) / Gold (#f5b335)
 *
 * ============================================================================
 */

'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Building2, MapPin, GraduationCap, Loader, CheckCircle, X, RefreshCw, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

interface School {
  id: string;
  name: string;
  slug: string;
  subdomain?: string;
  logoUrl?: string;
  city?: string;
  schoolType?: string;
  country?: string;
}

interface SchoolSearchProps {
  onSchoolSelect: (school: School | null) => void;
  selectedSchool: School | null;
  portalType: 'PLATFORM' | 'SCHOOL' | 'TEACHER' | 'PARENT' | 'PUBLIC' | null;
}

/** Palette Academia Helm */
const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';

export default function SchoolSearch({
  onSchoolSelect,
  selectedSchool,
  portalType,
}: SchoolSearchProps) {
  const reduceMotion = useReducedMotion();
  const [searchQuery, setSearchQuery] = useState('');
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Liste des établissements : route App Router → BFF qui appelle Nest
  // Fallback : si /list échoue (403/5xx), essayer /search?q= pour obtenir au moins des résultats
  const loadAllSchools = async () => {
    const abortController = new AbortController();
    // Timeout augmenté à 35s — le backend peut avoir un cold start Neon
    const timeoutId = setTimeout(() => abortController.abort(), 35000);

    setIsLoading(true);
    setFetchError(null);
    try {
      const response = await fetch('/api/public/schools/list', {
        signal: abortController.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setAllSchools(data);
        } else if (data && Array.isArray(data.schools)) {
          setAllSchools(data.schools);
        } else {
          console.warn('[SchoolSearch] Unexpected response format:', data);
          setAllSchools([]);
        }
      } else {
        // Tenter le fallback via /search si /list échoue
        const errorBody = await response.json().catch(() => null);
        console.error('[SchoolSearch] /list failed:', response.status, errorBody);

        if (response.status === 403 || response.status >= 500) {
          console.log('[SchoolSearch] Trying /search fallback...');
          const fallbackOk = await trySearchFallback();
          if (fallbackOk) return; // Succès du fallback
        }

        const hint = errorBody?._debug?.hint || '';
        const errorMsg = response.status === 403
          ? 'Accès refusé par le serveur. Réessayez dans quelques instants.'
          : response.status === 504
            ? 'Le serveur met trop de temps à répondre. Réessayez dans quelques instants.'
            : `Erreur ${response.status}: impossible de charger les établissements`;
        setFetchError(hint ? `${errorMsg} ${hint}` : errorMsg);
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.warn('[SchoolSearch] Schools list fetch timed out');
        // Timeout côté client → essayer le search fallback
        const fallbackOk = await trySearchFallback().catch(() => false);
        if (!fallbackOk) {
          setFetchError('Le serveur met trop de temps à répondre. Réessayez.');
        }
      } else {
        console.error('[SchoolSearch] Error loading schools list:', error);
        // Dernier recours : essayer le search fallback
        const fallbackOk = await trySearchFallback().catch(() => false);
        if (!fallbackOk) {
          setFetchError('Erreur de connexion au serveur.');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  /** Fallback : charger quelques écoles via le endpoint /search */
  const trySearchFallback = async (): Promise<boolean> => {
    try {
      const fallbackController = new AbortController();
      const fallbackTimeout = setTimeout(() => fallbackController.abort(), 10000);
      // Recherche large pour obtenir un maximum de résultats
      // ⚠️ Le endpoint /search exige au moins 2 caractères — ne pas utiliser q=a
      const response = await fetch('/api/public/schools/search?q=aa', {
        signal: fallbackController.signal,
      });
      clearTimeout(fallbackTimeout);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          console.log(`[SchoolSearch] Fallback /search loaded ${data.length} schools`);
          setAllSchools(data);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    loadAllSchools();
  }, []);

  // Recherche intelligente avec debounce
  useEffect(() => {
    if (searchQuery.length > 0) {
      setIsSearching(true);
      const timeout = setTimeout(() => setIsSearching(false), 300);
      return () => clearTimeout(timeout);
    } else {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Filtrer les écoles selon la recherche
  const filteredSchools = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length === 0) {
      return allSchools;
    }

    const query = searchQuery.toLowerCase().trim();
    return allSchools.filter((school) => {
      const nameMatch = school.name?.toLowerCase().includes(query);
      const cityMatch = school.city?.toLowerCase().includes(query);
      const slugMatch = school.slug?.toLowerCase().includes(query);
      const subdomainMatch = school.subdomain?.toLowerCase().includes(query);
      const countryMatch = school.country?.toLowerCase().includes(query);

      return nameMatch || cityMatch || slugMatch || subdomainMatch || countryMatch;
    });
  }, [allSchools, searchQuery]);

  const handleSchoolClick = (school: School) => {
    onSchoolSelect(school);
    setSearchQuery('');
  };

  const handleClearSelection = () => {
    onSchoolSelect(null);
    setSearchQuery('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const getSchoolTypeLabel = (type?: string) => {
    switch (type?.toUpperCase()) {
      case 'PRIMAIRE':
        return 'Primaire';
      case 'SECONDAIRE':
        return 'Secondaire';
      case 'MIXTE':
        return 'Primaire & Secondaire';
      default:
        return type || 'École';
    }
  };

  // ── École sélectionnée : affichage compact ──
  if (selectedSchool) {
    return (
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }}
        className="rounded-xl border-2 p-4"
        style={{
          borderColor: `${NAVY}25`,
          background: `linear-gradient(135deg, ${NAVY}06, ${BLUE}08)`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {selectedSchool.logoUrl ? (
              <Image
                src={selectedSchool.logoUrl}
                alt={selectedSchool.name}
                width={48}
                height={48}
                className="rounded-lg flex-shrink-0 object-cover"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${NAVY}, ${BLUE})`,
                }}
              >
                <Building2 className="w-6 h-6 text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <p className="font-bold text-slate-900 truncate">{selectedSchool.name}</p>
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              </div>
              <div className="flex items-center space-x-4 mt-1 text-sm text-slate-600">
                {selectedSchool.city && (
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{selectedSchool.city}</span>
                  </div>
                )}
                {selectedSchool.schoolType && (
                  <div className="flex items-center space-x-1">
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>{getSchoolTypeLabel(selectedSchool.schoolType)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleClearSelection}
            className="ml-3 p-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
            title="Changer d'établissement"
          >
            <X className="w-5 h-5 text-slate-500 hover:text-slate-800" />
          </button>
        </div>
      </motion.div>
    );
  }

  // ── Liste intégrée : recherche + résultats directement dans le flux ──
  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Barre de recherche */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <div
          className="w-full px-3 py-2.5 rounded-xl flex items-center gap-2 bg-white"
          style={{ border: `2px solid ${NAVY}25` }}
        >
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: NAVY }} />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un établissement..."
            className="flex-1 outline-none bg-transparent text-sm text-slate-700 placeholder-slate-400"
            autoComplete="off"
          />
          {isLoading ? (
            <Loader className="w-4 h-4 animate-spin flex-shrink-0 text-slate-400" />
          ) : isSearching ? (
            <Loader className="w-4 h-4 animate-spin flex-shrink-0 text-slate-400" />
          ) : null}
        </div>
      </div>

      {/* Compteur de résultats */}
      <div
        className="shrink-0 px-4 py-1.5 flex items-center justify-between text-xs"
        style={{ color: NAVY }}
      >
        <span className="font-medium">
          {searchQuery ? (
            <>{filteredSchools.length} résultat{filteredSchools.length > 1 ? 's' : ''}</>
          ) : (
            <>{allSchools.length} établissement{allSchools.length > 1 ? 's' : ''}</>
          )}
        </span>
      </div>

      {/* Liste des écoles — scrollable, occupe tout l'espace restant */}
      <div className="flex-1 overflow-y-auto min-h-0 px-2 pb-2">
        {fetchError && allSchools.length === 0 ? (
          /* Erreur de chargement avec retry */
          <div className="px-4 py-8 text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-3 text-amber-500" />
            <p className="text-sm font-medium text-slate-700 mb-1">Impossible de charger les établissements</p>
            <p className="text-xs text-slate-500 mb-4">{fetchError}</p>
            <button
              onClick={() => loadAllSchools()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Réessayer
            </button>
          </div>
        ) : filteredSchools.length > 0 ? (
          filteredSchools.map((school) => (
            <button
              key={school.id}
              onClick={() => handleSchoolClick(school)}
              className="school-item w-full px-3 py-2.5 flex items-center gap-3 text-left rounded-lg transition-all duration-150 border-2 border-transparent"
            >
              {school.logoUrl ? (
                <Image
                  src={school.logoUrl}
                  alt={school.name}
                  width={40}
                  height={40}
                  className="rounded-lg flex-shrink-0 object-cover"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                  style={{
                    background: `linear-gradient(135deg, ${NAVY}10, ${BLUE}15)`,
                  }}
                >
                  <Building2 className="w-5 h-5" style={{ color: NAVY }} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate transition-colors" style={{ color: NAVY }}>
                  {school.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                  {school.city && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" />
                      {school.city}
                    </span>
                  )}
                  {school.schoolType && (
                    <span className="flex items-center gap-0.5">
                      <GraduationCap className="w-3 h-3" />
                      {getSchoolTypeLabel(school.schoolType)}
                    </span>
                  )}
                  {school.country && (
                    <span className="text-slate-400">{school.country}</span>
                  )}
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-slate-500">
              {searchQuery ? (
                <>Aucun établissement trouvé pour &quot;{searchQuery}&quot;</>
              ) : (
                <>Aucun établissement disponible</>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
