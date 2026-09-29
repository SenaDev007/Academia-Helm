'use client';

/**
 * ============================================================================
 * BULK CLASS OVERRIDE MODAL — Personnalisation EN MASSE pour toute une classe
 * ============================================================================
 *
 * ⭐ Demande utilisateur (sept. 2026) :
 *    « lorsqu'on vient au niveau de l'onglet personnalisation, je voudrais
 *    qu'on puisse permettre de faire une personnalisation en masse. Une
 *    personnalisation en masse pour toute une classe, par exemple pour des
 *    raisons spécifiques. »
 *
 * Fonctionnement :
 *   1. L'admin choisit une classe (sélecteur cascade Niveau → Classe) ;
 *   2. Il choisit le frais concerné (toutes les structures actives de
 *      l'année — y compris les frais généraux GENERAL) ;
 *   3. Il applique une réduction — en pourcentage (%) OU en montant (XOF) —
 *      exactement comme le modal de personnalisation individuelle ;
 *   4. Motif obligatoire (partagé par tous les overrides créés) ;
 *   5. POST /api/finance/fee-structures/overrides/bulk-class → upsert par
 *      élève + recalcul synchrone des comptes de toute la classe.
 *
 * Le récapitulatif visuel (Initial − Réduction = À payer) est identique au
 * modal individuel (FeeOverrideModal) pour une expérience cohérente.
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Users, Calculator, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getModalMotion } from '@/lib/motion/presets';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import { financeService } from '@/services/finance.service';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';

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

export default function BulkClassOverrideModal({
  structures,
  classes,
  levels,
  onClose,
  onSuccess,
}: {
  structures: any[];
  classes: any[];
  levels: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const { shouldReduceMotion } = useMotionBudget();
  const modalMotion = getModalMotion(shouldReduceMotion);

  // Sélecteurs cascade Niveau → Classe
  const [levelId, setLevelId] = useState('');
  const [classId, setClassId] = useState('');
  const [feeStructureId, setFeeStructureId] = useState('');
  const [reductionPercent, setReductionPercent] = useState('');
  const [reductionAmount, setReductionAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  // Classes triées (filtrées par niveau si sélectionné)
  const filteredClasses = useMemo(() => {
    const sorted = [...classes].sort((a, b) => classOrder(a.name) - classOrder(b.name));
    if (!levelId) return sorted;
    const selectedLevel = levels.find((l) => l.id === levelId);
    if (!selectedLevel) return sorted;
    const schoolLevelId = selectedLevel.schoolLevelId || selectedLevel.id;
    const levelCode = (selectedLevel.code || '').toLowerCase();
    const levelLabel = (selectedLevel.label || '').toLowerCase();
    return sorted.filter((c: any) =>
      c.schoolLevelId === schoolLevelId ||
      (c.schoolLevel?.code || '').toLowerCase() === levelCode ||
      (c.schoolLevel?.code || '').toLowerCase() === levelLabel ||
      c.schoolLevel?.id === schoolLevelId
    );
  }, [classes, levelId, levels]);

  // Frais concerné
  const selectedFee = structures.find((s) => s.id === feeStructureId);
  const originalAmount = selectedFee ? Number(selectedFee.totalAmount) : 0;

  // Nom intelligent du frais (enrichi classe) — même logique que FeeOverrideModal
  const feeDisplayName = (s: any): string => {
    const baseName = s.name ?? '';
    if (!s.classId) return baseName;
    const className = s.class?.name ?? classes.find((c) => c.id === s.classId)?.name;
    if (!className) return baseName;
    if (baseName.includes(className)) return baseName;
    return `${baseName} — ${className}`;
  };

  // Montant personnalisé calculé (auto, comme FeeOverrideModal)
  const computedCustomAmount = useMemo(() => {
    if (originalAmount <= 0) return 0;
    const pct = parseFloat(reductionPercent);
    if (!isNaN(pct) && pct >= 0 && reductionPercent !== '') {
      return Math.max(0, Math.round(originalAmount * (1 - pct / 100)));
    }
    const amt = parseFloat(reductionAmount);
    if (!isNaN(amt) && amt >= 0 && reductionAmount !== '') {
      return Math.max(0, Math.round(originalAmount - amt));
    }
    return originalAmount;
  }, [originalAmount, reductionPercent, reductionAmount]);

  // Validation
  const hasPercent = reductionPercent !== '' && !isNaN(parseFloat(reductionPercent));
  const hasAmount = reductionAmount !== '' && !isNaN(parseFloat(reductionAmount));
  const isValid =
    Boolean(classId) &&
    Boolean(feeStructureId) &&
    (hasPercent || hasAmount) &&
    reason.trim().length > 0 &&
    (!hasPercent || (parseFloat(reductionPercent) >= 0 && parseFloat(reductionPercent) <= 100)) &&
    (!hasAmount || (parseFloat(reductionAmount) >= 0 && parseFloat(reductionAmount) <= originalAmount));

  // Handler % → efface le montant (mode exclusif, comme FeeOverrideModal)
  const handlePercentChange = (v: string) => {
    setReductionPercent(v);
    setReductionAmount('');
  };
  const handleAmountChange = (v: string) => {
    setReductionAmount(v);
    setReductionPercent('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    try {
      const result = await financeService.bulkClassOverride({
        classId,
        feeStructureId,
        ...(hasPercent ? { reductionPercent: parseFloat(reductionPercent) } : {}),
        ...(hasAmount ? { reductionAmount: parseFloat(reductionAmount) } : {}),
        reason: reason.trim(),
      });

      const applied = result?.applied ?? 0;
      const failed = result?.failed ?? 0;
      const totalStudents = result?.totalStudents ?? 0;

      if (failed === 0) {
        toast({
          title: 'Personnalisation en masse réussie',
          description: `${applied} élève(s) de la classe personnalisé(s) — montant personnalisé : ${formatCurrency(result?.customAmount ?? computedCustomAmount)}. Les comptes élèves ont été recalculés.`,
        });
      } else if (applied === 0) {
        toast({
          title: 'Échec de la personnalisation en masse',
          description: `Aucun élève sur ${totalStudents} n'a pu être personnalisé.`,
          variant: 'destructive',
        });
        return;
      } else {
        toast({
          title: 'Personnalisation partielle',
          description: `${applied} personnalisé(s), ${failed} en échec sur ${totalStudents} élève(s).`,
          variant: 'warning',
        });
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error?.message || 'Erreur réseau',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50">
      <motion.div
        initial={modalMotion.initial}
        animate={modalMotion.animate}
        transition={modalMotion.transition}
        className="bg-white rounded-xl p-6 max-w-lg w-full border border-blue-100 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Personnalisation en masse — classe
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Applique la même réduction à <strong>tous les élèves actifs</strong> d'une classe pour le frais
          choisi — idéal pour des raisons spécifiques (cas sociaux, remise collective, exonération…).
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sélecteurs cascade : Niveau → Classe */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Niveau scolaire</Label>
              <Select value={levelId || 'ALL'} onValueChange={(v) => { setLevelId(v === 'ALL' ? '' : v); setClassId(''); }}>
                <SelectTrigger><SelectValue placeholder="Tous les niveaux" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les niveaux</SelectItem>
                  {levels.map((l) => (<SelectItem key={l.id} value={l.id}>{l.label ?? l.code ?? l.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Classe *</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une classe" /></SelectTrigger>
                <SelectContent>
                  {filteredClasses.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Frais concerné */}
          <div>
            <Label>Frais concerné *</Label>
            <Select value={feeStructureId} onValueChange={(v) => { setFeeStructureId(v); setReductionPercent(''); setReductionAmount(''); }}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un frais" /></SelectTrigger>
              <SelectContent>
                {structures.filter((s) => s.isActive).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {feeDisplayName(s)} — {formatCurrency(Number(s.totalAmount))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedFee && (
              <p className="text-xs text-slate-500 mt-1">
                Montant initial : <span className="font-semibold text-slate-700">{formatCurrency(originalAmount)}</span>
              </p>
            )}
          </div>

          {/* Réduction : % OU montant (exclusif) */}
          {selectedFee && (
            <div className="border rounded-lg p-3 bg-slate-50 space-y-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-600" />
                <Label className="text-sm font-semibold m-0">Réduction appliquée à toute la classe</Label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Réduction (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={reductionPercent}
                    onChange={(e) => handlePercentChange(e.target.value)}
                    placeholder="Ex: 10"
                  />
                </div>
                <div>
                  <Label className="text-xs">Réduction (XOF)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={reductionAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="Ex: 5000"
                  />
                </div>
              </div>
              {/* Récapitulatif visuel */}
              <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-200">
                <div>
                  <span className="text-slate-500 block">Initial</span>
                  <p className="font-semibold text-slate-700">{formatCurrency(originalAmount)}</p>
                </div>
                <div>
                  <span className="text-slate-500 block">Réduction</span>
                  <p className="font-semibold text-rose-600">
                    −{formatCurrency(Math.max(0, originalAmount - computedCustomAmount))}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 block">À payer / élève</span>
                  <p className="font-bold text-emerald-700">{formatCurrency(computedCustomAmount)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Motif obligatoire */}
          <div>
            <Label>Motif (obligatoire)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: réduction cas social collective, bourse de la classe…"
              required
            />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={loading || !isValid}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Application en cours…
                </>
              ) : (
                <>
                  <Users className="w-4 h-4 mr-2" />
                  Appliquer à toute la classe
                </>
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
