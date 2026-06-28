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
  Award,
  Layers
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
import { MultigradeTab } from './MultigradeTab';

// --- Helpers ---

/**
 * Détermine si un niveau est de type Titulaire Unique (Maternelle ou Primaire).
 * Retourne false pour le Secondaire (mode Spécialiste).
 */
const isHomeroomLevel = (levelName?: string): boolean => {
  if (!levelName) return false;
  const n = levelName.toUpperCase();
  return n.includes('MATERN') || n.includes('PRIMA') || n.includes('PRIM');
};

const PRIMARY = '#1A2BA6';
const ACCENT = '#F5A623';

// --- Types ---

interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  matricule: string;
  email?: string;
  status?: string;
  /** Photo de profil (depuis StaffPhoto via jointure backend par email).
   * Si null/undefined → le frontend affiche les initiales. */
  photoUrl?: string | null;
  photoUrlHd?: string | null;
  /** Niveau scolaire rattaché (depuis Teacher.schoolLevelId, inclus par le backend). */
  schoolLevel?: { id: string; name: string; code?: string } | null;
  /** Nom du niveau scolaire (raccourci pour l'affichage). */
  schoolLevelName?: string;
}

/**
 * TeacherAvatar — affiche la photo de profil si disponible, sinon les initiales.
 * Tailles supportées : 'sm' (w-8 h-8), 'md' (w-9 h-9), 'lg' (w-12 h-12).
 */
function TeacherAvatar({
  teacher,
  size = 'md',
  bgColor,
  textColor = '#fff',
  roundedClass = 'rounded-lg',
}: {
  teacher: { firstName?: string; lastName?: string; photoUrl?: string | null };
  size?: 'sm' | 'md' | 'lg';
  bgColor?: string;
  textColor?: string;
  roundedClass?: string;
}) {
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-lg' : 'w-9 h-9 text-xs';
  const initials = `${(teacher.firstName?.[0] ?? '?')}${(teacher.lastName?.[0] ?? '')}`.toUpperCase();
  const [imgError, setImgError] = useState(false);

  // Si photoUrl existe ET pas d'erreur de chargement, on affiche l'image
  if (teacher.photoUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={teacher.photoUrl}
        alt={`${teacher.firstName ?? ''} ${teacher.lastName ?? ''}`}
        className={`${sizeClass} ${roundedClass} object-cover shadow-sm`}
        onError={() => setImgError(true)}
      />
    );
  }

  // Fallback initiales (si pas de photoUrl OU si l'image a échoué à charger)
  return (
    <div
      className={`${sizeClass} ${roundedClass} flex items-center justify-center font-bold shadow-sm`}
      style={bgColor ? { backgroundColor: bgColor, color: textColor } : { backgroundColor: '#f1f5f9', color: '#475569' }}
    >
      {initials}
    </div>
  );
}

