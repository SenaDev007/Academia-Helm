/**
 * FederisCentersPage — Centres d'examen et salles (Academia Federis)
 *
 * Workflow logistique §9 : sélection d'examen → registre des centres
 * (GET /federis/exams/:id/centers), création de centres et de salles,
 * capacités et occupation. Écritures réservées au coordonnateur et à
 * l'organisateur (canWrite 'exam_org' — garde finale côté API).
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { canWrite } from '@/lib/patronat/permissions';
import { useFederisExams, EXAM_STATUS_LABELS } from '@/hooks/useFederisExams';

interface Room {
  id: string;
  code: string;
  name: string;
  capacity: number;
  currentOccupancy: number;
  floor: number | null;
  building: string | null;
  status: string;
}

interface Center {
  id: string;
  code: string;
  name: string;
  address: string | null;
  capacity: number;
  status: string;
  contactName: string | null;
  contactPhone: string | null;
  rooms: Room[];
  roomsCount: number;
  roomsCapacity: number;
  assignedCandidates: number;
}

interface FederisCentersPageProps {
  tenantId?: string;
  userRole?: string | null;
}

export default function FederisCentersPage({ userRole }: FederisCentersPageProps) {
  const { exams, examId, setExamId, loading: examsLoading } = useFederisExams();
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showCenterForm, setShowCenterForm] = useState(false);
  const [centerForm, setCenterForm] = useState({ code: '', name: '', address: '', contactName: '', contactPhone: '' });
  const [roomFormTarget, setRoomFormTarget] = useState<string | null>(null);
  const [roomForm, setRoomForm] = useState({ code: '', name: '', capacity: '', building: '', floor: '' });
  const [busy, setBusy] = useState(false);

  const canOrganize = canWrite(userRole, 'exam_org');

  const load = useCallback(async () => {
    if (!examId) {
      setCenters([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/federis/exams/${examId}/centers`, { timeout: 20000 });
      setCenters(res.data?.centers ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de charger les centres.');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examId) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/federis/exams/${examId}/centers`, centerForm, { timeout: 20000 });
      setNotice(`Centre ${centerForm.code.toUpperCase()} créé.`);
      setShowCenterForm(false);
      setCenterForm({ code: '', name: '', address: '', contactName: '', contactPhone: '' });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Création impossible.');
    } finally {
      setBusy(false);
    }
  };

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomFormTarget) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(
        `/federis/centers/${roomFormTarget}/rooms`,
        {
          code: roomForm.code,
          name: roomForm.name || undefined,
          capacity: Number(roomForm.capacity),
          building: roomForm.building || undefined,
          floor: roomForm.floor ? Number(roomForm.floor) : undefined,
        },
        { timeout: 20000 },
      );
      setNotice(`Salle ${roomForm.code.toUpperCase()} ajoutée.`);
      setRoomFormTarget(null);
      setRoomForm({ code: '', name: '', capacity: '', building: '', floor: '' });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Création impossible.');
    } finally {
      setBusy(false);
    }
  };

  const archiveCenter = async (center: Center) => {
    setError(null);
    setNotice(null);
    try {
      await apiClient.patch(`/federis/centers/${center.id}`, { status: 'ARCHIVED' }, { timeout: 20000 });
      setNotice(`Centre ${center.name} archivé.`);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Archivage impossible.');
    }
  };

  const totalRooms = centers.reduce((s, c) => s + c.roomsCount, 0);
  const totalCapacity = centers.reduce((s, c) => s + c.roomsCapacity, 0);
  const totalAssigned = centers.reduce((s, c) => s + c.assignedCandidates, 0);

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="bg-white p-8 lg:p-10 rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16" />
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 bg-blue-900 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
              <AppIcon name="classes" size="dashboard" className="text-white" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 italic tracking-tighter">Centres et salles</h1>
          </div>
          <p className="text-gray-500 font-medium max-w-xl">
            Organisez le réseau des centres d&apos;accueil et leurs salles. L&apos;affectation des
            candidats aux numéros de table s&apos;appuie sur ces capacités.
          </p>
        </div>
        <div className="flex items-center gap-6 shrink-0">
          <div className="text-right">
            <p className="text-2xl font-black text-blue-900 tracking-tighter">{centers.length}</p>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Centres</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-blue-900 tracking-tighter">{totalRooms}</p>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Salles</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-blue-900 tracking-tighter">{totalCapacity}</p>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Places</p>
          </div>
          {canOrganize && (
            <button
              onClick={() => setShowCenterForm((v) => !v)}
              disabled={!examId}
              className="px-5 py-3 bg-blue-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all disabled:opacity-40"
            >
              {showCenterForm ? 'Fermer' : 'Ajouter un centre'}
            </button>
          )}
        </div>
      </div>

      {/* Sélecteur d'examen */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">Examen</span>
        {examsLoading ? (
          <span className="text-sm font-bold text-gray-400">Chargement…</span>
        ) : exams.length === 0 ? (
          <span className="text-sm font-bold text-gray-400">Aucun examen — créez d&apos;abord une campagne.</span>
        ) : (
          <select
            value={examId ?? ''}
            onChange={(e) => setExamId(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-gray-50 rounded-xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-900"
          >
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.code} — {exam.name} ({EXAM_STATUS_LABELS[exam.status] ?? exam.status})
              </option>
            ))}
          </select>
        )}
        {totalCapacity > 0 && (
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">
            {totalAssigned} / {totalCapacity} affectés
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-sm font-semibold text-red-800">{error}</div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-4 text-sm font-semibold text-emerald-800">{notice}</div>
      )}

      {/* Formulaire centre */}
      {showCenterForm && canOrganize && examId && (
        <form onSubmit={createCenter} className="bg-white rounded-3xl border border-blue-100 shadow-lg p-8 space-y-5">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Nouveau centre d&apos;accueil</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Code</label>
              <input required value={centerForm.code} onChange={(e) => setCenterForm({ ...centerForm, code: e.target.value })}
                placeholder="CTR-COTONOU" className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Établissement d&apos;accueil</label>
              <input required value={centerForm.name} onChange={(e) => setCenterForm({ ...centerForm, name: e.target.value })}
                placeholder="Lycée Coulibaly" className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Adresse</label>
              <input value={centerForm.address} onChange={(e) => setCenterForm({ ...centerForm, address: e.target.value })}
                placeholder="Cotonou, quartier…" className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Contact</label>
              <input value={centerForm.contactName} onChange={(e) => setCenterForm({ ...centerForm, contactName: e.target.value })}
                placeholder="Chef de centre" className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Téléphone</label>
              <input value={centerForm.contactPhone} onChange={(e) => setCenterForm({ ...centerForm, contactPhone: e.target.value })}
                placeholder="+229…" className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900" />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={busy} className="px-8 py-3.5 bg-blue-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all disabled:opacity-50">
              {busy ? 'Création…' : 'Créer le centre'}
            </button>
          </div>
        </form>
      )}

      {/* Liste des centres */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center text-sm font-bold text-gray-400">
          Chargement des centres…
        </div>
      ) : centers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center text-sm font-bold text-gray-400">
          Aucun centre pour cet examen. {canOrganize ? 'Ajoutez le premier centre d\u2019accueil.' : ''}
        </div>
      ) : (
        <div className="space-y-5">
          {centers.map((center) => (
            <div key={center.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 lg:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-50">
                <div className="flex items-center space-x-5">
                  <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center font-black text-blue-900 text-lg shadow-sm">
                    {center.code.slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className="text-lg font-black text-gray-900">{center.name}</h4>
                      <span className="text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-900 px-2.5 py-1 rounded">
                        {center.code}
                      </span>
                      {center.status !== 'ACTIVE' && (
                        <span className="text-[9px] font-black uppercase tracking-widest bg-gray-100 text-gray-500 px-2.5 py-1 rounded">
                          {center.status}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1.5">
                      {center.address ?? 'Adresse non renseignée'}
                      {center.contactName ? ` • ${center.contactName}` : ''}
                      {center.contactPhone ? ` • ${center.contactPhone}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', center.roomsCapacity > 0 && center.assignedCandidates / center.roomsCapacity > 0.9 ? 'bg-red-500' : 'bg-blue-500')}
                          style={{ width: `${center.roomsCapacity > 0 ? Math.min(100, (center.assignedCandidates / center.roomsCapacity) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-black text-gray-900">
                        {center.roomsCapacity > 0 ? Math.round((center.assignedCandidates / center.roomsCapacity) * 100) : 0}%
                      </span>
                    </div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                      {center.assignedCandidates} / {center.roomsCapacity} places ({center.roomsCount} salles)
                    </p>
                  </div>
                  {canOrganize && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setRoomFormTarget(roomFormTarget === center.id ? null : center.id); setRoomForm({ code: '', name: '', capacity: '', building: '', floor: '' }); }}
                        className="px-4 py-2.5 bg-blue-50 rounded-xl text-[10px] font-black uppercase tracking-widest text-blue-900 hover:bg-blue-100 transition-all"
                      >
                        + Salle
                      </button>
                      {center.status === 'ACTIVE' && (
                        <button
                          onClick={() => archiveCenter(center)}
                          className="px-4 py-2.5 bg-gray-50 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-red-50 hover:text-red-700 transition-all"
                          title="Archiver le centre"
                        >
                          Archiver
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Salles */}
              <div className="p-6 lg:p-8">
                {center.rooms.length === 0 ? (
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Aucune salle — la capacité du centre est nulle tant qu&apos;aucune salle n&apos;est créée.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {center.rooms.map((room) => (
                      <div key={room.id} className={cn(
                        'rounded-2xl border p-5',
                        room.status === 'FULL' ? 'border-amber-200 bg-amber-50' : room.status === 'MAINTENANCE' ? 'border-gray-200 bg-gray-50' : 'border-gray-100 bg-gray-50/60',
                      )}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-black text-gray-900">{room.code}</span>
                          <span className={cn(
                            'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded',
                            room.status === 'FULL' ? 'bg-amber-200 text-amber-900' : room.status === 'MAINTENANCE' ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-700',
                          )}>
                            {room.status === 'FULL' ? 'Pleine' : room.status === 'MAINTENANCE' ? 'Indispo.' : 'Dispo.'}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                          {room.name}
                          {room.building ? ` • ${room.building}` : ''}
                          {room.floor ? ` • Étage ${room.floor}` : ''}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-gray-900">
                            {room.currentOccupancy} / {room.capacity}
                          </span>
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={cn('h-full', room.currentOccupancy >= room.capacity ? 'bg-red-500' : 'bg-blue-500')}
                              style={{ width: `${room.capacity > 0 ? Math.min(100, (room.currentOccupancy / room.capacity) * 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Formulaire salle */}
                {roomFormTarget === center.id && canOrganize && (
                  <form onSubmit={createRoom} className="mt-5 bg-white rounded-2xl border border-blue-100 p-6 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Code</label>
                      <input required value={roomForm.code} onChange={(e) => setRoomForm({ ...roomForm, code: e.target.value })}
                        placeholder="S-01" className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Nom</label>
                      <input value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                        placeholder="Salle 12A" className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Capacité</label>
                      <input required type="number" min={1} value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })}
                        placeholder="40" className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Bâtiment / Étage</label>
                      <div className="flex gap-2">
                        <input value={roomForm.building} onChange={(e) => setRoomForm({ ...roomForm, building: e.target.value })}
                          placeholder="Bloc A" className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900" />
                        <input value={roomForm.floor} onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })}
                          placeholder="1" className="w-16 px-3 py-2.5 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900" />
                      </div>
                    </div>
                    <button type="submit" disabled={busy} className="px-6 py-3 bg-blue-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-800 transition-all disabled:opacity-50">
                      {busy ? '…' : 'Ajouter'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
