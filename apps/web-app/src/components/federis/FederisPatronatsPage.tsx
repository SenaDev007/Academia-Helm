/**
 * FederisPatronatsPage — Gestion des patronats territoriaux
 *
 * Cahier des charges §7.2 / §8.2 / wireframe §10.3 :
 *   - Écran réservé aux rôles autorisés du patronat NATIONAL.
 *   - Lister les patronats rattachés (niveau territorial, statut, activité).
 *   - Créer un patronat territorial rattaché au patronat national.
 *
 * ⭐ MÊME FLUX QUE L'INSCRIPTION PUBLIQUE (2026-09-28) :
 *   1. Le national saisit l'identité du patronat territorial + le compte du
 *      responsable (email + mot de passe — le type d'organisme n'est plus
 *      demandé : c'est toujours un PATRONAT) ;
 *   2. La création est PAYANTE : après l'appel POST /children, la page
 *      redirige vers /checkout?patronatId=… où le national règle
 *      l'abonnement du territorial (barème TERRITORIAL — inférieur au
 *      barème NATIONAL) ;
 *   3. L'activation (webhook / verify Fedapay) attribue le sous-domaine et
 *      envoie l'email d'activation, exactement comme le flux public.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppIcon from '@/components/ui/AppIcon';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { FedPage } from '@/components/federis/federis-motion';
import { federisLink } from '@/lib/federis/useFederisPath';

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

interface TerritorialLevel {
  id: string;
  code: string;
  label: string;
  order: number;
}

const SUBSCRIPTION_BADGES: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Actif', className: 'bg-green-100 text-green-800' },
  PENDING_PAYMENT: { label: 'Paiement requis', className: 'bg-amber-100 text-amber-800' },
  EXPIRED: { label: 'Expiré', className: 'bg-red-100 text-red-700' },
};

const EMPTY_FORM = {
  name: '',
  territoryName: '',
  territorialLevelCode: '',
  responsibleName: '',
  email: '',
  phone: '',
  password: '',
};

export default function FederisPatronatsPage() {
  const router = useRouter();
  const [children, setChildren] = useState<ChildPatronat[]>([]);
  const [levels, setLevels] = useState<TerritorialLevel[]>([]);
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

  // Niveaux territoriaux configurés pour le pays (Département, Commune…)
  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/federis/patronat/territorial-levels', { timeout: 15000 });
        setLevels(res.data?.levels ?? []);
      } catch {
        // Table non déployée — le territoire reste saisissable librement.
      }
    })();
  }, []);

  useEffect(() => {
    void loadChildren();
  }, [loadChildren]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Le nom du patronat territorial est requis';
    if (!form.territoryName.trim()) errs.territoryName = 'Le territoire est requis';
    if (!form.responsibleName.trim())
      errs.responsibleName = 'Le responsable est requis (compte de connexion du patronat créé)';
    if (!form.email.trim()) {
      errs.email = "L'email du responsable est requis (identifiant de connexion)";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = 'Adresse électronique invalide';
    }
    if (!form.password) {
      errs.password = 'Le mot de passe du responsable est requis';
    } else if (form.password.length < 8) {
      errs.password = 'Le mot de passe doit contenir au moins 8 caractères';
    }
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      const res = await apiClient.post(
        '/federis/patronat/children',
        {
          name: form.name.trim(),
          territoryName: form.territoryName.trim(),
          ...(form.territorialLevelCode
            ? { territorialLevelCode: form.territorialLevelCode }
            : {}),
          responsibleName: form.responsibleName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        },
        { timeout: 30000 },
      );

      const created = res.data?.patronat;
      const createdName = created?.name ?? form.name.trim();

      // ⭐ Même flux que l'inscription publique : la création est PAYANTE —
      //    redirection vers le checkout avec l'identifiant du patronat créé
      //    (le national règle son abonnement, barème TERRITORIAL).
      if (res.data?.nextStep === 'CHECKOUT' && created?.id) {
        router.push(
          federisLink(
            `/checkout?patronatId=${encodeURIComponent(created.id)}&name=${encodeURIComponent(createdName)}&status=child`,
          ),
        );
        return;
      }

      setSuccessMsg(
        `Patronat « ${createdName} » créé et rattaché à votre réseau. Activez son abonnement depuis la liste.`,
      );
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
        <div className="h-8 w-72 bg-blue-100 rounded-full" />
        <div className="fed-card h-64" />
      </div>
    );
  }

  // Accès réservé au niveau national (cahier des charges §7.2)
  if (forbidden) {
    return (
      <div className="fed-card p-10 text-center">
        <AppIcon name="lock" size="dashboard" className="text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-blue-900 mb-2">
          Gestion des patronats territoriaux
        </h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Cette section est réservée au patronat national. Votre espace est rattaché à un périmètre
          territorial : contactez votre patronat national pour toute modification du réseau.
        </p>
      </div>
    );
  }

  return (
    <FedPage className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="fed-badge mb-3">Module gouvernance</div>
          <h1 className="text-2xl md:text-3xl font-bold text-blue-900 tracking-tight">
            Patronats territoriaux
          </h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">
            Créez et suivez les patronats rattachés à votre réseau national — {children.length}{' '}
            rattaché(s). Chaque création est suivie du règlement de l&apos;abonnement du patronat
            créé (même flux que l&apos;inscription publique).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="fed-btn-gold px-4 py-2.5 text-sm flex-shrink-0"
        >
          <AppIcon name={showCreate ? 'close' : 'add'} size="submenu" />
          {showCreate ? 'Annuler' : 'Créer un patronat territorial'}
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Formulaire de création — même flux que l'inscription publique */}
      {showCreate && (
        <form onSubmit={handleCreate} className="fed-card p-6 space-y-5">
          <div>
            <h2 className="text-base font-bold text-blue-900">Nouveau patronat territorial</h2>
            <p className="text-xs text-slate-500 mt-1">
              Le compte du responsable est créé immédiatement ; l&apos;abonnement du patronat est
              réglé à l&apos;étape suivante (activation du sous-domaine après paiement).
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                Nom du patronat <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={cn(
                  'fed-input-light px-4 py-2',
                  formErrors.name ? '!border-red-400' : '',
                )}
                placeholder="Ex : Patronat des Écoles Privées de l'Atlantique"
              />
              {formErrors.name && (
                <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                Territoire (département, région…) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.territoryName}
                onChange={(e) => setForm({ ...form, territoryName: e.target.value })}
                className={cn(
                  'fed-input-light px-4 py-2',
                  formErrors.territoryName ? '!border-red-400' : '',
                )}
                placeholder="Ex : Atlantique"
              />
              {formErrors.territoryName && (
                <p className="mt-1 text-sm text-red-600">{formErrors.territoryName}</p>
              )}
            </div>
            {levels.length > 0 && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                  Niveau territorial
                </label>
                <select
                  value={form.territorialLevelCode}
                  onChange={(e) => setForm({ ...form, territorialLevelCode: e.target.value })}
                  className="fed-input-light px-4 py-2"
                >
                  {levels.map((lvl) => (
                    <option key={lvl.code} value={lvl.code}>
                      {lvl.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Par défaut : {levels[0]?.label ?? 'premier niveau configuré'} pour votre pays.
                </p>
              </div>
            )}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                Responsable — prénom et nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.responsibleName}
                onChange={(e) => setForm({ ...form, responsibleName: e.target.value })}
                className={cn(
                  'fed-input-light px-4 py-2',
                  formErrors.responsibleName ? '!border-red-400' : '',
                )}
                placeholder="Prénom et nom du coordonnateur"
              />
              {formErrors.responsibleName && (
                <p className="mt-1 text-sm text-red-600">{formErrors.responsibleName}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                Responsable — email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={cn(
                  'fed-input-light px-4 py-2',
                  formErrors.email ? '!border-red-400' : '',
                )}
                placeholder="responsable@patronat.org"
              />
              {formErrors.email && (
                <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
              )}
              <p className="mt-1 text-[11px] text-slate-400">
                Identifiant de connexion du patronat créé.
              </p>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                Responsable — mot de passe <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={cn(
                  'fed-input-light px-4 py-2',
                  formErrors.password ? '!border-red-400' : '',
                )}
                placeholder="8 caractères minimum"
                autoComplete="new-password"
              />
              {formErrors.password && (
                <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
              )}
              <p className="mt-1 text-[11px] text-slate-400">
                À transmettre au responsable — modifiable depuis son espace.
              </p>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                Contact — téléphone (optionnel)
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="fed-input-light px-4 py-2"
                placeholder="+229 …"
              />
            </div>
          </div>

          {formErrors.submit && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{formErrors.submit}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-[11px] text-slate-400">
              L&apos;abonnement sera réglé juste après la création — barème territorial (inférieur
              au barème national).
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="fed-btn-gold px-6 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Création…' : 'Créer et régler l\u2019abonnement'}
            </button>
          </div>
        </form>
      )}

      {/* Liste */}
      <section className="fed-card overflow-hidden">
        {children.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <AppIcon name="network" size="dashboard" className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500 mb-4">
              Aucun patronat territorial rattaché. Créez les patronats de votre réseau pour
              coordonner les écoles privées par territoire.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f7f9fc] text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-6 py-3 font-semibold">Patronat</th>
                  <th className="px-4 py-3 font-semibold">Territoire</th>
                  <th className="px-4 py-3 font-semibold">Niveau</th>
                  <th className="px-4 py-3 font-semibold text-center">Écoles</th>
                  <th className="px-4 py-3 font-semibold text-center">Examens</th>
                  <th className="px-4 py-3 font-semibold">Abonnement</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {children.map((child) => {
                  const sub =
                    SUBSCRIPTION_BADGES[child.subscriptionStatus] ??
                    ({ label: child.subscriptionStatus, className: 'bg-gray-100 text-slate-700' } as const);
                  return (
                    <tr key={child.id} className="border-t border-slate-100 hover:bg-[#f7f9fc]">
                      <td className="px-6 py-3.5">
                        <div className="font-medium text-blue-900">{child.name}</div>
                        <div className="text-xs text-slate-400">
                          Créé le {new Date(child.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{child.territoryName ?? '—'}</td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {child.territorialLevel?.label ?? 'Territorial'}
                      </td>
                      <td className="px-4 py-3.5 text-center text-slate-700">
                        {child.schoolsCount}
                      </td>
                      <td className="px-4 py-3.5 text-center text-slate-700">{child.examsCount}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn('px-2.5 py-1 rounded-full text-[9px] font-bold uppercase', sub.className)}
                        >
                          {sub.label}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {child.subscriptionPlan === 'INSTITUTION'
                            ? 'Institution'
                            : 'Essentiel'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            'px-2.5 py-1 rounded-full text-[9px] font-bold uppercase',
                            child.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-slate-700',
                          )}
                        >
                          {child.status === 'ACTIVE' ? 'Actif' : child.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {child.subscriptionStatus === 'PENDING_PAYMENT' && (
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                federisLink(
                                  `/checkout?patronatId=${encodeURIComponent(child.id)}&name=${encodeURIComponent(child.name)}&status=child`,
                                ),
                              )
                            }
                            className="fed-btn-gold px-4 py-2 text-xs"
                            title="Régler l'abonnement de ce patronat territorial"
                          >
                            Régler l&apos;abonnement
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </FedPage>
  );
}
