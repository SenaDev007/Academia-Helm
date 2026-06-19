'use client';

/**
 * ============================================================================
 * RECRUITER SETTINGS WORKSPACE
 * ============================================================================
 *
 * Formulaire de configuration du profil de recruteur pour le tenant courant.
 *
 * Types de recruteur :
 *   - PROMOTER     : le promoteur/fondateur gère lui-même le RH (pas de staffId)
 *   - DEDICATED_RH : un responsable RH dédié (lié à un Staff)
 *   - DELEGATED    : un autre membre du staff délégué par le promoteur
 *
 * Champs :
 *   - Type de recruteur (sélecteur)
 *   - Staff (si DEDICATED_RH ou DELEGATED)
 *   - Nom complet (auto-rempli depuis le staff si possible)
 *   - Fonction (ex: "Promoteur / Fondateur")
 *   - Email (utilisé comme from dans les emails aux candidats)
 *   - Téléphone
 *   - Signature texte (affichée dans le footer des emails)
 *   - Format d'entretien par défaut
 *   - Délai minimum entre candidature et entretien (heures)
 *
 * Endpoints :
 *   GET  /api/hr/recruitment/recruiter-profile
 *   PUT  /api/hr/recruitment/recruiter-profile
 *   DELETE /api/hr/recruitment/recruiter-profile (désactiver)
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Save, UserCog, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { useAppSession } from '@/contexts/AppSessionContext';

const PRIMARY = '#1A2BA6';
const ACCENT = '#F5A623';

interface RecruiterProfile {
  id: string;
  recruiterType: string;
  staffId: string | null;
  fullName: string;
  functionLabel: string | null;
  email: string;
  phone: string | null;
  signatureText: string | null;
  signatureLogoUrl: string | null;
  defaultInterviewFormat: string;
  defaultInterviewDelayHr: number;
  isActive: boolean;
}

interface StaffOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  position: string | null;
}

export default function RecruiterSettingsWorkspace() {
  const { tenant } = useAppSession();
  const tenantId = tenant?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<RecruiterProfile | null>(null);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);

  // Form state
  const [recruiterType, setRecruiterType] = useState<string>('PROMOTER');
  const [staffId, setStaffId] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [functionLabel, setFunctionLabel] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [signatureText, setSignatureText] = useState<string>('');
  const [defaultInterviewFormat, setDefaultInterviewFormat] = useState<string>('Visioconférence');
  const [defaultInterviewDelayHr, setDefaultInterviewDelayHr] = useState<number>(48);

  const loadProfile = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/hr/recruitment/recruiter-profile?tenantId=${encodeURIComponent(tenantId)}`,
        { credentials: 'include' },
      );
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setProfile(data);
          setRecruiterType(data.recruiterType || 'PROMOTER');
          setStaffId(data.staffId || '');
          setFullName(data.fullName || '');
          setFunctionLabel(data.functionLabel || '');
          setEmail(data.email || '');
          setPhone(data.phone || '');
          setSignatureText(data.signatureText || '');
          setDefaultInterviewFormat(data.defaultInterviewFormat || 'Visioconférence');
          setDefaultInterviewDelayHr(data.defaultInterviewDelayHr || 48);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const loadStaffList = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/hr/staff?tenantId=${encodeURIComponent(tenantId)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.data ?? [];
        setStaffList(list);
      }
    } catch {
      // Non-critique — le staff est optionnel
    }
  }, [tenantId]);

  useEffect(() => {
    loadProfile();
    loadStaffList();
  }, [loadProfile, loadStaffList]);

  // Auto-remplir fullName/email depuis le staff sélectionné
  const handleStaffChange = (selectedStaffId: string) => {
    setStaffId(selectedStaffId);
    const staff = staffList.find((s) => s.id === selectedStaffId);
    if (staff) {
      if (!fullName) {
        setFullName(`${staff.firstName || ''} ${staff.lastName || ''}`.trim());
      }
      if (!email && staff.email) {
        setEmail(staff.email);
      }
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(
        `/api/hr/recruitment/recruiter-profile?tenantId=${encodeURIComponent(tenantId)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            recruiterType,
            staffId: staffId || null,
            fullName,
            functionLabel: functionLabel || null,
            email,
            phone: phone || null,
            signatureText: signatureText || null,
            defaultInterviewFormat,
            defaultInterviewDelayHr,
            isActive: true,
          }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        setProfile(data);
        setSuccess('Profil de recruteur enregistré avec succès.');
      } else {
        setError(data?.message || data?.detail || `Erreur (${res.status})`);
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur réseau');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!tenantId || !profile) return;
    if (!confirm('Voulez-vous vraiment désactiver le profil de recruteur ? Les emails utiliseront les paramètres par défaut.')) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/hr/recruitment/recruiter-profile?tenantId=${encodeURIComponent(tenantId)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (res.ok) {
        setProfile(null);
        setRecruiterType('PROMOTER');
        setStaffId('');
        setFullName('');
        setFunctionLabel('');
        setEmail('');
        setPhone('');
        setSignatureText('');
        setDefaultInterviewFormat('Visioconférence');
        setDefaultInterviewDelayHr(48);
        setSuccess('Profil de recruteur désactivé.');
      } else {
        const data = await res.json();
        setError(data?.message || `Erreur (${res.status})`);
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur réseau');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: PRIMARY }} />
        <span className="ml-2 text-gray-600 text-sm">Chargement du profil recruteur...</span>
      </div>
    );
  }

  const needsStaff = recruiterType === 'DEDICATED_RH' || recruiterType === 'DELEGATED';

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: `${PRIMARY}10` }}
        >
          <UserCog className="w-6 h-6" style={{ color: PRIMARY }} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Configuration du Recruteur</h2>
          <p className="text-sm text-gray-500">
            Personnalisez l'identité et les préférences du recruteur pour cette école.
          </p>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        {/* Type de recruteur */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Type de recruteur <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { value: 'PROMOTER', label: 'Promoteur', desc: 'Le fondateur gère lui-même le RH' },
              { value: 'DEDICATED_RH', label: 'RH Délégué', desc: 'Un responsable RH dédié' },
              { value: 'DELEGATED', label: 'Membre Staff', desc: 'Un autre membre du staff délégué' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRecruiterType(opt.value)}
                className={`text-left p-3 rounded-xl border-2 transition-all ${
                  recruiterType === opt.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="font-bold text-sm text-gray-900">{opt.label}</div>
                <div className="text-xs text-gray-500 mt-1">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Staff selector (si DEDICATED_RH ou DELEGATED) */}
        {needsStaff && (
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Membre du personnel <span className="text-red-500">*</span>
            </label>
            <select
              value={staffId}
              onChange={(e) => handleStaffChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">— Sélectionner un membre du staff —</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} {s.position ? `(${s.position})` : ''}{' '}
                  {s.email ? `— ${s.email}` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Sélectionnez le membre du staff qui agira comme recruteur.
            </p>
          </div>
        )}

        {/* Nom complet */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Nom complet <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ex: Jean Dupont"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Fonction */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Fonction / Titre</label>
          <input
            type="text"
            value={functionLabel}
            onChange={(e) => setFunctionLabel(e.target.value)}
            placeholder="Ex: Promoteur / Fondateur, Responsable RH"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Email + Téléphone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="recruteur@ecole.com"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Utilisé comme expéditeur dans les emails aux candidats.
            </p>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Téléphone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+229 ..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Signature */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Signature des emails
          </label>
          <textarea
            value={signatureText}
            onChange={(e) => setSignatureText(e.target.value)}
            placeholder={'Ex:\nJean Dupont\nPromoteur / Fondateur\nMon École'}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Affichée dans le footer des emails envoyés aux candidats.
          </p>
        </div>

        {/* Préférences */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Format d'entretien par défaut
            </label>
            <select
              value={defaultInterviewFormat}
              onChange={(e) => setDefaultInterviewFormat(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Visioconférence">Visioconférence</option>
              <option value="Présentiel">Présentiel</option>
              <option value="Téléphone">Téléphone</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Délai min. candidature → entretien (heures)
            </label>
            <input
              type="number"
              value={defaultInterviewDelayHr}
              onChange={(e) => setDefaultInterviewDelayHr(parseInt(e.target.value, 10) || 48)}
              min={0}
              max={720}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        {profile ? (
          <button
            onClick={handleDeactivate}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-red-600 border border-red-200 hover:bg-red-50 transition disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Désactiver
          </button>
        ) : (
          <div />
        )}
        <button
          onClick={handleSave}
          disabled={saving || !fullName || !email}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: PRIMARY }}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Enregistrer
            </>
          )}
        </button>
      </div>
    </div>
  );
}
