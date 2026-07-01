'use client';

/**
 * ============================================================================
 * PARAMÉTRAGE ÉLÈVES & SCOLARITÉ
 * ============================================================================
 *
 * Selon MODULE ELEVES.md — Onglet 11
 * Configuration des règles du module :
 *   - Général : toggles (auto-matricule, blocage financier, validation NPI)
 *   - Matricules : format et préfixe
 *   - Documents : types requis par niveau
 *   - Admissions : workflow (étapes, notifications)
 *   - Sécurité : verrouillage dossiers, audit
 *
 * Persistance : localStorage (par tenant) — simple et efficace pour des préférences.
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import {
  Settings, Sliders, Tags, Hash, ClipboardList, Save, Shield,
  FileText, Baby, BookOpen, GraduationCap, Check,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

type Section = 'general' | 'matricules' | 'documents' | 'admissions' | 'security';

interface Settings {
  autoMatricule: boolean;
  blockFinanceArrears: boolean;
  requireNpi: boolean;
  autoArchiveYearEnd: boolean;
  matriculePrefix: string;
  matriculeFormat: string;
  requiredDocs: {
    maternelle: string[];
    primaire: string[];
    secondaire: string[];
  };
  admissionWorkflow: {
    requireInterview: boolean;
    requireTest: boolean;
    notifyParent: boolean;
    notifyStaff: boolean;
  };
  lockArchiveDossiers: boolean;
  auditOnDelete: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  autoMatricule: true,
  blockFinanceArrears: false,
  requireNpi: true,
  autoArchiveYearEnd: true,
  matriculePrefix: '',
  matriculeFormat: '{PREFIX}-E-{YY}-{XXXX}',
  requiredDocs: {
    maternelle: ['BIRTH_CERTIFICATE', 'ID_PHOTO'],
    primaire: ['BIRTH_CERTIFICATE', 'ID_PHOTO', 'REPORT_CARD'],
    secondaire: ['BIRTH_CERTIFICATE', 'ID_PHOTO', 'REPORT_CARD', 'SCHOOL_CERTIFICATE'],
  },
  admissionWorkflow: {
    requireInterview: false,
    requireTest: false,
    notifyParent: true,
    notifyStaff: true,
  },
  lockArchiveDossiers: true,
  auditOnDelete: true,
};

const DOC_TYPES: Record<string, string> = {
  BIRTH_CERTIFICATE: 'Acte de naissance',
  ID_PHOTO: 'Photo d\'identité',
  NPI: 'NPI',
  REPORT_CARD: 'Bulletin précédent',
  SCHOOL_CERTIFICATE: 'Certificat de scolarité',
  PARENTAL_AUTH: 'Autorisation parentale',
  ID_DOCUMENT: 'Pièce d\'identité',
};

export default function StudentSettingsContent() {
  const { tenantId } = useModuleContext();
  const [activeSection, setActiveSection] = useState<Section>('general');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);

  const storageKey = `students_settings_${tenantId || 'default'}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    } catch { /* ignore */ }
  }, [storageKey]);

  const update = (key: keyof Settings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updateNested = (parent: keyof Settings, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [parent]: { ...(prev[parent] as any), [key]: value },
    }));
    setHasChanges(true);
  };

  const toggleDoc = (level: 'maternelle' | 'primaire' | 'secondaire', docType: string) => {
    const current = settings.requiredDocs[level];
    const newList = current.includes(docType)
      ? current.filter(d => d !== docType)
      : [...current, docType];
    setSettings(prev => ({
      ...prev,
      requiredDocs: { ...prev.requiredDocs, [level]: newList },
    }));
    setHasChanges(true);
  };

  const save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
      setHasChanges(false);
      toast({ title: '✅ Paramètres enregistrés', variant: 'success' });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible d\'enregistrer', variant: 'error' });
    }
  };

  const sections: { id: Section; label: string; icon: any }[] = [
    { id: 'general', label: 'Général', icon: Sliders },
    { id: 'matricules', label: 'Matricules', icon: Hash },
    { id: 'documents', label: 'Documents requis', icon: ClipboardList },
    { id: 'admissions', label: 'Workflow Admissions', icon: FileText },
    { id: 'security', label: 'Sécurité & Audit', icon: Shield },
  ];

  // Composant Toggle réutilisable
  const Toggle = ({ on, onChange }: { on: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={cn('w-11 h-6 rounded-full relative transition-colors', on ? 'bg-blue-600' : 'bg-slate-300')}
    >
      <div className={cn('absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all', on ? 'right-1' : 'left-1')} />
    </button>
  );

  const ToggleRow = ({ title, desc, on, onChange }: { title: string; desc: string; on: boolean; onChange: () => void }) => (
    <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl">
      <div>
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 rounded-xl"><Settings className="w-5 h-5 text-white" /></div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Paramétrage Élèves</h2>
            <p className="text-xs text-slate-500">Configurez les règles de gestion du module</p>
          </div>
        </div>
        <button
          onClick={save}
          disabled={!hasChanges}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {hasChanges ? 'Enregistrer' : 'Enregistré'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-0">
        {/* Navigation latérale */}
        <div className="space-y-1.5">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all',
                activeSection === s.id ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-50'
              )}
            >
              <s.icon className="w-4 h-4" />
              {s.label}
            </button>
          ))}
        </div>

        {/* Panneau de config */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-5 overflow-y-auto">
          {/* GÉNÉRAL */}
          {activeSection === 'general' && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-slate-800 mb-2">Règles de gestion</h3>
              <ToggleRow
                title="Génération automatique du matricule"
                desc="Générer le matricule dès la conversion de l'admission en inscription"
                on={settings.autoMatricule}
                onChange={() => update('autoMatricule', !settings.autoMatricule)}
              />
              <ToggleRow
                title="Blocage financier automatique"
                desc="Bloquer l'accès aux documents en cas d'arriérés critiques"
                on={settings.blockFinanceArrears}
                onChange={() => update('blockFinanceArrears', !settings.blockFinanceArrears)}
              />
              <ToggleRow
                title="Validation NPI requise"
                desc="Forcer la saisie du NPI avant validation de l'inscription"
                on={settings.requireNpi}
                onChange={() => update('requireNpi', !settings.requireNpi)}
              />
              <ToggleRow
                title="Archivage automatique en fin d'année"
                desc="Archiver automatiquement les élèves en fin d'année scolaire"
                on={settings.autoArchiveYearEnd}
                onChange={() => update('autoArchiveYearEnd', !settings.autoArchiveYearEnd)}
              />
            </div>
          )}

          {/* MATRICULES */}
          {activeSection === 'matricules' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-800 mb-2">Format des matricules</h3>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Préfixe (code école)</label>
                <input
                  type="text"
                  value={settings.matriculePrefix}
                  onChange={(e) => update('matriculePrefix', e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="Ex: CSPEB"
                  className="w-full max-w-xs px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Laisser vide pour utiliser le code automatique du tenant</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Format</label>
                <select
                  value={settings.matriculeFormat}
                  onChange={(e) => update('matriculeFormat', e.target.value)}
                  className="w-full max-w-xs px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="{PREFIX}-E-{YY}-{XXXX}">{PREFIX}-E-{YY}-{XXXX} (local)</option>
                  <option value="AH-STU-{YY}-{XXXXXX}">AH-STU-{YY}-{XXXXXX} (global)</option>
                </select>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-700">
                  <strong>Aperçu :</strong>{' '}
                  {(settings.matriculePrefix || 'CSPEB')}-E-26-0001
                </p>
              </div>
            </div>
          )}

          {/* DOCUMENTS REQUIS */}
          {activeSection === 'documents' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-800 mb-2">Documents requis par niveau</h3>
              {(['maternelle', 'primaire', 'secondaire'] as const).map(level => {
                const icons = { maternelle: Baby, primaire: BookOpen, secondaire: GraduationCap };
                const Icon = icons[level];
                return (
                  <div key={level}>
                    <p className="text-sm font-semibold text-slate-700 capitalize flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4" /> {level}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(DOC_TYPES).map(([type, label]) => {
                        const checked = settings.requiredDocs[level].includes(type);
                        return (
                          <button
                            key={type}
                            onClick={() => toggleDoc(level, type)}
                            className={cn(
                              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition',
                              checked
                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                            )}
                          >
                            {checked && <Check className="w-3 h-3" />}
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ADMISSIONS */}
          {activeSection === 'admissions' && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-slate-800 mb-2">Workflow d'admission</h3>
              <ToggleRow
                title="Entretien obligatoire"
                desc="Exiger un entretien avant l'acceptation d'une demande d'admission"
                on={settings.admissionWorkflow.requireInterview}
                onChange={() => updateNested('admissionWorkflow', 'requireInterview', !settings.admissionWorkflow.requireInterview)}
              />
              <ToggleRow
                title="Test d'évaluation obligatoire"
                desc="Exiger un test avant l'acceptation"
                on={settings.admissionWorkflow.requireTest}
                onChange={() => updateNested('admissionWorkflow', 'requireTest', !settings.admissionWorkflow.requireTest)}
              />
              <ToggleRow
                title="Notifier le parent par email"
                desc="Envoyer un email au parent à chaque étape (reçue, acceptée, inscrite)"
                on={settings.admissionWorkflow.notifyParent}
                onChange={() => updateNested('admissionWorkflow', 'notifyParent', !settings.admissionWorkflow.notifyParent)}
              />
              <ToggleRow
                title="Notifier le staff par notification in-app"
                desc="Envoyer une notification cloche au staff à chaque nouvelle admission"
                on={settings.admissionWorkflow.notifyStaff}
                onChange={() => updateNested('admissionWorkflow', 'notifyStaff', !settings.admissionWorkflow.notifyStaff)}
              />
            </div>
          )}

          {/* SÉCURITÉ */}
          {activeSection === 'security' && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-slate-800 mb-2">Sécurité & Audit</h3>
              <ToggleRow
                title="Verrouiller les dossiers archivés"
                desc="Empêcher la modification des dossiers des élèves archivés"
                on={settings.lockArchiveDossiers}
                onChange={() => update('lockArchiveDossiers', !settings.lockArchiveDossiers)}
              />
              <ToggleRow
                title="Audit obligatoire sur suppression"
                desc="Journaliser automatiquement toute action de suppression ou modification sensible"
                on={settings.auditOnDelete}
                onChange={() => update('auditOnDelete', !settings.auditOnDelete)}
              />
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-xs text-amber-800">
                  <Shield className="w-4 h-4 inline mr-1" />
                  Les actions sensibles (archivage, transfert, suppression) sont toujours journalisées
                  dans l'onglet Audit, indépendamment de ces paramètres.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
