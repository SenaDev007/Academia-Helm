/**
 * ============================================================================
 * MODULE 2 — STRUCTURE ACADÉMIQUE (refonte 2026-11-27, demande promoteur)
 * ============================================================================
 *
 * ⭐ 2026-11-27 — L'onglet « Structure académique » du module Organisation
 *    pédagogique a été ALLÉGÉ : tout ce qui s'y trouvait a été supprimé
 *    (Niveaux, Cycles, Classes, Pistes linguistiques, Séries, duplication
 *    d'année) SAUF le sous-onglet « Salle ». C'est désormais la gestion des
 *    SALLES qui OCCUPE l'onglet Structure académique, sans sous-onglets.
 *
 *    - Les niveaux officiels (Maternelle/Primaire/Secondaire) restent gérés
 *      dans Paramètres → Structure (aucune régression côté backend).
 *    - Les classes officielles / sections physiques restent pilotées par les
 *      flux Inscription et Affectations & Mouvements (module Élève).
 *    - Les APIs /api/pedagogy/academic-structure/* demeurent intactes pour
 *      les consommateurs internes (bulletins, emplois du temps, transferts).
 *
 * Fonctionnalités conservées à l'identique :
 *   - Liste des salles de l'année scolaire active (recherche, type, statut)
 *   - Création / modification / suppression d'une salle
 *   - Assistant multi-salles (suggestions par type, capacité, équipements)
 *   - Description intelligente auto-générée + sélection rapide d'équipements
 * ============================================================================
 */

'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Copy,
  Info,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import BaseModal from '@/components/modules/blueprint/modals/BaseModal';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useModuleContext } from '@/hooks/useModuleContext';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import ResponsiveTableWrapper from '@/components/ui/tables/ResponsiveTableWrapper';

const PRIMARY = '#1A2BA6';
const ACCENT = '#F5A623';

interface RoomRow {
  id: string;
  roomName?: string;
  roomCode?: string;
  roomType?: string;
  capacity?: number | null;
  status?: string;
  equipment?: unknown;
  description?: string | null;
}

function roomDisplayName(r: RoomRow): string {
  return r.roomName ?? r.roomCode ?? '—';
}

function roomTypeDisplay(r: RoomRow): string {
  if (!r.roomType) return '—';
  const mapping: Record<string, string> = {
    CLASSROOM: 'Salle de classe',
    LABORATORY: 'Laboratoire',
    LIBRARY: 'Bibliothèque',
    OFFICE: 'Bureau',
    MEETING_ROOM: 'Salle de réunion',
    SPORTS_HALL: 'Gymnase',
    MULTIPURPOSE: 'Salle polyvalente',
    OTHER: 'Autre',
  };
  return mapping[r.roomType.toUpperCase()] ?? r.roomType;
}

