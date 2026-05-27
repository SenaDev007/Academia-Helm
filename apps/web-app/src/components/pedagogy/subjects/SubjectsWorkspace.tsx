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

// --- Types ---

interface Subject {
  id: string;
  name: string;
  code: string;
  coefficient: number;
  weeklyHours?: number;
  description?: string;
  language?: string;
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
type SubTab = 'catalogue' | 'series' | 'classes' | 'programs';

export default function SubjectsWorkspace() {
  const { academicYear, tenantId } = useModuleContext();
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<SubTab>('catalogue');
  const [loading, setLoading] = useState(false);

  // Data
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [series, setSeries] = useState<AcademicSeries[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  // Class-Subject Assignments Map
  const [classSubjectsMap, setClassSubjectsMap] = useState<Record<string, any[]>>({});
  const [loadingClassSubjects, setLoadingClassSubjects] = useState(false);

  // Form states
  const [subjectForm, setSubjectForm] = useState({
    id: '',
    code: '',
    name: '',
    coefficient: 1,
    weeklyHours: 4,
    schoolLevelId: '',
    description: '',
  });

  const [seriesForm, setSeriesForm] = useState({
    id: '',
    name: '',
    description: '',
    levelId: '',
  });

  // Mass Assignment State
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [massConfig, setMassConfig] = useState({
    weeklyHours: 0,
    coefficient: 1.0,
    useSeries: true
  });

  // Modals
  const [modal, setModal] = useState<'none' | 'create-subject' | 'create-series' | 'edit-subject' | 'edit-series' | 'mass-assignment'>('none');

  const [uploading, setUploading] = useState(false);

  /** Lien Paramètres → onglet Structure (activation des niveaux officiels). */
  const settingsHref = useMemo(() => {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenant_id', tenantId);
    params.set('tab', 'structure');
    const q = params.toString();
    return `/app/settings${q ? `?${q}` : ''}`;
  }, [tenantId]);

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

  const loadSeries = useCallback(async () => {
    if (!academicYear?.id) return;
    try {
      const data = await pedagogyService.getSeries(academicYear.id);
      setSeries(data || []);
    } catch (e) {
      console.error(e);
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

  const loadLevels = useCallback(async () => {
    if (!academicYear?.id) return;
    try {
      const data = await pedagogyFetch<any[]>(`/api/pedagogy/academic-structure/levels?academicYearId=${academicYear.id}`);
      setLevels(data || []);
    } catch (e) {
      console.error(e);
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
    loadSeries();
    loadClasses();
    loadLevels();
  }, [loadSubjects, loadSeries, loadClasses, loadLevels]);

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
    if (!confirm("Voulez-vous vraiment retirer cette matière de cette classe ?")) return;
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

  const handleDeleteSubject = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cette matière ?")) return;
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
    }
  };

  const handleSaveSeries = async () => {
    if (!seriesForm.name.trim() || !seriesForm.levelId) {
      toast({
        title: "Champs manquants",
        description: "Veuillez saisir un nom et sélectionner un niveau.",
        variant: "destructive"
      });
      return;
    }
    try {
      if (modal === 'create-series') {
        await pedagogyService.createSeries({
          academicYearId: academicYear?.id,
          levelId: seriesForm.levelId,
          name: seriesForm.name.trim(),
          description: seriesForm.description.trim(),
        });
        toast({
          title: "Succès",
          description: "La série a été créée.",
        });
      } else {
        await pedagogyService.updateSeries(seriesForm.id, {
          name: seriesForm.name.trim(),
          description: seriesForm.description.trim(),
        });
        toast({
          title: "Succès",
          description: "La série a été mise à jour.",
        });
      }
      setModal('none');
      loadSeries();
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Une erreur est survenue.",
        variant: "destructive"
      });
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
                coefficient: 1,
                weeklyHours: 4,
                schoolLevelId: levels[0]?.id || '',
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
          { id: 'series', label: 'Séries (Secondaire)', icon: Layers },
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
                                <div className="font-semibold text-slate-900">{subject.name}</div>
                                <div className="text-xs text-slate-400 uppercase">{subject.code}</div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {subject.schoolLevel?.name ?? subject.schoolLevel?.label ?? '—'}
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
                                    coefficient: subject.coefficient,
                                    weeklyHours: subject.weeklyHours || 0,
                                    schoolLevelId: subject.schoolLevel?.id || '',
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
                                onClick={() => handleDeleteSubject(subject.id)}
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

          {tab === 'series' && (
            <div className="p-6 space-y-6">
               <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex gap-4">
                 <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                   <Info className="w-5 h-5" />
                 </div>
                 <div className="space-y-1">
                   <h5 className="text-sm font-bold text-amber-900">Séries du Secondaire</h5>
                   <p className="text-xs text-amber-700 leading-relaxed">
                     Les séries (A, C, D, etc.) permettent de regrouper les matières et de définir des coefficients spécifiques pour le niveau Secondaire.
                   </p>
                 </div>
               </div>

               {/* Toolbar */}
               <div className="flex justify-between items-center">
                 <h3 className="text-base font-semibold text-slate-900">Liste des séries enregistrées</h3>
                 <button 
                  type="button"
                  onClick={() => {
                    setSeriesForm({
                      id: '',
                      name: '',
                      description: '',
                      levelId: levels.find(l => /secondaire/i.test(l.name))?.id || levels[0]?.id || '',
                    });
                    setModal('create-series');
                  }}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
                  style={{ backgroundColor: PRIMARY }}
                 >
                   <Plus className="h-4 w-4" />
                   Ajouter une Série
                 </button>
               </div>

               {/* Table Series */}
               <div className="overflow-x-auto rounded-xl border border-slate-200">
                 <table className="min-w-full text-sm">
                   <thead>
                     <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                       <th className="px-4 py-3">Série</th>
                       <th className="px-4 py-3">Niveau Scolaire</th>
                       <th className="px-4 py-3">Description</th>
                       <th className="px-4 py-3 text-center">Statut</th>
                       <th className="px-4 py-3 text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody>
                     {series.length === 0 ? (
                       <tr>
                         <td colSpan={5} className="py-20 text-center text-slate-500">
                           <div className="max-w-xs mx-auto space-y-2">
                             <Layers className="w-8 h-8 text-slate-300 mx-auto" />
                             <p className="text-sm font-medium">Aucune série n'est définie.</p>
                           </div>
                         </td>
                       </tr>
                     ) : (
                       series.map((s) => (
                         <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                           <td className="px-4 py-3 font-semibold text-slate-900">
                             Série {s.name}
                           </td>
                           <td className="px-4 py-3 text-slate-600">
                             {s.level?.name || 'Secondaire'}
                           </td>
                           <td className="px-4 py-3 text-slate-600">
                             {s.description || '—'}
                           </td>
                           <td className="px-4 py-3 text-center">
                             <span className="rounded-full bg-emerald-100 text-emerald-900 px-2.5 py-0.5 text-xs font-semibold">
                               Active
                             </span>
                           </td>
                           <td className="px-4 py-3 text-right">
                             <button
                               type="button"
                               onClick={() => {
                                 setSeriesForm({
                                   id: s.id,
                                   name: s.name,
                                   description: s.description || '',
                                   levelId: s.level?.id || '',
                                 });
                                 setModal('edit-series');
                               }}
                               className="mr-3 text-sm font-medium hover:underline"
                               style={{ color: PRIMARY }}
                             >
                               Modifier
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
                                         onClick={() => handleRemoveClassSubject(cs.id)}
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
                       <th className="px-4 py-3 text-center">Version</th>
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
                               {s.schoolLevel?.name ?? s.schoolLevel?.label ?? '—'}
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
          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Nom</label>
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
               <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Coefficient</label>
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
          <div className="space-y-1">
             <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Niveau Scolaire</label>
             <select
               className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800 bg-white"
               value={subjectForm.schoolLevelId}
               onChange={(e) => setSubjectForm({ ...subjectForm, schoolLevelId: e.target.value })}
             >
               <option value="">Sélectionner un niveau</option>
               {levels.map(l => (
                 <option key={l.id} value={l.id}>{l.name}</option>
               ))}
             </select>
          </div>
        </div>
      </FormModal>

      <FormModal
        title={modal === 'edit-series' ? 'Modifier la série' : 'Nouvelle Série'}
        isOpen={modal === 'create-series' || modal === 'edit-series'}
        onClose={() => setModal('none')}
        onConfirm={handleSaveSeries}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Nom de la série</label>
            <input 
              type="text" 
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800" 
              placeholder="EX: Série D" 
              value={seriesForm.name}
              onChange={(e) => setSeriesForm({ ...seriesForm, name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Niveau</label>
            <select
              value={seriesForm.levelId}
              onChange={(e) => setSeriesForm({ ...seriesForm, levelId: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800 bg-white"
            >
              <option value="">Sélectionner un niveau</option>
              {levels.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Description</label>
            <textarea 
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800 bg-white" 
              placeholder="Description ou commentaires..." 
              value={seriesForm.description}
              onChange={(e) => setSeriesForm({ ...seriesForm, description: e.target.value })}
            />
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
              <div className="bg-slate-50 rounded-lg p-4 max-h-60 overflow-y-auto space-y-2 border border-slate-200">
                {classes.map(c => (
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
                ))}
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
    </div>
  );
}
