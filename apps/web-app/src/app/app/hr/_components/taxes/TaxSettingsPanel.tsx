'use client';

import { useState, useEffect } from 'react';
import { Loader2, Save, Percent, Calendar } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';

export function TaxSettingsPanel() {
  const { tenant } = useModuleContext();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenant?.id) return;
    (async () => {
      try {
        setLoading(true);
        const res = await hrFetch<any>(hrUrl('taxes/settings', { tenantId: tenant.id }));
        setSettings(res);
      } catch {} finally { setLoading(false); }
    })();
  }, [tenant?.id]);

  const handleSave = async () => {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      await hrFetch(hrUrl('taxes/settings', { tenantId: tenant.id }), { method: 'PUT', body: settings });
      toast({ variant: 'success', title: 'Paramètres enregistrés' });
    } catch (e: any) {
      toast({ variant: 'error', title: 'Erreur', description: e.message });
    } finally { setSaving(false); }
  };

  const update = (field: string, value: number | string) => {
    setSettings((prev: any) => ({ ...prev, [field]: value }));
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;
  if (!settings) return <div className="text-center text-slate-500 py-12">Aucun paramètre</div>;

  const rateFields = [
    { section: 'CNSS — Cotisations sécurité sociale', fields: [
      { key: 'cnssFamilialesRate', label: 'Cotisations familiales (%)' },
      { key: 'cnssRisquesRate', label: 'Risques professionnels (%)' },
      { key: 'cnssVieillesseRate', label: 'Assurance vieillesse (%)' },
      { key: 'cnssPatronaleRate', label: 'Part patronale (%)' },
      { key: 'cnssOuvriereRate', label: 'Part ouvrière (%)' },
    ]},
    { section: 'IST — Impôt sur Salaires', fields: [
      { key: 'istVpsRate', label: 'VPS — Versement Patronal (%)' },
      { key: 'istIrppRate', label: 'IRPP (%) — 0 = calcul auto barème' },
    ]},
    { section: 'AIB — Abattement Impôt Bénéfices', fields: [
      { key: 'aibAchatsRate', label: 'AIB sur achats marchandises (%)' },
      { key: 'aibPrestationsRate', label: 'AIB sur prestations services (%)' },
    ]},
  ];

  const frequencyFields = [
    { key: 'istFrequency', label: 'Périodicité IST' },
    { key: 'cnssFrequency', label: 'Périodicité CNSS' },
    { key: 'aibFrequency', label: 'Périodicité AIB' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">Paramètres fiscaux</h3>
          <p className="text-xs text-slate-500 mt-0.5">Taux et périodicités configurables. Modifiez sans toucher au code.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg bg-[#1A2BA6] hover:opacity-90 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
        </button>
      </div>

      {/* Taux */}
      {rateFields.map((section) => (
        <div key={section.section} className="bg-white rounded-xl border border-slate-200 p-5">
          <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Percent className="h-4 w-4 text-[#1A2BA6]" /> {section.section}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {section.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">{field.label}</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={settings[field.key] ?? 0}
                    onChange={(e) => update(field.key, parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 pr-8 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Périodicités */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#1A2BA6]" /> Périodicités
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {frequencyFields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">{field.label}</label>
              <select
                value={settings[field.key] || 'MONTHLY'}
                onChange={(e) => update(field.key, e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6]"
              >
                <option value="MONTHLY">Mensuelle</option>
                <option value="QUARTERLY">Trimestrielle</option>
                <option value="ANNUAL">Annuelle</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
