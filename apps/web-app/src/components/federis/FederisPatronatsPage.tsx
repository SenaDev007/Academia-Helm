/**
 * FederisPatronatsPage — Gestion des patronats territoriaux
 *
 * Cahier des charges §7.2 / §8.2 / wireframe §10.3 :
 *   - Écran réservé aux rôles autorisés du patronat NATIONAL.
 *   - Lister les patronats rattachés (niveau territorial, statut, activité).
 *   - Créer un patronat territorial rattaché au patronat national.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface ChildPatronat {
  id: string;
  name: string;
  territoryName?: string | null;
  territorialLevel?: { label: string; code: string } | null;
  status: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  schoolsCount: number;
  examsCount: number;
  usersCount: number;
  createdAt: string;
}

const SUBSCRIPTION_BADGES: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Actif', className: 'bg-green-100 text-green-800' },
  PENDING_PAYMENT: { label: 'Paiement requis', className: 'bg-amber-100 text-amber-800' },
  EXPIRED: { label: 'Expiré', className: 'bg-red-100 text-red-700' },
};

const EMPTY_FORM = {
  name: '',
  territoryName: '',
  organismType: 'PATRONAT',
  responsibleName: '',
  email: '',
  phone: '',
};

export default function FederisPatronatsPage() {
  const [children, setChildren] = useState<ChildPatronat[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadChildren = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/federis/patronat/children', { timeout: 30000 });
      setChildren(res.data ?? []);
      setForbidden(false);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setForbidden(true);
      } else {
        setError(
          err?.response?.data?.message ??
            'Impossible de charger les patronats territoriaux. Veuillez réessayer.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChildren();
  }, [loadChildren]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Le nom du patronat territorial est requis';
    if (!form.territoryName.trim()) errs.territoryName = 'Le territoire est requis';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errs.email = 'Adresse électronique invalide';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      await apiClient.post(
        '/federis/patronat/children',
        {
          name: form.name.trim(),
          territoryName: form.territoryName.trim(),
          organismType: form.organismType,
          ...(form.responsibleName.trim() ? { responsibleName: form.responsibleName.trim() } : {}),
          ...(form.email.trim() ? { email: form.email.trim().toLowerCase() } : {}),
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        },
        { timeout: 30000 },
      );
      setSuccessMsg(`Patronat « ${form.name.trim()} » créé et rattaché à votre réseau.`);
      setForm(EMPTY_FORM);
      setShowCreate(false);
      await loadChildren();
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Erreur lors de la création. Veuillez réessayer.';
      setFormErrors({ submit: Array.isArray(msg) ? msg.join(' ') : String(msg) });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-72 bg-gray-200 rounded" />
        <div className="h-64 bg-white border border-gray-100 rounded-xl" />
      </div>
    );
  }

  // Accès réservé au niveau national (cahier des charges §7.2)
  if (forbidden) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
        <AppIcon name="lock" size="dashboard" className="text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Gestion des patronats territoriaux
        </h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Cette section est réservée au patronat national. Votre espace est rattaché à un périmètre
          territorial : contactez votre patronat national pour toute modification du réseau.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Patronats territoriaux
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            Créez et suivez les patronats rattachés à votre réseau national — {children.length}{' '}
            rattaché(s).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="px-5 py-2.5 bg-blue-800 text-white rounded-lg font-semibold text-sm hover:bg-blue-900 transition-colors inline-flex items-center gap-2 flex-shrink-0"
        >
          <AppIcon name={showCreate ? 'close' : 'add'} size="submenu" />
          {showCreate ? 'Annuler' : 'Créer un patronat territorial'}
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Formulaire de création */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-blue-200 rounded-xl p-6 space-y-5"
        >
          <h2 className="text-base font-bold text-gray-900">Nouveau patronat territorial</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom du patronat <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={cn(
                  'w-full px-4 py-2 border rounded-md',
                  formErrors.name ? 'border-red-300' : 'border-gray-300',
                  'focus:ring-2 focus:ring-blue-800 focus:border-blue-800',
                )}
                placeholder="Ex : Patronat des Écoles Privées de l'Atlantique"
              />
              {formErrors.name && (
                <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Territoire (département, région…) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.territoryName}
                onChange={(e) => setForm({ ...form, territoryName: e.target.value })}
                className={cn(
                  'w-full px-4 py-2 border rounded-md',
                  formErrors.territoryName ? 'border-red-300' : 'border-gray-300',
                  'focus:ring-2 focus:ring-blue-800 focus:border-blue-800',
                )}
                placeholder="Ex : Atlantique"
              />
              {formErrors.territoryName && (
                <p className="mt-1 text-sm text-red-600">{formErrors.territoryName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type d&rsquo;organisme
              </label>
              <select
                value={form.organismType}
                onChange={(e) => setForm({ ...form, organismType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
              >
                <option value="PATRONAT">Patronat</option>
                <option value="ASSOCIATION">Association</option>
                <option value="ORGANISME">Organisme</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Responsable (optionnel)
              </label>
              <input
                type="text"
                value={form.responsibleName}
                onChange={(e) => setForm({ ...form, responsibleName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
                placeholder="Prénom et nom"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact — email (optionnel)
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={cn(
                  'w-full px-4 py-2 border rounded-md',
                  formErrors.email ? 'border-red-300' : 'border-gray-300',
                  'focus:ring-2 focus:ring-blue-800 focus:border-blue-800',
                )}
                placeholder="contact@patronat.org"
              />
              {formErrors.email && (
                <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact — téléphone (optionnel)
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
                placeholder="+229 …"
              />
            </div>
          </div>

          {formErrors.submit && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{formErrors.submit}</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-blue-800 text-white rounded-md font-semibold hover:bg-blue-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Création…' : 'Créer le patronat'}
            </button>
          </div>
        </form>
      )}

      {/* Liste */}
      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {children.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <AppIcon name="network" size="dashboard" className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-4">
              Aucun patronat territorial rattaché. Créez les patronats de votre réseau pour
              coordonner les écoles privées par territoire.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-6 py-3 font-semibold">Patronat</th>
                  <th className="px-4 py-3 font-semibold">Territoire</th>
                  <th className="px-4 py-3 font-semibold">Niveau</th>
                  <th className="px-4 py-3 font-semibold text-center">Écoles</th>
                  <th className="px-4 py-3 font-semibold text-center">Examens</th>
                  <th className="px-4 py-3 font-semibold">Abonnement</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody>
                {children.map((child) => {
                  const sub =
                    SUBSCRIPTION_BADGES[child.subscriptionStatus] ??
                    ({ label: child.subscriptionStatus, className: 'bg-gray-100 text-gray-700' } as const);
                  return (
                    <tr key={child.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-3.5">
                        <div className="font-medium text-gray-900">{child.name}</div>
                        <div className="text-xs text-gray-400">
                          Créé le {new Date(child.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">{child.territoryName ?? '—'}</td>
                      <td className="px-4 py-3.5 text-gray-600">
                        {child.territorialLevel?.label ?? 'Territorial'}
                      </td>
                      <td className="px-4 py-3.5 text-center text-gray-700">
                        {child.schoolsCount}
                      </td>
                      <td className="px-4 py-3.5 text-center text-gray-700">{child.examsCount}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn('px-2 py-0.5 rounded text-xs font-medium', sub.className)}
                        >
                          {sub.label}
                        </span>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {child.subscriptionPlan === 'INSTITUTION'
                            ? 'Institution'
                            : 'Essentiel'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            child.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-700',
                          )}
                        >
                          {child.status === 'ACTIVE' ? 'Actif' : child.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
