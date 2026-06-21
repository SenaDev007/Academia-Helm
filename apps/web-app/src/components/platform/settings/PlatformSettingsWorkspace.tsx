'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  Shield,
  Globe,
  Database,
  Key,
  AlertCircle,
  Check,
  Loader2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '../PlatformStates';

type SettingsValue = string | number | boolean | null | object;
type SettingsObject = Record<string, SettingsValue>;

interface SettingsResponse {
  settings?: SettingsObject;
  [k: string]: unknown;
}

function valueToString(v: SettingsValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

function detectType(v: SettingsValue): 'string' | 'number' | 'boolean' | 'json' {
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'object' && v !== null) return 'json';
  return 'string';
}

export default function PlatformSettingsWorkspace() {
  const { data, loading, error, refetch } = usePlatformData<SettingsResponse>('/settings');

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const settings: SettingsObject = useMemo(() => {
    if (!data) return {};
    if (data.settings && typeof data.settings === 'object') return data.settings as SettingsObject;
    const { settings: _ignored, ...rest } = data;
    return rest as SettingsObject;
  }, [data]);

  // Sync draft whenever fetched settings change.
  useEffect(() => {
    const next: Record<string, string> = {};
    Object.keys(settings).forEach((k) => {
      next[k] = valueToString(settings[k]);
    });
    setDraft(next);
    setTouched({});
  }, [settings]);

  const dirtyKeys = useMemo(() => Object.keys(touched).filter((k) => touched[k]), [touched]);

  const updateField = (key: string, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setTouched((t) => ({ ...t, [key]: true }));
  };

  const resetDraft = () => {
    const next: Record<string, string> = {};
    Object.keys(settings).forEach((k) => {
      next[k] = valueToString(settings[k]);
    });
    setDraft(next);
    setTouched({});
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleSave = async () => {
    setSaveError(null);
    setSaveSuccess(null);

    if (dirtyKeys.length === 0) {
      setSaveError('Aucune modification à enregistrer.');
      return;
    }

    const patch: Record<string, unknown> = {};
    for (const key of dirtyKeys) {
      const original = settings[key];
      const type = detectType(original);
      const raw = draft[key];
      try {
        if (type === 'boolean') {
          patch[key] = raw === 'true' || raw === '1' || raw === 'on';
        } else if (type === 'number') {
          patch[key] = raw === '' ? null : Number(raw);
        } else if (type === 'json') {
          patch[key] = raw === '' ? null : JSON.parse(raw);
        } else {
          patch[key] = raw;
        }
      } catch {
        setSaveError(`Valeur invalide pour « ${key} » (JSON invalide).`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch('/api/platform/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || j?.message || `Erreur ${res.status}`);
      }
      setSaveSuccess('Paramètres enregistrés avec succès.');
      setTouched({});
      setSaving(false);
      // Briefly show success, then refetch
      setTimeout(() => {
        setSaveSuccess(null);
        refetch();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement';
      setSaveError(msg);
      setSaving(false);
    }
  };

  const entries = Object.entries(settings);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Paramètres Plateforme</h1>
          <p className="text-slate-500">Configuration globale d'Academia Helm</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-60 rounded-xl text-sm font-semibold text-slate-600 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button
            onClick={handleSave}
            disabled={saving || dirtyKeys.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-white shadow-md transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Enregistrer
            {dirtyKeys.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-white/25 rounded text-[10px] font-bold">
                {dirtyKeys.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Modifiez les valeurs ci-dessous puis cliquez sur « Enregistrer » pour appliquer. Les
          domaines, secrets et intégrations critiques restent gérés via les variables
          d'environnement et le PricingAdminController.
        </span>
      </div>

      {saveError && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}
      {saveSuccess && (
        <div className="flex items-start gap-2 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <Check className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {loading ? <PlatformLoading label="Chargement des paramètres…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       entries.length === 0 ? (
         <PlatformEmpty title="Aucun paramètre" description="Aucun paramètre plateforme n'est disponible." />
       ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <div>
              <h3 className="font-bold text-blue-900 text-sm">Paramètres dynamiques</h3>
              <p className="text-xs text-slate-500 mt-0.5">{entries.length} clé(s) — {dirtyKeys.length} modifiée(s)</p>
            </div>
            {dirtyKeys.length > 0 && (
              <button
                onClick={resetDraft}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Réinitialiser
              </button>
            )}
          </div>
          <div className="divide-y divide-slate-50">
            {entries.map(([key, value]) => {
              const type = detectType(value);
              const isDirty = !!touched[key];
              return (
                <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-3 px-6 py-4 items-start hover:bg-slate-50/40 transition-colors">
                  <div className="md:col-span-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-semibold text-slate-900 break-all">{key}</span>
                      {isDirty && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-bold uppercase shrink-0">
                          Modifié
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
                      {type}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    {type === 'boolean' ? (
                      <select
                        value={draft[key] ?? 'false'}
                        onChange={(e) => updateField(key, e.target.value)}
                        className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 ${isDirty ? 'border-amber-400' : 'border-slate-200'}`}
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : (
                      <input
                        type={type === 'number' ? 'number' : 'text'}
                        value={draft[key] ?? ''}
                        onChange={(e) => updateField(key, e.target.value)}
                        className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 ${isDirty ? 'border-amber-400' : 'border-slate-200'} ${type === 'json' ? 'font-mono text-xs' : ''}`}
                        placeholder="—"
                      />
                    )}
                    <div className="text-[10px] text-slate-400 mt-1 font-mono break-all">
                      Original : {valueToString(value) || '∅'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <a
          href="/platform/rbac"
          className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-amber-200 transition-all"
        >
          <Shield className="w-6 h-6 text-indigo-600 mb-3" />
          <h3 className="font-bold text-slate-900 text-sm">Rôles & Permissions</h3>
          <p className="text-xs text-slate-500 mt-1">Gérer le RBAC plateforme</p>
        </a>
        <a
          href="/platform/settings"
          className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-amber-200 transition-all"
        >
          <Globe className="w-6 h-6 text-blue-600 mb-3" />
          <h3 className="font-bold text-slate-900 text-sm">Domaines & Sous-domaines</h3>
          <p className="text-xs text-slate-500 mt-1">Configuration DNS et domaines</p>
        </a>
        <a
          href="/platform/audit"
          className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-amber-200 transition-all"
        >
          <Database className="w-6 h-6 text-emerald-600 mb-3" />
          <h3 className="font-bold text-slate-900 text-sm">Audit & Logs</h3>
          <p className="text-xs text-slate-500 mt-1">Journal d'audit plateforme</p>
        </a>
      </div>
    </div>
  );
}
