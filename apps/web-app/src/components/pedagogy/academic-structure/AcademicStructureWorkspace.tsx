/**
 * ============================================================================
 * MODULE 2 — GESTION DE SALLE (refonte professionnelle 2026-11-27)
 * ============================================================================
 *
 * ⭐ 2026-11-27 (retour promoteur) — l'onglet « Structure académique » est
 *    renommé « Gestion de salle » et couvre désormais TOUTES les
 *    fonctionnalités attendues d'une gestion de salles professionnelle :
 *
 *    1. INVENTAIRE COMPLET — liste des salles de l'année active avec
 *       recherche, filtres type / statut / niveau scolaire, badges de statut
 *       colorés, équipements en chips et indicateurs (KPIs) en tête de page ;
 *    2. CRUD SALLE — création / modification / suppression (code unique,
 *       type, capacité, statut, niveau scolaire, équipements, description
 *       intelligente auto-générée) ;
 *    3. ASSISTANT MULTI-SALLES — création en lot par suggestions de type ;
 *    4. AFFECTATION DES CLASSES — vue 360° par salle : classes officielles
 *       affectées (professeur principal, effectif), affectation / libération
 *       en un clic ;
 *    5. EMPLOI DU TEMPS DE LA SALLE — créneaux réels (TimetableEntry) par
 *       jour : classe, matière, enseignant, horaires ;
 *    6. MAINTENANCE — mise en maintenance immédiate (motif), maintenance
 *       planifiée (dates + motif), réactivation (clôture + historique
 *       conservé) ;
 *    7. EXPORT CSV — inventaire complet exportable (Excel/FR).
 *
 *    Les niveaux officiels restent gérés dans Paramètres → Structure ; les
 *    classes officielles dans Inscription / Affectations (module Élève) —
 *    cet onglet CONSULTE ces données et y rattache les salles.
 * ============================================================================
 */

'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarClock,
  DoorOpen,
  Download,
  Info,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import BaseModal from '@/components/modules/blueprint/modals/BaseModal';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useModuleContext } from '@/hooks/useModuleContext';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import ResponsiveTableWrapper from '@/components/ui/tables/ResponsiveTableWrapper';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RoomRow {
  id: string;
  roomName?: string;
  roomCode?: string;
  roomType?: string;
  capacity?: number | null;
  status?: string;
  equipment?: unknown;
  description?: string | null;
  schoolLevelId?: string | null;
  schoolLevel?: { id: string; code: string; name: string; label?: string | null } | null;
}

interface SchoolLevelOption {
  id: string;
  code: string;
  name: string;
  label?: string;
}

interface ClassRow {
  id: string;
  name: string;
  code?: string;
  capacity?: number | null;
  roomId?: string | null;
  level?: { id: string; name: string } | null;
  mainTeacher?: { firstName: string; lastName: string } | null;
}

interface MaintenanceRow {
  id: string;
  reason: string;
  startDate: string;
  endDate?: string | null;
  isActive?: boolean;
}

interface TimetableSlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  class?: { name: string } | null;
  subject?: { name: string } | null;
  teacher?: { firstName: string; lastName: string } | null;
}

interface RoomDetailData {
  room: RoomRow;
  classes: ClassRow[];
  timetable: TimetableSlot[];
  activeMaintenances: MaintenanceRow[];
  pastMaintenances: MaintenanceRow[];
  stats: {
    assignedClasses: number;
    weeklySlots: number;
    totalStudents: number;
    inMaintenance: boolean;
  };
}

// ─── Constantes ─────────────────────────────────────────────────────────────

const ROOM_TYPES: Record<string, string> = {
  CLASSROOM: 'Salle de classe',
  LABORATORY: 'Laboratoire',
  LIBRARY: 'Bibliothèque',
  OFFICE: 'Bureau',
  MEETING_ROOM: 'Salle de réunion',
  SPORTS_HALL: 'Gymnase',
  MULTIPURPOSE: 'Salle polyvalente',
  OTHER: 'Autre',
};