export function AcademicStructureWorkspace() {
  const searchParams = useSearchParams();
  const { user, tenant } = useAppSession();
  const { academicYear } = useModuleContext();
  const yearId = academicYear?.id ?? '';

  /** Aligné Paramètres : PO / admin plateforme peuvent cibler un tenant (URL ?tenant_id=) ; sinon JWT / session. */
  const tenantQuery = useMemo(() => {
    const cross = ['PLATFORM_OWNER', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '');
    const id = cross ? searchParams.get('tenant_id') || tenant?.id : tenant?.id;
    const s = id && String(id).trim();
    return s ? { tenant_id: s } : ({} as Record<string, string>);
  }, [user?.role, searchParams, tenant?.id]);

  const { toast } = useToast();
  const [notice, setNoticeState] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const setNotice = useCallback((val: { type: 'ok' | 'err'; text: string } | null) => {
    setNoticeState(val);
    if (val) {
      toast({
        title: val.type === 'ok' ? 'Succès' : 'Erreur',
        description: val.text,
        variant: val.type === 'ok' ? 'success' : 'destructive',
      });
    }
  }, [toast]);

  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [roomFilters, setRoomFilters] = useState({
    search: '',
    roomType: '',
    status: '',
  });
  const [loading, setLoading] = useState(true);

  const [roomModal, setRoomModal] = useState<
    null | { mode: 'create' } | { mode: 'edit'; room: RoomRow }
  >(null);
  const [roomDeleteTarget, setRoomDeleteTarget] = useState<RoomRow | null>(null);
  const [roomForm, setRoomForm] = useState({
    roomCode: '',
    roomName: '',
    roomType: 'CLASSROOM',
    capacity: '' as string | number,
    status: 'ACTIVE',
    description: '',
    equipmentCsv: '',
  });
  const [isDescriptionManual, setIsDescriptionManual] = useState(false);

  // ─── Assistant création multi-salles ──
  const [bulkRoomModal, setBulkRoomModal] = useState(false);
  const [bulkRoomType, setBulkRoomType] = useState('CLASSROOM');
  const [bulkRoomCapacity, setBulkRoomCapacity] = useState(40);
  const [bulkRoomSaving, setBulkRoomSaving] = useState(false);
  const [bulkRoomSelections, setBulkRoomSelections] = useState<
    Array<{ selected: boolean; roomCode: string; roomName: string; capacity: number; alreadyExists: boolean }>
  >([]);

  // Suggestions de salles par type
  const ROOM_SUGGESTIONS: Record<string, Array<{ code: string; name: string; capacity: number; equipment: string[] }>> = {
    CLASSROOM: [
      { code: 'S01', name: 'Salle de classe 01', capacity: 40, equipment: ['Tableau blanc', 'Prises électriques'] },
      { code: 'S02', name: 'Salle de classe 02', capacity: 40, equipment: ['Tableau blanc', 'Prises électriques'] },
      { code: 'S03', name: 'Salle de classe 03', capacity: 40, equipment: ['Tableau blanc', 'Prises électriques'] },
      { code: 'S04', name: 'Salle de classe 04', capacity: 35, equipment: ['Tableau blanc', 'Prises électriques'] },
      { code: 'S05', name: 'Salle de classe 05', capacity: 35, equipment: ['Tableau blanc', 'Prises électriques'] },
      { code: 'S06', name: 'Salle de classe 06', capacity: 30, equipment: ['Tableau blanc', 'Prises électriques'] },
      { code: 'S07', name: 'Salle de classe 07', capacity: 30, equipment: ['Tableau blanc', 'Prises électriques'] },
      { code: 'S08', name: 'Salle de classe 08', capacity: 25, equipment: ['Tableau blanc', 'Prises électriques'] },
      { code: 'S09', name: 'Salle de classe 09', capacity: 25, equipment: ['Tableau blanc', 'Prises électriques'] },
      { code: 'S10', name: 'Salle de classe 10', capacity: 25, equipment: ['Tableau blanc', 'Prises électriques'] },
    ],
    LABORATORY: [
      { code: 'LAB-SCI', name: 'Laboratoire de Sciences', capacity: 30, equipment: ['Microscopes', 'Verrerie', 'Lavabo', 'Prises électriques'] },
      { code: 'LAB-PHY', name: 'Laboratoire de Physique', capacity: 30, equipment: ['Prises électriques', 'Armoire de rangement'] },
      { code: 'LAB-CHIM', name: 'Laboratoire de Chimie', capacity: 30, equipment: ['Verrerie', 'Lavabo', 'Armoire de rangement'] },
      { code: 'LAB-BIO', name: 'Laboratoire de Biologie', capacity: 30, equipment: ['Microscopes', 'Lavabo'] },
      { code: 'LAB-INFO', name: 'Salle Informatique', capacity: 25, equipment: ['Ordinateurs', 'Wi-Fi', 'Prises électriques', 'Climatisation'] },
    ],
    LIBRARY: [
      { code: 'BIB', name: 'Bibliothèque', capacity: 50, equipment: ['Armoire de rangement', 'Wi-Fi', 'Climatisation'] },
    ],
    OFFICE: [
      { code: 'BUR-DIR', name: 'Bureau Direction', capacity: 5, equipment: ['Climatisation'] },
      { code: 'BUR-SEC', name: 'Bureau Secrétariat', capacity: 5, equipment: ['Climatisation'] },
      { code: 'BUR-PED', name: 'Bureau Pédagogie', capacity: 5, equipment: [] },
      { code: 'BUR-RH', name: 'Bureau RH', capacity: 5, equipment: [] },
    ],
    MEETING_ROOM: [
      { code: 'REU-01', name: 'Salle de réunion 01', capacity: 15, equipment: ['Tableau blanc', 'Vidéoprojecteur'] },
      { code: 'REU-02', name: 'Salle de réunion 02', capacity: 10, equipment: ['Tableau blanc'] },
    ],
    SPORTS_HALL: [
      { code: 'GYM', name: 'Gymnase', capacity: 60, equipment: ['Haut-parleurs'] },
      { code: 'FIT', name: 'Salle de Fitness', capacity: 20, equipment: [] },
    ],
    MULTIPURPOSE: [
      { code: 'POLY-01', name: 'Salle polyvalente 01', capacity: 50, equipment: ['Tableau blanc', 'Vidéoprojecteur', 'Climatisation'] },
      { code: 'POLY-02', name: 'Salle polyvalente 02', capacity: 40, equipment: ['Tableau blanc', 'Vidéoprojecteur'] },
    ],
  };

  const generateRoomSuggestions = useCallback((type: string, existingRooms: RoomRow[]) => {
    const suggestions = ROOM_SUGGESTIONS[type] || [];
    const existingCodes = new Set(existingRooms.map(r => r.roomCode));
    return suggestions.map(s => ({
      selected: !existingCodes.has(s.code),
      roomCode: s.code,
      roomName: s.name,
      capacity: s.capacity,
      alreadyExists: existingCodes.has(s.code),
    }));
  }, []);

  const saveBulkRooms = async () => {
    if (!yearId) return;
    const toCreate = bulkRoomSelections.filter(s => s.selected && !s.alreadyExists);
    if (toCreate.length === 0) {
      setNotice({ type: 'err', text: 'Aucune salle à créer (toutes existent déjà ou désélectionnées).' });
      return;
    }
    setBulkRoomSaving(true);
    let created = 0;
    let failed = 0;
    const typeEquipment = (ROOM_SUGGESTIONS[bulkRoomType] || []).reduce((acc, s) => {
      acc[s.code] = s.equipment || [];
      return acc;
    }, {} as Record<string, string[]>);

    for (const s of toCreate) {
      try {
        await pedagogyFetch('/api/rooms', {
          method: 'POST',
          body: {
            academicYearId: yearId,
            roomCode: s.roomCode.trim(),
            roomName: s.roomName.trim(),
            roomType: bulkRoomType,
            capacity: s.capacity,
            status: 'ACTIVE',
            equipment: typeEquipment[s.roomCode] || [],
          },
        });
        created++;
      } catch (e) {
        console.error(`Failed to create room ${s.roomCode}:`, e);
        failed++;
      }
    }
    setBulkRoomSaving(false);
    setBulkRoomModal(false);
    setBulkRoomSelections([]);
    await loadRooms();
    setNotice({
      type: created > 0 ? 'ok' : 'err',
      text: created > 0
        ? `${created} salle(s) créée(s)${failed > 0 ? `, ${failed} échec(s)` : ''}.`
        : `Échec de la création (${failed} erreur(s)).`,
    });
  };

  const COMMON_EQUIPMENT = useMemo(() => [
    'Tableau blanc',
    'Tableau noir',
    'Vidéoprojecteur',
    'Climatisation',
    'Ordinateurs',
    'Wi-Fi',
    'Microscopes',
    'Verrerie',
    'Prises électriques',
    'Haut-parleurs',
    'Armoire de rangement',
    'Tableau interactif',
    'Lavabo',
  ], []);

  const generateSmartDescription = useCallback((type: string, csv: string): string => {
    const items = csv.split(',')
      .map(i => i.trim())
      .filter(i => i.length > 0);

    let typeLabel = "salle de classe";
    let baseDesc = "";

    switch (type) {
      case 'CLASSROOM':
        typeLabel = "salle de classe";
        baseDesc = "conçue pour accueillir les cours théoriques et les activités d'apprentissage quotidiennes";
        break;
      case 'LABORATORY':
        typeLabel = "laboratoire de sciences";
        baseDesc = "aménagé spécifiquement pour les séances de travaux pratiques (TP) et les expérimentations scientifiques";
        break;
      case 'LIBRARY':
        typeLabel = "bibliothèque";
        baseDesc = "dédiée à la lecture, à la recherche documentaire et au travail individuel des élèves";
        break;
      case 'OFFICE':
        typeLabel = "bureau";
        baseDesc = "destiné au travail administratif et aux réunions de l'équipe pédagogique";
        break;
      case 'MEETING_ROOM':
        typeLabel = "salle de réunion";
        baseDesc = "aménagée pour les réunions du personnel et les concertations pédagogiques";
        break;
      case 'SPORTS_HALL':
        typeLabel = "gymnase";
        baseDesc = "équipée pour les activités sportives et l'éducation physique";
        break;
      case 'MULTIPURPOSE':
        typeLabel = "salle polyvalente";
        baseDesc = "adaptée à divers besoins pédagogiques et activités multidisciplinaires";
        break;
      default:
        typeLabel = "salle polyvalente";
        baseDesc = "adaptée à divers besoins pédagogiques et activités multidisciplinaires";
    }

    if (items.length === 0) {
      return `Cette ${typeLabel} est ${baseDesc}.`;
    }

    let equipmentList = "";
    if (items.length === 1) {
      equipmentList = items[0];
    } else {
      equipmentList = items.slice(0, -1).join(', ') + ' et ' + items[items.length - 1];
    }

    return `Cette ${typeLabel} est ${baseDesc}. Elle est équipée de : ${equipmentList}.`;
  }, []);

  const toggleEquipment = useCallback((item: string) => {
    const currentItems = roomForm.equipmentCsv
      .split(',')
      .map(i => i.trim())
      .filter(i => i.length > 0);

    const lowerItem = item.toLowerCase();
    const existsIdx = currentItems.findIndex(i => i.toLowerCase() === lowerItem);

    let newItems: string[];
    if (existsIdx >= 0) {
      newItems = currentItems.filter((_, idx) => idx !== existsIdx);
    } else {
      newItems = [...currentItems, item];
    }

    const newCsv = newItems.join(', ');

    setRoomForm(prev => {
      const updated = { ...prev, equipmentCsv: newCsv };
      if (!isDescriptionManual) {
        updated.description = generateSmartDescription(prev.roomType, newCsv);
      }
      return updated;
    });
  }, [roomForm.equipmentCsv, isDescriptionManual, generateSmartDescription]);

  const handleRoomTypeChange = useCallback((newType: string) => {
    setRoomForm(prev => {
      const updated = { ...prev, roomType: newType };
      if (!isDescriptionManual) {
        updated.description = generateSmartDescription(newType, prev.equipmentCsv);
      }
      return updated;
    });
  }, [isDescriptionManual, generateSmartDescription]);

  const openRoomModal = useCallback((r: RoomRow) => {
    setIsDescriptionManual(!!r.description);
    setRoomForm({
      roomCode: r.roomCode ?? '',
      roomName: r.roomName ?? '',
      roomType: r.roomType ?? 'CLASSROOM',
      capacity: r.capacity ?? '',
      status: r.status ?? 'ACTIVE',
      description: r.description ?? '',
      equipmentCsv: Array.isArray(r.equipment) ? r.equipment.join(', ') : '',
    });
    setRoomModal({ mode: 'edit', room: r });
  }, []);

  const loadRooms = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({
        academicYearId: yearId,
        ...(tenantQuery.tenant_id ? { tenant_id: tenantQuery.tenant_id } : {}),
        ...(roomFilters.roomType ? { roomType: roomFilters.roomType } : {}),
        ...(roomFilters.status ? { status: roomFilters.status } : {}),
        ...(roomFilters.search.trim() ? { search: roomFilters.search.trim() } : {}),
      }).toString();
      const data = await pedagogyFetch<RoomRow[]>(`/api/rooms?${q}`);
      setRooms(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setRooms([]);
      setNotice({ type: 'err', text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [yearId, tenantQuery, roomFilters.roomType, roomFilters.status, roomFilters.search, setNotice]);

  const saveRoom = async () => {
    if (!yearId) return;
    if (!roomForm.roomCode.trim() || !roomForm.roomName.trim()) {
      setNotice({ type: 'err', text: 'Code et nom de salle requis.' });
      return;
    }
    try {
      const cap =
        roomForm.capacity === '' ? undefined : Math.max(1, Number(roomForm.capacity) || 1);
      const equipment =
        roomForm.equipmentCsv.trim().length > 0
          ? roomForm.equipmentCsv
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
      const body = {
        academicYearId: yearId,
        roomCode: roomForm.roomCode.trim(),
        roomName: roomForm.roomName.trim(),
        roomType: roomForm.roomType,
        capacity: cap,
        status: roomForm.status || 'ACTIVE',
        description: roomForm.description.trim() || undefined,
        equipment,
      };
      if (roomModal?.mode === 'create') {
        await pedagogyFetch('/api/rooms', { method: 'POST', body });
        setNotice({ type: 'ok', text: 'Salle créée.' });
      } else if (roomModal?.mode === 'edit') {
        await pedagogyFetch(`/api/rooms/${roomModal.room.id}`, { method: 'PUT', body });
        setNotice({ type: 'ok', text: 'Salle mise à jour.' });
      }
      setRoomModal(null);
      await loadRooms();
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
    }
  };

  const deleteRoom = async (roomId: string) => {
    try {
      await pedagogyFetch(`/api/rooms/${roomId}`, { method: 'DELETE' });
      setNotice({ type: 'ok', text: 'Salle supprimée.' });
      await loadRooms();
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
    }
  };

  /** Bouton « Ajouter » : ouvre la modale de création d'une salle. */
  const addAction = () => {
    setIsDescriptionManual(false);
    setRoomForm({
      roomCode: '',
      roomName: '',
      roomType: 'CLASSROOM',
      capacity: '',
      status: 'ACTIVE',
      description: generateSmartDescription('CLASSROOM', ''),
      equipmentCsv: '',
    });
    setRoomModal({ mode: 'create' });
  };

  // Charger les salles de l'année scolaire active au montage / changement d'année
  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  /** Retour sur l'onglet navigateur : resynchroniser avec le backend. */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible' || !yearId) return;
      void loadRooms();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [yearId, loadRooms]);

  return (
    <div className="space-y-4">
      {notice && (
        <div
          className={cn(
            'rounded-lg border px-4 py-2 text-sm',
            notice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900',
          )}
        >
          {notice.text}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => setNotice(null)}
          >
            Fermer
          </button>
        </div>
      )}

      {/* ─── En-tête : année active + actions salles ─── */}
      <div
        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        style={{ borderLeftWidth: 4, borderLeftColor: PRIMARY }}
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Année scolaire active
          </p>
          <p className="text-lg font-semibold text-slate-900">{academicYear?.label}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Gestion des salles de l'établissement — codes, types, capacités, équipements et statuts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addAction}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
            style={{ backgroundColor: PRIMARY }}
          >
            <Plus className="h-4 w-4" />
            Ajouter une salle
          </button>
          <button
            type="button"
            onClick={() => {
              setBulkRoomType('CLASSROOM');
              setBulkRoomSelections(generateRoomSuggestions('CLASSROOM', rooms));
              setBulkRoomModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
            style={{ backgroundColor: ACCENT }}
          >
            <Sparkles className="h-4 w-4" />
            Assistant multi-salles
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement…
        </div>
      )}

      {/* ─── Liste des salles ─── */}
      {!loading && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-white p-4 md:flex-row md:items-end md:justify-between">
            <div className="grid w-full grid-cols-1 gap-3 md:max-w-3xl md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Recherche
                </label>
                <input
                  value={roomFilters.search}
                  onChange={(e) =>
                    setRoomFilters((f) => ({ ...f, search: e.target.value }))
                  }
                  placeholder="Code ou nom…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Type
                </label>
                <select
                  value={roomFilters.roomType}
                  onChange={(e) =>
                    setRoomFilters((f) => ({ ...f, roomType: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">Tous</option>
                  <option value="CLASSROOM">Salle de classe</option>
                  <option value="LABORATORY">Laboratoire</option>
                  <option value="LIBRARY">Bibliothèque</option>
                  <option value="OFFICE">Bureau</option>
                  <option value="MEETING_ROOM">Salle de réunion</option>
                  <option value="SPORTS_HALL">Gymnase</option>
                  <option value="MULTIPURPOSE">Salle polyvalente</option>
                  <option value="OTHER">Autre</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Statut
                </label>
                <select
                  value={roomFilters.status}
                  onChange={(e) =>
                    setRoomFilters((f) => ({ ...f, status: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">Tous</option>
                  <option value="ACTIVE">Active</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="UNAVAILABLE">Indisponible</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                onClick={() => {
                  setRoomFilters({ search: '', roomType: '', status: '' });
                  void loadRooms();
                }}
              >
                <Copy className="h-4 w-4" />
                Réinitialiser
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                onClick={() => void loadRooms()}
              >
                <Loader2 className={cn('h-4 w-4', loading ? 'animate-spin' : 'hidden')} />
                Actualiser
              </button>
            </div>
          </div>
          <ResponsiveTableWrapper minWidth="800px">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Salle</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Capacité</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Équipements</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rooms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    <Building2 className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    Aucune salle enregistrée pour cette année scolaire.
                    <br />
                    Utilisez « Ajouter une salle » ou l'assistant multi-salles pour démarrer.
                  </td>
                </tr>
              ) : (
                rooms.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.roomCode ?? '—'}</td>
                    <td className="px-4 py-3 font-medium">{roomDisplayName(r)}</td>
                    <td className="px-4 py-3">{roomTypeDisplay(r)}</td>
                    <td className="px-4 py-3">{r.capacity ?? '—'}</td>
                    <td className="px-4 py-3">{r.status ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {Array.isArray(r.equipment) ? r.equipment.length : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="mr-3 text-sm font-medium hover:underline"
                        style={{ color: PRIMARY }}
                        onClick={() => openRoomModal(r)}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="text-sm font-medium text-amber-700 hover:underline"
                        onClick={() => setRoomDeleteTarget(r)}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </ResponsiveTableWrapper>
        </div>
      )}

      {/* ─── Modal : création / modification d'une salle ─── */}
      <BaseModal
        title={roomModal?.mode === 'edit' ? 'Modifier la salle' : 'Nouvelle salle'}
        isOpen={roomModal != null}
        onClose={() => setRoomModal(null)}
        showContext={false}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRoomModal(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={saveRoom}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: PRIMARY }}
            >
              Enregistrer
            </button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-600">Code</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono"
              value={roomForm.roomCode}
              onChange={(e) => setRoomForm((f) => ({ ...f, roomCode: e.target.value }))}
              placeholder="Ex. S01"
              disabled={roomModal?.mode === 'edit'}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Nom</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={roomForm.roomName}
              onChange={(e) => setRoomForm((f) => ({ ...f, roomName: e.target.value }))}
              placeholder="Ex. Salle 01"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Type</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={roomForm.roomType}
              onChange={(e) => handleRoomTypeChange(e.target.value)}
            >
              <option value="CLASSROOM">Salle de classe</option>
              <option value="LABORATORY">Laboratoire</option>
              <option value="LIBRARY">Bibliothèque</option>
              <option value="OFFICE">Bureau</option>
              <option value="MEETING_ROOM">Salle de réunion</option>
              <option value="SPORTS_HALL">Gymnase</option>
              <option value="MULTIPURPOSE">Salle polyvalente</option>
              <option value="OTHER">Autre</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Statut</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={roomForm.status}
              onChange={(e) => setRoomForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="ACTIVE">Active</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="UNAVAILABLE">Indisponible</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Capacité (optionnel)</span>
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={roomForm.capacity}
              onChange={(e) => setRoomForm((f) => ({ ...f, capacity: e.target.value }))}
            />
          </label>
          <div className="block text-sm sm:col-span-2">
            <span className="text-slate-600 font-medium">Équipements</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
              value={roomForm.equipmentCsv}
              onChange={(e) => {
                setRoomForm((f) => {
                  const updated = { ...f, equipmentCsv: e.target.value };
                  if (!isDescriptionManual) {
                    updated.description = generateSmartDescription(f.roomType, e.target.value);
                  }
                  return updated;
                });
              }}
              placeholder="Ex. Tableau, Projecteur, Climatisation"
            />
            <div className="mt-2">
              <span className="text-xs text-slate-500 block mb-1.5 font-semibold">Sélection rapide :</span>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_EQUIPMENT.map((eq) => {
                  const isActive = roomForm.equipmentCsv
                    .split(',')
                    .map(i => i.trim().toLowerCase())
                    .includes(eq.toLowerCase());
                  return (
                    <button
                      key={eq}
                      type="button"
                      onClick={() => toggleEquipment(eq)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-200 active:scale-95",
                        isActive
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300"
                      )}
                    >
                      {eq}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="block text-sm sm:col-span-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-600 font-medium">Description (optionnel)</span>
              <button
                type="button"
                onClick={() => {
                  setIsDescriptionManual(false);
                  setRoomForm(prev => ({
                    ...prev,
                    description: generateSmartDescription(prev.roomType, prev.equipmentCsv)
                  }));
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 transition-all"
                title="Régénérer la description automatique"
              >
                ✨ Régénérer
              </button>
            </div>
            <textarea
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
              rows={3}
              value={roomForm.description}
              onChange={(e) => {
                setIsDescriptionManual(true);
                setRoomForm((f) => ({ ...f, description: e.target.value }));
              }}
              placeholder="Notes internes (localisation, contraintes, etc.)"
            />
          </div>
          <p className="text-xs text-slate-500 sm:col-span-2">
            Les salles sont filtrées sur l'année scolaire active.
          </p>
        </div>
      </BaseModal>

      {/* ─── Modal : Assistant création multi-salles ─── */}
      <BaseModal
        title="Assistant de création multi-salles"
        isOpen={bulkRoomModal}
        onClose={() => setBulkRoomModal(false)}
        showContext={false}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setBulkRoomModal(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={saveBulkRooms}
              disabled={bulkRoomSaving || bulkRoomSelections.filter(s => s.selected).length === 0}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: PRIMARY }}
            >
              {bulkRoomSaving ? 'Création...' : `Créer ${bulkRoomSelections.filter(s => s.selected).length} salle(s)`}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex gap-2">
            <Info className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-600">
              Sélectionnez un type de salle, puis choisissez les salles à créer parmi les suggestions.
              Vous pouvez ajuster le code, le nom et la capacité de chaque salle avant création.
            </p>
          </div>

          {/* Type de salle */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Type de salle</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'CLASSROOM', label: 'Salle de classe' },
                { value: 'LABORATORY', label: 'Laboratoire' },
                { value: 'LIBRARY', label: 'Bibliothèque' },
                { value: 'OFFICE', label: 'Bureau' },
                { value: 'MEETING_ROOM', label: 'Salle de réunion' },
                { value: 'SPORTS_HALL', label: 'Gymnase' },
                { value: 'MULTIPURPOSE', label: 'Salle polyvalente' },
              ].map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setBulkRoomType(t.value);
                    setBulkRoomSelections(generateRoomSuggestions(t.value, rooms));
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition',
                    bulkRoomType === t.value
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Capacité par défaut */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Capacité par défaut</label>
            <input
              type="number"
              min={1}
              value={bulkRoomCapacity}
              onChange={(e) => {
                const cap = Math.max(1, Number(e.target.value) || 1);
                setBulkRoomCapacity(cap);
                setBulkRoomSelections(prev => prev.map(s => ({ ...s, capacity: cap })));
              }}
              className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            />
          </div>

          {/* Sélection rapide */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBulkRoomSelections(prev => prev.map(s => ({ ...s, selected: true })))}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 hover:underline"
            >
              Tout sélectionner
            </button>
            <button
              type="button"
              onClick={() => setBulkRoomSelections(prev => prev.map(s => ({ ...s, selected: false })))}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 hover:underline"
            >
              Tout désélectionner
            </button>
          </div>

          {/* Liste des suggestions */}
          <div className="bg-slate-50 rounded-lg p-3 max-h-80 overflow-y-auto space-y-2 border border-slate-200">
            {bulkRoomSelections.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                Sélectionnez un type de salle pour voir les suggestions.
              </p>
            ) : (
              bulkRoomSelections.map((s, i) => (
                <div key={i} className={cn(
                  'flex items-center gap-3 p-2 rounded-lg transition border',
                  s.selected ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-transparent opacity-60'
                )}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300"
                    style={{ color: PRIMARY }}
                    checked={s.selected}
                    onChange={(e) => setBulkRoomSelections(prev => prev.map((p, idx) => idx === i ? { ...p, selected: e.target.checked } : p))}
                  />
                  <input
                    type="text"
                    value={s.roomCode}
                    onChange={(e) => setBulkRoomSelections(prev => prev.map((p, idx) => idx === i ? { ...p, roomCode: e.target.value } : p))}
                    className="w-20 rounded border border-slate-200 px-2 py-1 text-xs font-mono"
                    placeholder="Code"
                  />
                  <input
                    type="text"
                    value={s.roomName}
                    onChange={(e) => setBulkRoomSelections(prev => prev.map((p, idx) => idx === i ? { ...p, roomName: e.target.value } : p))}
                    className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
                    placeholder="Nom"
                  />
                  <input
                    type="number"
                    min={1}
                    value={s.capacity}
                    onChange={(e) => setBulkRoomSelections(prev => prev.map((p, idx) => idx === i ? { ...p, capacity: Math.max(1, Number(e.target.value) || 1) } : p))}
                    className="w-16 rounded border border-slate-200 px-2 py-1 text-xs"
                    placeholder="Cap."
                  />
                  {s.alreadyExists && (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      Existe
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          <p className="text-xs text-slate-500">
            Les salles déjà existantes (même code) sont marquées "Existe" et seront ignorées lors de la création.
          </p>
        </div>
      </BaseModal>

      {/* ═══ MODAL CONFIRMATION SUPPRESSION SALLE ═══ */}
      {roomDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900">Supprimer la salle</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Confirmez-vous la suppression de la salle{' '}
                    <strong className="text-slate-900">{roomDisplayName(roomDeleteTarget)}</strong>
                    {roomDeleteTarget.roomCode ? (
                      <> (code : <strong>{roomDeleteTarget.roomCode}</strong>)</>
                    ) : null} ?
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    Cette action est irréversible.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRoomDeleteTarget(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteRoom(roomDeleteTarget.id);
                  setRoomDeleteTarget(null);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow-md transition"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
