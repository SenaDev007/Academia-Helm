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
import { classesService } from '@/services/classes.service';
import { formatCurrency } from '@/lib/utils';
import { filterAndSortClasses } from '@/lib/finance/class-sort';
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
  const [loading, setLoading] = useState(true);
  const [filterClassId, setFilterClassId] = useState('');
  const [filterFeeType, setFilterFeeType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOverride, setModalOverride] = useState(false);
  const [editingOverride, setEditingOverride] = useState<any | null>(null);
  // Formulaire d'édition inline (montant + motif)
  const [editForm, setEditForm] = useState<{ customAmount: string; reason: string }>({ customAmount: '', reason: '' });

  // Chargement initial : classes + structures (pour le modal de création)
  useEffect(() => {
    classesService.getAll({})
      .then((d) => setClasses(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => setClasses([]));
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
      if (filterClassId) params.classId = filterClassId;
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
  }, [academicYear?.id, filterClassId]);

  // Filtrage côté frontend : par type de frais + recherche par nom d'élève
  const filteredOverrides = useMemo(() => {
    let result = overrides;
    if (filterFeeType) {
      result = result.filter((o) => o.feeStructure?.feeType === filterFeeType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((o) => {
        const name = `${o.student?.lastName || ''} ${o.student?.firstName || ''} ${o.student?.matricule || ''}`.toLowerCase();
        return name.includes(q);
      });
    }
    return result;
  }, [overrides, filterFeeType, searchQuery]);

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

  // Ouvrir le modal d'édition inline (montant + motif)
  const openEdit = (o: any) => {
    setEditingOverride(o);
    setEditForm({
      customAmount: String(o.customAmount ?? ''),
      reason: o.reason ?? '',
    });
  };

  // Sauvegarder la modification
  const handleUpdateOverride = async () => {
    if (!editingOverride) return;
    const amount = parseFloat(editForm.customAmount);
    if (isNaN(amount) || amount < 0) {
      toast({ title: 'Erreur', description: 'Montant invalide', variant: 'destructive' });
      return;
    }
    if (!editForm.reason.trim()) {
      toast({ title: 'Erreur', description: 'Motif obligatoire', variant: 'destructive' });
      return;
    }
    try {
      await financeService.updateFeeOverride(editingOverride.id, {
        customAmount: amount,
        reason: editForm.reason.trim(),
      });
      toast({ title: 'Succès', description: 'Personnalisation modifiée.' });
      setEditingOverride(null);
      await loadOverrides();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error?.message || 'Erreur réseau', variant: 'destructive' });
    }
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

        {/* Filtres */}
        <div className="mb-4 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Rechercher un élève</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nom, prénom ou matricule..."
                className="pl-9 w-[260px]"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Classe</Label>
            <Select value={filterClassId || 'ALL'} onValueChange={(v) => setFilterClassId(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Toutes les classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes les classes</SelectItem>
                {filterAndSortClasses(classes).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Type de frais</Label>
            <Select value={filterFeeType || 'ALL'} onValueChange={(v) => setFilterFeeType(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Tous les types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les types</SelectItem>
                {FEE_TYPES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tableau principal — toutes les cellules sur une seule ligne */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="whitespace-nowrap">Élève</TableHead>
                <TableHead className="whitespace-nowrap">Frais concerné</TableHead>
                <TableHead className="whitespace-nowrap">Type</TableHead>
                <TableHead className="text-right whitespace-nowrap">Montant initial</TableHead>
                <TableHead className="text-right whitespace-nowrap">Montant perso.</TableHead>
                <TableHead className="text-right whitespace-nowrap">Réduction</TableHead>
                <TableHead className="whitespace-nowrap">Motif</TableHead>
                <TableHead className="whitespace-nowrap">Créé par</TableHead>
                <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
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
                      <TableCell className="font-medium whitespace-nowrap">
                        {studentName || '—'}
                        {studentMatricule && <span className="text-xs text-slate-500 ml-1">({studentMatricule})</span>}
                      </TableCell>
                      {/* Frais concerné — single line, tronqué si trop long */}
                      <TableCell className="text-sm whitespace-nowrap max-w-[200px] truncate" title={feeDisplayName(o.feeStructure)}>
                        {feeDisplayName(o.feeStructure)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap"><Badge variant="outline">{feeTypeLabel(o.feeStructure?.feeType)}</Badge></TableCell>
                      <TableCell className="text-right text-slate-500 line-through whitespace-nowrap">{formatCurrency(original)}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-700 whitespace-nowrap">{formatCurrency(custom)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {reduction > 0 ? (
                          <span className="text-rose-600 font-semibold">
                            −{formatCurrency(reduction)} <span className="text-xs text-slate-500">({reductionPct}%)</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </TableCell>
                      {/* Motif — single line, tronqué */}
                      <TableCell className="text-sm text-slate-600 max-w-[180px] truncate whitespace-nowrap" title={o.reason}>{o.reason}</TableCell>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {o.creator ? `${o.creator.firstName || ''} ${o.creator.lastName || ''}` : 'Système'}
                        <span className="text-slate-400 ml-1">· {o.createdAt ? new Date(o.createdAt).toLocaleDateString('fr-FR') : ''}</span>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
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

      {/* Modal d'édition inline (montant + motif) */}
      {editingOverride && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">Modifier la personnalisation</h3>
            <p className="text-sm text-slate-600 mb-4">
              Élève : <strong>{editingOverride.student?.lastName} {editingOverride.student?.firstName}</strong>
              <br />
              Frais : <strong>{feeDisplayName(editingOverride.feeStructure)}</strong>
              <br />
              Montant initial : <strong>{formatCurrency(Number(editingOverride.feeStructure?.totalAmount ?? 0))}</strong>
            </p>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Nouveau montant personnalisé (XOF)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.customAmount}
                  onChange={(e) => setEditForm({ ...editForm, customAmount: e.target.value })}
                  required
                />
                <p className="text-xs text-blue-600 mt-1">
                  Réduction actuelle : {formatCurrency(Math.max(0, Number(editingOverride.feeStructure?.totalAmount ?? 0) - parseFloat(editForm.customAmount || '0')))}
                </p>
              </div>
              <div>
                <Label className="text-xs">Motif</Label>
                <Input
                  value={editForm.reason}
                  onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                  placeholder="Ex: réduction cas social, bourse..."
                  required
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => setEditingOverride(null)}>Annuler</Button>
              <Button onClick={handleUpdateOverride}>Enregistrer</Button>
            </div>
          </div>
        </div>
      )}

      {modalOverride && (
        <FeeOverrideModal
          structures={structures}
          onClose={() => { setModalOverride(false); loadOverrides(); }}
        />
      )}
    </>
  );
}
