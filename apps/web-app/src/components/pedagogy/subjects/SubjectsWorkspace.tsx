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
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FormModal, 
  ConfirmModal, 
  ReadOnlyModal 
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAuth } from '@/hooks/useAuth';
import { pedagogyFetch, academicStructureUrl } from '@/lib/pedagogy/academic-structure-client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// --- Types ---

interface Subject {
  id: string;
  name: string;
  code: string;
  coefficient: number;
  weeklyHours?: number;
  description?: string;
  language?: string;
  schoolLevel?: { id: string; label: string; code: string };
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
  const { academicYear, schoolLevel, tenantId } = useModuleContext();
  const { user } = useAuth();
  const [tab, setTab] = useState<SubTab>('catalogue');
  const [loading, setLoading] = useState(false);

  // Data
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [series, setSeries] = useState<AcademicSeries[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  // Mass Assignment State
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [massConfig, setMassConfig] = useState({
    weeklyHours: 0,
    coefficient: 1.0,
    useSeries: true
  });

  // Modals
  const [modal, setModal] = useState<'none' | 'create-subject' | 'create-series' | 'edit-subject' | 'mass-assignment'>('none');

  const [selected, setSelected] = useState<any>(null);

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
      const data = await pedagogyFetch<Subject[]>(`/api/subjects?academicYearId=${academicYear.id}`);
      setSubjects(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id]);

  const loadSeries = useCallback(async () => {
    if (!academicYear?.id) return;
    try {
      const data = await pedagogyFetch<AcademicSeries[]>(`/api/pedagogy/academic-series?academicYearId=${academicYear.id}`);
      setSeries(data);
    } catch (e) {
      console.error(e);
    }
  }, [academicYear?.id]);

  const loadClasses = useCallback(async () => {
    if (!academicYear?.id) return;
    try {
      const data = await pedagogyFetch<any[]>(`/api/pedagogy/academic-classes?academicYearId=${academicYear.id}`);
      setClasses(data);
    } catch (e) {
      console.error(e);
    }
  }, [academicYear?.id]);

  useEffect(() => {
    loadSubjects();
    loadSeries();
    loadClasses();
  }, [loadSubjects, loadSeries, loadClasses]);

