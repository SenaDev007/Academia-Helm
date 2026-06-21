'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Loader2,
  AlertCircle,
  X,
  Check,
  DollarSign,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '../PlatformStates';

interface Payment {
  id: string;
  school: string;
  amount: number;
  method: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  date: string;
  reference: string | null;
}

interface PaymentsData {
  payments: Payment[];
}

interface TenantOption {
  id: string;
  name: string;
  slug: string;
}

interface TenantsListResponse {
  tenants: TenantOption[];
  total: number;
}

const PAYMENT_METHODS = [
  { code: 'CASH', label: 'Espèces' },
  { code: 'MOBILE_MONEY', label: 'Mobile Money' },
  { code: 'CARD', label: 'Carte bancaire' },
  { code: 'BANK_TRANSFER', label: 'Virement bancaire' },
] as const;

const PAYMENT_TYPES = [
  { code: 'SUBSCRIPTION', label: 'Abonnement' },
  { code: 'SETUP_FEE', label: "Frais d'activation" },
  { code: 'BILINGUAL', label: 'Option bilingue' },
  { code: 'OTHER', label: 'Autre' },
] as const;

export default function PlatformPaymentsWorkspace() {
  const { data, loading, error, refetch } = usePlatformData<PaymentsData>('/payments');

  // Create manual payment modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    tenantId: '',
    amount: 0,
    method: 'CASH',
    type: 'SUBSCRIPTION',
    reference: '',
    description: '',
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Tenants list for the select
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [tenantsError, setTenantsError] = useState<string | null>(null);

  // Fetch tenants list when modal opens
  useEffect(() => {
    if (!createOpen) return;
    let cancelled = false;
    setTenantsLoading(true);
    setTenantsError(null);
    fetch('/api/platform/tenants?limit=100', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j?.error || j?.message || `Erreur ${r.status}`);
        }
        return r.json();
      })
      .then((d: TenantsListResponse) => {
        if (cancelled) return;
        const list = Array.isArray(d?.tenants) ? d.tenants : Array.isArray(d) ? (d as unknown as TenantOption[]) : [];
        setTenants(list);
        setTenantsLoading(false);
        // Pré-sélection du premier tenant si vide
        if (!createForm.tenantId && list.length > 0) {
          setCreateForm((prev) => ({ ...prev, tenantId: list[0].id }));
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setTenantsError(e?.message || 'Erreur lors du chargement des écoles');
        setTenantsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createOpen]);

  const openCreate = () => {
    setCreateForm({
      tenantId: '',
      amount: 0,
      method: 'CASH',
      type: 'SUBSCRIPTION',
      reference: '',
      description: '',
    });
    setCreateError(null);
    setCreateSuccess(null);
    setCreateOpen(true);
  };

  const closeCreate = () => {
    if (submitting) return;
    setCreateOpen(false);
    setCreateError(null);
    setCreateSuccess(null);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    if (!createForm.tenantId) {
      setCreateError('Veuillez sélectionner une école.');
      return;
    }
    if (!createForm.amount || createForm.amount <= 0) {
      setCreateError('Le montant doit être supérieur à 0.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/platform/payments/record-manual', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: createForm.tenantId,
          amount: Number(createForm.amount),
          method: createForm.method,
          type: createForm.type,
          reference: createForm.reference.trim() || undefined,
          description: createForm.description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || j?.message || `Erreur ${res.status}`);
      }
      setCreateSuccess('Paiement manuel enregistré avec succès.');
      setTimeout(() => {
        setSubmitting(false);
        setCreateOpen(false);
        setCreateError(null);
        setCreateSuccess(null);
        refetch();
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement';
      setCreateError(msg);
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Paiements & Transactions</h1>
          <p className="text-slate-500">Historique des paiements de la plateforme</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold shadow-md transition-all"
        >
          <Plus className="w-4 h-4" />
          Enregistrer paiement manuel
        </button>
      </div>

      {loading ? <PlatformLoading label="Chargement des paiements…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       !data || data.payments.length === 0 ? <PlatformEmpty title="Aucun paiement" /> : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">École</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Montant</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Méthode</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Statut</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Référence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{p.school}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{formatCurrency(p.amount)}</td>
                    <td className="px-6 py-4 text-xs text-slate-700 uppercase">{p.method}</td>
                    <td className="px-6 py-4">
                      {p.status === 'SUCCESS' ? (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">Succès</span>
                      ) : p.status === 'FAILED' ? (
                        <span className="px-2.5 py-1 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold uppercase">Échec</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase">En attente</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">{new Date(p.date).toLocaleDateString('fr-FR')}</td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">{p.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal — Enregistrer paiement manuel */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-blue-900">Enregistrer paiement manuel</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Paiement hors-ligne ou saisie manuelle</p>
                </div>
              </div>
              <button
                onClick={closeCreate}
                disabled={submitting}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitCreate} className="p-6 space-y-4">
              {/* Tenant select */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">École *</label>
                {tenantsLoading ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" /> Chargement des écoles...
                  </div>
                ) : tenantsError ? (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{tenantsError}</span>
                  </div>
                ) : tenants.length === 0 ? (
                  <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                    Aucune école disponible. Créez d'abord une école.
                  </div>
                ) : (
                  <select
                    value={createForm.tenantId}
                    onChange={(e) => setCreateForm({ ...createForm, tenantId: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    required
                  >
                    <option value="">— Sélectionner une école —</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.slug})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Montant (F CFA) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={createForm.amount}
                    onChange={(e) => setCreateForm({ ...createForm, amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    placeholder="50000"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Méthode</label>
                  <select
                    value={createForm.method}
                    onChange={(e) => setCreateForm({ ...createForm, method: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.code} value={m.code}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Type de paiement</label>
                  <select
                    value={createForm.type}
                    onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  >
                    {PAYMENT_TYPES.map((t) => (
                      <option key={t.code} value={t.code}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Référence (optionnel)</label>
                  <input
                    type="text"
                    value={createForm.reference}
                    onChange={(e) => setCreateForm({ ...createForm, reference: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                    placeholder="REF-001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description (optionnel)</label>
                <textarea
                  rows={2}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
                  placeholder="Paiement encaissé en espèces au bureau de Cotonou"
                />
              </div>

              {createError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}
              {createSuccess && (
                <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{createSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={closeCreate}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting || tenantsLoading || tenants.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white shadow-md transition-all"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
