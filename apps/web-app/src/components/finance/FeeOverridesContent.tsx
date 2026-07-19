'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Search, User, Pencil, ChevronLeft, ChevronRight, MoreHorizontal, CheckSquare, Square, Upload } from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { financeService } from '@/services/finance.service';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import { formatCurrency, cn } from '@/lib/utils';
import FeeOverrideModal from './FeeOverrideModal';
import ImportOverridesModal from './ImportOverridesModal';

const FEE_TYPES = [
  { value: 'INSCRIPTION', label: 'Inscription' },
  { value: 'REINSCRIPTION', label: 'Réinscription' },
  { value: 'TUITION', label: 'Scolarité' },
  { value: 'CANTEEN', label: 'Cantine' },
  { value: 'EXAMEN', label: "Frais d'examen" },
  { value: 'OTHER', label: 'Autre' },
];

const feeTypeLabel = (t: string) => FEE_TYPES.find((f) => f.value === t)?.label ?? t;

function classOrder(name: string): number {
  const n = (name || '').trim().toUpperCase();
  if (n === 'MATERNELLE 1' || n === 'M1') return 0;
  if (n === 'MATERNELLE 2' || n === 'M2') return 1;
  if (n === 'CI') return 10;
  if (n === 'CP') return 11;
  if (n === 'CE1') return 12;
  if (n === 'CE2') return 13;
  if (n === 'CM1') return 14;
  if (n === 'CM2') return 15;
  if (n === '6E' || n === '6ÈME') return 20;
  if (n === '5E' || n === '5ÈME') return 21;
  if (n === '4E' || n === '4ÈME') return 22;
  if (n === '3E' || n === '3ÈME') return 23;
  if (n === '2NDE') return 24;
  if (n === '1ERE' || n === '1ÈRE') return 25;
  if (n === 'TERMINALE' || n === 'TLE') return 26;
  return 100 + (name.charCodeAt(0) || 0);
}

// Helper : nom intelligent du frais (enrichi avec la classe si manquante)
function feeDisplayName(s: any): string {
  const baseName = s.name ?? '';
  if (!s.classId) return baseName;
  const className = s.class?.name;
  if (!className) return baseName;
  if (baseName.includes(className)) return baseName;
  return `${baseName} — ${className}`;
}

