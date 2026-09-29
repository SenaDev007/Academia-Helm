/**
 * FederisCentersPage — Centres d'examen, salles ET surveillants (Academia Federis)
 *
 * ⭐ 2026-09-29 — le module devient « Centres, salles & Surveillants » :
 *    1. Onglet « Centres et salles » — workflow logistique §9 : sélection
 *       d'examen → registre des centres (GET /federis/exams/:id/centers),
 *       création de centres et de salles, capacités et occupation ;
 *    2. Onglet « Gestion des surveillants » — demande aux écoles rattachées,
 *       listes d'enseignants reçues par école + récapitulatif global,
 *       répartition par centre et par salle, registre des affectations
 *       (composant FederisSupervisorsTab — workflow patronat ↔ écoles Helm).
 *
 * Écritures réservées au coordonnateur et à l'organisateur (canWrite
 * 'exam_org' — garde finale côté API).
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { canWrite } from '@/lib/patronat/permissions';
import { useFederisExams, EXAM_STATUS_LABELS } from '@/hooks/useFederisExams';
import { FedPage, FedCountUp } from '@/components/federis/federis-motion';
import FederisSupervisorsTab from './FederisSupervisorsTab';

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
  // ⭐ Onglet du module : « Centres et salles » | « Gestion des surveillants »
  const [tab, setTab] = useState<'centres' | 'surveillants'>('centres');
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
    <FedPage className="space-y-8">
      {/* En-tête */}
      <div className="fed-card p-8 lg:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="relative z-10">
          <div className="fed-badge mb-3">Module logistique</div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-800 rounded-lg flex items-center justify-center ">
              <AppIcon name="classes" size="dashboard" className="text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-blue-900 tracking-tight">Centres, salles &amp; Surveillants</h1>
          </div>
          <p className="text-slate-500 font-medium max-w-xl text-sm mt-3">
            Organisez le réseau des centres d&apos;accueil et leurs salles, et gérez les
            surveillants : demande aux écoles rattachées, répartition par centre et par
            salle, notifications aux enseignants.
          </p>
        </div>
        <div className="flex items-center gap-6 shrink-0">
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-800"><FedCountUp value={centers.length} /></p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Centres</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-800"><FedCountUp value={totalRooms} /></p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Salles</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-800"><FedCountUp value={totalCapacity} /></p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Places</p>
          </div>
          {canOrganize && tab === 'centres' && (
            <button
              onClick={() => setShowCenterForm((v) => !v)}
              disabled={!examId}
              className="fed-btn-gold px-4 py-2.5 text-sm disabled:opacity-40"
            >
              {showCenterForm ? 'Fermer' : 'Ajouter un centre'}
            </button>
          )}
        </div>
      </div>

      {/* ⭐ Onglets du module (pattern Helm) : Centres et salles | Gestion des surveillants */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setTab('centres')}
          className={cn(
            'px-5 py-2 rounded-lg text-xs transition-all',
            tab === 'centres'
              ? 'bg-white shadow-sm text-blue-900 font-bold'
              : 'text-slate-500 font-semibold hover:text-blue-900',
          )}
        >
          Centres et salles
        </button>
        <button
          type="button"
          onClick={() => setTab('surveillants')}
          className={cn(
            'px-5 py-2 rounded-lg text-xs transition-all',
            tab === 'surveillants'
              ? 'bg-white shadow-sm text-blue-900 font-bold'
              : 'text-slate-500 font-semibold hover:text-blue-900',
          )}
        >
          Gestion des surveillants
        </button>
      </div>

      {/* Sélecteur d'examen — partagé par les deux onglets */}
      <div className="fed-card px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Examen</span>
        {examsLoading ? (
          <span className="text-sm font-bold text-slate-400">Chargement…</span>
        ) : exams.length === 0 ? (
          <span className="text-sm font-bold text-slate-400">Aucun examen — créez d&apos;abord une campagne.</span>
        ) : (
          <select
            value={examId ?? ''}
            onChange={(e) => setExamId(e.target.value)}
            className="fed-input-light flex-1 !w-auto px-4 py-2.5 font-bold"
          >
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.code} — {exam.name} ({EXAM_STATUS_LABELS[exam.status] ?? exam.status})
              </option>
            ))}
          </select>
        )}
        {totalCapacity > 0 && (
          <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">
            {totalAssigned} / {totalCapacity} affectés
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">{error}</div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-4 text-sm font-semibold text-emerald-800">{notice}</div>
      )}

      {/* Formulaire centre (onglet « Centres et salles ») */}
      {tab === 'centres' && showCenterForm && canOrganize && examId && (
        <form onSubmit={createCenter} className="fed-card p-8 space-y-5">
          <h3 className="text-sm font-bold text-blue-900 uppercase">Nouveau centre d&apos;accueil</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Code</label>
              <input required value={centerForm.code} onChange={(e) => setCenterForm({ ...centerForm, code: e.target.value })}
                placeholder="CTR-COTONOU" className="fed-input-light px-4 py-3 font-semibold" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Établissement d&apos;accueil</label>
              <input required value={centerForm.name} onChange={(e) => setCenterForm({ ...centerForm, name: e.target.value })}
                placeholder="Lycée Coulibaly" className="fed-input-light px-4 py-3 font-semibold" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Adresse</label>
              <input value={centerForm.address} onChange={(e) => setCenterForm({ ...centerForm, address: e.target.value })}
                placeholder="Cotonou, quartier…" className="fed-input-light px-4 py-3 font-semibold" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Contact</label>
              <input value={centerForm.contactName} onChange={(e) => setCenterForm({ ...centerForm, contactName: e.target.value })}
                placeholder="Chef de centre" className="fed-input-light px-4 py-3 font-semibold" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Téléphone</label>
              <input value={centerForm.contactPhone} onChange={(e) => setCenterForm({ ...centerForm, contactPhone: e.target.value })}
                placeholder="+229…" className="fed-input-light px-4 py-3 font-semibold" />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={busy} className="fed-btn-gold px-8 py-3 text-sm disabled:opacity-50">
              {busy ? 'Création…' : 'Créer le centre'}
            </button>
          </div>
        </form>
      )}

      {/* Liste des centres (onglet « Centres et salles ») */}
      {tab === 'centres' && (loading ? (
        <div className="fed-card p-12 text-center text-sm font-bold text-slate-400">
          Chargement des centres…
        </div>
      ) : centers.length === 0 ? (
        <div className="fed-card p-12 text-center text-sm font-bold text-slate-400">
          Aucun centre pour cet examen. {canOrganize ? 'Ajoutez le premier centre d\u2019accueil.' : ''}
        </div>
      ) : (
        <div className="space-y-5">
          {centers.map((center) => (
            <div key={center.id} className="fed-card overflow-hidden">
              <div className="p-6 lg:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-blue-50">
                <div className="flex items-center space-x-5">
                  <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center font-bold text-blue-800 text-lg shadow-sm">
                    {center.code.slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className="text-lg font-bold text-blue-900">{center.name}</h4>
                      <span className="text-[9px] font-bold uppercase bg-blue-50 text-blue-800 px-2.5 py-1 rounded-full">
                        {center.code}
                      </span>
                      {center.status !== 'ACTIVE' && (
                        <span className="text-[9px] font-bold uppercase bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">
                          {center.status}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1.5">
                      {center.address ?? 'Adresse non renseignée'}
                      {center.contactName ? ` • ${center.contactName}` : ''}
                      {center.contactPhone ? ` • ${center.contactPhone}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-24 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', center.roomsCapacity > 0 && center.assignedCandidates / center.roomsCapacity > 0.9 ? 'bg-red-500' : 'bg-[#1e3a8a]')}
                          style={{ width: `${center.roomsCapacity > 0 ? Math.min(100, (center.assignedCandidates / center.roomsCapacity) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-blue-900">
                        {center.roomsCapacity > 0 ? Math.round((center.assignedCandidates / center.roomsCapacity) * 100) : 0}%
                      </span>
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">
                      {center.assignedCandidates} / {center.roomsCapacity} places ({center.roomsCount} salles)
                    </p>
                  </div>
                  {canOrganize && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setRoomFormTarget(roomFormTarget === center.id ? null : center.id); setRoomForm({ code: '', name: '', capacity: '', building: '', floor: '' }); }}
                        className="px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-[10px] font-bold uppercase text-blue-800 hover:bg-[#1e3a8a] hover:text-white transition-all"
                      >
                        + Salle
                      </button>
                      {center.status === 'ACTIVE' && (
                        <button
                          onClick={() => archiveCenter(center)}
                          className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold uppercase text-slate-500 hover:bg-red-50 hover:text-red-700 transition-all"
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
                  <p className="text-xs font-bold text-slate-400 uppercase">
                    Aucune salle — la capacité du centre est nulle tant qu&apos;aucune salle n&apos;est créée.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {center.rooms.map((room) => (
                      <div key={room.id} className={cn(
                        'rounded-xl border p-5',
                        room.status === 'FULL' ? 'border-amber-200 bg-amber-50' : room.status === 'MAINTENANCE' ? 'border-slate-200 bg-slate-50' : 'border-blue-100 bg-[#f7f9fc]',
                      )}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-blue-900">{room.code}</span>
                          <span className={cn(
                            'text-[9px] font-bold uppercase px-2 py-0.5 rounded',
                            room.status === 'FULL' ? 'bg-amber-200 text-amber-900' : room.status === 'MAINTENANCE' ? 'bg-slate-200 text-slate-600' : 'bg-green-100 text-green-700',
                          )}>
                            {room.status === 'FULL' ? 'Pleine' : room.status === 'MAINTENANCE' ? 'Indispo.' : 'Dispo.'}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">
                          {room.name}
                          {room.building ? ` • ${room.building}` : ''}
                          {room.floor ? ` • Étage ${room.floor}` : ''}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-blue-900">
                            {room.currentOccupancy} / {room.capacity}
                          </span>
                          <div className="w-16 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                            <div
                              className={cn('h-full', room.currentOccupancy >= room.capacity ? 'bg-red-500' : 'bg-[#1e3a8a]')}
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
                  <form onSubmit={createRoom} className="mt-5 bg-[#f7f9fc] rounded-xl border border-blue-100 p-6 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Code</label>
                      <input required value={roomForm.code} onChange={(e) => setRoomForm({ ...roomForm, code: e.target.value })}
                        placeholder="S-01" className="fed-input-light px-3 py-2.5 font-semibold" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Nom</label>
                      <input value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                        placeholder="Salle 12A" className="fed-input-light px-3 py-2.5 font-semibold" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Capacité</label>
                      <input required type="number" min={1} value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })}
                        placeholder="40" className="fed-input-light px-3 py-2.5 font-semibold" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Bâtiment / Étage</label>
                      <div className="flex gap-2">
                        <input value={roomForm.building} onChange={(e) => setRoomForm({ ...roomForm, building: e.target.value })}
                          placeholder="Bloc A" className="fed-input-light px-3 py-2.5 font-semibold" />
                        <input value={roomForm.floor} onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })}
                          placeholder="1" className="fed-input-light w-16 px-3 py-2.5 font-semibold" />
                      </div>
                    </div>
                    <button type="submit" disabled={busy} className="fed-btn-gold px-5 py-2.5 text-xs disabled:opacity-50">
                      {busy ? '…' : 'Ajouter'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* ⭐ Onglet « Gestion des surveillants » — demande aux écoles, listes
          reçues, répartition par centre/salle et registre des affectations */}
      {tab === 'surveillants' && (
        <FederisSupervisorsTab
          examId={examId}
          examLabel={
            exams.find((e) => e.id === examId)
              ? `${exams.find((e) => e.id === examId)!.code} — ${exams.find((e) => e.id === examId)!.name}`
              : null
          }
          userRole={userRole}
        />
      )}
    </FedPage>
  );
}
