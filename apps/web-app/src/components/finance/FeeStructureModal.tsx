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
  { value: 'CANTEEN', label: 'Cantine' },
  { value: 'EXAMEN', label: "Frais d'examen" },
  { value: 'OTHER', label: 'Autre' },
];

// Helper : préfixe du nom auto-généré selon le type de frais
function feeTypePrefix(feeType: string, customLabel: string): string {
  switch (feeType) {
    case 'INSCRIPTION': return "Frais d'inscription";
    case 'REINSCRIPTION': return 'Frais de réinscription';
    case 'TUITION': return 'Frais de scolarité';
    case 'CANTEEN': return 'Frais de cantine';
    case 'EXAMEN': return "Frais d'examen";
    case 'OTHER': return customLabel.trim() ? `Frais de ${customLabel.trim()}` : 'Frais personnalisé';
    default: return 'Frais';
  }
}

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

interface Installment {
  label: string;
  amount: string;
  dueDate: string;
  dueDateType: 'FIXED' | 'AT_ENROLLMENT' | 'DAYS_AFTER_ENROLLMENT';
  daysOffset: string;
  orderIndex: number;
}

const DUE_DATE_TYPE_LABELS: Record<Installment['dueDateType'], string> = {
  AT_ENROLLMENT: "À l'inscription",
  DAYS_AFTER_ENROLLMENT: "Jours après inscription",
  FIXED: 'Date fixe',
};

