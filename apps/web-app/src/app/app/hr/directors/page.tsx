'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Save, UserCog, CheckCircle2, AlertCircle, Trash2,
  Upload, Pen, Eraser, School, Globe,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useBilingual } from '@/contexts/BilingualContext';
import { SignatureCanvas } from '@/components/ui/SignatureCanvas';
import apiClient from '@/lib/api/client';
import { HR_SUBMODULE_TABS } from '../hr-tabs';
import { cn } from '@/lib/utils';

const PRIMARY = '#0A2A5E';
const ACCENT = '#CFA63A';

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
}

interface SchoolLevel {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export default function DirectorsPage() {
  const { tenant } = useAppSession();
  const { isEnabled: isBilingual } = useBilingual();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [directors, setDirectors] = useState<Director[]>([]);
  const [schoolLevels, setSchoolLevels] = useState<SchoolLevel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state: key = `${schoolLevelId}_${language}`
  const [forms, setForms] = useState<Record<string, any>>({});
  const [signatureMode, setSignatureMode] = useState<Record<string, 'upload' | 'canvas' | 'none'>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load school levels
      const levelsRes = await apiClient.get('/school-levels');
      const levels = Array.isArray(levelsRes.data) ? levelsRes.data : (levelsRes.data?.items || []);
      const activeLevels = levels.filter((l: any) => l.id !== 'ALL' && l.isActive);
      setSchoolLevels(activeLevels);

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
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [isBilingual]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async (key: string) => {
    const formData = forms[key];
    if (!formData || !formData.fullName.trim()) {
      setError('Le nom complet est obligatoire');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.post('/hr/school-directors', formData);
      setSuccess(`Directeur enregistré : ${formData.fullName}`);
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

  const handleSignatureChange = (key: string, dataUrl: string | null) => {
    setForms(prev => ({
      ...prev,
      [key]: { ...prev[key], signatureDataUrl: dataUrl },
    }));
  };

  const handleFileUpload = async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForms(prev => ({
        ...prev,
        [key]: { ...prev[key], signatureUploadedUrl: reader.result as string },
      }));
    };
    reader.readAsDataURL(file);
  };

  const updateField = (key: string, field: string, value: string) => {
    setForms(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const subModulesList = HR_SUBMODULE_TABS.map((t) => ({
    id: t.id, label: t.label, href: t.path, icon: t.icon,
  }));

  const languages = isBilingual ? ['FR', 'EN'] : ['FR'];
  const langLabels: Record<string, string> = { FR: 'Francophone', EN: 'Anglophone' };

  if (loading) {
    return (
      <ModuleContainer
        header={{ title: 'Directeurs', description: 'Définissez les directeurs par niveau scolaire.', icon: 'userCog' }}
        subModules={{ modules: subModulesList, activeModuleId: 'recruiter-settings' }}
        content={{ layout: 'full', children: <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" style={{ color: PRIMARY }} /></div> }}
      />
    );
  }

  return (
    <ModuleContainer
      header={{ title: 'Directeurs', description: "Définissez les directeurs de l'école par niveau scolaire et piste linguistique.", icon: 'userCog' }}
      subModules={{ modules: subModulesList, activeModuleId: 'recruiter-settings' }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-6 max-w-4xl">
            {/* Info banner */}
            <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: `${PRIMARY}0D`, border: `1px solid ${PRIMARY}30` }}>
              <School className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: PRIMARY }} />
              <div>
                <p className="text-sm font-bold" style={{ color: PRIMARY }}>Configuration des directeurs</p>
                <p className="text-xs mt-1" style={{ color: `${PRIMARY}CC` }}>
                  Définissez le directeur pour chaque niveau scolaire.
                  {isBilingual && ' Le mode bilingue est activé — vous pouvez définir un directeur par piste linguistique (FR/EN).'}
                  Les signatures seront utilisées sur tous les documents officiels (bulletins, PV de conseil, etc.).
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}
            {success && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4" /> {success}
              </div>
            )}

