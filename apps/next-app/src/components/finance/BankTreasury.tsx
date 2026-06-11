/**
 * BankTreasury Component
 *
 * Gestion de la trésorerie, des clôtures journalières et des reconciliations.
 */

'use client';

import { useState, useEffect } from 'react';
import { Wallet, Landmark, Plus, CheckCircle2, Clock, LockIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { financeService } from '@/services/finance.service';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { networkDetectionService } from '@/lib/offline/network-detection.service';

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  PENDING:   { label: 'En attente',  color: 'bg-amber-100 text-amber-700',   icon: Clock },
  VALIDATED: { label: 'Validée',     color: 'bg-green-100 text-green-700',   icon: CheckCircle2 },
  LOCKED:    { label: 'Verrouillée', color: 'bg-slate-100 text-slate-600',   icon: LockIcon },
};

export default function BankTreasury() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();

  const [closures, setClosures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], openingBalance: '', closingBalance: '', totalReceipts: '', totalExpenses: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);

  const loadClosures = async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const data = await financeService.getTreasuryClosures(academicYear.id);
      setClosures(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de charger les clôtures', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClosures();
  }, [academicYear?.id]);

  const handleCreate = async () => {
    if (!form.date || !form.closingBalance) {
      toast({ title: 'Erreur', description: 'La date et le solde de clôture sont obligatoires.', variant: 'destructive' });
      return;
    }
    if (!networkDetectionService.isConnected()) {
      toast({ title: 'Hors Ligne', description: 'La clôture de trésorerie requiert une connexion internet.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await financeService.createTreasuryClosure({
        academicYearId: academicYear?.id,
        date: form.date,
        openingBalance: Number(form.openingBalance) || 0,
        closingBalance: Number(form.closingBalance),
        totalReceipts: Number(form.totalReceipts) || 0,
        totalExpenses: Number(form.totalExpenses) || 0,
        notes: form.notes,
      });
      setModalOpen(false);
      setForm({ date: new Date().toISOString().split('T')[0], openingBalance: '', closingBalance: '', totalReceipts: '', totalExpenses: '', notes: '' });
      toast({ title: 'Clôture créée', description: 'La clôture journalière a été enregistrée.' });
      loadClosures();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de créer la clôture', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidate = async (id: string) => {
    if (!networkDetectionService.isConnected()) {
      toast({ title: 'Hors Ligne', description: 'La validation de trésorerie requiert une connexion internet.', variant: 'destructive' });
      return;
    }
    setValidatingId(id);
    try {
      await financeService.validateTreasuryClosure(id);
      toast({ title: 'Clôture validée', description: 'La clôture a été validée avec succès.' });
      loadClosures();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de valider la clôture', variant: 'destructive' });
    } finally {
      setValidatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-600" />
            Trésorerie & Clôtures Journalières
          </h2>
          <p className="text-sm text-slate-500 mt-1">Gestion des clôtures de caisse par journée</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nouvelle clôture
        </Button>
      </div>

      {/* Closures List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
          <Landmark className="w-4 h-4 text-blue-600" />
          <h3 className="font-bold text-slate-800 text-sm">Historique des clôtures — {academicYear?.label ?? '—'}</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />)}
          </div>
        ) : closures.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Wallet className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Aucune clôture enregistrée pour cette année.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {closures.map((c) => {
              const statusInfo = STATUS_MAP[c.status] ?? STATUS_MAP.PENDING;
              const StatusIcon = statusInfo.icon;
              return (
                <div key={c.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-slate-100 rounded-xl">
                      <StatusIcon className="w-4 h-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">
                        {c.date ? new Date(c.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Clôture: <span className="font-bold text-slate-700">{formatCurrency(Number(c.closingBalance))}</span>
                        {c.notes && <span className="ml-2 italic">{c.notes}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={`${statusInfo.color} border-0 text-xs font-bold`}>{statusInfo.label}</Badge>
                    {c.status === 'PENDING' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleValidate(c.id)}
                        disabled={validatingId === c.id}
                      >
                        {validatingId === c.id ? 'Validation...' : 'Valider'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Création */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle clôture journalière</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date de clôture <span className="text-red-500">*</span></label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Solde ouverture (XOF)</label>
                <Input type="number" placeholder="0" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Solde clôture (XOF) <span className="text-red-500">*</span></label>
                <Input type="number" placeholder="0" value={form.closingBalance} onChange={(e) => setForm({ ...form, closingBalance: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Total encaissements</label>
                <Input type="number" placeholder="0" value={form.totalReceipts} onChange={(e) => setForm({ ...form, totalReceipts: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Total dépenses</label>
                <Input type="number" placeholder="0" value={form.totalExpenses} onChange={(e) => setForm({ ...form, totalExpenses: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes / Observations</label>
              <Input placeholder="Optionnel" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? 'Enregistrement...' : 'Créer la clôture'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
