/**
 * FederisBureauPage — Bureau & Membres du patronat (Academia Federis)
 * ═══════════════════════════════════════════════════════════════════════════
 * Cahier des charges §7.1 / §11 : composition du bureau institutionnel —
 * Président, Vice-Président, Secrétaire Général, Trésorier…
 *
 * ⭐ VRAIES DONNÉES PERSISTÉES (2026-09-28) — remplace l'ancienne page de
 *    démonstration (mock) : CRUD complet via l'API Federis
 *    (table patronat_bureau_members) :
 *      GET    /federis/patronat/bureau      — composition (ordre protocolaire)
 *      POST   /federis/patronat/bureau      — ajouter un membre
 *      PATCH  /federis/patronat/bureau/:id  — modifier (rôle, identité, état)
 *      DELETE /federis/patronat/bureau/:id  — retirer un membre
 *
 * Rôles : lecture pour tous les membres du patronat ; création / modification /
 * suppression réservées au COORDONNATEUR (garde API → canManage).
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { FedPage, FedStagger, FedStaggerItem, FedCountUp } from '@/components/federis/federis-motion';

interface BureauMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  roleLabel: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  userId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CatalogEntry {
  key: string;
  label: string;
}

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  role: 'MEMBRE',
  email: '',
  phone: '',
};

export default function FederisBureauPage() {
  const [members, setMembers] = useState<BureauMember[]>([]);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Formulaire de création
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Édition en ligne (un membre à la fois)
  const [editTarget, setEditTarget] = useState<BureauMember | null>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', role: 'MEMBRE', email: '', phone: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/federis/patronat/bureau', { timeout: 20000 });
      setMembers(res.data?.members ?? []);
      setCatalog(res.data?.catalog ?? []);
      setCanManage(Boolean(res.data?.canManage));
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          'Impossible de charger la composition du bureau. Veuillez réessayer.',
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
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = 'Le prénom est requis';
    if (!form.lastName.trim()) errs.lastName = 'Le nom est requis';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errs.email = 'Adresse électronique invalide';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      await apiClient.post(
        '/federis/patronat/bureau',
        {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          role: form.role,
          ...(form.email.trim() ? { email: form.email.trim().toLowerCase() } : {}),
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        },
        { timeout: 20000 },
      );
      setNotice(`${form.firstName.trim()} ${form.lastName.trim()} a rejoint le bureau.`);
      setForm(EMPTY_FORM);
      setShowCreate(false);
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Création impossible.';
      setFormErrors({ submit: Array.isArray(msg) ? msg.join(' ') : String(msg) });
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (member: BureauMember) => {
    setEditTarget(member);
    setEditForm({
      firstName: member.firstName,
      lastName: member.lastName,
      role: member.role,
      email: member.email ?? '',
      phone: member.phone ?? '',
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiClient.patch(
        `/federis/patronat/bureau/${editTarget.id}`,
        {
          firstName: editForm.firstName.trim(),
          lastName: editForm.lastName.trim(),
          role: editForm.role,
          ...(editForm.email.trim() ? { email: editForm.email.trim().toLowerCase() } : { email: null }),
          ...(editForm.phone.trim() ? { phone: editForm.phone.trim() } : { phone: null }),
        },
        { timeout: 20000 },
      );
      setNotice('Membre mis à jour.');
      setEditTarget(null);
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Modification impossible.';
      setError(Array.isArray(msg) ? msg.join(' ') : String(msg));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (member: BureauMember) => {
    setError(null);
    setNotice(null);
    try {
      await apiClient.patch(
        `/federis/patronat/bureau/${member.id}`,
        { isActive: !member.isActive },
        { timeout: 20000 },
      );
      setNotice(
        member.isActive
          ? `${member.firstName} ${member.lastName} est passé(e) en inactif.`
          : `${member.firstName} ${member.lastName} est réactivé(e).`,
      );
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Modification impossible.');
    }
  };

  const handleDelete = async (member: BureauMember) => {
    if (
      !window.confirm(
        `Retirer ${member.firstName} ${member.lastName} (${member.roleLabel}) du bureau ? Cette action est définitive.`,
      )
    ) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await apiClient.delete(`/federis/patronat/bureau/${member.id}`, { timeout: 20000 });
      setNotice(`${member.firstName} ${member.lastName} a été retiré(e) du bureau.`);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Suppression impossible.');
    }
  };

  const initials = (m: BureauMember) =>
    `${m.firstName?.[0] ?? ''}${m.lastName?.[0] ?? ''}`.toUpperCase() || '?';

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-72 bg-blue-100 rounded-full" />
        <div className="fed-card h-32" />
        <div className="grid md:grid-cols-3 gap-6">
          <div className="fed-card h-52" />
          <div className="fed-card h-52" />
          <div className="fed-card h-52" />
        </div>
      </div>
    );
  }

  return (
    <FedPage className="space-y-8">
      {/* ── En-tête Premium Bureau ── */}
      <div className="fed-card p-10 flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16" />
        <div className="relative z-10">
          <div className="fed-badge mb-4">Module gouvernance</div>
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#1e3a8a] to-[#0b1d3a] rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
              <AppIcon name="building" size="dashboard" className="text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-[#0b1d3a] tracking-tight">
              Bureau &amp; Membres
            </h1>
          </div>
          <p className="text-slate-500 font-medium max-w-xl text-sm">
            Composition officielle du bureau du patronat — président, secrétariat, trésorerie et
            conseillers. Ces informations sont persistées et suivies dans le journal d&apos;audit.
          </p>
        </div>
        <div className="flex items-center space-x-6 shrink-0 relative z-10">
          <div className="text-right">
            <p className="text-2xl font-black text-[#1e3a8a]">
              <FedCountUp value={members.filter((m) => m.isActive).length} />
            </p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Membres actifs
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => {
                setShowCreate((v) => !v);
                setEditTarget(null);
              }}
              className="fed-btn-gold fed-btn-shimmer px-6 py-3 text-sm"
            >
              <AppIcon name={showCreate ? 'close' : 'add'} size="submenu" />
              {showCreate ? 'Annuler' : 'Nouveau Membre'}
            </button>
          )}
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

      {/* ── Formulaire d'ajout (coordonnateur) ── */}
      {showCreate && canManage && (
        <form onSubmit={handleCreate} className="fed-card p-8 space-y-6">
          <h3 className="text-sm font-black text-[#0b1d3a] uppercase tracking-widest">
            Nouveau membre du bureau
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Prénom <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className={cn('fed-input-light px-4 py-3 font-semibold', formErrors.firstName && '!border-red-400')}
                placeholder="Awa"
              />
              {formErrors.firstName && <p className="mt-1 text-sm text-red-600">{formErrors.firstName}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className={cn('fed-input-light px-4 py-3 font-semibold', formErrors.lastName && '!border-red-400')}
                placeholder="Dossou"
              />
              {formErrors.lastName && <p className="mt-1 text-sm text-red-600">{formErrors.lastName}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Rôle au bureau <span className="text-red-500">*</span>
              </label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold"
              >
                {catalog.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Email (optionnel)
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={cn('fed-input-light px-4 py-3 font-semibold', formErrors.email && '!border-red-400')}
                placeholder="awa.dossou@patronat.org"
              />
              {formErrors.email && <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Téléphone (optionnel)
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold"
                placeholder="+229 …"
              />
            </div>
          </div>

          {formErrors.submit && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
              <p className="text-sm text-red-600">{formErrors.submit}</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="fed-btn-navy px-6 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Ajout…' : 'Ajouter au bureau'}
            </button>
          </div>
        </form>
      )}

      {/* ── Édition en ligne ── */}
      {editTarget && (
        <form onSubmit={handleUpdate} className="fed-card p-8 space-y-6 border-2 border-amber-300">
          <h3 className="text-sm font-black text-[#0b1d3a] uppercase tracking-widest">
            Modifier — {editTarget.firstName} {editTarget.lastName}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Prénom</label>
              <input
                required
                value={editForm.firstName}
                onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nom</label>
              <input
                required
                value={editForm.lastName}
                onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Rôle</label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold"
              >
                {catalog.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Téléphone</label>
              <input
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditTarget(null)}
              className="px-5 py-2.5 rounded-full text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="fed-btn-navy px-6 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}

      {/* ── Composition du bureau ── */}
      {members.length === 0 ? (
        <div className="fed-card px-6 py-14 text-center">
          <AppIcon name="building" size="dashboard" className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto">
            Aucun membre enregistré au bureau. {canManage ? 'Ajoutez le président, le secrétaire général et les autres membres pour composer votre bureau officiel.' : 'Le coordonnateur du patronat n\u2019a pas encore composé le bureau.'}
          </p>
        </div>
      ) : (
        <FedStagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {members.map((member) => (
            <FedStaggerItem key={member.id}>
              <div
                className={cn(
                  'fed-card fed-card-shimmer p-8 transition-all group h-full relative',
                  !member.isActive && 'opacity-60',
                )}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="w-14 h-14 bg-[#eff6ff] rounded-2xl flex items-center justify-center text-[#1e3a8a] font-black text-xl group-hover:bg-[#0b1d3a] group-hover:text-white transition-all">
                    {initials(member)}
                  </div>
                  <div
                    className={cn(
                      'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest',
                      member.isActive
                        ? 'bg-green-50 text-green-700'
                        : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {member.isActive ? 'Actif' : 'Inactif'}
                  </div>
                </div>

                {editTarget?.id === member.id ? null : (
                  <>
                    <h3 className="text-lg font-black text-[#0b1d3a] mb-1">
                      {member.firstName} {member.lastName}
                    </h3>
                    <p className="text-[#1e3a8a] text-xs font-bold uppercase tracking-widest mb-2">
                      {member.roleLabel}
                    </p>
                    {(member.email || member.phone) && (
                      <div className="space-y-1 mb-2">
                        {member.email && (
                          <p className="text-xs text-slate-500 truncate" title={member.email}>
                            {member.email}
                          </p>
                        )}
                        {member.phone && <p className="text-xs text-slate-500">{member.phone}</p>}
                      </div>
                    )}

                    <div className="pt-4 border-t border-blue-50 flex items-center justify-between">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Depuis {new Date(member.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                      {canManage && (
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={() => startEdit(member)}
                            className="p-2 text-slate-400 hover:text-[#0b1d3a] transition-colors"
                            title="Modifier ce membre"
                          >
                            <AppIcon name="edit" size="submenu" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleActive(member)}
                            className="p-2 text-slate-400 hover:text-amber-600 transition-colors"
                            title={member.isActive ? 'Désactiver' : 'Réactiver'}
                          >
                            <AppIcon name={member.isActive ? 'close' : 'check'} size="submenu" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(member)}
                            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                            title="Retirer du bureau"
                          >
                            <AppIcon name="delete" size="submenu" />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </FedStaggerItem>
          ))}
        </FedStagger>
      )}
    </FedPage>
  );
}
