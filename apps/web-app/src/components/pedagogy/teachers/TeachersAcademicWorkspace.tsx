/**
 * ============================================================================
 * TEACHERS ACADEMIC WORKSPACE - MODULE 2 (Enseignants Académiques)
 * ============================================================================
 * 
 * Gestion des profils académiques des enseignants :
 * 1. Habilitations par matière
 * 2. Autorisations par niveau
 * 3. Charge horaire maximale
 * 4. Disponibilités hebdomadaires
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Search, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Info,
  ShieldCheck,
  Clock,
  Calendar,
  Plus,
  X,
  UserCheck,
  UserX,
  FileText,
  BookOpen,
  ClipboardList,
  BarChart3,
  TrendingUp,
  ShieldAlert,
  Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FormModal, 
  ConfirmModal, 
  ReadOnlyModal 
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { pedagogyService } from '@/services/pedagogy.service';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import AssignmentsWorkspace from '../assignments/AssignmentsWorkspace';

// --- Types ---

interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  matricule: string;
  email?: string;
  status?: string;
}

interface TeacherAcademicProfile {
  id: string;
  teacherId: string;
  academicYearId: string;
  maxWeeklyHours: number;
  isSemainier: boolean;
  isActive: boolean;
  teacher: Teacher;
  subjectQualifications: any[];
  levelAuthorizations: any[];
  availabilities: any[];
}

export default function TeachersAcademicWorkspace() {
  const { academicYear, tenantId } = useModuleContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [profiles, setProfiles] = useState<TeacherAcademicProfile[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<TeacherAcademicProfile | null>(null);

  // Tabs selection
  const [activeSubTab, setActiveSubTab] = useState<'teachers' | 'assignments' | 'workloads'>('teachers');

  // --- Workload Analysis ---
  const [workloadLoading, setWorkloadLoading] = useState(false);
  const [globalWorkloads, setGlobalWorkloads] = useState<Record<string, { assigned: number, details: any[] }>>({});

  const loadGlobalWorkloads = useCallback(async () => {
    if (!academicYear?.id) return;
    setWorkloadLoading(true);
    try {
      const classesData = await pedagogyService.getAcademicClasses(academicYear.id);
      const loads: Record<string, { assigned: number, details: any[] }> = {};
      
      const promises = (classesData || []).map(async (cls: any) => {
        const subjects = await pedagogyService.getClassSubjects(cls.id, academicYear.id);
        (subjects || []).forEach((cs: any) => {
          const assignment = cs.assignments?.[0];
          if (assignment?.teacher) {
            const tId = assignment.teacher.id;
            if (!loads[tId]) {
              loads[tId] = { assigned: 0, details: [] };
            }
            loads[tId].assigned += cs.weeklyHours || 0;
            loads[tId].details.push({
              className: cls.name,
              subjectName: cs.subject.name,
              subjectCode: cs.subject.code,
              hours: cs.weeklyHours
            });
          }
        });
      });
      
      await Promise.all(promises);
      setGlobalWorkloads(loads);
    } catch (e) {
      console.error("Error loading workloads:", e);
    } finally {
      setWorkloadLoading(false);
    }
  }, [academicYear?.id]);

  useEffect(() => {
    if (activeSubTab === 'workloads') {
      loadGlobalWorkloads();
    }
  }, [activeSubTab, loadGlobalWorkloads]);

  // Modals
  const [modal, setModal] = useState<'none' | 'create-teacher' | 'edit-teacher' | 'edit-profile' | 'add-qualification' | 'add-authorization' | 'add-availability'>('none');

  // --- Loaders ---

  const loadData = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const [teachersData, profilesData] = await Promise.all([
        pedagogyService.getTeachers(),
        pedagogyService.getTeacherProfiles(academicYear.id)
      ]);
      setTeachers(teachersData || []);
      setProfiles(profilesData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectTeacher = async (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    const existing = profiles.find(p => p.teacherId === teacherId);
    if (existing) {
      setActiveProfile(existing);
    } else {
      setActiveProfile(null);
    }
  };

  const handleCreateProfile = async () => {
    if (!selectedTeacherId || !academicYear?.id) return;
    try {
      const newProfile = await pedagogyService.createTeacherProfile({
        academicYearId: academicYear.id,
        teacherId: selectedTeacherId,
        maxWeeklyHours: 18, // Default
        isSemainier: false
      });
      setProfiles(prev => [...prev, newProfile]);
      setActiveProfile(newProfile);
      toast({
        title: "Succès",
        description: "Profil académique initialisé avec succès.",
      });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Erreur lors de la création du profil.",
        variant: "destructive"
      });
    }
  };

  const handleUpdateProfile = async (data: any) => {
    if (!activeProfile) return;
    try {
      const updated = await pedagogyService.updateTeacherProfile(activeProfile.id, data);
      setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p));
      setActiveProfile(updated);
      setModal('none');
      toast({
        title: "Succès",
        description: "Profil mis à jour.",
      });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Impossible de mettre à jour le profil.",
        variant: "destructive"
      });
    }
  };

  const handleCreateTeacher = async (data: any) => {
    try {
      const newTeacher = await pedagogyService.createTeacher(data);
      setTeachers(prev => [...prev, newTeacher]);
      setModal('none');
      selectTeacher(newTeacher.id);
      toast({
        title: "Succès",
        description: "Enseignant créé.",
      });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Erreur lors de la création.",
        variant: "destructive"
      });
    }
  };

  const handleUpdateTeacher = async (data: any) => {
    if (!selectedTeacherId) return;
    try {
      const updated = await pedagogyService.updateTeacher(selectedTeacherId, data);
      setTeachers(prev => prev.map(t => t.id === updated.id ? updated : t));
      setModal('none');
      toast({
        title: "Succès",
        description: "Informations de l'enseignant mises à jour.",
      });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Erreur lors de la modification.",
        variant: "destructive"
      });
    }
  };

  // --- Qualifications ---
  const [subjects, setSubjects] = useState<any[]>([]);
  const loadSubjects = useCallback(async () => {
     if (!academicYear?.id) return;
     const data = await pedagogyService.getSubjects(academicYear.id);
     setSubjects(data || []);
  }, [academicYear?.id]);

  useEffect(() => {
    if (modal === 'add-qualification') loadSubjects();
  }, [modal, loadSubjects]);

  const handleAddQualification = async (subjectId: string) => {
    if (!activeProfile || !academicYear?.id) return;
    try {
      await pedagogyFetch(`/api/pedagogy/teacher-profiles/${activeProfile.id}/qualifications`, {
        method: 'POST',
        body: {
          academicYearId: academicYear.id,
          subjectId,
          certified: true
        }
      });
      // Refresh
      const updated = await pedagogyFetch<TeacherAcademicProfile>(`/api/pedagogy/teacher-profiles/${activeProfile.id}`);
      setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p));
      setActiveProfile(updated);
      setModal('none');
      toast({
        title: "Succès",
        description: "Matière ajoutée aux habilitations.",
      });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Erreur lors de l'ajout.",
        variant: "destructive"
      });
    }
  };

  const handleRemoveQualification = async (subjectId: string) => {
    if (!activeProfile) return;
    try {
      await pedagogyFetch(`/api/pedagogy/teacher-profiles/${activeProfile.id}/qualifications/${subjectId}`, {
        method: 'DELETE'
      });
      const updated = await pedagogyFetch<TeacherAcademicProfile>(`/api/pedagogy/teacher-profiles/${activeProfile.id}`);
      setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p));
      setActiveProfile(updated);
      toast({
        title: "Succès",
        description: "Habilitation retirée.",
      });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Erreur lors du retrait.",
        variant: "destructive"
      });
    }
  };

  // --- Niveaux Autorisés ---
  const [schoolLevels, setSchoolLevels] = useState<any[]>([]);
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

  useEffect(() => {
    if (modal === 'add-authorization') loadSchoolLevels();
  }, [modal, loadSchoolLevels]);

  const handleAddLevelAuthorization = async (levelId: string) => {
    if (!activeProfile || !academicYear?.id) return;
    try {
      await pedagogyFetch(`/api/pedagogy/teacher-profiles/${activeProfile.id}/level-authorizations`, {
        method: 'POST',
        body: {
          academicYearId: academicYear.id,
          levelId
        }
      });
      const updated = await pedagogyFetch<TeacherAcademicProfile>(`/api/pedagogy/teacher-profiles/${activeProfile.id}`);
      setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p));
      setActiveProfile(updated);
      setModal('none');
      toast({
        title: "Succès",
        description: "Niveau autorisé ajouté.",
      });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Erreur lors de l'ajout.",
        variant: "destructive"
      });
    }
  };

  const handleRemoveLevelAuthorization = async (levelId: string) => {
    if (!activeProfile) return;
    try {
      await pedagogyFetch(`/api/pedagogy/teacher-profiles/${activeProfile.id}/level-authorizations/${levelId}`, {
        method: 'DELETE'
      });
      const updated = await pedagogyFetch<TeacherAcademicProfile>(`/api/pedagogy/teacher-profiles/${activeProfile.id}`);
      setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p));
      setActiveProfile(updated);
      toast({
        title: "Succès",
        description: "Autorisation retirée.",
      });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Erreur lors du retrait.",
        variant: "destructive"
      });
    }
  };

  // --- Availabilities ---

  const handleAddAvailability = async (data: any) => {
    if (!activeProfile || !academicYear?.id) return;
    try {
      await pedagogyFetch(`/api/pedagogy/teacher-profiles/${activeProfile.id}/availabilities`, {
        method: 'POST',
        body: {
          academicYearId: academicYear.id,
          dayOfWeek: Number(data.dayOfWeek),
          startTime: data.startTime,
          endTime: data.endTime
        }
      });
      const updated = await pedagogyFetch<TeacherAcademicProfile>(`/api/pedagogy/teacher-profiles/${activeProfile.id}`);
      setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p));
      setActiveProfile(updated);
      setModal('none');
      toast({
        title: "Succès",
        description: "Disponibilité ajoutée.",
      });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Erreur lors de l'ajout.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteAvailability = async (id: string) => {
    if (!activeProfile) return;
    try {
      await pedagogyFetch(`/api/pedagogy/teacher-profiles/availabilities/${id}`, {
        method: 'DELETE'
      });
      const updated = await pedagogyFetch<TeacherAcademicProfile>(`/api/pedagogy/teacher-profiles/${activeProfile.id}`);
      setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p));
      setActiveProfile(updated);
      toast({
        title: "Succès",
        description: "Disponibilité supprimée.",
      });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Erreur lors de la suppression.",
        variant: "destructive"
      });
    }
  };

  const DAYS = [
    { id: 1, label: 'Lundi' },
    { id: 2, label: 'Mardi' },
    { id: 3, label: 'Mercredi' },
    { id: 4, label: 'Jeudi' },
    { id: 5, label: 'Vendredi' },
    { id: 6, label: 'Samedi' },
  ];

  // --- Filtered List ---
  const filteredTeachers = teachers.filter(t => 
    `${t.firstName} ${t.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    t.matricule.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-12rem)] overflow-hidden">
      {/* Premium Segmented Controls Tab Bar */}
      <div className="flex items-center justify-between bg-white border border-gray-100 p-2 rounded-2xl shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSubTab('teachers')}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all",
              activeSubTab === 'teachers'
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            )}
          >
            <Users className="w-4 h-4" />
            Profils & Disponibilités
          </button>
          
          <button
            onClick={() => setActiveSubTab('assignments')}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all",
              activeSubTab === 'assignments'
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            )}
          >
            <ClipboardList className="w-4 h-4" />
            Affectations par Classe
          </button>

          <button
            onClick={() => setActiveSubTab('workloads')}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all",
              activeSubTab === 'workloads'
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            )}
          >
            <BarChart3 className="w-4 h-4" />
            Charge Horaire Globale
          </button>
        </div>

        {activeSubTab === 'teachers' && (
          <button
            onClick={() => setModal('create-teacher')}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white font-black text-xs uppercase tracking-wider transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Créer un enseignant
          </button>
        )}
      </div>

      {/* Main Views */}
      <div className="flex-1 overflow-hidden">
        {activeSubTab === 'teachers' && (
          <div className="flex h-full gap-6 overflow-hidden">
            {/* Liste des enseignants (Gauche) */}
            <div className="w-1/3 bg-white rounded-3xl border border-gray-100 flex flex-col shadow-sm">
              <div className="p-6 border-b border-gray-50 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Users className="w-6 h-6 text-indigo-600" />
                    Corps Enseignant
                  </h2>
                </div>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher par nom ou matricule..."
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium transition-all"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {loading ? (
                  <div className="p-8 text-center space-y-3">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-gray-400 font-medium">Chargement des dossiers...</p>
                  </div>
                ) : filteredTeachers.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm italic">
                    Aucun enseignant trouvé.
                  </div>
                ) : (
                  filteredTeachers.map(teacher => {
                    const hasProfile = profiles.some(p => p.teacherId === teacher.id);
                    const isSelected = selectedTeacherId === teacher.id;
                    
                    return (
                      <button
                        key={teacher.id}
                        onClick={() => selectTeacher(teacher.id)}
                        className={cn(
                          "w-full text-left p-4 rounded-2xl transition-all flex items-center justify-between group",
                          isSelected ? "bg-indigo-50 border-indigo-100" : "hover:bg-gray-50 border-transparent"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shadow-sm transition-all",
                            isSelected ? "bg-indigo-600 text-white" : "bg-white text-gray-600 border border-gray-100"
                          )}>
                            {teacher.firstName[0]}{teacher.lastName[0]}
                          </div>
                          <div>
                            <p className={cn("font-bold text-sm", isSelected ? "text-indigo-900" : "text-gray-900")}>
                              {teacher.lastName} {teacher.firstName}
                            </p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                              {teacher.matricule}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className={cn(
                          "w-4 h-4 transition-all",
                          isSelected ? "text-indigo-600 translate-x-1" : "text-gray-300 opacity-0 group-hover:opacity-100"
                        )} />
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Fiche active (Droite) */}
            <div className="flex-1 bg-white rounded-3xl border border-gray-100 flex flex-col shadow-sm overflow-hidden">
              {selectedTeacherId ? (
                activeProfile ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Header Profil */}
                    <div className="p-6 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg shadow-indigo-100">
                          {activeProfile.teacher.firstName[0]}{activeProfile.teacher.lastName[0]}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">
                            {activeProfile.teacher.lastName} {activeProfile.teacher.firstName}
                          </h3>
                          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                            <span>{activeProfile.teacher.matricule}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300" />
                            <span className={activeProfile.isActive ? "text-emerald-600" : "text-red-500"}>
                              {activeProfile.isActive ? 'Actif' : 'Inactif'}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setModal('edit-teacher')}
                          className="px-4 py-2 border border-gray-100 rounded-xl hover:bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-600 transition-all"
                        >
                          Infos Perso
                        </button>
                        <button 
                          onClick={() => setModal('edit-profile')}
                          className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                        >
                          Paramètres Profil
                        </button>
                      </div>
                    </div>

                    {/* Contenu Profil */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {/* KPI Summary Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-5 rounded-2xl border border-gray-100 bg-gray-50/30 flex items-center gap-4">
                          <Clock className="w-8 h-8 text-indigo-600" />
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Volume Max</p>
                            <p className="text-lg font-black text-gray-900">{activeProfile.maxWeeklyHours}h/sem</p>
                          </div>
                        </div>

                        <div className="p-5 rounded-2xl border border-gray-100 bg-gray-50/30 flex items-center gap-4">
                          <ShieldCheck className="w-8 h-8 text-emerald-500" />
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Habilitations</p>
                            <p className="text-lg font-black text-gray-900">{activeProfile.subjectQualifications.length} matières</p>
                          </div>
                        </div>

                        <div className="p-5 rounded-2xl border border-gray-100 bg-gray-50/30 flex items-center gap-4">
                          <Calendar className="w-8 h-8 text-indigo-600" />
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Niveaux</p>
                            <p className="text-lg font-black text-gray-900">{activeProfile.levelAuthorizations.length} autorisés</p>
                          </div>
                        </div>
                      </div>

                      {/* Section : Habilitations Matières */}
                      <div className="space-y-4 pt-4 border-t border-gray-50">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-indigo-600" />
                            Matières qualifiées (Habilitations)
                          </h4>
                          <button 
                            onClick={() => setModal('add-qualification')}
                            className="text-indigo-600 hover:text-indigo-800 text-xs font-black uppercase tracking-wider flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Ajouter
                          </button>
                        </div>
                        {activeProfile.subjectQualifications.length === 0 ? (
                          <div className="p-4 bg-gray-50 rounded-2xl text-center text-xs text-gray-400 italic">
                            Aucune matière qualifiée déclarée. L'enseignant ne pourra être affecté dans l'assistant.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {activeProfile.subjectQualifications.map(q => (
                              <div key={q.id} className="p-4 rounded-2xl border border-gray-100 bg-white shadow-sm flex items-center justify-between group">
                                <div>
                                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 tracking-wider">
                                    {q.subject.code}
                                  </span>
                                  <p className="font-bold text-gray-800 text-xs mt-1.5">{q.subject.name}</p>
                                </div>
                                <button 
                                  onClick={() => handleRemoveQualification(q.subjectId)}
                                  className="text-gray-300 hover:text-red-500 p-1 rounded transition-all opacity-0 group-hover:opacity-100"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Section : Niveaux Autorisés */}
                      <div className="space-y-4 pt-4 border-t border-gray-50">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-indigo-600" />
                            Niveaux Scolaires Autorisés
                          </h4>
                          <button 
                            onClick={() => setModal('add-authorization')}
                            className="text-indigo-600 hover:text-indigo-800 text-xs font-black uppercase tracking-wider flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Ajouter
                          </button>
                        </div>
                        {activeProfile.levelAuthorizations.length === 0 ? (
                          <div className="p-4 bg-gray-50 rounded-2xl text-center text-xs text-gray-400 italic">
                            Aucun niveau spécifique autorisé. (Par défaut : habilité sur tous les niveaux).
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {activeProfile.levelAuthorizations.map(auth => (
                              <div key={auth.id} className="pl-3 pr-2 py-1.5 rounded-full border border-indigo-100 bg-indigo-50/50 flex items-center gap-2 group transition-all">
                                <span className="text-[10px] font-black uppercase text-indigo-900">
                                  {auth.level.name}
                                </span>
                                <button 
                                  onClick={() => handleRemoveLevelAuthorization(auth.levelId)}
                                  className="text-indigo-400 hover:text-red-500 rounded-full transition-all"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Section : Disponibilités Hebdomadaires */}
                      <div className="space-y-4 pt-4 border-t border-gray-50">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-indigo-600" />
                            Disponibilités d'emploi du temps
                          </h4>
                          <button 
                            onClick={() => setModal('add-availability')}
                            className="text-indigo-600 hover:text-indigo-800 text-xs font-black uppercase tracking-wider flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Ajouter un créneau
                          </button>
                        </div>
                        {activeProfile.availabilities.length === 0 ? (
                          <div className="p-4 bg-gray-50 rounded-2xl text-center text-xs text-gray-400 italic">
                            Aucune contrainte horaire déclarée. Enseignant disponible 100% du temps.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {activeProfile.availabilities.map(av => {
                              const dayLabel = DAYS.find(d => d.id === av.dayOfWeek)?.label || 'Jour';
                              return (
                                <div key={av.id} className="p-4 rounded-2xl border border-gray-100 bg-white shadow-sm flex items-center justify-between group">
                                  <div>
                                    <p className="font-bold text-gray-800 text-xs">{dayLabel}</p>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-indigo-600" />
                                      {av.startTime} à {av.endTime}
                                    </p>
                                  </div>
                                  <button 
                                    onClick={() => handleDeleteAvailability(av.id)}
                                    className="text-gray-300 hover:text-red-500 p-1 rounded transition-all opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
                    <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 shadow-lg shadow-indigo-50">
                      <Users className="w-10 h-10" />
                    </div>
                    <div className="max-w-sm space-y-2">
                      <h3 className="text-xl font-bold text-gray-900">Profil Académique Non Initialisé</h3>
                      <p className="text-xs text-gray-400 font-medium">
                        Cet enseignant est enregistré dans le personnel, mais son profil académique de cours pour cette année n'est pas encore créé.
                      </p>
                    </div>
                    <button 
                      onClick={handleCreateProfile}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                    >
                      Initialiser le profil académique
                    </button>
                  </div>
                )
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400 italic">
                  Sélectionnez un enseignant pour afficher son profil.
                </div>
              )}
            </div>
          </div>
        )}

        {activeSubTab === 'assignments' && (
          <div className="h-full overflow-hidden">
            <AssignmentsWorkspace />
          </div>
        )}

        {activeSubTab === 'workloads' && (
          <div className="h-full flex flex-col gap-6 overflow-hidden">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Enseignants Actifs</p>
                  <p className="text-2xl font-black text-gray-900 mt-0.5">{teachers.length}</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Heures Totales Affectées</p>
                  <p className="text-2xl font-black text-gray-900 mt-0.5">
                    {Object.values(globalWorkloads).reduce((sum, w) => sum + w.assigned, 0)}h
                  </p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Professeurs Surchargés</p>
                  <p className="text-2xl font-black text-gray-900 mt-0.5">
                    {teachers.filter(t => {
                      const profile = profiles.find(p => p.teacherId === t.id);
                      const assigned = globalWorkloads[t.id]?.assigned || 0;
                      const capacity = profile?.maxWeeklyHours || 18;
                      return assigned > capacity;
                    }).length}
                  </p>
                </div>
              </div>
            </div>

            {/* List Table of Workloads */}
            <div className="flex-1 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-50 bg-gray-50/20">
                <h3 className="text-lg font-black text-gray-900">Suivi Global de la Charge Académique</h3>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Comparatif charges réelles vs capacités maximales</p>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {workloadLoading ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Analyse et agrégation des charges...</p>
                  </div>
                ) : teachers.length === 0 ? (
                  <div className="p-12 text-center text-gray-400 italic text-sm">
                    Aucun dossier enseignant disponible.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                          <th className="pb-4 font-black">Enseignant</th>
                          <th className="pb-4 font-black">Niveaux Autorisés</th>
                          <th className="pb-4 font-black">Habilitations</th>
                          <th className="pb-4 font-black">Charge / Capacité</th>
                          <th className="pb-4 font-black text-center">Statut</th>
                          <th className="pb-4 font-black text-right">Détails des cours</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {teachers.map(t => {
                          const profile = profiles.find(p => p.teacherId === t.id);
                          const assigned = globalWorkloads[t.id]?.assigned || 0;
                          const capacity = profile?.maxWeeklyHours || 18;
                          const percent = Math.min(Math.round((assigned / capacity) * 100), 100);
                          
                          let statusLabel = "Optimal";
                          let statusColorClass = "bg-emerald-50 text-emerald-700 border border-emerald-100";
                          let barColorClass = "bg-emerald-500";
                          let icon = <CheckCircle2 className="w-3.5 h-3.5" />;

                          if (assigned > capacity) {
                            statusLabel = "Surchargé";
                            statusColorClass = "bg-rose-50 text-rose-700 border border-rose-100";
                            barColorClass = "bg-rose-500";
                            icon = <ShieldAlert className="w-3.5 h-3.5" />;
                          } else if (assigned < capacity * 0.7) {
                            statusLabel = "Sous-chargé";
                            statusColorClass = "bg-indigo-50 text-indigo-700 border border-indigo-100";
                            barColorClass = "bg-indigo-500";
                            icon = <Clock className="w-3.5 h-3.5" />;
                          }

                          return (
                            <tr key={t.id} className="text-sm group hover:bg-gray-50/30 transition-all">
                              {/* Teacher Info */}
                              <td className="py-4 pr-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center font-black text-xs text-gray-600">
                                    {t.firstName[0]}{t.lastName[0]}
                                  </div>
                                  <div>
                                    <p className="font-bold text-gray-900">{t.lastName} {t.firstName}</p>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{t.matricule}</p>
                                  </div>
                                </div>
                              </td>

                              {/* Authorized Levels */}
                              <td className="py-4 pr-4">
                                <div className="flex flex-wrap gap-1">
                                  {profile?.levelAuthorizations && profile.levelAuthorizations.length > 0 ? (
                                    profile.levelAuthorizations.map((la: any) => (
                                      <span key={la.id} className="text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-600">
                                        {la.level?.name}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[10px] text-gray-400 italic font-bold">Tous niveaux</span>
                                  )}
                                </div>
                              </td>

                              {/* Habilitations */}
                              <td className="py-4 pr-4">
                                <div className="flex flex-wrap gap-1">
                                  {profile?.subjectQualifications && profile.subjectQualifications.length > 0 ? (
                                    profile.subjectQualifications.map((sq: any) => (
                                      <span key={sq.id} className="text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-lg bg-indigo-50/50 border border-indigo-100/50 text-indigo-700">
                                        {sq.subject?.code}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[10px] text-gray-400 italic font-bold">Aucune</span>
                                  )}
                                </div>
                              </td>

                              {/* Workload hours progress */}
                              <td className="py-4 pr-4 min-w-[150px]">
                                <div className="space-y-1">
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-xs font-black text-gray-900">{assigned}h <span className="text-gray-400 font-bold">/ {capacity}h</span></span>
                                    <span className="text-[9px] font-black text-gray-400">{percent}%</span>
                                  </div>
                                  <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                    <div className={cn("h-full rounded-full transition-all duration-500", barColorClass)} style={{ width: `${percent}%` }} />
                                  </div>
                                </div>
                              </td>

                              {/* Status Badge */}
                              <td className="py-4 pr-4 text-center">
                                <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wide", statusColorClass)}>
                                  {icon}
                                  {statusLabel}
                                </span>
                              </td>

                              {/* Assigned courses details list */}
                              <td className="py-4 text-right">
                                <div className="inline-flex flex-col items-end gap-1 max-w-[200px] text-left">
                                  {globalWorkloads[t.id]?.details && globalWorkloads[t.id].details.length > 0 ? (
                                    globalWorkloads[t.id].details.map((d: any, idx: number) => (
                                      <div key={idx} className="text-[10px] font-bold text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 flex items-center justify-between gap-3 w-full">
                                        <span className="truncate">{d.className} - {d.subjectCode}</span>
                                        <span className="font-black text-indigo-600 whitespace-nowrap">{d.hours}h</span>
                                      </div>
                                    ))
                                  ) : (
                                    <span className="text-[10px] text-gray-400 italic font-bold">Aucun cours affecté</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Edit Profile */}
      <FormModal
        isOpen={modal === 'edit-profile'}
        onClose={() => setModal('none')}
        title="Modifier Paramètres Académiques"
        onSave={handleUpdateProfile}
        initialData={activeProfile}
        fields={[
          {
            name: 'maxWeeklyHours',
            label: 'Volume Horaire Hebdomadaire Maximum (h)',
            type: 'number',
            placeholder: '18'
          },
          {
            name: 'isSemainier',
            label: 'Soumis au Semainier',
            type: 'checkbox'
          }
        ]}
      />

      {/* Modal Add Qualification */}
      <FormModal
        isOpen={modal === 'add-qualification'}
        onClose={() => setModal('none')}
        title="Nouvelle Habilitation"
        onSave={(data) => handleAddQualification(data.subjectId)}
        fields={[
          {
            name: 'subjectId',
            label: 'Matière',
            type: 'select',
            options: subjects.map(s => ({ value: s.id, label: `${s.code} - ${s.name}` }))
          },
          {
            name: 'certified',
            label: 'Habilitation officielle (Diplômé)',
            type: 'checkbox'
          }
        ]}
      />

      {/* Modal Create Teacher */}
      <FormModal
        isOpen={modal === 'create-teacher'}
        onClose={() => setModal('none')}
        title="Nouvel Enseignant"
        onSave={handleCreateTeacher}
        fields={[
          { name: 'firstName', label: 'Prénom', type: 'text', placeholder: 'Jean' },
          { name: 'lastName', label: 'Nom', type: 'text', placeholder: 'DUPONT' },
          { name: 'matricule', label: 'Matricule', type: 'text', placeholder: 'ENS-2024-001' },
          { name: 'email', label: 'Email', type: 'email', placeholder: 'jean.dupont@ecole.com' }
        ]}
      />

      {/* Modal Edit Teacher Info */}
      <FormModal
        isOpen={modal === 'edit-teacher'}
        onClose={() => setModal('none')}
        title="Modifier Informations"
        onSave={handleUpdateTeacher}
        initialData={teachers.find(t => t.id === selectedTeacherId)}
        fields={[
          { name: 'firstName', label: 'Prénom', type: 'text' },
          { name: 'lastName', label: 'Nom', type: 'text' },
          { name: 'matricule', label: 'Matricule', type: 'text', disabled: true },
          { name: 'email', label: 'Email', type: 'email' }
        ]}
      />

      {/* Modal Add Availability */}
      <FormModal
        isOpen={modal === 'add-availability'}
        onClose={() => setModal('none')}
        title="Ajouter une Disponibilité"
        onSave={handleAddAvailability}
        fields={[
          {
            name: 'dayOfWeek',
            label: 'Jour de la semaine',
            type: 'select',
            options: DAYS.map(d => ({ value: d.id, label: d.label }))
          },
          {
            name: 'startTime',
            label: 'Heure de Début',
            type: 'time',
            placeholder: '08:00'
          },
          {
            name: 'endTime',
            label: 'Heure de Fin',
            type: 'time',
            placeholder: '10:00'
          }
        ]}
      />

      {/* Modal Add Level Authorization */}
      <FormModal
        isOpen={modal === 'add-authorization'}
        onClose={() => setModal('none')}
        title="Ajouter une Autorisation de Niveau"
        onSave={(data) => handleAddLevelAuthorization(data.levelId)}
        fields={[
          {
            name: 'levelId',
            label: 'Niveau Scolaire',
            type: 'select',
            options: schoolLevels.map(l => ({ value: l.id, label: l.label || l.name }))
          }
        ]}
      />
    </div>
  );
}
