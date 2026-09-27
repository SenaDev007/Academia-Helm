/**
 * FederisTeamPage — Équipe & Comptes (Academia Federis)
 *
 * Réservé au COORDONNATEUR (garde middleware + API). Il crée ici les comptes
 * des autres membres du patronat — secrétaire, trésorier, organisateur,
 * chargé de mission — exactement comme le fait le responsable RH Helm
 * (pattern staff-credential / generate-credentials) :
 *   - création : email + mot de passe + fonction → User + PatronatUser
 *   - modification : changer la fonction, activer / désactiver
 *   - réinitialisation du mot de passe
 *
 * Chaque membre se connecte ensuite sur /federis/login avec SON email : il
 * atterrit dans SON UI Shell (navigation filtrée par sa fonction).
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import {
  CREATABLE_FUNCTIONS,
  PATRONAT_FUNCTION_DESCRIPTIONS,
  PATRONAT_FUNCTION_LABELS,
  type PatronatFunctionKey,
} from '@/lib/patronat/permissions';
import { FedPage, FedCountUp } from '@/components/federis/federis-motion';

interface Member {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  function: string;
  functionLabel: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  isSelf: boolean;
}

interface CatalogEntry {
  key: PatronatFunctionKey;
  label: string;
  description: string;
}

const FUNCTION_BADGES: Record<string, string> = {
  COORDONNATEUR: 'bg-blue-900 text-white',
  SECRETAIRE: 'bg-sky-100 text-sky-800',
  TRESORIER: 'bg-emerald-100 text-emerald-800',
  ORGANISATEUR: 'bg-amber-100 text-amber-800',
  CHARGE_MISSION: 'bg-violet-100 text-violet-800',
  OPERATOR: 'bg-gray-100 text-slate-700',
  VIEWER: 'bg-gray-100 text-slate-700',
};

export default function FederisTeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Formulaire de création
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    function: 'SECRETAIRE' as PatronatFunctionKey,
    password: '',
  });

  // Réinitialisation mot de passe
  const [resetTarget, setResetTarget] = useState<Member | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/federis/patronat/users', { timeout: 20000 });
      setMembers(res.data?.members ?? []);
      setCatalog(res.data?.catalog ?? []);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          "Impossible de charger l'équipe. Vérifiez que vous êtes coordonnateur du patronat.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.post(
        '/federis/patronat/users',
        {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone || undefined,
          function: form.function,
          password: form.password,
        },
        { timeout: 20000 },
      );
      setNotice(res.data?.message ?? 'Compte créé.');
      setShowCreate(false);
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        function: 'SECRETAIRE',
        password: '',
      });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Création impossible.');
    } finally {
      setCreating(false);
    }
  };

  const changeFunction = async (member: Member, fn: PatronatFunctionKey) => {
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.patch(
        `/federis/patronat/users/${member.id}`,
        { function: fn },
        { timeout: 20000 },
      );
      setNotice(
        `${member.firstName} ${member.lastName} est désormais ${res.data?.member?.functionLabel ?? PATRONAT_FUNCTION_LABELS[fn]}.`,
      );
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Modification impossible.');
    }
  };

  const toggleActive = async (member: Member) => {
    setError(null);
    setNotice(null);
    try {
      await apiClient.patch(
        `/federis/patronat/users/${member.id}`,
        { isActive: !member.isActive },
        { timeout: 20000 },
      );
      setNotice(
        member.isActive
          ? `Compte de ${member.firstName} ${member.lastName} désactivé.`
          : `Compte de ${member.firstName} ${member.lastName} réactivé.`,
      );
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Modification impossible.');
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetting(true);
    setError(null);
    try {
      const res = await apiClient.post(
        `/federis/patronat/users/${resetTarget.id}/reset-password`,
        { password: newPassword },
        { timeout: 20000 },
      );
      setNotice(res.data?.message ?? 'Mot de passe réinitialisé.');
      setResetTarget(null);
      setNewPassword('');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Réinitialisation impossible.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <FedPage className="space-y-8">
      {/* En-tête */}
      <div className="fed-card p-10 flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16" />
        <div className="relative z-10">
          <div className="fed-badge mb-4">Module équipe</div>
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#1e3a8a] to-[#0b1d3a] rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
              <AppIcon name="students" size="dashboard" className="text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-[#0b1d3a] tracking-tight">
              Équipe &amp; Comptes
            </h1>
          </div>
          <p className="text-slate-500 font-medium max-w-xl text-sm">
            Créez les comptes de votre équipe patronale. Chaque membre se connecte avec son
            email et accède uniquement aux fonctions de son rôle : secrétaire, trésorier,
            organisateur, chargé de mission.
          </p>
        </div>
        <div className="flex items-center space-x-4 shrink-0">
          <div className="text-right">
            <p className="text-2xl font-black text-[#1e3a8a]"><FedCountUp value={members.length} /></p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Comptes membres
            </p>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="fed-btn-navy px-5 py-2.5 text-sm"
          >
            {showCreate ? 'Fermer' : 'Créer un compte'}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-4 text-sm font-semibold text-emerald-800">
          {notice}
        </div>
      )}

      {/* Formulaire de création */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="fed-card p-8 space-y-6"
        >
          <h3 className="text-sm font-black text-[#0b1d3a] uppercase tracking-widest">
            Nouveau compte membre
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Prénom
              </label>
              <input
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold"
                placeholder="Awa"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Nom
              </label>
              <input
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold"
                placeholder="Dossou"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Email (identifiant de connexion)
              </label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold"
                placeholder="awa.dossou@patronat.org"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Téléphone (optionnel)
              </label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold"
                placeholder="+229 97 00 00 00"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Fonction
              </label>
              <select
                value={form.function}
                onChange={(e) => setForm({ ...form, function: e.target.value as PatronatFunctionKey })}
                className="fed-input-light px-4 py-3 font-semibold"
              >
                {(catalog.length > 0
                  ? catalog.map((c) => ({ key: c.key, label: c.label }))
                  : CREATABLE_FUNCTIONS.map((k) => ({ key: k, label: PATRONAT_FUNCTION_LABELS[k] }))
                ).map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500 font-medium">
                {PATRONAT_FUNCTION_DESCRIPTIONS[form.function]}
              </p>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Mot de passe (min. 8 caractères)
              </label>
              <input
                required
                type="text"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold"
                placeholder="À communiquer au membre"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="fed-btn-gold fed-btn-shimmer px-8 py-3 text-sm disabled:opacity-50"
            >
              {creating ? 'Création…' : 'Créer le compte'}
            </button>
          </div>
        </form>
      )}

      {/* Liste des membres */}
      <div className="fed-card overflow-hidden">
        <div className="p-8 border-b border-blue-50 flex items-center justify-between">
          <h3 className="text-sm font-black text-[#0b1d3a] uppercase tracking-widest">
            Membres du patronat
          </h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">
              {members.filter((m) => m.isActive).length} actifs
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm font-bold text-slate-400">
            Chargement de l&apos;équipe…
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-sm font-bold text-slate-400">
            Aucun membre — créez le premier compte de votre équipe.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {members.map((m) => (
              <div key={m.id} className="p-6 lg:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[#f7f9fc] transition-all">
                <div className="flex items-center space-x-5">
                  <div
                    className={cn(
                      'w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm',
                      m.isActive ? 'bg-[#eff6ff] text-[#1e3a8a]' : 'bg-slate-100 text-slate-400',
                    )}
                  >
                    {(m.firstName?.[0] ?? m.email[0]).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className="text-base font-black text-[#0b1d3a]">
                        {m.firstName} {m.lastName}
                        {m.isSelf && (
                          <span className="ml-2 text-[9px] font-black uppercase tracking-widest bg-[#0b1d3a] text-white px-2 py-0.5 rounded-full">
                            Vous
                          </span>
                        )}
                      </h4>
                      <span
                        className={cn(
                          'text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full',
                          FUNCTION_BADGES[m.function] ?? FUNCTION_BADGES.VIEWER,
                        )}
                      >
                        {m.functionLabel}
                      </span>
                      {!m.isActive && (
                        <span className="text-[9px] font-black uppercase tracking-widest bg-red-100 text-red-700 px-2.5 py-1 rounded-full">
                          Désactivé
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
                      {m.email}
                      {m.phone ? ` • ${m.phone}` : ''}
                      {m.lastLoginAt
                        ? ` • Dernière connexion ${new Date(m.lastLoginAt).toLocaleDateString('fr-FR')}`
                        : ' • Jamais connecté'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={m.function}
                    disabled={m.isSelf}
                    onChange={(e) => changeFunction(m, e.target.value as PatronatFunctionKey)}
                    className="fed-input-light px-3 py-2 text-xs font-bold !w-auto disabled:opacity-40"
                    title={m.isSelf ? 'Vous ne pouvez pas changer votre propre fonction' : 'Changer la fonction'}
                  >
                    {(catalog.length > 0
                      ? catalog.map((c) => ({ key: c.key, label: c.label }))
                      : CREATABLE_FUNCTIONS.map((k) => ({ key: k, label: PATRONAT_FUNCTION_LABELS[k] }))
                    ).map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      setResetTarget(m);
                      setNewPassword('');
                    }}
                    className="px-3 py-2 bg-[#eff6ff] border border-blue-100 rounded-lg text-xs font-bold text-[#1e3a8a] hover:bg-[#1e3a8a] hover:text-white transition-all"
                    title="Réinitialiser le mot de passe"
                  >
                    <AppIcon name="lock" size="submenu" />
                  </button>
                  <button
                    onClick={() => toggleActive(m)}
                    disabled={m.isSelf}
                    className={cn(
                      'px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40',
                      m.isActive
                        ? 'bg-red-50 text-red-700 hover:bg-red-100'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                    )}
                    title={m.isActive ? 'Désactiver le compte' : 'Réactiver le compte'}
                  >
                    {m.isActive ? 'Désactiver' : 'Réactiver'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modale réinitialisation mot de passe */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleReset}
            className="fed-card p-8 w-full max-w-md space-y-5"
          >
            <h3 className="text-lg font-black text-[#0b1d3a]">
              Réinitialiser le mot de passe
            </h3>
            <p className="text-sm text-slate-500 font-medium">
              Nouveau mot de passe pour{' '}
              <span className="font-bold text-[#0b1d3a]">
                {resetTarget.firstName} {resetTarget.lastName}
              </span>{' '}
              ({resetTarget.email}).
            </p>
            <input
              required
              type="text"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="fed-input-light px-4 py-3 font-semibold"
              placeholder="Nouveau mot de passe (min. 8 caractères)"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={resetting}
                className="fed-btn-navy px-5 py-2.5 text-xs disabled:opacity-50"
              >
                {resetting ? 'Validation…' : 'Réinitialiser'}
              </button>
            </div>
          </form>
        </div>
      )}
    </FedPage>
  );
}
