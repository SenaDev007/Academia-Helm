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
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { pedagogyService } from '@/services/pedagogy.service';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const PRIMARY = '#1A2BA6';
const ACCENT = '#F5A623';

// --- Catalogue de matières par défaut (suggestions dans le modal) ---
const DEFAULT_SUBJECTS_CATALOGUE: Record<
  string,
  Array<{ name: string; code: string; description?: string }>
> = {
  MATERNELLE: [
    {
      name: 'Développement du bien-être (Santé & Environnement)',
      code: 'DOM1',
      description: 'Éducation pour la santé · Éducation à des réflexions de santé',
    },
    {
      name: 'Développement du bien-être physique et moteur',
      code: 'DOM2',
      description: 'Éducation du mouvement · Gestuelle · Rythmique',
    },
    {
      name: 'Développement des aptitudes cognitives et intellectuelles',
      code: 'DOM3',
      description: 'Observation · Éducation sensorielle · Pré-lecture · Pré-écriture · Pré-mathématique',
    },
    {
      name: 'Développement des sentiments et émotions',
      code: 'DOM4',
      description: 'Expression plastique · Expression émotionnelle',
    },
    {
      name: 'Développement des relations et de l\'interaction sociale',
      code: 'DOM5',
      description: 'Langage · Conte · Comptine · Poésie · Chant',
    },
  ],
  PRIMAIRE: [
    { name: 'Expression Écrite',                          code: 'EXPR_EC' },
    { name: 'Lecture',                                    code: 'LECT'    },
    { name: 'Dictée',                                     code: 'DICT'    },
    { name: 'Mathématiques',                              code: 'MATH'    },
    { name: 'Éducation Scientifique et Technologique',    code: 'EST'     },
    { name: 'Éducation Sociale',                          code: 'ES'      },
    { name: 'Éducation Artistique (EA) Vivant',           code: 'EA_VIV'  },
    { name: 'Éducation Artistique (EA) Plastique',        code: 'EA_PLAS' },
    { name: 'Éducation Physique et Sportive',             code: 'EPS'     },
  ],
  SECONDAIRE: [
    { name: 'Communication Écrite',                       code: 'COMM_EC' },
    { name: 'Lecture',                                    code: 'LECT'    },
    { name: 'Anglais',                                    code: 'ANG'     },
    { name: 'Français',                                   code: 'FR'      },
    { name: 'Espagnol',                                   code: 'ESP'     },
    { name: 'Allemand',                                   code: 'ALL'     },
    { name: 'Mathématiques',                              code: 'MATH'    },
    { name: 'Physique Chimie et Technologie',             code: 'PCT'     },
    { name: 'Science de la Vie et de la Terre',           code: 'SVT'     },
    { name: 'Éducation Physique et Sportive',             code: 'EPS'     },
  ],
};

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

  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      if (filterClassLevelId && c.levelId !== filterClassLevelId && c.level?.id !== filterClassLevelId) {
        return false;
      }
      if (filterClassSeriesId && c.seriesId !== filterClassSeriesId && c.series?.id !== filterClassSeriesId) {
        return false;
      }
      return true;
    });
  }, [classes, filterClassLevelId, filterClassSeriesId]);

  // Modal state
  const [modal, setModal] = useState<'none' | 'create-subject' | 'edit-subject' | 'mass-assignment'>('none');

  const [uploading, setUploading] = useState(false);

  // Confirmation states
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [assignmentToRemove, setAssignmentToRemove] = useState<{ id: string; name: string } | null>(null);

  // Multi-sélection des suggestions de matières par défaut
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

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
    const key = resolveLevelKey(selectedLevelObj);
    return key ? DEFAULT_SUBJECTS_CATALOGUE[key] ?? [] : [];
  }, [selectedLevelObj]);

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
      const data = await pedagogyService.getSubjects(academicYear.id);
      setSubjects(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id]);

  const loadClasses = useCallback(async () => {
    if (!academicYear?.id) return;
    try {
      const data = await pedagogyService.getAcademicClasses(academicYear.id);
      setClasses(data || []);
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
            const data = await pedagogyService.getClassSubjects(cls.id, academicYear.id);
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
      await pedagogyService.removeClassSubject(assignmentId);
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
        await pedagogyService.createSubject({
          academicYearId: academicYear?.id,
          schoolLevelId: subjectForm.schoolLevelId,
          code: subjectForm.code.trim(),
          name: subjectForm.name.trim(),
          abbreviation: subjectForm.abbreviation.trim() || undefined,
          coefficient: Number(subjectForm.coefficient) || 1.0,
          weeklyHours: Number(subjectForm.weeklyHours) || 0,
          description: subjectForm.description,
        });
        toast({
          title: "Succès",
          description: "La matière a été créée.",
        });
      } else {
        await pedagogyService.updateSubject(subjectForm.id, {
          code: subjectForm.code.trim(),
          name: subjectForm.name.trim(),
          abbreviation: subjectForm.abbreviation.trim() || undefined,
          coefficient: Number(subjectForm.coefficient) || 1.0,
          weeklyHours: Number(subjectForm.weeklyHours) || 0,
          description: subjectForm.description,
        });
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
   */
  const handleBulkCreateSuggestions = async () => {
    if (selectedSuggestions.size === 0 || !subjectForm.schoolLevelId || !academicYear?.id) return;
    setBulkSaving(true);
    const toCreate = defaultSuggestionsForLevel.filter(s => selectedSuggestions.has(s.code));
    let created = 0;
    let skipped = 0;
    for (const suggestion of toCreate) {
      try {
        await pedagogyService.createSubject({
          academicYearId: academicYear.id,
          schoolLevelId: subjectForm.schoolLevelId,
          code: suggestion.code,
          name: suggestion.name,
          coefficient: isPrimaryOrMaternelle ? 1.0 : 1.0,
          weeklyHours: 0,
          description: suggestion.description,
        });
        created++;
      } catch {
        // Code déjà existant → on ignore
        skipped++;
      }
    }
    setBulkSaving(false);
    setSelectedSuggestions(new Set());
    await loadSubjects();
    toast({
      title: created > 0 ? `${created} matière${created > 1 ? 's' : ''} créée${created > 1 ? 's' : ''}` : 'Aucune matière créée',
      description: skipped > 0
        ? `${skipped} matière${skipped > 1 ? 's' : ''} ignorée${skipped > 1 ? 's' : ''} (déjà existante${skipped > 1 ? 's' : ''}).`
        : 'Toutes les matières sélectionnées ont été ajoutées.',
    });
    if (created > 0) setModal('none');
  };

  const handleDeleteSubject = async (id: string) => {
    // Mise à jour optimiste immédiate dans le state local
    setSubjects(prev => prev.filter(s => s.id !== id));
    try {
      await pedagogyService.deleteSubject(id);
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
      loadSubjects(); // Recharger le vrai état en cas d'erreur
    }
  };



  const handleUploadProgram = async (subjectId: string, file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'programs');

      const { url } = await pedagogyFetch<{ url: string }>('/api/pedagogy/academic-series/programs/upload', {
        method: 'POST',
        body: formData
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
          { id: 'catalogue', label: 'Catalogue Matières', icon: BookOpen },
          { id: 'classes', label: 'Affectation Classes', icon: ClipboardList },
          { id: 'programs', label: 'Programmes Officiels', icon: FileText },
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
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Chercher une matière (Code, Nom...)"
                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 text-sm font-medium transition-all"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Grid / Table Catalogue */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Matière</th>
                      <th className="px-4 py-3">Niveau Scolaire</th>
                      <th className="px-4 py-3 text-center">Volume Hebdo</th>
                      <th className="px-4 py-3 text-center">Coefficient</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="py-20 text-center">
                          <div className="flex flex-col items-center justify-center gap-2 text-sm text-slate-500">
                            <Loader2 className="h-6 w-6 animate-spin" style={{ color: PRIMARY }} />
                            <span>Chargement du catalogue...</span>
                          </div>
                        </td>
                      </tr>
                    ) : subjects.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-20 text-center text-slate-500">
                          <div className="max-w-xs mx-auto space-y-2">
                            <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                            <p className="text-sm font-medium">Aucune matière n'est définie pour cette année scolaire.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      subjects
                        .filter(
                          (s) =>
                            s.name.toLowerCase().includes(search.toLowerCase()) ||
                            s.code.toLowerCase().includes(search.toLowerCase()),
                        )
                        .map((subject) => (
                          <tr key={subject.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                            <td className="px-4 py-3">
                              <div>
                                <div className="font-semibold text-slate-900 flex items-center gap-2">
                                  <span>{subject.name}</span>
                                  {subject.abbreviation && (
                                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold border border-slate-200 uppercase">
                                      {subject.abbreviation}
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
                        ))
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
                     ) : classes.length === 0 ? (
                       <tr>
                         <td colSpan={5} className="py-20 text-center text-slate-500">
                           Aucune classe disponible pour cette année scolaire.
                         </td>
                       </tr>
                     ) : (
                       classes.map((c) => {
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
                     {subjects.length === 0 ? (
                       <tr>
                         <td colSpan={5} className="py-20 text-center text-slate-500">
                           Aucune matière disponible pour associer un programme.
                         </td>
                       </tr>
                     ) : (
                       subjects.map((s) => {
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
        onConfirm={handleSaveSubject}
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
                      title={suggestion.description ?? suggestion.name}
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
                        {suggestion.description && (
                          <span className={cn(
                            'block text-xs mt-0.5 truncate',
                            isSelected ? 'text-indigo-200' : 'text-slate-400'
                          )}>
                            {suggestion.description}
                          </span>
                        )}
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
                <div className="flex items-center justify-between pt-2 border-t border-indigo-200">
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
                  {series.map(s => (
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
               <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Étape 2 : Choisir les Matières ({selectedSubjects.length})</label>
               <div className="bg-slate-50 rounded-lg p-4 max-h-60 overflow-y-auto space-y-2 border border-slate-200">
                {subjects.map(s => (
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
                    <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">{s.name}</span>
                  </label>
                ))}
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
    </div>
  );
}
