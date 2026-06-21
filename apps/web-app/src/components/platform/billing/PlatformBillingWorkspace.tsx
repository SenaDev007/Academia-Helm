'use client';

import { useState } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Loader2,
  AlertCircle,
  Mail,
  MessageSquare,
  X,
  Check,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '../PlatformStates';

interface Invoice {
  id: string;
  school: string;
  amount: number;
  currency: string;
  status: string;
  date: string;
  paidAt: string | null;
  period: string;
  number?: string;
  reference?: string;
}

interface BillingData {
  summary: { monthlyRevenue: number; pendingPayments: number; todayCollections: number; currency: string };
  invoices: Invoice[];
}

const PAYMENT_METHODS = [
  { code: 'CASH', label: 'Espèces' },
  { code: 'MOBILE_MONEY', label: 'Mobile Money' },
  { code: 'CARD', label: 'Carte bancaire' },
] as const;

/**
 * Construit le HTML imprimable d'une facture et l'ouvre dans une nouvelle fenêtre.
 */
function openPrintableInvoice(invoice: Record<string, unknown>, fallback?: Invoice) {
  const inv = invoice as any;
  const number = inv.number || inv.invoiceNumber || inv.reference || fallback?.reference || fallback?.id || '—';
  const school = inv.school || inv.schoolName || inv.tenantName || fallback?.school || '—';
  const amount = Number(inv.amount ?? inv.total ?? inv.totalAmount ?? fallback?.amount ?? 0);
  const currency = inv.currency || fallback?.currency || 'F CFA';
  const status = (inv.status || fallback?.status || 'PENDING').toString().toUpperCase();
  const issuedAt = inv.issuedAt || inv.date || inv.createdAt || fallback?.date || new Date().toISOString();
  const paidAt = inv.paidAt || fallback?.paidAt || null;
  const period = inv.period || inv.description || fallback?.period || 'Abonnement Academia Helm';

  const statusLabel = status === 'PAID' ? 'PAYÉE' : status === 'PARTIAL' ? 'PARTIELLE' : status === 'FAILED' ? 'ÉCHEC' : 'EN ATTENTE';
  const statusColor = status === 'PAID' ? '#059669' : status === 'PARTIAL' ? '#2563EB' : status === 'FAILED' ? '#DC2626' : '#D97706';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Facture ${number}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #0F172A; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0D1F6E; padding-bottom: 24px; margin-bottom: 24px; }
  .brand h1 { color: #0D1F6E; margin: 0; font-size: 28px; letter-spacing: -0.5px; }
  .brand p { color: #64748B; margin: 4px 0 0; font-size: 13px; }
  .invoice-meta { text-align: right; }
  .invoice-meta h2 { color: #0F172A; margin: 0; font-size: 22px; text-transform: uppercase; letter-spacing: 1px; }
  .invoice-meta p { margin: 4px 0; color: #475569; font-size: 13px; }
  .status-badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; color: white; background: ${statusColor}; margin-top: 6px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  .party { background: #F8FAFC; border-radius: 8px; padding: 16px; }
  .party h3 { margin: 0 0 8px; color: #0D1F6E; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  .party p { margin: 2px 0; font-size: 13px; color: #334155; }
  .line-items { border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; margin-bottom: 24px; }
  .line-items table { width: 100%; border-collapse: collapse; }
  .line-items th { background: #F1F5F9; padding: 12px 16px; text-align: left; font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; }
  .line-items td { padding: 16px; font-size: 14px; border-top: 1px solid #E2E8F0; }
  .total-row { background: #0D1F6E; color: white; font-weight: bold; font-size: 18px; }
  .total-row td { padding: 20px 16px; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; text-align: center; }
  .actions { margin: 24px 0; }
  .btn { display: inline-block; background: #F5A623; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600; margin-right: 8px; }
  @media print { .actions { display: none; } }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <h1>ACADEMIA HELM</h1>
      <p>Plateforme SaaS de gestion scolaire</p>
    </div>
    <div class="invoice-meta">
      <h2>Facture</h2>
      <p><strong>N° ${number}</strong></p>
      <p>Émise le : ${new Date(issuedAt).toLocaleDateString('fr-FR')}</p>
      ${paidAt ? `<p>Payée le : ${new Date(paidAt).toLocaleDateString('fr-FR')}</p>` : ''}
      <span class="status-badge">${statusLabel}</span>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>Émetteur</h3>
      <p><strong>Academia Helm</strong></p>
      <p>Cotonou, Bénin</p>
      <p>contact@academia-helm.app</p>
    </div>
    <div class="party">
      <h3>Client</h3>
      <p><strong>${school}</strong></p>
      <p>Réf. : ${fallback?.reference || number}</p>
    </div>
  </div>

  <div class="line-items">
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: right;">Montant</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${period}</td>
          <td style="text-align: right;">${formatCurrency(amount, { suffix: currency })}</td>
        </tr>
        <tr class="total-row">
          <td>TOTAL</td>
          <td style="text-align: right;">${formatCurrency(amount, { suffix: currency })}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="actions">
    <a href="#" onclick="window.print(); return false;" class="btn">Imprimer / Enregistrer en PDF</a>
  </div>

  <div class="footer">
    Cette facture a été générée automatiquement par la plateforme Academia Helm.<br/>
    Pour toute question, contactez-nous à contact@academia-helm.app
  </div>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facture-${number}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export default function PlatformBillingWorkspace() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data, loading, error, refetch } = usePlatformData<BillingData>('/invoices');

  // Download state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Payment modal
  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: 0, method: 'CASH', reference: '' });
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  // Email modal
  const [emailTarget, setEmailTarget] = useState<Invoice | null>(null);
  const [emailValue, setEmailValue] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  // WhatsApp modal
  const [waTarget, setWaTarget] = useState<Invoice | null>(null);
  const [waValue, setWaValue] = useState('');
  const [waError, setWaError] = useState<string | null>(null);
  const [waSuccess, setWaSuccess] = useState<string | null>(null);
  const [waSubmitting, setWaSubmitting] = useState(false);

  const filteredInvoices = (() => {
    if (!data?.invoices) return [];
    if (!searchTerm.trim()) return data.invoices;
    const q = searchTerm.toLowerCase();
    return data.invoices.filter(
      (i) => i.school.toLowerCase().includes(q) || (i.reference || '').toLowerCase().includes(q),
    );
  })();

  const handleDownload = async (inv: Invoice) => {
    setActionError(null);
    setDownloadingId(inv.id);
    try {
      const res = await fetch(`/api/platform/invoices/${inv.id}/pdf`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || j?.message || `Erreur ${res.status}`);
      }
      const json = await res.json();
      const invoice = (json as any)?.invoice || (json as any)?.data || json;
      openPrintableInvoice(invoice, inv);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du téléchargement';
      setActionError(msg);
    } finally {
      setDownloadingId(null);
    }
  };

  const openPayment = (inv: Invoice) => {
    setPaymentTarget(inv);
    setPaymentForm({ amount: inv.amount, method: 'CASH', reference: inv.reference || '' });
    setPaymentError(null);
    setPaymentSuccess(null);
  };
  const closePayment = () => {
    if (paymentSubmitting) return;
    setPaymentTarget(null);
    setPaymentError(null);
    setPaymentSuccess(null);
  };
  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTarget) return;
    setPaymentError(null);
    setPaymentSuccess(null);
    if (!paymentForm.amount || paymentForm.amount <= 0) {
      setPaymentError('Le montant doit être supérieur à 0.');
      return;
    }
    setPaymentSubmitting(true);
    try {
      const res = await fetch(`/api/platform/invoices/${paymentTarget.id}/record-payment`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(paymentForm.amount),
          method: paymentForm.method,
          reference: paymentForm.reference.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || j?.message || `Erreur ${res.status}`);
      }
      setPaymentSuccess('Paiement enregistré avec succès.');
      setTimeout(() => {
        setPaymentSubmitting(false);
        setPaymentTarget(null);
        setPaymentError(null);
        setPaymentSuccess(null);
        refetch();
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement';
      setPaymentError(msg);
      setPaymentSubmitting(false);
    }
  };

  const openEmail = (inv: Invoice) => {
    setEmailTarget(inv);
    setEmailValue('');
    setEmailError(null);
    setEmailSuccess(null);
  };
  const closeEmail = () => {
    if (emailSubmitting) return;
    setEmailTarget(null);
    setEmailError(null);
    setEmailSuccess(null);
  };
  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailTarget) return;
    setEmailError(null);
    setEmailSuccess(null);
    if (!emailValue.trim() || !/^\S+@\S+\.\S+$/.test(emailValue.trim())) {
      setEmailError('Veuillez saisir un email valide.');
      return;
    }
    setEmailSubmitting(true);
    try {
      const res = await fetch(`/api/platform/invoices/${emailTarget.id}/send-email`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailValue.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || j?.message || `Erreur ${res.status}`);
      }
      setEmailSuccess('Facture envoyée par email.');
      setTimeout(() => {
        setEmailSubmitting(false);
        setEmailTarget(null);
        setEmailError(null);
        setEmailSuccess(null);
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'envoi';
      setEmailError(msg);
      setEmailSubmitting(false);
    }
  };

  const openWhatsApp = (inv: Invoice) => {
    setWaTarget(inv);
    setWaValue('');
    setWaError(null);
    setWaSuccess(null);
  };
  const closeWhatsApp = () => {
    if (waSubmitting) return;
    setWaTarget(null);
    setWaError(null);
    setWaSuccess(null);
  };
  const submitWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waTarget) return;
    setWaError(null);
    setWaSuccess(null);
    if (!waValue.trim() || waValue.replace(/\D/g, '').length < 8) {
      setWaError('Veuillez saisir un numéro de téléphone valide.');
      return;
    }
    setWaSubmitting(true);
    try {
      const res = await fetch(`/api/platform/invoices/${waTarget.id}/send-whatsapp`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: waValue.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || j?.message || `Erreur ${res.status}`);
      }
      setWaSuccess('Facture envoyée par WhatsApp.');
      setTimeout(() => {
        setWaSubmitting(false);
        setWaTarget(null);
        setWaError(null);
        setWaSuccess(null);
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'envoi';
      setWaError(msg);
      setWaSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Facturation SaaS</h1>
          <p className="text-slate-500">Factures et encaissements de la plateforme</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher une facture..."
            className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all w-full md:w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="ml-auto text-red-600 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? <PlatformLoading label="Chargement des factures…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       !data ? <PlatformEmpty /> : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><DollarSign className="w-5 h-5" /></div>
                <span className="text-sm font-medium text-slate-500">CA mensuel</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(data.summary.monthlyRevenue)}</div>
            </div>
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Clock className="w-5 h-5" /></div>
                <span className="text-sm font-medium text-slate-500">Paiements en attente</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(data.summary.pendingPayments)}</div>
            </div>
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><CheckCircle2 className="w-5 h-5" /></div>
                <span className="text-sm font-medium text-slate-500">Encaissements du jour</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(data.summary.todayCollections)}</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {filteredInvoices.length === 0 ? <PlatformEmpty title="Aucune facture" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">École</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Montant</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Période</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Statut</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredInvoices.map((inv) => {
                      const isPaid = (inv.status || '').toUpperCase() === 'PAID';
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-900">{inv.school}</td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-900">{formatCurrency(inv.amount)}</td>
                          <td className="px-6 py-4 text-xs text-slate-600">{inv.period}</td>
                          <td className="px-6 py-4">
                            {isPaid ? (
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">Payée</span>
                            ) : (
                              <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase">En attente</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600">{new Date(inv.date).toLocaleDateString('fr-FR')}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isPaid && (
                                <button
                                  onClick={() => openPayment(inv)}
                                  disabled={paymentSubmitting && paymentTarget?.id === inv.id}
                                  className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-emerald-600 disabled:opacity-50"
                                  title="Enregistrer paiement"
                                >
                                  {paymentSubmitting && paymentTarget?.id === inv.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <DollarSign className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                              <button
                                onClick={() => handleDownload(inv)}
                                disabled={downloadingId === inv.id}
                                className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-amber-600 disabled:opacity-50"
                                title="Télécharger"
                              >
                                {downloadingId === inv.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Download className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => openEmail(inv)}
                                disabled={emailSubmitting && emailTarget?.id === inv.id}
                                className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-blue-600 disabled:opacity-50"
                                title="Envoyer email"
                              >
                                {emailSubmitting && emailTarget?.id === inv.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Mail className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => openWhatsApp(inv)}
                                disabled={waSubmitting && waTarget?.id === inv.id}
                                className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-emerald-600 disabled:opacity-50"
                                title="Envoyer WhatsApp"
                              >
                                {waSubmitting && waTarget?.id === inv.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <MessageSquare className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal — Enregistrer paiement */}
      {paymentTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-blue-900">Enregistrer paiement</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{paymentTarget.school} — {paymentTarget.period}</p>
                </div>
              </div>
              <button
                onClick={closePayment}
                disabled={paymentSubmitting}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitPayment} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Montant (F CFA)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Méthode de paiement</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.code} value={m.code}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Référence (optionnel)</label>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                  placeholder="REF-PAY-001"
                />
              </div>
              {paymentError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}
              {paymentSuccess && (
                <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{paymentSuccess}</span>
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closePayment}
                  disabled={paymentSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={paymentSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white shadow-md transition-all"
                >
                  {paymentSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal — Envoyer par email */}
      {emailTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-blue-900">Envoyer par email</h2>
              </div>
              <button
                onClick={closeEmail}
                disabled={emailSubmitting}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitEmail} className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Envoyer la facture de <strong>{emailTarget.school}</strong> par email.
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email du destinataire</label>
                <input
                  type="email"
                  value={emailValue}
                  onChange={(e) => setEmailValue(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  placeholder="promoteur@ecole.org"
                  required
                />
              </div>
              {emailError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{emailError}</span>
                </div>
              )}
              {emailSuccess && (
                <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{emailSuccess}</span>
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeEmail}
                  disabled={emailSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={emailSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white shadow-md transition-all"
                >
                  {emailSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Envoyer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal — Envoyer par WhatsApp */}
      {waTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-blue-900">Envoyer par WhatsApp</h2>
              </div>
              <button
                onClick={closeWhatsApp}
                disabled={waSubmitting}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitWhatsApp} className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Envoyer la facture de <strong>{waTarget.school}</strong> par WhatsApp.
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Numéro WhatsApp</label>
                <input
                  type="tel"
                  value={waValue}
                  onChange={(e) => setWaValue(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  placeholder="+229 00 00 00 00"
                  required
                />
              </div>
              {waError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{waError}</span>
                </div>
              )}
              {waSuccess && (
                <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{waSuccess}</span>
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeWhatsApp}
                  disabled={waSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={waSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white shadow-md transition-all"
                >
                  {waSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                  Envoyer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
