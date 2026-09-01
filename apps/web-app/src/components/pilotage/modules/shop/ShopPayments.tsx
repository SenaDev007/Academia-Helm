/**
 * ============================================================================
 * SHOP PAYMENTS — Historique des ventes + reçus PDF
 * ============================================================================
 *
 * Refonte sept 2026 : alignement sur le pattern Finance/Encaissement.
 *  - Affiche le total des ventes encaissées (pas "-0")
 *  - Carte "Total Portefeuille" seule, pleine largeur, hauteur proportionnelle
 *  - Suppression de la carte "Méthodes Favorites" (redondante)
 *  - Colonnes corrigées : Référence=saleNumber, Méthode=paymentMode (mappé),
 *    Montant=totalAmount (pas amount)
 *  - Colonne Actions : boutons Reçu PDF (Download / Email / Helm Connect)
 *    qui appellent les endpoints /api/modules-complementaires/shop/sales/:id/receipt.pdf
 *    et /resend — pattern identique à TransactionsContent (Finance).
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import {
  Loader2, Wallet, CreditCard, Banknote, History, Search, Filter,
  ArrowUpRight, ArrowDownLeft, Plus, Smartphone, User,
  Download, Mail, FileText, RefreshCw,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import DocumentPreviewModal from '@/components/students/DocumentPreviewModal';
import { GmailIcon, HelmConnectIcon } from '@/components/finance/OfficialIcons';

interface SaleItem {
  id?: string;
  saleNumber?: string;
  refNo?: string;
  reference?: string;
  customerName?: string;
  clientName?: string;
  studentName?: string;
  paymentMode?: string;
  method?: string;
  paymentMethod?: string;
  totalAmount?: number;
  amount?: number;
  total?: number;
  subTotal?: number;
  paymentStatus?: string;
  status?: string;
  saleDate?: string;
  date?: string;
  createdAt?: string;
  customerType?: string;
  // ⭐ Items détaillés (articles achetés) — pour afficher le détail
  //    dans l'historique des paiements. Le backend renvoie `items` avec
  //    chaque item contenant { product: { name }, quantity, unitPrice, totalPrice }.
  items?: Array<{
    product?: { name?: string; code?: string };
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
  }>;
}

// ⭐ Mapping des codes de paiement → libellés français lisibles.
// Le backend stocke paymentMode en uppercase ('CASH', 'FEDAPAY', 'WALLET', 'CARD').
const PAYMENT_MODE_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  cash: 'Espèces',
  FEDAPAY: 'FedaPay',
  fedapay: 'FedaPay',
  WALLET: 'Portefeuille',
  wallet: 'Portefeuille',
  CARD: 'Carte bancaire',
  card: 'Carte bancaire',
  MOBILE_MONEY: 'Mobile Money',
};

export default function ShopPayments() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: sales, loading, error, refetch } = useModulesList<SaleItem>(
    'shop',
    'sales',
    academicYear?.id,
  );

  const [searchQuery, setSearchQuery] = useState('');
  // ⭐ Canal d'envoi en cours (par sale id) — pour désactiver le bouton pendant l'envoi
  const [sendingChannel, setSendingChannel] = useState<string | null>(null);
  // ⭐ Filtre par date pour la génération PDF de l'historique
  const [pdfStartDate, setPdfStartDate] = useState('');
  const [pdfEndDate, setPdfEndDate] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  // ⭐ État pour l'aperçu PDF (pattern Finance)
  const [previewDoc, setPreviewDoc] = useState<{ filePath: string; fileName: string; mimeType: string } | null>(null);

  const safeSales = sales ?? [];

  // ⭐ Calcul du total des ventes encaissées (somme des totalAmount)
  // Anciennement : sommait uniquement les "CRÉDIT" → donnait -0 car les
  // ShopSale n'ont pas de champ type/direction. Maintenant on somme
  // directement totalAmount qui est le montant total de la vente.
  const totalRevenue = safeSales.reduce((acc: number, s: any) => {
    const amount = Number(s?.totalAmount ?? s?.total ?? s?.amount ?? 0);
    return acc + amount;
  }, 0);

  // Filtrage par recherche (saleNumber ou customerName)
  const filteredSales = safeSales.filter((s: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const saleNumber = (s?.saleNumber ?? s?.refNo ?? s?.reference ?? '').toString().toLowerCase();
    const customerName = (s?.customerName ?? s?.clientName ?? s?.studentName ?? '').toString().toLowerCase();
    return saleNumber.includes(q) || customerName.includes(q);
  });

  // ⭐ URL du reçu PDF pour une vente (endpoint BFF)
  const getReceiptPdfUrl = (saleId: string) =>
    `/api/modules-complementaires/shop/sales/${encodeURIComponent(saleId)}/receipt.pdf`;

  // ⭐ Télécharger le reçu PDF (ouvre dans un nouvel onglet)
  const handleDownloadReceipt = (saleId: string) => {
    window.open(getReceiptPdfUrl(saleId), '_blank');
  };

  // ⭐ Renvoyer le reçu par email ou Helm Connect
  const handleResendReceipt = async (saleId: string, channel: 'email' | 'helm_connect') => {
    const key = `${saleId}:${channel}`;
    setSendingChannel(key);
    try {
      const res = await fetch(`/api/modules-complementaires/shop/sales/${encodeURIComponent(saleId)}/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ channels: [channel] }),
      });
      const data = await res.json().catch(() => ({}));
      const status = data?.channels?.[channel];
      if (status?.status === 'skipped') {
        toast({ title: 'Contact manquant', description: status.reason || `Aucun contact pour ${channel}.`, variant: 'destructive' });
      } else if (status?.status === 'failed') {
        toast({ title: 'Échec d\'envoi', description: status.error || `Échec de l'envoi par ${channel}.`, variant: 'destructive' });
      } else {
        toast({ title: 'Reçu envoyé', description: `Reçu envoyé par ${channel}${status?.to ? ` à ${status.to}` : ''}.` });
      }
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || `Échec envoi par ${channel}.`, variant: 'destructive' });
    } finally {
      setSendingChannel(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des transactions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les transactions. {error}
        </div>
      )}

      {/* ⭐ CARTE UNIQUE : Total des ventes encaissées — pleine largeur,
          hauteur proportionnelle au contenu (pas de min-height fixe).
          L'ancienne carte "Méthodes Favorites" a été supprimée car elle
          affichait des pourcentages hardcoded (65%/25%/10%) non basés sur
          les données réelles. */}
      <Card className="p-6 bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-md border-0 relative overflow-hidden">
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-lg backdrop-blur-sm">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Total des ventes encaissées</h3>
              <p className="text-indigo-100 text-xs mt-0.5">
                {safeSales.length} transaction(s) · Année {academicYear?.name || '—'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-semibold">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-indigo-100 mt-1">Recette totale boutique</p>
          </div>
        </div>
      </Card>

      {/* ⭐ HISTORIQUE DES TRANSACTIONS — avec colonnes corrigées :
          Référence=saleNumber, Méthode=paymentMode (mappé vers libellé
          français), Montant=totalAmount, + colonne Actions (Reçu). */}
      <Card className="shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-base font-semibold text-navy-900">Historique des Transactions</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="N° vente ou client..."
                className="pl-9 h-9 w-56"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9" title="Filtrer (à venir)">
              <Filter className="w-4 h-4" />
            </Button>
            {/* ⭐ Bouton Générer PDF de l'historique — avec filtre par date.
                Le PDF est généré à la volée par le backend (Puppeteer) avec
                en-tête officiel (République du Bénin + drapeau + ministère +
                nom école + logo + slogan). Pattern identique à la liste
                des élèves. */}
            <Button
              variant="outline"
              size="sm"
              disabled={generatingPdf || !academicYear?.id}
              onClick={async () => {
                if (!academicYear?.id) return;
                setGeneratingPdf(true);
                const params = new URLSearchParams({ academicYearId: academicYear.id });
                if (pdfStartDate) params.set('startDate', new Date(pdfStartDate).toISOString());
                if (pdfEndDate) {
                  const end = new Date(pdfEndDate);
                  end.setHours(23, 59, 59, 999);
                  params.set('endDate', end.toISOString());
                }
                try {
                  const res = await fetch(
                    `/api/modules-complementaires/shop/payments/history/pdf?${params.toString()}`,
                    { credentials: 'include' },
                  );
                  if (!res.ok) throw new Error(`Erreur ${res.status}`);
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  setPreviewDoc({
                    filePath: url,
                    fileName: `Historique_Paiements_${new Date().toISOString().substring(0, 10)}.pdf`,
                    mimeType: 'application/pdf',
                  });
                } catch (e: any) {
                  toast({ title: 'Erreur export PDF', description: e.message, variant: 'destructive' });
                } finally {
                  setGeneratingPdf(false);
                }
              }}
              title="Générer le PDF de l'historique des paiements (filtrable par date)"
            >
              {generatingPdf ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileText className="w-4 h-4 mr-1.5" />}
              Générer PDF
            </Button>
          </div>
        </div>
        {/* ⭐ Filtre par date pour la génération PDF — visible sous la barre de recherche */}
        <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-3 flex-wrap bg-slate-50/50">
          <span className="text-xs text-gray-500 font-medium">Filtrer PDF par période :</span>
          <Input
            type="date"
            value={pdfStartDate}
            onChange={(e) => setPdfStartDate(e.target.value)}
            className="h-8 w-auto text-xs"
            placeholder="Date début"
          />
          <span className="text-xs text-gray-400">→</span>
          <Input
            type="date"
            value={pdfEndDate}
            onChange={(e) => setPdfEndDate(e.target.value)}
            className="h-8 w-auto text-xs"
            placeholder="Date fin"
          />
          {(pdfStartDate || pdfEndDate) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => { setPdfStartDate(''); setPdfEndDate(''); }}
            >
              Effacer les dates
            </Button>
          )}
          {!pdfStartDate && !pdfEndDate && (
            <span className="text-[10px] text-gray-400">(toutes les ventes si pas de dates)</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="whitespace-nowrap">Référence</TableHead>
                <TableHead className="whitespace-nowrap">Client / Élève</TableHead>
                <TableHead className="whitespace-nowrap">Articles</TableHead>
                <TableHead className="whitespace-nowrap">Méthode</TableHead>
                <TableHead className="text-right whitespace-nowrap">Montant</TableHead>
                <TableHead className="whitespace-nowrap">Statut</TableHead>
                <TableHead className="whitespace-nowrap">Date</TableHead>
                <TableHead className="text-right whitespace-nowrap">Reçu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-gray-400 py-12">
                    Aucune transaction disponible pour cette année scolaire.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.map((sale: any, i: number) => {
                  // ⭐ Référence : prioriser saleNumber (format VTE-YYYY-NNNNN),
                  //    puis refNo, reference, id.
                  const saleNumber = sale?.saleNumber ?? sale?.refNo ?? sale?.reference ?? sale?.id ?? `VTE-${i}`;
                  // ⭐ Client : prioriser customerName, puis clientName, studentName
                  const customerName = sale?.customerName ?? sale?.clientName ?? sale?.studentName ?? 'Client de passage';
                  // ⭐ Méthode : mapper paymentMode vers libellé français
                  const paymentMode = sale?.paymentMode ?? sale?.method ?? sale?.paymentMethod ?? '—';
                  const methodLabel = PAYMENT_MODE_LABELS[String(paymentMode).toUpperCase()] ?? PAYMENT_MODE_LABELS[paymentMode] ?? paymentMode;
                  // ⭐ Montant : prioriser totalAmount, puis total, amount
                  const amount = Number(sale?.totalAmount ?? sale?.total ?? sale?.amount ?? 0);
                  // ⭐ Statut : prioriser paymentStatus, puis status
                  const status = sale?.paymentStatus ?? sale?.status ?? 'PAID';
                  const statusLabel = status === 'PAID' ? 'Payé' : status === 'PENDING' ? 'En attente' : status;
                  const statusClass = status === 'PAID'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200';
                  // ⭐ Date : prioriser saleDate, puis createdAt
                  const rawDate = sale?.saleDate ?? sale?.createdAt;
                  const date = rawDate
                    ? new Date(rawDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : (sale?.date ?? '—');
                  const saleId = sale?.id;

                  return (
                    <TableRow key={sale?.id ?? `tx-${i}`} className="hover:bg-slate-50">
                      <TableCell>
                        <span className="text-xs font-mono font-medium text-navy-900">{saleNumber}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <User className="w-3 h-3 text-gray-400" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-700 truncate max-w-[180px]">{customerName}</span>
                            {sale?.customerType === 'STUDENT' && (
                              <span className="text-[10px] text-indigo-500">Élève</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      {/* ⭐ Colonne Articles — détail des articles achetés */}
                      <TableCell>
                        <div className="space-y-0.5 max-w-[250px]">
                          {(sale?.items?.length ?? 0) > 0 ? (
                            sale.items.map((it: any, idx: number) => (
                              <div key={idx} className="text-[11px] text-gray-600 flex items-center gap-1 whitespace-nowrap">
                                <span className="font-medium text-gray-700">{it.product?.name ?? 'Article'}</span>
                                <span className="text-gray-400">×{it.quantity ?? 1}</span>
                                <span className="text-gray-400">@ {formatCurrency(Number(it.unitPrice ?? 0))}</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">Détail non disponible</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {String(paymentMode).toUpperCase() === 'CASH' && <Banknote className="w-3.5 h-3.5 text-emerald-600" />}
                          {String(paymentMode).toUpperCase() === 'FEDAPAY' && <CreditCard className="w-3.5 h-3.5 text-blue-600" />}
                          {String(paymentMode).toUpperCase() === 'WALLET' && <Wallet className="w-3.5 h-3.5 text-indigo-600" />}
                          <span className="text-xs text-gray-600 whitespace-nowrap">{methodLabel}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-semibold text-navy-900">
                          {formatCurrency(amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${statusClass}`}>
                          {statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">{date}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* ⭐ Télécharger le reçu PDF */}
                          <button
                            type="button"
                            onClick={() => saleId && handleDownloadReceipt(saleId)}
                            disabled={!saleId}
                            className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Télécharger le reçu PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          {/* ⭐ Envoyer par Email */}
                          <button
                            type="button"
                            onClick={() => saleId && handleResendReceipt(saleId, 'email')}
                            disabled={!saleId || sendingChannel === `${saleId}:email`}
                            className="p-1.5 rounded text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Envoyer le reçu par email"
                          >
                            {sendingChannel === `${saleId}:email` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <GmailIcon className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {/* ⭐ Envoyer par Helm Connect */}
                          <button
                            type="button"
                            onClick={() => saleId && handleResendReceipt(saleId, 'helm_connect')}
                            disabled={!saleId || sendingChannel === `${saleId}:helm_connect`}
                            className="p-1.5 rounded text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Envoyer le reçu via Helm Connect"
                          >
                            {sendingChannel === `${saleId}:helm_connect` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <HelmConnectIcon className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ⭐ DocumentPreviewModal — pattern Finance */}
      {previewDoc && (
        <DocumentPreviewModal doc={previewDoc} onClose={() => { URL.revokeObjectURL(previewDoc.filePath); setPreviewDoc(null); }} />
      )}
    </div>
  );
}
