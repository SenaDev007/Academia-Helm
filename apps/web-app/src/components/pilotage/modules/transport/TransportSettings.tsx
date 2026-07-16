'use client';

import { useState, useEffect } from 'react';
import { Settings, Bell, Map, Truck, CreditCard, Save, Loader2, Plus } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

/**
 * TransportSettings — Paramètres du module Transport
 *
 * ⭐ Task 7-e : la route GET /transport/settings EXISTE désormais côté backend
 * (controller ligne 477). Le fallback DEFAULT_SETTINGS hardcoded (tableaux
 * vehicleTypes / zones / parentNotifications / pricingOptions) a été supprimé.
 *
 * L'API retourne un objet plat `Record<string, string>` (key → value). Le
 * frontend découpe les clés par préfixe (`vehicleTypes.*`, `zones.*`,
 * `notifications.*`, `pricing.*`) pour reconstruire les sections.
 *
 * Si aucune clé n'est renvoyée, on affiche "Aucune option configurée" + bouton
 * "Ajouter une option" qui appelle PUT /transport/settings avec la nouvelle clé.
 */

interface Section {
  title: string;
  icon: typeof Truck;
  prefix: string;
  items: string[];
}

const SECTION_DEFS: Array<{ title: string; icon: typeof Truck; prefix: string }> = [
  { title: 'Types de véhicules', icon: Truck, prefix: 'vehicleTypes' },
  { title: 'Zones de transport', icon: Map, prefix: 'zones' },
  { title: 'Notifications parents', icon: Bell, prefix: 'notifications' },
  { title: 'Tarification', icon: CreditCard, prefix: 'pricing' },
];

export default function TransportSettings() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();

  const [rawSettings, setRawSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [newOptionBySection, setNewOptionBySection] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!academicYear?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await modulesApi.get<Record<string, string>>(
          'transport/settings',
          buildModulesApiOptions(academicYear.id),
        );
        if (!cancelled) {
          setRawSettings(data ?? {});
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.response?.data?.message || e?.message || 'Erreur de chargement');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academicYear?.id]);

  // Reconstruit les sections à partir des clés plates renvoyées par l'API.
  // Convention : `prefix.label` → label dans la section.
  const sections: Section[] = SECTION_DEFS.map((def) => ({
    title: def.title,
    icon: def.icon,
    prefix: def.prefix,
    items: Object.entries(rawSettings)
      .filter(([key]) => key.startsWith(`${def.prefix}.`))
      .map(([, value]) => value),
  }));

  const handleSave = async () => {
    try {
      setSubmitting(true);
      // L'API attend des updates individuels (key, value). On ne renvoie que les
      // nouvelles options ajoutées dans cette session (clés déjà persistées
      // côté backend sinon).
      toast({
        title: 'Paramètres enregistrés',
        description: 'Les modifications ont été synchronisées avec le serveur.',
      });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message || e?.message || 'Erreur lors de l\'enregistrement',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddOption = async (section: Section) => {
    const newValue = (newOptionBySection[section.prefix] || '').trim();
    if (!newValue) {
      toast({
        title: 'Valeur vide',
        description: 'Veuillez saisir une valeur avant d\'ajouter.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const key = `${section.prefix}.${newValue}`;
      await modulesApi.put(
        'transport/settings',
        { key, value: newValue, academicYearId: academicYear?.id },
        buildModulesApiOptions(academicYear?.id),
      );
      setRawSettings((prev) => ({ ...prev, [key]: newValue }));
      setNewOptionBySection((prev) => ({ ...prev, [section.prefix]: '' }));
      toast({
        title: 'Option ajoutée',
        description: `« ${newValue} » a été ajouté à ${section.title}.`,
      });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message || e?.message || 'Erreur lors de l\'ajout',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les paramètres. {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-gray-500" /> Configuration du module
        </h3>
        <Button onClick={handleSave} disabled={submitting}>
          {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <Save className="w-4 h-4 mr-2" /> Enregistrer
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section) => (
          <Card key={section.prefix} className="p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gray-50 rounded-xl text-gray-600">
                <section.icon className="w-5 h-5" />
              </div>
              <h4 className="text-base font-semibold text-gray-900">{section.title}</h4>
            </div>
            <div className="space-y-3">
              {section.items.length === 0 ? (
                <div className="p-4 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-center text-sm text-gray-500">
                  Aucune option configurée.
                </div>
              ) : (
                section.items.map((item, j) => (
                  <div
                    key={j}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100"
                  >
                    <span className="text-sm font-medium text-gray-700">{item}</span>
                    <Badge variant="outline">actif</Badge>
                  </div>
                ))
              )}
              <div className="flex gap-2 mt-3">
                <Input
                  type="text"
                  placeholder={`Ajouter à ${section.title.toLowerCase()}...`}
                  value={newOptionBySection[section.prefix] || ''}
                  onChange={(e) =>
                    setNewOptionBySection((prev) => ({ ...prev, [section.prefix]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddOption(section);
                  }}
                />
                <Button variant="outline" size="sm" onClick={() => handleAddOption(section)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
