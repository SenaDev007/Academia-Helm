/**
 * ============================================================================
 * LIBRARY BORROWINGS (EMPRUNTS) — Branché sur backend réel (Standardisé)
 * ============================================================================
 *
 * Endpoint (lecture)   : GET  /modules-complementaires/library/loans
 * Endpoint (création)  : POST /modules-complementaires/library/loans
 * Endpoint (retour)    : POST /modules-complementaires/library/loans/:id/return
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { ArrowUpCircle, Calendar, Clock, MoreVertical, Plus, Filter, Search, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface LoanItem {
  id: string;
  reader?: string;
  readerName?: string;
  student?: string;
  user?: string;
  class?: string;
  className?: string;
  book?: string;
  bookTitle?: string;
  title?: string;
  date?: string;
  loanDate?: string;
  borrowedAt?: string;
  due?: string;
  dueDate?: string;
  expectedReturnDate?: string;
  status?: string;
  [key: string]: any;
}

interface NewLoanFormData {
  readerId: string;
  bookId: string;
  dueDate: string;
}

const emptyLoanForm: NewLoanFormData = { readerId: '', bookId: '', dueDate: '' };

export default function LibraryBorrowings() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<NewLoanFormData>(emptyLoanForm);
  const [submitting, setSubmitting] = useState(false);
  const { data: loans, loading, error, refetch } = useModulesList<LoanItem>(
    'library',
    'loans',
    academicYear?.id,
    { status: 'active', ...(search ? { search } : {}) },
  );

  const handleReturn = async (loanId: string) => {
    try {
      setActionLoading(loanId);
      await modulesApi.post(
        `library/loans/${loanId}/return`,
        {},
        buildModulesApiOptions(academicYear?.id),
      );
      await refetch();
      toast({ title: 'Retour enregistré', description: 'Le prêt a été marqué comme retourné.' });
    } catch (e: any) {
      console.error('Erreur retour de prêt :', e?.message || e);
      toast({ title: 'Erreur', description: `Erreur lors du retour : ${e?.message || 'Erreur inconnue'}`, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateLoan = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post(
        'library/loans',
        formData,
        buildModulesApiOptions(academicYear?.id),
      );
      setModalOpen(false);
      setFormData(emptyLoanForm);
      await refetch();
      toast({ title: 'Emprunt créé', description: 'Le nouvel emprunt a été enregistré.' });
    } catch (e: any) {
      console.error('Erreur création emprunt :', e?.message || e);
      toast({ title: 'Erreur', description: e?.message || "Erreur lors de la création de l'emprunt", variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des emprunts...</span>
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
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un emprunt..."
            className="w-full pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon">
            <Filter className="w-5 h-5" />
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nouvel Emprunt
          </Button>
        </div>
      </div>

      {loans.length === 0 ? (
        <Card className="text-center py-16 text-gray-500 shadow-sm">
          Aucun emprunt actif pour cette année scolaire.
        </Card>
      ) : (
      <div className="grid grid-cols-1 gap-4">
        {loans.map((loan) => {
          const reader = loan.reader ?? loan.readerName ?? loan.student ?? loan.user ?? '—';
          const className = loan.class ?? loan.className ?? '—';
          const bookTitle = loan.book ?? loan.bookTitle ?? loan.title ?? '—';
          const loanDate = loan.date ?? loan.loanDate ?? loan.borrowedAt ?? '—';
          const dueDate = loan.due ?? loan.dueDate ?? loan.expectedReturnDate ?? '—';
          const status = (loan.status ?? 'ACTIVE').toString().toUpperCase();
          const isOverdue = status === 'OVERDUE';
          return (
          <Card key={loan.id} className={`p-6 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center justify-between gap-6 border-l-8 ${
            isOverdue ? 'border-l-rose-500' : 'border-l-blue-500'
          }`}>
            <div className="flex items-center gap-6 flex-1">
              <div className={`p-4 rounded-xl ${isOverdue ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                <ArrowUpCircle className="w-8 h-8" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 flex-1">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Lecteur</p>
                  <p className="font-semibold text-slate-900">{reader}</p>
                  <p className="text-xs font-medium text-blue-600">{className}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Livre / Ressource</p>
                  <p className="font-medium text-slate-700 leading-tight">{bookTitle}</p>
                  <p className="text-xs text-slate-400">ID: {loan.id}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Date d'emprunt</p>
                  <p className="font-medium text-slate-700 flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-2 text-slate-300" />
                    {loanDate}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Retour prévu</p>
                  <p className={`font-semibold flex items-center ${isOverdue ? 'text-rose-600' : 'text-slate-700'}`}>
                    <Clock className="w-3.5 h-3.5 mr-2" />
                    {dueDate}
                  </p>
                  {isOverdue && <Badge variant="destructive" className="mt-1 animate-pulse">En retard !</Badge>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => handleReturn(loan.id)}
                disabled={actionLoading === loan.id}
                className="text-emerald-600 hover:bg-emerald-600 hover:text-white"
              >
                {actionLoading === loan.id ? 'En cours…' : 'Retourner'}
              </Button>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-5 h-5 text-slate-300" />
              </Button>
            </div>
          </Card>
          );
        })}
      </div>
      )}

      {/* Modal Nouvel Emprunt */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvel Emprunt</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="loan-reader">Lecteur (ID)</Label>
              <Input
                id="loan-reader"
                type="text"
                placeholder="ex : student-123"
                value={formData.readerId}
                onChange={(e) => setFormData({ ...formData, readerId: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loan-book">Livre (ID)</Label>
              <Input
                id="loan-book"
                type="text"
                placeholder="ex : book-456"
                value={formData.bookId}
                onChange={(e) => setFormData({ ...formData, bookId: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loan-due">Date de retour prévue</Label>
              <Input
                id="loan-due"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={handleCreateLoan} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi…' : "Créer l'emprunt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