            {/* Director cards per level + language */}
            {schoolLevels.map((level) => (
              <div key={level.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Level header */}
                <div className="px-5 py-3 flex items-center gap-3" style={{ background: `${PRIMARY}0A`, borderBottom: `2px solid ${PRIMARY}` }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: PRIMARY }}>
                    <School className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{level.name}</h3>
                    <p className="text-xs text-slate-500">{level.code}</p>
                  </div>
                </div>

                {/* Language tabs */}
                <div className="p-5 space-y-5">
                  {languages.map((lang) => {
                    const key = `${level.id}_${lang}`;
                    const formData = forms[key] || {};
                    const existingDirector = directors.find(d => d.schoolLevelId === level.id && d.language === lang);
                    const currentSigMode = signatureMode[key] || 'none';

                    return (
                      <div key={key} className="border border-slate-100 rounded-lg p-4 space-y-3">
                        {/* Language label */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-slate-400" />
                            <span className="text-xs font-bold uppercase text-slate-600">
                              Piste {langLabels[lang]}
                            </span>
                            {existingDirector && (
                              <Badge className="text-[10px] bg-emerald-100 text-emerald-700">Configuré</Badge>
                            )}
                          </div>
                          {existingDirector && (
                            <button
                              onClick={() => handleDelete(existingDirector.id)}
                              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> Supprimer
                            </button>
                          )}
                        </div>

                        {/* Form fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold uppercase text-slate-500">Nom complet *</label>
                            <input
                              type="text"
                              value={formData.fullName || ''}
                              onChange={(e) => updateField(key, 'fullName', e.target.value)}
                              placeholder="Ex: M. KOUASSI Jean"
                              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase text-slate-500">Fonction</label>
                            <input
                              type="text"
                              value={formData.functionLabel || ''}
                              onChange={(e) => updateField(key, 'functionLabel', e.target.value)}
                              placeholder="Ex: Directeur de la Maternelle"
                              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase text-slate-500">Email</label>
                            <input
                              type="email"
                              value={formData.email || ''}
                              onChange={(e) => updateField(key, 'email', e.target.value)}
                              placeholder="directeur@ecole.com"
                              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase text-slate-500">Téléphone</label>
                            <input
                              type="tel"
                              value={formData.phone || ''}
                              onChange={(e) => updateField(key, 'phone', e.target.value)}
                              placeholder="+229 ..."
                              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 mt-1"
                            />
                          </div>
                        </div>

                        {/* Signature section */}
                        <div className="border-t border-slate-100 pt-3">
                          <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block">Signature</label>
                          <div className="flex items-center gap-2 mb-3">
                            <button
                              onClick={() => setSignatureMode(prev => ({ ...prev, [key]: 'upload' }))}
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
                                className="text-xs"
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
                              <div className="border border-slate-300 rounded-lg p-1 bg-slate-50/50">
                                <SignatureCanvas
                                  width={400}
                                  height={120}
                                  onSignatureChange={(data) => handleSignatureChange(key, data)}
                                />
                              </div>
                              {formData.signatureDataUrl && (
                                <div className="text-xs text-emerald-600 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Signature capturée
                                </div>
                              )}
                            </div>
                          )}

                          {/* Existing signature preview */}
                          {currentSigMode === 'none' && (formData.signatureDataUrl || formData.signatureUploadedUrl) && (
                            <div className="border border-slate-200 rounded-lg p-2 bg-slate-50">
                              <img src={formData.signatureDataUrl || formData.signatureUploadedUrl} alt="Signature" className="max-h-20" />
                            </div>
                          )}
                        </div>

                        {/* Save button */}
                        <div className="flex justify-end pt-2">
                          <Button
                            onClick={() => handleSave(key)}
                            disabled={saving || !formData.fullName?.trim()}
                            className="text-white text-sm"
                            style={{ background: PRIMARY }}
                          >
                            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Enregistrer
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ),
      }}
    />
  );
}
