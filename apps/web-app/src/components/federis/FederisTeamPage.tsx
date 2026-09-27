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
  OPERATOR: 'bg-gray-100 text-gray-700',
  VIEWER: 'bg-gray-100 text-gray-700',
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
    <div className="space-y-8">
      {/* En-tête */}
      <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16" />
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-blue-900 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
              <AppIcon name="students" size="dashboard" className="text-white" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 italic tracking-tighter">
              Équipe &amp; Comptes
            </h1>
          </div>
          <p className="text-gray-500 font-medium max-w-xl">
            Créez les comptes de votre équipe patronale. Chaque membre se connecte avec son
            email et accède uniquement aux fonctions de son rôle : secrétaire, trésorier,
            organisateur, chargé de mission.
          </p>
        </div>
        <div className="flex items-center space-x-4 shrink-0">
          <div className="text-right">
            <p className="text-2xl font-black text-blue-900 tracking-tighter">{members.length}</p>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Comptes membres
            </p>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="px-6 py-3 bg-blue-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all"
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
          className="bg-white rounded-3xl border border-blue-100 shadow-lg p-8 space-y-6"
        >
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">
            Nouveau compte membre
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                Prénom
              </label>
              <input
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900"
                placeholder="Awa"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                Nom
              </label>
              <input
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900"
                placeholder="Dossou"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                Email (identifiant de connexion)
              </label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900"
                placeholder="awa.dossou@patronat.org"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                Téléphone (optionnel)
              </label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900"
                placeholder="+229 97 00 00 00"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                Fonction
              </label>
              <select
                value={form.function}
                onChange={(e) => setForm({ ...form, function: e.target.value as PatronatFunctionKey })}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900"
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
              <p className="mt-2 text-xs text-gray-500 font-medium">
                {PATRONAT_FUNCTION_DESCRIPTIONS[form.function]}
              </p>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                Mot de passe (min. 8 caractères)
              </label>
              <input
                required
                type="text"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900"
                placeholder="À communiquer au membre"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="px-8 py-3.5 bg-blue-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all disabled:opacity-50"
            >
              {creating ? 'Création…' : 'Créer le compte'}
            </button>
          </div>
        </form>
      )}

      {/* Liste des membres */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">
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
          <div className="p-12 text-center text-sm font-bold text-gray-400">
            Chargement de l&apos;équipe…
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-sm font-bold text-gray-400">
            Aucun membre — créez le premier compte de votre équipe.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {members.map((m) => (
              <div key={m.id} className="p-6 lg:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-gray-50 transition-all">
                <div className="flex items-center space-x-5">
                  <div
                    className={cn(
                      'w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm',
                      m.isActive ? 'bg-blue-50 text-blue-900' : 'bg-gray-100 text-gray-400',
                    )}
                  >
                    {(m.firstName?.[0] ?? m.email[0]).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className="text-base font-black text-gray-900">
                        {m.firstName} {m.lastName}
                        {m.isSelf && (
                          <span className="ml-2 text-[9px] font-black uppercase tracking-widest bg-blue-900 text-white px-2 py-0.5 rounded">
                            Vous
                          </span>
                        )}
                      </h4>
                      <span
                        className={cn(
                          'text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded',
                          FUNCTION_BADGES[m.function] ?? FUNCTION_BADGES.VIEWER,
                        )}
                      >
                        {m.functionLabel}
                      </span>
                      {!m.isActive && (
                        <span className="text-[9px] font-black uppercase tracking-widest bg-red-100 text-red-700 px-2.5 py-1 rounded">
                          Désactivé
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1.5">
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
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-900 disabled:opacity-40"
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
                    className="px-3 py-2 bg-gray-50 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100 hover:text-blue-900 transition-all"
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
            className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md space-y-5"
          >
            <h3 className="text-lg font-black text-gray-900">
              Réinitialiser le mot de passe
            </h3>
            <p className="text-sm text-gray-500 font-medium">
              Nouveau mot de passe pour{' '}
              <span className="font-bold text-gray-900">
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
              className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900"
              placeholder="Nouveau mot de passe (min. 8 caractères)"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={resetting}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-blue-900 text-white hover:bg-blue-800 transition-all disabled:opacity-50"
              >
                {resetting ? 'Validation…' : 'Réinitialiser'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
