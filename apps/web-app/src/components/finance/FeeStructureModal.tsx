'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const FEE_TYPES = [
  { value: 'INSCRIPTION', label: 'Inscription' },
  { value: 'REINSCRIPTION', label: 'Réinscription' },
  { value: 'TUITION', label: 'Scolarité' },
  { value: 'CANTEEN', label: 'Cantine' },
  { value: 'AMANTS', label: 'Frais des amants' },
  { value: 'OTHER', label: 'Autre' },
];

// Helper : préfixe du nom auto-généré selon le type de frais
function feeTypePrefix(feeType: string, customLabel: string): string {
  switch (feeType) {
    case 'INSCRIPTION': return "Frais d'inscription";
    case 'REINSCRIPTION': return 'Frais de réinscription';
    case 'TUITION': return 'Frais de scolarité';
    case 'CANTEEN': return 'Frais de cantine';
    case 'AMANTS': return 'Frais des amants';
    case 'OTHER': return customLabel.trim() ? `Frais de ${customLabel.trim()}` : 'Frais personnalisé';
    default: return 'Frais';
  }
}

export default function FeeStructureModal({
  academicYearId,
  levels,
  classes,
  onClose,
  onSubmit,
  feeId,
  initialData,
}: {
  academicYearId: string;
  levels: any[];
  classes: any[];
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
  const [applyTo, setApplyTo] = useState<'level' | 'class'>(initialData?.classId ? 'class' : 'level');
  const [levelId, setLevelId] = useState(initialData?.levelId ?? '');
  const [classId, setClassId] = useState(initialData?.classId ?? '');

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
    const prefix = feeTypePrefix(feeType, customFeeTypeLabel);
    const target = applyTo === 'class' && classLabel ? classLabel : applyTo === 'level' && levelLabel ? levelLabel : '';
    return target ? `${prefix} — ${target}` : prefix;
  }, [feeType, customFeeTypeLabel, applyTo, classLabel, levelLabel]);

  useEffect(() => {
    if (!nameManuallyEdited) setName(autoName);
  }, [autoName, nameManuallyEdited]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(totalAmount);
    if (!name || isNaN(amount) || amount < 0) return;
    // Pour OTHER, le customFeeTypeLabel est obligatoire
    if (feeType === 'OTHER' && !customFeeTypeLabel.trim()) return;
    onSubmit({
      academicYearId,
      name,
      feeType,
      customFeeTypeLabel: feeType === 'OTHER' ? customFeeTypeLabel.trim() : undefined,
      totalAmount: amount,
      isInstallment,
      isMandatory,
      levelId: applyTo === 'level' ? levelId || undefined : undefined,
      classId: applyTo === 'class' ? classId || undefined : undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-blue-100 shadow-2xl"
      >
        <h3 className="text-lg font-semibold mb-4">{isEdit ? 'Modifier le frais' : 'Nouveau frais'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Type de frais</Label>
            <Select value={feeType} onValueChange={setFeeType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FEE_TYPES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {feeType === 'OTHER' && (
            <div>
              <Label>Précisez le type de frais</Label>
              <Input
                value={customFeeTypeLabel}
                onChange={(e) => setCustomFeeTypeLabel(e.target.value)}
                placeholder="Ex: Transport, Activités, Examens..."
                required
              />
              <p className="text-xs text-blue-600 mt-1">
                💡 Ce nom sera utilisé pour générer automatiquement le nom du frais (ex: « Frais de Transport — CE1 »).
              </p>
            </div>
          )}
          <div>
            <Label>Appliquer à</Label>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2">
                <input type="radio" checked={applyTo === 'level'} onChange={() => setApplyTo('level')} />
                Niveau
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={applyTo === 'class'} onChange={() => setApplyTo('class')} />
                Classe spécifique
              </label>
            </div>
          </div>
          {applyTo === 'level' && (
            <div>
              <Label>Niveau</Label>
              <Select value={levelId} onValueChange={setLevelId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {levels.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.label ?? l.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {applyTo === 'class' && (
            <div>
              <Label>Classe</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Nom du frais</Label>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); setNameManuallyEdited(true); }}
              placeholder="Auto-généré"
              required
            />
            {!nameManuallyEdited && <p className="text-xs text-blue-600 mt-1">💡 Le nom se remplit automatiquement selon le type, le niveau et la classe.</p>}
            {nameManuallyEdited && (
              <button type="button" onClick={() => { setNameManuallyEdited(false); setName(autoName); }} className="text-xs text-slate-500 hover:text-blue-600 mt-1 underline">
                ↺ Revenir au nom auto-généré
              </button>
            )}
          </div>
          <div>
            <Label>Montant total (XOF)</Label>
            <Input type="number" min={0} value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="installment" checked={isInstallment} onChange={(e) => setIsInstallment(e.target.checked)} />
            <Label htmlFor="installment">Paiement en tranches</Label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="mandatory" checked={isMandatory} onChange={(e) => setIsMandatory(e.target.checked)} />
            <Label htmlFor="mandatory">Frais obligatoire</Label>
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit">{isEdit ? 'Enregistrer' : 'Créer'}</Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
