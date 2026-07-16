/**
 * ============================================================================
 * LIBRARY PENALTIES & LOSSES (Standardisé)
 * ============================================================================
 *
 * TODO: endpoint non disponible — garder mock. Aucun endpoint GET library/penalties
 * n'est exposé par le backend modules-complementaires. Les pénalités sont
 * actuellement calculées à la volée sur les prêts retournés (library/loans).
 * ============================================================================
 */

'use client';

import { AlertCircle, Search, Filter, MoreVertical, CreditCard, Clock, CheckCircle2, Ban } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';

export default function LibraryPenalties() {
  const { toast } = useToast();
  const penalties = [
    { id: 'PN-4001', reader: 'Jean Lawson', book: 'Le Petit Prince', motif: 'RETARD (15 jours)', amount: '1 500 F CFA', status: 'PENDING', date: '12/05/2026' },
    { id: 'PN-4002', reader: 'Saliou Diallo', book: 'Physique 3ème', motif: 'LIVRE ABÎMÉ', amount: '5 000 F CFA', status: 'PAID', date: '10/05/2026' },
    { id: 'PN-4003', reader: 'Sarah Goussi', book: 'Dictionnaire Anglais', motif: 'PERTE DE LIVRE', amount: '12 500 F CFA', status: 'OVERDUE', date: '05/05/2026' },
    { id: 'PN-4004', reader: 'M. Saliou', book: 'L\'Enfant Noir', motif: 'RETARD (2 jours)', amount: '1 000 F CFA', status: 'CANCELLED', date: '01/05/2026' },
  ];

  const getStatusVariant = (status: string): 'outline' | 'secondary' | 'destructive' => {
    switch (status) {
      case 'PAID': return 'outline';
      case 'PENDING': return 'secondary';
      case 'OVERDUE': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Banner for serious issues */}
      <div className="bg-rose-50 border border-rose-100 rounded-xl p-6 flex items-center gap-6">
        <div className="p-3 bg-white rounded-xl shadow-sm text-rose-600">
          <Ban className="w-8 h-8 animate-pulse" />
        </div>
        <div className="flex-1">
          <h4 className="text-lg font-semibold text-rose-900">Lecteurs Suspendus</h4>
          <p className="text-rose-700/80 text-sm">3 lecteurs ont des pénalités critiques en attente. Leurs droits d'emprunt sont automatiquement bloqués.</p>
        </div>
        <Button
          variant="destructive"
          onClick={() => toast({ title: 'Blocages', description: 'Gestion des blocages — fonctionnalité à venir.' })}
        >
          Gérer les blocages
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-slate-900">Registre des Pénalités</h3>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input type="text" placeholder="Lecteur..." className="pl-10 w-48" />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="px-6 py-4">Lecteur & Motif</TableHead>
              <TableHead className="px-6 py-4">Montant</TableHead>
              <TableHead className="px-6 py-4">Statut</TableHead>
              <TableHead className="px-6 py-4">Date</TableHead>
              <TableHead className="px-6 py-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {penalties.map((pn) => (
              <TableRow key={pn.id} className="hover:bg-slate-50">
                <TableCell className="px-6 py-4">
                  <div>
                    <p className="font-semibold text-slate-900">{pn.reader}</p>
                    <p className="text-xs text-slate-400">{pn.motif} • {pn.book}</p>
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4">
                  <span className="text-sm font-semibold text-slate-900">{pn.amount}</span>
                </TableCell>
                <TableCell className="px-6 py-4">
                  <Badge variant={getStatusVariant(pn.status)} className={
                    pn.status === 'PAID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    pn.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                    pn.status === 'OVERDUE' ? 'bg-rose-50 text-rose-600 border-rose-100' : ''
                  }>
                    {pn.status === 'PAID' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                    {pn.status === 'PENDING' && <Clock className="w-3 h-3 mr-1" />}
                    {pn.status === 'OVERDUE' && <Ban className="w-3 h-3 mr-1" />}
                    {pn.status}
                  </Badge>
                </TableCell>
                <TableCell className="px-6 py-4 text-sm font-medium text-slate-500">{pn.date}</TableCell>
                <TableCell className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600" title="Encaisser">
                      <CreditCard className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-5 h-5 text-slate-300" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
