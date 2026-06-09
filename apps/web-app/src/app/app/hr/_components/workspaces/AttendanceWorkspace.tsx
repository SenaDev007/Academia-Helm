'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Calendar, UserCheck, UserX, Clock, ChevronRight, Check, X, AlertCircle } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';

const PRIMARY = '#1A2BA6';

export function AttendanceWorkspace() {
  const { tenant, academicYear } = useModuleContext();
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [overtimes, setOvertimes] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ present: 0, absent: 0, attendanceRate: 0 });
  
  // States for forms
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceStatus, setAttendanceStatus] = useState('PRESENT');
  const [notes, setNotes] = useState('');
  const [hoursWorked, setHoursWorked] = useState('8');
  
  const [overtimeDate, setOvertimeDate] = useState(new Date().toISOString().split('T')[0]);
  const [overtimeHours, setOvertimeHours] = useState('2');
  const [overtimeReason, setOvertimeReason] = useState('');

  const [savingAttendance, setSavingAttendance] = useState(false);
  const [savingOvertime, setSavingOvertime] = useState(false);

  useEffect(() => {
    async function loadInitialData() {
      if (!tenant?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        // Load staff to choose from
        const staffData = await hrFetch<any[]>(hrUrl('staff', { tenantId: tenant.id }));
        setStaffList(staffData);
        if (staffData.length > 0) {
          setSelectedStaff(staffData[0]);
        }
      } catch (err) {
        console.error('Error loading initial data:', err);
        toast({ variant: 'error', title: 'Erreur: chargement des données du personnel' });
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, [tenant?.id]);

  useEffect(() => {
    async function loadStaffStatsAndHistory() {
      if (!tenant?.id || !selectedStaff?.id || !academicYear?.id) return;
      try {
        // Load attendance history for selected staff
        const attHistory = await hrFetch<any[]>(hrUrl(`attendance/staff/${selectedStaff.id}`, { tenantId: tenant.id, academicYearId: academicYear.id }));
        setAttendances(attHistory);

        // Load overtime history for selected staff
        const otHistory = await hrFetch<any[]>(hrUrl(`attendance/overtime/staff/${selectedStaff.id}`, { tenantId: tenant.id, academicYearId: academicYear.id }));
        setOvertimes(otHistory);

        // Load stats
        const statData = await hrFetch<any>(hrUrl('attendance/statistics', { tenantId: tenant.id, academicYearId: academicYear.id, staffId: selectedStaff.id }));
        setStats(statData);
      } catch (err) {
        console.error('Error loading staff details:', err);
        toast({ variant: 'error', title: 'Erreur: chargement des détails du collaborateur' });
      }
    }
    loadStaffStatsAndHistory();
  }, [tenant?.id, selectedStaff?.id, academicYear?.id]);

  async function handleRecordAttendance(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant?.id || !selectedStaff?.id || !academicYear?.id) return;
    try {
      setSavingAttendance(true);
      await hrFetch(hrUrl('attendance', { tenantId: tenant.id }), {
        method: 'POST',
        body: {
          academicYearId: academicYear.id,
          staffId: selectedStaff.id,
          date: new Date(attendanceDate).toISOString(),
          status: attendanceStatus,
          hoursWorked: parseFloat(hoursWorked),
          notes,
        },
      });
      // Refresh
      const attHistory = await hrFetch<any[]>(hrUrl(`attendance/staff/${selectedStaff.id}`, { tenantId: tenant.id, academicYearId: academicYear.id }));
      setAttendances(attHistory);
      const statData = await hrFetch<any>(hrUrl('attendance/statistics', { tenantId: tenant.id, academicYearId: academicYear.id, staffId: selectedStaff.id }));
      setStats(statData);
      setNotes('');
      toast({ variant: 'success', title: 'Présence enregistrée avec succès' });
    } catch (err) {
      console.error('Error recording attendance:', err);
      toast({ variant: 'error', title: 'Erreur: enregistrement de la présence' });
    } finally {
      setSavingAttendance(false);
    }
  }

  async function handleRecordOvertime(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant?.id || !selectedStaff?.id || !academicYear?.id) return;
    try {
      setSavingOvertime(true);
      await hrFetch(hrUrl('attendance/overtime', { tenantId: tenant.id }), {
        method: 'POST',
        body: {
          academicYearId: academicYear.id,
          staffId: selectedStaff.id,
          date: new Date(overtimeDate).toISOString(),
          hours: parseFloat(overtimeHours),
          reason: overtimeReason,
        },
      });
      // Refresh
      const otHistory = await hrFetch<any[]>(hrUrl(`attendance/overtime/staff/${selectedStaff.id}`, { tenantId: tenant.id, academicYearId: academicYear.id }));
      setOvertimes(otHistory);
      setOvertimeReason('');
      toast({ variant: 'success', title: 'Heures supplémentaires enregistrées avec succès' });
    } catch (err) {
      console.error('Error recording overtime:', err);
      toast({ variant: 'error', title: 'Erreur: enregistrement des heures supplémentaires' });
    } finally {
      setSavingOvertime(false);
    }
  }

  const filteredStaff = staffList.filter((s) =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
      {/* Sidebar - Staff List */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un collaborateur…"
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10 transition"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="divide-y divide-slate-100 max-h-[450px] overflow-y-auto space-y-1 pr-1">
            {loading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-slate-50 animate-pulse rounded-lg mt-1" />
              ))
            ) : filteredStaff.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">Aucun collaborateur trouvé</p>
            ) : (
              filteredStaff.map((member) => (
                <button
                  key={member.id}
                  onClick={() => setSelectedStaff(member)}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-lg text-left transition-all',
                    selectedStaff?.id === member.id
                      ? 'bg-slate-50 border border-slate-300 shadow-sm'
                      : 'hover:bg-slate-50 border border-transparent'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: PRIMARY + '15', color: PRIMARY }}
                    >
                      {member.firstName?.[0]}{member.lastName?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{member.firstName} {member.lastName}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">{member.position || 'Poste non renseigné'}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="lg:col-span-8 space-y-6">
        {selectedStaff ? (
          <>
            {/* Staff Info and Stats */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-950">
                    Suivi de {selectedStaff.firstName} {selectedStaff.lastName}
                  </h3>
                  <p className="text-sm text-slate-500">{selectedStaff.position || 'Poste non renseigné'} · {selectedStaff.staffCode}</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700">
                  Taux de présence : <span className="font-bold text-[#1A2BA6]">{stats?.attendanceRate?.toFixed(1) || 0}%</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Présences</p>
                    <p className="text-lg font-bold text-slate-800">{stats?.present || 0}</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-100 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-600">
                    <UserX className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Absences</p>
                    <p className="text-lg font-bold text-slate-800">{stats?.absent || 0}</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-600">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Heures supp. approuvées</p>
                    <p className="text-lg font-bold text-slate-800">
                      {overtimes.filter((o) => o.validated === true).reduce((acc, curr) => acc + Number(curr.hours), 0)} hrs
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Forms section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Record Attendance */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
                <h4 className="font-bold text-slate-900 text-sm">Enregistrer une Présence / Absence</h4>
                <form onSubmit={handleRecordAttendance} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Date</label>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1A2BA6]"
                      value={attendanceDate}
                      onChange={(e) => setAttendanceDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Statut</label>
                      <select
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1A2BA6]"
                        value={attendanceStatus}
                        onChange={(e) => setAttendanceStatus(e.target.value)}
                      >
                        <option value="PRESENT">Présent</option>
                        <option value="ABSENT">Absent</option>
                        <option value="LATE">En retard</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Heures Travaillées</label>
                      <input
                        type="number"
                        step="0.5"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1A2BA6]"
                        value={hoursWorked}
                        onChange={(e) => setHoursWorked(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Notes / Justification</label>
                    <input
                      type="text"
                      placeholder="Commentaire ou motif..."
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1A2BA6]"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingAttendance}
                    className="w-full py-2.5 rounded-lg text-white font-semibold text-sm shadow-sm hover:opacity-90 transition flex items-center justify-center"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    {savingAttendance ? 'Enregistrement...' : 'Valider la présence'}
                  </button>
                </form>
              </div>

              {/* Record Overtime */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
                <h4 className="font-bold text-slate-900 text-sm">Déclarer des Heures Supplémentaires</h4>
                <form onSubmit={handleRecordOvertime} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Date</label>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1A2BA6]"
                      value={overtimeDate}
                      onChange={(e) => setOvertimeDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nombre d'heures</label>
                    <input
                      type="number"
                      step="0.5"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1A2BA6]"
                      value={overtimeHours}
                      onChange={(e) => setOvertimeHours(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Raison</label>
                    <input
                      type="text"
                      placeholder="Ex: Soutien cours du soir, correction examens..."
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1A2BA6]"
                      value={overtimeReason}
                      onChange={(e) => setOvertimeReason(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingOvertime}
                    className="w-full py-2.5 rounded-lg text-white font-semibold text-sm shadow-sm hover:opacity-90 transition flex items-center justify-center"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    {savingOvertime ? 'Déclaration...' : 'Déclarer les heures'}
                  </button>
                </form>
              </div>
            </div>

            {/* History Tables */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
                <h4 className="font-bold text-slate-900 text-sm">Historique des Présences</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-5 py-3 text-slate-500 font-semibold">Date</th>
                      <th className="px-5 py-3 text-slate-500 font-semibold">Statut</th>
                      <th className="px-5 py-3 text-slate-500 font-semibold">Heures</th>
                      <th className="px-5 py-3 text-slate-500 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendances.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-6 text-slate-400">Aucun enregistrement de présence</td>
                      </tr>
                    ) : (
                      attendances.map((att) => (
                        <tr key={att.id}>
                          <td className="px-5 py-3.5 font-medium text-slate-900">
                            {new Date(att.date).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={cn(
                              'px-2 py-0.5 rounded-full text-xs font-bold uppercase',
                              att.status === 'PRESENT' && 'bg-emerald-50 text-emerald-700 border border-emerald-100',
                              att.status === 'ABSENT' && 'bg-rose-50 text-rose-700 border border-rose-100',
                              att.status === 'LATE' && 'bg-amber-50 text-amber-700 border border-amber-100'
                            )}>
                              {att.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-slate-600">{att.hoursWorked || 0} hrs</td>
                          <td className="px-5 py-3.5 text-slate-500 max-w-[200px] truncate">{att.notes || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center shadow-sm">
            <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">Aucun collaborateur disponible</h3>
            <p className="text-sm text-slate-500 mt-2">Veuillez d'abord enregistrer un collaborateur dans le module Personnel.</p>
          </div>
        )}
      </div>
    </div>
  );
}
