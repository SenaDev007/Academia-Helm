/**
 * ============================================================================
 * LIBRARY RETURNS (RETOURS) — Branché sur backend réel (Standardisé)
 * ============================================================================
 *
 * Endpoint (lecture)  : GET  /modules-complementaires/library/loans?status=returned
 * Endpoint (retour)   : POST /modules-complementaires/library/loans/:id/return
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { ArrowDownCircle, CheckCircle2, AlertCircle, Calendar, ShieldCheck, Search, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface LoanItem {
  id: string;
  reader?: string;
  readerName?: string;
  student?: string;
  user?: string;
  book?: string;
  bookTitle?: string;
  title?: string;
  date?: string;
  returnDate?: string;
  returnedAt?: string;
  condition?: string;
  state?: string;
  penalty?: string;
  penaltyAmount?: number;
  fee?: number;
  [key: string]: any;
}

export default function LibraryReturns() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [returningId, setReturningId] = useState<string | null>(null);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [manualLoanId, setManualLoanId] = useState('');
  const { data: returns, loading, error, refetch } = useModulesList<LoanItem>(
    'library',
    'loans',
    academicYear?.id,
    { status: 'returned', ...(search ? { search } : {}) },
  );

  const handleReturn = async (loanId: string) => {
    try {
      setReturningId(loanId);
      await modulesApi.post(
        `library/loans/${loanId}/return`,
        {},
        buildModulesApiOptions(academicYear?.id),
      );
      await refetch();
      toast({ title: 'Retour validé', description: 'Le retour a été enregistré avec succès.' });
    } catch (e: any) {
      console.error('Erreur validation retour :', e?.message || e);
      toast({ title: 'Erreur', description: `Erreur lors de la validation du retour : ${e?.message || 'Erreur inconnue'}`, variant: 'destructive' });
    } finally {
      setReturningId(null);
    }
  };

  const confirmManualReturn = () => {
    const id = manualLoanId.trim();
    if (!id) return;
    setReturnModalOpen(false);
    setManualLoanId('');
    handleReturn(id);
  };

  const formatPenalty = (item: LoanItem) => {
    if (item.penalty) return item.penalty;
    const amt = item.penaltyAmount ?? item.fee ?? 0;
    return amt > 0 ? `${amt.toLocaleString('fr-FR')} F CFA` : '0 F CFA';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des retours...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-slate-900">Historique des Retours</h3>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="pl-10 w-48"
            />
          </div>
          <Button
            onClick={() => setReturnModalOpen(true)}
            disabled={!!returningId}
          >
            <ArrowDownCircle className="w-4 h-4 mr-2" />
            {returningId ? 'En cours…' : 'Valider Retour'}
          </Button>
        </div>
      </div>

      {returns.length === 0 ? (
        <Card className="text-center py-16 text-gray-500 shadow-sm">
          Aucun retour enregistré pour cette année scolaire.
        </Card>
      ) : (
      <Card className="shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="px-6 py-4">Lecteur & Livre</TableHead>
              <TableHead className="px-6 py-4">Date Retour</TableHead>
              <TableHead className="px-6 py-4">État au Retour</TableHead>
              <TableHead className="px-6 py-4">Pénalité Appliquée</TableHead>
              <TableHead className="px-6 py-4 text-right">Justificatif</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {returns.map((ret) => {
              const reader = ret.reader ?? ret.readerName ?? ret.student ?? ret.user ?? '—';
              const bookTitle = ret.book ?? ret.bookTitle ?? ret.title ?? '—';
              const returnDate = ret.date ?? ret.returnDate ?? ret.returnedAt ?? '—';
              const condition = (ret.condition ?? ret.state ?? 'CONFORME').toString().toUpperCase();
              const isConforme = condition === 'CONFORME';
              const penalty = formatPenalty(ret);
              return (
              <TableRow key={ret.id} className="hover:bg-slate-50">
                <TableCell className="px-6 py-4">
                  <div>
                    <p className="font-semibold text-slate-900">{reader}</p>
                    <p className="text-xs text-slate-400">{bookTitle}</p>
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4">
                  <div className="flex items-center text-xs font-medium text-slate-500">
                    <Calendar className="w-4 h-4 mr-2 text-slate-300" />
                    {returnDate}
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4">
                  <Badge variant="outline" className={isConforme ? 'text-emerald-600 border-emerald-100' : 'text-amber-600 border-amber-100'}>
                    {isConforme ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                    {condition}
                  </Badge>
                </TableCell>
                <TableCell className="px-6 py-4">
                  <span className={`text-sm font-semibold ${penalty !== '0 F CFA' ? 'text-rose-600' : 'text-slate-900'}`}>{penalty}</span>
                </TableCell>
                <TableCell className="px-6 py-4 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ShieldCheck className="w-4 h-4 text-slate-400" />
                  </Button>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      )}

      {/* Modal Validation manuelle retour */}
      <Dialog open={returnModalOpen} onOpenChange={setReturnModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Valider un retour</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="return-loan-id">ID de l'emprunt à retourner</Label>
              <Input
                id="return-loan-id"
                type="text"
                placeholder="ex : loan-123"
                value={manualLoanId}
                onChange={(e) => setManualLoanId(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={confirmManualReturn} disabled={!manualLoanId.trim() || !!returningId}>
              {returningId && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Valider le retour
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
