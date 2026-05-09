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
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FormModal, 
  ConfirmModal 
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { cn } from '@/lib/utils';

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

  // Modals
  const [modal, setModal] = useState<'none' | 'create-timetable' | 'add-entry'>('none');

  // --- Loaders ---

  const loadData = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const [tts, cls, rms, tchs] = await Promise.all([
        pedagogyFetch<Timetable[]>(`/api/pedagogy/timetables?academicYearId=${academicYear.id}`),
        pedagogyFetch<AcademicClass[]>(`/api/pedagogy/academic-classes?academicYearId=${academicYear.id}`),
        pedagogyFetch<Room[]>(`/api/pedagogy/rooms`),
        pedagogyFetch<any[]>(`/api/pedagogy/teacher-profiles?academicYearId=${academicYear.id}`)
      ]);
      setClasses(cls);
      setRooms(rms);
      setTeachers(tchs);

      if (tts.length > 0) {
        setActiveTimetableId(tts[0].id);
      } else {
        // Créer un emploi du temps par défaut si vide
        const newTt = await pedagogyFetch<Timetable>('/api/pedagogy/timetables', {
          method: 'POST',
          body: JSON.stringify({
            academicYearId: academicYear.id,
            schoolLevelId: schoolLevel?.id || 'ALL',
            name: `Emploi du Temps Principal ${academicYear.label}`,
            startDate: new Date(),
          })
        });
        setTimetables([newTt]);
        setActiveTimetableId(newTt.id);
      }
      if (cls.length > 0) setSelectedId(cls[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id]);

  const loadEntries = useCallback(async () => {
    if (!activeTimetableId) return;
    try {
      const data = await pedagogyFetch<any>(`/api/pedagogy/timetables/${activeTimetableId}`);
      setEntries(data.entries);
    } catch (e) {
      console.error(e);
    }
  }, [activeTimetableId]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadEntries(); }, [loadEntries]);

  // --- Filtered Entries for Grid ---
  const filteredEntries = useMemo(() => {
    if (!selectedId) return entries;
    return entries.filter(e => {
      if (viewMode === 'class') return e.class?.id === selectedId;
      if (viewMode === 'teacher') return e.teacher?.id === selectedId;
      if (viewMode === 'room') return e.room?.id === selectedId;
      return true;
    });
  }, [entries, viewMode, selectedId]);

  // --- Actions ---

  const handleAddEntry = async (data: any) => {
    if (!activeTimetableId || !academicYear?.id) return;
    try {
      await pedagogyFetch(`/api/pedagogy/timetables/entries`, {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          timetableId: activeTimetableId,
          academicYearId: academicYear.id,
          schoolLevelId: schoolLevel?.id || 'ALL'
        })
      });
      loadEntries();
      setModal('none');
    } catch (e) {
      alert(e.message || "Erreur lors de l'ajout. Vérifiez les conflits.");
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await pedagogyFetch(`/api/pedagogy/timetables/entries/${id}`, { method: 'DELETE' });
      loadEntries();
    } catch (e) {
      console.error(e);
    }
  };

  // --- Grid Component ---
  const GridCell = ({ day, hour }: { day: number, hour: number }) => {
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
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
            <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-100 rounded-2xl text-xs font-black text-gray-600 hover:bg-gray-50 transition-all">
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

      {/* Modal Add Entry */}
      <FormModal
        isOpen={modal === 'add-entry'}
        onClose={() => setModal('none')}
        title="Nouveau Cours / Créneau"
        size="lg"
        onSave={handleAddEntry}
        fields={[
          {
            name: 'classId',
            label: 'Classe',
            type: 'select',
            options: classes.map(c => ({ value: c.id, label: c.name })),
            defaultValue: viewMode === 'class' ? selectedId : undefined
          },
          {
            name: 'subjectId',
            label: 'Matière',
            type: 'select',
            options: teachers.find(t => t.teacherId === (viewMode === 'teacher' ? selectedId : ''))?.subjectQualifications.map((q: any) => ({ value: q.subjectId, label: q.subjectId })) || [] // Need to fetch real subject names
          },
          {
            name: 'teacherId',
            label: 'Enseignant',
            type: 'select',
            options: teachers.map(t => ({ value: t.teacherId, label: `${t.teacher.lastName} ${t.teacher.firstName}` })),
            defaultValue: viewMode === 'teacher' ? selectedId : undefined
          },
          {
            name: 'roomId',
            label: 'Salle de classe',
            type: 'select',
            options: rooms.map(r => ({ value: r.id, label: `${r.name} (${r.code})` })),
            defaultValue: viewMode === 'room' ? selectedId : undefined
          },
          {
            name: 'dayOfWeek',
            label: 'Jour',
            type: 'select',
            options: DAYS.map(d => ({ value: d.id, label: d.label }))
          },
          {
            name: 'startTime',
            label: 'Heure Début',
            type: 'time'
          },
          {
            name: 'endTime',
            label: 'Heure Fin',
            type: 'time'
          }
        ]}
      />
    </div>
  );
}
