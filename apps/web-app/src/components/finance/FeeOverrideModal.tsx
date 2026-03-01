'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/students?limit=200', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setStudents(Array.isArray(d) ? d : d?.data ?? []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(customAmount);
    if (!studentId || !feeStructureId || isNaN(amount) || !reason.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/finance/fee-structures/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ studentId, feeStructureId, customAmount: amount, reason: reason.trim() }),
      });
      if (res.ok) {
        onClose();
      } else {
        const err = await res.json();
        alert(err?.message || err?.error || 'Erreur');
      }
    } catch {
      alert('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full">
        <h3 className="text-lg font-semibold mb-4">Personnalisation élève</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Rechercher élève</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un élève" /></SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.lastName} {s.firstName} {s.matricule ? `(${s.matricule})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Frais concerné</Label>
            <Select value={feeStructureId} onValueChange={setFeeStructureId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un frais" /></SelectTrigger>
              <SelectContent>
                {structures.filter((f) => f.isActive).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} — {Number(s.totalAmount).toLocaleString('fr-FR')} XOF</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Montant personnalisé (XOF)</Label>
            <Input type="number" min={0} value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} required />
          </div>
          <div>
            <Label>Motif (obligatoire)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: réduction cas social" required />
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Envoi...' : 'Valider'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
