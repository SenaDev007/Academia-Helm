'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const FEE_TYPES = [
  { value: 'INSCRIPTION', label: 'Inscription' },
  { value: 'REINSCRIPTION', label: 'Réinscription' },
  { value: 'TUITION', label: 'Scolarité' },
  { value: 'ANNEX', label: 'Annexe' },
  { value: 'EXCEPTIONAL', label: 'Exceptionnel' },
];

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

interface Installment { label: string; amount: string; dueDate: string; orderIndex: number; }

export default function FeeStructureModal({
  academicYearId, levels, classes, onClose, onSubmit, feeId, initialData,
}: {
  academicYearId: string; levels: any[]; classes: any[];
  onClose: () => void; onSubmit: (body: any) => void;
  feeId?: string; initialData?: any;
}) {
  const isEdit = Boolean(feeId);
  const [name, setName] = useState(initialData?.name ?? '');
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [feeType, setFeeType] = useState(initialData?.feeType ?? 'TUITION');
  const [totalAmount, setTotalAmount] = useState(initialData?.totalAmount != null ? String(initialData.totalAmount) : '');
  const [isInstallment, setIsInstallment] = useState(initialData?.isInstallment ?? false);
  const [isMandatory, setIsMandatory] = useState(initialData?.isMandatory ?? true);
  const [applyTo, setApplyTo] = useState<'level' | 'class'>(initialData?.classId ? 'class' : 'level');
  // levelId = education_levels UUID (sélectionné dans le sélecteur)
  const [levelId, setLevelId] = useState(initialData?.levelId ?? '');
  const [classId, setClassId] = useState(initialData?.classId ?? '');

  const initialInstallments: Installment[] = initialData?.structureInstallments?.length
    ? initialData.structureInstallments.sort((a: any, b: any) => a.orderIndex - b.orderIndex).map((i: any) => ({
        label: i.label, amount: String(i.amount),
        dueDate: i.dueDate ? new Date(i.dueDate).toISOString().slice(0, 10) : '', orderIndex: i.orderIndex,
      }))
    : [{ label: 'Tranche 1', amount: '', dueDate: '', orderIndex: 0 }];
  const [installments, setInstallments] = useState<Installment[]>(initialInstallments);

  // Obtenir le schoolLevelId depuis le level sélectionné
  // levels vient de /api/school-levels qui contient maintenant schoolLevelId
  const getSchoolLevelId = (eduId: string): string | undefined => {
    const level = levels.find((l) => l.id === eduId);
    return level?.schoolLevelId || undefined;
  };

  // Filtrer les classes par niveau (en utilisant schoolLevelId)
  const modalFilteredClasses = useMemo(() => {
    if (!levelId) return [...classes].sort((a, b) => classOrder(a.name) - classOrder(b.name));
    const schoolLevelId = getSchoolLevelId(levelId);
    if (!schoolLevelId) return [];
    return classes
      .filter((c: any) => c.schoolLevelId === schoolLevelId)
      .sort((a, b) => classOrder(a.name) - classOrder(b.name));
  }, [classes, levelId, levels]);

  useEffect(() => {
    if (classId && levelId && !modalFilteredClasses.find((c) => c.id === classId)) {
      setClassId('');
    }
  }, [modalFilteredClasses, classId, levelId]);

  // Auto-génération du nom
  const levelLabel = useMemo(() => {
    const level = levels.find((l) => l.id === levelId);
    return level ? (level.label ?? level.code ?? level.name ?? '') : '';
  }, [levels, levelId]);

  const classLabel = useMemo(() => {
    const cls = classes.find((c) => c.id === classId);
    return cls ? (cls.name ?? '') : '';
  }, [classes, classId]);

  const autoName = useMemo(() => {
    const target = applyTo === 'class' && classLabel ? classLabel : applyTo === 'level' && levelLabel ? levelLabel : '';
    const prefix = feeType === 'INSCRIPTION' ? "Frais d'inscription"
      : feeType === 'REINSCRIPTION' ? 'Frais de réinscription'
      : feeType === 'TUITION' ? 'Frais de scolarité'
      : feeType === 'ANNEX' ? 'Frais annexe' : 'Frais exceptionnel';
    return target ? `${prefix} — ${target}` : prefix;
  }, [feeType, applyTo, classLabel, levelLabel]);

  useEffect(() => {
    if (!nameManuallyEdited) setName(autoName);
  }, [autoName, nameManuallyEdited]);

  const addInstallment = () => setInstallments([...installments, { label: `Tranche ${installments.length + 1}`, amount: '', dueDate: '', orderIndex: installments.length }]);
  const removeInstallment = (idx: number) => setInstallments(installments.filter((_, i) => i !== idx).map((inst, i) => ({ ...inst, orderIndex: i })));
  const updateInstallment = (idx: number, field: keyof Installment, value: string) => setInstallments(installments.map((inst, i) => i === idx ? { ...inst, [field]: value } : inst));

  const installmentsSum = installments.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
  const totalAmountNum = parseFloat(totalAmount) || 0;
  const installmentsValid = !isInstallment || (installments.every((i) => i.label && i.amount && i.dueDate) && Math.abs(installmentsSum - totalAmountNum) < 1);

  // handleSubmit envoie levelId = education_levels UUID
  // Le parent (FeeStructuresContent) fera la conversion en schoolLevelId
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(totalAmount);
    if (!name || isNaN(amount) || amount < 0) return;
    if (isInstallment && !installmentsValid) return;
    onSubmit({
      academicYearId, name, feeType, totalAmount: amount, isInstallment, isMandatory,
      levelId: levelId || undefined,
      classId: applyTo === 'class' ? classId || undefined : undefined,
      installments: isInstallment ? installments.map((i) => ({ label: i.label, amount: parseFloat(i.amount), dueDate: new Date(i.dueDate), orderIndex: i.orderIndex })) : undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50">
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.22, ease: 'easeOut' }} className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-blue-100 shadow-2xl">
        <h3 className="text-lg font-semibold mb-4">{isEdit ? 'Modifier le frais' : 'Nouveau frais'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Type de frais</Label>
            <Select value={feeType} onValueChange={setFeeType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FEE_TYPES.map((f) => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Appliquer à</Label>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2"><input type="radio" checked={applyTo === 'level'} onChange={() => setApplyTo('level')} />Niveau</label>
              <label className="flex items-center gap-2"><input type="radio" checked={applyTo === 'class'} onChange={() => setApplyTo('class')} />Classe spécifique</label>
            </div>
          </div>
          <div>
            <Label>Niveau {applyTo === 'class' && <span className="text-xs text-slate-400">(filtre les classes)</span>}</Label>
            <Select value={levelId} onValueChange={(v) => { setLevelId(v); setClassId(''); }}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un niveau" /></SelectTrigger>
              <SelectContent>{levels.map((l) => (<SelectItem key={l.id} value={l.id}>{l.label ?? l.code ?? l.name ?? 'Niveau'}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          {applyTo === 'class' && (
            <div>
              <Label>Classe</Label>
              <Select value={classId} onValueChange={setClassId} disabled={!levelId || modalFilteredClasses.length === 0}>
                <SelectTrigger><SelectValue placeholder={levelId ? (modalFilteredClasses.length === 0 ? 'Aucune classe pour ce niveau' : 'Sélectionner une classe') : "Sélectionner d'abord un niveau"} /></SelectTrigger>
                <SelectContent>{modalFilteredClasses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Nom du frais</Label>
            <Input value={name} onChange={(e) => { setName(e.target.value); setNameManuallyEdited(true); }} placeholder="Auto-généré" required />
            {!nameManuallyEdited && <p className="text-xs text-blue-600 mt-1">💡 Le nom se remplit automatiquement. Vous pouvez le personnaliser.</p>}
          </div>
          <div>
            <Label>Montant total (XOF)</Label>
            <Input type="number" min={0} value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required />
          </div>
          <div className="flex items-center gap-2"><input type="checkbox" id="installment" checked={isInstallment} onChange={(e) => setIsInstallment(e.target.checked)} /><Label htmlFor="installment">Paiement en tranches</Label></div>
          <div className="flex items-center gap-2"><input type="checkbox" id="mandatory" checked={isMandatory} onChange={(e) => setIsMandatory(e.target.checked)} /><Label htmlFor="mandatory">Frais obligatoire</Label></div>
          {isInstallment && (
            <div className="border rounded-lg p-3 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between"><Label className="text-sm font-semibold">Tranches de paiement</Label><Button type="button" size="sm" variant="outline" onClick={addInstallment}><Plus className="h-3.5 w-3.5 mr-1" />Ajouter</Button></div>
              {installments.map((inst, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-3"><Label className="text-xs">Libellé</Label><Input value={inst.label} onChange={(e) => updateInstallment(idx, 'label', e.target.value)} required /></div>
                  <div className="col-span-3"><Label className="text-xs">Montant</Label><Input type="number" value={inst.amount} onChange={(e) => updateInstallment(idx, 'amount', e.target.value)} required /></div>
                  <div className="col-span-4"><Label className="text-xs">Échéance</Label><Input type="date" value={inst.dueDate} onChange={(e) => updateInstallment(idx, 'dueDate', e.target.value)} required /></div>
                  <div className="col-span-2 flex justify-end">{installments.length > 1 && <Button type="button" size="sm" variant="ghost" onClick={() => removeInstallment(idx)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>}</div>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t text-sm"><span className="text-slate-600">Somme :</span><span className={Math.abs(installmentsSum - totalAmountNum) < 1 ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>{installmentsSum.toLocaleString('fr-FR')} / {totalAmountNum.toLocaleString('fr-FR')} XOF</span></div>
              {isInstallment && !installmentsValid && <p className="text-xs text-rose-600">⚠️ La somme des tranches doit être égale au montant total.</p>}
            </div>
          )}
          <div className="flex gap-2 justify-end pt-4"><Button type="button" variant="outline" onClick={onClose}>Annuler</Button><Button type="submit" disabled={isInstallment && !installmentsValid}>{isEdit ? 'Enregistrer' : 'Créer'}</Button></div>
        </form>
      </motion.div>
    </div>
  );
}
