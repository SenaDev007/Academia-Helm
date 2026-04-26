/**
 * SOUS-MODULE 6 — Clôture & Trésorerie (FinanceDailyClosure)
 * Calcul auto, type MANUAL/AUTO, rapprochement caisse, anomalie.
 */
'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Eye } from 'lucide-react';
import { ModuleHeader, SubModuleNavigation, ModuleContentArea } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FINANCE_SUBMODULE_TABS } from '@/components/finance/finance-tabs';

const formatXOF = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);

export default function TreasuryPage() {
  const { academicYear } = useModuleContext();
  const [closures, setClosures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalClosure, setModalClosure] = useState(false);
  const [detailClosure, setDetailClosure] = useState<any | null>(null);
  const [closureDate, setClosureDate] = useState(new Date().toISOString().split('T')[0]);
  const [physicalAmount, setPhysicalAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadClosures = async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/treasury/daily-closures?academicYearId=${academicYear.id}`, { credentials: 'include' });
      const data = await res.json();
      setClosures(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClosures();
  }, [academicYear?.id]);

  const handleCreateClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYear?.id) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/finance/treasury/daily-closures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          academicYearId: academicYear.id,
          date: closureDate,
          physicalAmount: physicalAmount ? Number(physicalAmount) : undefined,
          validate: true,
        }),
      });
      if (res.ok) {
        setModalClosure(false);
        setPhysicalAmount('');
        loadClosures();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidate = async (id: string) => {
    const res = await fetch(`/api/finance/treasury/daily-closures/${id}/validate`, { method: 'PATCH', credentials: 'include' });
    if (res.ok) loadClosures();
  };

  const subModuleTabs = FINANCE_SUBMODULE_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    path: t.path,
    icon: <t.icon className="w-4 h-4" />,
  }));

  const totalNet = closures.reduce((s, c) => s + Number(c.netBalance ?? 0), 0);

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Clôture & Trésorerie"
        description="Clôture journalière (calcul auto), rapprochement caisse, type Manuel/Auto, anomalie."
        icon="finance"
        kpis={[
          { label: 'Solde cumulé', value: formatXOF(totalNet) },
          { label: 'Clôtures', value: String(closures.length) },
          { label: 'Année', value: academicYear?.label ?? '—' },
        ]}
        actions={<Button onClick={() => setModalClosure(true)}>Clôturer la journée</Button>}
      />
      <SubModuleNavigation tabs={subModuleTabs} currentPath="/app/finance/treasury" />

      {modalClosure && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="font-semibold mb-4">Clôture journalière</h3>
            <p className="text-sm text-gray-600 mb-4">Encaissements et dépenses du jour sont calculés automatiquement. Saisissez le montant physique caisse pour le rapprochement.</p>
            <form onSubmit={handleCreateClosure}>
              <label className="block text-sm font-medium mb-1">Date</label>
              <Input type="date" value={closureDate} onChange={(e) => setClosureDate(e.target.value)} required className="mb-4" />
              <label className="block text-sm font-medium mb-1">Montant physique caisse (XOF, optionnel)</label>
              <Input type="number" value={physicalAmount} onChange={(e) => setPhysicalAmount(e.target.value)} placeholder="Rapprochement" className="mb-4" />
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>{submitting ? 'En cours…' : 'Valider clôture'}</Button>
                <Button type="button" variant="outline" onClick={() => setModalClosure(false)}>Annuler</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailClosure && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <h3 className="font-semibold mb-4">Clôture {new Date(detailClosure.date).toLocaleDateString('fr-FR')}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div><strong>Type:</strong> {detailClosure.closureType}</div>
              <div><strong>Validée:</strong> {detailClosure.validatedById ? 'Oui' : 'Non'}</div>
              <div><strong>Encaissements:</strong> {formatXOF(Number(detailClosure.totalIncome ?? 0))}</div>
              <div><strong>Dépenses:</strong> {formatXOF(Number(detailClosure.totalExpense ?? 0))}</div>
              <div><strong>Solde:</strong> {formatXOF(Number(detailClosure.netBalance ?? 0))}</div>
              {detailClosure.physicalAmount != null && <div><strong>Montant physique:</strong> {formatXOF(Number(detailClosure.physicalAmount))}</div>}
              {detailClosure.discrepancy != null && <div><strong>Écart:</strong> {formatXOF(Number(detailClosure.discrepancy))}</div>}
              {detailClosure.anomalyNote && <div className="col-span-2"><strong>Anomalie:</strong> {detailClosure.anomalyNote}</div>}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setDetailClosure(null)}>Fermer</Button>
            </div>
          </div>
        </div>
      )}

      <ModuleContentArea layout="table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Encaissements</TableHead>
              <TableHead>Dépenses</TableHead>
              <TableHead>Solde</TableHead>
              <TableHead>Anomalie</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-gray-500">Chargement…</TableCell></TableRow>
            ) : closures.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-gray-500">Aucune clôture.</TableCell></TableRow>
            ) : (
              closures.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{new Date(c.date).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell>
                    {c.closureType === 'AUTO' ? (
                      <Badge variant="outline" className={c.anomalyDetected ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>Auto</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800">Manuel</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-green-600">{formatXOF(Number(c.totalIncome ?? 0))}</TableCell>
                  <TableCell className="text-red-600">{formatXOF(Number(c.totalExpense ?? 0))}</TableCell>
                  <TableCell className="font-medium">{formatXOF(Number(c.netBalance ?? 0))}</TableCell>
                  <TableCell>{c.anomalyDetected ? <span className="text-red-600">Oui</span> : '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setDetailClosure(c)}><Eye className="h-4 w-4" /></Button>
                    {!c.validatedById && (
                      <Button variant="ghost" size="icon" onClick={() => { if (window.confirm(`Valider la clôture du ${new Date(c.date).toLocaleDateString('fr-FR')} ?`)) handleValidate(c.id); }}><CheckCircle className="h-4 w-4 text-green-600" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ModuleContentArea>
    </div>
  );
}