  const [uploading, setUploading] = useState(false);

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
       setModal('none');
       setSelectedClasses([]);
       setSelectedSubjects([]);
     } catch (e) {
       console.error(e);
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
    } catch (e) {
      console.error(e);
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
    } catch (e) {
      console.error(e);
    }
  };





  // --- Renderers ---

  return (
    <div className="space-y-6">
      {/* Banner / Connection Paramètres */}
      <div 
        className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        style={{ borderLeftWidth: 4, borderLeftColor: '#4f46e5' }}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-500">
              Année Scolaire Active
            </p>
            <p className="text-lg font-black text-gray-900">{academicYear?.label || 'Chargement...'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <a
            href={settingsHref}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all border border-gray-100"
          >
            <ExternalLink className="w-4 h-4" />
            Paramètres
          </a>
          <button 
            onClick={() => setModal('create-subject')}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 font-bold text-sm"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Matière
          </button>
        </div>
      </div>

      {/* Navigation Interne */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-1.5 border border-gray-200 flex gap-1 shadow-sm">
        {(['catalogue', 'series', 'classes', 'programs'] as SubTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "relative px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300",
              tab === t ? "text-indigo-600" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            )}
          >
            {tab === t && (
              <motion.div
                layoutId="subject-active-pill"
                className="absolute inset-0 bg-indigo-50 rounded-xl"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10 capitalize">
              {t === 'catalogue' ? 'Catalogue Matières' : 
               t === 'series' ? 'Séries (Secondaire)' : 
               t === 'classes' ? 'Affectation Classes' : 'Programmes Officiels'}
            </span>
          </button>
        ))}
      </div>

      {/* Zone de contenu dynamique */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
        >
          {tab === 'catalogue' && (
            <div className="p-6 space-y-6">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Chercher une matière (Code, Nom...)"
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium transition-all"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Grid / Table Catalogue */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400">
                      <th className="px-4 py-4">Matière</th>
                      <th className="px-4 py-4">Niveau</th>
                      <th className="px-4 py-4 text-center">Volume (h)</th>
                      <th className="px-4 py-4 text-center">Coeff par défaut</th>
                      <th className="px-4 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="py-20 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm font-bold text-gray-400">Génération du catalogue...</span>
                          </div>
                        </td>
                      </tr>
                    ) : subjects.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-20 text-center">
                          <div className="max-w-xs mx-auto space-y-4">
                            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto">
                              <BookOpen className="w-8 h-8 text-gray-200" />
                            </div>
                            <p className="text-sm text-gray-400 font-medium">Aucune matière n'est définie pour cette année scolaire.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      subjects.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase())).map((subject) => (
                        <tr key={subject.id} className="group hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-5">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xs">
                                {subject.code.substring(0, 3)}
                              </div>
                              <div>
                                <h4 className="font-bold text-gray-900">{subject.name}</h4>
                                <span className="text-[10px] font-mono text-gray-400 uppercase tracking-tighter">{subject.code}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-5">
                            <span className="text-sm font-medium text-gray-500">{subject.schoolLevel?.label ?? 'N/A'}</span>
                          </td>
                          <td className="px-4 py-5 text-center">
                            <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-bold text-gray-600">{subject.weeklyHours ?? 0}h</span>
                          </td>
                          <td className="px-4 py-5 text-center">
                            <span className="text-sm font-black text-indigo-600">{subject.coefficient}</span>
                          </td>
                          <td className="px-4 py-5 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-gray-400 hover:text-indigo-600 transition-all">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-gray-400 hover:text-rose-600 transition-all">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
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
               <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex gap-4">
                 <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                   <Info className="w-5 h-5" />
                 </div>
                 <div className="space-y-1">
                   <h5 className="text-sm font-bold text-amber-900">Séries du Secondaire</h5>
                   <p className="text-xs text-amber-700 leading-relaxed">
                     Les séries (A, C, D, etc.) permettent de regrouper les matières et de définir des coefficients spécifiques pour le niveau Secondaire.
                   </p>
                 </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {series.map(s => (
                   <div key={s.id} className="p-5 rounded-3xl border border-gray-100 hover:border-indigo-200 transition-all hover:shadow-lg hover:shadow-indigo-50 group cursor-pointer relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-4 opacity-[0.03] scale-150 rotate-12">
                       <Layers className="w-20 h-20 text-indigo-900" />
                     </div>
                     <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-indigo-100">
                          {s.name}
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-600 transition-colors" />
                     </div>
                     <h4 className="font-bold text-gray-900 text-lg mb-1">Série {s.name}</h4>
                     <p className="text-sm text-gray-500 font-medium mb-4 line-clamp-2">{s.description || 'Aucune description'}</p>
                     <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                       <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{s.level?.name || 'Secondaire'}</span>
                       <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-black uppercase tracking-tight">Active</span>
                     </div>
                   </div>
                 ))}
                 <button 
                  onClick={() => setModal('create-series')}
                  className="p-5 rounded-3xl border-2 border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all flex flex-col items-center justify-center gap-3 text-gray-400 hover:text-indigo-600"
                 >
                   <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
                     <Plus className="w-6 h-6" />
                   </div>
                   <span className="text-sm font-bold">Ajouter une Série</span>
                 </button>
               </div>
            </div>
          )}

          {tab === 'classes' && (
             <div className="p-10 text-center space-y-4">
                <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto text-indigo-600">
                   <ArrowUpRight className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Affectation des Matières</h3>
                <p className="text-gray-500 max-w-sm mx-auto text-sm">Gérez les coefficients et volumes horaires spécifiques pour chaque classe en fonction de sa série.</p>
                <div className="pt-6">
                   <button 
                    onClick={() => setModal('mass-assignment')}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:scale-105 transition-all flex items-center gap-2 mx-auto"
                   >
                     <Sparkles className="w-4 h-4" />
                     Lancer l'assistant d'affectation
                   </button>
                </div>
             </div>
          )}


          {tab === 'programs' && (
            <div className="p-6 space-y-8">
               <div className="flex items-center justify-between border-b border-gray-50 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Programmes Officiels</h3>
                      <p className="text-sm text-gray-500 font-medium">Documents PDF de référence institutionnelle (Signés & Scellés)</p>
                    </div>
                  </div>
                  <button className="flex items-center gap-2 text-indigo-600 font-bold text-sm hover:underline">
                    <Download className="w-4 h-4" />
                    Tout télécharger (.zip)
                  </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {subjects.map(s => {
                   const latestProgram = s.programs && s.programs.length > 0 ? s.programs[0] : null;
                   const isApproved = !!latestProgram?.approvedAt;

                   return (
                    <div key={s.id} className="p-5 bg-gray-50/50 rounded-3xl border border-gray-100 flex flex-col gap-4 hover:border-indigo-100 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center">
                              <FileText className={cn("w-6 h-6", latestProgram ? "text-rose-500" : "text-gray-200")} />
                           </div>
                           <div>
                              <h4 className="font-bold text-gray-900 text-sm">{s.name}</h4>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{s.code}</p>
                           </div>
                        </div>
                        {isApproved && (
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] font-black text-emerald-600 uppercase">Validé</span>
                            <span className="text-[8px] text-gray-400">{format(new Date(latestProgram!.approvedAt!), 'dd/MM/yyyy', { locale: fr })}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {latestProgram ? (
                          <div className="flex-1 flex items-center gap-2 p-2 bg-white rounded-xl border border-gray-100">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-bold text-gray-600 truncate">v{latestProgram.version}</span>
                            <a 
                              href={latestProgram.documentUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="ml-auto p-1.5 hover:bg-gray-50 rounded-lg text-indigo-600"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        ) : (
                          <div className="flex-1 p-2 border-2 border-dashed border-gray-200 rounded-xl text-center">
                            <span className="text-[10px] font-bold text-gray-400">Aucun document</span>
                          </div>
                        )}

                        <div className="relative group">
                           <input 
                              type="file" 
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                              accept=".pdf"
                              onChange={(e) => {
                                 const file = e.target.files?.[0];
                                 if (file) handleUploadProgram(s.id, file);
                              }}
                           />
                           <button className={cn(
                              "p-2.5 rounded-xl bg-gray-100 text-gray-400 group-hover:bg-indigo-600 group-hover:text-white transition-all",
                              uploading && "opacity-50 cursor-not-allowed"
                           )}>
                             <Plus className="w-4 h-4" />
                           </button>
                        </div>
                      </div>

                      {latestProgram && !isApproved && (
                        <button 
                          onClick={() => handleApproveProgram(latestProgram.id)}
                          className="w-full py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"
                        >
                          Approuver & Signer
                        </button>
                      )}
                    </div>
                   );
                 })}
               </div>

            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Orion Insight Banner */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-gradient-to-r from-indigo-900 to-blue-900 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <Sparkles className="w-24 h-24" />
        </div>
        <div className="flex items-center gap-6 relative">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
            <CheckCircle2 className="w-8 h-8 text-indigo-300" />
          </div>
          <div>
            <h4 className="text-lg font-black tracking-tight mb-1">Intelligence Pédagogique ORION</h4>
            <p className="text-indigo-100/80 text-sm max-w-2xl leading-relaxed">
              Toutes les matières obligatoires sont couvertes pour le niveau primaire. 
              Attention : 3 matières en série D n'ont pas encore de volume horaire défini.
            </p>
          </div>
          <button className="ml-auto px-6 py-3 bg-white text-indigo-900 rounded-2xl font-bold text-sm hover:bg-indigo-50 transition-all">
            Analyser tout
          </button>
        </div>
      </motion.div>

      {/* Modals */}
      <FormModal
        title={modal === 'edit-subject' ? 'Modifier la matière' : 'Nouvelle Matière'}
        isOpen={modal === 'create-subject' || modal === 'edit-subject'}
        onClose={() => setModal('none')}
        onConfirm={async () => {
          // Logic for save
          setModal('none');
          loadSubjects();
        }}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-black uppercase text-gray-400">Code Matière</label>
              <input type="text" className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="EX: MATH-01" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black uppercase text-gray-400">Nom</label>
              <input type="text" className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="Mathématiques" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1">
               <label className="text-xs font-black uppercase text-gray-400">Coefficient</label>
               <input type="number" className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="2" />
             </div>
             <div className="space-y-1">
               <label className="text-xs font-black uppercase text-gray-400">Volume Hebdo (h)</label>
               <input type="number" className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="4" />
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
          <div className="bg-indigo-50 p-4 rounded-2xl flex gap-3">
             <Info className="w-5 h-5 text-indigo-600 mt-1" />
             <p className="text-sm text-indigo-900 font-medium leading-relaxed">
               Cet assistant permet de lier plusieurs matières à plusieurs classes simultanément. 
               Si vous activez l'option <b>"Priorité aux coefficients de série"</b>, le système ignorera les valeurs saisies ici pour utiliser celles définies dans le catalogue des séries pour chaque couple classe/matière.
             </p>
          </div>

          <div className="grid grid-cols-2 gap-8">
            {/* Colonne Classes */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Étape 1 : Choisir les Classes ({selectedClasses.length})</label>
              <div className="bg-gray-50 rounded-2xl p-4 max-h-60 overflow-y-auto space-y-2 border border-gray-100">
                {classes.map(c => (
                  <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-xl transition-colors cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={selectedClasses.includes(c.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedClasses([...selectedClasses, c.id]);
                        else setSelectedClasses(selectedClasses.filter(id => id !== c.id));
                      }}
                    />
                    <span className="text-sm font-bold text-gray-700 group-hover:text-indigo-600">{c.name}</span>
                    {c.series && <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded text-[8px] font-black">{c.series.name}</span>}
                  </label>
                ))}
              </div>
            </div>

            {/* Colonne Matières */}
            <div className="space-y-3">
               <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Étape 2 : Choisir les Matières ({selectedSubjects.length})</label>
               <div className="bg-gray-50 rounded-2xl p-4 max-h-60 overflow-y-auto space-y-2 border border-gray-100">
                {subjects.map(s => (
                  <label key={s.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-xl transition-colors cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={selectedSubjects.includes(s.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedSubjects([...selectedSubjects, s.id]);
                        else setSelectedSubjects(selectedSubjects.filter(id => id !== s.id));
                      }}
                    />
                    <span className="text-sm font-bold text-gray-700 group-hover:text-indigo-600">{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 grid grid-cols-3 gap-6">
             <div className="space-y-1">
               <label className="text-[10px] font-black uppercase text-gray-400">Coefficient Global</label>
               <input 
                type="number" 
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 font-bold"
                value={massConfig.coefficient}
                onChange={(e) => setMassConfig({...massConfig, coefficient: parseFloat(e.target.value)})}
               />
             </div>
             <div className="space-y-1">
               <label className="text-[10px] font-black uppercase text-gray-400">Heures Hebdo</label>
               <input 
                type="number" 
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 font-bold"
                value={massConfig.weeklyHours}
                onChange={(e) => setMassConfig({...massConfig, weeklyHours: parseInt(e.target.value)})}
               />
             </div>
             <div className="flex items-center gap-3 pt-6">
                <input 
                  type="checkbox" 
                  id="use-series" 
                  className="w-5 h-5 rounded-lg border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  checked={massConfig.useSeries}
                  onChange={(e) => setMassConfig({...massConfig, useSeries: e.target.checked})}
                />
                <label htmlFor="use-series" className="text-xs font-black text-gray-600 cursor-pointer">Priorité aux coefficients de série</label>
             </div>
          </div>
        </div>
      </FormModal>
    </div>
  );
}


