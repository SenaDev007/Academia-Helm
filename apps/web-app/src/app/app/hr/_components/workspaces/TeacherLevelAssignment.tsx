/**
 * ============================================================================
 * TEACHER LEVEL ASSIGNMENT - CATÉGORISATION DES ENSEIGNANTS PAR NIVEAU
 * ============================================================================
 * 
 * Système intelligent permettant de catégoriser chaque enseignant dans son
 * niveau scolaire (Maternelle, Primaire, Secondaire) dans le module RH.
 * 
 * Ces données alimentent ensuite le module Pédagogie pour l'affectation
 * au niveau des classes.
 * 
 * Design V2 : Palette officielle Academia Helm
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  Users,
  Loader2,
  Check,
  AlertTriangle,
  Search,
  Filter,
  ArrowRightLeft,
  Save,
  ChevronDown,
  Baby,
  BookOpen,
  School,
  UserCheck,
  X,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { useBilingual } from '@/contexts/BilingualContext';

// ── Types ──

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber?: string;
  globalMatricule?: string;
  position?: string;
  department?: string;
  roleType: string;
  category?: string;
  schoolLevelId?: string | null;
  schoolLevel?: {
    id: string;
    name: string;
    code: string;
  } | null;
  photoUrl?: string;
  status?: string;
  phone?: string;
  email?: string;
  /// Langues assignées : ['FR'], ['EN'], ['FR','EN'], ou null (FR+EN par défaut)
  assignedLanguages?: string[] | null;
}

/// État d'affectation pending : levelId + languages (bilingue)
interface PendingAssignment {
  levelId: string | null;
  languages?: string[];
}

interface SchoolLevelOption {
  id: string;
  code: string;
  label: string;
}

// ── Constants ──

const LEVEL_STYLES: Record<string, {
  bg: string;
  text: string;
  border: string;
  icon: any;
  gradient: string;
  dot: string;
}> = {
  MATERNELLE: {
    bg: 'bg-pink-50',
    text: 'text-pink-700',
    border: 'border-pink-200',
    icon: Baby,
    gradient: 'from-pink-500 to-rose-500',
    dot: 'bg-pink-400',
  },
  PRIMAIRE: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: BookOpen,
    gradient: 'from-emerald-500 to-green-500',
    dot: 'bg-emerald-400',
  },
  SECONDAIRE: {
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
    icon: School,
    gradient: 'from-violet-500 to-purple-500',
    dot: 'bg-violet-400',
  },
};

const LEVEL_EMPTY_STYLES = {
  bg: 'bg-gray-50',
  text: 'text-gray-500',
  border: 'border-gray-200',
  icon: GraduationCap,
  gradient: 'from-gray-400 to-gray-500',
  dot: 'bg-gray-400',
};

export function TeacherLevelAssignment() {
  const { tenant } = useModuleContext();
  const { availableLevels, currentLevel } = useSchoolLevel();
  const { isEnabled: bilingualEnabled } = useBilingual();
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [pendingAssignments, setPendingAssignments] = useState<Record<string, PendingAssignment>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Filter available levels to only school levels (not ALL)
  const schoolLevels: SchoolLevelOption[] = useMemo(() => 
    availableLevels.filter(l => l.code !== 'ALL' && l.code !== 'TOUS_LES_NIVEAUX'),
    [availableLevels]
  );

  // Load staff data (ALL staff — not just teachers, because an admin staff
  // can also teach. The director can assign any staff to a school level.)
  const loadTeachers = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    setError(null);
    try {
      // Charger TOUS les staffs actifs (pas seulement PEDAGOGICAL)
      // pour permettre à un staff admin d'être aussi enseignant
      const data = await hrFetch<StaffMember[]>(hrUrl('staff', {
        tenantId: tenant.id,
      }));
      // Filtrer côté frontend : garder seulement les staffs actifs ou en attente
      const activeStaff = (Array.isArray(data) ? data : []).filter(
        (s: any) => s.status === 'ACTIVE' || s.status === 'PENDING_SIGNATURE' || s.status === 'PENDING_HIRE'
      );
      setStaffList(activeStaff);
    } catch (err: any) {
      console.error('Error loading staff:', err);
      setError(err?.message || 'Erreur de chargement');
      toast({ variant: 'error', title: 'Erreur de chargement du personnel' });
      setStaffList([]);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  // Filtered staff based on search and level filter
  const filteredStaff = useMemo(() => {
    let result = staffList;

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(s =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        s.employeeNumber?.toLowerCase().includes(q) ||
        s.position?.toLowerCase().includes(q) ||
        s.department?.toLowerCase().includes(q)
      );
    }

    // Filter by level
    if (selectedLevel) {
      result = result.filter(s => {
        const effectiveLevel = pendingAssignments[s.id] !== undefined
          ? pendingAssignments[s.id].levelId
          : s.schoolLevelId;
        if (selectedLevel === 'UNASSIGNED') {
          return !effectiveLevel;
        }
        return effectiveLevel === selectedLevel;
      });
    }

    return result;
  }, [staffList, searchQuery, selectedLevel, pendingAssignments]);

  // Get the effective level for a staff member (pending or current)
  // ⚠️ Important: staff.schoolLevelId is a SchoolLevel.id (stored by backend),
  // but schoolLevels array contains EducationLevel entries with different IDs.
  // We must match by `code` (e.g. 'MATERNELLE', 'PRIMAIRE', 'SECONDAIRE') which is
  // the same in both SchoolLevel.code and EducationLevel.code/name.
  const getEffectiveLevel = (staff: StaffMember): SchoolLevelOption | null => {
    // If there's a pending assignment, use it directly (EducationLevel.id)
    if (pendingAssignments[staff.id] !== undefined) {
      const pendingId = pendingAssignments[staff.id].levelId;
      if (!pendingId) return null;
      return schoolLevels.find(l => l.id === pendingId) || null;
    }
    // No pending assignment — use the stored schoolLevel
    if (!staff.schoolLevelId) return null;
    // Try matching by ID first (in case they're the same)
    const byId = schoolLevels.find(l => l.id === staff.schoolLevelId);
    if (byId) return byId;
    // Match by code: staff.schoolLevel.code === schoolLevel.code
    if (staff.schoolLevel?.code) {
      const byCode = schoolLevels.find(l => l.code === staff.schoolLevel!.code);
      if (byCode) return byCode;
    }
    return null;
  };

  // Build a code → EducationLevel.id map for resolving stored SchoolLevel.ids
  const codeToEduLevelId = useMemo(() => {
    const m: Record<string, string> = {};
    schoolLevels.forEach(l => { m[l.code] = l.id; });
    return m;
  }, [schoolLevels]);

  const levelStats = useMemo(() => {
    const stats: Record<string, number> = { UNASSIGNED: 0 };
    schoolLevels.forEach(l => { stats[l.id] = 0; });

    staffList.forEach(s => {
      let effectiveLevel: string | null = null;
      if (pendingAssignments[s.id] !== undefined) {
        // Pending: EducationLevel.id (direct match)
        effectiveLevel = pendingAssignments[s.id].levelId;
      } else if (s.schoolLevelId) {
        // Stored: SchoolLevel.id — try direct match, else match by code
        if (stats[s.schoolLevelId] !== undefined) {
          effectiveLevel = s.schoolLevelId;
        } else if (s.schoolLevel?.code && codeToEduLevelId[s.schoolLevel.code]) {
          effectiveLevel = codeToEduLevelId[s.schoolLevel.code];
        }
      }
      if (effectiveLevel && stats[effectiveLevel] !== undefined) {
        stats[effectiveLevel]++;
      } else {
        stats.UNASSIGNED++;
      }
    });

    return stats;
  }, [staffList, schoolLevels, pendingAssignments, codeToEduLevelId]);

  // Handle level assignment for a single teacher
  const handleAssignLevel = (staffId: string, levelId: string | null) => {
    const staff = staffList.find(s => s.id === staffId);
    // Compare the effective level (resolved via code) to detect if there's actually a change
    const currentEffective = getEffectiveLevel(staff || {} as StaffMember);
    const currentLevelId = currentEffective?.id || null;

    setPendingAssignments(prev => {
      const newAssignments = { ...prev };
      // If the new value is the same as the original, remove the pending change
      if (levelId === currentLevelId) {
        delete newAssignments[staffId];
      } else {
        // Préserver les languages pending si déjà définis, sinon null
        const existingLanguages = newAssignments[staffId]?.languages;
        newAssignments[staffId] = { levelId, languages: existingLanguages };
      }
      return newAssignments;
    });
  };

  // Handle language toggle for a single teacher (bilingue)
  const handleToggleLanguage = (staffId: string, lang: 'FR' | 'EN') => {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) return;

    // Langues actuelles (pending si défini, sinon staff.assignedLanguages, sinon ['FR','EN'] défaut)
    const pending = pendingAssignments[staffId];
    const currentLangs = pending?.languages
      ?? staff.assignedLanguages
      ?? ['FR', 'EN'];

    // Toggle
    const newLangs = currentLangs.includes(lang)
      ? currentLangs.filter((l) => l !== lang)
      : [...currentLangs, lang];

    // Si vide, on remet FR par défaut (au moins une langue requise)
    const finalLangs = newLangs.length === 0 ? ['FR'] : newLangs;

    setPendingAssignments(prev => {
      const newAssignments = { ...prev };
      const currentLevelId = getEffectiveLevel(staff)?.id || null;
      const pendingLevel = newAssignments[staffId]?.levelId ?? currentLevelId;

      // Si pas de changement (level identique + languages identiques), on supprime le pending
      const originalLangs = staff.assignedLanguages ?? ['FR', 'EN'];
      if (pendingLevel === currentLevelId && arraysEqual(finalLangs, originalLangs)) {
        delete newAssignments[staffId];
      } else {
        newAssignments[staffId] = { levelId: pendingLevel, languages: finalLangs };
      }
      return newAssignments;
    });
  };

  // Helper : comparaison de tableaux de strings
  function arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((v, i) => v === sortedB[i]);
  }

  // Check if there are unsaved changes
  useEffect(() => {
    setHasChanges(Object.keys(pendingAssignments).length > 0);
  }, [pendingAssignments]);

  // Save all pending assignments
  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);

    try {
      // Stratégie : une requête par staff (plus simple avec les languages qui varient)
      // L'API batch-assign-level accepte maintenant languages[] dans le body.
      for (const [staffId, assignment] of Object.entries(pendingAssignments)) {
        const { levelId, languages } = assignment;
        if (!levelId) {
          // Unassign : schoolLevelId = null
          await hrFetch(hrUrl(`staff/${staffId}`), {
            method: 'PUT',
            body: {
              schoolLevelId: null,
              ...(languages !== undefined ? { assignedLanguages: languages } : {}),
            },
          });
        } else {
          // Assign : utiliser batch-assign-level avec 1 staff + languages
          await hrFetch(hrUrl('staff/batch-assign-level'), {
            method: 'PUT',
            body: {
              staffIds: [staffId],
              schoolLevelId: levelId,
              ...(languages !== undefined ? { languages } : {}),
            },
          });
        }
      }

      toast({ variant: 'success', title: 'Affectations enregistrées avec succès' });
      setPendingAssignments({});
      setHasChanges(false);
      // Force reload with cache-busting
      setLoading(true);
      await loadTeachers();
      // Additional reload after a short delay to ensure DB commit is visible
      setTimeout(() => loadTeachers(), 500);
    } catch (err: any) {
      console.error('Error saving assignments:', err);
      toast({ variant: 'error', title: 'Erreur lors de la sauvegarde', description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  // Get level style
  const getLevelStyle = (code: string) => LEVEL_STYLES[code] || LEVEL_EMPTY_STYLES;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Affectation par niveau scolaire</h3>
          <p className="text-sm text-gray-500 mt-1">
            Catégorisez chaque collaborateur dans son niveau pour faciliter l&apos;affectation aux classes dans le module Pédagogie. Un membre de l&apos;administration peut aussi enseigner — assignez-lui un niveau.
          </p>
        </div>
        {hasChanges && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-blue-800 to-blue-900 text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-900/20 hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? 'Enregistrement...' : 'Enregistrer les affectations'}</span>
            <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-md text-xs">
              {Object.keys(pendingAssignments).length}
            </span>
          </motion.button>
        )}
      </div>

      {/* Level Distribution Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Unassigned card */}
        <button
          onClick={() => setSelectedLevel(selectedLevel === 'UNASSIGNED' ? null : 'UNASSIGNED')}
          className={cn(
            'relative p-4 rounded-xl border-2 transition-all duration-200 text-left',
            selectedLevel === 'UNASSIGNED'
              ? 'border-gray-400 bg-gray-50 shadow-md'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
          )}
        >
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-gray-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{levelStats.UNASSIGNED}</p>
          <p className="text-xs text-gray-500 font-medium mt-0.5">Non affectés</p>
          {selectedLevel === 'UNASSIGNED' && (
            <div className="absolute top-2 right-2 w-2 h-2 bg-gray-500 rounded-full" />
          )}
        </button>

        {/* Level cards */}
        {schoolLevels.map((level) => {
          const style = getLevelStyle(level.code);
          const Icon = style.icon;
          const count = levelStats[level.id] || 0;
          const isSelected = selectedLevel === level.id;

          return (
            <button
              key={level.id}
              onClick={() => setSelectedLevel(isSelected ? null : level.id)}
              className={cn(
                'relative p-4 rounded-xl border-2 transition-all duration-200 text-left',
                isSelected
                  ? `${style.border} ${style.bg} shadow-md`
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              )}
            >
              <div className="flex items-center space-x-2 mb-2">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', style.bg)}>
                  <Icon className={cn('w-4 h-4', style.text)} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <p className={cn('text-xs font-medium mt-0.5', style.text)}>{level.label}</p>
              {isSelected && (
                <div className={cn('absolute top-2 right-2 w-2 h-2 rounded-full', style.dot)} />
              )}
            </button>
          );
        })}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un enseignant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setSelectedLevel(null)}
          className={cn(
            'flex items-center space-x-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all',
            !selectedLevel
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          )}
        >
          <Filter className="w-4 h-4" />
          <span>Tous ({staffList.length})</span>
        </button>
      </div>

      {/* Info Banner */}
      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center space-x-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl"
        >
          <Info className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{Object.keys(pendingAssignments).length} modification(s)</span> en attente.
            Cliquez sur &quot;Enregistrer les affectations&quot; pour appliquer.
          </p>
        </motion.div>
      )}

      {/* Staff List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
          <p className="text-sm text-gray-500">Chargement des enseignants...</p>
        </div>
      ) : error ? (
        <div className="text-center py-16 bg-red-50 rounded-2xl border border-red-100">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="font-semibold text-red-700">Erreur de chargement</p>
          <p className="text-sm text-red-500 mt-1">{error}</p>
          <button
            onClick={loadTeachers}
            className="mt-4 px-4 py-2 bg-blue-900 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition"
          >
            Réessayer
          </button>
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">
            {searchQuery || selectedLevel ? 'Aucun enseignant trouvé' : 'Aucun enseignant enregistré'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {searchQuery || selectedLevel
              ? 'Modifiez vos critères de recherche'
              : 'Ajoutez du personnel enseignant dans l\'onglet Personnel'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredStaff.map((staff) => {
              const effectiveLevel = getEffectiveLevel(staff);
              const levelStyle = effectiveLevel ? getLevelStyle(effectiveLevel.code) : LEVEL_EMPTY_STYLES;
              const LevelIcon = levelStyle.icon;
              const isPending = pendingAssignments[staff.id] !== undefined;

              return (
                <motion.div
                  key={staff.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={cn(
                    'bg-white rounded-xl border transition-all duration-200',
                    isPending ? 'border-gold-300 shadow-md ring-1 ring-gold-200/50' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  )}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* Avatar */}
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0',
                      effectiveLevel ? `${levelStyle.bg} ${levelStyle.text}` : 'bg-gray-100 text-gray-500'
                    )}>
                      {staff.firstName?.[0]}{staff.lastName?.[0]}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {staff.firstName} {staff.lastName}
                        </p>
                        {isPending && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 bg-gold-100 text-gold-700 text-[10px] font-bold rounded-md uppercase">
                            Modifié
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {staff.position || 'Enseignant'} {staff.employeeNumber && `· ${staff.employeeNumber}`}
                      </p>
                    </div>

                    {/* Level Selector */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {schoolLevels.map((level) => {
                        const style = getLevelStyle(level.code);
                        const Icon = style.icon;
                        const isActive = effectiveLevel?.id === level.id;
                        const isPendingLevel = pendingAssignments[staff.id]?.levelId === level.id;

                        return (
                          <button
                            key={level.id}
                            onClick={() => handleAssignLevel(staff.id, isActive ? null : level.id)}
                            title={`Affecter à ${level.label}`}
                            className={cn(
                              'relative p-2 rounded-lg transition-all duration-200 min-w-[40px] min-h-[40px] flex items-center justify-center',
                              isActive
                                ? `${style.bg} ${style.border} border shadow-sm`
                                : 'hover:bg-gray-50 border border-transparent'
                            )}
                          >
                            <Icon className={cn(
                              'w-4 h-4 transition-all',
                              isActive ? style.text : 'text-gray-300 hover:text-gray-500'
                            )} />
                            {isActive && (
                              <div className={cn('absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full', style.dot)} />
                            )}
                            {isPendingLevel && !isActive && (
                              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-gold-500 rounded-full" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Langues (bilingue) — visible uniquement si bilingue activé */}
                  {bilingualEnabled && effectiveLevel && (
                    <div className="mt-2 flex items-center gap-2 px-2 py-1.5 bg-blue-50/50 rounded-lg border border-blue-100">
                      <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Langue :</span>
                      {(['FR', 'EN'] as const).map((lang) => {
                        const pending = pendingAssignments[staff.id];
                        const currentLangs = pending?.languages
                          ?? staff.assignedLanguages
                          ?? ['FR', 'EN'];
                        const isLangActive = currentLangs.includes(lang);
                        const isLangPending = pending?.languages !== undefined
                          && pending.languages !== (staff.assignedLanguages ?? ['FR', 'EN']);
                        return (
                          <button
                            key={lang}
                            onClick={() => handleToggleLanguage(staff.id, lang)}
                            className={cn(
                              'px-2 py-0.5 rounded text-[10px] font-bold transition-all',
                              isLangActive
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-white text-blue-400 border border-blue-200 hover:bg-blue-50',
                              isLangPending && 'ring-1 ring-amber-400',
                            )}
                            title={isLangActive ? `Désactiver ${lang}` : `Activer ${lang}`}
                          >
                            {lang}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Summary Footer */}
      {!loading && staffList.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-xs text-gray-500">
            <span className="font-semibold text-gray-700">{staffList.length}</span> enseignant(s) au total
            {levelStats.UNASSIGNED > 0 && (
              <span className="ml-2 text-amber-600">
                · <span className="font-semibold">{levelStats.UNASSIGNED}</span> non affecté(s)
              </span>
            )}
          </p>
          {hasChanges && (
            <button
              onClick={() => setPendingAssignments({})}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium"
            >
              Annuler les modifications
            </button>
          )}
        </div>
      )}
    </div>
  );
}