export default function FeeOverridesContent() {
  const confirmDialog = useConfirmDialog();
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [overrides, setOverrides] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLevelId, setFilterLevelId] = useState('');
  const [filterClassId, setFilterClassId] = useState('');
  const [filterFeeType, setFilterFeeType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOverride, setModalOverride] = useState(false);
  const [editingOverride, setEditingOverride] = useState<any | null>(null);
  const [modalImport, setModalImport] = useState(false);

  // ⭐ Bulk delete — sélection multiple d'overrides (pattern FeeStructuresContent Task 24)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // ⭐ Pagination serveur (pattern identique à StudentMovementsContent.tsx — Task 9-a)
  const PAGE_SIZE = 25;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOverrides, setTotalOverrides] = useState(0);
  // ⭐ KPIs globaux — sommes agrégées sur TOUS les overrides matchés (pas seulement la page active)
  const [globalSums, setGlobalSums] = useState<{
    totalOriginal: number;
    totalCustom: number;
    totalReduction: number;
  }>({ totalOriginal: 0, totalCustom: 0, totalReduction: 0 });

  // Mapping education_levels UUID → school_levels UUID
  const eduToSchoolLevelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const level of levels) {
      const code = level.code;
      const matchingClass = classes.find((c: any) => c.schoolLevel?.code === code);
      if (matchingClass) {
        map[level.id] = matchingClass.schoolLevelId;
      }
    }
    return map;
  }, [levels, classes]);

  // Classes filtrées par niveau (comme dans Configuration des frais)
  const filteredClasses = useMemo(() => {
    if (!filterLevelId) return [...classes].sort((a, b) => classOrder(a.name) - classOrder(b.name));
    const schoolLevelId = eduToSchoolLevelMap[filterLevelId];
    if (!schoolLevelId) return [];
    return classes
      .filter((c: any) => c.schoolLevelId === schoolLevelId)
      .sort((a, b) => classOrder(a.name) - classOrder(b.name));
  }, [classes, filterLevelId, eduToSchoolLevelMap]);

  // Chargement initial : niveaux + classes (via BFF same-origin)
  useEffect(() => {
    const authHeaders = getClientAuthorizationHeader();
    fetch('/api/all-classes', { headers: { ...authHeaders }, credentials: 'include', cache: 'no-store' })
      .then((res) => res.json())
      .then((d) => setClasses(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => setClasses([]));
    fetch('/api/school-levels')
      .then((res) => res.json())
      .then((d) => setLevels(Array.isArray(d) ? d.filter((l: any) => l.id !== 'ALL') : []))
      .catch(() => setLevels([]));
  }, []);

  useEffect(() => {
    if (!academicYear?.id) return;
    financeService.getFeeStructures({ academicYearId: academicYear.id })
      .then((d) => setStructures(Array.isArray(d) ? d : []))
      .catch(() => setStructures([]));
  }, [academicYear?.id]);

  const loadOverrides = async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {
        academicYearId: academicYear.id,
        page: String(currentPage),
        limit: String(PAGE_SIZE),
      };
      // ⭐ Tous les filtres passés au backend (pattern Task 9-a)
      if (filterFeeType) params.feeType = filterFeeType;
      if (filterClassId) params.classId = filterClassId;
      // ⭐ Convertir filterLevelId (school_levels.id) en schoolLevelId pour le backend
      // (le backend filtre par student.studentEnrollments.class.schoolLevelId)
      if (filterLevelId) {
        const schoolLevelId = eduToSchoolLevelMap[filterLevelId];
        if (schoolLevelId) params.schoolLevelId = schoolLevelId;
      }
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const data = await financeService.getAllFeeOverrides(params);
      // ⭐ Gérer la réponse paginée { data, total, page, totalPages, sums } ou l'ancien format array
      const allItems = Array.isArray(data) ? data : (data?.data ?? []);
      setOverrides(allItems);
      setTotalOverrides(Array.isArray(data) ? data.length : (data?.total ?? 0));
      setTotalPages(Array.isArray(data) ? 1 : (data?.totalPages ?? 1));
      if (!Array.isArray(data) && data?.sums) {
        setGlobalSums({
          totalOriginal: Number(data.sums.totalOriginal ?? 0),
          totalCustom: Number(data.sums.totalCustom ?? 0),
          totalReduction: Number(data.sums.totalReduction ?? 0),
        });
      } else {
        // Fallback : calculer sur la page active (rétro-compat)
        setGlobalSums({
          totalOriginal: allItems.reduce((s, o) => s + Number(o.feeStructure?.totalAmount ?? 0), 0),
          totalCustom: allItems.reduce((s, o) => s + Number(o.customAmount ?? 0), 0),
          totalReduction: allItems.reduce((s, o) => s + Math.max(0, Number(o.feeStructure?.totalAmount ?? 0) - Number(o.customAmount ?? 0)), 0),
        });
      }
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Erreur de chargement',
        description: e?.message || 'Impossible de charger les personnalisations.',
        variant: 'destructive',
      });
      setOverrides([]);
      setTotalOverrides(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  // ⭐ Recharger quand la page ou les filtres changent (search avec debounce 250ms)
  useEffect(() => {
    if (!academicYear?.id) return;
    const timeout = setTimeout(() => {
      loadOverrides();
    }, searchQuery ? 250 : 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear?.id, currentPage, filterLevelId, filterClassId, filterFeeType, searchQuery]);

  // ⭐ Reset page à 1 quand les filtres changent
  useEffect(() => {
    setCurrentPage(1);
  }, [filterLevelId, filterClassId, filterFeeType, searchQuery]);

  // Filtrage côté frontend — SUPPRIMÉ (backend filtre maintenant par feeType, classId,
  // schoolLevelId, search). On conserve juste le tri alphabétique pour l'affichage.
  // (pattern identique au module Élève Task 9-a)
  const filteredOverrides = useMemo(() => {
    return [...overrides].sort((a, b) => {
      const nameA = `${a.student?.lastName || ''} ${a.student?.firstName || ''}`.toLowerCase();
      const nameB = `${b.student?.lastName || ''} ${b.student?.firstName || ''}`.toLowerCase();
      return nameA.localeCompare(nameB, 'fr');
    });
  }, [overrides]);

  const handleDelete = async (id: string, studentName: string) => {
    const ok = await confirmDialog.danger(
      `La personnalisation de ${studentName} sera supprimée. Le compte élève sera recalculé avec le montant initial.`,
      'Supprimer',
    );
    if (!ok) return;
    try {
      await financeService.deleteFeeOverride(id);
      toast({ title: 'Succès', description: 'Personnalisation supprimée.' });
      // Retirer de la sélection si présent
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      await loadOverrides();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error?.message || 'Erreur réseau', variant: 'destructive' });
    }
  };

  // ⭐ Bulk delete — suppression multiple d'overrides
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirmDialog.danger(
      `${selectedIds.size} personnalisation(s) seront supprimées. Les comptes élèves seront recalculés avec les montants initiaux.`,
      'Supprimer la sélection',
    );
    if (!ok) return;
    setBulkDeleting(true);
    try {
      const result = await financeService.bulkDeleteFeeOverrides(Array.from(selectedIds));
      const deletedCount = result.deleted?.length || 0;
      const blockedCount = result.blocked?.length || 0;
      if (deletedCount > 0 && blockedCount === 0) {
        toast({ title: 'Succès', description: `${deletedCount} personnalisation(s) supprimée(s).` });
      } else if (deletedCount > 0 && blockedCount > 0) {
        toast({
          title: 'Suppression partielle',
          description: `${deletedCount} supprimée(s), ${blockedCount} bloquée(s).`,
          variant: 'default',
        });
      } else if (deletedCount === 0 && blockedCount > 0) {
        toast({
          title: 'Aucune suppression',
          description: `Les ${blockedCount} personnalisations sélectionnées n'ont pas pu être supprimées.`,
          variant: 'destructive',
        });
      }
      setSelectedIds(new Set());
      await loadOverrides();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error?.message || 'Erreur réseau', variant: 'destructive' });
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (filteredOverrides.length > 0 && selectedIds.size === filteredOverrides.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOverrides.map(o => o.id)));
    }
  };

  // Ouvrir le vrai modal FeeOverrideModal en mode édition
  const openEdit = (o: any) => {
    setEditingOverride(o);
  };

  // Statistiques rapides — utilise les KPIs globaux serveur (pas la page active)
  const stats = useMemo(() => {
    return {
      total: totalOverrides,
      totalOriginal: globalSums.totalOriginal,
      totalCustom: globalSums.totalCustom,
      totalReduction: globalSums.totalReduction,
    };
  }, [totalOverrides, globalSums]);

  return (
    <>
      {confirmDialog.dialog}
      <ModuleContentArea
        layout="custom"
        toolbar={
          <div className="flex items-center justify-end flex-wrap gap-3">
            <Button variant="outline" onClick={() => setModalImport(true)}>
              <Upload className="w-4 h-4 mr-2" />Importer
            </Button>
            <Button onClick={() => setModalOverride(true)}>
              <Plus className="w-4 h-4 mr-2" />Nouvelle personnalisation
            </Button>
          </div>
        }
      >
        {/* ⭐ Bandeau de statistiques — 4 KPIs calculés sur le TOTAL serveur (pas la page active) */}
        <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Personnalisations actives</p>
            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
            <p className="text-[10px] text-slate-400">sur {totalPages} page(s) · année {academicYear?.label ?? '—'}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Montant initial cumulé</p>
            <p className="text-xl font-bold text-slate-700">{formatCurrency(stats.totalOriginal)}</p>
            <p className="text-[10px] text-slate-400">somme des tarifs standards</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Montant personnalisé cumulé</p>
            <p className="text-xl font-bold text-emerald-700">{formatCurrency(stats.totalCustom)}</p>
            <p className="text-[10px] text-slate-400">somme des tarifs personnalisés</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Réduction totale accordée</p>
            <p className="text-xl font-bold text-rose-600">{formatCurrency(stats.totalReduction)}</p>
            <p className="text-[10px] text-slate-400">
              {stats.totalOriginal > 0 ? `${Math.round((stats.totalReduction / stats.totalOriginal) * 100)}% du montant initial` : '—'}
            </p>
          </div>
        </div>

        {/* Filtres : Niveau → Classe → Type + Recherche */}
        <div className="mb-4 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Rechercher un élève</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nom, prénom ou matricule..."
                className="pl-10 w-full sm:w-[260px]"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Niveau</Label>
            <Select value={filterLevelId || 'ALL'} onValueChange={(v) => { setFilterLevelId(v === 'ALL' ? '' : v); setFilterClassId(''); }}>
              <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Tous les niveaux" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les niveaux</SelectItem>
                {levels.map((l) => (<SelectItem key={l.id} value={l.id}>{l.label ?? l.code ?? l.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Classe</Label>
            <Select value={filterClassId || 'ALL'} onValueChange={(v) => setFilterClassId(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Toutes les classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes les classes</SelectItem>
                {filteredClasses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Type de frais</Label>
            <Select value={filterFeeType || 'ALL'} onValueChange={(v) => setFilterFeeType(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Tous les types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les types</SelectItem>
                {FEE_TYPES.map((f) => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ⭐ Barre d'actions flottante pour suppression multiple */}
        {selectedIds.size > 0 && (
          <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg shadow-sm">
            <span className="text-sm font-semibold text-amber-800">
              {selectedIds.size} sélectionnée(s)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs"
                disabled={bulkDeleting}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="text-xs"
              >
                {bulkDeleting ? (
                  <span className="animate-pulse">Suppression…</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Supprimer ({selectedIds.size})
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Tableau principal — cellules avec hauteur confortable + single-line */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                {/* ⭐ Colonne checkbox pour sélection multiple */}
                <TableHead className="w-10 py-3">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="flex items-center justify-center w-5 h-5"
                    title={
                      filteredOverrides.length > 0 && selectedIds.size === filteredOverrides.length
                        ? 'Tout désélectionner'
                        : 'Tout sélectionner (page courante)'
                    }
                  >
                    {filteredOverrides.length > 0 && selectedIds.size === filteredOverrides.length
                      ? <CheckSquare className="w-4 h-4 text-blue-600" />
                      : <Square className="w-4 h-4 text-slate-400" />}
                  </button>
                </TableHead>
                <TableHead className="whitespace-nowrap py-3">Élève</TableHead>
                <TableHead className="whitespace-nowrap py-3">Frais concerné</TableHead>
                <TableHead className="whitespace-nowrap py-3">Type</TableHead>
                <TableHead className="text-right whitespace-nowrap py-3">Montant initial</TableHead>
                <TableHead className="text-right whitespace-nowrap py-3">Montant perso.</TableHead>
                <TableHead className="text-right whitespace-nowrap py-3">Réduction</TableHead>
                <TableHead className="whitespace-nowrap py-3">Motif</TableHead>
                <TableHead className="whitespace-nowrap py-3">Créé par</TableHead>
                <TableHead className="text-right whitespace-nowrap py-3">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="text-center text-gray-500 py-8">Chargement...</TableCell></TableRow>
              ) : filteredOverrides.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-gray-500 py-12">
                    <div className="flex flex-col items-center gap-3">
                      <User className="w-10 h-10 text-slate-300" />
                      <p>Aucune personnalisation trouvée.</p>
                      <Button onClick={() => setModalOverride(true)} size="sm">
                        <Plus className="w-4 h-4 mr-2" />Créer une personnalisation
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOverrides.map((o) => {
                  const original = Number(o.feeStructure?.totalAmount ?? 0);
                  const custom = Number(o.customAmount ?? 0);
                  const reduction = Math.max(0, original - custom);
                  const reductionPct = original > 0 ? Math.round((reduction / original) * 100) : 0;
                  const studentName = `${o.student?.lastName || ''} ${o.student?.firstName || ''}`.trim();
                  const studentMatricule = o.student?.matricule || o.student?.studentCode || '';
                  return (
                    <TableRow key={o.id} className={`hover:bg-slate-50 ${selectedIds.has(o.id) ? 'bg-blue-50/40' : ''}`}>
                      {/* ⭐ Checkbox de sélection */}
                      <TableCell className="w-10 py-3">
                        <button
                          type="button"
                          onClick={() => toggleSelect(o.id)}
                          className="flex items-center justify-center w-5 h-5"
                          title={selectedIds.has(o.id) ? 'Désélectionner' : 'Sélectionner'}
                        >
                          {selectedIds.has(o.id)
                            ? <CheckSquare className="w-4 h-4 text-blue-600" />
                            : <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />}
                        </button>
                      </TableCell>
                      {/* Élève — single line: "Nom Prénom (matricule)" */}
                      <TableCell className="font-medium whitespace-nowrap py-3">
                        {studentName || '—'}
                        {studentMatricule && <span className="text-xs text-slate-500 ml-1">({studentMatricule})</span>}
                      </TableCell>
                      {/* Frais concerné — single line, tronqué si trop long */}
                      <TableCell className="text-sm whitespace-nowrap max-w-[200px] truncate py-3" title={feeDisplayName(o.feeStructure)}>
                        {feeDisplayName(o.feeStructure)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-3"><Badge variant="outline">{feeTypeLabel(o.feeStructure?.feeType)}</Badge></TableCell>
                      <TableCell className="text-right text-slate-500 line-through whitespace-nowrap py-3">{formatCurrency(original)}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-700 whitespace-nowrap py-3">{formatCurrency(custom)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap py-3">
                        {reduction > 0 ? (
                          <span className="text-rose-600 font-semibold">
                            −{formatCurrency(reduction)} <span className="text-xs text-slate-500">({reductionPct}%)</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </TableCell>
                      {/* Motif — single line, tronqué */}
                      <TableCell className="text-sm text-slate-600 max-w-full sm:w-[180px] truncate whitespace-nowrap py-3" title={o.reason}>{o.reason}</TableCell>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap py-3">
                        {o.creator ? `${o.creator.firstName || ''} ${o.creator.lastName || ''}` : 'Système'}
                        <span className="text-slate-400 ml-1">· {o.createdAt ? new Date(o.createdAt).toLocaleDateString('fr-FR') : ''}</span>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap py-3">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(o)} title="Modifier">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(o.id, studentName)} title="Supprimer">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* ⭐ Pagination serveur — pattern identique à StudentMovementsContent.tsx */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 mt-3">
            <div className="text-xs text-slate-500">
              Affichage <strong className="text-slate-700">
                {totalOverrides > 0 ? `${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(currentPage * PAGE_SIZE, totalOverrides)}` : '0'}
              </strong> sur <strong className="text-slate-700">{totalOverrides}</strong> personnalisation(s)
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || loading}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Précédent
              </button>
              <div className="flex items-center gap-0.5">
                {(() => {
                  const pages: (number | 'ellipsis')[] = [];
                  const add = (p: number) => { if (!pages.includes(p)) pages.push(p); };
                  add(1);
                  if (currentPage - 1 > 2) pages.push('ellipsis');
                  for (let p = Math.max(2, currentPage - 1); p <= Math.min(totalPages - 1, currentPage + 1); p++) add(p);
                  if (currentPage + 1 < totalPages - 1) pages.push('ellipsis');
                  if (totalPages > 1) add(totalPages);
                  return pages.map((p, i) => {
                    if (p === 'ellipsis') {
                      return (
                        <span key={`e-${i}`} className="px-2 text-slate-400">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </span>
                      );
                    }
                    return (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        disabled={loading}
                        className={cn(
                          'min-w-[28px] h-7 px-2 text-xs font-bold rounded-lg transition disabled:opacity-50',
                          p === currentPage
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-600 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200'
                        )}
                      >
                        {p}
                      </button>
                    );
                  });
                })()}
              </div>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || loading}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Suivant
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </ModuleContentArea>

      {/* Modal de création */}
      {modalOverride && (
        <FeeOverrideModal
          structures={structures}
          onClose={() => { setModalOverride(false); loadOverrides(); }}
        />
      )}

      {/* Modal d'édition — utilise le vrai FeeOverrideModal en mode édition */}
      {editingOverride && (
        <FeeOverrideModal
          structures={structures}
          editingOverride={editingOverride}
          onClose={() => { setEditingOverride(null); loadOverrides(); }}
        />
      )}

      {/* Modal d'import en masse — bourses, réductions, cas sociaux */}
      <ImportOverridesModal
        open={modalImport}
        onClose={() => setModalImport(false)}
        onSuccess={() => loadOverrides()}
      />
    </>
  );
}
