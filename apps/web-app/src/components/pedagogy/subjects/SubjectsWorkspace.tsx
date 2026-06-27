/**
 * ============================================================================
 * SUBJECTS WORKSPACE - MODULE 2 (Matières & Programmes)
 * ============================================================================
 * 
 * Espace de travail institutionnel pour :
 * 1. Catalogue des matières (Catalogue)
 * 2. Séries du secondaire (A, C, D, G2...)
 * 3. Affectations par classe (Coefficients, Volumes horaires)
 * 4. Programmes officiels (Upload PDF)
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Plus, 
  BookOpen, 
  Layers, 
  FileText, 
  Search, 
  Edit, 
  Trash2, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Info,
  Sparkles,
  ArrowUpRight,
  Filter,
  Download,
  Loader2,
  ClipboardList,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FormModal, 
  ConfirmModal, 
  ReadOnlyModal 
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAuth } from '@/hooks/useAuth';
import { useBilingual } from '@/contexts/BilingualContext';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { compressImageFileToDataUrl } from '@/lib/media';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const PRIMARY = '#1A2BA6';
const ACCENT = '#F5A623';

// --- Catalogue de matières par défaut (suggestions dans le modal) ---
// Structure : { name, code (abrév + numéro), abbreviation }
const DEFAULT_SUBJECTS_CATALOGUE: Record<
  string,
  Array<{ name: string; code: string; abbreviation: string }>
> = {
  MATERNELLE: [
    { name: 'Éducation pour la santé',              abbreviation: 'ES',   code: 'ES-01'   },
    { name: 'Éducation à des réflexions de santé',  abbreviation: 'ERS',  code: 'ERS-02'  },
    { name: 'Éducation du mouvement',               abbreviation: 'EM',   code: 'EM-03'   },
    { name: 'Gestuelle',                            abbreviation: 'GEST', code: 'GEST-04' },
    { name: 'Rythmique',                            abbreviation: 'RYTH', code: 'RYTH-05' },
    { name: 'Observation',                          abbreviation: 'OBS',  code: 'OBS-06'  },
    { name: 'Éducation sensorielle',                abbreviation: 'ESENS',code: 'ESENS-07'},
    { name: 'Pré-lecture',                          abbreviation: 'PLEC', code: 'PLEC-08' },
    { name: 'Pré-écriture',                         abbreviation: 'PECR', code: 'PECR-09' },
    { name: 'Pré-mathématique',                     abbreviation: 'PMAT', code: 'PMAT-10' },
    { name: 'Expression plastique',                 abbreviation: 'EP',   code: 'EP-11'   },
    { name: 'Expression émotionnelle',              abbreviation: 'EE',   code: 'EE-12'   },
    { name: 'Langage',                              abbreviation: 'LANG', code: 'LANG-13' },
    { name: 'Conte',                                abbreviation: 'CONT', code: 'CONT-14' },
    { name: 'Comptine',                             abbreviation: 'COMP', code: 'COMP-15' },
    { name: 'Poésie',                               abbreviation: 'POES', code: 'POES-16' },
    { name: 'Chant',                                abbreviation: 'CHAN', code: 'CHAN-17' },
  ],
  PRIMAIRE: [
    { name: 'Expression Écrite',                         abbreviation: 'EE',   code: 'EE-01'   },
    { name: 'Lecture',                                   abbreviation: 'LECT', code: 'LECT-02' },
    { name: 'Dictée',                                    abbreviation: 'DICT', code: 'DICT-03' },
    { name: 'Mathématiques',                             abbreviation: 'MATH', code: 'MATH-04' },
    { name: 'Éducation Scientifique et Technologique',   abbreviation: 'EST',  code: 'EST-05'  },
    { name: 'Éducation Sociale',                         abbreviation: 'ES',   code: 'ES-06'   },
    { name: 'Éducation Artistique (EA) Vivant',          abbreviation: 'EAV',  code: 'EAV-07'  },
    { name: 'Éducation Artistique (EA) Plastique',       abbreviation: 'EAP',  code: 'EAP-08'  },
    { name: 'Éducation Physique et Sportive',            abbreviation: 'EPS',  code: 'EPS-09'  },
  ],
  SECONDAIRE: [
    { name: 'Communication Écrite',                      abbreviation: 'CE',   code: 'CE-01'   },
    { name: 'Lecture',                                   abbreviation: 'LECT', code: 'LECT-02' },
    { name: 'Anglais',                                   abbreviation: 'ANG',  code: 'ANG-03'  },
    { name: 'Français',                                  abbreviation: 'FR',   code: 'FR-04'   },
    { name: 'Espagnol',                                  abbreviation: 'ESP',  code: 'ESP-05'  },
    { name: 'Allemand',                                  abbreviation: 'ALL',  code: 'ALL-06'  },
    { name: 'Mathématiques',                             abbreviation: 'MATH', code: 'MATH-07' },
    { name: 'Physique Chimie et Technologie',            abbreviation: 'PCT',  code: 'PCT-08'  },
    { name: 'Science de la Vie et de la Terre',          abbreviation: 'SVT',  code: 'SVT-09'  },
    { name: 'Éducation Physique et Sportive',            abbreviation: 'EPS',  code: 'EPS-10'  },
  ],
};

// --- Catalogue de matières par défaut pour l'ANGLAIS (EN) ---
// Liste exacte fournie par l'utilisateur (pas une traduction du FR).
// Appliquée à tous les niveaux (Maternelle/Primaire/Secondaire) en mode EN.
const DEFAULT_SUBJECTS_CATALOGUE_EN: Array<{ name: string; code: string; abbreviation: string }> = [
  { name: 'Mathematics',                              abbreviation: 'MATH', code: 'MATH-EN-01' },
  { name: 'English Language',                         abbreviation: 'ENG',  code: 'ENG-EN-02'  },
  { name: 'Basic Science',                            abbreviation: 'BS',   code: 'BS-EN-03'   },
  { name: 'Social Studies',                           abbreviation: 'SST',  code: 'SST-EN-04'  },
  { name: 'Agricultural Science',                     abbreviation: 'AGR',  code: 'AGR-EN-05'  },
  { name: 'Computer Science',                         abbreviation: 'CS',   code: 'CS-EN-06'   },
  { name: 'Civic Education',                          abbreviation: 'CIV',  code: 'CIV-EN-07'  },
  { name: 'Verbal Reasoning',                         abbreviation: 'VR',   code: 'VR-EN-08'   },
  { name: 'Quantitative Reasoning',                   abbreviation: 'QR',   code: 'QR-EN-09'   },
  { name: 'Cultural and Creative Arts (CCA)',         abbreviation: 'CCA',  code: 'CCA-EN-10'  },
  { name: 'Christian Religious Knowledge (CRK)',      abbreviation: 'CRK',  code: 'CRK-EN-11'  },
  { name: 'Handwriting',                              abbreviation: 'HW',   code: 'HW-EN-12'   },
  { name: 'Drawing',                                  abbreviation: 'DRW',  code: 'DRW-EN-13'  },
  { name: 'Physical and Health Education (PHE)',      abbreviation: 'PHE',  code: 'PHE-EN-14'  },
];


/** Résout un SchoolLevel vers la clé de catalogue (MATERNELLE | PRIMAIRE | SECONDAIRE | null) */
function resolveLevelKey(level?: { code?: string; name?: string; label?: string }): string | null {
  if (!level) return null;
  const haystack = `${level.code ?? ''} ${level.name ?? ''} ${level.label ?? ''}`.toUpperCase();
  if (haystack.includes('MATERN')) return 'MATERNELLE';
  if (haystack.includes('PRIMA') || haystack.includes('PRIM')) return 'PRIMAIRE';
  if (haystack.includes('SECOND') || haystack.includes('SEC') || haystack.includes('LYCEE') || haystack.includes('LYCEA')) return 'SECONDAIRE';
  return null;
}

// --- Types ---

interface Subject {
  id: string;
  name: string;
  code: string;
  abbreviation?: string;
  coefficient: number;
  weeklyHours?: number;
  description?: string;
  language?: string;
  schoolLevelId?: string;
  schoolLevel?: { id: string; name?: string; label: string; code: string };
  programs?: SubjectProgram[];
}

interface AcademicSeries {
  id: string;
  name: string;
  description?: string;
  level?: { id: string; name: string };
}

