'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  MoreVertical,
  FileText,
  DollarSign,
  Download,
  Loader2,
  AlertCircle,
  Mail,
  MessageSquare,
  Eye,
  X,
  Check,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '../PlatformStates';

interface InitialSubItem {
  id: string;
  schoolName: string;
  amount: number;
  currency: string;
  status: 'PAID' | 'PENDING' | 'PARTIAL' | 'FAILED';
  issuedAt: string;
  paidAt: string | null;
  reference: string;
  invoiceId?: string;
}

interface InitialSubData {
  summary: { paidThisMonth: number; pending: number; invoicedTotal: number; currency: string };
  items: InitialSubItem[];
}

const PAYMENT_METHODS = [
  { code: 'CASH', label: 'Espèces' },
  { code: 'MOBILE_MONEY', label: 'Mobile Money' },
  { code: 'CARD', label: 'Carte bancaire' },
] as const;

/**
 * Construit le HTML imprimable d'une facture à partir des données
 * renvoyées par l'API et l'ouvre dans une nouvelle fenêtre.
 */
function openPrintableInvoice(invoice: Record<string, unknown>, fallback?: InitialSubItem) {
  const inv = invoice as any;
  const number = inv.number || inv.invoiceNumber || inv.reference || fallback?.reference || '—';
  const school = inv.schoolName || inv.school || inv.tenantName || fallback?.schoolName || '—';
  const amount = Number(inv.amount ?? inv.total ?? inv.totalAmount ?? fallback?.amount ?? 0);
  const currency = inv.currency || fallback?.currency || 'F CFA';
  const status = (inv.status || fallback?.status || 'PENDING').toString().toUpperCase();
  const issuedAt = inv.issuedAt || inv.date || inv.createdAt || fallback?.issuedAt || new Date().toISOString();
  const paidAt = inv.paidAt || fallback?.paidAt || null;
  const period = inv.period || inv.description || 'Frais d\'activation / Souscription initiale';

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
    // Bloqueur de pop-up : fallback download
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

export default function InitialSubscriptionsWorkspace() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data, loading, error, refetch } = usePlatformData<InitialSubData>('/initial-subscriptions');

  // Dropdown state (which row's "Plus d'actions" menu is open)
  const [dropdownId, setDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Payment modal
  const [paymentTarget, setPaymentTarget] = useState<InitialSubItem | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: 0, method: 'CASH', reference: '' });
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  // Email modal
  const [emailTarget, setEmailTarget] = useState<InitialSubItem | null>(null);
  const [emailValue, setEmailValue] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  // WhatsApp modal
  const [waTarget, setWaTarget] = useState<InitialSubItem | null>(null);
  const [waValue, setWaValue] = useState('');
  const [waError, setWaError] = useState<string | null>(null);
  const [waSuccess, setWaSuccess] = useState<string | null>(null);
  const [waSubmitting, setWaSubmitting] = useState(false);

  // Details modal
  const [detailsTarget, setDetailsTarget] = useState<InitialSubItem | null>(null);

  // Invoice download loading
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const items = useMemo(() => {
    if (!data?.items) return [];
    if (!searchTerm.trim()) return data.items;
    const q = searchTerm.toLowerCase();
    return data.items.filter((i) => i.schoolName.toLowerCase().includes(q) || i.reference.toLowerCase().includes(q));
  }, [data, searchTerm]);

  const resolveInvoiceId = (item: InitialSubItem): string => item.invoiceId || item.id;

  const handleDownloadInvoice = async (item: InitialSubItem) => {
    setActionError(null);
    setDownloadingId(item.id);
    setDropdownId(null);
    try {
      const invoiceId = resolveInvoiceId(item);
      const res = await fetch(`/api/platform/invoices/${invoiceId}/pdf`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || j?.message || `Erreur ${res.status}`);
      }
      const data = await res.json();
      // L'API peut renvoyer soit directement l'invoice, soit { invoice: {...} }
      const invoice = (data as any)?.invoice || (data as any)?.data || data;
      openPrintableInvoice(invoice, item);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du téléchargement';
      setActionError(msg);
    } finally {
      setDownloadingId(null);
    }
  };

  const openPayment = (item: InitialSubItem) => {
    setPaymentTarget(item);
    setPaymentForm({ amount: item.amount, method: 'CASH', reference: item.reference || '' });
    setPaymentError(null);
    setPaymentSuccess(null);
    setDropdownId(null);
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
      const invoiceId = resolveInvoiceId(paymentTarget);
      const res = await fetch(`/api/platform/invoices/${invoiceId}/record-payment`, {
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

  const openEmail = (item: InitialSubItem) => {
    setEmailTarget(item);
    setEmailValue('');
    setEmailError(null);
    setEmailSuccess(null);
    setDropdownId(null);
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
      const invoiceId = resolveInvoiceId(emailTarget);
      const res = await fetch(`/api/platform/invoices/${invoiceId}/send-email`, {
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

  const openWhatsApp = (item: InitialSubItem) => {
    setWaTarget(item);
    setWaValue('');
    setWaError(null);
    setWaSuccess(null);
    setDropdownId(null);
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
      const invoiceId = resolveInvoiceId(waTarget);
      const res = await fetch(`/api/platform/invoices/${invoiceId}/send-whatsapp`, {
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
          <h1 className="text-2xl font-bold text-blue-900">Souscriptions Initiales</h1>
          <p className="text-slate-500">Frais d'activation et d'entrée des écoles</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher une école..."
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
        </div>
      )}

      {loading ? <PlatformLoading label="Chargement des souscriptions…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       !data ? <PlatformEmpty /> : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 className="w-5 h-5" /></div>
                <span className="text-sm font-medium text-slate-500">Payées ce mois</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(data.summary.paidThisMonth)}</div>
              <p className="text-xs text-emerald-600 font-medium mt-1">Total encaissé</p>
            </div>
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Clock className="w-5 h-5" /></div>
                <span className="text-sm font-medium text-slate-500">En attente</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(data.summary.pending)}</div>
              <p className="text-xs text-amber-600 font-medium mt-1">{data.items.filter((i) => i.status === 'PENDING').length} dossier(s) à valider</p>
            </div>
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><FileText className="w-5 h-5" /></div>
                <span className="text-sm font-medium text-slate-500">Factures émises</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(data.summary.invoicedTotal)}</div>
              <p className="text-xs text-blue-600 font-medium mt-1">Total période</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {items.length === 0 ? <PlatformEmpty title="Aucune souscription" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">École</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Montant</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Statut</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Dates</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">{sub.schoolName}</div>
                          <div className="text-xs text-slate-500 font-mono">Ref: {sub.reference}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-slate-900">{formatCurrency(sub.amount)}</div>
                          <div className="text-[10px] text-slate-400">TTC</div>
                        </td>
                        <td className="px-6 py-4">
                          {sub.status === 'PAID' ? (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">Payée</span>
                          ) : sub.status === 'PARTIAL' ? (
                            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold uppercase">Partiel</span>
                          ) : sub.status === 'FAILED' ? (
                            <span className="px-2.5 py-1 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold uppercase">Échec</span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase">En attente</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-slate-600">Émise: {new Date(sub.issuedAt).toLocaleDateString('fr-FR')}</div>
                          {sub.paidAt && <div className="text-[10px] text-emerald-600 mt-0.5">Payée: {new Date(sub.paidAt).toLocaleDateString('fr-FR')}</div>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 relative">
                            <button
                              onClick={() => openPayment(sub)}
                              disabled={sub.status === 'PAID'}
                              className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Enregistrer paiement"
                            >
                              {paymentSubmitting && paymentTarget?.id === sub.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <DollarSign className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDownloadInvoice(sub)}
                              disabled={downloadingId === sub.id}
                              className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-amber-600 disabled:opacity-50"
                              title="Télécharger facture"
                            >
                              {downloadingId === sub.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </button>
                            <div ref={dropdownId === sub.id ? dropdownRef : null} className="relative">
                              <button
                                onClick={() => setDropdownId(dropdownId === sub.id ? null : sub.id)}
                                className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-slate-700"
                                title="Plus d'actions"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              {dropdownId === sub.id && (
                                <div className="absolute right-0 top-full mt-1 z-20 w-52 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                                  <button
                                    onClick={() => openEmail(sub)}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                  >
                                    <Mail className="w-4 h-4 text-slate-500" />
                                    Envoyer par email
                                  </button>
                                  <button
                                    onClick={() => openWhatsApp(sub)}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                  >
                                    <MessageSquare className="w-4 h-4 text-slate-500" />
                                    Envoyer par WhatsApp
                                  </button>
                                  <button
                                    onClick={() => { setDetailsTarget(sub); setDropdownId(null); }}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left border-t border-slate-100"
                                  >
                                    <Eye className="w-4 h-4 text-slate-500" />
                                    Voir détails
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
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
                  <p className="text-xs text-slate-500 mt-0.5">{paymentTarget.schoolName}</p>
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
                Envoyer la facture de <strong>{emailTarget.schoolName}</strong> par email.
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
                Envoyer la facture de <strong>{waTarget.schoolName}</strong> par WhatsApp.
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

      {/* Modal — Voir détails */}
      {detailsTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-blue-900">Détails de la souscription</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{detailsTarget.schoolName}</p>
                </div>
              </div>
              <button
                onClick={() => setDetailsTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {[
                { label: 'ID', value: detailsTarget.id, mono: true },
                { label: 'École', value: detailsTarget.schoolName },
                { label: 'Référence', value: detailsTarget.reference, mono: true },
                { label: 'Montant', value: formatCurrency(detailsTarget.amount) },
                { label: 'Devise', value: detailsTarget.currency },
                {
                  label: 'Statut',
                  value: (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                      {detailsTarget.status}
                    </span>
                  ),
                },
                { label: 'Émise le', value: new Date(detailsTarget.issuedAt).toLocaleString('fr-FR') },
                {
                  label: 'Payée le',
                  value: detailsTarget.paidAt ? new Date(detailsTarget.paidAt).toLocaleString('fr-FR') : '—',
                },
                { label: 'Invoice ID', value: detailsTarget.invoiceId || '—', mono: true },
              ].map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex-shrink-0">{row.label}</span>
                  <span className={`text-sm text-slate-900 text-right ${row.mono ? 'font-mono' : ''}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100">
              <button
                onClick={() => setDetailsTarget(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
