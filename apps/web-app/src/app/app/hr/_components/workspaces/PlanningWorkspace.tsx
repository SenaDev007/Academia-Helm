'use client';

import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Clock, Search, User, Filter, AlertCircle, Plus, Sparkles, PlusCircle, ChevronLeft, ChevronRight, Loader2, Users } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';

const PRIMARY = '#1A2BA6';

const DAYS_OF_WEEK = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAY_OF_WEEK_MAP: Record<string, string> = {
  Lundi: 'MONDAY', Mardi: 'TUESDAY', Mercredi: 'WEDNESDAY',
  Jeudi: 'THURSDAY', Vendredi: 'FRIDAY', Samedi: 'SATURDAY',
};
const SHIFTS = [
  { name: 'Matin', type: 'MORNING', startTime: '08:00', endTime: '12:00', time: '08:00 - 12:00' },
  { name: 'Après-midi', type: 'AFTERNOON', startTime: '14:00', endTime: '18:00', time: '14:00 - 18:00' },
];

function getWeekDates(offset: number): Date[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1 + offset * 7);
  return DAYS_OF_WEEK.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

interface AssignmentValue {
  staffId: string;
  scheduleId?: string;
  role?: string;
}

export function PlanningWorkspace() {
  const { tenant, academicYear } = useModuleContext();
  const confirmDialog = useConfirmDialog();
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [assignments, setAssignments] = useState<Record<string, AssignmentValue>>({});

  const weekDates = getWeekDates(weekOffset);
  const weekLabel = `${weekDates[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — ${weekDates[5].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  // Load staff
  useEffect(() => {
    async function loadStaff() {
      if (!tenant?.id) {
        setLoading(false);
        return;
      }
      try {
        const data = await hrFetch<any[]>(hrUrl('staff', { tenantId: tenant.id }));
        setStaffList(data);
      } catch (err) {
        console.error('Error loading staff for planning:', err);
      }
    }
    loadStaff();
  }, [tenant?.id]);

  // Load schedules from API for the current week
  const loadSchedules = useCallback(async () => {
    if (!tenant?.id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const startDate = formatDateKey(weekDates[0]);
      const endDate = formatDateKey(weekDates[5]);
      const data = await hrFetch<any[]>(hrUrl('schedules', { tenantId: tenant.id, startDate, endDate }));

      // Map API schedules to assignments grid
      const newAssignments: Record<string, AssignmentValue> = {};
      for (const sched of data) {
        const schedDate = new Date(sched.date);
        const dayIdx = schedDate.getDay() - 1; // Monday=0
        if (dayIdx < 0 || dayIdx > 5) continue;
        const dayName = DAYS_OF_WEEK[dayIdx];
        const shiftName = sched.shift === 'AFTERNOON' ? 'Après-midi' : 'Matin';
        const key = `${dayName}-${shiftName}`;
        newAssignments[key] = {
          staffId: sched.staffId || sched.staff?.id || '',
          scheduleId: sched.id,
          role: sched.role || sched.staff?.position || '',
        };
      }
      setAssignments(newAssignments);
    } catch (err) {
      console.error('Error loading schedules:', err);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, weekOffset]);

  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  const handleAssignmentChange = async (key: string, staffId: string) => {
    const prev = assignments[key];
    setSavingKey(key);

    // Parse key to get day and shift
    const [dayName, ...shiftParts] = key.split('-');
    const shiftName = shiftParts.join('-');
    const dayIdx = DAYS_OF_WEEK.indexOf(dayName);
    if (dayIdx < 0) { setSavingKey(null); return; }
    const date = weekDates[dayIdx];
    const shiftObj = SHIFTS.find(s => s.name === shiftName);
    const shiftType = shiftObj?.type || 'MORNING';
    const dayOfWeek = DAY_OF_WEEK_MAP[dayName] || 'MONDAY';

    // Find the staff member for role info
    const staffMember = staffList.find(s => s.id === staffId);
    const role = staffMember?.position || '';

    // Optimistic update
    if (staffId) {
      setAssignments((prev) => ({
        ...prev,
        [key]: { staffId, scheduleId: prev?.[key]?.scheduleId, role },
      }));
    } else {
      setAssignments((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }

    try {
      if (staffId && prev?.scheduleId) {
        // Update existing schedule
        await hrFetch<any>(hrUrl(`schedules/${prev.scheduleId}`, { tenantId: tenant.id }), {
          method: 'PUT',
          body: {
            staffId,
            dayOfWeek,
            shiftType,
            startTime: shiftObj?.startTime,
            endTime: shiftObj?.endTime,
            role,
            date: formatDateKey(date),
            shift: shiftType,
            academicYearId: academicYear?.id,
            tenantId: tenant?.id,
          },
        });
        toast({ variant: 'success', title: 'Planning mis à jour' });
      } else if (staffId && !prev?.scheduleId) {
        // Create new schedule
        const result = await hrFetch<any>(hrUrl('schedules', { tenantId: tenant.id }), {
          method: 'POST',
          body: {
            staffId,
            dayOfWeek,
            shiftType,
            startTime: shiftObj?.startTime,
            endTime: shiftObj?.endTime,
            role,
            date: formatDateKey(date),
            shift: shiftType,
            academicYearId: academicYear?.id,
            tenantId: tenant?.id,
          },
        });
        // Store the new schedule ID
        setAssignments((prev) => ({
          ...prev,
          [key]: { staffId, scheduleId: result?.id, role },
        }));
        toast({ variant: 'success', title: 'Créneau ajouté au planning' });
      } else if (!staffId && prev?.scheduleId) {
        // Delete schedule
        const ok = await confirmDialog.warning(
          'Ce créneau de planning sera définitivement supprimé.',
          'Supprimer ce créneau ?'
        );
        if (!ok) {
          // Revert optimistic update — reload from server
          loadSchedules();
          setSavingKey(null);
          return;
        }
        await hrFetch<any>(hrUrl(`schedules/${prev.scheduleId}`, { tenantId: tenant.id }), { method: 'DELETE' });
        toast({ variant: 'success', title: 'Créneau supprimé' });
      }
    } catch (err) {
      toast({ variant: 'error', title: 'Erreur lors de la sauvegarde' });
      // Revert optimistic update
      loadSchedules();
    } finally {
      setSavingKey(null);
    }
  };

  const getStaffById = (id: string) => staffList.find(s => s.id === id);

  const getCategoryColor = (staffId: string) => {
    const staff = getStaffById(staffId);
    const cat = staff?.category;
    if (cat === 'PEDAGOGICAL') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (cat === 'ADMIN') return 'bg-purple-50 text-purple-700 border-purple-200';
    if (cat === 'SUPPORT') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-slate-50 text-slate-600 border-slate-200';
  };

  const filteredStaff = staffList.filter((s) => {
    const matchesSearch = `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <>
    {confirmDialog.dialog}
    <div className="space-y-6 pb-12">
      {/* KPI banner */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-900 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-300 animate-pulse" /> Planning Hebdomadaire
          </h3>
          <p className="text-sm text-blue-100 mt-1">
            Organisez la répartition et les rôles de garde des collaborateurs par plages horaires.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="bg-white/10 px-4 py-2 rounded-xl text-center backdrop-blur-sm">
            <p className="text-[10px] uppercase font-bold tracking-wider opacity-80">Collaborateurs actifs</p>
            <p className="text-lg font-bold mt-0.5">{staffList.length}</p>
          </div>
          <div className="bg-white/10 px-4 py-2 rounded-xl text-center backdrop-blur-sm">
            <p className="text-[10px] uppercase font-bold tracking-wider opacity-80">Créneaux cette semaine</p>
            <p className="text-lg font-bold mt-0.5">{Object.keys(assignments).length}</p>
          </div>
        </div>
      </div>

      {/* Roster Calendar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-slate-400" /> Grille de Garde / Permanence
          </h4>
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekOffset((w) => w - 1)} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200">
              <ChevronLeft className="h-4 w-4 text-slate-500" />
            </button>
            <span className="text-sm font-semibold text-slate-700 min-w-[200px] text-center">{weekLabel}</span>
            <button onClick={() => setWeekOffset((w) => w + 1)} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200">
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="ml-2 text-xs font-semibold text-[#1A2BA6] hover:underline">Aujourd&apos;hui</button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" style={{ color: PRIMARY }} />
              <p className="text-sm text-slate-500 font-medium">Chargement du planning…</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-5 py-3 text-slate-500 font-semibold w-40">Horaires</th>
                  {DAYS_OF_WEEK.map((day, i) => (
                    <th key={day} className="px-5 py-3 text-slate-500 font-semibold min-w-[140px]">
                      <div>{day}</div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">{weekDates[i]?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {SHIFTS.map((shift) => (
                  <tr key={shift.name}>
                    <td className="px-5 py-4 font-semibold text-slate-800 bg-slate-50/20">
                      <div className="text-sm">{shift.name}</div>
                      <div className="text-xs text-slate-400 font-normal mt-0.5">{shift.time}</div>
                    </td>
                    {DAYS_OF_WEEK.map((day) => {
                      const key = `${day}-${shift.name}`;
                      const assigned = assignments[key];
                      const assignedStaff = assigned?.staffId ? getStaffById(assigned.staffId) : null;
                      const isSaving = savingKey === key;
                      return (
                        <td key={day} className="px-3 py-3">
                          <div className="relative">
                            <select
                              className={cn(
                                'text-xs font-semibold rounded-lg px-2.5 py-2 border focus:outline-none w-full shadow-sm transition appearance-none pr-7',
                                assignedStaff ? getCategoryColor(assigned.staffId) : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100',
                                isSaving && 'opacity-60'
                              )}
                              value={assigned?.staffId || ''}
                              onChange={(e) => handleAssignmentChange(key, e.target.value)}
                              disabled={isSaving}
                            >
                              <option value="">-- Non assigné --</option>
                              {staffList.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.firstName} {s.lastName}
                                </option>
                              ))}
                            </select>
                            {isSaving && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                              </div>
                            )}
                          </div>
                          {assignedStaff && (
                            <p className="text-[10px] text-slate-400 mt-1 truncate px-1">
                              {assignedStaff.position || assignedStaff.category || ''}
                            </p>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Staff directory for quick reference */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-400" /> Disponibilité du Personnel
          </h4>
          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-grow md:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrer par nom..."
                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs placeholder:text-slate-400 focus:outline-none focus:border-[#1A2BA6] transition"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 focus:outline-none"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="ALL">Toutes catégories</option>
              <option value="PEDAGOGICAL">Enseignants</option>
              <option value="ADMIN">Administratifs</option>
              <option value="SUPPORT">Appui</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            [1, 2, 3].map((i) => <div key={i} className="h-16 bg-slate-50 animate-pulse rounded-lg" />)
          ) : filteredStaff.length === 0 ? (
            <p className="text-sm text-slate-400 col-span-full text-center py-6">Aucun collaborateur trouvé</p>
          ) : (
            filteredStaff.map((s) => {
              // Count how many shifts this staff member is assigned to this week
              const assignedShifts = Object.values(assignments).filter(a => a.staffId === s.id).length;
              return (
                <div key={s.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50/50 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold font-mono" style={{ backgroundColor: PRIMARY + '15', color: PRIMARY }}>
                      {s.firstName?.[0]}{s.lastName?.[0]}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{s.firstName} {s.lastName}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{s.position || 'Général'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {assignedShifts > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                        {assignedShifts} créneau{assignedShifts > 1 ? 'x' : ''}
                      </span>
                    )}
                    <span className={cn(
                      'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border',
                      s.status === 'ACTIVE' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' :
                      s.status === 'ON_LEAVE' ? 'text-blue-600 bg-blue-50 border-blue-100' :
                      'text-slate-500 bg-slate-50 border-slate-100'
                    )}>
                      {s.status === 'ACTIVE' ? 'Actif' : s.status === 'ON_LEAVE' ? 'En congé' : s.status || 'Actif'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
    </>
  );
}
