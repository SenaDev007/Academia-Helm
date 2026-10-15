/**
 * ============================================================================
 * CANTEEN DAILY SALES — Vente journalière + Dispatching
 * ============================================================================
 * ⭐ 2026-10-15 — Modèle métier Cantine scolaire au Bénin
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Save, Trash2, Calendar, UtensilsCrossed, Split, Coins } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

const API_BASE = '/api/modules-complementaires/canteen/business';

export default function CanteenDailySales() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [saleForm, setSaleForm] = useState({ saleDate: new Date().toISOString().slice(0, 10), mealsSold: 0, pricePerMeal: 0, mealsPlanned: 0, mealsWasted: 0, sellerType: 'CANTINIERE', sellerName: '', notes: '' });
  const [dispatchForm, setDispatchForm] = useState({ restockAmount: 0, schoolRate: 0, sellerRate: 0, notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sales?academicYearId=${academicYear.id}`, { credentials: 'include' });
      if (res.ok) setSales(await res.json());
    } catch { /* silent */ } finally { setLoading(false); }
  }, [academicYear?.id]);

  useEffect(() => { load(); }, [load]);

  const totalRevenue = (sales ?? []).reduce((acc, s) => acc + parseFloat(s.totalRevenue || 0), 0);
  const totalMeals = (sales ?? []).reduce((acc, s) => acc + parseInt(s.mealsSold || 0), 0);
  const totalSavings = (sales ?? []).reduce((acc, s) => acc + parseFloat(s.savingsAmount || 0), 0);

  const handleCreateSale = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/sales?academicYearId=${academicYear.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(saleForm),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Erreur');
      setSaleModalOpen(false);
      setSaleForm({ saleDate: new Date().toISOString().slice(0, 10), mealsSold: 0, pricePerMeal: 0, mealsPlanned: 0, mealsWasted: 0, sellerType: 'CANTINIERE', sellerName: '', notes: '' });
      await load();
      toast({ title: '✅ Vente enregistrée' });
    } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
    finally { setSubmitting(false); }
  };

  const handleOpenDispatch = (sale: any) => {
    setSelectedSale(sale);
    setDispatchForm({ restockAmount: 0, schoolRate: 0, sellerRate: 0, notes: '' });
    setDispatchModalOpen(true);
  };

  const handleCreateDispatch = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/sales/${selectedSale.id}/dispatch?academicYearId=${academicYear.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(dispatchForm),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Erreur');
      const result = await res.json();
      setDispatchModalOpen(false);
      await load();
      toast({ title: '✅ Dispatching effectué', description: `Épargne: ${result.savingsAmount.toLocaleString('fr-FR')} F` });
    } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
    finally { setSubmitting(false); }
  };

  const handleDeleteSale = async (id: string) => {
    if (!confirm('Supprimer cette vente ?')) return;
    try { await fetch(`${API_BASE}/sales/${id}`, { method: 'DELETE', credentials: 'include' }); await load(); toast({ title: '✅ Vente supprimée' }); }
    catch { toast({ title: 'Erreur', variant: 'destructive' }); }
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 shadow-sm"><div className="flex items-center gap-3"><UtensilsCrossed className="w-8 h-8 p-2 bg-green-50 text-green-600 rounded-lg" /><div><p className="text-xs text-slate-500">Recette totale</p><p className="text-2xl font-bold text-green-700">{totalRevenue.toLocaleString('fr-FR')} F</p></div></div></Card>
        <Card className="p-6 shadow-sm"><div className="flex items-center gap-3"><Calendar className="w-8 h-8 p-2 bg-blue-50 text-blue-600 rounded-lg" /><div><p className="text-xs text-slate-500">Repas vendus</p><p className="text-2xl font-bold text-blue-700">{totalMeals}</p></div></div></Card>
        <Card className="p-6 shadow-sm"><div className="flex items-center gap-3"><Coins className="w-8 h-8 p-2 bg-amber-50 text-amber-600 rounded-lg" /><div><p className="text-xs text-slate-500">Épargne totale</p><p className="text-2xl font-bold text-amber-700">{totalSavings.toLocaleString('fr-FR')} F</p></div></div></Card>
      </div>

      <Card className="p-0 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div><h3 className="font-semibold text-slate-900 text-lg">Ventes journalières</h3><p className="text-sm text-slate-500">Enregistrez les repas vendus chaque jour</p></div>
          <Button onClick={() => setSaleModalOpen(true)}><Plus className="w-4 h-4 mr-2" />Nouvelle vente</Button>
        </div>
        {(sales ?? []).length === 0 ? (
          <div className="text-center py-12 text-slate-500">Aucune vente enregistrée.</div>
        ) : (
          <Table>
            <TableHeader><TableRow className="bg-slate-50">
              <TableHead>Date</TableHead><TableHead>Repas vendus</TableHead><TableHead>Prix/repas</TableHead><TableHead>Recette</TableHead><TableHead>Dispatching</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(sales ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-xs">{s.saleDate}</TableCell>
                  <TableCell className="text-xs">{s.mealsSold}</TableCell>
                  <TableCell className="text-xs">{parseFloat(s.pricePerMeal).toLocaleString('fr-FR')} F</TableCell>
                  <TableCell className="text-xs font-bold">{parseFloat(s.totalRevenue).toLocaleString('fr-FR')} F</TableCell>
                  <TableCell className="text-xs">
                    {s.dispatchId ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">Dispatché — Épargne: {parseFloat(s.savingsAmount || 0).toLocaleString('fr-FR')} F</span>
                    ) : (
                      <button onClick={() => handleOpenDispatch(s)} className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold hover:bg-amber-100"><Split className="w-3 h-3 inline mr-1" />Dispatcher</button>
                    )}
                  </TableCell>
                  <TableCell className="text-right"><button onClick={() => handleDeleteSale(s.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4" /></button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Modal Vente */}
      <Dialog open={saleModalOpen} onOpenChange={setSaleModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouvelle vente journalière</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Date</Label><Input type="date" value={saleForm.saleDate} onChange={(e) => setSaleForm({ ...saleForm, saleDate: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Repas vendus</Label><Input type="number" value={saleForm.mealsSold} onChange={(e) => setSaleForm({ ...saleForm, mealsSold: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>Prix par repas (F)</Label><Input type="number" value={saleForm.pricePerMeal} onChange={(e) => setSaleForm({ ...saleForm, pricePerMeal: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Repas prévus</Label><Input type="number" value={saleForm.mealsPlanned} onChange={(e) => setSaleForm({ ...saleForm, mealsPlanned: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>Repas gaspillés</Label><Input type="number" value={saleForm.mealsWasted} onChange={(e) => setSaleForm({ ...saleForm, mealsWasted: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div><Label>Vendeur</Label><select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" value={saleForm.sellerType} onChange={(e) => setSaleForm({ ...saleForm, sellerType: e.target.value })}><option value="CANTINIERE">Cantinière</option><option value="SELLER">Vendeur délégué</option></select></div>
            {saleForm.sellerType === 'SELLER' && <div><Label>Nom du vendeur</Label><Input value={saleForm.sellerName} onChange={(e) => setSaleForm({ ...saleForm, sellerName: e.target.value })} /></div>}
            <div className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg">Recette totale: <strong>{(saleForm.mealsSold * saleForm.pricePerMeal).toLocaleString('fr-FR')} F</strong></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setSaleModalOpen(false)}>Annuler</Button><Button onClick={handleCreateSale} disabled={submitting}>{submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Dispatching */}
      <Dialog open={dispatchModalOpen} onOpenChange={setDispatchModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Dispatching journalier</DialogTitle></DialogHeader>
          {selectedSale && (
            <div className="space-y-3">
              <div className="bg-slate-50 p-3 rounded-lg text-sm">Recette du jour: <strong>{parseFloat(selectedSale.totalRevenue).toLocaleString('fr-FR')} F</strong> ({selectedSale.mealsSold} repas)</div>
              <div><Label>Réapprovisionnement (F)</Label><Input type="number" value={dispatchForm.restockAmount} onChange={(e) => setDispatchForm({ ...dispatchForm, restockAmount: parseFloat(e.target.value) || 0 })} /><p className="text-xs text-slate-400">Achats pour le lendemain</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Part école (%)</Label><Input type="number" value={dispatchForm.schoolRate} onChange={(e) => setDispatchForm({ ...dispatchForm, schoolRate: parseFloat(e.target.value) || 0 })} /></div>
                <div><Label>Part vendeur (%)</Label><Input type="number" value={dispatchForm.sellerRate} onChange={(e) => setDispatchForm({ ...dispatchForm, sellerRate: parseFloat(e.target.value) || 0 })} /></div>
              </div>
              <div className="bg-emerald-50 p-3 rounded-lg text-sm">
                Épargne/bénéfice: <strong className="text-emerald-700">
                  {(parseFloat(selectedSale.totalRevenue) - dispatchForm.restockAmount - (parseFloat(selectedSale.totalRevenue) * dispatchForm.schoolRate / 100) - (parseFloat(selectedSale.totalRevenue) * dispatchForm.sellerRate / 100)).toLocaleString('fr-FR')} F
                </strong>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setDispatchModalOpen(false)}>Annuler</Button><Button onClick={handleCreateDispatch} disabled={submitting}>{submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Dispatcher</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
