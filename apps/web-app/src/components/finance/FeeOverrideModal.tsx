'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, X, User, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getModalMotion } from '@/lib/motion/presets';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import { studentsService } from '@/services/students.service';
import { financeService } from '@/services/finance.service';
import { formatCurrency } from '@/lib/utils';

export default function FeeOverrideModal({
  structures,
  onClose,
}: {
  structures: any[];
  onClose: () => void;
}) {
  const [studentId, setStudentId] = useState('');
  const [feeStructureId, setFeeStructureId] = useState('');
  const [reductionPercent, setReductionPercent] = useState('');
  const [reductionAmount, setReductionAmount] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [reason, setReason] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const { shouldReduceMotion } = useMotionBudget();
  const modalMotion = getModalMotion(shouldReduceMotion);
  const suggestionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    studentsService.getAll({ limit: '500' })
      .then((d) => setStudents(Array.isArray(d) ? d : d?.data ?? []))
      .catch(() => setStudents([]));
  }, []);

  // Filtrage pour l'autocomplétion (10 suggestions max)
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return students
      .filter((s) =>
        `${s.lastName || ''} ${s.firstName || ''} ${s.matricule || ''} ${s.studentCode || ''}`
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 10);
  }, [students, searchQuery]);

  const selectedStudent = students.find((s) => s.id === studentId);
  const selectedFee = structures.find((s) => s.id === feeStructureId);
  const originalAmount = selectedFee ? Number(selectedFee.totalAmount) : 0;

  // Helper : nom intelligent du frais (enrichi avec la classe si manquante)
  // Affichage identique au tableau : "Frais de scolarité — CI — 40000 FCFA"
  const feeDisplayName = (s: any): string => {
    const baseName = s.name ?? '';
    if (!s.classId) return baseName;
    const className = s.class?.name;
    if (!className) return baseName;
    if (baseName.includes(className)) return baseName;
    return `${baseName} — ${className}`;
  };

  // Fermer les suggestions au clic en dehors
  useEffect(() => {
    if (!showSuggestions) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSuggestions]);

  // Sélection d'un élève depuis les suggestions
  const selectStudent = (s: any) => {
    setStudentId(s.id);
    setSearchQuery(`${s.lastName} ${s.firstName}`);
    setShowSuggestions(false);
  };

  // Handler : changement de frais concerné → reset des réductions
  const handleFeeStructureChange = (id: string) => {
    setFeeStructureId(id);
    setReductionPercent('');
    setReductionAmount('');
    setCustomAmount('');
  };

  // Handler : réduction en pourcentage
  // Calcule automatiquement le montant de la réduction et le montant personnalisé final
  const handleReductionPercentChange = (v: string) => {
    setReductionPercent(v);
    if (originalAmount <= 0) return;
    const pct = parseFloat(v);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      setReductionAmount('');
      setCustomAmount(originalAmount.toFixed(0));
      return;
    }
    const reduction = (originalAmount * pct) / 100;
    setReductionAmount(reduction.toFixed(0));
    const final = Math.max(0, originalAmount - reduction);
    setCustomAmount(final.toFixed(0));
  };

  // Handler : réduction en montant
  // Calcule automatiquement le montant personnalisé final (initial − réduction)
  const handleReductionAmountChange = (v: string) => {
    setReductionAmount(v);
    setReductionPercent(''); // clear percent when user types amount directly
    if (originalAmount <= 0) return;
    const amt = parseFloat(v);
    if (isNaN(amt) || amt < 0) {
      setCustomAmount(originalAmount.toFixed(0));
      return;
    }
    const final = Math.max(0, originalAmount - amt);
    setCustomAmount(final.toFixed(0));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(customAmount);
    if (!studentId || !feeStructureId || isNaN(amount) || !reason.trim()) return;
    setLoading(true);
    try {
      await financeService.overrideFeeStructure({
        studentId,
        feeStructureId,
        customAmount: amount,
        reason: reason.trim(),
      });
      onClose();
    } catch (error: any) {
      alert(error?.message || 'Erreur réseau');
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Personnalisation élève</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recherche d'élève avec autocomplétion — input + dropdown de suggestions */}
          <div>
            <Label>Rechercher un élève</Label>
            <div className="relative" ref={suggestionsRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                  setStudentId(''); // reset si on tape à nouveau
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Tapez un nom, prénom ou matricule..."
                className="pl-10"
                autoComplete="off"
              />
              {/* Dropdown d'autocomplétion — cliquer pour sélectionner directement */}
              {showSuggestions && searchQuery.trim() && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredStudents.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-slate-500 text-center">
                      Aucun élève trouvé pour « {searchQuery} »
                    </p>
                  ) : (
                    filteredStudents.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => selectStudent(s)}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 transition-colors flex items-center gap-2"
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {s.lastName} {s.firstName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {s.matricule ? `Matricule: ${s.matricule}` : s.studentCode ? `Code: ${s.studentCode}` : '—'}
                            {s.class ? ` · ${s.class.name}` : ''}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {selectedStudent && (
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                ✓ Élève sélectionné : <span className="font-semibold">{selectedStudent.lastName} {selectedStudent.firstName}</span>
                {selectedStudent.matricule ? ` (${selectedStudent.matricule})` : ''}
              </p>
            )}
          </div>

          {/* Frais concerné — affichage enrichi avec classe + montant */}
          <div>
            <Label>Frais concerné</Label>
            <Select value={feeStructureId} onValueChange={handleFeeStructureChange}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un frais" /></SelectTrigger>
              <SelectContent>
                {structures.filter((f) => f.isActive).map((s) => (
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

          {/* Section réduction : % OU montant → calcul auto du montant personnalisé */}
          {selectedFee && (
            <div className="border rounded-lg p-3 bg-slate-50 space-y-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-600" />
                <Label className="text-sm font-semibold m-0">Réduction</Label>
              </div>
              <p className="text-xs text-slate-500 -mt-1">
                Choisissez le mode de réduction : pourcentage ou montant. Le montant personnalisé est calculé automatiquement.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Réduction (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={reductionPercent}
                    onChange={(e) => handleReductionPercentChange(e.target.value)}
                    placeholder="Ex: 10"
                  />
                </div>
                <div>
                  <Label className="text-xs">Réduction (XOF)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={reductionAmount}
                    onChange={(e) => handleReductionAmountChange(e.target.value)}
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
                    −{formatCurrency(parseFloat(reductionAmount) || 0)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 block">À payer</span>
                  <p className="font-bold text-emerald-700">{formatCurrency(parseFloat(customAmount) || 0)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Montant personnalisé (auto-calculé, read-only) */}
          <div>
            <Label>Montant personnalisé (XOF)</Label>
            <Input
              type="number"
              min={0}
              value={customAmount}
              readOnly
              className="bg-blue-50 font-semibold cursor-not-allowed border-blue-200"
              placeholder="Sélectionnez un frais et appliquez une réduction"
            />
            <p className="text-xs text-blue-600 mt-1">
              💡 Ce montant est calculé automatiquement : Montant initial − Réduction.
            </p>
          </div>

          <div>
            <Label>Motif (obligatoire)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: réduction cas social, bourse..."
              required
            />
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={loading || !customAmount}>
              {loading ? 'Envoi...' : 'Valider la personnalisation'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
