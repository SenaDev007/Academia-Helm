'use client';

/**
 * ============================================================================
 * AdminStructureSection — Configuration du mode d'administration scolaire
 * ============================================================================
 *
 * Section à intégrer dans la page /app/settings (Module Paramètres).
 *
 * Permet au directeur de configurer comment l'administration de son école
 * est structurée :
 *
 *   - Mode SEPARATE (par défaut) : chaque niveau (maternelle, primaire,
 *     secondaire) a sa propre administration — directeur, secrétaire,
 *     secrétaire comptable, etc. distincts pour chaque niveau.
 *
 *   - Mode FUSED_MATERNELLE_PRIMAIRE : l'administration de la maternelle
 *     et du primaire est FUSIONNÉE (même directeur, même secrétaire, même
 *     secrétaire comptable gèrent les 2 niveaux). L'administration du
 *     secondaire reste SÉPARÉE avec sa propre équipe.
 *
 * Le secondaire est TOUJOURS à part, quel que soit le mode choisi.
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import {
  Building2, Users, GitMerge, Split, Save, Loader2,
  CheckCircle, AlertCircle, School, Info,
} from 'lucide-react';
import { adminStructureService, type AdminStructureMode, type AdminGroup } from '@/services/admin-structure.service';

interface Props {
  tenantId?: string;
}

export function AdminStructureSection({ tenantId: _tenantId }: Props) {
  const [mode, setMode] = useState<AdminStructureMode>('SEPARATE');
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminStructureService.getGroups();
      setMode(data.mode);
      setGroups(data.groups || []);
    } catch (err: any) {
      setError(err?.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await adminStructureService.setMode(mode);
      setSuccess('Mode d\'administration enregistré avec succès');
      setTimeout(() => setSuccess(null), 4000);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const modeOptions: { value: AdminStructureMode; label: string; description: string; icon: any }[] = [
    {
      value: 'SEPARATE',
      label: 'Administration séparée par niveau',
      description: 'Chaque niveau (Maternelle, Primaire, Secondaire) a sa propre administration : directeur, secrétaire, secrétaire comptable distincts pour chaque niveau.',
      icon: Split,
    },
    {
      value: 'FUSED_MATERNELLE_PRIMAIRE',
      label: 'Maternelle + Primaire fusionnés',
      description: 'L\'administration de la maternelle et du primaire est fusionnée (même équipe gère les 2 niveaux). L\'administration du secondaire reste séparée avec sa propre équipe.',
      icon: GitMerge,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Structure administrative</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Définissez comment l'administration de votre établissement est organisée selon les niveaux scolaires.
          </p>
        </div>
      </div>

      {/* Bannières */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-sm text-emerald-700 flex-1">{success}</p>
        </div>
      )}

      {/* Sélecteur de mode */}
      <div className="space-y-3">
        {modeOptions.map((opt) => {
          const isSelected = mode === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              disabled={saving}
              className={`w-full text-left p-4 rounded-xl border-2 transition ${
                isSelected
                  ? 'border-blue-500 bg-blue-50/50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              } disabled:opacity-50`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900">{opt.label}</h4>
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold uppercase">
                        <CheckCircle className="w-3 h-3" />
                        Sélectionné
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">{opt.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Note d'information */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
        <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-800">
          <p className="font-semibold mb-1">Bon à savoir</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>L'administration du <strong>Secondaire</strong> est <strong>toujours séparée</strong>, quel que soit le mode choisi.</li>
            <li>En mode fusionné, un même staff peut être Directeur/Secrétaire/Secrétaire comptable de la Maternelle <strong>et</strong> du Primaire.</li>
            <li>Le changement de mode n'affecte pas les élèves, classes, matières et notes déjà créés — ils restent rattachés à leur niveau d'origine.</li>
            <li>Les permissions d'accès au système s'adapteront automatiquement au mode choisi.</li>
          </ul>
        </div>
      </div>

      {/* Aperçu des unités administratives */}
      {groups.length > 0 && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            Unités administratives de votre établissement
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {groups.map((group) => (
              <div key={group.unit} className="bg-white rounded-lg p-3 border border-slate-100">
                <div className="flex items-center gap-2 mb-1">
                  <School className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-slate-900 text-sm">{group.label}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {group.levelCodes.length} niveau{group.levelCodes.length > 1 ? 'x' : ''} : {group.levelCodes.join(', ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bouton sauvegarder */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold shadow-md transition"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Enregistrement…
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Enregistrer le mode
            </>
          )}
        </button>
      </div>
    </div>
  );
}