const DAYS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 7, label: 'Dimanche' },
];

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  MAINTENANCE: { label: 'Maintenance', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  UNAVAILABLE: { label: 'Indisponible', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function roomDisplayName(r: RoomRow): string {
  return r.roomName ?? r.roomCode ?? '—';
}

function roomTypeDisplay(r: RoomRow): string {
  if (!r.roomType) return '—';
  return ROOM_TYPES[r.roomType.toUpperCase()] ?? r.roomType;
}

function roomEquipment(r: RoomRow): string[] {
  return Array.isArray(r.equipment) ? (r.equipment as string[]) : [];
}

function levelDisplay(r: RoomRow): string {
  return r.schoolLevel?.label || r.schoolLevel?.name || '';
}

function formatDateTime(v?: string | null): string {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

// ─── Composant ──────────────────────────────────────────────────────────────

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
  const [schoolLevels, setSchoolLevels] = useState<SchoolLevelOption[]>([]);
  const [allClasses, setAllClasses] = useState<ClassRow[]>([]);
  const [roomFilters, setRoomFilters] = useState({
    search: '',
    roomType: '',
    status: '',
    schoolLevelId: '',
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
    schoolLevelId: '',
    description: '',
    equipmentCsv: '',
  });
  const [isDescriptionManual, setIsDescriptionManual] = useState(false);

  // ─── Vue détaillée d'une salle (360°) ──
  const [detailTarget, setDetailTarget] = useState<RoomRow | null>(null);
  const [detailData, setDetailData] = useState<RoomDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [assignClassId, setAssignClassId] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);
  const [maintForm, setMaintForm] = useState({ reason: '', startDate: '', endDate: '' });
  const [maintSaving, setMaintSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);

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
      schoolLevelId: r.schoolLevelId ?? r.schoolLevel?.id ?? '',
      description: r.description ?? '',
      equipmentCsv: roomEquipment(r).join(', '),
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

  /** Niveaux scolaires actifs (filtre + formulaire salle). */
  const loadSchoolLevels = useCallback(async () => {
    try {
      const res = await fetch('/api/school-levels', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data?.items ?? []);
      setSchoolLevels(
        list
          .filter((l: any) => l && l.id && l.id !== 'ALL' && l.isActive !== false)
          .map((l: any) => ({ id: l.id, code: l.code || '', name: l.name || '', label: l.label })),
      );
    } catch {
      /* non bloquant */
    }
  }, []);

  /** Classes officielles actives de l'année (pour l'affectation salle ↔ classe). */
  const loadClasses = useCallback(async () => {
    if (!yearId) return;
    try {
      const data = await pedagogyFetch<ClassRow[]>(
        `/api/pedagogy/academic-structure/classes?academicYearId=${encodeURIComponent(yearId)}`,
      );
      setAllClasses(Array.isArray(data) ? data : []);
    } catch {
      setAllClasses([]);
    }
  }, [yearId]);

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
        // ⭐ Niveau scolaire : chaîne vide → null (salle non rattachée à un niveau)
        schoolLevelId: roomForm.schoolLevelId || null,
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
      schoolLevelId: '',
      description: generateSmartDescription('CLASSROOM', ''),
      equipmentCsv: '',
    });
    setRoomModal({ mode: 'create' });
  };

  // ─── Vue 360° : chargement du détail d'une salle ──
  const openDetail = useCallback(async (r: RoomRow) => {
    setDetailTarget(r);
    setDetailData(null);
    setAssignClassId('');
    setMaintForm({ reason: '', startDate: '', endDate: '' });
    setDetailLoading(true);
    try {
      const q = new URLSearchParams({
        ...(yearId ? { academicYearId: yearId } : {}),
        ...(tenantQuery.tenant_id ? { tenant_id: tenantQuery.tenant_id } : {}),
      }).toString();
      const data = await pedagogyFetch<RoomDetailData>(`/api/rooms/${r.id}/detail${q ? `?${q}` : ''}`);
      setDetailData(data);
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
      setDetailTarget(null);
    } finally {
      setDetailLoading(false);
    }
  }, [yearId, tenantQuery, setNotice]);

  const refreshDetail = useCallback(async () => {
    if (!detailTarget) return;
    try {
      const q = new URLSearchParams({
        ...(yearId ? { academicYearId: yearId } : {}),
        ...(tenantQuery.tenant_id ? { tenant_id: tenantQuery.tenant_id } : {}),
      }).toString();
      const data = await pedagogyFetch<RoomDetailData>(`/api/rooms/${detailTarget.id}/detail${q ? `?${q}` : ''}`);
      setDetailData(data);
      setDetailTarget(data?.room ?? detailTarget);
    } catch {
      /* silencieux */
    }
  }, [detailTarget, yearId, tenantQuery]);

  /** Affecte (ou libère — roomId null) une classe officielle sur la salle. */
  const assignClass = async (classId: string, roomId: string | null) => {
    if (!classId && roomId !== null) return;
    setAssignSaving(true);
    try {
      await pedagogyFetch(
        `/api/pedagogy/academic-structure/classes/${classId}`,
        { method: 'PUT', body: { roomId } },
      );
      const cls = allClasses.find(c => c.id === classId);
      setNotice({
        type: 'ok',
        text: roomId
          ? `Classe ${cls?.name ?? ''} affectée à la salle.`
          : `Classe ${cls?.name ?? ''} libérée de la salle.`,
      });
      setAssignClassId('');
      await Promise.all([refreshDetail(), loadRooms(), loadClasses()]);
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
    } finally {
      setAssignSaving(false);
    }
  };

  /** Déclare une maintenance (immédiate si début ≤ aujourd'hui, sinon planifiée). */
  const declareMaintenance = async () => {
    if (!detailTarget) return;
    if (!maintForm.reason.trim() || !maintForm.startDate) {
      setNotice({ type: 'err', text: 'Motif et date de début requis.' });
      return;
    }
    setMaintSaving(true);
    try {
      await pedagogyFetch('/api/rooms/maintenances', {
        method: 'POST',
        body: {
          roomId: detailTarget.id,
          startDate: new Date(maintForm.startDate).toISOString(),
          endDate: maintForm.endDate ? new Date(maintForm.endDate).toISOString() : undefined,
          reason: maintForm.reason.trim(),
        },
      });
      // Début aujourd'hui ou passé → la salle passe immédiatement en maintenance
      const startsNow = new Date(maintForm.startDate) <= new Date(new Date().toDateString());
      if (startsNow) {
        await pedagogyFetch(`/api/rooms/${detailTarget.id}/maintenance`, {
          method: 'POST',
          body: { reason: maintForm.reason.trim() },
        });
      }
      setMaintForm({ reason: '', startDate: '', endDate: '' });
      setNotice({ type: 'ok', text: startsNow ? 'Salle mise en maintenance.' : 'Maintenance planifiée enregistrée.' });
      await Promise.all([refreshDetail(), loadRooms()]);
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
    } finally {
      setMaintSaving(false);
    }
  };

  /** Réactive une salle après maintenance. */
  const restoreRoom = async () => {
    if (!detailTarget) return;
    setRestoring(true);
    try {
      await pedagogyFetch(`/api/rooms/${detailTarget.id}/restore`, { method: 'PUT' });
      setNotice({ type: 'ok', text: 'Salle réactivée (maintenance clôturée).' });
      await Promise.all([refreshDetail(), loadRooms()]);
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
    } finally {
      setRestoring(false);
    }
  };

  /** Export CSV de l'inventaire des salles (séparateur « ; » — Excel FR). */
  const exportCsv = () => {
    const header = ['Code', 'Salle', 'Type', 'Capacité', 'Statut', 'Niveau', 'Équipements', 'Description'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = rooms.map(r => [
      r.roomCode ?? '',
      roomDisplayName(r),
      roomTypeDisplay(r),
      r.capacity ?? '',
      STATUS_BADGES[r.status ?? '']?.label ?? r.status ?? '',
      levelDisplay(r),
      roomEquipment(r).join(' | '),
      r.description ?? '',
    ].map(esc).join(';'));
    const csv = '\uFEFF' + header.map(esc).join(';') + '\r\n' + rows.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salles_${(academicYear?.label || yearId || 'export').replace(/[^\w-]+/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotice({ type: 'ok', text: `${rooms.length} salle(s) exportée(s) en CSV.` });
  };

  // Charger salles + niveaux + classes au montage / changement d'année
  useEffect(() => {
    loadRooms();
  }, [loadRooms]);
  useEffect(() => {
    loadSchoolLevels();
  }, [loadSchoolLevels]);
  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  /** Retour sur l'onglet navigateur : resynchroniser avec le backend. */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible' || !yearId) return;
      void loadRooms();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [yearId, loadRooms]);

  // ─── KPIs calculés ──
  const kpis = useMemo(() => {
    const active = rooms.filter(r => (r.status ?? 'ACTIVE') === 'ACTIVE').length;
    const maintenance = rooms.filter(r => r.status === 'MAINTENANCE').length;
    const unavailable = rooms.filter(r => r.status === 'UNAVAILABLE').length;
    const totalCapacity = rooms.reduce((s, r) => s + (r.capacity || 0), 0);
    return { total: rooms.length, active, maintenance, unavailable, totalCapacity };
  }, [rooms]);

  /** EDT groupé par jour (détail salle). */
  const timetableByDay = useMemo(() => {
    if (!detailData?.timetable) return [] as Array<{ day: number; slots: TimetableSlot[] }>;
    const map = new Map<number, TimetableSlot[]>();
    for (const t of detailData.timetable) {
      const list = map.get(t.dayOfWeek) ?? [];
      list.push(t);
      map.set(t.dayOfWeek, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([day, slots]) => ({ day, slots }));
  }, [detailData]);

  /** Classes disponibles pour affectation (non affectées ailleurs). */
  const assignableClasses = useMemo(
    () => allClasses.filter(c => !c.roomId || c.roomId === detailTarget?.id),
    [allClasses, detailTarget],
  );

  // ═══════════════════════════════════ RENDU ═══════════════════════════════

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
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Année scolaire active
          </p>
          <p className="text-lg font-semibold text-slate-900">{academicYear?.label}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Gestion professionnelle des salles — inventaire, affectation des classes, emploi du temps et maintenance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addAction}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
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
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-amber-600"
          >
            <Sparkles className="h-4 w-4" />
            Assistant multi-salles
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={rooms.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* ─── KPIs ─── */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: 'Total salles', value: kpis.total, icon: Building2, cls: 'bg-blue-50 text-blue-700 border-blue-100' },
            { label: 'Actives', value: kpis.active, icon: DoorOpen, cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
            { label: 'En maintenance', value: kpis.maintenance, icon: Wrench, cls: 'bg-amber-50 text-amber-700 border-amber-100' },
            { label: 'Indisponibles', value: kpis.unavailable, icon: X, cls: 'bg-slate-100 text-slate-600 border-slate-200' },
            { label: 'Capacité totale', value: kpis.totalCapacity, icon: Users, cls: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
          ].map(k => (
            <div key={k.label} className={cn('flex items-center gap-3 rounded-xl border p-3', k.cls)}>
              <k.icon className="h-6 w-6 shrink-0" />
              <div className="min-w-0">
                <p className="text-xl font-bold leading-tight">{kpis.total === 0 && k.label === 'Capacité totale' ? '—' : k.value}</p>
                <p className="truncate text-[11px] font-semibold uppercase tracking-wide opacity-80">{k.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

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
            <div className="grid w-full grid-cols-1 gap-3 md:max-w-4xl md:grid-cols-4">
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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Tous</option>
                  {Object.entries(ROOM_TYPES).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Tous</option>
                  <option value="ACTIVE">Active</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="UNAVAILABLE">Indisponible</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Niveau
                </label>
                <select
                  value={roomFilters.schoolLevelId}
                  onChange={(e) =>
                    setRoomFilters((f) => ({ ...f, schoolLevelId: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Tous</option>
                  {schoolLevels.map(l => (
                    <option key={l.id} value={l.id}>{l.label || l.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                onClick={() => {
                  setRoomFilters({ search: '', roomType: '', status: '', schoolLevelId: '' });
                  void loadRooms();
                }}
              >
                Réinitialiser
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                onClick={() => void loadRooms()}
              >
                <Loader2 className={cn('h-4 w-4', loading ? 'animate-spin' : 'hidden')} />
                Actualiser
              </button>
            </div>
          </div>

          {/* ⭐ Filtre niveau appliqué côté client (le backend filtre par
              schoolLevelId transmis en query — on complète ici pour couvrir
              les réponses sans le filtre appliqué). */}
          <ResponsiveTableWrapper minWidth="980px">
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
                rooms
                  .filter(r => !roomFilters.schoolLevelId || r.schoolLevelId === roomFilters.schoolLevelId)
                  .map((r) => {
                  const equip = roomEquipment(r);
                  const badge = STATUS_BADGES[r.status ?? 'ACTIVE'] ?? { label: r.status ?? '—', className: 'bg-slate-100 text-slate-600 border-slate-200' };
                  return (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.roomCode ?? '—'}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{roomDisplayName(r)}</p>
                      {levelDisplay(r) && (
                        <span className="mt-0.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          {levelDisplay(r)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                        {roomTypeDisplay(r)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{r.capacity ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold', badge.className)}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {equip.length === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <div className="flex max-w-[220px] flex-wrap gap-1">
                          {equip.slice(0, 3).map(e => (
                            <span key={e} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{e}</span>
                          ))}
                          {equip.length > 3 && (
                            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">+{equip.length - 3}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="mr-3 text-sm font-medium text-blue-700 hover:underline"
                        onClick={() => void openDetail(r)}
                      >
                        Détail
                      </button>
                      <button
                        type="button"
                        className="mr-3 text-sm font-medium hover:underline text-slate-600"
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
                  );
                })
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
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
              {Object.entries(ROOM_TYPES).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
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
          <label className="block text-sm">
            <span className="text-slate-600">Niveau scolaire (optionnel)</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={roomForm.schoolLevelId}
              onChange={(e) => setRoomForm((f) => ({ ...f, schoolLevelId: e.target.value }))}
            >
              <option value="">Aucun / tous niveaux</option>
              {schoolLevels.map(l => (
                <option key={l.id} value={l.id}>{l.label || l.name}</option>
              ))}
            </select>
          </label>
          <div className="block text-sm sm:col-span-2">
            <span className="text-slate-600 font-medium">Équipements</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
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
                          ? "bg-blue-600 border-blue-600 text-white shadow-sm"
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
                className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 transition-all"
                title="Régénérer la description automatique"
              >
                ✨ Régénérer
              </button>
            </div>
            <textarea
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
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

      {/* ═══ MODAL DÉTAIL SALLE (360°) ═══ */}
      <BaseModal
        title={`Salle ${detailTarget ? roomDisplayName(detailTarget) : ''}`}
        isOpen={detailTarget != null}
        onClose={() => { setDetailTarget(null); setDetailData(null); }}
        showContext={false}
        size="xl"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            {detailData?.stats.inMaintenance && (
              <button
                type="button"
                onClick={() => void restoreRoom()}
                disabled={restoring}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <DoorOpen className="h-4 w-4" />}
                Réactiver la salle
              </button>
            )}
            <button
              type="button"
              onClick={() => { setDetailTarget(null); setDetailData(null); }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
            >
              Fermer
            </button>
          </div>
        }
      >
        {detailLoading || !detailData ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement du détail…
          </div>
        ) : (
          <div className="space-y-5">
            {/* ——— Résumé ——— */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { l: 'Type', v: roomTypeDisplay(detailData.room) },
                { l: 'Capacité', v: detailData.room.capacity ?? '—' },
                { l: 'Niveau', v: levelDisplay(detailData.room) || 'Tous' },
                { l: 'Statut', v: STATUS_BADGES[detailData.room.status ?? 'ACTIVE']?.label ?? detailData.room.status ?? '—' },
              ].map(x => (
                <div key={x.l} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{x.l}</p>
                  <p className="text-sm font-semibold text-slate-800">{x.v}</p>
                </div>
              ))}
            </div>
            {roomEquipment(detailData.room).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {roomEquipment(detailData.room).map(e => (
                  <span key={e} className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">{e}</span>
                ))}
              </div>
            )}
            {detailData.room.description && (
              <p className="rounded-lg border border-slate-100 bg-white p-2.5 text-xs text-slate-600">{detailData.room.description}</p>
            )}

            {/* ——— Maintenance ——— */}
            <section className="rounded-xl border border-slate-200">
              <header className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                <Wrench className="h-4 w-4 text-amber-600" />
                <h4 className="text-sm font-bold text-slate-800">Maintenance</h4>
                {detailData.stats.inMaintenance && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    En maintenance
                  </span>
                )}
              </header>
              <div className="space-y-3 p-3">
                {detailData.activeMaintenances.length > 0 && (
                  <div className="space-y-1.5">
                    {detailData.activeMaintenances.map(m => (
                      <div key={m.id} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                        <p className="font-semibold">{m.reason}</p>
                        <p className="opacity-80">
                          Depuis le {formatDateTime(m.startDate)}
                          {m.endDate ? ` — prévue jusqu'au ${formatDateTime(m.endDate)}` : ' — en cours'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {/* Déclarer une maintenance */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Déclarer une maintenance</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      type="text"
                      placeholder="Motif (ex. réparation climatisation)"
                      value={maintForm.reason}
                      onChange={(e) => setMaintForm(f => ({ ...f, reason: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm sm:col-span-3"
                    />
                    <label className="text-xs text-slate-500">
                      Début
                      <input
                        type="date"
                        value={maintForm.startDate}
                        onChange={(e) => setMaintForm(f => ({ ...f, startDate: e.target.value }))}
                        className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                      />
                    </label>
                    <label className="text-xs text-slate-500">
                      Fin (optionnel)
                      <input
                        type="date"
                        value={maintForm.endDate}
                        onChange={(e) => setMaintForm(f => ({ ...f, endDate: e.target.value }))}
                        className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                      />
                    </label>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => void declareMaintenance()}
                        disabled={maintSaving}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                      >
                        {maintSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
                        Enregistrer
                      </button>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-400">
                    Un début aujourd'hui ou passé bascule immédiatement la salle en maintenance (les réservations futures sont annulées).
                  </p>
                </div>
                {/* Historique */}
                {detailData.pastMaintenances.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Historique</p>
                    <ul className="space-y-1">
                      {detailData.pastMaintenances.map(m => (
                        <li key={m.id} className="flex items-baseline justify-between gap-2 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">
                          <span className="font-medium text-slate-700">{m.reason}</span>
                          <span className="shrink-0 opacity-70">
                            {formatDateTime(m.startDate)} → {m.endDate ? formatDateTime(m.endDate) : '—'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>

            {/* ——— Classes affectées ——— */}
            <section className="rounded-xl border border-slate-200">
              <header className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                <Users className="h-4 w-4 text-blue-600" />
                <h4 className="text-sm font-bold text-slate-800">Classes affectées</h4>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                  {detailData.stats.assignedClasses} classe(s) · {detailData.stats.totalStudents} élèves
                </span>
              </header>
              <div className="space-y-2 p-3">
                {detailData.classes.length === 0 ? (
                  <p className="text-xs text-slate-500">Aucune classe affectée à cette salle.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {detailData.classes.map(c => (
                      <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800">
                            {c.name}
                            {c.level?.name && <span className="ml-1.5 text-[11px] font-medium text-slate-500">({c.level.name})</span>}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {c.capacity ? `${c.capacity} places` : 'Capacité non définie'}
                            {c.mainTeacher ? ` · Prof. principal : ${c.mainTeacher.firstName} ${c.mainTeacher.lastName}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void assignClass(c.id, null)}
                          disabled={assignSaving}
                          className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-red-200 hover:text-red-600 disabled:opacity-50"
                        >
                          Libérer
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {/* Affecter une classe */}
                <div className="flex items-end gap-2">
                  <label className="flex-1 text-xs text-slate-500">
                    Affecter une classe à cette salle
                    <select
                      value={assignClassId}
                      onChange={(e) => setAssignClassId(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                    >
                      <option value="">Choisir une classe…</option>
                      {assignableClasses.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.level?.name ? ` (${c.level.name})` : ''}
                          {c.roomId === detailTarget?.id ? ' — déjà affectée' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => assignClassId && void assignClass(assignClassId, detailTarget!.id)}
                    disabled={!assignClassId || assignSaving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {assignSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Affecter
                  </button>
                </div>
              </div>
            </section>

            {/* ——— Emploi du temps de la salle ——— */}
            <section className="rounded-xl border border-slate-200">
              <header className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                <CalendarClock className="h-4 w-4 text-indigo-600" />
                <h4 className="text-sm font-bold text-slate-800">Emploi du temps de la salle</h4>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                  {detailData.stats.weeklySlots} créneau(x)/semaine
                </span>
              </header>
              <div className="p-3">
                {timetableByDay.length === 0 ? (
                  <p className="text-xs text-slate-500">Aucun cours programmé dans cette salle (emploi du temps).</p>
                ) : (
                  <div className="space-y-2">
                    {timetableByDay.map(({ day, slots }) => (
                      <div key={day}>
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-indigo-700">
                          {DAYS.find(d => d.value === day)?.label ?? `Jour ${day}`}
                        </p>
                        <ul className="space-y-1">
                          {slots.map(s => (
                            <li key={s.id} className="flex flex-wrap items-baseline gap-x-2 rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
                              <span className="font-mono font-semibold text-slate-800">{s.startTime}–{s.endTime}</span>
                              {s.class?.name && <span className="font-semibold">{s.class.name}</span>}
                              {s.subject?.name && <span className="text-slate-500">· {s.subject.name}</span>}
                              {s.teacher && <span className="text-slate-400">· {s.teacher.firstName} {s.teacher.lastName}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
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
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
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
              {Object.entries(ROOM_TYPES).filter(([v]) => v !== 'OTHER').map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setBulkRoomType(value);
                    setBulkRoomSelections(generateRoomSuggestions(value, rooms));
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition',
                    bulkRoomType === value
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'
                  )}
                >
                  {label}
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
                    Cette action est irréversible. Les classes affectées seront libérées et les
                    créneaux d'emploi du temps détachés.
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