interface SubjectProgram {
  id: string;
  subjectId: string;
  documentUrl: string;
  version: string;
  approvedAt?: string;
}

// --- Tabs ---
type SubTab = 'catalogue' | 'classes' | 'programs';

export default function SubjectsWorkspace() {
  const { academicYear, tenantId } = useModuleContext();
  const { user } = useAuth();
  const { isEnabled: bilingualEnabled, currentTrack, setCurrentTrack } = useBilingual();
  const { toast } = useToast();
  const [tab, setTab] = useState<SubTab>('catalogue');
  const [loading, setLoading] = useState(false);

  // Data
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [schoolLevels, setSchoolLevels] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  // Class-Subject Assignments Map
  const [classSubjectsMap, setClassSubjectsMap] = useState<Record<string, any[]>>({});
  const [loadingClassSubjects, setLoadingClassSubjects] = useState(false);

  // Form states
  const [subjectForm, setSubjectForm] = useState({
    id: '',
    code: '',
    name: '',
    abbreviation: '',
    coefficient: 1,
    weeklyHours: 4,
    schoolLevelId: '',
    description: '',
    language: '' as string,
  });

  // Mass Assignment State
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [massConfig, setMassConfig] = useState({
    weeklyHours: 0,
    coefficient: 1.0,
    useSeries: true
  });

  // Class filtering for mass assignment
  const [filterClassLevelId, setFilterClassLevelId] = useState<string>('');
  const [filterClassSeriesId, setFilterClassSeriesId] = useState<string>('');

  // Filtre par niveau scolaire sur le tableau catalogue
  const [filterLevelId, setFilterLevelId] = useState<string>('ALL');

  /** Noms des niveaux actifs (depuis /api/school-levels) en uppercase pour matching */
  const activeLevelNames = useMemo(() => {
    return schoolLevels.map((l: any) => (l.code || l.label || '').toUpperCase());
  }, [schoolLevels]);

  /** Vérifie si un niveau (par nom/code) est actif */
  const isLevelActive = useCallback((levelName: string | undefined | null): boolean => {
    if (!levelName) return true;
    if (activeLevelNames.length === 0) return true;
    const name = levelName.toUpperCase();
    return activeLevelNames.some(
      (active: string) => name.includes(active) || active.includes(name),
    );
  }, [activeLevelNames]);

  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      // Filtrer par niveau actif (Paramètres > Structure)
      const classLevelName = (c as any).level?.name || (c as any).level?.label;
      if (!isLevelActive(classLevelName)) return false;

      if (filterClassLevelId && c.levelId !== filterClassLevelId && c.level?.id !== filterClassLevelId) {
        return false;
      }
      if (filterClassSeriesId && c.seriesId !== filterClassSeriesId && c.series?.id !== filterClassSeriesId) {
        return false;
      }
      return true;
    });
  }, [classes, filterClassLevelId, filterClassSeriesId, isLevelActive]);

  // Modal state
  const [modal, setModal] = useState<'none' | 'create-subject' | 'edit-subject' | 'mass-assignment'>('none');

  const [uploading, setUploading] = useState(false);

  // Confirmation states
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [assignmentToRemove, setAssignmentToRemove] = useState<{ id: string; name: string } | null>(null);

  // Multi-sélection des suggestions de matières par défaut
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  // Sélection multiple pour la suppression dans le tableau
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  /** Lien Paramètres → onglet Structure (activation des niveaux officiels). */
  const settingsHref = useMemo(() => {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenant_id', tenantId);
    params.set('tab', 'structure');
    const q = params.toString();
    return `/app/settings${q ? `?${q}` : ''}`;
  }, [tenantId]);

  const selectedLevelObj = useMemo(() => {
    return schoolLevels.find(l => l.id === subjectForm.schoolLevelId);
  }, [subjectForm.schoolLevelId, schoolLevels]);

  const isPrimaryOrMaternelle = useMemo(() => {
    if (!selectedLevelObj) return false;
    const nameOrLabel = (selectedLevelObj.name || selectedLevelObj.label || '').toLowerCase();
    const code = (selectedLevelObj.code || '').toUpperCase();
    return nameOrLabel.includes('maternelle') || 
           nameOrLabel.includes('primaire') || 
           code.startsWith('MAT') || 
           code.startsWith('PRI');
  }, [selectedLevelObj]);

  /** Suggestions de matières pour le niveau sélectionné dans le modal */
  const defaultSuggestionsForLevel = useMemo(() => {
    // En mode EN, on utilise le catalogue anglais (liste exacte fournie par l'utilisateur)
    if (bilingualEnabled && currentTrack === 'EN') {
      return DEFAULT_SUBJECTS_CATALOGUE_EN;
    }
    // En mode FR (ou bilingue désactivé), on utilise le catalogue français par niveau
    const key = resolveLevelKey(selectedLevelObj);
    return key ? DEFAULT_SUBJECTS_CATALOGUE[key] ?? [] : [];
  }, [selectedLevelObj, bilingualEnabled, currentTrack]);

  /** Séries filtrées par niveaux actifs (le secondaire doit être actif) */
  const filteredSeries = useMemo(() => {
    const secondaryActive = activeLevelNames.some((n: string) => n.includes('SECONDAIRE'));
    if (!secondaryActive) return [];
    return series;
  }, [series, activeLevelNames]);

  /** Matières filtrées par niveau actif + niveau sélectionné + recherche textuelle */
  const filteredSubjects = useMemo(() => {
    return subjects.filter((s: any) => {
      // 1. Filtrer par niveau actif (Paramètres > Structure)
      const subjectLevelName = s.schoolLevel?.name || s.schoolLevel?.label || s.schoolLevel?.code;
      if (!isLevelActive(subjectLevelName)) return false;

      // 2. Filtrer par recherche textuelle
      const matchesSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase()) ||
        (s.abbreviation ?? '').toLowerCase().includes(search.toLowerCase());

      // 3. Filtrer par niveau sélectionné (chip)
      // IMPORTANT : on compare par CODE (ex: 'MATERNELLE') et non par ID, car
      // les chips utilisent schoolLevels (de /api/school-levels = EducationLevel)
      // dont les IDs diffèrent de SchoolLevel.id utilisé par les subjects.
      const selectedLevel = schoolLevels.find(l => l.id === filterLevelId);
      const matchesLevel =
        filterLevelId === 'ALL' ||
        s.schoolLevel?.id === filterLevelId ||
        s.schoolLevelId === filterLevelId ||
        (selectedLevel && s.schoolLevel?.code === selectedLevel.code);
      return matchesSearch && matchesLevel;
    });
  }, [subjects, search, filterLevelId, isLevelActive, activeLevelNames, schoolLevels]);

  // Réinitialiser la sélection quand le niveau change ou quand on ferme le modal
  useEffect(() => {
    setSelectedSuggestions(new Set());
  }, [subjectForm.schoolLevelId, modal]);

  useEffect(() => {
    if (isPrimaryOrMaternelle && !subjectForm.id) {
      setSubjectForm(prev => ({ ...prev, coefficient: 1 }));
    }
  }, [isPrimaryOrMaternelle, subjectForm.id]);

  // --- Loaders ---

  const loadSubjects = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ academicYearId: academicYear.id });
      if (bilingualEnabled) params.append('language', currentTrack);
      const result = await pedagogyFetch<Subject[]>(`/api/subjects?${params.toString()}`);
      const data = Array.isArray(result) ? result : [];
      setSubjects(data);
    } catch (e) {
      console.error('[SubjectsWorkspace] Failed to load subjects:', e);
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, bilingualEnabled, currentTrack]);

  const loadClasses = useCallback(async () => {
    if (!academicYear?.id) return;
    try {
      const data = await pedagogyFetch<any[]>(`/api/pedagogy/academic-classes?academicYearId=${academicYear.id}`);
      setClasses(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  }, [academicYear?.id]);

  const loadSchoolLevels = useCallback(async () => {
    try {
      const res = await fetch('/api/school-levels', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSchoolLevels(data || []);
      }
    } catch (e) {
      console.error('Error loading school levels:', e);
    }
  }, []);

  const loadSeries = useCallback(async () => {
    if (!academicYear?.id) return;
    try {
      const data = await pedagogyFetch<any[]>(`/api/pedagogy/academic-series?academicYearId=${academicYear.id}`);
      setSeries(data || []);
    } catch (e) {
      console.error('Error loading series:', e);
    }
  }, [academicYear?.id]);

  const loadClassSubjects = useCallback(async () => {
    if (!academicYear?.id || classes.length === 0) return;
    setLoadingClassSubjects(true);
    try {
      const map: Record<string, any[]> = {};
      await Promise.all(
        classes.map(async (cls) => {
          try {
            const data = await pedagogyFetch<any[]>(`/api/pedagogy/class-subjects?classId=${cls.id}&academicYearId=${academicYear.id}`);
            map[cls.id] = data || [];
          } catch (err) {
            console.error(`Failed to load subjects for class ${cls.id}`, err);
            map[cls.id] = [];
          }
        })
      );
      setClassSubjectsMap(map);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingClassSubjects(false);
    }
  }, [academicYear?.id, classes]);

  useEffect(() => {
    loadSubjects();
    loadClasses();
    loadSchoolLevels();
    loadSeries();
  }, [loadSubjects, loadClasses, loadSchoolLevels, loadSeries]);

  useEffect(() => {
    if (classes.length > 0) {
      loadClassSubjects();
    } else {
      setClassSubjectsMap({});
    }
  }, [classes, loadClassSubjects]);

  const handleMassAssign = async () => {
     if (selectedClasses.length === 0 || selectedSubjects.length === 0) return;
     try {
       await pedagogyFetch('/api/pedagogy/class-subjects/bulk', {
         method: 'POST',
         body: {
          academicYearId: academicYear?.id,
          classIds: selectedClasses,
          subjectIds: selectedSubjects,
          weeklyHours: massConfig.weeklyHours,
          coefficient: massConfig.coefficient,
          useSeriesCoefficients: massConfig.useSeries
        }
       });
       toast({
         title: "Succès",
         description: "Affectation en masse effectuée avec succès.",
       });
       setModal('none');
       setSelectedClasses([]);
       setSelectedSubjects([]);
       loadSubjects();
       loadClassSubjects();
     } catch (e: any) {
       toast({
         title: "Erreur",
         description: e.message || "Impossible de réaliser l'affectation.",
         variant: "destructive"
       });
     }
  };

  const handleRemoveClassSubject = async (assignmentId: string) => {
    // Mise à jour optimiste immédiate dans le state local
    setClassSubjectsMap(prev => {
      const next = { ...prev };
      for (const classId in next) {
        next[classId] = next[classId].filter((cs: any) => cs.id !== assignmentId);
      }
      return next;
    });
    try {
      await pedagogyFetch(`/api/pedagogy/class-subjects/${assignmentId}`, { method: 'DELETE' });
      toast({
        title: "Succès",
        description: "Matière retirée de la classe.",
      });
      loadClassSubjects();
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Impossible de retirer la matière.",
        variant: "destructive"
      });
      loadClassSubjects(); // Recharger le vrai état en cas d'erreur
    }
  };

  const handleSaveSubject = async () => {
    // Si des suggestions sont sélectionnées, on fait une création multiple
    if (modal === 'create-subject' && selectedSuggestions.size > 0) {
      await handleBulkCreateSuggestions();
      return;
    }

    if (!subjectForm.code.trim() || !subjectForm.name.trim() || !subjectForm.schoolLevelId) {
      toast({
        title: "Champs manquants",
        description: "Veuillez remplir le code, le nom et sélectionner un niveau.",
        variant: "destructive"
      });
      return;
    }
    try {
      if (modal === 'create-subject') {
        const created = await pedagogyFetch<any>(`/api/subjects`, { method: 'POST', body: {
          academicYearId: academicYear?.id,
          schoolLevelId: subjectForm.schoolLevelId,
          code: subjectForm.code.trim(),
          name: subjectForm.name.trim(),
          abbreviation: subjectForm.abbreviation.trim() || undefined,
          coefficient: Number(subjectForm.coefficient) || 1.0,
          weeklyHours: Number(subjectForm.weeklyHours) || 0,
          description: subjectForm.description,
          ...(bilingualEnabled ? { language: currentTrack } : {}),
        }});
        // ─── Insertion optimiste ──
        // createEntityOffline met la matière dans l'outbox (sync async).
        // On l'ajoute immédiatement au state local pour qu'elle apparaisse
        // dans le catalogue sans attendre la synchronisation serveur.
        if (created) {
          const optimisticSubject = {
            id: created.id || `temp-${Date.now()}`,
            academicYearId: academicYear?.id,
            schoolLevelId: subjectForm.schoolLevelId,
            code: subjectForm.code.trim(),
            name: subjectForm.name.trim(),
            abbreviation: subjectForm.abbreviation.trim() || undefined,
            coefficient: Number(subjectForm.coefficient) || 1.0,
            weeklyHours: Number(subjectForm.weeklyHours) || 0,
            description: subjectForm.description,
            schoolLevel: schoolLevels.find((l) => l.id === subjectForm.schoolLevelId) || null,
            ...(bilingualEnabled ? { language: currentTrack } : {}),
          } as any;
          setSubjects(prev => [optimisticSubject, ...prev] as any);
        }
        toast({
          title: "Succès",
          description: "La matière a été créée.",
        });
      } else {
        await pedagogyFetch(`/api/subjects/${subjectForm.id}`, { method: 'PATCH', body: {
          code: subjectForm.code.trim(),
          name: subjectForm.name.trim(),
          abbreviation: subjectForm.abbreviation.trim() || undefined,
          coefficient: Number(subjectForm.coefficient) || 1.0,
          weeklyHours: Number(subjectForm.weeklyHours) || 0,
          description: subjectForm.description,
          ...(bilingualEnabled ? { language: currentTrack } : {}),
        }});
        // Mise à jour optimiste
        setSubjects((prev: any) => prev.map((s: any) => s.id === subjectForm.id ? {
          ...s,
          code: subjectForm.code.trim(),
          name: subjectForm.name.trim(),
          abbreviation: subjectForm.abbreviation.trim() || undefined,
          coefficient: Number(subjectForm.coefficient) || 1.0,
          weeklyHours: Number(subjectForm.weeklyHours) || 0,
          description: subjectForm.description,
          ...(bilingualEnabled ? { language: currentTrack } : {}),
        } : s));
        toast({
          title: "Succès",
          description: "La matière a été mise à jour.",
        });
      }
      setModal('none');
      loadSubjects();
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Une erreur est survenue.",
        variant: "destructive"
      });
    }
  };

  /**
   * Enregistrement groupé des matières sélectionnées dans le panneau de suggestions.
   * Chaque matière est créée séquentiellement ; les doublons sont ignorés silencieusement.
   * Les valeurs de coefficient et volume horaire hebdomadaire sont lues depuis le formulaire.
   */
  const handleBulkCreateSuggestions = async () => {
    if (selectedSuggestions.size === 0 || !subjectForm.schoolLevelId || !academicYear?.id) return;
    setBulkSaving(true);
    const toCreate = defaultSuggestionsForLevel.filter(s => selectedSuggestions.has(s.code));
    // Lire les valeurs communes depuis le formulaire (définies par l'utilisateur)
    const bulkCoefficient = Number(subjectForm.coefficient) || 1.0;
    const bulkWeeklyHours = Number(subjectForm.weeklyHours) ?? 0;
    let created = 0;
    let skipped = 0;
    let lastError = '';
    const optimisticSubjects: any[] = [];
    for (const suggestion of toCreate) {
      try {
        const createdEntity = await pedagogyFetch<any>(`/api/subjects`, { method: 'POST', body: {
          academicYearId: academicYear.id,
          schoolLevelId: subjectForm.schoolLevelId,
          code: suggestion.code,
          name: suggestion.name,
          abbreviation: suggestion.abbreviation,
          coefficient: bulkCoefficient,
          weeklyHours: bulkWeeklyHours,
          ...(bilingualEnabled ? { language: currentTrack } : {}),
        }});
        created++;
        // Insertion optimiste
        if (createdEntity) {
          optimisticSubjects.push({
            id: createdEntity.id || `temp-${Date.now()}-${suggestion.code}`,
            academicYearId: academicYear.id,
            schoolLevelId: subjectForm.schoolLevelId,
            code: suggestion.code,
            name: suggestion.name,
            abbreviation: suggestion.abbreviation,
            coefficient: bulkCoefficient,
            weeklyHours: bulkWeeklyHours,
            schoolLevel: schoolLevels.find((l) => l.id === subjectForm.schoolLevelId) || null,
            ...(bilingualEnabled ? { language: currentTrack } : {}),
          });
        }
      } catch (e: any) {
        console.error('[SubjectsWorkspace] Failed to create subject:', suggestion.code, e.message);
        skipped++;
        // Garder le dernier message d'erreur pour le toast
        lastError = e.message;
      }
    }
    // Ajouter toutes les matières créées au state local immédiatement
    if (optimisticSubjects.length > 0) {
      setSubjects(prev => [...optimisticSubjects, ...prev] as any);
    }
    setBulkSaving(false);
    setSelectedSuggestions(new Set());
    await loadSubjects();
    toast({
      title: created > 0 ? `${created} matière${created > 1 ? 's' : ''} créée${created > 1 ? 's' : ''}` : 'Aucune matière créée',
      description: skipped > 0
        ? `${skipped} matière${skipped > 1 ? 's' : ''} ignorée${skipped > 1 ? 's' : ''}. Erreur: ${lastError || 'déjà existante'}`
        : 'Toutes les matières sélectionnées ont été ajoutées.',
      variant: skipped > 0 && created === 0 ? 'destructive' : undefined,
    });
    if (created > 0) setModal('none');
  };

  const handleDeleteSubject = async (id: string) => {
    // Mise à jour optimiste immédiate dans le state local
    setSubjects(prev => prev.filter(s => s.id !== id));
    try {
      await pedagogyFetch(`/api/subjects/${id}`, { method: 'DELETE' });
      toast({
        title: "Succès",
        description: "Matière supprimée avec succès.",
      });
      loadSubjects();
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Impossible de supprimer la matière.",
        variant: "destructive"
      });
      loadSubjects();
    }
  };

  /**
   * Suppression groupée des matières sélectionnées dans le tableau.
   * Mise à jour optimiste immédiate, suppression séquentielle en background.
   */
  const handleBulkDeleteSubjects = async () => {
    const ids = Array.from(selectedSubjectIds);
    if (ids.length === 0) return;

    // Mise à jour optimiste
    setSubjects(prev => prev.filter(s => !selectedSubjectIds.has(s.id)));
    setSelectedSubjectIds(new Set());
    setConfirmBulkDelete(false);

    let deleted = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await pedagogyFetch(`/api/subjects/${id}`, { method: 'DELETE' });
        deleted++;
      } catch {
        failed++;
      }
    }

    await loadSubjects();
    toast({
      title: deleted > 0
        ? `${deleted} matière${deleted > 1 ? 's' : ''} supprimée${deleted > 1 ? 's' : ''}`
        : 'Aucune matière supprimée',
      description: failed > 0
        ? `${failed} échec${failed > 1 ? 's' : ''} (matières utilisées par des classes).`
        : `Suppression effectuée avec succès.`,
      variant: failed > 0 && deleted === 0 ? 'destructive' : undefined,
    });
  };



  const handleUploadProgram = async (subjectId: string, file: File) => {
    setUploading(true);
    try {
      // Pattern data URL : compresser/lire côté navigateur et envoyer en JSON
      const isImage = file.type.startsWith('image/');
      let fileDataUrl: string;
      if (isImage) {
        fileDataUrl = await compressImageFileToDataUrl(file, {
          maxEdge: 1600,
          quality: 0.85,
          mimeType: 'image/jpeg',
        });
      } else {
        fileDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
          reader.readAsDataURL(file);
        });
      }

      const { url } = await pedagogyFetch<{ url: string }>('/api/pedagogy/academic-series/programs/upload-program', {
        method: 'POST',
        body: {
          fileDataUrl,
          fileName: file.name,
          mimeType: file.type || (isImage ? 'image/jpeg' : 'application/pdf'),
          folder: 'programs',
        }
      });

      await pedagogyFetch('/api/pedagogy/academic-series/programs', {
        method: 'POST',
        body: {
          academicYearId: academicYear?.id,
          subjectId,
          documentUrl: url,
          version: '1.0'
        }
      });

      loadSubjects();
      toast({
        title: "Succès",
        description: "Le programme officiel a été téléversé avec succès.",
      });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Impossible de téléverser le document.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleApproveProgram = async (programId: string) => {
    if (!user?.id) return;
    try {
      await pedagogyFetch(`/api/pedagogy/academic-series/programs/${programId}/approve`, {
        method: 'PUT',
        body: { userId: user.id }
      });
      loadSubjects();
      toast({
        title: "Succès",
        description: "Le programme officiel a été approuvé et signé.",
      });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Impossible d'approuver le document.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner / Connection Paramètres */}
      <div
        className="flex flex-col gap-4 rounded-xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        style={{ borderLeftWidth: 4, borderLeftColor: PRIMARY }}
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Année scolaire active
          </p>
          <p className="text-lg font-semibold text-slate-900">{academicYear?.label || 'Chargement...'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {bilingualEnabled && (
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1" role="group" aria-label="Sélecteur de piste linguistique">
              <button
                type="button"
                onClick={() => setCurrentTrack('FR')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                  currentTrack === 'FR'
                    ? 'bg-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800',
                )}
                style={currentTrack === 'FR' ? { color: PRIMARY } : undefined}
              >
                Français
              </button>
              <button
                type="button"
                onClick={() => setCurrentTrack('EN')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                  currentTrack === 'EN'
                    ? 'bg-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800',
                )}
                style={currentTrack === 'EN' ? { color: PRIMARY } : undefined}
              >
                English
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setSubjectForm({
                id: '',
                code: '',
                name: '',
                abbreviation: '',
                coefficient: 1,
                weeklyHours: 4,
                schoolLevelId: schoolLevels[0]?.id || '',
                description: '',
                language: bilingualEnabled ? currentTrack : '',
              });
              setModal('create-subject');
            }}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
            style={{ backgroundColor: PRIMARY }}
          >
            <Plus className="h-4 w-4" />
            Nouvelle matière
          </button>
          <a
            href={settingsHref}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <ExternalLink className="h-4 w-4" style={{ color: ACCENT }} />
            Paramètres
          </a>
        </div>
      </div>

      {/* Navigation Interne */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50/80 p-1">
        {[
          { id: 'catalogue', label: currentTrack === 'EN' ? 'Subjects Catalogue' : 'Catalogue Matières', icon: BookOpen },
          { id: 'classes', label: currentTrack === 'EN' ? 'Class Assignments' : 'Affectation Classes', icon: ClipboardList },
          { id: 'programs', label: currentTrack === 'EN' ? 'Official Programs' : 'Programmes Officiels', icon: FileText },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as SubTab)}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition',
                active
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900',
              )}
              style={active ? { color: PRIMARY } : undefined}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Zone de contenu dynamique */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          {tab === 'catalogue' && (
            <div className="p-6 space-y-6">
              {/* Indicateur de mode linguistique */}
              {bilingualEnabled && (
                <div className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold border',
                  currentTrack === 'FR'
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700',
                )}>
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black text-white"
                    style={{ backgroundColor: currentTrack === 'FR' ? '#0b2f73' : '#F5A623' }}>
                    {currentTrack}
                  </span>
                  {currentTrack === 'FR'
                    ? 'Vous êtes actuellement en mode Français. Les matières affichées et créées seront en français.'
                    : 'You are currently in English mode. Displayed and created subjects will be in English.'}
                </div>
              )}

              {/* Toolbar : Recherche + Filtre par niveau */}
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                {/* Barre de recherche */}
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={currentTrack === 'EN' ? 'Search subject (Code, Name, Abbr.)' : 'Chercher une matière (Code, Nom, Abrév.)'}
                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 text-sm font-medium transition-all"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Filtres par niveau */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5" /> Niveau
                  </span>
                  <button
                    type="button"
                    onClick={() => setFilterLevelId('ALL')}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                      filterLevelId === 'ALL'
                        ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    )}
                  >
                    Tous ({filteredSubjects.length})
                  </button>
                  {schoolLevels.map((level) => {
                    // Comparer par CODE (ex: 'MATERNELLE') au lieu d'ID, car les chips
                    // utilisent schoolLevels (EducationLevel) dont les IDs diffèrent de
                    // SchoolLevel.id utilisé par les subjects.
                    const levelCode = (level.code || level.name || '').toUpperCase();
                    const count = subjects.filter(
                      s => {
                        const sCode = (s.schoolLevel?.code || s.schoolLevel?.name || '').toUpperCase();
                        return sCode === levelCode || s.schoolLevel?.id === level.id || s.schoolLevelId === level.id;
                      }
                    ).length;
                    return (
                      <button
                        key={level.id}
                        type="button"
                        onClick={() => setFilterLevelId(filterLevelId === level.id ? 'ALL' : level.id)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                          filterLevelId === level.id
                            ? 'text-white border-transparent shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                        )}
                        style={filterLevelId === level.id ? { backgroundColor: PRIMARY } : undefined}
                      >
                        {level.label || level.name} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Barre d'actions flottante (sélection multiple) */}
              <AnimatePresence>
                {selectedSubjectIds.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 16 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-rose-600 text-white text-xs font-bold">
                        {selectedSubjectIds.size}
                      </span>
                      <span className="text-sm font-semibold text-rose-900">
                        matière{selectedSubjectIds.size > 1 ? 's' : ''} sélectionnée{selectedSubjectIds.size > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedSubjectIds(new Set())}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 border border-rose-300 bg-white hover:bg-rose-50 transition-all"
                      >
                        Désélectionner
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmBulkDelete(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-all active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Supprimer {selectedSubjectIds.size} sélection{selectedSubjectIds.size > 1 ? 's' : ''}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Grid / Table Catalogue */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {/* Case à cocher globale */}
                      <th className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label="Sélectionner toutes les matières"
                          className="w-4 h-4 rounded border-slate-300 accent-indigo-600 cursor-pointer"
                          checked={
                            filteredSubjects.length > 0 &&
                            filteredSubjects.every(s => selectedSubjectIds.has(s.id))
                          }
                          ref={(el) => {
                            if (el) {
                              el.indeterminate =
                                selectedSubjectIds.size > 0 &&
                                !filteredSubjects.every(s => selectedSubjectIds.has(s.id));
                            }
                          }}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSubjectIds(prev => {
                                const next = new Set(prev);
                                filteredSubjects.forEach(s => next.add(s.id));
                                return next;
                              });
                            } else {
                              setSelectedSubjectIds(prev => {
                                const next = new Set(prev);
                                filteredSubjects.forEach(s => next.delete(s.id));
                                return next;
                              });
                            }
                          }}
                        />
                      </th>
                      <th className="px-4 py-3">{currentTrack === 'EN' ? 'Subject' : 'Matière'}</th>
                      <th className="px-4 py-3">{currentTrack === 'EN' ? 'School Level' : 'Niveau Scolaire'}</th>
                      <th className="px-4 py-3 text-center">{currentTrack === 'EN' ? 'Weekly Hours' : 'Volume Hebdo'}</th>
                      <th className="px-4 py-3 text-center">{currentTrack === 'EN' ? 'Coefficient' : 'Coefficient'}</th>
                      <th className="px-4 py-3 text-right">{currentTrack === 'EN' ? 'Actions' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-20 text-center">
                          <div className="flex flex-col items-center justify-center gap-2 text-sm text-slate-500">
                            <Loader2 className="h-6 w-6 animate-spin" style={{ color: PRIMARY }} />
                            <span>Chargement du catalogue...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredSubjects.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-20 text-center text-slate-500">
                          <div className="max-w-xs mx-auto space-y-2">
                            <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                            <p className="text-sm font-medium">
                              {filteredSubjects.length === 0
                                ? (currentTrack === 'EN'
                                    ? 'No subject defined for this school year.'
                                    : "Aucune matière n'est définie pour cette année scolaire.")
                                : (currentTrack === 'EN'
                                    ? 'No subject for the selected level.'
                                    : `Aucune matière pour le niveau sélectionné.`)
                              }
                            </p>
                            {filterLevelId !== 'ALL' && (
                              <button
                                type="button"
                                onClick={() => setFilterLevelId('ALL')}
                                className="text-xs text-indigo-600 hover:underline font-medium"
                              >
                                Voir toutes les matières
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredSubjects.map((subject) => {
                        const isRowSelected = selectedSubjectIds.has(subject.id);
                        return (
                          <tr
                            key={subject.id}
                            className={cn(
                              'border-b border-slate-100 transition-colors',
                              isRowSelected
                                ? 'bg-indigo-50/70 hover:bg-indigo-50'
                                : 'hover:bg-slate-50/80'
                            )}
                          >
                            {/* Checkbox ligne */}
                            <td className="w-10 px-4 py-3">
                              <input
                                type="checkbox"
                                aria-label={`Sélectionner ${subject.name}`}
                                className="w-4 h-4 rounded border-slate-300 accent-indigo-600 cursor-pointer"
                                checked={isRowSelected}
                                onChange={(e) => {
                                  setSelectedSubjectIds(prev => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(subject.id);
                                    else next.delete(subject.id);
                                    return next;
                                  });
                                }}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <div className="font-semibold text-slate-900 flex items-center gap-2">
                                  <span>{subject.name}</span>
                                  {subject.abbreviation && (
                                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold border border-slate-200 uppercase">
                                      {subject.abbreviation}
                                    </span>
                                  )}
                                  {bilingualEnabled && subject.language && (
                                    <span
                                      className={cn(
                                        'px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase',
                                        subject.language.toUpperCase() === 'EN'
                                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                                          : 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                      )}
                                      title={`Piste linguistique : ${subject.language}`}
                                    >
                                      {subject.language}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-400 uppercase">{subject.code}</div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {subject.schoolLevel?.name ?? 
                               subject.schoolLevel?.label ?? 
                               schoolLevels.find(l => l.id === subject.schoolLevelId || l.id === (subject as any).level)?.label ??
                               schoolLevels.find(l => l.id === subject.schoolLevelId || l.id === (subject as any).level)?.name ??
                               '—'}
                            </td>
                            <td className="px-4 py-3 text-center text-slate-600 font-medium">{subject.weeklyHours ?? 0}h</td>
                            <td className="px-4 py-3 text-center font-bold text-slate-900">{subject.coefficient}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSubjectForm({
                                    id: subject.id,
                                    code: subject.code,
                                    name: subject.name,
                                    abbreviation: subject.abbreviation || '',
                                    coefficient: subject.coefficient,
                                    weeklyHours: subject.weeklyHours || 0,
                                    schoolLevelId: subject.schoolLevel?.id || subject.schoolLevelId || (subject as any).level || '',
                                    description: subject.description || '',
                                    language: subject.language || '',
                                  });
                                  setModal('edit-subject');
                                }}
                                className="mr-3 text-sm font-medium hover:underline"
                                style={{ color: PRIMARY }}
                              >
                                Modifier
                              </button>
                              <button
                                type="button"
                                onClick={() => setSubjectToDelete(subject)}
                                className="text-sm font-medium text-rose-700 hover:underline"
                              >
                                Supprimer
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}



          {tab === 'classes' && (
             <div className="p-6 space-y-6">
               {/* Header Info Banner */}
               <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex gap-4">
                 <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                   <Info className="w-5 h-5" />
                 </div>
                 <div className="space-y-1">
                   <h5 className="text-sm font-bold text-amber-900">Affectation des Matières aux Classes</h5>
                   <p className="text-xs text-amber-700 leading-relaxed">
                     Gérez les coefficients et volumes horaires spécifiques pour chaque classe. Vous pouvez affecter des matières en masse ou retirer individuellement des matières affectées.
                   </p>
                 </div>
               </div>

               {/* Toolbar */}
               <div className="flex justify-between items-center">
                 <h3 className="text-base font-semibold text-slate-900">Matières affectées par classe</h3>
                 <button 
                  type="button"
                  onClick={() => {
                    setSelectedClasses([]);
                    setSelectedSubjects([]);
                    setModal('mass-assignment');
                  }}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
                  style={{ backgroundColor: PRIMARY }}
                 >
                   <Sparkles className="w-4 h-4" />
                   Assistant d'affectation
                 </button>
               </div>

               {/* Table Classes Assignments */}
               <div className="overflow-x-auto rounded-xl border border-slate-200">
                 <table className="min-w-full text-sm">
                   <thead>
                     <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                       <th className="px-4 py-3">Classe</th>
                       <th className="px-4 py-3">Série</th>
                       <th className="px-4 py-3">Matières affectées</th>
                       <th className="px-4 py-3 text-center">Volume Hebdo Total</th>
                       <th className="px-4 py-3 text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody>
                     {loadingClassSubjects ? (
                       <tr>
                         <td colSpan={5} className="py-20 text-center">
                           <div className="flex flex-col items-center justify-center gap-2 text-sm text-slate-500">
                             <Loader2 className="h-6 w-6 animate-spin" style={{ color: PRIMARY }} />
                             <span>Chargement des affectations...</span>
                           </div>
                         </td>
                       </tr>
                     ) : filteredClasses.length === 0 ? (
                       <tr>
                         <td colSpan={5} className="py-20 text-center text-slate-500">
                           Aucune classe disponible pour cette année scolaire.
                         </td>
                       </tr>
                     ) : (
                       filteredClasses.map((c) => {
                         const classSubjects = classSubjectsMap[c.id] || [];
                         const totalHours = classSubjects.reduce(
                           (sum: number, cs: any) => sum + (cs.weeklyHours || 0),
                           0
                         );

                         return (
                           <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                             <td className="px-4 py-3 font-semibold text-slate-900">
                               {c.name}
                             </td>
                             <td className="px-4 py-3 text-slate-600">
                               {c.series ? (
                                 <span className="inline-flex items-center rounded bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                                   {c.series.name}
                                 </span>
                               ) : (
                                 '—'
                               )}
                             </td>
                             <td className="px-4 py-3">
                               {classSubjects.length === 0 ? (
                                 <span className="text-xs text-slate-400 font-medium">Aucune matière affectée</span>
                               ) : (
                                 <div className="flex flex-wrap gap-1.5 py-1">
                                   {classSubjects.map((cs: any) => (
                                     <span
                                       key={cs.id}
                                       className="inline-flex items-center gap-1 rounded bg-slate-100 pl-2 pr-1.5 py-0.5 text-xs font-semibold text-slate-800 border border-slate-200"
                                     >
                                       <span>
                                         {cs.subject?.name} <span className="text-[10px] text-slate-500 font-normal">(Coeff. {cs.coefficient} · {cs.weeklyHours}h)</span>
                                       </span>
                                       <button
                                         type="button"
                                         onClick={() => setAssignmentToRemove({ id: cs.id, name: cs.subject?.name })}
                                         className="rounded-full hover:bg-slate-200 p-0.5 text-slate-500 hover:text-slate-900 transition-colors"
                                       >
                                         <Plus className="h-3 w-3 rotate-45 shrink-0" />
                                       </button>
                                     </span>
                                   ))}
                                 </div>
                               )}
                             </td>
                             <td className="px-4 py-3 text-center font-bold text-slate-700">
                               {totalHours}h
                             </td>
                             <td className="px-4 py-3 text-right">
                               <button
                                 type="button"
                                 onClick={() => {
                                   setSelectedClasses([c.id]);
                                   setSelectedSubjects([]);
                                   setModal('mass-assignment');
                                 }}
                                 className="text-sm font-medium hover:underline"
                                 style={{ color: PRIMARY }}
                               >
                                 Affecter
                               </button>
                             </td>
                           </tr>
                         );
                       })
                     )}
                   </tbody>
                 </table>
               </div>
             </div>
          )}


          {tab === 'programs' && (
            <div className="p-6 space-y-6">
               <div className="flex flex-col gap-1">
                  <h3 className="text-base font-semibold text-slate-900">Programmes Officiels de Référence</h3>
                  <p className="text-xs text-slate-500">Documents PDF de référence institutionnelle (Signés & Scellés).</p>
               </div>

               <div className="overflow-x-auto rounded-xl border border-slate-200">
                 <table className="min-w-full text-sm">
                   <thead>
                     <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                       <th className="px-4 py-3">Matière</th>
                       <th className="px-4 py-3">Niveau Scolaire</th>
                       <th className="px-4 py-3 text-center">
                         <span className="cursor-help border-b border-dashed border-slate-300 pb-0.5" title="Version du programme d'études officiel (commence à 1.0 par défaut)">
                           Version
                         </span>
                       </th>
                       <th className="px-4 py-3 text-center">Statut d'Approbation</th>
                       <th className="px-4 py-3 text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody>
                     {filteredSubjects.length === 0 ? (
                       <tr>
                         <td colSpan={5} className="py-20 text-center text-slate-500">
                           Aucune matière disponible pour associer un programme.
                         </td>
                       </tr>
                     ) : (
                       filteredSubjects.map((s) => {
                         const latestProgram = s.programs && s.programs.length > 0 ? s.programs[0] : null;
                         const isApproved = !!latestProgram?.approvedAt;

                         return (
                           <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                             <td className="px-4 py-3">
                               <div>
                                 <div className="font-semibold text-slate-900">{s.name}</div>
                                 <div className="text-xs text-slate-400 uppercase">{s.code}</div>
                               </div>
                             </td>
                             <td className="px-4 py-3 text-slate-600">
                               {s.schoolLevel?.name ?? 
                                s.schoolLevel?.label ?? 
                                schoolLevels.find(l => l.id === s.schoolLevelId || l.id === (s as any).level)?.label ??
                                schoolLevels.find(l => l.id === s.schoolLevelId || l.id === (s as any).level)?.name ??
                                '—'}
                             </td>
                             <td className="px-4 py-3 text-center text-slate-600 font-medium">
                               {latestProgram ? `v${latestProgram.version}` : '—'}
                             </td>
                             <td className="px-4 py-3 text-center">
                               {latestProgram ? (
                                 isApproved ? (
                                   <span className="inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs font-semibold border border-emerald-200">
                                     <CheckCircle2 className="w-3.5 h-3.5" />
                                     Validé le {format(new Date(latestProgram.approvedAt!), 'dd/MM/yyyy', { locale: fr })}
                                   </span>
                                 ) : (
                                   <span className="inline-flex items-center gap-1 rounded bg-amber-50 text-amber-700 px-2 py-0.5 text-xs font-semibold border border-amber-200">
                                     <AlertCircle className="w-3.5 h-3.5" />
                                     En attente d'approbation
                                   </span>
                                 )
                               ) : (
                                 <span className="inline-flex items-center gap-1 rounded bg-slate-100 text-slate-600 px-2 py-0.5 text-xs font-semibold border border-slate-200">
                                   Non importé
                                 </span>
                               )}
                             </td>
                             <td className="px-4 py-3 text-right">
                               <div className="flex items-center justify-end gap-2">
                                 {latestProgram && (
                                   <>
                                     <a 
                                       href={latestProgram.documentUrl} 
                                       target="_blank" 
                                       rel="noreferrer"
                                       className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-200 rounded hover:bg-slate-200 transition-colors animate-none"
                                     >
                                       <Download className="w-3 h-3" />
                                       Télécharger
                                     </a>
                                     {!isApproved && (
                                       <button 
                                         type="button"
                                         onClick={() => handleApproveProgram(latestProgram.id)}
                                         className="text-xs font-semibold px-2.5 py-1 text-white rounded hover:opacity-95 transition-all"
                                         style={{ backgroundColor: PRIMARY }}
                                       >
                                         Approuver
                                       </button>
                                     )}
                                   </>
                                 )}
                                 <div className="relative inline-block">
                                    <input 
                                       type="file" 
                                       className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                                       accept=".pdf"
                                       onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) handleUploadProgram(s.id, file);
                                       }}
                                       disabled={uploading}
                                    />
                                    <button 
                                      type="button"
                                      className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-200 rounded hover:bg-slate-200 transition-colors disabled:opacity-50"
                                      disabled={uploading}
                                    >
                                      {latestProgram ? 'Remplacer PDF' : 'Importer PDF'}
                                    </button>
                                 </div>
                               </div>
                             </td>
                           </tr>
                         );
                       })
                     )}
                   </tbody>
                 </table>
               </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Orion Insight Banner */}
      <div 
        className="rounded-xl border bg-white p-6 shadow-sm relative overflow-hidden"
        style={{ borderLeftWidth: 4, borderLeftColor: PRIMARY }}
      >
        <div className="absolute top-0 right-0 p-6 opacity-5">
          <Sparkles className="w-24 h-24" style={{ color: PRIMARY }} />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between relative">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200">
              <CheckCircle2 className="w-6 h-6" style={{ color: PRIMARY }} />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Intelligence Pédagogique ORION</h4>
              <p className="text-slate-600 text-sm max-w-2xl leading-relaxed mt-0.5">
                Toutes les matières obligatoires sont couvertes pour le niveau primaire. 
                Attention : 3 matières en série D n'ont pas encore de volume horaire défini.
              </p>
            </div>
          </div>
          <button 
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 self-start sm:self-center"
          >
            Analyser tout
          </button>
        </div>
      </div>

      {/* Modals */}
      <FormModal
        title={modal === 'edit-subject' ? 'Modifier la matière' : 'Nouvelle Matière'}
        isOpen={modal === 'create-subject' || modal === 'edit-subject'}
        onClose={() => setModal('none')}
        onConfirm={selectedSuggestions.size > 0 ? undefined : handleSaveSubject}
        actions={
          selectedSuggestions.size > 0 ? (
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModal('none')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Fermer
              </button>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Code Matière</label>
              <input 
                type="text" 
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800" 
                placeholder="EX: MATH-01" 
                value={subjectForm.code}
                onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
              />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Nom de la matière</label>
              <input 
                type="text" 
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800" 
                placeholder="Mathématiques" 
                value={subjectForm.name}
                onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Abréviation</label>
              <input 
                type="text" 
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800" 
                placeholder="EX: MATH" 
                value={subjectForm.abbreviation}
                onChange={(e) => setSubjectForm({ ...subjectForm, abbreviation: e.target.value })}
              />
            </div>
            <div className="space-y-1">
               <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Niveau Scolaire</label>
               <select
                 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800 bg-white"
                 value={subjectForm.schoolLevelId}
                 onChange={(e) => setSubjectForm({ ...subjectForm, schoolLevelId: e.target.value })}
               >
                 <option value="">Sélectionner un niveau</option>
                 {schoolLevels.map(l => (
                   <option key={l.id} value={l.id}>{l.label || l.name}</option>
                 ))}
               </select>
            </div>
          </div>

          {/* Langue (FR/EN) — visible uniquement en mode bilingue.
              La langue est déterminée par le switch FR/EN en haut de la page.
              L'utilisateur ne peut pas la changer dans le modal — il doit basculer
              le switch pour créer des matières dans l'autre langue. */}
          {bilingualEnabled && (
            <div className="space-y-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Piste linguistique
              </label>
              <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700">
                {currentTrack === 'FR' ? 'Français (FR)' : 'English (EN)'}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                La matière sera rattachée à la piste <strong>{currentTrack}</strong>.
                Pour créer une matière dans l&apos;autre langue, basculez le switch FR/EN en haut de la page.
              </p>
            </div>
          )}

          {/* ── Suggestions de matières par défaut (multi-sélection) ──────── */}
          {modal === 'create-subject' && defaultSuggestionsForLevel.length > 0 && (
            <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-slate-50 p-4 space-y-3">
              {/* En-tête */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold uppercase tracking-wide text-indigo-700">
                    Matières suggérées pour ce niveau
                  </span>
                </div>
                <button
                  type="button"
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                  onClick={() => {
                    const available = defaultSuggestionsForLevel.filter(
                      s => !subjects.some(sub => sub.code === s.code && sub.schoolLevelId === subjectForm.schoolLevelId)
                    );
                    if (selectedSuggestions.size === available.length) {
                      setSelectedSuggestions(new Set());
                    } else {
                      setSelectedSuggestions(new Set(available.map(s => s.code)));
                    }
                  }}
                >
                  {selectedSuggestions.size === defaultSuggestionsForLevel.filter(
                    s => !subjects.some(sub => sub.code === s.code && sub.schoolLevelId === subjectForm.schoolLevelId)
                  ).length && selectedSuggestions.size > 0
                    ? 'Tout désélectionner'
                    : 'Tout sélectionner'}
                </button>
              </div>

              {/* Grille de chips multi-sélection */}
              <div className="flex flex-col gap-2">
                {defaultSuggestionsForLevel.map((suggestion) => {
                  const isAlreadyCreated = subjects.some(
                    s => s.code === suggestion.code && s.schoolLevelId === subjectForm.schoolLevelId
                  );
                  const isSelected = selectedSuggestions.has(suggestion.code);

                  return (
                    <button
                      key={suggestion.code}
                      type="button"
                      disabled={isAlreadyCreated}
                      title={`${suggestion.name} (${suggestion.abbreviation})`}
                      onClick={() => {
                        if (isAlreadyCreated) return;
                        setSelectedSuggestions(prev => {
                          const next = new Set(prev);
                          if (next.has(suggestion.code)) next.delete(suggestion.code);
                          else next.add(suggestion.code);
                          return next;
                        });
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-left transition-all border',
                        isAlreadyCreated
                          ? 'cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400'
                          : isSelected
                          ? 'cursor-pointer bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                          : 'cursor-pointer bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
                      )}
                    >
                      {/* Checkbox visuelle */}
                      <span className={cn(
                        'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
                        isAlreadyCreated
                          ? 'border-slate-300 bg-slate-100'
                          : isSelected
                          ? 'border-white bg-white'
                          : 'border-slate-300 bg-white'
                      )}>
                        {isAlreadyCreated
                          ? <CheckCircle2 className="w-3 h-3 text-slate-400" />
                          : isSelected
                          ? <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                          : null
                        }
                      </span>

                      {/* Contenu */}
                      <span className="flex-1 min-w-0">
                        <span className={cn(
                          'font-semibold text-xs uppercase tracking-wider mr-2',
                          isSelected ? 'text-indigo-200' : 'text-indigo-500'
                        )}>
                          {suggestion.code}
                        </span>
                        <span className={cn(
                          'font-medium',
                          isAlreadyCreated && 'line-through opacity-50'
                        )}>
                          {suggestion.name}
                        </span>
                        <span className={cn(
                            'block text-xs mt-0.5 truncate font-medium',
                            isSelected ? 'text-indigo-200' : 'text-slate-400'
                          )}>
                            Abrév. : {suggestion.abbreviation}
                          </span>
                      </span>

                      {isAlreadyCreated && (
                        <span className={cn(
                          'text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 shrink-0'
                        )}>
                          Déjà ajoutée
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Barre d'action groupée */}
              {selectedSuggestions.size > 0 && (
                <div className="space-y-2 pt-2 border-t border-indigo-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-indigo-700">
                      {selectedSuggestions.size} matière{selectedSuggestions.size > 1 ? 's' : ''} sélectionnée{selectedSuggestions.size > 1 ? 's' : ''}
                    </span>
                    <button
                      type="button"
                      disabled={bulkSaving}
                      onClick={handleBulkCreateSuggestions}
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {bulkSaving ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</>
                      ) : (
                        <><Plus className="w-4 h-4" /> Enregistrer {selectedSuggestions.size} matière{selectedSuggestions.size > 1 ? 's' : ''}</>
                      )}
                    </button>
                  </div>
                  {/* Rappel contextuel : les champs Coefficient/Horaire ci-dessous s'appliquent à toutes les matières */}
                  <p className="text-[11px] text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5 leading-relaxed">
                    💡 Les valeurs <strong>Coefficient</strong> et <strong>Volume Hebdo</strong> définies ci-dessous seront appliquées à toutes les matières sélectionnées.
                  </p>
                </div>
              )}
            </div>
          )}


          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1">
               <div className="flex justify-between items-center">
                 <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Coefficient</label>
                  {isPrimaryOrMaternelle && (
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 mb-1">
                      Par défaut 1 (Mat/Pri)
                    </span>
                  )}
               </div>
               <input 
                 type="number" 
                 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800" 
                 placeholder="2" 
                 value={subjectForm.coefficient}
                 onChange={(e) => setSubjectForm({ ...subjectForm, coefficient: Number(e.target.value) })}
               />
             </div>
             <div className="space-y-1">
               <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Volume Hebdo (h)</label>
               <input 
                 type="number" 
                 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800" 
                 placeholder="4" 
                 value={subjectForm.weeklyHours}
                 onChange={(e) => setSubjectForm({ ...subjectForm, weeklyHours: Number(e.target.value) })}
               />
             </div>
          </div>
        </div>
      </FormModal>



      <FormModal
        title="Assistant d'affectation en masse"
        isOpen={modal === 'mass-assignment'}
        onClose={() => setModal('none')}
        onConfirm={handleMassAssign}
        size="large"
      >
        <div className="space-y-6">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex gap-3">
             <Info className="w-5 h-5 text-slate-500 mt-1 shrink-0" />
             <p className="text-sm text-slate-700 leading-relaxed">
               Cet assistant permet de lier plusieurs matières à plusieurs classes simultanément. 
               Si vous activez l'option <b>"Priorité aux coefficients de série"</b>, le système ignorera les valeurs saisies ici pour utiliser celles définies dans le catalogue des séries pour chaque couple classe/matière.
             </p>
          </div>

          <div className="grid grid-cols-2 gap-8">
            {/* Colonne Classes */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Étape 1 : Choisir les Classes ({selectedClasses.length})</label>
              
              {/* Filtres de sélection rapide */}
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={filterClassLevelId}
                  onChange={(e) => setFilterClassLevelId(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
                >
                  <option value="">Tous les niveaux</option>
                  {schoolLevels.map(l => (
                    <option key={l.id} value={l.id}>{l.label || l.name}</option>
                  ))}
                </select>
                <select
                  value={filterClassSeriesId}
                  onChange={(e) => setFilterClassSeriesId(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
                >
                  <option value="">Toutes les séries</option>
                  {filteredSeries.map(s => (
                    <option key={s.id} value={s.id}>{s.name} {s.description ? `— ${s.description}` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Raccourcis de sélection */}
              <div className="flex gap-2 justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const allFilteredIds = filteredClasses.map(c => c.id);
                    setSelectedClasses(Array.from(new Set([...selectedClasses, ...allFilteredIds])));
                  }}
                  className="text-[10px] font-bold text-slate-600 hover:text-slate-900 hover:underline"
                >
                  Tout sélectionner
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const allFilteredIds = filteredClasses.map(c => c.id);
                    setSelectedClasses(selectedClasses.filter(id => !allFilteredIds.includes(id)));
                  }}
                  className="text-[10px] font-bold text-slate-600 hover:text-slate-900 hover:underline"
                >
                  Tout désélectionner
                </button>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 max-h-60 overflow-y-auto space-y-2 border border-slate-200">
                {filteredClasses.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Aucune classe ne correspond aux filtres.</p>
                ) : (
                  filteredClasses.map(c => (
                    <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg transition-colors cursor-pointer group border border-transparent hover:border-slate-200">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-gray-300 focus:ring-slate-500"
                        style={{ color: PRIMARY }}
                        checked={selectedClasses.includes(c.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedClasses([...selectedClasses, c.id]);
                          else setSelectedClasses(selectedClasses.filter(id => id !== c.id));
                        }}
                      />
                      <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">{c.name}</span>
                      {c.series && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-semibold border border-indigo-100">{c.series.name}</span>}
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Colonne Matières */}
            <div className="space-y-3">
               <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                 Étape 2 : Choisir les Matières ({selectedSubjects.length})
               </label>

               {/* Synchronisation et sélection rapide des matières filtrées */}
               <div className="flex gap-2 justify-between">
                 <button
                   type="button"
                   onClick={() => {
                     const matchedSubjects = subjects.filter(s => {
                       if (!filterClassLevelId) return true;
                       return s.schoolLevelId === filterClassLevelId || (s.schoolLevel && s.schoolLevel.id === filterClassLevelId);
                     });
                     const matchedIds = matchedSubjects.map(s => s.id);
                     setSelectedSubjects(Array.from(new Set([...selectedSubjects, ...matchedIds])));
                   }}
                   className="text-[10px] font-bold text-slate-600 hover:text-slate-900 hover:underline"
                 >
                   Sélectionner filtrées
                 </button>
                 <button
                   type="button"
                   onClick={() => {
                     const matchedSubjects = subjects.filter(s => {
                       if (!filterClassLevelId) return true;
                       return s.schoolLevelId === filterClassLevelId || (s.schoolLevel && s.schoolLevel.id === filterClassLevelId);
                     });
                     const matchedIds = matchedSubjects.map(s => s.id);
                     setSelectedSubjects(selectedSubjects.filter(id => !matchedIds.includes(id)));
                   }}
                   className="text-[10px] font-bold text-slate-600 hover:text-slate-900 hover:underline"
                 >
                   Désélectionner filtrées
                 </button>
               </div>

               <div className="bg-slate-50 rounded-lg p-4 max-h-60 overflow-y-auto space-y-2 border border-slate-200">
                {subjects
                  .filter(s => {
                    // Si un niveau de classe est filtré à l'étape 1, on affiche uniquement les matières de ce niveau
                    if (!filterClassLevelId) return true;
                    return s.schoolLevelId === filterClassLevelId || (s.schoolLevel && s.schoolLevel.id === filterClassLevelId);
                  })
                  .length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">Aucune matière ne correspond à ce niveau.</p>
                  ) : (
                    subjects
                      .filter(s => {
                        if (!filterClassLevelId) return true;
                        return s.schoolLevelId === filterClassLevelId || (s.schoolLevel && s.schoolLevel.id === filterClassLevelId);
                      })
                      .map(s => (
                        <label key={s.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg transition-colors cursor-pointer group border border-transparent hover:border-slate-200">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-gray-300 focus:ring-slate-500"
                            style={{ color: PRIMARY }}
                            checked={selectedSubjects.includes(s.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedSubjects([...selectedSubjects, s.id]);
                              else setSelectedSubjects(selectedSubjects.filter(id => id !== s.id));
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 block truncate">{s.name}</span>
                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{s.code}</span>
                          </div>
                          {s.schoolLevel && (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-semibold border border-slate-200 shrink-0">
                              {s.schoolLevel.label || s.schoolLevel.name}
                            </span>
                          )}
                        </label>
                      ))
                  )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 grid grid-cols-3 gap-6">
             <div className="space-y-1">
               <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Coefficient Global</label>
               <input 
                type="number" 
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800"
                value={massConfig.coefficient}
                onChange={(e) => setMassConfig({...massConfig, coefficient: parseFloat(e.target.value)})}
               />
             </div>
             <div className="space-y-1">
               <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Heures Hebdo</label>
               <input 
                type="number" 
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800"
                value={massConfig.weeklyHours}
                onChange={(e) => setMassConfig({...massConfig, weeklyHours: parseInt(e.target.value)})}
               />
             </div>
             <div className="flex items-center gap-3 pt-6">
                <input 
                  type="checkbox" 
                  id="use-series" 
                  className="w-5 h-5 rounded border-gray-300 focus:ring-slate-500"
                  style={{ color: PRIMARY }}
                  checked={massConfig.useSeries}
                  onChange={(e) => setMassConfig({...massConfig, useSeries: e.target.checked})}
                />
                <label htmlFor="use-series" className="text-xs font-semibold text-slate-700 cursor-pointer">Priorité aux coefficients de série</label>
             </div>
          </div>
        </div>
      </FormModal>

      {/* Confirmation Modals */}
      <ConfirmModal
        title="Supprimer la matière"
        message={`Voulez-vous vraiment supprimer la matière "${subjectToDelete?.name}" ? Cette action est irréversible et affectera toutes les classes associées.`}
        type="danger"
        isOpen={subjectToDelete !== null}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={async () => {
          if (subjectToDelete) {
            await handleDeleteSubject(subjectToDelete.id);
            setSubjectToDelete(null);
          }
        }}
        onCancel={() => setSubjectToDelete(null)}
      />

      <ConfirmModal
        title="Retirer la matière de la classe"
        message={`Voulez-vous vraiment retirer la matière "${assignmentToRemove?.name}" de cette classe ?`}
        type="warning"
        isOpen={assignmentToRemove !== null}
        confirmLabel="Retirer"
        cancelLabel="Annuler"
        onConfirm={async () => {
          if (assignmentToRemove) {
            await handleRemoveClassSubject(assignmentToRemove.id);
            setAssignmentToRemove(null);
          }
        }}
        onCancel={() => setAssignmentToRemove(null)}
      />
      {/* Confirmation suppression multiple */}
      <ConfirmModal
        title={`Supprimer ${selectedSubjectIds.size} matière${selectedSubjectIds.size > 1 ? 's' : ''}`}
        message={`Voulez-vous vraiment supprimer ${selectedSubjectIds.size} matière${selectedSubjectIds.size > 1 ? 's' : ''} sélectionnée${selectedSubjectIds.size > 1 ? 's' : ''} ? Cette action est irréversible. Les matières utilisées par des classes ne pourront pas être supprimées.`}
        type="danger"
        isOpen={confirmBulkDelete}
        confirmLabel={`Supprimer ${selectedSubjectIds.size} matière${selectedSubjectIds.size > 1 ? 's' : ''}`}
        cancelLabel="Annuler"
        onConfirm={handleBulkDeleteSubjects}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </div>
  );
}
