'use client';

import { useState, useEffect, useCallback } from 'react';
import { CalendarRange, Save, RotateCcw, Loader2, Info } from 'lucide-react';
import * as settingsService from '@/services/settings.service';
import type { SchoolCalendarConfig } from '@/services/settings.service';

interface Props {
  tenantId?: string | null;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const DEFAULT_CONFIG: SchoolCalendarConfig = {
  startMonth: 8,
  preEntryWeekNumber: 2,
  preEntryDayOfWeek: 1,
  entryWeekOffset: 1,
  endMonth: 5,
  endDayOfWeek: 5,
  quarter1EndMonth: 11,
  quarter1EndDay: 31,
  quarter2EndMonth: 2,
  quarter2EndDay: 31,
  quarter3EndMonth: 5,
  quarter3EndDay: 30,
};

/**
 * Section "Calendrier scolaire" des Paramètres.
 * Permet à l'admin de personnaliser les règles de calcul des dates
 * (pré-rentrée, rentrée, fin d'année, dates de fin de trimestre).
 *
 * Par défaut : calendrier type Bénin (sept→juin, trimestres sept→déc/janv→mars/avr→juin).
 */
export default function SchoolCalendarConfigSection({ tenantId, showToast }: Props) {
  const [config, setConfig] = useState<SchoolCalendarConfig>(DEFAULT_CONFIG);
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const response = await settingsService.getSchoolCalendarConfig(tenantId);
      setConfig(response.config);
      setIsCustom(response.isCustom);
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors du chargement de la configuration');
    } finally {
      setLoading(false);
    }
  }, [tenantId, showToast]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.updateSchoolCalendarConfig(config, tenantId);
      showToast('success', 'Configuration du calendrier enregistrée. Les nouvelles années scolaires utiliseront ces règles.');
      setIsCustom(true);
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Voulez-vous vraiment réinitialiser la configuration aux valeurs par défaut (calendrier Bénin) ? Les nouvelles années utiliseront les règles par défaut.')) {
      return;
    }
    setResetting(true);
    try {
      await settingsService.resetSchoolCalendarConfig(tenantId);
      setConfig(DEFAULT_CONFIG);
      setIsCustom(false);
      showToast('success', 'Configuration réinitialisée aux valeurs par défaut (Bénin).');
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de la réinitialisation');
    } finally {
      setResetting(false);
    }
  };

  const updateField = (field: keyof SchoolCalendarConfig, value: number) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement de la configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <CalendarRange className="w-5 h-5 text-blue-600" />
          Configuration du calendrier scolaire
        </h3>
        <p className="text-sm text-gray-600">
          Personnalisez les règles de calcul automatique des dates de l'année scolaire et des trimestres.
          Par défaut, le système utilise le calendrier type Bénin (sept→juin, T1 sept→déc, T2 janv→mars, T3 avr→juin).
          Modifiez ces règles si le gouvernement change les dates ou pour un autre pays.
        </p>
        {isCustom ? (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
            <Info className="w-3.5 h-3.5" />
            Configuration personnalisée — les nouvelles années utiliseront ces règles
          </div>
        ) : (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-800">
            <Info className="w-3.5 h-3.5" />
            Configuration par défaut (Bénin) — aucune personnalisation
          </div>
        )}
      </div>

      {/* Formulaire */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        {/* Année scolaire */}
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-3">Année scolaire</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mois de début</label>
              <select
                value={config.startMonth}
                onChange={(e) => updateField('startMonth', parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {MONTHS_FR.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">N° semaine pré-rentrée</label>
              <input
                type="number"
                min={1}
                max={5}
                value={config.preEntryWeekNumber}
                onChange={(e) => updateField('preEntryWeekNumber', parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jour pré-rentrée</label>
              <select
                value={config.preEntryDayOfWeek}
                onChange={(e) => updateField('preEntryDayOfWeek', parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {DAYS_FR.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Décalage rentrée (semaines)</label>
              <input
                type="number"
                min={0}
                max={4}
                value={config.entryWeekOffset}
                onChange={(e) => updateField('entryWeekOffset', parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">0 = même jour que pré-rentrée, 1 = semaine suivante</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mois de fin</label>
              <select
                value={config.endMonth}
                onChange={(e) => updateField('endMonth', parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {MONTHS_FR.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jour de fin (dernier du mois)</label>
              <select
                value={config.endDayOfWeek}
                onChange={(e) => updateField('endDayOfWeek', parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {DAYS_FR.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Trimestres */}
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-3">Dates de fin des trimestres</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fin Trimestre 1 — Mois</label>
              <select
                value={config.quarter1EndMonth}
                onChange={(e) => updateField('quarter1EndMonth', parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {MONTHS_FR.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fin Trimestre 1 — Jour</label>
              <input
                type="number"
                min={1}
                max={31}
                value={config.quarter1EndDay}
                onChange={(e) => updateField('quarter1EndDay', parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div className="hidden md:block" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fin Trimestre 2 — Mois</label>
              <select
                value={config.quarter2EndMonth}
                onChange={(e) => updateField('quarter2EndMonth', parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {MONTHS_FR.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fin Trimestre 2 — Jour</label>
              <input
                type="number"
                min={1}
                max={31}
                value={config.quarter2EndDay}
                onChange={(e) => updateField('quarter2EndDay', parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div className="hidden md:block" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fin Trimestre 3 — Mois</label>
              <select
                value={config.quarter3EndMonth}
                onChange={(e) => updateField('quarter3EndMonth', parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {MONTHS_FR.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fin Trimestre 3 — Jour</label>
              <input
                type="number"
                min={1}
                max={31}
                value={config.quarter3EndDay}
                onChange={(e) => updateField('quarter3EndDay', parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Enregistrement...' : 'Enregistrer la configuration'}
          </button>
          {isCustom && (
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 text-sm font-medium"
            >
              {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              {resetting ? 'Réinitialisation...' : 'Réinitialiser aux valeurs par défaut'}
            </button>
          )}
        </div>
      </div>

      {/* Note d'information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Comment ça marche ?</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>Les nouvelles années scolaires seront calculées avec ces règles automatiquement.</li>
              <li>Les années existantes ne sont pas modifiées — utilisez le bouton "Modifier les dates" sur chaque année pour les ajuster.</li>
              <li>Les trimestres par défaut seront créés selon ces règles à la création de chaque nouvelle année.</li>
              <li>En cas de doute, réinitialisez aux valeurs par défaut (calendrier Bénin).</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