export default function FeeStructureModal({
  academicYearId, levels, classes, eduToSchoolLevelMap, onClose, onSubmit, feeId, initialData,
}: {
  academicYearId: string;
  levels: any[];
  classes: any[];
  eduToSchoolLevelMap: Record<string, string>; // education_levels UUID → school_levels UUID
  onClose: () => void;
  onSubmit: (body: any) => void;
  feeId?: string;
  initialData?: any;
}) {
  const isEdit = Boolean(feeId);
  const [name, setName] = useState(initialData?.name ?? '');
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [feeType, setFeeType] = useState(initialData?.feeType ?? 'TUITION');
  const [customFeeTypeLabel, setCustomFeeTypeLabel] = useState(initialData?.customFeeTypeLabel ?? '');
  const [totalAmount, setTotalAmount] = useState(initialData?.totalAmount != null ? String(initialData.totalAmount) : '');
  const [isInstallment, setIsInstallment] = useState(initialData?.isInstallment ?? false);
  const [isMandatory, setIsMandatory] = useState(initialData?.isMandatory ?? true);
  // ⭐ Prioriser academicClassId (classe officielle) sur classId (classe physique).
  const initialClassId = initialData?.academicClassId || initialData?.classId;
  const [applyTo, setApplyTo] = useState<'level' | 'class'>(initialClassId ? 'class' : 'level');
  const [levelId, setLevelId] = useState(initialData?.levelId ?? ''); // education_levels UUID
  // Multi-select : classIds est un tableau (création groupée pour plusieurs classes)
  // En édition, on initialise avec la classe existante (si présente)
  const [classIds, setClassIds] = useState<string[]>(initialClassId ? [initialClassId] : []);

  const initialInstallments: Installment[] = initialData?.structureInstallments?.length
    ? initialData.structureInstallments.sort((a: any, b: any) => a.orderIndex - b.orderIndex).map((i: any) => ({
        label: i.label, amount: String(i.amount),
        dueDate: i.dueDate ? new Date(i.dueDate).toISOString().slice(0, 10) : '',
        dueDateType: (i.dueDateType ?? 'FIXED') as Installment['dueDateType'],
        daysOffset: i.daysOffset != null ? String(i.daysOffset) : '',
        orderIndex: i.orderIndex,
      }))
    : [{
        label: 'Tranche 1',
        amount: '',
        dueDate: '',
        // Par défaut, la 1ère tranche est due à l'inscription (règle métier écoles privées)
        dueDateType: 'AT_ENROLLMENT',
        daysOffset: '',
        orderIndex: 0,
      }];
  const [installments, setInstallments] = useState<Installment[]>(initialInstallments);

  // Filtrer les classes officielles par niveau
  // ⭐ On filtre par NOM de niveau (Maternelle/Primaire/Secondaire) et non par ID,
  // car AcademicClass.levelId pointe vers pedagogy_academic_levels (AcademicLevel),
  // tandis que levels viennent de school_levels (SchoolLevel) — ce sont 2 tables différentes.
  const modalFilteredClasses = useMemo(() => {
    const sorted = [...classes].sort((a, b) => classOrder(a.name) - classOrder(b.name));
    if (!levelId) return sorted;
    const selectedLevel = levels.find((l) => l.id === levelId);
    if (!selectedLevel) return sorted;
    const levelCode = (selectedLevel.code || '').toLowerCase();
    const levelLabel = (selectedLevel.label || '').toLowerCase();
    return sorted.filter((c: any) => {
      const levelName = (c.level?.name || '').toLowerCase();
      const classLevelCode = (c.level?.code || '').toLowerCase();
      return levelName === levelCode || levelName === levelLabel ||
             classLevelCode === levelCode || classLevelCode === levelLabel ||
             c.schoolLevelId === selectedLevel.schoolLevelId;
    });
  }, [classes, levelId, levels]);

  useEffect(() => {
    // Enlever les classIds qui ne sont plus dans la liste filtrée (ex: changement de niveau)
    setClassIds((prev) => prev.filter((id) => modalFilteredClasses.find((c) => c.id === id)));
  }, [modalFilteredClasses]);

  // Auto-génération du nom
  const levelLabel = useMemo(() => {
    const level = levels.find((l) => l.id === levelId);
    return level ? (level.label ?? level.code ?? level.name ?? '') : '';
  }, [levels, levelId]);

  const classLabel = useMemo(() => {
    // Si une seule classe sélectionnée, on affiche son nom ; sinon on garde vide (auto-nom basé sur niveau)
    if (classIds.length === 1) {
      const cls = classes.find((c) => c.id === classIds[0]);
      return cls ? (cls.name ?? '') : '';
    }
    return '';
  }, [classes, classIds]);

  const autoName = useMemo(() => {
    const target = applyTo === 'class' && classLabel ? classLabel : applyTo === 'level' && levelLabel ? levelLabel : '';
    const prefix = feeTypePrefix(feeType, customFeeTypeLabel);
    return target ? `${prefix} — ${target}` : prefix;
  }, [feeType, customFeeTypeLabel, applyTo, classLabel, levelLabel]);

  useEffect(() => {
    if (!nameManuallyEdited) setName(autoName);
  }, [autoName, nameManuallyEdited]);

  const addInstallment = () => setInstallments([
    ...installments,
    {
      label: `Tranche ${installments.length + 1}`,
      amount: '',
      dueDate: '',
      // Les tranches suivantes sont en mode FIXED par défaut (date fixe)
      dueDateType: 'FIXED',
      daysOffset: '',
      orderIndex: installments.length,
    },
  ]);
  const removeInstallment = (idx: number) => setInstallments(installments.filter((_, i) => i !== idx).map((inst, i) => ({ ...inst, orderIndex: i })));
  const updateInstallment = (idx: number, field: keyof Installment, value: string) => setInstallments(installments.map((inst, i) => i === idx ? { ...inst, [field]: value } as Installment : inst));

  const installmentsSum = installments.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
  const totalAmountNum = parseFloat(totalAmount) || 0;

  // Validation : chaque tranche doit avoir un libellé + un montant
  // + une échéance valide selon son mode (date pour FIXED, daysOffset > 0 pour DAYS_AFTER_ENROLLMENT,
  // rien pour AT_ENROLLMENT)
  const isInstallmentValid = (i: Installment): boolean => {
    if (!i.label || !i.amount) return false;
    if (i.dueDateType === 'FIXED') return Boolean(i.dueDate);
    if (i.dueDateType === 'DAYS_AFTER_ENROLLMENT') return Boolean(i.daysOffset) && parseInt(i.daysOffset) >= 0;
    // AT_ENROLLMENT : toujours valide
    return true;
  };
  const installmentsValid = !isInstallment || (installments.every(isInstallmentValid) && Math.abs(installmentsSum - totalAmountNum) < 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(totalAmount);
    if (!name || isNaN(amount) || amount < 0) return;
    if (isInstallment && !installmentsValid) return;
    // Pour OTHER, le customFeeTypeLabel est obligatoire
    if (feeType === 'OTHER' && !customFeeTypeLabel.trim()) return;
    // levelId = education_levels UUID, le parent fera la conversion
    // En mode class : on envoie classIds (tableau) pour création groupée
    onSubmit({
      academicYearId, name, feeType,
      customFeeTypeLabel: feeType === 'OTHER' ? customFeeTypeLabel.trim() : undefined,
      totalAmount: amount, isInstallment, isMandatory,
      levelId: levelId || undefined,
      classIds: applyTo === 'class' ? classIds : undefined,
      installments: isInstallment ? installments.map((i) => ({
        label: i.label,
        amount: parseFloat(i.amount),
        // dueDate n'est envoyé que pour le mode FIXED
        dueDate: i.dueDateType === 'FIXED' && i.dueDate ? new Date(i.dueDate) : undefined,
        dueDateType: i.dueDateType,
        daysOffset: i.dueDateType === 'DAYS_AFTER_ENROLLMENT' && i.daysOffset ? parseInt(i.daysOffset) : undefined,
        orderIndex: i.orderIndex,
      })) : undefined,
    });
  };

  // Toggle d'une classe dans la sélection multiple
  const toggleClass = (id: string) => {
    setClassIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };
  const selectAllClasses = () => setClassIds(modalFilteredClasses.map((c) => c.id));
  const clearAllClasses = () => setClassIds([]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50">
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.22, ease: 'easeOut' }} className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-blue-100 shadow-2xl">
        <h3 className="text-lg font-semibold mb-4">{isEdit ? 'Modifier le frais' : 'Nouveau frais'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label>Type de frais</Label>
            <Select value={feeType} onValueChange={setFeeType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FEE_TYPES.map((f) => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}</SelectContent></Select>
          </div>
          {feeType === 'OTHER' && (
            <div><Label>Précisez le type de frais</Label>
              <Input
                value={customFeeTypeLabel}
                onChange={(e) => setCustomFeeTypeLabel(e.target.value)}
                placeholder="Ex: Transport, Activités, Examens..."
                required
              />
              <p className="text-xs text-blue-600 mt-1">💡 Ce nom sera utilisé pour générer automatiquement le nom du frais (ex: « Frais de Transport — CE1 »).</p>
            </div>
          )}
          <div><Label>Appliquer à</Label>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2"><input type="radio" checked={applyTo === 'level'} onChange={() => setApplyTo('level')} />Niveau</label>
              <label className="flex items-center gap-2"><input type="radio" checked={applyTo === 'class'} onChange={() => setApplyTo('class')} />Classe spécifique</label>
            </div>
          </div>
          <div><Label>Niveau {applyTo === 'class' && <span className="text-xs text-slate-400">(filtre les classes)</span>}</Label>
            <Select value={levelId} onValueChange={(v) => { setLevelId(v); setClassIds([]); }}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un niveau" /></SelectTrigger>
              <SelectContent>{levels.map((l) => (<SelectItem key={l.id} value={l.id}>{l.label ?? l.code ?? l.name ?? 'Niveau'}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          {applyTo === 'class' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Classes <span className="text-xs text-slate-400">({classIds.length} sélectionnée{classIds.length > 1 ? 's' : ''})</span></Label>
                {modalFilteredClasses.length > 0 && (
                  <div className="flex gap-2 text-xs">
                    <button type="button" onClick={selectAllClasses} className="text-blue-600 hover:text-blue-800 hover:underline">Tout sélectionner</button>
                    <span className="text-slate-300">|</span>
                    <button type="button" onClick={clearAllClasses} className="text-slate-500 hover:text-slate-700 hover:underline">Tout désélectionner</button>
                  </div>
                )}
              </div>
              {!levelId ? (
                <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-md">Sélectionnez d'abord un niveau pour voir les classes.</p>
              ) : modalFilteredClasses.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-md">Aucune classe pour ce niveau.</p>
              ) : (
                <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-md bg-white divide-y divide-slate-100">
                  {modalFilteredClasses.map((c) => {
                    const checked = classIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${checked ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleClass(c.id)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700">{c.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              {classIds.length > 1 && (
                <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2 mt-2">
                  💡 <strong>Création groupée</strong> : {classIds.length} frais identiques seront créés (un par classe sélectionnée). Chaque classe apparaîtra individuellement dans le tableau.
                </p>
              )}
            </div>
          )}
          <div><Label>Nom du frais</Label>
            <Input value={name} onChange={(e) => { setName(e.target.value); setNameManuallyEdited(true); }} placeholder="Auto-généré" required />
            {!nameManuallyEdited && <p className="text-xs text-blue-600 mt-1">💡 Le nom se remplit automatiquement.</p>}
          </div>
          <div><Label>Montant total (XOF)</Label>
            <Input type="number" min={0} value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required />
          </div>
          <div className="flex items-center gap-2"><input type="checkbox" id="installment" checked={isInstallment} onChange={(e) => setIsInstallment(e.target.checked)} /><Label htmlFor="installment">Paiement en tranches</Label></div>
          <div className="flex items-center gap-2"><input type="checkbox" id="mandatory" checked={isMandatory} onChange={(e) => setIsMandatory(e.target.checked)} /><Label htmlFor="mandatory">Frais obligatoire</Label></div>
          {isInstallment && (
            <div className="border rounded-lg p-3 bg-slate-50 space-y-2">
              <Label className="text-sm font-semibold">Tranches</Label>
              <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
                💡 <strong>Tranche 1 = À l'inscription</strong> par défaut (règle usuelle des écoles privées :
                la 1ère tranche est payée le jour de l'inscription de l'élève). Pour les tranches suivantes,
                choisissez le mode d'échéance : date fixe, à l'inscription, ou X jours après inscription.
              </p>
              {installments.map((inst, idx) => (
                <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-3"><Label className="text-xs">Libellé</Label><Input value={inst.label} onChange={(e) => updateInstallment(idx, 'label', e.target.value)} required /></div>
                    <div className="col-span-3"><Label className="text-xs">Montant</Label><Input type="number" value={inst.amount} onChange={(e) => updateInstallment(idx, 'amount', e.target.value)} required /></div>
                    <div className="col-span-4">
                      <Label className="text-xs">Mode d'échéance</Label>
                      <Select value={inst.dueDateType} onValueChange={(v) => updateInstallment(idx, 'dueDateType', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AT_ENROLLMENT">À l'inscription</SelectItem>
                          <SelectItem value="DAYS_AFTER_ENROLLMENT">Jours après inscription</SelectItem>
                          <SelectItem value="FIXED">Date fixe</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 flex justify-end">
                      {installments.length > 1 && (
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeInstallment(idx)}>
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {/* Champ conditionnel selon le mode d'échéance */}
                  {inst.dueDateType === 'FIXED' && (
                    <div><Label className="text-xs">Date d'échéance</Label><Input type="date" value={inst.dueDate} onChange={(e) => updateInstallment(idx, 'dueDate', e.target.value)} required /></div>
                  )}
                  {inst.dueDateType === 'AT_ENROLLMENT' && (
                    <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">
                      ✅ L'échéance sera automatiquement calculée = <strong>date d'inscription de l'élève</strong>.
                      Aucune date à saisir ici ; le système s'en charge au moment de l'inscription.
                    </p>
                  )}
                  {inst.dueDateType === 'DAYS_AFTER_ENROLLMENT' && (
                    <div>
                      <Label className="text-xs">Nombre de jours après l'inscription</Label>
                      <Input
                        type="number"
                        min={0}
                        value={inst.daysOffset}
                        onChange={(e) => updateInstallment(idx, 'daysOffset', e.target.value)}
                        placeholder="Ex: 30 = 30 jours après l'inscription"
                        required
                      />
                    </div>
                  )}
                </div>
              ))}
              {/* Bouton "Ajouter" déplacé en bas — plus facile d'accès après ajout de tranches */}
              <Button type="button" size="sm" variant="outline" onClick={addInstallment} className="w-full border-dashed border-blue-300 text-blue-700 hover:bg-blue-50">
                <Plus className="h-3.5 w-3.5 mr-1" />Ajouter une tranche
              </Button>
              <div className="flex justify-between items-center pt-2 border-t text-sm">
                <span className="text-slate-600">Somme :</span>
                <span className={Math.abs(installmentsSum - totalAmountNum) < 1 ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                  {installmentsSum.toLocaleString('fr-FR')} / {totalAmountNum.toLocaleString('fr-FR')} XOF
                </span>
              </div>
              {isInstallment && !installmentsValid && (
                <p className="text-xs text-rose-600">
                  ⚠️ La somme doit être égale au montant total et chaque tranche doit avoir un libellé, un montant et une échéance valide.
                </p>
              )}
            </div>
          )}
          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={isInstallment && !installmentsValid}>
              {isEdit
                ? 'Enregistrer'
                : (applyTo === 'class' && classIds.length > 1
                    ? `Créer ${classIds.length} frais`
                    : 'Créer')}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
