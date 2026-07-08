'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Search, User, Pencil } from 'lucide-react';
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
import { formatCurrency } from '@/lib/utils';
import FeeOverrideModal from './FeeOverrideModal';

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
      const params: Record<string, string> = { academicYearId: academicYear.id };
      const data = await financeService.getAllFeeOverrides(params);
      setOverrides(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverrides();
  }, [academicYear?.id]);

  // Filtrage côté frontend : par niveau + classe (de l'élève) + type de frais + recherche
  const filteredOverrides = useMemo(() => {
    let result = overrides;

    // Filtre par niveau : vérifier la classe de l'élève via studentEnrollments
    if (filterLevelId) {
      const schoolLevelId = eduToSchoolLevelMap[filterLevelId];
      if (schoolLevelId) {
        result = result.filter((o) => {
          // La classe de l'élève est dans studentEnrollments (chargé par le backend)
          const enrollment = o.student?.studentEnrollments?.[0];
          const classObj = enrollment?.class;
          return classObj?.schoolLevelId === schoolLevelId;
        });
      }
    }

    // Filtre par classe : vérifier la classe de l'élève
    if (filterClassId) {
      result = result.filter((o) => {
        const enrollment = o.student?.studentEnrollments?.[0];
        return enrollment?.classId === filterClassId;
      });
    }

    // Filtre par type de frais
    if (filterFeeType) {
      result = result.filter((o) => o.feeStructure?.feeType === filterFeeType);
    }

    // Recherche par nom d'élève
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((o) => {
        const name = `${o.student?.lastName || ''} ${o.student?.firstName || ''} ${o.student?.matricule || ''}`.toLowerCase();
        return name.includes(q);
      });
    }

    // Tri par ordre alphabétique (lastName, puis firstName)
    return [...result].sort((a, b) => {
      const nameA = `${a.student?.lastName || ''} ${a.student?.firstName || ''}`.toLowerCase();
      const nameB = `${b.student?.lastName || ''} ${b.student?.firstName || ''}`.toLowerCase();
      return nameA.localeCompare(nameB, 'fr');
    });
  }, [overrides, filterLevelId, filterClassId, filterFeeType, searchQuery, eduToSchoolLevelMap]);

  const handleDelete = async (id: string, studentName: string) => {
    const ok = await confirmDialog.danger(
      `La personnalisation de ${studentName} sera supprimée. Le compte élève sera recalculé avec le montant initial.`,
      'Supprimer',
    );
    if (!ok) return;
    try {
      await financeService.deleteFeeOverride(id);
      toast({ title: 'Succès', description: 'Personnalisation supprimée.' });
      await loadOverrides();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error?.message || 'Erreur réseau', variant: 'destructive' });
    }
  };

  // Ouvrir le vrai modal FeeOverrideModal en mode édition
  const openEdit = (o: any) => {
    setEditingOverride(o);
  };

  // Statistiques rapides
  const stats = useMemo(() => {
    const total = filteredOverrides.length;
    const totalReduction = filteredOverrides.reduce((sum, o) => {
      const original = Number(o.feeStructure?.totalAmount ?? 0);
      const custom = Number(o.customAmount ?? 0);
      return sum + Math.max(0, original - custom);
    }, 0);
    return { total, totalReduction };
  }, [filteredOverrides]);

  return (
    <>
      {confirmDialog.dialog}
      <ModuleContentArea
        layout="custom"
        toolbar={
          <div className="flex items-center justify-end flex-wrap gap-3">
            <Button onClick={() => setModalOverride(true)}>
              <Plus className="w-4 h-4 mr-2" />Nouvelle personnalisation
            </Button>
          </div>
        }
      >
        {/* Bandeau de statistiques */}
        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Personnalisations actives</p>
            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Réduction totale accordée</p>
            <p className="text-2xl font-bold text-rose-600">{formatCurrency(stats.totalReduction)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Année scolaire</p>
            <p className="text-sm font-semibold text-slate-700 mt-1">{academicYear?.label ?? '—'}</p>
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
                className="pl-10 w-[260px]"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Niveau</Label>
            <Select value={filterLevelId || 'ALL'} onValueChange={(v) => { setFilterLevelId(v === 'ALL' ? '' : v); setFilterClassId(''); }}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Tous les niveaux" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les niveaux</SelectItem>
                {levels.map((l) => (<SelectItem key={l.id} value={l.id}>{l.label ?? l.code ?? l.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Classe</Label>
            <Select value={filterClassId || 'ALL'} onValueChange={(v) => setFilterClassId(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Toutes les classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes les classes</SelectItem>
                {filteredClasses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Type de frais</Label>
            <Select value={filterFeeType || 'ALL'} onValueChange={(v) => setFilterFeeType(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Tous les types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les types</SelectItem>
                {FEE_TYPES.map((f) => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tableau principal — cellules avec hauteur confortable + single-line */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
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
                <TableRow><TableCell colSpan={9} className="text-center text-gray-500 py-8">Chargement...</TableCell></TableRow>
              ) : filteredOverrides.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-gray-500 py-12">
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
                    <TableRow key={o.id} className="hover:bg-slate-50">
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
                      <TableCell className="text-sm text-slate-600 max-w-[180px] truncate whitespace-nowrap py-3" title={o.reason}>{o.reason}</TableCell>
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
    </>
  );
}
