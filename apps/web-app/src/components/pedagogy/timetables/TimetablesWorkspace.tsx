/**
 * ============================================================================
 * TIMETABLES WORKSPACE - MODULE 2 (Emploi du Temps)
 * ============================================================================
 * 
 * Gestionnaire visuel d'Emploi du Temps (EDT) :
 * 1. Grille hebdomadaire interactive
 * 2. Détection automatique des conflits (Salles, Profs, Classes)
 * 3. Filtrage par Classe, Enseignant ou Salle
 * 4. Export institutionnel
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  BookOpen, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  Download,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Users,
  Search,
  MoreVertical,
  Trash2,
  Printer,
  X,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FormModal, 
  ConfirmModal 
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useBilingual } from '@/contexts/BilingualContext';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

// --- Types ---

interface Timetable {
  id: string;
  name: string;
  isActive: boolean;
}

interface TimetableEntry {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subject?: { id: string; name: string; code: string };
  teacher?: { id: string; firstName: string; lastName: string };
  room?: { id: string; name: string; code: string };
  class?: { id: string; name: string };
}

interface AcademicClass {
  id: string;
  name: string;
  levelId?: string;
}

interface Room {
  id: string;
  name: string;
  code: string;
}

const DAYS = [
  { id: 1, label: 'Lundi' },
  { id: 2, label: 'Mardi' },
  { id: 3, label: 'Mercredi' },
  { id: 4, label: 'Jeudi' },
  { id: 5, label: 'Vendredi' },
  { id: 6, label: 'Samedi' },
];

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8:00 to 18:00

export default function TimetablesWorkspace() {
  const { academicYear, schoolLevel } = useModuleContext();
  const { isEnabled: isBilingual, currentTrack, setCurrentTrack } = useBilingual();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // State
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [activeTimetableId, setActiveTimetableId] = useState<string | null>(null);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  
  // Filters
  const [viewMode, setViewMode] = useState<'class' | 'teacher' | 'room'>('class');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Data for Selectors
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);

  // Breaks configuration
  interface BreakPeriod {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
  }
  const [breaks, setBreaks] = useState<BreakPeriod[]>([
    { id: '1', name: 'Récréation', startTime: '10:00', endTime: '10:30' },
    { id: '2', name: 'Pause Déjeuner', startTime: '12:00', endTime: '13:00' }
  ]);

  // Timetables automatic generation
  const [generating, setGenerating] = useState(false);

  const handleAutoGenerate = async () => {
    if (!activeTimetableId || !academicYear?.id || !selectedId) return;

    if (viewMode === 'teacher') {
      // ─── Teacher mode: generate timetable for a teacher ──
      // Fetch all class-subject assignments for this teacher across all classes
      setGenerating(true);
      try {
        const teacherAssignments = await pedagogyFetch<any[]>(
          `/api/pedagogy/teacher-class-assignments?teacherId=${selectedId}&academicYearId=${academicYear.id}`
        );

        if (!teacherAssignments || teacherAssignments.length === 0) {
          throw new Error("Aucune affectation trouvée pour cet enseignant. Veuillez d'abord assigner des classes à cet enseignant.");
        }

        // Build slots (same as class mode)
        const slots: { day: number; start: string; end: string }[] = [];
        for (let day = 1; day <= 6; day++) {
          for (let hour = 8; hour < 17; hour++) {
            const startStr = `${hour.toString().padStart(2, '0')}:00`;
            const endStr = `${(hour + 1).toString().padStart(2, '0')}:00`;
            const isBreak = breaks.some(b =>
              (startStr >= b.startTime && startStr < b.endTime) ||
              (endStr > b.startTime && endStr <= b.endTime)
            );
            if (!isBreak) {
              slots.push({ day, start: startStr, end: endStr });
            }
          }
        }

        // Get teacher's availability profile
        const teacherProfile = teachers.find((t: any) => t.teacherId === selectedId);
        const availabilities = teacherProfile?.availabilities || [];

        // Existing entries (to avoid conflicts)
        const existingEntries = entries.filter(e => e.teacher?.id === selectedId);
        const scheduledEntries: any[] = [];

        // Shuffle slots
        const shuffled = [...slots].sort(() => Math.random() - 0.5);

        // Track how many hours assigned per day per class (max 2 same subject per day)
        const hoursPerDayPerClass: Record<string, Record<number, number>> = {};

        for (const assignment of teacherAssignments) {
          const cs = assignment.classSubject;
          if (!cs) continue;

          const classId = cs.academicClass?.id;
          const subjectId = cs.subject?.id;
          const subjectName = cs.subject?.name || 'Matière';
          const className = cs.academicClass?.name || '';
          const weeklyHours = cs.weeklyHours || 2;

          let assigned = 0;
          for (const slot of shuffled) {
            if (assigned >= weeklyHours) break;

            // Check teacher availability
            if (availabilities.length > 0) {
              const available = availabilities.some((av: any) =>
                av.dayOfWeek === slot.day &&
                av.startTime <= slot.start &&
                av.endTime >= slot.end
              );
              if (!available) continue;
            }

            // Check if teacher is already busy at this slot
            const teacherBusy = existingEntries.some(e =>
              e.dayOfWeek === slot.day && e.startTime === slot.start
            ) || scheduledEntries.some(e =>
              e.dayOfWeek === slot.day && e.startTime === slot.start
            );
            if (teacherBusy) continue;

            // Check if class is already busy
            const classBusy = entries.some(e =>
              e.class?.id === classId &&
              e.dayOfWeek === slot.day &&
              e.startTime === slot.start
            );
            if (classBusy) continue;

            // Max 2 hours of same subject per day
            const dayKey = `${classId}-${slot.day}`;
            if (!hoursPerDayPerClass[dayKey]) hoursPerDayPerClass[dayKey] = 0;
            if (hoursPerDayPerClass[dayKey] >= 2) continue;

            scheduledEntries.push({
              dayOfWeek: slot.day,
              startTime: slot.start,
              endTime: slot.end,
              subjectId,
              subjectName,
              teacherId: selectedId,
              classId,
              className,
              roomId: null,
            });
            hoursPerDayPerClass[dayKey]++;
            assigned++;
          }
        }

        // Delete existing entries for this teacher and create new ones
        for (const entry of existingEntries) {
          if (entry.id) {
            await pedagogyFetch(`/api/timetables/${activeTimetableId}/entries/${entry.id}`, { method: 'DELETE' });
          }
        }

        for (const entry of scheduledEntries) {
          await pedagogyFetch(`/api/timetables/${activeTimetableId}/entries`, {
            method: 'POST',
            body: JSON.stringify({
              dayOfWeek: entry.dayOfWeek,
              startTime: entry.startTime,
              endTime: entry.endTime,
              subjectId: entry.subjectId,
              teacherId: entry.teacherId,
              classId: entry.classId,
              roomId: entry.roomId,
            }),
          });
        }

        await fetchEntries();

        toast({
          title: "✅ Emploi du temps généré (Mode Enseignant)",
          description: `${scheduledEntries.length} créneaux planifiés pour ${teacherProfile?.teacher?.lastName || 'l\'enseignant'}.`,
        });
      } catch (error: any) {
        toast({
          title: "Erreur de génération",
          description: error.message || "Une erreur est survenue lors de la génération de l'emploi du temps.",
        });
      } finally {
        setGenerating(false);
      }
      return;
    }

    if (viewMode !== 'class') {
      toast({
        title: "Sélection requise",
        description: "Sélectionnez d'abord une classe ou un enseignant à gauche pour générer son emploi du temps.",
      });
      return;
    }

    setGenerating(true);
    try {
      // 1. Charger les matières et affectations de la classe
      const classSubjects = await pedagogyFetch<any[]>(`/api/pedagogy/class-subjects?classId=${selectedId}&academicYearId=${academicYear.id}`);
      if (!classSubjects || classSubjects.length === 0) {
        throw new Error("Aucune matière configurée pour cette classe. Veuillez ajouter des matières au niveau ou à la classe d'abord.");
      }

      // 2. Déterminer les créneaux hebdomadaires libres (hors pauses)
      const slots: { day: number; start: string; end: string }[] = [];
      for (let day = 1; day <= 6; day++) {
        for (let hour = 8; hour < 17; hour++) {
          const startStr = `${hour.toString().padStart(2, '0')}:00`;
          const endStr = `${(hour + 1).toString().padStart(2, '0')}:00`;

          // Vérifier si ce créneau chevauche une pause
          const isBreak = breaks.some(b =>
            (startStr >= b.startTime && startStr < b.endTime) ||
            (endStr > b.startTime && endStr <= b.endTime)
          );

          if (!isBreak) {
            slots.push({ day, start: startStr, end: endStr });
          }
        }
      }

      // Mélanger aléatoirement les créneaux pour une répartition homogène
      const shuffledSlots = [...slots].sort(() => Math.random() - 0.5);

      // Supprimer les cours existants pour cette classe pour régénérer proprement
      const currentClassEntries = entries.filter(e => e.class?.id === selectedId);
      const deletePromises = currentClassEntries.map(e =>
        pedagogyFetch(`/api/timetables/entries/${e.id}`, { method: 'DELETE' })
      );
      await Promise.all(deletePromises);

      // Conserver les créneaux des autres classes pour éviter les collisions de profs
      const otherClassEntries = entries.filter(e => e.class?.id !== selectedId);

      const scheduledEntries: any[] = [];

      // ── Détection du mode pédagogique ──────────────────────────────────────
      // Maternelle / Primaire → Titulaire Unique (1 enseignant pour toutes les matières)
      // Secondaire            → Spécialiste (1 enseignant par matière)
      const selectedClass = classes.find(c => c.id === selectedId);
      const levelName = (selectedClass as any)?.level?.name || '';
      const lvl = levelName.toUpperCase();
      const isHomeroomMode =
        lvl.includes('MATERN') || lvl.includes('PRIMA') || lvl.includes('PRIM');

      if (isHomeroomMode) {
        // ── MODE TITULAIRE (Maternelle / Primaire) ──────────────────────────
        // Un seul enseignant titulaire gère toutes les matières.
        const homeroomTeacher =
          classSubjects.find((cs: any) => cs.assignments?.[0]?.teacher)
            ?.assignments?.[0]?.teacher || null;
        const homeroomTeacherId: string | null = homeroomTeacher?.id || null;

        const homeroomProfile = homeroomTeacherId
          ? teachers.find((t: any) => t.teacherId === homeroomTeacherId)
          : null;

        for (const cs of classSubjects) {
          const weeklyHours = cs.weeklyHours || 0;
          const subjectId = cs.subject.id;
          let hoursScheduled = 0;

          for (const slot of shuffledSlots) {
            if (hoursScheduled >= weeklyHours) break;

            // Contrainte 1 : La classe est-elle déjà occupée ?
            const classBusy = scheduledEntries.some(
              e => e.dayOfWeek === slot.day && e.startTime === slot.start
            );
            if (classBusy) continue;

            // Contrainte 2 : Le titulaire est-il indisponible ?
            if (homeroomTeacherId && homeroomProfile?.availabilities?.length > 0) {
              const available = homeroomProfile.availabilities.some(
                (av: any) =>
                  av.dayOfWeek === slot.day &&
                  slot.start >= av.startTime &&
                  slot.end <= av.endTime
              );
              if (!available) continue;
            }

            // Contrainte 3 : Max 2 heures de la même matière par jour
            const hoursOnDay = scheduledEntries.filter(
              e => e.dayOfWeek === slot.day && e.subjectId === subjectId
            ).length;
            if (hoursOnDay >= 2) continue;

            scheduledEntries.push({
              timetableId: activeTimetableId,
              academicYearId: academicYear.id,
              schoolLevelId: schoolLevel?.id || '',
              dayOfWeek: slot.day,
              startTime: slot.start,
              endTime: slot.end,
              subjectId,
              teacherId: homeroomTeacherId,
              classId: selectedId,
            });
            hoursScheduled++;
          }

          if (hoursScheduled < weeklyHours) {
            toast({
              title: "Planification Partielle",
              description: `Impossible de placer toutes les heures de ${cs.subject.name} (${hoursScheduled}/${weeklyHours}h).`,
              variant: "warning" as any,
            });
          }
        }

      } else {
        // ── MODE SPÉCIALISTE (Secondaire) ───────────────────────────────────
        // Chaque matière a son propre enseignant — contraintes anti-collision inter-classes.
        for (const cs of classSubjects) {
          const weeklyHours = cs.weeklyHours || 0;
          const subjectId = cs.subject.id;
          const teacher = cs.assignments?.[0]?.teacher;
          const teacherId = teacher?.id;

          let hoursScheduled = 0;

          for (const slot of shuffledSlots) {
            if (hoursScheduled >= weeklyHours) break;

            // Contrainte 1 : La classe est-elle déjà occupée ?
            const classBusy = scheduledEntries.some(e => e.dayOfWeek === slot.day && e.startTime === slot.start);
            if (classBusy) continue;

            // Contrainte 2 : Le professeur est-il déjà occupé ?
            if (teacherId) {
              const teacherBusy = otherClassEntries.some(e =>
                e.dayOfWeek === slot.day &&
                e.startTime === slot.start &&
                e.teacher?.id === teacherId
              );
              if (teacherBusy) continue;

              const teacherBusyLocal = scheduledEntries.some(e =>
                e.dayOfWeek === slot.day &&
                e.startTime === slot.start &&
                e.teacherId === teacherId
              );
              if (teacherBusyLocal) continue;

              const teacherProfile = teachers.find((t: any) => t.teacherId === teacherId);
              if (teacherProfile?.availabilities?.length > 0) {
                const available = teacherProfile.availabilities.some((av: any) =>
                  av.dayOfWeek === slot.day &&
                  slot.start >= av.startTime &&
                  slot.end <= av.endTime
                );
                if (!available) continue;
              }
            }

            // Contrainte 3 : Max 2 heures de la même matière par jour
            const hoursOnDay = scheduledEntries.filter(e => e.dayOfWeek === slot.day && e.subjectId === subjectId).length;
            if (hoursOnDay >= 2) continue;

            scheduledEntries.push({
              timetableId: activeTimetableId,
              academicYearId: academicYear.id,
              schoolLevelId: schoolLevel?.id || '',
              dayOfWeek: slot.day,
              startTime: slot.start,
              endTime: slot.end,
              subjectId,
              teacherId: teacherId || null,
              classId: selectedId,
            });

            hoursScheduled++;
          }

          if (hoursScheduled < weeklyHours) {
            toast({
              title: "Planification Partielle",
              description: `Impossible de placer toutes les heures de ${cs.subject.name} (${hoursScheduled}/${weeklyHours}h) en raison de contraintes trop strictes.`,
              variant: "warning" as any,
            });
          }
        }
      }

      // Enregistrer les entrées générées
      const savePromises = scheduledEntries.map(entry =>
        pedagogyFetch(`/api/timetables/${activeTimetableId}/entries`, {
          method: 'POST',
          body: entry,
        })
      );
      await Promise.all(savePromises);

      loadEntries();
      toast({
        title: isHomeroomMode ? "✅ Emploi du temps généré (Mode Titulaire)" : "✅ Emploi du temps généré",
        description: isHomeroomMode
          ? `${scheduledEntries.length} créneaux planifiés avec le titulaire de ${selectedClass?.name || 'la classe'}.`
          : "L'emploi du temps de la classe a été généré et optimisé automatiquement !",
      });
    } catch (e: any) {
      toast({
        title: "Erreur lors de la génération",
        description: e.message || "Erreur lors du calcul de l'emploi du temps.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  // Modals
  const [modal, setModal] = useState<'none' | 'create-timetable' | 'add-entry' | 'settings-breaks'>('none');
  const [entryForm, setEntryForm] = useState({
    classId: '',
    teacherId: '',
    subjectId: '',
    roomId: '',
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '09:00',
  });

  // --- Loaders ---

  const loadData = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const [tts, cls, rms, tchs] = await Promise.all([
        pedagogyFetch<Timetable[]>(`/api/timetables?academicYearId=${academicYear.id}`),
        pedagogyFetch<AcademicClass[]>(`/api/pedagogy/academic-structure/classes?academicYearId=${academicYear.id}`),
        pedagogyFetch<Room[]>(`/api/rooms`),
        pedagogyFetch<any[]>(`/api/pedagogy/teacher-profiles?academicYearId=${academicYear.id}`)
      ]);
      setClasses(cls);
      setRooms(rms);
      setTeachers(tchs);

      if (tts.length > 0) {
        setActiveTimetableId(tts[0].id);
      } else {
        // Créer un emploi du temps par défaut si vide
        const newTt = await pedagogyFetch<Timetable>('/api/timetables', {
          method: 'POST',
          body: {
            academicYearId: academicYear.id,
            schoolLevelId: schoolLevel?.id || '',
            name: `Emploi du Temps Principal ${academicYear.label}`,
            startDate: new Date(),
          }
        });
        setTimetables([newTt]);
        setActiveTimetableId(newTt.id);
      }
      if (cls.length > 0) setSelectedId(cls[0].id);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id]);

  const loadEntries = useCallback(async () => {
    if (!activeTimetableId) return;
    try {
      const data = await pedagogyFetch<any>(`/api/timetables/${activeTimetableId}`);
      setEntries(data.entries);
    } catch (e: any) {
      console.error(e);
    }
  }, [activeTimetableId]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadEntries(); }, [loadEntries]);

  // --- Filtered Entries for Grid ---
  const filteredEntries = useMemo(() => {
    if (!selectedId) return entries;
    const base = entries.filter(e => {
      if (viewMode === 'class') return e.class?.id === selectedId;
      if (viewMode === 'teacher') return e.teacher?.id === selectedId;
      if (viewMode === 'room') return e.room?.id === selectedId;
      return true;
    });

    // ── Filtre bilingue ──────────────────────────────────────────────────
    // En mode bilingue, on ne montre que les cours dont la matière
    // correspond à la track sélectionnée (FR ou EN). On se base sur le
    // `language` du Subject (déduit du code suffixé _EN ou via la colonne
    // language retournée par l'API).
    if (!isBilingual) return base;
    return base.filter(e => {
      const subjectLang =
        (e.subject as any)?.language ||
        ((e.subject?.code || '').endsWith('_EN') ? 'EN' : 'FR');
      return subjectLang === currentTrack;
    });
  }, [entries, viewMode, selectedId, isBilingual, currentTrack]);

  // --- Actions ---

  const handleAddEntry = async (data: any) => {
    if (!activeTimetableId || !academicYear?.id) return;
    try {
      // Resolve a valid schoolLevelId (not 'ALL')
      const resolvedSchoolLevelId = schoolLevel?.id || classes.find(c => c.id === data.classId)?.levelId || '';
      if (!resolvedSchoolLevelId) {
        toast({ title: "Erreur", description: "Impossible de déterminer le niveau scolaire.", variant: "destructive" });
        return;
      }
      await pedagogyFetch(`/api/timetables/${activeTimetableId}/entries`, {
        method: 'POST',
        body: {
          ...data,
          timetableId: activeTimetableId,
          academicYearId: academicYear.id,
          schoolLevelId: resolvedSchoolLevelId,
        }
      });
      loadEntries();
      setModal('none');
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Erreur lors de l'ajout. Vérifiez les conflits.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await pedagogyFetch(`/api/timetables/entries/${id}`, { method: 'DELETE' });
      loadEntries();
    } catch (e) {
      console.error(e);
    }
  };

  // --- Grid Component ---
  const GridCell = ({ day, hour }: { day: number, hour: number }) => {
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    
    // Check if this slot falls in a configured break
    const activeBreak = breaks.find(b => 
      timeStr >= b.startTime && timeStr < b.endTime
    );

    if (activeBreak) {
      return (
        <div className="min-h-[80px] border-r border-b border-gray-100 bg-gray-50 flex items-center justify-center p-2 select-none relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-60" />
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center rotate-[-12deg] z-10 bg-white/80 px-2 py-1 rounded border border-slate-100 shadow-sm">
            {activeBreak.name}
          </span>
        </div>
      );
    }

    const slotEntries = filteredEntries.filter(e => 
      e.dayOfWeek === day && 
      e.startTime <= timeStr && 
      e.endTime > timeStr
    );

    return (
      <div className="min-h-[80px] border-r border-b border-gray-100 p-1 relative group">
        {slotEntries.map(e => (
          <div 
            key={e.id}
            className="absolute inset-1 rounded-xl bg-indigo-600 text-white p-2 shadow-lg shadow-indigo-100 z-10 overflow-hidden flex flex-col justify-between"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-tighter truncate">
                {e.subject?.name || 'Matière'}
              </p>
              <p className="text-[8px] font-bold opacity-80 truncate">
                {viewMode === 'teacher' ? e.class?.name : `${e.teacher?.firstName[0]}. ${e.teacher?.lastName}`}
              </p>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[8px] font-mono bg-white/20 px-1 rounded">{e.room?.code || 'Salle'}</span>
              <button 
                onClick={(ev) => { ev.stopPropagation(); handleDeleteEntry(e.id); }}
                className="p-1 hover:bg-white/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
        {!slotEntries.length && (
          <button 
            onClick={() => setModal('add-entry')}
            className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-indigo-50/50 flex items-center justify-center transition-all cursor-pointer"
          >
            <Plus className="w-5 h-5 text-indigo-400" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-6 overflow-hidden">
      {/* Bilingual track selector — affiché en haut si bilingue activé */}
      {isBilingual && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-100 rounded-xl p-1 shadow-md">
          <button
            type="button"
            onClick={() => setCurrentTrack('FR')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${currentTrack === 'FR' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
          >
            Français
          </button>
          <button
            type="button"
            onClick={() => setCurrentTrack('EN')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${currentTrack === 'EN' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
          >
            English
          </button>
        </div>
      )}
      {/* Sidebar de contrôle */}
      <div className="w-72 bg-white rounded-3xl border border-gray-100 flex flex-col shadow-sm">
        <div className="p-6 border-b border-gray-50 space-y-4">
           <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                Planning
              </h2>
              <button className="p-2 hover:bg-gray-50 rounded-xl text-gray-400">
                <MoreVertical className="w-4 h-4" />
              </button>
           </div>
           
           <div className="flex p-1 bg-gray-50 rounded-2xl">
              <button 
                onClick={() => setViewMode('class')}
                className={cn("flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all", viewMode === 'class' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400")}
              >Classe</button>
              <button 
                onClick={() => setViewMode('teacher')}
                className={cn("flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all", viewMode === 'teacher' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400")}
              >Prof</button>
              <button 
                onClick={() => setViewMode('room')}
                className={cn("flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all", viewMode === 'room' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400")}
              >Salle</button>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {viewMode === 'class' && classes.map(c => (
            <button 
              key={c.id} 
              onClick={() => setSelectedId(c.id)}
              className={cn("w-full p-3 rounded-2xl text-left transition-all", selectedId === c.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "hover:bg-gray-50 text-gray-700")}
            >
              <p className="text-sm font-black">{c.name}</p>
            </button>
          ))}
          {viewMode === 'teacher' && teachers.map(t => (
            <button 
              key={t.id} 
              onClick={() => setSelectedId(t.teacherId)}
              className={cn("w-full p-3 rounded-2xl text-left transition-all", selectedId === t.teacherId ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "hover:bg-gray-50 text-gray-700")}
            >
              <p className="text-sm font-black">{t.teacher.lastName} {t.teacher.firstName}</p>
            </button>
          ))}
          {viewMode === 'room' && rooms.map(r => (
            <button 
              key={r.id} 
              onClick={() => setSelectedId(r.id)}
              className={cn("w-full p-3 rounded-2xl text-left transition-all", selectedId === r.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "hover:bg-gray-50 text-gray-700")}
            >
              <p className="text-sm font-black">{r.name}</p>
              <p className="text-[10px] opacity-70">{r.code}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Grille EDT */}
      <div className="flex-1 bg-white rounded-3xl border border-gray-100 flex flex-col shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 bg-gray-50/20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
               <h3 className="text-xl font-black text-gray-900 tracking-tight">Emploi du Temps Hebdomadaire</h3>
               <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">
                 {viewMode === 'class' ? "Classe" : viewMode === 'teacher' ? "Enseignant" : "Salle"} : {
                    viewMode === 'class' ? classes.find(c => c.id === selectedId)?.name :
                    viewMode === 'teacher' ? teachers.find(t => t.teacherId === selectedId)?.teacher?.lastName :
                    rooms.find(r => r.id === selectedId)?.name
                 }
               </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setModal('settings-breaks')}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-100 rounded-2xl text-xs font-black text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
            >
              <Clock className="w-4 h-4 text-indigo-600" />
              PAUSES & PLAGES
            </button>
            {(viewMode === 'class' || viewMode === 'teacher') && (
              <button 
                onClick={handleAutoGenerate}
                disabled={generating}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl text-xs font-black transition-all shadow-sm",
                  generating && "opacity-75 cursor-not-allowed"
                )}
              >
                {generating ? (
                  <div className="w-3.5 h-3.5 border-2 border-indigo-700 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Calendar className="w-4 h-4" />
                )}
                {generating ? "GÉNÉRATION..." : "AUTO-GÉNÉRER"}
              </button>
            )}
            <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-100 rounded-2xl text-xs font-black text-gray-600 hover:bg-gray-50 transition-all shadow-sm">
              <Printer className="w-4 h-4" />
              IMPRIMER PDF
            </button>
            <button 
              onClick={() => setModal('add-entry')}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-xs font-black hover:scale-105 transition-all shadow-lg shadow-indigo-100"
            >
              <Plus className="w-4 h-4" />
              AJOUTER UN COURS
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-50/10">
          <div className="min-w-[800px]">
             {/* Header Jours */}
             <div className="grid grid-cols-[100px_repeat(6,1fr)] border-b border-gray-100 bg-white sticky top-0 z-20">
                <div className="p-4 border-r border-gray-100 flex items-center justify-center bg-gray-50/50">
                  <Clock className="w-4 h-4 text-gray-300" />
                </div>
                {DAYS.map(day => (
                  <div key={day.id} className="p-4 border-r border-gray-100 text-center">
                    <span className="text-[11px] font-black uppercase text-gray-500 tracking-widest">{day.label}</span>
                  </div>
                ))}
             </div>

             {/* Lignes Heures */}
             {HOURS.map(hour => (
               <div key={hour} className="grid grid-cols-[100px_repeat(6,1fr)]">
                  <div className="p-4 border-r border-b border-gray-100 flex items-center justify-center bg-white sticky left-0 z-10">
                    <span className="text-xs font-black text-gray-400">{hour}:00</span>
                  </div>
                  {DAYS.map(day => (
                    <GridCell key={`${day.id}-${hour}`} day={day.id} hour={hour} />
                  ))}
               </div>
             ))}
          </div>
        </div>
      </div>

      <FormModal
        isOpen={modal === 'add-entry'}
        onClose={() => setModal('none')}
        title="Nouveau Cours / Créneau"
        size="lg"
      >
        <div className="space-y-4 p-4">
          <p className="text-sm text-gray-500 mb-4">Remplissez les informations pour ajouter un nouveau créneau à l'emploi du temps.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Classe *</label>
              <select
                className="w-full p-2 border rounded-lg"
                value={entryForm.classId || (viewMode === 'class' ? selectedId || '' : '')}
                onChange={(e) => setEntryForm(f => ({ ...f, classId: e.target.value }))}
              >
                <option value="">— Sélectionner —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Enseignant</label>
              <select
                className="w-full p-2 border rounded-lg"
                value={entryForm.teacherId || (viewMode === 'teacher' ? selectedId || '' : '')}
                onChange={(e) => setEntryForm(f => ({ ...f, teacherId: e.target.value }))}
              >
                <option value="">— Sélectionner —</option>
                {teachers.map(t => <option key={t.teacherId} value={t.teacherId}>{t.teacher.lastName} {t.teacher.firstName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Salle</label>
              <select
                className="w-full p-2 border rounded-lg"
                value={entryForm.roomId}
                onChange={(e) => setEntryForm(f => ({ ...f, roomId: e.target.value }))}
              >
                <option value="">— Aucune —</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Jour *</label>
              <select
                className="w-full p-2 border rounded-lg"
                value={entryForm.dayOfWeek}
                onChange={(e) => setEntryForm(f => ({ ...f, dayOfWeek: parseInt(e.target.value) }))}
              >
                <option value={1}>Lundi</option>
                <option value={2}>Mardi</option>
                <option value={3}>Mercredi</option>
                <option value={4}>Jeudi</option>
                <option value={5}>Vendredi</option>
                <option value={6}>Samedi</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Heure début *</label>
              <input
                type="time"
                className="w-full p-2 border rounded-lg"
                value={entryForm.startTime}
                onChange={(e) => setEntryForm(f => ({ ...f, startTime: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Heure fin *</label>
              <input
                type="time"
                className="w-full p-2 border rounded-lg"
                value={entryForm.endTime}
                onChange={(e) => setEntryForm(f => ({ ...f, endTime: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setModal('none')} className="px-4 py-2 text-sm font-bold text-gray-500">Annuler</button>
            <button
              onClick={() => handleAddEntry({
                classId: entryForm.classId || (viewMode === 'class' ? selectedId : ''),
                teacherId: entryForm.teacherId || (viewMode === 'teacher' ? selectedId : ''),
                roomId: entryForm.roomId || null,
                dayOfWeek: entryForm.dayOfWeek,
                startTime: entryForm.startTime,
                endTime: entryForm.endTime,
              })}
              className="px-4 py-2 text-sm font-bold bg-indigo-600 text-white rounded-lg"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </FormModal>

      {/* Modal Settings Breaks */}
      <FormModal
        isOpen={modal === 'settings-breaks'}
        onClose={() => setModal('none')}
        title="Configuration des Plages de Pause"
        size="md"
      >
        <div className="space-y-4 p-4">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Configurez les heures de pause générale de l'établissement :</p>
          
          <div className="space-y-3">
            {breaks.map(b => (
              <div key={b.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <p className="text-xs font-bold text-gray-900 uppercase">{b.name}</p>
                  <p className="text-[10px] font-bold text-indigo-600 tracking-wider mt-0.5">{b.startTime} - {b.endTime}</p>
                </div>
                <button 
                  onClick={() => setBreaks(prev => prev.filter(item => item.id !== b.id))}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs font-bold text-gray-700 uppercase">Ajouter une nouvelle pause</p>
            <div className="grid grid-cols-2 gap-3">
              <input 
                type="text" 
                id="new-break-name" 
                placeholder="Nom (ex: Goûter)" 
                className="col-span-2 p-2.5 text-xs font-medium bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500" 
              />
              <input 
                type="time" 
                id="new-break-start" 
                className="p-2.5 text-xs font-medium bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500" 
              />
              <input 
                type="time" 
                id="new-break-end" 
                className="p-2.5 text-xs font-medium bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500" 
              />
            </div>
            <button 
              onClick={() => {
                const nameInput = document.getElementById('new-break-name') as HTMLInputElement;
                const startInput = document.getElementById('new-break-start') as HTMLInputElement;
                const endInput = document.getElementById('new-break-end') as HTMLInputElement;
                if (nameInput?.value && startInput?.value && endInput?.value) {
                  setBreaks(prev => [...prev, {
                    id: Math.random().toString(),
                    name: nameInput.value,
                    startTime: startInput.value,
                    endTime: endInput.value
                  }]);
                  nameInput.value = '';
                  startInput.value = '';
                  endInput.value = '';
                }
              }}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-700 transition-all"
            >
              Ajouter la pause
            </button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
