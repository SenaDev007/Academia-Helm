'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
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
  const [customAmount, setCustomAmount] = useState('');
  const [reason, setReason] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const { shouldReduceMotion } = useMotionBudget();
  const modalMotion = getModalMotion(shouldReduceMotion);

  useEffect(() => {
    // Charge plus d'élèves (500 au lieu de 200) pour éviter les recherches vides
    studentsService.getAll({ limit: '500' })
      .then((d) => setStudents(Array.isArray(d) ? d : d?.data ?? []))
      .catch(() => setStudents([]));
  }, []);

  // Filtrage local avec debounce pour la recherche d'élèves
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students.slice(0, 100); // Limite à 100 pour la perf d'affichage
    const q = searchQuery.toLowerCase().trim();
    return students
      .filter((s) =>
        `${s.lastName || ''} ${s.firstName || ''} ${s.matricule || ''} ${s.studentCode || ''}`
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 100);
  }, [students, searchQuery]);

  const selectedStudent = students.find((s) => s.id === studentId);

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
          {/* Recherche d'élève avec input + select */}
          <div>
            <Label>Rechercher un élève</Label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nom, prénom ou matricule..."
                className="pl-9"
              />
            </div>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger>
                <SelectValue placeholder={
                  filteredStudents.length === 0
                    ? 'Aucun élève trouvé'
                    : `${filteredStudents.length} élève(s) — Sélectionner`
                } />
              </SelectTrigger>
              <SelectContent>
                {filteredStudents.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.lastName} {s.firstName}
                    {s.matricule ? ` (${s.matricule})` : s.studentCode ? ` (${s.studentCode})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedStudent && (
              <p className="text-xs text-emerald-600 mt-1">
                ✓ Élève sélectionné : {selectedStudent.lastName} {selectedStudent.firstName}
              </p>
            )}
          </div>

          <div>
            <Label>Frais concerné</Label>
            <Select value={feeStructureId} onValueChange={setFeeStructureId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un frais" /></SelectTrigger>
              <SelectContent>
                {structures.filter((f) => f.isActive).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} — {formatCurrency(Number(s.totalAmount))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Montant personnalisé (XOF)</Label>
            <Input
              type="number"
              min={0}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              required
              placeholder="Ex: 30000"
            />
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
            <Button type="submit" disabled={loading}>
              {loading ? 'Envoi...' : 'Valider la personnalisation'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
