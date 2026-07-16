/**
 * ============================================================================
 * LABORATORY SETTINGS (CONFIGURATION)
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Infirmerie.
 * - MOCKS hardcoded supprimés → modulesApi.get('labs/settings') au chargement
 *   + modulesApi.put('labs/settings', { key, value }) pour sauvegarder
 *   (backend GET/PUT /labs/settings désormais exposés)
 * - alert() → toast() (sauvegarde succès + erreur)
 * - Toggles CSS-only → <Switch> shadcn avec onCheckedChange
 * - rounded-3xl → rounded-xl, font-black uppercase tracking-widest → font-medium
 * - Bandeau "Paramètres Avancés" rounded-3xl border-dashed → rounded-xl
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Loader2,
  Settings,
  Shield,
  Beaker,
  Save,
  Lock,
  Workflow,
  Package,
} from 'lucide-react';
import { modulesApi } from '@/lib/modules-complementaires/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

// Définition des clés de paramètres connues.
// Chaque clé est rattachée à une section et possède un libellé + description.
interface SettingItem {
  key: string;
  label: string;
  desc: string;
}
interface SettingSection {
  title: string;
  icon: React.ElementType;
  items: SettingItem[];
}

const SETTING_SECTIONS: SettingSection[] = [
  {
    title: 'Gestion des Laboratoires',
    icon: Beaker,
    items: [
      { key: 'labs.types', label: 'Types de laboratoires', desc: 'Physique, Chimie, Biologie, Robotique...' },
      { key: 'labs.openingHours', label: 'Horaires d\'ouverture', desc: 'Définir les plages réservables par jour' },
    ],
  },
  {
    title: 'Sécurité & QHSE',
    icon: Shield,
    items: [
      { key: 'labs.safetyRules', label: 'Règles de sécurité standards', desc: 'Éditer les consignes affichées par défaut' },
      { key: 'labs.severityLevels', label: 'Niveaux de gravité', desc: 'Configurer les paliers d\'incidents' },
    ],
  },
  {
    title: 'Stocks & Inventaire',
    icon: Package,
    items: [
      { key: 'labs.stockThreshold', label: 'Seuils d\'alerte critiques', desc: 'Définir les % de stock pour alertes' },
      { key: 'labs.equipmentCategories', label: 'Catégories d\'équipement', desc: 'Mesure, Optique, Électronique...' },
    ],
  },
  {
    title: 'Réservations & Workflows',
    icon: Workflow,
    items: [
      { key: 'labs.autoValidation', label: 'Validation automatique', desc: 'Activer pour les enseignants certifiés' },
      { key: 'labs.reservationLeadTime', label: 'Délais de réservation', desc: 'Anticipation minimale (ex: 48h)' },
    ],
  },
];

// Quelques clés sont booléennes (toggle) plutôt que textuelles
const BOOLEAN_KEYS = new Set(['labs.autoValidation']);

export default function LaboratorySettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Charger les paramètres depuis le backend
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await modulesApi.get<Record<string, string> | { data: Record<string, string> }>('labs/settings');
        if (!cancelled) {
          const map = (data as any)?.data ?? data ?? {};
          setSettings(typeof map === 'object' ? map : {});
        }
      } catch (e: any) {
        if (!cancelled) {
          toast({
            title: 'Erreur de chargement',
            description: e?.response?.data?.message ?? e?.message ?? 'Impossible de charger les paramètres.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const updateSetting = async (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const saveSetting = async (key: string) => {
    try {
      setSavingKey(key);
      await modulesApi.put('labs/settings', { key, value: String(settings[key] ?? '') });
      toast({ title: 'Paramètre enregistré', description: key });
    } catch (e: any) {
      toast({
        title: 'Erreur d\'enregistrement',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la sauvegarde.',
        variant: 'destructive',
      });
    } finally {
      setSavingKey(null);
    }
  };

  const saveAll = async () => {
    try {
      setSavingKey('__all__');
      const keys = Object.keys(settings);
      for (const k of keys) {
        await modulesApi.put('labs/settings', { key: k, value: String(settings[k] ?? '') });
      }
      toast({
        title: 'Configuration enregistrée',
        description: `${keys.length} paramètre(s) mis à jour(s).`,
      });
    } catch (e: any) {
      toast({
        title: 'Erreur d\'enregistrement',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la sauvegarde.',
        variant: 'destructive',
      });
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des paramètres...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900">Configuration du Module</h3>
          <p className="text-slate-500 text-sm">Personnalisez les règles métier de vos espaces pratiques.</p>
        </div>
        <Button onClick={saveAll} disabled={savingKey === '__all__'}>
          {savingKey === '__all__' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Enregistrer
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {SETTING_SECTIONS.map((section, i) => (
          <Card key={i} className="p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 bg-slate-50 text-slate-500 rounded-xl">
                <section.icon className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-slate-900">{section.title}</h4>
                <p className="text-xs text-slate-400">{section.items.length} paramètre(s)</p>
              </div>
            </div>

            <div className="space-y-4">
              {section.items.map((item) => {
                const value = settings[item.key] ?? '';
                const isBool = BOOLEAN_KEYS.has(item.key);
                return (
                  <div key={item.key} className="space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <Label htmlFor={`set-${item.key}`} className="text-sm font-medium text-slate-800">
                          {item.label}
                        </Label>
                        <p className="text-xs text-slate-400">{item.desc}</p>
                      </div>
                      {isBool ? (
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`set-${item.key}`}
                            checked={value === 'true' || value === '1'}
                            onCheckedChange={(checked) => updateSetting(item.key, checked ? 'true' : 'false')}
                          />
                          <Badge variant="outline" className={value === 'true' || value === '1' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}>
                            {value === 'true' || value === '1' ? 'Activé' : 'Désactivé'}
                          </Badge>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => saveSetting(item.key)}
                          disabled={savingKey === item.key}
                          title="Enregistrer ce paramètre"
                        >
                          {savingKey === item.key && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                          <Save className="w-3.5 h-3.5 mr-1.5" />
                          OK
                        </Button>
                      )}
                    </div>
                    {!isBool && (
                      <Input
                        id={`set-${item.key}`}
                        value={value}
                        onChange={(e) => updateSetting(item.key, e.target.value)}
                        placeholder="Valeur..."
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {/* Advanced Settings Placeholder */}
      <Card className="p-8 shadow-sm border-2 border-dashed border-slate-200 text-center">
        <Lock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h4 className="text-base font-semibold text-slate-500">Paramètres Avancés</h4>
        <p className="text-slate-400 text-xs max-w-xs mx-auto mt-2">
          L&apos;accès aux API et aux journaux d&apos;audit nécessite une autorisation de la direction technique.
        </p>
      </Card>
    </div>
  );
}