/** Version simplifiée pour les sous-objets teacher (ex: activeProfile.teacher) */
function TeacherAvatarWithFallback({
  teacher,
  size = 'md',
  bgColor,
  textColor = '#fff',
  roundedClass = 'rounded-lg',
}: {
  teacher: { firstName?: string; lastName?: string; photoUrl?: string | null } | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  bgColor?: string;
  textColor?: string;
  roundedClass?: string;
}) {
  if (!teacher) {
    // Pas de teacher — on affiche juste un placeholder
    const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-lg' : 'w-9 h-9 text-xs';
    return (
      <div
        className={`${sizeClass} ${roundedClass} flex items-center justify-center font-bold shadow-sm`}
        style={bgColor ? { backgroundColor: bgColor, color: textColor } : { backgroundColor: '#f1f5f9', color: '#475569' }}
      >
        ?
      </div>
    );
  }
  return <TeacherAvatar teacher={teacher} size={size} bgColor={bgColor} textColor={textColor} roundedClass={roundedClass} />;
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

  // Modals forms states
  const [profileForm, setProfileForm] = useState({
    maxWeeklyHours: 18,
    isSemainier: false,
  });

  const [qualificationForm, setQualificationForm] = useState({
    subjectId: '',
    certified: true,
  });

  const [teacherForm, setTeacherForm] = useState({
    firstName: '',
    lastName: '',
    matricule: '',
    email: '',
    schoolLevelId: '',
  });

  const [availabilityForm, setAvailabilityForm] = useState({
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '10:00',
  });

  const [authorizationForm, setAuthorizationForm] = useState({
    levelId: '',
  });

  // Synchroniser les formulaires d'édition quand le profil ou l'enseignant change
  useEffect(() => {
    if (activeProfile) {
      setProfileForm({
        maxWeeklyHours: activeProfile.maxWeeklyHours || 18,
        isSemainier: activeProfile.isSemainier || false,
      });
    }
  }, [activeProfile]);

  useEffect(() => {
    const t = teachers.find(t => t.id === selectedTeacherId);
    if (t) {
      setTeacherForm({
        firstName: t.firstName || '',
        lastName: t.lastName || '',
        matricule: t.matricule || '',
        email: t.email || '',
      });
    }
  }, [selectedTeacherId, teachers]);

  // Tabs selection
  const [activeSubTab, setActiveSubTab] = useState<'teachers' | 'assignments' | 'workloads' | 'multigrade'>('teachers');

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
      // Enrichir avec schoolLevelName pour l'affichage dans le header du panneau droit
      const enrichedTeachers = (teachersData || []).map((t: any) => ({
        ...t,
        schoolLevelName: t.schoolLevel?.name || null,
      }));
      setTeachers(enrichedTeachers);
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
      // Utiliser pedagogyFetch (proxy Next) au lieu de pedagogyService.createTeacherProfile
      // (legacy Axios via createEntityOffline qui ne renvoie PAS l'include teacher →
      // crash "Cannot read properties of undefined (reading 'firstName')" au rendu)
      const newProfile = await pedagogyFetch<any>(`/api/pedagogy/teacher-profiles`, {
        method: 'POST',
        body: {
          academicYearId: academicYear.id,
          teacherId: selectedTeacherId,
          maxWeeklyHours: 18, // Default
          isSemainier: false,
        },
      });
      // Re-fetch du profil complet pour garantir l'inclusion de teacher
      // (au cas où le POST ne renvoie pas tous les includes)
      let fullProfile = newProfile;
      if (newProfile?.id && !newProfile?.teacher) {
        try {
          fullProfile = await pedagogyFetch<any>(`/api/pedagogy/teacher-profiles/${newProfile.id}`);
        } catch {
          // fallback sur la réponse POST
        }
      }
      setProfiles(prev => [...prev, fullProfile]);
      setActiveProfile(fullProfile);
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
      // Utiliser pedagogyFetch (proxy direct) au lieu de pedagogyService.updateTeacherProfile
      // car ce dernier passe par updateEntityOffline qui cherche l'entité dans SQLite local
      // et échoue avec "Entity TEACHER_PROFILE with id ... not found" si l'entité n'est pas
      // en cache local. pedagogyFetch fait un PUT direct au backend NestJS.
      const updated = await pedagogyFetch<any>(`/api/pedagogy/teacher-profiles/${activeProfile.id}`, {
        method: 'PUT',
        body: data,
      });
      // Si la réponse n'inclut pas teacher, on fait un re-fetch pour garantir l'inclusion
      let fullProfile = updated;
      if (updated?.id && !updated?.teacher) {
        try {
          fullProfile = await pedagogyFetch<any>(`/api/pedagogy/teacher-profiles/${updated.id}`);
        } catch {
          // fallback sur la réponse PUT
        }
      }
      setProfiles(prev => prev.map(p => p.id === fullProfile.id ? fullProfile : p));
      setActiveProfile(fullProfile);
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
          {activeSubTab === 'teachers' && (
            <button
              type="button"
              onClick={() => {
                setTeacherForm({
                  firstName: '',
                  lastName: '',
                  matricule: '',
                  email: '',
                });
                setModal('create-teacher');
              }}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
              style={{ backgroundColor: PRIMARY }}
            >
              <Plus className="h-4 w-4" />
              Créer un enseignant
            </button>
          )}
        </div>
      </div>

      {/* Navigation Interne */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50/80 p-1">
        {[
          { id: 'teachers', label: 'Profils & Disponibilités', icon: Users },
          { id: 'assignments', label: 'Affectations par Classe', icon: ClipboardList },
          { id: 'multigrade', label: 'Multigrade', icon: Layers },
          { id: 'workloads', label: 'Charge Horaire Globale', icon: BarChart3 },
        ].map((t) => {
          const Icon = t.icon;
          const active = activeSubTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveSubTab(t.id as any)}
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

      {/* Main Views — layout fluide, pas de hauteur fixe ni overflow-hidden */}
      <div className="space-y-4">
        {activeSubTab === 'teachers' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Liste des enseignants (Gauche) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/20 flex flex-col">
              <div className="p-4 border-b border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4" style={{ color: PRIMARY }} />
                    Corps Enseignant
                  </h2>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rechercher par nom ou matricule..."
                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 text-sm font-medium transition-all"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="p-2 space-y-1 bg-white">
                {loading ? (
                  <div className="p-8 text-center space-y-3">
                    <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: PRIMARY, borderTopColor: 'transparent' }} />
                    <p className="text-xs text-slate-400 font-medium">Chargement des dossiers...</p>
                  </div>
                ) : filteredTeachers.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs italic">
                    Aucun enseignant trouvé.
                  </div>
                ) : (
                  filteredTeachers.map(teacher => {
                    const isSelected = selectedTeacherId === teacher.id;
                    
                    return (
                      <button
                        key={teacher.id}
                        type="button"
                        onClick={() => selectTeacher(teacher.id)}
                        className={cn(
                          "w-full text-left p-3 rounded-lg transition-all flex items-center justify-between group border border-transparent",
                          isSelected ? "bg-slate-50 shadow-sm" : "hover:bg-slate-50/80"
                        )}
                        style={isSelected ? { borderLeft: `3px solid ${PRIMARY}`, paddingLeft: '9px' } : undefined}
                      >
                        <div className="flex items-center gap-3">
                          <TeacherAvatar
                            teacher={teacher}
                            size="md"
                            bgColor={isSelected ? PRIMARY : undefined}
                            textColor={isSelected ? '#fff' : '#475569'}
                          />
                          <div>
                            <p className={cn("font-bold text-xs", isSelected ? "text-slate-900" : "text-slate-800")}>
                              {teacher.lastName} {teacher.firstName}
                            </p>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">
                              {teacher.matricule}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className={cn(
                          "w-3.5 h-3.5 transition-all text-slate-400",
                          isSelected ? "translate-x-1" : "opacity-0 group-hover:opacity-100"
                        )} style={isSelected ? { color: PRIMARY } : undefined} />
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Fiche active (Droite) — lg:col-span-2 pour prendre 2/3 de la largeur */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
              {selectedTeacherId ? (
                activeProfile ? (
                  <div className="flex flex-col">
                    {/* Header Profil */}
                    <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Utiliser l'enseignant enrichi (avec photoUrl) de la liste teachers[],
                            car activeProfile.teacher n'a pas photoUrl (le backend profileInclude
                            ne fait pas la jointure StaffPhoto par email). */}
                        <TeacherAvatarWithFallback
                          teacher={teachers.find(t => t.id === selectedTeacherId) ?? activeProfile?.teacher}
                          size="lg"
                          bgColor={PRIMARY}
                        />
                        <div>
                          <h3 className="text-base font-bold text-slate-900">
                            {activeProfile?.teacher?.lastName ?? '—'} {activeProfile?.teacher?.firstName ?? ''}
                          </h3>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5 flex items-center gap-1.5">
                            <span>{activeProfile?.teacher?.matricule ?? '—'}</span>
                            {(() => {
                              const t = teachers.find(t => t.id === selectedTeacherId);
                              if (t?.schoolLevelName) {
                                return (
                                  <>
                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                    <span className="text-slate-500">{t.schoolLevelName}</span>
                                  </>
                                );
                              }
                              return null;
                            })()}
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span className={activeProfile.isActive ? "text-emerald-600" : "text-red-500"}>
                              {activeProfile.isActive ? 'Actif' : 'Inactif'}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setModal('edit-teacher')}
                          className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 rounded-lg transition-all shadow-sm"
                        >
                          Infos Perso
                        </button>
                        <button 
                          onClick={() => setModal('edit-profile')}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm transition hover:opacity-95"
                          style={{ backgroundColor: PRIMARY }}
                        >
                          Paramètres Profil
                        </button>
                      </div>
                    </div>

                    {/* Contenu Profil */}
                    <div className="p-4 space-y-4 bg-white">
                      {/* KPI Summary Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/30 flex items-center gap-3">
                          <Clock className="w-6 h-6" style={{ color: PRIMARY }} />
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Volume Max</p>
                            <p className="text-sm font-bold text-slate-900">{activeProfile.maxWeeklyHours}h/sem</p>
                          </div>
                        </div>

                        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/30 flex items-center gap-3">
                          <ShieldCheck className="w-6 h-6 text-emerald-500" />
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Habilitations</p>
                            <p className="text-sm font-bold text-slate-900">{activeProfile.subjectQualifications.length} matières</p>
                          </div>
                        </div>

                        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/30 flex items-center gap-3">
                          <Calendar className="w-6 h-6" style={{ color: PRIMARY }} />
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Niveaux</p>
                            <p className="text-sm font-bold text-slate-900">{activeProfile.levelAuthorizations.length} autorisés</p>
                          </div>
                        </div>
                      </div>

                      {/* Section : Habilitations Matières */}
                      <div className="space-y-3 pt-3 border-t border-slate-100">
                        {(() => {
                          // Détection automatique du niveau de l'enseignant
                          const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);
                          const teacherLevelName = selectedTeacher?.schoolLevelName || selectedTeacher?.schoolLevel?.name || '';
                          const teacherLevelCode = (selectedTeacher?.schoolLevel?.code || teacherLevelName || '').toUpperCase();
                          // Un enseignant de Maternelle ou Primaire est qualifié pour TOUTES les matières de son niveau
                          const isMaternelleOrPrimaire = teacherLevelCode.includes('MATERN') || teacherLevelCode.includes('PRIMA');

                          if (isMaternelleOrPrimaire) {
                            return (
                              <>
                                <div className="flex items-center justify-between">
                                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                                    <BookOpen className="w-4 h-4" style={{ color: PRIMARY }} />
                                    Matières qualifiées (Habilitations)
                                  </h4>
                                </div>
                                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-3">
                                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                                  <div>
                                    <p className="text-sm font-bold text-emerald-900">
                                      Qualifié(e) pour enseigner toutes les matières du niveau {teacherLevelName}
                                    </p>
                                    <p className="text-xs text-emerald-700 mt-0.5">
                                      Les enseignants de {teacherLevelName} sont polyvalents et peuvent enseigner
                                      toutes les matières de leur niveau. Aucune habilitation individuelle n'est requise.
                                    </p>
                                  </div>
                                </div>
                              </>
                            );
                          }

                          // Pour les autres niveaux (Secondaire), on garde l'interface manuelle
                          return (
                            <>
                              <div className="flex items-center justify-between">
                                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                                  <BookOpen className="w-4 h-4" style={{ color: PRIMARY }} />
                                  Matières qualifiées (Habilitations)
                                </h4>
                                <button
                                  onClick={() => {
                                    setQualificationForm({
                                      subjectId: subjects[0]?.id || '',
                                      certified: true,
                                    });
                                    setModal('add-qualification');
                                  }}
                                  className="text-xs font-semibold flex items-center gap-1 hover:underline"
                                  style={{ color: PRIMARY }}
                                >
                                  <Plus className="w-3.5 h-3.5" /> Ajouter
                                </button>
                              </div>
                              {activeProfile.subjectQualifications.length === 0 ? (
                                <div className="p-4 bg-slate-50 rounded-lg text-center text-xs text-slate-400 italic border border-slate-100">
                                  Aucune matière qualifiée déclarée. L'enseignant ne pourra être affecté dans l'assistant.
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {activeProfile.subjectQualifications.map(q => (
                                    <div key={q.id} className="p-3 rounded-lg border border-slate-200 bg-white shadow-sm flex items-center justify-between group">
                                      <div>
                                        <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600 tracking-wider">
                                          {q.subject.code}
                                        </span>
                                        <p className="font-bold text-slate-800 text-xs mt-1">{q.subject.name}</p>
                                      </div>
                                      <button
                                        onClick={() => handleRemoveQualification(q.subjectId)}
                                        className="text-slate-300 hover:text-red-500 p-1 rounded transition-all opacity-0 group-hover:opacity-100"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>

                      {/* Section : Niveaux Autorisés */}
                      <div className="space-y-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" style={{ color: PRIMARY }} />
                            Niveaux Scolaires Autorisés
                          </h4>
                          <button
                            onClick={() => {
                              setAuthorizationForm({
                                levelId: schoolLevels[0]?.id || '',
                              });
                              setModal('add-authorization');
                            }}
                            className="text-xs font-semibold flex items-center gap-1 hover:underline"
                            style={{ color: PRIMARY }}
                          >
                            <Plus className="w-3.5 h-3.5" /> Ajouter
                          </button>
                        </div>
                        {/* Niveau scolaire rattaché (auto-détecté depuis Teacher.schoolLevelId) */}
                        {(() => {
                          const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);
                          const teacherLevelName = selectedTeacher?.schoolLevelName || selectedTeacher?.schoolLevel?.name;
                          if (!teacherLevelName) return null;
                          return (
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-2">
                              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                              <span className="text-xs font-bold text-blue-900">
                                Niveau d'affectation : {teacherLevelName}
                              </span>
                              <span className="text-[10px] text-blue-600 font-normal ml-1">
                                (récupéré automatiquement depuis l'affectation du staff)
                              </span>
                            </div>
                          );
                        })()}
                        {activeProfile.levelAuthorizations.length === 0 ? (
                          <div className="p-4 bg-slate-50 rounded-lg text-center text-xs text-slate-400 italic border border-slate-100">
                            Aucun niveau spécifique autorisé. (Par défaut : habilité sur tous les niveaux).
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {activeProfile.levelAuthorizations.map(auth => (
                              <div key={auth.id} className="pl-3 pr-2 py-1 rounded-full border border-slate-200 bg-slate-50/50 flex items-center gap-1.5 group transition-all text-xs font-bold text-slate-700">
                                <span className="text-[10px] font-bold uppercase tracking-wider">
                                  {auth.level.name}
                                </span>
                                <button 
                                  onClick={() => handleRemoveLevelAuthorization(auth.levelId)}
                                  className="text-slate-400 hover:text-red-500 rounded-full transition-all"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Section : Disponibilités — Matrice professionnelle (jours × créneaux) */}
                      <div className="space-y-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                            <Calendar className="w-4 h-4" style={{ color: PRIMARY }} />
                            Disponibilités d'emploi du temps
                          </h4>
                        </div>

                        {/* Légende */}
                        <div className="flex items-center gap-3 text-[10px] font-bold">
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" />
                            <span className="text-emerald-700">Disponible</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-red-100 border border-red-300" />
                            <span className="text-red-700">Indisponible</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-slate-100 border border-slate-300" />
                            <span className="text-slate-500">Non défini</span>
                          </span>
                          <span className="text-slate-400 font-normal italic ml-auto">
                            Cliquez sur une cellule pour basculer le statut
                          </span>
                        </div>

                        {/* Matrice */}
                        {(() => {
                          // Créneaux horaires standards (08:00 → 18:00 par tranches de 2h)
                          const TIME_SLOTS = [
                            { start: '08:00', end: '10:00', label: '08h-10h' },
                            { start: '10:00', end: '12:00', label: '10h-12h' },
                            { start: '14:00', end: '16:00', label: '14h-16h' },
                            { start: '16:00', end: '18:00', label: '16h-18h' },
                          ];
                          const MATRIX_DAYS = [
                            { id: 1, label: 'Lun' },
                            { id: 2, label: 'Mar' },
                            { id: 3, label: 'Mer' },
                            { id: 4, label: 'Jeu' },
                            { id: 5, label: 'Ven' },
                            { id: 6, label: 'Sam' },
                          ];

                          // Chercher une disponibilité existante pour un jour + créneau donné
                          const findAvailability = (dayId: number, start: string, end: string) => {
                            return activeProfile.availabilities.find(
                              (av: any) => av.dayOfWeek === dayId && av.startTime === start && av.endTime === end
                            );
                          };

                          // Basculer le statut d'une cellule (ajouter/supprimer une indisponibilité)
                          const toggleCell = async (dayId: number, start: string, end: string) => {
                            const existing = findAvailability(dayId, start, end);
                            if (existing) {
                              // Existant → supprimer (redevient disponible)
                              await handleDeleteAvailability(existing.id);
                            } else {
                              // Non existant → créer (marquer comme indisponible)
                              await handleAddAvailability({ dayOfWeek: dayId, startTime: start, endTime: end });
                            }
                          };

                          return (
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                              <table className="min-w-full text-xs">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-2 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                                      Créneau
                                    </th>
                                    {MATRIX_DAYS.map(d => (
                                      <th key={d.id} className="px-2 py-2 text-center font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                                        {d.label}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {TIME_SLOTS.map(slot => (
                                    <tr key={slot.start} className="border-b border-slate-100 last:border-0">
                                      <td className="px-2 py-1.5 font-bold text-slate-700 whitespace-nowrap">
                                        {slot.label}
                                      </td>
                                      {MATRIX_DAYS.map(day => {
                                        const av = findAvailability(day.id, slot.start, slot.end);
                                        const isUnavailable = !!av;
                                        return (
                                          <td key={day.id} className="px-1 py-1 text-center">
                                            <button
                                              type="button"
                                              onClick={() => toggleCell(day.id, slot.start, slot.end)}
                                              className={cn(
                                                'w-full h-8 rounded-md border text-[10px] font-bold transition-all hover:shadow-sm',
                                                isUnavailable
                                                  ? 'bg-red-100 border-red-300 text-red-700 hover:bg-red-200'
                                                  : 'bg-emerald-100 border-emerald-300 text-emerald-700 hover:bg-emerald-200',
                                              )}
                                              title={`${day.label} ${slot.label} — ${isUnavailable ? 'Indisponible' : 'Disponible'}`}
                                            >
                                              {isUnavailable ? '✗' : '✓'}
                                            </button>
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-200 shadow-sm">
                      <Users className="w-8 h-8" />
                    </div>
                    <div className="max-w-xs space-y-1">
                      <h3 className="text-sm font-bold text-slate-900">Profil Académique Non Initialisé</h3>
                      <p className="text-xs text-slate-400 font-medium">
                        Cet enseignant est enregistré dans le personnel, mais son profil académique de cours pour cette année n'est pas encore créé.
                      </p>
                    </div>
                    <button 
                      onClick={handleCreateProfile}
                      className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
                      style={{ backgroundColor: PRIMARY }}
                    >
                      Initialiser le profil académique
                    </button>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 text-xs italic">
                  Sélectionnez un enseignant pour afficher son profil.
                </div>
              )}
            </div>
          </div>
        )}

        {activeSubTab === 'assignments' && (
          <AssignmentsWorkspace />
        )}

        {activeSubTab === 'multigrade' && (
          <MultigradeTab />
        )}

        {activeSubTab === 'workloads' && (
          <div className="flex flex-col gap-6 p-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-50 border border-slate-100" style={{ color: PRIMARY }}>
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Enseignants Actifs</p>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">{teachers.length}</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-50 border border-slate-100 text-emerald-600">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Heures Totales Affectées</p>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">
                    {Object.values(globalWorkloads).reduce((sum, w) => sum + w.assigned, 0)}h
                  </p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-50 border border-slate-100 text-amber-500">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Professeurs Surchargés</p>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">
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
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-900">Suivi Global de la Charge Académique</h3>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-1">Comparatif charges réelles vs capacités maximales</p>
              </div>

              <div className="p-4">
                {workloadLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: PRIMARY, borderTopColor: 'transparent' }} />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Analyse et agrégation des charges...</p>
                  </div>
                ) : teachers.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 italic text-xs">
                    Aucun dossier enseignant disponible.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs min-w-[800px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-4 py-3 font-bold">Enseignant</th>
                          <th className="px-4 py-3 font-bold">Niveaux Autorisés</th>
                          <th className="px-4 py-3 font-bold">Habilitations</th>
                          <th className="px-4 py-3 font-bold">Charge / Capacité</th>
                          <th className="px-4 py-3 font-bold text-center">Statut</th>
                          <th className="px-4 py-3 font-bold text-right">Détails des cours</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
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
 
                          // Déterminer si ce prof est un titulaire (Maternelle/Primaire)
                          // On se base sur les niveaux autorisés déclarés dans son profil
                          const homeroomDetails = globalWorkloads[t.id]?.details || [];
                          const homeroomClasses = homeroomDetails.reduce((acc: Record<string, { totalHours: number; levelName: string }>, d: any) => {
                            const lvlName = d.levelName || '';
                            if (isHomeroomLevel(lvlName)) {
                              if (!acc[d.className]) acc[d.className] = { totalHours: 0, levelName: lvlName };
                              acc[d.className].totalHours += d.hours;
                            }
                            return acc;
                          }, {});
                          const isHomeroom = Object.keys(homeroomClasses).length > 0 &&
                            homeroomDetails.every((d: any) => isHomeroomLevel(d.levelName || ''));
 
                          return (
                            <tr key={t.id} className="group hover:bg-slate-50/50 transition-all">
                              {/* Teacher Info */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <TeacherAvatar
                                    teacher={t}
                                    size="sm"
                                    bgColor={isHomeroom ? `${ACCENT}20` : undefined}
                                    textColor={isHomeroom ? ACCENT : '#475569'}
                                  />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-bold text-slate-900">{t.lastName} {t.firstName}</p>
                                      {isHomeroom && (
                                        <span className="text-[8px] font-bold bg-amber-50 border border-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                                          ★ Titulaire
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[9px] font-semibold text-slate-400 mt-0.5">{t.matricule}</p>
                                  </div>
                                </div>
                              </td>
 
                              {/* Authorized Levels */}
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {profile?.levelAuthorizations && profile.levelAuthorizations.length > 0 ? (
                                    profile.levelAuthorizations.map((la: any) => (
                                      <span key={la.id} className={cn(
                                        'text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                                        isHomeroomLevel(la.level?.name)
                                          ? 'bg-amber-50 border-amber-100 text-amber-700'
                                          : 'bg-slate-50 border-slate-200 text-slate-600'
                                      )}>
                                        {la.level?.name}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[10px] text-slate-400 italic font-bold">Tous niveaux</span>
                                  )}
                                </div>
                              </td>
 
                              {/* Habilitations / Mode */}
                              <td className="px-4 py-3">
                                {isHomeroom ? (
                                  <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                                    Toutes matières
                                  </span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {profile?.subjectQualifications && profile.subjectQualifications.length > 0 ? (
                                      profile.subjectQualifications.map((sq: any) => (
                                        <span key={sq.id} className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                          {sq.subject?.code}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-[10px] text-slate-400 italic font-bold">Aucune</span>
                                    )}
                                  </div>
                                )}
                              </td>
 
                              {/* Workload hours progress */}
                              <td className="px-4 py-3 min-w-[150px]">
                                <div className="space-y-1">
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-xs font-bold text-slate-900">{assigned}h <span className="text-slate-400 font-normal">/ {capacity}h</span></span>
                                    <span className="text-[9px] font-bold text-slate-400">{percent}%</span>
                                  </div>
                                  <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                    <div className={cn('h-full rounded-full transition-all duration-500', barColorClass)} style={{ width: `${percent}%` }} />
                                  </div>
                                </div>
                              </td>

                              {/* Status Badge */}
                              <td className="py-4 pr-4 text-center">
                                <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wide', statusColorClass)}>
                                  {icon}
                                  {statusLabel}
                                </span>
                              </td>

                              {/* Assigned courses / classes details */}
                              <td className="py-4 text-right">
                                <div className="inline-flex flex-col items-end gap-1 max-w-[220px] text-left">
                                  {isHomeroom ? (
                                    // Mode Titulaire : afficher les classes prises en charge
                                    Object.keys(homeroomClasses).length > 0 ? (
                                      Object.entries(homeroomClasses).map(([className, info]: [string, any]) => (
                                        <div key={className} className="text-[10px] font-bold bg-amber-50 border border-amber-100 text-amber-800 rounded-lg px-2 py-1 flex items-center justify-between gap-3 w-full">
                                          <span className="truncate">★ {className}</span>
                                          <span className="font-black whitespace-nowrap">{info.totalHours}h</span>
                                        </div>
                                      ))
                                    ) : (
                                      <span className="text-[10px] text-gray-400 italic font-bold">Aucune classe affectée</span>
                                    )
                                  ) : (
                                    // Mode Spécialiste : afficher les cours par matière
                                    globalWorkloads[t.id]?.details && globalWorkloads[t.id].details.length > 0 ? (
                                      globalWorkloads[t.id].details.map((d: any, idx: number) => (
                                        <div key={idx} className="text-[10px] font-bold text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 flex items-center justify-between gap-3 w-full">
                                          <span className="truncate">{d.className} – {d.subjectCode}</span>
                                          <span className="font-black text-indigo-600 whitespace-nowrap">{d.hours}h</span>
                                        </div>
                                      ))
                                    ) : (
                                      <span className="text-[10px] text-gray-400 italic font-bold">Aucun cours affecté</span>
                                    )
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
        onConfirm={async () => {
          await handleUpdateProfile({
            maxWeeklyHours: Number(profileForm.maxWeeklyHours),
            isSemainier: Boolean(profileForm.isSemainier),
          });
        }}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Volume Horaire Hebdomadaire Maximum (h)</label>
            <input 
              type="number" 
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800 bg-white" 
              placeholder="18" 
              value={profileForm.maxWeeklyHours}
              onChange={(e) => setProfileForm({ ...profileForm, maxWeeklyHours: Number(e.target.value) })}
            />
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="isSemainier"
              className="w-4 h-4 rounded border-slate-300 accent-indigo-600 cursor-pointer" 
              checked={profileForm.isSemainier}
              onChange={(e) => setProfileForm({ ...profileForm, isSemainier: e.target.checked })}
            />
            <label htmlFor="isSemainier" className="text-sm font-medium text-slate-700 cursor-pointer select-none">Soumis au Semainier</label>
          </div>
        </div>
      </FormModal>

      {/* Modal Add Qualification */}
      <FormModal
        isOpen={modal === 'add-qualification'}
        onClose={() => setModal('none')}
        title="Nouvelle Habilitation"
        onConfirm={async () => {
          await handleAddQualification(qualificationForm.subjectId);
        }}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Matière</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800 bg-white"
              value={qualificationForm.subjectId}
              onChange={(e) => setQualificationForm({ ...qualificationForm, subjectId: e.target.value })}
            >
              <option value="">Sélectionner une matière</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="certified"
              className="w-4 h-4 rounded border-slate-300 accent-indigo-600 cursor-pointer" 
              checked={qualificationForm.certified}
              onChange={(e) => setQualificationForm({ ...qualificationForm, certified: e.target.checked })}
            />
            <label htmlFor="certified" className="text-sm font-medium text-slate-700 cursor-pointer select-none">Habilitation officielle (Diplômé)</label>
          </div>
        </div>
      </FormModal>

      {/* Modal Create Teacher */}
      <FormModal
        isOpen={modal === 'create-teacher'}
        onClose={() => setModal('none')}
        title="Nouvel Enseignant"
        onConfirm={async () => {
          await handleCreateTeacher(teacherForm);
        }}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Prénom</label>
              <input 
                type="text" 
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800 bg-white" 
                placeholder="Jean" 
                value={teacherForm.firstName}
                onChange={(e) => setTeacherForm({ ...teacherForm, firstName: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Nom</label>
              <input 
                type="text" 
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800 bg-white" 
                placeholder="DUPONT" 
                value={teacherForm.lastName}
                onChange={(e) => setTeacherForm({ ...teacherForm, lastName: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Matricule</label>
              <input 
                type="text" 
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800 bg-white" 
                placeholder="ENS-2024-001" 
                value={teacherForm.matricule}
                onChange={(e) => setTeacherForm({ ...teacherForm, matricule: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</label>
              <input
                type="email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800 bg-white"
                placeholder="jean.dupont@ecole.com"
                value={teacherForm.email}
                onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Niveau scolaire *</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800 bg-white"
                value={teacherForm.schoolLevelId}
                onChange={(e) => setTeacherForm({ ...teacherForm, schoolLevelId: e.target.value })}
                required
              >
                <option value="">— Sélectionner —</option>
                {schoolLevels.map(l => (
                  <option key={l.id} value={l.id}>{l.name || l.code}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </FormModal>

      {/* Modal Edit Teacher Info */}
      <FormModal
        isOpen={modal === 'edit-teacher'}
        onClose={() => setModal('none')}
        title="Modifier Informations"
        onConfirm={async () => {
          await handleUpdateTeacher(teacherForm);
        }}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Prénom</label>
              <input 
                type="text" 
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800 bg-white" 
                value={teacherForm.firstName}
                onChange={(e) => setTeacherForm({ ...teacherForm, firstName: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Nom</label>
              <input 
                type="text" 
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800 bg-white" 
                value={teacherForm.lastName}
                onChange={(e) => setTeacherForm({ ...teacherForm, lastName: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Matricule</label>
              <input 
                type="text" 
                disabled
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-400 bg-slate-55 focus:outline-none cursor-not-allowed" 
                value={teacherForm.matricule}
              />
            </div>
            <div className="space-y-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</label>
              <input 
                type="email" 
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800 bg-white" 
                value={teacherForm.email}
                onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
              />
            </div>
          </div>
        </div>
      </FormModal>

      {/* Modal Add Availability */}
      <FormModal
        isOpen={modal === 'add-availability'}
        onClose={() => setModal('none')}
        title="Ajouter une Disponibilité"
        onConfirm={async () => {
          await handleAddAvailability(availabilityForm);
        }}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Jour de la semaine</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800 bg-white"
              value={availabilityForm.dayOfWeek}
              onChange={(e) => setAvailabilityForm({ ...availabilityForm, dayOfWeek: Number(e.target.value) })}
            >
              {DAYS.map(d => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Heure de Début</label>
              <input 
                type="time" 
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800 bg-white" 
                value={availabilityForm.startTime}
                onChange={(e) => setAvailabilityForm({ ...availabilityForm, startTime: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Heure de Fin</label>
              <input 
                type="time" 
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800 bg-white" 
                value={availabilityForm.endTime}
                onChange={(e) => setAvailabilityForm({ ...availabilityForm, endTime: e.target.value })}
              />
            </div>
          </div>
        </div>
      </FormModal>

      {/* Modal Add Level Authorization */}
      <FormModal
        isOpen={modal === 'add-authorization'}
        onClose={() => setModal('none')}
        title="Ajouter une Autorisation de Niveau"
        onConfirm={async () => {
          await handleAddLevelAuthorization(authorizationForm.levelId);
        }}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Niveau Scolaire</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800 bg-white"
              value={authorizationForm.levelId}
              onChange={(e) => setAuthorizationForm({ ...authorizationForm, levelId: e.target.value })}
            >
              <option value="">Sélectionner un niveau</option>
              {schoolLevels.map(l => (
                <option key={l.id} value={l.id}>{l.label || l.name}</option>
              ))}
            </select>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
