'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Eye, Unlock, UserCog, Search, Download, Receipt, Clock } from 'lucide-react';
import { WhatsAppIcon, GmailIcon, SmsIcon } from './OfficialIcons';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Button, buttonVariants } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { financeService } from '@/services/finance.service';
import { classesService } from '@/services/classes.service';
import { getAcademicYears } from '@/services/settings.service';
import { formatCurrency } from '@/lib/utils';
import { filterAndSortClasses } from '@/lib/finance/class-sort';
import { Label } from '@/components/ui/label';

const STATUS_COLORS: Record<string, string> = {
  PAID: 'bg-green-100 text-green-800',
  PARTIAL: 'bg-yellow-100 text-yellow-800',
  OVERDUE: 'bg-orange-100 text-orange-800',
  BLOCKED: 'bg-red-100 text-red-800',
  ACTIVE: 'bg-blue-100 text-blue-800',
  CLOSED: 'bg-gray-100 text-gray-800',
};

export default function StudentAccountsContent() {
  const { academicYear } = useModuleContext();
  const searchParams = useSearchParams();
  const preselectStudentId = searchParams.get('studentId');
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Filtre année : par défaut l'année courante du module context, mais l'utilisateur peut changer
  const [filterYearId, setFilterYearId] = useState('');
  const [filterClassId, setFilterClassId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailAccount, setDetailAccount] = useState<any | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [unblockReason, setUnblockReason] = useState('');
  const [unblockModal, setUnblockModal] = useState<string | null>(null);

  // L'année effective = filtre utilisateur OU année du contexte
  const effectiveYearId = filterYearId || academicYear?.id || '';

  const loadAccounts = async () => {
    if (!effectiveYearId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ academicYearId: effectiveYearId });
      if (filterClassId) params.set('classId', filterClassId);
      if (filterStatus) params.set('status', filterStatus);
      const data = await financeService.getStudentAccounts(Object.fromEntries(params.entries()));
      setAccounts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [effectiveYearId, filterClassId, filterStatus]);

  useEffect(() => {
    classesService.getAll({})
      .then((d) => setClasses(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => setClasses([]));
    getAcademicYears()
      .then((d) => setAcademicYears(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => setAcademicYears([]));
  }, []);

  // Pré-sélectionner un élève si l'URL contient ?studentId=X
  // (depuis le bouton "Régime & Finance" dans le module Élève)
  useEffect(() => {
    if (preselectStudentId && accounts.length > 0) {
      // Trouver le compte de cet élève
      const account = accounts.find((a) => a.studentId === preselectStudentId);
      if (account) {
        setSelectedAccountId(account.id);
        loadPaymentHistory(account.id);
      }
    }
  }, [preselectStudentId, accounts]);

  const loadDetail = async (id: string) => {
    try {
      const data = await financeService.getStudentAccountDetails(id);
      setDetailAccount(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Charger l'historique des paiements d'un élève (tableau droit)
  // Utilise getStudentAccountDetails qui inclut les transactions
  const loadPaymentHistory = async (accountId: string) => {
    setLoadingHistory(true);
    try {
      const data = await financeService.getStudentAccountDetails(accountId);
      setPaymentHistory(data?.transactions ?? []);
    } catch (e) {
      console.error(e);
      setPaymentHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Sélectionner un élève dans le tableau gauche → charger son historique à droite
  const selectStudent = (accountId: string) => {
    setSelectedAccountId(accountId);
    loadPaymentHistory(accountId);
  };

  const handleUnblock = async () => {
    if (!unblockModal || !unblockReason.trim()) return;
    try {
      await financeService.unblockStudentAccount(unblockModal, { reason: unblockReason });
      setUnblockModal(null);
      setUnblockReason('');
      toast({ title: 'Compte débloqué', description: 'Le compte a été débloqué avec succès.' });
      loadAccounts();
      if (detailAccount?.id === unblockModal) loadDetail(unblockModal);
    } catch (error: any) {
      toast({ title: 'Erreur', description: error?.message || 'Erreur réseau', variant: 'destructive' });
    }
  };

  // Filtrage frontend par recherche (nom, prénom, matricule)
  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return accounts;
    const q = searchQuery.toLowerCase().trim();
    return accounts.filter((a) => {
      const name = `${a.student?.lastName || ''} ${a.student?.firstName || ''} ${a.student?.studentCode || ''}`.toLowerCase();
      return name.includes(q);
    });
  }, [accounts, searchQuery]);

  // Export CSV de la liste filtrée
  const handleExportCSV = () => {
    if (filteredAccounts.length === 0) {
      toast({ title: 'Aucune donnée', description: 'Rien à exporter.', variant: 'destructive' });
      return;
    }
    const headers = ['Élève', 'Matricule', 'Total dû', 'Payé', 'Solde', 'Statut', 'Personnalisé'];
    const rows = filteredAccounts.map((a) => {
      const name = a.student ? `${a.student.lastName} ${a.student.firstName}` : a.studentId;
      const matricule = a.student?.studentCode || '';
      const hasOverride = (a.breakdowns ?? []).some((b: any) => {
        const fsTotal = Number(b.feeStructure?.totalAmount ?? 0);
        const initial = Number(b.initialAmount ?? 0);
        return Math.abs(fsTotal - initial) > 0.01;
      });
      return [
        name,
        matricule,
        Number(a.totalDue ?? 0),
        Number(a.totalPaid ?? 0),
        Number(a.balance ?? 0),
        a.status || '',
        hasOverride ? 'Oui' : 'Non',
      ];
    });
    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const yearLabel = academicYears.find((y) => y.id === effectiveYearId)?.name || 'annee';
    link.href = url;
    link.download = `comptes-eleves-${yearLabel}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export réussi', description: `${filteredAccounts.length} compte(s) exporté(s).` });
  };

  return (
    <div className="space-y-4">
      <ModuleContentArea
        layout="custom"
        toolbar={
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-slate-600">
              Solde, total dû, payé et statut par élève et par année.
            </p>
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={filteredAccounts.length === 0}>
              <Download className="w-4 h-4 mr-2" />Exporter CSV
            </Button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap gap-4 items-end">
          {/* Filtre Année scolaire */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Année scolaire</Label>
            <Select
              value={filterYearId || (academicYear?.id ?? 'ALL')}
              onValueChange={(v) => setFilterYearId(v === 'ALL' ? '' : v)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Année courante" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={academicYear?.id ?? 'ALL'}>Année courante</SelectItem>
                {academicYears.filter((y) => y.id !== academicYear?.id).map((y) => (
                  <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Recherche par nom/matricule */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Rechercher</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nom, prénom ou matricule..."
                className="pl-9 w-[260px]"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Classe</Label>
            <Select value={filterClassId || 'ALL'} onValueChange={(v) => setFilterClassId(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Toutes les classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes les classes</SelectItem>
                {filterAndSortClasses(classes).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Statut</Label>
            <Select value={filterStatus || 'ALL'} onValueChange={(v) => setFilterStatus(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les statuts</SelectItem>
                <SelectItem value="PAID">Payé</SelectItem>
                <SelectItem value="PARTIAL">Partiel</SelectItem>
                <SelectItem value="OVERDUE">En retard</SelectItem>
                <SelectItem value="BLOCKED">Bloqué</SelectItem>
                <SelectItem value="ACTIVE">Actif</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Layout 2 tableaux côte à côte : Comptes (gauche) + Historique paiements (droite) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* TABLEAU GAUCHE — Comptes élèves (cliquable pour sélectionner) */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <UserCog className="w-4 h-4 text-slate-500" />
              Comptes élèves
            </h3>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Élève</TableHead>
                    <TableHead className="text-right">Total dû</TableHead>
                    <TableHead className="text-right">Payé</TableHead>
                    <TableHead className="text-right">Solde</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">Chargement...</TableCell>
                    </TableRow>
                  ) : filteredAccounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-12">
                        {searchQuery ? `Aucun élève trouvé pour « ${searchQuery} ».` : 'Aucun compte élève.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAccounts.map((a) => {
                      const hasOverride = (a.breakdowns ?? []).some((b: any) => {
                        const fsTotal = Number(b.feeStructure?.totalAmount ?? 0);
                        const initial = Number(b.initialAmount ?? 0);
                        return Math.abs(fsTotal - initial) > 0.01;
                      });
                      const isSelected = selectedAccountId === a.id;

                      // Code couleur basé sur le statut de paiement
                      const totalDue = Number(a.totalDue ?? 0);
                      const totalPaid = Number(a.totalPaid ?? 0);
                      const balance = Number(a.balance ?? 0);
                      let rowBg = '';
                      let rowBorder = '';
                      if (balance <= 0) {
                        rowBg = 'bg-green-50'; rowBorder = 'border-l-4 border-green-500';
                      } else if (totalPaid <= 0) {
                        rowBg = 'bg-red-50'; rowBorder = 'border-l-4 border-red-500';
                      } else if (a.status === 'OVERDUE' || a.status === 'BLOCKED') {
                        rowBg = 'bg-orange-50'; rowBorder = 'border-l-4 border-orange-500';
                      } else {
                        rowBg = 'bg-amber-50'; rowBorder = 'border-l-4 border-amber-400';
                      }

                      // Extraire les montants par type de frais depuis les breakdowns
                      const breakdowns = a.breakdowns ?? [];
                      const getAmounts = (feeType: string) => {
                        const b = breakdowns.find((bd: any) => bd.feeStructure?.feeType === feeType);
                        return {
                          due: b ? Number(b.initialAmount ?? 0) : 0,
                          paid: b ? Number(b.paidAmount ?? 0) : 0,
                          remaining: b ? Number(b.remainingAmount ?? 0) : 0,
                        };
                      };
                      const inscription = getAmounts('INSCRIPTION');
                      const reinscription = getAmounts('REINSCRIPTION');
                      const tuition = getAmounts('TUITION');
                      const hasReinscription = reinscription.due > 0;

                      // Helper pour afficher un détail de frais — Total dû figé (jamais de calcul)
                      const FeeDetail = ({ label, due }: { label: string; due: number; paid?: number; remaining?: number }) => {
                        if (due <= 0) return null;
                        return (
                          <div className="flex justify-between text-[10px] text-slate-500">
                            <span>{label} :</span>
                            <span>{formatCurrency(due)}</span>
                          </div>
                        );
                      };

                      return (
                        <TableRow
                          key={a.id}
                          className={`cursor-pointer transition-all duration-150 ${rowBorder} ${rowBg} ${
                            isSelected
                              ? 'ring-2 ring-blue-500 ring-inset bg-blue-50 shadow-sm'
                              : 'hover:bg-indigo-50 hover:shadow-sm'
                          }`}
                          onClick={() => selectStudent(a.id)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div>
                                {a.student ? `${a.student.lastName} ${a.student.firstName}` : a.studentId}
                              </div>
                              {hasOverride && (
                                <Badge variant="outline" className="text-purple-700 border-purple-300 bg-purple-50" title="Cet élève a une personnalisation de frais">
                                  <UserCog className="w-3 h-3 mr-1" />Pers.
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          {/* Total dû — avec détail par frais */}
                          <TableCell className="text-right">
                            <div className="font-semibold text-red-700">{formatCurrency(totalDue)}</div>
                            <div className="mt-1 space-y-0.5 min-w-[140px]">
                              {inscription.due > 0 && <FeeDetail label="Inscription" {...inscription} />}
                              {hasReinscription && <FeeDetail label="Réinscription" {...reinscription} />}
                              {tuition.due > 0 && <FeeDetail label="Scolarité" {...tuition} />}
                            </div>
                          </TableCell>
                          {/* Payé — avec détail par frais */}
                          <TableCell className="text-right">
                            <div className="font-semibold text-emerald-700">{formatCurrency(totalPaid)}</div>
                            <div className="mt-1 space-y-0.5 min-w-[140px]">
                              {inscription.due > 0 && (
                                <div className="flex justify-between text-[10px] text-slate-500">
                                  <span>Inscription :</span>
                                  <span>{formatCurrency(inscription.paid)}</span>
                                </div>
                              )}
                              {hasReinscription && (
                                <div className="flex justify-between text-[10px] text-slate-500">
                                  <span>Réinscription :</span>
                                  <span>{formatCurrency(reinscription.paid)}</span>
                                </div>
                              )}
                              {tuition.due > 0 && (
                                <div className="flex justify-between text-[10px] text-slate-500">
                                  <span>Scolarité :</span>
                                  <span>{formatCurrency(tuition.paid)}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          {/* Solde — avec détail par frais */}
                          <TableCell className="text-right">
                            <div className={`font-bold ${balance <= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(balance)}</div>
                            <div className="mt-1 space-y-0.5 min-w-[140px]">
                              {inscription.due > 0 && (
                                <div className="flex justify-between text-[10px] text-slate-500">
                                  <span>Inscription :</span>
                                  <span className={inscription.remaining <= 0 ? 'text-green-600' : ''}>{formatCurrency(inscription.remaining <= 0 ? 0 : inscription.remaining)}</span>
                                </div>
                              )}
                              {hasReinscription && (
                                <div className="flex justify-between text-[10px] text-slate-500">
                                  <span>Réinscription :</span>
                                  <span className={reinscription.remaining <= 0 ? 'text-green-600' : ''}>{formatCurrency(reinscription.remaining <= 0 ? 0 : reinscription.remaining)}</span>
                                </div>
                              )}
                              {tuition.due > 0 && (
                                <div className="flex justify-between text-[10px] text-slate-500">
                                  <span>Scolarité :</span>
                                  <span className={tuition.remaining <= 0 ? 'text-green-600' : ''}>{formatCurrency(tuition.remaining <= 0 ? 0 : tuition.remaining)}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_COLORS[a.status] ?? 'bg-gray-100 text-gray-800'}>{a.status}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* TABLEAU DROIT — Historique des encaissements de l'élève sélectionné */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-slate-500" />
              Historique des encaissements
              {selectedAccountId && (
                <span className="text-xs font-normal text-slate-500 ml-1">
                  ({filteredAccounts.find((a) => a.id === selectedAccountId)?.student
                    ? `${filteredAccounts.find((a) => a.id === selectedAccountId)?.student.lastName} ${filteredAccounts.find((a) => a.id === selectedAccountId)?.student.firstName}`
                    : '—'})
                </span>
              )}
            </h3>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {!selectedAccountId ? (
                <div className="text-center text-gray-500 py-16">
                  <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p>Sélectionnez un élève à gauche pour voir son historique de paiements.</p>
                </div>
              ) : loadingHistory ? (
                <div className="text-center text-gray-500 py-8">Chargement de l'historique...</div>
              ) : paymentHistory.length === 0 ? (
                <div className="text-center text-gray-500 py-16">
                  <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p>Aucun paiement enregistré pour cet élève.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="whitespace-nowrap">N° reçu</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Montant</TableHead>
                      <TableHead className="whitespace-nowrap">Mode</TableHead>
                      <TableHead className="whitespace-nowrap">Date</TableHead>
                      <TableHead className="whitespace-nowrap">Heure</TableHead>
                      <TableHead className="whitespace-nowrap">Référence</TableHead>
                      <TableHead className="whitespace-nowrap text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentHistory.map((t: any) => (
                      <TableRow key={t.id} className="hover:bg-slate-50">
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {t.receiptNumber || '—'}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-700 whitespace-nowrap">
                          {formatCurrency(t.amount)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline">
                            {(() => {
                              const labels: Record<string, string> = {
                                CASH: 'Espèces',
                                MOBILE_MONEY: 'Mobile Money',
                                WIRE: 'Virement',
                                FEDAPAY: 'Fedapay',
                              };
                              return labels[t.paymentMethod] || t.paymentMethod || '—';
                            })()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {t.createdAt ? new Date(t.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {t.createdAt ? new Date(t.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap" title={t.reference || ''}>
                          {t.reference || '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1 justify-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => window.open(financeService.getReceiptPdfUrl(t.id), '_blank')}
                              title="Visualiser le reçu"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-600" />
                            </Button>
                            <a
                              href={financeService.getReceiptPdfUrl(t.id)}
                              download={`recu-${t.receiptNumber || t.id}.pdf`}
                              title="Télécharger le reçu PDF"
                              className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-slate-100 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-600" />
                            </a>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={async () => {
                                try {
                                  const r = await financeService.resendReceipt(t.id, ['email']);
                                  const s = r?.channels?.email;
                                  if (s?.status === 'skipped') toast({ title: 'Contact manquant', description: s.reason, variant: 'destructive' });
                                  else toast({ title: 'Reçu envoyé', description: `Email envoyé${s?.to ? ` à ${s.to}` : ''}` });
                                } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
                              }}
                              title="Envoyer par email"
                            >
                              <GmailIcon className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={async () => {
                                try {
                                  const r = await financeService.resendReceipt(t.id, ['whatsapp']);
                                  const s = r?.channels?.whatsapp;
                                  if (s?.status === 'skipped') toast({ title: 'Contact manquant', description: s.reason, variant: 'destructive' });
                                  else toast({ title: 'Reçu envoyé', description: `WhatsApp envoyé${s?.to ? ` à ${s.to}` : ''}` });
                                } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
                              }}
                              title="Envoyer par WhatsApp"
                            >
                              <WhatsAppIcon className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={async () => {
                                try {
                                  const r = await financeService.resendReceipt(t.id, ['sms']);
                                  const s = r?.channels?.sms;
                                  if (s?.status === 'skipped') toast({ title: 'Contact manquant', description: s.reason, variant: 'destructive' });
                                  else toast({ title: 'Reçu envoyé', description: `SMS envoyé${s?.to ? ` à ${s.to}` : ''}` });
                                } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
                              }}
                              title="Envoyer par SMS"
                            >
                              <SmsIcon className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {/* Récapitulatif du total payé si historique non vide */}
              {selectedAccountId && paymentHistory.length > 0 && (
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-sm">
                  <span className="text-slate-500">Total encaissé :</span>
                  <span className="font-bold text-emerald-700">
                    {formatCurrency(paymentHistory.reduce((sum, t) => sum + Number(t.amount ?? 0), 0))}
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>
      </ModuleContentArea>
      {detailAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {detailAccount.student ? `${detailAccount.student.lastName} ${detailAccount.student.firstName}` : 'Détail compte'}
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><span className="text-gray-600">Total dû :</span> {formatCurrency(detailAccount.totalDue)}</div>
              <div><span className="text-gray-600">Total payé :</span> {formatCurrency(detailAccount.totalPaid)}</div>
              <div><span className="text-gray-600">Solde :</span> {formatCurrency(detailAccount.balance)}</div>
              <div><span className="text-gray-600">Statut :</span> <Badge className={STATUS_COLORS[detailAccount.status]}>{detailAccount.status}</Badge></div>
              {Number(detailAccount.arrearsAmount) > 0 && (
                <div className="col-span-2"><span className="text-gray-600">Arriérés (année précédente) :</span> {formatCurrency(detailAccount.arrearsAmount)}</div>
              )}
            </div>
            <h4 className="font-medium mb-2">Détail par frais</h4>
            <ul className="space-y-2">
              {Number(detailAccount.arrearsAmount) > 0 && (
                <li className="flex justify-between text-sm">
                  <span>Arriéré</span>
                  <span>{formatCurrency(detailAccount.arrearsAmount)} — Non payé</span>
                </li>
              )}
              {detailAccount.breakdowns?.map((b: any) => {
                const fsTotal = Number(b.feeStructure?.totalAmount ?? 0);
                const initial = Number(b.initialAmount ?? 0);
                const isOverridden = Math.abs(fsTotal - initial) > 0.01;
                return (
                  <li key={b.id} className="flex justify-between text-sm">
                    <span className="flex items-center gap-1">
                      {b.feeStructure?.name ?? b.feeStructureId}
                      {isOverridden && (
                        <Badge variant="outline" className="text-[10px] text-purple-700 border-purple-300 bg-purple-50 ml-1" title={`Personnalisé: ${formatCurrency(fsTotal)} → ${formatCurrency(initial)}`}>
                          <UserCog className="w-2.5 h-2.5 mr-0.5" />Pers.
                        </Badge>
                      )}
                    </span>
                    <span className={isOverridden ? 'text-purple-700' : ''}>
                      {isOverridden && <span className="line-through text-slate-400 mr-1">{formatCurrency(fsTotal)}</span>}
                      {formatCurrency(initial)} — Soldé: {formatCurrency(b.paidAmount)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {/* Section Personnalisations — liste les overrides de l'élève pour cette année */}
            {detailAccount.overrides?.length > 0 && (
              <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2 text-purple-900">
                  <UserCog className="w-4 h-4" />
                  Personnalisations appliquées ({detailAccount.overrides.length})
                </h4>
                <ul className="space-y-2">
                  {detailAccount.overrides.map((o: any) => {
                    const original = Number(o.feeStructure?.totalAmount ?? 0);
                    const custom = Number(o.customAmount ?? 0);
                    const reduction = Math.max(0, original - custom);
                    const reductionPct = original > 0 ? Math.round((reduction / original) * 100) : 0;
                    return (
                      <li key={o.id} className="text-sm bg-white rounded p-2 border border-purple-100">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800">{o.feeStructure?.name ?? '—'}</p>
                            <p className="text-xs text-slate-500">
                              {o.feeStructure?.class?.name ? `Classe: ${o.feeStructure.class.name} · ` : ''}
                              {reduction > 0 ? `Réduction: ${formatCurrency(reduction)} (${reductionPct}%)` : 'Aucune réduction'}
                            </p>
                            <p className="text-xs text-slate-500 italic mt-0.5">Motif: {o.reason}</p>
                          </div>
                          <div className="text-right whitespace-nowrap">
                            <p className="text-xs text-slate-400 line-through">{formatCurrency(original)}</p>
                            <p className="font-semibold text-emerald-700">{formatCurrency(custom)}</p>
                          </div>
                        </div>
                        {o.creator && (
                          <p className="text-[10px] text-slate-400 mt-1">
                            Par {o.creator.firstName || ''} {o.creator.lastName || ''} · {o.createdAt ? new Date(o.createdAt).toLocaleDateString('fr-FR') : ''}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {detailAccount.transactions?.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Dernières transactions</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  {detailAccount.transactions.slice(0, 5).map((t: any) => (
                    <li key={t.id}>{t.receiptNumber} — {formatCurrency(t.amount)} — {t.createdAt ? new Date(t.createdAt).toLocaleDateString('fr-FR') : ''}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2 justify-end">
              <Link href="/app/finance/payments" className={buttonVariants({ variant: 'outline' })}>Voir historique transactions</Link>
              {(detailAccount.transactions?.find((t: any) => t.receiptUrl)?.receiptUrl) && (
                <Button variant="outline" onClick={() => window.open(detailAccount.transactions.find((t: any) => t.receiptUrl).receiptUrl, '_blank')}>Voir reçu</Button>
              )}
              <Button variant="outline" onClick={() => setDetailAccount(null)}>Fermer</Button>
              {detailAccount.isBlocked && (
                <Button onClick={() => { setUnblockModal(detailAccount.id); setDetailAccount(null); }}>Débloquer</Button>
              )}
            </div>
          </div>
        </div>
      )}
      {unblockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-4">Levée de blocage</h3>
            <p className="text-sm text-gray-600 mb-2">Motif obligatoire (audit) :</p>
            <input
              className="w-full border rounded px-3 py-2 mb-4"
              value={unblockReason}
              onChange={(e) => setUnblockReason(e.target.value)}
              placeholder="Ex: accord de règlement"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setUnblockModal(null); setUnblockReason(''); }}>Annuler</Button>
              <Button onClick={handleUnblock} disabled={!unblockReason.trim()}>Débloquer</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
