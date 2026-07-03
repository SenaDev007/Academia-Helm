'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { Plus, Copy, UserCog, Pencil, Trash2 } from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { financeService } from '@/services/finance.service';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import { getAcademicYears } from '@/services/settings.service';
import FeeStructureModal from './FeeStructureModal';
import FeeOverrideModal from './FeeOverrideModal';
import { formatCurrency } from '@/lib/utils';

const FEE_TYPES = [
  { value: 'INSCRIPTION', label: 'Inscription' },
  { value: 'REINSCRIPTION', label: 'Réinscription' },
  { value: 'TUITION', label: 'Scolarité' },
  { value: 'ANNEX', label: 'Annexe' },
  { value: 'EXCEPTIONAL', label: 'Exceptionnel' },
];

function classOrder(name: string): number {
  const n = (name || '').trim().toUpperCase();
  if (n === 'MATERNELLE 1' || n === 'M1' || n === 'MAT1') return 0;
  if (n === 'MATERNELLE 2' || n === 'M2' || n === 'MAT2') return 1;
  if (n === 'CI') return 10;
  if (n === 'CP') return 11;
  if (n === 'CE1') return 12;
  if (n === 'CE2') return 13;
  if (n === 'CM1') return 14;
  if (n === 'CM2') return 15;
  if (n === '6E' || n === '6ÈME' || n === '6EME') return 20;
  if (n === '5E' || n === '5ÈME' || n === '5EME') return 21;
  if (n === '4E' || n === '4ÈME' || n === '4EME') return 22;
  if (n === '3E' || n === '3ÈME' || n === '3EME') return 23;
  if (n === '2NDE') return 24;
  if (n === '1ERE' || n === '1ÈRE') return 25;
  if (n === 'TERMINALE' || n === 'TLE') return 26;
  return 100 + (name.charCodeAt(0) || 0);
}

