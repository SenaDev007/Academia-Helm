/**
 * ============================================================================
 * SCHOOL SEARCH COMPONENT — SÉLECTEUR INTELLIGENT D'ÉTABLISSEMENT
 * ============================================================================
 *
 * Composant sélecteur avec recherche intelligente et liste complète.
 * Palette Academia Helm : Navy (#0b2f73) / Blue (#1d4fa5) / Gold (#f5b335)
 *
 * ============================================================================
 */

'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Building2, MapPin, GraduationCap, Loader, CheckCircle, ChevronDown, X } from 'lucide-react';
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
  const [showDropdown, setShowDropdown] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Liste des établissements : route App Router → BFF qui appelle Nest
  useEffect(() => {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 10000); // 10s timeout client-side
    
    const loadAllSchools = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/public/schools/list', {
          signal: abortController.signal,
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          const data = await response.json();
          setAllSchools(data);
        } else {
          console.error('Failed to load schools list');
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.warn('Schools list fetch timed out');
        } else {
          console.error('Error loading schools list:', error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadAllSchools();
    
    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, []);

  // Recherche intelligente avec debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.length > 0) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(() => {
        setIsSearching(false);
      }, 300);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
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

  // Fermer le dropdown en cliquant à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ouvrir/fermer le dropdown
  const handleToggleDropdown = () => {
    if (selectedSchool && !isOpen) {
      setSearchQuery('');
      onSchoolSelect(null);
    }
    setIsOpen(!isOpen);
    setShowDropdown(!showDropdown);
    if (!isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSchoolClick = (school: School) => {
    onSchoolSelect(school);
    setShowDropdown(false);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSchoolSelect(null);
    setSearchQuery('');
    setIsOpen(false);
    setShowDropdown(false);
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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Sélecteur avec recherche */}
      {!selectedSchool ? (
        <div className="relative">
          <div
            onClick={handleToggleDropdown}
            className="w-full px-4 py-3 rounded-xl cursor-pointer hover:border-slate-400 transition-colors flex items-center justify-between bg-white"
            style={{ border: `2px solid ${NAVY}25` }}
          >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <Search className="w-5 h-5 flex-shrink-0" style={{ color: NAVY }} />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                  setIsOpen(true);
                }}
                onFocus={() => {
                  setShowDropdown(true);
                  setIsOpen(true);
                }}
                placeholder="Rechercher ou sélectionner un établissement..."
                className="flex-1 outline-none bg-transparent text-slate-700 placeholder-slate-400"
                autoComplete="off"
              />
            </div>
            {isLoading ? (
              <Loader className="w-5 h-5 animate-spin flex-shrink-0 text-slate-400" />
            ) : (
              <ChevronDown
                className={`w-5 h-5 flex-shrink-0 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
                style={{ color: NAVY }}
              />
            )}
          </div>

          {/* Dropdown avec résultats */}
          <AnimatePresence>
            {showDropdown && (
              <motion.div
                key="school-dropdown"
                initial={reduceMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.99 }}
                transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
                className="absolute z-[200] mt-2 flex max-h-[60vh] sm:max-h-[450px] w-full flex-col overflow-hidden rounded-xl border-2 bg-white shadow-xl"
                style={{ borderColor: `${NAVY}15` }}
              >
                {/* Header avec compteur */}
                <div
                  className="px-4 py-2 border-b flex items-center justify-between"
                  style={{ background: `${NAVY}06`, borderColor: `${NAVY}12` }}
                >
                  <span className="text-sm font-medium" style={{ color: NAVY }}>
                    {searchQuery ? (
                      <>
                        {filteredSchools.length} résultat{filteredSchools.length > 1 ? 's' : ''} trouvé{filteredSchools.length > 1 ? 's' : ''}
                      </>
                    ) : (
                      <>
                        {allSchools.length} établissement{allSchools.length > 1 ? 's' : ''} disponible{allSchools.length > 1 ? 's' : ''}
                      </>
                    )}
                  </span>
                  {isSearching && (
                    <Loader className="w-4 h-4 animate-spin text-slate-400" />
                  )}
                </div>

                {/* Liste des résultats */}
                <div className="overflow-y-auto max-h-[52vh] sm:max-h-[380px]">
                  {filteredSchools.length > 0 ? (
                    filteredSchools.map((school) => (
                      <button
                        key={school.id}
                        onClick={() => handleSchoolClick(school)}
                        className="w-full px-4 py-3 hover:bg-slate-50 flex items-center space-x-3 text-left border-b border-slate-100 last:border-b-0 transition-colors group"
                      >
                        {school.logoUrl ? (
                          <Image
                            src={school.logoUrl}
                            alt={school.name}
                            width={48}
                            height={48}
                            className="rounded-lg flex-shrink-0 object-cover"
                          />
                        ) : (
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                            style={{
                              background: `linear-gradient(135deg, ${NAVY}10, ${BLUE}15)`,
                            }}
                          >
                            <Building2 className="w-6 h-6" style={{ color: NAVY }} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 truncate group-hover:text-slate-700 transition-colors">
                            {school.name}
                          </p>
                          <div className="flex items-center space-x-3 mt-1 text-sm text-slate-500">
                            {school.city && (
                              <span className="flex items-center space-x-1">
                                <MapPin className="w-3 h-3" />
                                <span>{school.city}</span>
                              </span>
                            )}
                            {school.schoolType && (
                              <span className="flex items-center space-x-1">
                                <GraduationCap className="w-3 h-3" />
                                <span>{getSchoolTypeLabel(school.schoolType)}</span>
                              </span>
                            )}
                            {school.country && (
                              <span className="text-slate-400">· {school.country}</span>
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        /* École sélectionnée */
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
                  width={56}
                  height={56}
                  className="rounded-lg flex-shrink-0 object-cover"
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${NAVY}, ${BLUE})`,
                  }}
                >
                  <Building2 className="w-7 h-7 text-white" />
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
                      <MapPin className="w-4 h-4" />
                      <span>{selectedSchool.city}</span>
                    </div>
                  )}
                  {selectedSchool.schoolType && (
                    <div className="flex items-center space-x-1">
                      <GraduationCap className="w-4 h-4" />
                      <span>{getSchoolTypeLabel(selectedSchool.schoolType)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleClearSelection}
              className="ml-4 p-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
              title="Changer d'établissement"
            >
              <X className="w-5 h-5 text-slate-500 hover:text-slate-800" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
