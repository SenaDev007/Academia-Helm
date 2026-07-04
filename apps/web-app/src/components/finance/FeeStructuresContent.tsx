'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { Plus, Copy, UserCog, Pencil, Trash2, X, ChevronDown, Calendar, Clock, CalendarClock, Users } from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  { value: 'CANTEEN', label: 'Cantine' },
  { value: 'EXAMEN', label: "Frais d'examen" },
  { value: 'OTHER', label: 'Autre' },
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
  const [filterFeeType, setFilterFeeType] = useState<string>('');
  const [modalNewFee, setModalNewFee] = useState(false);
  const [editingFee, setEditingFee] = useState<any | null>(null);
  const [modalOverride, setModalOverride] = useState(false);
  const [copyYearModal, setCopyYearModal] = useState(false);
  const [copyFrom, setCopyFrom] = useState('');
  const [copyTo, setCopyTo] = useState('');
  const [installmentPopoverId, setInstallmentPopoverId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  // Régimes tarifaires
  const [regimes, setRegimes] = useState<any[]>([]);
  const [regimeLoading, setRegimeLoading] = useState(false);
  const [regimeLevelId, setRegimeLevelId] = useState('');
  const [regimeModal, setRegimeModal] = useState(false);
  const [editingRegime, setEditingRegime] = useState<any | null>(null);
  const [regimeForm, setRegimeForm] = useState({ schoolLevelId: '', code: 'STANDARD', label: '', description: '', isDefault: false });
  const [newRuleFeeType, setNewRuleFeeType] = useState('TUITION');
  const [newRuleValue, setNewRuleValue] = useState('');

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
      if (filterFeeType) params.feeType = filterFeeType;
      const data = await financeService.getFeeStructures(params);
      setStructures(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [academicYear?.id, filterLevelId, filterClassId, filterFeeType, eduToSchoolLevelMap]);

  useEffect(() => { loadStructures(); }, [loadStructures]);

  // Fermer le popover au clic en dehors ou sur Escape
  useEffect(() => {
    if (!installmentPopoverId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setInstallmentPopoverId(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInstallmentPopoverId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [installmentPopoverId]);

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

  // Helper : nom intelligent du frais
  // Si le frais a une classe (classId) mais que le nom ne contient pas déjà le nom de la classe,
  // on enrichit le nom avec " — NomClasse" (ex: "Frais de scolarité" → "Frais de scolarité — CE1")
  // Cas d'usage : création groupée où le nom générique a été utilisé pour toutes les classes
  const feeDisplayName = (s: any): string => {
    const baseName = s.name ?? '';
    if (!s.classId) return baseName;
    const className = s.class?.name ?? classes.find((c) => c.id === s.classId)?.name;
    if (!className) return baseName;
    // Si le nom contient déjà le nom de la classe (ex: "Frais de scolarité — CE1"), on garde tel quel
    if (baseName.includes(className)) return baseName;
    // Sinon on enrichit
    return `${baseName} — ${className}`;
  };

  // Helper : libellé du mode d'échéance d'une tranche
  const dueDateTypeLabel = (i: any): string => {
    const t = i.dueDateType ?? 'FIXED';
    if (t === 'AT_ENROLLMENT') return "À l'inscription";
    if (t === 'DAYS_AFTER_ENROLLMENT') return `${i.daysOffset ?? 0} jour(s) après inscription`;
    return 'Date fixe';
  };

  // Helper : description lisible de l'échéance d'une tranche
  const dueDateDescription = (i: any): string => {
    const t = i.dueDateType ?? 'FIXED';
    if (t === 'AT_ENROLLMENT') {
      return 'Sera calculée à l\'inscription de l\'élève';
    }
    if (t === 'DAYS_AFTER_ENROLLMENT') {
      return `${i.daysOffset ?? 0} jour(s) après l'inscription`;
    }
    if (i.dueDate) {
      return new Date(i.dueDate).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'long', year: 'numeric',
      });
    }
    return '—';
  };

  // Helper : icône selon le mode d'échéance
  const dueDateIcon = (i: any) => {
    const t = i.dueDateType ?? 'FIXED';
    if (t === 'AT_ENROLLMENT') return <Calendar className="w-3.5 h-3.5 text-emerald-600" />;
    if (t === 'DAYS_AFTER_ENROLLMENT') return <CalendarClock className="w-3.5 h-3.5 text-amber-600" />;
    return <Clock className="w-3.5 h-3.5 text-slate-500" />;
  };

  const handleCreate = async (body: any) => {
    if (!academicYear?.id) return;
    try {
      // Conversion levelId education_levels → school_levels
      const convertedLevelId = body.levelId ? toSchoolLevelId(body.levelId) : undefined;

      // Cas 1 : création groupée pour plusieurs classes (classIds est un tableau)
      if (Array.isArray(body.classIds) && body.classIds.length > 0) {
        const classIds = body.classIds;
        const basePayload: any = {
          academicYearId: academicYear.id,
          name: body.name,
          feeType: body.feeType,
          customFeeTypeLabel: body.customFeeTypeLabel,
          totalAmount: body.totalAmount,
          isInstallment: body.isInstallment,
          isMandatory: body.isMandatory,
          levelId: convertedLevelId,
          installments: body.installments,
        };

        let successCount = 0;
        let failCount = 0;
        for (const cid of classIds) {
          try {
            await financeService.createFeeStructure({ ...basePayload, classId: cid });
            successCount++;
          } catch {
            failCount++;
          }
        }

        setModalNewFee(false);
        if (failCount === 0) {
          toast({
            title: 'Succès',
            description: `${successCount} frais créés avec succès (un par classe sélectionnée).`,
          });
        } else {
          toast({
            title: 'Partiellement réussi',
            description: `${successCount} créés, ${failCount} en échec sur ${classIds.length} classes.`,
            variant: 'destructive',
          });
        }
        await loadStructures();
        return;
      }

      // Cas 2 : création unique (niveau ou classe unique)
      const payload = { ...body, academicYearId: academicYear.id };
      if (payload.levelId) payload.levelId = convertedLevelId;
      delete payload.classIds; // nettoyer au cas où
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
      // En édition : on prend la 1ère classe du tableau classIds (si présent) pour classId
      // (l'édition reste sur une seule classe à la fois)
      if (Array.isArray(payload.classIds) && payload.classIds.length > 0) {
        payload.classId = payload.classIds[0];
      }
      delete payload.classIds;
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

  // === Régimes tarifaires ===
  const loadRegimes = useCallback(async () => {
    if (!academicYear?.id || !regimeLevelId) { setRegimes([]); return; }
    setRegimeLoading(true);
    try {
      const data = await financeService.getFeeRegimes({ academicYearId: academicYear.id, schoolLevelId: regimeLevelId });
      setRegimes(Array.isArray(data) ? data : []);
    } catch { setRegimes([]); }
    finally { setRegimeLoading(false); }
  }, [academicYear?.id, regimeLevelId]);

  useEffect(() => { loadRegimes(); }, [loadRegimes]);

  const handleCreateRegime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYear?.id || !regimeForm.schoolLevelId || !regimeForm.label) return;
    try {
      await financeService.createFeeRegime({
        academicYearId: academicYear.id,
        schoolLevelId: regimeForm.schoolLevelId,
        code: regimeForm.code,
        label: regimeForm.label,
        description: regimeForm.description || undefined,
        isDefault: regimeForm.isDefault,
      });
      setRegimeModal(false);
      setRegimeForm({ schoolLevelId: '', code: 'STANDARD', label: '', description: '', isDefault: false });
      loadRegimes();
    } catch (e: any) { console.error(e); }
  };

  const handleUpdateRegime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRegime?.id) return;
    try {
      await financeService.updateFeeRegime(editingRegime.id, {
        label: editingRegime.label,
        description: editingRegime.description,
        isDefault: editingRegime.isDefault,
      });
      setEditingRegime(null);
      loadRegimes();
    } catch (e: any) { console.error(e); }
  };

  const handleDeleteRegime = async (id: string) => {
    const ok = await confirmDialog.danger('Ce régime tarifaire sera supprimé.', 'Supprimer');
    if (!ok) return;
    try {
      await financeService.deleteFeeRegime(id);
      loadRegimes();
    } catch (e: any) { console.error(e); }
  };

  const handleAddRule = async (regimeId: string) => {
    if (!newRuleFeeType || !newRuleValue) return;
    try {
      await financeService.addFeeRegimeRule(regimeId, {
        feeType: newRuleFeeType,
        reductionPercentage: parseFloat(newRuleValue),
      });
      setNewRuleValue('');
      // Recharger les régimes + mettre à jour le modal d'édition
      await loadRegimes();
      if (editingRegime) {
        const updated = await financeService.getFeeRegimes({ academicYearId: academicYear?.id, schoolLevelId: regimeLevelId });
        const found = (Array.isArray(updated) ? updated : []).find((r: any) => r.id === regimeId);
        if (found) setEditingRegime(found);
      }
    } catch (e: any) { console.error(e); }
  };

  return (
    <>
      {confirmDialog.dialog}
      <div className="space-y-4">
        <ModuleContentArea layout="custom" toolbar={
          <div className="flex items-center justify-end flex-wrap gap-3">
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
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Type</Label>
              <Select value={filterFeeType || 'ALL'} onValueChange={(v) => setFilterFeeType(v === 'ALL' ? '' : v)}>
                <SelectTrigger className="w-[220px]"><SelectValue placeholder="Tous les types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les types</SelectItem>
                  {FEE_TYPES.map((f) => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}
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
                    <TableCell className="font-medium">{feeDisplayName(s)}</TableCell>
                    <TableCell><Badge variant="outline">{feeTypeLabel(s.feeType)}</Badge></TableCell>
                    <TableCell className="text-sm">{s.levelId ? <strong>{levelDisplay(s)}</strong> : <span className="text-slate-400">Tous</span>}</TableCell>
                    <TableCell className="text-sm">{s.classId ? <strong>{classDisplay(s)}</strong> : <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(s.totalAmount)}</TableCell>
                    <TableCell>
                      {s.isInstallment ? (
                        <div className="space-y-1">
                          {/* Badge cliquable — hover plus clair (pas plus foncé) */}
                          <button
                            type="button"
                            onClick={() => setInstallmentPopoverId(installmentPopoverId === s.id ? null : s.id)}
                            className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold cursor-pointer transition-colors hover:bg-blue-100 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            title="Cliquez pour voir les tranches"
                          >
                            {s.structureInstallments?.length || 0} tranche(s)
                            <ChevronDown className={`w-3 h-3 transition-transform ${installmentPopoverId === s.id ? 'rotate-180' : ''}`} />
                          </button>

                          {/* Badges secondaires (info rapide sur les modes) */}
                          <div className="flex gap-1 flex-wrap">
                            {s.structureInstallments?.some((i: any) => i.dueDateType === 'AT_ENROLLMENT') && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0">
                                <Calendar className="w-2.5 h-2.5" />1ère = inscr.
                              </span>
                            )}
                            {s.structureInstallments?.some((i: any) => i.dueDateType === 'DAYS_AFTER_ENROLLMENT') && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0">
                                <CalendarClock className="w-2.5 h-2.5" />Jours après inscr.
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">Non</span>
                      )}
                    </TableCell>
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

        {/* Hologramme flottant — détails des tranches (au-dessus du tableau, pas dedans) */}
        {installmentPopoverId && (() => {
          const s = structures.find((st) => st.id === installmentPopoverId);
          if (!s) return null;
          return (
            <div
              className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
              onClick={() => setInstallmentPopoverId(null)}
              style={{ backdropFilter: 'blur(2px)', background: 'rgba(15, 23, 42, 0.25)' }}
            >
              <div
                ref={popoverRef}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-white/95 rounded-2xl shadow-2xl border border-blue-200 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
                style={{ boxShadow: '0 25px 50px -12px rgba(59, 130, 246, 0.25), 0 0 0 1px rgba(59, 130, 246, 0.1)' }}
              >
                {/* Header du hologramme — effet glassmorphism */}
                <div className="relative px-5 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white overflow-hidden">
                  {/* Effet de brillance en arrière-plan */}
                  <div className="absolute inset-0 opacity-20" style={{
                    background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)',
                  }} />
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center ring-2 ring-white/30">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold tracking-wide">Tranches de paiement</p>
                        <p className="text-xs text-white/80">
                          {s.structureInstallments?.length || 0} tranche(s) · Total : {formatCurrency(s.totalAmount)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInstallmentPopoverId(null)}
                      className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                      title="Fermer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Nom du frais concerné — enrichi intelligemment avec la classe si manquante */}
                <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Frais</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{feeDisplayName(s)}</p>
                  {s.classId && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Classe : <span className="font-medium text-slate-700">{classDisplay(s)}</span>
                    </p>
                  )}
                </div>

                {/* Liste des tranches */}
                <div className="max-h-[50vh] overflow-y-auto">
                  {[...(s.structureInstallments || [])]
                    .sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
                    .map((i: any, idx: number) => {
                      const mode = i.dueDateType ?? 'FIXED';
                      const modeBg = mode === 'AT_ENROLLMENT'
                        ? 'bg-emerald-50/70 border-l-emerald-500'
                        : mode === 'DAYS_AFTER_ENROLLMENT'
                          ? 'bg-amber-50/70 border-l-amber-500'
                          : 'bg-slate-50/70 border-l-slate-400';
                      return (
                        <div key={i.id ?? idx} className={`px-5 py-3 border-b border-slate-100 last:border-b-0 border-l-4 ${modeBg}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white border border-slate-300 flex items-center justify-center text-xs font-bold text-slate-700 shadow-sm">
                                {idx + 1}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">{i.label}</p>
                                <p className="text-xs text-slate-500">{dueDateTypeLabel(i)}</p>
                              </div>
                            </div>
                            <p className="text-sm font-bold text-slate-900 whitespace-nowrap">
                              {formatCurrency(i.amount)}
                            </p>
                          </div>
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600 pl-9">
                            {dueDateIcon(i)}
                            <span>{dueDateDescription(i)}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Footer du hologramme — somme de contrôle */}
                <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-blue-50 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs text-slate-600">Somme des tranches :</span>
                  <span className="text-sm font-bold text-blue-700">{formatCurrency(s.totalAmount)}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* === SECTION RÉGIMES TARIFAIRES === */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" />
              Régimes tarifaires
            </h3>
            <Button size="sm" variant="outline" onClick={() => setRegimeModal(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" />Nouveau régime
            </Button>
          </div>

          {/* Sélecteur de niveau pour les régimes */}
          <div className="mb-3">
            <Select value={regimeLevelId || 'ALL'} onValueChange={(v) => { setRegimeLevelId(v === 'ALL' ? '' : v); }}>
              <SelectTrigger className="w-[260px]"><SelectValue placeholder="Sélectionner un niveau" /></SelectTrigger>
              <SelectContent className="w-[260px]">
                <SelectItem value="ALL">Tous les niveaux</SelectItem>
                {levels.map((l) => (<SelectItem key={l.id} value={l.id}>{l.label ?? l.code ?? l.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {regimeLoading ? (
            <p className="text-sm text-slate-500 py-4 text-center">Chargement des régimes...</p>
          ) : regimes.length === 0 ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-sm text-blue-800">Aucun régime configuré. Un régime STANDARD sera créé automatiquement lors de la première inscription.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {regimes.map((regime) => (
                <div key={regime.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-mono">{regime.code}</Badge>
                        {regime.isDefault && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Défaut</Badge>}
                      </div>
                      <p className="font-semibold text-sm text-slate-800 mt-1">{regime.label}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingRegime(regime)} title="Modifier">
                        <Pencil className="w-3 h-3" />
                      </Button>
                      {!regime.isDefault && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteRegime(regime.id)} title="Supprimer">
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {regime.description && <p className="text-xs text-slate-500 mb-2">{regime.description}</p>}
                  {regime.rules?.length > 0 ? (
                    <div className="space-y-1">
                      {regime.rules.map((rule: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-xs bg-slate-50 px-2 py-1 rounded">
                          <span className="text-slate-600">{rule.feeType}</span>
                          <span className="font-medium text-indigo-600">
                            {rule.discountType === 'PERCENT' ? `−${rule.discountValue}%` : `−${formatCurrency(rule.discountValue)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Aucune règle de réduction</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal création régime */}
        {regimeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Nouveau régime tarifaire</h3>
              <form onSubmit={handleCreateRegime} className="space-y-3">
                <div>
                  <Label className="text-xs">Niveau scolaire</Label>
                  <Select value={regimeForm.schoolLevelId} onValueChange={(v) => setRegimeForm({ ...regimeForm, schoolLevelId: v })} required>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>{levels.map((l) => (<SelectItem key={l.id} value={l.id}>{l.label ?? l.code ?? l.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Code</Label>
                  <Select value={regimeForm.code} onValueChange={(v) => setRegimeForm({ ...regimeForm, code: v })} required>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STANDARD">STANDARD</SelectItem>
                      <SelectItem value="ENFANT_ENSEIGNANT">ENFANT_ENSEIGNANT</SelectItem>
                      <SelectItem value="REDUCTION">REDUCTION</SelectItem>
                      <SelectItem value="BOURSE">BOURSE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Libellé</Label>
                  <Input value={regimeForm.label} onChange={(e) => setRegimeForm({ ...regimeForm, label: e.target.value })} placeholder="ex: Régime Enfant d'enseignant" required />
                </div>
                <div>
                  <Label className="text-xs">Description (optionnel)</Label>
                  <Input value={regimeForm.description} onChange={(e) => setRegimeForm({ ...regimeForm, description: e.target.value })} placeholder="ex: Réduction de 50% sur la scolarité" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isDefault" checked={regimeForm.isDefault} onChange={(e) => setRegimeForm({ ...regimeForm, isDefault: e.target.checked })} />
                  <Label htmlFor="isDefault" className="text-xs">Régime par défaut</Label>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button type="button" variant="outline" onClick={() => setRegimeModal(false)}>Annuler</Button>
                  <Button type="submit">Créer</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal édition régime */}
        {editingRegime && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Modifier le régime</h3>
              <form onSubmit={handleUpdateRegime} className="space-y-3">
                <div>
                  <Label className="text-xs">Libellé</Label>
                  <Input value={editingRegime.label} onChange={(e) => setEditingRegime({ ...editingRegime, label: e.target.value })} required />
                </div>
                <div>
                  <Label className="text-xs">Description</Label>
                  <Input value={editingRegime.description || ''} onChange={(e) => setEditingRegime({ ...editingRegime, description: e.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="editIsDefault" checked={editingRegime.isDefault || false} onChange={(e) => setEditingRegime({ ...editingRegime, isDefault: e.target.checked })} />
                  <Label htmlFor="editIsDefault" className="text-xs">Régime par défaut</Label>
                </div>

                {/* Règles de réduction */}
                <div className="border-t pt-3">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Règles de réduction</p>
                  {editingRegime.rules?.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {editingRegime.rules.map((rule: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-xs bg-slate-50 px-2 py-1 rounded">
                          <span>{rule.feeType}</span>
                          <span className="font-medium">{rule.discountType === 'PERCENT' ? `−${rule.discountValue}%` : `−${formatCurrency(rule.discountValue)}`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Select value={newRuleFeeType} onValueChange={setNewRuleFeeType}>
                      <SelectTrigger className="w-[120px]"><SelectValue placeholder="Type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INSCRIPTION">Inscription</SelectItem>
                        <SelectItem value="REINSCRIPTION">Réinscription</SelectItem>
                        <SelectItem value="TUITION">Scolarité</SelectItem>
                        <SelectItem value="CANTEEN">Cantine</SelectItem>
                        <SelectItem value="EXAMEN">Examen</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" placeholder="% ou montant" value={newRuleValue} onChange={(e) => setNewRuleValue(e.target.value)} className="w-[100px]" />
                    <Button type="button" size="sm" variant="outline" onClick={() => handleAddRule(editingRegime.id)}>Ajouter</Button>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <Button type="button" variant="outline" onClick={() => setEditingRegime(null)}>Annuler</Button>
                  <Button type="submit">Enregistrer</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
