/**
 * ============================================================================
 * QHSE MODULE SETTINGS (Standardisé)
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Settings, Shield, Trash2, Save, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

export default function QHSESettings() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

  useEffect(() => {
    if (!academicYear?.id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await modulesApi.get('qhse/settings', buildModulesApiOptions(academicYear.id));
        if (!cancelled) setSettings(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academicYear?.id]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await modulesApi.put('qhse/settings', settings ?? {}, buildModulesApiOptions(academicYear?.id));
      toast({ title: 'Paramètres enregistrés', description: 'Les paramètres QHSE ont été sauvegardés.' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || "Erreur lors de l'enregistrement", variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleSetting = (key: string) => {
    setSettings((prev: any) => ({ ...(prev ?? {}), [key]: !prev?.[key] }));
  };

  const updateNumber = (key: string, value: number) => {
    setSettings((prev: any) => ({ ...(prev ?? {}), [key]: value }));
  };

  const sections = [
    { title: 'Configuration Générale', icon: Settings, desc: 'Paramètres du module et seuils de criticité.' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des paramètres QHSE...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les paramètres. {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Nav */}
        <div className="lg:col-span-1 space-y-2">
          {sections.map((section, i) => (
            <Button
              key={i}
              variant={activeSection === i ? 'default' : 'ghost'}
              className={`w-full justify-start ${activeSection === i ? '' : 'text-slate-500'}`}
              onClick={() => setActiveSection(i)}
            >
              <section.icon className="w-5 h-5 mr-2" />
              <span className="text-xs font-semibold">{section.title}</span>
            </Button>
          ))}
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="p-8 shadow-sm space-y-8">
            <div className="space-y-2 border-b border-slate-100 pb-6">
              <h3 className="text-2xl font-semibold text-slate-900">Configuration Générale</h3>
              <p className="text-slate-500">Définissez les règles métier du module QHSE.</p>
            </div>

            <div className="space-y-6">
              {/* Setting Item */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">Signalement Mobile</p>
                  <p className="text-xs text-slate-400">Autoriser les enseignants à signaler des incidents via l'application mobile.</p>
                </div>
                <Switch
                  checked={!!settings?.mobileReporting}
                  onCheckedChange={() => toggleSetting('mobileReporting')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">Anonymat des Risques</p>
                  <p className="text-xs text-slate-400">Permettre le signalement anonyme des risques par le personnel.</p>
                </div>
                <Switch
                  checked={!!settings?.anonymousRisks}
                  onCheckedChange={() => toggleSetting('anonymousRisks')}
                />
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-400">Seuil d'Alerte Critique (Score)</p>
                <div className="flex items-center gap-6">
                  <Input
                    type="range"
                    min={0}
                    max={100}
                    value={settings?.criticalThreshold ?? 75}
                    onChange={(e) => updateNumber('criticalThreshold', Number(e.target.value))}
                    className="flex-1 accent-emerald-600"
                  />
                  <span className="text-xl font-semibold text-emerald-600">{settings?.criticalThreshold ?? 75}%</span>
                </div>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-between">
              <Button variant="ghost" className="text-rose-600 hover:bg-rose-50">
                <Trash2 className="w-4 h-4 mr-2" /> Réinitialiser
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Enregistrer les Modifications
              </Button>
            </div>
          </Card>

          <div className="bg-amber-50 border border-amber-100 p-6 rounded-xl flex items-start gap-4">
            <Shield className="w-8 h-8 text-amber-600 shrink-0" />
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-amber-900">Protection des Données QHSE</h4>
              <p className="text-xs text-amber-800/70 leading-relaxed">
                Certaines données de santé (infirmerie) et de sécurité sont soumises à des restrictions de confidentialité strictes. Assurez-vous que vos paramètres respectent la réglementation en vigueur.
              </p>
              <Button variant="link" className="text-amber-900 underline h-auto p-0 text-xs">Consulter la Politique RGPD</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
