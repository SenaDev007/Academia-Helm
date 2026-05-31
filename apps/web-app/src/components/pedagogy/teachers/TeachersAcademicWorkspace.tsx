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
  BookOpen
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
    <div className="flex h-[calc(100vh-12rem)] gap-6 overflow-hidden">
      {/* Liste des enseignants (Gauche) */}
      <div className="w-1/3 bg-white rounded-3xl border border-gray-100 flex flex-col shadow-sm">
        <div className="p-6 border-b border-gray-50 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-600" />
              Corps Enseignant
            </h2>
            <button 
              onClick={() => setModal('create-teacher')}
              className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
            </button>
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
                  {hasProfile ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-orange-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Détail du Profil Académique (Droite) */}
      <div className="flex-1 bg-white rounded-3xl border border-gray-100 flex flex-col shadow-sm overflow-hidden">
        {!selectedTeacherId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6">
            <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center">
              <Users className="w-10 h-10 text-indigo-200" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Sélectionnez un enseignant</h3>
              <p className="text-gray-500 max-w-xs mx-auto mt-2">
                Choisissez un membre du personnel pour configurer son profil académique et ses habilitations.
              </p>
            </div>
          </div>
        ) : !activeProfile ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6">
            <div className="w-24 h-24 bg-orange-50 rounded-full flex items-center justify-center text-orange-200">
              <AlertCircle className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Profil Académique manquant</h3>
              <p className="text-gray-500 max-w-xs mx-auto mt-2">
                Cet enseignant n'a pas encore de profil académique pour l'année {academicYear?.label}.
              </p>
            </div>
            <button
              onClick={handleCreateProfile}
              className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Initialiser le Profil {academicYear?.label}
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header Detail */}
            <div className="p-8 border-b border-gray-50 bg-gray-50/30">
              <div className="flex items-start justify-between">
                <div className="flex gap-5">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-xl font-black text-indigo-600 shadow-sm border border-gray-100">
                    {activeProfile.teacher.firstName[0]}{activeProfile.teacher.lastName[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-black text-gray-900">
                        {activeProfile.teacher.lastName} {activeProfile.teacher.firstName}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase">
                        ACTIF
                      </span>
                    </div>
                    <p className="text-gray-400 font-bold text-sm mt-1 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-400" />
                      Profil Académique - {academicYear?.label}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-center min-w-[120px]">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Charge Max</p>
                    <p className="text-xl font-black text-indigo-600">{activeProfile.maxWeeklyHours}h</p>
                  </div>
                  <button 
                    onClick={() => setModal('edit-teacher')}
                    className="p-3 bg-white border border-gray-200 text-gray-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm"
                    title="Modifier Informations Personnelles"
                  >
                    <Users className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setModal('edit-profile')}
                    className="p-3 bg-white border border-gray-200 text-gray-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm"
                    title="Modifier Paramètres Académiques"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content Detail */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Qualifications */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                    Habilitations Matières
                  </h4>
                  <button 
                    onClick={() => setModal('add-qualification')}
                    className="flex items-center gap-2 text-xs font-black text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-xl transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    AJOUTER
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeProfile.subjectQualifications.length === 0 ? (
                    <div className="col-span-full py-8 text-center border-2 border-dashed border-gray-100 rounded-3xl">
                      <p className="text-sm text-gray-400 font-bold">Aucune habilitation définie.</p>
                    </div>
                  ) : (
                    activeProfile.subjectQualifications.map((q: any) => (
                      <div key={q.id} className="group p-4 bg-white border border-gray-100 rounded-2xl flex items-center justify-between hover:border-indigo-200 transition-all shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center font-bold text-xs text-indigo-600">
                            {q.subject.code}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{q.subject.name}</p>
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                              Certifié
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleRemoveQualification(q.subjectId)}
                          className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Autorisations Niveaux */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    Niveaux Autorisés
                  </h4>
                  <button 
                    onClick={() => setModal('add-authorization')}
                    className="flex items-center gap-2 text-xs font-black text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-xl transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    AJOUTER
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {activeProfile.levelAuthorizations.length === 0 ? (
                    <p className="text-sm text-gray-400 font-bold italic">Aucun niveau restreint (Accès total par défaut).</p>
                  ) : (
                    activeProfile.levelAuthorizations.map((la: any) => (
                      <div key={la.id} className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold text-xs flex items-center gap-2">
                        {la.level?.name || la.level?.label || 'Niveau'}
                        <button 
                          onClick={() => handleRemoveLevelAuthorization(la.levelId || la.level?.id)}
                          className="hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Disponibilités */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                    Disponibilités & Contraintes
                  </h4>
                  <button 
                    onClick={() => setModal('add-availability')}
                    className="flex items-center gap-2 text-xs font-black text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-xl transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    AJOUTER UN CRÉNEAU
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {DAYS.map(day => {
                    const slots = activeProfile.availabilities.filter((a: any) => a.dayOfWeek === day.id);
                    
                    return (
                      <div key={day.id} className="flex flex-col gap-3">
                        <div className="py-2 px-3 bg-gray-50 rounded-xl border border-gray-100 text-center">
                          <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">{day.label}</span>
                        </div>
                        
                        <div className="space-y-2 min-h-[100px]">
                          {slots.length === 0 ? (
                            <div className="h-full border-2 border-dashed border-gray-50 rounded-2xl flex items-center justify-center opacity-40">
                              <Clock className="w-4 h-4 text-gray-300" />
                            </div>
                          ) : (
                            slots.sort((a: any, b: any) => a.startTime.localeCompare(b.startTime)).map((slot: any) => (
                              <div key={slot.id} className="group relative p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
                                <p className="text-[10px] font-bold text-indigo-900">
                                  {slot.startTime} - {slot.endTime}
                                </p>
                                <button 
                                  onClick={() => handleDeleteAvailability(slot.id)}
                                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>

      {/* Modal Edit Profile */}
      <FormModal
        isOpen={modal === 'edit-profile'}
        onClose={() => setModal('none')}
        title="Modifier le Profil Académique"
        onSave={(data) => handleUpdateProfile(data)}
        initialData={{
          maxWeeklyHours: activeProfile?.maxWeeklyHours,
          isSemainier: activeProfile?.isSemainier
        }}
        fields={[
          {
            name: 'maxWeeklyHours',
            label: 'Charge horaire maximale (h)',
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
