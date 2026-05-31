/**
 * ============================================================================
 * HR MODULE - ADD STAFF MODAL
 * Design harmonisé avec le pattern pédagogie
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { X, User, Mail, Phone, Briefcase, Shield, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/toast';

const PRIMARY = '#1A2BA6';

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantId: string;
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10 transition';

const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5';

export function AddStaffModal({ isOpen, onClose, onSuccess, tenantId }: AddStaffModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    category: 'ADMIN',
    position: '',
    gender: 'MALE',
    birthDate: '',
  });

  if (!isOpen) return null;

  const update = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await apiFetch(`/hr/staff?tenantId=${tenantId}`, {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      toast({ variant: 'success', title: 'Collaborateur ajouté avec succès' });
      onSuccess();
      onClose();
    } catch {
      toast({ variant: 'error', title: "Erreur lors de l'ajout" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ background: PRIMARY }}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/15 p-2">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Nouveau collaborateur</h3>
              <p className="text-xs text-white/70">Identité et informations professionnelles</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-white/15 transition-colors text-white/80 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* Nom & Prénom */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Prénom</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  required
                  type="text"
                  placeholder="Ex : Kouadio"
                  className={inputClass + ' pl-9'}
                  value={formData.firstName}
                  onChange={(e) => update('firstName', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Nom de famille</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  required
                  type="text"
                  placeholder="Ex : Koffi"
                  className={inputClass + ' pl-9'}
                  value={formData.lastName}
                  onChange={(e) => update('lastName', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Email & Téléphone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Email professionnel</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  placeholder="prenom.nom@ecole.ci"
                  className={inputClass + ' pl-9'}
                  value={formData.email}
                  onChange={(e) => update('email', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Téléphone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="tel"
                  placeholder="+225 07 00 00 00 00"
                  className={inputClass + ' pl-9'}
                  value={formData.phone}
                  onChange={(e) => update('phone', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Catégorie & Poste */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Catégorie</label>
              <select
                className={inputClass}
                value={formData.category}
                onChange={(e) => update('category', e.target.value)}
              >
                <option value="PEDAGOGICAL">Corps Enseignant</option>
                <option value="ADMIN">Administration</option>
                <option value="SUPPORT">Personnel d'appui</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Poste occupé</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ex : Comptable, Professeur de Maths…"
                  className={inputClass + ' pl-9'}
                  value={formData.position}
                  onChange={(e) => update('position', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Genre & Date de naissance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Genre</label>
              <select
                className={inputClass}
                value={formData.gender}
                onChange={(e) => update('gender', e.target.value)}
              >
                <option value="MALE">Masculin</option>
                <option value="FEMALE">Féminin</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Date de naissance</label>
              <input
                type="date"
                className={inputClass}
                value={formData.birthDate}
                onChange={(e) => update('birthDate', e.target.value)}
              />
            </div>
          </div>

          {/* Séparateur */}
          <div className="border-t border-slate-100" />

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] rounded-xl py-2.5 text-sm font-bold text-white flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: PRIMARY }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4" />
                  Enregistrer le collaborateur
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