export default function FeeStructuresContent() {
  const confirmDialog = useConfirmDialog();
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [structures, setStructures] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLevelId, setFilterLevelId] = useState<string>('');
  const [filterClassId, setFilterClassId] = useState<string>('');
  const [modalNewFee, setModalNewFee] = useState(false);
  const [editingFee, setEditingFee] = useState<any | null>(null);
  const [modalOverride, setModalOverride] = useState(false);
  const [copyYearModal, setCopyYearModal] = useState(false);
  const [copyFrom, setCopyFrom] = useState('');
  const [copyTo, setCopyTo] = useState('');

  // Mapping education_levels UUID → school_levels UUID
  // levels vient de /api/school-levels (education_levels UUID + code MATERNELLE/PRIMAIRE)
  // classes vient de /api/all-classes (schoolLevelId = school_levels UUID + schoolLevel.code)
  // On mappe en matchant par code
  const eduToSchoolLevelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const level of levels) {
      const code = level.code; // MATERNELLE / PRIMAIRE / SECONDAIRE
      const matchingClass = classes.find((c: any) => c.schoolLevel?.code === code);
      if (matchingClass) {
        map[level.id] = matchingClass.schoolLevelId;
      }
    }
    return map;
  }, [levels, classes]);

  // Convertir education_levels UUID → school_levels UUID
  const toSchoolLevelId = (eduId: string): string | undefined => {
    return eduToSchoolLevelMap[eduId] || eduId;
  };

  // Filtrer les classes par niveau
  const filteredSortedClasses = useMemo(() => {
    if (!filterLevelId) return [...classes].sort((a, b) => classOrder(a.name) - classOrder(b.name));
    const schoolLevelId = toSchoolLevelId(filterLevelId);
    return classes
      .filter((c: any) => c.schoolLevelId === schoolLevelId)
      .sort((a, b) => classOrder(a.name) - classOrder(b.name));
  }, [classes, filterLevelId, eduToSchoolLevelMap]);

  useEffect(() => {
    if (filterClassId && !filteredSortedClasses.find((c) => c.id === filterClassId)) {
      setFilterClassId('');
    }
  }, [filteredSortedClasses, filterClassId]);

  const loadStructures = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const params: Record<string, string> = { academicYearId: academicYear.id };
      if (filterLevelId) {
        const slId = toSchoolLevelId(filterLevelId);
        if (slId) params.levelId = slId;
      }
      if (filterClassId) params.classId = filterClassId;
      const data = await financeService.getFeeStructures(params);
      setStructures(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [academicYear?.id, filterLevelId, filterClassId, eduToSchoolLevelMap]);

  useEffect(() => { loadStructures(); }, [loadStructures]);

  useEffect(() => {
    // Utiliser la route BFF /api/all-classes (same-origin, pas de Cloudflare)
    // au lieu de classesService.getAll() qui utilise axios cross-origin
    const authHeaders = getClientAuthorizationHeader();
    fetch('/api/all-classes', { headers: { ...authHeaders }, credentials: 'include', cache: 'no-store' })
      .then((res) => res.json())
      .then((d) => {
        const cls = Array.isArray(d) ? d : (d.data ?? []);
        setClasses(cls);
      })
      .catch(() => setClasses([]));
    fetch('/api/school-levels')
      .then((res) => res.json())
      .then((d) => setLevels(Array.isArray(d) ? d.filter((l: any) => l.id !== 'ALL') : []))
      .catch(() => setLevels([]));
    getAcademicYears()
      .then((d) => setAcademicYears(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => setAcademicYears([]));
  }, []);

  const levelDisplay = (s: any): string => {
    if (s.level?.label) return s.level.label;
    if (s.level?.code) return s.level.code;
    if (s.level?.name) return s.level.name;
    return '—';
  };
  const classDisplay = (s: any): string => {
    if (s.class?.name) return s.class.name;
    if (s.classId) { const cls = classes.find((c) => c.id === s.classId); if (cls) return cls.name ?? '—'; }
    return '—';
  };

  const handleCreate = async (body: any) => {
    if (!academicYear?.id) return;
    try {
      const payload = { ...body, academicYearId: academicYear.id };
      if (payload.levelId) payload.levelId = toSchoolLevelId(payload.levelId);
      await financeService.createFeeStructure(payload);
      setModalNewFee(false);
      toast({ title: 'Succès', description: 'Frais configuré avec succès.' });
      await loadStructures();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error?.message || 'Erreur réseau', variant: 'destructive' });
    }
  };

  const handleUpdate = async (body: any) => {
    if (!editingFee?.id) return;
    try {
      const payload = { ...body };
      if (payload.levelId) payload.levelId = toSchoolLevelId(payload.levelId);
      await financeService.updateFeeStructure(editingFee.id, payload);
      setEditingFee(null);
      toast({ title: 'Succès', description: 'Frais modifié avec succès.' });
      await loadStructures();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error?.message || 'Erreur réseau', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog.danger('Ce frais sera supprimé.', 'Supprimer');
    if (!ok) return;
    try {
      await financeService.deleteFeeStructure(id);
      toast({ title: 'Succès', description: 'Frais supprimé.' });
      await loadStructures();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error?.message || 'Erreur réseau', variant: 'destructive' });
    }
  };

  const handleCopyToYear = async () => {
    if (!copyFrom || !copyTo) return;
    try {
      await financeService.copyFeeStructuresToYear({ fromAcademicYearId: copyFrom, toAcademicYearId: copyTo });
      setCopyYearModal(false); setCopyFrom(''); setCopyTo('');
      toast({ title: 'Succès', description: 'Frais copiés.' });
      await loadStructures();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error?.message || 'Erreur réseau', variant: 'destructive' });
    }
  };

  const feeTypeLabel = (t: string) => FEE_TYPES.find((f) => f.value === t)?.label ?? t;
  const modalClasses = useMemo(() => [...classes].sort((a, b) => classOrder(a.name) - classOrder(b.name)), [classes]);

  return (
    <>
      {confirmDialog.dialog}
      <div className="space-y-4">
        <ModuleContentArea layout="custom" toolbar={
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-slate-600">Priorité : Classe {'>'} Niveau {'>'} Override élève.</p>
            <div className="flex gap-2">
              <Button onClick={() => setModalNewFee(true)}><Plus className="w-4 h-4 mr-2" />Nouveau frais</Button>
              <Button variant="outline" onClick={() => setCopyYearModal(true)}><Copy className="w-4 h-4 mr-2" />Copier année</Button>
              <Button variant="outline" onClick={() => setModalOverride(true)}><UserCog className="w-4 h-4 mr-2" />Personnalisation</Button>
            </div>
          </div>
        }>
          <div className="mb-4 flex flex-wrap gap-4 items-end">
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
                  {filteredSortedClasses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Nom du frais</TableHead><TableHead>Type</TableHead><TableHead>Niveau</TableHead><TableHead>Classe</TableHead>
                  <TableHead className="text-right">Montant</TableHead><TableHead>Tranches</TableHead><TableHead>Oblig.</TableHead><TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (<TableRow><TableCell colSpan={9} className="text-center text-gray-500 py-8">Chargement...</TableCell></TableRow>
                ) : structures.length === 0 ? (<TableRow><TableCell colSpan={9} className="text-center text-gray-500 py-12">
                  <div className="flex flex-col items-center gap-3"><Plus className="w-10 h-10 text-slate-300" /><p>Aucun frais configuré.</p><Button onClick={() => setModalNewFee(true)} size="sm"><Plus className="w-4 h-4 mr-2" />Configurer un frais</Button></div>
                </TableCell></TableRow>
                ) : structures.map((s) => (
                  <TableRow key={s.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell><Badge variant="outline">{feeTypeLabel(s.feeType)}</Badge></TableCell>
                    <TableCell className="text-sm">{s.levelId ? <strong>{levelDisplay(s)}</strong> : <span className="text-slate-400">Tous</span>}</TableCell>
                    <TableCell className="text-sm">{s.classId ? <strong>{classDisplay(s)}</strong> : <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(s.totalAmount)}</TableCell>
                    <TableCell>{s.isInstallment ? <Badge className="bg-blue-50 text-blue-700">{s.structureInstallments?.length || 0} tranches</Badge> : <span className="text-slate-400 text-sm">Non</span>}</TableCell>
                    <TableCell><Badge variant={s.isMandatory ? 'default' : 'outline'}>{s.isMandatory ? 'Obligatoire' : 'Facultatif'}</Badge></TableCell>
                    <TableCell><Badge variant={s.isActive ? 'default' : 'secondary'}>{s.isActive ? 'Actif' : 'Inactif'}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setEditingFee(s)} title="Modifier"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)} title="Supprimer"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ModuleContentArea>

        {modalNewFee && <FeeStructureModal academicYearId={academicYear?.id ?? ''} levels={levels} classes={modalClasses} eduToSchoolLevelMap={eduToSchoolLevelMap} onClose={() => setModalNewFee(false)} onSubmit={handleCreate} />}
        {editingFee && <FeeStructureModal academicYearId={academicYear?.id ?? ''} levels={levels} classes={modalClasses} eduToSchoolLevelMap={eduToSchoolLevelMap} feeId={editingFee.id} initialData={editingFee} onClose={() => setEditingFee(null)} onSubmit={handleUpdate} />}
        {modalOverride && <FeeOverrideModal structures={structures} onClose={() => setModalOverride(false)} />}
        {copyYearModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Copier vers nouvelle année</h3>
              <div className="mb-3"><label className="block text-sm font-medium mb-1">Année source</label>
                <Select value={copyFrom || 'NONE'} onValueChange={(v) => setCopyFrom(v === 'NONE' ? '' : v)}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent><SelectItem value="NONE">— Choisir —</SelectItem>{academicYears.map((y) => (<SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>))}</SelectContent></Select>
              </div>
              <div className="mb-4"><label className="block text-sm font-medium mb-1">Année cible</label>
                <Select value={copyTo || 'NONE'} onValueChange={(v) => setCopyTo(v === 'NONE' ? '' : v)}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent><SelectItem value="NONE">— Choisir —</SelectItem>{academicYears.map((y) => (<SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>))}</SelectContent></Select>
              </div>
              <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => { setCopyYearModal(false); setCopyFrom(''); setCopyTo(''); }}>Annuler</Button><Button onClick={handleCopyToYear} disabled={!copyFrom || !copyTo || copyFrom === copyTo}>Copier</Button></div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
