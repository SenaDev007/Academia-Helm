'use client';

/**
 * ============================================================================
 * DIRECTORS WORKSPACE
 * ============================================================================
 *
 * Configuration des directeurs par niveau scolaire + piste linguistique.
 * Suit le même pattern que RecruiterSettingsWorkspace (centré, max-w-3xl).
 *
 * Fonctionnalités :
 *   - Définition du directeur pour chaque niveau (Maternelle / Primaire / Secondaire)
 *   - Pour chaque niveau : 1 directeur FR (+ 1 directeur EN si bilingue)
 *   - Toggle "Même directeur pour Maternelle + Primaire" (réplication automatique)
 *   - Signature : upload PNG OU signature électronique (canvas)
 *   - Les signatures seront utilisées sur les bulletins (module examen)
 *
 * Endpoints :
 *   GET    /api/hr/school-directors
 *   POST   /api/hr/school-directors (upsert)
 *   DELETE /api/hr/school-directors/:id (soft delete)
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Save, UserCog, CheckCircle2, AlertCircle, Trash2,
  Upload, Pen, School, Globe, Link2, Link2Off, Eraser, Mail, UserCheck,
} from 'lucide-react';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useBilingual } from '@/contexts/BilingualContext';
import { SignatureCanvas } from '@/components/ui/SignatureCanvas';
import apiClient from '@/lib/api/client';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { cn } from '@/lib/utils';

const PRIMARY = '#1A2BA6';
const ACCENT = '#F5A623';

interface Director {
  id: string;
  schoolLevelId: string;
  schoolLevelCode: string;
  schoolLevelName: string;
  language: string;
  fullName: string;
  functionLabel: string | null;
  email: string | null;
  phone: string | null;
  signatureDataUrl: string | null;
  signatureUploadedUrl: string | null;
  staffId?: string | null;
}

interface SchoolLevel {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

// ⭐ Type pour la liste du personnel sélectionnable comme directeur
interface StaffOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  roleType: string | null;
  status: string;
}

const langLabels: Record<string, string> = { FR: 'Francophone', EN: 'Anglophone' };

export default function DirectorsWorkspace() {
  const { tenant } = useAppSession();
  const { isEnabled: isBilingual } = useBilingual();
  const tenantId = tenant?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingCredentials, setSendingCredentials] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [directors, setDirectors] = useState<Director[]>([]);
  const [schoolLevels, setSchoolLevels] = useState<SchoolLevel[]>([]);
  // ⭐ Liste du personnel existant (pour le sélecteur de directeur)
  const [staffList, setStaffList] = useState<StaffOption[]>([]);

  // Form state: key = `${schoolLevelId}_${language}`
  const [forms, setForms] = useState<Record<string, any>>({});
  const [signatureMode, setSignatureMode] = useState<Record<string, 'upload' | 'canvas' | 'none'>>({});

  // ⭐ Toggle "Même directeur pour Maternelle + Primaire" — PAR PISTE LINGUISTIQUE
  //    On peut avoir le même directeur FR pour Maternelle+Primaire
  //    mais des directeurs EN différents pour chaque niveau.
  //    Clé: 'FR' ou 'EN' → boolean
  const [sameMaternellePrimaireByLang, setSameMaternellePrimaireByLang] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      // Load school levels
      const levelsRes = await apiClient.get('/school-levels');
      const levels = Array.isArray(levelsRes.data) ? levelsRes.data : (levelsRes.data?.items || []);
      const activeLevels = levels.filter((l: any) => l.id !== 'ALL' && l.isActive);
      setSchoolLevels(activeLevels);

      // ⭐ Charger la liste du personnel existant (pour le sélecteur de directeur)
      //    On filtre : status=ACTIVE + email non null (sinon pas d'envoi d'identifiants possible)
      //    Utilisation de hrFetch (offline-aware) au lieu de apiClient direct.
      try {
        const staffData = await hrFetch<any[]>(hrUrl('staff', { tenantId, status: 'ACTIVE', limit: '500' }));
        const allStaff = Array.isArray(staffData) ? staffData : (staffData?.items || staffData?.data || []);
        // Filtrer : doit avoir un email (sinon pas d'envoi d'identifiants possible)
        const eligibleStaff = allStaff.filter((s: any) => s.email);
        setStaffList(eligibleStaff);
      } catch (err) {
        console.warn('Failed to load staff list for director picker:', err);
        // Fallback : essayer sans le filtre status
        try {
          const staffData = await hrFetch<any[]>(hrUrl('staff', { tenantId, limit: '500' }));
          const allStaff = Array.isArray(staffData) ? staffData : (staffData?.items || staffData?.data || []);
          const eligibleStaff = allStaff.filter((s: any) => s.email);
          setStaffList(eligibleStaff);
        } catch (err2) {
          console.warn('Failed to load staff list (fallback):', err2);
          setStaffList([]);
        }
      }

      // Load existing directors
      const directorsRes = await apiClient.get('/hr/school-directors');
      const existingDirectors = Array.isArray(directorsRes.data) ? directorsRes.data : [];
      setDirectors(existingDirectors);

      // Build form state
      const formState: Record<string, any> = {};
      const sigMode: Record<string, 'upload' | 'canvas' | 'none'> = {};
      const languages = isBilingual ? ['FR', 'EN'] : ['FR'];

      for (const level of activeLevels) {
        for (const lang of languages) {
          const key = `${level.id}_${lang}`;
          const existing = existingDirectors.find((d: any) =>
            d.schoolLevelId === level.id && d.language === lang
          );
          formState[key] = {
            schoolLevelId: level.id,
            language: lang,
            staffId: existing?.staffId || '',
            fullName: existing?.fullName || '',
            functionLabel: existing?.functionLabel || '',
            email: existing?.email || '',
            phone: existing?.phone || '',
            signatureDataUrl: existing?.signatureDataUrl || null,
            signatureUploadedUrl: existing?.signatureUploadedUrl || null,
          };
          if (existing?.signatureDataUrl) sigMode[key] = 'canvas';
          else if (existing?.signatureUploadedUrl) sigMode[key] = 'upload';
          else sigMode[key] = 'none';
        }
      }
      setForms(formState);
      setSignatureMode(sigMode);

      // ⭐ Détecter si Maternelle et Primaire ont déjà le même directeur
      //    PAR PISTE LINGUISTIQUE (indépendamment pour FR et EN)
      if (activeLevels.length >= 2) {
        const maternelle = activeLevels.find(l => (l.code || '').toUpperCase().includes('MATERNELLE'));
        const primaire = activeLevels.find(l => (l.code || '').toUpperCase().includes('PRIMAIRE'));
        if (maternelle && primaire) {
          const langs = isBilingual ? ['FR', 'EN'] : ['FR'];
          const newToggles: Record<string, boolean> = {};
          for (const lang of langs) {
            const mKey = `${maternelle.id}_${lang}`;
            const pKey = `${primaire.id}_${lang}`;
            const mForm = formState[mKey];
            const pForm = formState[pKey];
            if (mForm && pForm && mForm.fullName &&
                mForm.fullName === pForm.fullName &&
                mForm.functionLabel === pForm.functionLabel &&
                mForm.email === pForm.email &&
                mForm.phone === pForm.phone) {
              newToggles[lang] = true;
            } else {
              newToggles[lang] = false;
            }
          }
          setSameMaternellePrimaireByLang(newToggles);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId, isBilingual]);

  useEffect(() => { loadData(); }, [loadData]);

  // ⭐ Réplication Maternelle → Primaire quand le toggle est activé POUR CETTE LANGUE
  const replicateToPrimaire = useCallback((sourceKey: string, field: string, value: string) => {
    const maternelle = schoolLevels.find(l => (l.code || '').toUpperCase().includes('MATERNELLE'));
    const primaire = schoolLevels.find(l => (l.code || '').toUpperCase().includes('PRIMAIRE'));
    if (!maternelle || !primaire) return;
    // Source key = `${maternelleId}_${lang}`, target key = `${primaireId}_${lang}`
    if (!sourceKey.startsWith(`${maternelle.id}_`)) return;
    const lang = sourceKey.split('_')[1];
    // ⭐ Vérifier le toggle POUR CETTE LANGUE uniquement
    if (!sameMaternellePrimaireByLang[lang]) return;
    const targetKey = `${primaire.id}_${lang}`;
    setForms(prev => ({
      ...prev,
      [targetKey]: { ...prev[targetKey], [field]: value },
    }));
  }, [sameMaternellePrimaireByLang, schoolLevels]);

  const handleSave = async (key: string) => {
    const formData = forms[key];
    if (!formData || !formData.fullName?.trim()) {
      setError('Le nom complet est obligatoire');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      // ⭐ Construire le payload — ne pas envoyer les signatures null
      //    (sinon le backend peut interpréter null comme "effacer")
      const payload: any = {
        schoolLevelId: formData.schoolLevelId,
        language: formData.language,
        fullName: formData.fullName,
        functionLabel: formData.functionLabel || null,
        email: formData.email || null,
        phone: formData.phone || null,
        // ⭐ Si un staff est sélectionné, l'inclure pour que le backend
        //    puisse résoudre les infos à jour + envoyer les identifiants.
        staffId: formData.staffId || null,
        // ⭐ Demander au backend d'envoyer automatiquement les identifiants
        //    au directeur (mail avec loginUrl + mdp temporaire + lien portail).
        //    Le directeur recevra un mail "Vous êtes le directeur de [niveau]".
        sendCredentialsEmail: true,
      };
      // ⭐ Envoyer la signature SEULEMENT si elle a une valeur
      //    (évite d'écraser une signature existante avec null)
      if (formData.signatureDataUrl) {
        payload.signatureDataUrl = formData.signatureDataUrl;
      }
      if (formData.signatureUploadedUrl) {
        payload.signatureUploadedUrl = formData.signatureUploadedUrl;
      }

      const saveRes = await apiClient.post('/hr/school-directors', payload);
      // ⭐ Si le backend a renvoyé un email envoyé, l'indiquer dans le succès
      const emailSentInfo = saveRes?.data?.emailSent
        ? ` · Identifiants envoyés à ${saveRes.data.email || formData.email}`
        : '';
      setSuccess(`Directeur enregistré : ${formData.fullName}${emailSentInfo}`);

      // ⭐ Si le toggle "même directeur Maternelle + Primaire" est activé POUR CETTE LANGUE,
      //    ET qu'on sauvegarde la Maternelle, sauvegarder aussi le Primaire (même langue)
      const langOfKey = key.split('_')[1];
      if (sameMaternellePrimaireByLang[langOfKey]) {
        const maternelle = schoolLevels.find(l => (l.code || '').toUpperCase().includes('MATERNELLE'));
        const primaire = schoolLevels.find(l => (l.code || '').toUpperCase().includes('PRIMAIRE'));
        if (maternelle && primaire && key.startsWith(`${maternelle.id}_`)) {
          const lang = key.split('_')[1];
          const primaireKey = `${primaire.id}_${lang}`;
          const primaireForm = forms[primaireKey];
          if (primaireForm && primaireForm.fullName?.trim()) {
            const primairePayload: any = {
              schoolLevelId: primaireForm.schoolLevelId,
              language: primaireForm.language,
              fullName: primaireForm.fullName,
              functionLabel: primaireForm.functionLabel || null,
              email: primaireForm.email || null,
              phone: primaireForm.phone || null,
            };
            if (primaireForm.signatureDataUrl) primairePayload.signatureDataUrl = primaireForm.signatureDataUrl;
            if (primaireForm.signatureUploadedUrl) primairePayload.signatureUploadedUrl = primaireForm.signatureUploadedUrl;
            await apiClient.post('/hr/school-directors', primairePayload);
          }
        }
      }

      setTimeout(() => setSuccess(null), 3000);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (directorId: string) => {
    if (!confirm('Supprimer ce directeur ?')) return;
    try {
      await apiClient.delete(`/hr/school-directors/${directorId}`);
      setSuccess('Directeur supprimé');
      setTimeout(() => setSuccess(null), 3000);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    }
  };

  // ⭐ Signature canvas callback — STABLE (useCallback) pour éviter les stale closures
  const handleSignatureChange = useCallback((key: string, dataUrl: string | null) => {
    setForms(prev => ({
      ...prev,
      [key]: { ...prev[key], signatureDataUrl: dataUrl },
    }));
    // ⭐ Répliquer vers le Primaire si le toggle est activé POUR CETTE LANGUE
    if (dataUrl) {
      const maternelle = schoolLevels.find(l => (l.code || '').toUpperCase().includes('MATERNELLE'));
      const primaire = schoolLevels.find(l => (l.code || '').toUpperCase().includes('PRIMAIRE'));
      if (maternelle && primaire && key.startsWith(`${maternelle.id}_`)) {
        const lang = key.split('_')[1];
        if (sameMaternellePrimaireByLang[lang]) {
          const targetKey = `${primaire.id}_${lang}`;
          setForms(prev => ({
            ...prev,
            [targetKey]: { ...prev[targetKey], signatureDataUrl: dataUrl },
          }));
        }
      }
    }
  }, [sameMaternellePrimaireByLang, schoolLevels]);

  const handleFileUpload = async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setForms(prev => ({
        ...prev,
        [key]: { ...prev[key], signatureUploadedUrl: dataUrl },
      }));
      // ⭐ Répliquer vers le Primaire si toggle activé POUR CETTE LANGUE
      const maternelle = schoolLevels.find(l => (l.code || '').toUpperCase().includes('MATERNELLE'));
      const primaire = schoolLevels.find(l => (l.code || '').toUpperCase().includes('PRIMAIRE'));
      if (maternelle && primaire && key.startsWith(`${maternelle.id}_`)) {
        const lang = key.split('_')[1];
        if (sameMaternellePrimaireByLang[lang]) {
          const targetKey = `${primaire.id}_${lang}`;
          setForms(prev => ({
            ...prev,
            [targetKey]: { ...prev[targetKey], signatureUploadedUrl: dataUrl },
          }));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const updateField = (key: string, field: string, value: string) => {
    setForms(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
    // ⭐ Répliquer vers le Primaire si toggle activé
    replicateToPrimaire(key, field, value);
  };

  // ⭐ Sélection d'un staff depuis le dropdown — remplit automatiquement
  //    les champs fullName/email/phone/functionLabel depuis le Staff record.
  //    Le staff est la source de vérité ; les champs manuels deviennent
  //    read-only (mais toujours modifiables manuellement si besoin).
  const handleStaffSelect = (key: string, staffId: string) => {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) {
      // Si on déselectionne (staffId vide), on ne clear pas les champs
      // pour éviter de perdre des données déjà saisies manuellement.
      setForms(prev => ({
        ...prev,
        [key]: { ...prev[key], staffId: '' },
      }));
      return;
    }
    const newFullName = `${staff.firstName || ''} ${staff.lastName || ''}`.trim();
    setForms(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        staffId: staff.id,
        fullName: newFullName,
        email: staff.email || prev[key].email || '',
        phone: staff.phone || prev[key].phone || '',
        functionLabel: staff.position || prev[key].functionLabel || '',
      },
    }));
    // ⭐ Répliquer vers le Primaire si toggle activé
    replicateToPrimaire(key, 'fullName', newFullName);
    replicateToPrimaire(key, 'email', staff.email || '');
    replicateToPrimaire(key, 'phone', staff.phone || '');
    replicateToPrimaire(key, 'functionLabel', staff.position || '');
  };

  // ⭐ Envoi / Renvoi d'identifiants au directeur sélectionné.
  //    Appelle POST /hr/school-directors/:id/send-credentials qui crée
  //    (ou met à jour) un User + envoie un mail avec loginUrl + mdp temporaire.
  const handleSendCredentials = async (directorId: string, directorName: string) => {
    setSendingCredentials(directorId);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiClient.post(`/hr/school-directors/${directorId}/send-credentials`);
      const data = res.data || {};
      if (data.success) {
        setSuccess(`Identifiants envoyés à ${directorName} (${data.email || 'email inconnu'}). Le directeur peut maintenant se connecter et modifier son mot de passe.`);
      } else {
        setError(data.message || 'Erreur lors de l\'envoi des identifiants');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSendingCredentials(null);
    }
  };

  const languages = isBilingual ? ['FR', 'EN'] : ['FR'];

  // ⭐ Vérifier si on a au moins Maternelle + Primaire pour afficher le toggle
  const hasMaternelleAndPrimaire = schoolLevels.some(l => (l.code || '').toUpperCase().includes('MATERNELLE'))
    && schoolLevels.some(l => (l.code || '').toUpperCase().includes('PRIMAIRE'));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: PRIMARY }} />
        <span className="ml-2 text-gray-600 text-sm">Chargement des directeurs...</span>
      </div>
    );
  }

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
          <h2 className="text-xl font-bold text-gray-900">Configuration des Directeurs</h2>
          <p className="text-sm text-gray-500">
            Définissez les directeurs par niveau scolaire et piste linguistique. Les signatures seront utilisées sur les bulletins.
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

      {/* ⭐ Toggles "Même directeur pour Maternelle + Primaire" — UN PAR PISTE LINGUISTIQUE */}
      {hasMaternelleAndPrimaire && languages.map((lang) => {
        const isToggleOn = !!sameMaternellePrimaireByLang[lang];
        return (
          <div key={`toggle-${lang}`} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: isToggleOn ? `${PRIMARY}15` : `${PRIMARY}08` }}
            >
              {isToggleOn
                ? <Link2 className="w-5 h-5" style={{ color: PRIMARY }} />
                : <Link2Off className="w-5 h-5 text-slate-400" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">
                Même directeur pour Maternelle et Primaire
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                  <Globe className="w-3 h-3" /> {langLabels[lang]}
                </span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Les informations saisies pour la Maternelle <strong>{langLabels[lang]}</strong> seront automatiquement répliquées vers le Primaire <strong>{langLabels[lang]}</strong>.
                {!isBilingual && ' (Mode non bilingue — piste unique FR.)'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const newVal = !isToggleOn;
                setSameMaternellePrimaireByLang(prev => ({ ...prev, [lang]: newVal }));
                if (newVal) {
                  // ⭐ Activer : répliquer immédiatement Maternelle → Primaire POUR CETTE LANGUE
                  const maternelle = schoolLevels.find(l => (l.code || '').toUpperCase().includes('MATERNELLE'));
                  const primaire = schoolLevels.find(l => (l.code || '').toUpperCase().includes('PRIMAIRE'));
                  if (maternelle && primaire) {
                    const mKey = `${maternelle.id}_${lang}`;
                    const pKey = `${primaire.id}_${lang}`;
                    const mForm = forms[mKey];
                    if (mForm) {
                      setForms(prev => ({
                        ...prev,
                        [pKey]: { ...prev[pKey], ...mForm, schoolLevelId: primaire.id },
                      }));
                    }
                  }
                }
              }}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0",
                isToggleOn ? "" : "bg-slate-300"
              )}
              style={isToggleOn ? { background: PRIMARY } : {}}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  isToggleOn ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
        );
      })}

      {/* Director cards per level */}
      {schoolLevels.map((level) => {
        const isMaternelle = (level.code || '').toUpperCase().includes('MATERNELLE');
        const isPrimaire = (level.code || '').toUpperCase().includes('PRIMAIRE');

        return (
          <div key={level.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Level header */}
            <div className="px-5 py-4 flex items-center gap-3" style={{ background: `${PRIMARY}08`, borderBottom: `2px solid ${PRIMARY}20` }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: PRIMARY }}>
                <School className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-900">{level.name}</h3>
                <p className="text-xs text-gray-500">{level.code}</p>
              </div>
              {/* ⭐ Badge "Lié" affiché par langue dans la section langue (voir plus bas) */}
            </div>

            {/* Language sections */}
            <div className="p-5 space-y-5">
              {languages.map((lang) => {
                const key = `${level.id}_${lang}`;
                const formData = forms[key] || {};
                const existingDirector = directors.find(d => d.schoolLevelId === level.id && d.language === lang);
                const currentSigMode = signatureMode[key] || 'none';
                // ⭐ isLinked POUR CETTE LANGUE — dépend du toggle de cette langue
                const isLinked = isPrimaire && !!sameMaternellePrimaireByLang[lang];

                return (
                  <div key={key} className={cn(
                    "border rounded-xl p-4 space-y-3",
                    isLinked ? "border-blue-200 bg-blue-50/30" : "border-slate-100"
                  )}>
                    {/* Language label */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold uppercase text-slate-600">
                          Piste {langLabels[lang]}
                        </span>
                        {existingDirector && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                            Configuré
                          </span>
                        )}
                        {/* ⭐ Badge "Lié" affiché PAR LANGUE sur le Primaire */}
                        {isLinked && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-[10px] font-bold text-blue-700 border border-blue-200">
                            <Link2 className="w-3 h-3" /> Lié à la Maternelle ({langLabels[lang]})
                          </span>
                        )}
                      </div>
                      {existingDirector && (
                        <div className="flex items-center gap-2">
                          {/* ⭐ Bouton "Envoyer les identifiants" — visible seulement si le directeur est lié à un staff */}
                          {existingDirector.staffId && (
                            <button
                              onClick={() => handleSendCredentials(existingDirector.id, existingDirector.fullName)}
                              disabled={sendingCredentials === existingDirector.id}
                              className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50"
                              title="Envoyer les identifiants de connexion par email au directeur"
                            >
                              {sendingCredentials === existingDirector.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Mail className="w-3 h-3" />
                              )}
                              {sendingCredentials === existingDirector.id ? 'Envoi…' : 'Envoyer identifiants'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(existingDirector.id)}
                            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Supprimer
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Form fields */}
                    <div className="space-y-3">
                      {/* ⭐ Sélecteur de staff — le directeur est choisi parmi le personnel existant */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                          <UserCheck className="w-3 h-3" /> Sélectionner un membre du personnel
                        </label>
                        <select
                          value={formData.staffId || ''}
                          onChange={(e) => handleStaffSelect(key, e.target.value)}
                          disabled={isLinked}
                          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 bg-white"
                        >
                          <option value="">— Sélectionner dans le staff —</option>
                          {staffList.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.firstName} {s.lastName}
                              {s.position ? ` (${s.position})` : ''}
                              {s.email ? ` — ${s.email}` : ''}
                            </option>
                          ))}
                        </select>
                        {staffList.length === 0 && (
                          <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Aucun membre du personnel éligible. Embauchez d'abord du personnel avec un email valide.
                          </p>
                        )}
                        {formData.staffId && (
                          <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Staff sélectionné — coordonnées auto-remplies depuis la fiche personnelle.
                          </p>
                        )}
                      </div>

                      {/* Champs manuels (pré-remplis si staff sélectionné) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom complet *</label>
                        <input
                          type="text"
                          value={formData.fullName || ''}
                          onChange={(e) => updateField(key, 'fullName', e.target.value)}
                          placeholder="Ex: M. KOUASSI Jean"
                          disabled={isLinked}
                          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fonction</label>
                        <input
                          type="text"
                          value={formData.functionLabel || ''}
                          onChange={(e) => updateField(key, 'functionLabel', e.target.value)}
                          placeholder="Ex: Directeur de la Maternelle"
                          disabled={isLinked}
                          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                        <input
                          type="email"
                          value={formData.email || ''}
                          onChange={(e) => updateField(key, 'email', e.target.value)}
                          placeholder="directeur@ecole.com"
                          disabled={isLinked}
                          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Téléphone</label>
                        <input
                          type="tel"
                          value={formData.phone || ''}
                          onChange={(e) => updateField(key, 'phone', e.target.value)}
                          placeholder="+229 ..."
                          disabled={isLinked}
                          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                        />
                      </div>
                      </div>
                    </div>

                    {/* Signature section */}
                    <div className="border-t border-slate-100 pt-3">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Signature</label>
                      <div className="flex items-center gap-2 mb-3">
                        <button
                          onClick={() => setSignatureMode(prev => ({ ...prev, [key]: 'upload' }))}
                          disabled={isLinked}
                          className={cn(
                            'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                            currentSigMode === 'upload' ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          )}
                          style={currentSigMode === 'upload' ? { background: PRIMARY } : {}}
                        >
                          <Upload className="w-3 h-3" /> Upload PNG
                        </button>
                        <button
                          onClick={() => setSignatureMode(prev => ({ ...prev, [key]: 'canvas' }))}
                          disabled={isLinked}
                          className={cn(
                            'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                            currentSigMode === 'canvas' ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          )}
                          style={currentSigMode === 'canvas' ? { background: PRIMARY } : {}}
                        >
                          <Pen className="w-3 h-3" /> Signature électronique
                        </button>
                      </div>

                      {/* Upload mode */}
                      {currentSigMode === 'upload' && (
                        <div className="space-y-2">
                          <input
                            type="file"
                            accept="image/png,image/jpeg"
                            onChange={(e) => handleFileUpload(key, e)}
                            disabled={isLinked}
                            className="text-xs disabled:bg-slate-50"
                          />
                          {formData.signatureUploadedUrl && (
                            <div className="border border-slate-200 rounded-lg p-2 bg-slate-50">
                              <img src={formData.signatureUploadedUrl} alt="Signature" className="max-h-20" />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Canvas mode */}
                      {currentSigMode === 'canvas' && (
                        <div className="space-y-2">
                          {/* ⭐ Si une signature existe déjà (canvas), l'afficher comme image
                              + bouton "Modifier" pour effacer et re-signer.
                              Le canvas React a un bug connu : il se vide au moindre re-render
                              car React met à jour les attributs width/height. On affiche donc
                              l'image stockée au lieu du canvas quand une signature est capturée. */}
                          {formData.signatureDataUrl ? (
                            <div className="space-y-2">
                              <div className="border border-emerald-300 rounded-lg p-2 bg-emerald-50/30">
                                <img
                                  src={formData.signatureDataUrl}
                                  alt="Signature capturée"
                                  className="max-h-24 mx-auto"
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-emerald-600 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Signature capturée
                                </div>
                                {!isLinked && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setForms(prev => ({
                                        ...prev,
                                        [key]: { ...prev[key], signatureDataUrl: null },
                                      }));
                                    }}
                                    className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                                  >
                                    <Eraser className="w-3 h-3" /> Modifier
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            /* Canvas vide — prêt pour signer */
                            <div className="border border-slate-300 rounded-lg p-1 bg-slate-50/50">
                              <SignatureCanvas
                                width={400}
                                height={120}
                                onSignatureChange={(data) => handleSignatureChange(key, data)}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Existing signature preview (when mode is 'none') */}
                      {currentSigMode === 'none' && (formData.signatureDataUrl || formData.signatureUploadedUrl) && (
                        <div className="border border-slate-200 rounded-lg p-2 bg-slate-50">
                          <img
                            src={formData.signatureDataUrl || formData.signatureUploadedUrl}
                            alt="Signature"
                            className="max-h-20"
                          />
                        </div>
                      )}
                    </div>

                    {/* Save button — masqué si lié (sauvegarde via la Maternelle) */}
                    {!isLinked && (
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={() => handleSave(key)}
                          disabled={saving || !formData.fullName?.trim()}
                          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: PRIMARY }}
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Enregistrer
                        </button>
                      </div>
                    )}
                    {isLinked && (
                      <div className="text-xs text-blue-600 bg-blue-50 rounded-lg p-2 flex items-center gap-2">
                        <Link2 className="w-3 h-3" />
                        Sauvegardé automatiquement avec la Maternelle — Piste {langLabels[lang]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
