/**
 * ============================================================================
 * CANTEEN TREASURY — Caisse / Trésorerie (Capital + Achats)
 * ============================================================================
 * ⭐ 2026-10-15 — Modèle métier Cantine scolaire au Bénin
 *
 * Backend : /api/modules-complementaires/canteen/business/
 *   GET/POST /fund       — Capital
 *   GET/POST /purchases  — Achats
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Save, Trash2, Package, Wallet, ShoppingCart, TrendingUp } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

const API_BASE = '/api/modules-complementaires/canteen/business';

export default function CanteenTreasury() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();

  const [fund, setFund] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fundModalOpen, setFundModalOpen] = useState(false);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [fundForm, setFundForm] = useState({ initialCapital: 0, notes: '' });
  const [purchaseForm, setPurchaseForm] = useState({
    purchaseDate: new Date().toISOString().slice(0, 10),
    items: '', totalAmount: 0, supplierName: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    const yearId = `academicYearId=${academicYear.id}`;
    try {
      const [fundRes, purchRes] = await Promise.all([
        fetch(`${API_BASE}/fund?${yearId}`, { credentials: 'include' }),
        fetch(`${API_BASE}/purchases?${yearId}`, { credentials: 'include' }),
      ]);
      if (fundRes.ok) setFund(await fundRes.json());
      if (purchRes.ok) setPurchases(await purchRes.json());
    } catch { /* silent */ } finally { setLoading(false); }
  }, [academicYear?.id]);

  useEffect(() => { load(); }, [load]);

  const handleCreateFund = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/fund?academicYearId=${academicYear.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(fundForm),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Erreur');
      setFundModalOpen(false);
      await load();
      toast({ title: '✅ Capital défini' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const handleCreatePurchase = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/purchases?academicYearId=${academicYear.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          ...purchaseForm,
          items: purchaseForm.items ? purchaseForm.items.split('\n').map((s: string) => s.trim()).filter(Boolean).map((item: string) => ({ name: item })) : [],
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Erreur');
      setPurchaseModalOpen(false);
      setPurchaseForm({ purchaseDate: new Date().toISOString().slice(0, 10), items: '', totalAmount: 0, supplierName: '', notes: '' });
      await load();
      toast({ title: '✅ Achat enregistré' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const handleDeletePurchase = async (id: string) => {
    if (!confirm('Supprimer cet achat ? Le montant sera remboursé au capital.')) return;
    try {
      await fetch(`${API_BASE}/purchases/${id}`, { method: 'DELETE', credentials: 'include' });
      await load();
      toast({ title: '✅ Achat supprimé' });
    } catch { toast({ title: 'Erreur', variant: 'destructive' }); }
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2"><Wallet className="w-8 h-8 p-2 bg-blue-50 text-blue-600 rounded-lg" /><div><p className="text-xs text-slate-500">Capital initial</p><p className="text-2xl font-bold text-slate-900">{fund ? parseFloat(fund.initialCapital).toLocaleString('fr-FR') + ' F' : '—'}</p></div></div>
        </Card>
        <Card className="p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2"><TrendingUp className="w-8 h-8 p-2 bg-emerald-50 text-emerald-600 rounded-lg" /><div><p className="text-xs text-slate-500">Solde actuel</p><p className="text-2xl font-bold text-emerald-700">{fund ? parseFloat(fund.currentBalance).toLocaleString('fr-FR') + ' F' : '—'}</p></div></div>
        </Card>
        <Card className="p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2"><ShoppingCart className="w-8 h-8 p-2 bg-amber-50 text-amber-600 rounded-lg" /><div><p className="text-xs text-slate-500">Total achats</p><p className="text-2xl font-bold text-amber-700">{purchases.reduce((acc, p) => acc + parseFloat(p.totalAmount || 0), 0).toLocaleString('fr-FR')} F</p></div></div>
        </Card>
      </div>

      {/* Capital */}
      <Card className="p-0 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div><h3 className="font-semibold text-slate-900 text-lg">Capital de la cantine</h3><p className="text-sm text-slate-500">Capital de départ versé par le promoteur</p></div>
          {!fund && <Button onClick={() => setFundModalOpen(true)}><Plus className="w-4 h-4 mr-2" />Définir le capital</Button>}
        </div>
        {fund ? (
          <div className="p-6 grid grid-cols-2 gap-4">
            <div><Label>Capital initial</Label><p className="text-lg font-bold">{parseFloat(fund.initialCapital).toLocaleString('fr-FR')} F</p></div>
            <div><Label>Solde actuel</Label><p className="text-lg font-bold text-emerald-700">{parseFloat(fund.currentBalance).toLocaleString('fr-FR')} F</p></div>
            {fund.notes && <div className="col-span-2"><Label>Notes</Label><p className="text-sm text-slate-600">{fund.notes}</p></div>}
          </div>
        ) : (
          <div className="p-6 text-center text-slate-500">Aucun capital défini pour cette année.</div>
        )}
      </Card>

      {/* Achats */}
      <Card className="p-0 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div><h3 className="font-semibold text-slate-900 text-lg">Achats journaliers</h3><p className="text-sm text-slate-500">Approvisionnement par la cantinière</p></div>
          <Button onClick={() => setPurchaseModalOpen(true)}><Plus className="w-4 h-4 mr-2" />Nouvel achat</Button>
        </div>
        {(purchases ?? []).length === 0 ? (
          <div className="text-center py-12 text-slate-500">Aucun achat enregistré.</div>
        ) : (
          <Table>
            <TableHeader><TableRow className="bg-slate-50">
              <TableHead>Date</TableHead><TableHead>Articles</TableHead><TableHead>Fournisseur</TableHead><TableHead>Montant</TableHead><TableHead className="text-right">Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(purchases ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">{p.purchaseDate}</TableCell>
                  <TableCell className="text-xs max-w-xs truncate">{Array.isArray(p.items) ? p.items.map((i: any) => i.name || i).join(', ') : '—'}</TableCell>
                  <TableCell className="text-xs">{p.supplierName || 'Cantinière'}</TableCell>
                  <TableCell className="text-xs font-bold">{parseFloat(p.totalAmount).toLocaleString('fr-FR')} F</TableCell>
                  <TableCell className="text-right"><button onClick={() => handleDeletePurchase(p.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4" /></button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Modal Capital */}
      <Dialog open={fundModalOpen} onOpenChange={setFundModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Définir le capital de la cantine</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Montant du capital (FCFA)</Label><Input type="number" value={fundForm.initialCapital} onChange={(e) => setFundForm({ ...fundForm, initialCapital: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Notes (optionnel)</Label><Input value={fundForm.notes} onChange={(e) => setFundForm({ ...fundForm, notes: e.target.value })} placeholder="Ex: Capital versé par le promoteur pour l'année..." /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setFundModalOpen(false)}>Annuler</Button><Button onClick={handleCreateFund} disabled={submitting}>{submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Définir</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Achat */}
      <Dialog open={purchaseModalOpen} onOpenChange={setPurchaseModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouvel achat</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Date</Label><Input type="date" value={purchaseForm.purchaseDate} onChange={(e) => setPurchaseForm({ ...purchaseForm, purchaseDate: e.target.value })} /></div>
            <div><Label>Articles (un par ligne)</Label><textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" rows={4} placeholder="Riz 25kg&#10;Tomate 5kg&#10;Huile 5L" value={purchaseForm.items} onChange={(e) => setPurchaseForm({ ...purchaseForm, items: e.target.value })} /></div>
            <div><Label>Montant total (FCFA)</Label><Input type="number" value={purchaseForm.totalAmount} onChange={(e) => setPurchaseForm({ ...purchaseForm, totalAmount: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Fournisseur (optionnel)</Label><Input value={purchaseForm.supplierName} onChange={(e) => setPurchaseForm({ ...purchaseForm, supplierName: e.target.value })} placeholder="Nom du fournisseur ou 'Cantinière'" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPurchaseModalOpen(false)}>Annuler</Button><Button onClick={handleCreatePurchase} disabled={submitting}>{submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
